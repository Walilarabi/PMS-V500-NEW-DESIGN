/**
 * FLOWTYM — Service Conversations (socle L2).
 *
 * Lecture de la nouvelle architecture Conversations (threads / messages /
 * participants) construite EN PARALLÈLE de communication_logs.
 *
 * ⚠️ NON BRANCHÉ aux écrans existants. Ce module est le socle du futur Journal
 * unifié (L3) : il sait déjà restituer une timeline chronologique multi-canal
 * (email + SMS + WhatsApp). Les écrans actuels continuent d'utiliser
 * communicationService / communication_logs sans changement.
 *
 * Sécurité : toutes les lectures sont isolées par hôtel via la RLS
 * (hotel_id = get_user_hotel_id()). Aucun secret n'est exposé.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConversationChannel = 'email' | 'sms' | 'whatsapp' | 'internal';
export type ConversationDirection = 'inbound' | 'outbound';
export type ConversationMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type ConversationStatus = 'open' | 'snoozed' | 'closed';

export interface ConversationThread {
  id: string;
  channel: ConversationChannel;
  contact_address: string;
  guest_id: string | null;
  reservation_id: string | null;
  subject: string | null;
  status: ConversationStatus;
  assigned_to: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: ConversationDirection | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  thread_id: string;
  channel: ConversationChannel;
  direction: ConversationDirection;
  status: ConversationMessageStatus;
  guest_id: string | null;
  reservation_id: string | null;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  template_kind: string | null;
  provider: string | null;
  error_message: string | null;
  communication_log_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ConversationParticipant {
  id: string;
  thread_id: string;
  role: 'guest' | 'staff' | 'system' | 'external';
  guest_id: string | null;
  user_id: string | null;
  display_name: string | null;
  address: string | null;
}

const THREAD_COLS =
  'id, channel, contact_address, guest_id, reservation_id, subject, status, assigned_to, last_message_at, last_message_preview, last_direction, unread_count, created_at, updated_at';
const MESSAGE_COLS =
  'id, thread_id, channel, direction, status, guest_id, reservation_id, from_address, to_address, subject, body, template_kind, provider, error_message, communication_log_id, sent_at, delivered_at, read_at, created_at';

// ─── Lectures ────────────────────────────────────────────────────────────────

export interface ListThreadsParams {
  guestId?: string;
  reservationId?: string;
  channel?: ConversationChannel;
  status?: ConversationStatus;
  limit?: number;
}

/** Liste les conversations (les plus récentes d'abord). */
export async function listThreads(params: ListThreadsParams = {}): Promise<ConversationThread[]> {
  let q = supabase
    .from('conversation_threads')
    .select(THREAD_COLS)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(params.limit ?? 50, 200));

  if (params.guestId) q = q.eq('guest_id', params.guestId);
  if (params.reservationId) q = q.eq('reservation_id', params.reservationId);
  if (params.channel) q = q.eq('channel', params.channel);
  if (params.status) q = q.eq('status', params.status);

  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as ConversationThread[];
}

/** Messages d'un thread, dans l'ordre chronologique (ancien → récent). */
export async function listMessages(threadId: string, limit = 200): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select(MESSAGE_COLS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(Math.min(limit, 500));
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as ConversationMessage[];
}

export interface UnifiedTimelineParams {
  guestId?: string;
  reservationId?: string;
  channels?: ConversationChannel[];
  /** ancien → récent par défaut (timeline de lecture). */
  ascending?: boolean;
  limit?: number;
}

/**
 * Timeline unifiée multi-canal (email + SMS + WhatsApp) pour un client ou une
 * réservation — socle du futur Journal unifié (L3). Une seule liste, triée.
 */
export async function listUnifiedTimeline(params: UnifiedTimelineParams = {}): Promise<ConversationMessage[]> {
  let q = supabase
    .from('conversation_messages')
    .select(MESSAGE_COLS)
    .order('created_at', { ascending: params.ascending ?? true })
    .limit(Math.min(params.limit ?? 100, 500));

  if (params.guestId) q = q.eq('guest_id', params.guestId);
  if (params.reservationId) q = q.eq('reservation_id', params.reservationId);
  if (params.channels && params.channels.length > 0) q = q.in('channel', params.channels);

  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as ConversationMessage[];
}

/** Participants d'un thread. */
export async function listParticipants(threadId: string): Promise<ConversationParticipant[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('id, thread_id, role, guest_id, user_id, display_name, address')
    .eq('thread_id', threadId);
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as ConversationParticipant[];
}

// ─── Écriture (find-or-create via RPC SECURITY DEFINER) ───────────────────────

export interface GetOrCreateThreadInput {
  channel: ConversationChannel;
  contactAddress: string;
  guestId?: string | null;
  reservationId?: string | null;
  subject?: string | null;
}

/**
 * Récupère ou crée le thread (clé naturelle hôtel/canal/contact) côté serveur.
 * Réservé au futur chat interne / aux flux staff ; les envois email/WhatsApp
 * créent déjà leur thread via les edge functions (dual-write).
 */
export async function getOrCreateThread(input: GetOrCreateThreadInput): Promise<string> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>)('conversation_get_or_create_thread', {
    p_channel: input.channel,
    p_contact_address: input.contactAddress,
    p_guest_id: input.guestId ?? null,
    p_reservation_id: input.reservationId ?? null,
    p_subject: input.subject ?? null,
  });
  if (error) throw mapSupabaseError(error);
  return data as string;
}
