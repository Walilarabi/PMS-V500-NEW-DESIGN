/**
 * FLOWTYM — Finance domain schemas.
 * Covers: Reconciliation, FEC exports, Revenue Integrity anomalies, CSV templates.
 */
import { z } from 'zod';

// ─── Reconciliation ──────────────────────────────────────────────────────────

export const reconciliationSourceSchema = z.enum([
  'BOOKING', 'EXPEDIA', 'AIRBNB', 'BANK_HOTEL', 'DIRECT',
]);
export type ReconciliationSource = z.infer<typeof reconciliationSourceSchema>;

export const reconciliationStatusSchema = z.enum([
  'pending', 'matched', 'disputed', 'ignored',
]);
export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;

export const reconciliationLineRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  source: reconciliationSourceSchema,
  reference: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string().default('EUR'),
  line_date: z.string(),
  status: reconciliationStatusSchema,
  reservation_id: z.string().uuid().nullable(),
  match_score: z.number().nullable(),
  match_delta: z.number().nullable(),
  matched_at: z.string().nullable(),
  matched_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  raw_payload: z.unknown().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export type ReconciliationLineRow = z.infer<typeof reconciliationLineRowSchema>;

export const importCsvLineSchema = z.object({
  source: reconciliationSourceSchema,
  reference: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ImportCsvLine = z.infer<typeof importCsvLineSchema>;

export const updateReconciliationStatusSchema = z.object({
  status: reconciliationStatusSchema,
  reservation_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});

// ─── FEC ─────────────────────────────────────────────────────────────────────

export const fecExportRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  period_from: z.string(),
  period_to: z.string(),
  siren: z.string().nullable(),
  filename: z.string(),
  entries_count: z.number().int(),
  total_debit: z.number(),
  total_credit: z.number(),
  is_balanced: z.boolean(),
  sha256_hash: z.string().nullable(),
  generated_by: z.string().uuid().nullable(),
  created_at: z.string(),
}).passthrough();
export type FecExportRow = z.infer<typeof fecExportRowSchema>;

// FEC entry — 18 colonnes DGFiP NF Z 47-006
export interface FecEntry {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: number;
  EcritureDate: string;      // YYYYMMDD
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;         // YYYYMMDD
  EcritureLib: string;
  Debit: number;
  Credit: number;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;         // YYYYMMDD
  Montantdevise: number;
  Idevise: string;
}

// ─── Revenue Anomalies ────────────────────────────────────────────────────────

export const anomalyTypeSchema = z.enum([
  'PRICE_MISMATCH',
  'COMMISSION_ERROR',
  'TAX_ERROR',
  'PROMOTION_ERROR',
  'PAYOUT_ERROR',
  'CURRENCY_ERROR',
  'ROUNDING_ERROR',
  'MAPPING_ERROR',
]);
export type AnomalyType = z.infer<typeof anomalyTypeSchema>;

export const anomalySeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AnomalySeverity = z.infer<typeof anomalySeveritySchema>;

export const revenueAnomalyRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  reservation_id: z.string().uuid().nullable(),
  recon_line_id: z.string().uuid().nullable(),
  anomaly_type: anomalyTypeSchema,
  source: z.string().nullable(),
  severity: anomalySeveritySchema,
  score: z.number().nullable(),
  expected_amount: z.number().nullable(),
  actual_amount: z.number().nullable(),
  delta: z.number().nullable(),
  description: z.string(),
  details: z.unknown().nullable(),
  status: z.enum(['open', 'resolved', 'ignored']),
  resolved_by: z.string().uuid().nullable(),
  resolved_at: z.string().nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
export type RevenueAnomalyRow = z.infer<typeof revenueAnomalyRowSchema>;

// ─── CSV Import Templates ─────────────────────────────────────────────────────

export const csvTemplateRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  name: z.string(),
  source: reconciliationSourceSchema,
  mapping: z.record(z.string()),
  default_currency: z.string(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
export type CsvTemplateRow = z.infer<typeof csvTemplateRowSchema>;

export const upsertCsvTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  source: reconciliationSourceSchema,
  mapping: z.record(z.string()),
  is_default: z.boolean().default(false),
});
export type UpsertCsvTemplateInput = z.infer<typeof upsertCsvTemplateSchema>;

// ─── Audit Log (read-side, extends existing AuditLogRow) ─────────────────────

export const auditLogReadSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  entity: z.string(),
  entity_id: z.string(),
  action: z.string(),
  payload: z.unknown(),
  correlation_id: z.string().nullable(),
  created_at: z.string(),
}).passthrough();
export type AuditLogRead = z.infer<typeof auditLogReadSchema>;
