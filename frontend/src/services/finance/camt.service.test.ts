import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { parseCamt053, buildCamt053 } from './camt.service';
import type { CamtStatementPayload } from './camt.service';

const SAMPLE_CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <Stmt>
      <Id>BANKSTMT-9</Id>
      <Acct><Id><IBAN>FR7612345678901234567890123</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">500.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-05-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">800.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-05-31</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">300.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-05-15</Dt></BookgDt>
        <ValDt><Dt>2026-05-16</Dt></ValDt>
        <AcctSvcrRef>REF-123</AcctSvcrRef>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>E2E-XYZ</EndToEndId></Refs>
          <RltdPties><Dbtr><Nm>Client Test</Nm></Dbtr></RltdPties>
          <RmtInf><Ustrd>Paiement sejour</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe('parseCamt053', () => {
  it('extrait l\'en-tête du relevé (référence, IBAN, devise, soldes)', () => {
    const r = parseCamt053(SAMPLE_CAMT, 'releve.xml');

    expect(r.statement_ref).toBe('BANKSTMT-9');
    expect(r.iban).toBe('FR7612345678901234567890123');
    expect(r.currency).toBe('EUR');
    expect(r.opening_balance).toBe(500);
    expect(r.closing_balance).toBe(800);
    expect(r.from_date).toBe('2026-05-01');
    expect(r.to_date).toBe('2026-05-31');
  });

  it('extrait les écritures avec leurs détails', () => {
    const r = parseCamt053(SAMPLE_CAMT, 'releve.xml');

    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0]).toMatchObject({
      amount: 300,
      credit_debit: 'CRDT',
      booking_date: '2026-05-15',
      value_date: '2026-05-16',
      counterparty: 'Client Test',
      remittance_info: 'Paiement sejour',
      end_to_end_id: 'E2E-XYZ',
      bank_reference: 'REF-123',
    });
  });

  it('rejette un fichier XML illisible', () => {
    expect(() => parseCamt053('<<< pas du xml', 'bad.xml')).toThrow(/XML invalide/i);
  });

  it('rejette un XML sans élément <Stmt>', () => {
    expect(() => parseCamt053('<Document><Autre/></Document>', 'x.xml'))
      .toThrow(/Stmt/);
  });

  it('rejette un relevé sans aucune écriture', () => {
    const empty = `<?xml version="1.0"?>
      <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
        <BkToCstmrStmt><Stmt>
          <Id>VIDE</Id>
          <Acct><Id><IBAN>FR76</IBAN></Id><Ccy>EUR</Ccy></Acct>
        </Stmt></BkToCstmrStmt>
      </Document>`;
    expect(() => parseCamt053(empty, 'vide.xml')).toThrow(/Ntry|écriture/i);
  });
});

describe('buildCamt053 + parseCamt053 (aller-retour)', () => {
  const payload: CamtStatementPayload = {
    statement_ref: 'STMT-001',
    iban: 'FR7630006000011234567890189',
    currency: 'EUR',
    opening_balance: 1000,
    closing_balance: 1350,
    from_date: '2026-05-01',
    to_date: '2026-05-31',
    filename: 'aller-retour.xml',
    transactions: [
      {
        booking_date: '2026-05-10', value_date: '2026-05-10', amount: 250,
        credit_debit: 'CRDT', currency: 'EUR', counterparty: 'Jean Dupont',
        remittance_info: 'Sejour ABC', end_to_end_id: 'E2E-1', bank_reference: 'ACCT001',
      },
      {
        booking_date: '2026-05-12', value_date: '2026-05-12', amount: 90,
        credit_debit: 'DBIT', currency: 'EUR', counterparty: 'Banque',
        remittance_info: 'Frais de tenue', end_to_end_id: '', bank_reference: 'ACCT002',
      },
    ],
  };

  it('conserve l\'en-tête du relevé après un aller-retour', () => {
    const parsed = parseCamt053(buildCamt053(payload), 'aller-retour.xml');

    expect(parsed.statement_ref).toBe('STMT-001');
    expect(parsed.iban).toBe('FR7630006000011234567890189');
    expect(parsed.opening_balance).toBe(1000);
    expect(parsed.closing_balance).toBe(1350);
  });

  it('conserve les montants, sens et contreparties des écritures', () => {
    const parsed = parseCamt053(buildCamt053(payload), 'aller-retour.xml');

    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]).toMatchObject({
      amount: 250, credit_debit: 'CRDT', counterparty: 'Jean Dupont',
      remittance_info: 'Sejour ABC', end_to_end_id: 'E2E-1',
    });
    expect(parsed.transactions[1]).toMatchObject({
      amount: 90, credit_debit: 'DBIT', counterparty: 'Banque',
    });
  });

  it('substitue NOTPROVIDED à une référence de bout en bout vide', () => {
    const parsed = parseCamt053(buildCamt053(payload), 'aller-retour.xml');
    expect(parsed.transactions[1].end_to_end_id).toBe('NOTPROVIDED');
  });
});
