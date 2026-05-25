/**
 * FLOWTYM RMS — Event Reliability Engine
 *
 * À partir de l'historique d'un événement (éditions précédentes), calcule :
 *   • la fiabilité moyenne des prévisions (Event Reliability Score)
 *   • l'erreur moyenne de prévision par dimension (ADR, TO, RevPAR, compression)
 *   • la tendance d'impact (croissante, stable, déclinante)
 *   • l'historique moyen d'impact (prior pour la prochaine édition)
 *   • la priorisation automatique pour l'année suivante
 *
 * Données d'entrée :
 *   • Liste d'`EventActualVsForecast` triée chronologiquement
 *
 * Sortie : `EventReliabilityScore`
 *
 * Règles métier :
 *   • Un événement avec ≥ 2 éditions et erreur moyenne ≤ 5 pts → score ≥ 80
 *   • Tendance détectée sur la dérivée des deltas réels (lift réel)
 *   • Un événement avec lift moyen > 25 % ADR ou > 15 pts TO est marqué
 *     `shouldPrioritizeNextEdition = true` — le calendrier doit le mettre
 *     en avant l'année suivante.
 *
 * 100 % pur, déterministe, testable.
 */

import type {
  EventActualVsForecast,
  EventReliabilityScore,
  ForecastError,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Erreur absolue moyenne par dimension (en points de pourcentage). */
function computeMeanError(history: EventActualVsForecast[]): ForecastError {
  const occErr = history.map((h) => Math.abs(h.actual.occupancyDelta - h.forecast.occupancyDelta));
  const adrErr = history.map((h) => Math.abs(h.actual.adrDelta - h.forecast.adrDelta));
  const rpErr  = history.map((h) => Math.abs(h.actual.revparDelta - h.forecast.revparDelta));
  const cpErr  = history.map((h) => Math.abs(h.actual.compression - h.forecast.compression));
  return {
    occupancy:  mean(occErr),
    adr:        mean(adrErr),
    revpar:     mean(rpErr),
    compression: mean(cpErr),
  };
}

/**
 * Lift moyen historique (réel observé) — prior pour la prochaine édition.
 */
function computeHistoricLift(history: EventActualVsForecast[]) {
  return {
    occupancyDelta: mean(history.map((h) => h.actual.occupancyDelta)),
    adrDelta:       mean(history.map((h) => h.actual.adrDelta)),
    revparDelta:    mean(history.map((h) => h.actual.revparDelta)),
    compression:    mean(history.map((h) => h.actual.compression)),
  };
}

/**
 * Tendance d'impact = signe de la pente des réels (ADR + TO) sur le temps.
 * Fenêtre de 3 dernières éditions max pour rester réactif.
 */
function computeTrend(history: EventActualVsForecast[]): EventReliabilityScore['trend'] {
  if (history.length < 2) return 'stable';

  const sortedHistory = [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const recent = sortedHistory.slice(-3);

  // Combinaison ADR + TO pour avoir un signal robuste
  const composite = recent.map(
    (h) => h.actual.adrDelta * 0.6 + h.actual.occupancyDelta * 0.4,
  );

  // Pente simple via régression linéaire ordinaire (slope) sur t = 0, 1, 2…
  const n = composite.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(composite);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (composite[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  if (slope > 2) return 'rising';
  if (slope < -2) return 'declining';
  return 'stable';
}

/**
 * Score 0-100 à partir de l'erreur moyenne pondérée :
 *   - ADR (poids 0.40) — la dimension la plus utile au RM
 *   - Occupancy (0.30)
 *   - Compression (0.20)
 *   - RevPAR (0.10)
 *
 * Erreur 0 pt → 100 ; erreur 30 pts → 0. Linéaire entre.
 */
function computeScore(err: ForecastError): number {
  const weighted =
    err.adr * 0.40 +
    err.occupancy * 0.30 +
    err.compression * 0.20 +
    err.revpar * 0.10;
  // Erreur 0 → 100, Erreur 30 → 0
  const raw = 100 - (weighted / 30) * 100;
  return Math.round(clamp(raw, 0, 100));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Compute la fiabilité d'un événement à partir de son historique
 * forecast vs réel.
 *
 * @param eventKey  identifiant logique (slug ou clé événement)
 * @param history   historique forecast vs réel (peut être vide)
 */
export function computeEventReliability(
  eventKey: string,
  history: EventActualVsForecast[],
): EventReliabilityScore {
  if (history.length === 0) {
    return {
      eventKey,
      editionsObserved: 0,
      score: 50, // confiance neutre par défaut
      meanError: { occupancy: 0, adr: 0, revpar: 0, compression: 0 },
      historicLift: { occupancyDelta: 0, adrDelta: 0, revparDelta: 0, compression: 0 },
      trend: 'stable',
      shouldPrioritizeNextEdition: false,
    };
  }

  const meanError = computeMeanError(history);
  const historicLift = computeHistoricLift(history);
  const trend = computeTrend(history);
  const score = computeScore(meanError);

  // Priorisation auto si lift significatif observé
  const shouldPrioritizeNextEdition =
    historicLift.adrDelta >= 25 ||
    historicLift.occupancyDelta >= 15 ||
    historicLift.compression >= 65;

  return {
    eventKey,
    editionsObserved: history.length,
    score,
    meanError,
    historicLift,
    trend,
    shouldPrioritizeNextEdition,
  };
}

/**
 * Compute en batch — utile pour la vue Historique du module Événements
 * qui doit afficher la fiabilité de tous les événements connus.
 *
 * @param historyByKey map { eventKey → liste d'éditions observées }
 */
export function computeEventReliabilities(
  historyByKey: Map<string, EventActualVsForecast[]>,
): Map<string, EventReliabilityScore> {
  const out = new Map<string, EventReliabilityScore>();
  for (const [key, hist] of historyByKey.entries()) {
    out.set(key, computeEventReliability(key, hist));
  }
  return out;
}

/**
 * Helper UI : explication courte de la tendance.
 */
export function explainTrend(trend: EventReliabilityScore['trend']): string {
  switch (trend) {
    case 'rising':    return 'Impact croissant — éditions de plus en plus tendues.';
    case 'declining': return 'Impact en baisse — calibrer les recommandations à la baisse.';
    case 'stable':    return 'Impact stable d\'une édition à l\'autre.';
  }
}
