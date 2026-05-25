/**
 * FLOWTYM RMS — Tests Compset Clustering Engine
 *
 * Couvre :
 *   • Classification par nom (palaces, 4★, 3★, budget, lifestyle, aparthotel)
 *   • Fallback prix quand nom inconnu
 *   • buildClusterSnapshot (médiane segmentée, ratios statuts)
 *   • buildSegmentedSnapshots (1 série par cluster non vide)
 *   • compsetDistribution
 */

import { describe, it, expect } from 'vitest';
import {
  avgCompetitorPrice,
  buildClusterSnapshot,
  buildSegmentedSnapshots,
  classifyCompset,
  classifyHotel,
  compsetDistribution,
  type HotelClassification,
} from './compset-clustering.engine';
import type {
  CompetitorRate,
  LighthouseDayData,
} from '../lighthouse-parser.service';

function comp(name: string, status: CompetitorRate['status'] = 'available', price: number | null = 200): CompetitorRate {
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
    competitors: [],
    compsetMin: 150,
    compsetMax: 700,
    ...overrides,
  };
}

describe('classifyHotel — par nom (palaces / luxury)', () => {
  it('reconnaît les palaces parisiens', () => {
    const names = [
      'Le Bristol Paris',
      'Hôtel Ritz Paris',
      'Four Seasons George V',
      'Plaza Athénée',
      'Le Meurice',
      'Cheval Blanc Paris',
      'Mandarin Oriental Paris',
    ];
    for (const name of names) {
      const c = classifyHotel({ hotelName: name, avgPrice: 1200, marketMedian: 250 });
      expect(c.cluster).toBe('luxury');
      expect(c.confidence).toBeGreaterThanOrEqual(90);
    }
  });
});

describe('classifyHotel — upscale (4★ premium)', () => {
  it('reconnaît les chaînes upscale', () => {
    for (const name of ['Sofitel Paris Le Faubourg', 'Hilton Paris Opera', 'Pullman Paris Tour Eiffel']) {
      const c = classifyHotel({ hotelName: name, avgPrice: 350, marketMedian: 250 });
      expect(c.cluster).toBe('upscale');
    }
  });
});

describe('classifyHotel — midscale (3★)', () => {
  it('reconnaît Novotel/Mercure/Holiday Inn', () => {
    for (const name of ['Novotel Paris Centre', 'Mercure Paris Opera', 'Holiday Inn Paris Notre Dame']) {
      const c = classifyHotel({ hotelName: name, avgPrice: 200, marketMedian: 220 });
      expect(c.cluster).toBe('midscale');
    }
  });
});

describe('classifyHotel — budget', () => {
  it('reconnaît Ibis / B&B / Premier Inn / hotelF1', () => {
    for (const name of ['Ibis Paris Bastille', 'Ibis Budget Paris 13', 'B&B Hôtel Paris Nord', 'Premier Inn Paris', 'hotelF1 Paris Porte']) {
      const c = classifyHotel({ hotelName: name, avgPrice: 95, marketMedian: 200 });
      expect(c.cluster).toBe('budget');
    }
  });
});

describe('classifyHotel — lifestyle / boutique', () => {
  it('reconnaît Mama Shelter, Hoxton, citizenM', () => {
    for (const name of ['Mama Shelter Paris East', 'The Hoxton, Paris', 'citizenM Paris Champs Elysees']) {
      const c = classifyHotel({ hotelName: name, avgPrice: 250, marketMedian: 220 });
      expect(c.cluster).toBe('lifestyle');
    }
  });
});

describe('classifyHotel — aparthotel', () => {
  it('reconnaît Adagio, Citadines, Aparthotel', () => {
    for (const name of ['Adagio Paris Bercy', 'Citadines Tour Eiffel', 'Aparthotel Adagio Paris Centre']) {
      const c = classifyHotel({ hotelName: name, avgPrice: 180, marketMedian: 220 });
      expect(c.cluster).toBe('aparthotel');
    }
  });
});

describe('classifyHotel — fallback prix', () => {
  it('classe en luxury par prix si ratio ≥ 1.7×', () => {
    const c = classifyHotel({ hotelName: 'Hôtel Inconnu Premium', avgPrice: 500, marketMedian: 200 });
    expect(c.cluster).toBe('luxury');
    expect(c.reason).toBe('price_tier');
  });

  it('classe en upscale par prix si ratio 1.25-1.7×', () => {
    const c = classifyHotel({ hotelName: 'Hôtel Inconnu', avgPrice: 300, marketMedian: 200 });
    expect(c.cluster).toBe('upscale');
  });

  it('classe en midscale par prix si ratio 0.85-1.25×', () => {
    const c = classifyHotel({ hotelName: 'Hôtel Inconnu', avgPrice: 200, marketMedian: 200 });
    expect(c.cluster).toBe('midscale');
  });

  it('classe en budget par prix si ratio < 0.85×', () => {
    const c = classifyHotel({ hotelName: 'Hôtel Inconnu', avgPrice: 100, marketMedian: 200 });
    expect(c.cluster).toBe('budget');
  });

  it('fallback midscale si pas de prix ni nom connu', () => {
    const c = classifyHotel({ hotelName: 'Random Inn', avgPrice: 0, marketMedian: 200 });
    expect(c.cluster).toBe('midscale');
    expect(c.reason).toBe('price_fallback');
    expect(c.confidence).toBeLessThanOrEqual(50);
  });
});

describe('avgCompetitorPrice', () => {
  it('calcule la moyenne sur plusieurs jours', () => {
    const days = [
      day({ competitors: [comp('Ritz', 'available', 1200)] }),
      day({ competitors: [comp('Ritz', 'available', 1300)] }),
      day({ competitors: [comp('Ritz', 'sold_out', null)] }), // ignoré
    ];
    expect(avgCompetitorPrice('Ritz', days)).toBeCloseTo(1250, 1);
  });

  it('renvoie 0 si jamais présent', () => {
    expect(avgCompetitorPrice('Inconnu', [day()])).toBe(0);
  });
});

describe('classifyCompset', () => {
  it('classe tout le compset', () => {
    const days = [
      day({
        compsetMedian: 250,
        competitors: [
          comp('Le Bristol Paris', 'available', 1200),
          comp('Sofitel Paris', 'available', 350),
          comp('Novotel Paris Centre', 'available', 220),
          comp('Ibis Paris', 'available', 100),
          comp('Mama Shelter Paris', 'available', 280),
        ],
      }),
    ];
    const out = classifyCompset({
      hotelNames: ['Le Bristol Paris', 'Sofitel Paris', 'Novotel Paris Centre', 'Ibis Paris', 'Mama Shelter Paris'],
      days,
    });
    expect(out.get('Le Bristol Paris')?.cluster).toBe('luxury');
    expect(out.get('Sofitel Paris')?.cluster).toBe('upscale');
    expect(out.get('Novotel Paris Centre')?.cluster).toBe('midscale');
    expect(out.get('Ibis Paris')?.cluster).toBe('budget');
    expect(out.get('Mama Shelter Paris')?.cluster).toBe('lifestyle');
  });
});

describe('buildClusterSnapshot', () => {
  const classifications = new Map<string, HotelClassification>([
    ['Le Bristol Paris',    { hotelName: 'Le Bristol Paris', cluster: 'luxury', confidence: 95, reason: 'name_pattern' }],
    ['Plaza Athénée',       { hotelName: 'Plaza Athénée', cluster: 'luxury', confidence: 95, reason: 'name_pattern' }],
    ['Ibis Bastille',       { hotelName: 'Ibis Bastille', cluster: 'budget', confidence: 92, reason: 'name_pattern' }],
    ['hotelF1 Porte',       { hotelName: 'hotelF1 Porte', cluster: 'budget', confidence: 92, reason: 'name_pattern' }],
  ]);

  it('calcule la médiane segmentée luxury', () => {
    const d = day({
      competitors: [
        comp('Le Bristol Paris', 'available', 1200),
        comp('Plaza Athénée', 'available', 1500),
        comp('Ibis Bastille', 'available', 100),
      ],
    });
    const snap = buildClusterSnapshot({ day: d, cluster: 'luxury', classifications });
    expect(snap).not.toBeNull();
    expect(snap!.compsetMedian).toBe(1350); // (1200+1500)/2 = 1350
  });

  it('renvoie null si aucun compétiteur du cluster', () => {
    const d = day({
      competitors: [comp('Le Bristol Paris', 'available', 1200)],
    });
    const snap = buildClusterSnapshot({ day: d, cluster: 'budget', classifications });
    expect(snap).toBeNull();
  });

  it('détecte les restrictions par segment', () => {
    const d = day({
      competitors: [
        comp('Le Bristol Paris', 'restricted', 1500),
        comp('Plaza Athénée', 'restricted', 1700),
      ],
    });
    const snap = buildClusterSnapshot({ day: d, cluster: 'luxury', classifications });
    expect(snap).not.toBeNull();
    expect(snap!.minStayShare).toBeGreaterThan(0);
    expect(snap!.flexibleClosedShare).toBeGreaterThan(0);
  });
});

describe('buildSegmentedSnapshots', () => {
  it('produit une série par cluster non vide', () => {
    const classifications = new Map<string, HotelClassification>([
      ['Bristol', { hotelName: 'Bristol', cluster: 'luxury', confidence: 95, reason: 'name_pattern' }],
      ['Ibis',    { hotelName: 'Ibis', cluster: 'budget', confidence: 92, reason: 'name_pattern' }],
    ]);
    const days = [
      day({ date: '2026-06-01', competitors: [comp('Bristol', 'available', 1300), comp('Ibis', 'available', 95)] }),
      day({ date: '2026-06-02', competitors: [comp('Bristol', 'available', 1350), comp('Ibis', 'available', 100)] }),
    ];
    const out = buildSegmentedSnapshots({ days, classifications });
    expect(out.has('luxury')).toBe(true);
    expect(out.has('budget')).toBe(true);
    expect(out.has('midscale')).toBe(false); // pas de midscale → pas de série
    expect(out.get('luxury')!.length).toBe(2);
  });
});

describe('compsetDistribution', () => {
  it('renvoie la part de chaque cluster, triée décroissant', () => {
    const classifications = new Map<string, HotelClassification>([
      ['A', { hotelName: 'A', cluster: 'midscale', confidence: 90, reason: 'name_pattern' }],
      ['B', { hotelName: 'B', cluster: 'midscale', confidence: 90, reason: 'name_pattern' }],
      ['C', { hotelName: 'C', cluster: 'midscale', confidence: 90, reason: 'name_pattern' }],
      ['D', { hotelName: 'D', cluster: 'luxury', confidence: 90, reason: 'name_pattern' }],
      ['E', { hotelName: 'E', cluster: 'budget', confidence: 90, reason: 'name_pattern' }],
    ]);
    const dist = compsetDistribution(classifications);
    expect(dist[0].cluster).toBe('midscale');
    expect(dist[0].count).toBe(3);
    expect(dist[0].share).toBeCloseTo(0.6, 2);
    expect(dist.length).toBe(3);
  });

  it('renvoie tableau vide si classifications vide', () => {
    expect(compsetDistribution(new Map())).toEqual([]);
  });
});
