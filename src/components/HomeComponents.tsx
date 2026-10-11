import React, { useState, useEffect } from 'react';
import { formatINR } from '../lib/format';
import { ImageWithFallback, PriceChip, BreakdownTable } from './SharedUI';
import { apiRequest } from '../api/client';
import { Search } from 'lucide-react';

export interface CategoryStatus {
  category: 'hotel' | 'airline' | 'car';
  domain_slug: string;
  enabled: boolean;
  from_price: number | null;
  currency: string;
  config_version: number | null;
}

export interface PlaceOption {
  id: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

export const GlassFeatureCarousel: React.FC<{
  categories: CategoryStatus[];
  onNavigate: (path: string) => void;
}> = ({ categories, onNavigate }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const hotelCat = categories.find((c) => c.category === 'hotel');
  const flightCat = categories.find((c) => c.category === 'airline');
  const carCat = categories.find((c) => c.category === 'car');

  const slides = [
    {
      category: 'hotel' as const,
      eyebrow: 'UDAIPUR · LAKE PICHOLA',
      title: 'THE ARAVALLI SANDSTONE HAVELI',
      description: 'Courtyard suites priced dynamically by real-time occupancy, calendar day, and member loyalty tier.',
      imageKey: 'hero_hotel',
      enabled: hotelCat ? hotelCat.enabled : true,
      fromPrice: hotelCat?.from_price ?? 3730,
      targetPath: '/hotels?city=Udaipur&check_in=2026-10-17&check_out=2026-10-20&guests=2&rooms=1',
    },
    {
      category: 'airline' as const,
      eyebrow: 'BENGALURU → UDAIPUR · DIRECT',
      title: 'SKYLINE AIR · FLIGHT SK-104',
      description: 'Commercial aviation fares governed by departure window proximity, cabin inventory, and student concessions.',
      imageKey: 'airliner_sunset',
      enabled: flightCat ? flightCat.enabled : true,
      fromPrice: flightCat?.from_price ?? 6830,
      targetPath: '/flights?origin=Bengaluru&destination=Udaipur&date=2026-10-15&passengers=1&cabin=Economy',
    },
    {
      category: 'car' as const,
      eyebrow: 'UDAIPUR · CHAUFFEUR TRANSFER',
      title: 'SOVEREIGN ESPRESSO SALOON',
      description: 'Point-to-point urban mobility calculated from exact road distance, live dispatch demand ratio, and weather.',
      imageKey: 'exec_sedan',
      enabled: carCat ? carCat.enabled : true,
      fromPrice: carCat?.from_price ?? 213,
      targetPath: '/cars?pickup_id=plc-udp-01&drop_id=plc-udp-02&pickup_at=14:00&car_type=all',
    },
  ];

  useEffect(() => {
    if (paused) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  const current = slides[activeIndex];

  return (
    <div
      className="relative w-full h-full min-h-[460px] lg:min-h-[600px] flex items-end justify-end p-6 sm:p-10 lg:p-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ImageWithFallback
        imageKey={current.imageKey}
        alt={current.title}
        overlayGradient
        className="absolute inset-0 w-full h-full"
      />

      <div className="relative z-10 glass-card w-full max-w-md p-6 sm:p-7 shadow-xl transition-all duration-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#FAF8F6]/80 font-medium">
            {current.eyebrow}
          </span>
          <span className="text-xs text-[#FAF8F6]/90 tabular-nums font-medium">
            {current.enabled && current.fromPrice
              ? `From ${formatINR(current.fromPrice)}`
              : 'Opening soon'}
          </span>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-medium uppercase tracking-[0.04em] text-[#FAF8F6] leading-tight mb-2.5">
          {current.title}
        </h2>

        <p className="text-sm text-[#E6DCD2]/90 leading-relaxed mb-5">
          {current.description}
        </p>

        <div className="relative mb-6 pt-2">
          <div className="h-28 w-full rounded-[4px] overflow-hidden border border-[#FAF8F6]/15">
            <ImageWithFallback
              imageKey={current.imageKey}
              alt={current.title}
              className="w-full h-full"
            />
          </div>
          {current.enabled ? (
            <button
              type="button"
              onClick={() => onNavigate(current.targetPath)}
              className="absolute -bottom-4 right-4 h-10 px-5 rounded-full bg-[#FAF8F6] text-[#3E362E] hover:bg-[#865D36] hover:text-[#FAF8F6] text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2 shadow-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>View</span>
            </button>
          ) : (
            <span className="absolute -bottom-4 right-4 h-10 px-4 rounded-[4px] bg-[#3E362E] text-[#FAF8F6]/80 border border-[#FAF8F6]/20 text-xs font-medium inline-flex items-center">
              Opening soon
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3" role="tablist" aria-label="Featured travel categories">
          {slides.map((s, idx) => (
            <button
              key={s.category}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              onClick={() => setActiveIndex(idx)}
              className="py-2 group focus:outline-none cursor-pointer"
              title={`Show ${s.category} feature`}
            >
              <div
                className={`h-[2px] w-full transition-opacity duration-200 ${
                  idx === activeIndex ? 'bg-[#FAF8F6] opacity-100' : 'bg-[#FAF8F6] opacity-30 group-hover:opacity-60'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SearchCard: React.FC<{
  categories: CategoryStatus[];
  places: PlaceOption[];
  initialTab?: 'hotel' | 'airline' | 'car';
  initialParams?: Record<string, string>;
  onSearchSubmit: (category: 'hotel' | 'airline' | 'car', params: Record<string, string>) => void;
  compact?: boolean;
}> = ({
  categories,
  places,
  initialTab = 'hotel',
  initialParams = {},
  onSearchSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<'hotel' | 'airline' | 'car'>(initialTab);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hotelCity, setHotelCity] = useState(initialParams.city || 'Udaipur');
  const [checkIn, setCheckIn] = useState(initialParams.check_in || '2026-10-17');
  const [checkOut, setCheckOut] = useState(initialParams.check_out || '2026-10-20');
  const [guests, setGuests] = useState(initialParams.guests || '2');
  const [rooms, setRooms] = useState(initialParams.rooms || '1');

  const [origin, setOrigin] = useState(initialParams.origin || 'Bengaluru');
  const [destination, setDestination] = useState(initialParams.destination || 'Udaipur');
  const [flightDate, setFlightDate] = useState(initialParams.date || '2026-10-15');
  const [passengers, setPassengers] = useState(initialParams.passengers || '2');
  const [cabin, setCabin] = useState(initialParams.cabin || 'Economy');

  const [pickupId, setPickupId] = useState(initialParams.pickup_id || 'plc-udp-01');
  const [dropId, setDropId] = useState(initialParams.drop_id || 'plc-udp-02');
  const [pickupAt, setPickupAt] = useState(initialParams.pickup_at || '14:00');
  const [carType, setCarType] = useState(initialParams.car_type || 'all');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const isCatEnabled = (cat: 'hotel' | 'airline' | 'car') => {
    const found = categories.find((c) => c.category === cat);
    return found ? found.enabled : true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isCatEnabled(activeTab)) {
      setErrorMsg('This category is opening soon once its domain configuration is published.');
      return;
    }

    if (activeTab === 'hotel') {
      if (!checkIn || !checkOut) {
        setErrorMsg('Please select both check-in and check-out dates.');
        return;
      }
      if (new Date(checkOut) <= new Date(checkIn)) {
        setErrorMsg('Check-out date must be after check-in date.');
        return;
      }
      if (Number(rooms) < 1) {
        setErrorMsg('At least 1 room is required.');
        return;
      }
      onSearchSubmit('hotel', {
        city: hotelCity,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        rooms,
      });
    } else if (activeTab === 'airline') {
      if (origin === destination) {
        setErrorMsg('Origin and destination cities must be different.');
        return;
      }
      const pax = Number(passengers);
      if (pax < 1 || pax > 9) {
        setErrorMsg('Passengers must be between 1 and 9.');
        return;
      }
      onSearchSubmit('airline', {
        origin,
        destination,
        date: flightDate,
        passengers,
        cabin,
      });
    } else {
      if (pickupId === dropId) {
        setErrorMsg('Pickup and drop-off localities must be different.');
        return;
      }
      onSearchSubmit('car', {
        pickup_id: pickupId,
        drop_id: dropId,
        pickup_at: pickupAt,
        car_type: carType,
      });
    }
  };

  return (
    <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#A69080]/30 pb-4 mb-5">
        <div className="flex items-center gap-2" role="tablist">
          {(
            [
              { id: 'hotel', label: 'Hotels' },
              { id: 'airline', label: 'Flights' },
              { id: 'car', label: 'Cars' },
            ] as const
          ).map((t) => {
            const enabled = isCatEnabled(t.id);
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!enabled}
                onClick={() => {
                  if (enabled) {
                    setActiveTab(t.id);
                    setErrorMsg(null);
                  }
                }}
                className={`px-4 py-2 min-h-[44px] text-sm font-medium rounded-[4px] transition-colors whitespace-nowrap shrink-0 ${
                  !enabled
                    ? 'bg-[#E6DCD2]/60 text-[#3E362E]/45 cursor-not-allowed'
                    : active
                    ? 'bg-[#3E362E] text-[#FAF8F6] cursor-pointer'
                    : 'bg-transparent text-[#3E362E] hover:bg-[#E6DCD2]/60 cursor-pointer'
                }`}
              >
                <span>{t.label}</span>
                {!enabled && (
                  <span className="ml-2 text-[11px] uppercase tracking-wider text-[#865D36]">
                    · Opening soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[#3E362E]/70">
          Customer segment rates (Loyalty / Student) apply automatically from your account.
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'hotel' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Destination City</label>
              <select
                value={hotelCity}
                onChange={(e) => setHotelCity(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                <option value="Udaipur">Udaipur</option>
                <option value="Jaipur">Jaipur</option>
                <option value="Goa">Goa</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Mumbai">Mumbai</option>
                <option value="All">All Cities</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Check-in (Sat = +20%)</label>
              <input
                type="date"
                value={checkIn}
                min="2026-10-10"
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Check-out</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Guests</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Rooms</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="w-full h-11 px-5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-sm font-medium rounded-[4px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>Search Hotels</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'airline' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Origin</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                <option value="Bengaluru">Bengaluru (BLR)</option>
                <option value="Mumbai">Mumbai (BOM)</option>
                <option value="Delhi">Delhi (DEL)</option>
                <option value="All">All Origins</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Destination</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                <option value="Udaipur">Udaipur (UDR)</option>
                <option value="Jaipur">Jaipur (JAI)</option>
                <option value="Goa">Goa (GOI)</option>
                <option value="All">All Destinations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Departure Date</label>
              <input
                type="date"
                value={flightDate}
                min="2026-10-10"
                onChange={(e) => setFlightDate(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Pax (1–9)</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Cabin</label>
                <select
                  value={cabin}
                  onChange={(e) => setCabin(e.target.value)}
                  className="w-full h-11 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
                >
                  <option value="Economy">Economy</option>
                  <option value="Premier">Premier</option>
                </select>
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="w-full h-11 px-5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-sm font-medium rounded-[4px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>Search Flights</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'car' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Pickup Locality</label>
              <select
                value={pickupId}
                onChange={(e) => setPickupId(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.city} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Drop-off Locality</label>
              <select
                value={dropId}
                onChange={(e) => setDropId(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.city} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Pickup Time (IST)</label>
              <input
                type="time"
                value={pickupAt}
                onChange={(e) => setPickupAt(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Vehicle Class</label>
              <select
                value={carType}
                onChange={(e) => setCarType(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E] focus:outline-none focus:ring-2 focus:ring-[#865D36]"
              >
                <option value="all">All Classes</option>
                <option value="hatchback">Urban Compact</option>
                <option value="sedan">Executive Saloon</option>
                <option value="suv">Luxury SUV</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                className="w-full h-11 px-5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-sm font-medium rounded-[4px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>Search Cars</span>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 text-xs text-[#9B2C2C] font-medium flex items-center gap-1.5">
            <span>▲ {errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
};

export const PricingPlaygroundSection: React.FC<{
  userSegment?: string;
}> = ({ userSegment = 'loyalty' }) => {
  const [cat, setCat] = useState<'hotel' | 'car' | 'airline'>('hotel');
  const [hotelDay, setHotelDay] = useState('Sat');
  const [hotelOcc, setHotelOcc] = useState(85);
  const [hotelSeg, setHotelSeg] = useState(userSegment);

  const [carDist, setCarDist] = useState(8);
  const [carRatio, setCarRatio] = useState(1.7);
  const [carRain, setCarRain] = useState(false);

  const [airDays, setAirDays] = useState(5);
  const [airSeats, setAirSeats] = useState(12);
  const [airSeg, setAirSeg] = useState('student');

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        let inputs: Record<string, any> = {};
        if (cat === 'hotel') {
          inputs = {
            day_of_week: hotelDay,
            occupancy_percent: hotelOcc,
            customer_segment: hotelSeg,
          };
        } else if (cat === 'car') {
          inputs = {
            distance_km: carDist,
            demand_supply_ratio: carRatio,
            is_raining: carRain,
            hour_of_day: 14,
          };
        } else {
          inputs = {
            days_to_departure: airDays,
            seats_left: airSeats,
            customer_segment: airSeg,
            cabin: 'Economy',
          };
        }
        const data = await apiRequest('/api/shop/playground', {
          method: 'POST',
          body: JSON.stringify({ category: cat, inputs }),
        });
        setResult(data);
      } catch {
        // Ignore transient
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [cat, hotelDay, hotelOcc, hotelSeg, carDist, carRatio, carRain, airDays, airSeats, airSeg]);

  return (
    <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#A69080]/25">
        <div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
            INTERACTIVE ENGINE SANDBOX
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#3E362E] mt-1">
            Test the Golden Calculation Rules Live
          </h3>
          <p className="text-xs text-[#3E362E]/70 mt-1">
            Illustrative inputs. In real bookings these are measured by our system, not chosen by you.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#E6DCD2] p-1 rounded-[4px] self-start">
          {(
            [
              { id: 'hotel', label: 'Hotel (₹3,730 Golden)' },
              { id: 'car', label: 'Car (₹213 Golden)' },
              { id: 'airline', label: 'Flight (₹6,830 Golden)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCat(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer whitespace-nowrap ${
                cat === item.id
                  ? 'bg-[#3E362E] text-[#FAF8F6]'
                  : 'text-[#3E362E] hover:bg-[#FAF8F6]/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          {cat === 'hotel' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">
                  Check-in Day of Week (Sat/Sun triggers +20%)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setHotelDay(d)}
                      className={`py-2 text-xs font-medium rounded-[4px] border cursor-pointer ${
                        hotelDay === d
                          ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                          : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                  <span>Live Property Occupancy (&gt;80% triggers +15%)</span>
                  <span className="tabular-nums font-semibold">{hotelOcc}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={98}
                  value={hotelOcc}
                  onChange={(e) => setHotelOcc(Number(e.target.value))}
                  className="w-full accent-[#865D36] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">
                  Account Segment (Server-Verified Profile)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['regular', 'loyalty', 'student'] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => setHotelSeg(seg)}
                      className={`py-2 text-xs font-medium capitalize rounded-[4px] border cursor-pointer ${
                        hotelSeg === seg
                          ? 'bg-[#865D36] text-[#FAF8F6] border-[#865D36]'
                          : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {cat === 'car' && (
            <>
              <div>
                <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                  <span>Road Distance (Base = ₹40 + ₹14 × km)</span>
                  <span className="tabular-nums font-semibold">{carDist} km</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={carDist}
                  onChange={(e) => setCarDist(Number(e.target.value))}
                  className="w-full accent-[#865D36] cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                  <span>Demand / Supply Ratio (&gt;1.5× → ×1.4, &gt;2.0× → ×1.8)</span>
                  <span className="tabular-nums font-semibold">{carRatio.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={2.4}
                  step={0.1}
                  value={carRatio}
                  onChange={(e) => setCarRatio(Number(e.target.value))}
                  className="w-full accent-[#865D36] cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-[#3E362E]">Monsoon Weather Signal (+10%)</span>
                <button
                  type="button"
                  onClick={() => setCarRain(!carRain)}
                  className={`px-4 py-2 text-xs font-medium rounded-[4px] border cursor-pointer ${
                    carRain
                      ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                      : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
                  }`}
                >
                  {carRain ? 'Raining: Active' : 'Clear Weather'}
                </button>
              </div>
            </>
          )}

          {cat === 'airline' && (
            <>
              <div>
                <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                  <span>Days to Departure (&lt;7 days triggers +25%)</span>
                  <span className="tabular-nums font-semibold">{airDays} days</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={airDays}
                  onChange={(e) => setAirDays(Number(e.target.value))}
                  className="w-full accent-[#865D36] cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                  <span>Seats Remaining (&lt;20 seats triggers +15%)</span>
                  <span className="tabular-nums font-semibold">{airSeats} seats</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={60}
                  value={airSeats}
                  onChange={(e) => setAirSeats(Number(e.target.value))}
                  className="w-full accent-[#865D36] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">
                  Passenger Account Segment (Student triggers −5%)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['regular', 'loyalty', 'student'] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => setAirSeg(seg)}
                      className={`py-2 text-xs font-medium capitalize rounded-[4px] border cursor-pointer ${
                        airSeg === seg
                          ? 'bg-[#865D36] text-[#FAF8F6] border-[#865D36]'
                          : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-7">
          {result ? (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <span className="text-xs text-[#3E362E]/70">Computed Engine Output</span>
                  <div className="text-3xl font-semibold text-[#3E362E] tabular-nums">
                    {formatINR(result.price)}
                  </div>
                </div>
                {result.headline_adjustment && (
                  <PriceChip
                    direction={result.headline_adjustment.direction}
                    effect={result.headline_adjustment.effect}
                    label={result.headline_adjustment.label}
                  />
                )}
              </div>
              <BreakdownTable
                breakdown={result.breakdown || []}
                finalPrice={result.price}
                configVersion={result.config_version}
              />
            </div>
          ) : (
            <div className="h-48 bg-[#E6DCD2]/40 animate-pulse rounded-[4px]" />
          )}
        </div>
      </div>
    </div>
  );
};
