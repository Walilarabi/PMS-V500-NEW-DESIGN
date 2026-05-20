/**
 * FLOWTYM Revenue — Service d'enrichissement RMS
 *
 * Fonctions pures qui prennent une ligne brute (DayRMSData) et calculent
 * les indicateurs dérivés (scores, niveaux, recommandations enrichies).
 *
 * Centralisé pour éviter la duplication entre AnalyseRMPanel et
 * RecommandationRMPanel.
 *
 * Vague A — Fondations.
 */

import type { DayRMSData } from '../RMSTableauPro';
import { buildRMRecommendation, type RMRecommendation } from '../../../services/recommandation-rm.service';
import {
  getDemandLevel, getCompressionLevel,
  DOMINANT_SOURCE_LABEL,
  type DemandLevel, type CompressionLevel,
} from './rms-theme';

// ═══════════════════════════════════════════════════════════════════════════
// SCORES PARTAGÉS (lecture légère, sans RMRecommendation)
// ═══════════════════════════════════════════════════════════════════════════

export interface RMSScores {
  demandScore: number;
  demandLevel: DemandLevel;
  compressionScore: number;
  compressionLevel: CompressionLevel;
  combinedPressure: number;
  confidenceScore: number;
  scoreLH: number | null;
  scoreEX: number | null;
  dominantSourceLabel: string;
  isContradiction: boolean;
}

/**
 * Calcule tous les scores dérivés à partir d'une ligne RMS, sans construire
 * la RMRecommendation détaillée (plus rapide pour les vues qui n'en ont pas besoin).
 */
export function computeRMSScores(row: DayRMSData): RMSScores {
  const bundle = row.marketBundle;
  const breakdown = row.recommendationBreakdown;
  const combinedPressure = bundle?.consensus.combinedPressure ?? row.marketPressure;
  const demandScore = breakdown?.demandScore.value ?? combinedPressure;
  const compressionScore = breakdown?.compressionScore.value ?? 0;
  const confidenceScore = Math.min(100, row.confidenceScore + (breakdown?.confidenceBonus ?? 0));

  return {
    demandScore,
    demandLevel: getDemandLevel(demandScore),
    compressionScore,
    compressionLevel: getCompressionLevel(compressionScore),
    combinedPressure,
    confidenceScore,
    scoreLH: bundle?.lighthouse.pressurePercent ?? null,
    scoreEX: bundle?.expedia.pressurePercentNeighborhood ?? null,
    dominantSourceLabel: DOMINANT_SOURCE_LABEL[bundle?.consensus.dominantSource ?? 'none'] ?? '–',
    isContradiction: bundle?.consensus.agreement === 'diverge',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHISSEMENT COMPLET (avec RMRecommendation pour cockpit Reco)
// ═══════════════════════════════════════════════════════════════════════════

export interface EnrichedRMSRow extends RMSScores {
  raw: DayRMSData;
  recommendation: RMRecommendation;
}

/**
 * Enrichissement complet : scores + RMRecommendation explicative.
 * Utilisé par RecommandationRMPanel et RMRecommendationDetailModal.
 */
export function enrichRMSRow(row: DayRMSData, totalCapacity: number): EnrichedRMSRow {
  const scores = computeRMSScores(row);

  const recommendation = buildRMRecommendation({
    date: row.date,
    bundle: row.marketBundle,
    breakdown: row.recommendationBreakdown,
    currentPrice: row.currentPrice,
    suggestedPrice: row.suggestedPrice,
    medianPrice: row.medianPrice,
    occupancyRate: row.occupancyRate,
    availability: row.availability,
    totalCapacity,
    pickupRate: row.pickupRate,
    varVsYesterday: row.varVsYesterday ?? null,
    varVs3Days: row.varVs3Days ?? null,
    varVs7Days: row.varVs7Days ?? null,
    eventsCount: row.events.length,
    recommendationLabel: row.recommendation,
    strategy: row.strategy,
  });

  return { raw: row, recommendation, ...scores };
}
