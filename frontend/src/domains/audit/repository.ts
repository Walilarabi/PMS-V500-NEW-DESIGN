/**
 * FLOWTYM — Audit log repository.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { auditLogSchema, type AuditFilters, type AuditLog } from './schemas';

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  let q = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 250);
  if (filters.entity) q = q.eq('entity', filters.entity);
  if (filters.action) q = q.eq('action', filters.action);
  if (filters.actorUserId) q = q.eq('actor_user_id', filters.actorUserId);
  if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
  if (filters.toDate) q = q.lte('created_at', filters.toDate);
  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  // Tolerant parse: if a row fails Zod validation we keep it as-is rather than blowing up the whole list.
  return (data ?? []).map((d) => {
    const r = auditLogSchema.safeParse(d);
    return (r.success ? r.data : (d as AuditLog));
  });
}

export async function listAuditEntities(): Promise<{ entity: string; n: number }[]> {
  const { data, error } = await (supabase.from('audit_logs') as any)
    .select('entity')
    .limit(2000);
  if (error) throw mapSupabaseError(error);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { entity: string }[]) counts[r.entity] = (counts[r.entity] ?? 0) + 1;
  return Object.entries(counts)
    .map(([entity, n]) => ({ entity, n }))
    .sort((a, b) => b.n - a.n);
}

export interface AuditActor {
  id: string;
  email: string;
  full_name: string | null;
}

export async function listAuditActors(): Promise<AuditActor[]> {
  const { data, error } = await (supabase.from('users') as any)
    .select('id, email, full_name')
    .order('full_name', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as AuditActor[];
}
