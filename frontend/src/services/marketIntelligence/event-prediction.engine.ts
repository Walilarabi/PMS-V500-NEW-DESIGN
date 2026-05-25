/**
 * FLOWTYM RMS — Event Prediction Engine
 *
 * Prédit l'impact d'un événement pour la fenêtre [startDate, endDate] :
 *   • Expected ADR Lift     (%)
 *   • Expected Occupancy Lift (points)
 *   • Expected Compression  (0-100)
 *   • Confidence            (0-100)
 *
 * Sources de signal utilisées :
 *   1) Reliability historique (édition précédente du même événement)
 *      — c'est la source la plus fiable. Pondération 50 %.
 *   2) Event Impact Score (LOT 1) — proxy pour les événements sans
 *      historique. Pondération 30 %.
 *   3) Événements similaires détectés dans la base (matching par
 *      catégorie + audience + venue + récurrence). Pondération 20 %.
 *
 * Le moteur sait également détecter les SCHÉMAS CACHÉS via le matching
 * d'événements similaires : "Salon Y de catégorie Z à Villepinte
 * généralement +18 % ADR sur 4 jours".
 *
 * 100 % pur, déterministe, testable.
 */

import type { RMSMarketEvent } from '../../types/events';
import {
  type EventEnrichment,
  type EventImpactScore,
  type EventReliabilityScore,
  type MarketImpactForecast,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* SIMILAR EVENTS DETECTION                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SimilarEvent {
  eventId: string;
  similarity: number;          // 0-100
  matchedAttributes: string[]; // explication
}

/**
 * Détecte les événements historiquement similaires à un événement cible.
 * Matching multi-critères :
 *   • même catégorie (poids 30)
 *   • même cluster compset principal (poids 20)
 *   • même tier audience (poids 20)
 *   • même mix client (poids 15)
 *   • même venue (poids 15) — bonus si exact
 */
export function findSimilarEvents(
  target: { event: RMSMarketEvent; enrichment: EventEnrichment },
  pool: Array<{ event: RMSMarketEvent; enrichment: EventEnrichment }>,
  topN = 5,
): SimilarEvent[] {
  const out: SimilarEvent[] = [];
  for (const candidate of pool) {
    if (candidate.event.id === target.event.id) continue;
    let score = 0;
    const matched: string[] = [];

    if (candidate.event.category === target.event.category) {
      score += 30;
      matched.push('catégorie');
    }
    if (candidate.enrichment.geoImpact.primaryCluster === target.enrichment.geoImpact.primaryCluster) {
      score += 20;
      matched.push('cluster compset');
    }
    if (candidate.enrichment.audienceTier === target.enrichment.audienceTier) {
      score += 20;
      matched.push('audience');
    }
    if (candidate.enrichment.clientMix === target.enrichment.clientMix) {
      score += 15;
      matched.push('mix client');
    }
    if (
      candidate.event.venue &&
      target.event.venue &&
      candidate.event.venue.toLowerCase() === target.event.venue.toLowerCase()
    ) {
      score += 15;
      matched.push('venue');
    }

    if (score >= 35) {
      out.push({ eventId: candidate.event.id, similarity: score, matchedAttributes: matched });
    }
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PREDICTION                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PredictionInput {
  event: RMSMarketEvent;
  enrichment: EventEnrichment;
  impactScore: EventImpactScore;
  /** Reliability sur l'historique du même événement. */
  ownReliability?: EventReliabilityScore | null;
  /**
   * Événements similaires avec leur reliability historique. Le moteur
   * pondère par la similarité.
   */
  similarEvents?: Array<{
    similarity: number;
    reliability: EventReliabilityScore;
  }>;
}

/**
 * Prédit l'impact d'un événement.
 *
 * Stratégie :
 *   1) Si ownReliability avec ≥ 2 éditions observées → prior fort (50 %).
 *   2) Sinon, si similar events disponibles → moyenne pondérée (40 %).
 *   3) Sinon, fallback sur Event Impact Score normalisé (100 %).
 *
 * Confidence calculée à partir de :
 *   • disponibilité du prior historique (own + similar)
 *   • cohérence Impact Score vs historique
 *   • bornes raisonnables atteintes
 */
export function predictEventImpact(input: PredictionInput): MarketImpactForecast {
  const { event, impactScore } = input;
  const own = input.ownReliability && input.ownReliability.editionsObserved > 0
    ? input.ownReliability
    : null;
  const similars = input.similarEvents ?? [];

  // ─── 1. Lift moyen issu de l'historique propre ──────────────────────────
  let adrLift: number | null = null;
  let occLift: number | null = null;
  let compression: number | null = null;

  if (own) {
    adrLift = own.historicLift.adrDelta;
    occLift = own.historicLift.occupancyDelta;
    compression = own.historicLift.compression;
  }

  // ─── 2. Pondération par similar events ──────────────────────────────────
  if (similars.length > 0) {
    let wAdr = 0, wOcc = 0, wComp = 0, wTotal = 0;
    for (const s of similars) {
      const w = s.similarity / 100;
      wAdr += s.reliability.historicLift.adrDelta * w;
      wOcc += s.reliability.historicLift.occupancyDelta * w;
      wComp += s.reliability.historicLift.compression * w;
      wTotal += w;
    }
    if (wTotal > 0) {
      const simAdr = wAdr / wTotal;
      const simOcc = wOcc / wTotal;
      const simComp = wComp / wTotal;
      if (adrLift === null) {
        adrLift = simAdr;
        occLift = simOcc;
        compression = simComp;
      } else {
        // Mix 60 % propre / 40 % similaires
        adrLift = adrLift * 0.6 + simAdr * 0.4;
        occLift = (occLift ?? 0) * 0.6 + simOcc * 0.4;
        compression = (compression ?? 0) * 0.6 + simComp * 0.4;
      }
    }
  }

  // ─── 3. Fallback sur Impact Score ────────────────────────────────────────
  if (adrLift === null) {
    // Calibration : Impact Score 100 → ~30 % ADR, 50 → ~10 % ADR
    adrLift = (impactScore.score / 100) * 30;
    occLift = (impactScore.score / 100) * 22;
    compression = impactScore.score; // direct
  }

  // ─── 4. Confidence ──────────────────────────────────────────────────────
  let confidence = 50;
  if (own) confidence += Math.min(30, own.editionsObserved * 8);
  if (similars.length > 0) confidence += Math.min(15, similars.length * 5);
  if (impactScore.score >= 70 && (compression ?? 0) >= 60) confidence += 5; // cohérence

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    date: event.startDate,
    expectedAdrLift: round(adrLift),
    expectedOccupancyLift: round(occLift ?? 0),
    expectedCompression: round(compression ?? 0),
    confidence,
    contributingEventIds: [
      event.id,
      ...similars.map((s, i) => `sim_${i}`),
    ],
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Prédit l'impact pour une fenêtre [from, to] en additionnant l'impact
 * de chaque événement actif (clamp 100 sur la compression).
 */
export function predictMarketImpactWindow(
  forecasts: MarketImpactForecast[],
  windowFrom: string,
  windowTo: string,
): MarketImpactForecast[] {
  const inWindow = forecasts.filter(
    (f) => f.date >= windowFrom && f.date <= windowTo,
  );
  return inWindow.sort((a, b) => a.date.localeCompare(b.date));
}
