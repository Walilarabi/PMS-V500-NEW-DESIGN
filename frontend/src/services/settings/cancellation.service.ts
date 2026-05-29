/**
 * FLOWTYM — Conditions d'annulation (cancellation_policies).
 *
 * CRUD Supabase (RLS hotel_id) + formatage du résumé lisible + calcul réel
 * de la pénalité selon la base de calcul. Aucun localStorage métier.
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PenaltyType = 'percentage' | 'fixed_amount';
export type PenaltyBase = 'first_night' | 'total_stay' | 'cancelled_amount' | 'remaining_due' | 'paid_amount' | 'fixed_amount';

export interface CancellationPolicy {
  id: string;
  hotel_id?: string;
  name: string;
  code: string | null;
  free_until_hours: number;
  penalty_type: PenaltyType;
  penalty_value: number;
  penalty_base: PenaltyBase;
  currency: string;
  applies_from: string | null;
  applies_until: string | null;
  is_active: boolean;
}

export const PENALTY_BASE_LABELS: Record<PenaltyBase, string> = {
  first_night: '1ère nuit',
  total_stay: 'montant total du séjour',
  cancelled_amount: 'montant annulé',
  remaining_due: 'montant restant dû',
  paid_amount: 'montant déjà payé',
  fixed_amount: 'frais fixes',
};

/** Tournures avec l'article correct pour le résumé. */
const PENALTY_BASE_PHRASE: Record<PenaltyBase, string> = {
  first_night: 'de la 1ère nuit',
  total_stay: 'du montant total du séjour',
  cancelled_amount: 'du montant annulé',
  remaining_due: 'du montant restant dû',
  paid_amount: 'du montant déjà payé',
  fixed_amount: 'de frais fixes',
};

/** Résumé lisible : « 100 % de la 1ère nuit », « 100 € de frais fixes »… */
export function formatPolicySummary(p: Pick<CancellationPolicy, 'penalty_type' | 'penalty_value' | 'penalty_base' | 'currency'>): string {
  if (p.penalty_type === 'fixed_amount') {
    return `${p.penalty_value} ${p.currency} de frais fixes`;
  }
  return `${p.penalty_value} % ${PENALTY_BASE_PHRASE[p.penalty_base] ?? `de ${p.penalty_base}`}`;
}

/** Contexte financier d'une réservation pour calculer la pénalité réelle. */
export interface PenaltyContext {
  firstNightAmount: number;
  totalStayAmount: number;
  cancelledAmount: number;
  remainingDue: number;
  paidAmount: number;
}

/** Calcule la pénalité réelle en montant (devise de la policy). */
export function computePenalty(p: Pick<CancellationPolicy, 'penalty_type' | 'penalty_value' | 'penalty_base'>, ctx: PenaltyContext): number {
  if (p.penalty_type === 'fixed_amount') return p.penalty_value;
  const base: Record<PenaltyBase, number> = {
    first_night: ctx.firstNightAmount,
    total_stay: ctx.totalStayAmount,
    cancelled_amount: ctx.cancelledAmount,
    remaining_due: ctx.remainingDue,
    paid_amount: ctx.paidAmount,
    fixed_amount: 0,
  };
  return Math.round(((base[p.penalty_base] ?? 0) * p.penalty_value / 100) * 100) / 100;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function listPolicies(): Promise<CancellationPolicy[]> {
  const hid = await resolveHotelId();
  if (!hid) return [];
  const { data } = await sb.from('cancellation_policies').select('*').eq('hotel_id', hid).order('name');
  return data ?? [];
}

export async function upsertPolicy(p: Partial<CancellationPolicy> & { name: string }): Promise<{ error: string | null }> {
  const hid = await resolveHotelId();
  if (!hid) return { error: 'Hôtel introuvable — reconnectez-vous.' };
  const payload: Record<string, unknown> = {
    hotel_id: hid, name: p.name, code: p.code || null,
    free_until_hours: p.free_until_hours ?? 0,
    penalty_type: p.penalty_type ?? 'percentage',
    penalty_value: p.penalty_value ?? 0,
    // En montant fixe, la base est forcée à 'fixed_amount'
    penalty_base: p.penalty_type === 'fixed_amount' ? 'fixed_amount' : (p.penalty_base ?? 'first_night'),
    currency: p.currency ?? 'EUR',
    applies_from: p.applies_from || null,
    applies_until: p.applies_until || null,
    is_active: p.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  if (p.id) payload.id = p.id;
  const { error } = await sb.from('cancellation_policies').upsert(payload, { onConflict: 'hotel_id,name' });
  return { error: error?.message ?? null };
}

export async function deletePolicy(id: string): Promise<{ error: string | null }> {
  const { error } = await sb.from('cancellation_policies').delete().eq('id', id);
  return { error: error?.message ?? null };
}
