import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../config/images';
import { formatINR } from '../lib/format';
import { ArrowUpRight, ArrowDownRight, AlertCircle, Clock } from 'lucide-react';

export const ImageWithFallback: React.FC<{
  imageKey?: string;
  src?: string;
  alt: string;
  className?: string;
  overlayGradient?: boolean;
}> = ({ imageKey, src, alt, className = '', overlayGradient = false }) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = src || (imageKey ? getImageUrl(imageKey) : getImageUrl('hero_hotel'));

  return (
    <div className={`relative overflow-hidden bg-[#E6DCD2] ${className}`}>
      {!failed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover transition-transform duration-300"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, #3E362E 0%, #865D36 55%, #AC8968 100%)',
          }}
        >
          <span className="text-xs uppercase tracking-[0.2em] text-[#FAF8F6]/70 mb-1">
            MONETIZE360 TRAVEL
          </span>
          <span className="font-display text-lg text-[#FAF8F6] uppercase tracking-wider">
            {alt}
          </span>
        </div>
      )}
      {overlayGradient && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, rgba(62,54,46,0.38), rgba(62,54,46,0.08))',
          }}
        />
      )}
    </div>
  );
};

export const PriceChip: React.FC<{
  direction: 'up' | 'down' | 'neutral';
  effect: string;
  label?: string;
}> = ({ direction, effect, label }) => {
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3E362E] tabular-nums whitespace-nowrap shrink-0">
        <ArrowUpRight className="w-3.5 h-3.5 text-[#865D36] shrink-0" />
        <span>▲ {effect} (Increase)</span>
        {label && <span className="text-[#3E362E]/75 font-normal">· {label}</span>}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#865D36] tabular-nums whitespace-nowrap shrink-0">
        <ArrowDownRight className="w-3.5 h-3.5 text-[#865D36] shrink-0" />
        <span>▼ {effect} (Discount)</span>
        {label && <span className="text-[#3E362E]/75 font-normal">· {label}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#865D36] tabular-nums whitespace-nowrap shrink-0">
      <span>{effect}</span>
      {label && <span className="text-[#3E362E]/75 font-normal">· {label}</span>}
    </span>
  );
};

export const PriceCapBadge: React.FC<{
  capDetails?: {
    which_cap?: string;
    cap_percent?: number;
    unconstrained_price?: number;
    capped_price?: number;
    tooltip?: string;
  } | null;
  breakdown?: BreakdownRow[];
}> = ({ capDetails, breakdown = [] }) => {
  const [showTip, setShowTip] = useState(false);

  const constraintStep = breakdown.find(
    (b) =>
      b.type === 'constraint' ||
      b.step.toLowerCase().includes('cap applied') ||
      b.step.toLowerCase().includes('floor applied') ||
      b.step.toLowerCase().includes('minimum floor') ||
      b.step.toLowerCase().includes('maximum ceiling')
  );

  if (!capDetails && !constraintStep) return null;

  const tooltipText =
    capDetails?.tooltip ||
    constraintStep?.message ||
    (constraintStep?.before !== undefined
      ? `Without the cap this would have been ₹${Math.round(constraintStep.before).toLocaleString('en-IN')}. Guardrail price protection applied.`
      : 'Guardrail price protection cap applied.');

  const isFloor =
    capDetails?.which_cap === 'max_discount_percent' ||
    capDetails?.which_cap === 'min_price' ||
    constraintStep?.which_cap === 'max_discount_percent' ||
    constraintStep?.which_cap === 'min_price';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        onClick={() => setShowTip((prev) => !prev)}
        aria-label={tooltipText}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#AC8968]/15 border border-[#865D36] text-[#3E362E] text-[11px] font-semibold tracking-wide cursor-pointer"
      >
        <span>{isFloor ? '▼ Discount floor applied' : '▼ Price cap applied'}</span>
        <span className="text-[#865D36] underline decoration-dotted">Why?</span>
      </button>
      {showTip && (
        <div
          role="tooltip"
          className="absolute z-40 bottom-full left-0 mb-2 w-72 p-3 rounded-[4px] bg-[#3E362E] text-white text-xs leading-relaxed shadow-lg border border-[#AC8968]"
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
};

export const LoyaltyTierBadge: React.FC<{
  tier: string;
  discountPercent?: number;
  confirmedBookings?: number;
}> = ({ tier, discountPercent = 0, confirmedBookings }) => {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#AC8968]/15 border border-[#AC8968] text-[#3E362E] text-xs font-semibold"
      aria-label={`Loyalty tier ${tier}${discountPercent > 0 ? ` with ${discountPercent}% discount` : ''}`}
    >
      <span className="w-2 h-2 rounded-full bg-[#865D36]" aria-hidden="true" />
      <span>{tier} Tier</span>
      {discountPercent > 0 && <span className="text-[#865D36]">(−{discountPercent}%)</span>}
      {confirmedBookings !== undefined && (
        <span className="text-[#3E362E]/70 font-normal">· {confirmedBookings} stays/trips</span>
      )}
    </span>
  );
};

export interface BreakdownRow {
  step: string;
  type?: 'base' | 'rule' | 'constraint' | 'rounding';
  rule_id?: string;
  which_cap?: string;
  before?: number;
  after?: number;
  message?: string;
  effect: string;
  direction?: 'up' | 'down' | 'neutral';
  running: number;
}

export const BreakdownTable: React.FC<{
  breakdown: BreakdownRow[];
  finalPrice: number;
  configVersion?: number;
  auditId?: string;
  compact?: boolean;
  capApplied?: boolean;
  capDetails?: any;
  finalLabel?: string;
  onNavigate?: (url: string) => void;
  onNavigateHowWePrice?: () => void;
}> = ({
  breakdown,
  finalPrice,
  configVersion,
  auditId,
  compact = false,
  capDetails,
  finalLabel = 'Final Unit Fare (Server Verified)',
  onNavigate,
  onNavigateHowWePrice,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAudit = () => {
    if (!auditId) return;
    navigator.clipboard?.writeText(auditId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleHowWePriceClick = (e: React.MouseEvent) => {
    if (onNavigateHowWePrice) {
      e.preventDefault();
      onNavigateHowWePrice();
      return;
    }
    if (onNavigate) {
      e.preventDefault();
      onNavigate('/how-we-price');
      return;
    }
    e.preventDefault();
    window.history.pushState({}, '', '/how-we-price');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="border border-[#A69080] rounded-[4px] bg-white overflow-hidden text-sm">
      <div className="px-3.5 py-2.5 bg-[#AC8968]/10 border-b border-[#A69080] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#3E362E]">
            Deterministic Engine Calculation
          </span>
          <PriceCapBadge capDetails={capDetails} breakdown={breakdown} />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#3E362E] tabular-nums">
          {configVersion !== undefined && <span>Config v{configVersion}</span>}
          {auditId && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleCopyAudit}
                className="text-[#865D36] hover:underline font-semibold cursor-pointer whitespace-nowrap"
                title="Copy Audit ID"
              >
                {copied ? 'Copied ID' : `Audit: ${auditId}`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" aria-label="Price calculation breakdown">
          <thead>
            <tr className="border-b border-[#A69080]/50 text-[11px] uppercase tracking-[0.12em] text-[#3E362E]">
              <th className="py-2 px-3.5 font-semibold">Step / Rule Fired</th>
              <th className="py-2 px-3.5 font-semibold text-right">Adjustment</th>
              <th className="py-2 px-3.5 font-semibold text-right">Running Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#A69080]/30">
            {breakdown.map((row, idx) => {
              const isUp = row.direction === 'up' || row.effect.startsWith('+') || row.effect.startsWith('×1.');
              const isDown = row.direction === 'down' || row.effect.startsWith('−') || row.effect.startsWith('-');
              const isConstraint =
                row.type === 'constraint' ||
                row.step.toLowerCase().includes('cap applied') ||
                row.step.toLowerCase().includes('floor applied');
              return (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-[#AC8968]/10' : 'bg-white'}>
                  <td className="py-2 px-3.5 text-[#3E362E]">
                    <div className={isConstraint ? 'font-semibold text-[#3E362E]' : 'font-normal'}>
                      {row.step}
                    </div>
                    {!compact && row.rule_id && (
                      <div className="text-[11px] text-[#3E362E]/75 tabular-nums">Rule ID: {row.rule_id}</div>
                    )}
                    {row.message && (
                      <div className="text-xs text-[#3E362E] mt-1 bg-[#AC8968]/10 p-1.5 rounded-[3px] border border-[#AC8968]">
                        {row.message}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3.5 text-right font-semibold tabular-nums whitespace-nowrap text-[#3E362E]">
                    {isUp && !row.effect.startsWith('▲')
                      ? `▲ ${row.effect} (Increase)`
                      : isDown && !row.effect.startsWith('▼')
                      ? `▼ ${row.effect} (Discount)`
                      : row.effect}
                  </td>
                  <td className="py-2 px-3.5 text-right font-semibold text-[#3E362E] tabular-nums whitespace-nowrap">
                    {formatINR(row.running, true)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#AC8968]/15 font-semibold text-[#3E362E] border-t border-[#A69080]">
              <td className="py-2.5 px-3.5" colSpan={2}>
                {finalLabel}
              </td>
              <td className="py-2.5 px-3.5 text-right tabular-nums text-base">
                {formatINR(finalPrice)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-3.5 py-2 bg-[#AC8968]/10 border-t border-[#A69080]/50 flex items-center justify-between text-xs text-[#3E362E]">
        <span>Every price is deterministically computed & audit-logged.</span>
        <a
          href="/how-we-price"
          onClick={handleHowWePriceClick}
          className="text-[#865D36] font-semibold hover:underline whitespace-nowrap"
        >
          How we price →
        </a>
      </div>
    </div>
  );
};

export const PriceCountdown: React.FC<{
  expiresAt: string;
  onExpire?: () => void;
}> = ({ expiresAt, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const firedRef = React.useRef<boolean>(false);

  useEffect(() => {
    firedRef.current = false;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0 && !firedRef.current && onExpire) {
        firedRef.current = true;
        onExpire();
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#3E362E]/75 tabular-nums whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-[#865D36] shrink-0" />
      <span>Price valid for {mins}:{secs}</span>
    </span>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}> = ({ open, title, description, confirmLabel = 'Confirm', onConfirm, onCancel, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E362E]/60 p-4">
      <div className="bg-[#FAF8F6] border border-[#A69080] rounded-[4px] max-w-md w-full p-6 shadow-lg">
        <h3 className="font-display text-2xl font-semibold text-[#3E362E] mb-2">{title}</h3>
        <p className="text-sm text-[#3E362E]/80 mb-6 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 min-h-[44px] border border-[#3E362E] text-[#3E362E] text-sm font-medium rounded-[4px] hover:bg-[#E6DCD2] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 min-h-[44px] bg-[#3E362E] text-[#FAF8F6] text-sm font-medium rounded-[4px] hover:bg-[#865D36] transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div className="border border-[#9B2C2C]/40 bg-[#FAF8F6] rounded-[4px] p-6 text-center max-w-lg mx-auto my-6">
    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#9B2C2C]/10 text-[#9B2C2C] mb-3">
      <AlertCircle className="w-5 h-5" />
    </div>
    <h3 className="font-display text-xl font-semibold text-[#3E362E] mb-1">Unable to complete request</h3>
    <p className="text-sm text-[#9B2C2C] mb-4">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 min-h-[44px] bg-[#3E362E] text-[#FAF8F6] text-sm font-medium rounded-[4px] hover:bg-[#865D36] transition-colors cursor-pointer"
      >
        Retry Request
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, actionLabel, onAction }) => (
  <div className="border border-[#A69080]/40 bg-[#FAF8F6] rounded-[4px] p-8 text-center max-w-lg mx-auto my-6">
    <h3 className="font-display text-2xl font-semibold text-[#3E362E] mb-2">{title}</h3>
    <p className="text-sm text-[#3E362E]/75 mb-5 leading-relaxed">{subtitle}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="px-5 py-2.5 min-h-[44px] bg-[#3E362E] text-[#FAF8F6] text-sm font-medium rounded-[4px] hover:bg-[#865D36] transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
