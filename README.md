# Monetize360 Travel — Universal Dynamic Pricing Engine & Storefront

KLE Tech Hackfest 2026 · Problem Statement 5B

## Overview
**Monetize360 Travel** is a full-stack booking website for **Hotels**, **Airlines (Flights)**, and **Car Booking (Cabs)** powered by a domain-agnostic dynamic pricing engine, paired with a private **Admin Console**.

### Key Architectural Guarantees
1. **Server Owns the Money**: The React frontend never computes prices, subtotals, taxes, or totals. Every figure displayed in cards, breakdowns, checkout, and receipts comes directly from the server API.
2. **Server Owns Pricing Inputs**: Context signals (`occupancy_percent`, `seats_left`, `demand_supply_ratio`, `is_raining`, `distance_km`, `day_of_week`, `days_to_checkin`, `days_to_departure`) and `customer_segment` are derived on the server.
3. **Exact Decimal Half-Up Rounding**: Avoids floating-point and banker's rounding traps (`212.5 → 213`, `3,726 → 3,730`, `6,828.125 → 6,830`).
4. **Zero-Code Industry Launch (Live Demo)**: On initial boot, `hotel` and `car` are published while `airline` is staged in draft (`enabled: false`, showing "Opening soon" on the storefront). Publishing the Airline domain from `/admin` immediately activates the Flights category on the customer storefront with zero code changes.

## Golden Calculations Verified
- **Hotel Golden Case**: Base `3,000` → Weekend `+20% (3,600)` → Occupancy >80% `+15% (4,140)` → Loyalty `−10% (3,726)` → Round to 10 = **`₹3,730`** (3 nights + 12% Demo tax = **`₹12,533`**).
- **Car Golden Case**: Base `40 + 14 × 8 km = 152` → Demand ratio 1.7× (`×1.4 = 212.8`) → Round to 1 = **`₹213`** (+ 5% Demo tax = **`₹224`**).
- **Flight Golden Case**: Base `5,000` → `<7 days (+25% = 6,250)` → `<20 seats (+15% = 7,187.5)` → Student `−5% (6,828.125)` → Round to 10 = **`₹6,830`** (2 passengers + 5% Demo tax = **`₹14,343`**).

## Running Locally
1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`
3. Start the unified full-stack server (port 3000): `npm run dev`
4. Typecheck: `npm run lint`

## Demo Credentials
- **Loyalty Customer**: `loyalty@demo.travel` / `TravelDemo@2026`
- **Student Customer**: `student@demo.travel` / `TravelDemo@2026`
- **Regular Customer**: `regular@demo.travel` / `TravelDemo@2026`
- **Private Admin Login (`/admin/login`)**: `admin@monetize360.travel` / `AdminPassword2026!`
