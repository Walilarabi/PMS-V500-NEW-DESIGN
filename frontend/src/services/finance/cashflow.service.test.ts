import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { buildSageCsv, buildCegidCsv } from './cashflow.service';
import type { JournalLine } from './cashflow.service';

const DEBIT_LINE: JournalLine = {
  date: '2026-05-22',
  journal: 'VT',
  account: '411000',
  account_label: 'Clients',
  label: 'Facture FE-2026-00001',
  piece: 'FE-2026-00001',
  debit: 220,
  credit: 0,
};

const CREDIT_LINE: JournalLine = {
  date: '2026-05-22',
  journal: 'VT',
  account: '445710',
  account_label: 'TVA collectée',
  label: 'Facture FE-2026-00001',
  piece: 'FE-2026-00001',
  debit: 0,
  credit: 20,
};

describe('buildSageCsv', () => {
  it('place l\'en-tête de colonnes Sage en première ligne', () => {
    const csv = buildSageCsv([DEBIT_LINE]);
    expect(csv.split('\r\n')[0]).toBe('Journal;Date;Compte;Libelle;Debit;Credit;Piece');
  });

  it('formate une écriture au débit (date JJ/MM/AAAA, décimale virgule)', () => {
    const csv = buildSageCsv([DEBIT_LINE]);
    expect(csv.split('\r\n')[1]).toBe(
      'VT;22/05/2026;411000;Facture FE-2026-00001;220,00;0,00;FE-2026-00001',
    );
  });

  it('formate une écriture au crédit', () => {
    const csv = buildSageCsv([CREDIT_LINE]);
    expect(csv.split('\r\n')[1]).toBe(
      'VT;22/05/2026;445710;Facture FE-2026-00001;0,00;20,00;FE-2026-00001',
    );
  });

  it('neutralise les points-virgules présents dans un libellé', () => {
    const csv = buildSageCsv([{ ...DEBIT_LINE, label: 'Facture; ligne 1' }]);
    // le séparateur de colonnes reste fiable : 7 colonnes
    expect(csv.split('\r\n')[1].split(';')).toHaveLength(7);
    expect(csv).toContain('Facture  ligne 1');
  });

  it('génère une ligne par écriture comptable', () => {
    const csv = buildSageCsv([DEBIT_LINE, CREDIT_LINE]);
    expect(csv.split('\r\n')).toHaveLength(3); // en-tête + 2 lignes
  });
});

describe('buildCegidCsv', () => {
  it('place l\'en-tête de colonnes Cegid en première ligne', () => {
    const csv = buildCegidCsv([DEBIT_LINE]);
    expect(csv.split('\r\n')[0]).toBe(
      'Date;CodeJournal;NumeroCompte;LibelleEcriture;Sens;Montant;NumeroPiece',
    );
  });

  it('formate une écriture au débit (date AAAAMMJJ, sens D)', () => {
    const csv = buildCegidCsv([DEBIT_LINE]);
    expect(csv.split('\r\n')[1]).toBe(
      '20260522;VT;411000;Facture FE-2026-00001;D;220,00;FE-2026-00001',
    );
  });

  it('marque le sens C et reporte le montant crédit pour une écriture au crédit', () => {
    const csv = buildCegidCsv([CREDIT_LINE]);
    expect(csv.split('\r\n')[1]).toBe(
      '20260522;VT;445710;Facture FE-2026-00001;C;20,00;FE-2026-00001',
    );
  });
});
