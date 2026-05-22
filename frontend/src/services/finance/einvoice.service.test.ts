import { describe, it, expect, vi } from 'vitest';

// Le service importe le client Supabase au chargement du module — on le
// neutralise puisque buildUbl21 est une fonction pure sans I/O.
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { buildUbl21 } from './einvoice.service';
import type { EInvoiceDetail, EInvoiceLine } from './einvoice.service';

const HOTEL = {
  id: 'h1',
  name: 'Hôtel Test',
  address: '1 rue de la Paix',
  city: 'Paris',
  zip: '75001',
  country: 'FR',
  siret: '12345678900012',
  tva_number: 'FR12345678900',
  email: 'contact@test.fr',
  phone: '+33100000000',
  currency: 'EUR',
};

function makeLine(over: Partial<EInvoiceLine> = {}): EInvoiceLine {
  return {
    id: null,
    label: 'Nuitée',
    family: 'accommodation',
    quantity: 1,
    unit_price: 100,
    tva_rate: 10,
    tva_amount: 10,
    total_amount: 110,
    ...over,
  };
}

function makeDetail(lines: EInvoiceLine[], invoiceOver: Record<string, unknown> = {}): EInvoiceDetail {
  const total_ht = lines.reduce((s, l) => s + (l.total_amount - l.tva_amount), 0);
  const total_tva = lines.reduce((s, l) => s + l.tva_amount, 0);
  const total_ttc = lines.reduce((s, l) => s + l.total_amount, 0);
  return {
    submission: {} as EInvoiceDetail['submission'],
    events: [],
    hotel: HOTEL,
    lines,
    invoice: {
      id: 'i1',
      invoice_number: 'FE-2026-00001',
      invoice_type: 'standard',
      guest_name: 'Jean Dupont',
      guest_email: 'jean@test.fr',
      guest_siret: null,
      issue_date: '2026-05-22',
      due_date: '2026-06-21',
      total_ht,
      total_tva,
      total_ttc,
      status: 'issued',
      reservation_id: null,
      ...invoiceOver,
    },
  };
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

describe('buildUbl21', () => {
  it('produit un document XML bien formé dont la racine est <Invoice>', () => {
    const xml = buildUbl21(makeDetail([makeLine()]));
    const doc = parseXml(xml);

    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.localName).toBe('Invoice');
  });

  it('renseigne les identifiants de la facture', () => {
    const xml = buildUbl21(makeDetail([makeLine()]));

    expect(xml).toContain('<cbc:ID>FE-2026-00001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-05-22</cbc:IssueDate>');
    expect(xml).toContain('<cbc:DueDate>2026-06-21</cbc:DueDate>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>');
  });

  it('intègre l\'identité du fournisseur (SIRET et n° de TVA)', () => {
    const xml = buildUbl21(makeDetail([makeLine()]));

    expect(xml).toContain('<cbc:CompanyID>12345678900012</cbc:CompanyID>');
    expect(xml).toContain('<cbc:CompanyID>FR12345678900</cbc:CompanyID>');
    expect(xml).toContain('Hôtel Test');
  });

  it('intègre le nom du client', () => {
    const xml = buildUbl21(makeDetail([makeLine()]));
    expect(xml).toContain('Jean Dupont');
  });

  it('émet une ligne <cac:InvoiceLine> par prestation', () => {
    const xml = buildUbl21(makeDetail([
      makeLine({ label: 'Nuitée' }),
      makeLine({ label: 'Petit-déjeuner', tva_rate: 10, tva_amount: 1, total_amount: 11 }),
    ]));
    expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(2);
  });

  it('calcule le montant HT d\'une ligne comme TTC moins TVA', () => {
    // quantité 2, TTC 220, TVA 20 → HT 200, prix unitaire HT 100
    const xml = buildUbl21(makeDetail([
      makeLine({ quantity: 2, total_amount: 220, tva_amount: 20, tva_rate: 10 }),
    ]));

    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount>');
  });

  it('totalise les montants légaux (HT, TVA, TTC)', () => {
    const xml = buildUbl21(makeDetail([
      makeLine({ total_amount: 110, tva_amount: 10 }),
      makeLine({ total_amount: 110, tva_amount: 10 }),
    ]));

    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="EUR">200.00</cbc:TaxExclusiveAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">220.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">220.00</cbc:PayableAmount>');
  });

  it('regroupe la TVA en un seul TaxSubtotal lorsque le taux est identique', () => {
    const xml = buildUbl21(makeDetail([
      makeLine({ tva_rate: 10, tva_amount: 10, total_amount: 110 }),
      makeLine({ tva_rate: 10, tva_amount: 10, total_amount: 110 }),
    ]));
    expect(xml.match(/<cac:TaxSubtotal>/g)).toHaveLength(1);
  });

  it('émet un TaxSubtotal distinct par taux de TVA', () => {
    const xml = buildUbl21(makeDetail([
      makeLine({ tva_rate: 10, tva_amount: 10, total_amount: 110 }),
      makeLine({ tva_rate: 20, tva_amount: 20, total_amount: 120 }),
    ]));
    expect(xml.match(/<cac:TaxSubtotal>/g)).toHaveLength(2);
  });

  it('échappe les caractères réservés XML dans le texte libre', () => {
    const detail = makeDetail([makeLine()]);
    detail.hotel = { ...HOTEL, name: 'Bar & Café <Resto>' };
    const xml = buildUbl21(detail);

    expect(xml).toContain('Bar &amp; Café &lt;Resto&gt;');
    expect(xml).not.toContain('Bar & Café');
    expect(parseXml(xml).getElementsByTagName('parsererror')).toHaveLength(0);
  });
});
