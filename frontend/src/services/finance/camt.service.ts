/**
 * FLOWTYM — Service Rapprochement bancaire CAMT.053 (Vague F6)
 *
 * Import de relevés bancaires ISO 20022 (camt.053), rapprochement
 * automatique avec les paiements et matching manuel assisté.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────

export type CreditDebit = 'CRDT' | 'DBIT';
export type TxStatus = 'unmatched' | 'matched' | 'ignored';

export interface CamtTransactionInput {
  booking_date: string;
  value_date: string;
  amount: number;
  credit_debit: CreditDebit;
  currency: string;
  counterparty: string;
  remittance_info: string;
  end_to_end_id: string;
  bank_reference: string;
}

export interface CamtStatementPayload {
  statement_ref: string;
  iban: string;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  from_date: string | null;
  to_date: string | null;
  filename: string;
  transactions: CamtTransactionInput[];
}

export interface BankStatement {
  id: string;
  statement_ref: string | null;
  iban: string | null;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  from_date: string | null;
  to_date: string | null;
  filename: string | null;
  imported_at: string;
  entry_count: number;
  matched: number;
  unmatched: number;
}

export interface BankTransaction {
  id: string;
  booking_date: string | null;
  value_date: string | null;
  amount: number;
  credit_debit: CreditDebit;
  currency: string;
  counterparty: string | null;
  remittance_info: string | null;
  end_to_end_id: string | null;
  bank_reference: string | null;
  status: TxStatus;
  match_confidence: number | null;
  match_method: string | null;
  matched_payment_id: string | null;
  payment: {
    amount: number;
    payment_method: string | null;
    payment_date: string | null;
    reference: string | null;
    reservation_id: string | null;
  } | null;
}

export interface CamtDashboard {
  statements: number;
  transactions: number;
  matched: number;
  unmatched: number;
  ignored: number;
  credits: number;
  total_credited: number;
  total_matched: number;
  match_rate: number;
}

export interface MatchCandidate {
  payment_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  reference: string | null;
  transaction_id: string | null;
  reservation_id: string | null;
  amount_delta: number;
  score: number;
}

// ─── CAMT.053 XML parsing ────────────────────────────────────────────────

const txt = (parent: Element | Document, tag: string): string => {
  const el = parent.getElementsByTagNameNS('*', tag)[0];
  return el?.textContent?.trim() ?? '';
};

const firstChildText = (parent: Element, tag: string): string => {
  for (const child of Array.from(parent.children)) {
    if (child.localName === tag) return child.textContent?.trim() ?? '';
  }
  return '';
};

/**
 * Parse un fichier CAMT.053 (ISO 20022) en charge utile importable.
 * Tolère les variantes de version (camt.053.001.02 → .08+).
 */
export function parseCamt053(xmlString: string, filename: string): CamtStatementPayload {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Fichier XML invalide ou illisible');
  }

  const stmt = doc.getElementsByTagNameNS('*', 'Stmt')[0];
  if (!stmt) throw new Error('Format non reconnu : élément <Stmt> CAMT.053 absent');

  // Référence du relevé : premier <Id> direct du <Stmt>
  const statementRef = firstChildText(stmt, 'Id') || `STMT-${Date.now()}`;

  const acct = stmt.getElementsByTagNameNS('*', 'Acct')[0];
  const iban = acct ? txt(acct, 'IBAN') : '';
  const currency = (acct ? txt(acct, 'Ccy') : '') || 'EUR';

  // Soldes d'ouverture (OPBD/PRCD) et de clôture (CLBD)
  let opening: number | null = null;
  let closing: number | null = null;
  const fromTo: string[] = [];
  for (const bal of Array.from(stmt.getElementsByTagNameNS('*', 'Bal'))) {
    const code = txt(bal, 'Cd');
    const amt = parseFloat(txt(bal, 'Amt'));
    const sign = txt(bal, 'CdtDbtInd') === 'DBIT' ? -1 : 1;
    const dt = txt(bal, 'Dt');
    if (dt) fromTo.push(dt);
    if (Number.isFinite(amt)) {
      if (code === 'OPBD' || code === 'PRCD') opening = amt * sign;
      if (code === 'CLBD') closing = amt * sign;
    }
  }
  fromTo.sort();

  const transactions: CamtTransactionInput[] = [];
  for (const ntry of Array.from(stmt.getElementsByTagNameNS('*', 'Ntry'))) {
    const amount = parseFloat(txt(ntry, 'Amt'));
    if (!Number.isFinite(amount)) continue;
    const cd = (txt(ntry, 'CdtDbtInd') === 'DBIT' ? 'DBIT' : 'CRDT') as CreditDebit;

    const bookg = ntry.getElementsByTagNameNS('*', 'BookgDt')[0];
    const valdt = ntry.getElementsByTagNameNS('*', 'ValDt')[0];
    const bookingDate = bookg ? txt(bookg, 'Dt') || txt(bookg, 'DtTm').slice(0, 10) : '';
    const valueDate = valdt ? txt(valdt, 'Dt') || txt(valdt, 'DtTm').slice(0, 10) : '';

    // Contrepartie : débiteur si CRDT (argent entrant), créditeur si DBIT
    const txDtls = ntry.getElementsByTagNameNS('*', 'TxDtls')[0] ?? ntry;
    const dbtr = txDtls.getElementsByTagNameNS('*', 'Dbtr')[0];
    const cdtr = txDtls.getElementsByTagNameNS('*', 'Cdtr')[0];
    const party = cd === 'CRDT' ? dbtr : cdtr;
    const counterparty = party ? txt(party, 'Nm') : '';

    const ustrd = Array.from(txDtls.getElementsByTagNameNS('*', 'Ustrd'))
      .map(e => e.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');

    transactions.push({
      booking_date: bookingDate || valueDate,
      value_date: valueDate || bookingDate,
      amount: Math.abs(amount),
      credit_debit: cd,
      currency: ntry.getElementsByTagNameNS('*', 'Amt')[0]?.getAttribute('Ccy') ?? currency,
      counterparty,
      remittance_info: ustrd,
      end_to_end_id: txt(txDtls, 'EndToEndId'),
      bank_reference: txt(ntry, 'AcctSvcrRef'),
    });
  }

  if (transactions.length === 0) {
    throw new Error('Aucune écriture <Ntry> trouvée dans le relevé');
  }

  return {
    statement_ref: statementRef,
    iban,
    currency,
    opening_balance: opening,
    closing_balance: closing,
    from_date: fromTo[0] ?? null,
    to_date: fromTo[fromTo.length - 1] ?? null,
    filename,
    transactions,
  };
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Sérialise une charge utile en document CAMT.053 (pour téléchargement
 * d'un relevé de démonstration réimportable).
 */
export function buildCamt053(p: CamtStatementPayload): string {
  const entries = p.transactions.map(t => `
      <Ntry>
        <Amt Ccy="${esc(t.currency)}">${t.amount.toFixed(2)}</Amt>
        <CdtDbtInd>${t.credit_debit}</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>${esc(t.booking_date)}</Dt></BookgDt>
        <ValDt><Dt>${esc(t.value_date)}</Dt></ValDt>
        <AcctSvcrRef>${esc(t.bank_reference)}</AcctSvcrRef>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>${esc(t.end_to_end_id) || 'NOTPROVIDED'}</EndToEndId></Refs>
          <RltdPties>
            <${t.credit_debit === 'CRDT' ? 'Dbtr' : 'Cdtr'}><Nm>${esc(t.counterparty)}</Nm></${t.credit_debit === 'CRDT' ? 'Dbtr' : 'Cdtr'}>
          </RltdPties>
          <RmtInf><Ustrd>${esc(t.remittance_info)}</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>${esc(p.statement_ref)}</MsgId><CreDtTm>${new Date().toISOString()}</CreDtTm></GrpHdr>
    <Stmt>
      <Id>${esc(p.statement_ref)}</Id>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <Acct><Id><IBAN>${esc(p.iban)}</IBAN></Id><Ccy>${esc(p.currency)}</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="${esc(p.currency)}">${(p.opening_balance ?? 0).toFixed(2)}</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>${esc(p.from_date)}</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="${esc(p.currency)}">${(p.closing_balance ?? 0).toFixed(2)}</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>${esc(p.to_date)}</Dt></Dt>
      </Bal>${entries}
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}

// ─── RPCs ────────────────────────────────────────────────────────────────

export async function importCamtStatement(
  payload: CamtStatementPayload,
): Promise<{ statement_id: string; inserted: number; duplicates: number }> {
  const { data, error } = await (supabase.rpc as any)('camt_import_statement', { p_payload: payload });
  if (error) throw error;
  return data;
}

export async function autoMatchStatement(
  statementId: string,
): Promise<{ scanned: number; matched: number }> {
  const { data, error } = await (supabase.rpc as any)('camt_auto_match', { p_statement_id: statementId });
  if (error) throw error;
  return data;
}

export async function getCamtDashboard(): Promise<CamtDashboard | null> {
  const { data, error } = await (supabase.rpc as any)('camt_dashboard');
  if (error) return null;
  return data as CamtDashboard;
}

export async function listBankStatements(): Promise<BankStatement[]> {
  const { data, error } = await (supabase.rpc as any)('camt_list_statements');
  if (error) return [];
  return (data ?? []) as BankStatement[];
}

export async function listBankTransactions(statementId: string): Promise<BankTransaction[]> {
  const { data, error } = await (supabase.rpc as any)('camt_list_transactions', {
    p_statement_id: statementId,
  });
  if (error) return [];
  return (data ?? []) as BankTransaction[];
}

export async function getMatchCandidates(transactionId: string): Promise<MatchCandidate[]> {
  const { data, error } = await (supabase.rpc as any)('camt_match_candidates', {
    p_transaction_id: transactionId,
  });
  if (error) return [];
  return (data ?? []) as MatchCandidate[];
}

export async function confirmMatch(transactionId: string, paymentId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('camt_confirm_match', {
    p_transaction_id: transactionId,
    p_payment_id: paymentId,
  });
  if (error) throw error;
}

export async function unmatchTransaction(transactionId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('camt_unmatch', { p_transaction_id: transactionId });
  if (error) throw error;
}

export async function setTransactionIgnored(transactionId: string, ignored: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('camt_set_ignored', {
    p_transaction_id: transactionId,
    p_ignored: ignored,
  });
  if (error) throw error;
}

export async function seedSampleCamt(): Promise<CamtStatementPayload> {
  const { data, error } = await (supabase.rpc as any)('camt_seed_sample');
  if (error) throw error;
  return data as CamtStatementPayload;
}
