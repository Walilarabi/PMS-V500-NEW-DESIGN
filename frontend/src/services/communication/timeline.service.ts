/**
 * FLOWTYM — Service du Journal Unifié des communications (L3).
 *
 * Lecture de la timeline chronologique agrégée côté serveur (RPC
 * communication_timeline) : messages (email/SMS/WhatsApp, in/out), historique
 * communication_logs, actions CRM (badges, incidents) et notes internes — le
 * tout normalisé en une seule liste triée.
 *
 * Données réelles uniquement (aucun mock). Isolation hôtel garantie côté RPC.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export type TimelineEntryType = 'message' | 'badge' | 'note' | 'incident';

export interface TimelineAttachment {
  name?: string;
  url?: string;
  mime?: string;
  size?: number;
}

export interface TimelineEntry {
  entry_type: TimelineEntryType;
  entry_id: string;
  occurred_at: string;
  /** email | sms | whatsapp | internal | crm */
  channel: string | null;
  /** inbound | outbound | null */
  direction: string | null;
  status: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  subject: string | null;
  body: string | null;
  contact_address: string | null;
  attachments: TimelineAttachment[];
  metadata: Record<string, unknown>;
}

export interface TimelineScope {
  guestId?: string | null;
  reservationId?: string | null;
}

export interface FetchTimelineParams extends TimelineScope {
  /** Taille de page (défaut 50, max 200). */
  limit?: number;
  /** Keyset : ne renvoyer que les entrées strictement avant cet ISO timestamp. */
  before?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;

/** Récupère une page de la timeline unifiée (la plus récente d'abord). */
export async function fetchCommunicationTimeline(params: FetchTimelineParams): Promise<TimelineEntry[]> {
  if (!params.guestId && !params.reservationId) return [];
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('communication_timeline', {
    p_guest_id: params.guestId ?? null,
    p_reservation_id: params.reservationId ?? null,
    p_limit: Math.min(params.limit ?? 50, 200),
    p_before: params.before ?? null,
  });
  if (error) throw mapSupabaseError(error);
  return ((data ?? []) as TimelineEntry[]).map((e) => ({
    ...e,
    attachments: Array.isArray(e.attachments) ? e.attachments : [],
    metadata: (e.metadata ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Résout les UUID réels (réservation + client) à partir d'une référence
 * lisible, pour les vues legacy qui ne propagent pas les UUID (ex. Planning).
 * RLS hôtel appliquée. Renvoie null si 0 ou plusieurs correspondances
 * (jamais de donnée ambiguë → jamais de faux rattachement).
 */
export async function resolveReservationRefIds(
  reference: string,
): Promise<{ reservationId: string; guestId: string | null } | null> {
  if (!reference) return null;
  const { data, error } = await supabase
    .from('reservations')
    .select('id, guest_id')
    .eq('reference', reference)
    .limit(2);
  if (error || !data || data.length !== 1) return null;
  const row = data[0] as { id: string; guest_id: string | null };
  return { reservationId: row.id, guestId: row.guest_id ?? null };
}

export interface AddInternalNoteParams extends TimelineScope {
  body: string;
}

/** Crée une note interne rattachée au client et/ou à la réservation. */
export async function addInternalNote(params: AddInternalNoteParams): Promise<string> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('add_internal_note', {
    p_guest_id: params.guestId ?? null,
    p_reservation_id: params.reservationId ?? null,
    p_body: params.body,
  });
  if (error) throw mapSupabaseError(error);
  return data as string;
}
