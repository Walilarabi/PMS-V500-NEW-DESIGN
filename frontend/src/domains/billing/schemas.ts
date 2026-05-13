/**
 * FLOWTYM — Billing domain schemas (Zod).
 * invoices · folios · invoice_lines · payments
 */
import { z } from 'zod';

// ─── Invoice ─────────────────────────────────────────────────────────────────

export const invoiceStatusSchema = z.enum(['draft', 'issued', 'paid', 'voided']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceRowSchema = z.object({
  id:              z.string().uuid(),
  hotel_id:        z.string().uuid(),
  reservation_id:  z.string().uuid().nullable(),
  guest_id:        z.string().uuid().nullable(),
  invoice_number:  z.string(),
  status:          invoiceStatusSchema,
  total_ht:        z.number(),
  total_tva:       z.number(),
  total_ttc:       z.number(),
  paid_amount:     z.number(),
  balance:         z.number().nullable(),
  issued_at:       z.string().nullable(),
  due_date:        z.string().nullable(),
  bill_to_name:    z.string().nullable(),
  bill_to_address: z.string().nullable(),
  bill_to_vat:     z.string().nullable(),
  notes:           z.string().nullable(),
  created_by:      z.string().uuid().nullable(),
  created_at:      z.string(),
  updated_at:      z.string(),
}).passthrough();
export type InvoiceRow = z.infer<typeof invoiceRowSchema>;

export const createInvoiceSchema = z.object({
  reservationId: z.string().uuid().optional(),
  guestId:       z.string().uuid().optional(),
  billToName:    z.string().optional(),
  billToAddress: z.string().optional(),
  billToVat:     z.string().optional(),
  notes:         z.string().optional(),
  dueDate:       z.string().optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ─── Folio ────────────────────────────────────────────────────────────────────

export const folioRowSchema = z.object({
  id:          z.string().uuid(),
  hotel_id:    z.string().uuid(),
  invoice_id:  z.string().uuid(),
  label:       z.string(),
  folio_order: z.number().int(),
  created_at:  z.string(),
}).passthrough();
export type FolioRow = z.infer<typeof folioRowSchema>;

// ─── Invoice Lines ────────────────────────────────────────────────────────────

export const lineSourceSchema = z.enum(['manual', 'night_audit', 'pos', 'reversal']);
export type LineSource = z.infer<typeof lineSourceSchema>;

export const invoiceLineRowSchema = z.object({
  id:             z.string().uuid(),
  hotel_id:       z.string().uuid(),
  folio_id:       z.string().uuid(),
  invoice_id:     z.string().uuid(),
  product_code:   z.string().nullable(),
  description:    z.string(),
  service_date:   z.string(),
  quantity:       z.number(),
  unit_price_ht:  z.number(),
  tva_rate:       z.number(),
  total_ht:       z.number().nullable(),
  total_tva:      z.number().nullable(),
  total_ttc:      z.number().nullable(),
  source:         lineSourceSchema,
  reversal_of:    z.string().uuid().nullable(),
  created_by:     z.string().uuid().nullable(),
  created_at:     z.string(),
}).passthrough();
export type InvoiceLineRow = z.infer<typeof invoiceLineRowSchema>;

export const addInvoiceLineSchema = z.object({
  folioId:      z.string().uuid(),
  invoiceId:    z.string().uuid(),
  description:  z.string().min(1),
  productCode:  z.string().optional(),
  serviceDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity:     z.number().positive(),
  unitPriceHt:  z.number(),
  tvaRate:      z.number().min(0).max(100).default(10),
  source:       lineSourceSchema.default('manual'),
});
export type AddInvoiceLineInput = z.infer<typeof addInvoiceLineSchema>;

// ─── Payments ─────────────────────────────────────────────────────────────────

export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer', 'cheque', 'ota', 'other']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'reversed']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentRowSchema = z.object({
  id:              z.string().uuid(),
  hotel_id:        z.string().uuid(),
  invoice_id:      z.string().uuid(),
  amount:          z.number(),
  currency:        z.string(),
  method:          paymentMethodSchema,
  status:          paymentStatusSchema,
  reversal_of:     z.string().uuid().nullable(),
  reversal_reason: z.string().nullable(),
  reference:       z.string().nullable(),
  collected_at:    z.string(),
  created_by:      z.string().uuid().nullable(),
  created_at:      z.string(),
}).passthrough();
export type PaymentRow = z.infer<typeof paymentRowSchema>;

export const addPaymentSchema = z.object({
  invoiceId:   z.string().uuid(),
  amount:      z.number().positive(),
  method:      paymentMethodSchema,
  reference:   z.string().optional(),
  collectedAt: z.string().optional(),
});
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
