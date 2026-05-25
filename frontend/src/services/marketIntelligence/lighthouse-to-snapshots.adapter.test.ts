/**
 * FLOWTYM RMS — Tests Lighthouse Adapter
 */

import { describe, it, expect } from 'vitest';
import {
  lighthouseDayToSnapshot,
  lighthouseImportToSnapshots,
} from './lighthouse-to-snapshots.adapter';
import type {
  CompetitorRate,
  LighthouseDayData,
  LighthouseImport,
} from '../lighthouse-parser.service';

function comp(name: string, status: CompetitorRate['status'], price: number | null = 200): CompetitorRate {
  return { hotelName: name, price, status, rawValue: String(price ?? status) };
}

function day(overrides: Partial<LighthouseDayData> = {}): LighthouseDayData {
  return {
    date: '2026-06-15',
    dayName: 'Lun',
    ourPrice: 195,
    compsetMedian: 200,
    marketDemand: 0.5,
    marketDemandPercent: 50,
    ranking: '5 sur 10',
    rankPosition: 5,
    rankTotal: 10,
    bookingRank: '5',
    holidays: '',
    events: '',
    competitors: [
      comp('A', 'available', 200),
      comp('B', 'available', 210),
      comp('C', 'available', 205),
      comp('D', 'available', 195),
    ],
    compsetMin: 195,
    compsetMax: 210,
    ...overrides,
  };
}

describe('lighthouseDayToSnapshot — marché calme', () => {
  it('availability ≈ 1 si tous available', () => {
    const s = lighthouseDayToSnapshot(day());
    expect(s.availability).toBeGreaterThanOrEqual(0.9);
    expect(s.minStayShare).toBe(0);
    expect(s.ctaCtdShare).toBe(0);
  });
});

describe('lighthouseDayToSnapshot — marché tendu', () => {
  it('availability baisse fortement quand sold_out présent', () => {
    const s = lighthouseDayToSnapshot(day({
      competitors: [
        comp('A', 'sold_out', null),
        comp('B', 'sold_out', null),
        comp('C', 'available', 250),
        comp('D', 'available', 245),
      ],
    }));
    expect(s.availability).toBeLessThanOrEqual(0.6);
    expect(s.otaClosedShare).toBeGreaterThan(0);
  });

  it('restricted déclenche min_stay + cta/ctd + flex closed', () => {
    const s = lighthouseDayToSnapshot(day({
      competitors: [
        comp('A', 'restricted', 220),
        comp('B', 'restricted', 230),
        comp('C', 'available', 200),
        comp('D', 'available', 195),
      ],
    }));
    expect(s.minStayShare).toBeGreaterThan(0);
    expect(s.ctaCtdShare).toBeGreaterThan(0);
    expect(s.flexibleClosedShare).toBeGreaterThan(0);
  });
});

describe('lighthouseDayToSnapshot — pickup', () => {
  it('pickup proportionnel à marketDemand', () => {
    const low  = lighthouseDayToSnapshot(day({ marketDemand: 0.1 }));
    const high = lighthouseDayToSnapshot(day({ marketDemand: 0.9 }));
    expect(high.pickup).toBeGreaterThan(low.pickup);
  });

  it('utilise basePickup quand fourni', () => {
    const s = lighthouseDayToSnapshot(day({ marketDemand: 0 }), { basePickup: 20 });
    expect(s.pickup).toBe(20);
  });
});

describe('lighthouseDayToSnapshot — champs préservés', () => {
  it('compsetMedian et ourPrice sont préservés', () => {
    const s = lighthouseDayToSnapshot(day({ ourPrice: 175, compsetMedian: 220 }));
    expect(s.ourPrice).toBe(175);
    expect(s.compsetMedian).toBe(220);
  });

  it('compsetMedian négatif clamp à 0', () => {
    const s = lighthouseDayToSnapshot(day({ compsetMedian: -50 }));
    expect(s.compsetMedian).toBe(0);
  });
});

describe('lighthouseImportToSnapshots', () => {
  it('filtre les jours sans prix valide', () => {
    const importData: LighthouseImport = {
      fileName: 'test.xlsx',
      importedAt: '2026-06-01T08:00:00Z',
      ourHotelName: 'Folkestone',
      competitorNames: ['A', 'B'],
      days: [
        day({ date: '2026-06-01' }),
        day({ date: '2026-06-02', ourPrice: 0 }), // exclu
        day({ date: '2026-06-03', compsetMedian: 0 }), // exclu
        day({ date: '2026-06-04' }),
      ],
      sheetsFound: [],
      warnings: [],
    };
    const out = lighthouseImportToSnapshots(importData);
    expect(out).toHaveLength(2);
    expect(out[0].date).toBe('2026-06-01');
    expect(out[1].date).toBe('2026-06-04');
  });

  it('trie chronologiquement', () => {
    const importData: LighthouseImport = {
      fileName: 'test.xlsx',
      importedAt: '2026-06-01T08:00:00Z',
      ourHotelName: 'Folkestone',
      competitorNames: [],
      days: [
        day({ date: '2026-06-15' }),
        day({ date: '2026-06-01' }),
        day({ date: '2026-06-10' }),
      ],
      sheetsFound: [],
      warnings: [],
    };
    const out = lighthouseImportToSnapshots(importData);
    expect(out.map((s) => s.date)).toEqual(['2026-06-01', '2026-06-10', '2026-06-15']);
  });
});
