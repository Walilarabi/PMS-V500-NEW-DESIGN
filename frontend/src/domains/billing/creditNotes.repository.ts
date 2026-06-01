/**
 * FLOWTYM — Credit Notes repository.
 * Avoirs : draft → issued (immutable) → voided (traced, never deleted).
 * All mutations go through RPCs for atomicity, amount guards, and audit trail.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError } from '@/src/domains/_shared/errors';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const creditNoteStatusSchema = z.enum(['draft', 'issued', 'voided']);
export type CreditNoteStatus = z.infer<typeof creditNoteStatusSchema>;

export const creditNoteRowSchema = z.object({
  id:                   z.string().uuid(),
  hotel_id:             z.string().uuid(),
  credit_note_number:   z.string(),
  original_invoice_id:  z.string().uuid().nullable(),
  reservation_id:       z.string().uuid().nullable(),
  guest_id:             z.string().uuid().nullable(),
  deposit_id:           z.string().uuid().nullable().optional(),
  total_ht:             z.number(),
  total_tva:            z.number(),
  total_ttc:            z.number(),
  reason:               z.string(),
  status:               creditNoteStatusSchema,
  issued_at:            z.string().nullable(),
  voided_at:            z.string().nullable().optional(),
  voided_by:            z.string().uuid().nullable().optional(),
  void_reason:          z.string().nullable().optional(),
  bill_to_name:         z.string().nullable(),
  notes:                z.string().nullable(),
  created_by:           z.string().uuid().nullable(),
  created_at:           z.string(),
  updated_at:           z.string(),
}).passthrough();
export type CreditNoteRow = z.infer<typeof creditNoteRowSchema>;

export const createCreditNoteSchema = z.object({
  invoiceId:       z.string().uuid(),
  totalTtc:        z.number().positive(),
  reason:          z.string().min(1),
  totalHt:         z.number().optional(),
  totalTva:        z.number().min(0).default(0),
  notes:           z.string().optional(),
  depositId:       z.string().uuid().optional(),
  reservationId:   z.string().uuid().optional(),
  guestId:         z.string().uuid().optional(),
  billToName:      z.string().optional(),
});
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listCreditNotes(params: {
  originalInvoiceId?: string;
  reservationId?: string;
  status?: string;
} = {}): Promise<CreditNoteRow[]> {
  let q = supabase
    .from('credit_notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (params.originalInvoiceId) q = q.eq('original_invoice_id', params.originalInvoiceId);
  if (params.reservationId)     q = q.eq('reservation_id', params.reservationId);
  if (params.status)            q = q.eq('status', params.status);
  const { data, error } = await q;
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => creditNoteRowSchema.parse(d));
}

export async function getCreditNote(id: string): Promise<CreditNoteRow> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return creditNoteRowSchema.parse(data);
}

// ─── Mutations — all via RPC for atomicity ────────────────────────────────────

export async function createCreditNote(
  input: CreateCreditNoteInput,
): Promise<string> {
  // Returns the new credit note UUID.
  // RPC guards: hotel isolation, amount ≤ refundable, atomic number generation.
  const { data, error } = await supabase.rpc('create_credit_note', {
    p_invoice_id:     input.invoiceId,
    p_total_ttc:      input.totalTtc,
    p_reason:         input.reason,
    p_total_ht:       input.totalHt ?? null,
    p_total_tva:      input.totalTva ?? 0,
    p_notes:          input.notes ?? null,
    p_deposit_id:     input.depositId ?? null,
    p_reservation_id: input.reservationId ?? null,
    p_guest_id:       input.guestId ?? null,
    p_bill_to_name:   input.billToName ?? null,
  });
  if (error) throw mapSupabaseError(error);
  return data as string;
}

export async function issueCreditNote(
  id: string,
): Promise<{ creditNoteId: string; creditNoteNumber: string }> {
  // Transitions draft → issued. Immutability trigger locks record after this.
  const { data, error } = await supabase.rpc('issue_credit_note', {
    p_credit_note_id: id,
  });
  if (error) throw mapSupabaseError(error);
  if (!data.success) throw new ConflictError(data.error ?? 'Émission échouée.');
  return {
    creditNoteId:     data.credit_note_id,
    creditNoteNumber: data.credit_note_number,
  };
}

export async function voidCreditNote(
  id: string,
  reason?: string,
): Promise<{ creditNoteId: string; previousStatus: string }> {
  // Transitions draft|issued → voided with trace. Never deletes.
  const { data, error } = await supabase.rpc('void_credit_note', {
    p_credit_note_id: id,
    p_reason:         reason ?? null,
  });
  if (error) throw mapSupabaseError(error);
  if (!data.success) throw new ConflictError(data.error ?? 'Annulation échouée.');
  return {
    creditNoteId:   data.credit_note_id,
    previousStatus: data.previous_status,
  };
}
