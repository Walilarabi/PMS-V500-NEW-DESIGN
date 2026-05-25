/**
 * FLOWTYM RMS — Market Intelligence Persistence Service
 *
 * Persiste les recommandations RMS + actions utilisateur + alertes dans
 * Supabase, en best-effort offline-friendly. Toutes les fonctions sont
 * idempotentes : on peut les rejouer sans risque.
 *
 * Pattern :
 *   • upsertRecommendations(recos)       — sync recos générées par le moteur
 *   • recordAction(recoId, action, reason?)— enregistre une décision RM
 *   • upsertAlerts(alerts)               — sync alertes
 *   • acknowledgeAlert(alertId)          — RM acquitte une alerte
 *   • dismissAlert(alertId)              — RM ignore une alerte
 *
 * Tous les appels Supabase passent par le client browser (RLS multi-tenant
 * automatique via la session). Les erreurs réseau sont loggées en console
 * mais n'interrompent pas l'app (UI doit rester réactive).
 */

import { supabase } from '../../lib/supabase';
import type {
  MarketIntelligenceAlert,
  RmsRecommendation,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export type RecommendationAction = 'accept' | 'reject' | 'snooze' | 'apply';

export interface RecordActionInput {
  recommendationId: string;
  action: RecommendationAction;
  reason?: string;
  appliedValue?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAPPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function recommendationToRow(r: RmsRecommendation): Record<string, unknown> {
  return {
    id: r.id,
    target_date: r.targetDate,
    target_end_date: r.targetEndDate ?? null,
    type: r.type,
    severity: r.severity,
    title: r.title,
    suggested_value: r.suggestedValue,
    suggested_unit: r.suggestedUnit,
    causes: r.causes,
    driving_event_ids: r.drivingEventIds,
    confidence: r.confidence,
    compression_snapshot: r.compression ?? null,
    velocity_snapshot: r.velocity ?? null,
    emitted_at: r.emittedAt,
    expires_at: r.expiresAt,
    // status défaut 'pending' (laissé géré côté Postgres)
  };
}

function alertToRow(a: MarketIntelligenceAlert): Record<string, unknown> {
  return {
    id: a.id,
    emitted_at: a.emittedAt,
    level: a.level,
    code: a.code,
    title: a.title,
    detail: a.detail,
    refs: a.refs,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* RECOMMENDATIONS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Upsert idempotent — sync les recommandations dans Supabase. Les recos
 * déjà présentes sont écrasées (sauf champs statut qui sont préservés
 * via le ON CONFLICT côté DB).
 */
export async function upsertRecommendations(
  recos: RmsRecommendation[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (recos.length === 0) return { ok: true, count: 0 };
  try {
    const rows = recos.map(recommendationToRow);
    const { error, count } = await (supabase as any)
      .from('mi_recommendations')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: false, count: 'exact' });
    if (error) throw error;
    return { ok: true, count: count ?? rows.length };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MI] upsertRecommendations failed (offline OK)', err);
    }
    return { ok: false, count: 0, error: String((err as Error)?.message ?? err) };
  }
}

/**
 * Enregistre une action utilisateur (accept/reject/snooze/apply) avec
 * mise à jour du statut de la recommandation dans la même transaction
 * logique (2 appels Supabase — best-effort).
 */
export async function recordAction(
  input: RecordActionInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nextStatus = ({
      accept: 'accepted',
      reject: 'rejected',
      snooze: 'snoozed',
      apply: 'applied',
    } as const)[input.action];

    // 1. Mise à jour statut reco
    const { error: e1 } = await (supabase as any)
      .from('mi_recommendations')
      .update({
        status: nextStatus,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', input.recommendationId);
    if (e1) throw e1;

    // 2. Log action
    const { error: e2 } = await (supabase as any)
      .from('mi_recommendation_actions')
      .insert({
        recommendation_id: input.recommendationId,
        action: input.action,
        reason: input.reason ?? null,
        applied_value: input.appliedValue ?? null,
      });
    if (e2) throw e2;

    return { ok: true };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MI] recordAction failed (offline OK)', err);
    }
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ALERTS                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function upsertAlerts(
  alerts: MarketIntelligenceAlert[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (alerts.length === 0) return { ok: true, count: 0 };
  try {
    const rows = alerts.map(alertToRow);
    const { error, count } = await (supabase as any)
      .from('mi_alerts')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: false, count: 'exact' });
    if (error) throw error;
    return { ok: true, count: count ?? rows.length };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MI] upsertAlerts failed (offline OK)', err);
    }
    return { ok: false, count: 0, error: String((err as Error)?.message ?? err) };
  }
}

export async function acknowledgeAlert(
  alertId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from('mi_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MI] acknowledgeAlert failed (offline OK)', err);
    }
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

export async function dismissAlert(
  alertId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from('mi_alerts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MI] dismissAlert failed (offline OK)', err);
    }
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}
