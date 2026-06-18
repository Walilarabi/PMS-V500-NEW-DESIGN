/**
 * FLOWTYM RMS — Source UNIQUE pour la recommandation tarifaire jour-marché.
 *
 * Avant ce module, deux composants calculaient la même chose différemment :
 *  - MarketDayDecisionModal (popup « Décision RM ») → moteur RMS centralisé
 *    + centralPricingEngine.
 *  - DayDetailPanel (bloc « Détail du jour / Recommandation RMS ») →
 *    formule simpliste locale (`median × 0.98` si demand ≥ 75 et ourPrice <
 *    median, `median × 1.02` si demand ≤ 25 et ourPrice > median, sinon
 *    `ourPrice`).
 *
 * Résultat observé pour le 18/06/2026 :
 *  - popup affichait 375 € (moteur centralisé)
 *  - panel affichait 298 € (formule locale)
 * → le RM ne savait pas quel tarif appliquer.
 *
 * Avec ce helper, les deux composants délèguent leur calcul ICI. Garantie
 * d'invariant par construction : même input → même output.
 *
 * Le helper respecte aussi la priorité du moteur central pricing :
 *  1. Si une décision a déjà été prise (accept/reject/maintain) ailleurs
 *     dans l'app sur cette date → on respecte la valeur stockée.
 *  2. Sinon → on délègue au moteur RMS (11 facteurs + pondération NRF).
 *  3. Si aucune donnée tarifaire amont (median manquante ET prix manquant) →
 *     pas de recommandation (null) plutôt qu'une valeur fabriquée.
 */

import { centralPricingEngine } from '@/src/services/revenue/centralPricingEngine.service';
import {
  calculateRecommendation,
  calculateStrategy,
  type Strategy,
} from '@/src/services/revenue/rmsEngine';

export interface DayRecommendationInput {
  /** YYYY-MM-DD — clé centrale (mêmes données → mêmes recos). */
  date: string;
  /** Prix issu de Lighthouse (benchmark marché). null si non relevé. */
  ourPrice: number | null;
  /** Prix issu du Calendrier tarifaire (BAR). Prioritaire si présent. */
  calendarPrice?: number;
  /** Médiane compset. null si compset vide / incomplet. */
  median: number | null;
  /** Demande marché 0–100. */
  demand: number;
}

export type PressureLabel = 'Faible' | 'Modérée' | 'Forte' | 'Extrême';
export type DayRecommendationSource = 'central-engine' | 'rms-engine' | 'no-data';

export interface DayRecommendation {
  /** Prix actuellement en vente (calendarPrice prioritaire, fallback ourPrice). */
  currentPrice: number;
  /** Prix recommandé par le moteur unique. null = données insuffisantes. */
  recommendedPrice: number | null;
  /** Δ recommandé − actuel. null si recommendedPrice est null. */
  recommendationDelta: number | null;
  strategy: Strategy;
  pressureLabel: PressureLabel;
  confidence: number;
  /** Provenance — utile pour debug et badge UI. */
  source: DayRecommendationSource;
}

/** Mapping pression → label, aligné sur MarketDayDecisionModal historique. */
export function pressureLabelFor(demand: number): PressureLabel {
  if (demand >= 85) return 'Extrême';
  if (demand >= 65) return 'Forte';
  if (demand >= 40) return 'Modérée';
  return 'Faible';
}

export function calculateDayRecommendation(
  day: DayRecommendationInput,
): DayRecommendation {
  // Prix actuel : calendrier (BAR) prioritaire, sinon Lighthouse, sinon 0.
  const currentPrice = day.calendarPrice ?? day.ourPrice ?? 0;

  const pressureLabel = pressureLabelFor(day.demand);
  const strategy = calculateStrategy({
    marketPressure: day.demand,
    occupancyRate: day.demand,
  });

  // Pas de prix actuel OU pas de médiane → pas de reco. Cohérent avec
  // l'ancien DayDetailPanel qui retournait null dans ce cas.
  if (currentPrice <= 0 || day.median == null || day.median <= 0) {
    return {
      currentPrice,
      recommendedPrice: null,
      recommendationDelta: null,
      strategy,
      pressureLabel,
      confidence: 0,
      source: 'no-data',
    };
  }

  // Priorité 1 : une décision a déjà été calculée (et potentiellement
  // acceptée/refusée/maintenue) dans le central engine — on la respecte
  // pour assurer la cohérence cross-écrans.
  const existing = centralPricingEngine.get(day.date);
  if (existing) {
    return {
      currentPrice,
      recommendedPrice: existing.suggestedPrice,
      recommendationDelta: existing.suggestedPrice - currentPrice,
      strategy,
      pressureLabel,
      confidence: existing.confidence ?? 85,
      source: 'central-engine',
    };
  }

  // Priorité 2 : moteur RMS centralisé (11 facteurs + pondération NRF).
  const engineResult = calculateRecommendation({
    currentPrice,
    medianPrice: day.median,
    marketPressure: day.demand,
    occupancyRate: day.demand,
    date: day.date,
    source: 'lighthouse',
  });
  return {
    currentPrice,
    recommendedPrice: engineResult.suggestedPrice,
    recommendationDelta: engineResult.suggestedPrice - currentPrice,
    strategy,
    pressureLabel,
    confidence: engineResult.confidence,
    source: 'rms-engine',
  };
}
