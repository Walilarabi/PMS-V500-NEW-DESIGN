/**
 * FLOWTYM RMS — Events Repository (Supabase)
 *
 * Couche d'accès données pour hotel_rms_events.
 * Isolation hôtel via RLS (get_user_hotel_id côté serveur).
 * Audit trail automatique via trigger DB.
 *
 * Design :
 *   • Toutes les opérations sont fire-and-forget safe : elles rejettent
 *     avec une Error typée plutôt que de crasher silencieusement.
 *   • Le store eventsStore reste la source de vérité UI (localStorage).
 *     Ce service est le miroir Supabase du store.
 */

import { supabase } from '../../lib/supabase';
import type { RMSMarketEvent } from '../../types/events';

// ─── Types internes ───────────────────────────────────────────────────────

interface DbRow {
  id: string;
  hotel_id: string;
  payload: RMSMarketEvent;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventsLoadResult {
  events: RMSMarketEvent[];
  hotelId: string;
  loadedAt: string;
}

// ─── Résolution hotel_id ──────────────────────────────────────────────────

let _cachedHotelId: string | null = null;

async function resolveHotelId(): Promise<string | null> {
  if (_cachedHotelId) return _cachedHotelId;
  try {
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    if (data) { _cachedHotelId = data as string; }
    return _cachedHotelId;
  } catch {
    return null;
  }
}

/** Invalide le cache (ex: après reconnexion). */
export function clearHotelIdCache() {
  _cachedHotelId = null;
}

// ─── Lecture ──────────────────────────────────────────────────────────────

/**
 * Charge tous les événements actifs (non soft-deleted) pour l'hôtel courant.
 * Retourne [] si pas d'auth ou pas de données (pas d'exception).
 */
export async function loadEventsFromSupabase(): Promise<EventsLoadResult | null> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('hotel_rms_events')
    .select('id, hotel_id, payload, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[eventsRepository] loadEventsFromSupabase:', error.message);
    return null;
  }

  const rows = (data ?? []) as DbRow[];
  const events = rows.map((r) => ({
    ...r.payload,
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })) as RMSMarketEvent[];

  return { events, hotelId, loadedAt: new Date().toISOString() };
}

// ─── Création ─────────────────────────────────────────────────────────────

export async function createEventInSupabase(
  event: RMSMarketEvent,
): Promise<{ ok: boolean; error?: string }> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return { ok: false, error: 'Pas de hotel_id — auth requise' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('hotel_rms_events').insert({
    id: event.id,
    hotel_id: hotelId,
    payload: event,
  });

  if (error) {
    console.warn('[eventsRepository] createEventInSupabase:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── Modification ─────────────────────────────────────────────────────────

export async function updateEventInSupabase(
  id: string,
  event: RMSMarketEvent,
): Promise<{ ok: boolean; error?: string }> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return { ok: false, error: 'Pas de hotel_id — auth requise' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('hotel_rms_events')
    .update({ payload: event })
    .eq('id', id)
    .eq('hotel_id', hotelId);

  if (error) {
    console.warn('[eventsRepository] updateEventInSupabase:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── Suppression (soft delete) ────────────────────────────────────────────

export async function deleteEventFromSupabase(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return { ok: false, error: 'Pas de hotel_id — auth requise' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('hotel_rms_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hotel_id', hotelId);

  if (error) {
    console.warn('[eventsRepository] deleteEventFromSupabase:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── Upsert batch (import) ────────────────────────────────────────────────

/**
 * Upsert batch via RPC — utilisé après import XLS / recherche live.
 * Idempotent : re-upserter le même événement ne crée pas de doublon.
 */
export async function batchUpsertEventsInSupabase(
  events: RMSMarketEvent[],
): Promise<{ ok: boolean; upserted: number; error?: string }> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return { ok: false, upserted: 0, error: 'Pas de hotel_id' };
  if (events.length === 0) return { ok: true, upserted: 0 };

  const items = events.map((e) => ({ id: e.id, payload: e }));

  const { data, error } = await (supabase.rpc as any)('upsert_hotel_rms_events', {
    p_hotel_id: hotelId,
    p_events: JSON.stringify(items),
  });

  if (error) {
    console.warn('[eventsRepository] batchUpsertEventsInSupabase:', error.message);
    return { ok: false, upserted: 0, error: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, upserted: row?.upserted_count ?? events.length };
}

// ─── Audit trail ─────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number;
  event_id: string;
  action: 'created' | 'updated' | 'deleted';
  performed_by: string | null;
  performed_at: string;
  old_payload: RMSMarketEvent | null;
  new_payload: RMSMarketEvent | null;
}

export async function loadAuditTrailForEvent(
  eventId: string,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('hotel_rms_events_audit')
    .select('id, event_id, action, performed_by, performed_at, old_payload, new_payload')
    .eq('event_id', eventId)
    .order('performed_at', { ascending: false });

  if (error) {
    console.warn('[eventsRepository] loadAuditTrail:', error.message);
    return [];
  }
  return (data ?? []) as AuditEntry[];
}
