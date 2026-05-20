/**
 * FLOWTYM — Market Signal Normalizer
 *
 * Agrège les données multi-sources (Lighthouse, Expedia, Salons, PMS) pour
 * une date donnée et produit un MarketSignalBundle normalisé.
 *
 * Caractéristiques :
 *   - Fonction pure — zéro side-effect, zéro dépendance React, testable isolément
 *   - Chaque source reçoit un score de confiance selon fraîcheur et complétude
 *   - Le consensus détecte convergence/divergence entre Lighthouse et Expedia
 *   - La pression combinée est pondérée par les scores de confiance
 *
 * Usage :
 *   const bundle = buildMarketSignalBundle(date, lhDay, exDay, salons, pms, meta);
 *   → bundle.consensus.agreement === 'diverge' → afficher alerte "Signal contradictoire"
 *   → bundle.consensus.combinedPressure → pression marché unifiée 0-100
 */

import type { LighthouseDayData } from './lighthouse-parser.service';
import type { ExpediaDayData } from './expedia-parser.service';
import type { SalonEvent } from './salons-parser.service';
import type { OperationalMetrics } from '../hooks/useOperationalData';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES PUBLICS
// ═══════════════════════════════════════════════════════════════════════════

export type SignalConfidence = 'high' | 'medium' | 'low' | 'absent';

export type ConsensusAgreement =
  | 'converge'   // |LH% − EX%| ≤ 15 pts — les deux sources confirment
  | 'diverge'    // |LH% − EX%| > 15 pts — signal contradictoire
  | 'partial'    // une seule source disponible
  | 'no_data';   // aucune source de pression disponible

export type DominantSource = 'lighthouse' | 'expedia' | 'tie' | 'none';

export interface LighthouseSignal {
  available: boolean;
  pressurePercent: number | null;      // marketDemandPercent (0-100)
  ourPrice: number | null;
  compsetMedian: number | null;
  freshnessHours: number | null;       // âge de l'import en heures
  confidence: SignalConfidence;
}

export interface ExpediaSignal {
  available: boolean;
  pressurePercentNeighborhood: number | null;  // voisinage (plus précis géographiquement)
  pressurePercentBroader: number | null;       // Paris entier
  ourPrice: number | null;
  compsetAverage: number | null;
  soldOutCount: number;                         // concurrents sold_out ce jour
  restrictedCount: number;                      // concurrents en restriction (min stay, etc.)
  competitorCount: number;
  freshnessHours: number | null;
  confidence: SignalConfidence;
}

export interface SalonsSignal {
  available: boolean;
  events: SalonEvent[];                 // bruts (déjà filtrés sur la date par l'appelant)
  count: number;
  impactScore: number;                  // somme pondérée des impacts (0 = pas d'événement)
}

export interface PmsSignal {
  available: boolean;
  occupancyRate: number | null;         // 0..100
  availability: number | null;          // chambres restantes
  leadTimeMajority: number | null;      // médiane lead time en jours
  pickupRate: number | null;            // % variation pick-up
}

export interface SignalConsensus {
  agreement: ConsensusAgreement;
  dominantSource: DominantSource;
  contradictionDelta: number | null;    // |LH% − EX%| en points, null si une seule source
  combinedPressure: number;             // 0-100, fusion pondérée par confidence
}

export interface MarketSignalBundle {
  date: string;                         // YYYY-MM-DD
  lighthouse: LighthouseSignal;
  expedia: ExpediaSignal;
  salons: SalonsSignal;
  pms: PmsSignal;
  consensus: SignalConsensus;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

// Seuil de divergence : au-delà de 15 points d'écart entre LH% et EX%, on affiche
// une alerte "Signal contradictoire". Choix RM : 15 pts = 15% de différence relative.
const DIVERGENCE_THRESHOLD_PTS = 15;

const CONFIDENCE_WEIGHTS: Record<SignalConfidence, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
  absent: 0.0,
};

// Pondération des impacts salons texte → score numérique
const SALON_IMPACT_SCORE: Record<string, number> = {
  'élevé': 3, 'haut': 3, 'high': 3, 'fort': 3,
  'moyen': 2, 'medium': 2, 'modéré': 2,
  'faible': 1, 'low': 1, 'bas': 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS PRIVÉS
// ═══════════════════════════════════════════════════════════════════════════

function computeFreshnessHours(importedAt: string | null, now: Date): number | null {
  if (!importedAt) return null;
  const delta = now.getTime() - new Date(importedAt).getTime();
  return delta / 3_600_000;
}

/**
 * Évalue la confiance d'un signal selon sa fraîcheur et la disponibilité
 * de la donnée de pression marché.
 *
 * Règles (dans l'ordre de priorité) :
 *   absent  — source indisponible OU fraîcheur incalculable
 *   high    — fraîcheur < 24 h ET pression disponible
 *   medium  — fraîcheur < 72 h OU pression disponible mais fraîcheur > 24 h
 *   low     — fraîcheur ≥ 72 h
 */
function computeConfidence(
  available: boolean,
  freshnessHours: number | null,
  hasPressure: boolean,
): SignalConfidence {
  if (!available || freshnessHours === null) return 'absent';
  if (freshnessHours < 24 && hasPressure) return 'high';
  if (freshnessHours < 72) return 'medium';
  return 'low';
}

/**
 * Pondère la pression marché de deux sources par leur score de confiance.
 * Normalise par la somme des poids effectifs pour éviter l'écrasement.
 */
function computeCombinedPressure(
  lhPressure: number | null,
  lhConfidence: SignalConfidence,
  exPressure: number | null,
  exConfidence: SignalConfidence,
): number {
  const lhWeight = lhPressure !== null ? CONFIDENCE_WEIGHTS[lhConfidence] : 0;
  const exWeight = exPressure !== null ? CONFIDENCE_WEIGHTS[exConfidence] : 0;
  const totalWeight = lhWeight + exWeight;
  if (totalWeight === 0) return 0;
  return Math.round(
    ((lhPressure ?? 0) * lhWeight + (exPressure ?? 0) * exWeight) / totalWeight,
  );
}

function computeAgreement(
  lhAvailable: boolean,
  exAvailable: boolean,
  delta: number | null,
): ConsensusAgreement {
  if (!lhAvailable && !exAvailable) return 'no_data';
  if (!lhAvailable || !exAvailable) return 'partial';
  if (delta === null) return 'partial';
  return delta <= DIVERGENCE_THRESHOLD_PTS ? 'converge' : 'diverge';
}

function computeDominantSource(
  lhConfidence: SignalConfidence,
  exConfidence: SignalConfidence,
  lhAvailable: boolean,
  exAvailable: boolean,
): DominantSource {
  if (!lhAvailable && !exAvailable) return 'none';
  if (!lhAvailable) return 'expedia';
  if (!exAvailable) return 'lighthouse';
  const lhW = CONFIDENCE_WEIGHTS[lhConfidence];
  const exW = CONFIDENCE_WEIGHTS[exConfidence];
  if (lhW > exW) return 'lighthouse';
  if (exW > lhW) return 'expedia';
  return 'tie';
}

function computeSalonImpactScore(events: SalonEvent[]): number {
  return events.reduce((acc, ev) => {
    const key = (ev.impact ?? '').toLowerCase().trim();
    return acc + (SALON_IMPACT_SCORE[key] ?? 1);
  }, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit un MarketSignalBundle normalisé pour une date donnée.
 *
 * @param date               — YYYY-MM-DD
 * @param lighthouseDay      — données Lighthouse pour ce jour (null si absent)
 * @param expediaDay         — données Expedia pour ce jour (null si absent)
 * @param salonEvents        — événements salons couvrant ce jour (déjà filtrés)
 * @param pms                — métriques opérationnelles PMS (null si absentes)
 * @param meta               — timestamps des imports pour le calcul de fraîcheur
 * @param now                — date courante (injectable pour les tests)
 */
export function buildMarketSignalBundle(
  date: string,
  lighthouseDay: LighthouseDayData | null,
  expediaDay: ExpediaDayData | null,
  salonEvents: SalonEvent[],
  pms: OperationalMetrics | null,
  meta: { lighthouseImportedAt: string | null; expediaImportedAt: string | null },
  now: Date = new Date(),
): MarketSignalBundle {

  // ─── Lighthouse ───────────────────────────────────────────────────────
  const lhFreshness = computeFreshnessHours(meta.lighthouseImportedAt, now);
  const lhAvailable = lighthouseDay !== null;
  const lhPressure = lighthouseDay?.marketDemandPercent ?? null;
  const lhConfidence = computeConfidence(lhAvailable, lhFreshness, lhPressure !== null);

  const lighthouse: LighthouseSignal = {
    available: lhAvailable,
    pressurePercent: lhPressure,
    ourPrice: lighthouseDay ? lighthouseDay.ourPrice : null,
    compsetMedian: lighthouseDay ? lighthouseDay.compsetMedian : null,
    freshnessHours: lhFreshness,
    confidence: lhConfidence,
  };

  // ─── Expedia ──────────────────────────────────────────────────────────
  const exFreshness = computeFreshnessHours(meta.expediaImportedAt, now);
  const exAvailable = expediaDay !== null;
  const exPressureN = expediaDay?.marketPressureNeighborhoodPercent ?? null;
  const exPressureB = expediaDay?.marketPressureBroaderPercent ?? null;
  const exConfidence = computeConfidence(exAvailable, exFreshness, exPressureN !== null);

  const soldOutCount = expediaDay?.competitors.filter(c => c.status === 'sold_out').length ?? 0;
  const restrictedCount = expediaDay?.competitors.filter(c => c.status === 'restricted').length ?? 0;

  const expedia: ExpediaSignal = {
    available: exAvailable,
    pressurePercentNeighborhood: exPressureN,
    pressurePercentBroader: exPressureB,
    ourPrice: expediaDay?.ourPrice ?? null,
    compsetAverage: expediaDay?.compsetAverage ?? null,
    soldOutCount,
    restrictedCount,
    competitorCount: expediaDay?.competitors.length ?? 0,
    freshnessHours: exFreshness,
    confidence: exConfidence,
  };

  // ─── Salons ───────────────────────────────────────────────────────────
  const salons: SalonsSignal = {
    available: salonEvents.length > 0,
    events: salonEvents,
    count: salonEvents.length,
    impactScore: computeSalonImpactScore(salonEvents),
  };

  // ─── PMS ──────────────────────────────────────────────────────────────
  const pmsSignal: PmsSignal = {
    available: pms !== null,
    occupancyRate: pms?.occupancyRate ?? null,
    availability: pms?.availability ?? null,
    leadTimeMajority: pms?.leadTimeMajority ?? null,
    pickupRate: pms?.pickupRate ?? null,
  };

  // ─── Consensus ────────────────────────────────────────────────────────
  // Divergence calculée sur Expedia voisinage (signal géographiquement plus précis)
  const delta =
    lhAvailable && exAvailable && lhPressure !== null && exPressureN !== null
      ? Math.abs(lhPressure - exPressureN)
      : null;

  const agreement = computeAgreement(lhAvailable, exAvailable, delta);
  const dominantSource = computeDominantSource(lhConfidence, exConfidence, lhAvailable, exAvailable);
  const combinedPressure = computeCombinedPressure(lhPressure, lhConfidence, exPressureN, exConfidence);

  const consensus: SignalConsensus = {
    agreement,
    dominantSource,
    contradictionDelta: delta,
    combinedPressure,
  };

  return { date, lighthouse, expedia, salons, pms: pmsSignal, consensus };
}
