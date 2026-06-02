/**
 * FLOWTYM — Service badges client (persistance réelle + historique).
 *
 * Écriture via la RPC SECURITY DEFINER `set_guest_badges` : met à jour
 * guests.badges, dérive vip/blacklisted, et historise dans guest_badge_history.
 * L'isolation hotel_id est validée côté serveur (RLS + RPC).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { normalizeBadges, type BadgeKey } from './badges';

export interface BadgeHistoryEntry {
  id: string;
  guest_id: string;
  reservation_id: string | null;
  old_badges: string[];
  new_badges: string[];
  changed_by: string | null;
  source: string;
  changed_at: string;
}

/**
 * Enregistre les badges d'un client. Retourne la liste normalisée persistée.
 * @throws DomainError si le client n'existe pas / n'appartient pas à l'hôtel actif.
 */
export async function setGuestBadges(params: {
  guestId: string;
  badges: BadgeKey[];
  reservationId?: string | null;
  source?: string;
}): Promise<BadgeKey[]> {
  const { guestId, badges, reservationId, source } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('set_guest_badges', {
    p_guest_id: guestId,
    p_badges: badges,
    p_reservation_id: reservationId ?? null,
    p_source: source ?? 'flowday',
  });
  if (error) throw mapSupabaseError(error);
  return normalizeBadges((data as string[] | null) ?? badges);
}

/** Historique des changements de badge d'un client (plus récent d'abord). */
export async function listBadgeHistory(guestId: string, limit = 20): Promise<BadgeHistoryEntry[]> {
  const { data, error } = await supabase
    .from('guest_badge_history')
    .select('id, guest_id, reservation_id, old_badges, new_badges, changed_by, source, changed_at')
    .eq('guest_id', guestId)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as BadgeHistoryEntry[];
}
