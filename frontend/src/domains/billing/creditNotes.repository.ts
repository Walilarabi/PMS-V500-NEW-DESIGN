/**
 * FLOWTYM — Credit Notes repository.
 * Avoirs : nouvelles factures négatives (jamais mutation de la facture originale).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
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
  total_ht:             z.number(),
  total_tva:            z.number(),
  total_ttc:            z.number(),
  reason:               z.string(),
  status:               creditNoteStatusSchema,
  issued_at:            z.string().nullable(),
  bill_to_name:         z.string().nullable(),
  notes:                z.string().nullable(),
  created_by:           z.string().uuid().nullable(),
  created_at:           z.string(),
  updated_at:           z.string(),
}).passthrough();
export type CreditNoteRow = z.infer<typeof creditNoteRowSchema>;

export const createCreditNoteSchema = z.object({
  originalInvoiceId: z.string().uuid().optional(),
  reservationId:     z.string().uuid().optional(),
  guestId:           z.string().uuid().optional(),
  totalHt:           z.number(),
  totalTva:          z.number(),
  totalTtc:          z.number(),
  reason:            z.string().min(1),
  billToName:        z.string().optional(),
  notes:             z.string().optional(),
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

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCreditNote(
  hotelId: string,
  input: CreateCreditNoteInput,
): Promise<CreditNoteRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numData, error: numError } = await (supabase as any)
    .rpc('next_credit_note_number', { p_hotel_id: hotelId });
  if (numError) throw mapSupabaseError(numError);
  const creditNoteNumber = numData as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('credit_notes') as any)
    .insert({
      hotel_id:             hotelId,
      credit_note_number:   creditNoteNumber,
      original_invoice_id:  input.originalInvoiceId ?? null,
      reservation_id:       input.reservationId ?? null,
      guest_id:             input.guestId ?? null,
      total_ht:             input.totalHt,
      total_tva:            input.totalTva,
      total_ttc:            input.totalTtc,
      reason:               input.reason,
      bill_to_name:         input.billToName ?? null,
      notes:                input.notes ?? null,
      status:               'draft',
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  const row = creditNoteRowSchema.parse(data);
  await writeAuditLog({
    entity: 'credit_note',
    entity_id: row.id,
    action: 'INSERT',
    payload: {
      credit_note_number: creditNoteNumber,
      original_invoice_id: input.originalInvoiceId,
      total_ttc: input.totalTtc,
    },
  });
  return row;
}

export async function issueCreditNote(id: string): Promise<CreditNoteRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('credit_notes') as any)
    .update({ status: 'issued', issued_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new ConflictError('Avoir introuvable ou déjà émis.');
  const row = creditNoteRowSchema.parse(data);
  await writeAuditLog({
    entity: 'credit_note',
    entity_id: id,
    action: 'ISSUE',
    payload: { credit_note_number: row.credit_note_number, total_ttc: row.total_ttc },
  });
  return row;
}

export async function voidCreditNote(id: string): Promise<CreditNoteRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('credit_notes') as any)
    .update({ status: 'voided' })
    .eq('id', id)
    .in('status', ['draft', 'issued'])
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new ConflictError('Avoir introuvable.');
  await writeAuditLog({ entity: 'credit_note', entity_id: id, action: 'VOID', payload: {} });
  return creditNoteRowSchema.parse(data);
}
