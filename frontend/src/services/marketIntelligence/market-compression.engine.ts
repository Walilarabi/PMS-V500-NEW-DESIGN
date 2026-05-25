/**
 * FLOWTYM RMS — Market Compression Engine
 *
 * Calcule le **MARKET COMPRESSION SCORE 0-100** pour une date à partir
 * d'un snapshot marché + sa vélocité. C'est l'indicateur central qui
 * pilote les recommandations RMS agressives.
 *
 * Pondérations métier (somme = 100) :
 *   • hausse médiane           25
 *   • disparition disponibilité 20
 *   • Min Stay                  15
 *   • CTA/CTD                   10
 *   • fermeture flexible        10
 *   • pickup accéléré           10
 *   • hausse luxe                5
 *   • hausse budget              5
 *
 * Classifications :
 *   • no_compression  <20
 *   • soft            20-39
 *   • building        40-59
 *   • strong          60-79
 *   • extreme         80+
 *
 * Scopes supportés :
 *   • global     — toute la place
 *   • localized  — un quartier / cluster
 *   • luxury / midscale / budget — par segment
 *
 * Les signaux marché détectés sont émis sous forme de `MarketSignal[]`
 * exploitables par le moteur de recommandations RMS.
 *
 * 100 % pur, déterministe, testable.
 */

import {
  COMPRESSION_WEIGHTS,
  type CompressionScope,
  type HotelCluster,
  type MarketCompressionScore,
  type MarketSignal,
  type MarketSnapshot,
  type MarketVelocity,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* CONTRIBUTIONS PAR DIMENSION                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Hausse médiane : delta 7 jours, plafonné à 25 % → 25 pts. */
function contributionMedianLift(velocity: MarketVelocity | null): number {
  if (!velocity) return 0;
  const lift = Math.max(0, velocity.medianDelta.d7); // hausse uniquement
  return Math.min(COMPRESSION_WEIGHTS.medianLift, (lift / 25) * COMPRESSION_WEIGHTS.medianLift);
}

/**
 * Disparition disponibilité : delta 7 jours (négatif = baisse).
 * Plafonné à -40 points → 20 pts.
 */
function contributionAvailabilityDrop(velocity: MarketVelocity | null): number {
  if (!velocity) return 0;
  const drop = Math.max(0, -velocity.availabilityDelta.d7);
  return Math.min(
    COMPRESSION_WEIGHTS.availabilityDrop,
    (drop / 40) * COMPRESSION_WEIGHTS.availabilityDrop,
  );
}

/** Min Stay : part hôtels appliquant Min Stay (0-1) × poids. */
function contributionMinStay(snapshot: MarketSnapshot): number {
  return Math.min(COMPRESSION_WEIGHTS.minStay, snapshot.minStayShare * COMPRESSION_WEIGHTS.minStay);
}

/** CTA/CTD : part hôtels appliquant CTA/CTD (0-1) × poids. */
function contributionCtaCtd(snapshot: MarketSnapshot): number {
  return Math.min(COMPRESSION_WEIGHTS.ctaCtd, snapshot.ctaCtdShare * COMPRESSION_WEIGHTS.ctaCtd);
}

/** Fermeture flexible : part hôtels ayant fermé les tarifs flexibles. */
function contributionFlexibleClosed(snapshot: MarketSnapshot): number {
  return Math.min(
    COMPRESSION_WEIGHTS.flexibleClosed,
    snapshot.flexibleClosedShare * COMPRESSION_WEIGHTS.flexibleClosed,
  );
}

/** Pickup accéléré : accélération pickup, plafonné à 8 res/j → 10 pts. */
function contributionPickupAcceleration(velocity: MarketVelocity | null): number {
  if (!velocity) return 0;
  const acc = Math.max(0, velocity.pickupAcceleration);
  return Math.min(
    COMPRESSION_WEIGHTS.pickupAcceleration,
    (acc / 8) * COMPRESSION_WEIGHTS.pickupAcceleration,
  );
}

/**
 * Hausse luxe/budget — pour l'instant on utilise la médiane globale + un
 * coefficient si snapshot porte un scope. Sera enrichi quand on aura des
 * snapshots par segment.
 */
function contributionLuxuryLift(velocity: MarketVelocity | null, scope: CompressionScope): number {
  if (scope === 'luxury' && velocity) {
    return Math.min(
      COMPRESSION_WEIGHTS.luxuryLift,
      (Math.max(0, velocity.medianDelta.d7) / 25) * COMPRESSION_WEIGHTS.luxuryLift,
    );
  }
  // Sur scope global, on attribue uniformément 60 % du potentiel
  if (scope === 'global' && velocity) {
    return Math.min(
      COMPRESSION_WEIGHTS.luxuryLift,
      (Math.max(0, velocity.medianDelta.d7) / 25) * COMPRESSION_WEIGHTS.luxuryLift * 0.6,
    );
  }
  return 0;
}

function contributionBudgetLift(velocity: MarketVelocity | null, scope: CompressionScope): number {
  if (scope === 'budget' && velocity) {
    return Math.min(
      COMPRESSION_WEIGHTS.budgetLift,
      (Math.max(0, velocity.medianDelta.d7) / 25) * COMPRESSION_WEIGHTS.budgetLift,
    );
  }
  if (scope === 'global' && velocity) {
    return Math.min(
      COMPRESSION_WEIGHTS.budgetLift,
      (Math.max(0, velocity.medianDelta.d7) / 25) * COMPRESSION_WEIGHTS.budgetLift * 0.6,
    );
  }
  return 0;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SIGNAUX DÉTECTÉS                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** Convertit une intensité 0-100 en niveau de confiance par dimension. */
function confidenceFromIntensity(intensity: number, baseConfidence = 80): number {
  return Math.round(Math.max(40, Math.min(99, baseConfidence + intensity / 5)));
}

/**
 * Émet des signaux marché explicables — utilisés par le moteur de
 * recommandations RMS pour produire des justifications human-friendly.
 */
export function detectMarketSignals(
  snapshot: MarketSnapshot,
  velocity: MarketVelocity | null,
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  if (velocity && velocity.medianDelta.d7 >= 5) {
    const intensity = Math.min(100, (velocity.medianDelta.d7 / 25) * 100);
    signals.push({
      code: 'median_lift',
      label: 'Hausse médiane marché',
      intensity,
      confidence: confidenceFromIntensity(intensity),
      detail: `+${velocity.medianDelta.d7.toFixed(1)}% médiane marché sur 7 jours`,
    });
  }

  if (velocity && velocity.availabilityDelta.d7 <= -10) {
    const intensity = Math.min(100, (-velocity.availabilityDelta.d7 / 40) * 100);
    signals.push({
      code: 'availability_drop',
      label: 'Chute disponibilité',
      intensity,
      confidence: confidenceFromIntensity(intensity),
      detail: `Disponibilité marché en baisse de ${(-velocity.availabilityDelta.d7).toFixed(0)} pts sur 7 jours`,
    });
  }

  if (snapshot.minStayShare >= 0.30) {
    const intensity = Math.min(100, snapshot.minStayShare * 100);
    signals.push({
      code: 'min_stay_spread',
      label: 'Diffusion Min Stay',
      intensity,
      confidence: confidenceFromIntensity(intensity, 85),
      detail: `Min Stay détecté sur ${Math.round(snapshot.minStayShare * 100)}% du compset`,
    });
  }

  if (snapshot.ctaCtdShare >= 0.20) {
    const intensity = Math.min(100, snapshot.ctaCtdShare * 100);
    signals.push({
      code: 'cta_ctd_spread',
      label: 'CTA / CTD diffusé',
      intensity,
      confidence: confidenceFromIntensity(intensity, 80),
      detail: `CTA/CTD détecté sur ${Math.round(snapshot.ctaCtdShare * 100)}% du compset`,
    });
  }

  if (snapshot.flexibleClosedShare >= 0.25) {
    const intensity = Math.min(100, snapshot.flexibleClosedShare * 100);
    signals.push({
      code: 'flex_closure',
      label: 'Fermeture tarifs flexibles',
      intensity,
      confidence: confidenceFromIntensity(intensity, 85),
      detail: `${Math.round(snapshot.flexibleClosedShare * 100)}% du compset a fermé les flexibles`,
    });
  }

  if (snapshot.otaClosedShare >= 0.15) {
    const intensity = Math.min(100, snapshot.otaClosedShare * 100);
    signals.push({
      code: 'ota_closure',
      label: 'Fermeture OTA',
      intensity,
      confidence: confidenceFromIntensity(intensity, 75),
      detail: `${Math.round(snapshot.otaClosedShare * 100)}% du compset a fermé une OTA majeure`,
    });
  }

  if (snapshot.inventoryShrinkShare >= 0.20) {
    const intensity = Math.min(100, snapshot.inventoryShrinkShare * 100);
    signals.push({
      code: 'inventory_shrink',
      label: 'Disparition catégories',
      intensity,
      confidence: confidenceFromIntensity(intensity, 80),
      detail: `${Math.round(snapshot.inventoryShrinkShare * 100)}% du compset a fait disparaître une catégorie`,
    });
  }

  if (velocity && velocity.pickupAcceleration >= 2) {
    const intensity = Math.min(100, (velocity.pickupAcceleration / 8) * 100);
    signals.push({
      code: 'pickup_burst',
      label: 'Pickup accéléré',
      intensity,
      confidence: confidenceFromIntensity(intensity, 75),
      detail: `Pickup +${velocity.pickupAcceleration.toFixed(1)} res/jour vs tendance`,
    });
  }

  // Signaux par segment (placeholders — enrichis quand snapshots segmentés)
  return signals;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CLASSIFICATION                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function classifyCompression(score: number): MarketCompressionScore['classification'] {
  if (score >= 80) return 'extreme';
  if (score >= 60) return 'strong';
  if (score >= 40) return 'building';
  if (score >= 20) return 'soft';
  return 'no_compression';
}

/**
 * Détermine les clusters affectés à partir du snapshot.
 * Pour l'instant, basé sur des seuils par défaut — sera enrichi avec
 * des snapshots segmentés quand disponibles.
 */
function inferAffectedClusters(snapshot: MarketSnapshot): HotelCluster[] {
  const clusters: HotelCluster[] = [];
  if (snapshot.minStayShare >= 0.30 || snapshot.availability <= 0.5) {
    clusters.push('upscale', 'midscale');
  }
  if (snapshot.flexibleClosedShare >= 0.25) {
    clusters.push('luxury');
  }
  if (snapshot.otaClosedShare >= 0.30) {
    clusters.push('budget');
  }
  return Array.from(new Set(clusters));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule le score de compression marché pour un snapshot + sa vélocité.
 * Le scope par défaut est `global` ; passer un scope segmenté quand on
 * dispose de snapshots par cluster.
 */
export function computeMarketCompression(
  snapshot: MarketSnapshot,
  velocity: MarketVelocity | null = null,
  scope: CompressionScope = 'global',
): MarketCompressionScore {
  const contributions = {
    medianLift: contributionMedianLift(velocity),
    availabilityDrop: contributionAvailabilityDrop(velocity),
    minStay: contributionMinStay(snapshot),
    ctaCtd: contributionCtaCtd(snapshot),
    flexibleClosed: contributionFlexibleClosed(snapshot),
    pickupAcceleration: contributionPickupAcceleration(velocity),
    luxuryLift: contributionLuxuryLift(velocity, scope),
    budgetLift: contributionBudgetLift(velocity, scope),
  };

  const raw =
    contributions.medianLift +
    contributions.availabilityDrop +
    contributions.minStay +
    contributions.ctaCtd +
    contributions.flexibleClosed +
    contributions.pickupAcceleration +
    contributions.luxuryLift +
    contributions.budgetLift;

  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const classification = classifyCompression(score);
  const affectedClusters = inferAffectedClusters(snapshot);

  return {
    date: snapshot.date,
    scope,
    score,
    classification,
    contributions,
    affectedClusters,
    snapshot,
  };
}

/**
 * Compute la compression pour une série de snapshots (toute la fenêtre).
 * Utile pour la heatmap et les timelines.
 */
export function computeCompressionWindow(
  snapshots: MarketSnapshot[],
  velocityByDate: Map<string, MarketVelocity>,
  scope: CompressionScope = 'global',
): Map<string, MarketCompressionScore> {
  const out = new Map<string, MarketCompressionScore>();
  for (const snap of snapshots) {
    out.set(snap.date, computeMarketCompression(snap, velocityByDate.get(snap.date) ?? null, scope));
  }
  return out;
}
