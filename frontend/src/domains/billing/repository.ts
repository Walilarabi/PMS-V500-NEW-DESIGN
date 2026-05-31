/**
 * FLOWTYM — Billing repository.
 * Immutable accounting: invoices lock after issue, lines are append-only,
 * payments corrected via reversals only.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError, NotFoundError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import {
  invoiceRowSchema,
  folioRowSchema,
  invoiceLineRowSchema,
  paymentRowSchema,
  type InvoiceRow,
  type FolioRow,
  type InvoiceLineRow,
  type PaymentRow,
  type CreateInvoiceInput,
  type AddInvoiceLineInput,
  type AddPaymentInput,
} from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function handleBillingError(error: { code?: string; message?: string }): never {
  if (error.message?.includes('INVOICE_LOCKED')) throw new ConflictError('Cette facture est verrouillée après émission.');
  if (error.message?.includes('APPEND_ONLY'))    throw new ConflictError('Les lignes sont immuables. Créez une ligne de correction.');
  if (error.message?.includes('PAYMENT_LOCKED')) throw new ConflictError('Ce paiement est finalisé. Créez un remboursement.');
  if (error.message?.includes('OVERBOOKING'))    throw new ConflictError('Conflit de disponibilité détecté.');
  throw mapSupabaseError(error as { code?: string; message: string });
}

// ─── INVOICES ─────────────────────────────────────────────────────────────────

export async function listInvoices(params: {
  status?: string;
  reservationId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: InvoiceRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status)        q = q.eq('status', params.status);
  if (params.reservationId) q = q.eq('reservation_id', params.reservationId);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);
  return {
    rows: (data ?? []).map((d) => invoiceRowSchema.parse(d)),
    total: count ?? 0,
  };
}

export async function getInvoice(id: string): Promise<InvoiceRow> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return invoiceRowSchema.parse(data);
}

export async function createInvoice(
  hotelId: string,
  input: CreateInvoiceInput,
): Promise<{ invoice: InvoiceRow; folio: FolioRow }> {
  // Générer le numéro de facture via la fonction PG
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numData, error: numError } = await (supabase as any)
    .rpc('next_invoice_number', { p_hotel_id: hotelId });
  if (numError) throw mapSupabaseError(numError);
  const invoiceNumber = numData as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv, error: invError } = await (supabase.from('invoices') as any)
    .insert({
      hotel_id:        hotelId,
      reservation_id:  input.reservationId ?? null,
      guest_id:        input.guestId ?? null,
      invoice_number:  invoiceNumber,
      status:          'draft',
      bill_to_name:    input.billToName ?? null,
      bill_to_address: input.billToAddress ?? null,
      bill_to_vat:     input.billToVat ?? null,
      notes:           input.notes ?? null,
      due_date:        input.dueDate ?? null,
    })
    .select('*')
    .single();
  if (invError) handleBillingError(invError);
  const invoice = invoiceRowSchema.parse(inv);

  // Créer un folio principal automatiquement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fol, error: folError } = await (supabase.from('folios') as any)
    .insert({ hotel_id: hotelId, invoice_id: invoice.id, label: 'Hébergement', folio_order: 0 })
    .select('*')
    .single();
  if (folError) handleBillingError(folError);
  const folio = folioRowSchema.parse(fol);

  await writeAuditLog({
    entity: 'invoice',
    entity_id: invoice.id,
    action: 'INSERT',
    payload: { invoice_number: invoiceNumber, reservation_id: input.reservationId },
  });

  return { invoice, folio };
}

export async function issueInvoice(id: string): Promise<InvoiceRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('invoices') as any)
    .update({ status: 'issued', issued_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')  // ne peut être émise que si draft
    .select('*')
    .maybeSingle();

  if (error) handleBillingError(error);
  if (!data) throw new ConflictError('Facture introuvable ou déjà émise.');

  const invoice = invoiceRowSchema.parse(data);

  await writeAuditLog({
    entity: 'invoice',
    entity_id: id,
    action: 'ISSUE',
    payload: { invoice_number: invoice.invoice_number, total_ttc: invoice.total_ttc },
  });

  return invoice;
}

export async function voidInvoice(id: string, reason: string): Promise<InvoiceRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('invoices') as any)
    .update({ status: 'voided', notes: reason })
    .eq('id', id)
    .in('status', ['draft', 'issued'])
    .select('*')
    .maybeSingle();

  if (error) handleBillingError(error);
  if (!data) throw new NotFoundError('Invoice', id);

  await writeAuditLog({ entity: 'invoice', entity_id: id, action: 'VOID', payload: { reason } });
  return invoiceRowSchema.parse(data);
}

// ─── FOLIOS ───────────────────────────────────────────────────────────────────

export async function listFolios(invoiceId: string): Promise<FolioRow[]> {
  const { data, error } = await supabase
    .from('folios')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('folio_order');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => folioRowSchema.parse(d));
}

export async function addFolio(hotelId: string, invoiceId: string, label: string): Promise<FolioRow> {
  const { data: existing } = await supabase
    .from('folios')
    .select('folio_order')
    .eq('invoice_id', invoiceId)
    .order('folio_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = ((existing as any)?.folio_order ?? -1) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('folios') as any)
    .insert({ hotel_id: hotelId, invoice_id: invoiceId, label, folio_order: nextOrder })
    .select('*')
    .single();
  if (error) handleBillingError(error);
  return folioRowSchema.parse(data);
}

// ─── INVOICE LINES ────────────────────────────────────────────────────────────

export async function listInvoiceLines(invoiceId: string): Promise<InvoiceLineRow[]> {
  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => invoiceLineRowSchema.parse(d));
}

export async function addInvoiceLine(
  hotelId: string,
  input: AddInvoiceLineInput,
): Promise<InvoiceLineRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('invoice_lines') as any)
    .insert({
      hotel_id:       hotelId,
      folio_id:       input.folioId,
      invoice_id:     input.invoiceId,
      product_code:   input.productCode ?? null,
      description:    input.description,
      service_date:   input.serviceDate,
      quantity:       input.quantity,
      unit_price_ht:  input.unitPriceHt,
      tva_rate:       input.tvaRate,
      source:         input.source,
    })
    .select('*')
    .single();
  if (error) handleBillingError(error);
  return invoiceLineRowSchema.parse(data);
}

/**
 * reverseLine — Crée une ligne négative pour annuler une ligne existante.
 * C'est la SEULE façon de corriger une ligne (append-only).
 */
export async function reverseLine(
  hotelId: string,
  lineId: string,
): Promise<InvoiceLineRow> {
  // Récupérer la ligne originale
  const { data: orig, error: origErr } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('id', lineId)
    .single();
  if (origErr) throw mapSupabaseError(origErr);
  const original = invoiceLineRowSchema.parse(orig);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('invoice_lines') as any)
    .insert({
      hotel_id:      hotelId,
      folio_id:      original.folio_id,
      invoice_id:    original.invoice_id,
      product_code:  original.product_code,
      description:   `[ANNULATION] ${original.description}`,
      service_date:  new Date().toISOString().split('T')[0],
      quantity:      -original.quantity,
      unit_price_ht: original.unit_price_ht,
      tva_rate:      original.tva_rate,
      source:        'reversal',
      reversal_of:   lineId,
    })
    .select('*')
    .single();
  if (error) handleBillingError(error);

  await writeAuditLog({
    entity: 'invoice_line',
    entity_id: lineId,
    action: 'REVERSAL',
    payload: { original_description: original.description, amount: original.total_ttc },
  });

  return invoiceLineRowSchema.parse(data);
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function listPayments(invoiceId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => paymentRowSchema.parse(d));
}

export async function addPayment(
  hotelId: string,
  input: AddPaymentInput,
): Promise<PaymentRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('payments') as any)
    .insert({
      hotel_id:     hotelId,
      invoice_id:   input.invoiceId,
      amount:       input.amount,
      method:       input.method,
      reference:    input.reference ?? null,
      collected_at: input.collectedAt ?? new Date().toISOString(),
      status:       'completed',
    })
    .select('*')
    .single();
  if (error) handleBillingError(error);

  const payment = paymentRowSchema.parse(data);

  // Mettre à jour le statut de la facture si soldée
  const invoice = await getInvoice(input.invoiceId);
  if (invoice.balance !== null && invoice.balance <= 0 && invoice.status === 'issued') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('invoices') as any)
      .update({ status: 'paid' })
      .eq('id', input.invoiceId);
  }

  await writeAuditLog({
    entity: 'payment',
    entity_id: payment.id,
    action: 'INSERT',
    payload: { invoice_id: input.invoiceId, amount: input.amount, method: input.method },
  });

  return payment;
}

/**
 * reversePayment — Annule un paiement via une écriture négative.
 * Le paiement original est marqué 'reversed', un nouveau paiement négatif est créé.
 */
export async function reversePayment(
  hotelId: string,
  paymentId: string,
  reason: string,
): Promise<PaymentRow> {
  const { data: orig, error: origErr } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  if (origErr) throw mapSupabaseError(origErr);
  const original = paymentRowSchema.parse(orig);

  if (original.status !== 'completed') {
    throw new ConflictError('Seuls les paiements complétés peuvent être annulés.');
  }

  // Marquer l'original comme reversed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('payments') as any)
    .update({ status: 'reversed', reversal_reason: reason })
    .eq('id', paymentId);

  // Créer le remboursement (montant négatif)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('payments') as any)
    .insert({
      hotel_id:        hotelId,
      invoice_id:      original.invoice_id,
      amount:          -original.amount,
      method:          original.method,
      status:          'completed',
      reversal_of:     paymentId,
      reversal_reason: reason,
      reference:       `REVERSAL-${original.reference ?? paymentId.slice(0, 8)}`,
    })
    .select('*')
    .single();
  if (error) handleBillingError(error);

  await writeAuditLog({
    entity: 'payment',
    entity_id: paymentId,
    action: 'REVERSAL',
    payload: { reason, amount: original.amount },
  });

  return paymentRowSchema.parse(data);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

export async function getBillingStats(): Promise<{
  totalIssued: number;
  totalPaid: number;
  totalBalance: number;
  countDraft: number;
  countIssued: number;
  countPaid: number;
  countOverdue: number;
}> {
  const { data, error } = await supabase
    .from('invoices')
    .select('status, total_ttc, paid_amount, balance, due_date');
  if (error) throw mapSupabaseError(error);

  const rows = data ?? [];
  const today = new Date().toISOString().split('T')[0];

  return {
    totalIssued:  rows.filter(r => r.status === 'issued').reduce((s, r) => s + (r.total_ttc ?? 0), 0),
    totalPaid:    rows.filter(r => r.status === 'paid').reduce((s, r) => s + (r.total_ttc ?? 0), 0),
    totalBalance: rows.filter(r => ['issued', 'paid'].includes(r.status)).reduce((s, r) => s + (r.balance ?? 0), 0),
    countDraft:   rows.filter(r => r.status === 'draft').length,
    countIssued:  rows.filter(r => r.status === 'issued').length,
    countPaid:    rows.filter(r => r.status === 'paid').length,
    countOverdue: rows.filter(r => r.status === 'issued' && r.due_date && r.due_date < today).length,
  };
}
