/**
 * Tests du parser d'import des plans tarifaires partenaires (format 3 colonnes
 * avec forward-fill des cellules fusionnées à plat).
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePartnerRateExcel, derivePlanAttributes } from './partner-rate-import.service';

/** Construit un buffer XLSX à partir d'une matrice (1re ligne = en-têtes). */
function buildXlsx(rows: (string)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tarifs');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('derivePlanAttributes', () => {
  it('extrait meal plan / annulation / occupation depuis le code', () => {
    expect(derivePlanAttributes('OTA-BB-FLEX-1P')).toEqual({ mealPlan: 'BB', cancellationType: 'FLEX', occupancy: '1P' });
    expect(derivePlanAttributes('OTA-RO-NANR-2P')).toEqual({ mealPlan: 'RO', cancellationType: 'NANR', occupancy: '2P' });
    expect(derivePlanAttributes('RACK-HB-4P')).toEqual({ mealPlan: 'HB', cancellationType: null, occupancy: '4P' });
  });
});

describe('parsePartnerRateExcel — forward-fill', () => {
  it('reprend le dernier partenaire/activation connu quand la cellule est vide', () => {
    const buf = buildXlsx([
      ['Activation', 'Partenaires de distribution', 'Tarifs distribués'],
      ['Activé', 'Booking.com (6562)', 'OTA BB FLEX 1P (OTA-BB-FLEX-1P)'],
      ['', '', 'OTA BB FLEX 2P (OTA-BB-FLEX-2P)'],       // hérite Booking.com + Activé
      ['', 'Agoda (6144)', 'OTA RO NANR 1P (OTA-RO-NANR-1P)'],
      ['', '', 'OTA RO NANR 2P (OTA-RO-NANR-2P)'],       // hérite Agoda
    ]);
    const report = parsePartnerRateExcel(buf, 'test.xlsx');

    expect(report.errors).toEqual([]);
    expect(report.plans).toHaveLength(4);

    // Forward-fill du partenaire
    expect(report.plans[0].partnerName).toBe('Booking.com');
    expect(report.plans[1].partnerName).toBe('Booking.com');   // hérité
    expect(report.plans[2].partnerName).toBe('Agoda');
    expect(report.plans[3].partnerName).toBe('Agoda');         // hérité

    // External id partenaire
    expect(report.plans[0].partnerExternalId).toBe('6562');
    expect(report.plans[2].partnerExternalId).toBe('6144');

    // Extraction nom + code du plan
    expect(report.plans[0].name).toBe('OTA BB FLEX 1P');
    expect(report.plans[0].code).toBe('OTA-BB-FLEX-1P');

    // Activation forward-fill (toutes activées)
    expect(report.plans.every((p) => p.isActive)).toBe(true);

    // Partenaires dédupliqués
    expect(report.partners.map((p) => p.name).sort()).toEqual(['Agoda', 'Booking.com']);
    expect(report.partners.find((p) => p.name === 'Agoda')?.externalId).toBe('6144');

    // Attributs dérivés
    expect(report.plans[0]).toMatchObject({ mealPlan: 'BB', cancellationType: 'FLEX', occupancy: '1P' });
    expect(report.plans[2]).toMatchObject({ mealPlan: 'RO', cancellationType: 'NANR', occupancy: '1P' });
  });

  it('signale une erreur si un plan apparaît sans aucun partenaire connu', () => {
    const buf = buildXlsx([
      ['Activation', 'Partenaires de distribution', 'Tarifs distribués'],
      ['Activé', '', 'OTA BB FLEX 1P (OTA-BB-FLEX-1P)'],   // aucun partenaire en amont
    ]);
    const report = parsePartnerRateExcel(buf, 'test.xlsx');
    expect(report.plans).toHaveLength(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toMatch(/sans partenaire/i);
  });

  it('gère les en-têtes accentués / casse variable', () => {
    const buf = buildXlsx([
      ['ACTIVATION', 'Partenaires De Distribution', 'Tarifs Distribués'],
      ['Désactivé', 'Expedia (999)', 'Rack RO FLEX (RACK-RO-FLEX)'],
    ]);
    const report = parsePartnerRateExcel(buf, 'test.xlsx');
    expect(report.plans).toHaveLength(1);
    expect(report.plans[0].isActive).toBe(false);   // "Désactivé"
    expect(report.plans[0].partnerName).toBe('Expedia');
    expect(report.plans[0].code).toBe('RACK-RO-FLEX');
  });
});
