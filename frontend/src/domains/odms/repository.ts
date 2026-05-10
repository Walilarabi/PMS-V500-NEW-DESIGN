/**
 * FLOWTYM — ODMS repository + reliability fetch.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import {
  type CreateDisputeInput,
  disputeRowSchema,
  type DisputeRow,
  type DisputeStatus,
  type DraftEmail,
  reliabilityRowSchema,
  type ReliabilityRow,
} from './types';

/* ------------------------- partner reliability ----------------------- */

export async function loadReliability(): Promise<ReliabilityRow[]> {
  const { data, error } = await supabase.from('partner_reliability_view').select('*');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => reliabilityRowSchema.parse(d) as ReliabilityRow);
}

/* ----------------------------- disputes ------------------------------ */

function genReference(): string {
  const d = new Date();
  const year = d.getFullYear();
  const seq = `${d.getMonth() + 1}${d.getDate()}${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
  return `DSP-${year}-${seq}`;
}

export async function listDisputes(limit = 100): Promise<DisputeRow[]> {
  const { data, error } = await supabase
    .from('ota_disputes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => disputeRowSchema.parse(d) as DisputeRow);
}

export async function getDispute(id: string): Promise<DisputeRow | null> {
  const { data, error } = await supabase
    .from('ota_disputes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data ? (disputeRowSchema.parse(data) as DisputeRow) : null;
}

export async function listDisputeMessages(disputeId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('ota_dispute_messages')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function listDisputeStatusHistory(disputeId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('ota_dispute_status_history')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

interface VirtualRoom { id: string; code: string; }
async function pickVirtualQuarantineRoom(hotelId: string): Promise<VirtualRoom | null> {
  const { data, error } = await supabase
    .from('quarantine_virtual_rooms')
    .select('id, code')
    .eq('hotel_id', hotelId)
    .eq('purpose', 'OTA_DISPUTE')
    .eq('enabled', true)
    .limit(1)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return (data as VirtualRoom) ?? null;
}

export async function createDispute(
  hotelId: string,
  userId: string | null,
  input: CreateDisputeInput,
): Promise<DisputeRow> {
  const room = await pickVirtualQuarantineRoom(hotelId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_disputes') as any;
  const payload = {
    hotel_id: hotelId,
    partner_id: input.partnerId,
    reservation_id: input.reservationId,
    validation_id: input.validationId,
    reference: genReference(),
    origin: input.origin,
    status: 'DRAFT',
    subject: input.subject,
    description: input.description,
    expected_amount: input.expectedAmount,
    received_amount: input.receivedAmount,
    claimed_amount: input.claimedAmount,
    delta_amount: input.deltaAmount,
    currency: input.currency,
    anomaly_codes: input.anomalyCodes,
    attachments_summary: input.email?.attachments ?? [],
    computed_email: input.email,
    virtual_room_id: room?.id ?? null,
    created_by: userId,
  };
  const { data, error } = await builder.insert(payload).select('*').single();
  if (error) throw mapSupabaseError(error);

  // history row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const histBuilder = supabase.from('ota_dispute_status_history') as any;
  await histBuilder.insert({
    hotel_id: hotelId,
    dispute_id: (data as { id: string }).id,
    from_status: null,
    to_status: 'DRAFT',
    reason: input.origin === 'AUTO' ? 'Création automatique suite à anomalie' : 'Création manuelle',
    by_user_id: userId,
  });

  return disputeRowSchema.parse(data) as DisputeRow;
}

export async function changeDisputeStatus(
  disputeId: string,
  hotelId: string,
  from: DisputeStatus,
  to: DisputeStatus,
  reason: string,
  userId: string | null,
  email: DraftEmail | null = null,
): Promise<DisputeRow> {
  // 1) update dispute
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_disputes') as any;
  const updates: Record<string, unknown> = { status: to };
  if (to === 'CLOSED') updates.closed_at = new Date().toISOString();
  if (email) updates.computed_email = email;
  const { data, error } = await builder.update(updates).eq('id', disputeId).select('*').single();
  if (error) throw mapSupabaseError(error);

  // 2) history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const histBuilder = supabase.from('ota_dispute_status_history') as any;
  await histBuilder.insert({
    hotel_id: hotelId,
    dispute_id: disputeId,
    from_status: from,
    to_status: to,
    reason,
    by_user_id: userId,
  });

  // 3) when SENT, log the outbound email as a message + schedule J+2 reminder
  if (to === 'SENT' && email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgBuilder = supabase.from('ota_dispute_messages') as any;
    await msgBuilder.insert({
      hotel_id: hotelId,
      dispute_id: disputeId,
      kind: 'OUTBOUND_EMAIL',
      author_user_id: userId,
      to_addresses: email.to,
      cc_addresses: email.cc,
      subject: email.subject,
      body_text: email.body_text,
      body_html: email.body_html,
      metadata: { attachments: email.attachments },
    });

    // Schedule first reminder J+2 (step=1) — pure time math, no engine import here
    const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remBuilder = supabase.from('ota_dispute_reminders') as any;
    await remBuilder.insert({
      hotel_id: hotelId,
      dispute_id: disputeId,
      step: 1,
      due_at: dueAt,
      status: 'PENDING',
      email_payload: {
        ...email,
        subject: `[RELANCE J+2] ${email.subject}`,
      },
    });
  }

  return disputeRowSchema.parse(data) as DisputeRow;
}


/**
 * Toggle the auto-send pause flag on a dispute. When `paused = true`, pg_cron
 * skips all reminders attached to this dispute (manual send still works).
 */
export async function setDisputeAutoSendPaused(id: string, paused: boolean): Promise<DisputeRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_disputes') as any;
  const { data, error } = await builder
    .update({ auto_send_paused: paused })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return disputeRowSchema.parse(data) as DisputeRow;
}
