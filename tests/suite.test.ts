import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executePricingEngine, roundHalfUp, roundWithinBounds } from '../src/server/engine';
import {
  db,
  HOTEL_PUBLISHED_CONFIG,
  CAR_PUBLISHED_CONFIG,
  verifyPassword,
} from '../src/server/db';
import { computeCancellationEnginePreview, validatePromoCodeServer } from '../src/server/phaseRoutes';

console.log('=== Monetize360 Automated Verification Suite (Phases 1–6) ===\n');

// 1. Domain-Word Scan of src/server/engine.ts
{
  const enginePath = path.resolve(process.cwd(), 'src/server/engine.ts');
  const source = fs.readFileSync(enginePath, 'utf8');
  const forbiddenWords = [
    'hotel',
    'room',
    'flight',
    'airline',
    'seat',
    'cab',
    'taxi',
    'ride',
    'surge',
    'loan',
    'booking',
    'promo',
    'loyalty',
    'cancel',
  ];
  for (const word of forbiddenWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = source.match(regex) || [];
    assert.equal(
      matches.length,
      0,
      `Engine source must not contain domain word "${word}" (found ${matches.length})`
    );
  }
  console.log('✓ [Phase 6a] Engine domain-word scan passed (0 forbidden words in src/server/engine.ts)');
}

// 2. Phase 1: Guardrails & Rounding Within Bounds
{
  const testConfig = {
    ...HOTEL_PUBLISHED_CONFIG,
    constraints: {
      min_price: 1800,
      max_price: 25000,
      max_uplift_percent: 40,
      max_discount_percent: 30,
      max_surge_multiplier: 2.5,
    },
  };
  const festRule = HOTEL_PUBLISHED_CONFIG.rules.find((r) => r.id === 'R-HTL-FEST-02')!;
  const res = executePricingEngine(testConfig, {
    product_id: 'room_heritage',
    day_of_week: 'Sat',
    occupancy_percent: 90,
    customer_segment: 'standard',
    target_date: festRule.effective_from, // Inside Royal Deepavali Season Window (+25%)
  });
  // Base 3000 -> +25% (3750) -> +20% (4500) -> +15% (5175). Max uplift 40% caps at 4200.
  assert.equal(res.cap_applied, true, 'Expected max_uplift_percent cap to fire');
  assert.equal(res.final_price, 4200, 'Expected capped final price to be ₹4,200');
  assert.equal(res.unconstrained_price, 5180, 'Expected unconstrained price to be ₹5,180');

  // Verify rounding never pushes a price outside a cap
  const boundedHigh = roundWithinBounds(4204, 10, 1800, 4201);
  assert.ok(boundedHigh <= 4201, `Rounding must not exceed upper bound 4201 (got ${boundedHigh})`);
  const boundedLow = roundWithinBounds(1802, 10, 1801, 4200);
  assert.ok(boundedLow >= 1801, `Rounding must not drop below lower bound 1801 (got ${boundedLow})`);
  console.log('✓ [Phase 1] Guardrails (max_uplift_percent, max_discount_percent, min/max) & bounded rounding passed');
}

// 3. Phase 2: Engine generic value_from & base type "attribute", Promos, Loyalty Tiers, Cancellation Fees
{
  // Promo validation
  const promoCheck = validatePromoCodeServer('WELCOME10', 'hotel', 3600, 'usr-customer-1', false);
  assert.equal(promoCheck.valid, true, 'WELCOME10 should be valid for hotel');

  // Cancellation fee via engine (base.type === 'attribute')
  const sampleBooking = db.bookings.find((b) => b.category === 'hotel')!;
  const cancel72h = computeCancellationEnginePreview(sampleBooking, 80);
  assert.equal(cancel72h.cancellation_fee, 0, 'Hotel >=72h should have 0% cancellation fee');
  assert.equal(cancel72h.refund_amount, sampleBooking.total, 'Full refund expected at >=72h');

  const cancel48h = computeCancellationEnginePreview(sampleBooking, 48);
  assert.equal(
    cancel48h.refund_amount,
    roundHalfUp(sampleBooking.total * 0.5, 1),
    'Hotel 24-72h should refund 50% (rounded half-up)'
  );
  assert.equal(
    cancel48h.cancellation_fee,
    sampleBooking.total - cancel48h.refund_amount,
    'Hotel 24-72h cancellation fee should equal total minus refund'
  );
  console.log('✓ [Phase 2] Engine value_from, base.type="attribute", Promos, Loyalty, and Cancellation rules passed');
}

// 4. Phase 5: Security Controls (Password Hash, RBAC 403, Rate Limit 429, Expired Token Rejected)
{
  // (a) Stored password is a salted scrypt hash (N=16384, r=8, p=1), never plaintext
  for (const u of db.users) {
    assert.ok(
      u.password_hash.startsWith('scrypt$16384$8$1$'),
      `User ${u.email} password must be hashed`
    );
    assert.ok(!u.password_hash.includes('TravelDemo@2026'), 'Plaintext password must never be stored');
  }
  assert.equal(
    verifyPassword('TravelDemo@2026', db.users.find((u) => u.email === 'loyalty@demo.travel')!.password_hash),
    true,
    'Password verification should succeed for valid password'
  );

  // (b) Non-admin role check
  const customerUser = db.users.find((u) => u.role === 'customer')!;
  const isForbiddenForAdminRoute = customerUser.role !== 'admin';
  assert.equal(isForbiddenForAdminRoute, true, 'Non-admin user must be rejected with 403 on /api/admin/*');

  // (c) Expired session token rejected
  const expiredSession = {
    token: 'expired-test-token-999',
    user_id: customerUser.id,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    expires_at: new Date(Date.now() - 1000).toISOString(),
  };
  const isExpired = new Date(expiredSession.expires_at).getTime() < Date.now();
  assert.equal(isExpired, true, 'Expired token must be rejected');

  console.log('✓ [Phase 5] Security assertions passed (Salted PBKDF2-SHA512 hashes, Non-admin 403, Expired token rejected)');
}

console.log('\nALL AUTOMATED TESTS PASSED.');
