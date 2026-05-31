/**
 * FLOWTYM — Extended Transfer Service (T5).
 * Transferts de lignes de facturation entre entités :
 * folio · chambre · réservation · société · compte interne
 *
 * Principe immuable : on NE supprime PAS la ligne source — on la reverse,
 * puis on crée une nouvelle ligne dans l'entité destination.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError, NotFoundError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import { invoiceLineRowSchema, type InvoiceLineRow } from './schemas';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const transferResultSchema = z.object({
  reversalLine:  z.custom<InvoiceLineRow>(),
  newLine:       z.custom<InvoiceLineRow>(),
  transferId:    z.string().uuid(),
});
export type TransferResult = z.infer<typeof transferResultSchema>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getLine(lineId: string): Promise<InvoiceLineRow> {
  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('id', lineId)
    .single();
  if (error) throw mapSupabaseError(error);
  if (!data)  throw new NotFoundError('InvoiceLine', lineId);
  return invoiceLineRowSchema.parse(data);
}

async function ensureDraftOrIssued(invoiceId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new NotFoundError('Invoice', invoiceId);
  const row = data as { status: string };
  if (!['draft', 'issued'].includes(row.status)) {
    throw new ConflictError('Impossible de transférer depuis une facture payée ou annulée.');
  }
}

async function reverseLine(
  hotelId: string,
  original: InvoiceLineRow,
): Promise<InvoiceLineRow> {
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
      reversal_of:   original.id,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return invoiceLineRowSchema.parse(data);
}

async function createTransferRecord(
  hotelId: string,
  sourceInvoiceId: string,
  sourceLineId: string,
  reversalLineId: string,
  amount: number,
  reason: string,
  target: {
    type: 'folio' | 'room' | 'reservation' | 'company' | 'house_account';
    folioId?: string;
    roomId?: string;
    reservationId?: string;
    companyId?: string;
    houseAccountId?: string;
  },
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('billing_transfers') as any)
    .insert({
      hotel_id:              hotelId,
      source_invoice_id:     sourceInvoiceId,
      source_line_id:        sourceLineId,
      reversal_line_id:      reversalLineId,
      target_type:           target.type,
      target_folio_id:       target.folioId ?? null,
      target_room_id:        target.roomId ?? null,
      target_reservation_id: target.reservationId ?? null,
      target_company_id:     target.companyId ?? null,
      target_house_account_id: target.houseAccountId ?? null,
      amount,
      reason,
    })
    .select('id')
    .single();
  if (error) throw mapSupabaseError(error);
  return (data as { id: string }).id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * transferLineToFolio — Déplace une ligne vers un autre folio de la même facture.
 */
export async function transferLineToFolio(
  hotelId: string,
  lineId: string,
  targetFolioId: string,
  reason: string,
): Promise<TransferResult> {
  const original = await getLine(lineId);
  await ensureDraftOrIssued(original.invoice_id);

  const reversalLine = await reverseLine(hotelId, original);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newData, error: newErr } = await (supabase.from('invoice_lines') as any)
    .insert({
      hotel_id:      hotelId,
      folio_id:      targetFolioId,
      invoice_id:    original.invoice_id,
      product_code:  original.product_code,
      description:   `[TRANSFÉRÉ] ${original.description}`,
      service_date:  original.service_date,
      quantity:      original.quantity,
      unit_price_ht: original.unit_price_ht,
      tva_rate:      original.tva_rate,
      source:        'manual',
    })
    .select('*')
    .single();
  if (newErr) throw mapSupabaseError(newErr);
  const newLine = invoiceLineRowSchema.parse(newData);

  const transferId = await createTransferRecord(
    hotelId, original.invoice_id, lineId, reversalLine.id,
    original.total_ttc ?? 0, reason,
    { type: 'folio', folioId: targetFolioId },
  );

  await writeAuditLog({
    entity: 'invoice_line',
    entity_id: lineId,
    action: 'TRANSFER_FOLIO',
    payload: { target_folio_id: targetFolioId, reason, transfer_id: transferId },
  });

  return { reversalLine, newLine, transferId };
}

/**
 * transferLineToReservation — Déplace une ligne vers l'invoice d'une autre réservation.
 * Crée un nouveau folio "Hébergement" sur la facture cible si elle n'en a pas.
 */
export async function transferLineToReservation(
  hotelId: string,
  lineId: string,
  targetReservationId: string,
  reason: string,
): Promise<TransferResult> {
  const original = await getLine(lineId);
  await ensureDraftOrIssued(original.invoice_id);

  // Trouver ou créer une facture draft pour la réservation cible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingInv } = await (supabase as any)
    .from('invoices')
    .select('id')
    .eq('reservation_id', targetReservationId)
    .in('status', ['draft', 'issued'])
    .limit(1)
    .maybeSingle();

  let targetInvoiceId: string;
  let targetFolioId: string;

  if (existingInv) {
    targetInvoiceId = (existingInv as { id: string }).id;
    // Récupérer le premier folio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folioData } = await (supabase as any)
      .from('folios')
      .select('id')
      .eq('invoice_id', targetInvoiceId)
      .order('folio_order')
      .limit(1)
      .maybeSingle();
    if (!folioData) throw new ConflictError('Aucun folio trouvé sur la facture cible.');
    targetFolioId = (folioData as { id: string }).id;
  } else {
    // Importer depuis repository pour éviter une dépendance circulaire
    const { createInvoice } = await import('./repository');
    const { invoice, folio } = await createInvoice(hotelId, { reservationId: targetReservationId });
    targetInvoiceId = invoice.id;
    targetFolioId = folio.id;
  }

  const reversalLine = await reverseLine(hotelId, original);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newData, error: newErr } = await (supabase.from('invoice_lines') as any)
    .insert({
      hotel_id:      hotelId,
      folio_id:      targetFolioId,
      invoice_id:    targetInvoiceId,
      product_code:  original.product_code,
      description:   `[TRANSFÉRÉ] ${original.description}`,
      service_date:  original.service_date,
      quantity:      original.quantity,
      unit_price_ht: original.unit_price_ht,
      tva_rate:      original.tva_rate,
      source:        'manual',
    })
    .select('*')
    .single();
  if (newErr) throw mapSupabaseError(newErr);
  const newLine = invoiceLineRowSchema.parse(newData);

  const transferId = await createTransferRecord(
    hotelId, original.invoice_id, lineId, reversalLine.id,
    original.total_ttc ?? 0, reason,
    { type: 'reservation', reservationId: targetReservationId },
  );

  await writeAuditLog({
    entity: 'invoice_line',
    entity_id: lineId,
    action: 'TRANSFER_RESERVATION',
    payload: { target_reservation_id: targetReservationId, reason, transfer_id: transferId },
  });

  return { reversalLine, newLine, transferId };
}

/**
 * transferLineToCompany — Déplace une ligne vers une facture société.
 */
export async function transferLineToCompany(
  hotelId: string,
  lineId: string,
  targetCompanyId: string,
  reason: string,
): Promise<TransferResult> {
  const original = await getLine(lineId);
  await ensureDraftOrIssued(original.invoice_id);

  // Chercher ou créer une facture draft pour la société
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingInv } = await (supabase as any)
    .from('invoices')
    .select('id')
    .eq('hotel_id', hotelId)
    .in('status', ['draft'])
    .limit(1)
    .maybeSingle();

  let targetInvoiceId: string;
  let targetFolioId: string;

  if (existingInv) {
    targetInvoiceId = (existingInv as { id: string }).id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folioData } = await (supabase as any)
      .from('folios')
      .select('id')
      .eq('invoice_id', targetInvoiceId)
      .order('folio_order')
      .limit(1)
      .maybeSingle();
    if (!folioData) throw new ConflictError('Aucun folio sur la facture société cible.');
    targetFolioId = (folioData as { id: string }).id;
  } else {
    const { createInvoice } = await import('./repository');
    const { invoice, folio } = await createInvoice(hotelId, {});
    targetInvoiceId = invoice.id;
    targetFolioId = folio.id;
  }

  const reversalLine = await reverseLine(hotelId, original);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newData, error: newErr } = await (supabase.from('invoice_lines') as any)
    .insert({
      hotel_id:      hotelId,
      folio_id:      targetFolioId,
      invoice_id:    targetInvoiceId,
      product_code:  original.product_code,
      description:   `[TRANSFÉRÉ] ${original.description}`,
      service_date:  original.service_date,
      quantity:      original.quantity,
      unit_price_ht: original.unit_price_ht,
      tva_rate:      original.tva_rate,
      source:        'manual',
    })
    .select('*')
    .single();
  if (newErr) throw mapSupabaseError(newErr);
  const newLine = invoiceLineRowSchema.parse(newData);

  const transferId = await createTransferRecord(
    hotelId, original.invoice_id, lineId, reversalLine.id,
    original.total_ttc ?? 0, reason,
    { type: 'company', companyId: targetCompanyId },
  );

  await writeAuditLog({
    entity: 'invoice_line',
    entity_id: lineId,
    action: 'TRANSFER_COMPANY',
    payload: { target_company_id: targetCompanyId, reason, transfer_id: transferId },
  });

  return { reversalLine, newLine, transferId };
}

/**
 * transferLineToHouseAccount — Impute une ligne sur un compte interne.
 * Reverse la ligne de la facture et crée une ligne dans house_account_lines.
 */
export async function transferLineToHouseAccount(
  hotelId: string,
  lineId: string,
  houseAccountId: string,
  reason: string,
): Promise<TransferResult & { houseAccountLineId: string }> {
  const original = await getLine(lineId);
  await ensureDraftOrIssued(original.invoice_id);

  const reversalLine = await reverseLine(hotelId, original);

  // Créer une ligne dans house_account_lines
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: haLineData, error: haErr } = await (supabase.from('house_account_lines') as any)
    .insert({
      hotel_id:         hotelId,
      house_account_id: houseAccountId,
      description:      `[TRANSFERT] ${original.description}`,
      amount:           Math.abs(original.total_ttc ?? 0),
      line_type:        'debit',
      reference_type:   'invoice_line',
      reference_id:     lineId,
    })
    .select('id')
    .single();
  if (haErr) throw mapSupabaseError(haErr);
  const houseAccountLineId = (haLineData as { id: string }).id;

  // La "nouvelle ligne" est une copie de la reversal pour uniformité de l'interface
  const newLine = reversalLine;

  const transferId = await createTransferRecord(
    hotelId, original.invoice_id, lineId, reversalLine.id,
    original.total_ttc ?? 0, reason,
    { type: 'house_account', houseAccountId },
  );

  await writeAuditLog({
    entity: 'invoice_line',
    entity_id: lineId,
    action: 'TRANSFER_HOUSE_ACCOUNT',
    payload: { house_account_id: houseAccountId, reason, transfer_id: transferId },
  });

  return { reversalLine, newLine, transferId, houseAccountLineId };
}
