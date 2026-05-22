/**
 * FLOWTYM — Service Relances (Vague F5)
 *
 * Workflow de relances automatiques (dunning) : modèles configurables,
 * synchronisation des débiteurs, file de relances dues, campagne
 * automatique, envoi manuel et historique.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────

export type DunningChannel = 'email' | 'sms' | 'postal';
export type DunningTone = 'courteous' | 'firm' | 'formal';
export type DebtorStatus = 'open' | 'partial' | 'paid' | 'written_off' | 'disputed';

export interface DunningTemplate {
  id: string;
  hotel_id: string;
  level: number;
  name: string;
  trigger_days: number;
  channel: DunningChannel;
  subject: string;
  body: string;
  tone: DunningTone;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DunningDebtor {
  debtor_id: string;
  reservation_id: string | null;
  guest_name: string;
  guest_email: string | null;
  company_name: string | null;
  reference: string | null;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  days_overdue: number;
  status: DebtorStatus;
  reminder_count: number;
  last_reminder_at: string | null;
  next_level: number;
  next_template: string | null;
  next_channel: DunningChannel | null;
  next_trigger_days: number | null;
  is_due: boolean;
}

export interface DunningQueueItem {
  debtor_id: string;
  guest_name: string;
  company_name: string | null;
  reference: string | null;
  balance: number;
  due_date: string;
  days_overdue: number;
  reminder_count: number;
  next_level: number;
  template_name: string;
  channel: DunningChannel;
  tone: DunningTone;
  trigger_days: number;
}

export interface DunningDashboard {
  debtors_open: number;
  total_outstanding: number;
  queue_due: number;
  recovered_count: number;
  recovered_amount: number;
  relances: {
    total: number;
    level_1: number;
    level_2: number;
    level_3: number;
    responded: number;
    response_rate: number;
  };
}

export interface DunningLog {
  id: string;
  hotel_id: string;
  debtor_id: string;
  level: number;
  channel: DunningChannel;
  subject: string;
  body: string;
  sent_at: string;
  delivered: boolean;
  opened: boolean;
  responded: boolean;
}

export interface DunningPreview {
  level: number;
  channel: DunningChannel;
  tone: DunningTone;
  subject: string;
  body: string;
}

// ─── RPCs ────────────────────────────────────────────────────────────────

export async function getDunningSettings(): Promise<DunningTemplate[]> {
  const { data, error } = await (supabase.rpc as any)('dunning_get_settings');
  if (error) throw error;
  return (data ?? []) as DunningTemplate[];
}

export async function saveDunningTemplate(t: {
  id: string | null;
  level: number;
  name: string;
  trigger_days: number;
  channel: DunningChannel;
  subject: string;
  body: string;
  tone: DunningTone;
  active: boolean;
}): Promise<DunningTemplate> {
  const { data, error } = await (supabase.rpc as any)('dunning_save_template', {
    p_id: t.id,
    p_level: t.level,
    p_name: t.name,
    p_trigger_days: t.trigger_days,
    p_channel: t.channel,
    p_subject: t.subject,
    p_body: t.body,
    p_tone: t.tone,
    p_active: t.active,
  });
  if (error) throw error;
  return data as DunningTemplate;
}

export async function syncDebtors(): Promise<{ created: number; updated: number; total: number }> {
  const { data, error } = await (supabase.rpc as any)('dunning_sync_debtors');
  if (error) throw error;
  return data;
}

export async function getDunningQueue(): Promise<DunningQueueItem[]> {
  const { data, error } = await (supabase.rpc as any)('dunning_queue');
  if (error) return [];
  return (data ?? []) as DunningQueueItem[];
}

export async function getDunningDashboard(): Promise<DunningDashboard | null> {
  const { data, error } = await (supabase.rpc as any)('dunning_dashboard');
  if (error) return null;
  return data as DunningDashboard;
}

export async function listDunningDebtors(): Promise<DunningDebtor[]> {
  const { data, error } = await (supabase.rpc as any)('dunning_list');
  if (error) return [];
  return (data ?? []) as DunningDebtor[];
}

export async function previewDunning(debtorId: string, level: number): Promise<DunningPreview> {
  const { data, error } = await (supabase.rpc as any)('dunning_preview', {
    p_debtor_id: debtorId,
    p_level: level,
  });
  if (error) throw error;
  return data as DunningPreview;
}

export async function sendDunning(debtorId: string, level: number): Promise<{ success: boolean; log_id: string; level: number }> {
  const { data, error } = await (supabase.rpc as any)('dunning_send', {
    p_debtor_id: debtorId,
    p_level: level,
  });
  if (error) throw error;
  return data;
}

export async function runDunningAuto(): Promise<{ processed: number; by_level: Record<string, number> }> {
  const { data, error } = await (supabase.rpc as any)('dunning_run_auto');
  if (error) throw error;
  return data;
}

export async function getDunningHistory(debtorId: string): Promise<DunningLog[]> {
  const { data, error } = await (supabase.rpc as any)('dunning_history', {
    p_debtor_id: debtorId,
  });
  if (error) return [];
  return (data ?? []) as DunningLog[];
}

export async function markDebtorPaid(debtorId: string): Promise<{ success: boolean }> {
  const { data, error } = await (supabase.rpc as any)('dunning_mark_paid', {
    p_debtor_id: debtorId,
  });
  if (error) throw error;
  return data;
}
