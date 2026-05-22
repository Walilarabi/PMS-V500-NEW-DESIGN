/**
 * FLOWTYM — Service Finance
 *
 * Façade pour toutes les interactions Supabase du module Finance.
 */

import { supabase } from '../../lib/supabase';

// ─── KPIs Dashboard ──────────────────────────────────────────────────────

export interface FinanceDashboardKpis {
  ca_month: number;
  revpar: number;
  encaissements_30d: number;
  debiteurs_total: number;
  tva_due: number;
  last_closure: string | null;
  nights_sold: number;
  capacity: number;
}

export async function fetchFinanceKpis(): Promise<FinanceDashboardKpis | null> {
  try {
    const { data, error } = await (supabase.rpc as any)('finance_dashboard_kpis');
    if (error) return null;
    return data as FinanceDashboardKpis;
  } catch {
    return null;
  }
}

// ─── TVA Snapshots ───────────────────────────────────────────────────────

export interface TvaSnapshot {
  id: string;
  hotel_id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  encours_debut: number;
  encours_fin: number;
  ca_debits: number;
  ca_taxable: number;
  base_10: number;
  tva_10: number;
  base_55: number;
  tva_55: number;
  base_20: number;
  tva_20: number;
  base_21: number;
  tva_21: number;
  total_tva: number;
  fiscal_stamp: string;
  payload_hash: string;
  locked: boolean;
  created_at: string;
}

export async function listTvaSnapshots(): Promise<TvaSnapshot[]> {
  const { data, error } = await supabase
    .from('tva_snapshots')
    .select('*')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TvaSnapshot[];
}

export async function getTvaSnapshot(year: number, month: number): Promise<TvaSnapshot | null> {
  const { data, error } = await supabase
    .from('tva_snapshots')
    .select('*')
    .eq('period_year', year)
    .eq('period_month', month)
    .maybeSingle();
  if (error) return null;
  return data as TvaSnapshot | null;
}

export async function generateTvaSnapshot(year: number, month: number): Promise<TvaSnapshot> {
  const { data, error } = await (supabase.rpc as any)('generate_tva_snapshot', {
    p_year: year, p_month: month,
  });
  if (error) throw error;
  return data as TvaSnapshot;
}

// ─── Débiteurs ───────────────────────────────────────────────────────────

export interface DebtorAged {
  id: string;
  hotel_id: string;
  reservation_id: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  company_name: string | null;
  reference: string | null;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  days_overdue: number;
  aging_bucket: 'paid' | 'current' | 'overdue_30' | 'overdue_60' | 'overdue_90' | 'overdue_90_plus';
  status: 'open' | 'partial' | 'paid' | 'written_off' | 'disputed';
  last_reminder_at: string | null;
  reminder_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDebtors(): Promise<DebtorAged[]> {
  const { data, error } = await supabase
    .from('debtors_aged')
    .select('*')
    .order('days_overdue', { ascending: false });
  if (error) return [];
  return (data ?? []) as DebtorAged[];
}

// ─── Closure ─────────────────────────────────────────────────────────────

export interface ClosureWorkflow {
  id: string;
  hotel_id: string;
  closure_date: string;
  state: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  step_current: number;
  steps_done: any[];
  steps_errors: Record<string, string>;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  initiated_by: string | null;
  notes: string | null;
}

export async function listClosures(limit = 30): Promise<ClosureWorkflow[]> {
  const { data, error } = await supabase
    .from('closure_workflow')
    .select('*')
    .order('closure_date', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ClosureWorkflow[];
}

// ─── Closure RPCs (vraies opérations) ────────────────────────────────────

export interface ClosureStepResult {
  step: number;
  success: boolean;
  duration_ms?: number;
  completed_at?: string;
  warnings?: any[];
  [key: string]: any;
}

export async function startClosure(closureDate: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('closure_start', {
    p_closure_date: closureDate,
  });
  if (error) throw error;
  return String(data);
}

export async function executeClosureStep(closureId: string, step: number): Promise<ClosureStepResult> {
  const { data, error } = await (supabase.rpc as any)('closure_execute_step', {
    p_closure_id: closureId,
    p_step: step,
  });
  if (error) throw error;
  return data as ClosureStepResult;
}

export async function rollbackClosure(closureId: string): Promise<{ recouchants_reverted: number; noshows_reverted: number }> {
  const { data, error } = await (supabase.rpc as any)('closure_rollback', {
    p_closure_id: closureId,
  });
  if (error) throw error;
  return data;
}

// ─── Proforma ────────────────────────────────────────────────────────────

export interface ProformaQuote {
  id: string;
  hotel_id: string;
  quote_number: string;
  reservation_id: string | null;
  guest_name: string;
  guest_email: string | null;
  company_name: string | null;
  company_siret: string | null;
  issue_date: string;
  valid_until: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  lines: any[];
  status: 'draft' | 'sent' | 'accepted' | 'expired' | 'converted' | 'cancelled';
  converted_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listProformas(): Promise<ProformaQuote[]> {
  const { data, error } = await supabase
    .from('proforma_quotes')
    .select('*')
    .order('issue_date', { ascending: false });
  if (error) return [];
  return (data ?? []) as ProformaQuote[];
}

// ─── Multi-folios (Vague F3) ─────────────────────────────────────────────

export interface FolioLine {
  id: string;
  family: string | null;
  code: string | null;
  label: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  tva_rate: number;
  tva_amount: number;
  prestation_date: string;
  status: string | null;
}

export type FolioType = 'guest' | 'company' | 'master' | 'extra';

export interface ReservationFolio {
  folio_number: number;
  label: string;
  folio_type: FolioType;
  lines: FolioLine[];
  total_ttc: number;
}

export interface FolioReservationInfo {
  id: string;
  reference: string;
  guest_name: string;
  room_number: string | null;
  check_in: string;
  check_out: string;
  total_amount: number;
  paid_amount: number;
  solde: number;
}

export interface ReservationFoliosResult {
  reservation: FolioReservationInfo | null;
  folios: ReservationFolio[];
}

export interface FolioTransfer {
  id: string;
  hotel_id: string;
  reservation_id: string;
  source_folio_id: string | null;
  target_folio_id: string | null;
  invoice_line_id: string | null;
  description: string | null;
  quantity: number | null;
  amount_ttc: number | null;
  tva_rate: number | null;
  transferred_at: string;
  transferred_by: string | null;
  reason: string | null;
}

export interface FolioReservationPick {
  id: string;
  reference: string;
  guest_name: string;
  room_number: string | null;
  status: string;
  check_in: string;
  check_out: string;
}

export async function getReservationFolios(reservationId: string): Promise<ReservationFoliosResult> {
  const { data, error } = await (supabase.rpc as any)('get_reservation_folios', {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return (data ?? { reservation: null, folios: [] }) as ReservationFoliosResult;
}

export async function transferPrestationFolio(
  prestationId: string,
  targetFolio: number,
  reason?: string,
): Promise<{ success: boolean; source_folio?: number; target_folio?: number; amount?: number; unchanged?: boolean }> {
  const { data, error } = await (supabase.rpc as any)('transfer_prestation_folio', {
    p_prestation_id: prestationId,
    p_target_folio: targetFolio,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data;
}

export async function upsertReservationFolio(
  reservationId: string,
  folioNumber: number,
  label: string,
  folioType: FolioType = 'guest',
): Promise<{ success: boolean }> {
  const { data, error } = await (supabase.rpc as any)('upsert_reservation_folio', {
    p_reservation_id: reservationId,
    p_folio_number: folioNumber,
    p_label: label,
    p_folio_type: folioType,
  });
  if (error) throw error;
  return data;
}

export async function getFolioTransferHistory(reservationId: string): Promise<FolioTransfer[]> {
  const { data, error } = await (supabase.rpc as any)('get_folio_transfer_history', {
    p_reservation_id: reservationId,
  });
  if (error) return [];
  return (data ?? []) as FolioTransfer[];
}

export async function searchFolioReservations(query: string): Promise<FolioReservationPick[]> {
  let req = supabase
    .from('reservations')
    .select('id, reference, guest_name, room_number, status, check_in, check_out')
    .order('check_in', { ascending: false })
    .limit(25);
  const q = query.trim();
  if (q) {
    req = req.or(`guest_name.ilike.%${q}%,reference.ilike.%${q}%,room_number.ilike.%${q}%`);
  }
  const { data, error } = await req;
  if (error) return [];
  return (data ?? []) as FolioReservationPick[];
}
