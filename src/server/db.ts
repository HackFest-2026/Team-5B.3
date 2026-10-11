import crypto from 'crypto';
import { DomainConfigSchema, executePricingEngine, roundHalfUp } from './engine';

export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: 'customer' | 'admin';
  customer_segment: 'regular' | 'loyalty' | 'student';
  is_active: boolean;
  failed_attempts: number;
  locked_until: number | null;
  last_login_at: string | null;
  created_at: string;
}

export interface ConfigVersionRecord {
  id: string;
  domain_slug: string;
  version_no: number;
  status: 'draft' | 'published' | 'archived';
  author: string;
  note: string;
  created_at: string;
  config: DomainConfigSchema;
}

export interface HotelItem {
  id: string;
  name: string;
  city: string;
  stars: number;
  amenities: string[];
  image_key: string;
  product_id: string;
  subtitle: string;
  base_override?: number;
  occupancy_override?: number;
  rooms_left_override?: number;
}

export interface FlightItem {
  id: string;
  airline_name: string;
  flight_no: string;
  origin: string;
  destination: string;
  depart_at: string;
  arrive_at: string;
  cabin: 'Economy' | 'Premier';
  product_id: string;
  image_key: string;
  base_override?: number;
  seats_left_override?: number;
}

export interface CarItem {
  id: string;
  name: string;
  car_type: 'hatchback' | 'sedan' | 'suv';
  seats: number;
  city: string;
  image_key: string;
  product_id: string;
  subtitle: string;
  base_override?: number;
  cars_left_override?: number;
}

export interface PlaceItem {
  id: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

export interface InventoryRecord {
  category: 'hotel' | 'airline' | 'car';
  item_id: string;
  product_id: string;
  date: string;
  capacity: number;
  booked: number;
}

export interface AuditRecord {
  id: string;
  domain_slug: string;
  category: string;
  item_id: string;
  user_id: string | null;
  config_version: number;
  context: Record<string, any>;
  base_price: number;
  final_price: number;
  breakdown: any[];
  rules_evaluated: any[];
  constraints_applied: string[];
  latency_ms: number;
  created_at: string;
}

export interface QuoteRecord {
  quote_id: string;
  user_id: string | null;
  category: 'hotel' | 'airline' | 'car';
  item_id: string;
  item_title: string;
  item_subtitle: string;
  params: Record<string, any>;
  context: Record<string, any>;
  unit_price: number;
  base_price: number;
  unconstrained_price?: number;
  cap_applied?: boolean;
  cap_details?: any;
  promo_code?: string | null;
  loyalty_tier?: string;
  loyalty_discount_percent?: number;
  quantity: number;
  quantity_label: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  currency: string;
  config_version: number;
  audit_id: string;
  expires_at: string;
  status: 'open' | 'used' | 'expired';
  headline_adjustment: {
    label: string;
    effect: string;
    direction: 'up' | 'down' | 'neutral';
  };
  breakdown: any[];
  constraints_applied: string[];
  created_at: string;
}

export interface BookingRecord {
  id: string;
  user_id: string;
  category: 'hotel' | 'airline' | 'car';
  item_id: string;
  item_title: string;
  details: {
    travellers: { full_name: string; age?: string }[];
    contact: { email: string; phone: string };
    params: Record<string, any>;
  };
  quantity: number;
  quantity_label: string;
  base_price?: number;
  unit_price: number;
  unconstrained_price?: number;
  cap_applied?: boolean;
  cap_details?: any;
  promo_code?: string | null;
  loyalty_tier?: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  currency: string;
  config_version: number;
  audit_id: string;
  quote_id: string;
  idempotency_key: string;
  status: 'confirmed' | 'cancelled';
  is_simulated?: boolean;
  created_at: string;
  cancelled_at?: string;
  refund_amount?: number;
  cancellation_fee?: number;
  cancellation_audit_id?: string;
  refund_breakdown?: any[];
  breakdown: any[];
}

export interface PromoCodeRecord {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number;
  min_spend: number;
  valid_from: string;
  valid_to: string;
  usage_limit: number;
  used_count: number;
  per_user_limit: number;
  user_usages: Record<string, number>;
  categories: ('hotel' | 'airline' | 'car')[];
  stackable: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LoyaltyTierConfig {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  min_bookings: number;
  discount_percent: number;
  badge_label: string;
}

export interface AdminAuditLogRecord {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  category: string;
  target_id: string;
  summary: string;
  details?: Record<string, any>;
  ip: string;
  created_at: string;
}

const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'm360_argon2id_pepper_v2';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(`${password}:${PASSWORD_PEPPER}`, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      const salt = parts[4];
      const expectedHex = parts[5];
      if (!salt || !expectedHex) return false;
      const derived = crypto.scryptSync(`${password}:${PASSWORD_PEPPER}`, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHex, 'hex'));
    }
    const legacySalt = 'm360_argon2id_salt_v1';
    const computed = crypto.scryptSync(password, legacySalt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const HOTEL_PUBLISHED_CONFIG: DomainConfigSchema = {
  domainSlug: 'hotel',
  name: 'Hospitality & Stays',
  currency: 'INR',
  products: [
    { id: 'room_heritage', name: 'Heritage Courtyard Room', baseType: 'fixed', baseValue: 3000 },
    { id: 'room_pavilion', name: 'Grand Sandstone Pavilion', baseType: 'fixed', baseValue: 4200 },
    { id: 'room_royal', name: 'Royal Lakeview Suite', baseType: 'fixed', baseValue: 4800 },
  ],
  attributes: [
    { name: 'day_of_week', type: 'enum', source: 'derived', options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], default: 'Sat' },
    { name: 'occupancy_percent', type: 'number', source: 'signal', default: 85 },
    { name: 'days_to_checkin', type: 'number', source: 'derived', default: 5 },
    { name: 'customer_segment', type: 'enum', source: 'request', options: ['regular', 'loyalty', 'student'], default: 'loyalty' },
    { name: 'loyalty_tier_discount_pct', type: 'number', source: 'derived', default: 0 },
    { name: 'promo_discount_pct', type: 'number', source: 'request', default: 0 },
    { name: 'promo_discount_flat', type: 'number', source: 'request', default: 0 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 10,
  },
  rules: [
    {
      id: 'R-HTL-FEST-01',
      name: 'Autumn Heritage Festival Window',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [],
      effective_from: getRelativeDateStr(3),
      effective_to: getRelativeDateStr(5),
      action: { type: 'percent', value: 15 },
    },
    {
      id: 'R-HTL-FEST-02',
      name: 'Royal Deepavali Season Window',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [],
      effective_from: getRelativeDateStr(11),
      effective_to: getRelativeDateStr(15),
      action: { type: 'percent', value: 25 },
    },
    {
      id: 'R-HTL-01',
      name: 'Weekend stay uplift',
      priority: 1,
      conditionLogic: 'OR',
      conditions: [{ attribute: 'day_of_week', operator: 'in', value: ['Sat', 'Sun'] }],
      action: { type: 'percent', value: 20 },
    },
    {
      id: 'R-HTL-02',
      name: 'High occupancy surge (>80%)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'occupancy_percent', operator: 'gt', value: 80 }],
      action: { type: 'percent', value: 15 },
    },
    {
      id: 'R-HTL-03',
      name: 'Loyalty member privilege',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'customer_segment', operator: 'eq', value: 'loyalty' }],
      action: { type: 'percent', value: -10 },
    },
    {
      id: 'R-HTL-04',
      name: 'Student academic rate',
      priority: 4,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'customer_segment', operator: 'eq', value: 'student' }],
      action: { type: 'percent', value: -5 },
    },
    {
      id: 'R-HTL-05',
      name: 'Loyalty tier benefit',
      priority: 5,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'loyalty_tier_discount_pct', label_from: 'loyalty_tier_label' },
    },
    {
      id: 'R-HTL-06',
      name: 'Promotional percent offer',
      priority: 6,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'promo_discount_pct', label_from: 'promo_step_label' },
    },
    {
      id: 'R-HTL-07',
      name: 'Promotional flat offer',
      priority: 7,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'flat', value: 0, value_from: 'promo_discount_flat', label_from: 'promo_step_label' },
    },
  ],
  constraints: {
    min_price: 2000,
    max_price: 6000,
    max_uplift_percent: 35,
    max_discount_percent: 30,
    minPrice: 2000,
    maxPrice: 6000,
  },
};

export const CAR_PUBLISHED_CONFIG: DomainConfigSchema = {
  domainSlug: 'car',
  name: 'Chauffeur & Urban Mobility',
  currency: 'INR',
  products: [
    { id: 'car_city', name: 'Urban Transfer Fare', baseType: 'formula', baseValue: 40, formulaAttr: 'distance_km', formulaRate: 14 },
    { id: 'car_exec', name: 'Executive Sedan Transfer', baseType: 'formula', baseValue: 80, formulaAttr: 'distance_km', formulaRate: 22 },
    { id: 'car_suv', name: 'Grand Touring SUV', baseType: 'formula', baseValue: 120, formulaAttr: 'distance_km', formulaRate: 28 },
  ],
  attributes: [
    { name: 'distance_km', type: 'number', source: 'derived', default: 8 },
    { name: 'demand_supply_ratio', type: 'number', source: 'signal', default: 1.7 },
    { name: 'is_raining', type: 'boolean', source: 'signal', default: false },
    { name: 'hour_of_day', type: 'number', source: 'derived', default: 14 },
    { name: 'loyalty_tier_discount_pct', type: 'number', source: 'derived', default: 0 },
    { name: 'promo_discount_pct', type: 'number', source: 'request', default: 0 },
    { name: 'promo_discount_flat', type: 'number', source: 'request', default: 0 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 1,
  },
  rules: [
    {
      id: 'R-CAR-01',
      name: 'Peak demand surge (>2.0×)',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'demand_supply_ratio', operator: 'gt', value: 2.0 }],
      action: { type: 'multiplier', value: 1.8 },
      exclusiveGroup: 'demand_tier',
    },
    {
      id: 'R-CAR-02',
      name: 'Elevated demand ratio (>1.5×)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'demand_supply_ratio', operator: 'gt', value: 1.5 }],
      action: { type: 'multiplier', value: 1.4 },
      exclusiveGroup: 'demand_tier',
    },
    {
      id: 'R-CAR-03',
      name: 'Monsoon weather adjustment',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'is_raining', operator: 'eq', value: true }],
      action: { type: 'percent', value: 10 },
    },
    {
      id: 'R-CAR-04',
      name: 'Late night dispatch allowance',
      priority: 4,
      conditionLogic: 'OR',
      conditions: [
        { attribute: 'hour_of_day', operator: 'gte', value: 22 },
        { attribute: 'hour_of_day', operator: 'lte', value: 5 },
      ],
      action: { type: 'percent', value: 15 },
    },
    {
      id: 'R-CAR-05',
      name: 'Loyalty tier benefit',
      priority: 5,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'loyalty_tier_discount_pct', label_from: 'loyalty_tier_label' },
    },
    {
      id: 'R-CAR-06',
      name: 'Promotional percent offer',
      priority: 6,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'promo_discount_pct', label_from: 'promo_step_label' },
    },
    {
      id: 'R-CAR-07',
      name: 'Promotional flat offer',
      priority: 7,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'flat', value: 0, value_from: 'promo_discount_flat', label_from: 'promo_step_label' },
    },
  ],
  constraints: {
    min_price: 60,
    max_price: 5000,
    max_uplift_percent: 100,
    max_discount_percent: 30,
    minPrice: 60,
  },
};

export const AIRLINE_TEMPLATE_CONFIG: DomainConfigSchema = {
  domainSlug: 'airline',
  name: 'Commercial Aviation & Flights',
  currency: 'INR',
  products: [
    { id: 'flight_econ', name: 'Standard Economy Cabin', baseType: 'fixed', baseValue: 5000 },
    { id: 'flight_prem', name: 'Premier Club Cabin', baseType: 'fixed', baseValue: 9500 },
  ],
  attributes: [
    { name: 'days_to_departure', type: 'number', source: 'derived', default: 5 },
    { name: 'seats_left', type: 'number', source: 'signal', default: 12 },
    { name: 'customer_segment', type: 'enum', source: 'request', options: ['regular', 'loyalty', 'student'], default: 'student' },
    { name: 'cabin', type: 'enum', source: 'request', options: ['Economy', 'Premier'], default: 'Economy' },
    { name: 'loyalty_tier_discount_pct', type: 'number', source: 'derived', default: 0 },
    { name: 'promo_discount_pct', type: 'number', source: 'request', default: 0 },
    { name: 'promo_discount_flat', type: 'number', source: 'request', default: 0 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 10,
  },
  rules: [
    {
      id: 'R-AIR-01',
      name: 'Close-in departure window (<7 days)',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'days_to_departure', operator: 'lt', value: 7 }],
      action: { type: 'percent', value: 25 },
    },
    {
      id: 'R-AIR-02',
      name: 'Low inventory scarcity (<20 seats)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'seats_left', operator: 'lt', value: 20 }],
      action: { type: 'percent', value: 15 },
    },
    {
      id: 'R-AIR-03',
      name: 'Student scholar concession',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'customer_segment', operator: 'eq', value: 'student' }],
      action: { type: 'percent', value: -5 },
    },
    {
      id: 'R-AIR-05',
      name: 'Loyalty tier benefit',
      priority: 5,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'loyalty_tier_discount_pct', label_from: 'loyalty_tier_label' },
    },
    {
      id: 'R-AIR-06',
      name: 'Promotional percent offer',
      priority: 6,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'percent', value: 0, value_from: 'promo_discount_pct', label_from: 'promo_step_label' },
    },
    {
      id: 'R-AIR-07',
      name: 'Promotional flat offer',
      priority: 7,
      conditionLogic: 'AND',
      conditions: [],
      action: { type: 'flat', value: 0, value_from: 'promo_discount_flat', label_from: 'promo_step_label' },
    },
  ],
  constraints: {
    min_price: 2000,
    max_price: 25000,
    max_uplift_percent: 40,
    max_discount_percent: 30,
    minPrice: 2000,
    maxPrice: 25000,
  },
};

export const HOTEL_CANCELLATION_CONFIG: DomainConfigSchema = {
  domainSlug: 'hotel_cancellation',
  name: 'Hotel Cancellation & Refund Policy',
  currency: 'INR',
  products: [
    { id: 'refund_calc', name: 'Amount Paid', baseType: 'attribute', baseValue: 0, formulaAttr: 'amount_paid' },
  ],
  attributes: [
    { name: 'amount_paid', type: 'number', source: 'request', default: 12533 },
    { name: 'hours_before_checkin', type: 'number', source: 'derived', default: 48 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 1,
  },
  rules: [
    {
      id: 'R-CHTL-01',
      name: 'Free cancellation window (≥72h before check-in: 0% fee)',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'hours_before_checkin', operator: 'gte', value: 72 }],
      action: { type: 'percent', value: 0 },
      exclusiveGroup: 'cancel_tier',
    },
    {
      id: 'R-CHTL-02',
      name: 'Standard cancellation window (24h–72h before check-in: 50% fee)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [
        { attribute: 'hours_before_checkin', operator: 'gte', value: 24 },
        { attribute: 'hours_before_checkin', operator: 'lt', value: 72 },
      ],
      action: { type: 'percent', value: -50 },
      exclusiveGroup: 'cancel_tier',
    },
    {
      id: 'R-CHTL-03',
      name: 'Late cancellation window (<24h before check-in: 100% fee)',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'hours_before_checkin', operator: 'lt', value: 24 }],
      action: { type: 'percent', value: -100 },
      exclusiveGroup: 'cancel_tier',
    },
  ],
  constraints: {
    min_price: 0,
  },
};

export const AIRLINE_CANCELLATION_CONFIG: DomainConfigSchema = {
  domainSlug: 'airline_cancellation',
  name: 'Airline Cancellation & Refund Policy',
  currency: 'INR',
  products: [
    { id: 'refund_calc', name: 'Amount Paid', baseType: 'attribute', baseValue: 0, formulaAttr: 'amount_paid' },
  ],
  attributes: [
    { name: 'amount_paid', type: 'number', source: 'request', default: 14343 },
    { name: 'days_before_departure', type: 'number', source: 'derived', default: 4 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 1,
  },
  rules: [
    {
      id: 'R-CAIR-01',
      name: 'Advance cancellation window (≥7 days before departure: 10% fee)',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'days_before_departure', operator: 'gte', value: 7 }],
      action: { type: 'percent', value: -10 },
      exclusiveGroup: 'cancel_tier',
    },
    {
      id: 'R-CAIR-02',
      name: 'Moderate notice cancellation (2–7 days before departure: 30% fee)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [
        { attribute: 'days_before_departure', operator: 'gte', value: 2 },
        { attribute: 'days_before_departure', operator: 'lt', value: 7 },
      ],
      action: { type: 'percent', value: -30 },
      exclusiveGroup: 'cancel_tier',
    },
    {
      id: 'R-CAIR-03',
      name: 'Close-in cancellation (<2 days before departure: 60% fee)',
      priority: 3,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'days_before_departure', operator: 'lt', value: 2 }],
      action: { type: 'percent', value: -60 },
      exclusiveGroup: 'cancel_tier',
    },
  ],
  constraints: {
    min_price: 0,
  },
};

export const CAR_CANCELLATION_CONFIG: DomainConfigSchema = {
  domainSlug: 'car_cancellation',
  name: 'Car Dispatch Cancellation & Refund Policy',
  currency: 'INR',
  products: [
    { id: 'refund_calc', name: 'Amount Paid', baseType: 'attribute', baseValue: 0, formulaAttr: 'amount_paid' },
  ],
  attributes: [
    { name: 'amount_paid', type: 'number', source: 'request', default: 224 },
    { name: 'minutes_before_pickup', type: 'number', source: 'derived', default: 5 },
  ],
  strategy: {
    stacking: 'sequential',
    roundTo: 1,
  },
  rules: [
    {
      id: 'R-CCAR-01',
      name: 'Free cancellation window (≥10 min before pickup: ₹0 fee)',
      priority: 1,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'minutes_before_pickup', operator: 'gte', value: 10 }],
      action: { type: 'flat', value: 0 },
      exclusiveGroup: 'cancel_tier',
    },
    {
      id: 'R-CCAR-02',
      name: 'Late dispatch cancellation (<10 min before pickup: Flat ₹50 fee)',
      priority: 2,
      conditionLogic: 'AND',
      conditions: [{ attribute: 'minutes_before_pickup', operator: 'lt', value: 10 }],
      action: { type: 'flat', value: -50 },
      exclusiveGroup: 'cancel_tier',
    },
  ],
  constraints: {
    min_price: 0,
  },
};

export const HOTELS_DATA: HotelItem[] = [
  {
    id: 'htl-udaipur-01',
    name: 'THE ARAVALLI SANDSTONE HAVELI',
    city: 'Udaipur',
    stars: 5,
    amenities: ['Courtyard Pool', 'Spa Sanctuary', 'Private Veranda', 'Breakfast Included'],
    image_key: 'hero_hotel',
    product_id: 'room_heritage',
    subtitle: 'Lake Pichola East Bank · Heritage Courtyard Room',
  },
  {
    id: 'htl-udaipur-02',
    name: 'SURYA GARH PALACE RETREAT',
    city: 'Udaipur',
    stars: 5,
    amenities: ['Lakefront Terrace', 'Ayurvedic Spa', 'Fine Dining', 'Butler Service'],
    image_key: 'suite_hotel',
    product_id: 'room_pavilion',
    subtitle: 'Fateh Sagar Ridge · Grand Sandstone Pavilion',
  },
  {
    id: 'htl-jaipur-01',
    name: 'THE AMBER TERRACOTTA MANOR',
    city: 'Jaipur',
    stars: 5,
    amenities: ['Courtyard Pool', 'Rooftop Dining', 'Heritage Library', 'Chauffeur Transfer'],
    image_key: 'hero_hotel',
    product_id: 'room_heritage',
    subtitle: 'Amer Road Foothills · Heritage Courtyard Room',
  },
  {
    id: 'htl-jaipur-02',
    name: 'RAJWADA VERANDA RESIDENCES',
    city: 'Jaipur',
    stars: 4,
    amenities: ['Garden Courtyard', 'Artisan Cafe', 'High-Speed Wi-Fi'],
    image_key: 'suite_hotel',
    product_id: 'room_pavilion',
    subtitle: 'Civil Lines · Grand Sandstone Pavilion',
  },
  {
    id: 'htl-goa-01',
    name: 'CASA DE TRAVERTINE ASSAGAO',
    city: 'Goa',
    stars: 5,
    amenities: ['Saltwater Lap Pool', 'Portuguese Gardens', 'Private Veranda', 'Breakfast Included'],
    image_key: 'suite_hotel',
    product_id: 'room_heritage',
    subtitle: 'Assagao Valley · Heritage Courtyard Room',
  },
  {
    id: 'htl-goa-02',
    name: 'ESTUARY TEAK PAVILIONS',
    city: 'Goa',
    stars: 5,
    amenities: ['Riverfront Deck', 'Spa Sanctuary', 'Private Plunge Pool'],
    image_key: 'hero_hotel',
    product_id: 'room_royal',
    subtitle: 'Mandovi Backwaters · Royal Lakeview Suite',
  },
  {
    id: 'htl-bengaluru-01',
    name: 'THE LAVELLA BOTANIC CLUB',
    city: 'Bengaluru',
    stars: 5,
    amenities: ['Executive Lounge', 'Heated Lap Pool', 'Artisan Roastery', 'Gymnasium'],
    image_key: 'suite_hotel',
    product_id: 'room_heritage',
    subtitle: 'Lavelle Road · Heritage Courtyard Room',
  },
  {
    id: 'htl-mumbai-01',
    name: 'BALLARD PIER ART DECO CHAMBERS',
    city: 'Mumbai',
    stars: 5,
    amenities: ['Harbour View', 'Private Club', 'Chauffeur Transfer', 'Breakfast Included'],
    image_key: 'hero_hotel',
    product_id: 'room_royal',
    subtitle: 'Fort Precinct · Royal Lakeview Suite',
  },
];

export const FLIGHTS_DATA: FlightItem[] = [
  {
    id: 'flt-sky-104',
    airline_name: 'Skyline Air',
    flight_no: 'SK-104',
    origin: 'Bengaluru',
    destination: 'Udaipur',
    depart_at: '07:15',
    arrive_at: '09:40',
    cabin: 'Economy',
    product_id: 'flight_econ',
    image_key: 'airliner_sunset',
  },
  {
    id: 'flt-mon-218',
    airline_name: 'Monsoon Airways',
    flight_no: 'MW-218',
    origin: 'Bengaluru',
    destination: 'Udaipur',
    depart_at: '16:30',
    arrive_at: '18:55',
    cabin: 'Economy',
    product_id: 'flight_econ',
    image_key: 'airliner_sunset',
  },
  {
    id: 'flt-sky-309',
    airline_name: 'Skyline Air',
    flight_no: 'SK-309',
    origin: 'Mumbai',
    destination: 'Jaipur',
    depart_at: '08:45',
    arrive_at: '10:35',
    cabin: 'Economy',
    product_id: 'flight_econ',
    image_key: 'airliner_sunset',
  },
  {
    id: 'flt-mon-402',
    airline_name: 'Monsoon Airways',
    flight_no: 'MW-402',
    origin: 'Mumbai',
    destination: 'Goa',
    depart_at: '11:20',
    arrive_at: '12:35',
    cabin: 'Economy',
    product_id: 'flight_econ',
    image_key: 'airliner_sunset',
  },
  {
    id: 'flt-sky-512',
    airline_name: 'Skyline Air',
    flight_no: 'SK-512',
    origin: 'Bengaluru',
    destination: 'Jaipur',
    depart_at: '13:10',
    arrive_at: '15:45',
    cabin: 'Premier',
    product_id: 'flight_prem',
    image_key: 'airliner_sunset',
  },
  {
    id: 'flt-mon-615',
    airline_name: 'Monsoon Airways',
    flight_no: 'MW-615',
    origin: 'Delhi',
    destination: 'Udaipur',
    depart_at: '09:00',
    arrive_at: '10:25',
    cabin: 'Economy',
    product_id: 'flight_econ',
    image_key: 'airliner_sunset',
  },
];

export const CARS_DATA: CarItem[] = [
  {
    id: 'car-city-01',
    name: 'AURA URBAN ELECTRIC COMPACT',
    car_type: 'hatchback',
    seats: 4,
    city: 'Udaipur',
    image_key: 'exec_sedan',
    product_id: 'car_city',
    subtitle: 'Point-to-Point Urban Transfer · Zero Emission Compact',
  },
  {
    id: 'car-sedan-01',
    name: 'SOVEREIGN ESPRESSO SALOON',
    car_type: 'sedan',
    seats: 4,
    city: 'Udaipur',
    image_key: 'exec_sedan',
    product_id: 'car_city',
    subtitle: 'Chauffeur Driven Saloon · Acoustic Glass Cabin',
  },
  {
    id: 'car-exec-02',
    name: 'GRAND TRAVERTINE EXECUTIVE SEDAN',
    car_type: 'sedan',
    seats: 4,
    city: 'Bengaluru',
    image_key: 'exec_sedan',
    product_id: 'car_exec',
    subtitle: 'Executive Airport & Inter-Precinct Transfer',
  },
  {
    id: 'car-suv-01',
    name: 'ARAVALLI LAND CRUISER SUV',
    car_type: 'suv',
    seats: 6,
    city: 'Jaipur',
    image_key: 'exec_sedan',
    product_id: 'car_suv',
    subtitle: '6-Passenger Lounge Seating · All-Terrain Luxury',
  },
];

export const PLACES_DATA: PlaceItem[] = [
  { id: 'plc-udp-01', city: 'Udaipur', name: 'Lake Pichola East Pier', lat: 24.5760, lng: 73.6800 },
  { id: 'plc-udp-02', city: 'Udaipur', name: 'Monsoon Palace Ridge Gate (8.0 km)', lat: 24.6313, lng: 73.6800 },
  { id: 'plc-udp-03', city: 'Udaipur', name: 'Maharana Pratap Dabok Airport (21.5 km)', lat: 24.6177, lng: 73.8961 },
  { id: 'plc-blr-01', city: 'Bengaluru', name: 'Lavelle Road Pavilion', lat: 12.9716, lng: 77.5946 },
  { id: 'plc-blr-02', city: 'Bengaluru', name: 'Indiranagar 100ft Boulevard (8.0 km)', lat: 13.0269, lng: 77.5946 },
  { id: 'plc-blr-03', city: 'Bengaluru', name: 'Kempegowda International Terminal (34.2 km)', lat: 13.1986, lng: 77.7066 },
  { id: 'plc-jai-01', city: 'Jaipur', name: 'Rambagh Polo Precinct', lat: 26.8980, lng: 75.8080 },
  { id: 'plc-jai-02', city: 'Jaipur', name: 'Amer Fort Sandstone Ramparts (12.4 km)', lat: 26.9855, lng: 75.8513 },
  { id: 'plc-goa-01', city: 'Goa', name: 'Assagao Banyan Crossroads', lat: 15.6010, lng: 73.7880 },
  { id: 'plc-goa-02', city: 'Goa', name: 'Panjim Fontainhas Latin Quarter (18.6 km)', lat: 15.4989, lng: 73.8278 },
];

class DatabaseStore {
  users: UserRecord[] = [];
  configVersions: ConfigVersionRecord[] = [];
  inventory: InventoryRecord[] = [];
  audits: AuditRecord[] = [];
  quotes: QuoteRecord[] = [];
  bookings: BookingRecord[] = [];
  promoCodes: PromoCodeRecord[] = [];
  loyaltyTiers: LoyaltyTierConfig[] = [];
  adminAuditLogs: AdminAuditLogRecord[] = [];
  authEvents: { id: string; user_id: string | null; event: string; ip: string; created_at: string }[] = [];

  appSettings: Record<string, number> = {
    tax_percent_hotel: 12,
    tax_percent_airline: 5,
    tax_percent_car: 5,
  };

  contextSignals: {
    demand_supply_ratio: number;
    is_raining: boolean;
    default_hotel_occupancy: number;
    default_flight_seats_left: number;
  } = {
    demand_supply_ratio: 1.7,
    is_raining: false,
    default_hotel_occupancy: 85,
    default_flight_seats_left: 12,
  };

  constructor() {
    this.seed();
  }

  seed() {
    const now = new Date().toISOString();
    const adminEmail = 'admin@monetize360.travel';
    const adminPass = 'AdminPassword2026!';

    this.users = [
      {
        id: 'usr-admin-01',
        full_name: 'Vikramaditya Rao (Principal Admin)',
        email: adminEmail,
        phone: '9845011223',
        password_hash: hashPassword(adminPass),
        role: 'admin',
        customer_segment: 'regular',
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
        last_login_at: now,
        created_at: now,
      },
      {
        id: 'usr-loyalty-01',
        full_name: 'Ananya Deshmukh',
        email: 'loyalty@demo.travel',
        phone: '9820123456',
        password_hash: hashPassword('TravelDemo@2026'),
        role: 'customer',
        customer_segment: 'loyalty',
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
        last_login_at: now,
        created_at: now,
      },
      {
        id: 'usr-student-01',
        full_name: 'Rohan Kulkarni',
        email: 'student@demo.travel',
        phone: '9811223344',
        password_hash: hashPassword('TravelDemo@2026'),
        role: 'customer',
        customer_segment: 'student',
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
        last_login_at: now,
        created_at: now,
      },
      {
        id: 'usr-regular-01',
        full_name: 'Meera Nair',
        email: 'regular@demo.travel',
        phone: '9833445566',
        password_hash: hashPassword('TravelDemo@2026'),
        role: 'customer',
        customer_segment: 'regular',
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
        last_login_at: now,
        created_at: now,
      },
    ];

    const hotelV1: DomainConfigSchema = {
      ...HOTEL_PUBLISHED_CONFIG,
      rules: HOTEL_PUBLISHED_CONFIG.rules.slice(0, 2),
    };

    this.configVersions = [
      {
        id: 'cfg-hotel-v1',
        domain_slug: 'hotel',
        version_no: 1,
        status: 'archived',
        author: 'admin@monetize360.travel',
        note: 'Initial weekend & occupancy rules',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        config: hotelV1,
      },
      {
        id: 'cfg-hotel-v2',
        domain_slug: 'hotel',
        version_no: 2,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Added loyalty -10% & student -5% sequential rules (Golden v2)',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        config: HOTEL_PUBLISHED_CONFIG,
      },
      {
        id: 'cfg-car-v1',
        domain_slug: 'car',
        version_no: 1,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Distance formula (40 + 14*km) + demand ratio tiers + surge cap 2.5x',
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        config: CAR_PUBLISHED_CONFIG,
      },
      {
        id: 'cfg-airline-v1',
        domain_slug: 'airline',
        version_no: 1,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Published Airline Golden Configuration (<7d +25%, <20 seats +15%, student -5%, round 10)',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        config: AIRLINE_TEMPLATE_CONFIG,
      },
      {
        id: 'cfg-airline-v2-draft',
        domain_slug: 'airline',
        version_no: 2,
        status: 'draft',
        author: 'admin@monetize360.travel',
        note: 'Staged Airline v2 draft with Early Bird (>21d -10%) rule',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        config: {
          ...AIRLINE_TEMPLATE_CONFIG,
          rules: [
            ...AIRLINE_TEMPLATE_CONFIG.rules,
            {
              id: 'R-AIR-04',
              name: 'Early bird advance purchase (>21 days)',
              priority: 4,
              conditionLogic: 'AND',
              conditions: [{ attribute: 'days_to_departure', operator: 'gt', value: 21 }],
              action: { type: 'percent', value: -10 },
            },
          ],
        },
      },
      {
        id: 'cfg-hotel-cancel-v1',
        domain_slug: 'hotel_cancellation',
        version_no: 1,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Hotel cancellation fee tiers (≥72h 0%, 24–72h 50%, <24h 100%)',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        config: HOTEL_CANCELLATION_CONFIG,
      },
      {
        id: 'cfg-airline-cancel-v1',
        domain_slug: 'airline_cancellation',
        version_no: 1,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Airline cancellation fee tiers (≥7d 10%, 2–7d 30%, <2d 60%)',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        config: AIRLINE_CANCELLATION_CONFIG,
      },
      {
        id: 'cfg-car-cancel-v1',
        domain_slug: 'car_cancellation',
        version_no: 1,
        status: 'published',
        author: 'admin@monetize360.travel',
        note: 'Car cancellation fee tiers (≥10m ₹0, <10m flat ₹50)',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        config: CAR_CANCELLATION_CONFIG,
      },
    ];

    this.loyaltyTiers = [
      { tier: 'Bronze', min_bookings: 0, discount_percent: 0, badge_label: 'Bronze Member (Standard)' },
      { tier: 'Silver', min_bookings: 1, discount_percent: 3, badge_label: 'Silver Tier (−3% Fare Privilege)' },
      { tier: 'Gold', min_bookings: 3, discount_percent: 5, badge_label: 'Gold Tier (−5% Fare Privilege)' },
      { tier: 'Platinum', min_bookings: 6, discount_percent: 8, badge_label: 'Platinum Tier (−8% Fare Privilege)' },
    ];

    this.promoCodes = [
      {
        id: 'prm-welcome10',
        code: 'WELCOME10',
        description: '10% off across Hotel, Airlines & Chauffeur transfers',
        type: 'percent',
        value: 10,
        min_spend: 1000,
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        usage_limit: 100,
        used_count: 4,
        per_user_limit: 3,
        user_usages: {},
        categories: ['hotel', 'airline', 'car'],
        stackable: true,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
      {
        id: 'prm-heritage15',
        code: 'HERITAGE15',
        description: '15% off luxury heritage hotel stays (min ₹3,000)',
        type: 'percent',
        value: 15,
        min_spend: 3000,
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        usage_limit: 50,
        used_count: 2,
        per_user_limit: 2,
        user_usages: {},
        categories: ['hotel'],
        stackable: true,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      },
      {
        id: 'prm-monsoon500',
        code: 'MONSOON500',
        description: 'Flat ₹500 off Hotel & Airline bookings above ₹3,500',
        type: 'flat',
        value: 500,
        min_spend: 3500,
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        usage_limit: 50,
        used_count: 1,
        per_user_limit: 2,
        user_usages: {},
        categories: ['hotel', 'airline'],
        stackable: true,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
      {
        id: 'prm-cabflat40',
        code: 'CABFLAT40',
        description: 'Flat ₹40 off point-to-point urban car transfers (non-stackable)',
        type: 'flat',
        value: 40,
        min_spend: 150,
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        usage_limit: 200,
        used_count: 5,
        per_user_limit: 5,
        user_usages: {},
        categories: ['car'],
        stackable: false,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      },
      {
        id: 'prm-expired20',
        code: 'EXPIRED20',
        description: ' Legacy 2025 seasonal campaign (expired window)',
        type: 'percent',
        value: 20,
        min_spend: 500,
        valid_from: '2025-01-01',
        valid_to: '2025-12-31',
        usage_limit: 50,
        used_count: 12,
        per_user_limit: 1,
        user_usages: {},
        categories: ['hotel', 'airline', 'car'],
        stackable: true,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
      },
      {
        id: 'prm-limit1',
        code: 'LIMIT1',
        description: 'Single-use flash voucher (global redemption cap reached)',
        type: 'percent',
        value: 15,
        min_spend: 500,
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        usage_limit: 1,
        used_count: 1,
        per_user_limit: 1,
        user_usages: {},
        categories: ['hotel', 'airline', 'car'],
        stackable: true,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
    ];

    this.adminAuditLogs = [
      {
        id: 'ALOG-1001',
        actor_id: 'usr-admin-01',
        actor_email: 'admin@monetize360.travel',
        action: 'CONFIG_PUBLISHED',
        category: 'hotel',
        target_id: 'cfg-hotel-v2',
        summary: 'Published Hospitality & Stays v2 with festival windows and guardrails (+35% cap, -30% floor)',
        ip: '127.0.0.1',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'ALOG-1002',
        actor_id: 'usr-admin-01',
        actor_email: 'admin@monetize360.travel',
        action: 'GUARDRAILS_UPDATED',
        category: 'airline',
        target_id: 'cfg-airline-v1',
        summary: 'Configured Airline guardrails: min ₹2,000, max ₹25,000, max uplift +40%, max discount -30%',
        ip: '127.0.0.1',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'ALOG-1003',
        actor_id: 'usr-admin-01',
        actor_email: 'admin@monetize360.travel',
        action: 'PROMO_SEEDED',
        category: 'all',
        target_id: 'WELCOME10',
        summary: 'Activated WELCOME10 (-10%), HERITAGE15 (-15%), MONSOON500 (-₹500), CABFLAT40 (-₹40)',
        ip: '127.0.0.1',
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
    ];

    this.audits = [
      {
        id: 'AUD-2026-8841',
        domain_slug: 'hotel',
        category: 'hotel',
        item_id: 'htl-udaipur-01',
        user_id: 'usr-loyalty-01',
        config_version: 2,
        context: {
          day_of_week: 'Sat',
          occupancy_percent: 85,
          days_to_checkin: 5,
          customer_segment: 'loyalty',
        },
        base_price: 3000,
        final_price: 3730,
        breakdown: [
          { step: 'Base fare (Heritage Courtyard Room)', effect: 'Base', direction: 'neutral', running: 3000 },
          { step: 'Weekend stay uplift', rule_id: 'R-HTL-01', effect: '+20%', direction: 'up', running: 3600 },
          { step: 'High occupancy surge (>80%)', rule_id: 'R-HTL-02', effect: '+15%', direction: 'up', running: 4140 },
          { step: 'Loyalty member privilege', rule_id: 'R-HTL-03', effect: '−10%', direction: 'down', running: 3726 },
          { step: 'Round to nearest 10 (Half-Up)', effect: '+₹4', direction: 'neutral', running: 3730 },
        ],
        rules_evaluated: [
          { id: 'R-HTL-01', name: 'Weekend stay uplift', fired: true, reason: 'Matched OR: day_of_week (Sat) in Sat|Sun', effect_str: '+20%', counterfactual_price: 3110 },
          { id: 'R-HTL-02', name: 'High occupancy surge (>80%)', fired: true, reason: 'Matched all: occupancy_percent (85) gt 80', effect_str: '+15%', counterfactual_price: 3240 },
          { id: 'R-HTL-03', name: 'Loyalty member privilege', fired: true, reason: 'Matched all: customer_segment (loyalty) eq loyalty', effect_str: '−10%', counterfactual_price: 4140 },
          { id: 'R-HTL-04', name: 'Student academic rate', fired: false, reason: 'Condition not met: customer_segment (loyalty) eq student', effect_str: '—' },
        ],
        constraints_applied: [],
        latency_ms: 1.8,
        created_at: now,
      },
      {
        id: 'AUD-2026-8842',
        domain_slug: 'car',
        category: 'car',
        item_id: 'car-sedan-01',
        user_id: 'usr-regular-01',
        config_version: 1,
        context: {
          distance_km: 8,
          demand_supply_ratio: 1.7,
          is_raining: false,
          hour_of_day: 14,
        },
        base_price: 152,
        final_price: 213,
        breakdown: [
          { step: 'Base formula (40 + 14 × 8)', effect: 'Base', direction: 'neutral', running: 152 },
          { step: 'Elevated demand ratio (>1.5×)', rule_id: 'R-CAR-02', effect: '×1.4', direction: 'up', running: 212.8 },
          { step: 'Round to nearest 1 (Half-Up)', effect: '+₹0.2', direction: 'neutral', running: 213 },
        ],
        rules_evaluated: [
          { id: 'R-CAR-01', name: 'Peak demand surge (>2.0×)', fired: false, reason: 'Condition not met: demand_supply_ratio (1.7) gt 2', effect_str: '—' },
          { id: 'R-CAR-02', name: 'Elevated demand ratio (>1.5×)', fired: true, reason: 'Matched all: demand_supply_ratio (1.7) gt 1.5', effect_str: '×1.4', counterfactual_price: 152 },
          { id: 'R-CAR-03', name: 'Monsoon weather adjustment', fired: false, reason: 'Condition not met: is_raining (false) eq true', effect_str: '—' },
          { id: 'R-CAR-04', name: 'Late night dispatch allowance', fired: false, reason: 'Failed all OR conditions: hour_of_day (14) gte 22; hour_of_day (14) lte 5', effect_str: '—' },
        ],
        constraints_applied: [],
        latency_ms: 1.4,
        created_at: now,
      },
      {
        id: 'AUD-2026-8843',
        domain_slug: 'airline',
        category: 'airline',
        item_id: 'flt-sky-104',
        user_id: 'usr-student-01',
        config_version: 1,
        context: {
          days_to_departure: 5,
          seats_left: 12,
          customer_segment: 'student',
          cabin: 'Economy',
        },
        base_price: 5000,
        final_price: 6830,
        breakdown: [
          { step: 'Base fare (Standard Economy Cabin)', effect: 'Base', direction: 'neutral', running: 5000 },
          { step: 'Close-in departure window (<7 days)', rule_id: 'R-AIR-01', effect: '+25%', direction: 'up', running: 6250 },
          { step: 'Low inventory scarcity (<20 seats)', rule_id: 'R-AIR-02', effect: '+15%', direction: 'up', running: 7187.5 },
          { step: 'Student scholar concession', rule_id: 'R-AIR-03', effect: '−5%', direction: 'down', running: 6828.13 },
          { step: 'Round to nearest 10 (Half-Up)', effect: '+₹1.88', direction: 'neutral', running: 6830 },
        ],
        rules_evaluated: [
          { id: 'R-AIR-01', name: 'Close-in departure window (<7 days)', fired: true, reason: 'Matched all: days_to_departure (5) lt 7', effect_str: '+25%', counterfactual_price: 5460 },
          { id: 'R-AIR-02', name: 'Low inventory scarcity (<20 seats)', fired: true, reason: 'Matched all: seats_left (12) lt 20', effect_str: '+15%', counterfactual_price: 5940 },
          { id: 'R-AIR-03', name: 'Student scholar concession', fired: true, reason: 'Matched all: customer_segment (student) eq student', effect_str: '−5%', counterfactual_price: 7190 },
        ],
        constraints_applied: [],
        latency_ms: 1.5,
        created_at: now,
      },
    ];

    this.bookings = [
      {
        id: 'BK-8843F104',
        user_id: 'usr-student-01',
        category: 'airline',
        item_id: 'flt-sky-104',
        item_title: 'Skyline Air · SK-104',
        details: {
          travellers: [
            { full_name: 'Rohan Kulkarni', age: '21' },
            { full_name: 'Aarav Kulkarni', age: '20' },
          ],
          contact: { email: 'student@demo.travel', phone: '9811223344' },
          params: { origin: 'Bengaluru', destination: 'Udaipur', date: '2026-10-15', passengers: 2, cabin: 'Economy', productId: 'flight_econ', dateKey: '2026-10-15' },
        },
        quantity: 2,
        quantity_label: '2 passengers · Economy',
        base_price: 5000,
        unit_price: 6830,
        subtotal: 13660,
        tax_percent: 5,
        tax_amount: 683,
        total: 14343,
        currency: 'INR',
        config_version: 1,
        audit_id: 'AUD-2026-8843',
        quote_id: 'QT-SEED-AIR-01',
        idempotency_key: 'seed-idem-air-01',
        status: 'confirmed',
        is_simulated: false,
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        breakdown: this.audits[2].breakdown,
      },
      {
        id: 'BK-8841H01',
        user_id: 'usr-loyalty-01',
        category: 'hotel',
        item_id: 'htl-udaipur-01',
        item_title: 'THE ARAVALLI SANDSTONE HAVELI',
        details: {
          travellers: [{ full_name: 'Ananya Deshmukh' }],
          contact: { email: 'loyalty@demo.travel', phone: '9820123456' },
          params: { city: 'Udaipur', check_in: '2026-10-17', check_out: '2026-10-20', rooms: 1, guests: 2, productId: 'room_heritage', dateKey: '2026-10-17' },
        },
        quantity: 3,
        quantity_label: '3 nights × 1 room',
        base_price: 3000,
        unit_price: 3730,
        subtotal: 11190,
        tax_percent: 12,
        tax_amount: 1343,
        total: 12533,
        currency: 'INR',
        config_version: 2,
        audit_id: 'AUD-2026-8841',
        quote_id: 'QT-SEED-HTL-01',
        idempotency_key: 'seed-idem-htl-01',
        status: 'confirmed',
        is_simulated: false,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        breakdown: this.audits[0].breakdown,
      },
      {
        id: 'BK-8842C01',
        user_id: 'usr-regular-01',
        category: 'car',
        item_id: 'car-sedan-01',
        item_title: 'SOVEREIGN ESPRESSO SALOON',
        details: {
          travellers: [{ full_name: 'Meera Nair' }],
          contact: { email: 'regular@demo.travel', phone: '9833445566' },
          params: { pickup_id: 'plc-udp-01', drop_id: 'plc-udp-02', pickup_at: '14:00', productId: 'car_city', dateKey: '2026-10-17' },
        },
        quantity: 1,
        quantity_label: '1 transfer (8 km)',
        base_price: 152,
        unit_price: 213,
        subtotal: 213,
        tax_percent: 5,
        tax_amount: 11,
        total: 224,
        currency: 'INR',
        config_version: 1,
        audit_id: 'AUD-2026-8842',
        quote_id: 'QT-SEED-CAR-01',
        idempotency_key: 'seed-idem-car-01',
        status: 'confirmed',
        is_simulated: false,
        created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
        breakdown: this.audits[1].breakdown,
      },
    ];
    this.inventory = [];
    this.quotes = [];
  }

  resetDemoData() {
    this.seed();
  }

  getCustomerLoyaltyTier(userId: string | null): {
    tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
    confirmed_bookings: number;
    discount_percent: number;
    badge_label: string;
    next_tier: string | null;
    bookings_to_next: number;
  } {
    const sortedTiers = [...this.loyaltyTiers].sort((a, b) => a.min_bookings - b.min_bookings);
    if (!userId) {
      const bronze = sortedTiers[0] || { tier: 'Bronze' as const, min_bookings: 0, discount_percent: 0, badge_label: 'Bronze Member' };
      const next = sortedTiers[1];
      return {
        tier: bronze.tier,
        confirmed_bookings: 0,
        discount_percent: bronze.discount_percent,
        badge_label: bronze.badge_label,
        next_tier: next ? next.tier : null,
        bookings_to_next: next ? next.min_bookings : 0,
      };
    }

    const confirmedCount = this.bookings.filter(
      (b) => b.user_id === userId && b.status === 'confirmed' && !b.is_simulated
    ).length;

    let current = sortedTiers[0];
    let nextTier: LoyaltyTierConfig | null = null;
    for (let i = 0; i < sortedTiers.length; i++) {
      if (confirmedCount >= sortedTiers[i].min_bookings) {
        current = sortedTiers[i];
        nextTier = sortedTiers[i + 1] || null;
      }
    }

    return {
      tier: current.tier,
      confirmed_bookings: confirmedCount,
      discount_percent: current.discount_percent,
      badge_label: current.badge_label,
      next_tier: nextTier ? nextTier.tier : null,
      bookings_to_next: nextTier ? Math.max(0, nextTier.min_bookings - confirmedCount) : 0,
    };
  }

  logAdminAction(
    actor: UserRecord | null,
    action: string,
    category: string,
    targetId: string,
    summary: string,
    details?: Record<string, any>,
    ip: string = '127.0.0.1'
  ): AdminAuditLogRecord {
    const rec: AdminAuditLogRecord = {
      id: `ALOG-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`,
      actor_id: actor ? actor.id : 'system',
      actor_email: actor ? actor.email : 'system@monetize360.travel',
      action,
      category,
      target_id: targetId,
      summary,
      details,
      ip,
      created_at: new Date().toISOString(),
    };
    this.adminAuditLogs.unshift(rec);
    return rec;
  }

  generateSimulatedBookings(count: number = 500): { generated: number; total_bookings: number } {
    this.bookings = this.bookings.filter((b) => !b.is_simulated);
    this.audits = this.audits.filter((a) => !a.id.startsWith('AUD-SIM-'));

    let seed = 20261010;
    const nextRand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const hotelCfg = this.getPublishedConfig('hotel')?.config || HOTEL_PUBLISHED_CONFIG;
    const airCfg = this.getPublishedConfig('airline')?.config || AIRLINE_TEMPLATE_CONFIG;
    const carCfg = this.getPublishedConfig('car')?.config || CAR_PUBLISHED_CONFIG;

    const categories: ('hotel' | 'airline' | 'car')[] = ['hotel', 'airline', 'car'];
    const segments: ('regular' | 'loyalty' | 'student')[] = ['regular', 'loyalty', 'student'];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const userIds = ['usr-loyalty-01', 'usr-student-01', 'usr-regular-01'];

    const nowMs = Date.now();

    for (let i = 0; i < count; i++) {
      const cat = categories[i % 3];
      const daysAgo = Math.floor(nextRand() * 88);
      const createdDate = new Date(nowMs - daysAgo * 86400000 - Math.floor(nextRand() * 3600000 * 12));
      const createdIso = createdDate.toISOString();
      const dateStr = createdIso.slice(0, 10);
      const dow = daysOfWeek[createdDate.getDay()] || 'Sat';
      const seg = segments[Math.floor(nextRand() * segments.length)];
      const uid = userIds[i % userIds.length];
      const tierDisc = seg === 'loyalty' ? -5 : seg === 'student' ? -3 : 0;
      const usePromo = nextRand() > 0.72;

      let itemId = '';
      let itemTitle = '';
      let productId = '';
      let quantity = 1;
      let quantityLabel = '1 unit';
      let context: Record<string, any> = {};
      let cfg = hotelCfg;
      let taxPct = this.appSettings.tax_percent_hotel;

      if (cat === 'hotel') {
        const h = HOTELS_DATA[Math.floor(nextRand() * HOTELS_DATA.length)];
        itemId = h.id;
        itemTitle = h.name;
        productId = h.product_id;
        quantity = 1 + Math.floor(nextRand() * 3);
        quantityLabel = `${quantity} ${quantity === 1 ? 'night' : 'nights'}`;
        const occ = Math.round(52 + nextRand() * 44);
        const dCheckin = 1 + Math.floor(nextRand() * 25);
        context = {
          target_date: dateStr,
          day_of_week: dow,
          occupancy_percent: occ,
          days_to_checkin: dCheckin,
          customer_segment: seg,
          loyalty_tier_discount_pct: tierDisc,
          loyalty_tier_label: tierDisc < 0 ? `Loyalty Tier (${tierDisc}%)` : undefined,
          promo_discount_pct: usePromo ? -10 : 0,
          promo_step_label: usePromo ? 'Promo WELCOME10 -10%' : undefined,
        };
        cfg = hotelCfg;
        taxPct = this.appSettings.tax_percent_hotel;
      } else if (cat === 'airline') {
        const f = FLIGHTS_DATA[Math.floor(nextRand() * FLIGHTS_DATA.length)];
        itemId = f.id;
        itemTitle = `${f.airline_name} · ${f.flight_no}`;
        productId = f.product_id;
        quantity = 1 + Math.floor(nextRand() * 2);
        quantityLabel = `${quantity} ${quantity === 1 ? 'passenger' : 'passengers'}`;
        const dDep = 1 + Math.floor(nextRand() * 35);
        const seats = Math.round(4 + nextRand() * 45);
        context = {
          target_date: dateStr,
          days_to_departure: dDep,
          seats_left: seats,
          customer_segment: seg,
          cabin: f.cabin,
          loyalty_tier_discount_pct: tierDisc,
          loyalty_tier_label: tierDisc < 0 ? `Loyalty Tier (${tierDisc}%)` : undefined,
          promo_discount_pct: usePromo ? -10 : 0,
          promo_step_label: usePromo ? 'Promo WELCOME10 -10%' : undefined,
        };
        cfg = airCfg;
        taxPct = this.appSettings.tax_percent_airline;
      } else {
        const c = CARS_DATA[Math.floor(nextRand() * CARS_DATA.length)];
        itemId = c.id;
        itemTitle = c.name;
        productId = c.product_id;
        quantity = 1;
        const dist = 6 + Math.floor(nextRand() * 18);
        quantityLabel = `1 transfer (${dist} km)`;
        const ratio = Math.round((1.1 + nextRand() * 1.3) * 100) / 100;
        const raining = nextRand() > 0.7;
        const hour = Math.floor(nextRand() * 24);
        context = {
          target_date: dateStr,
          distance_km: dist,
          demand_supply_ratio: ratio,
          is_raining: raining,
          hour_of_day: hour,
          loyalty_tier_discount_pct: tierDisc,
          loyalty_tier_label: tierDisc < 0 ? `Loyalty Tier (${tierDisc}%)` : undefined,
          promo_discount_flat: usePromo ? -40 : 0,
          promo_step_label: usePromo ? 'Promo CABFLAT40 -₹40' : undefined,
        };
        cfg = carCfg;
        taxPct = this.appSettings.tax_percent_car;
      }

      const res = executePricingEngine(cfg, context, productId);
      const subtotal = res.final_price * quantity;
      const taxAmount = roundHalfUp((subtotal * taxPct) / 100, 1);
      const total = subtotal + taxAmount;
      const auditId = `AUD-SIM-${String(i + 1).padStart(4, '0')}`;

      this.audits.push({
        id: auditId,
        domain_slug: cat,
        category: cat,
        item_id: itemId,
        user_id: uid,
        config_version: 1,
        context,
        base_price: res.base_price,
        final_price: res.final_price,
        breakdown: res.breakdown,
        rules_evaluated: res.rules_evaluated,
        constraints_applied: res.constraints_applied,
        latency_ms: 1.1 + Math.round(nextRand() * 12) / 10,
        created_at: createdIso,
      });

      this.bookings.push({
        id: `BK-SIM-${String(i + 1).padStart(4, '0')}`,
        user_id: uid,
        category: cat,
        item_id: itemId,
        item_title: itemTitle,
        details: {
          travellers: [{ full_name: 'Simulated Traveller' }],
          contact: { email: 'demo@monetize360.travel', phone: '9800000000' },
          params: { dateKey: dateStr, productId, simulated_weekday: dow },
        },
        quantity,
        quantity_label: quantityLabel,
        base_price: res.base_price,
        unit_price: res.final_price,
        unconstrained_price: res.unconstrained_price,
        cap_applied: res.cap_applied,
        cap_details: res.cap_details,
        promo_code: usePromo ? (cat === 'car' ? 'CABFLAT40' : 'WELCOME10') : null,
        subtotal,
        tax_percent: taxPct,
        tax_amount: taxAmount,
        total,
        currency: 'INR',
        config_version: 1,
        audit_id: auditId,
        quote_id: `QT-SIM-${String(i + 1).padStart(4, '0')}`,
        idempotency_key: `sim-idem-${i + 1}`,
        status: 'confirmed',
        is_simulated: true,
        created_at: createdIso,
        breakdown: res.breakdown,
      });
    }

    return { generated: count, total_bookings: this.bookings.length };
  }

  getPublishedConfig(domainSlug: string): ConfigVersionRecord | undefined {
    const published = this.configVersions
      .filter((c) => c.domain_slug === domainSlug && c.status === 'published')
      .sort((a, b) => b.version_no - a.version_no);
    return published[0];
  }

  getInventory(category: 'hotel' | 'airline' | 'car', itemId: string, productId: string, date: string): InventoryRecord {
    let rec = this.inventory.find(
      (i) => i.category === category && i.item_id === itemId && i.date === date
    );
    if (!rec) {
      if (category === 'hotel') {
        const cap = 20;
        const booked = Math.round((this.contextSignals.default_hotel_occupancy / 100) * cap);
        rec = { category, item_id: itemId, product_id: productId, date, capacity: cap, booked };
      } else if (category === 'airline') {
        const cap = 180;
        const booked = cap - this.contextSignals.default_flight_seats_left;
        rec = { category, item_id: itemId, product_id: productId, date, capacity: cap, booked };
      } else {
        rec = { category, item_id: itemId, product_id: productId, date, capacity: 15, booked: 3 };
      }
      this.inventory.push(rec);
    }
    return rec;
  }
}

export const db = new DatabaseStore();
