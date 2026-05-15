/**
 * FLOWTYM — Finance repository.
 * Covers: Reconciliation, FEC exports, Revenue Integrity anomalies, CSV templates, Audit logs.
 * RLS enforces hotel_id isolation on every table — we never inject it client-side.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import {
  reconciliationLineRowSchema,
  fecExportRowSchema,
  revenueAnomalyRowSchema,
  csvTemplateRowSchema,
  auditLogReadSchema,
  type ReconciliationLineRow,
  type FecExportRow,
  type RevenueAnomalyRow,
  type CsvTemplateRow,
  type AuditLogRead,
  type ImportCsvLine,
  type UpsertCsvTemplateInput,
  type FecEntry,
} from './schemas';

// ─── RECONCILIATION ──────────────────────────────────────────────────────────

export interface ListReconciliationParams {
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export async function listReconciliationLines(
  params: ListReconciliationParams = {},
): Promise<{ rows: ReconciliationLineRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('reconciliation_lines')
    .select('*', { count: 'exact' })
    .order('line_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) q = q.eq('status', params.status);
  if (params.source) q = q.eq('source', params.source);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((d) => reconciliationLineRowSchema.parse(d));
  return { rows, total: count ?? rows.length };
}

export async function importCsvLines(lines: ImportCsvLine[]): Promise<ReconciliationLineRow[]> {
  const payload = lines.map((l) => ({
    source: l.source,
    reference: l.reference,
    description: l.description ?? null,
    amount: l.amount,
    line_date: l.date,
    status: 'pending',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reconciliation_lines') as any)
    .insert(payload)
    .select('*');

  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d: unknown) => reconciliationLineRowSchema.parse(d));
}

export async function updateReconciliationStatus(
  id: string,
  status: string,
  reservationId?: string | null,
  notes?: string,
): Promise<ReconciliationLineRow> {
  const patch: Record<string, unknown> = {
    status,
    matched_at: status === 'matched' ? new Date().toISOString() : null,
  };
  if (reservationId !== undefined) patch.reservation_id = reservationId;
  if (notes !== undefined) patch.notes = notes;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reconciliation_lines') as any)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return reconciliationLineRowSchema.parse(data);
}

export async function getReconciliationStats(): Promise<{
  pending: number;
  matched: number;
  disputed: number;
  pendingAmount: number;
  matchedAmount: number;
  coveragePercent: number;
  autoSuggestions: number;
}> {
  const { data, error } = await supabase
    .from('reconciliation_lines')
    .select('status, amount, match_score');

  if (error) throw mapSupabaseError(error);
  const rows = data ?? [];

  const pending = rows.filter((r) => r.status === 'pending');
  const matched = rows.filter((r) => r.status === 'matched');
  const disputed = rows.filter((r) => r.status === 'disputed');
  const total = rows.length;

  return {
    pending: pending.length,
    matched: matched.length,
    disputed: disputed.length,
    pendingAmount: pending.reduce((s, r) => s + (r.amount ?? 0), 0),
    matchedAmount: matched.reduce((s, r) => s + (r.amount ?? 0), 0),
    coveragePercent: total > 0 ? Math.round((matched.length / total) * 100) : 0,
    autoSuggestions: pending.filter((r) => r.match_score && r.match_score >= 40).length,
  };
}

// ─── FEC EXPORTS ─────────────────────────────────────────────────────────────

export async function listFecExports(): Promise<FecExportRow[]> {
  const { data, error } = await supabase
    .from('fec_exports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => fecExportRowSchema.parse(d));
}

/**
 * Generates FEC entries from reconciliation_lines (matched) + reservations.
 * In production this would call a Postgres function/view.
 * For now we build it client-side from available Supabase data.
 */
export async function generateFecEntries(
  fromDate: string,
  toDate: string,
): Promise<FecEntry[]> {
  const { data: lines, error } = await supabase
    .from('reconciliation_lines')
    .select('*')
    .gte('line_date', fromDate)
    .lte('line_date', toDate)
    .eq('status', 'matched');

  if (error) throw mapSupabaseError(error);

  const entries: FecEntry[] = [];
  let num = 1;

  for (const line of lines ?? []) {
    const dateStr = (line.line_date as string).replace(/-/g, '');
    const amount = Math.abs(line.amount as number);

    // Écriture débit — Compte client OTA (41x)
    entries.push({
      JournalCode: 'BQ',
      JournalLib: 'Banque',
      EcritureNum: num,
      EcritureDate: dateStr,
      CompteNum: '41200000',
      CompteLib: `Client ${line.source}`,
      CompAuxNum: line.source as string,
      CompAuxLib: `Paiement ${line.source}`,
      PieceRef: line.reference as string,
      PieceDate: dateStr,
      EcritureLib: `${line.source} — ${line.description ?? line.reference}`,
      Debit: amount,
      Credit: 0,
      EcritureLet: '',
      DateLet: '',
      ValidDate: dateStr,
      Montantdevise: amount,
      Idevise: (line.currency as string) || 'EUR',
    });

    // Écriture crédit — Produit hébergement (70x)
    entries.push({
      JournalCode: 'BQ',
      JournalLib: 'Banque',
      EcritureNum: num,
      EcritureDate: dateStr,
      CompteNum: '70610000',
      CompteLib: 'Produits hébergement',
      CompAuxNum: '',
      CompAuxLib: '',
      PieceRef: line.reference as string,
      PieceDate: dateStr,
      EcritureLib: `${line.source} — ${line.description ?? line.reference}`,
      Debit: 0,
      Credit: amount,
      EcritureLet: '',
      DateLet: '',
      ValidDate: dateStr,
      Montantdevise: amount,
      Idevise: (line.currency as string) || 'EUR',
    });

    num++;
  }

  return entries;
}

/**
 * Builds the FEC text file (UTF-8, pipe-delimited, 18 cols DGFiP).
 */
export function buildFecBuffer(entries: FecEntry[], siren: string): {
  content: string;
  filename: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
} {
  const HEADERS = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib',
    'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate',
    'Montantdevise', 'Idevise',
  ];

  const escape = (v: string | number): string => {
    if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
    return String(v ?? '').replace(/\|/g, ' ').replace(/[\r\n]+/g, ' ');
  };

  const rows = entries.map((e) =>
    HEADERS.map((h) => escape(e[h as keyof FecEntry] as string | number)).join('|'),
  );

  const totalDebit = entries.reduce((s, e) => s + e.Debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.Credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${siren.padStart(9, '0')}FEC${today}.txt`;
  const content = [HEADERS.join('|'), ...rows].join('\r\n');

  return { content, filename, totalDebit, totalCredit, isBalanced };
}

export async function saveFecExport(payload: {
  period_from: string;
  period_to: string;
  siren: string | null;
  filename: string;
  entries_count: number;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  sha256_hash?: string;
}): Promise<FecExportRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('fec_exports') as any)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error);
  return fecExportRowSchema.parse(data);
}

// ─── REVENUE ANOMALIES ────────────────────────────────────────────────────────

export async function listRevenueAnomalies(params: {
  status?: string;
  severity?: string;
  limit?: number;
} = {}): Promise<{ rows: RevenueAnomalyRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);

  let q = supabase
    .from('revenue_anomalies')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.status) q = q.eq('status', params.status);
  if (params.severity) q = q.eq('severity', params.severity);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((d) => revenueAnomalyRowSchema.parse(d));
  return { rows, total: count ?? rows.length };
}

export async function resolveAnomaly(
  id: string,
  note: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('revenue_anomalies') as any)
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_note: note,
    })
    .eq('id', id);

  if (error) throw mapSupabaseError(error);
}

export async function getAnomalyStats(): Promise<{
  open: number;
  critical: number;
  potentialLoss: number;
  resolvedThisMonth: number;
}> {
  const { data, error } = await supabase
    .from('revenue_anomalies')
    .select('status, severity, delta, resolved_at');

  if (error) throw mapSupabaseError(error);
  const rows = data ?? [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    open: rows.filter((r) => r.status === 'open').length,
    critical: rows.filter((r) => r.status === 'open' && r.severity === 'critical').length,
    potentialLoss: rows
      .filter((r) => r.status === 'open')
      .reduce((s, r) => s + Math.abs(r.delta ?? 0), 0),
    resolvedThisMonth: rows.filter(
      (r) => r.status === 'resolved' && r.resolved_at && r.resolved_at >= monthStart,
    ).length,
  };
}

// ─── CSV TEMPLATES ────────────────────────────────────────────────────────────

export async function listCsvTemplates(): Promise<CsvTemplateRow[]> {
  const { data, error } = await supabase
    .from('csv_import_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => csvTemplateRowSchema.parse(d));
}

export async function upsertCsvTemplate(input: UpsertCsvTemplateInput): Promise<CsvTemplateRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('csv_import_templates') as any)
    .upsert({ ...input }, { onConflict: 'hotel_id,name' })
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error);
  return csvTemplateRowSchema.parse(data);
}

export async function deleteCsvTemplate(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('csv_import_templates') as any).delete().eq('id', id);
  if (error) throw mapSupabaseError(error);
}

// ─── AUDIT LOGS (read-side) ───────────────────────────────────────────────────

export async function listAuditLogs(params: {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: AuditLogRead[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.entity) q = q.eq('entity', params.entity);
  if (params.action) q = q.eq('action', params.action);
  if (params.from) q = q.gte('created_at', params.from);
  if (params.to) q = q.lte('created_at', params.to);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((d) => auditLogReadSchema.parse(d));
  return { rows, total: count ?? rows.length };
}

/**
 * writeAuditLog — Appelé après chaque mutation métier critique.
 * Utilisé par les repositories (reservations, finance) pour traçabilité.
 */
export async function writeAuditLog(entry: {
  entity: string;
  entity_id: string;
  action: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
}): Promise<void> {
  // Audit failures MUST NEVER block business operations.
  // All errors are swallowed here — the DB trigger is the authoritative audit trail.
  try {
    // Résoudre actor_user_id via public.users (pas auth.uid() direct qui
    // ne correspond pas à public.users.id — seul public.users.auth_id = auth.uid())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actorId } = await (supabase.rpc as any)('resolve_actor_user_id');
    const { data: hotelId } = await supabase.rpc('get_user_hotel_id');

    if (!hotelId) {
      // Pas de contexte hôtel → pas d'audit possible, skip silencieux
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('audit_logs') as any).insert({
      entity: entry.entity,
      entity_id: entry.entity_id,
      action: entry.action,
      payload: entry.payload ?? {},
      correlation_id: null,
      hotel_id: hotelId,
      actor_user_id: actorId ?? null, // NULL accepté grâce à la migration 0150
    });

    if (error) console.warn('[audit] write failed (non-fatal):', error.message);
  } catch (err) {
    // Swallow entièrement — l'audit ne doit jamais faire crasher une réservation
    console.warn('[audit] exception (non-fatal):', err);
  }
}
