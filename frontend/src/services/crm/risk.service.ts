/**
 * FLOWTYM — Risk & Satisfaction Service (Wave C5)
 */

import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestIncident {
  id:            string;
  hotel_id:      string;
  guest_id:      string;
  type:          string;
  description:   string | null;
  incident_date: string;
  created_by:    string | null;
  created_at:    string;
}

export interface GuestFlagInput {
  guest_id:           string;
  blacklisted:        boolean;
  risk_level:         string;
  vip:                boolean;
  notes:              string | null;
  satisfaction_score: number | null;
}

export interface SatisfactionOverview {
  total_scored: number;
  avg_score:    number | null;
  nps:          number | null;
  promoters:    number;
  passives:     number;
  detractors:   number;
  distribution: { label: string; count: number }[];
}

export const INCIDENT_TYPES: { key: string; label: string }[] = [
  { key: 'payment_issue', label: 'Incident paiement' },
  { key: 'behavior',      label: 'Comportement' },
  { key: 'damage',        label: 'Dommages' },
  { key: 'no_show',       label: 'No-show' },
  { key: 'complaint',     label: 'Réclamation' },
  { key: 'other',         label: 'Autre' },
];

export const RISK_LEVELS: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'low',      label: 'Faible',   color: '#10B981', bg: '#ECFDF5' },
  { key: 'medium',   label: 'Moyen',    color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'high',     label: 'Élevé',    color: '#F97316', bg: '#FFF7ED' },
  { key: 'critical', label: 'Critique', color: '#EF4444', bg: '#FEF2F2' },
];

// ─── RPCs ──────────────────────────────────────────────────────────────────────

export async function flagGuest(input: GuestFlagInput): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_flag_guest', {
    p_guest_id:           input.guest_id,
    p_blacklisted:        input.blacklisted,
    p_risk_level:         input.risk_level,
    p_vip:                input.vip,
    p_notes:              input.notes,
    p_satisfaction_score: input.satisfaction_score,
  });
  if (error) throw error;
}

export async function addIncident(params: {
  guest_id:      string;
  type:          string;
  description:   string;
  incident_date: string;
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crm_add_incident', {
    p_guest_id:      params.guest_id,
    p_type:          params.type,
    p_description:   params.description,
    p_incident_date: params.incident_date,
  });
  if (error) throw error;
  return data as string;
}

export async function listIncidents(guestId: string): Promise<GuestIncident[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_incidents', {
    p_guest_id: guestId,
  });
  if (error) return [];
  return (data ?? []) as GuestIncident[];
}

export async function getSatisfactionOverview(): Promise<SatisfactionOverview> {
  const { data, error } = await (supabase.rpc as any)('crm_satisfaction_overview');
  if (error) throw error;
  return data as SatisfactionOverview;
}
