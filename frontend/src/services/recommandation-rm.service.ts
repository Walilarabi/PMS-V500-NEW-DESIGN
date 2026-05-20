/**
 * FLOWTYM — Recommandation RM Service
 *
 * Compose une recommandation RM explicative et exploitable à partir des
 * données déjà enrichies (DayRMSData + MarketSignalBundle + RecommendationBreakdown).
 *
 * Ce n'est PAS le moteur déterministe (qui vit dans market-analysis-engine.ts).
 * Ce service consomme les sorties du moteur et y ajoute :
 *   - restrictions tarifaires recommandées (Min Stay, CTA, CTD, etc.)
 *   - risques détectés (fausse demande, signal contradictoire, sold-out marché…)
 *   - explication multi-paragraphe en français
 *   - mode source (Lighthouse seul / Expedia seul / Croisé)
 *
 * Fonction pure, zéro dépendance React.
 */

import type { MarketSignalBundle } from './market-signal-normalizer';
import type { RecommendationBreakdown } from './market-analysis-engine';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES PUBLICS
// ═══════════════════════════════════════════════════════════════════════════

export type SourceMode = 'lighthouse_only' | 'expedia_only' | 'crossed' | 'none';

export interface RMRecommendation {
  // Synthèse
  actionLabel: string;            // "Augmenter le tarif" / "Baisser" / "Maintenir"
  priceAction: string;            // "+15% (de 280€ à 322€)"
  priceDeltaPercent: number;      // 15
  priceDeltaAbsolute: number;     // 42

  // Restrictions tarifaires recommandées
  restrictions: string[];         // ex: ["Min Stay 2 nuits", "CTA J-7"]

  // Risques détectés
  risks: string[];                // ex: ["Risque fausse demande", "Signal contradictoire"]

  // Explication détaillée (multi-paragraphes)
  detailedExplanation: string[];  // chaque entrée = un paragraphe

  // Mode source
  sourceMode: SourceMode;
  sourceModeLabel: string;        // "Analyse croisée Lighthouse + Expedia"

  // Contradiction
  hasContradiction: boolean;
  contradictionMessage: string | null;

  // Positionnement tarifaire
  pricePositioning: 'sous_marche' | 'mid_market' | 'premium' | 'trop_cher' | 'unknown';
  pricePositioningLabel: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT — données minimales nécessaires
// ═══════════════════════════════════════════════════════════════════════════

export interface RMRecommendationInput {
  date: string;
  bundle: MarketSignalBundle | null;
  breakdown: RecommendationBreakdown | null;
  currentPrice: number;
  suggestedPrice: number;
  medianPrice: number;
  occupancyRate: number;
  availability: number;
  totalCapacity: number;
  pickupRate: number;
  varVsYesterday: number | null;
  varVs3Days: number | null;
  varVs7Days: number | null;
  eventsCount: number;
  recommendationLabel: 'Augmenter' | 'Baisser' | 'Maintenir';
  strategy: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function computeSourceMode(bundle: MarketSignalBundle | null): { mode: SourceMode; label: string } {
  if (!bundle) return { mode: 'none', label: 'Aucune source de signal disponible' };
  const lh = bundle.lighthouse.available;
  const ex = bundle.expedia.available;
  if (lh && ex)  return { mode: 'crossed',         label: 'Analyse croisée Lighthouse + Expedia' };
  if (lh && !ex) return { mode: 'lighthouse_only', label: 'Analyse basée uniquement sur Lighthouse' };
  if (!lh && ex) return { mode: 'expedia_only',    label: 'Analyse basée uniquement sur Expedia' };
  return { mode: 'none', label: 'Aucune source de signal disponible' };
}

function computePositioning(currentPrice: number, medianPrice: number): {
  key: RMRecommendation['pricePositioning']; label: string;
} {
  if (medianPrice <= 0 || currentPrice <= 0) return { key: 'unknown', label: 'Données insuffisantes' };
  const deltaPct = ((currentPrice - medianPrice) / medianPrice) * 100;
  if (deltaPct < -10) return { key: 'sous_marche', label: 'Sous le marché (≤ −10% médiane)' };
  if (deltaPct >  15) return { key: 'trop_cher',   label: 'Trop cher (> +15% médiane)' };
  if (deltaPct >   5) return { key: 'premium',     label: 'Premium (entre +5% et +15%)' };
  return { key: 'mid_market', label: 'Mid-market (±5% médiane)' };
}

function computeRestrictions(input: RMRecommendationInput): string[] {
  const restrictions: string[] = [];
  const demand = input.breakdown?.demandScore.value ?? input.bundle?.consensus.combinedPressure ?? 0;
  const compression = input.breakdown?.compressionScore.value ?? 0;
  const availabilityRatio = input.totalCapacity > 0 ? input.availability / input.totalCapacity : 1;

  // Compression très forte → blindage inventaire
  if (compression >= 75) {
    restrictions.push('Fermeture des canaux opaques à J-3');
    restrictions.push('Protection inventaire (≥ 20% bloqué)');
  } else if (compression >= 50) {
    restrictions.push('Surveillance canaux opaques à J-5');
  }

  // Très forte demande + faible dispo → Min Stay + CTA
  if (demand >= 80 && availabilityRatio <= 0.25) {
    restrictions.push('Min Stay 2 nuits');
    restrictions.push('CTA J-7 (Closed To Arrival)');
  } else if (demand >= 80) {
    restrictions.push('Min Stay 2 nuits');
  } else if (demand >= 60 && input.eventsCount > 0) {
    restrictions.push('Min Stay 2 nuits sur dates événement');
  } else if (demand >= 60 && input.occupancyRate >= 80) {
    restrictions.push('CTA J-7 (Closed To Arrival)');
  }

  // Occupation très élevée → CTD
  if (input.occupancyRate >= 90 && availabilityRatio <= 0.1) {
    restrictions.push('CTD (Closed To Departure) sur veille');
  }

  // Demande faible → libérer
  if (demand < 30 && restrictions.length === 0) {
    restrictions.push('Aucune restriction nécessaire — flexibilité maximale');
  }

  return restrictions;
}

function computeRisks(input: RMRecommendationInput): string[] {
  const risks: string[] = [];
  const bundle = input.bundle;
  const combinedPressure = bundle?.consensus.combinedPressure ?? 0;
  const availabilityRatio = input.totalCapacity > 0 ? input.availability / input.totalCapacity : 1;

  if (bundle?.consensus.agreement === 'diverge' && bundle.consensus.contradictionDelta !== null) {
    risks.push(
      `Signal contradictoire entre Lighthouse et Expedia (écart ${Math.round(bundle.consensus.contradictionDelta)} pts) — validation humaine recommandée`,
    );
  }

  if (combinedPressure > 70 && input.eventsCount === 0) {
    risks.push('Risque de fausse demande — pression élevée sans événement répertorié');
  }

  if (bundle && bundle.expedia.competitorCount > 0) {
    const soldOutRatio = bundle.expedia.soldOutCount / bundle.expedia.competitorCount;
    if (soldOutRatio >= 0.5) {
      risks.push(`Risque de sold-out marché — ${Math.round(soldOutRatio * 100)}% du compset déjà épuisé`);
    }
  }

  if (combinedPressure >= 60 && availabilityRatio > 0.7) {
    risks.push('Sous-vente potentielle — forte demande détectée mais inventaire encore largement ouvert');
  }

  if (bundle?.consensus.agreement === 'no_data') {
    risks.push('Données insuffisantes — recommandation fondée sur les seules métriques PMS internes');
  }

  if (input.breakdown && !input.breakdown.isDataReliable) {
    risks.push('Fiabilité réduite — au moins une source critique manque ou est obsolète');
  }

  return risks;
}

function buildDetailedExplanation(input: RMRecommendationInput): string[] {
  const paragraphs: string[] = [];
  const bundle = input.bundle;
  const breakdown = input.breakdown;
  const demand = breakdown?.demandScore.value ?? bundle?.consensus.combinedPressure ?? 0;
  const compression = breakdown?.compressionScore.value ?? 0;
  const combinedPressure = bundle?.consensus.combinedPressure ?? input.bundle?.consensus.combinedPressure ?? 0;

  // ── § 1 : lecture du compset
  const lh = bundle?.lighthouse;
  const ex = bundle?.expedia;
  if (lh?.available && lh.compsetMedian !== null && lh.ourPrice !== null) {
    const deltaPct = lh.compsetMedian > 0 ? ((lh.ourPrice - lh.compsetMedian) / lh.compsetMedian) * 100 : 0;
    const positionDescr = deltaPct < -5 ? 'sous la médiane' : deltaPct > 5 ? 'au-dessus de la médiane' : 'à la médiane';
    paragraphs.push(
      `Lecture compset Lighthouse : notre tarif (${Math.round(lh.ourPrice)}€) est ${positionDescr} ` +
      `du compset (médiane ${Math.round(lh.compsetMedian)}€, écart ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%).`,
    );
  } else if (ex?.available && ex.compsetAverage !== null && ex.ourPrice !== null) {
    paragraphs.push(
      `Lecture compset Expedia : notre tarif ${Math.round(ex.ourPrice)}€ vs moyenne voisinage ${Math.round(ex.compsetAverage)}€. ` +
      `${ex.soldOutCount} concurrents épuisés, ${ex.restrictedCount} en restriction sur ${ex.competitorCount} suivis.`,
    );
  }

  // ── § 2 : niveau de pression marché
  if (combinedPressure > 0) {
    const pressureLevel =
      combinedPressure >= 80 ? 'extrême' :
      combinedPressure >= 60 ? 'élevée' :
      combinedPressure >= 40 ? 'modérée' : 'faible';
    paragraphs.push(
      `Pression marché ${pressureLevel} (${Math.round(combinedPressure)}/100) — score composite issu ` +
      `${bundle?.lighthouse.available && bundle?.expedia.available ? 'du croisement Lighthouse + Expedia voisinage' :
        bundle?.lighthouse.available ? 'de Lighthouse seul' :
        bundle?.expedia.available ? 'd\'Expedia voisinage seul' : 'des sources internes'}.`,
    );
  }

  // ── § 3 : évolution tarifaire (deltas Lighthouse)
  const deltas: string[] = [];
  if (input.varVsYesterday !== null && Math.abs(input.varVsYesterday) >= 0.5) {
    deltas.push(`${input.varVsYesterday >= 0 ? '+' : ''}${input.varVsYesterday.toFixed(1)}% vs hier`);
  }
  if (input.varVs3Days !== null && Math.abs(input.varVs3Days) >= 0.5) {
    deltas.push(`${input.varVs3Days >= 0 ? '+' : ''}${input.varVs3Days.toFixed(1)}% vs J-3`);
  }
  if (input.varVs7Days !== null && Math.abs(input.varVs7Days) >= 0.5) {
    deltas.push(`${input.varVs7Days >= 0 ? '+' : ''}${input.varVs7Days.toFixed(1)}% vs J-7`);
  }
  if (deltas.length > 0) {
    paragraphs.push(`Évolution tarifaire compset (Lighthouse) : ${deltas.join(' · ')}.`);
  }

  // ── § 4 : événement contextuel
  if (input.eventsCount > 0) {
    paragraphs.push(
      `${input.eventsCount} événement${input.eventsCount > 1 ? 's' : ''} identifié${input.eventsCount > 1 ? 's' : ''} sur la date — ` +
      `support légitime de la pression marché observée.`,
    );
  } else if (combinedPressure > 70) {
    paragraphs.push(
      `⚠ Aucun événement répertorié malgré une pression marché élevée. Vérifier événements locaux non listés ` +
      `(salons, congrès, événements sportifs/culturels) avant d'agir agressivement sur le tarif.`,
    );
  }

  // ── § 5 : disponibilité + pick-up
  const availabilityRatio = input.totalCapacity > 0 ? input.availability / input.totalCapacity : 0;
  if (input.totalCapacity > 0) {
    paragraphs.push(
      `Inventaire : ${input.availability} chambres disponibles sur ${input.totalCapacity} ` +
      `(taux d'occupation ${Math.round(input.occupancyRate)}%, pick-up ${input.pickupRate >= 0 ? '+' : ''}${input.pickupRate.toFixed(1)}%). ` +
      (availabilityRatio < 0.2 ? 'Inventaire tendu — opportunité de yield agressif.' :
       availabilityRatio > 0.7 && combinedPressure >= 60 ? 'Inventaire encore large malgré la pression — accélérer la conversion.' :
       'Équilibre inventaire/demande conforme.'),
    );
  }

  // ── § 6 : contradiction éventuelle
  if (bundle?.consensus.agreement === 'diverge' && bundle.consensus.contradictionDelta !== null) {
    paragraphs.push(
      `⚠ Signal contradictoire : Lighthouse indique ${Math.round(bundle.lighthouse.pressurePercent ?? 0)}% de pression, ` +
      `Expedia voisinage ${Math.round(bundle.expedia.pressurePercentNeighborhood ?? 0)}% (écart ${Math.round(bundle.consensus.contradictionDelta)} pts). ` +
      `Validation humaine recommandée avant push automatique.`,
    );
  }

  // ── § 7 : compression
  if (compression >= 50) {
    paragraphs.push(
      `Compression marché ${compression >= 75 ? 'très élevée' : 'élevée'} (${Math.round(compression)}/100) — ` +
      `${bundle?.expedia.soldOutCount ?? 0} sold-out, ${bundle?.expedia.restrictedCount ?? 0} restrictions concurrents.`,
    );
  }

  // ── § 8 : justification synthèse moteur (fallback si rien d'autre)
  if (breakdown?.justificationFR && paragraphs.length === 0) {
    paragraphs.push(breakdown.justificationFR);
  }

  return paragraphs;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export function buildRMRecommendation(input: RMRecommendationInput): RMRecommendation {
  const { mode: sourceMode, label: sourceModeLabel } = computeSourceMode(input.bundle);
  const positioning = computePositioning(input.currentPrice, input.medianPrice);
  const restrictions = computeRestrictions(input);
  const risks = computeRisks(input);
  const detailedExplanation = buildDetailedExplanation(input);

  // Action tarifaire formatée
  const priceDeltaAbsolute = input.suggestedPrice - input.currentPrice;
  const priceDeltaPercent  = input.currentPrice > 0
    ? (priceDeltaAbsolute / input.currentPrice) * 100
    : 0;

  let actionLabel: string;
  let priceAction: string;
  if (input.recommendationLabel === 'Augmenter') {
    actionLabel = 'Augmenter le tarif';
    priceAction = `+${priceDeltaPercent.toFixed(1)}% (${input.currentPrice}€ → ${input.suggestedPrice}€, +${priceDeltaAbsolute}€)`;
  } else if (input.recommendationLabel === 'Baisser') {
    actionLabel = 'Baisser le tarif';
    priceAction = `${priceDeltaPercent.toFixed(1)}% (${input.currentPrice}€ → ${input.suggestedPrice}€, ${priceDeltaAbsolute}€)`;
  } else {
    actionLabel = 'Maintenir le tarif';
    priceAction = `Pas d'ajustement (${input.currentPrice}€)`;
  }

  const hasContradiction = input.bundle?.consensus.agreement === 'diverge';
  const contradictionMessage = hasContradiction
    ? `Signal contradictoire entre Lighthouse et Expedia : validation humaine recommandée.`
    : null;

  return {
    actionLabel,
    priceAction,
    priceDeltaPercent,
    priceDeltaAbsolute,
    restrictions,
    risks,
    detailedExplanation,
    sourceMode,
    sourceModeLabel,
    hasContradiction,
    contradictionMessage,
    pricePositioning: positioning.key,
    pricePositioningLabel: positioning.label,
  };
}
