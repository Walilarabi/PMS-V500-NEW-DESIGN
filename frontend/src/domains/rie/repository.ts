/**
 * FLOWTYM — RIE repository (Supabase access).
 *
 * Loads the full RIE configuration once and exposes mutations to persist
 * validations, anomalies, payouts and quarantine entries. RLS guarantees
 * hotel isolation.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import {
  partnerSchema,
  partnerPaymentModelSchema,
  partnerCommissionSchema,
  partnerPromotionSchema,
  scoringRuleSchema,
  type Partner,
  type PartnerPaymentModel,
  type PartnerCommission,
  type PartnerPromotion,
  type ScoringRule,
  type ValidationOutcome,
  type OtaPayload,
} from './types';
import type { CurrencyRate, RIEConfiguration } from './engines';

/* ------------------------------------------------------------------------- */

export async function loadConfiguration(): Promise<RIEConfiguration> {
  const [partners, paymentModels, commissions, promotions, scoringRules, fx] = await Promise.all([
    supabase.from('partners').select('*'),
    supabase.from('partner_payment_models').select('*'),
    supabase.from('partner_commissions').select('*'),
    supabase.from('partner_promotions').select('*'),
    supabase.from('scoring_rules').select('*'),
    supabase.from('currency_rates').select('*'),
  ]);

  const errors = [partners.error, paymentModels.error, commissions.error, promotions.error, scoringRules.error, fx.error].filter(Boolean);
  if (errors.length) throw mapSupabaseError(errors[0]!);

  return {
    partners: (partners.data ?? []).map((d) => partnerSchema.parse(d) as Partner),
    paymentModels: (paymentModels.data ?? []).map((d) => partnerPaymentModelSchema.parse(d) as PartnerPaymentModel),
    commissions: (commissions.data ?? []).map((d) => partnerCommissionSchema.parse(d) as PartnerCommission),
    promotions: (promotions.data ?? []).map((d) => partnerPromotionSchema.parse(d) as PartnerPromotion),
    scoringRules: (scoringRules.data ?? []).map((d) => scoringRuleSchema.parse(d) as ScoringRule),
    currencyRates: (fx.data ?? []).map((d) => ({
      from_currency: (d as { from_currency: string }).from_currency,
      to_currency: (d as { to_currency: string }).to_currency,
      rate: Number((d as { rate: number }).rate),
      observed_at: (d as { observed_at: string }).observed_at,
    })) as CurrencyRate[],
  };
}

/* ------------------------------------------------------------------------- */
/*                       Persisting a validation run                         */
/* ------------------------------------------------------------------------- */

export interface PersistedValidation {
  id: string;
  decision: ValidationOutcome['decision'];
  score: number;
}

export async function persistValidation(
  hotelId: string,
  payload: OtaPayload,
  outcome: ValidationOutcome,
  reservationId: string | null,
): Promise<PersistedValidation> {
  // 1) reservation_validations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('reservation_validations') as any;
  const { data, error } = await builder
    .insert({
      hotel_id: hotelId,
      reservation_id: reservationId,
      partner_id: outcome.partner_id,
      payment_model_id: outcome.payment_model_id,
      raw_payload: payload,
      computation: outcome.breakdown,
      rules_used: outcome.breakdown.rules_applied,
      expected_amount: outcome.breakdown.expected_amount,
      received_amount: outcome.breakdown.received_amount,
      delta_amount: outcome.breakdown.delta_amount,
      delta_pct: outcome.breakdown.delta_pct,
      currency: outcome.currency,
      score: outcome.score,
      decision: outcome.decision,
      collection_type: outcome.breakdown.collection_type,
    })
    .select('id, score, decision')
    .single();
  if (error) throw mapSupabaseError(error);
  const validationId = (data as { id: string }).id;

  // 2) anomaly_reports (batch)
  if (outcome.anomalies.length > 0) {
    const rows = outcome.anomalies.map((a) => ({
      hotel_id: hotelId,
      validation_id: validationId,
      reservation_id: reservationId,
      partner_id: outcome.partner_id,
      code: a.code,
      severity: a.severity,
      message: a.message,
      delta_amount: a.delta_amount ?? null,
      delta_pct: a.delta_pct ?? null,
      evidence: a.evidence ?? {},
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ab = supabase.from('anomaly_reports') as any;
    const { error: anomalyErr } = await ab.insert(rows);
    if (anomalyErr) throw mapSupabaseError(anomalyErr);
  }

  // 3) payout_calculations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pb = supabase.from('payout_calculations') as any;
  const { error: payoutErr } = await pb.insert({
    hotel_id: hotelId,
    validation_id: validationId,
    reservation_id: reservationId,
    partner_id: outcome.partner_id,
    base_amount: outcome.breakdown.base_amount,
    promotion_amount: outcome.breakdown.promotion_amount,
    tax_amount: outcome.breakdown.tax_amount,
    commission_amount: outcome.breakdown.commission_amount,
    fx_adjustment: outcome.breakdown.fx_adjustment,
    rounding_amount: outcome.breakdown.rounding_amount,
    expected_payout: outcome.breakdown.expected_amount - outcome.breakdown.commission_amount,
    received_payout: payload.expected_payout ?? null,
    currency: outcome.currency,
  });
  if (payoutErr) throw mapSupabaseError(payoutErr);

  // 4) quarantine_reservations if needed
  if (outcome.decision === 'QUARANTINE' && reservationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qb = supabase.from('quarantine_reservations') as any;
    await qb.insert({
      hotel_id: hotelId,
      reservation_id: reservationId,
      validation_id: validationId,
      reason: outcome.anomalies.map((a) => `${a.code}: ${a.message}`).join('; ').slice(0, 1000) || 'Score critique',
      history: [
        { at: new Date().toISOString(), action: 'CREATED', reason: 'Validation score below threshold' },
      ],
    });
  }

  return { id: validationId, decision: outcome.decision, score: outcome.score };
}

/* ------------------------------------------------------------------------- */
/*                        Read helpers (dashboard)                           */
/* ------------------------------------------------------------------------- */

export async function listRecentValidations(limit = 50): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('reservation_validations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function listOpenAnomalies(limit = 100): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('anomaly_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function listQuarantine(limit = 100): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('quarantine_reservations')
    .select('*')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function resolveQuarantine(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reason: string,
  userId: string | null,
): Promise<void> {
  const event = {
    at: new Date().toISOString(),
    action: status,
    reason,
    by: userId,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.rpc('jsonb_array_append');
  // direct update without RPC for simplicity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upd = supabase.from('quarantine_reservations') as any;
  const { error } = await upd
    .update({
      status,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      history: [event],
    })
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
  // suppress unused warning
  void builder;
}
