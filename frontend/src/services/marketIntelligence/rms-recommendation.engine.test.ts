/**
 * FLOWTYM RMS — Tests RMS Recommendation Engine
 *
 * Couvre :
 *   • Garde-fou confidence : pas de reco si < 45
 *   • Sévérité bornée par confidence (pas d'aggressive sans 70+)
 *   • Génération bar_lift / min_stay / close_promotions / etc.
 *   • Déduplication par type
 *   • Causes explicables (poids normalisés, tri descendant)
 */

import { describe, it, expect } from 'vitest';
import {
  explainRecommendation,
  generateRmsRecommendations,
} from './rms-recommendation.engine';
import type {
  ConfidenceScore,
  EventImpactScore,
  MarketCompressionScore,
  MarketImpactForecast,
  MarketSignal,
  MarketSnapshot,
  MarketVelocity,
} from '../../types/marketIntelligence';
import type { RMSMarketEvent } from '../../types/events';

function ev(): RMSMarketEvent {
  return {
    id: 'evt_x',
    name: 'Roland-Garros',
    category: 'sport',
    status: 'active',
    city: 'Paris',
    country: 'FR',
    startDate: '2026-05-24',
    endDate: '2026-06-07',
    impact: {
      demand: 30, adr: 25, occupancy: 18, pickup: 22, revpar: 28,
      compression: 75, confidence: 95, level: 'critical',
    },
    influencePrice: 18,
    sources: ['s1'],
    primarySource: 'FFT',
    rmsSynced: true,
    history: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function impact(score: number): EventImpactScore {
  return {
    score,
    classification: score >= 75 ? 'very_high_tension' : 'adr_lift_likely',
    breakdown: {
      audience: 18, international: 13, duration: 9, historicAdr: 18,
      historicOccupancy: 18, rarity: 9, prestige: 4,
    },
    legacyLevel: score >= 80 ? 'critical' : 'high',
  };
}

function snap(): MarketSnapshot {
  return {
    date: '2026-05-25',
    capturedAt: '2026-05-25T08:00:00Z',
    compsetMedian: 250,
    ourPrice: 240,
    availability: 0.35,
    minStayShare: 0.6,
    ctaCtdShare: 0.3,
    flexibleClosedShare: 0.45,
    otaClosedShare: 0.2,
    pickup: 18,
    inventoryShrinkShare: 0.3,
  };
}

function compression(score: number): MarketCompressionScore {
  return {
    date: '2026-05-25',
    scope: 'global',
    score,
    classification: score >= 80 ? 'extreme' : score >= 60 ? 'strong' : 'building',
    contributions: {
      medianLift: 20, availabilityDrop: 18, minStay: 12, ctaCtd: 8,
      flexibleClosed: 9, pickupAcceleration: 7, luxuryLift: 3, budgetLift: 3,
    },
    affectedClusters: ['upscale', 'luxury'],
    snapshot: snap(),
  };
}

function vel(): MarketVelocity {
  return {
    date: '2026-05-25',
    adrVelocity: 4.5,
    inventoryDepletionVelocity: 3.0,
    compressionAcceleration: 3,
    pickupAcceleration: 4,
    medianDelta: { d1: 2, d3: 5, d7: 15, d14: 22, d30: 28 },
    availabilityDelta: { d1: -3, d3: -8, d7: -25, d14: -32, d30: -45 },
    velocityIndex: 70,
  };
}

function highConf(score = 85, allowAggressive = true): ConfidenceScore {
  return {
    score,
    factors: {
      sourceReliability: 90, sourceCoverage: 85, dataConsistency: 95,
      historicalReliability: 80, marketDataQuality: 90, signalCoherence: 80,
    },
    allowsAggressiveActions: allowAggressive,
    anomalies: [],
  };
}

function forecast(adrLift = 18): MarketImpactForecast {
  return {
    date: '2026-05-24',
    expectedAdrLift: adrLift,
    expectedOccupancyLift: 14,
    expectedCompression: 75,
    confidence: 80,
    contributingEventIds: ['evt_x'],
  };
}

function signals(): MarketSignal[] {
  return [
    { code: 'median_lift', label: 'Hausse médiane', intensity: 60, confidence: 88, detail: '+15% médiane' },
    { code: 'availability_drop', label: 'Chute dispo', intensity: 62, confidence: 85, detail: '-25 pts' },
    { code: 'min_stay_spread', label: 'Min Stay', intensity: 60, confidence: 87, detail: '60% du compset' },
    { code: 'flex_closure', label: 'Flex fermée', intensity: 45, confidence: 85, detail: '45% du compset' },
    { code: 'inventory_shrink', label: 'Catégories disparues', intensity: 30, confidence: 80, detail: '30% du compset' },
    { code: 'ota_closure', label: 'OTA fermées', intensity: 35, confidence: 80, detail: '35% du compset' },
    { code: 'pickup_burst', label: 'Pickup accéléré', intensity: 50, confidence: 80, detail: '+4 res/jour' },
  ];
}

describe('generateRmsRecommendations — garde-fou confidence', () => {
  it('n\'émet aucune reco si confidence < 45', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(75),
      velocity: vel(),
      signals: signals(),
      confidence: {
        score: 30,
        factors: { sourceReliability: 30, sourceCoverage: 30, dataConsistency: 50, historicalReliability: 30, marketDataQuality: 40, signalCoherence: 40 },
        allowsAggressiveActions: false,
        anomalies: [],
      },
      forecast: forecast(),
      impactScore: impact(80),
      drivingEvents: [ev()],
    });
    expect(recos).toHaveLength(0);
  });
});

describe('generateRmsRecommendations — événement à forte pression', () => {
  it('émet bar_lift + close_promotions + min_stay + cta sur Roland-Garros', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(80),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    const types = recos.map((r) => r.type);
    expect(types).toContain('bar_lift');
    expect(types).toContain('close_promotions');
    expect(types).toContain('min_stay');
    expect(types).toContain('cta');
  });

  it('chaque reco contient des causes explicables avec poids normalisés', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(80),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    const r = recos[0];
    expect(r.causes.length).toBeGreaterThan(0);
    const sumWeights = r.causes.reduce((s, c) => s + c.weight, 0);
    expect(sumWeights).toBeCloseTo(1, 2);
    // Tri par poids décroissant
    for (let i = 1; i < r.causes.length; i++) {
      expect(r.causes[i - 1].weight).toBeGreaterThanOrEqual(r.causes[i].weight);
    }
  });

  it('explainRecommendation renvoie une chaîne avec POURQUOI', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(80),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    const text = explainRecommendation(recos[0]);
    expect(text).toMatch(/POURQUOI/i);
    expect(text.length).toBeGreaterThan(20);
  });
});

describe('generateRmsRecommendations — borné par confidence', () => {
  it('confidence < 70 → pas de sévérité aggressive/maximum', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(85),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(60, false),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    for (const r of recos) {
      expect(['standard', 'soft']).toContain(r.severity);
    }
  });

  it('confidence ≥ 70 → autorise aggressive/maximum', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(85),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85, true),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    expect(recos.some((r) => r.severity === 'aggressive' || r.severity === 'maximum')).toBe(true);
  });
});

describe('generateRmsRecommendations — déduplication', () => {
  it('au max une reco par type', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(80),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    const seen = new Set<string>();
    for (const r of recos) {
      expect(seen.has(r.type)).toBe(false);
      seen.add(r.type);
    }
  });
});

describe('generateRmsRecommendations — tri par sévérité', () => {
  it('renvoie les recos triées par sévérité décroissante', () => {
    const recos = generateRmsRecommendations({
      targetDate: '2026-05-24',
      compression: compression(80),
      velocity: vel(),
      signals: signals(),
      confidence: highConf(85),
      forecast: forecast(20),
      impactScore: impact(85),
      drivingEvents: [ev()],
    });
    const sevOrder = { soft: 1, standard: 2, aggressive: 3, maximum: 4 } as const;
    for (let i = 1; i < recos.length; i++) {
      expect(sevOrder[recos[i - 1].severity]).toBeGreaterThanOrEqual(sevOrder[recos[i].severity]);
    }
  });
});
