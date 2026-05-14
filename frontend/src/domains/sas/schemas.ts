/**
 * FLOWTYM — SAS domain schemas (Zod).
 * Revenue Integrity Engine + ODMS + Partners + Quarantine + Reconciliation
 */
import { z } from 'zod';

// ─── Partners ─────────────────────────────────────────────────────────────────

export const partnerStatusSchema = z.enum(['active', 'suspended', 'inactive']);
export type PartnerStatus = z.infer<typeof partnerStatusSchema>;

export const sasPartnerRowSchema = z.object({
  id:           z.string(),
  hotel_id:     z.string(),
  code:         z.string(),
  name:         z.string(),
  status:       partnerStatusSchema,
  timezone:     z.string(),
  currency:     z.string(),
  country:      z.string().nullable(),
  api_provider: z.string().nullable(),
  metadata:     z.record(z.unknown()).nullable(),
  created_at:   z.string(),
  updated_at:   z.string(),
}).passthrough();
export type SasPartnerRow = z.infer<typeof sasPartnerRowSchema>;

export const collectionTypeSchema = z.enum([
  'HOTEL_COLLECT','OTA_COLLECT','VIRTUAL_CARD','HYBRID_COLLECT','PAY_AT_PROPERTY'
]);
export type CollectionType = z.infer<typeof collectionTypeSchema>;

export const sasPaymentModelRowSchema = z.object({
  id:               z.string(),
  hotel_id:         z.string(),
  partner_id:       z.string(),
  collection_type:  collectionTypeSchema,
  commission_mode:  z.enum(['PERCENTAGE','FIXED','HYBRID']).nullable(),
  commission_value: z.number().nullable(),
  payout_mode:      z.enum(['POST_PAID','PRE_DEDUCTED']).nullable(),
  detection_rules:  z.array(z.unknown()).nullable(),
  is_default:       z.boolean(),
  enabled:          z.boolean(),
  created_at:       z.string(),
}).passthrough();
export type SasPaymentModelRow = z.infer<typeof sasPaymentModelRowSchema>;

export const sasCommissionRowSchema = z.object({
  id:           z.string(),
  hotel_id:     z.string(),
  partner_id:   z.string(),
  rate:         z.number(),
  fixed_amount: z.number().nullable(),
  valid_from:   z.string(),
  valid_to:     z.string().nullable(),
  applies_to:   z.enum(['GROSS','NET','AFTER_PROMO']),
  notes:        z.string().nullable(),
  created_at:   z.string(),
}).passthrough();
export type SasCommissionRow = z.infer<typeof sasCommissionRowSchema>;

// ─── Incoming Reservations ────────────────────────────────────────────────────

export const rieStatusSchema = z.enum([
  'pending','validating','approved','warning','manual_review','quarantined','rejected'
]);
export type RieStatus = z.infer<typeof rieStatusSchema>;

export const sasIncomingRowSchema = z.object({
  id:              z.string(),
  hotel_id:        z.string(),
  partner_id:      z.string().nullable(),
  ota_reference:   z.string(),
  raw_payload:     z.record(z.unknown()),
  guest_name:      z.string().nullable(),
  check_in:        z.string().nullable(),
  check_out:       z.string().nullable(),
  room_type:       z.string().nullable(),
  adults:          z.number().nullable(),
  children:        z.number().nullable(),
  ota_amount:      z.number().nullable(),
  ota_currency:    z.string().nullable(),
  ota_commission:  z.number().nullable(),
  collection_type: z.string().nullable(),
  rie_status:      rieStatusSchema,
  rie_score:       z.number().nullable(),
  reservation_id:  z.string().nullable(),
  received_at:     z.string(),
  processed_at:    z.string().nullable(),
  created_at:      z.string(),
  updated_at:      z.string(),
}).passthrough();
export type SasIncomingRow = z.infer<typeof sasIncomingRowSchema>;

// ─── Validation RIE ───────────────────────────────────────────────────────────

export const rieDecisionSchema = z.enum([
  'AUTO_APPROVED','WARNING','MANUAL_REVIEW','QUARANTINED','BLOCKED'
]);
export type RieDecision = z.infer<typeof rieDecisionSchema>;

export const anomalyTypeSchema = z.enum([
  'PRICE_MISMATCH','COMMISSION_ERROR','TAX_ERROR','PROMOTION_ERROR',
  'PAYOUT_ERROR','CURRENCY_ERROR','ROUNDING_ERROR','MAPPING_ERROR','COLLECTION_MODEL_ERROR'
]);
export type AnomalyType = z.infer<typeof anomalyTypeSchema>;

export const anomalySchema = z.object({
  type:        anomalyTypeSchema,
  severity:    z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
  description: z.string(),
  deviation:   z.number().nullable(),
});
export type Anomaly = z.infer<typeof anomalySchema>;

export const sasValidationRowSchema = z.object({
  id:                  z.string(),
  hotel_id:            z.string(),
  incoming_id:         z.string(),
  partner_id:          z.string().nullable(),
  pms_base_rate:       z.number().nullable(),
  promo_deduction:     z.number().nullable(),
  tax_amount:          z.number().nullable(),
  commission_rate:     z.number().nullable(),
  commission_amount:   z.number().nullable(),
  expected_amount:     z.number().nullable(),
  received_amount:     z.number().nullable(),
  deviation:           z.number().nullable(),
  deviation_pct:       z.number().nullable(),
  score:               z.number(),
  decision:            rieDecisionSchema,
  anomalies:           z.array(anomalySchema).nullable(),
  calculation_detail:  z.record(z.unknown()).nullable(),
  promotions_applied:  z.array(z.unknown()).nullable(),
  collection_type:     z.string().nullable(),
  validated_at:        z.string(),
  validated_by:        z.string().nullable(),
}).passthrough();
export type SasValidationRow = z.infer<typeof sasValidationRowSchema>;

// ─── Quarantine ───────────────────────────────────────────────────────────────

export const quarantineStatusSchema = z.enum([
  'QUARANTINED','RELEASED','DISPUTED','CANCELLED'
]);
export type QuarantineStatus = z.infer<typeof quarantineStatusSchema>;

export const sasQuarantineRowSchema = z.object({
  id:              z.string(),
  hotel_id:        z.string(),
  incoming_id:     z.string(),
  validation_id:   z.string().nullable(),
  virtual_room:    z.string().nullable(),
  reason:          z.string(),
  quarantined_at:  z.string(),
  quarantined_by:  z.string().nullable(),
  released_at:     z.string().nullable(),
  released_by:     z.string().nullable(),
  release_note:    z.string().nullable(),
  status:          quarantineStatusSchema,
}).passthrough();
export type SasQuarantineRow = z.infer<typeof sasQuarantineRowSchema>;

// ─── ODMS Disputes ────────────────────────────────────────────────────────────

export const disputeStatusSchema = z.enum([
  'DRAFT','SENT','ACKNOWLEDGED','IN_REVIEW','CORRECTED','REJECTED','CLOSED','ESCALATED'
]);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

export const sasDisputeRowSchema = z.object({
  id:               z.string(),
  hotel_id:         z.string(),
  reference:        z.string(),
  incoming_id:      z.string().nullable(),
  validation_id:    z.string().nullable(),
  partner_id:       z.string().nullable(),
  expected_amount:  z.number().nullable(),
  received_amount:  z.number().nullable(),
  claimed_amount:   z.number().nullable(),
  recovered_amount: z.number().nullable(),
  subject:          z.string().nullable(),
  explanation:      z.string().nullable(),
  email_subject:    z.string().nullable(),
  email_body:       z.string().nullable(),
  recipients:       z.array(z.string()).nullable(),
  status:           disputeStatusSchema,
  sent_at:          z.string().nullable(),
  acknowledged_at:  z.string().nullable(),
  resolved_at:      z.string().nullable(),
  next_followup_at: z.string().nullable(),
  followup_count:   z.number(),
  created_by:       z.string().nullable(),
  created_at:       z.string(),
  updated_at:       z.string(),
}).passthrough();
export type SasDisputeRow = z.infer<typeof sasDisputeRowSchema>;

export const sasDisputeMessageRowSchema = z.object({
  id:          z.string(),
  hotel_id:    z.string(),
  dispute_id:  z.string(),
  direction:   z.enum(['OUTBOUND','INBOUND','INTERNAL']),
  content:     z.string(),
  attachments: z.array(z.unknown()).nullable(),
  sent_at:     z.string().nullable(),
  created_by:  z.string().nullable(),
  created_at:  z.string(),
}).passthrough();
export type SasDisputeMessageRow = z.infer<typeof sasDisputeMessageRowSchema>;

export const sasStatusHistoryRowSchema = z.object({
  id:          z.string(),
  hotel_id:    z.string(),
  dispute_id:  z.string(),
  old_status:  z.string().nullable(),
  new_status:  z.string(),
  reason:      z.string().nullable(),
  changed_by:  z.string().nullable(),
  changed_at:  z.string(),
}).passthrough();
export type SasStatusHistoryRow = z.infer<typeof sasStatusHistoryRowSchema>;

// ─── Scoring Rules ────────────────────────────────────────────────────────────

export const sasScoringRuleRowSchema = z.object({
  id:                       z.string(),
  hotel_id:                 z.string(),
  partner_id:               z.string().nullable(),
  rule_name:                z.string(),
  auto_approve_min:         z.number(),
  warning_min:              z.number(),
  manual_review_min:        z.number(),
  price_deviation_pct:      z.number(),
  commission_deviation_pct: z.number(),
  active:                   z.boolean(),
  created_at:               z.string(),
}).passthrough();
export type SasScoringRuleRow = z.infer<typeof sasScoringRuleRowSchema>;

// ─── Partner Reliability ──────────────────────────────────────────────────────

export const sasReliabilityRowSchema = z.object({
  id:                   z.string(),
  hotel_id:             z.string(),
  partner_id:           z.string(),
  period_start:         z.string(),
  period_end:           z.string(),
  total_validations:    z.number(),
  avg_score:            z.number().nullable(),
  auto_rate_pct:        z.number().nullable(),
  manual_rate_pct:      z.number().nullable(),
  quarantine_rate_pct:  z.number().nullable(),
  total_deviation:      z.number().nullable(),
  computed_at:          z.string(),
}).passthrough();
export type SasReliabilityRow = z.infer<typeof sasReliabilityRowSchema>;

// ─── Nav Badge ────────────────────────────────────────────────────────────────

export const sasNavBadgeSchema = z.object({
  hotel_id:      z.string(),
  pending_count: z.number(),    // bulle verte
  anomaly_count: z.number(),    // bulle rouge
});
export type SasNavBadge = z.infer<typeof sasNavBadgeSchema>;

// ─── Input types ──────────────────────────────────────────────────────────────

export const createIncomingReservationSchema = z.object({
  partnerId:      z.string().optional(),
  otaReference:   z.string().min(1),
  rawPayload:     z.record(z.unknown()),
  guestName:      z.string().optional(),
  checkIn:        z.string().optional(),
  checkOut:       z.string().optional(),
  roomType:       z.string().optional(),
  adults:         z.number().int().min(1).default(1),
  children:       z.number().int().min(0).default(0),
  otaAmount:      z.number().optional(),
  otaCurrency:    z.string().length(3).default('EUR'),
  otaCommission:  z.number().optional(),
});
export type CreateIncomingReservationInput = z.infer<typeof createIncomingReservationSchema>;

export const createDisputeSchema = z.object({
  incomingId:      z.string().optional(),
  validationId:    z.string().optional(),
  partnerId:       z.string().optional(),
  expectedAmount:  z.number().optional(),
  receivedAmount:  z.number().optional(),
  claimedAmount:   z.number().optional(),
  subject:         z.string().optional(),
  explanation:     z.string().optional(),
  recipients:      z.array(z.string().email()).default([]),
});
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
