/**
 * FLOWTYM — Service E-facture (Vague F4)
 *
 * Génération UBL 2.1, transmission au PPF (Portail Public de Facturation)
 * avec gestion du retry à backoff exponentiel et suivi du cycle de vie.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────

export type EInvoiceFormat = 'ubl_2.1' | 'factur_x' | 'cii';

export type EInvoiceLifecycle =
  | 'draft' | 'deposited' | 'received' | 'made_available'
  | 'approved' | 'disputed' | 'refused' | 'payment_sent' | 'cashed';

export type EInvoiceTransmission = 'pending' | 'sending' | 'sent' | 'failed';

export interface EInvoiceListRow {
  submission_id: string;
  invoice_id: string;
  format: EInvoiceFormat;
  lifecycle_status: EInvoiceLifecycle;
  transmission_status: EInvoiceTransmission;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  ppf_reference: string | null;
  has_xml: boolean;
  payload_hash: string | null;
  submitted_at: string | null;
  created_at: string;
  invoice_number: string;
  guest_name: string;
  issue_date: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
}

export interface EInvoiceDashboard {
  total: number;
  transmitted: number;
  pending: number;
  failed: number;
  retry_due: number;
  retry_waiting: number;
  lifecycle: Record<EInvoiceLifecycle | 'draft', number>;
  compliance_rate: number;
}

export interface EInvoiceEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  created_at: string;
}

export interface EInvoiceHotel {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  country: string;
  siret: string | null;
  tva_number: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
}

export interface EInvoiceLine {
  id: string | null;
  label: string;
  family: string | null;
  quantity: number;
  unit_price: number;
  tva_rate: number;
  tva_amount: number;
  total_amount: number;
}

export interface EInvoiceInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_siret: string | null;
  issue_date: string;
  due_date: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  status: string;
  reservation_id: string | null;
}

export interface EInvoiceSubmission {
  id: string;
  invoice_id: string;
  format: EInvoiceFormat;
  ubl_xml: string | null;
  payload_hash: string | null;
  lifecycle_status: EInvoiceLifecycle;
  transmission_status: EInvoiceTransmission;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  ppf_reference: string | null;
  ppf_response: any;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface EInvoiceDetail {
  submission: EInvoiceSubmission;
  invoice: EInvoiceInvoice;
  hotel: EInvoiceHotel;
  lines: EInvoiceLine[];
  events: EInvoiceEvent[];
}

// ─── RPCs ────────────────────────────────────────────────────────────────

export async function getEInvoiceDashboard(): Promise<EInvoiceDashboard | null> {
  const { data, error } = await (supabase.rpc as any)('einvoice_dashboard');
  if (error) return null;
  return data as EInvoiceDashboard;
}

export async function listEInvoices(): Promise<EInvoiceListRow[]> {
  const { data, error } = await (supabase.rpc as any)('einvoice_list');
  if (error) return [];
  return (data ?? []) as EInvoiceListRow[];
}

export async function getEInvoiceDetail(submissionId: string): Promise<EInvoiceDetail> {
  const { data, error } = await (supabase.rpc as any)('einvoice_get_detail', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
  return data as EInvoiceDetail;
}

export async function issueEInvoiceFromReservation(
  reservationId: string,
  format: EInvoiceFormat = 'ubl_2.1',
): Promise<{ invoice_id: string; submission_id: string; invoice_number: string; total_ttc: number }> {
  const { data, error } = await (supabase.rpc as any)('einvoice_issue_from_reservation', {
    p_reservation_id: reservationId,
    p_format: format,
  });
  if (error) throw error;
  return data;
}

export async function registerEInvoiceXml(
  submissionId: string,
  ublXml: string,
): Promise<{ success: boolean; payload_hash: string }> {
  const { data, error } = await (supabase.rpc as any)('einvoice_register_xml', {
    p_submission_id: submissionId,
    p_ubl_xml: ublXml,
  });
  if (error) throw error;
  return data;
}

export async function submitEInvoice(
  submissionId: string,
): Promise<{ success: boolean; ppf_reference?: string; attempt: number; next_retry_at?: string; error?: string }> {
  const { data, error } = await (supabase.rpc as any)('einvoice_submit', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
  return data;
}

export async function advanceEInvoice(
  submissionId: string,
  toStatus: EInvoiceLifecycle,
  message?: string,
): Promise<{ success: boolean; lifecycle_status: EInvoiceLifecycle }> {
  const { data, error } = await (supabase.rpc as any)('einvoice_advance', {
    p_submission_id: submissionId,
    p_to_status: toStatus,
    p_message: message ?? null,
  });
  if (error) throw error;
  return data;
}

// ─── Générateur UBL 2.1 ──────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const n2 = (v: number): string => (Math.round((v ?? 0) * 100) / 100).toFixed(2);

/**
 * Construit un document UBL 2.1 (norme EN 16931) conforme au profil
 * de facturation électronique français (PPF / réforme 2026).
 */
export function buildUbl21(detail: EInvoiceDetail): string {
  const { invoice, hotel, lines } = detail;
  const cur = hotel.currency || 'EUR';

  // Regroupement TVA par taux
  const taxGroups = new Map<number, { base: number; tax: number }>();
  for (const l of lines) {
    const ht = l.total_amount - l.tva_amount;
    const g = taxGroups.get(l.tva_rate) ?? { base: 0, tax: 0 };
    g.base += ht;
    g.tax += l.tva_amount;
    taxGroups.set(l.tva_rate, g);
  }

  const lineExtTotal = lines.reduce((s, l) => s + (l.total_amount - l.tva_amount), 0);

  const taxSubtotals = [...taxGroups.entries()]
    .map(([rate, g]) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${n2(g.base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${n2(g.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${rate > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${n2(rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`)
    .join('');

  const invoiceLines = lines
    .map((l, i) => {
      const ht = l.total_amount - l.tva_amount;
      const qty = l.quantity || 1;
      return `
  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${n2(qty)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${cur}">${n2(ht)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.label)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.tva_rate > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${n2(l.tva_rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${cur}">${n2(ht / qty)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ProfileID>urn:flowtym.fr:ppf:2026:billing</cbc:ProfileID>
  <cbc:ID>${esc(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${esc(invoice.issue_date)}</cbc:IssueDate>
  <cbc:DueDate>${esc(invoice.due_date)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(hotel.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(hotel.address)}</cbc:StreetName>
        <cbc:CityName>${esc(hotel.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(hotel.zip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(hotel.country)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(hotel.tva_number)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(hotel.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${esc(hotel.siret)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${esc(hotel.email)}</cbc:ElectronicMail>
        <cbc:Telephone>${esc(hotel.phone)}</cbc:Telephone>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(invoice.guest_name)}</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(invoice.guest_name)}</cbc:RegistrationName>
        ${invoice.guest_siret ? `<cbc:CompanyID>${esc(invoice.guest_siret)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${invoice.guest_email ? `<cac:Contact><cbc:ElectronicMail>${esc(invoice.guest_email)}</cbc:ElectronicMail></cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${n2(invoice.total_tva)}</cbc:TaxAmount>${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${n2(lineExtTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${n2(invoice.total_ht)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${n2(invoice.total_ttc)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${n2(invoice.total_ttc)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${invoiceLines}
</Invoice>`;
}
