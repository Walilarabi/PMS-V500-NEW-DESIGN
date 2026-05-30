/**
 * FLOWTYM — Planning snapshot service.
 *
 * Persiste un état quotidien de l'occupation/revenu pour chaque date cible
 * (J+0..J+N) dans `planning_daily_snapshots`. Permet de calculer le pickup
 * (J vs J-1) : combien de chambres / de revenu se sont ajoutés depuis hier
 * pour une date d'arrivée donnée.
 *
 * - Lecture/écriture Supabase scopées par RLS (`hotel_id = get_user_hotel_id()`).
 * - Calcul du delta = fonction pure, testable unitairement.
 * - Écriture idempotente : upsert sur (hotel_id, snapped_on, target_date).
 *
 * Aucune donnée fictive : les snapshots sont dérivés des KPIs réels.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import type { DayKpi } from './planning-kpi.service';
import { toIsoDate } from './planning-kpi.service';

export interface SnapshotRow {
  hotel_id: string;
  snapped_on: string;       // date YYYY-MM-DD à laquelle la photo a été prise
  target_date: string;      // date cible (arrivée) photographiée
  rooms_total: number;
  rooms_occupied: number;
  revenue_total: number;
  arrivals_count: number;
  departures_count: number;
}

/** Pickup d'une date cible : delta occupation + revenu entre aujourd'hui et hier. */
export interface PickupDelta {
  target_date: string;
  /** Chambres gagnées (>0) ou perdues (<0) depuis hier. */
  rooms: number;
  /** Revenu gagné (>0) ou perdu (<0) depuis hier. */
  revenue: number;
  /** true si aucune photo de référence (hier) n'existe → pickup indéterminé. */
  noBaseline: boolean;
}

/** Décale une date ISO de `n` jours (n négatif = passé). */
export function shiftIso(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return toIsoDate(dt);
}

/**
 * Calcule le pickup pour chaque date cible à partir des photos d'aujourd'hui
 * et d'hier. Fonction pure — aucune dépendance réseau.
 *
 * @param today  snapshots pris aujourd'hui (snapped_on = today)
 * @param prior  snapshots pris hier (snapped_on = yesterday)
 */
export function computePickup(today: SnapshotRow[], prior: SnapshotRow[]): PickupDelta[] {
  const priorByTarget = new Map<string, SnapshotRow>();
  for (const s of prior) priorByTarget.set(s.target_date, s);

  return today.map((cur) => {
    const ref = priorByTarget.get(cur.target_date);
    if (!ref) {
      return { target_date: cur.target_date, rooms: 0, revenue: 0, noBaseline: true };
    }
    return {
      target_date: cur.target_date,
      rooms: cur.rooms_occupied - ref.rooms_occupied,
      revenue: round2(cur.revenue_total - ref.revenue_total),
      noBaseline: false,
    };
  });
}

/** Convertit un DayKpi en ligne snapshot pour une date de prise donnée. */
export function kpiToSnapshotRow(hotelId: string, snappedOn: string, day: DayKpi): SnapshotRow {
  return {
    hotel_id: hotelId,
    snapped_on: snappedOn,
    target_date: day.date,
    rooms_total: day.totalRooms,
    rooms_occupied: day.occupied,
    revenue_total: round2(day.revenue),
    arrivals_count: day.arrivals,
    departures_count: day.departures,
  };
}

/**
 * Lit les snapshots pris à une date donnée, sur une plage de dates cibles.
 */
export async function fetchSnapshots(
  snappedOn: string,
  targetStart: string,
  targetEnd: string,
): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from('planning_daily_snapshots')
    .select('hotel_id, snapped_on, target_date, rooms_total, rooms_occupied, revenue_total, arrivals_count, departures_count')
    .eq('snapped_on', snappedOn)
    .gte('target_date', targetStart)
    .lte('target_date', targetEnd)
    .order('target_date', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as SnapshotRow[];
}

/**
 * Écrit (upsert) un lot de snapshots en une seule requête.
 * Idempotent grâce à la contrainte unique (hotel_id, snapped_on, target_date).
 */
export async function upsertSnapshots(rows: SnapshotRow[]): Promise<void> {
  if (rows.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('planning_daily_snapshots')
    .upsert(rows, { onConflict: 'hotel_id,snapped_on,target_date' });
  if (error) throw mapSupabaseError(error);
}

/**
 * Vérifie si un snapshot a déjà été pris aujourd'hui (n'importe quelle cible).
 * Évite de réécrire à chaque navigation : 1 photo / jour suffit pour le pickup.
 */
export async function hasSnapshotForDate(snappedOn: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('planning_daily_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('snapped_on', snappedOn);
  if (error) throw mapSupabaseError(error);
  return (count ?? 0) > 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
