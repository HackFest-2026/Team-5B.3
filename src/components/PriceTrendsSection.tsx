import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { formatINR } from '../lib/format';
import { BreakdownTable, PriceCapBadge } from './SharedUI';
import { Calendar, TrendingUp, Clock, Info, Table } from 'lucide-react';

/**
 * Documented Deterministic Demand Functions (Seeded & Reproducible Offline)
 * Used to generate context signals for the batch price trend views.
 */
export function deterministicHotelOccupancy(dayIndex: number, isWeekend: boolean): number {
  const wave = Math.round(62 + 18 * Math.sin(dayIndex * 0.65) + (isWeekend ? 14 : 0));
  return Math.min(96, Math.max(45, wave));
}

export function deterministicFlightSeatsLeft(daysToDeparture: number): number {
  // Under 3 days -> < 10 seats; under 8 days -> < 20 seats; grows with lead time
  const val = Math.round(6 + daysToDeparture * 1.45 + 4 * Math.sin(daysToDeparture * 0.4));
  return Math.min(160, Math.max(3, val));
}

export function deterministicCarDemandRatio(hourOfDay: number): { ratio: number; is_raining: boolean } {
  // Morning peak (8-10): >2.0x; Evening peak (18-20): >2.0x; Midday (12-16): >1.5x; Night: 1.25x
  if (hourOfDay >= 8 && hourOfDay <= 10) return { ratio: 2.15, is_raining: false };
  if (hourOfDay >= 18 && hourOfDay <= 20) return { ratio: 2.25, is_raining: true };
  if (hourOfDay >= 12 && hourOfDay <= 16) return { ratio: 1.68, is_raining: false };
  if (hourOfDay >= 22 || hourOfDay <= 5) return { ratio: 1.35, is_raining: false };
  return { ratio: 1.2, is_raining: false };
}

export const PriceTrendsSection: React.FC<{
  category: 'hotel' | 'airline' | 'car';
  userSegment?: string;
  onSelectDate?: (dateStr: string) => void;
}> = ({ category, userSegment = 'regular', onSelectDate }) => {
  // Hotel controls
  const [roomProduct, setRoomProduct] = useState<string>('room_heritage');
  // Airline controls
  const [routeLabel, setRouteLabel] = useState<string>('Bengaluru → Udaipur (SK-104)');
  const [cabin, setCabin] = useState<'Economy' | 'Premier'>('Economy');
  // Car controls
  const [carProduct, setCarProduct] = useState<string>('car_city');

  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [configVersion, setConfigVersion] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showTableFallback, setShowTableFallback] = useState<boolean>(false);

  const loadBatchTrends = async () => {
    setLoading(true);
    setError('');
    try {
      const contexts: Record<string, any>[] = [];
      let productId = roomProduct;

      if (category === 'hotel') {
        productId = roomProduct;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        for (let d = 0; d < 30; d++) {
          const dt = new Date(today.getTime() + d * 86400000);
          const dateStr = dt.toISOString().slice(0, 10);
          const dow = days[dt.getDay()] || 'Sat';
          const isWeekend = dow === 'Sat' || dow === 'Sun';
          const occ = deterministicHotelOccupancy(d, isWeekend);
          contexts.push({
            label: dateStr,
            day_number: dt.getDate(),
            month_short: dt.toLocaleString('en-IN', { month: 'short' }),
            target_date: dateStr,
            day_of_week: dow,
            occupancy_percent: occ,
            days_to_checkin: Math.max(1, d + 1),
            customer_segment: userSegment,
          });
        }
      } else if (category === 'airline') {
        productId = cabin === 'Premier' ? 'flight_prem' : 'flight_econ';
        for (let d = 0; d <= 60; d++) {
          const seatsLeft = deterministicFlightSeatsLeft(d);
          contexts.push({
            days_to_departure: d,
            seats_left: seatsLeft,
            customer_segment: userSegment,
            cabin,
          });
        }
      } else {
        productId = carProduct;
        for (let h = 0; h < 24; h++) {
          const sig = deterministicCarDemandRatio(h);
          contexts.push({
            distance_km: 8,
            demand_supply_ratio: sig.ratio,
            is_raining: sig.is_raining,
            hour_of_day: h,
          });
        }
      }

      const res = await apiRequest('/api/v1/price/batch', {
        method: 'POST',
        body: JSON.stringify({
          domain: category,
          product_id: productId,
          contexts,
        }),
      });

      setBatchResults(res.results || []);
      setConfigVersion(res.config_version || 1);
      if (category === 'car') {
        setSelectedIndex(14);
      } else if (category === 'airline') {
        setSelectedIndex(5);
      } else {
        setSelectedIndex(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load batch price trend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchTrends();
  }, [category, roomProduct, cabin, carProduct, userSegment]);

  if (loading) {
    return (
      <section className="my-8 p-6 border border-[#A69080] rounded-[4px] bg-white" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-64 bg-[#AC8968]/20 rounded-[4px]" />
          <div className="h-4 w-96 bg-[#AC8968]/15 rounded-[4px]" />
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 bg-[#AC8968]/15 rounded-[4px]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="my-8 p-6 border border-[#865D36] rounded-[4px] bg-[#AC8968]/10 text-[#3E362E]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold">Price Trend Unavailable</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadBatchTrends}
            className="px-4 py-2 bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] cursor-pointer"
          >
            Retry Batch Request
          </button>
        </div>
      </section>
    );
  }

  if (batchResults.length === 0) {
    return (
      <section className="my-8 p-6 border border-[#A69080] rounded-[4px] bg-white text-center text-[#3E362E]">
        <p className="text-sm">No price trend points available for this configuration.</p>
      </section>
    );
  }

  const selectedItem = batchResults[selectedIndex] || batchResults[0];
  const minPriceInBatch = Math.min(...batchResults.map((r) => r.final_price));
  const maxPriceInBatch = Math.max(...batchResults.map((r) => r.final_price));

  return (
    <section
      aria-labelledby={`trend-heading-${category}`}
      className="my-8 border border-[#A69080] rounded-[4px] bg-white overflow-hidden text-[#3E362E]"
    >
      {/* Top Bar */}
      <div className="p-5 bg-[#AC8968]/10 border-b border-[#A69080] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-[#AC8968]/20 border border-[#865D36] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3E362E]">
              Simulated demand
            </span>
            <span className="text-xs text-[#3E362E]/80 tabular-nums">
              Single Batch Endpoint: <code>POST /api/v1/price/batch</code> ({batchResults.length} points)
            </span>
          </div>
          <h2 id={`trend-heading-${category}`} className="font-display text-2xl font-semibold text-[#3E362E]">
            {category === 'hotel'
              ? '30-Day Dynamic Room Tariff Calendar'
              : category === 'airline'
              ? '60-Day Advance Purchase & Scarcity Fare Curve'
              : '24-Hour Chauffeur Surge Multiplier & Fare Schedule (8 km)'}
          </h2>
        </div>

        {/* Category-specific selectors & accessible table toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {category === 'hotel' && (
            <div>
              <label htmlFor="trend-room-select" className="block text-[10px] uppercase tracking-wider font-semibold mb-1">
                Room Category
              </label>
              <select
                id="trend-room-select"
                value={roomProduct}
                onChange={(e) => setRoomProduct(e.target.value)}
                className="px-3 py-2 min-h-[40px] border border-[#A69080] rounded-[4px] bg-white text-xs font-semibold text-[#3E362E]"
              >
                <option value="room_heritage">Heritage Courtyard Room (Base ₹3,000)</option>
                <option value="room_pavilion">Grand Sandstone Pavilion (Base ₹4,200)</option>
                <option value="room_royal">Royal Lakeview Suite (Base ₹4,800)</option>
              </select>
            </div>
          )}

          {category === 'airline' && (
            <>
              <div>
                <label htmlFor="trend-route-select" className="block text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Route
                </label>
                <select
                  id="trend-route-select"
                  value={routeLabel}
                  onChange={(e) => setRouteLabel(e.target.value)}
                  className="px-3 py-2 min-h-[40px] border border-[#A69080] rounded-[4px] bg-white text-xs font-semibold text-[#3E362E]"
                >
                  <option value="Bengaluru → Udaipur (SK-104)">Bengaluru → Udaipur (SK-104)</option>
                  <option value="Mumbai → Jaipur (SK-309)">Mumbai → Jaipur (SK-309)</option>
                  <option value="Mumbai → Goa (MW-402)">Mumbai → Goa (MW-402)</option>
                </select>
              </div>
              <div>
                <label htmlFor="trend-cabin-select" className="block text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Cabin Class
                </label>
                <select
                  id="trend-cabin-select"
                  value={cabin}
                  onChange={(e) => setCabin(e.target.value as 'Economy' | 'Premier')}
                  className="px-3 py-2 min-h-[40px] border border-[#A69080] rounded-[4px] bg-white text-xs font-semibold text-[#3E362E]"
                >
                  <option value="Economy">Standard Economy (Base ₹5,000)</option>
                  <option value="Premier">Premier Club (Base ₹9,500)</option>
                </select>
              </div>
            </>
          )}

          {category === 'car' && (
            <div>
              <label htmlFor="trend-car-select" className="block text-[10px] uppercase tracking-wider font-semibold mb-1">
                Vehicle Tier (Fixed 8 km Trip)
              </label>
              <select
                id="trend-car-select"
                value={carProduct}
                onChange={(e) => setCarProduct(e.target.value)}
                className="px-3 py-2 min-h-[40px] border border-[#A69080] rounded-[4px] bg-white text-xs font-semibold text-[#3E362E]"
              >
                <option value="car_city">Urban Transfer Fare (40 + 14×km = ₹152)</option>
                <option value="car_exec">Executive Sedan Transfer (80 + 22×km = ₹256)</option>
                <option value="car_suv">Grand Touring SUV (120 + 28×km = ₹344)</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowTableFallback((prev) => !prev)}
            aria-expanded={showTableFallback}
            className="mt-4 px-3 py-2 min-h-[40px] border border-[#3E362E] rounded-[4px] bg-white hover:bg-[#AC8968]/15 text-xs font-semibold text-[#3E362E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Table className="w-3.5 h-3.5 text-[#865D36]" />
            <span>{showTableFallback ? 'Hide Data Table' : 'Accessible Data Table'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          {/* HOTEL 30-DAY CALENDAR */}
          {category === 'hotel' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-[#3E362E]">
                <span>Click any date cell to inspect its complete rule & guardrail calculation:</span>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#865D36]" /> Best value ({formatINR(minPriceInBatch)})
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#3E362E]" /> Festival window
                  </span>
                </div>
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-6 gap-2.5"
                role="listbox"
                aria-label="30-day hotel price calendar"
              >
                {batchResults.map((item, idx) => {
                  const isCheapest = item.final_price === minPriceInBatch;
                  const isSelected = idx === selectedIndex;
                  const firedFestival = item.rules_evaluated?.some(
                    (r: any) => r.fired && r.id.startsWith('R-HTL-FEST')
                  );
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedIndex(idx)}
                      className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[88px] ${
                        isSelected
                          ? 'border-2 border-[#3E362E] bg-[#AC8968]/20 shadow-sm'
                          : isCheapest
                          ? 'border-[#865D36] bg-[#AC8968]/10 hover:bg-[#AC8968]/20'
                          : 'border-[#A69080] bg-white hover:bg-[#AC8968]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-[11px] font-semibold text-[#3E362E]">
                          {item.context.day_of_week}, {item.context.day_number} {item.context.month_short}
                        </span>
                        {item.cap_applied && (
                          <span className="text-[10px] font-bold text-[#865D36]" title="Price cap applied">
                            CAP
                          </span>
                        )}
                      </div>

                      <div className="my-1 font-display text-base font-bold text-[#3E362E] tabular-nums">
                        {formatINR(item.final_price)}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {isCheapest && (
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#865D36] text-white text-[10px] font-semibold uppercase tracking-wider">
                            Best value
                          </span>
                        )}
                        {firedFestival && (
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#3E362E] text-white text-[10px] font-semibold uppercase tracking-wider">
                            Festival
                          </span>
                        )}
                        {!isCheapest && !firedFestival && (
                          <span className="text-[10px] text-[#3E362E]/75 tabular-nums">
                            Occ {item.context.occupancy_percent}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AIRLINES 0-60 DAYS TO DEPARTURE CURVE */}
          {category === 'airline' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-[#3E362E]">
                <span>
                  <strong>{routeLabel}</strong> · Days to Departure (0 to 60 days):
                </span>
                <span className="font-semibold text-[#865D36]">
                  Click any day marker to inspect rule breakdown
                </span>
              </div>

              {/* Annotated Rule Jump Callouts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 text-xs">
                <div className="p-2.5 rounded-[4px] bg-[#AC8968]/10 border border-[#865D36]">
                  <div className="font-semibold text-[#3E362E]">Jump #1: &lt; 7 Days Out</div>
                  <div className="text-[#3E362E]/85">▲ +25% Close-in Departure Uplift fires</div>
                </div>
                <div className="p-2.5 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
                  <div className="font-semibold text-[#3E362E]">Jump #2: &lt; 20 Seats Left</div>
                  <div className="text-[#3E362E]/85">▲ +15% Scarcity Rule fires (Days 0–9)</div>
                </div>
                <div className="p-2.5 rounded-[4px] bg-white border border-[#A69080]">
                  <div className="font-semibold text-[#3E362E]">Today Marker (Day 0)</div>
                  <div className="text-[#3E362E]/85">
                    Fare: <strong>{formatINR(batchResults[0]?.final_price || 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Accessible SVG Line Chart */}
              <div className="border border-[#A69080] rounded-[4px] p-4 bg-white">
                <svg
                  viewBox="0 0 640 240"
                  className="w-full h-56 overflow-visible"
                  role="img"
                  aria-label="Airline fare versus days to departure from 0 to 60 days"
                >
                  {/* Horizontal Grid lines */}
                  {[0, 0.5, 1].map((t, i) => {
                    const y = 30 + t * 165;
                    const priceVal = Math.round(maxPriceInBatch - t * (maxPriceInBatch - minPriceInBatch));
                    return (
                      <g key={i}>
                        <line x1="55" y1={y} x2="615" y2={y} stroke="#A69080" strokeDasharray="3 3" strokeWidth="1" />
                        <text x="50" y={y + 4} textAnchor="end" fontSize="10" fill="#3E362E" fontWeight="600">
                          ₹{priceVal.toLocaleString('en-IN')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Rule Jump Vertical Annotations at Day 7 & Day 9 */}
                  {[0, 7, 9, 21, 60].map((dayMark) => {
                    const x = 60 + (dayMark / 60) * 550;
                    return (
                      <g key={dayMark}>
                        <line x1={x} y1={25} x2={x} y2={195} stroke="#865D36" strokeDasharray="2 2" strokeWidth="1" />
                        <text x={x} y={215} textAnchor="middle" fontSize="10" fill="#3E362E" fontWeight="600">
                          {dayMark === 0 ? 'Today (0d)' : `${dayMark}d`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Polyline for Fare Curve */}
                  <polyline
                    fill="none"
                    stroke="#3E362E"
                    strokeWidth="2.5"
                    points={batchResults
                      .map((r, idx) => {
                        const x = 60 + (idx / 60) * 550;
                        const span = Math.max(1, maxPriceInBatch - minPriceInBatch);
                        const y = 195 - ((r.final_price - minPriceInBatch) / span) * 160;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {/* Direct Series Label */}
                  <text x="65" y="20" fontSize="11" fill="#3E362E" fontWeight="700">
                    ● Dynamic Fare Series ({cabin}) — Jump at &lt;7d (+25%) &amp; &lt;20 seats (+15%)
                  </text>

                  {/* Interactive Points */}
                  {batchResults.map((r, idx) => {
                    if (idx % 2 !== 0 && idx !== 0 && idx !== 5 && idx !== 7 && idx !== 9 && idx !== selectedIndex) {
                      return null;
                    }
                    const x = 60 + (idx / 60) * 550;
                    const span = Math.max(1, maxPriceInBatch - minPriceInBatch);
                    const y = 195 - ((r.final_price - minPriceInBatch) / span) * 160;
                    const isSel = idx === selectedIndex;
                    return (
                      <g
                        key={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`${idx} days to departure: ${formatINR(r.final_price)}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedIndex(idx);
                        }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isSel ? 6 : idx === 0 ? 5 : 3.5}
                          fill={isSel ? '#865D36' : idx === 0 ? '#3E362E' : '#AC8968'}
                          stroke="#3E362E"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Quick Day Selector Buttons */}
                <div className="mt-3 pt-3 border-t border-[#A69080]/40 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold mr-1">Inspect Day:</span>
                  {[0, 2, 5, 6, 7, 10, 15, 25, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedIndex(d)}
                      className={`px-2.5 py-1 rounded-[3px] text-xs font-semibold cursor-pointer ${
                        selectedIndex === d
                          ? 'bg-[#3E362E] text-white'
                          : 'bg-[#AC8968]/15 text-[#3E362E] border border-[#AC8968]'
                      }`}
                    >
                      {d === 0 ? 'Today (0d)' : `${d}d out`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CARS 0-23 HOUR SURGE & FARE SCHEDULE */}
          {category === 'car' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-[#3E362E]">
                <span>
                  Fixed <strong>8.0 km</strong> Urban Transfer · Hourly Fare &amp; Surge Schedule (00:00 to 23:00):
                </span>
                <span className="font-semibold text-[#865D36]">
                  Current Hour Highlighted · Click any hour bar to inspect breakdown
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="listbox" aria-label="24-hour car fare schedule">
                {batchResults.map((r, hour) => {
                  const currentHour = new Date().getHours();
                  const isCurrentHour = hour === currentHour;
                  const isSelected = hour === selectedIndex;
                  const ratio = r.context.demand_supply_ratio;
                  const surgeLabel = ratio > 2.0 ? '1.8× Peak' : ratio > 1.5 ? '1.4× Elevated' : '1.0× Base';
                  return (
                    <button
                      key={hour}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedIndex(hour)}
                      className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#3E362E] bg-[#AC8968]/25'
                          : isCurrentHour
                          ? 'border-[#865D36] bg-[#AC8968]/15'
                          : 'border-[#A69080] bg-white hover:bg-[#AC8968]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span>{String(hour).padStart(2, '0')}:00</span>
                        {isCurrentHour && (
                          <span className="px-1 rounded-[2px] bg-[#865D36] text-white text-[9px] uppercase">
                            Now
                          </span>
                        )}
                      </div>
                      <div className="font-display text-base font-bold text-[#3E362E] tabular-nums my-0.5">
                        {formatINR(r.final_price)}
                      </div>
                      <div className="text-[10px] text-[#3E362E] font-medium tabular-nums">
                        {surgeLabel} ({ratio}×)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accessible Data-Table Fallback */}
          {showTableFallback && (
            <div className="mt-6 border border-[#A69080] rounded-[4px] overflow-x-auto max-h-72">
              <table className="w-full text-left border-collapse text-xs" aria-label={`Data table fallback for ${category} price trends`}>
                <thead className="bg-[#AC8968]/15 border-b border-[#A69080]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">
                      {category === 'hotel' ? 'Date' : category === 'airline' ? 'Days to Departure' : 'Hour of Day'}
                    </th>
                    <th className="py-2 px-3 font-semibold">Simulated Demand Signal</th>
                    <th className="py-2 px-3 font-semibold text-right">Base Price</th>
                    <th className="py-2 px-3 font-semibold text-right">Final Engine Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A69080]/30">
                  {batchResults.map((r, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`cursor-pointer ${idx === selectedIndex ? 'bg-[#AC8968]/20 font-semibold' : 'bg-white'}`}
                    >
                      <td className="py-2 px-3 tabular-nums">
                        {category === 'hotel'
                          ? `${r.context.label} (${r.context.day_of_week})`
                          : category === 'airline'
                          ? `${r.context.days_to_departure} days`
                          : `${String(r.context.hour_of_day).padStart(2, '0')}:00`}
                      </td>
                      <td className="py-2 px-3 tabular-nums">
                        {category === 'hotel'
                          ? `Occupancy ${r.context.occupancy_percent}%`
                          : category === 'airline'
                          ? `${r.context.seats_left} seats left`
                          : `Demand ratio ${r.context.demand_supply_ratio}×${r.context.is_raining ? ' (Rain)' : ''}`}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatINR(r.base_price)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatINR(r.final_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Documented Deterministic Demand Formula Note */}
          <div className="mt-4 p-3 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] text-xs text-[#3E362E]">
            <strong>Simulated demand documentation:</strong>{' '}
            {category === 'hotel'
              ? 'Occupancy(d) = clamp(45%, 96%, round(62 + 18·sin(0.65d) + weekendBoost)). Includes 2 effective-dated festival windows within the 30-day horizon.'
              : category === 'airline'
              ? 'SeatsLeft(d) = clamp(3, 160, round(6 + 1.45·d + 4·sin(0.4d))). Triggers scarcity rule (<20 seats) at ≤9 days and close-in rule (<7 days) at ≤6 days.'
              : 'DemandRatio(h) = 2.15× (08:00–10:00 morning rush), 2.25× + rain (18:00–20:00 evening rush), 1.68× (12:00–16:00), and 1.35× + 15% night dispatch (22:00–05:00).'}
          </div>
        </div>

        {/* Right Column: Live Breakdown for Selected Date / Day / Hour */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-3">
            <div className="p-3.5 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
                  Selected Point Inspection
                </div>
                <div className="font-display text-lg font-bold text-[#3E362E]">
                  {category === 'hotel'
                    ? `${selectedItem.context.day_of_week}, ${selectedItem.context.label} (Occ ${selectedItem.context.occupancy_percent}%)`
                    : category === 'airline'
                    ? `${selectedItem.context.days_to_departure} Days Before Departure (${selectedItem.context.seats_left} seats left)`
                    : `Hour ${String(selectedItem.context.hour_of_day).padStart(2, '0')}:00 · 8 km Transfer (Ratio ${selectedItem.context.demand_supply_ratio}×)`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-[#93785B] tabular-nums">
                  {formatINR(selectedItem.final_price)}
                </div>
              </div>
            </div>

            <BreakdownTable
              breakdown={selectedItem.breakdown || []}
              finalPrice={selectedItem.final_price}
              configVersion={configVersion}
              capDetails={selectedItem.cap_details}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
