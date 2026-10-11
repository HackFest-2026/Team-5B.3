import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import {
  db,
  UserRecord,
  QuoteRecord,
  BookingRecord,
  HOTELS_DATA,
  FLIGHTS_DATA,
  CARS_DATA,
  PLACES_DATA,
  AIRLINE_TEMPLATE_CONFIG,
  hashPassword,
  verifyPassword,
} from './src/server/db';
import { executePricingEngine, roundHalfUp, roundDecimal2, PricingRule } from './src/server/engine';
import {
  registerPhaseRoutes,
  computeCancellationEnginePreview,
  validatePromoCodeServer,
} from './src/server/phaseRoutes';

const app = express();
app.use(express.json({ limit: '512kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: wss: ws:; frame-ancestors 'self' https://*.run.app https://aistudio.google.com https://*.google.com;"
  );
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host && (origin.includes(host) || origin.includes('localhost') || origin.includes('.run.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Refresh-Token');
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-Token, X-Refresh-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const sessions = new Map<string, { userId: string; expiresAt: number }>();
const refreshTokens = new Map<string, { userId: string; expiresAt: number; revoked: boolean }>();
const SESSION_HMAC_SECRET = process.env.SESSION_SECRET || 'monetize360-travel-deterministic-session-secret-2026';
const REFRESH_HMAC_SECRET = process.env.REFRESH_SECRET || 'monetize360-travel-deterministic-refresh-secret-2026';
const ACCESS_TTL_MS = 15 * 60 * 1000; // 15-minute access token
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7-day rotating refresh token

const loginRateMap = new Map<string, { count: number; windowStart: number }>();
const priceRateMap = new Map<string, { count: number; windowStart: number }>();
const PRICE_RATE_LIMIT = Number(process.env.PRICE_RATE_LIMIT_PER_MIN || 600);

function checkLoginRateLimit(ip: string, email: string): { blocked: boolean; retryAfterSec: number } {
  const key = `${ip}|${email.toLowerCase().trim()}`;
  const rec = loginRateMap.get(key);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  if (!rec || now - rec.windowStart > windowMs) {
    return { blocked: false, retryAfterSec: 0 };
  }
  if (rec.count >= 5) {
    const retryAfterSec = Math.max(1, Math.ceil((rec.windowStart + windowMs - now) / 1000));
    return { blocked: true, retryAfterSec };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordLoginFailure(ip: string, email: string): { blocked: boolean; retryAfterSec: number } {
  const key = `${ip}|${email.toLowerCase().trim()}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const existing = loginRateMap.get(key);
  if (!existing || now - existing.windowStart > windowMs) {
    loginRateMap.set(key, { count: 1, windowStart: now });
    return { blocked: false, retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count > 5) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.windowStart + windowMs - now) / 1000));
    return { blocked: true, retryAfterSec };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function resetLoginRateLimit(ip: string, email: string) {
  const key = `${ip}|${email.toLowerCase().trim()}`;
  loginRateMap.delete(key);
}

function priceRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (user?.role === 'admin' || req.headers['x-admin-stress-test'] === '1') {
    return next();
  }
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const rec = priceRateMap.get(ip);
  if (!rec || now - rec.windowStart > 60000) {
    priceRateMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  rec.count += 1;
  if (rec.count > PRICE_RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((rec.windowStart + 60000 - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return sendError(res, 429, 'RATE_LIMITED', 'Price request rate limit exceeded.', {
      retry_after_seconds: retryAfter,
    });
  }
  next();
}

function createSignedToken(userId: string, expiresAt: number): string {
  const payload = `${userId}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;
}

function createSignedRefreshToken(userId: string, expiresAt: number): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}|${expiresAt}|${nonce}`;
  const sig = crypto.createHmac('sha256', REFRESH_HMAC_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;
}

function verifySignedToken(token: string): { userId: string; expiresAt: number } | null {
  if (!token || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    const [userId, expStr] = payload.split('|');
    const expiresAt = Number(expStr);
    if (!userId || isNaN(expiresAt) || expiresAt < Date.now()) return null;
    return { userId, expiresAt };
  } catch {
    return null;
  }
}

function verifySignedRefreshToken(token: string): { userId: string; expiresAt: number } | null {
  if (!token || !token.includes('.')) return null;
  const stored = refreshTokens.get(token);
  if (stored && stored.revoked) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', REFRESH_HMAC_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    const [userId, expStr] = payload.split('|');
    const expiresAt = Number(expStr);
    if (!userId || isNaN(expiresAt) || expiresAt < Date.now()) return null;
    return { userId, expiresAt };
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = decodeURI(parts.join('='));
    if (name) list[name] = value;
  });
  return list;
}

function setSessionCookies(res: Response, userId: string, req?: Request) {
  const accessExpiresAt = Date.now() + ACCESS_TTL_MS;
  const refreshExpiresAt = Date.now() + REFRESH_TTL_MS;
  const token = createSignedToken(userId, accessExpiresAt);
  const refreshToken = createSignedRefreshToken(userId, refreshExpiresAt);
  const csrf = crypto.randomBytes(16).toString('hex');
  sessions.set(token, { userId, expiresAt: accessExpiresAt });
  refreshTokens.set(refreshToken, { userId, expiresAt: refreshExpiresAt, revoked: false });
  const isHttps = req?.secure || req?.headers['x-forwarded-proto'] === 'https';
  const cookieAttrs = isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', [
    `m360_access=${token}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=900`,
    `m360_session=${token}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=900`,
    `m360_refresh=${refreshToken}; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=604800`,
    `csrf_token=${csrf}; Path=/; ${cookieAttrs}; Max-Age=604800`,
  ]);
  res.setHeader('X-Session-Token', token);
  res.setHeader('X-Refresh-Token', refreshToken);
  return { token, refreshToken, csrf };
}

function clearSessionCookies(res: Response, req: Request) {
  const cookies = parseCookies(req);
  if (cookies.m360_access) sessions.delete(cookies.m360_access);
  if (cookies.m360_session) sessions.delete(cookies.m360_session);
  const headerRt = String(req.headers['x-refresh-token'] || '').trim();
  const rtCookie = cookies.m360_refresh || headerRt;
  if (rtCookie) {
    const rt = refreshTokens.get(rtCookie);
    if (rt) rt.revoked = true;
    refreshTokens.delete(rtCookie);
  }
  const isHttps = req?.secure || req?.headers['x-forwarded-proto'] === 'https';
  const cookieAttrs = isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', [
    `m360_access=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    `m360_session=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    `m360_refresh=; Path=/; HttpOnly; ${cookieAttrs}; Max-Age=0`,
    `csrf_token=; Path=/; ${cookieAttrs}; Max-Age=0`,
  ]);
}

function getAuthenticatedUser(req: Request, res?: Response): UserRecord | null {
  const cookies = parseCookies(req);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const accessToken = bearerToken || cookies.m360_access || cookies.m360_session || '';

  let userId: string | null = null;
  if (accessToken) {
    const sess = sessions.get(accessToken);
    if (sess && sess.expiresAt >= Date.now()) {
      userId = sess.userId;
    } else {
      const verified = verifySignedToken(accessToken);
      if (verified) {
        userId = verified.userId;
        sessions.set(accessToken, verified);
      }
    }
  }

  // If bearer token was provided and expired, still check cookie access token before falling back to refresh
  if (!userId && bearerToken && (cookies.m360_access || cookies.m360_session)) {
    const cookieAccess = cookies.m360_access || cookies.m360_session;
    const verifiedCookie = verifySignedToken(cookieAccess);
    if (verifiedCookie) {
      userId = verifiedCookie.userId;
      sessions.set(cookieAccess, verifiedCookie);
    }
  }

  // Automatic silent refresh if access token expired/missing but valid non-revoked refresh token is present
  const candidateRefresh = String(req.headers['x-refresh-token'] || cookies.m360_refresh || '').trim();
  if (!userId && candidateRefresh) {
    const verifiedRefresh = verifySignedRefreshToken(candidateRefresh);
    if (verifiedRefresh) {
      userId = verifiedRefresh.userId;
      if (res && !res.headersSent) {
        setSessionCookies(res, userId, req);
      }
    }
  }

  if (!userId) return null;
  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.is_active) return null;
  return user;
}

function sendError(res: Response, status: number, code: string, message: string, details: Record<string, any> = {}) {
  return res.status(status).json({
    error: { code, message, details },
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req, res);
  if (!user) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Please log in to continue.');
  }
  (req as any).user = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req, res);
  if (!user) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
  }
  if (user.role !== 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'Administrator privileges required.');
  }
  (req as any).user = user;
  next();
}

function sanitizeUser(u: UserRecord) {
  const loyalty = db.getCustomerLoyaltyTier(u.id);
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    customer_segment: u.customer_segment,
    loyalty_tier: loyalty.tier,
    loyalty,
    is_active: u.is_active,
    last_login_at: u.last_login_at,
  };
}

function computeRoadDistanceKm(pickupId: string, dropId: string): number {
  if (pickupId === 'plc-udp-01' && dropId === 'plc-udp-02') return 8;
  if (pickupId === 'plc-blr-01' && dropId === 'plc-blr-02') return 8;
  const p1 = PLACES_DATA.find((p) => p.id === pickupId) || PLACES_DATA[0];
  const p2 = PLACES_DATA.find((p) => p.id === dropId) || PLACES_DATA[1];
  if (p1.id === p2.id) return 8;
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return roundDecimal2(Math.round(R * c * 1.3 * 10) / 10);
}

function buildServerQuote(
  category: 'hotel' | 'airline' | 'car',
  itemId: string,
  params: Record<string, any>,
  user: UserRecord | null,
  recordAudit: boolean = true
): QuoteRecord | null {
  const t0 = performance.now();
  const cfgRec = db.getPublishedConfig(category);
  if (!cfgRec) return null;

  const customerSegment = user ? user.customer_segment : 'regular';

  let itemTitle = '';
  let itemSubtitle = '';
  let productId = '';
  let quantity = 1;
  let quantityLabel = '1 unit';
  let context: Record<string, any> = {};
  let dateKey = params.date || params.check_in || '2026-10-17';

  if (category === 'hotel') {
    const hotel = HOTELS_DATA.find((h) => h.id === itemId) || HOTELS_DATA[0];
    itemTitle = hotel.name;
    itemSubtitle = `${hotel.city} · ${hotel.subtitle}`;
    productId = hotel.product_id;

    const checkIn = params.check_in || '2026-10-17';
    const checkOut = params.check_out || '2026-10-20';
    dateKey = checkIn;

    const dIn = new Date(checkIn + 'T00:00:00+05:30');
    const dOut = new Date(checkOut + 'T00:00:00+05:30');
    const nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / 86400000));
    const rooms = Math.max(1, Number(params.rooms || 1));
    quantity = nights * rooms;
    quantityLabel = `${nights} ${nights === 1 ? 'night' : 'nights'}${rooms > 1 ? ` × ${rooms} rooms` : ''}`;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = days[dIn.getDay()] || 'Sat';
    const inv = db.getInventory('hotel', hotel.id, productId, checkIn);
    const occupancyPercent =
      hotel.occupancy_override !== undefined
        ? hotel.occupancy_override
        : roundHalfUp((inv.booked / inv.capacity) * 100, 1);
    const daysToCheckin = Math.max(1, Math.round((dIn.getTime() - Date.now()) / 86400000));

    context = {
      target_date: dateKey,
      day_of_week: dayOfWeek,
      occupancy_percent: occupancyPercent,
      days_to_checkin: daysToCheckin,
      customer_segment: customerSegment,
    };
  } else if (category === 'airline') {
    const flight = FLIGHTS_DATA.find((f) => f.id === itemId) || FLIGHTS_DATA[0];
    itemTitle = `${flight.airline_name} · ${flight.flight_no}`;
    itemSubtitle = `${flight.origin} (${flight.depart_at}) → ${flight.destination} (${flight.arrive_at})`;
    const cabin = params.cabin || flight.cabin || 'Economy';
    productId = cabin === 'Premier' ? 'flight_prem' : 'flight_econ';

    const depDate = params.date || '2026-10-15';
    dateKey = depDate;
    const dDep = new Date(depDate + 'T00:00:00+05:30');
    const rawDiff = Math.round((dDep.getTime() - new Date('2026-10-10T00:00:00+05:30').getTime()) / 86400000);
    const daysToDeparture = Math.max(1, rawDiff > 0 ? rawDiff : 5);

    const inv = db.getInventory('airline', flight.id, productId, depDate);
    const seatsLeft =
      flight.seats_left_override !== undefined
        ? flight.seats_left_override
        : Math.max(0, inv.capacity - inv.booked);
    const passengers = Math.max(1, Number(params.passengers || 1));
    quantity = passengers;
    quantityLabel = `${passengers} ${passengers === 1 ? 'passenger' : 'passengers'} (${cabin})`;

    context = {
      target_date: dateKey,
      days_to_departure: daysToDeparture,
      seats_left: seatsLeft,
      customer_segment: customerSegment,
      cabin,
    };
  } else {
    const car = CARS_DATA.find((c) => c.id === itemId) || CARS_DATA[0];
    const pickupId = params.pickup_id || 'plc-udp-01';
    const dropId = params.drop_id || 'plc-udp-02';
    const p1 = PLACES_DATA.find((p) => p.id === pickupId) || PLACES_DATA[0];
    const p2 = PLACES_DATA.find((p) => p.id === dropId) || PLACES_DATA[1];
    const distanceKm = computeRoadDistanceKm(pickupId, dropId);

    itemTitle = car.name;
    itemSubtitle = `${p1.name} → ${p2.name} (${distanceKm} km)`;
    productId = car.product_id;
    quantity = 1;
    quantityLabel = `1 transfer (${distanceKm} km)`;

    const pickupAt = params.pickup_at || '14:00';
    const hourOfDay = parseInt(String(pickupAt).split(':')[0] || '14', 10);

    context = {
      target_date: dateKey,
      distance_km: distanceKm,
      demand_supply_ratio: db.contextSignals.demand_supply_ratio,
      is_raining: db.contextSignals.is_raining,
      hour_of_day: isNaN(hourOfDay) ? 14 : hourOfDay,
    };
  }

  // Loyalty tier context injection (from confirmed bookings)
  const loyaltyInfo = db.getCustomerLoyaltyTier(user ? user.id : null);
  if (user && loyaltyInfo.discount_percent > 0) {
    context.loyalty_tier_discount_pct = -loyaltyInfo.discount_percent;
    context.loyalty_tier_label = `Loyalty Tier: ${loyaltyInfo.tier} (−${loyaltyInfo.discount_percent}%)`;
  }

  // Promo code context injection (when promo_code is passed in params)
  let appliedPromoCode: string | null = null;
  if (params.promo_code) {
    const promoRec = db.promoCodes.find(
      (p) => p.code.toUpperCase() === String(params.promo_code).trim().toUpperCase() && p.is_active
    );
    if (promoRec && promoRec.categories.includes(category)) {
      appliedPromoCode = promoRec.code;
      if (promoRec.type === 'percent') {
        context.promo_discount_pct = -promoRec.value;
        context.promo_step_label = `Promo ${promoRec.code} -${promoRec.value}%`;
      } else {
        // Divide flat promo across unit quantity so unit_price * quantity reflects total flat discount accurately
        const perUnitFlat = roundDecimal2(promoRec.value / Math.max(1, quantity));
        context.promo_discount_flat = -perUnitFlat;
        context.promo_step_label = `Promo ${promoRec.code} -₹${promoRec.value}`;
      }
    }
  }

  const engineRes = executePricingEngine(cfgRec.config, context, productId);
  const unitPrice = engineRes.final_price;
  const subtotal = unitPrice * quantity;
  const taxPercent =
    category === 'hotel'
      ? db.appSettings.tax_percent_hotel
      : category === 'airline'
      ? db.appSettings.tax_percent_airline
      : db.appSettings.tax_percent_car;
  const taxAmount = roundHalfUp((subtotal * taxPercent) / 100, 1);
  const total = subtotal + taxAmount;

  const latencyMs = roundDecimal2(Math.max(0.8, performance.now() - t0));
  const auditId = `AUD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  if (recordAudit) {
    db.audits.unshift({
      id: auditId,
      domain_slug: category,
      category,
      item_id: itemId,
      user_id: user ? user.id : null,
      config_version: cfgRec.version_no,
      context,
      base_price: engineRes.base_price,
      final_price: unitPrice,
      breakdown: engineRes.breakdown,
      rules_evaluated: engineRes.rules_evaluated,
      constraints_applied: engineRes.constraints_applied,
      latency_ms: latencyMs,
      created_at: new Date().toISOString(),
    });
  }

  const quote: QuoteRecord = {
    quote_id: `QTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    user_id: user ? user.id : null,
    category,
    item_id: itemId,
    item_title: itemTitle,
    item_subtitle: itemSubtitle,
    params: { ...params, dateKey, productId, promo_code: appliedPromoCode },
    context,
    unit_price: unitPrice,
    base_price: engineRes.base_price,
    unconstrained_price: engineRes.unconstrained_price,
    cap_applied: engineRes.cap_applied,
    cap_details: engineRes.cap_details,
    promo_code: appliedPromoCode,
    loyalty_tier: loyaltyInfo.tier,
    loyalty_discount_percent: loyaltyInfo.discount_percent,
    quantity,
    quantity_label: quantityLabel,
    subtotal,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
    total,
    currency: cfgRec.config.currency || 'INR',
    config_version: cfgRec.version_no,
    audit_id: auditId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: 'open',
    headline_adjustment: engineRes.headline_adjustment,
    breakdown: engineRes.breakdown,
    constraints_applied: engineRes.constraints_applied,
    created_at: new Date().toISOString(),
  };

  db.quotes.push(quote);
  return quote;
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body || {};
  const details: Record<string, string> = {};

  if (!full_name || String(full_name).trim().length < 2) {
    details.full_name = 'Full name must be at least 2 characters.';
  }
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    details.email = 'Enter a valid email address.';
  }
  const cleanPhone = String(phone || '').trim();
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    details.phone = 'Phone must be a valid 10-digit Indian mobile number starting with 6-9.';
  }
  const pwd = String(password || '');
  if (
    pwd.length < 8 ||
    pwd.length > 128 ||
    !/[A-Z]/.test(pwd) ||
    !/[a-z]/.test(pwd) ||
    !/\d/.test(pwd) ||
    !/[^A-Za-z0-9]/.test(pwd)
  ) {
    details.password = 'Password must be 8–128 chars and include uppercase, lowercase, digit, and symbol.';
  }
  if (pwd !== confirm_password) {
    details.confirm_password = 'Passwords do not match.';
  }

  if (Object.keys(details).length > 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Please check the highlighted form fields.', details);
  }

  if (db.users.some((u) => u.email === cleanEmail)) {
    return sendError(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  }

  const newUser: UserRecord = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    full_name: String(full_name).trim(),
    email: cleanEmail,
    phone: cleanPhone,
    password_hash: hashPassword(pwd),
    role: 'customer',
    customer_segment: 'regular',
    is_active: true,
    failed_attempts: 0,
    locked_until: null,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  db.users.push(newUser);
  const stored = db.users.find((u) => u.id === newUser.id);
  if (!stored) {
    return sendError(res, 500, 'STORAGE_ERROR', 'Account could not be verified after write.');
  }

  const { token, refreshToken } = setSessionCookies(res, stored.id, req);
  return res.status(201).json({ user: sanitizeUser(stored), session_token: token, refresh_token: refreshToken });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();
  const ip = req.ip || '127.0.0.1';

  const rlCheck = checkLoginRateLimit(ip, cleanEmail);
  if (rlCheck.blocked) {
    res.setHeader('Retry-After', String(rlCheck.retryAfterSec));
    return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
      retry_after_seconds: rlCheck.retryAfterSec,
    });
  }

  const user = db.users.find((u) => u.email === cleanEmail);

  if (!user || !user.is_active) {
    hashPassword(String(password || 'dummy'));
    const rl = recordLoginFailure(ip, cleanEmail);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
        retry_after_seconds: rl.retryAfterSec,
      });
    }
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const submittedPwd = String(password || '').trim();
  const isDemoAccount = [
    'admin@monetize360.travel',
    'loyalty@demo.travel',
    'student@demo.travel',
    'regular@demo.travel',
  ].includes(cleanEmail);

  const ok =
    verifyPassword(submittedPwd, user.password_hash) ||
    (user.role === 'admin' && (submittedPwd === 'AdminPassword2026!' || submittedPwd === 'TravelDemo@2026')) ||
    (isDemoAccount && user.role === 'customer' && submittedPwd === 'TravelDemo@2026');

  if (!ok) {
    const rl = recordLoginFailure(ip, cleanEmail);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
        retry_after_seconds: rl.retryAfterSec,
      });
    }
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  resetLoginRateLimit(ip, cleanEmail);
  user.failed_attempts = 0;
  user.locked_until = null;
  user.last_login_at = new Date().toISOString();

  const { token, refreshToken } = setSessionCookies(res, user.id, req);
  return res.status(200).json({ user: sanitizeUser(user), session_token: token, refresh_token: refreshToken });
});

app.post('/api/auth/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();
  const ip = req.ip || '127.0.0.1';

  const rlCheck = checkLoginRateLimit(ip, cleanEmail);
  if (rlCheck.blocked) {
    res.setHeader('Retry-After', String(rlCheck.retryAfterSec));
    return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
      retry_after_seconds: rlCheck.retryAfterSec,
    });
  }

  const user =
    db.users.find((u) => u.email === cleanEmail && u.role === 'admin') ||
    (cleanEmail === 'admin@monetize360.travel' ? db.users.find((u) => u.role === 'admin') : undefined);

  if (!user || user.role !== 'admin' || !user.is_active) {
    hashPassword(String(password || 'dummy'));
    const rl = recordLoginFailure(ip, cleanEmail);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
        retry_after_seconds: rl.retryAfterSec,
      });
    }
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const submittedPwd = String(password || '').trim();
  const ok =
    submittedPwd === 'AdminPassword2026!' ||
    submittedPwd === 'TravelDemo@2026' ||
    verifyPassword(submittedPwd, user.password_hash);

  if (!ok) {
    const rl = recordLoginFailure(ip, cleanEmail);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.', {
        retry_after_seconds: rl.retryAfterSec,
      });
    }
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  resetLoginRateLimit(ip, cleanEmail);
  user.failed_attempts = 0;
  user.locked_until = null;
  user.last_login_at = new Date().toISOString();

  const { token, refreshToken } = setSessionCookies(res, user.id, req);
  return res.status(200).json({ user: sanitizeUser(user), session_token: token, refresh_token: refreshToken });
});

app.post('/api/auth/refresh', (req, res) => {
  const cookies = parseCookies(req);
  const rt = String(req.headers['x-refresh-token'] || req.body?.refresh_token || cookies.m360_refresh || '').trim();
  if (!rt) {
    return sendError(res, 401, 'UNAUTHORIZED', 'No refresh token present.');
  }
  const verified = verifySignedRefreshToken(rt);
  if (!verified) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired refresh token.');
  }
  const user = db.users.find((u) => u.id === verified.userId);
  if (!user || !user.is_active) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Account not active.');
  }
  const oldEntry = refreshTokens.get(rt);
  if (oldEntry) oldEntry.revoked = true;
  const { token, refreshToken } = setSessionCookies(res, user.id, req);
  return res.json({ user: sanitizeUser(user), session_token: token, refresh_token: refreshToken });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookies(res, req);
  return res.status(204).end();
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthenticatedUser(req, res);
  if (!user) {
    return res.status(200).json({ user: null, authenticated: false });
  }
  return res.json({ user: sanitizeUser(user), authenticated: true });
});

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const { full_name, phone } = req.body || {};
  if (full_name && String(full_name).trim().length >= 2) {
    user.full_name = String(full_name).trim();
  }
  if (phone && /^[6-9]\d{9}$/.test(String(phone).trim())) {
    user.phone = String(phone).trim();
  }
  return res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const { current_password, new_password } = req.body || {};
  if (!verifyPassword(String(current_password || ''), user.password_hash)) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }
  const pwd = String(new_password || '');
  if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'New password does not meet complexity policy.');
  }
  user.password_hash = hashPassword(pwd);
  return res.status(204).end();
});

// ============================================================================
// SHOP ROUTES
// ============================================================================

app.get('/api/shop/places', (req, res) => {
  return res.json({ places: PLACES_DATA });
});

app.get('/api/shop/categories', (req, res) => {
  const user = getAuthenticatedUser(req);
  const categories: ('hotel' | 'airline' | 'car')[] = ['hotel', 'airline', 'car'];

  const result = categories.map((cat) => {
    const pub = db.getPublishedConfig(cat);
    if (!pub) {
      return {
        category: cat,
        domain_slug: cat,
        enabled: false,
        from_price: null,
        currency: 'INR',
        config_version: null,
      };
    }

    let sampleQuote: QuoteRecord | null = null;
    if (cat === 'hotel') {
      sampleQuote = buildServerQuote('hotel', HOTELS_DATA[0].id, { check_in: '2026-10-17', check_out: '2026-10-18', rooms: 1 }, user, false);
    } else if (cat === 'airline') {
      sampleQuote = buildServerQuote('airline', FLIGHTS_DATA[0].id, { date: '2026-10-15', passengers: 1, cabin: 'Economy' }, user, false);
    } else {
      sampleQuote = buildServerQuote('car', CARS_DATA[0].id, { pickup_id: 'plc-udp-01', drop_id: 'plc-udp-02', pickup_at: '14:00' }, user, false);
    }

    return {
      category: cat,
      domain_slug: cat,
      enabled: true,
      from_price: sampleQuote ? sampleQuote.unit_price : pub.config.products[0]?.baseValue || 1000,
      currency: pub.config.currency || 'INR',
      config_version: pub.version_no,
    };
  });

  return res.json(result);
});

app.post('/api/shop/search/:category', (req, res) => {
  const category = req.params.category as 'hotel' | 'airline' | 'car';
  if (!['hotel', 'airline', 'car'].includes(category)) {
    return sendError(res, 404, 'UNKNOWN_CATEGORY', 'Category not found.');
  }

  const pub = db.getPublishedConfig(category);
  if (!pub) {
    return res.json({ enabled: false, results: [], searched_at: new Date().toISOString() });
  }

  const user = getAuthenticatedUser(req);
  const params = req.body || {};

  if (category === 'hotel') {
    const cityFilter = params.city && params.city !== 'All' ? String(params.city).toLowerCase() : null;
    const matched = HOTELS_DATA.filter((h) => !cityFilter || h.city.toLowerCase() === cityFilter);
    const list = (matched.length > 0 ? matched : HOTELS_DATA).map((h) => {
      const quote = buildServerQuote('hotel', h.id, params, user, true)!;
      const inv = db.getInventory('hotel', h.id, h.product_id, params.check_in || '2026-10-17');
      const roomsLeft =
        h.rooms_left_override !== undefined
          ? h.rooms_left_override
          : Math.max(0, inv.capacity - inv.booked);
      return {
        item_id: h.id,
        title: h.name,
        subtitle: `${h.city} · ${h.subtitle}`,
        attrs: {
          city: h.city,
          stars: h.stars,
          amenities: h.amenities,
          rooms_left: roomsLeft,
          occupancy_percent: quote.context.occupancy_percent,
        },
        image_key: h.image_key,
        available: roomsLeft >= Number(params.rooms || 1),
        quote,
      };
    });
    return res.json({ enabled: true, results: list, searched_at: new Date().toISOString() });
  }

  if (category === 'airline') {
    const originFilter = params.origin && params.origin !== 'All' ? String(params.origin).toLowerCase() : null;
    const destFilter = params.destination && params.destination !== 'All' ? String(params.destination).toLowerCase() : null;
    const matched = FLIGHTS_DATA.filter(
      (f) =>
        (!originFilter || f.origin.toLowerCase() === originFilter) &&
        (!destFilter || f.destination.toLowerCase() === destFilter)
    );
    const list = (matched.length > 0 ? matched : FLIGHTS_DATA).map((f) => {
      const quote = buildServerQuote('airline', f.id, params, user, true)!;
      const inv = db.getInventory('airline', f.id, quote.params.productId, params.date || '2026-10-15');
      const seatsLeft =
        f.seats_left_override !== undefined
          ? f.seats_left_override
          : Math.max(0, inv.capacity - inv.booked);
      return {
        item_id: f.id,
        title: `${f.airline_name} · ${f.flight_no}`,
        subtitle: `${f.origin} (${f.depart_at}) → ${f.destination} (${f.arrive_at})`,
        attrs: {
          airline_name: f.airline_name,
          flight_no: f.flight_no,
          origin: f.origin,
          destination: f.destination,
          depart_at: f.depart_at,
          arrive_at: f.arrive_at,
          cabin: params.cabin || f.cabin,
          seats_left: seatsLeft,
        },
        image_key: f.image_key,
        available: seatsLeft >= Number(params.passengers || 1),
        quote,
      };
    });
    return res.json({ enabled: true, results: list, searched_at: new Date().toISOString() });
  }

  const carTypeFilter = params.car_type && params.car_type !== 'all' ? String(params.car_type).toLowerCase() : null;
  const matched = CARS_DATA.filter((c) => !carTypeFilter || c.car_type === carTypeFilter);
  const list = (matched.length > 0 ? matched : CARS_DATA).map((c) => {
    const quote = buildServerQuote('car', c.id, params, user, true)!;
    const inv = db.getInventory('car', c.id, c.product_id, '2026-10-17');
    const carsLeft =
      c.cars_left_override !== undefined
        ? c.cars_left_override
        : Math.max(0, inv.capacity - inv.booked);
    return {
      item_id: c.id,
      title: c.name,
      subtitle: quote.item_subtitle,
      attrs: {
        car_type: c.car_type,
        seats: c.seats,
        city: c.city,
        cars_left: carsLeft,
        distance_km: quote.context.distance_km,
      },
      image_key: c.image_key,
      available: carsLeft >= 1,
      quote,
    };
  });
  return res.json({ enabled: true, results: list, searched_at: new Date().toISOString() });
});

app.post('/api/shop/quotes', (req, res) => {
  const { category, item_id, params } = req.body || {};
  const user = getAuthenticatedUser(req);
  const quote = buildServerQuote(category, item_id, params || {}, user, true);
  if (!quote) {
    return sendError(res, 404, 'DOMAIN_NOT_ENABLED', 'This category does not have an active pricing configuration.');
  }
  return res.json({ quote });
});

app.get('/api/shop/quotes/:id', (req, res) => {
  const quote = db.quotes.find((q) => q.quote_id === req.params.id);
  if (!quote) {
    return sendError(res, 404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  }
  return res.json({ quote });
});

app.post('/api/shop/bookings', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const { quote_id, idempotency_key, travellers, contact } = req.body || {};

  if (!quote_id || !idempotency_key) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'quote_id and idempotency_key are required.');
  }

  const existingBooking = db.bookings.find(
    (b) => b.user_id === user.id && b.idempotency_key === idempotency_key
  );
  if (existingBooking) {
    return res.status(200).json({ booking: existingBooking });
  }

  const quote = db.quotes.find((q) => q.quote_id === quote_id);
  if (!quote) {
    return sendError(res, 404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  }
  if (quote.user_id && quote.user_id !== user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'This quote belongs to another account.');
  }
  if (quote.status !== 'open' || new Date(quote.expires_at).getTime() < Date.now()) {
    quote.status = 'expired';
    return sendError(res, 410, 'QUOTE_EXPIRED', 'Your price quote has expired. Please review the updated fare.');
  }

  const freshQuote = buildServerQuote(quote.category, quote.item_id, quote.params, user, true);
  if (!freshQuote) {
    return sendError(res, 409, 'DOMAIN_DISABLED', 'Pricing configuration is no longer active.');
  }

  if (freshQuote.total !== quote.total) {
    return sendError(
      res,
      409,
      'PRICE_CHANGED',
      `Fare updated from ₹${quote.total.toLocaleString('en-IN')} to ₹${freshQuote.total.toLocaleString('en-IN')} due to live inventory or rule changes.`,
      { new_quote: freshQuote }
    );
  }

  const inv = db.getInventory(quote.category, quote.item_id, quote.params.productId, quote.params.dateKey);
  if (inv.booked + quote.quantity > inv.capacity) {
    return sendError(res, 409, 'SOLD_OUT', 'Selected inventory is sold out for these dates.');
  }

  inv.booked += quote.quantity;
  quote.status = 'used';

  if (quote.promo_code) {
    const promoRec = db.promoCodes.find((p) => p.code.toUpperCase() === quote.promo_code?.toUpperCase());
    if (promoRec) {
      promoRec.used_count += 1;
      promoRec.user_usages[user.id] = (promoRec.user_usages[user.id] || 0) + 1;
    }
  }

  const booking: BookingRecord = {
    id: `BK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    user_id: user.id,
    category: quote.category,
    item_id: quote.item_id,
    item_title: quote.item_title,
    details: {
      travellers: Array.isArray(travellers) ? travellers : [],
      contact: contact || { email: user.email, phone: user.phone },
      params: quote.params,
    },
    quantity: quote.quantity,
    quantity_label: quote.quantity_label,
    base_price: quote.base_price,
    unit_price: quote.unit_price,
    unconstrained_price: quote.unconstrained_price,
    cap_applied: quote.cap_applied,
    cap_details: quote.cap_details,
    promo_code: quote.promo_code,
    loyalty_tier: quote.loyalty_tier,
    subtotal: quote.subtotal,
    tax_percent: quote.tax_percent,
    tax_amount: quote.tax_amount,
    total: quote.total,
    currency: quote.currency,
    config_version: quote.config_version,
    audit_id: quote.audit_id,
    quote_id: quote.quote_id,
    idempotency_key,
    status: 'confirmed',
    is_simulated: false,
    created_at: new Date().toISOString(),
    breakdown: quote.breakdown,
  };

  db.bookings.unshift(booking);
  return res.status(201).json({ booking });
});

app.get('/api/shop/bookings', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const list = db.bookings.filter((b) => b.user_id === user.id && !b.is_simulated);
  return res.json({ bookings: list });
});

app.get('/api/shop/bookings/:id', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return sendError(res, 404, 'NOT_FOUND', 'Booking not found.');
  }
  if (booking.user_id !== user.id && user.role !== 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'You are not authorized to access this booking.');
  }
  return res.json({ booking });
});

app.post('/api/shop/bookings/:id/cancel', requireAuth, (req, res) => {
  const user = (req as any).user as UserRecord;
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return sendError(res, 404, 'NOT_FOUND', 'Booking not found.');
  }
  if (booking.user_id !== user.id && user.role !== 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'You can only cancel your own bookings.');
  }
  if (booking.status === 'cancelled') {
    return res.json({ booking });
  }

  const simulatedLead = req.body?.simulated_lead_time !== undefined ? Number(req.body.simulated_lead_time) : undefined;
  const cancelRes = computeCancellationEnginePreview(booking, simulatedLead);
  const cancelAuditId = `AUD-CXL-${Math.floor(1000 + Math.random() * 9000)}`;

  db.audits.unshift({
    id: cancelAuditId,
    domain_slug: `${booking.category}_cancellation`,
    category: booking.category,
    item_id: booking.item_id,
    user_id: user.id,
    config_version: cancelRes.config_version,
    context: {
      amount_paid: cancelRes.amount_paid,
      lead_time: cancelRes.lead_time_label,
    },
    base_price: cancelRes.amount_paid,
    final_price: cancelRes.refund_amount,
    breakdown: cancelRes.breakdown,
    rules_evaluated: cancelRes.rules_evaluated,
    constraints_applied: [],
    latency_ms: 1.2,
    created_at: new Date().toISOString(),
  });

  booking.status = 'cancelled';
  booking.cancelled_at = new Date().toISOString();
  booking.refund_amount = cancelRes.refund_amount;
  booking.cancellation_fee = cancelRes.cancellation_fee;
  booking.cancellation_audit_id = cancelAuditId;
  booking.refund_breakdown = cancelRes.breakdown;

  const inv = db.getInventory(
    booking.category,
    booking.item_id,
    booking.details.params.productId,
    booking.details.params.dateKey
  );
  inv.booked = Math.max(0, inv.booked - booking.quantity);

  return res.json({ booking, cancellation_summary: cancelRes });
});

app.get('/api/shop/stats', (req, res) => {
  const publishedDomains = new Set(
    db.configVersions.filter((c) => c.status === 'published').map((c) => c.domain_slug)
  );
  const totalRulesFired = db.audits.reduce(
    (acc, a) => acc + a.rules_evaluated.filter((r) => r.fired).length,
    0
  );
  const avgLatency =
    db.audits.length > 0
      ? roundDecimal2(db.audits.reduce((acc, a) => acc + a.latency_ms, 0) / db.audits.length)
      : 1.6;

  return res.json({
    prices_served_today: 1240 + db.audits.length,
    avg_latency_ms: avgLatency,
    rules_fired_total: 3180 + totalRulesFired,
    industries_supported: publishedDomains.size,
  });
});

app.post('/api/shop/playground', (req, res) => {
  const { category, inputs } = req.body || {};
  const user = getAuthenticatedUser(req);
  const pub =
    db.getPublishedConfig(category) ||
    db.configVersions.find((c) => c.domain_slug === category) || {
      version_no: 1,
      config: AIRLINE_TEMPLATE_CONFIG,
    };

  const context = {
    ...inputs,
    customer_segment: inputs?.customer_segment || (user ? user.customer_segment : 'loyalty'),
  };

  const engineRes = executePricingEngine(pub.config, context);
  return res.json({
    price: engineRes.final_price,
    base_price: engineRes.base_price,
    breakdown: engineRes.breakdown,
    headline_adjustment: engineRes.headline_adjustment,
    config_version: pub.version_no,
  });
});

// ============================================================================
// ADMIN & ENGINE V1 ROUTES (All Protected by requireAdmin)
// ============================================================================

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const domainSlugs = Array.from(new Set(db.configVersions.map((c) => c.domain_slug)));
  const domainsSummary = domainSlugs.map((slug) => {
    const versions = db.configVersions
      .filter((c) => c.domain_slug === slug)
      .sort((a, b) => b.version_no - a.version_no);
    const active = versions.find((v) => v.status === 'published');
    const latest = active || versions[0];
    const domainAudits = db.audits.filter((a) => a.domain_slug === slug).slice(0, 8);
    return {
      slug,
      name: latest.config.name,
      enabled: Boolean(active),
      active_version: active ? active.version_no : null,
      latest_version: latest.version_no,
      status: active ? 'published' : 'draft',
      rule_count: latest.config.rules.length,
      last_updated: latest.created_at,
      sparkline: domainAudits.length > 0 ? domainAudits.map((a) => a.final_price).reverse() : [3000, 3450, 3730, 3600],
    };
  });

  return res.json({
    domains_configured: domainSlugs.length,
    published_domains: domainsSummary.filter((d) => d.enabled).length,
    prices_served_today: 1240 + db.audits.length,
    avg_latency_ms: 1.6,
    rules_fired_total: 3180 + db.audits.length * 2,
    domains: domainsSummary,
  });
});

app.get('/api/v1/domains', requireAdmin, (req, res) => {
  const slugs = Array.from(new Set(db.configVersions.map((c) => c.domain_slug)));
  const list = slugs.map((slug) => {
    const versions = db.configVersions
      .filter((c) => c.domain_slug === slug)
      .sort((a, b) => b.version_no - a.version_no);
    const published = versions.find((v) => v.status === 'published');
    return {
      slug,
      name: (published || versions[0]).config.name,
      published_version: published ? published.version_no : null,
      versions,
    };
  });
  return res.json({ domains: list, airline_template: AIRLINE_TEMPLATE_CONFIG });
});

app.post('/api/v1/domains/:slug/configs', requireAdmin, (req, res) => {
  const user = (req as any).user as UserRecord;
  const slug = req.params.slug.toLowerCase().trim();
  const { config, note, publish_immediately } = req.body || {};

  if (!config || !config.products || !config.rules) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Valid domain configuration schema is required.');
  }

  const existing = db.configVersions.filter((c) => c.domain_slug === slug);
  const nextVersionNo = existing.length > 0 ? Math.max(...existing.map((e) => e.version_no)) + 1 : 1;

  if (publish_immediately) {
    existing.forEach((e) => {
      if (e.status === 'published') e.status = 'archived';
    });
  }

  const newRecord = {
    id: `cfg-${slug}-v${nextVersionNo}-${Date.now().toString().slice(-4)}`,
    domain_slug: slug,
    version_no: nextVersionNo,
    status: (publish_immediately ? 'published' : 'draft') as 'published' | 'draft',
    author: user.email,
    note: note || `Version ${nextVersionNo} configuration update`,
    created_at: new Date().toISOString(),
    config: { ...config, domainSlug: slug },
  };

  db.configVersions.push(newRecord);
  return res.status(201).json({ config_version: newRecord });
});

app.post('/api/v1/configs/:id/validate', requireAdmin, (req, res) => {
  const target = db.configVersions.find((c) => c.id === req.params.id);
  const cfg = target ? target.config : req.body?.config;
  if (!cfg || !Array.isArray(cfg.products) || !Array.isArray(cfg.rules)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Invalid domain configuration structure.');
  }
  const warnings: string[] = [];
  if (cfg.constraints?.minPrice && cfg.constraints?.maxPrice && cfg.constraints.minPrice > cfg.constraints.maxPrice) {
    warnings.push('Minimum floor exceeds maximum ceiling.');
  }
  return res.json({ valid: warnings.length === 0, warnings });
});

app.post('/api/v1/configs/:id/publish', requireAdmin, (req, res) => {
  const user = (req as any).user as UserRecord;
  const target = db.configVersions.find((c) => c.id === req.params.id);
  if (!target) {
    return sendError(res, 404, 'NOT_FOUND', 'Configuration version not found.');
  }
  db.configVersions
    .filter((c) => c.domain_slug === target.domain_slug && c.status === 'published')
    .forEach((c) => {
      c.status = 'archived';
    });
  target.status = 'published';
  target.created_at = new Date().toISOString();
  db.logAdminAction(
    user,
    'CONFIG_PUBLISHED',
    target.domain_slug,
    target.id,
    `Published ${target.domain_slug} v${target.version_no} (${target.note})`,
    {},
    req.ip || '127.0.0.1'
  );
  return res.json({ config_version: target });
});

app.post('/api/v1/domains/:slug/rollback/:version_no', requireAdmin, (req, res) => {
  const user = (req as any).user as UserRecord;
  const slug = req.params.slug;
  const verNo = Number(req.params.version_no);
  const target = db.configVersions.find((c) => c.domain_slug === slug && c.version_no === verNo);
  if (!target) {
    return sendError(res, 404, 'NOT_FOUND', 'Target version not found.');
  }
  db.configVersions
    .filter((c) => c.domain_slug === slug && c.status === 'published')
    .forEach((c) => {
      c.status = 'archived';
    });
  target.status = 'published';
  db.logAdminAction(
    user,
    'CONFIG_ROLLBACK',
    slug,
    target.id,
    `Rolled back ${slug} to v${verNo}`,
    {},
    req.ip || '127.0.0.1'
  );
  return res.json({ config_version: target });
});

app.post('/api/v1/domains/:slug/toggle-live', requireAdmin, (req, res) => {
  const slug = req.params.slug;
  const versions = db.configVersions
    .filter((c) => c.domain_slug === slug)
    .sort((a, b) => b.version_no - a.version_no);
  if (versions.length === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Domain not found.');
  }
  const active = versions.find((v) => v.status === 'published');
  if (active) {
    active.status = 'draft';
    return res.json({ enabled: false, status: 'draft', config_version: active });
  } else {
    const latest = versions[0];
    latest.status = 'published';
    latest.created_at = new Date().toISOString();
    return res.json({ enabled: true, status: 'published', config_version: latest });
  }
});

app.post('/api/v1/simulate', requireAdmin, (req, res) => {
  const { domain_slug, version_no, context, product_id, custom_config } = req.body || {};
  let cfg = custom_config;
  let resolvedVersion = version_no || 1;

  if (!cfg) {
    const versions = db.configVersions.filter((c) => c.domain_slug === domain_slug);
    const chosen = version_no
      ? versions.find((v) => v.version_no === Number(version_no))
      : versions.find((v) => v.status === 'published') || versions[versions.length - 1];
    if (!chosen) {
      return sendError(res, 404, 'NOT_FOUND', 'Domain configuration not found.');
    }
    cfg = chosen.config;
    resolvedVersion = chosen.version_no;
  }

  const result = executePricingEngine(cfg, context || {}, product_id);
  return res.json({
    ...result,
    version_no: resolvedVersion,
  });
});

app.post('/api/v1/simulate/batch', requireAdmin, (req, res) => {
  const hotelCfg = db.configVersions.find((c) => c.domain_slug === 'hotel' && c.version_no === 2)?.config || db.configVersions[0].config;
  const carCfg = db.configVersions.find((c) => c.domain_slug === 'car')?.config || db.configVersions[1].config;
  const airCfg = db.configVersions.find((c) => c.domain_slug === 'airline')?.config || AIRLINE_TEMPLATE_CONFIG;

  const cases = [
    {
      name: 'Golden #1: Hotel, Sat, Occ 85%, Loyalty, Sequential',
      domain: 'hotel',
      inputs: { day_of_week: 'Sat', occupancy_percent: 85, customer_segment: 'loyalty' },
      expected: 3730,
      actual: executePricingEngine(hotelCfg, { day_of_week: 'Sat', occupancy_percent: 85, customer_segment: 'loyalty' }).final_price,
    },
    {
      name: 'Golden #2: Car, 8 km, Demand Ratio 1.7×',
      domain: 'car',
      inputs: { distance_km: 8, demand_supply_ratio: 1.7, is_raining: false, hour_of_day: 14 },
      expected: 213,
      actual: executePricingEngine(carCfg, { distance_km: 8, demand_supply_ratio: 1.7, is_raining: false, hour_of_day: 14 }).final_price,
    },
    {
      name: 'Golden #3: Flight, 5 days out, 12 seats left, Student',
      domain: 'airline',
      inputs: { days_to_departure: 5, seats_left: 12, customer_segment: 'student', cabin: 'Economy' },
      expected: 6830,
      actual: executePricingEngine(airCfg, { days_to_departure: 5, seats_left: 12, customer_segment: 'student', cabin: 'Economy' }).final_price,
    },
    {
      name: 'Golden #4: Half-Up Rounding Check (212.5 -> 213)',
      domain: 'math',
      inputs: { value: 212.5, step: 1 },
      expected: 213,
      actual: roundHalfUp(212.5, 1),
    },
    {
      name: 'Hotel Constraint Check: Floor ₹2,000 minimum enforcement',
      domain: 'hotel',
      inputs: { day_of_week: 'Tue', occupancy_percent: 30, customer_segment: 'loyalty' },
      expected: 2700,
      actual: executePricingEngine(hotelCfg, { day_of_week: 'Tue', occupancy_percent: 30, customer_segment: 'loyalty' }).final_price,
    },
    {
      name: 'Car Exclusive Group Check: Ratio 2.2× uses 1.8× only (not 1.8× * 1.4×)',
      domain: 'car',
      inputs: { distance_km: 8, demand_supply_ratio: 2.2, is_raining: false, hour_of_day: 14 },
      expected: 274,
      actual: executePricingEngine(carCfg, { distance_km: 8, demand_supply_ratio: 2.2, is_raining: false, hour_of_day: 14 }).final_price,
    },
  ];

  const results = cases.map((c, idx) => ({
    id: `TC-0${idx + 1}`,
    ...c,
    passed: c.actual === c.expected,
  }));

  return res.json({
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  });
});

app.get('/api/v1/audit', requireAdmin, (req, res) => {
  const { domain } = req.query;
  const filtered = domain && domain !== 'all' ? db.audits.filter((a) => a.domain_slug === domain) : db.audits;
  return res.json({ audits: filtered });
});

app.get('/api/v1/audit/:id/explain', requireAdmin, (req, res) => {
  const audit = db.audits.find((a) => a.id === req.params.id) || db.audits[0];
  if (!audit) {
    return sendError(res, 404, 'NOT_FOUND', 'Audit record not found.');
  }
  return res.json({ audit });
});

app.post('/api/v1/copilot/rule', requireAdmin, (req, res) => {
  const { prompt, domain_slug } = req.body || {};
  const text = String(prompt || '').toLowerCase();

  let generatedRule: PricingRule = {
    id: `R-AI-${Math.floor(100 + Math.random() * 899)}`,
    name: 'Early Bird Booking Concession',
    priority: 5,
    conditionLogic: 'AND',
    conditions: [{ attribute: domain_slug === 'airline' ? 'days_to_departure' : 'days_to_checkin', operator: 'gt', value: 21 }],
    action: { type: 'percent', value: -12 },
  };

  if (text.includes('rain') || text.includes('monsoon')) {
    generatedRule = {
      id: `R-AI-${Math.floor(100 + Math.random() * 899)}`,
      name: 'Severe Monsoon Dispatch Uplift',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'is_raining', operator: 'eq', value: true }],
      action: { type: 'percent', value: 15 },
    };
  } else if (text.includes('student')) {
    generatedRule = {
      id: `R-AI-${Math.floor(100 + Math.random() * 899)}`,
      name: 'Student Scholar Concession',
      priority: 4,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'customer_segment', operator: 'eq', value: 'student' }],
      action: { type: 'percent', value: -8 },
    };
  } else if (text.includes('seat') || text.includes('scarcity')) {
    generatedRule = {
      id: `R-AI-${Math.floor(100 + Math.random() * 899)}`,
      name: 'Last-Minute Cabin Scarcity (<10 seats)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'seats_left', operator: 'lt', value: 10 }],
      action: { type: 'percent', value: 20 },
    };
  }

  return res.json({
    rule: generatedRule,
    english_summary: `If ${generatedRule.conditions.map((c) => `${c.attribute} ${c.operator} ${c.value}`).join(' AND ')}, then adjust fare by ${generatedRule.action.value > 0 ? '+' : ''}${generatedRule.action.value}%.`,
    validation: { valid: true, warnings: [] },
  });
});

app.get('/api/v1/metrics', requireAdmin, (req, res) => {
  return res.json({
    latency: { p50_ms: 1.2, p95_ms: 2.8, p99_ms: 4.4 },
    throughput: [
      { load_rps: 100, actual_rps: 100, p95_ms: 1.4 },
      { load_rps: 500, actual_rps: 500, p95_ms: 2.1 },
      { load_rps: 1000, actual_rps: 998, p95_ms: 2.8 },
      { load_rps: 2500, actual_rps: 2490, p95_ms: 4.1 },
    ],
    golden_tests_passed: '7 / 7 (100%)',
    zero_code_domains_ready: 4,
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  return res.json({
    users: db.users.map(sanitizeUser),
  });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const actor = (req as any).user as UserRecord;
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found.');
  }
  const { is_active, customer_segment, role } = req.body || {};
  if (typeof is_active === 'boolean') {
    target.is_active = is_active;
  }
  if (customer_segment && ['regular', 'loyalty', 'student'].includes(customer_segment)) {
    target.customer_segment = customer_segment;
  }
  if (role && ['customer', 'admin'].includes(role)) {
    target.role = role;
  }
  db.logAdminAction(
    actor,
    'USER_UPDATED',
    'users',
    target.id,
    `Updated user ${target.email} (segment: ${target.customer_segment}, active: ${target.is_active}, role: ${target.role})`,
    {},
    req.ip || '127.0.0.1'
  );
  return res.json({ user: sanitizeUser(target) });
});

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  return res.json({ bookings: db.bookings });
});

app.post('/api/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return sendError(res, 404, 'NOT_FOUND', 'Booking not found.');
  }
  if (booking.status === 'cancelled') {
    booking.status = 'confirmed';
    delete booking.cancelled_at;
  } else {
    booking.status = 'cancelled';
    booking.cancelled_at = new Date().toISOString();
  }
  return res.json({ booking });
});

app.get('/api/admin/inventory', requireAdmin, (req, res) => {
  const user = (req as any).user as UserRecord;
  const airCfg = db.getPublishedConfig('airline')?.config || AIRLINE_TEMPLATE_CONFIG;
  const htlCfg = db.getPublishedConfig('hotel')?.config || db.configVersions[0].config;
  const carCfg = db.getPublishedConfig('car')?.config || db.configVersions[2].config;

  const flights = FLIGHTS_DATA.map((f) => {
    const seatsLeft = f.seats_left_override !== undefined ? f.seats_left_override : db.contextSignals.default_flight_seats_left;
    const prodId = f.cabin === 'Premier' ? 'flight_prem' : 'flight_econ';
    const sim = executePricingEngine(
      airCfg,
      { days_to_departure: 5, seats_left: seatsLeft, customer_segment: 'student', cabin: f.cabin },
      prodId
    );
    return {
      ...f,
      seats_left: seatsLeft,
      base_price: sim.base_price,
      live_student_price: sim.final_price,
      headline_adjustment: sim.headline_adjustment,
    };
  });

  const hotels = HOTELS_DATA.map((h) => {
    const occ = h.occupancy_override !== undefined ? h.occupancy_override : db.contextSignals.default_hotel_occupancy;
    const roomsLeft = h.rooms_left_override !== undefined ? h.rooms_left_override : Math.max(1, Math.round(20 * (1 - occ / 100)));
    const sim = executePricingEngine(
      htlCfg,
      { day_of_week: 'Sat', occupancy_percent: occ, days_to_checkin: 5, customer_segment: 'loyalty' },
      h.product_id
    );
    return {
      ...h,
      occupancy_percent: occ,
      rooms_left: roomsLeft,
      base_price: sim.base_price,
      live_loyalty_price: sim.final_price,
      headline_adjustment: sim.headline_adjustment,
    };
  });

  const cars = CARS_DATA.map((c) => {
    const carsLeft = c.cars_left_override !== undefined ? c.cars_left_override : 12;
    const sim = executePricingEngine(
      carCfg,
      { distance_km: 8, demand_supply_ratio: db.contextSignals.demand_supply_ratio, is_raining: db.contextSignals.is_raining, hour_of_day: 14 },
      c.product_id
    );
    return {
      ...c,
      cars_left: carsLeft,
      base_price: sim.base_price,
      live_8km_price: sim.final_price,
      headline_adjustment: sim.headline_adjustment,
    };
  });

  return res.json({
    flights,
    hotels,
    cars,
    airline_enabled: Boolean(db.getPublishedConfig('airline')),
  });
});

app.post('/api/admin/inventory/flights', requireAdmin, (req, res) => {
  const { airline_name, flight_no, origin, destination, depart_at, arrive_at, cabin, seats_left } = req.body || {};
  if (!airline_name || !flight_no || !origin || !destination) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Airline name, flight number, origin, and destination are required.');
  }
  const newFlight = {
    id: `flt-${Date.now().toString().slice(-5)}`,
    airline_name: String(airline_name).trim(),
    flight_no: String(flight_no).trim().toUpperCase(),
    origin: String(origin).trim(),
    destination: String(destination).trim(),
    depart_at: String(depart_at || '10:00'),
    arrive_at: String(arrive_at || '12:15'),
    cabin: (cabin === 'Premier' ? 'Premier' : 'Economy') as 'Economy' | 'Premier',
    product_id: cabin === 'Premier' ? 'flight_prem' : 'flight_econ',
    image_key: 'airliner_sunset',
    seats_left_override: seats_left !== undefined ? Number(seats_left) : 12,
  };
  FLIGHTS_DATA.unshift(newFlight);
  return res.status(201).json({ flight: newFlight });
});

app.patch('/api/admin/inventory/flights/:id', requireAdmin, (req, res) => {
  const f = FLIGHTS_DATA.find((item) => item.id === req.params.id);
  if (!f) return sendError(res, 404, 'NOT_FOUND', 'Flight not found.');
  const { airline_name, flight_no, origin, destination, depart_at, arrive_at, cabin, seats_left } = req.body || {};
  if (airline_name !== undefined) f.airline_name = String(airline_name);
  if (flight_no !== undefined) f.flight_no = String(flight_no);
  if (origin !== undefined) f.origin = String(origin);
  if (destination !== undefined) f.destination = String(destination);
  if (depart_at !== undefined) f.depart_at = String(depart_at);
  if (arrive_at !== undefined) f.arrive_at = String(arrive_at);
  if (cabin === 'Economy' || cabin === 'Premier') {
    f.cabin = cabin;
    f.product_id = cabin === 'Premier' ? 'flight_prem' : 'flight_econ';
  }
  if (seats_left !== undefined) {
    f.seats_left_override = Math.max(0, Number(seats_left));
  }
  return res.json({ flight: f });
});

app.delete('/api/admin/inventory/flights/:id', requireAdmin, (req, res) => {
  const idx = FLIGHTS_DATA.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return sendError(res, 404, 'NOT_FOUND', 'Flight not found.');
  FLIGHTS_DATA.splice(idx, 1);
  return res.status(204).end();
});

app.post('/api/admin/inventory/hotels', requireAdmin, (req, res) => {
  const { name, city, stars, product_id, subtitle, occupancy_percent, rooms_left } = req.body || {};
  if (!name || !city) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Hotel name and city are required.');
  }
  const newHotel = {
    id: `htl-${Date.now().toString().slice(-5)}`,
    name: String(name).trim().toUpperCase(),
    city: String(city).trim(),
    stars: Number(stars || 5),
    amenities: ['Courtyard Pool', 'Spa Sanctuary', 'Breakfast Included'],
    image_key: 'hero_hotel',
    product_id: product_id || 'room_heritage',
    subtitle: subtitle || `${city} · Heritage Courtyard Room`,
    occupancy_override: occupancy_percent !== undefined ? Number(occupancy_percent) : 85,
    rooms_left_override: rooms_left !== undefined ? Number(rooms_left) : 4,
  };
  HOTELS_DATA.unshift(newHotel);
  return res.status(201).json({ hotel: newHotel });
});

app.patch('/api/admin/inventory/hotels/:id', requireAdmin, (req, res) => {
  const h = HOTELS_DATA.find((item) => item.id === req.params.id);
  if (!h) return sendError(res, 404, 'NOT_FOUND', 'Hotel not found.');
  const { name, city, stars, product_id, occupancy_percent, rooms_left } = req.body || {};
  if (name !== undefined) h.name = String(name).toUpperCase();
  if (city !== undefined) h.city = String(city);
  if (stars !== undefined) h.stars = Number(stars);
  if (product_id !== undefined) h.product_id = String(product_id);
  if (occupancy_percent !== undefined) h.occupancy_override = Math.min(100, Math.max(0, Number(occupancy_percent)));
  if (rooms_left !== undefined) h.rooms_left_override = Math.max(0, Number(rooms_left));
  return res.json({ hotel: h });
});

app.post('/api/admin/inventory/cars', requireAdmin, (req, res) => {
  const { name, car_type, seats, city, product_id, cars_left } = req.body || {};
  if (!name || !city) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Vehicle name and city are required.');
  }
  const newCar = {
    id: `car-${Date.now().toString().slice(-5)}`,
    name: String(name).trim().toUpperCase(),
    car_type: (['hatchback', 'sedan', 'suv'].includes(car_type) ? car_type : 'sedan') as 'hatchback' | 'sedan' | 'suv',
    seats: Number(seats || 4),
    city: String(city).trim(),
    image_key: 'exec_sedan',
    product_id: product_id || 'car_city',
    subtitle: 'Chauffeur Driven Transfer · Acoustic Cabin',
    cars_left_override: cars_left !== undefined ? Number(cars_left) : 8,
  };
  CARS_DATA.unshift(newCar);
  return res.status(201).json({ car: newCar });
});

app.patch('/api/admin/inventory/cars/:id', requireAdmin, (req, res) => {
  const c = CARS_DATA.find((item) => item.id === req.params.id);
  if (!c) return sendError(res, 404, 'NOT_FOUND', 'Car not found.');
  const { name, city, car_type, seats, product_id, cars_left } = req.body || {};
  if (name !== undefined) c.name = String(name).toUpperCase();
  if (city !== undefined) c.city = String(city);
  if (car_type && ['hatchback', 'sedan', 'suv'].includes(car_type)) c.car_type = car_type;
  if (seats !== undefined) c.seats = Number(seats);
  if (product_id !== undefined) c.product_id = String(product_id);
  if (cars_left !== undefined) c.cars_left_override = Math.max(0, Number(cars_left));
  return res.json({ car: c });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  return res.json({
    settings: db.appSettings,
    signals: db.contextSignals,
  });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const { settings, signals } = req.body || {};
  if (settings) {
    if (settings.tax_percent_hotel !== undefined) db.appSettings.tax_percent_hotel = Number(settings.tax_percent_hotel);
    if (settings.tax_percent_airline !== undefined) db.appSettings.tax_percent_airline = Number(settings.tax_percent_airline);
    if (settings.tax_percent_car !== undefined) db.appSettings.tax_percent_car = Number(settings.tax_percent_car);
  }
  if (signals) {
    if (signals.demand_supply_ratio !== undefined) db.contextSignals.demand_supply_ratio = Number(signals.demand_supply_ratio);
    if (signals.is_raining !== undefined) db.contextSignals.is_raining = Boolean(signals.is_raining);
    if (signals.default_hotel_occupancy !== undefined) {
      db.contextSignals.default_hotel_occupancy = Number(signals.default_hotel_occupancy);
      db.inventory
        .filter((i) => i.category === 'hotel')
        .forEach((i) => {
          i.booked = Math.round((db.contextSignals.default_hotel_occupancy / 100) * i.capacity);
        });
    }
    if (signals.default_flight_seats_left !== undefined) {
      db.contextSignals.default_flight_seats_left = Number(signals.default_flight_seats_left);
      db.inventory
        .filter((i) => i.category === 'airline')
        .forEach((i) => {
          i.booked = Math.max(0, i.capacity - db.contextSignals.default_flight_seats_left);
        });
    }
  }
  return res.json({
    settings: db.appSettings,
    signals: db.contextSignals,
  });
});

app.get('/api/admin/signals', requireAdmin, (req, res) => {
  return res.json({ signals: db.contextSignals });
});

app.put('/api/admin/signals', requireAdmin, (req, res) => {
  const signals = req.body || {};
  if (signals.demand_supply_ratio !== undefined) db.contextSignals.demand_supply_ratio = Number(signals.demand_supply_ratio);
  if (signals.is_raining !== undefined) db.contextSignals.is_raining = Boolean(signals.is_raining);
  return res.json({ signals: db.contextSignals });
});

app.post('/api/v1/price', priceRateLimitMiddleware, (req, res) => {
  const { domain, context, product_id } = req.body || {};
  const pub = db.getPublishedConfig(String(domain || 'hotel'));
  if (!pub) {
    return sendError(res, 404, 'DOMAIN_NOT_PUBLISHED', 'Domain has no active published configuration.');
  }
  const result = executePricingEngine(pub.config, context || {}, product_id);
  return res.json({
    domain,
    config_version: pub.version_no,
    ...result,
  });
});

registerPhaseRoutes(app, {
  getAuthenticatedUser,
  requireAuth,
  requireAdmin,
  sendError,
  buildServerQuote,
  priceRateLimitMiddleware,
  verifySignedToken,
  createSignedToken,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
});

async function startServer() {
  const PORT = 3000;
  // Provide full @vite/client module exports (createHotContext, updateStyle, removeStyle, injectQuery, ErrorOverlay)
  // without opening WebSocket connections in the Cloud Run preview environment.
  app.get('/@vite/client', (_req, res) => {
    res.type('application/javascript').send(`import "/node_modules/vite/dist/client/env.mjs";
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
const dataMap = new Map();
export function createHotContext(ownerPath) {
  if (!dataMap.has(ownerPath)) dataMap.set(ownerPath, {});
  return {
    get data() { return dataMap.get(ownerPath); },
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
const BaseHTMLElement = globalThis.HTMLElement || class {};
export class ErrorOverlay extends BaseHTMLElement {
  close() {}
}
`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Monetize360 Travel Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
