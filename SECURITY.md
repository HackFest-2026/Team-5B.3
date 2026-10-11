# Security Architecture & Controls (`SECURITY.md`)

Monetize360 Dynamic Pricing & Travel Platform implements defense-in-depth server-side security controls across authentication, session management, authorization, rate limiting, and pricing integrity.

## 1. Server-Authoritative Pricing & Integrity
- **Single Pricing Path**: Every customer quote, promo code discount, loyalty tier concession, guardrail cap, and cancellation refund breakdown is computed exclusively on the server via `executePricingEngine` (`src/server/engine.ts`).
- **Zero Client Price Trust**: Booking creation (`POST /api/shop/bookings`) accepts only `quote_id` and `idempotency_key`. The server recomputes the quote live against published rules and inventory; if the price changed (`409 PRICE_CHANGED`) or expired (`410 QUOTE_EXPIRED`), the transaction is halted.
- **Immutable Audit Trail**: Every price evaluation and cancellation calculation produces an `AuditRecord` (`AUD-*`) and every administrative mutation (config publish/rollback, guardrail update, promo creation/toggle, loyalty tier edit, user role change) writes an `AdminAuditLogRecord` (`ALOG-*`).

## 2. Password Storage & Credential Policy
- **Cryptographic KDF**: Passwords are hashed using `crypto.scryptSync` (`N=16384, r=8, p=1`, 64-byte key length) with a unique 16-byte random salt per password and a server-side pepper (`PASSWORD_PEPPER`).
- **Timing-Safe Verification**: Password comparisons use `crypto.timingSafeEqual` and dummy hash computation on missing users to prevent timing-based user enumeration.
- **No Exposure**: `sanitizeUser()` strips `password_hash`, `failed_attempts`, and `locked_until` before any user object is serialized.
- **Generic Error Messages**: Login failures always return a generic `401 INVALID_CREDENTIALS ("Invalid email or password")` message.
- **Complexity Policy**: Minimum 8 characters (max 128), requiring uppercase, lowercase, digit, and special character, plus normalized unique lowercase email (`toLowerCase().trim()`).

## 3. Session Management & Cookies
- **Short-Lived Access Token + Rotating Refresh Token**:
  - `m360_access`: 15-minute (`Max-Age=900`) HMAC-SHA256 signed access token stored in an `HttpOnly; SameSite=Lax` cookie (`Secure` enabled automatically on HTTPS).
  - `m360_refresh`: 7-day (`Max-Age=604800`) rotating refresh token stored in an `HttpOnly; SameSite=Lax` cookie and tracked server-side.
- **No `localStorage` Token Storage**: Session tokens are never persisted in `window.localStorage`.
- **Token Revocation**: `POST /api/auth/logout` and refresh rotation (`POST /api/auth/refresh`) immediately revoke the refresh token server-side and clear cookies.

## 4. Server-Side Authorization (RBAC & Ownership)
- **Admin Route Enforcement**: Every `/api/admin/*` and administrative `/api/v1/*` endpoint enforces `requireAdmin`, returning `401 UNAUTHORIZED` for unauthenticated callers and `403 FORBIDDEN` for authenticated non-admin (`customer`) accounts.
- **Resource Ownership**: Customers can view (`GET /api/shop/bookings/:id`) and cancel (`POST /api/shop/bookings/:id/cancel`) only their own bookings (`booking.user_id === req.user.id`); cross-account attempts return `403 FORBIDDEN`.

## 5. Rate Limiting & Abuse Prevention
- **Login Rate Limiter**: Tracked per `IP + normalized email`. After 5 failed login attempts within a 15-minute window, subsequent attempts (6th attempt onward) return `HTTP 429 Too Many Requests` with a standard `Retry-After` header.
- **Pricing API Rate Limiter**: Public pricing endpoints (`/api/v1/price`, `/api/v1/price/batch`) enforce a configurable limit of `600 requests/minute` per IP (`PRICE_RATE_LIMIT_PER_MIN`), while authenticated admin stress tests are exempt.

## 6. HTTP Hardening & Input Validation
- **Security Headers**:
  - `Content-Security-Policy` restricting script, style, image, and frame-ancestors origins
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: same-origin`
- **Body Size & Schema Validation**: JSON payloads are capped at `512kb` and validated for expected field types and bounds (`min_price <= max_price`, percentages `0–100`).
- **CSRF Protection**: Double-submit `csrf_token` cookie + `X-CSRF-Token` request header on authenticated state-changing requests.

## 7. Known Limitations
- **In-Memory Datastore**: For offline portability and zero external database dependencies, records (`users`, `configVersions`, `bookings`, `audits`, `promoCodes`, `adminAuditLogs`) are stored in an in-memory `DatabaseStore` seeded idempotently on startup.
- **Preview Iframe Environment**: When hosted inside a cross-origin preview iframe where third-party cookies may be restricted by browser privacy settings, an in-memory-only bearer fallback (never written to `localStorage`) is used for the active tab lifecycle.
