/**
 * FLOWTYM — ODMS reminders queue (J+2 / J+5 / J+10 escalation).
 *
 * `scheduleNextReminder` creates a PENDING row in `ota_dispute_reminders`
 * based on `DisputeReminderEngine`. `markReminderSent` is called by the
 * UI when the user (or a future cron) acknowledges the email has been
 * dispatched.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { z } from 'zod';

import { DisputeReminderEngine } from './engines';
import { DisputeEmailGenerator, type EmailGenerationContext } from './engines';
import type { DraftEmail } from './types';

export const reminderRowSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  dispute_id: z.string(),
  step: z.number().int(),
  due_at: z.string(),
  status: z.enum(['PENDING', 'SENT', 'SKIPPED']),
  email_payload: z.unknown().nullable(),
  sent_at: z.string().nullable(),
  created_at: z.string(),
}).passthrough();
export type ReminderRow = z.infer<typeof reminderRowSchema>;

export async function listReminders(): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from('ota_dispute_reminders')
    .select('*')
    .order('due_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => reminderRowSchema.parse(d) as ReminderRow);
}

export async function listRemindersByDispute(disputeId: string): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from('ota_dispute_reminders')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('due_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => reminderRowSchema.parse(d) as ReminderRow);
}

export async function scheduleNextReminder(
  hotelId: string,
  disputeId: string,
  sentAt: Date,
  currentStep: number,
  emailContext: EmailGenerationContext,
): Promise<ReminderRow | null> {
  const plan = DisputeReminderEngine.computeFromSent(sentAt, currentStep);
  if (!plan.next_due_at) return null;

  const reminderEmail: DraftEmail = DisputeEmailGenerator.build({
    ...emailContext,
    signatureRole: plan.escalation_role
      ? `${emailContext.signatureRole} (relance ${plan.escalation_role})`
      : emailContext.signatureRole,
  });
  reminderEmail.subject = `[RELANCE J+${[2, 5, 10][currentStep] ?? '?'}] ${reminderEmail.subject}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_dispute_reminders') as any;
  const { data, error } = await builder
    .insert({
      hotel_id: hotelId,
      dispute_id: disputeId,
      step: plan.next_step,
      due_at: plan.next_due_at,
      status: 'PENDING',
      email_payload: reminderEmail,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return reminderRowSchema.parse(data) as ReminderRow;
}

export async function markReminderSent(id: string): Promise<ReminderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_dispute_reminders') as any;
  const { data, error } = await builder
    .update({ status: 'SENT', sent_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return reminderRowSchema.parse(data) as ReminderRow;
}

export async function skipReminder(id: string): Promise<ReminderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('ota_dispute_reminders') as any;
  const { data, error } = await builder
    .update({ status: 'SKIPPED' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return reminderRowSchema.parse(data) as ReminderRow;
}

/* ------------------------------------------------------------------ */
/*  Real email send via FastAPI backend → Resend                       */
/* ------------------------------------------------------------------ */

export interface SendReminderResult {
  status: 'sent' | 'already_sent';
  reminder_id: string;
  provider_message_id: string | null;
  recipients: string[];
}

/**
 * Send the reminder's email via the secure backend (Resend).
 * The backend validates the caller's Supabase JWT, scopes to the user's hotel,
 * sends the email, and marks the reminder as SENT in the database.
 */
export async function sendReminderEmail(reminderId: string): Promise<SendReminderResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error('Session expirée — reconnectez-vous.');

  const apiBase = (import.meta.env.VITE_BACKEND_URL as string | undefined)
    ?? (import.meta.env.REACT_APP_BACKEND_URL as string | undefined)
    ?? window.location.origin;
  const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/odms/send-reminder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reminder_id: reminderId }),
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      detail = (j as { detail?: string }).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await resp.json()) as SendReminderResult;
}
