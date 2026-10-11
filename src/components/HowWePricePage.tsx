import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { formatINR } from '../lib/format';
import { BreakdownTable } from './SharedUI';
import { ShieldCheck, Search, CheckCircle2, ArrowRight, Scale, FileText } from 'lucide-react';

export const HowWePricePage: React.FC<{
  onNavigate: (path: string) => void;
}> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'hotel' | 'airline' | 'car'>('hotel');
  const [auditQuery, setAuditQuery] = useState<string>('AUD-2026-8841');
  const [inspectedAudit, setInspectedAudit] = useState<any>(null);
  const [auditError, setAuditError] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  const loadHowWePrice = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/shop/how-we-price');
      setData(res);
      if (res.recent_audits?.[0]?.id) {
        setAuditQuery(res.recent_audits[0].id);
        inspectAuditById(res.recent_audits[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load live pricing policy.');
    } finally {
      setLoading(false);
    }
  };

  const inspectAuditById = async (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await apiRequest(`/api/shop/audit/${encodeURIComponent(clean)}`);
      setInspectedAudit(res.audit);
    } catch (err: any) {
      setInspectedAudit(null);
      setAuditError(err.message || `Audit ID "${clean}" not found.`);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadHowWePrice();
  }, []);

  if (loading) {
    return (
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-72 bg-[#AC8968]/20 rounded-[4px]" />
          <div className="h-32 w-full bg-[#AC8968]/15 rounded-[4px]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-[#AC8968]/15 rounded-[4px]" />
            <div className="h-64 bg-[#AC8968]/15 rounded-[4px]" />
            <div className="h-64 bg-[#AC8968]/15 rounded-[4px]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="p-6 border border-[#A69080] rounded-[4px] bg-white text-[#3E362E]">
          <h1 className="font-display text-2xl font-semibold mb-2">Unable to load pricing transparency report</h1>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={loadHowWePrice}
            className="px-4 py-2 bg-[#865D36] text-white text-sm font-semibold rounded-[4px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const currentDomain =
    data.domains.find((d: any) => d.category === activeCategory) || data.domains[0];

  const formatActionSummary = (action: any) => {
    if (action.type === 'percent') {
      return action.value >= 0
        ? `▲ +${action.value}% (Increase)`
        : `▼ −${Math.abs(action.value)}% (Discount)`;
    }
    if (action.type === 'multiplier') {
      return action.value >= 1
        ? `▲ ×${action.value} (Multiplier Increase)`
        : `▼ ×${action.value} (Multiplier Discount)`;
    }
    if (action.type === 'flat') {
      return action.value >= 0
        ? `▲ +${formatINR(action.value)} (Flat Increase)`
        : `▼ −${formatINR(Math.abs(action.value))} (Flat Discount)`;
    }
    return `Set ${formatINR(action.value)}`;
  };

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-12 text-[#3E362E]">
      {/* Editorial Header */}
      <div className="border-b border-[#A69080] pb-8 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#AC8968]/15 border border-[#AC8968] text-xs font-semibold uppercase tracking-[0.14em] text-[#3E362E] mb-4">
          <ShieldCheck className="w-4 h-4 text-[#865D36]" />
          <span>Live Configuration Transparency · Read Directly From Engine</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-[#3E362E] tracking-tight mb-4">
          How We Price Every Booking
        </h1>
        <p className="text-base md:text-lg text-[#3E362E] max-w-3xl leading-relaxed">
          Every fare on Monetize360 is computed by a single deterministic, domain-agnostic engine.
          Prices depend <strong>exclusively on the published factors and guardrails listed below</strong>—never on
          your personal identity, browsing history, device model, or how many times you search.
          Every quote and booking carries a permanent, verifiable Audit ID.
        </p>
      </div>

      {/* Our 4 Transparency Guarantees */}
      <section aria-labelledby="pledge-heading" className="mb-12">
        <h2 id="pledge-heading" className="font-display text-2xl font-semibold text-[#3E362E] mb-4">
          Algorithmic Fairness & Non-Discrimination Guarantee
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#865D36] mb-3">
              What Never Affects Your Price
            </h3>
            <ul className="space-y-2.5 text-sm text-[#3E362E]">
              {(data.pledge?.excluded_factors || []).map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#865D36] shrink-0 mt-0.5" />
                  <span><strong>Excluded:</strong> {item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 rounded-[4px] bg-white border border-[#A69080]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#865D36] mb-3">
              Deterministic Execution Order
            </h3>
            <ol className="space-y-2 text-sm text-[#3E362E] list-decimal list-inside">
              <li><strong>Base Tariff:</strong> Fixed product rate or distance formula (`base + rate × km`).</li>
              <li><strong>Season & Calendar Rules:</strong> Weekend stays or effective-dated festival windows.</li>
              <li><strong>Live Inventory & Demand Signals:</strong> Occupancy %, remaining seats, or dispatch ratio.</li>
              <li><strong>Loyalty Tier & Promo Concessions:</strong> Verified member tier & promo code steps.</li>
              <li><strong>Hard Guardrail Caps & Rounding:</strong> Capped by `max_uplift_percent`, floored by `max_discount_percent`, and rounded without ever breaching a guardrail.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Category Selector Tabs */}
      <section aria-labelledby="live-config-heading" className="mb-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 id="live-config-heading" className="font-display text-2xl font-semibold text-[#3E362E]">
              Live Category Rules & Guardrail Caps
            </h2>
            <p className="text-sm text-[#3E362E]/80">
              Read directly from active published configuration v{currentDomain.version_no} ({currentDomain.name}).
            </p>
          </div>
          <div className="flex items-center gap-2" role="tablist" aria-label="Select pricing category">
            {(['hotel', 'airline', 'car'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 min-h-[44px] rounded-[4px] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#3E362E] text-white'
                    : 'bg-[#AC8968]/10 text-[#3E362E] border border-[#AC8968] hover:bg-[#AC8968]/20'
                }`}
              >
                {cat === 'hotel' ? 'Hotels & Stays' : cat === 'airline' ? 'Airlines' : 'Chauffeur Cars'}
              </button>
            ))}
          </div>
        </div>

        {/* Guardrails in Force */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="p-4 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#3E362E]/80 font-semibold mb-1">
              Max Uplift Cap
            </div>
            <div className="font-display text-2xl font-bold text-[#93785B] tabular-nums">
              {currentDomain.constraints.max_uplift_percent !== null
                ? `+${currentDomain.constraints.max_uplift_percent}% above base`
                : 'Uncapped'}
            </div>
            <div className="text-xs text-[#3E362E] mt-1">
              Hard ceiling on rule increases
            </div>
          </div>

          <div className="p-4 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#3E362E]/80 font-semibold mb-1">
              Max Discount Floor
            </div>
            <div className="font-display text-2xl font-bold text-[#93785B] tabular-nums">
              {currentDomain.constraints.max_discount_percent !== null
                ? `−${currentDomain.constraints.max_discount_percent}% below base`
                : 'No % floor'}
            </div>
            <div className="text-xs text-[#3E362E] mt-1">
              Maximum combined discount
            </div>
          </div>

          <div className="p-4 rounded-[4px] bg-white border border-[#A69080]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#3E362E]/80 font-semibold mb-1">
              Minimum Floor Price
            </div>
            <div className="font-display text-2xl font-bold text-[#3E362E] tabular-nums">
              {currentDomain.constraints.min_price !== null
                ? formatINR(currentDomain.constraints.min_price)
                : '—'}
            </div>
            <div className="text-xs text-[#3E362E] mt-1">
              Absolute minimum unit price
            </div>
          </div>

          <div className="p-4 rounded-[4px] bg-white border border-[#A69080]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#3E362E]/80 font-semibold mb-1">
              Maximum Ceiling Price
            </div>
            <div className="font-display text-2xl font-bold text-[#3E362E] tabular-nums">
              {currentDomain.constraints.max_price !== null
                ? formatINR(currentDomain.constraints.max_price)
                : '—'}
            </div>
            <div className="text-xs text-[#3E362E] mt-1">
              Absolute maximum unit price
            </div>
          </div>

          <div className="p-4 rounded-[4px] bg-white border border-[#A69080]">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#3E362E]/80 font-semibold mb-1">
              Rounding Rule
            </div>
            <div className="font-display text-2xl font-bold text-[#3E362E] tabular-nums">
              Nearest ₹{currentDomain.strategy?.roundTo || 1}
            </div>
            <div className="text-xs text-[#3E362E] mt-1">
              Half-Up (never exceeds cap)
            </div>
          </div>
        </div>

        {/* Active Rules Table */}
        <div className="border border-[#A69080] rounded-[4px] bg-white overflow-hidden mb-8">
          <div className="px-5 py-3.5 bg-[#AC8968]/10 border-b border-[#A69080] flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-[0.14em] font-semibold text-[#3E362E]">
              Active Pricing Factors ({currentDomain.name})
            </h3>
            <span className="text-xs text-[#3E362E] font-medium">
              Stacking Strategy: {currentDomain.strategy?.stacking || 'sequential'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm" aria-label={`Active rules for ${currentDomain.name}`}>
              <thead>
                <tr className="border-b border-[#A69080]/50 text-[11px] uppercase tracking-[0.12em] text-[#3E362E]">
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Rule ID & Name</th>
                  <th className="py-3 px-4 font-semibold">Trigger Condition / Effective Window</th>
                  <th className="py-3 px-4 font-semibold text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/30">
                {currentDomain.active_rules.map((r: any, idx: number) => (
                  <tr key={r.id} className={idx % 2 === 1 ? 'bg-[#AC8968]/10' : 'bg-white'}>
                    <td className="py-3 px-4 font-semibold tabular-nums">#{r.priority}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#3E362E]">{r.name}</div>
                      <div className="text-xs text-[#3E362E]/75 tabular-nums">{r.id}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#3E362E]">
                      {r.conditions && r.conditions.length > 0 ? (
                        <span>
                          {r.conditions
                            .map(
                              (c: any) =>
                                `${c.attribute} ${c.operator} ${Array.isArray(c.value) ? c.value.join(' or ') : c.value}`
                            )
                            .join(` ${r.conditionLogic} `)}
                        </span>
                      ) : (
                        <span>Effective-dated seasonal rule</span>
                      )}
                      {(r.effective_from || r.effective_to) && (
                        <div className="mt-1 inline-block px-2 py-0.5 rounded-[3px] bg-[#AC8968]/15 border border-[#AC8968] text-[11px] font-semibold">
                          Window: {r.effective_from || '*'} to {r.effective_to || '*'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatActionSummary(r.action)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cancellation Policy Rules & Loyalty Tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[#A69080] rounded-[4px] bg-white overflow-hidden">
            <div className="px-5 py-3 bg-[#AC8968]/10 border-b border-[#A69080]">
              <h3 className="text-xs uppercase tracking-[0.14em] font-semibold text-[#3E362E]">
                Cancellation Fee Rules ({currentDomain.name})
              </h3>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#3E362E] mb-3">
                Cancellation refunds run through the exact same pricing engine using the amount paid as the base attribute:
              </p>
              <table className="w-full text-left border-collapse text-xs" aria-label="Cancellation fee rules">
                <thead>
                  <tr className="border-b border-[#A69080]/40 uppercase text-[#3E362E]">
                    <th className="py-2 pr-2 font-semibold">Rule</th>
                    <th className="py-2 pl-2 font-semibold text-right">Fee Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A69080]/30">
                  {(currentDomain.cancellation_rules || []).map((cr: any) => (
                    <tr key={cr.id}>
                      <td className="py-2 pr-2 text-[#3E362E]">{cr.name}</td>
                      <td className="py-2 pl-2 text-right font-semibold tabular-nums">
                        {formatActionSummary(cr.action)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-[#A69080] rounded-[4px] bg-white overflow-hidden">
            <div className="px-5 py-3 bg-[#AC8968]/10 border-b border-[#A69080]">
              <h3 className="text-xs uppercase tracking-[0.14em] font-semibold text-[#3E362E]">
                Confirmed Booking Loyalty Tiers
              </h3>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#3E362E] mb-3">
                Your loyalty tier is automatically derived from your confirmed bookings and applied as its own breakdown step:
              </p>
              <table className="w-full text-left border-collapse text-xs" aria-label="Loyalty tier thresholds">
                <thead>
                  <tr className="border-b border-[#A69080]/40 uppercase text-[#3E362E]">
                    <th className="py-2 font-semibold">Tier</th>
                    <th className="py-2 font-semibold">Confirmed Bookings</th>
                    <th className="py-2 font-semibold text-right">Automatic Concession</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A69080]/30">
                  {(data.loyalty_tiers || []).map((lt: any) => (
                    <tr key={lt.tier}>
                      <td className="py-2 font-semibold text-[#3E362E]">{lt.tier}</td>
                      <td className="py-2 tabular-nums">≥ {lt.min_bookings} confirmed</td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {lt.discount_percent > 0 ? `▼ −${lt.discount_percent}% (Discount)` : 'Standard Base (0%)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Audit ID Inspector */}
      <section aria-labelledby="audit-lookup-heading" className="border-t border-[#A69080] pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] font-semibold text-[#865D36] mb-2">
              <FileText className="w-4 h-4" />
              <span>Verifiable Audit Trail</span>
            </div>
            <h2 id="audit-lookup-heading" className="font-display text-2xl font-semibold text-[#3E362E] mb-3">
              Verify Any Price Audit ID
            </h2>
            <p className="text-sm text-[#3E362E] mb-4 leading-relaxed">
              Every quote and confirmed booking displays an Audit ID (for example, <code>AUD-2026-8841</code>).
              Enter any Audit ID below to inspect the exact inputs, rules evaluated, and step-by-step arithmetic.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inspectAuditById(auditQuery);
              }}
              className="flex gap-2 mb-4"
            >
              <label htmlFor="audit-id-input" className="sr-only">
                Audit ID
              </label>
              <input
                id="audit-id-input"
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="e.g. AUD-2026-8841"
                className="flex-1 px-3.5 py-2.5 min-h-[44px] border border-[#A69080] rounded-[4px] bg-white text-sm text-[#3E362E]"
              />
              <button
                type="submit"
                disabled={auditLoading}
                className="px-5 py-2.5 min-h-[44px] bg-[#865D36] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#3E362E] transition-colors cursor-pointer"
              >
                {auditLoading ? 'Checking...' : 'Inspect'}
              </button>
            </form>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#3E362E]">Recent Live Audit IDs:</div>
              <div className="flex flex-wrap gap-2">
                {(data.recent_audits || []).map((a: any) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAuditQuery(a.id);
                      inspectAuditById(a.id);
                    }}
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-medium border cursor-pointer ${
                      inspectedAudit?.id === a.id
                        ? 'bg-[#3E362E] text-white border-[#3E362E]'
                        : 'bg-[#AC8968]/10 text-[#3E362E] border-[#AC8968] hover:bg-[#AC8968]/20'
                    }`}
                  >
                    {a.id} ({a.category})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {auditError && (
              <div className="p-4 rounded-[4px] border border-[#865D36] bg-[#AC8968]/10 text-sm text-[#3E362E]">
                {auditError}
              </div>
            )}
            {inspectedAudit && (
              <div className="space-y-4">
                <div className="p-4 rounded-[4px] bg-[#AC8968]/10 border border-[#AC8968] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold uppercase">Audit Record:</span> {inspectedAudit.id} · Category:{' '}
                    <strong className="uppercase">{inspectedAudit.category}</strong>
                  </div>
                  <div className="tabular-nums">
                    Inputs: <code>{JSON.stringify(inspectedAudit.context)}</code>
                  </div>
                </div>
                <BreakdownTable
                  breakdown={inspectedAudit.breakdown || []}
                  finalPrice={inspectedAudit.final_price}
                  configVersion={inspectedAudit.config_version}
                  auditId={inspectedAudit.id}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
