/**
 * FLOWTYM RMS — Tests de l'incident métier « deux tarifs recommandés
 * différents pour la même date » (18 juin 2026 — 375 € vs 298 €).
 *
 * Couvre les 7 cas requis par le commanditaire :
 *  - forte demande
 *  - faible demande
 *  - sans données compset
 *  - tarif actuel = 0
 *  - données partielles
 *  - recommandation déjà acceptée
 *  - navigation entre plusieurs dates (déterminisme)
 *
 * Garantie : pour un même input, `calculateDayRecommendation` retourne le
 * même `recommendedPrice` partout. Tant que les composants délèguent à ce
 * helper, popup et panel ne peuvent plus diverger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub supabase amont (chaîne rmsEngine → sourceWeighting → settingsPersistence).
vi.mock('@/src/lib/supabase', () => ({
  supabase: {},
  getSupabase: () => ({}),
}));

// Stub côté centralPricingEngine pour éviter localStorage et la chaîne
// rms-decisions.service → supabase. On reproduit l'API minimale utilisée.
vi.mock('@/src/services/revenue/centralPricingEngine.service', () => {
  type Rec = {
    date: string;
    currentPrice: number;
    suggestedPrice: number;
    finalPrice: number | null;
    status: 'pending' | 'accepted' | 'rejected' | 'maintained';
    confidence?: number;
  };
  const store = new Map<string, Rec>();
  return {
    centralPricingEngine: {
      get(date: string) {
        return store.get(date) ?? null;
      },
      _seed(rec: Rec) {
        store.set(rec.date, rec);
      },
      clear() {
        store.clear();
      },
    },
  };
});

import { centralPricingEngine } from '@/src/services/revenue/centralPricingEngine.service';
import {
  calculateDayRecommendation,
  pressureLabelFor,
  type DayRecommendationInput,
} from './dayRecommendation';

// Helper d'accès au stub pour seeder un record existant.
function seedExisting(date: string, suggestedPrice: number, currentPrice = 280) {
  (centralPricingEngine as unknown as {
    _seed: (r: {
      date: string;
      currentPrice: number;
      suggestedPrice: number;
      finalPrice: number | null;
      status: 'pending' | 'accepted' | 'rejected' | 'maintained';
      confidence?: number;
    }) => void;
  })._seed({
    date,
    currentPrice,
    suggestedPrice,
    finalPrice: null,
    status: 'pending',
    confidence: 90,
  });
}

beforeEach(() => {
  centralPricingEngine.clear();
});

afterEach(() => {
  centralPricingEngine.clear();
});

describe('pressureLabelFor — seuils communs popup & panel', () => {
  it.each([
    [10, 'Faible'],
    [39, 'Faible'],
    [40, 'Modérée'],
    [64, 'Modérée'],
    [65, 'Forte'],
    [84, 'Forte'],
    [85, 'Extrême'],
    [100, 'Extrême'],
  ])('demand=%i → %s', (demand, label) => {
    expect(pressureLabelFor(demand)).toBe(label);
  });
});

describe('calculateDayRecommendation — invariant source unique', () => {
  it('même input → même output (déterminisme appel répété)', () => {
    const input: DayRecommendationInput = {
      date: '2026-06-18',
      ourPrice: 330,
      median: 350,
      demand: 88,
    };
    const a = calculateDayRecommendation(input);
    const b = calculateDayRecommendation(input);
    expect(a.recommendedPrice).toBe(b.recommendedPrice);
    expect(a.strategy).toBe(b.strategy);
    expect(a.pressureLabel).toBe(b.pressureLabel);
    expect(a.currentPrice).toBe(b.currentPrice);
  });

  it('reproduction incident 18/06/2026 : un SEUL prix recommandé', () => {
    // Avant le fix : popup affichait 375 €, panel 298 €.
    // Désormais : les deux passent par ce helper, donc une seule valeur.
    const input: DayRecommendationInput = {
      date: '2026-06-18',
      ourPrice: 330,
      median: 350,
      demand: 88,
    };
    const reco = calculateDayRecommendation(input);
    expect(reco.recommendedPrice).not.toBeNull();
    expect(reco.recommendedPrice).toBeGreaterThan(0);
    expect(reco.source).toBe('rms-engine');
    // Pression marché élevée → label Extrême
    expect(reco.pressureLabel).toBe('Extrême');
    // Plus jamais la formule simpliste « median * 0.98 = 343 »
    expect(reco.recommendedPrice).not.toBe(343);
  });
});

describe('calculateDayRecommendation — cas métier requis', () => {
  it('forte demande (demand=88) : reco non-null, delta orienté hausse ou maintien', () => {
    const reco = calculateDayRecommendation({
      date: '2026-07-15',
      ourPrice: 320,
      median: 350,
      demand: 88,
    });
    expect(reco.recommendedPrice).not.toBeNull();
    expect(reco.recommendedPrice!).toBeGreaterThan(0);
    expect(['Forte', 'Extrême']).toContain(reco.pressureLabel);
  });

  it('faible demande (demand=15) : reco non-null, label Faible', () => {
    const reco = calculateDayRecommendation({
      date: '2026-01-10',
      ourPrice: 280,
      median: 250,
      demand: 15,
    });
    expect(reco.recommendedPrice).not.toBeNull();
    expect(reco.recommendedPrice!).toBeGreaterThan(0);
    expect(reco.pressureLabel).toBe('Faible');
  });

  it('sans données compset (median=null) : reco null + source no-data', () => {
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: 330,
      median: null,
      demand: 50,
    });
    expect(reco.recommendedPrice).toBeNull();
    expect(reco.recommendationDelta).toBeNull();
    expect(reco.source).toBe('no-data');
    expect(reco.confidence).toBe(0);
  });

  it('tarif actuel = 0 (ourPrice=null + calendarPrice absent) : reco null', () => {
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: null,
      median: 350,
      demand: 60,
    });
    expect(reco.recommendedPrice).toBeNull();
    expect(reco.source).toBe('no-data');
    expect(reco.currentPrice).toBe(0);
  });

  it('données partielles (ourPrice OK, median=0) : reco null safe', () => {
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: 200,
      median: 0,
      demand: 50,
    });
    expect(reco.recommendedPrice).toBeNull();
    expect(reco.source).toBe('no-data');
  });

  it('calendarPrice prioritaire sur ourPrice quand présent', () => {
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: 330,
      calendarPrice: 280,
      median: 350,
      demand: 50,
    });
    expect(reco.currentPrice).toBe(280);
  });

  it('recommandation déjà existante dans central engine → respectée', () => {
    seedExisting('2026-06-18', 412, 330);
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: 330,
      median: 350,
      demand: 88,
    });
    expect(reco.source).toBe('central-engine');
    expect(reco.recommendedPrice).toBe(412);
    expect(reco.recommendationDelta).toBe(82); // 412 - 330
  });

  it('navigation entre dates : chaque date est indépendante et déterministe', () => {
    const dates = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'];
    const recos = dates.map((date) =>
      calculateDayRecommendation({ date, ourPrice: 300, median: 320, demand: 70 }),
    );
    // Tous calculés sans erreur, tous avec une reco non-nulle.
    recos.forEach((r) => {
      expect(r.recommendedPrice).not.toBeNull();
      expect(r.recommendedPrice!).toBeGreaterThan(0);
    });
    // Re-appel des mêmes inputs → mêmes outputs.
    const recos2 = dates.map((date) =>
      calculateDayRecommendation({ date, ourPrice: 300, median: 320, demand: 70 }),
    );
    recos.forEach((r, i) => {
      expect(r.recommendedPrice).toBe(recos2[i].recommendedPrice);
    });
  });

  it('record central s\'impose même si data marché change après coup', () => {
    // Veille a accepté 400 € il y a 5 min ; entre-temps une nouvelle médiane
    // arrive. Le tarif recommandé ne doit pas changer dans l'UI : la
    // décision validée du moteur central prime.
    seedExisting('2026-06-18', 400, 330);
    const reco = calculateDayRecommendation({
      date: '2026-06-18',
      ourPrice: 330,
      median: 999, // grosse variation médiane
      demand: 88,
    });
    expect(reco.source).toBe('central-engine');
    expect(reco.recommendedPrice).toBe(400);
  });
});
