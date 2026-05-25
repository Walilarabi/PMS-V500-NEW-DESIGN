/**
 * FLOWTYM RMS — Event Impact Score Engine
 *
 * Calcule l'EVENT IMPACT SCORE 0-100 d'un événement à partir de
 * 7 dimensions pondérées (somme = 100) :
 *
 *   audience            20
 *   international       15
 *   duration            10
 *   historic ADR        20
 *   historic occupancy  20
 *   rarity              10
 *   prestige             5
 *
 * Classification métier (palier) :
 *   90-100 → Compression extrême
 *   75-89  → Très forte tension
 *   60-74  → Hausse ADR probable
 *   40-59  → Surveillance
 *    <40   → Impact faible
 *
 * Le moteur expose aussi `legacyLevel` pour rester compatible avec
 * l'API existante du module Événements (EventImpactLevel).
 *
 * 100 % pur, déterministe, testable.
 */

import type { RMSMarketEvent, EventImpactLevel } from '../../types/events';
import {
  EVENT_IMPACT_WEIGHTS,
  type AudienceTier,
  type EventEnrichment,
  type EventImpactBreakdown,
  type EventImpactScore,
  type EventReach,
  type EventReliabilityScore,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* SUB-SCORES PAR DIMENSION                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Audience → 0..1 puis pondéré × weight. */
function scoreAudience(tier: AudienceTier): number {
  switch (tier) {
    case 'micro':   return 0.10;
    case 'small':   return 0.25;
    case 'medium':  return 0.45;
    case 'large':   return 0.70;
    case 'massive': return 0.90;
    case 'mega':    return 1.00;
  }
}

/** International → 0..1. */
function scoreInternational(reach: EventReach): number {
  switch (reach) {
    case 'local':         return 0.05;
    case 'regional':      return 0.20;
    case 'national':      return 0.50;
    case 'international': return 0.85;
    case 'global':        return 1.00;
  }
}

/**
 * Duration → 0..1. Une journée n'a pas le même poids qu'une semaine.
 * Plafonné à 14 jours (au-delà → effet marginal décroissant déjà capté).
 */
function scoreDuration(days: number): number {
  if (days <= 1) return 0.30;
  if (days <= 2) return 0.50;
  if (days <= 4) return 0.70;
  if (days <= 7) return 0.90;
  if (days >= 14) return 1.00;
  return 0.95;
}

/**
 * Historic ADR lift (delta %, ex: +30 pour +30%). Borne raisonnable 70 %.
 * Si pas de réalisé, on retombe sur l'impact "demand" estimé du moteur.
 */
function scoreHistoricAdr(
  event: RMSMarketEvent,
  reliability: EventReliabilityScore | null,
): number {
  const lift =
    reliability?.historicLift.adrDelta ??
    event.realImpact?.adr ??
    event.impact.adr;
  return clamp01(lift / 70);
}

function scoreHistoricOccupancy(
  event: RMSMarketEvent,
  reliability: EventReliabilityScore | null,
): number {
  const lift =
    reliability?.historicLift.occupancyDelta ??
    event.realImpact?.occupancy ??
    event.impact.occupancy;
  return clamp01(lift / 40);
}

/**
 * Rarity — événement annuel et unique = score moyen ; événements rares
 * (ex: JO, expos coupes du monde, événements ponctuels exceptionnels)
 * = score élevé. Récurrence trop fréquente = score bas (effet d'habitude).
 */
function scoreRarity(enrichment: EventEnrichment): number {
  switch (enrichment.recurrence) {
    case 'unique':   return 1.00;
    case 'biennial': return 0.85;
    case 'biannual': return 0.60;
    case 'annual':   return 0.55;
    case 'monthly':  return 0.20;
  }
}

function scorePrestige(prestige: number): number {
  return clamp01(prestige / 100);
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CLASSIFICATION & LEGACY MAPPING                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function classify(score: number): EventImpactScore['classification'] {
  if (score >= 90) return 'extreme_compression';
  if (score >= 75) return 'very_high_tension';
  if (score >= 60) return 'adr_lift_likely';
  if (score >= 40) return 'watch';
  return 'low_impact';
}

/**
 * Mapping vers l'EventImpactLevel existant pour rester compatible avec
 * l'UI actuelle (badges, filtres rapides, market pressure index).
 */
function toLegacyLevel(score: number): EventImpactLevel {
  if (score >= 95) return 'hyper_compression';
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'low';
  return 'very_low';
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule l'Event Impact Score 0-100 d'un événement enrichi.
 * Si une fiabilité historique existe, elle est utilisée pour calibrer
 * les composantes "historicAdr" et "historicOccupancy".
 *
 * @param event       événement source
 * @param enrichment  résultat de `enrichEvent(event)`
 * @param reliability fiabilité historique (optionnelle)
 */
export function computeEventImpactScore(
  event: RMSMarketEvent,
  enrichment: EventEnrichment,
  reliability: EventReliabilityScore | null = null,
): EventImpactScore {
  // Sub-scores 0..1 par dimension
  const subAudience = scoreAudience(enrichment.audienceTier);
  const subInter    = scoreInternational(enrichment.reach);
  const subDuration = scoreDuration(enrichment.durationDays);
  const subAdr      = scoreHistoricAdr(event, reliability);
  const subOcc      = scoreHistoricOccupancy(event, reliability);
  const subRarity   = scoreRarity(enrichment);
  const subPrestige = scorePrestige(enrichment.prestige);

  // Pondérations métier — somme = 100
  const breakdown: EventImpactBreakdown = {
    audience:         subAudience * EVENT_IMPACT_WEIGHTS.audience,
    international:    subInter    * EVENT_IMPACT_WEIGHTS.international,
    duration:         subDuration * EVENT_IMPACT_WEIGHTS.duration,
    historicAdr:      subAdr      * EVENT_IMPACT_WEIGHTS.historicAdr,
    historicOccupancy: subOcc     * EVENT_IMPACT_WEIGHTS.historicOccupancy,
    rarity:           subRarity   * EVENT_IMPACT_WEIGHTS.rarity,
    prestige:         subPrestige * EVENT_IMPACT_WEIGHTS.prestige,
  };

  const raw =
    breakdown.audience +
    breakdown.international +
    breakdown.duration +
    breakdown.historicAdr +
    breakdown.historicOccupancy +
    breakdown.rarity +
    breakdown.prestige;

  // Bonus weekend (≤ +3 pts) : un événement concentré le weekend exerce
  // une pression marché plus forte qu'un même événement en semaine.
  const weekendBoost = enrichment.weekendShare * 3;

  const score = Math.round(Math.max(0, Math.min(100, raw + weekendBoost)));

  return {
    score,
    classification: classify(score),
    breakdown,
    legacyLevel: toLegacyLevel(score),
  };
}

/**
 * Compute en batch — utile pour les vues liste/calendrier qui ont besoin
 * de tous les scores en une passe.
 */
export function computeEventImpactScores(
  events: RMSMarketEvent[],
  enrichments: Map<string, EventEnrichment>,
  reliabilities: Map<string, EventReliabilityScore> = new Map(),
): Map<string, EventImpactScore> {
  const out = new Map<string, EventImpactScore>();
  for (const ev of events) {
    const enr = enrichments.get(ev.id);
    if (!enr) continue;
    const rel = reliabilities.get(ev.id) ?? null;
    out.set(ev.id, computeEventImpactScore(ev, enr, rel));
  }
  return out;
}
