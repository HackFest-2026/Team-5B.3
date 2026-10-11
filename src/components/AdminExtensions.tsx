import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { formatINR } from '../lib/format';
import { BreakdownTable, PriceCapBadge } from './SharedUI';
import {
  ShieldCheck,
  Tag,
  Award,
  BarChart3,
  Download,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Lock,
  Plus,
  Table,
  Info,
} from 'lucide-react';

// ============================================================================
// PHASE 1: ADMIN GUARDRAILS EDITOR PER CATEGORY
// ============================================================================

export const AdminGuardrailsPanel: React.FC<{
  selectedDomain?: string;
  onSelectDomain?: (slug: string) => void;
  onAuditLogged?: () => void;
}> = ({ selectedDomain, onSelectDomain, onAuditLogged }) => {
  const resolveBaseCat = (dom?: string): 'hotel' | 'airline' | 'car' => {
    if (!dom) return 'hotel';
    if (dom.startsWith('airline')) return 'airline';
    if (dom.startsWith('car')) return 'car';
    return 'hotel';
  };
  const [slug, setSlug] = useState<'hotel' | 'airline' | 'car'>(() => resolveBaseCat(selectedDomain));
  const [minPrice, setMinPrice] = useState<string>('2000');
  const [maxPrice, setMaxPrice] = useState<string>('6000');
  const [maxUpliftPct, setMaxUpliftPct] = useState<string>('35');
  const [maxDiscountPct, setMaxDiscountPct] = useState<string>('30');
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (selectedDomain) {
      const next = resolveBaseCat(selectedDomain);
      if (next !== slug) setSlug(next);
    }
  }, [selectedDomain]);

  const defaultPreviewContexts: Record<'hotel' | 'airline' | 'car', Record<string, any>> = {
    hotel: { day_of_week: 'Sat', occupancy_percent: 92, days_to_checkin: 2, customer_segment: 'regular' },
    airline: { days_to_departure: 3, seats_left: 8, customer_segment: 'regular', cabin: 'Economy' },
    car: { distance_km: 8, demand_supply_ratio: 2.3, is_raining: true, hour_of_day: 23 },
  };

  const loadDomainGuardrails = async (targetSlug: 'hotel' | 'airline' | 'car') => {
    setError('');
    setMessage('');
    try {
      const res = await apiRequest('/api/shop/how-we-price');
      const dom = res.domains?.find((d: any) => d.category === targetSlug);
      if (dom?.constraints) {
        setMinPrice(String(dom.constraints.min_price ?? 2000));
        setMaxPrice(String(dom.constraints.max_price ?? 6000));
        setMaxUpliftPct(String(dom.constraints.max_uplift_percent ?? 35));
        setMaxDiscountPct(String(dom.constraints.max_discount_percent ?? 30));
      }
      const simRes = await apiRequest('/api/v1/price', {
        method: 'POST',
        body: JSON.stringify({
          domain: targetSlug,
          context: defaultPreviewContexts[targetSlug],
        }),
      });
      setPreview(simRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load category guardrails.');
    }
  };

  useEffect(() => {
    loadDomainGuardrails(slug);
  }, [slug]);

  const handleSaveGuardrails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const minP = Number(minPrice);
    const maxP = Number(maxPrice);
    const upP = Number(maxUpliftPct);
    const discP = Number(maxDiscountPct);

    if (isNaN(minP) || isNaN(maxP) || minP > maxP) {
      setError('Validation failed: Minimum floor price must be less than or equal to maximum ceiling price (min <= max).');
      return;
    }
    if (isNaN(upP) || upP < 0 || upP > 100 || isNaN(discP) || discP < 0 || discP > 100) {
      setError('Validation failed: Uplift and discount guardrail percentages must be between 0% and 100%.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest(`/api/admin/guardrails/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          min_price: minP,
          max_price: maxP,
          max_uplift_percent: upP,
          max_discount_percent: discP,
          sample_context: defaultPreviewContexts[slug],
        }),
      });
      setPreview(res.preview);
      setMessage(`Guardrails saved for ${slug.toUpperCase()} and recorded in Admin Audit Log (${res.audit_log?.id}).`);
      onAuditLogged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update guardrails.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-[#A69080] rounded-[4px] bg-white p-6 text-[#3E362E]">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-[#A69080]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
            Phase 1 · Price Protection Guardrails
          </div>
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Category Guardrails &amp; Cap Editor
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {(['hotel', 'airline', 'car'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setSlug(c);
                onSelectDomain?.(c);
              }}
              className={`px-3.5 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                slug === c
                  ? 'bg-[#3E362E] text-white'
                  : 'bg-[#AC8968]/10 text-[#3E362E] border border-[#AC8968]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-[4px] bg-[#AC8968]/15 border border-[#865D36] text-xs font-semibold text-[#3E362E]">
          ▲ {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 rounded-[4px] bg-[#AC8968]/15 border border-[#3E362E] text-xs font-semibold text-[#3E362E]">
          ✓ {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSaveGuardrails} className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="gr-min-price" className="block text-xs font-semibold mb-1">
                Min Floor Price (₹)
              </label>
              <input
                id="gr-min-price"
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] text-sm"
              />
            </div>
            <div>
              <label htmlFor="gr-max-price" className="block text-xs font-semibold mb-1">
                Max Ceiling Price (₹)
              </label>
              <input
                id="gr-max-price"
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="gr-max-uplift" className="block text-xs font-semibold mb-1">
                Max Uplift Cap (0–100%)
              </label>
              <input
                id="gr-max-uplift"
                type="number"
                min={0}
                max={100}
                value={maxUpliftPct}
                onChange={(e) => setMaxUpliftPct(e.target.value)}
                className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] text-sm"
              />
              <span className="text-[11px] text-[#3E362E]/75">Caps increases above base price</span>
            </div>
            <div>
              <label htmlFor="gr-max-discount" className="block text-xs font-semibold mb-1">
                Max Discount Floor (0–100%)
              </label>
              <input
                id="gr-max-discount"
                type="number"
                min={0}
                max={100}
                value={maxDiscountPct}
                onChange={(e) => setMaxDiscountPct(e.target.value)}
                className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] text-sm"
              />
              <span className="text-[11px] text-[#3E362E]/75">Limits total stacked discounts</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 min-h-[44px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] transition-colors cursor-pointer"
          >
            {saving ? 'Applying & Logging...' : `Save ${slug.toUpperCase()} Guardrails & Preview`}
          </button>
        </form>

        <div className="lg:col-span-7">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#865D36] mb-2">
            Live Peak Scenario Preview ({JSON.stringify(defaultPreviewContexts[slug])})
          </div>
          {preview && (
            <BreakdownTable
              breakdown={preview.breakdown || []}
              finalPrice={preview.final_price}
              capDetails={preview.cap_details}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 2: PROMO CODES & LOYALTY TIERS ADMIN PANEL
// ============================================================================

export const AdminPromosAndLoyaltyPanel: React.FC<{
  selectedDomain?: string;
  onAuditLogged?: () => void;
}> = ({ selectedDomain, onAuditLogged }) => {
  const [promos, setPromos] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // New Promo Form
  const [newCode, setNewCode] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newType, setNewType] = useState<'percent' | 'flat'>('percent');
  const [newValue, setNewValue] = useState<string>('12');
  const [newMinSpend, setNewMinSpend] = useState<string>('1500');
  const [newValidFrom, setNewValidFrom] = useState<string>('2026-01-01');
  const [newValidTo, setNewValidTo] = useState<string>('2027-12-31');
  const [newLimit, setNewLimit] = useState<string>('50');
  const [newPerUser, setNewPerUser] = useState<string>('2');
  const [newStackable, setNewStackable] = useState<boolean>(true);
  const [newCats, setNewCats] = useState<string[]>(['hotel', 'airline', 'car']);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        apiRequest('/api/admin/promos'),
        apiRequest('/api/admin/loyalty-tiers'),
      ]);
      setPromos(pRes.promos || []);
      setTiers(tRes.tiers || []);
    } catch (e: any) {
      setErr(e.message || 'Failed to load promos & loyalty tiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      await apiRequest('/api/admin/promos', {
        method: 'POST',
        body: JSON.stringify({
          code: newCode,
          description: newDesc,
          type: newType,
          value: Number(newValue),
          min_spend: Number(newMinSpend),
          valid_from: newValidFrom,
          valid_to: newValidTo,
          usage_limit: Number(newLimit),
          per_user_limit: Number(newPerUser),
          categories: newCats,
          stackable: newStackable,
        }),
      });
      setNewCode('');
      setNewDesc('');
      setMsg(`Promo code "${newCode.toUpperCase()}" created and active.`);
      loadData();
      onAuditLogged?.();
    } catch (e: any) {
      setErr(e.message || 'Could not create promo code.');
    }
  };

  const handleTogglePromo = async (promo: any) => {
    try {
      await apiRequest(`/api/admin/promos/${promo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !promo.is_active }),
      });
      loadData();
      onAuditLogged?.();
    } catch (e: any) {
      setErr(e.message || 'Failed to update promo status.');
    }
  };

  const handleSaveTiers = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const res = await apiRequest('/api/admin/loyalty-tiers', {
        method: 'PUT',
        body: JSON.stringify({ tiers }),
      });
      setTiers(res.tiers || []);
      setMsg('Loyalty tier thresholds and discount percentages updated and logged.');
      onAuditLogged?.();
    } catch (e: any) {
      setErr(e.message || 'Failed to update loyalty tiers.');
    }
  };

  const toggleCategoryChoice = (cat: string) => {
    setNewCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (loading) {
    return <div className="p-6 text-sm text-[#3E362E]">Loading Promo Codes &amp; Loyalty Tiers...</div>;
  }

  return (
    <div className="space-y-8 text-[#3E362E]">
      {err && (
        <div className="p-3 rounded-[4px] bg-[#AC8968]/15 border border-[#865D36] text-xs font-semibold">
          ▲ {err}
        </div>
      )}
      {msg && (
        <div className="p-3 rounded-[4px] bg-[#AC8968]/15 border border-[#3E362E] text-xs font-semibold">
          ✓ {msg}
        </div>
      )}

      {/* Promo Codes Management */}
      <div className="border border-[#A69080] rounded-[4px] bg-white p-6">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
            Phase 2 · Promotional Vouchers (Context value_from Rules)
          </div>
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Promo Code Registry &amp; Redemption Limits
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Create Promo Form */}
          <form onSubmit={handleCreatePromo} className="lg:col-span-4 space-y-3 p-4 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3E362E]">
              Create New Promo Code
            </h4>
            <div>
              <label htmlFor="prm-code" className="block text-xs font-semibold mb-1">Code (3–20 chars)</label>
              <input
                id="prm-code"
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g. FESTIVE20"
                className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] bg-white text-sm uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="prm-type" className="block text-xs font-semibold mb-1">Discount Type</label>
                <select
                  id="prm-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'percent' | 'flat')}
                  className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] bg-white text-sm"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
              <div>
                <label htmlFor="prm-val" className="block text-xs font-semibold mb-1">Value</label>
                <input
                  id="prm-val"
                  type="number"
                  min={1}
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] bg-white text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="prm-min" className="block text-xs font-semibold mb-1">Min Spend (₹)</label>
                <input
                  id="prm-min"
                  type="number"
                  min={0}
                  value={newMinSpend}
                  onChange={(e) => setNewMinSpend(e.target.value)}
                  className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] bg-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="prm-limit" className="block text-xs font-semibold mb-1">Total Limit</label>
                <input
                  id="prm-limit"
                  type="number"
                  min={1}
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-[#A69080] rounded-[4px] bg-white text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="prm-from" className="block text-xs font-semibold mb-1">Valid From</label>
                <input
                  id="prm-from"
                  type="date"
                  value={newValidFrom}
                  onChange={(e) => setNewValidFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#A69080] rounded-[4px] bg-white text-xs"
                />
              </div>
              <div>
                <label htmlFor="prm-to" className="block text-xs font-semibold mb-1">Valid To</label>
                <input
                  id="prm-to"
                  type="date"
                  value={newValidTo}
                  onChange={(e) => setNewValidTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#A69080] rounded-[4px] bg-white text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <span className="font-semibold">Categories:</span>
              {(['hotel', 'airline', 'car'] as const).map((cat) => (
                <label key={cat} className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCats.includes(cat)}
                    onChange={() => toggleCategoryChoice(cat)}
                  />
                  <span className="uppercase">{cat}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={newStackable}
                onChange={(e) => setNewStackable(e.target.checked)}
              />
              <span>Stackable with loyalty/student rules</span>
            </label>
            <button
              type="submit"
              className="w-full py-2.5 min-h-[42px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] cursor-pointer"
            >
              Create Promo Code
            </button>
          </form>

          {/* Promo Codes Table */}
          <div className="lg:col-span-8 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" aria-label="Promo codes table">
              <thead>
                <tr className="border-b border-[#A69080] uppercase text-[#3E362E]">
                  <th className="py-2.5 px-3 font-semibold">Code</th>
                  <th className="py-2.5 px-3 font-semibold">Concession</th>
                  <th className="py-2.5 px-3 font-semibold">Min Spend</th>
                  <th className="py-2.5 px-3 font-semibold">Categories</th>
                  <th className="py-2.5 px-3 font-semibold">Validity</th>
                  <th className="py-2.5 px-3 font-semibold">Usage</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/30">
                {promos.map((p) => (
                  <tr key={p.id} className={!p.is_active ? 'opacity-60 bg-[#AC8968]/10' : 'bg-white'}>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-sm text-[#3E362E]">{p.code}</div>
                      <div className="text-[11px] text-[#3E362E]/75">{p.stackable ? 'Stackable' : 'Non-stackable'}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold tabular-nums">
                      {p.type === 'percent' ? `▼ −${p.value}%` : `▼ −${formatINR(p.value)}`}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums">{formatINR(p.min_spend)}</td>
                    <td className="py-2.5 px-3 uppercase">{(p.categories || []).join(', ')}</td>
                    <td className="py-2.5 px-3 tabular-nums">
                      {p.valid_from} → {p.valid_to}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-semibold">
                      {p.used_count} / {p.usage_limit} (max {p.per_user_limit}/user)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(p)}
                        className="px-2.5 py-1 rounded-[3px] border border-[#3E362E] text-xs font-semibold hover:bg-[#AC8968]/20 cursor-pointer"
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Loyalty Tiers Editor */}
      <div className="border border-[#A69080] rounded-[4px] bg-white p-6">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
            Phase 2 · Confirmed Booking Loyalty Tiers
          </div>
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Loyalty Tier Thresholds &amp; Discount Percentages
          </h3>
        </div>
        <form onSubmit={handleSaveTiers} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((t, idx) => (
              <div key={t.tier} className="p-4 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] space-y-3">
                <div className="font-display text-xl font-bold text-[#3E362E]">{t.tier} Tier</div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Min Confirmed Bookings
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={t.min_bookings}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...t, min_bookings: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className="w-full px-3 py-1.5 border border-[#A69080] rounded-[4px] bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Automatic Discount (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={t.discount_percent}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...t, discount_percent: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className="w-full px-3 py-1.5 border border-[#A69080] rounded-[4px] bg-white text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 min-h-[42px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] cursor-pointer"
          >
            Save Loyalty Tier Configuration
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 4: ADMIN ANALYTICS VIEW (/admin/analytics)
// ============================================================================

export const AdminAnalyticsView: React.FC<{
  selectedDomain?: string;
  onSelectDomain?: (slug: string) => void;
}> = ({ selectedDomain, onSelectDomain }) => {
  const [category, setCategory] = useState<'all' | 'hotel' | 'airline' | 'car'>('all');
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [showTables, setShowTables] = useState<boolean>(false);
  const [showUpliftTip, setShowUpliftTip] = useState<boolean>(false);

  const loadAnalytics = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiRequest(`/api/admin/analytics?category=${category}&days=${days}`);
      setData(res);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [category, days]);

  const handleGenerateDemoData = async () => {
    setGenerating(true);
    try {
      await apiRequest('/api/admin/analytics/generate-demo', {
        method: 'POST',
        body: JSON.stringify({ count: 500 }),
      });
      await loadAnalytics();
    } finally {
      setGenerating(false);
    }
  };

  const handleResetDemoData = async () => {
    setGenerating(true);
    try {
      await apiRequest('/api/admin/reset-demo', { method: 'POST' });
      await loadAnalytics();
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCsv = () => {
    if (!data?.csv_rows) return;
    const headers = [
      'booking_id',
      'category',
      'item_title',
      'created_at',
      'quantity',
      'base_unit_price',
      'final_unit_price',
      'uplift_total',
      'total_with_tax',
      'promo_code',
      'is_simulated',
      'audit_id',
    ];
    const lines = [
      headers.join(','),
      ...data.csv_rows.map((r: any) =>
        headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monetize360-analytics-${category}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="p-8 border border-[#A69080] rounded-[4px] bg-white text-[#3E362E]">
        Loading revenue &amp; rule telemetry...
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="p-8 border border-[#A69080] rounded-[4px] bg-white text-[#3E362E] space-y-3">
        <div className="text-sm font-semibold text-[#865D36]">▲ {errorMsg}</div>
        <button
          type="button"
          onClick={loadAnalytics}
          className="px-4 py-2 bg-[#3E362E] text-white text-xs font-semibold rounded-[4px] cursor-pointer"
        >
          Retry Analytics Load
        </button>
      </div>
    );
  }

  if (!data) return null;

  const maxRevPoint = Math.max(
    1,
    ...data.revenue_series.map((s: any) => Math.max(s.actual_revenue, s.base_revenue))
  );
  const maxRuleCount = Math.max(1, ...(data.rules_fired.map((r: any) => r.count) || [1]));

  return (
    <div className="space-y-6 text-[#3E362E]">
      {/* Controls Bar */}
      <div className="p-5 border border-[#A69080] rounded-[4px] bg-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
              Phase 4 · Revenue &amp; Uplift Telemetry (/admin/analytics)
            </span>
            {data.has_simulated_data && (
              <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/20 border border-[#865D36] text-[11px] font-semibold text-[#3E362E]">
                Simulated data
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl font-semibold text-[#3E362E]">
            Dynamic Pricing Performance &amp; Rule Analytics
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            aria-label="Filter analytics by category"
            value={category}
            onChange={(e) => {
              const val = e.target.value as 'all' | 'hotel' | 'airline' | 'car';
              setCategory(val);
              if (val !== 'all') onSelectDomain?.(val);
            }}
            className="px-3 py-2 min-h-[40px] border border-[#A69080] rounded-[4px] bg-white text-xs font-semibold"
          >
            <option value="all">All Categories</option>
            <option value="hotel">Hotels &amp; Stays</option>
            <option value="airline">Airlines</option>
            <option value="car">Chauffeur Cars</option>
          </select>
          {selectedDomain && ['hotel', 'airline', 'car'].includes(selectedDomain) && category !== selectedDomain && (
            <button
              type="button"
              onClick={() => setCategory(selectedDomain as any)}
              className="px-2.5 py-2 min-h-[40px] border border-[#865D36] bg-[#AC8968]/15 text-[#3E362E] text-xs font-semibold rounded-[4px] cursor-pointer"
            >
              Filter to Active Domain ({selectedDomain.toUpperCase()})
            </button>
          )}

          {/* Days Window Filter */}
          <div className="flex items-center border border-[#A69080] rounded-[4px] overflow-hidden">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer ${
                  days === d ? 'bg-[#3E362E] text-white' : 'bg-white text-[#3E362E]'
                }`}
              >
                Last {d}d
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateDemoData}
            className="px-3.5 py-2 min-h-[40px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] cursor-pointer"
          >
            {generating ? 'Working...' : 'Generate demo data (500)'}
          </button>

          <button
            type="button"
            disabled={generating}
            onClick={handleResetDemoData}
            className="px-3 py-2 min-h-[40px] border border-[#3E362E] text-[#3E362E] text-xs font-semibold rounded-[4px] hover:bg-[#AC8968]/15 cursor-pointer"
          >
            Reset demo data
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 min-h-[40px] border border-[#3E362E] text-[#3E362E] text-xs font-semibold rounded-[4px] hover:bg-[#AC8968]/15 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#865D36]" />
            <span>CSV Export</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTables((prev) => !prev)}
            className="px-3 py-2 min-h-[40px] border border-[#A69080] text-[#3E362E] text-xs font-semibold rounded-[4px] hover:bg-[#AC8968]/15 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Table className="w-3.5 h-3.5 text-[#865D36]" />
            <span>{showTables ? 'Hide Data Tables' : 'Show Data Tables'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-[4px] bg-white border border-[#A69080]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#3E362E]/80">
            Confirmed Bookings
          </div>
          <div className="font-display text-3xl font-bold text-[#93785B] tabular-nums my-1">
            {data.kpis.bookings_count.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#3E362E]">
            {data.kpis.total_units.toLocaleString('en-IN')} total room-nights / seats / trips
          </div>
        </div>

        <div className="p-5 rounded-[4px] bg-white border border-[#A69080]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#3E362E]/80">
            Average Unit Price
          </div>
          <div className="font-display text-3xl font-bold text-[#3E362E] tabular-nums my-1">
            {formatINR(data.kpis.avg_unit_price)}
          </div>
          <div className="text-xs text-[#3E362E]">Across selected {days}-day window</div>
        </div>

        <div className="p-5 rounded-[4px] bg-white border border-[#A69080]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#3E362E]/80">
            Dynamic Revenue
          </div>
          <div className="font-display text-3xl font-bold text-[#3E362E] tabular-nums my-1">
            {formatINR(data.kpis.total_revenue)}
          </div>
          <div className="text-xs text-[#3E362E] tabular-nums">
            Static base equivalent: {formatINR(data.kpis.static_base_revenue)}
          </div>
        </div>

        <div className="p-5 rounded-[4px] bg-[#AC8968]/10 border border-[#865D36] relative">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#3E362E]">
              Uplift vs Static Pricing
            </span>
            <button
              type="button"
              onMouseEnter={() => setShowUpliftTip(true)}
              onMouseLeave={() => setShowUpliftTip(false)}
              onFocus={() => setShowUpliftTip(true)}
              onBlur={() => setShowUpliftTip(false)}
              onClick={() => setShowUpliftTip((p) => !p)}
              aria-label="Uplift equals sum of (price paid minus base price) times quantity"
              className="text-xs font-semibold text-[#865D36] underline cursor-pointer"
            >
              Formula?
            </button>
          </div>
          {showUpliftTip && (
            <div
              role="tooltip"
              className="absolute z-30 top-10 right-2 w-72 p-3 rounded-[4px] bg-[#3E362E] text-white text-xs shadow-lg"
            >
              Assumption: Uplift = Σ (price paid − base price) × quantity across all confirmed bookings in the filter window.
            </div>
          )}
          <div className="font-display text-3xl font-bold text-[#93785B] tabular-nums my-1">
            {data.kpis.net_uplift >= 0
              ? `▲ +${formatINR(data.kpis.net_uplift)}`
              : `▼ −${formatINR(Math.abs(data.kpis.net_uplift))}`}
          </div>
          <div className="text-xs font-semibold text-[#3E362E] tabular-nums">
            {data.kpis.uplift_percent >= 0
              ? `▲ +${data.kpis.uplift_percent}% net yield vs static base`
              : `▼ −${Math.abs(data.kpis.uplift_percent)}% net concession vs static base`}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Revenue vs Base (Line) + Rules Fired (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue vs Static Base Price */}
        <div className="p-5 border border-[#A69080] rounded-[4px] bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                1. Actual Dynamic Revenue vs Static Base Revenue
              </h3>
              <p className="text-xs text-[#3E362E]/80">
                Solid ● = Dynamic Engine Revenue · Dashed ■ = Static Base Revenue
              </p>
            </div>
            {data.has_simulated_data && (
              <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] text-[10px] font-semibold">
                Simulated data
              </span>
            )}
          </div>

          <svg
            viewBox="0 0 560 220"
            className="w-full h-52 overflow-visible"
            role="img"
            aria-label="Line chart comparing actual dynamic revenue and static base revenue"
          >
            {[0, 0.5, 1].map((t, idx) => {
              const y = 25 + t * 150;
              const val = Math.round(maxRevPoint * (1 - t));
              return (
                <g key={idx}>
                  <line x1="65" y1={y} x2="540" y2={y} stroke="#A69080" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="60" y={y + 4} textAnchor="end" fontSize="10" fill="#3E362E" fontWeight="600">
                    ₹{val.toLocaleString('en-IN')}
                  </text>
                </g>
              );
            })}

            {/* Base Revenue Line (Dashed + Square Markers) */}
            <polyline
              fill="none"
              stroke="#865D36"
              strokeWidth="2"
              strokeDasharray="5 4"
              points={data.revenue_series
                .map((pt: any, i: number) => {
                  const x = 75 + (i / Math.max(1, data.revenue_series.length - 1)) * 455;
                  const y = 175 - (pt.base_revenue / maxRevPoint) * 145;
                  return `${x},${y}`;
                })
                .join(' ')}
            />

            {/* Actual Dynamic Revenue Line (Solid + Circle Markers) */}
            <polyline
              fill="none"
              stroke="#3E362E"
              strokeWidth="2.5"
              points={data.revenue_series
                .map((pt: any, i: number) => {
                  const x = 75 + (i / Math.max(1, data.revenue_series.length - 1)) * 455;
                  const y = 175 - (pt.actual_revenue / maxRevPoint) * 145;
                  return `${x},${y}`;
                })
                .join(' ')}
            />

            {data.revenue_series.map((pt: any, i: number) => {
              const x = 75 + (i / Math.max(1, data.revenue_series.length - 1)) * 455;
              const yAct = 175 - (pt.actual_revenue / maxRevPoint) * 145;
              const yBase = 175 - (pt.base_revenue / maxRevPoint) * 145;
              return (
                <g key={i}>
                  <rect x={x - 3.5} y={yBase - 3.5} width="7" height="7" fill="#AC8968" stroke="#3E362E" strokeWidth="1" />
                  <circle cx={x} cy={yAct} r="4" fill="#3E362E" />
                  <text x={x} y="198" textAnchor="middle" fontSize="9" fill="#3E362E" fontWeight="600">
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {showTables && (
            <div className="mt-3 border-t border-[#A69080] pt-3 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse" aria-label="Revenue vs base data table">
                <thead>
                  <tr className="border-b border-[#A69080]">
                    <th className="py-1.5 font-semibold">Window</th>
                    <th className="py-1.5 font-semibold text-right">Dynamic Revenue</th>
                    <th className="py-1.5 font-semibold text-right">Static Base Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenue_series.map((pt: any, i: number) => (
                    <tr key={i} className="border-b border-[#A69080]/20">
                      <td className="py-1">{pt.label}</td>
                      <td className="py-1 text-right tabular-nums">{formatINR(pt.actual_revenue)}</td>
                      <td className="py-1 text-right tabular-nums">{formatINR(pt.base_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Chart 2: Rules Fired per Rule */}
        <div className="p-5 border border-[#A69080] rounded-[4px] bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                2. Rules &amp; Guardrails Fired Frequency
              </h3>
              <p className="text-xs text-[#3E362E]/80">
                Direct count &amp; direction (▲ Increase / ▼ Discount) per rule
              </p>
            </div>
            {data.has_simulated_data && (
              <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] text-[10px] font-semibold">
                Simulated data
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {data.rules_fired.map((r: any) => {
              const pct = Math.max(6, Math.round((r.count / maxRuleCount) * 100));
              return (
                <div key={r.rule_id + r.name} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#3E362E]">
                      {r.direction === 'up' ? '▲ +' : r.direction === 'down' ? '▼ −' : '● '} {r.name}{' '}
                      <span className="text-[#3E362E]/70 font-normal">({r.rule_id})</span>
                    </span>
                    <span className="font-bold tabular-nums">{r.count} fires</span>
                  </div>
                  <div className="w-full h-3 bg-[#AC8968]/15 rounded-[2px] overflow-hidden border border-[#A69080]">
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: r.direction === 'up' ? '#3E362E' : '#865D36',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Weekday Averages per Category + Price Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Average Price by Weekday per Category */}
        <div className="p-5 border border-[#A69080] rounded-[4px] bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                3. Average Unit Fare by Weekday per Category
              </h3>
              <p className="text-xs text-[#3E362E]/80">
                Direct labels + distinct fill patterns (Solid #3E362E Air · Diagonal Hatch #AC8968 Hotel · Cross #865D36 Car)
              </p>
            </div>
            {data.has_simulated_data && (
              <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] text-[10px] font-semibold">
                Simulated data
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" aria-label="Average price by weekday per category">
              <thead>
                <tr className="border-b border-[#A69080] bg-[#AC8968]/10">
                  <th className="py-2 px-3 font-semibold">Weekday</th>
                  <th className="py-2 px-3 font-semibold text-right">■ Hotel Avg</th>
                  <th className="py-2 px-3 font-semibold text-right">● Airline Avg</th>
                  <th className="py-2 px-3 font-semibold text-right">▲ Car (8km) Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/30">
                {data.weekday_averages.map((w: any) => (
                  <tr key={w.weekday} className={w.weekday === 'Sat' || w.weekday === 'Sun' ? 'bg-[#AC8968]/10 font-semibold' : ''}>
                    <td className="py-2 px-3">{w.weekday}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {w.hotel_avg > 0 ? formatINR(w.hotel_avg) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {w.airline_avg > 0 ? formatINR(w.airline_avg) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {w.car_avg > 0 ? formatINR(w.car_avg) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart 4: Price Distribution Histogram */}
        <div className="p-5 border border-[#A69080] rounded-[4px] bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                4. Unit Price Distribution Histogram
              </h3>
              <p className="text-xs text-[#3E362E]/80">
                Booking distribution across fare bands
              </p>
            </div>
            {data.has_simulated_data && (
              <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] text-[10px] font-semibold">
                Simulated data
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.price_distribution.map((b: any) => {
              const maxBand = Math.max(1, ...data.price_distribution.map((d: any) => d.count));
              const widthPct = Math.max(4, Math.round((b.count / maxBand) * 100));
              return (
                <div key={b.range_label} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#3E362E]">{b.range_label}</span>
                    <span className="tabular-nums font-semibold">
                      {b.count} bookings (H:{b.hotel_count} · A:{b.airline_count} · C:{b.car_count})
                    </span>
                  </div>
                  <div className="w-full h-3.5 bg-[#AC8968]/15 rounded-[2px] border border-[#A69080] overflow-hidden">
                    <div
                      className="h-full bg-[#865D36]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 5: ADMIN SECURITY AUDIT LOG PANEL
// ============================================================================

export const AdminSecurityAuditLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/audit-logs');
      setLogs(res.logs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="border border-[#A69080] rounded-[4px] bg-white p-6 text-[#3E362E]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
            Phase 5 · Governance &amp; Security Audit Trail
          </div>
          <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
            Administrative Mutation Log (Who, What, When)
          </h3>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="px-3 py-1.5 border border-[#3E362E] rounded-[4px] text-xs font-semibold cursor-pointer"
        >
          Refresh Log
        </button>
      </div>

      {loading ? (
        <div className="text-sm">Loading audit log...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs" aria-label="Administrative audit log">
            <thead>
              <tr className="border-b border-[#A69080] bg-[#AC8968]/10 uppercase">
                <th className="py-2.5 px-3 font-semibold">Log ID</th>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Actor (Who)</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Category / Target</th>
                <th className="py-2.5 px-3 font-semibold">Summary (What)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A69080]/30">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-3 font-semibold tabular-nums">{l.id}</td>
                  <td className="py-2.5 px-3 tabular-nums">{new Date(l.created_at).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 font-medium">{l.actor_email}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] font-semibold">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 uppercase tabular-nums">
                    {l.category} · {l.target_id}
                  </td>
                  <td className="py-2.5 px-3">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PHASE 6: LIVE PROOF & PACKAGING VIEW (/admin/proof)
// ============================================================================

export const AdminProofView: React.FC = () => {
  const [proofData, setProofData] = useState<any>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [lastSection, setLastSection] = useState<string>('all');

  const runLiveProof = async (section: string = 'all') => {
    setRunning(true);
    setLastSection(section);
    try {
      const res = await apiRequest('/api/admin/proof/run', {
        method: 'POST',
        body: JSON.stringify({ section }),
      });
      setProofData(res);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runLiveProof('all');
  }, []);

  return (
    <div className="space-y-6 text-[#3E362E]">
      {/* Header & Master Run Button */}
      <div className="p-6 border border-[#A69080] rounded-[4px] bg-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#865D36]">
            Phase 6 · Live Architecture &amp; Security Proof (/admin/proof)
          </div>
          <h2 className="font-display text-3xl font-semibold text-[#3E362E]">
            Live Engine Domain-Agnosticism, Golden &amp; Security Verification
          </h2>
          <p className="text-sm text-[#3E362E]/80 mt-1">
            Nothing is hard-coded: clicking Run reads <code>src/server/engine.ts</code> from disk, executes 1,500 live
            engine evaluations, and runs security assertions on the server.
          </p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={() => runLiveProof('all')}
          className="px-5 py-3 min-h-[44px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] inline-flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4" />
          <span>{running ? 'Running Live Checks...' : 'Run All Live Verification Suites'}</span>
        </button>
      </div>

      {proofData && (
        <>
          {/* (a) Domain-Word Source Scan */}
          <div className="p-6 border border-[#A69080] rounded-[4px] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                  (a) Domain-Word Source Scan of Engine (<code>{proofData.domain_scan.file_path}</code>)
                </h3>
                <p className="text-xs text-[#3E362E]/80 tabular-nums">
                  Scanned {proofData.domain_scan.total_lines} lines ({proofData.domain_scan.total_bytes} bytes) ·
                  SHA-256: <code>{proofData.domain_scan.sha256.slice(0, 24)}...</code>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-[4px] bg-[#AC8968]/20 border border-[#3E362E] text-xs font-bold">
                  {proofData.domain_scan.passed
                    ? `✓ PASS (0 Forbidden Domain Words Found)`
                    : `▲ FAIL (${proofData.domain_scan.total_matches} matches)`}
                </span>
                <button
                  type="button"
                  onClick={() => runLiveProof('domain_scan')}
                  className="px-3 py-1.5 border border-[#3E362E] rounded-[4px] text-xs font-semibold cursor-pointer"
                >
                  Re-Run Scan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {proofData.domain_scan.word_results.map((w: any) => (
                <div
                  key={w.word}
                  className="p-2.5 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] flex items-center justify-between text-xs"
                >
                  <code className="font-semibold">\b{w.word}\b</code>
                  <span className="font-bold text-[#865D36]">
                    {w.matches_count === 0 ? '0 hits ✓' : `${w.matches_count} hits`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* (b) Live Golden, Guardrails, Promo, Loyalty & Cancellation Suite */}
          <div className="p-6 border border-[#A69080] rounded-[4px] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                  (b) Live Engine Golden, Guardrail, Promo &amp; Cancellation Suite
                </h3>
                <p className="text-xs text-[#3E362E]/80">
                  Passed {proofData.golden_suite.passed} / {proofData.golden_suite.total} live assertions
                </p>
              </div>
              <button
                type="button"
                onClick={() => runLiveProof('golden')}
                className="px-3 py-1.5 border border-[#3E362E] rounded-[4px] text-xs font-semibold cursor-pointer"
              >
                Re-Run Golden Tests
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs" aria-label="Golden test results">
                <thead>
                  <tr className="border-b border-[#A69080] bg-[#AC8968]/10 uppercase">
                    <th className="py-2 px-3 font-semibold">ID</th>
                    <th className="py-2 px-3 font-semibold">Scenario</th>
                    <th className="py-2 px-3 font-semibold text-right">Expected</th>
                    <th className="py-2 px-3 font-semibold text-right">Live Actual</th>
                    <th className="py-2 px-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A69080]/30">
                  {proofData.golden_suite.tests.map((t: any) => (
                    <tr key={t.id}>
                      <td className="py-2 px-3 font-semibold tabular-nums">{t.id}</td>
                      <td className="py-2 px-3">{t.name}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatINR(t.expected)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold">{formatINR(t.actual)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#865D36]">
                        {t.passed ? '✓ PASS' : '▲ FAIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* (c) Live Benchmark & (d) Live Security Suite */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 border border-[#A69080] rounded-[4px] bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                  (c) Live Latency &amp; Throughput Benchmark
                </h3>
                <button
                  type="button"
                  onClick={() => runLiveProof('benchmark')}
                  className="px-3 py-1.5 border border-[#3E362E] rounded-[4px] text-xs font-semibold cursor-pointer"
                >
                  Run 1,500 Evals
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
                  <div className="uppercase font-semibold text-[#3E362E]/75">Evaluations Run</div>
                  <div className="font-display text-2xl font-bold text-[#93785B] tabular-nums">
                    {proofData.benchmark.iterations.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
                  <div className="uppercase font-semibold text-[#3E362E]/75">Live Throughput</div>
                  <div className="font-display text-2xl font-bold text-[#93785B] tabular-nums">
                    {proofData.benchmark.throughput_rps.toLocaleString('en-IN')} req/s
                  </div>
                </div>
                <div className="p-3 rounded-[4px] bg-white border border-[#A69080]">
                  <div className="uppercase font-semibold text-[#3E362E]/75">p50 / p95 Latency</div>
                  <div className="font-display text-xl font-bold text-[#3E362E] tabular-nums">
                    {proofData.benchmark.p50_ms} ms / {proofData.benchmark.p95_ms} ms
                  </div>
                </div>
                <div className="p-3 rounded-[4px] bg-white border border-[#A69080]">
                  <div className="uppercase font-semibold text-[#3E362E]/75">p99 Latency</div>
                  <div className="font-display text-xl font-bold text-[#3E362E] tabular-nums">
                    {proofData.benchmark.p99_ms} ms
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border border-[#A69080] rounded-[4px] bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                  (d) Automated Security Controls Verification
                </h3>
                <button
                  type="button"
                  onClick={() => runLiveProof('security')}
                  className="px-3 py-1.5 border border-[#3E362E] rounded-[4px] text-xs font-semibold cursor-pointer"
                >
                  Re-Run Security Suite
                </button>
              </div>
              <div className="space-y-2.5 text-xs">
                {proofData.security_suite.tests.map((st: any) => (
                  <div
                    key={st.id}
                    className="p-3 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-[#3E362E]">
                        {st.id}: {st.name}
                      </div>
                      <div className="text-[#3E362E]/80 tabular-nums mt-0.5">{st.detail}</div>
                    </div>
                    <span className="font-bold text-[#865D36] shrink-0">
                      {st.passed ? '✓ PASS' : '▲ FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* (e) Zero-Code 4th Domain Proof */}
          <div className="p-6 border border-[#A69080] rounded-[4px] bg-white">
            <h3 className="font-display text-xl font-semibold text-[#3E362E] mb-2">
              (e) Zero-Code 4th Industry Domain Proof ({proofData.zero_code_domain.config.name})
            </h3>
            <p className="text-xs text-[#3E362E]/80 mb-4">
              Evaluated a JSON configuration for <code>event_venue</code> through <code>executePricingEngine</code> with
              zero engine code changes (including guardrail cap enforcement):
            </p>
              <BreakdownTable
              breakdown={proofData.zero_code_domain.result.breakdown || []}
              finalPrice={proofData.zero_code_domain.result.final_price}
              capDetails={proofData.zero_code_domain.result.cap_details}
            />
          </div>
        </>
      )}
    </div>
  );
};

export const ResetDemoDataButton: React.FC<{
  showToast?: (msg: string) => void;
  onReset?: () => void;
}> = ({ showToast, onReset }) => {
  const [busy, setBusy] = useState(false);

  const handleReset = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/admin/reset-demo', { method: 'POST' });
      showToast?.('Demo data reset to clean seed state across all categories.');
      onReset?.();
    } catch (e: any) {
      showToast?.(e.message || 'Could not reset demo data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleReset}
      className="px-3.5 py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#AC8968]/20 text-xs font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
    >
      <RefreshCw className={`w-3.5 h-3.5 text-[#865D36] ${busy ? 'animate-spin' : ''}`} />
      <span>{busy ? 'Resetting...' : 'Reset demo data'}</span>
    </button>
  );
};

export const AdminAuditLogPanel = AdminSecurityAuditLogPanel;
export const AdminPromosPanel = AdminPromosAndLoyaltyPanel;

