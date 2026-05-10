/**
 * FLOWTYM — ODMS compose helpers.
 *
 * Helpers that glue RIE outputs (validations + anomalies) with partner
 * configuration to produce a ready-to-persist `CreateDisputeInput` and
 * the corresponding `EmailGenerationContext` for the email generator.
 */
import type { Partner } from '@/src/domains/rie/types';
import { DisputeEmailGenerator, type EmailGenerationContext } from './engines';
import type { CreateDisputeInput, DraftEmail } from './types';

export interface ValidationLite {
  id: string;
  reservation_id: string | null;
  partner_id: string | null;
  expected_amount: number | null;
  received_amount: number | null;
  delta_amount: number | null;
  currency: string;
  score: number;
  decision: string;
  collection_type: string | null;
  raw_payload?: Record<string, unknown> | null;
  computation?: Record<string, unknown> | null;
}

export interface AnomalyLite {
  validation_id: string;
  code: string;
  message: string;
}

export interface PartnerExtended extends Partner {
  support_email?: string | null;
  accounting_email?: string | null;
  account_manager_email?: string | null;
  communication_language?: string | null;
}

export interface ComposeInput {
  hotelName: string;
  partner: PartnerExtended | null;
  validation: ValidationLite;
  anomalies: AnomalyLite[];
  signatureName: string;
  signatureRole: string;
}

export interface ComposeResult {
  email: DraftEmail;
  draft: CreateDisputeInput;
  context: EmailGenerationContext;
}

export function composeDisputeFromValidation(input: ComposeInput): ComposeResult {
  const { hotelName, partner, validation, anomalies, signatureName, signatureRole } = input;

  const codes = anomalies
    .filter((a) => a.validation_id === validation.id)
    .map((a) => a.code);

  const expected = validation.expected_amount ?? 0;
  const received = validation.received_amount ?? 0;
  const delta = validation.delta_amount ?? expected - received;
  const claimed = Math.max(0, delta);

  const ctx: EmailGenerationContext = {
    hotelName,
    partnerName: partner?.name ?? 'Partenaire',
    partnerCode: partner?.code ?? '—',
    partnerSupportEmail: partner?.support_email ?? null,
    partnerAccountingEmail: partner?.accounting_email ?? null,
    partnerAccountManagerEmail: partner?.account_manager_email ?? null,
    reservationReference: validation.reservation_id?.slice(0, 8) ?? null,
    reservationOtaReference:
      typeof validation.raw_payload?.['reference'] === 'string'
        ? (validation.raw_payload['reference'] as string)
        : null,
    guestName: null,
    checkIn: null,
    checkOut: null,
    roomNumber: null,
    ratePlan: null,
    nights:
      typeof validation.raw_payload?.['nights'] === 'number'
        ? (validation.raw_payload['nights'] as number)
        : null,
    currency: validation.currency || 'EUR',
    collectionType: validation.collection_type,
    promotionsApplied:
      typeof validation.raw_payload?.['promotion_code'] === 'string'
        ? [validation.raw_payload['promotion_code'] as string]
        : [],
    expectedAmount: expected,
    receivedAmount: received,
    claimedAmount: claimed,
    deltaAmount: delta,
    commissionExpected:
      typeof validation.computation?.['commission_amount'] === 'number'
        ? (validation.computation['commission_amount'] as number)
        : null,
    commissionReceived:
      typeof validation.raw_payload?.['commission_amount'] === 'number'
        ? (validation.raw_payload['commission_amount'] as number)
        : null,
    taxes:
      typeof validation.raw_payload?.['taxes'] === 'number'
        ? (validation.raw_payload['taxes'] as number)
        : null,
    promotionDiscount:
      typeof validation.raw_payload?.['promotion_amount'] === 'number'
        ? (validation.raw_payload['promotion_amount'] as number)
        : null,
    anomalyCodes: codes,
    score: validation.score,
    language: 'fr-FR',
    signatureName,
    signatureRole,
  };

  const email = DisputeEmailGenerator.build(ctx);
  const subject = email.subject;

  const draft: CreateDisputeInput = {
    partnerId: validation.partner_id,
    reservationId: validation.reservation_id,
    validationId: validation.id,
    origin: 'AUTO',
    subject,
    description: DisputeEmailGenerator.summarize(ctx),
    expectedAmount: expected,
    receivedAmount: received,
    claimedAmount: claimed,
    deltaAmount: delta,
    currency: ctx.currency,
    anomalyCodes: codes,
    email,
  };

  return { email, draft, context: ctx };
}
