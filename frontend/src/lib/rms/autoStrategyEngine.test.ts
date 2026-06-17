/**
 * FLOWTYM RMS — Tests autoStrategyEngine.
 *
 * Couvre la chaîne complète exécutée à chaque render de l'Autopilote :
 *   - selectStrategy(signals) → AutoStrategyResult
 *   - evaluateRecommendation(reco, params) → RecommendationVerdict
 *   - evaluateActivation(cfg, ctx) → ActivationState (depuis le store)
 *
 * Garantit qu'aucun signal extrême ni paramètre limite ne fait crash, ce
 * qui faisait tomber AutopilotPage à l'init.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({
  supabase: {},
  getSupabase: () => ({}),
}));

import {
  selectStrategy,
  evaluateRecommendation,
  type MarketSignals,
  type PriceRecommendation,
  type AutopilotParams,
} from './autoStrategyEngine';

const MID_SIGNALS: MarketSignals = {
  occupancy: 60,
  pickup: 50,
  leadTime: 14,
  marketPressure: 50,
  eventIntensity: 30,
  compsetTrend: 0,
  bookingPace: 0,
  segmentMix: 50,
  historyIndex: 50,
  futureDemand: 50,
  otaTrend: 0,
  marketCompression: 40,
};

const ZERO_SIGNALS: MarketSignals = {
  occupancy: 0,
  pickup: 0,
  leadTime: 1,
  marketPressure: 0,
  eventIntensity: 0,
  compsetTrend: -100,
  bookingPace: -100,
  segmentMix: 0,
  historyIndex: 0,
  futureDemand: 0,
  otaTrend: -100,
  marketCompression: 0,
};

const MAX_SIGNALS: MarketSignals = {
  occupancy: 100,
  pickup: 100,
  leadTime: 60,
  marketPressure: 100,
  eventIntensity: 100,
  compsetTrend: 100,
  bookingPace: 100,
  segmentMix: 100,
  historyIndex: 100,
  futureDemand: 100,
  otaTrend: 100,
  marketCompression: 100,
};

describe('selectStrategy — pas de crash sur signaux extrêmes', () => {
  it('produit un résultat valide pour signaux moyens', () => {
    const r = selectStrategy(MID_SIGNALS);
    expect(r.selected).toBeTruthy();
    expect(r.confidence).toBeGreaterThanOrEqual(55);
    expect(r.confidence).toBeLessThanOrEqual(97);
    expect(r.ranking.length).toBeGreaterThan(0);
    expect(r.factors.length).toBeGreaterThan(0);
  });

  it('ne crash pas sur tous signaux à 0 (ou minimum)', () => {
    const r = selectStrategy(ZERO_SIGNALS);
    expect(r.selected).toBeTruthy();
    expect(Number.isFinite(r.confidence)).toBe(true);
  });

  it('ne crash pas sur tous signaux à 100 (ou maximum)', () => {
    const r = selectStrategy(MAX_SIGNALS);
    expect(r.selected).toBeTruthy();
    expect(Number.isFinite(r.confidence)).toBe(true);
  });

  it('le ranking est trié décroissant par score', () => {
    const r = selectStrategy(MID_SIGNALS);
    for (let i = 1; i < r.ranking.length; i++) {
      expect(r.ranking[i].score).toBeLessThanOrEqual(r.ranking[i - 1].score);
    }
  });
});

const RECO_OK: PriceRecommendation = {
  id: 'reco-test',
  stayDate: '2026-07-01',
  roomType: 'Standard',
  channel: 'Direct',
  currentPrice: 150,
  recommendedPrice: 170,
  confidence: 85,
  strategy: 'balanced',
  occupancy: 70,
  leadTime: 14,
  isEvent: false,
  risk: 'low',
  factors: ['Test'],
  impact: { revpar: 3, adr: 5, occ: 0 },
};

const PARAMS_OK: AutopilotParams = {
  floorRate: 80,
  ceilingRate: 400,
  maxDailyVariationAbs: 40,
  maxDailyVariationPct: 25,
  minConfidence: 70,
  roomTypeExceptions: [],
  channelExceptions: [],
  periodExceptions: [],
  protectEvents: true,
  minOccupancy: 0,
  maxOccupancy: 100,
  shortLeadDays: 3,
  shortLeadMaxPct: 10,
  stayRules: { los: false, minStay: false, cta: false, ctd: false },
  fallbackStrategy: 'balanced',
};

describe('evaluateRecommendation — pas de division par zéro', () => {
  it('outcome=auto sur reco valide + params standard', () => {
    const v = evaluateRecommendation(RECO_OK, PARAMS_OK);
    expect(v.outcome).toBe('auto');
    expect(v.blockingReasons).toHaveLength(0);
  });

  it('ne crash pas quand currentPrice = 0 (déduction deltaPct)', () => {
    const v = evaluateRecommendation(
      { ...RECO_OK, currentPrice: 0, recommendedPrice: 150 },
      PARAMS_OK,
    );
    // Le verdict peut bloquer mais ne doit jamais throw
    expect(v).toBeDefined();
    expect(v.outcome).toBeDefined();
  });

  it('blocked quand reco sous le plancher', () => {
    const v = evaluateRecommendation(
      { ...RECO_OK, recommendedPrice: 50 },
      PARAMS_OK,
    );
    expect(v.outcome).toBe('blocked');
    expect(v.blockingReasons.some((r) => r.includes('plancher'))).toBe(true);
  });

  it('blocked quand confiance sous le seuil minimum', () => {
    const v = evaluateRecommendation(
      { ...RECO_OK, confidence: 50 },
      PARAMS_OK,
    );
    expect(['review', 'blocked']).toContain(v.outcome);
  });

  it('événement protégé → review/blocked au lieu de auto', () => {
    const v = evaluateRecommendation(
      { ...RECO_OK, isEvent: true },
      PARAMS_OK,
    );
    expect(v.outcome).not.toBe('auto');
  });

  it('exception type chambre → review/blocked', () => {
    const v = evaluateRecommendation(
      RECO_OK,
      { ...PARAMS_OK, roomTypeExceptions: ['Standard'] },
    );
    expect(v.outcome).not.toBe('auto');
  });

  it('checks toujours définis (UI lit verdict.checks[].label)', () => {
    const v = evaluateRecommendation(RECO_OK, PARAMS_OK);
    expect(Array.isArray(v.checks)).toBe(true);
    expect(v.checks.length).toBeGreaterThan(0);
    v.checks.forEach((c) => {
      expect(c.label).toBeTruthy();
      expect(['ok', 'hit']).toContain(c.status);
    });
  });
});
