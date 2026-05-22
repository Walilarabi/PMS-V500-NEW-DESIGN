/**
 * FLOWTYM — Service Cash Management (Vague F8)
 *
 * Prévision de trésorerie, postes prévisionnels manuels, taux de change
 * multi-devises et exports comptables aux formats Sage et Cegid.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────

export type FlowDirection = 'inflow' | 'outflow';
export type Recurrence = 'none' | 'weekly' | 'monthly';

export interface ForecastPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
}

export interface CashflowForecast {
  currency: string;
  rate: number;
  horizon_days: number;
  opening_balance: number;
  series: ForecastPoint[];
  summary: {
    total_inflow: number;
    total_outflow: number;
    end_balance: number;
    min_balance: number;
    min_balance_date: string | null;
  };
}

export interface CashflowEntry {
  id: string;
  label: string;
  direction: FlowDirection;
  amount: number;
  category: string | null;
  expected_date: string;
  recurrence: Recurrence;
  is_active: boolean;
}

export interface CurrencyRate {
  id: string;
  quote_currency: string;
  rate: number;
  as_of: string;
  updated_at: string;
}

export interface JournalLine {
  date: string;
  journal: string;
  account: string;
  account_label: string;
  label: string;
  piece: string;
  debit: number;
  credit: number;
}

// ─── RPCs ────────────────────────────────────────────────────────────────

export async function getCashflowForecast(
  horizonDays = 90,
  currency = 'EUR',
): Promise<CashflowForecast> {
  const { data, error } = await (supabase.rpc as any)('cashflow_forecast', {
    p_horizon_days: horizonDays,
    p_currency: currency,
  });
  if (error) throw error;
  return data as CashflowForecast;
}

export async function listCashflowEntries(): Promise<CashflowEntry[]> {
  const { data, error } = await (supabase.rpc as any)('cashflow_list_entries');
  if (error) return [];
  return (data ?? []) as CashflowEntry[];
}

export async function saveCashflowEntry(e: {
  id: string | null;
  label: string;
  direction: FlowDirection;
  amount: number;
  category: string | null;
  expected_date: string;
  recurrence: Recurrence;
  is_active: boolean;
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('cashflow_save_entry', {
    p_id: e.id,
    p_label: e.label,
    p_direction: e.direction,
    p_amount: e.amount,
    p_category: e.category,
    p_expected_date: e.expected_date,
    p_recurrence: e.recurrence,
    p_is_active: e.is_active,
  });
  if (error) throw error;
}

export async function deleteCashflowEntry(id: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('cashflow_delete_entry', { p_id: id });
  if (error) throw error;
}

export async function listCurrencyRates(): Promise<CurrencyRate[]> {
  const { data, error } = await (supabase.rpc as any)('currency_list_rates');
  if (error) return [];
  return (data ?? []) as CurrencyRate[];
}

export async function upsertCurrencyRate(quote: string, rate: number): Promise<void> {
  const { error } = await (supabase.rpc as any)('currency_upsert_rate', {
    p_quote: quote,
    p_rate: rate,
  });
  if (error) throw error;
}

export async function getAccountingJournal(from: string, to: string): Promise<JournalLine[]> {
  const { data, error } = await (supabase.rpc as any)('accounting_export_journal', {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return (data ?? []) as JournalLine[];
}

// ─── Formats d'export comptable ──────────────────────────────────────────

const num = (v: number) => (v ?? 0).toFixed(2).replace('.', ',');
const ddmmyyyy = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const yyyymmdd = (d: string) => d.replace(/-/g, '');

/** Export Sage (Sage 50/100) — séparateur point-virgule, dates JJ/MM/AAAA. */
export function buildSageCsv(lines: JournalLine[]): string {
  const header = 'Journal;Date;Compte;Libelle;Debit;Credit;Piece';
  const rows = lines.map(l =>
    [
      l.journal,
      ddmmyyyy(l.date),
      l.account,
      l.label.replace(/;/g, ' '),
      num(l.debit),
      num(l.credit),
      (l.piece ?? '').replace(/;/g, ' '),
    ].join(';'),
  );
  return [header, ...rows].join('\r\n');
}

/** Export Cegid (Cegid Loop / Quadra) — sens D/C, dates AAAAMMJJ. */
export function buildCegidCsv(lines: JournalLine[]): string {
  const header = 'Date;CodeJournal;NumeroCompte;LibelleEcriture;Sens;Montant;NumeroPiece';
  const rows = lines.map(l => {
    const isDebit = l.debit >= l.credit;
    return [
      yyyymmdd(l.date),
      l.journal,
      l.account,
      l.label.replace(/;/g, ' '),
      isDebit ? 'D' : 'C',
      num(isDebit ? l.debit : l.credit),
      (l.piece ?? '').replace(/;/g, ' '),
    ].join(';');
  });
  return [header, ...rows].join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
