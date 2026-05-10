/**
 * FLOWTYM — OTA Dispute Management System (ODMS) — types & schemas.
 */
import { z } from 'zod';

export type DisputeStatus =
  | 'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'IN_REVIEW'
  | 'CORRECTED' | 'REJECTED' | 'CLOSED';

export type DisputeOrigin = 'AUTO' | 'MANUAL';

export type DisputeMessageKind =
  | 'OUTBOUND_EMAIL' | 'INBOUND_EMAIL' | 'INTERNAL_NOTE'
  | 'SYSTEM_EVENT' | 'REMINDER';

export type ParticipantRole =
  | 'OTA_SUPPORT' | 'OTA_ACCOUNTING' | 'OTA_ACCOUNT_MANAGER'
  | 'HOTEL_RECEPTION_HEAD' | 'HOTEL_OPERATIONS_DIRECTOR'
  | 'HOTEL_REVENUE_MANAGER' | 'HOTEL_ACCOUNTING';

export const disputeRowSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  partner_id: z.string().nullable(),
  reservation_id: z.string().nullable(),
  validation_id: z.string().nullable(),
  reference: z.string(),
  origin: z.enum(['AUTO', 'MANUAL']),
  status: z.enum([
    'DRAFT','SENT','ACKNOWLEDGED','IN_REVIEW','CORRECTED','REJECTED','CLOSED',
  ]),
  subject: z.string(),
  description: z.string().nullable(),
  expected_amount: z.number().nullable(),
  received_amount: z.number().nullable(),
  claimed_amount: z.number().nullable(),
  delta_amount: z.number().nullable(),
  currency: z.string(),
  anomaly_codes: z.array(z.string()).default([]),
  attachments_summary: z.array(z.unknown()).default([]),
  computed_email: z.unknown().nullable(),
  virtual_room_id: z.string().nullable(),
  due_at: z.string().nullable(),
  reminder_step: z.number().int(),
  resolution: z.string().nullable(),
  recovered_amount: z.number().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
export type DisputeRow = z.infer<typeof disputeRowSchema>;

export interface DisputeParticipant {
  role: ParticipantRole;
  display_name: string;
  email: string;
  is_primary?: boolean;
}

export interface DraftEmail {
  to: string[];
  cc: string[];
  subject: string;
  body_text: string;
  body_html: string;
  attachments: { kind: string; filename: string; mime_type: string; preview?: unknown }[];
}

export interface CreateDisputeInput {
  partnerId: string | null;
  reservationId: string | null;
  validationId: string | null;
  origin: DisputeOrigin;
  subject: string;
  description: string | null;
  expectedAmount: number | null;
  receivedAmount: number | null;
  claimedAmount: number | null;
  deltaAmount: number | null;
  currency: string;
  anomalyCodes: string[];
  email: DraftEmail | null;
}

/* --------- Partner reliability (rolling 30d) ---------------------------- */

export const reliabilityRowSchema = z.object({
  hotel_id: z.string(),
  partner_id: z.string().nullable(),
  runs: z.number().int(),
  avg_score_30d: z.number().nullable(),
  auto_count: z.number().int(),
  warning_count: z.number().int(),
  manual_count: z.number().int(),
  quarantine_count: z.number().int(),
  cumulative_delta_30d: z.number().nullable(),
  last_run_at: z.string().nullable(),
}).passthrough();
export type ReliabilityRow = z.infer<typeof reliabilityRowSchema>;
