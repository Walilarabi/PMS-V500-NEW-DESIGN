/**
 * FLOWTYM RMS — Tests Confidence & Anti-Noise Engine
 *
 * Couvre :
 *   • Pondérations facteurs (somme 100)
 *   • Détection 10 types d'anomalies
 *   • allowsAggressiveActions seuil 70
 *   • Pénalités par anomalie sévérité
 */

import { describe, it, expect } from 'vitest';
import { computeConfidence, detectNoiseAnomalies } from './confidence.engine';
import type {
  EventEnrichment,
  EventReliabilityScore,
  MarketSignal,
  MarketSnapshot,
} from '../../types/marketIntelligence';
import type { EventSource, RMSMarketEvent } from '../../types/events';

function source(reliability = 90, id = 's1'): EventSource {
  return {
    id,
    city: 'Paris',
    country: 'FR',
    name: `Src ${id}`,
    type: 'salon',
    method: 'api',
    syncFrequency: 'daily',
    status: 'ok',
    reliabilityScore: reliability,
    active: true,
    apiAvailable: true,
    priority: 'recommended',
  };
}

function enrichment(overrides: Partial<EventEnrichment> = {}): EventEnrichment {
  return {
    estimatedAudience: 80_000,
    audienceTier: 'medium',
    clientMix: 'business',
    reach: 'national',
    prestige: 60,
    durationDays: 3,
    weekendShare: 0,
    recurrence: 'annual',
    geoImpact: {
      radiusKm: 5,
      zones: ['Paris 15'],
      primaryCluster: 'upscale',
    },
    keywords: ['salon'],
    ...overrides,
  };
}

function event(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'e1',
    name: 'Salon Test',
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
    primarySource: 'Source A',
    rmsSynced: true,
    history: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    frequency: 'annuel',
    ...overrides,
  };
}

function snap(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    date: '2026-06-15',
    capturedAt: '2026-06-15T08:00:00Z',
    compsetMedian: 200,
    ourPrice: 195,
    availability: 0.6,
    minStayShare: 0.3,
    ctaCtdShare: 0.1,
    flexibleClosedShare: 0.15,
    otaClosedShare: 0.05,
    pickup: 10,
    inventoryShrinkShare: 0.1,
    ...overrides,
  };
}

describe('computeConfidence — base', () => {
  it('renvoie un score élevé sur événement bien couvert avec historique', () => {
    const reliability: EventReliabilityScore = {
      eventKey: 'e1',
      editionsObserved: 3,
      score: 90,
      meanError: { occupancy: 3, adr: 4, revpar: 4, compression: 5 },
      historicLift: { occupancyDelta: 18, adrDelta: 22, revparDelta: 30, compression: 65 },
      trend: 'stable',
      shouldPrioritizeNextEdition: true,
    };
    const signals: MarketSignal[] = [
      { code: 'median_lift', label: 'Hausse médiane', intensity: 70, confidence: 90, detail: '+15%' },
      { code: 'availability_drop', label: 'Chute dispo', intensity: 60, confidence: 85, detail: '-25 pts' },
    ];
    const c = computeConfidence({
      event: event(),
      enrichment: enrichment(),
      sources: [source(95, 's1'), source(90, 's2'), source(92, 's3')],
      reliability,
      signals,
      snapshot: snap(),
      compsetSize: 12,
      freshnessHours: 6,
      today: '2026-05-01',
    });
    expect(c.score).toBeGreaterThanOrEqual(75);
    expect(c.allowsAggressiveActions).toBe(true);
  });

  it('renvoie un score bas sur événement faiblement couvert sans historique', () => {
    const c = computeConfidence({
      event: event({ sources: ['weak'] }),
      enrichment: enrichment({ estimatedAudience: 800, audienceTier: 'micro', reach: 'local' }),
      sources: [source(45, 'weak')],
      signals: [],
      snapshot: snap(),
      compsetSize: 3,
      freshnessHours: 96,
      today: '2026-05-01',
    });
    expect(c.score).toBeLessThan(50);
    expect(c.allowsAggressiveActions).toBe(false);
  });
});

describe('detectNoiseAnomalies', () => {
  it('détecte past_event', () => {
    const a = detectNoiseAnomalies({
      event: event({ startDate: '2024-06-15', endDate: '2024-06-17' }),
      enrichment: enrichment(),
      sources: [source()],
      signals: [],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'past_event')).toBeDefined();
  });

  it('détecte low_source_count', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source()],
      signals: [],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'low_source_count')).toBeDefined();
  });

  it('détecte ghost_event (1 source peu fiable)', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source(40, 'low')],
      signals: [],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'ghost_event')).toBeDefined();
  });

  it('détecte low_audience', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment({ estimatedAudience: 500, audienceTier: 'micro' }),
      sources: [source(), source(90, 's2')],
      signals: [],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'low_audience')).toBeDefined();
  });

  it('détecte minor_local_event', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment({
        estimatedAudience: 3_000,
        audienceTier: 'micro',
        reach: 'local',
      }),
      sources: [source(), source(90, 's2')],
      signals: [],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'minor_local_event')).toBeDefined();
  });

  it('détecte aberrant_price', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source(), source(90, 's2')],
      signals: [],
      snapshot: snap({ ourPrice: 40 }),
      marketMedian: 200,
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'aberrant_price')).toBeDefined();
  });

  it('détecte closed_hotel sur pickup=0 + dispo=0', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source(), source(90, 's2')],
      signals: [],
      snapshot: snap({ pickup: 0, availability: 0 }),
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'closed_hotel')).toBeDefined();
  });

  it('détecte duplicate_signal', () => {
    const sig: MarketSignal = {
      code: 'median_lift', label: 'X', intensity: 50, confidence: 80, detail: '',
    };
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source(), source(90, 's2')],
      signals: [sig, sig],
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'duplicate_signal')).toBeDefined();
  });

  it('détecte contradictory_signals (médiane monte + dispo encore haute)', () => {
    const a = detectNoiseAnomalies({
      event: event(),
      enrichment: enrichment(),
      sources: [source(), source(90, 's2')],
      signals: [
        { code: 'median_lift', label: '', intensity: 60, confidence: 85, detail: '' },
      ],
      snapshot: snap({ availability: 0.9 }),
      today: '2026-05-01',
    });
    expect(a.find((x) => x.code === 'contradictory_signals')).toBeDefined();
  });
});

describe('computeConfidence — pénalités anomalies', () => {
  it('le score baisse en présence d\'anomalies', () => {
    const base = computeConfidence({
      event: event(),
      enrichment: enrichment(),
      sources: [source(), source(90, 's2')],
      signals: [],
      snapshot: snap(),
      compsetSize: 12,
      freshnessHours: 6,
      today: '2026-05-01',
    });
    const withAnomalies = computeConfidence({
      event: event(),
      enrichment: enrichment(),
      sources: [source(40, 'low')], // ghost + low source
      signals: [],
      snapshot: snap({ pickup: 0, availability: 0 }), // closed_hotel
      compsetSize: 12,
      freshnessHours: 6,
      today: '2026-05-01',
    });
    expect(withAnomalies.score).toBeLessThan(base.score);
    expect(withAnomalies.anomalies.length).toBeGreaterThan(0);
  });
});

describe('computeConfidence — seuil aggressive', () => {
  it('allowsAggressiveActions = true uniquement à partir de 70', () => {
    const high = computeConfidence({
      event: event(),
      enrichment: enrichment(),
      sources: [source(95, 's1'), source(92, 's2'), source(90, 's3'), source(88, 's4')],
      signals: [],
      snapshot: snap(),
      compsetSize: 15,
      freshnessHours: 4,
      today: '2026-05-01',
    });
    expect(high.allowsAggressiveActions).toBe(high.score >= 70);
  });
});
