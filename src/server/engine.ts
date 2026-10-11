/**
 * MONETIZE360 UNIVERSAL DYNAMIC PRICING ENGINE
 * Pure domain-agnostic pricing library. Zero domain-specific vocabulary in engine logic.
 * Uses exact ROUND_HALF_UP arithmetic to avoid banker's rounding traps.
 */

export interface DomainAttribute {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'enum';
  source: 'request' | 'signal' | 'derived';
  options?: string[];
  default?: string | number | boolean;
}

export interface RuleCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: string | number | boolean | (string | number)[];
}

export interface PricingRule {
  id: string;
  name: string;
  priority: number;
  conditionLogic: 'AND' | 'OR';
  conditions: RuleCondition[];
  effective_from?: string;
  effective_to?: string;
  action: {
    type: 'percent' | 'flat' | 'multiplier' | 'set';
    value: number;
    value_from?: string;
    label_from?: string;
  };
  exclusiveGroup?: string;
  stopProcessing?: boolean;
}

export interface ProductDef {
  id: string;
  name: string;
  baseType: 'fixed' | 'formula' | 'attribute';
  baseValue: number;
  formulaAttr?: string;
  formulaRate?: number;
}

export interface GuardrailConstraints {
  min_price?: number;
  max_price?: number;
  max_uplift_percent?: number;
  max_discount_percent?: number;
  minPrice?: number;
  maxPrice?: number;
  maxDiscountPercent?: number;
}

export interface DomainConfigSchema {
  domainSlug: string;
  name: string;
  currency: string;
  products: ProductDef[];
  attributes: DomainAttribute[];
  strategy: {
    stacking: 'sequential' | 'on_base' | 'best_for_customer' | 'best_for_business';
    roundTo: number;
  };
  rules: PricingRule[];
  constraints: GuardrailConstraints;
}

export interface BreakdownStep {
  step: string;
  type?: 'base' | 'rule' | 'constraint' | 'rounding';
  rule_id?: string;
  which_cap?: string;
  before?: number;
  after?: number;
  message?: string;
  effect: string;
  direction: 'up' | 'down' | 'neutral';
  running: number;
}

export interface CapDetails {
  which_cap: string;
  cap_percent?: number;
  unconstrained_price: number;
  capped_price: number;
  tooltip: string;
}

export interface EngineResult {
  base_price: number;
  final_price: number;
  unconstrained_price: number;
  cap_applied: boolean;
  cap_details: CapDetails | null;
  breakdown: BreakdownStep[];
  constraints_applied: string[];
  headline_adjustment: {
    label: string;
    effect: string;
    direction: 'up' | 'down' | 'neutral';
  };
  rules_evaluated: {
    id: string;
    name: string;
    fired: boolean;
    reason: string;
    effect_str: string;
    counterfactual_price?: number;
  }[];
}

/**
 * Exact half-up rounding: 212.5 -> 213, 2.5 -> 3
 */
export function roundHalfUp(value: number, step: number = 1): number {
  if (step <= 0) return Math.floor(value + 0.5);
  const scaled = value / step;
  const roundedScaled = Math.floor(scaled + 0.5 + 1e-9);
  return roundedScaled * step;
}

export function roundDecimal2(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100;
}

function isWithinEffectiveDates(rule: PricingRule, context: Record<string, any>): { ok: boolean; reason?: string } {
  if (!rule.effective_from && !rule.effective_to) return { ok: true };
  const rawDate = context.target_date || context.effective_date || context.date;
  if (!rawDate) {
    return { ok: false, reason: `No target date in context for window ${rule.effective_from || '*'}..${rule.effective_to || '*'}` };
  }
  const dateStr = String(rawDate).slice(0, 10);
  if (rule.effective_from && dateStr < rule.effective_from) {
    return { ok: false, reason: `Date ${dateStr} is before effective_from ${rule.effective_from}` };
  }
  if (rule.effective_to && dateStr > rule.effective_to) {
    return { ok: false, reason: `Date ${dateStr} is after effective_to ${rule.effective_to}` };
  }
  return { ok: true };
}

function evaluateCondition(cond: RuleCondition, context: Record<string, any>): boolean {
  const actual = context[cond.attribute];
  if (actual === undefined || actual === null) return false;

  switch (cond.operator) {
    case 'eq':
      return String(actual).toLowerCase() === String(cond.value).toLowerCase();
    case 'neq':
      return String(actual).toLowerCase() !== String(cond.value).toLowerCase();
    case 'gt':
      return Number(actual) > Number(cond.value);
    case 'gte':
      return Number(actual) >= Number(cond.value);
    case 'lt':
      return Number(actual) < Number(cond.value);
    case 'lte':
      return Number(actual) <= Number(cond.value);
    case 'in':
      if (Array.isArray(cond.value)) {
        return cond.value.map((v) => String(v).toLowerCase()).includes(String(actual).toLowerCase());
      }
      return String(cond.value)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .includes(String(actual).toLowerCase());
    default:
      return false;
  }
}

function evaluateRule(rule: PricingRule, context: Record<string, any>): { fired: boolean; reason: string } {
  const dateCheck = isWithinEffectiveDates(rule, context);
  if (!dateCheck.ok) {
    return { fired: false, reason: dateCheck.reason || 'Outside effective date window' };
  }

  if (rule.action.value_from) {
    const dynVal = Number(context[rule.action.value_from]);
    if (isNaN(dynVal) || dynVal === 0) {
      return { fired: false, reason: `Context attribute ${rule.action.value_from} is 0 or absent` };
    }
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    return { fired: true, reason: 'Unconditional rule' };
  }
  const results = rule.conditions.map((c) => {
    const ok = evaluateCondition(c, context);
    const actualVal = context[c.attribute];
    return {
      ok,
      desc: `${c.attribute} (${actualVal ?? 'none'}) ${c.operator} ${Array.isArray(c.value) ? c.value.join('|') : c.value}`,
    };
  });

  if (rule.conditionLogic === 'OR') {
    const fired = results.some((r) => r.ok);
    return {
      fired,
      reason: fired
        ? `Matched OR: ${results.filter((r) => r.ok).map((r) => r.desc).join(' OR ')}`
        : `Failed all OR conditions: ${results.map((r) => r.desc).join('; ')}`,
    };
  } else {
    const fired = results.every((r) => r.ok);
    return {
      fired,
      reason: fired
        ? `Matched all: ${results.map((r) => r.desc).join(' AND ')}`
        : `Condition not met: ${results.filter((r) => !r.ok).map((r) => r.desc).join(', ')}`,
    };
  }
}

function resolveActionValue(action: PricingRule['action'], context: Record<string, any>): number {
  if (action.value_from && context[action.value_from] !== undefined && context[action.value_from] !== null) {
    const parsed = Number(context[action.value_from]);
    if (!isNaN(parsed)) return parsed;
  }
  return action.value;
}

function resolveStepLabel(rule: PricingRule, context: Record<string, any>): string {
  if (rule.action.label_from && context[rule.action.label_from]) {
    return String(context[rule.action.label_from]);
  }
  return rule.name;
}

function applyAction(
  current: number,
  base: number,
  action: PricingRule['action'],
  stacking: string,
  context: Record<string, any>
): { next: number; effect: string; direction: 'up' | 'down' | 'neutral' } {
  const ref = stacking === 'on_base' ? base : current;
  const val = resolveActionValue(action, context);

  if (action.type === 'percent') {
    const delta = (ref * val) / 100;
    const next = current + delta;
    const sign = val >= 0 ? '+' : '−';
    return {
      next: roundDecimal2(next),
      effect: `${sign}${Math.abs(val)}%`,
      direction: val > 0 ? 'up' : val < 0 ? 'down' : 'neutral',
    };
  }
  if (action.type === 'multiplier') {
    const next = current * val;
    return {
      next: roundDecimal2(next),
      effect: `×${val}`,
      direction: val > 1 ? 'up' : val < 1 ? 'down' : 'neutral',
    };
  }
  if (action.type === 'flat') {
    const next = current + val;
    const sign = val >= 0 ? '+₹' : '−₹';
    return {
      next: roundDecimal2(next),
      effect: `${sign}${Math.abs(val)}`,
      direction: val > 0 ? 'up' : val < 0 ? 'down' : 'neutral',
    };
  }
  if (action.type === 'set') {
    return {
      next: roundDecimal2(val),
      effect: `Set ₹${val}`,
      direction: val > current ? 'up' : val < current ? 'down' : 'neutral',
    };
  }
  return { next: current, effect: '0%', direction: 'neutral' };
}

function resolveConstraints(c: GuardrailConstraints = {}) {
  const minPrice = c.min_price !== undefined ? c.min_price : c.minPrice;
  const maxPrice = c.max_price !== undefined ? c.max_price : c.maxPrice;
  const maxUpliftPercent = c.max_uplift_percent;
  const maxDiscountPercent =
    c.max_discount_percent !== undefined ? c.max_discount_percent : c.maxDiscountPercent;
  return {
    min_price: minPrice,
    max_price: maxPrice,
    max_uplift_percent: maxUpliftPercent,
    max_discount_percent: maxDiscountPercent,
  };
}

export function roundWithinBounds(
  value: number,
  step: number,
  effectiveMin: number,
  effectiveMax: number
): number {
  const s = step > 0 ? step : 1;
  let rounded = roundHalfUp(value, s);
  if (rounded > effectiveMax) {
    const steppedDown = Math.floor((effectiveMax + 1e-9) / s) * s;
    rounded = steppedDown >= effectiveMin ? steppedDown : roundDecimal2(effectiveMax);
  }
  if (rounded < effectiveMin) {
    const steppedUp = Math.ceil((effectiveMin - 1e-9) / s) * s;
    rounded = steppedUp <= effectiveMax ? steppedUp : roundDecimal2(effectiveMin);
  }
  return rounded;
}

export function executePricingEngine(
  config: DomainConfigSchema,
  context: Record<string, any>,
  productId?: string
): EngineResult {
  const product =
    config.products.find((p) => p.id === productId) ||
    config.products[0] || {
      id: 'default',
      name: 'Standard',
      baseType: 'fixed' as const,
      baseValue: 1000,
    };

  let basePrice = product.baseValue;
  let baseStepLabel = `Base fare (${product.name})`;
  if (product.baseType === 'formula' && product.formulaAttr && product.formulaRate !== undefined) {
    const attrVal = Number(context[product.formulaAttr] ?? 0);
    basePrice = roundDecimal2(product.baseValue + product.formulaRate * attrVal);
    baseStepLabel = `Base formula (${product.baseValue} + ${product.formulaRate} × ${attrVal})`;
  } else if (product.baseType === 'attribute') {
    const attrName = product.formulaAttr || 'base_amount';
    const rawAttr = context[attrName];
    basePrice = roundDecimal2(rawAttr !== undefined ? Number(rawAttr) : product.baseValue);
    baseStepLabel = `Base amount (${product.name})`;
  }

  const breakdown: BreakdownStep[] = [
    {
      step: baseStepLabel,
      type: 'base',
      effect: 'Base',
      direction: 'neutral',
      running: basePrice,
    },
  ];

  const sortedRules = [...config.rules].sort((a, b) => a.priority - b.priority);
  const usedExclusiveGroups = new Set<string>();
  let running = basePrice;
  let stopped = false;

  const rulesEvaluated: EngineResult['rules_evaluated'] = [];
  let dominantRule: { label: string; effect: string; direction: 'up' | 'down' | 'neutral'; absDelta: number } | null = null;

  for (const rule of sortedRules) {
    if (stopped) {
      rulesEvaluated.push({
        id: rule.id,
        name: rule.name,
        fired: false,
        reason: 'Skipped due to prior stopProcessing rule',
        effect_str: '—',
      });
      continue;
    }

    if (rule.exclusiveGroup && usedExclusiveGroups.has(rule.exclusiveGroup)) {
      rulesEvaluated.push({
        id: rule.id,
        name: rule.name,
        fired: false,
        reason: `Superseded by higher-priority rule in group "${rule.exclusiveGroup}"`,
        effect_str: '—',
      });
      continue;
    }

    const evalRes = evaluateRule(rule, context);
    if (!evalRes.fired) {
      rulesEvaluated.push({
        id: rule.id,
        name: rule.name,
        fired: false,
        reason: evalRes.reason,
        effect_str: '—',
      });
      continue;
    }

    const before = running;
    const applied = applyAction(running, basePrice, rule.action, config.strategy.stacking, context);
    running = applied.next;

    if (rule.exclusiveGroup) {
      usedExclusiveGroups.add(rule.exclusiveGroup);
    }
    if (rule.stopProcessing) {
      stopped = true;
    }

    const stepLabel = resolveStepLabel(rule, context);
    const absDelta = Math.abs(running - before);
    if (!dominantRule || absDelta >= dominantRule.absDelta) {
      dominantRule = {
        label: stepLabel,
        effect: applied.effect,
        direction: applied.direction,
        absDelta,
      };
    }

    breakdown.push({
      step: stepLabel,
      type: 'rule',
      rule_id: rule.id,
      before,
      after: running,
      effect: applied.effect,
      direction: applied.direction,
      running,
    });

    rulesEvaluated.push({
      id: rule.id,
      name: stepLabel,
      fired: true,
      reason: evalRes.reason,
      effect_str: applied.effect,
    });
  }

  const roundStep = config.strategy.roundTo || 1;
  const unconstrainedRounded = roundHalfUp(running, roundStep);

  const bounds = resolveConstraints(config.constraints);
  const constraintsApplied: string[] = [];
  let capApplied = false;
  let capDetails: CapDetails | null = null;

  let effectiveMin = -Infinity;
  let effectiveMax = Infinity;

  if (bounds.max_uplift_percent !== undefined && bounds.max_uplift_percent >= 0) {
    const maxUpliftVal = roundDecimal2(basePrice * (1 + bounds.max_uplift_percent / 100));
    effectiveMax = Math.min(effectiveMax, maxUpliftVal);
    if (running > maxUpliftVal) {
      const beforeCap = running;
      running = maxUpliftVal;
      capApplied = true;
      const plainMsg = `Without the cap this would have been ₹${unconstrainedRounded.toLocaleString('en-IN')}. We limit increases to ${bounds.max_uplift_percent}% above the standard price.`;
      capDetails = {
        which_cap: 'max_uplift_percent',
        cap_percent: bounds.max_uplift_percent,
        unconstrained_price: unconstrainedRounded,
        capped_price: maxUpliftVal,
        tooltip: plainMsg,
      };
      const stepTitle = `Price cap applied (max +${bounds.max_uplift_percent}% uplift above base)`;
      constraintsApplied.push(stepTitle);
      breakdown.push({
        step: stepTitle,
        type: 'constraint',
        which_cap: 'max_uplift_percent',
        before: beforeCap,
        after: running,
        message: plainMsg,
        effect: `Cap ₹${running}`,
        direction: 'down',
        running,
      });
    }
  }

  if (bounds.max_discount_percent !== undefined && bounds.max_discount_percent >= 0) {
    const minDiscountFloor = roundDecimal2(basePrice * (1 - bounds.max_discount_percent / 100));
    effectiveMin = Math.max(effectiveMin, minDiscountFloor);
    if (running < minDiscountFloor) {
      const beforeCap = running;
      running = minDiscountFloor;
      capApplied = true;
      const plainMsg = `Without the floor this would have been ₹${unconstrainedRounded.toLocaleString('en-IN')}. Maximum total discount is capped at ${bounds.max_discount_percent}% below the standard price.`;
      if (!capDetails) {
        capDetails = {
          which_cap: 'max_discount_percent',
          cap_percent: bounds.max_discount_percent,
          unconstrained_price: unconstrainedRounded,
          capped_price: minDiscountFloor,
          tooltip: plainMsg,
        };
      }
      const stepTitle = `Discount floor applied (max −${bounds.max_discount_percent}% below base)`;
      constraintsApplied.push(stepTitle);
      breakdown.push({
        step: stepTitle,
        type: 'constraint',
        which_cap: 'max_discount_percent',
        before: beforeCap,
        after: running,
        message: plainMsg,
        effect: `Floor ₹${running}`,
        direction: 'up',
        running,
      });
    }
  }

  if (bounds.min_price !== undefined) {
    effectiveMin = Math.max(effectiveMin, bounds.min_price);
    if (running < bounds.min_price) {
      const beforeCap = running;
      running = bounds.min_price;
      capApplied = true;
      const plainMsg = `Minimum price guardrail of ₹${bounds.min_price.toLocaleString('en-IN')} applied (was ₹${beforeCap.toLocaleString('en-IN')}).`;
      if (!capDetails) {
        capDetails = {
          which_cap: 'min_price',
          unconstrained_price: unconstrainedRounded,
          capped_price: bounds.min_price,
          tooltip: plainMsg,
        };
      }
      const stepTitle = `Minimum floor (₹${bounds.min_price})`;
      constraintsApplied.push(stepTitle);
      breakdown.push({
        step: stepTitle,
        type: 'constraint',
        which_cap: 'min_price',
        before: beforeCap,
        after: running,
        message: plainMsg,
        effect: `Floor ₹${running}`,
        direction: 'up',
        running,
      });
    }
  }

  if (bounds.max_price !== undefined) {
    effectiveMax = Math.min(effectiveMax, bounds.max_price);
    if (running > bounds.max_price) {
      const beforeCap = running;
      running = bounds.max_price;
      capApplied = true;
      const plainMsg = `Without the cap this would have been ₹${unconstrainedRounded.toLocaleString('en-IN')}. Maximum price ceiling of ₹${bounds.max_price.toLocaleString('en-IN')} applied.`;
      if (!capDetails) {
        capDetails = {
          which_cap: 'max_price',
          unconstrained_price: unconstrainedRounded,
          capped_price: bounds.max_price,
          tooltip: plainMsg,
        };
      }
      const stepTitle = `Maximum ceiling (₹${bounds.max_price})`;
      constraintsApplied.push(stepTitle);
      breakdown.push({
        step: stepTitle,
        type: 'constraint',
        which_cap: 'max_price',
        before: beforeCap,
        after: running,
        message: plainMsg,
        effect: `Ceiling ₹${running}`,
        direction: 'down',
        running,
      });
    }
  }

  const finalPrice = roundWithinBounds(running, roundStep, effectiveMin, effectiveMax);
  if (capDetails) {
    capDetails.capped_price = finalPrice;
  }

  if (finalPrice !== running || roundStep >= 1) {
    const diff = roundDecimal2(finalPrice - running);
    breakdown.push({
      step: `Round to nearest ${roundStep} (Half-Up)`,
      type: 'rounding',
      before: running,
      after: finalPrice,
      effect: diff === 0 ? 'Exact' : diff > 0 ? `+₹${diff}` : `−₹${Math.abs(diff)}`,
      direction: 'neutral',
      running: finalPrice,
    });
  }

  for (const rEval of rulesEvaluated) {
    if (rEval.fired) {
      const withoutRuleConfig: DomainConfigSchema = {
        ...config,
        rules: config.rules.filter((r) => r.id !== rEval.id),
      };
      const cf = executePricingEngineWithoutCounterfactuals(withoutRuleConfig, context, product.id);
      rEval.counterfactual_price = cf;
    }
  }

  const netPct = basePrice > 0 ? Math.round(((finalPrice - basePrice) / basePrice) * 100) : 0;
  const headline_adjustment = dominantRule
    ? {
        label: dominantRule.label,
        effect: dominantRule.effect,
        direction: dominantRule.direction,
      }
    : {
        label: 'Standard rate',
        effect: netPct === 0 ? 'Base' : netPct > 0 ? `+${netPct}%` : `−${Math.abs(netPct)}%`,
        direction: (netPct > 0 ? 'up' : netPct < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      };

  return {
    base_price: basePrice,
    final_price: finalPrice,
    unconstrained_price: unconstrainedRounded,
    cap_applied: capApplied,
    cap_details: capDetails,
    breakdown,
    constraints_applied: constraintsApplied,
    headline_adjustment,
    rules_evaluated: rulesEvaluated,
  };
}

function executePricingEngineWithoutCounterfactuals(
  config: DomainConfigSchema,
  context: Record<string, any>,
  productId: string
): number {
  const product = config.products.find((p) => p.id === productId) || config.products[0];
  let basePrice = product.baseValue;
  if (product.baseType === 'formula' && product.formulaAttr && product.formulaRate !== undefined) {
    basePrice = roundDecimal2(product.baseValue + product.formulaRate * Number(context[product.formulaAttr] ?? 0));
  } else if (product.baseType === 'attribute') {
    const attrName = product.formulaAttr || 'base_amount';
    const rawAttr = context[attrName];
    basePrice = roundDecimal2(rawAttr !== undefined ? Number(rawAttr) : product.baseValue);
  }
  let running = basePrice;
  const sortedRules = [...config.rules].sort((a, b) => a.priority - b.priority);
  const usedGroups = new Set<string>();
  for (const rule of sortedRules) {
    if (rule.exclusiveGroup && usedGroups.has(rule.exclusiveGroup)) continue;
    const res = evaluateRule(rule, context);
    if (!res.fired) continue;
    running = applyAction(running, basePrice, rule.action, config.strategy.stacking, context).next;
    if (rule.exclusiveGroup) usedGroups.add(rule.exclusiveGroup);
    if (rule.stopProcessing) break;
  }

  const bounds = resolveConstraints(config.constraints);
  let effectiveMin = -Infinity;
  let effectiveMax = Infinity;

  if (bounds.max_uplift_percent !== undefined && bounds.max_uplift_percent >= 0) {
    const cap = roundDecimal2(basePrice * (1 + bounds.max_uplift_percent / 100));
    effectiveMax = Math.min(effectiveMax, cap);
    if (running > cap) running = cap;
  }
  if (bounds.max_discount_percent !== undefined && bounds.max_discount_percent >= 0) {
    const floor = roundDecimal2(basePrice * (1 - bounds.max_discount_percent / 100));
    effectiveMin = Math.max(effectiveMin, floor);
    if (running < floor) running = floor;
  }
  if (bounds.min_price !== undefined) {
    effectiveMin = Math.max(effectiveMin, bounds.min_price);
    if (running < bounds.min_price) running = bounds.min_price;
  }
  if (bounds.max_price !== undefined) {
    effectiveMax = Math.min(effectiveMax, bounds.max_price);
    if (running > bounds.max_price) running = bounds.max_price;
  }

  return roundWithinBounds(running, config.strategy.roundTo || 1, effectiveMin, effectiveMax);
}
