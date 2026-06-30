/**
 * FLOWTYM RMS — Moteur de sélection automatique de stratégie.
 *
 * À partir des signaux marché temps réel, le moteur score chacune des 7
 * stratégies, sélectionne la plus pertinente, expose un indice de confiance
 * et la liste des facteurs ayant influencé la décision.
 *
 * Il fournit aussi l'évaluation d'une recommandation tarifaire face aux
 * garde-fous de l'Autopilote (plancher / plafond / variation / confiance…).
 */

import {
  STRATEGIES,
  STRATEGY_BY_ID,
  type SignalKey,
  type StrategyId,
} from './strategies';

/** Photographie temps réel du marché — 12 signaux normalisés. */
export interface MarketSignals {
  /** Taux d'occupation actuel (%). */
  occupancy: number;
  /** Force du pickup sur 7 jours glissants (indice 0-100). */
  pickup: number;
  /** Lead time moyen avant arrivée (jours). */
  leadTime: number;
  /** Pression marché globale (0-100). */
  marketPressure: number;
  /** Intensité événementielle sur la période (0-100). */
  eventIntensity: number;
  /** Évolution tarifaire de la concurrence (-100 baisse → +100 hausse). */
  compsetTrend: number;
  /** Rythme des réservations vs N-1 (-100 → +100). */
  bookingPace: number;
  /** Mix de segmentation (0 = 100 % loisir → 100 = 100 % corporate). */
  segmentMix: number;
  /** Performance historique sur la même période (0-100). */
  historyIndex: number;
  /** Demande future détectée par l'IA (0-100). */
  futureDemand: number;
  /** Tendance de la demande sur les OTA (-100 → +100). */
  otaTrend: number;
  /** Compression marché — rareté de la disponibilité compset (0-100). */
  marketCompression: number;
}

type SignalKind = 'pct' | 'directional' | 'days' | 'index';

export interface SignalMeta {
  key: SignalKey;
  label: string;
  short: string;
  kind: SignalKind;
  /** Lecture humaine de la valeur courante. */
  format: (v: number) => string;
}

export const SIGNAL_META: SignalMeta[] = [
  { key: 'occupancy', label: "Niveau d'occupation", short: 'Occupation', kind: 'pct', format: (v) => `${Math.round(v)} %` },
  { key: 'pickup', label: 'Pickup', short: 'Pickup', kind: 'index', format: (v) => `${Math.round(v)} / 100` },
  { key: 'leadTime', label: 'Lead time', short: 'Lead time', kind: 'days', format: (v) => `${Math.round(v)} j` },
  { key: 'marketPressure', label: 'Pression marché', short: 'Pression', kind: 'pct', format: (v) => `${Math.round(v)} %` },
  { key: 'eventIntensity', label: 'Événements', short: 'Événements', kind: 'index', format: (v) => `${Math.round(v)} / 100` },
  { key: 'compsetTrend', label: 'Évolution concurrentielle', short: 'Compset', kind: 'directional', format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}` },
  { key: 'bookingPace', label: 'Rythme des réservations', short: 'Rythme', kind: 'directional', format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)} %` },
  { key: 'segmentMix', label: 'Segmentation', short: 'Segmentation', kind: 'index', format: (v) => (v >= 55 ? `Corpo ${Math.round(v)} %` : `Loisir ${100 - Math.round(v)} %`) },
  { key: 'historyIndex', label: 'Historique', short: 'Historique', kind: 'index', format: (v) => `${Math.round(v)} / 100` },
  { key: 'futureDemand', label: 'Demande future', short: 'Demande future', kind: 'index', format: (v) => `${Math.round(v)} / 100` },
  { key: 'otaTrend', label: 'Tendances OTA', short: 'OTA', kind: 'directional', format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)} %` },
  { key: 'marketCompression', label: 'Compression marché', short: 'Compression', kind: 'pct', format: (v) => `${Math.round(v)} %` },
];

export const SIGNAL_META_BY_KEY: Record<SignalKey, SignalMeta> = SIGNAL_META.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<SignalKey, SignalMeta>,
);

/** Normalise un signal brut vers une amplitude 0-1 (exploité pour l'affichage). */
export function signalLevel(meta: SignalMeta, raw: number): number {
  switch (meta.kind) {
    case 'pct':
    case 'index':
      return clamp(raw / 100, 0, 1);
    case 'directional':
      return clamp((raw + 100) / 200, 0, 1);
    case 'days':
      return clamp(raw / 60, 0, 1);
    default:
      return 0.5;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Niveau de faveur d'un terme : 1 = pleinement favorable, 0 = défavorable. */
function favorLevel(ideal: 'high' | 'low' | 'mid', level: number): number {
  if (ideal === 'high') return level;
  if (ideal === 'low') return 1 - level;
  return 1 - 2 * Math.abs(level - 0.5);
}

export interface StrategyScore {
  id: StrategyId;
  /** Score normalisé 0-100. */
  score: number;
}

export interface DecisionFactor {
  key: SignalKey;
  label: string;
  /** Valeur brute lisible du signal. */
  display: string;
  /** Contribution du facteur au choix (0-100). */
  weight: number;
  impact: 'positive' | 'neutral' | 'negative';
  /** Explication courte du rôle du facteur. */
  reason: string;
}

export interface AutoStrategyResult {
  selected: StrategyId;
  /** Indice de confiance IA 0-100. */
  confidence: number;
  ranking: StrategyScore[];
  factors: DecisionFactor[];
}

function buildReason(label: string, display: string, fav: number): string {
  if (fav >= 0.62) return `${label} (${display}) soutient fortement ce choix`;
  if (fav <= 0.38) return `${label} (${display}) joue en défaveur`;
  return `${label} (${display}) — contribution neutre`;
}

/**
 * Sélectionne la stratégie la plus pertinente au regard des signaux marché.
 */
export function selectStrategy(signals: MarketSignals): AutoStrategyResult {
  const levels = {} as Record<SignalKey, number>;
  for (const meta of SIGNAL_META) {
    levels[meta.key] = signalLevel(meta, signals[meta.key]);
  }

  const scored: { id: StrategyId; raw: number; max: number }[] = STRATEGIES.map((strategy) => {
    let raw = 0;
    let max = 0;
    for (const term of strategy.profile) {
      max += term.weight;
      raw += term.weight * favorLevel(term.ideal, levels[term.key]);
    }
    return { id: strategy.id, raw, max };
  });

  const ranking: StrategyScore[] = scored
    .map((s) => ({ id: s.id, score: Math.round((s.raw / s.max) * 100) }))
    .sort((a, b) => b.score - a.score);

  const selected = ranking[0].id;
  const margin = (ranking[0].score - ranking[1].score) / 100;
  const confidence = Math.round(clamp(60 + 80 * margin + ranking[0].score * 0.12, 55, 97));

  const winner = STRATEGY_BY_ID[selected];
  const factors: DecisionFactor[] = winner.profile
    .map((term) => {
      const meta = SIGNAL_META_BY_KEY[term.key];
      const fav = favorLevel(term.ideal, levels[term.key]);
      const display = meta.format(signals[term.key]);
      return {
        key: term.key,
        label: meta.label,
        display,
        weight: Math.round(term.weight * fav * 100),
        impact: (fav >= 0.55 ? 'positive' : fav <= 0.45 ? 'negative' : 'neutral') as DecisionFactor['impact'],
        reason: buildReason(meta.label, display, fav),
      };
    })
    .sort((a, b) => b.weight - a.weight);

  return { selected, confidence, ranking, factors };
}

// ─── Évaluation des recommandations face aux garde-fous Autopilote ──────────

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PriceRecommendation {
  id: string;
  stayDate: string;
  roomType: string;
  channel: string;
  currentPrice: number;
  recommendedPrice: number;
  /** Confiance IA de la recommandation (%). */
  confidence: number;
  strategy: StrategyId;
  occupancy: number;
  leadTime: number;
  isEvent: boolean;
  risk: RiskLevel;
  factors: string[];
  impact: { revpar: number; adr: number; occ: number };
}

export interface AutopilotParams {
  floorRate: number;
  ceilingRate: number;
  maxDailyVariationAbs: number;
  maxDailyVariationPct: number;
  minConfidence: number;
  roomTypeExceptions: string[];
  channelExceptions: string[];
  periodExceptions: { id: string; label: string; from: string; to: string }[];
  protectEvents: boolean;
  minOccupancy: number;
  maxOccupancy: number;
  shortLeadDays: number;
  /** Variation max autorisée sur la fenêtre courte (lead time court), en %. */
  shortLeadMaxPct: number;
  stayRules: { los: boolean; minStay: boolean; cta: boolean; ctd: boolean };
  fallbackStrategy: StrategyId | 'hold';
}

export interface GuardrailCheck {
  label: string;
  status: 'ok' | 'hit';
  detail: string;
}

export interface RecommendationVerdict {
  /** `auto` = applicable sans intervention, `review` = confirmation humaine requise, `blocked` = bloqué. */
  outcome: 'auto' | 'review' | 'blocked';
  checks: GuardrailCheck[];
  blockingReasons: string[];
}

function withinPeriodException(
  stayDate: string,
  periods: AutopilotParams['periodExceptions'],
): { id: string; label: string } | null {
  for (const p of periods) {
    if (stayDate >= p.from && stayDate <= p.to) return { id: p.id, label: p.label };
  }
  return null;
}

/**
 * Évalue une recommandation tarifaire face aux garde-fous Autopilote.
 * Le verdict ne tient pas compte du niveau d'automatisation : c'est la
 * couche appelante qui décide d'appliquer ou non selon le niveau actif.
 */
export function evaluateRecommendation(
  reco: PriceRecommendation,
  params: AutopilotParams,
): RecommendationVerdict {
  const checks: GuardrailCheck[] = [];
  const blocking: string[] = [];
  const delta = reco.recommendedPrice - reco.currentPrice;
  const deltaAbs = Math.abs(delta);
  const deltaPct = reco.currentPrice > 0 ? (deltaAbs / reco.currentPrice) * 100 : 0;

  // Plancher / plafond tarifaire.
  if (reco.recommendedPrice < params.floorRate) {
    checks.push({ label: 'Tarif plancher', status: 'hit', detail: `${reco.recommendedPrice} € < plancher ${params.floorRate} €` });
    blocking.push('Tarif sous le plancher autorisé');
  } else if (reco.recommendedPrice > params.ceilingRate) {
    checks.push({ label: 'Tarif plafond', status: 'hit', detail: `${reco.recommendedPrice} € > plafond ${params.ceilingRate} €` });
    blocking.push('Tarif au-dessus du plafond autorisé');
  } else {
    checks.push({ label: 'Plancher / plafond', status: 'ok', detail: `${reco.recommendedPrice} € dans la fourchette ${params.floorRate}–${params.ceilingRate} €` });
  }

  // Variation max absolue.
  if (deltaAbs > params.maxDailyVariationAbs) {
    checks.push({ label: 'Variation max / jour', status: 'hit', detail: `${deltaAbs.toFixed(0)} € > limite ${params.maxDailyVariationAbs} €` });
    blocking.push('Variation journalière trop forte (€)');
  } else {
    checks.push({ label: 'Variation max / jour', status: 'ok', detail: `${delta >= 0 ? '+' : '-'}${deltaAbs.toFixed(0)} € ≤ ${params.maxDailyVariationAbs} €` });
  }

  // Variation max en pourcentage.
  if (deltaPct > params.maxDailyVariationPct) {
    checks.push({ label: 'Variation max (%)', status: 'hit', detail: `${deltaPct.toFixed(1)} % > limite ${params.maxDailyVariationPct} %` });
    blocking.push('Variation journalière trop forte (%)');
  } else {
    checks.push({ label: 'Variation max (%)', status: 'ok', detail: `${deltaPct.toFixed(1)} % ≤ ${params.maxDailyVariationPct} %` });
  }

  // Seuil de confiance IA.
  if (reco.confidence < params.minConfidence) {
    checks.push({ label: 'Confiance IA', status: 'hit', detail: `${reco.confidence} % < seuil ${params.minConfidence} %` });
    blocking.push('Confiance IA sous le seuil de validation automatique');
  } else {
    checks.push({ label: 'Confiance IA', status: 'ok', detail: `${reco.confidence} % ≥ seuil ${params.minConfidence} %` });
  }

  // Protection des événements spéciaux.
  if (reco.isEvent && params.protectEvents) {
    checks.push({ label: 'Protection événement', status: 'hit', detail: 'Date événementielle — validation manuelle requise' });
    blocking.push('Événement spécial protégé');
  } else if (reco.isEvent) {
    checks.push({ label: 'Protection événement', status: 'ok', detail: 'Date événementielle — protection désactivée' });
  }

  // Exception par type de chambre.
  if (params.roomTypeExceptions.includes(reco.roomType)) {
    checks.push({ label: 'Exception chambre', status: 'hit', detail: `${reco.roomType} exclue de l'automatisation` });
    blocking.push(`Type de chambre exclu : ${reco.roomType}`);
  }

  // Exception par canal.
  if (params.channelExceptions.includes(reco.channel)) {
    checks.push({ label: 'Exception canal', status: 'hit', detail: `${reco.channel} exclu de l'automatisation` });
    blocking.push(`Canal exclu : ${reco.channel}`);
  }

  // Exception par période.
  const periodHit = withinPeriodException(reco.stayDate, params.periodExceptions);
  if (periodHit) {
    checks.push({ label: 'Exception période', status: 'hit', detail: `Période protégée : ${periodHit.label}` });
    blocking.push(`Période exclue : ${periodHit.label}`);
  }

  // Seuils de TO min / max.
  if (reco.occupancy < params.minOccupancy) {
    checks.push({ label: 'Seuil TO', status: 'hit', detail: `TO ${reco.occupancy} % < min ${params.minOccupancy} %` });
    blocking.push('Occupation sous le seuil minimum');
  } else if (reco.occupancy > params.maxOccupancy) {
    checks.push({ label: 'Seuil TO', status: 'hit', detail: `TO ${reco.occupancy} % > max ${params.maxOccupancy} %` });
    blocking.push('Occupation au-dessus du seuil maximum');
  } else {
    checks.push({ label: 'Seuil TO', status: 'ok', detail: `TO ${reco.occupancy} % dans la plage ${params.minOccupancy}–${params.maxOccupancy} %` });
  }

  // Règle spécifique lead time court.
  if (reco.leadTime <= params.shortLeadDays && deltaPct > params.shortLeadMaxPct) {
    checks.push({ label: 'Règle lead time court', status: 'hit', detail: `${deltaPct.toFixed(1)} % > ${params.shortLeadMaxPct} % autorisé à J-${reco.leadTime}` });
    blocking.push('Variation trop forte sur la fenêtre courte');
  } else if (reco.leadTime <= params.shortLeadDays) {
    checks.push({ label: 'Règle lead time court', status: 'ok', detail: `Fenêtre courte (J-${reco.leadTime}) — variation maîtrisée` });
  }

  const outcome: RecommendationVerdict['outcome'] =
    blocking.length === 0 ? 'auto' : reco.confidence >= params.minConfidence && blocking.length <= 1 ? 'review' : 'blocked';

  return { outcome, checks, blockingReasons: blocking };
}
