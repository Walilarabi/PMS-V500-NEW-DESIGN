/**
 * FLOWTYM — Revenue Integrity Engine — Domain types & Zod schemas.
 *
 * The whole engine is configuration-driven:
 *   * `Partner` carries the OTA identity but no business rule.
 *   * `PartnerPaymentModel` describes how a reservation is collected,
 *     selected by `detection_rules` evaluated against the OTA payload.
 *   * `PartnerCommission`, `PartnerPromotion`, `ScoringRule` provide all
 *     numeric inputs to the engines.
 *   * `ReservationValidation` is the immutable runtime audit row.
 */
import { z } from 'zod';

export type CollectionType =
  | 'HOTEL_COLLECT'
  | 'OTA_COLLECT'
  | 'VIRTUAL_CARD'
  | 'HYBRID_COLLECT'
  | 'PAY_AT_PROPERTY';

export type CommissionMode = 'PERCENTAGE' | 'FIXED' | 'HYBRID' | 'VARIABLE';
export type PayoutMode = 'POST_PAID' | 'PRE_DEDUCTED' | 'IMMEDIATE';

export type AnomalyCode =
  | 'PRICE_MISMATCH'
  | 'COMMISSION_ERROR'
  | 'TAX_ERROR'
  | 'PROMOTION_ERROR'
  | 'PAYOUT_ERROR'
  | 'CURRENCY_ERROR'
  | 'ROUNDING_ERROR'
  | 'MAPPING_ERROR'
  | 'COLLECTION_MODEL_ERROR';

export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type Decision = 'AUTO_INTEGRATE' | 'WARNING' | 'MANUAL_REVIEW' | 'QUARANTINE';
export type QuarantineStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/* ------------------------------------------------------------------------- */
/*                          Configuration entities                           */
/* ------------------------------------------------------------------------- */

export const partnerSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  code: z.string(),
  name: z.string(),
  api_provider: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string().nullable(),
  currency: z.string(),
  status: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Partner = z.infer<typeof partnerSchema>;

const detectionRuleSchema = z.object({
  path: z.string(),
  op: z.enum(['equals', 'not_equals', 'in', 'not_in', 'exists', 'not_exists', 'gt', 'lt']),
  value: z.unknown().optional(),
});
export type DetectionRule = z.infer<typeof detectionRuleSchema>;

export const partnerPaymentModelSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  partner_id: z.string(),
  collection_type: z.enum([
    'HOTEL_COLLECT', 'OTA_COLLECT', 'VIRTUAL_CARD', 'HYBRID_COLLECT', 'PAY_AT_PROPERTY',
  ]),
  commission_mode: z.enum(['PERCENTAGE', 'FIXED', 'HYBRID', 'VARIABLE']),
  payout_mode: z.enum(['POST_PAID', 'PRE_DEDUCTED', 'IMMEDIATE']),
  is_default: z.boolean(),
  detection_rules: z.array(detectionRuleSchema).default([]),
  priority: z.number().int(),
  enabled: z.boolean(),
});
export type PartnerPaymentModel = z.infer<typeof partnerPaymentModelSchema>;

export const partnerCommissionSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  partner_id: z.string(),
  payment_model_id: z.string().nullable(),
  mode: z.enum(['PERCENTAGE', 'FIXED', 'HYBRID', 'VARIABLE']),
  rate: z.number().nullable(),
  fixed_amount: z.number().nullable(),
  currency: z.string(),
  applies_on: z.string(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
});
export type PartnerCommission = z.infer<typeof partnerCommissionSchema>;

export const partnerPromotionSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  partner_id: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  discount_type: z.string(),
  discount_value: z.number(),
  cumulable: z.boolean(),
  priority: z.number().int(),
  conditions: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean(),
});
export type PartnerPromotion = z.infer<typeof partnerPromotionSchema>;

export const scoringRuleSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  partner_id: z.string().nullable(),
  currency: z.string().nullable(),
  bands: z.array(z.object({
    max_delta_abs: z.number(),
    max_delta_pct: z.number(),
    score: z.number().int(),
  })),
  thresholds: z.object({
    auto: z.number().int(),
    warning: z.number().int(),
    manual: z.number().int(),
  }),
  is_default: z.boolean(),
  enabled: z.boolean(),
});
export type ScoringRule = z.infer<typeof scoringRuleSchema>;

/* ------------------------------------------------------------------------- */
/*                              Runtime types                                */
/* ------------------------------------------------------------------------- */

export interface OtaPayload {
  reference: string;
  partner_code: string;            // e.g. BOOKING / EXPEDIA
  currency: string;                // ISO 4217
  base_rate_per_night: number;     // amount excl tax
  nights: number;
  taxes: number;                   // amount of taxes already added by OTA
  promotion_code?: string | null;
  promotion_amount?: number;       // deduction
  commission_amount?: number;      // commission stated by OTA
  total_received: number;          // gross amount on the booking
  expected_payout?: number;        // OTA-stated payout to hotel
  payment_collect?: 'OTA' | 'HOTEL';
  virtual_card?: { present: boolean };
  channel_manager_collection_hint?: CollectionType;
  // free-form extra fields tolerated
  [key: string]: unknown;
}

export interface AnomalyEntry {
  code: AnomalyCode;
  severity: Severity;
  message: string;
  delta_amount?: number;
  delta_pct?: number;
  evidence?: Record<string, unknown>;
}

export interface ValidationBreakdown {
  base_amount: number;
  promotion_amount: number;
  tax_amount: number;
  commission_amount: number;
  fx_adjustment: number;
  rounding_amount: number;
  expected_amount: number;
  received_amount: number;
  delta_amount: number;
  delta_pct: number;
  rules_applied: string[];   // human readable rule references
  promotions_applied: string[];
  collection_type: CollectionType;
  detection_path: string;    // which rule matched / "default"
}

export interface ValidationOutcome {
  score: number;
  decision: Decision;
  anomalies: AnomalyEntry[];
  breakdown: ValidationBreakdown;
  partner_id: string | null;
  payment_model_id: string | null;
  scoring_rule_id: string | null;
  currency: string;
  thresholds: ScoringRule['thresholds'];
}
