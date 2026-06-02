/**
 * FLOWTYM — Service d'envoi de communications client (email / WhatsApp).
 *
 * Délègue l'envoi RÉEL aux edge functions `send-email` / `send-whatsapp`, qui
 * lisent la config + les secrets de l'hôtel côté serveur et journalisent dans
 * communication_logs. Le frontend n'accède jamais aux tokens.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  reservationId?: string | null;
  guestId?: string | null;
  templateKind?: string;
}

export interface SendWhatsAppInput {
  to: string;
  text?: string;
  template?: { name: string; language?: string; components?: unknown[] };
  reservationId?: string | null;
  guestId?: string | null;
  templateKind?: string;
}

export interface SendResult {
  success: boolean;
  /** Code machine : 'email_not_configured' | 'whatsapp_not_configured' | 'invalid_phone' | 'send_failed' | ... */
  errorCode?: string;
  /** Message lisible affiché à l'utilisateur. */
  message?: string;
  messageId?: string | null;
}

/**
 * Les edge functions renvoient un corps JSON métier même sur status >= 400.
 * supabase.functions.invoke met l'erreur HTTP dans `error` mais expose aussi
 * le corps via error.context. On extrait toujours un message exploitable.
 */
async function readFnError(error: unknown): Promise<{ errorCode?: string; message?: string }> {
  // FunctionsHttpError expose la Response dans .context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (error as any)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const payload = await ctx.json();
      return { errorCode: payload?.error, message: payload?.message ?? payload?.error };
    } catch {
      /* ignore */
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { message: (error as any)?.message ?? 'Erreur d\'envoi' };
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke('send-email', { body: input });
  if (error) {
    const { errorCode, message } = await readFnError(error);
    return { success: false, errorCode, message };
  }
  return { success: true, messageId: data?.messageId ?? null };
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', { body: input });
  if (error) {
    const { errorCode, message } = await readFnError(error);
    return { success: false, errorCode, message };
  }
  return { success: true, messageId: data?.messageId ?? null };
}

export interface CommunicationLogEntry {
  id: string;
  channel: 'email' | 'whatsapp';
  direction: string;
  to_address: string | null;
  subject: string | null;
  status: 'queued' | 'sent' | 'failed';
  provider: string | null;
  error_message: string | null;
  template_kind: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ListLogsParams {
  reservationId?: string;
  guestId?: string;
  channel?: 'email' | 'whatsapp';
  limit?: number;
}

/** Journal des communications (RLS hôtel). */
export async function listCommunicationLogs(params: ListLogsParams = {}): Promise<CommunicationLogEntry[]> {
  let q = supabase
    .from('communication_logs')
    .select('id, channel, direction, to_address, subject, status, provider, error_message, template_kind, reservation_id, guest_id, sent_at, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(params.limit ?? 50, 200));

  if (params.reservationId) q = q.eq('reservation_id', params.reservationId);
  if (params.guestId) q = q.eq('guest_id', params.guestId);
  if (params.channel) q = q.eq('channel', params.channel);

  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as CommunicationLogEntry[];
}
