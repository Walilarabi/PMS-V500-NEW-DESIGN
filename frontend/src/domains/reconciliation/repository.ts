/**
 * FLOWTYM — Reconciliation domain (bank statements ↔ payouts ↔ encaissements).
 */
import { z } from 'zod';

import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export type BankSource = 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL' | string;
export type ReconStatus = 'UNMATCHED' | 'MATCHED' | 'DISPUTED' | 'IGNORED';

export const bankStatementSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  source: z.string(),
  external_reference: z.string().nullable(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  posted_at: z.string(),
  imported_at: z.string(),
  matched_validation_id: z.string().nullable(),
  matched_reservation_id: z.string().nullable(),
  status: z.enum(['UNMATCHED', 'MATCHED', 'DISPUTED', 'IGNORED']),
  notes: z.string().nullable(),
}).passthrough();
export type BankStatement = z.infer<typeof bankStatementSchema>;

export interface CreateBankStatementInput {
  source: string;
  externalReference?: string | null;
  description?: string | null;
  amount: number;
  currency?: string;
  postedAt: string; // ISO
}

export async function listBankStatements(): Promise<BankStatement[]> {
  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(500);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => bankStatementSchema.parse({ ...d, amount: Number((d as { amount: number }).amount) }));
}

export async function createBankStatement(
  hotelId: string,
  input: CreateBankStatementInput,
): Promise<BankStatement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('bank_statements') as any;
  const { data, error } = await builder
    .insert({
      hotel_id: hotelId,
      source: input.source,
      external_reference: input.externalReference ?? null,
      description: input.description ?? null,
      amount: input.amount,
      currency: input.currency ?? 'EUR',
      posted_at: input.postedAt,
      status: 'UNMATCHED',
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return bankStatementSchema.parse({ ...(data as object), amount: Number((data as { amount: number }).amount) });
}

export async function updateStatementStatus(
  id: string,
  status: ReconStatus,
  notes?: string,
): Promise<BankStatement> {
  const updates: Record<string, unknown> = { status };
  if (notes !== undefined) updates.notes = notes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('bank_statements') as any;
  const { data, error } = await builder
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return bankStatementSchema.parse({ ...(data as object), amount: Number((data as { amount: number }).amount) });
}

export async function matchStatement(
  id: string,
  match: { validationId?: string | null; reservationId?: string | null },
): Promise<BankStatement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('bank_statements') as any;
  const { data, error } = await builder
    .update({
      matched_validation_id: match.validationId ?? null,
      matched_reservation_id: match.reservationId ?? null,
      status: 'MATCHED',
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return bankStatementSchema.parse({ ...(data as object), amount: Number((data as { amount: number }).amount) });
}


/* ============================================================
 *  CSV import mapping templates (saved per-hotel)
 * ============================================================ */

export type ColumnMapping = Record<string, string[]>;

export interface CsvTemplate {
  id: string;
  hotel_id: string;
  name: string;
  source: string;
  mapping: ColumnMapping;
  default_currency: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function listCsvTemplates(): Promise<CsvTemplate[]> {
  const { data, error } = await supabase
    .from('csv_import_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as CsvTemplate[];
}

export interface UpsertCsvTemplateInput {
  name: string;
  source: string;
  mapping: ColumnMapping;
  defaultCurrency?: string;
  isDefault?: boolean;
}

export async function upsertCsvTemplate(hotelId: string, input: UpsertCsvTemplateInput): Promise<CsvTemplate> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('csv_import_templates') as any;
  const { data, error } = await builder
    .upsert(
      {
        hotel_id: hotelId,
        name: input.name,
        source: input.source,
        mapping: input.mapping,
        default_currency: input.defaultCurrency ?? 'EUR',
        is_default: input.isDefault ?? false,
      },
      { onConflict: 'hotel_id,name' },
    )
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as CsvTemplate;
}

export async function deleteCsvTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('csv_import_templates').delete().eq('id', id);
  if (error) throw mapSupabaseError(error);
}


/**
 * Bulk insert bank statements (CSV import). Deduplicates by (source, external_reference)
 * to keep imports idempotent — if a row with the same external_reference already exists
 * for this hotel + source it is skipped server-side via the unique partial index.
 *
 * Returns the number of rows successfully inserted.
 */
export async function createBankStatementsBatch(
  hotelId: string,
  rows: CreateBankStatementInput[],
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('bank_statements') as any;
  const payload = rows.map((input) => ({
    hotel_id: hotelId,
    source: input.source,
    external_reference: input.externalReference ?? null,
    description: input.description ?? null,
    amount: input.amount,
    currency: input.currency ?? 'EUR',
    posted_at: input.postedAt,
    status: 'UNMATCHED',
  }));
  // PostgREST does not yet support ON CONFLICT DO NOTHING natively for batch inserts
  // without explicit conflict target — we trust the unique index and capture 23505 as skipped.
  const { data, error } = await builder
    .insert(payload, { defaultToNull: true })
    .select('id');
  if (error) {
    // If a partial duplicate occurred, fall back to per-row inserts so successful rows persist.
    if ((error as { code?: string }).code === '23505') {
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        try {
          await createBankStatement(hotelId, r);
          inserted += 1;
        } catch (e) {
          if ((e as { code?: string }).code === '23505') skipped += 1;
          else throw e;
        }
      }
      return { inserted, skipped };
    }
    throw mapSupabaseError(error);
  }
  return { inserted: (data ?? []).length, skipped: rows.length - (data ?? []).length };
}
