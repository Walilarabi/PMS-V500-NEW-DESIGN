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
