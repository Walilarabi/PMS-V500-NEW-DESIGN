/**
 * FLOWTYM — House Accounts repository.
 * Comptes internes hôtel (Direction, Commercial, Maintenance, Compensation…)
 * Lines are append-only (trigger enforced at DB level).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const houseAccountCategorySchema = z.enum([
  'direction', 'commercial', 'maintenance', 'compensation', 'general', 'other',
]);
export type HouseAccountCategory = z.infer<typeof houseAccountCategorySchema>;

export const houseAccountRowSchema = z.object({
  id:           z.string().uuid(),
  hotel_id:     z.string().uuid(),
  name:         z.string(),
  category:     houseAccountCategorySchema,
  balance:      z.number(),
  credit_limit: z.number().nullable(),
  is_active:    z.boolean(),
  created_by:   z.string().uuid().nullable(),
  created_at:   z.string(),
  updated_at:   z.string(),
}).passthrough();
export type HouseAccountRow = z.infer<typeof houseAccountRowSchema>;

export const houseAccountLineRowSchema = z.object({
  id:               z.string().uuid(),
  hotel_id:         z.string().uuid(),
  house_account_id: z.string().uuid(),
  description:      z.string(),
  amount:           z.number(),
  line_type:        z.enum(['debit', 'credit']),
  reference_type:   z.string().nullable(),
  reference_id:     z.string().uuid().nullable(),
  created_by:       z.string().uuid().nullable(),
  created_at:       z.string(),
}).passthrough();
export type HouseAccountLineRow = z.infer<typeof houseAccountLineRowSchema>;

export const createHouseAccountSchema = z.object({
  name:         z.string().min(1),
  category:     houseAccountCategorySchema.default('general'),
  creditLimit:  z.number().positive().optional(),
});
export type CreateHouseAccountInput = z.infer<typeof createHouseAccountSchema>;

export const addHouseAccountLineSchema = z.object({
  houseAccountId: z.string().uuid(),
  description:    z.string().min(1),
  amount:         z.number().positive(),
  lineType:       z.enum(['debit', 'credit']).default('debit'),
  referenceType:  z.enum(['invoice_line', 'payment', 'deposit', 'manual']).optional(),
  referenceId:    z.string().uuid().optional(),
});
export type AddHouseAccountLineInput = z.infer<typeof addHouseAccountLineSchema>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listHouseAccounts(activeOnly = true): Promise<HouseAccountRow[]> {
  let q = supabase
    .from('house_accounts')
    .select('*')
    .order('name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => houseAccountRowSchema.parse(d));
}

export async function getHouseAccount(id: string): Promise<HouseAccountRow> {
  const { data, error } = await supabase
    .from('house_accounts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return houseAccountRowSchema.parse(data);
}

export async function listHouseAccountLines(houseAccountId: string): Promise<HouseAccountLineRow[]> {
  const { data, error } = await supabase
    .from('house_account_lines')
    .select('*')
    .eq('house_account_id', houseAccountId)
    .order('created_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => houseAccountLineRowSchema.parse(d));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createHouseAccount(
  hotelId: string,
  input: CreateHouseAccountInput,
): Promise<HouseAccountRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('house_accounts') as any)
    .insert({
      hotel_id:     hotelId,
      name:         input.name,
      category:     input.category ?? 'general',
      credit_limit: input.creditLimit ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  const row = houseAccountRowSchema.parse(data);
  await writeAuditLog({
    entity: 'house_account',
    entity_id: row.id,
    action: 'INSERT',
    payload: { name: input.name, category: input.category },
  });
  return row;
}

export async function addHouseAccountLine(
  hotelId: string,
  input: AddHouseAccountLineInput,
): Promise<HouseAccountLineRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('house_account_lines') as any)
    .insert({
      hotel_id:         hotelId,
      house_account_id: input.houseAccountId,
      description:      input.description,
      amount:           input.amount,
      line_type:        input.lineType ?? 'debit',
      reference_type:   input.referenceType ?? 'manual',
      reference_id:     input.referenceId ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  const row = houseAccountLineRowSchema.parse(data);
  await writeAuditLog({
    entity: 'house_account_line',
    entity_id: row.id,
    action: 'INSERT',
    payload: {
      house_account_id: input.houseAccountId,
      amount: input.amount,
      line_type: input.lineType,
    },
  });
  return row;
}

export async function archiveHouseAccount(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('house_accounts') as any)
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
  await writeAuditLog({
    entity: 'house_account',
    entity_id: id,
    action: 'ARCHIVE',
    payload: {},
  });
}
