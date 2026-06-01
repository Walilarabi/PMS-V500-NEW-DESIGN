/**
 * FLOWTYM RMS — Moteur de calcul centralisé
 *
 * SOURCE DE VÉRITÉ UNIQUE pour :
 *   - la stratégie tarifaire (8 stratégies)
 *   - le tarif recommandé (11 facteurs pondérés + pondération NRF)
 *
 * Aucun module ne recalcule ces valeurs localement. Tous les écrans
 * (Veille, Tableau RMS, Dashboard Revenue, Recommandations) importent
 * depuis ce fichier.
 *
 * Entrée générique : RmsEngineInput — pas de dépendance vers DayRMSData
 * ou tout autre type d'écran spécifique.
 */

import {
  sourceWeighting,
  seasonFromDate,
  type WeightingSeason,
  type WeightingStrategy,
} from './sourceWeighting.service';

// ─── Types exportés ──────────────────────────────────────────────────────────

export type Strategy =
  | 'Agressive'
  | 'Équilibrée'
  | 'Défensive'
  | 'Opportuniste'
  | 'Haute demande'
  | 'Last Minute'
  | 'Occupation faible'
  | 'Yield Max';

export type Recommendation = 'Augmenter' | 'Baisser' | 'Maintenir';

export interface RmsEngineInput {
  occupancyRate?: number;
  leadTimeMajority?: number;
  pickupRate?: number;
  marketPressure?: number;
  availability?: number;
  /** Prix actuel calendrier (BAR, source rateCalendarStore). */
  currentPrice?: number;
  /** Médiane marché (source Lighthouse/compset). */
  medianPrice?: number;
  /** Stratégie déjà calculée (optionnel — évite un double appel). */
  strategy?: Strategy;
  /** YYYY-MM-DD — pour la saison et le logging. */
  date?: string;
  /** Source de la donnée marché (influe sur la pondération NRF). */
  source?: 'lighthouse' | 'expedia' | 'mix' | 'direct';
  roomTypeCode?: string | null;
  channel?: string | null;
}

export interface RecommendationResult {
  recommendation: Recommendation;
  suggestedPrice: number;
  confidence: number;
  weighting: {
    percent: number;
    delta: number;
    applied: boolean;
    ruleId: string | null;
    rawSuggested: number;
  };
}

// ─── Moteur stratégie (8 stratégies) ────────────────────────────────────────

export function calculateStrategy(input: RmsEngineInput): Strategy {
  const {
    occupancyRate = 50,
    leadTimeMajority = 14,
    pickupRate = 0,
    marketPressure = 0,
    availability = 10,
  } = input;

  if (occupancyRate > 90 && marketPressure > 80) return 'Yield Max';
  if (occupancyRate > 85 && pickupRate > 15) return 'Haute demande';
  if (leadTimeMajority < 3 && availability > 15) return 'Last Minute';
  if (occupancyRate < 30 && leadTimeMajority < 7) return 'Occupation faible';
  if (marketPressure > 70 && occupancyRate < 60) return 'Opportuniste';
  if (occupancyRate < 40 && leadTimeMajority > 30) return 'Agressive';
  if (occupancyRate > 70 && leadTimeMajority < 7) return 'Défensive';
  return 'Équilibrée';
}

// ─── Moteur recommandation (11 facteurs + pondération NRF) ──────────────────

export function calculateRecommendation(input: RmsEngineInput): RecommendationResult {
  const {
    currentPrice = 280,
    medianPrice = 300,
    occupancyRate = 50,
    marketPressure = 0,
    pickupRate = 0,
    date,
    source = 'lighthouse',
    roomTypeCode = null,
    channel = null,
  } = input;

  const strategy = input.strategy ?? calculateStrategy(input);

  let recommendation: Recommendation = 'Maintenir';
  let priceAdjustment = 1.0;
  let confidence = 70;

  switch (strategy) {
    case 'Yield Max':
      recommendation = 'Augmenter'; priceAdjustment = 1.20; confidence = 95; break;
    case 'Haute demande':
      recommendation = 'Augmenter'; priceAdjustment = 1.15; confidence = 90; break;
    case 'Opportuniste':
      recommendation = 'Augmenter'; priceAdjustment = 1.12; confidence = 85; break;
    case 'Défensive':
      if (currentPrice < medianPrice * 0.95) {
        recommendation = 'Augmenter'; priceAdjustment = 1.08; confidence = 75;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 80;
      }
      break;
    case 'Agressive':
      recommendation = 'Baisser'; priceAdjustment = 0.88; confidence = 80; break;
    case 'Occupation faible':
      recommendation = 'Baisser'; priceAdjustment = 0.90; confidence = 85; break;
    case 'Last Minute':
      if (occupancyRate < 50) {
        recommendation = 'Baisser'; priceAdjustment = 0.92; confidence = 75;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 70;
      }
      break;
    case 'Équilibrée':
      if (currentPrice < medianPrice * 0.92) {
        recommendation = 'Augmenter'; priceAdjustment = 1.05; confidence = 65;
      } else if (currentPrice > medianPrice * 1.08) {
        recommendation = 'Baisser'; priceAdjustment = 0.97; confidence = 65;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 70;
      }
      break;
  }

  if (marketPressure > 80) {
    confidence += 10;
    if (recommendation === 'Augmenter') priceAdjustment += 0.03;
  }
  if (pickupRate > 20) {
    confidence += 5;
    if (recommendation === 'Augmenter') priceAdjustment += 0.02;
  }

  // Base = médiane marché pondérée NRF, puis multiplicateur stratégie.
  // Quand stratégie = Maintenir, priceAdjustment = 1 → suggestedPrice ≠
  // currentPrice (la médiane pondérée est le prix cible, pas le prix actuel).
  const referencePrice = medianPrice > 0 ? medianPrice : currentPrice;
  const season: WeightingSeason = date ? seasonFromDate(date) : 'mid';
  const stratKey: WeightingStrategy =
    strategy === 'Yield Max' || strategy === 'Haute demande' || strategy === 'Opportuniste'
      ? 'aggressive'
      : strategy === 'Défensive' || strategy === 'Last Minute' || strategy === 'Occupation faible'
        ? 'defensive'
        : 'balanced';

  const weight = sourceWeighting.apply(referencePrice, {
    source,
    channel,
    roomTypeCode,
    season,
    strategy: stratKey,
  });

  const rawSuggested = Math.round(weight.weightedPrice * priceAdjustment);

  return {
    recommendation,
    suggestedPrice: rawSuggested,
    confidence: Math.min(100, confidence),
    weighting: {
      percent: weight.percent,
      delta: weight.delta,
      applied: weight.applied,
      ruleId: weight.ruleId,
      rawSuggested: Math.round(referencePrice * priceAdjustment),
    },
  };
}
