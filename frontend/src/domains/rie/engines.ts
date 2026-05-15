/**
 * FLOWTYM — RIE engines (pure TypeScript, no I/O).
 *
 * Each engine consumes a typed configuration and returns a deterministic
 * result. They are reused by `ReservationValidationEngine` (orchestrator)
 * and by the simulation panels in the UI.
 *
 * INVARIANT : no engine performs Supabase access. Repositories load all
 * configuration upfront and pass it as input.
 */
import type {
  AnomalyEntry,
  CollectionType,
  Decision,
  DetectionRule,
  OtaPayload,
  Partner,
  PartnerCommission,
  PartnerPaymentModel,
  PartnerPromotion,
  ScoringRule,
  Severity,
  ValidationBreakdown,
  ValidationOutcome,
} from './types';

const TWO_DP = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------------- */
/*                  Helper : safe nested path resolution                     */
/* ------------------------------------------------------------------------- */

function readPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

/* ------------------------------------------------------------------------- */
/*                       PartnerConfigurationService                         */
/* ------------------------------------------------------------------------- */

export const PartnerConfigurationService = {
  resolvePartner(payload: OtaPayload, partners: Partner[]): Partner | null {
    if (!payload.partner_code) return null;
    const code = payload.partner_code.toUpperCase();
    return partners.find((p) => p.code.toUpperCase() === code && p.status === 'active') ?? null;
  },
};

/* ------------------------------------------------------------------------- */
/*                  PaymentCollectionDetectionService                        */
/*                                                                           */
/*  Walks all enabled payment models for the partner, ordered by `priority`. */
/*  Returns the first model whose detection rules ALL pass. Falls back to    */
/*  the model marked `is_default` if any.                                    */
/* ------------------------------------------------------------------------- */

function evaluateRule(rule: DetectionRule, payload: OtaPayload): boolean {
  const actual = readPath(payload, rule.path);
  switch (rule.op) {
    case 'equals': return actual === rule.value;
    case 'not_equals': return actual !== rule.value;
    case 'in': return Array.isArray(rule.value) && (rule.value as unknown[]).includes(actual);
    case 'not_in': return Array.isArray(rule.value) && !(rule.value as unknown[]).includes(actual);
    case 'exists': return actual !== undefined && actual !== null;
    case 'not_exists': return actual === undefined || actual === null;
    case 'gt': return typeof actual === 'number' && typeof rule.value === 'number' && actual > rule.value;
    case 'lt': return typeof actual === 'number' && typeof rule.value === 'number' && actual < rule.value;
    default: return false;
  }
}

export interface DetectionResult {
  model: PartnerPaymentModel | null;
  collection_type: CollectionType;
  matchedRules: string[];
  detection_path: string;
}

export const PaymentCollectionDetectionService = {
  detect(
    payload: OtaPayload,
    partner: Partner,
    models: PartnerPaymentModel[],
  ): DetectionResult {
    const partnerModels = models
      .filter((m) => m.partner_id === partner.id && m.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const m of partnerModels) {
      if (m.detection_rules.length === 0) continue;
      const matched = m.detection_rules.every((r) => evaluateRule(r, payload));
      if (matched) {
        return {
          model: m,
          collection_type: m.collection_type,
          matchedRules: m.detection_rules.map((r) => `${r.path} ${r.op} ${JSON.stringify(r.value)}`),
          detection_path: 'rule_match',
        };
      }
    }

    // Channel manager hint (priority just below explicit rules)
    if (payload.channel_manager_collection_hint) {
      const hinted = partnerModels.find(
        (m) => m.collection_type === payload.channel_manager_collection_hint,
      );
      if (hinted) {
        return {
          model: hinted,
          collection_type: hinted.collection_type,
          matchedRules: ['channel_manager_hint'],
          detection_path: 'channel_manager_hint',
        };
      }
    }

    const fallback = partnerModels.find((m) => m.is_default) ?? partnerModels[0] ?? null;
    return {
      model: fallback,
      collection_type: (fallback?.collection_type ?? 'HOTEL_COLLECT') as CollectionType,
      matchedRules: ['default'],
      detection_path: 'default',
    };
  },
};

/* ------------------------------------------------------------------------- */
/*                              PromotionEngine                              */
/* ------------------------------------------------------------------------- */

export const PromotionEngine = {
  apply(
    base: number,
    payload: OtaPayload,
    promotions: PartnerPromotion[],
    partner: Partner | null,
  ): { discount: number; applied: PartnerPromotion[]; rules: string[] } {
    if (!payload.promotion_code) return { discount: 0, applied: [], rules: [] };
    const candidates = promotions
      .filter((p) => p.enabled)
      .filter((p) => p.partner_id === null || p.partner_id === partner?.id)
      .filter((p) => p.code.toUpperCase() === payload.promotion_code!.toUpperCase())
      .sort((a, b) => a.priority - b.priority);

    let discount = 0;
    const applied: PartnerPromotion[] = [];
    for (const p of candidates) {
      if (applied.length > 0 && !p.cumulable) break;
      const v = p.discount_type === 'PERCENTAGE' ? base * p.discount_value : p.discount_value;
      discount += v;
      applied.push(p);
      if (!p.cumulable) break;
    }
    return {
      discount: TWO_DP(discount),
      applied,
      rules: applied.map((p) => `promo:${p.code}@${p.discount_value}`),
    };
  },
};

/* ------------------------------------------------------------------------- */
/*                              CommissionEngine                             */
/* ------------------------------------------------------------------------- */

export const CommissionEngine = {
  compute(
    netAmount: number,
    grossAmount: number,
    commissions: PartnerCommission[],
    partner: Partner | null,
    paymentModel: PartnerPaymentModel | null,
  ): { commission: number; rate: number | null; rule: string } {
    if (!partner) return { commission: 0, rate: 0, rule: 'no_partner' };
    const candidates = commissions
      .filter((c) => c.partner_id === partner.id)
      .filter((c) => c.payment_model_id === null || c.payment_model_id === paymentModel?.id);
    const rule = candidates[0];
    if (!rule) return { commission: 0, rate: 0, rule: 'no_rule' };
    const base = rule.applies_on === 'GROSS' ? grossAmount : netAmount;
    let commission = 0;
    if (rule.mode === 'PERCENTAGE') commission = base * (rule.rate ?? 0);
    else if (rule.mode === 'FIXED') commission = rule.fixed_amount ?? 0;
    else if (rule.mode === 'HYBRID') commission = base * (rule.rate ?? 0) + (rule.fixed_amount ?? 0);
    return {
      commission: TWO_DP(commission),
      rate: rule.rate,
      rule: `commission:${rule.mode}@${rule.rate ?? rule.fixed_amount}`,
    };
  },
};

/* ------------------------------------------------------------------------- */
/*                                TaxEngine                                  */
/*                                                                           */
/*  In v1 we trust the OTA-provided `taxes` figure but validate it against  */
/*  a derived expected tax amount when the payload provides a hint.         */
/* ------------------------------------------------------------------------- */

export const TaxEngine = {
  expected(payload: OtaPayload): number {
    return TWO_DP(payload.taxes ?? 0);
  },
};

/* ------------------------------------------------------------------------- */
/*                       CurrencyConversionService                           */
/* ------------------------------------------------------------------------- */

export interface CurrencyRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  observed_at: string;
}

export const CurrencyConversionService = {
  convert(
    amount: number,
    from: string,
    to: string,
    rates: CurrencyRate[],
  ): { value: number; rate: number } {
    if (from === to) return { value: TWO_DP(amount), rate: 1 };
    const direct = rates
      .filter((r) => r.from_currency === from && r.to_currency === to)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    if (direct) return { value: TWO_DP(amount * direct.rate), rate: direct.rate };
    const inverse = rates
      .filter((r) => r.from_currency === to && r.to_currency === from)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    if (inverse) {
      const rate = 1 / inverse.rate;
      return { value: TWO_DP(amount * rate), rate };
    }
    return { value: amount, rate: 1 };
  },
};

/* ------------------------------------------------------------------------- */
/*                              ScoringEngine                                */
/* ------------------------------------------------------------------------- */

export const ScoringEngine = {
  resolveRule(
    rules: ScoringRule[],
    partnerId: string | null,
    currency: string,
  ): ScoringRule | null {
    const sorted = [...rules].filter((r) => r.enabled);
    const exact = sorted.find((r) => r.partner_id === partnerId && r.currency === currency);
    if (exact) return exact;
    const partnerOnly = sorted.find((r) => r.partner_id === partnerId && r.currency === null);
    if (partnerOnly) return partnerOnly;
    const currencyOnly = sorted.find((r) => r.partner_id === null && r.currency === currency);
    if (currencyOnly) return currencyOnly;
    return sorted.find((r) => r.is_default) ?? null;
  },

  score(rule: ScoringRule, deltaAbs: number, deltaPct: number): number {
    const absDelta = Math.abs(deltaAbs);
    const absPct = Math.abs(deltaPct);
    for (const band of rule.bands) {
      if (absDelta <= band.max_delta_abs || absPct <= band.max_delta_pct) {
        return band.score;
      }
    }
    return 0;
  },
};

/* ------------------------------------------------------------------------- */
/*                         AnomalyDetectionEngine                            */
/* ------------------------------------------------------------------------- */

export const AnomalyDetectionEngine = {
  detect(
    payload: OtaPayload,
    breakdown: ValidationBreakdown,
    partner: Partner | null,
    paymentModel: PartnerPaymentModel | null,
  ): AnomalyEntry[] {
    const out: AnomalyEntry[] = [];
    const absDelta = Math.abs(breakdown.delta_amount);
    const relDelta = Math.abs(breakdown.delta_pct);

    if (!partner) {
      out.push({
        code: 'MAPPING_ERROR',
        severity: 'CRITICAL',
        message: `Partner introuvable pour le code "${payload.partner_code}"`,
        evidence: { partner_code: payload.partner_code },
      });
      return out;
    }

    if (!paymentModel) {
      out.push({
        code: 'COLLECTION_MODEL_ERROR',
        severity: 'CRITICAL',
        message: 'Aucun modèle de collecte applicable',
        evidence: { partner: partner.code },
      });
    }

    if (payload.currency !== partner.currency) {
      out.push({
        code: 'CURRENCY_ERROR',
        severity: 'WARNING',
        message: `Devise OTA ${payload.currency} ≠ devise partenaire ${partner.currency}`,
        evidence: { ota: payload.currency, partner: partner.currency },
      });
    }

    if (absDelta > 0.5 || relDelta > 0.005) {
      const sev: Severity = absDelta > 25 || relDelta > 0.08 ? 'CRITICAL' : absDelta > 5 ? 'WARNING' : 'INFO';
      out.push({
        code: 'PRICE_MISMATCH',
        severity: sev,
        message: `Écart prix : ${breakdown.delta_amount.toFixed(2)} (${(breakdown.delta_pct * 100).toFixed(2)} %)`,
        delta_amount: breakdown.delta_amount,
        delta_pct: breakdown.delta_pct,
      });
    }

    if (
      payload.commission_amount !== undefined &&
      Math.abs(payload.commission_amount - breakdown.commission_amount) > 0.5
    ) {
      out.push({
        code: 'COMMISSION_ERROR',
        severity: 'WARNING',
        message: `Commission OTA ${payload.commission_amount.toFixed(2)} ≠ attendue ${breakdown.commission_amount.toFixed(2)}`,
        delta_amount: payload.commission_amount - breakdown.commission_amount,
        evidence: {
          stated: payload.commission_amount,
          expected: breakdown.commission_amount,
        },
      });
    }

    if (payload.expected_payout !== undefined) {
      const expectedPayout = breakdown.expected_amount - breakdown.commission_amount;
      if (Math.abs(payload.expected_payout - expectedPayout) > 0.5) {
        out.push({
          code: 'PAYOUT_ERROR',
          severity: 'WARNING',
          message: `Payout déclaré ${payload.expected_payout.toFixed(2)} ≠ attendu ${expectedPayout.toFixed(2)}`,
          delta_amount: payload.expected_payout - expectedPayout,
        });
      }
    }

    const promotionDelta = (payload.promotion_amount ?? 0) - breakdown.promotion_amount;
    if (Math.abs(promotionDelta) > 0.5) {
      out.push({
        code: 'PROMOTION_ERROR',
        severity: 'INFO',
        message: `Promo OTA ${(payload.promotion_amount ?? 0).toFixed(2)} ≠ attendue ${breakdown.promotion_amount.toFixed(2)}`,
        delta_amount: promotionDelta,
      });
    }

    if (Math.abs(breakdown.rounding_amount) >= 0.5) {
      out.push({
        code: 'ROUNDING_ERROR',
        severity: 'INFO',
        message: `Arrondi suspect ${breakdown.rounding_amount.toFixed(2)}`,
        delta_amount: breakdown.rounding_amount,
      });
    }

    return out;
  },
};

/* ------------------------------------------------------------------------- */
/*                         WorkflowDecisionEngine                            */
/* ------------------------------------------------------------------------- */

export const WorkflowDecisionEngine = {
  decide(score: number, anomalies: AnomalyEntry[], thresholds: ScoringRule['thresholds']): Decision {
    if (anomalies.some((a) => a.severity === 'CRITICAL')) return 'QUARANTINE';
    if (score >= thresholds.auto) return 'AUTO_INTEGRATE';
    if (score >= thresholds.warning) return 'WARNING';
    if (score >= thresholds.manual) return 'MANUAL_REVIEW';
    return 'QUARANTINE';
  },
};

/* ------------------------------------------------------------------------- */
/*                       ReservationValidationEngine                         */
/*                                                                           */
/*   Pure orchestrator. Takes preloaded configuration and an OTA payload,    */
/*   returns a complete ValidationOutcome ready for persistence.             */
/* ------------------------------------------------------------------------- */

export interface RIEConfiguration {
  partners: Partner[];
  paymentModels: PartnerPaymentModel[];
  commissions: PartnerCommission[];
  promotions: PartnerPromotion[];
  scoringRules: ScoringRule[];
  currencyRates: CurrencyRate[];
}

export const ReservationValidationEngine = {
  validate(payload: OtaPayload, cfg: RIEConfiguration): ValidationOutcome {
    const partner = PartnerConfigurationService.resolvePartner(payload, cfg.partners);
    const detection = partner
      ? PaymentCollectionDetectionService.detect(payload, partner, cfg.paymentModels)
      : { model: null, collection_type: 'HOTEL_COLLECT' as CollectionType, matchedRules: [], detection_path: 'no_partner' };

    const baseAmount = TWO_DP((payload.base_rate_per_night ?? 0) * (payload.nights ?? 1));
    const promo = PromotionEngine.apply(baseAmount, payload, cfg.promotions, partner);
    const taxes = TaxEngine.expected(payload);
    const netAfterPromo = baseAmount - promo.discount;
    const grossExpected = TWO_DP(netAfterPromo + taxes);
    const commission = CommissionEngine.compute(
      netAfterPromo,
      grossExpected,
      cfg.commissions,
      partner,
      detection.model,
    );

    let fxAdjustment = 0;
    if (partner && payload.currency !== partner.currency) {
      const conv = CurrencyConversionService.convert(
        grossExpected,
        payload.currency,
        partner.currency,
        cfg.currencyRates,
      );
      fxAdjustment = TWO_DP(conv.value - grossExpected);
    }

    const expectedAmount = TWO_DP(grossExpected + fxAdjustment);
    const receivedAmount = TWO_DP(payload.total_received);
    const deltaAmount = TWO_DP(receivedAmount - expectedAmount);
    const rounding = TWO_DP(deltaAmount - Math.trunc(deltaAmount * 100) / 100);
    const deltaPct = expectedAmount === 0 ? 0 : deltaAmount / expectedAmount;

    const breakdown: ValidationBreakdown = {
      base_amount: baseAmount,
      promotion_amount: promo.discount,
      tax_amount: taxes,
      commission_amount: commission.commission,
      fx_adjustment: fxAdjustment,
      rounding_amount: rounding,
      expected_amount: expectedAmount,
      received_amount: receivedAmount,
      delta_amount: deltaAmount,
      delta_pct: Number.isFinite(deltaPct) ? deltaPct : 0,
      rules_applied: [
        `partner:${partner?.code ?? 'unknown'}`,
        `collection:${detection.collection_type}`,
        commission.rule,
        ...promo.rules,
      ],
      promotions_applied: promo.applied.map((p) => p.code),
      collection_type: detection.collection_type,
      detection_path: detection.detection_path,
    };

    const anomalies = AnomalyDetectionEngine.detect(payload, breakdown, partner, detection.model);

    const scoringRule = ScoringEngine.resolveRule(
      cfg.scoringRules,
      partner?.id ?? null,
      payload.currency,
    );
    const score = scoringRule
      ? ScoringEngine.score(scoringRule, breakdown.delta_amount, breakdown.delta_pct)
      : 0;

    const thresholds = scoringRule?.thresholds ?? { auto: 95, warning: 85, manual: 70 };
    const decision = WorkflowDecisionEngine.decide(score, anomalies, thresholds);

    return {
      score,
      decision,
      anomalies,
      breakdown,
      partner_id: partner?.id ?? null,
      payment_model_id: detection.model?.id ?? null,
      scoring_rule_id: scoringRule?.id ?? null,
      currency: payload.currency,
      thresholds,
    };
  },
};
