/**
 * FLOWTYM RMS — Tests Event Prediction Engine
 *
 * Couvre :
 *   • Prédiction depuis historique propre (prior fort)
 *   • Prédiction depuis similars (fallback)
 *   • Prédiction depuis Impact Score (fallback ultime)
 *   • Confidence selon disponibilité du prior
 *   • findSimilarEvents — matching multi-critères
 */

import { describe, it, expect } from 'vitest';
import {
  findSimilarEvents,
  predictEventImpact,
  predictMarketImpactWindow,
} from './event-prediction.engine';
import { enrichEvent } from './event-enrichment.engine';
import type {
  EventImpactScore,
  EventReliabilityScore,
} from '../../types/marketIntelligence';
import type { RMSMarketEvent } from '../../types/events';

function impact(score: number): EventImpactScore {
  return {
    score,
    classification: 'watch',
    breakdown: {
      audience: 10, international: 10, duration: 5, historicAdr: 10,
      historicOccupancy: 10, rarity: 5, prestige: 2,
    },
    legacyLevel: 'medium',
  };
}

function event(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'e1',
    name: 'Salon X',
    category: 'salon',
    status: 'active',
    city: 'Paris',
    country: 'FR',
    startDate: '2026-06-15',
    endDate: '2026-06-17',
    impact: {
      demand: 20, adr: 15, occupancy: 10, pickup: 12, revpar: 14,
      compression: 60, confidence: 85, level: 'medium',
    },
    influencePrice: 10,
    sources: ['s1'],
    primarySource: 'A',
    rmsSynced: true,
    history: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('predictEventImpact — depuis historique propre', () => {
  it('utilise le historic lift quand 2+ éditions observées', () => {
    const reliability: EventReliabilityScore = {
      eventKey: 'e1',
      editionsObserved: 3,
      score: 90,
      meanError: { occupancy: 3, adr: 4, revpar: 4, compression: 5 },
      historicLift: { occupancyDelta: 20, adrDelta: 25, revparDelta: 45, compression: 70 },
      trend: 'stable',
      shouldPrioritizeNextEdition: true,
    };
    const ev = event();
    const enr = enrichEvent(ev);
    const f = predictEventImpact({
      event: ev,
      enrichment: enr,
      impactScore: impact(60),
      ownReliability: reliability,
    });
    expect(f.expectedAdrLift).toBe(25);
    expect(f.expectedOccupancyLift).toBe(20);
    expect(f.expectedCompression).toBe(70);
    expect(f.confidence).toBeGreaterThanOrEqual(70);
  });
});

describe('predictEventImpact — depuis similars', () => {
  it('utilise la moyenne pondérée des similars en absence d\'historique propre', () => {
    const ev = event();
    const enr = enrichEvent(ev);
    const similars = [
      {
        similarity: 80,
        reliability: {
          eventKey: 's1',
          editionsObserved: 2,
          score: 85,
          meanError: { occupancy: 4, adr: 5, revpar: 5, compression: 6 },
          historicLift: { occupancyDelta: 18, adrDelta: 22, revparDelta: 40, compression: 65 },
          trend: 'stable' as const,
          shouldPrioritizeNextEdition: true,
        },
      },
      {
        similarity: 60,
        reliability: {
          eventKey: 's2',
          editionsObserved: 2,
          score: 80,
          meanError: { occupancy: 5, adr: 5, revpar: 6, compression: 7 },
          historicLift: { occupancyDelta: 12, adrDelta: 16, revparDelta: 28, compression: 55 },
          trend: 'rising' as const,
          shouldPrioritizeNextEdition: true,
        },
      },
    ];
    const f = predictEventImpact({
      event: ev,
      enrichment: enr,
      impactScore: impact(50),
      similarEvents: similars,
    });
    // Moyenne pondérée par similarité : ADR ≈ (22*0.8 + 16*0.6) / 1.4 ≈ 19.4
    expect(f.expectedAdrLift).toBeCloseTo(19.4, 0);
    expect(f.confidence).toBeGreaterThan(50);
  });
});

describe('predictEventImpact — fallback Impact Score', () => {
  it('utilise Impact Score si aucun historique disponible', () => {
    const ev = event();
    const enr = enrichEvent(ev);
    const f = predictEventImpact({
      event: ev,
      enrichment: enr,
      impactScore: impact(80),
    });
    // Calibration : score 80 → ~24 % ADR
    expect(f.expectedAdrLift).toBeCloseTo(24, 0);
    expect(f.expectedCompression).toBe(80);
    expect(f.confidence).toBeLessThanOrEqual(60); // moins fiable sans historique
  });
});

describe('predictEventImpact — mix own + similars', () => {
  it('mix 60/40 quand les deux sources sont présentes', () => {
    const ev = event();
    const enr = enrichEvent(ev);
    const own: EventReliabilityScore = {
      eventKey: 'own',
      editionsObserved: 1,
      score: 80,
      meanError: { occupancy: 4, adr: 5, revpar: 5, compression: 6 },
      historicLift: { occupancyDelta: 30, adrDelta: 40, revparDelta: 60, compression: 80 },
      trend: 'stable',
      shouldPrioritizeNextEdition: true,
    };
    const sim = {
      similarity: 90,
      reliability: {
        eventKey: 's',
        editionsObserved: 2,
        score: 85,
        meanError: { occupancy: 3, adr: 4, revpar: 5, compression: 5 },
        historicLift: { occupancyDelta: 10, adrDelta: 10, revparDelta: 20, compression: 40 },
        trend: 'stable' as const,
        shouldPrioritizeNextEdition: false,
      },
    };
    const f = predictEventImpact({
      event: ev,
      enrichment: enr,
      impactScore: impact(50),
      ownReliability: own,
      similarEvents: [sim],
    });
    // 40 * 0.6 + 10 * 0.4 = 28
    expect(f.expectedAdrLift).toBeCloseTo(28, 0);
  });
});

describe('findSimilarEvents', () => {
  it('match les événements de même catégorie + cluster + audience', () => {
    const target = {
      event: event({ id: 'target', category: 'salon' }),
      enrichment: enrichEvent(event({ id: 'target', venue: 'P. de Versailles' })),
    };
    const candidates = [
      {
        event: event({ id: 'match', category: 'salon', venue: 'P. de Versailles' }),
        enrichment: enrichEvent(event({ id: 'match', venue: 'P. de Versailles' })),
      },
      {
        event: event({ id: 'other', category: 'sport', venue: 'Stade de France' }),
        enrichment: enrichEvent(event({ id: 'other', venue: 'Stade de France', category: 'sport' })),
      },
    ];
    const sims = findSimilarEvents(target, candidates);
    expect(sims.length).toBeGreaterThanOrEqual(1);
    expect(sims[0].eventId).toBe('match');
    expect(sims[0].similarity).toBeGreaterThanOrEqual(60);
  });

  it('exclut l\'événement cible lui-même', () => {
    const t = {
      event: event({ id: 'self' }),
      enrichment: enrichEvent(event({ id: 'self' })),
    };
    const sims = findSimilarEvents(t, [t]);
    expect(sims).toHaveLength(0);
  });

  it('limite à topN', () => {
    const target = {
      event: event({ id: 'target', category: 'salon' }),
      enrichment: enrichEvent(event({ id: 'target' })),
    };
    const pool = Array.from({ length: 10 }, (_, i) => ({
      event: event({ id: `e${i}`, category: 'salon' }),
      enrichment: enrichEvent(event({ id: `e${i}` })),
    }));
    expect(findSimilarEvents(target, pool, 3)).toHaveLength(3);
  });
});

describe('predictMarketImpactWindow', () => {
  it('filtre dans la fenêtre + trie chronologiquement', () => {
    const f1 = { date: '2026-06-01', expectedAdrLift: 10, expectedOccupancyLift: 8, expectedCompression: 50, confidence: 60, contributingEventIds: [] };
    const f2 = { date: '2026-06-20', expectedAdrLift: 20, expectedOccupancyLift: 15, expectedCompression: 70, confidence: 70, contributingEventIds: [] };
    const f3 = { date: '2026-07-01', expectedAdrLift: 5, expectedOccupancyLift: 3, expectedCompression: 30, confidence: 50, contributingEventIds: [] };
    const out = predictMarketImpactWindow([f3, f1, f2], '2026-06-01', '2026-06-30');
    expect(out.map((f) => f.date)).toEqual(['2026-06-01', '2026-06-20']);
  });
});
