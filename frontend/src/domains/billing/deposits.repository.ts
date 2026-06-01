/**
 * FLOWTYM — Deposits repository.
 * Arrhes, acomptes, garanties — state machine: pending → captured → released | applied
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const depositStatusSchema  = z.enum(['pending', 'captured', 'released', 'applied']);
export const depositTypeSchema    = z.enum(['arrhes', 'acompte', 'garantie', 'other']);
export const depositMethodSchema  = z.enum(['cash', 'card', 'transfer', 'cheque', 'ota', 'other']);

export const depositRowSchema = z.object({
  id:                     z.string().uuid(),
  hotel_id:               z.string().uuid(),
  reservation_id:         z.string().uuid().nullable(),
  invoice_id:             z.string().uuid().nullable(),
  guest_id:               z.string().uuid().nullable(),
  amount:                 z.number(),
  currency:               z.string(),
  method:                 depositMethodSchema,
  deposit_type:           depositTypeSchema,
  status:                 depositStatusSchema,
  applied_to_invoice_id:  z.string().uuid().nullable(),
  applied_amount:         z.number().nullable(),
  captured_at:            z.string().nullable(),
  released_at:            z.string().nullable(),
  applied_at:             z.string().nullable(),
  notes:                  z.string().nullable(),
  created_by:             z.string().uuid().nullable(),
  created_at:             z.string(),
  updated_at:             z.string(),
}).passthrough();
export type DepositRow = z.infer<typeof depositRowSchema>;

export const createDepositSchema = z.object({
  reservationId: z.string().uuid().optional(),
  invoiceId:     z.string().uuid().optional(),
  guestId:       z.string().uuid().optional(),
  amount:        z.number().positive(),
  currency:      z.string().default('EUR'),
  method:        depositMethodSchema,
  depositType:   depositTypeSchema.default('acompte'),
  notes:         z.string().optional(),
});
export type CreateDepositInput = z.infer<typeof createDepositSchema>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listDeposits(params: {
  reservationId?: string;
  invoiceId?: string;
  status?: string;
} = {}): Promise<DepositRow[]> {
  let q = supabase
    .from('deposits')
    .select('*')
    .order('created_at', { ascending: false });
  if (params.reservationId) q = q.eq('reservation_id', params.reservationId);
  if (params.invoiceId)     q = q.eq('invoice_id', params.invoiceId);
  if (params.status)        q = q.eq('status', params.status);
  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => depositRowSchema.parse(d));
}

export async function getDeposit(id: string): Promise<DepositRow> {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return depositRowSchema.parse(data);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createDeposit(
  hotelId: string,
  input: CreateDepositInput,
): Promise<DepositRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deposits') as any)
    .insert({
      hotel_id:       hotelId,
      reservation_id: input.reservationId ?? null,
      invoice_id:     input.invoiceId ?? null,
      guest_id:       input.guestId ?? null,
      amount:         input.amount,
      currency:       input.currency ?? 'EUR',
      method:         input.method,
      deposit_type:   input.depositType ?? 'acompte',
      status:         'pending',
      notes:          input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  const row = depositRowSchema.parse(data);
  await writeAuditLog({
    entity: 'deposit',
    entity_id: row.id,
    action: 'INSERT',
    payload: { amount: input.amount, method: input.method, deposit_type: input.depositType },
  });
  return row;
}

export async function captureDeposit(id: string): Promise<DepositRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deposits') as any)
    .update({ status: 'captured', captured_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new ConflictError('Dépôt introuvable ou déjà capturé.');
  await writeAuditLog({ entity: 'deposit', entity_id: id, action: 'CAPTURE', payload: {} });
  return depositRowSchema.parse(data);
}

export async function releaseDeposit(id: string, notes?: string): Promise<DepositRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deposits') as any)
    .update({
      status:      'released',
      released_at: new Date().toISOString(),
      notes:       notes ?? null,
    })
    .eq('id', id)
    .in('status', ['pending', 'captured'])
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new ConflictError('Dépôt introuvable ou déjà libéré.');
  await writeAuditLog({ entity: 'deposit', entity_id: id, action: 'RELEASE', payload: { notes } });
  return depositRowSchema.parse(data);
}

export async function applyDepositToInvoice(
  id: string,
  invoiceId: string,
  appliedAmount?: number,
): Promise<{ depositId: string; invoiceId: string; appliedAmount: number; invoiceBalance: number }> {
  // Uses RPC for atomicity: locks deposit row, prevents double-apply,
  // updates invoices.paid_amount so balance (GENERATED) decreases correctly.
  const { data, error } = await supabase.rpc('apply_deposit_to_invoice', {
    p_deposit_id:     id,
    p_invoice_id:     invoiceId,
    p_applied_amount: appliedAmount ?? null,
  });
  if (error) throw mapSupabaseError(error);
  if (!data.success) throw new ConflictError(data.error ?? 'Imputation échouée.');
  return {
    depositId:      data.deposit_id,
    invoiceId:      data.invoice_id,
    appliedAmount:  data.applied_amount,
    invoiceBalance: data.invoice_balance,
  };
}
