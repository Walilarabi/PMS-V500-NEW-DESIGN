/**
 * FLOWTYM RMS — Recommendation Engine (explicable)
 *
 * Produit des RECOMMANDATIONS RMS EXPLICABLES à partir des signaux marché
 * + événements + confidence. C'est la couche qui ferme la boucle :
 *
 *   Événements → Enrichment → Impact Score → Reliability
 *                    ↓
 *   Snapshots → Velocity → Compression → Signals
 *                    ↓
 *            Confidence (anti-bruit)
 *                    ↓
 *        RECOMMANDATIONS RMS (cette couche)
 *
 * Types de recommandations émises (12) :
 *   bar_lift | dynamic_lift | close_promotions | close_ota | min_stay
 *   cta | ctd | open_premium | los_restrictions | reduce_allotments
 *   controlled_overbooking | inventory_protection
 *
 * Règles métier :
 *   • Aucune reco si confidence < CONFIDENCE_THRESHOLD_EMIT (45).
 *   • Pas de severity "aggressive" ou "maximum" sans confidence ≥ 70.
 *   • Chaque reco porte des CAUSES explicables (code, label, détail, poids)
 *     pour répondre à la question "POURQUOI cette reco ?".
 *   • Les recos sont déduplifiées par (type, targetDate) — au max une reco
 *     par type et par jour.
 *
 * Exemples de causes typiques :
 *   "Compression marché détectée : +18% médiane marché en 7 jours,
 *    Min Stay détecté sur 62% du compset, disponibilité marché en baisse
 *    de 34% sur 7 jours."
 *
 * 100 % pur, déterministe, testable.
 */

import type { RMSMarketEvent } from '../../types/events';
import {
  CONFIDENCE_THRESHOLD_AGGRESSIVE,
  CONFIDENCE_THRESHOLD_EMIT,
  type ConfidenceScore,
  type EventImpactScore,
  type MarketCompressionScore,
  type MarketImpactForecast,
  type MarketSignal,
  type MarketVelocity,
  type RmsRecommendation,
  type RmsRecommendationCause,
  type RmsRecommendationSeverity,
  type RmsRecommendationType,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* SEVERITY DETERMINATION                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule la sévérité d'une recommandation à partir de :
 *   • la compression observée
 *   • le score d'impact attendu
 *   • la confidence
 *
 * Le calcul borne automatiquement : impossible d'émettre "aggressive" ou
 * "maximum" si la confidence est insuffisante.
 */
function determineSeverity(args: {
  compression: number;
  impactScore: number;
  confidence: number;
}): RmsRecommendationSeverity {
  const combined = (args.compression * 0.5 + args.impactScore * 0.5);

  let severity: RmsRecommendationSeverity = 'soft';
  if (combined >= 85) severity = 'maximum';
  else if (combined >= 70) severity = 'aggressive';
  else if (combined >= 50) severity = 'standard';

  // Garde-fou : pas d'aggressive/maximum sans confidence
  if (args.confidence < CONFIDENCE_THRESHOLD_AGGRESSIVE) {
    if (severity === 'maximum') severity = 'standard';
    else if (severity === 'aggressive') severity = 'standard';
  }
  return severity;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SUGGESTED VALUES                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** Hausse BAR (%) suggérée à partir de l'expected ADR lift + sévérité. */
function suggestBarLift(forecast: MarketImpactForecast, severity: RmsRecommendationSeverity): number {
  const base = Math.max(0, forecast.expectedAdrLift);
  switch (severity) {
    case 'maximum':    return Math.round(base * 1.20);
    case 'aggressive': return Math.round(base * 1.05);
    case 'standard':   return Math.round(base * 0.85);
    case 'soft':       return Math.round(base * 0.50);
  }
}

/** Nombre de nuits Min Stay suggéré. */
function suggestMinStayNights(severity: RmsRecommendationSeverity): number {
  switch (severity) {
    case 'maximum':    return 4;
    case 'aggressive': return 3;
    case 'standard':   return 2;
    case 'soft':       return 2;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CAUSES — explication humaine                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Convertit un signal marché en cause explicable, avec poids dans la décision.
 * Le poids est proportionnel à l'intensité × confidence du signal.
 */
function signalToCause(signal: MarketSignal): RmsRecommendationCause {
  return {
    code: signal.code,
    label: signal.label,
    detail: signal.detail,
    weight: (signal.intensity / 100) * (signal.confidence / 100),
  };
}

/**
 * Ajoute des causes "événement" et "compression" en tête.
 */
function buildCauses(
  signals: MarketSignal[],
  drivingEvents: RMSMarketEvent[],
  compression: MarketCompressionScore | null,
  forecast: MarketImpactForecast | null,
): RmsRecommendationCause[] {
  const causes: RmsRecommendationCause[] = [];

  if (drivingEvents.length > 0) {
    const eventNames = drivingEvents.slice(0, 3).map((e) => e.name).join(', ');
    const more = drivingEvents.length > 3 ? ` +${drivingEvents.length - 3}` : '';
    causes.push({
      code: 'event',
      label: 'Événement marché actif',
      detail: `${eventNames}${more}`,
      weight: 1.0,
    });
  }

  if (compression && compression.score >= 40) {
    causes.push({
      code: 'compression',
      label: 'Compression marché détectée',
      detail: `Score compression ${compression.score}/100 (${compression.classification})`,
      weight: compression.score / 100,
    });
  }

  if (forecast && forecast.expectedAdrLift >= 8) {
    causes.push({
      code: 'forecast',
      label: 'Hausse ADR anticipée',
      detail: `+${forecast.expectedAdrLift.toFixed(0)}% ADR attendu (confidence ${forecast.confidence}%)`,
      weight: Math.min(1, forecast.expectedAdrLift / 30),
    });
  }

  // Ajoute les signaux comme causes secondaires
  for (const sig of signals) {
    causes.push(signalToCause(sig));
  }

  // Normalise les poids (somme = 1)
  const total = causes.reduce((s, c) => s + c.weight, 0);
  if (total > 0) {
    for (const c of causes) c.weight = c.weight / total;
  }

  // Tri par poids décroissant
  return causes.sort((a, b) => b.weight - a.weight);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DECISION RULES — par type de reco                                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface DecisionContext {
  targetDate: string;
  targetEndDate?: string;
  compression: MarketCompressionScore | null;
  velocity: MarketVelocity | null;
  signals: MarketSignal[];
  confidence: ConfidenceScore;
  forecast: MarketImpactForecast | null;
  impactScore: EventImpactScore;
  drivingEvents: RMSMarketEvent[];
  emittedAt: string;
}

/**
 * Génère un id stable pour une reco (type + date + premier event id).
 * Permet déduplication idempotente.
 */
function makeRecoId(type: RmsRecommendationType, date: string, drivingEvents: RMSMarketEvent[]): string {
  const evKey = drivingEvents.length > 0 ? drivingEvents[0].id : 'na';
  return `reco_${type}_${date}_${evKey}`;
}

function makeReco(
  type: RmsRecommendationType,
  title: string,
  suggestedValue: number,
  suggestedUnit: RmsRecommendation['suggestedUnit'],
  severity: RmsRecommendationSeverity,
  ctx: DecisionContext,
): RmsRecommendation {
  return {
    id: makeRecoId(type, ctx.targetDate, ctx.drivingEvents),
    targetDate: ctx.targetDate,
    targetEndDate: ctx.targetEndDate,
    type,
    severity,
    title,
    suggestedValue,
    suggestedUnit,
    causes: buildCauses(ctx.signals, ctx.drivingEvents, ctx.compression, ctx.forecast),
    drivingEventIds: ctx.drivingEvents.map((e) => e.id),
    confidence: ctx.confidence.score,
    compression: ctx.compression ?? undefined,
    velocity: ctx.velocity ?? undefined,
    emittedAt: ctx.emittedAt,
    expiresAt: shiftIso(ctx.emittedAt, 24 * 7), // 7 jours
  };
}

function shiftIso(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + hours * 3_600_000);
  return d.toISOString();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RecommendationComputeInput {
  targetDate: string;
  targetEndDate?: string;
  compression: MarketCompressionScore | null;
  velocity: MarketVelocity | null;
  signals: MarketSignal[];
  confidence: ConfidenceScore;
  forecast: MarketImpactForecast | null;
  impactScore: EventImpactScore;
  drivingEvents: RMSMarketEvent[];
  emittedAt?: string;
}

/**
 * Génère TOUTES les recommandations applicables pour une date cible.
 * Les recommandations sont déduplifiées par type (1 reco max par type).
 *
 * Règle métier centrale :
 *   • Aucune reco si confidence < CONFIDENCE_THRESHOLD_EMIT (45)
 *   • Sévérité bornée par la confidence
 *
 * @returns recommandations triées par sévérité décroissante
 */
export function generateRmsRecommendations(
  input: RecommendationComputeInput,
): RmsRecommendation[] {
  const ctx: DecisionContext = {
    ...input,
    emittedAt: input.emittedAt ?? new Date().toISOString(),
  };

  // Garde-fou : confidence insuffisante → aucune reco
  if (ctx.confidence.score < CONFIDENCE_THRESHOLD_EMIT) {
    return [];
  }

  const recs: RmsRecommendation[] = [];
  const compressionScore = ctx.compression?.score ?? 0;
  const expectedAdrLift = ctx.forecast?.expectedAdrLift ?? 0;
  const hasMinStayPressure = ctx.signals.some((s) => s.code === 'min_stay_spread' && s.intensity >= 30);
  const hasFlexClosure = ctx.signals.some((s) => s.code === 'flex_closure' && s.intensity >= 30);
  const hasAvailDrop = ctx.signals.some((s) => s.code === 'availability_drop' && s.intensity >= 30);
  const hasMedianLift = ctx.signals.some((s) => s.code === 'median_lift' && s.intensity >= 30);
  const hasPickupBurst = ctx.signals.some((s) => s.code === 'pickup_burst' && s.intensity >= 30);
  const hasInventoryShrink = ctx.signals.some((s) => s.code === 'inventory_shrink' && s.intensity >= 30);
  const hasOtaClosure = ctx.signals.some((s) => s.code === 'ota_closure' && s.intensity >= 30);

  // ─── 1. Hausse BAR — déclenchée par hausse médiane ou compression ──────
  if (hasMedianLift || compressionScore >= 50 || expectedAdrLift >= 10) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    const value = suggestBarLift(ctx.forecast ?? { date: ctx.targetDate, expectedAdrLift: 10, expectedOccupancyLift: 0, expectedCompression: 0, confidence: 0, contributingEventIds: [] }, severity);
    if (value > 0) {
      recs.push(makeReco('bar_lift', `Hausse BAR +${value}%`, value, 'percent', severity, ctx));
    }
  }

  // ─── 2. Dynamic lift — hausse progressive si pickup s'accélère ──────────
  if (hasPickupBurst && compressionScore >= 40) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'dynamic_lift',
      'Activer la hausse dynamique (pickup accéléré)',
      Math.max(5, Math.round(expectedAdrLift * 0.6)),
      'percent',
      severity,
      ctx,
    ));
  }

  // ─── 3. Fermer promotions — dès qu'il y a tension ───────────────────────
  if (compressionScore >= 40 || ctx.impactScore.score >= 60) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'close_promotions',
      'Suspendre les promotions actives',
      1,
      'flag',
      severity,
      ctx,
    ));
  }

  // ─── 4. Min Stay — si concurrents appliquent + compression building+ ────
  if (hasMinStayPressure && compressionScore >= 40) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    const nights = suggestMinStayNights(severity);
    recs.push(makeReco('min_stay', `Imposer Min Stay ${nights} nuits`, nights, 'nights', severity, ctx));
  }

  // ─── 5. CTA — si saturation arrivées détectée ───────────────────────────
  if (hasAvailDrop && hasMinStayPressure && ctx.confidence.allowsAggressiveActions) {
    recs.push(makeReco(
      'cta',
      'Close To Arrival (CTA)',
      1,
      'flag',
      'aggressive',
      ctx,
    ));
  }

  // ─── 6. CTD — si saturation départs ─────────────────────────────────────
  if (compressionScore >= 65 && ctx.confidence.allowsAggressiveActions) {
    recs.push(makeReco(
      'ctd',
      'Close To Departure (CTD)',
      1,
      'flag',
      'aggressive',
      ctx,
    ));
  }

  // ─── 7. Fermeture OTA — si concurrents le font ──────────────────────────
  if (hasOtaClosure && compressionScore >= 55) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'close_ota',
      'Fermer les OTA majeures (au profit du direct)',
      1,
      'flag',
      severity,
      ctx,
    ));
  }

  // ─── 8. Ouvrir catégories premium — si compression extrême ──────────────
  if (compressionScore >= 70 && ctx.impactScore.score >= 70) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'open_premium',
      'Ouvrir les catégories premium / suites',
      1,
      'flag',
      severity,
      ctx,
    ));
  }

  // ─── 9. Restrictions LOS — combinaison fermeture flex + Min Stay ────────
  if (hasFlexClosure && hasMinStayPressure) {
    const nights = suggestMinStayNights('aggressive');
    recs.push(makeReco(
      'los_restrictions',
      `Restrictions LOS (${nights}-${nights + 2} nuits)`,
      nights,
      'nights',
      ctx.confidence.allowsAggressiveActions ? 'aggressive' : 'standard',
      ctx,
    ));
  }

  // ─── 10. Réduire allotements — si OTA fermées par concurrents ──────────
  if (hasOtaClosure && hasAvailDrop) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'reduce_allotments',
      'Réduire les allotements OTA',
      Math.round(Math.max(10, compressionScore * 0.3)),
      'percent',
      severity,
      ctx,
    ));
  }

  // ─── 11. Surbooking contrôlé — sur événement avec historique fiable ────
  if (
    ctx.impactScore.score >= 75 &&
    ctx.confidence.allowsAggressiveActions &&
    compressionScore >= 65
  ) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'controlled_overbooking',
      'Surbooking contrôlé (5-8%)',
      Math.round(5 + compressionScore / 25),
      'percent',
      severity,
      ctx,
    ));
  }

  // ─── 12. Protection inventaire — disparition catégories chez concurrents
  if (hasInventoryShrink || (compressionScore >= 60 && expectedAdrLift >= 15)) {
    const severity = determineSeverity({
      compression: compressionScore,
      impactScore: ctx.impactScore.score,
      confidence: ctx.confidence.score,
    });
    recs.push(makeReco(
      'inventory_protection',
      'Protéger l\'inventaire (catégories prisées)',
      1,
      'flag',
      severity,
      ctx,
    ));
  }

  // Déduplication par type (1 max par type)
  const dedup = new Map<RmsRecommendationType, RmsRecommendation>();
  for (const r of recs) {
    const existing = dedup.get(r.type);
    if (!existing || severityRank(r.severity) > severityRank(existing.severity)) {
      dedup.set(r.type, r);
    }
  }

  // Tri par sévérité décroissante puis confidence
  return Array.from(dedup.values()).sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      b.confidence - a.confidence,
  );
}

function severityRank(s: RmsRecommendationSeverity): number {
  switch (s) {
    case 'maximum':    return 4;
    case 'aggressive': return 3;
    case 'standard':   return 2;
    case 'soft':       return 1;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS UI                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Génère une explication textuelle d'une reco (pour les tooltips UI).
 * Format type :
 *   "Hausse BAR +14% recommandée.
 *    POURQUOI : Compression marché score 72/100, Min Stay détecté sur
 *    62% du compset, disponibilité marché en baisse de 34% sur 7 jours."
 */
export function explainRecommendation(reco: RmsRecommendation): string {
  const top = reco.causes.slice(0, 3);
  const why = top.length === 0
    ? 'Causes non détaillées.'
    : top.map((c) => c.detail).join(', ');
  return `${reco.title} — POURQUOI : ${why}.`;
}
