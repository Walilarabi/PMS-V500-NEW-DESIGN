/**
 * FLOWTYM — Service Journal d'audit chaîné (Vague F7)
 *
 * Journal d'audit infalsifiable : chaque entrée est scellée par une
 * empreinte SHA-256 chaînée à la précédente. La rupture de la chaîne
 * révèle toute altération ou suppression.
 */

import { supabase } from '../../lib/supabase';

export interface AuditChainEntry {
  id: string;
  seq: number;
  entity: string | null;
  entity_id: string | null;
  action: string | null;
  actor_label: string | null;
  payload: any;
  prev_hash: string;
  entry_hash: string;
  created_at: string;
}

export interface AuditChainVerification {
  valid: boolean;
  total: number;
  verified: number;
  first_break_seq: number | null;
  break_reason: string | null;
  last_hash: string | null;
  checked_at: string;
}

export interface AuditChainStats {
  total: number;
  chained: number;
  last_seq: number;
  first_at: string | null;
  last_at: string | null;
  actors: number;
  entities: number;
}

export async function verifyAuditChain(): Promise<AuditChainVerification> {
  const { data, error } = await (supabase.rpc as any)('audit_verify_chain');
  if (error) throw error;
  return data as AuditChainVerification;
}

export async function getAuditChainStats(): Promise<AuditChainStats | null> {
  const { data, error } = await (supabase.rpc as any)('audit_chain_stats');
  if (error) return null;
  return data as AuditChainStats;
}

export async function listAuditChain(
  limit = 100,
  offset = 0,
  entity?: string,
): Promise<AuditChainEntry[]> {
  const { data, error } = await (supabase.rpc as any)('audit_chain_list', {
    p_limit: limit,
    p_offset: offset,
    p_entity: entity ?? null,
  });
  if (error) return [];
  return (data ?? []) as AuditChainEntry[];
}
