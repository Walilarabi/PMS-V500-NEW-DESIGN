/**
 * FLOWTYM RMS — Tests buildMarketMonth
 *
 * Règle métier : TOUTES les dates de la période doivent apparaître dans
 * le graphique « Écart des tarifs », même si :
 *   - le marché est épuisé (tous concurrents sold_out)
 *   - des restrictions LOS / CTA sont détectées
 *   - la demande Lighthouse existe mais aucun tarif n'est disponible
 *   - Folkestone est disponible mais le compset est indisponible
 */

import { describe, it, expect } from 'vitest';
import { buildMarketMonth } from './lighthouseToCompetitiveWatch';
import type { LighthouseImport } from '../../services/lighthouse-parser.service';

/* ────────────────────────────────────────────────────────────────────────── */
/* FIXTURES                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function makeImport(overrides: Partial<LighthouseImport['days'][0]>[]): LighthouseImport {
  return {
    fileName: 'test.xlsx',
    importedAt: new Date().toISOString(),
    ourHotelName: 'Folkestone Opéra',
    competitorNames: ['Hôtel A', 'Hôtel B', 'Hôtel C'],
    days: overrides.map((o, i) => ({
      date: `2026-06-0${i + 1}`,
      dayName: 'lundi',
      ourPrice: 200,
      compsetMedian: 210,
      marketDemand: 0.5,
      marketDemandPercent: 50,
      ranking: '3/10',
      rankPosition: 3,
      rankTotal: 10,
      bookingRank: '',
      holidays: '',
      events: '',
      competitors: [],
      compsetMin: null,
      compsetMax: null,
      varVsYesterday: null,
      varVs3Days: null,
      varVs7Days: null,
      ...o,
    })),
    sheetsFound: [],
    warnings: [],
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 1 : Tarif complet — tout disponible                                    */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — cas nominal', () => {
  it('retourne la date avec tous les champs remplis', () => {
    const lh = makeImport([{
      date: '2026-06-01',
      ourPrice: 250,
      compsetMedian: 240,
      marketDemandPercent: 65,
      competitors: [
        { hotelName: 'Hôtel A', price: 230, status: 'available', rawValue: '230' },
        { hotelName: 'Hôtel B', price: 245, status: 'available', rawValue: '245' },
        { hotelName: 'Hôtel C', price: 255, status: 'available', rawValue: '255' },
      ],
    }]);

    const result = buildMarketMonth(lh);
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.date).toBe('2026-06-01');
    expect(day.demand).toBe(65);
    expect(day.ourPrice).toBe(250);
    expect(day.median).toBe(240);
    expect(day.mean).not.toBeNull();
    expect(day.q25).not.toBeNull();
    expect(day.q75).not.toBeNull();
    expect(day.marketStatus).toBe('ok');
    expect(day.availableCount).toBe(3);
    expect(day.soldOutCount).toBe(0);
    expect(day.restrictedCount).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 2 : Marché épuisé — tous concurrents sold_out                          */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — marché épuisé', () => {
  it('conserve la date avec demand présente et prices null', () => {
    const lh = makeImport([{
      date: '2026-06-01',
      ourPrice: 0,         // notre hôtel aussi épuisé
      compsetMedian: 0,    // médiane non calculable
      marketDemandPercent: 96, // Lighthouse indique 96 % de demande !
      competitors: [
        { hotelName: 'Hôtel A', price: null, status: 'sold_out', rawValue: 'Épuisé' },
        { hotelName: 'Hôtel B', price: null, status: 'sold_out', rawValue: 'Épuisé' },
        { hotelName: 'Hôtel C', price: null, status: 'sold_out', rawValue: 'Épuisé' },
      ],
    }]);

    const result = buildMarketMonth(lh);
    // La date NE DOIT PAS disparaître
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.date).toBe('2026-06-01');
    expect(day.demand).toBe(96);
    // Les prix sont null — pas de valeur inventée
    expect(day.ourPrice).toBeNull();
    expect(day.median).toBeNull();
    expect(day.mean).toBeNull();
    expect(day.q25).toBeNull();
    expect(day.q75).toBeNull();
    expect(day.marketStatus).toBe('sold_out');
    expect(day.soldOutCount).toBe(3);
    expect(day.availableCount).toBe(0);
  });

  it('préserve les dates 01/06 et 02/06 avec demande forte', () => {
    const lh = makeImport([
      {
        date: '2026-06-01',
        ourPrice: 0,
        compsetMedian: 0,
        marketDemandPercent: 96,
        competitors: [
          { hotelName: 'Hôtel A', price: null, status: 'sold_out', rawValue: 'Épuisé' },
        ],
      },
      {
        date: '2026-06-02',
        ourPrice: 0,
        compsetMedian: 0,
        marketDemandPercent: 98,
        competitors: [
          { hotelName: 'Hôtel A', price: null, status: 'sold_out', rawValue: 'Épuisé' },
        ],
      },
    ]);

    const result = buildMarketMonth(lh);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-06-01');
    expect(result[0].demand).toBe(96);
    expect(result[1].date).toBe('2026-06-02');
    expect(result[1].demand).toBe(98);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 3 : Restrictions LOS / CTA                                             */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — restrictions LOS', () => {
  it('conserve la date, prices null, status = restricted', () => {
    const lh = makeImport([{
      date: '2026-06-03',
      ourPrice: 0,
      compsetMedian: 0,
      marketDemandPercent: 72,
      competitors: [
        { hotelName: 'Hôtel A', price: null, status: 'restricted', rawValue: 'LOS2' },
        { hotelName: 'Hôtel B', price: null, status: 'restricted', rawValue: 'CTA' },
        { hotelName: 'Hôtel C', price: null, status: 'restricted', rawValue: 'MIN 3' },
      ],
    }]);

    const result = buildMarketMonth(lh);
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.date).toBe('2026-06-03');
    expect(day.demand).toBe(72);
    expect(day.ourPrice).toBeNull();
    expect(day.median).toBeNull();
    expect(day.marketStatus).toBe('restricted');
    expect(day.restrictedCount).toBe(3);
    expect(day.availableCount).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 4 : Demande Lighthouse présente, aucun tarif disponible                */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — demande sans tarif', () => {
  it('affiche la demande, prices null, aucune valeur inventée', () => {
    const lh = makeImport([{
      date: '2026-06-04',
      ourPrice: 0,
      compsetMedian: 0,
      marketDemandPercent: 83,
      competitors: [],  // aucune donnée tarifaire
    }]);

    const result = buildMarketMonth(lh);
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.demand).toBe(83);
    expect(day.ourPrice).toBeNull();
    expect(day.median).toBeNull();
    expect(day.mean).toBeNull();
    // Aucune valeur fictive
    expect(day.ourPrice).not.toBe(0);
    expect(day.median).not.toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 5 : Folkestone disponible, compset indisponible                        */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — Folkestone dispo, compset absent', () => {
  it('affiche ourPrice avec median null, status = insufficient_data', () => {
    const lh = makeImport([{
      date: '2026-06-05',
      ourPrice: 290,    // Folkestone a un tarif
      compsetMedian: 0, // mais la médiane compset est absente
      marketDemandPercent: 88,
      competitors: [
        { hotelName: 'Hôtel A', price: null, status: 'sold_out', rawValue: 'Épuisé' },
        { hotelName: 'Hôtel B', price: null, status: 'restricted', rawValue: 'LOS2' },
      ],
    }]);

    const result = buildMarketMonth(lh);
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.date).toBe('2026-06-05');
    expect(day.demand).toBe(88);
    // Notre tarif est visible
    expect(day.ourPrice).toBe(290);
    // Médiane non calculable
    expect(day.median).toBeNull();
    expect(day.mean).toBeNull();
    expect(day.marketStatus).toBe('insufficient_data');
    expect(day.availableCount).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* CAS 6 : Aucune date ne doit disparaître dans un range complet              */
/* ────────────────────────────────────────────────────────────────────────── */

describe('buildMarketMonth — aucune date ne disparaît', () => {
  it('retourne exactement le même nombre de dates que dans l\'import', () => {
    const days = [
      { date: '2026-06-01', ourPrice: 250, compsetMedian: 240, marketDemandPercent: 65, competitors: [] },
      { date: '2026-06-02', ourPrice: 0,   compsetMedian: 0,   marketDemandPercent: 98, competitors: [{ hotelName: 'A', price: null, status: 'sold_out' as const, rawValue: 'Épuisé' }] },
      { date: '2026-06-03', ourPrice: 0,   compsetMedian: 0,   marketDemandPercent: 72, competitors: [{ hotelName: 'A', price: null, status: 'restricted' as const, rawValue: 'LOS2' }] },
      { date: '2026-06-04', ourPrice: 290, compsetMedian: 0,   marketDemandPercent: 88, competitors: [] },
    ];

    const lh: LighthouseImport = {
      fileName: 'test.xlsx',
      importedAt: new Date().toISOString(),
      ourHotelName: 'Folkestone Opéra',
      competitorNames: ['Hôtel A'],
      days: days.map(d => ({
        ...d,
        dayName: 'lundi',
        marketDemand: d.marketDemandPercent / 100,
        ranking: '',
        rankPosition: null,
        rankTotal: null,
        bookingRank: '',
        holidays: '',
        events: '',
        compsetMin: null,
        compsetMax: null,
        varVsYesterday: null,
        varVs3Days: null,
        varVs7Days: null,
      })),
      sheetsFound: [],
      warnings: [],
    };

    const result = buildMarketMonth(lh);
    // Toutes les dates sont présentes — aucun filtre ne supprime une date
    expect(result).toHaveLength(4);
    expect(result.map(d => d.date)).toEqual([
      '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04',
    ]);
    // Chaque date a bien sa demande Lighthouse
    expect(result[0].demand).toBe(65);
    expect(result[1].demand).toBe(98);
    expect(result[2].demand).toBe(72);
    expect(result[3].demand).toBe(88);
  });
});
