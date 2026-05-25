/**
 * FLOWTYM RMS — Tests Event Reliability Engine
 *
 * Couvre :
 *   • Score 0-100 sur erreur moyenne pondérée
 *   • Calcul historic lift (moyenne réelle)
 *   • Détection tendance (rising / stable / declining)
 *   • Priorisation auto pour la prochaine édition
 *   • Cas dégénéré (historique vide)
 */

import { describe, it, expect } from 'vitest';
import {
  computeEventReliability,
  computeEventReliabilities,
  explainTrend,
} from './event-reliability.engine';
import type { EventActualVsForecast } from '../../types/marketIntelligence';

function edition(
  observedAt: string,
  forecast: EventActualVsForecast['forecast'],
  actual: EventActualVsForecast['actual'],
): EventActualVsForecast {
  return {
    edition: observedAt.slice(0, 4),
    observedAt,
    forecast,
    actual,
  };
}

describe('computeEventReliability — historique vide', () => {
  it('renvoie un score neutre 50 + flags par défaut', () => {
    const r = computeEventReliability('key', []);
    expect(r.score).toBe(50);
    expect(r.editionsObserved).toBe(0);
    expect(r.shouldPrioritizeNextEdition).toBe(false);
    expect(r.trend).toBe('stable');
  });
});

describe('computeEventReliability — score', () => {
  it('renvoie un score haut quand le forecast est très proche du réel', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 20, adrDelta: 30, revparDelta: 50, compression: 75 },
        { occupancyDelta: 21, adrDelta: 31, revparDelta: 50, compression: 76 },
      ),
      edition(
        '2024-06-01',
        { occupancyDelta: 18, adrDelta: 28, revparDelta: 48, compression: 72 },
        { occupancyDelta: 19, adrDelta: 29, revparDelta: 49, compression: 73 },
      ),
    ];
    const r = computeEventReliability('roland', history);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.editionsObserved).toBe(2);
  });

  it('renvoie un score bas quand les prévisions sont très fausses', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 30, adrDelta: 30, revparDelta: 50, compression: 80 },
        { occupancyDelta: 5,  adrDelta: 0,  revparDelta: 5,  compression: 10 },
      ),
    ];
    const r = computeEventReliability('flop', history);
    expect(r.score).toBeLessThanOrEqual(30);
  });
});

describe('computeEventReliability — historic lift', () => {
  it('calcule la moyenne des réels par dimension', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 10, adrDelta: 20, revparDelta: 30, compression: 60 },
      ),
      edition(
        '2024-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 20, adrDelta: 30, revparDelta: 50, compression: 80 },
      ),
    ];
    const r = computeEventReliability('avg', history);
    expect(r.historicLift.occupancyDelta).toBe(15);
    expect(r.historicLift.adrDelta).toBe(25);
    expect(r.historicLift.revparDelta).toBe(40);
    expect(r.historicLift.compression).toBe(70);
  });
});

describe('computeEventReliability — tendance', () => {
  it('détecte une tendance "rising" sur 3 éditions croissantes', () => {
    const history = [
      edition(
        '2023-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 5,  adrDelta: 5,  revparDelta: 10, compression: 30 },
      ),
      edition(
        '2024-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 12, adrDelta: 15, revparDelta: 22, compression: 50 },
      ),
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 22, adrDelta: 30, revparDelta: 45, compression: 75 },
      ),
    ];
    const r = computeEventReliability('rising', history);
    expect(r.trend).toBe('rising');
  });

  it('détecte une tendance "declining" sur 3 éditions décroissantes', () => {
    const history = [
      edition(
        '2023-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 25, adrDelta: 30, revparDelta: 45, compression: 70 },
      ),
      edition(
        '2024-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 18, adrDelta: 20, revparDelta: 30, compression: 55 },
      ),
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 10, adrDelta: 8,  revparDelta: 14, compression: 35 },
      ),
    ];
    const r = computeEventReliability('declining', history);
    expect(r.trend).toBe('declining');
  });

  it('détecte "stable" si peu de variation', () => {
    const history = [
      edition(
        '2023-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 15, adrDelta: 20, revparDelta: 30, compression: 60 },
      ),
      edition(
        '2024-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 14, adrDelta: 21, revparDelta: 30, compression: 61 },
      ),
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 16, adrDelta: 19, revparDelta: 31, compression: 59 },
      ),
    ];
    const r = computeEventReliability('stable', history);
    expect(r.trend).toBe('stable');
  });
});

describe('computeEventReliability — priorisation', () => {
  it('priorise un événement à fort lift ADR', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 5, adrDelta: 30, revparDelta: 35, compression: 50 },
      ),
    ];
    const r = computeEventReliability('high_adr', history);
    expect(r.shouldPrioritizeNextEdition).toBe(true);
  });

  it('priorise un événement à forte compression observée', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 8, adrDelta: 5, revparDelta: 10, compression: 70 },
      ),
    ];
    const r = computeEventReliability('high_comp', history);
    expect(r.shouldPrioritizeNextEdition).toBe(true);
  });

  it('ne priorise pas un événement à faible lift', () => {
    const history = [
      edition(
        '2025-06-01',
        { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
        { occupancyDelta: 3, adrDelta: 4, revparDelta: 6, compression: 25 },
      ),
    ];
    expect(computeEventReliability('low', history).shouldPrioritizeNextEdition).toBe(false);
  });
});

describe('computeEventReliabilities (batch)', () => {
  it('indexe les fiabilités par clé', () => {
    const m = new Map<string, EventActualVsForecast[]>([
      ['a', []],
      ['b', [
        edition(
          '2025-06-01',
          { occupancyDelta: 10, adrDelta: 10, revparDelta: 20, compression: 50 },
          { occupancyDelta: 11, adrDelta: 11, revparDelta: 22, compression: 51 },
        ),
      ]],
    ]);
    const out = computeEventReliabilities(m);
    expect(out.size).toBe(2);
    expect(out.get('a')?.editionsObserved).toBe(0);
    expect(out.get('b')?.editionsObserved).toBe(1);
  });
});

describe('explainTrend', () => {
  it('renvoie une chaîne non vide pour chaque tendance', () => {
    expect(explainTrend('rising').length).toBeGreaterThan(0);
    expect(explainTrend('stable').length).toBeGreaterThan(0);
    expect(explainTrend('declining').length).toBeGreaterThan(0);
  });
});
