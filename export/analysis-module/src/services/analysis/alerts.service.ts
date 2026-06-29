/**
 * FLOWTYM — Centre d'alertes (Vague 6)
 *
 * Service pour :
 *   - CRUD des watchers (seuils KPI surveillés)
 *   - Évaluation des watchers (RPC evaluate_alert_watchers)
 *   - Lecture / acquittement des triggers (historique)
 */

import { supabase } from '../../lib/supabase';

export type AlertMetric =
  | 'revpar'
  | 'adr'
  | 'occupancy'
  | 'ca_total'
  | 'cancellation_rate'
  | 'pickup_3d'
  | 'sold_rooms'
  | 'avg_lead_time';

export type AlertOperator = '<' | '<=' | '>' | '>=' | '=';
export type AlertPeriod = 'today' | 'last_7d' | 'last_30d';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertWatcher {
  id: string;
  hotel_id: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  period: AlertPeriod;
  severity: AlertSeverity;
  enabled: boolean;
  notes: string | null;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  last_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface AlertTrigger {
  id: string;
  watcher_id: string;
  hotel_id: string;
  triggered_at: string;
  value: number;
  threshold: number;
  message: string;
  severity: AlertSeverity;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export const METRIC_LABELS: Record<AlertMetric, string> = {
  revpar:            'RevPAR (€)',
  adr:               'ADR (€)',
  occupancy:         'Occupation (%)',
  ca_total:          'CA Total (€)',
  cancellation_rate: "Taux d'annulation (%)",
  pickup_3d:         'Pickup 3 jours',
  sold_rooms:        'Chambres vendues',
  avg_lead_time:     'Lead time moyen (j)',
};

export const PERIOD_LABELS: Record<AlertPeriod, string> = {
  today:    "Aujourd'hui",
  last_7d:  '7 derniers jours',
  last_30d: '30 derniers jours',
};

// ─── CRUD watchers ────────────────────────────────────────────────────────

export async function listWatchers(): Promise<AlertWatcher[]> {
  const { data, error } = await supabase
    .from('analysis_alert_watchers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AlertWatcher[];
}

export async function createWatcher(input: {
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  period: AlertPeriod;
  severity: AlertSeverity;
  enabled?: boolean;
  notes?: string;
}): Promise<AlertWatcher> {
  // Récupérer hotel_id depuis le RPC
  const { data: hotelData } = await (supabase.rpc as any)('get_user_hotel_id');
  const hotel_id = String(hotelData ?? '');
  if (!hotel_id) throw new Error('Hôtel non résolu (auth requise)');

  const { data, error } = await supabase
    .from('analysis_alert_watchers')
    .insert({
      hotel_id,
      name: input.name,
      metric: input.metric,
      operator: input.operator,
      threshold: input.threshold,
      period: input.period,
      severity: input.severity,
      enabled: input.enabled ?? true,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AlertWatcher;
}

export async function updateWatcher(id: string, patch: Partial<Omit<AlertWatcher, 'id' | 'hotel_id' | 'created_at'>>): Promise<AlertWatcher> {
  const { data, error } = await supabase
    .from('analysis_alert_watchers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as AlertWatcher;
}

export async function deleteWatcher(id: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_alert_watchers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function toggleWatcher(id: string, enabled: boolean): Promise<void> {
  await updateWatcher(id, { enabled });
}

// ─── Évaluation ───────────────────────────────────────────────────────────

export interface EvaluationResult {
  watcher_id: string;
  metric: string;
  value: number;
  threshold: number;
  triggered: boolean;
}

export async function evaluateWatchers(): Promise<EvaluationResult[]> {
  const { data, error } = await (supabase.rpc as any)('evaluate_alert_watchers');
  if (error) throw error;
  return (data ?? []) as EvaluationResult[];
}

// ─── Triggers (inbox) ─────────────────────────────────────────────────────

export async function listTriggers(opts: { limit?: number; acknowledgedOnly?: boolean; unackOnly?: boolean } = {}): Promise<AlertTrigger[]> {
  let query = supabase
    .from('analysis_alert_triggers')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.acknowledgedOnly) query = query.eq('acknowledged', true);
  if (opts.unackOnly) query = query.eq('acknowledged', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AlertTrigger[];
}

export async function countUnacknowledged(): Promise<number> {
  const { count, error } = await supabase
    .from('analysis_alert_triggers')
    .select('*', { count: 'exact', head: true })
    .eq('acknowledged', false);
  if (error) return 0;
  return count ?? 0;
}

export async function acknowledgeTrigger(id: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_alert_triggers')
    .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function acknowledgeAll(): Promise<void> {
  const { error } = await supabase
    .from('analysis_alert_triggers')
    .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('acknowledged', false);
  if (error) throw error;
}
