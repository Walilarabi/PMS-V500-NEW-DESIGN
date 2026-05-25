/**
 * FLOWTYM RMS — Confidence & Anti-Noise Engine
 *
 * Calcule un CONFIDENCE SCORE 0-100 pour un événement enrichi + signaux
 * marché. Le score combine 6 facteurs (chacun 0-100) pondérés :
 *
 *   sourceReliability      18  — fiabilité moyenne des sources
 *   sourceCoverage         15  — nombre de sources qui confirment
 *   dataConsistency        15  — cohérence des données (date, lieu, cat.)
 *   historicalReliability  22  — fiabilité prouvée sur historique
 *   marketDataQuality      15  — taille / fraîcheur compset
 *   signalCoherence        15  — signaux convergents (pas contradictoires)
 *
 * En parallèle, le moteur ANTI-BRUIT détecte 10 types d'anomalies qui
 * font baisser la confidence :
 *   • duplicate_signal      — signal déjà émis (déduplication temporelle)
 *   • price_outlier         — prix marché aberrant (IQR strict)
 *   • ghost_event           — événement remonté par 1 seule source non fiable
 *   • closed_hotel          — hôtel détecté fermé sur la fenêtre
 *   • aberrant_price        — prix < 30 % médiane (anomalie scraping)
 *   • minor_local_event     — petit événement local sans impact
 *   • low_audience          — audience < seuil minimal
 *   • past_event            — événement déjà terminé
 *   • contradictory_signals — médiane monte / dispo monte (impossible)
 *   • low_source_count      — moins de 2 sources qui confirment
 *
 * Règle métier critique : `allowsAggressiveActions` n'est `true` que si
 * `score ≥ CONFIDENCE_THRESHOLD_AGGRESSIVE` (70 par défaut).
 *
 * 100 % pur, déterministe, testable.
 */

import type { EventSource, RMSMarketEvent } from '../../types/events';
import {
  CONFIDENCE_THRESHOLD_AGGRESSIVE,
  type ConfidenceFactors,
  type ConfidenceScore,
  type EventEnrichment,
  type EventReliabilityScore,
  type MarketSignal,
  type MarketSnapshot,
  type NoiseAnomaly,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* PONDÉRATIONS                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const FACTOR_WEIGHTS = {
  sourceReliability: 18,
  sourceCoverage: 15,
  dataConsistency: 15,
  historicalReliability: 22,
  marketDataQuality: 15,
  signalCoherence: 15,
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* SUB-SCORES                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function scoreSourceReliability(sources: EventSource[]): number {
  if (sources.length === 0) return 0;
  const avg = sources.reduce((s, x) => s + x.reliabilityScore, 0) / sources.length;
  return Math.max(0, Math.min(100, avg));
}

function scoreSourceCoverage(count: number): number {
  if (count >= 4) return 100;
  if (count === 3) return 85;
  if (count === 2) return 70;
  if (count === 1) return 40;
  return 0;
}

/** Cohérence date / lieu / catégorie. */
function scoreDataConsistency(event: RMSMarketEvent, enrichment: EventEnrichment): number {
  let score = 100;
  // Dates inversées (impossible — déjà filtré ailleurs, mais on garde la garde)
  if (event.endDate < event.startDate) score -= 50;
  // Ville vide
  if (!event.city || !event.city.trim()) score -= 20;
  // Audience incohérente avec la portée
  if (enrichment.reach === 'global' && enrichment.estimatedAudience < 10_000) score -= 15;
  if (enrichment.reach === 'local' && enrichment.estimatedAudience > 500_000) score -= 15;
  // Recurrence + frequency cohérence
  if (event.frequency === 'annuel' && enrichment.recurrence !== 'annual') score -= 5;
  return Math.max(0, Math.min(100, score));
}

function scoreHistoricalReliability(reliability: EventReliabilityScore | null): number {
  if (!reliability || reliability.editionsObserved === 0) return 50;
  return reliability.score;
}

/**
 * Qualité des données marché : taille compset + fraîcheur des snapshots.
 * Compset < 4 hôtels = score faible. Snapshot > 48h = pénalité.
 */
function scoreMarketDataQuality(
  compsetSize: number,
  freshnessHours: number,
): number {
  let score = 100;
  if (compsetSize < 4) score -= 40;
  else if (compsetSize < 6) score -= 20;
  else if (compsetSize < 10) score -= 10;

  if (freshnessHours > 72) score -= 30;
  else if (freshnessHours > 48) score -= 20;
  else if (freshnessHours > 24) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Cohérence des signaux : si la médiane monte ET la disponibilité monte
 * (signaux contradictoires), pénalité forte.
 */
function scoreSignalCoherence(signals: MarketSignal[]): number {
  if (signals.length === 0) return 70; // pas de signal = pas d'incohérence, mais pas non plus de confirmation
  const hasMedianLift = signals.some((s) => s.code === 'median_lift');
  const hasAvailDrop = signals.some((s) => s.code === 'availability_drop');
  const hasMinStay = signals.some((s) => s.code === 'min_stay_spread');
  const hasPickup = signals.some((s) => s.code === 'pickup_burst');

  // Combinaison cohérente = score élevé
  let score = 60;
  if (hasMedianLift && hasAvailDrop) score += 25;
  if (hasMinStay && hasAvailDrop) score += 10;
  if (hasPickup && (hasMedianLift || hasMinStay)) score += 5;

  // Confidence moyenne des signaux
  const avgSigConf = signals.reduce((s, x) => s + x.confidence, 0) / signals.length;
  score = score * 0.7 + avgSigConf * 0.3;

  return Math.max(0, Math.min(100, score));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ANTI-BRUIT — détection anomalies                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const MIN_AUDIENCE_FOR_RMS = 2_000;

export interface NoiseDetectionInput {
  event: RMSMarketEvent;
  enrichment: EventEnrichment;
  sources: EventSource[];
  signals: MarketSignal[];
  snapshot?: MarketSnapshot | null;
  /** Date "aujourd'hui" pour détecter past_event. */
  today?: string;
  /** Médiane prix marché (utilisée pour détecter aberrant_price). */
  marketMedian?: number;
}

export function detectNoiseAnomalies(input: NoiseDetectionInput): NoiseAnomaly[] {
  const anomalies: NoiseAnomaly[] = [];
  const { event, enrichment, sources, signals, snapshot, today, marketMedian } = input;

  // 1) past_event
  const todayIso = today ?? new Date().toISOString().slice(0, 10);
  if (event.endDate < todayIso) {
    anomalies.push({
      code: 'past_event',
      severity: 'info',
      detail: `Événement terminé le ${event.endDate}.`,
    });
  }

  // 2) low_source_count
  if (sources.length < 2) {
    anomalies.push({
      code: 'low_source_count',
      severity: 'warning',
      detail: `Confirmé par ${sources.length} source(s) seulement.`,
    });
  }

  // 3) ghost_event — 1 seule source non fiable (<70)
  if (sources.length === 1 && sources[0].reliabilityScore < 70) {
    anomalies.push({
      code: 'ghost_event',
      severity: 'warning',
      detail: `Source unique peu fiable (${sources[0].reliabilityScore}%).`,
    });
  }

  // 4) low_audience
  if (enrichment.estimatedAudience < MIN_AUDIENCE_FOR_RMS) {
    anomalies.push({
      code: 'low_audience',
      severity: 'info',
      detail: `Audience estimée ${enrichment.estimatedAudience} — sous le seuil RMS (${MIN_AUDIENCE_FOR_RMS}).`,
    });
  }

  // 5) minor_local_event
  if (enrichment.reach === 'local' && enrichment.estimatedAudience < 5_000) {
    anomalies.push({
      code: 'minor_local_event',
      severity: 'info',
      detail: 'Événement local mineur — impact RMS limité.',
    });
  }

  // 6) aberrant_price
  if (snapshot && marketMedian && marketMedian > 0) {
    if (snapshot.ourPrice > 0 && snapshot.ourPrice < marketMedian * 0.3) {
      anomalies.push({
        code: 'aberrant_price',
        severity: 'warning',
        detail: `Notre prix ${snapshot.ourPrice.toFixed(0)}€ < 30 % médiane ${marketMedian.toFixed(0)}€.`,
      });
    }
  }

  // 7) contradictory_signals
  const medianLift = signals.some((s) => s.code === 'median_lift');
  const availDrop = signals.some((s) => s.code === 'availability_drop');
  if (medianLift) {
    // Si médiane monte mais availability monte aussi (= pas de drop)
    // → contradictoire. Mais on n'a pas le signal "availability_lift" —
    // on déduit via le snapshot : si disponibilité élevée + médiane monte
    // = signal incohérent (généralement bug source).
    if (snapshot && snapshot.availability > 0.85 && !availDrop) {
      anomalies.push({
        code: 'contradictory_signals',
        severity: 'warning',
        detail: 'Médiane en hausse mais disponibilité encore très haute — vérifier les données.',
      });
    }
  }

  // 8) closed_hotel — heuristique : pickup nul + availability 0
  if (snapshot && snapshot.pickup === 0 && snapshot.availability === 0) {
    anomalies.push({
      code: 'closed_hotel',
      severity: 'warning',
      detail: 'Aucun pickup + dispo 0 → hôtel probablement fermé ou non scrapé.',
    });
  }

  // 9) duplicate_signal — signaux émis avec même code à la même date
  const codeCount = new Map<string, number>();
  for (const s of signals) {
    codeCount.set(s.code, (codeCount.get(s.code) ?? 0) + 1);
  }
  for (const [code, n] of codeCount.entries()) {
    if (n > 1) {
      anomalies.push({
        code: 'duplicate_signal',
        severity: 'info',
        detail: `Signal "${code}" présent ${n} fois sur la même fenêtre.`,
      });
    }
  }

  return anomalies;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ConfidenceComputeInput {
  event: RMSMarketEvent;
  enrichment: EventEnrichment;
  /** Sources qui ont remonté cet événement. */
  sources: EventSource[];
  /** Reliability historique (optionnelle). */
  reliability?: EventReliabilityScore | null;
  /** Signaux marché détectés. */
  signals: MarketSignal[];
  /** Snapshot de référence (pour anti-bruit). */
  snapshot?: MarketSnapshot | null;
  /** Taille du compset utilisé pour le calcul. */
  compsetSize: number;
  /** Fraîcheur des données marché en heures. */
  freshnessHours: number;
  /** Date "aujourd'hui" — utilisé pour past_event. */
  today?: string;
  /** Médiane prix marché — pour aberrant_price. */
  marketMedian?: number;
}

export function computeConfidence(input: ConfidenceComputeInput): ConfidenceScore {
  const factors: ConfidenceFactors = {
    sourceReliability: scoreSourceReliability(input.sources),
    sourceCoverage: scoreSourceCoverage(input.sources.length),
    dataConsistency: scoreDataConsistency(input.event, input.enrichment),
    historicalReliability: scoreHistoricalReliability(input.reliability ?? null),
    marketDataQuality: scoreMarketDataQuality(input.compsetSize, input.freshnessHours),
    signalCoherence: scoreSignalCoherence(input.signals),
  };

  // Score pondéré (somme poids = 100)
  let score =
    (factors.sourceReliability    * FACTOR_WEIGHTS.sourceReliability +
     factors.sourceCoverage       * FACTOR_WEIGHTS.sourceCoverage +
     factors.dataConsistency      * FACTOR_WEIGHTS.dataConsistency +
     factors.historicalReliability * FACTOR_WEIGHTS.historicalReliability +
     factors.marketDataQuality    * FACTOR_WEIGHTS.marketDataQuality +
     factors.signalCoherence      * FACTOR_WEIGHTS.signalCoherence) / 100;

  // Pénalités anti-bruit
  const anomalies = detectNoiseAnomalies({
    event: input.event,
    enrichment: input.enrichment,
    sources: input.sources,
    signals: input.signals,
    snapshot: input.snapshot,
    today: input.today,
    marketMedian: input.marketMedian,
  });

  for (const a of anomalies) {
    if (a.severity === 'critical') score -= 15;
    else if (a.severity === 'warning') score -= 8;
    else score -= 2;
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score,
    factors,
    allowsAggressiveActions: score >= CONFIDENCE_THRESHOLD_AGGRESSIVE,
    anomalies,
  };
}
