/**
 * FLOWTYM — Salon Events Persistence Service
 *
 * STRATÉGIE APPEND-ONLY :
 *   - UPSERT sur clé naturelle (hotel_id, event_name, start_date)
 *   - Événements existants → UPDATE (si futurs, bloqué par RLS si passés)
 *   - Événements absents du nouvel import → PRÉSERVÉS (jamais supprimés)
 *   - Permet : analyses historiques, comparaisons, entraînement modèles prédictifs
 */

import { supabase } from '../lib/supabase';
import type { SalonEvent } from './salons-parser.service';

export interface PersistResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function resolveHotelAndUser(): Promise<{ hotelId: string | null; userId: string | null }> {
  let hotelId: string | null = null;
  let userId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    if (data) hotelId = String(data);
  } catch { /* ignore */ }
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) userId = userData.user.id;
  } catch { /* ignore */ }
  return { hotelId, userId };
}

/**
 * Persiste les événements importés en DB de manière append-only.
 * UPSERT sur clé naturelle (hotel_id, event_name, start_date).
 */
export async function persistSalonEvents(
  events: SalonEvent[],
  fileName: string,
): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const { hotelId, userId } = await resolveHotelAndUser();
  if (!hotelId) {
    result.errors.push('Aucun hôtel résolu (utilisateur non authentifié) — événements non persistés en base.');
    return result;
  }

  // 1. Récupérer existants pour cet hôtel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from('salon_events')
    .select('id, event_name, start_date')
    .eq('hotel_id', hotelId);

  if (fetchErr) {
    result.errors.push(`Lecture existante échouée: ${fetchErr.message}`);
    return result;
  }

  const existingMap = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (existing ?? []) as any[]) {
    const key = `${String(row.event_name).toLowerCase().trim()}|${row.start_date}`;
    existingMap.set(key, row.id);
  }

  // 2. Classifier : à insérer vs à mettre à jour
  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const ev of events) {
    const key = `${ev.name.toLowerCase().trim()}|${ev.startDate}`;
    const existingId = existingMap.get(key);

    const payload: Record<string, unknown> = {
      hotel_id: hotelId,
      event_name: ev.name,
      start_date: ev.startDate,
      end_date: ev.endDate,
      location: ev.location ?? null,
      impact: ev.impact ?? null,
      source: 'excel_import',
      source_file_name: fileName,
      imported_at: new Date().toISOString(),
      imported_by: userId,
    };

    if (existingId) {
      toUpdate.push({ id: existingId, data: payload });
    } else {
      toInsert.push(payload);
    }
  }

  // 3. INSERT en batch
  if (toInsert.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('salon_events').insert(toInsert);
    if (error) {
      result.errors.push(`Insert ${toInsert.length} events: ${error.message}`);
    } else {
      result.inserted = toInsert.length;
    }
  }

  // 4. UPDATE un par un (la RLS bloquera les passés → skipped)
  for (const upd of toUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('salon_events')
      .update(upd.data)
      .eq('id', upd.id);
    if (error) {
      if (error.message?.includes('row-level security') || error.code === '42501') {
        result.skipped++;
      } else {
        result.errors.push(`Update ${upd.id}: ${error.message}`);
      }
    } else {
      result.updated++;
    }
  }

  return result;
}

/**
 * Charge tous les salon events de l'hôtel courant (passés + futurs).
 */
export async function fetchSalonEvents(opts: {
  fromDate?: string;
  toDate?: string;
  futureOnly?: boolean;
} = {}): Promise<SalonEvent[]> {
  const { hotelId } = await resolveHotelAndUser();
  if (!hotelId) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('salon_events')
      .select('event_name, start_date, end_date, location, impact')
      .eq('hotel_id', hotelId)
      .order('start_date', { ascending: true });

    if (opts.futureOnly) {
      q = q.gte('end_date', new Date().toISOString().slice(0, 10));
    }
    if (opts.fromDate) q = q.gte('end_date', opts.fromDate);
    if (opts.toDate) q = q.lte('start_date', opts.toDate);

    const { data, error } = await q.limit(2000);
    if (error) {
      console.warn('[salon-events] fetch failed:', error.message);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({
      name: r.event_name,
      startDate: r.start_date,
      endDate: r.end_date,
      location: r.location ?? undefined,
      impact: r.impact ?? undefined,
    }));
  } catch (err) {
    console.warn('[salon-events] fetch exception:', err);
    return [];
  }
}
