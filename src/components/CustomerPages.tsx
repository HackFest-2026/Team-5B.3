import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { formatINR, formatDateTimeIST } from '../lib/format';
import {
  ImageWithFallback,
  PriceChip,
  PriceCapBadge,
  LoyaltyTierBadge,
  BreakdownTable,
  PriceCountdown,
  ConfirmDialog,
  ErrorState,
  EmptyState,
} from './SharedUI';
import { SearchCard, PricingPlaygroundSection, CategoryStatus, PlaceOption } from './HomeComponents';
import { PriceTrendsSection } from './PriceTrendsSection';
import {
  CheckCircle2,
  Printer,
  ChevronDown,
  ChevronUp,
  Tag,
  X,
} from 'lucide-react';

export const ResultsPage: React.FC<{
  category: 'hotel' | 'airline' | 'car';
  categories: CategoryStatus[];
  places: PlaceOption[];
  queryParams: Record<string, string>;
  onNavigate: (path: string) => void;
  showToast: (msg: string) => void;
}> = ({ category, categories, places, queryParams, onNavigate, showToast }) => {
  const [results, setResults] = useState<any[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'price_desc'>('recommended');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(25000);
  const [minStars, setMinStars] = useState<number>(0);

  const fetchResults = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/shop/search/${category}`, {
        method: 'POST',
        body: JSON.stringify(queryParams),
      });
      setEnabled(data.enabled !== false);
      setResults(data.results || []);
      if (silent) {
        showToast('Prices updated from server inventory.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not load results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(false);
  }, [category, JSON.stringify(queryParams)]);

  const handleSelectResult = async (item: any) => {
    setSelectingId(item.item_id);
    try {
      const res = await apiRequest('/api/shop/quotes', {
        method: 'POST',
        body: JSON.stringify({
          category,
          item_id: item.item_id,
          params: queryParams,
        }),
      });
      onNavigate(`/checkout/${res.quote.quote_id}`);
    } catch (err: any) {
      showToast(err.message || 'Could not generate checkout quote.');
    } finally {
      setSelectingId(null);
    }
  };

  const filteredResults = results
    .filter((r) => (r.quote?.unit_price || 0) <= maxPriceFilter)
    .filter((r) => (category === 'hotel' ? (r.attrs?.stars || 5) >= minStars : true))
    .sort((a, b) => {
      if (sortBy === 'price_asc') return (a.quote?.unit_price || 0) - (b.quote?.unit_price || 0);
      if (sortBy === 'price_desc') return (b.quote?.unit_price || 0) - (a.quote?.unit_price || 0);
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <SearchCard
        categories={categories}
        places={places}
        initialTab={category}
        initialParams={queryParams}
        compact
        onSearchSubmit={(cat, params) => {
          const qs = new URLSearchParams(params).toString();
          const route = cat === 'hotel' ? '/hotels' : cat === 'airline' ? '/flights' : '/cars';
          onNavigate(`${route}?${qs}`);
        }}
      />

      {enabled && (
        <PriceTrendsSection
          category={category}
          onSelectDate={(dateStr) => {
            if (category === 'hotel') {
              const nextOut = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + 3 * 86400000)
                .toISOString()
                .slice(0, 10);
              const nextParams = { ...queryParams, check_in: dateStr, check_out: nextOut };
              onNavigate(`/hotels?${new URLSearchParams(nextParams).toString()}`);
            }
          }}
        />
      )}

      {!enabled ? (
        <EmptyState
          title="This category opens soon"
          subtitle="Commercial Aviation (Flights) is currently awaiting domain configuration publication in the Monetize360 Admin Console. Once an administrator publishes the airline rules, live flight fares will appear here immediately with zero code changes."
          actionLabel="Explore Hotels Instead"
          onAction={() => onNavigate('/hotels')}
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchResults(false)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <aside className="lg:col-span-3 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[#A69080]/25 pb-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3E362E]">
                Refine Results
              </span>
              <button
                type="button"
                onClick={() => {
                  setSortBy('recommended');
                  setMaxPriceFilter(25000);
                  setMinStars(0);
                }}
                className="text-xs text-[#865D36] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Sort Order</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Fare: Low to High</option>
                <option value="price_desc">Fare: High to Low</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-[#3E362E] mb-1.5">
                <span>Maximum Unit Fare</span>
                <span className="tabular-nums font-semibold">{formatINR(maxPriceFilter)}</span>
              </div>
              <input
                type="range"
                min={200}
                max={25000}
                step={100}
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                className="w-full accent-[#865D36] cursor-pointer"
              />
            </div>

            {category === 'hotel' && (
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1.5">Property Star Rating</label>
                <div className="flex gap-2">
                  {[0, 4, 5].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMinStars(st)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-[4px] border cursor-pointer ${
                        minStars === st
                          ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                          : 'bg-[#F5F1ED] text-[#3E362E] border-[#A69080]'
                      }`}
                    >
                      {st === 0 ? 'All' : `${st}★`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="lg:col-span-9 space-y-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-52 bg-[#FAF8F6] border border-[#A69080]/30 animate-pulse rounded-[4px]" />
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <EmptyState
                title="No results. Try different dates or fewer filters."
                subtitle="Expand your maximum fare range or reset your filters to view available inventory."
                actionLabel="Reset Filters"
                onAction={() => {
                  setMaxPriceFilter(25000);
                  setMinStars(0);
                }}
              />
            ) : (
              filteredResults.map((item) => {
                const q = item.quote;
                const isExpanded = expandedId === item.item_id;
                const availText =
                  category === 'hotel'
                    ? `${item.attrs.rooms_left} rooms left`
                    : category === 'airline'
                    ? `${item.attrs.seats_left} seats left`
                    : `${item.attrs.cars_left} vehicles available`;

                return (
                  <div
                    key={item.item_id}
                    className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12">
                      <div className="md:col-span-4 h-52 md:h-auto">
                        <ImageWithFallback
                          imageKey={item.image_key}
                          alt={item.title}
                          className="w-full h-full min-h-[200px]"
                        />
                      </div>

                      <div className="md:col-span-8 p-5 sm:p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#3E362E]/70 mb-1">
                            <span>
                              {category.toUpperCase()} · {availText}
                            </span>
                            <PriceCountdown
                              expiresAt={q.expires_at}
                              onExpire={() => fetchResults(true)}
                            />
                          </div>

                          <h2 className="font-display text-2xl font-semibold text-[#3E362E] tracking-wide uppercase">
                            {item.title}
                          </h2>
                          <p className="text-xs text-[#3E362E]/75 mt-0.5">{item.subtitle}</p>

                          {item.attrs.amenities && (
                            <div className="text-xs text-[#3E362E]/70 mt-2">
                              {item.attrs.amenities.join(' · ')}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 pt-4 border-t border-[#A69080]/25 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                              {q.base_price !== q.unit_price && (
                                <span className="text-xs text-[#3E362E]/50 line-through tabular-nums">
                                  Base {formatINR(q.base_price)}
                                </span>
                              )}
                              <PriceChip
                                direction={q.headline_adjustment.direction}
                                effect={q.headline_adjustment.effect}
                                label={q.headline_adjustment.label}
                              />
                              {q.cap_applied && q.cap_details && (
                                <PriceCapBadge capDetails={q.cap_details} />
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-semibold text-[#3E362E] tabular-nums">
                                {formatINR(q.unit_price)}
                              </span>
                              <span className="text-xs text-[#3E362E]/70">
                                per unit · Total {formatINR(q.total)} incl. Demo tax
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : item.item_id)}
                              className="px-3.5 py-2.5 min-h-[44px] border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] hover:bg-[#E6DCD2] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <span>How is this calculated?</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              disabled={!item.available || selectingId === item.item_id}
                              onClick={() => handleSelectResult(item)}
                              className="px-5 py-2.5 min-h-[44px] bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {selectingId === item.item_id
                                ? 'Locking Quote...'
                                : item.available
                                ? 'Select'
                                : 'Sold Out'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5 bg-[#F5F1ED] border-t border-[#A69080]/35">
                        <BreakdownTable
                          breakdown={q.breakdown}
                          finalPrice={q.unit_price}
                          configVersion={q.config_version}
                          auditId={q.audit_id}
                          capApplied={q.cap_applied}
                          capDetails={q.cap_details}
                          onNavigate={onNavigate}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CheckoutPage: React.FC<{
  quoteId: string;
  user: any;
  onOpenAuthModal: () => void;
  onNavigate: (path: string) => void;
  showToast: (msg: string) => void;
}> = ({ quoteId, user, onOpenAuthModal, onNavigate, showToast }) => {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [leadName, setLeadName] = useState(user?.full_name || 'Ananya Deshmukh');
  const [email, setEmail] = useState(user?.email || 'loyalty@demo.travel');
  const [phone, setPhone] = useState(user?.phone || '9820123456');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [priceChangedQuote, setPriceChangedQuote] = useState<any>(null);

  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLeadName((prev: string) => prev || user.full_name);
      setEmail((prev: string) => prev || user.email);
      setPhone((prev: string) => prev || user.phone);
    }
  }, [user]);

  const loadQuote = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/shop/quotes/${quoteId}`);
      setQuote(res.quote);
    } catch (err: any) {
      setError(err.message || 'Quote not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuote();
  }, [quoteId]);

  const handleRequote = async () => {
    if (!quote) return;
    const res = await apiRequest('/api/shop/quotes', {
      method: 'POST',
      body: JSON.stringify({
        category: quote.category,
        item_id: quote.item_id,
        params: quote.params,
      }),
    });
    setQuote(res.quote);
    showToast('Quote refreshed with a new 10-minute validity window.');
  };

  const handleApplyPromo = async () => {
    setPromoError(null);
    setPromoSuccess(null);
    setPromoLoading(true);
    try {
      const res = await apiRequest(`/api/shop/quotes/${quote.quote_id}/promo`, {
        method: 'POST',
        body: JSON.stringify({ promo_code: promoInput.trim() }),
      });
      setQuote(res.quote);
      if (promoInput.trim()) {
        setPromoSuccess(`Promo code ${promoInput.trim().toUpperCase()} applied via engine context.`);
      } else {
        setPromoSuccess('Promo code cleared.');
      }
    } catch (err: any) {
      setPromoError(err.message || 'Promo code could not be applied.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      onOpenAuthModal();
      return;
    }

    if (leadName.trim().length < 2) {
      setFormError('Please enter the lead traveller full name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSubmitting(true);
    try {
          const res = await apiRequest('/api/shop/bookings', {
        method: 'POST',
        body: JSON.stringify({
          quote_id: quote.quote_id,
          idempotency_key: idempotencyKey,
          travellers: [{ full_name: leadName.trim() }],
          contact: { email: email.trim(), phone: phone.trim() },
          promo_code: quote.promo_code || undefined,
        }),
      });
      onNavigate(`/booking/${res.booking.id}`);
    } catch (err: any) {
      if (err.code === 'PRICE_CHANGED' && err.details?.new_quote) {
        setPriceChangedQuote(err.details.new_quote);
      } else if (err.code === 'QUOTE_EXPIRED') {
        await handleRequote();
        setFormError('Your previous quote expired. We have refreshed the current fare; please review and confirm.');
      } else {
        setFormError(err.message || 'Booking could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-72 bg-[#FAF8F6] animate-pulse rounded-[4px]" />
      </div>
    );
  }

  if (error || !quote) {
    return <ErrorState message={error || 'Quote unavailable'} onRetry={loadQuote} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
          SERVER-VERIFIED CHECKOUT
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#3E362E]">
          Complete Your Reservation
        </h1>
      </div>

      {priceChangedQuote && (
        <div className="mb-6 p-5 bg-[#FAF8F6] border-2 border-[#A3431F] rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-[#A3431F]">
              Price changed from {formatINR(quote.total)} to {formatINR(priceChangedQuote.total)}. Accept new price?
            </h3>
            <p className="text-xs text-[#3E362E]/80 mt-1">
              Live server inventory or active domain rules changed since your quote was created.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => {
                setQuote(priceChangedQuote);
                setPriceChangedQuote(null);
                showToast('Updated price accepted. Click Confirm & Book to complete.');
              }}
              className="px-4 py-2 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
            >
              Accept ({formatINR(priceChangedQuote.total)})
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleConfirmBooking} className="lg:col-span-7 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-5">
          <div className="border-b border-[#A69080]/25 pb-4">
            <span className="text-xs uppercase tracking-wider text-[#865D36] font-semibold">
              {quote.category} Reservation
            </span>
            <h2 className="font-display text-2xl font-semibold text-[#3E362E] mt-0.5">
              {quote.item_title}
            </h2>
            <p className="text-xs text-[#3E362E]/75">{quote.item_subtitle}</p>
          </div>

          {!user && (
            <div className="p-4 bg-[#E6DCD2]/70 rounded-[4px] flex items-center justify-between gap-4">
              <div className="text-xs text-[#3E362E]">
                <strong>Sign in required to confirm booking.</strong> Your typed details below will be preserved.
              </div>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-4 py-2 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer whitespace-nowrap"
              >
                Sign In / Register
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#3E362E] mb-1">
                Lead Traveller / Guest Full Name
              </label>
              <input
                type="text"
                required
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1">
                  Confirmation Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1">
                  10-Digit Mobile Phone
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
                />
              </div>
            </div>
          </div>

          {formError && (
            <div className="text-xs text-[#9B2C2C] font-medium">▲ {formError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-sm font-medium rounded-[4px] transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? 'Verifying Server Price & Confirming...'
              : `Confirm & Book — ${formatINR(quote.total)}`}
          </button>
        </form>

        <aside className="lg:col-span-5 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-5 sticky top-20">
          <div className="flex items-center justify-between border-b border-[#A69080]/25 pb-3">
            <h3 className="font-display text-2xl font-semibold text-[#3E362E]">Price Summary</h3>
            <PriceCountdown expiresAt={quote.expires_at} onExpire={handleRequote} />
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#3E362E]/75">
                {formatINR(quote.unit_price)} × {quote.quantity_label}
              </span>
              <span className="font-medium tabular-nums">{formatINR(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#3E362E]/75">
                Tax (Demo tax {quote.tax_percent}%)
              </span>
              <span className="font-medium tabular-nums">{formatINR(quote.tax_amount)}</span>
            </div>
            <div className="pt-3 border-t border-[#A69080]/30 flex justify-between items-baseline text-base font-semibold text-[#3E362E]">
              <span>Total</span>
              <span className="text-2xl tabular-nums">{formatINR(quote.total)}</span>
            </div>
          </div>

          {/* Phase 2: Promo Code Input & Engine Context Integration */}
          <div className="pt-3 border-t border-[#A69080]/25 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3E362E]">
              Promo Code (Passed to Pricing Engine)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME10, FESTIVE500, FLAT250"
                className="flex-1 h-9 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs font-mono uppercase text-[#3E362E]"
              />
              <button
                type="button"
                disabled={promoLoading}
                onClick={handleApplyPromo}
                className="px-3.5 h-9 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer whitespace-nowrap"
              >
                {promoLoading ? 'Checking...' : 'Apply'}
              </button>
              {quote.promo_code && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoInput('');
                    apiRequest(`/api/shop/quotes/${quote.quote_id}/promo`, {
                      method: 'POST',
                      body: JSON.stringify({ promo_code: '' }),
                    }).then((res) => {
                      setQuote(res.quote);
                      setPromoSuccess(null);
                      setPromoError(null);
                    });
                  }}
                  className="px-2.5 h-9 border border-[#3E362E] text-[#3E362E] text-xs rounded-[4px] cursor-pointer"
                  title="Remove promo code"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {['WELCOME10', 'FESTIVE500', 'FLAT250'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPromoInput(code)}
                  className="px-2 py-0.5 bg-[#AC8968]/15 border border-[#AC8968] rounded-[4px] font-mono text-[#3E362E] hover:bg-[#AC8968]/30 cursor-pointer"
                >
                  {code}
                </button>
              ))}
            </div>
            {promoError && (
              <div className="text-xs text-[#3E362E] bg-[#AC8968]/20 border border-[#865D36] px-3 py-2 rounded-[4px] font-medium">
                ▲ {promoError}
              </div>
            )}
            {promoSuccess && (
              <div className="text-xs text-[#3E362E] bg-[#AC8968]/15 border border-[#865D36] px-3 py-2 rounded-[4px] font-medium">
                ▼ {promoSuccess}
              </div>
            )}
          </div>

          <div className="pt-2">
            <BreakdownTable
              breakdown={quote.breakdown}
              finalPrice={quote.unit_price}
              configVersion={quote.config_version}
              auditId={quote.audit_id}
              capApplied={quote.cap_applied}
              capDetails={quote.cap_details}
              onNavigate={onNavigate}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export const ConfirmationPage: React.FC<{
  bookingId: string;
  onNavigate: (path: string) => void;
}> = ({ bookingId, onNavigate }) => {
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest(`/api/shop/bookings/${bookingId}`)
      .then((res) => setBooking(res.booking))
      .catch((err) => setError(err.message || 'Booking not found'));
  }, [bookingId]);

  if (error) {
    return (
      <EmptyState
        title="404 — Booking Not Found"
        subtitle="This reservation reference does not exist or belongs to another customer account."
        actionLabel="Back to Home"
        onAction={() => onNavigate('/')}
      />
    );
  }

  if (!booking) {
    return <div className="max-w-4xl mx-auto p-12 text-center text-sm">Loading booking confirmation...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#A69080]/30 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#4F6B3A]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reservation {booking.status}</span>
              <span>·</span>
              <span className="tabular-nums">Ref: {booking.id}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#3E362E] mt-1">
              {booking.item_title}
            </h1>
            <p className="text-xs text-[#3E362E]/70 mt-1 tabular-nums">
              Booked on {formatDateTimeIST(booking.created_at)} · Audit ID: {booking.audit_id} · Config v{booking.config_version}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-4 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] inline-flex items-center gap-2 hover:bg-[#E6DCD2] cursor-pointer self-start"
          >
            <Printer className="w-4 h-4" />
            <span>Print receipt</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-[#F5F1ED] p-4 rounded-[4px]">
          <div>
            <span className="text-[#3E362E]/65 block">Lead Traveller</span>
            <span className="font-semibold text-sm text-[#3E362E]">
              {booking.details?.travellers?.[0]?.full_name || 'Verified Guest'}
            </span>
          </div>
          <div>
            <span className="text-[#3E362E]/65 block">Quantity</span>
            <span className="font-semibold text-sm text-[#3E362E] tabular-nums">
              {booking.quantity_label}
            </span>
          </div>
          <div>
            <span className="text-[#3E362E]/65 block">Total Amount Paid</span>
            <span className="font-semibold text-lg text-[#3E362E] tabular-nums">
              {formatINR(booking.total)} (incl. {booking.tax_percent}% Demo tax)
            </span>
          </div>
        </div>

        <BreakdownTable
          breakdown={booking.breakdown || []}
          finalPrice={booking.unit_price}
          configVersion={booking.config_version}
          auditId={booking.audit_id}
        />

        <div className="no-print pt-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate('/account/bookings')}
            className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            View my bookings
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-5 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export const MyBookingsPage: React.FC<{
  onNavigate: (path: string) => void;
  showToast: (msg: string) => void;
}> = ({ onNavigate, showToast }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelPreview, setCancelPreview] = useState<any>(null);
  const [cancelHoursBefore, setCancelHoursBefore] = useState<number | ''>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadBookings = () => {
    apiRequest('/api/shop/bookings').then((res) => setBookings(res.bookings || []));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const openCancelModal = async (bookingId: string, overrideHours?: number) => {
    setCancelTarget(bookingId);
    setCancelLoading(true);
    try {
      const qs = overrideHours !== undefined ? `?hours_before=${overrideHours}` : '';
      const res = await apiRequest(`/api/shop/bookings/${bookingId}/cancel-preview${qs}`);
      setCancelPreview(res.preview);
      if (overrideHours === undefined && res.preview?.hours_before !== undefined) {
        setCancelHoursBefore(res.preview.hours_before);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not compute cancellation refund preview.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    await apiRequest(`/api/shop/bookings/${cancelTarget}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        hours_before: cancelHoursBefore !== '' ? Number(cancelHoursBefore) : undefined,
      }),
    });
    setCancelTarget(null);
    setCancelPreview(null);
    setTab('cancelled');
    showToast('Reservation cancelled. Refund breakdown stored & audit entry written.');
    loadBookings();
  };

  const filtered = bookings.filter((b) => {
    if (tab === 'cancelled') return b.status === 'cancelled';
    if (tab === 'past') return false;
    return b.status === 'confirmed';
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">My Bookings</h1>
          <p className="text-xs text-[#3E362E]/75">
            Every booking stores an immutable snapshot of the price calculation and config version at the moment of purchase.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
              tab === 'upcoming' ? 'bg-[#3E362E] text-[#FAF8F6]' : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
            }`}
          >
            Upcoming ({bookings.filter((b) => b.status === 'confirmed').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
              tab === 'past' ? 'bg-[#3E362E] text-[#FAF8F6]' : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
            }`}
          >
            Past (0)
          </button>
          <button
            type="button"
            onClick={() => setTab('cancelled')}
            className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
              tab === 'cancelled' ? 'bg-[#3E362E] text-[#FAF8F6]' : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
            }`}
          >
            Cancelled ({bookings.filter((b) => b.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={`No ${tab} reservations`}
          subtitle="Search our dynamically priced hotels, flights, or chauffeur cars to book your next itinerary."
          actionLabel="Search Stays & Flights"
          onAction={() => onNavigate('/')}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => (
            <div key={b.id} className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#865D36] font-semibold uppercase tabular-nums">
                    {b.id} · {b.category} · {b.status} · Audit {b.audit_id}
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-[#3E362E] mt-0.5">
                    {b.item_title}
                  </h3>
                  <div className="text-xs text-[#3E362E]/70 tabular-nums mt-0.5">
                    {b.quantity_label} · Unit {formatINR(b.unit_price)} · Total {formatINR(b.total)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    className="px-3.5 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                  >
                    {expandedId === b.id ? 'Hide calculation' : 'View calculation'}
                  </button>
                  {b.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => openCancelModal(b.id)}
                      className="px-3.5 py-2 border border-[#865D36] text-[#3E362E] hover:bg-[#AC8968]/20 text-xs font-medium rounded-[4px] cursor-pointer"
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </div>

              {b.status === 'cancelled' && b.cancellation_breakdown && (
                <div className="p-4 bg-[#AC8968]/10 border border-[#A69080]/50 rounded-[4px] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#865D36] uppercase tracking-wider">
                      Cancellation Engine Refund Trace · Audit {b.cancellation_audit_id || b.audit_id}
                    </span>
                    <div className="tabular-nums font-semibold text-[#3E362E]">
                      Paid: {formatINR(b.total)} · Fee: {formatINR(b.cancellation_fee || 0)} · Refund: {formatINR(b.refund_amount ?? b.total)}
                    </div>
                  </div>
                  <BreakdownTable
                    breakdown={b.cancellation_breakdown}
                    finalPrice={b.refund_amount ?? b.total}
                    configVersion={1}
                    auditId={b.cancellation_audit_id || b.audit_id}
                    compact
                    onNavigate={onNavigate}
                  />
                </div>
              )}

              {expandedId === b.id && (
                <BreakdownTable
                  breakdown={b.breakdown || []}
                  finalPrice={b.unit_price}
                  configVersion={b.config_version}
                  auditId={b.audit_id}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Phase 2: Cancellation Fee Engine Modal using the same BreakdownTable component */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E362E]/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#FAF8F6] border border-[#A69080] rounded-[4px] max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#A69080]/30 pb-3">
              <div>
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
                  CANCELLATION FEE AS ORDINARY ENGINE RULES
                </span>
                <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                  Cancel Booking & Refund Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelPreview(null);
                }}
                className="text-xs underline text-[#3E362E] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="bg-[#AC8968]/10 border border-[#A69080]/40 rounded-[4px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-[#3E362E] block">
                  Simulate Notice Window (Hours Before Check-in / Departure / Pickup)
                </span>
                <span className="text-[#3E362E]/75">
                  Adjust hours to inspect how different cancellation fee rules fire in the engine:
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={cancelHoursBefore}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setCancelHoursBefore(val);
                    if (val !== '') openCancelModal(cancelTarget, val);
                  }}
                  className="w-24 h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                />
                <span className="text-xs text-[#3E362E]">hours</span>
              </div>
            </div>

            {cancelLoading || !cancelPreview ? (
              <div className="h-40 bg-[#AC8968]/10 animate-pulse rounded-[4px]" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-xs bg-[#FAF8F6] border border-[#A69080]/40 p-3.5 rounded-[4px] tabular-nums">
                  <div>
                    <span className="text-[#3E362E]/70 block">Amount Paid (Base)</span>
                    <span className="text-base font-semibold text-[#3E362E]">
                      {formatINR(cancelPreview.amount_paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#3E362E]/70 block">Cancellation Fee</span>
                    <span className="text-base font-semibold text-[#865D36]">
                      − {formatINR(cancelPreview.cancellation_fee)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#3E362E]/70 block">Net Refund</span>
                    <span className="text-base font-semibold text-[#3E362E]">
                      {formatINR(cancelPreview.refund_amount)}
                    </span>
                  </div>
                </div>

                <BreakdownTable
                  breakdown={cancelPreview.breakdown}
                  finalPrice={cancelPreview.refund_amount}
                  configVersion={cancelPreview.config_version}
                  auditId="PREVIEW-CANCEL"
                  onNavigate={onNavigate}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#A69080]/30">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelPreview(null);
                }}
                className="px-4 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
              >
                Confirm Cancellation & Record Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProfilePage: React.FC<{
  user: any;
  onUserUpdated: (u: any) => void;
  showToast: (msg: string) => void;
}> = ({ user, onUserUpdated, showToast }) => {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    onUserUpdated(res.user);
    showToast('Profile details saved.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated.');
    } catch (err: any) {
      setPwdMsg(err.message || 'Could not update password.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-8">
      <form onSubmit={handleSaveProfile} className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[#3E362E]">Account Profile</h2>
        <div>
          <label className="block text-xs font-medium mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Email Address (Read-only)</label>
          <input
            type="email"
            value={user?.email || ''}
            readOnly
            className="w-full h-10 px-3 bg-[#E6DCD2]/60 border border-[#A69080] rounded-[4px] text-sm text-[#3E362E]/70"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
          />
        </div>
        <div className="p-3.5 bg-[#AC8968]/15 border border-[#A69080]/40 rounded-[4px] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-[#865D36]">
              Account Type: {user?.customer_segment} (Read-only)
            </div>
            {user?.loyalty && (
              <LoyaltyTierBadge
                tier={user.loyalty.tier}
                discountPercent={user.loyalty.discount_percent}
                confirmedBookings={user.loyalty.confirmed_bookings}
              />
            )}
          </div>
          {user?.loyalty && (
            <p className="text-xs text-[#3E362E] tabular-nums">
              Confirmed Bookings: <strong>{user.loyalty.confirmed_bookings}</strong> · Active Loyalty Tier Discount: <strong>−{user.loyalty.discount_percent}%</strong>
              {user.loyalty.next_tier
                ? ` · Book ${Math.max(0, user.loyalty.next_tier.min_bookings - user.loyalty.confirmed_bookings)} more to unlock ${user.loyalty.next_tier.tier} (−${user.loyalty.next_tier.discount_percent}%)`
                : ' · Highest Tier Reached (Platinum)'}
            </p>
          )}
          <p className="text-xs text-[#3E362E]/75">
            Set by Monetize360. Loyalty tier and segment concessions apply automatically on the server.
          </p>
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
        >
          Save Profile
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[#3E362E]">Security & Password</h2>
        <div>
          <label className="block text-xs font-medium mb-1">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            New Password (8+ chars, upper, lower, digit, symbol)
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
          />
        </div>
        {pwdMsg && <div className="text-xs text-[#9B2C2C]">{pwdMsg}</div>}
        <button
          type="submit"
          className="px-5 py-2.5 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
        >
          Update Password
        </button>
      </form>
    </div>
  );
};

export const HowPricingWorksPage: React.FC<{ userSegment?: string }> = ({ userSegment }) => {
  const steps = [
    { no: '01', title: 'Context Signal Resolution', desc: 'The server resolves real-time inventory occupancy, remaining seats, road distance, and authenticated customer segment.' },
    { no: '02', title: 'Base Fare Calculation', desc: 'Evaluates either a fixed product base price (e.g. ₹3,000 hotel room) or a linear formula (e.g. ₹40 + ₹14 × km).' },
    { no: '03', title: 'Priority-Ordered Rule Evaluation', desc: 'Rules execute in strict priority order. Boolean AND/OR conditions test context attributes without domain-hardcoded code.' },
    { no: '04', title: 'Exclusive Group & Stop-Processing', desc: 'Mutually exclusive tiers (such as Demand >2.0× vs >1.5×) ensure only the highest-priority tier in a group applies.' },
    { no: '05', title: 'Stacking Strategy Application', desc: 'Sequential compounding multiplies each rule onto the running subtotal; Additive applies percentages to the initial base.' },
    { no: '06', title: 'Guardrail Constraints', desc: 'Enforces minimum floor, maximum ceiling, and surge multiplier caps (e.g. max 2.5× base fare).' },
    { no: '07', title: 'Exact Decimal Half-Up Rounding', desc: 'Eliminates floating-point and banker’s rounding traps: 212.5 rounds deterministically to 213; 3,726 rounds to 3,730.' },
    { no: '08', title: 'Immutable Audit & Counterfactual Trace', desc: 'Writes a permanent price_audit record with rule-by-rule trace and counterfactual prices.' },
  ];

  const hotelGoldenSteps = [
    { step: 'Base fare (Heritage Courtyard Room)', rule_id: 'BASE', effect: 'Base', direction: 'neutral' as const, running: 3000 },
    { step: 'Weekend stay uplift (Sat/Sun)', rule_id: 'R-HTL-01', effect: '+20%', direction: 'up' as const, running: 3600 },
    { step: 'High occupancy surge (>80%)', rule_id: 'R-HTL-02', effect: '+15%', direction: 'up' as const, running: 4140 },
    { step: 'Loyalty member privilege', rule_id: 'R-HTL-03', effect: '−10%', direction: 'down' as const, running: 3726 },
    { step: 'Round to nearest 10 (Half-Up)', effect: '+₹4', direction: 'neutral' as const, running: 3730 },
  ];

  const carGoldenSteps = [
    { step: 'Base formula (40 + 14 × 8 km)', rule_id: 'BASE', effect: 'Base', direction: 'neutral' as const, running: 152 },
    { step: 'Elevated demand ratio (>1.5×)', rule_id: 'R-CAR-02', effect: '×1.4', direction: 'up' as const, running: 212.8 },
    { step: 'Round to nearest 1 (Half-Up)', effect: '+₹0.2', direction: 'neutral' as const, running: 213 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="max-w-3xl">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
          ARCHITECTURAL TRANSPARENCY
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#3E362E] mt-1">
          The 8-Step Deterministic Pricing Pipeline
        </h1>
        <p className="text-sm text-[#3E362E]/80 mt-3 leading-relaxed">
          Monetize360 Travel uses a single domain-agnostic pricing engine across hospitality, aviation, and urban mobility. Industries differ strictly by versioned JSON configuration—never by hardcoded application logic.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((s) => (
          <div key={s.no} className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 space-y-2">
            <div className="text-xs font-semibold text-[#865D36] tabular-nums">{s.no}.</div>
            <h3 className="font-display text-xl font-semibold text-[#3E362E]">{s.title}</h3>
            <p className="text-xs text-[#3E362E]/75 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Worked Golden Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Worked Example 1: Hotel Stay (₹3,730)
          </h3>
          <p className="text-xs text-[#3E362E]/75">
            Saturday check-in, 85% occupancy, Loyalty customer segment, sequential compounding, rounded to nearest 10:
          </p>
          <BreakdownTable breakdown={hotelGoldenSteps} finalPrice={3730} configVersion={2} auditId="AUD-2026-8841" />
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Worked Example 2: Chauffeur Car (₹213)
          </h3>
          <p className="text-xs text-[#3E362E]/75">
            8.0 km road distance (40 + 14 × 8 = 152), demand ratio 1.7× (×1.4 = 212.8), rounded half-up to nearest 1:
          </p>
          <BreakdownTable breakdown={carGoldenSteps} finalPrice={213} configVersion={1} auditId="AUD-2026-8842" />
        </div>
      </div>

      <PricingPlaygroundSection userSegment={userSegment} />

      {/* Why you can trust the price (Page C8) */}
      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#865D36] mb-1">01 · Deterministic</div>
          <h4 className="font-display text-xl font-semibold text-[#3E362E] mb-1">Zero Black-Box Surges</h4>
          <p className="text-xs text-[#3E362E]/75 leading-relaxed">
            Given the same configuration version and server context, the engine always produces the exact same rupee fare using decimal half-up math.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#865D36] mb-1">02 · Versioned</div>
          <h4 className="font-display text-xl font-semibold text-[#3E362E] mb-1">Immutable Config Snapshots</h4>
          <p className="text-xs text-[#3E362E]/75 leading-relaxed">
            Every quote and confirmed booking locks in the exact configuration version number so later rule edits never alter historical bookings.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#865D36] mb-1">03 · Audited</div>
          <h4 className="font-display text-xl font-semibold text-[#3E362E] mb-1">Forensic Audit IDs</h4>
          <p className="text-xs text-[#3E362E]/75 leading-relaxed">
            Every price calculation writes a permanent audit ID that can be inspected for fired rules, skipped rules, and counterfactuals.
          </p>
        </div>
      </div>
    </div>
  );
};
