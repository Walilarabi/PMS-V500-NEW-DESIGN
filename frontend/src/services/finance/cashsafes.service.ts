/**
 * FLOWTYM — Service Caisse multi-coffres (Vague F7)
 *
 * Gestion de plusieurs coffres/caisses : mouvements espèces, transferts
 * inter-coffres atomiques, comptages avec ajustement d'écart.
 */

import { supabase } from '../../lib/supabase';

export type SafeType = 'main_safe' | 'reception' | 'petty_cash' | 'bar' | 'restaurant' | 'other';
export type MovementKind = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'adjustment';

export interface CashSafe {
  id: string;
  name: string;
  safe_type: SafeType;
  currency: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  movements_today: number;
  last_count_at: string | null;
}

export interface CashMovement {
  id: string;
  kind: MovementKind;
  amount: number;
  balance_after: number;
  category: string | null;
  reason: string | null;
  reference: string | null;
  counterpart_safe_id: string | null;
  counterpart_name: string | null;
  performed_at: string;
}

export interface CashDashboard {
  safes: number;
  total_balance: number;
  in_today: number;
  out_today: number;
  movements_today: number;
  variance_30d: number;
}

export async function listCashSafes(): Promise<CashSafe[]> {
  const { data, error } = await (supabase.rpc as any)('cash_list_safes');
  if (error) throw error;
  return (data ?? []) as CashSafe[];
}

export async function createCashSafe(name: string, type: SafeType): Promise<{ safe_id: string }> {
  const { data, error } = await (supabase.rpc as any)('cash_create_safe', {
    p_name: name,
    p_type: type,
  });
  if (error) throw error;
  return data;
}

export async function recordCashMovement(input: {
  safeId: string;
  kind: 'deposit' | 'withdrawal';
  amount: number;
  category?: string;
  reason?: string;
  reference?: string;
}): Promise<{ balance: number }> {
  const { data, error } = await (supabase.rpc as any)('cash_record_movement', {
    p_safe_id: input.safeId,
    p_kind: input.kind,
    p_amount: input.amount,
    p_category: input.category ?? null,
    p_reason: input.reason ?? null,
    p_reference: input.reference ?? null,
  });
  if (error) throw error;
  return data;
}

export async function transferCash(
  sourceSafe: string,
  targetSafe: string,
  amount: number,
  reason?: string,
): Promise<{ source_balance: number; target_balance: number }> {
  const { data, error } = await (supabase.rpc as any)('cash_transfer', {
    p_source_safe: sourceSafe,
    p_target_safe: targetSafe,
    p_amount: amount,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data;
}

export async function countCash(
  safeId: string,
  counted: number,
  denominations?: Record<string, number>,
  notes?: string,
): Promise<{ variance: number; balance: number }> {
  const { data, error } = await (supabase.rpc as any)('cash_count', {
    p_safe_id: safeId,
    p_counted: counted,
    p_denominations: denominations ?? null,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getCashLedger(safeId: string, limit = 80): Promise<CashMovement[]> {
  const { data, error } = await (supabase.rpc as any)('cash_safe_ledger', {
    p_safe_id: safeId,
    p_limit: limit,
  });
  if (error) return [];
  return (data ?? []) as CashMovement[];
}

export async function getCashDashboard(): Promise<CashDashboard | null> {
  const { data, error } = await (supabase.rpc as any)('cash_dashboard');
  if (error) return null;
  return data as CashDashboard;
}
