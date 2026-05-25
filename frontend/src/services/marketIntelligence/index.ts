/**
 * FLOWTYM RMS — Market Intelligence Service (orchestrateur)
 *
 * Point d'entrée unifié pour toute la couche Market Intelligence.
 * Orchestre les 7 moteurs purs :
 *
 *   Enrichment → Impact Score → Reliability
 *        ↓
 *   Velocity → Compression → Correlation → Signals
 *        ↓
 *   Confidence (anti-bruit) → Prediction
 *        ↓
 *   Recommendations RMS (explicables)
 *
 * Expose des fonctions haut niveau directement utilisables par l'UI
 * et le RMS sans avoir à connaître l'ordre des appels.
 *
 * Re-exporte aussi tout ce dont l'UI a besoin pour faciliter les imports.
 */

import type { EventSource, RMSMarketEvent } from '../../types/events';
import type {
  ConfidenceScore,
  EnrichedMarketEvent,
  EventActualVsForecast,
  EventImpactScore,
  EventReliabilityScore,
  MarketCompressionScore,
  MarketHeatmapCell,
  MarketImpactForecast,
  MarketIntelligenceAlert,
  MarketSignal,
  MarketSnapshot,
  MarketVelocity,
  RmsRecommendation,
} from '../../types/marketIntelligence';

import { enrichEvent, enrichEvents } from './event-enrichment.engine';
import {
  computeEventImpactScore,
  computeEventImpactScores,
} from './event-impact-score.engine';
import {
  computeEventReliability,
  computeEventReliabilities,
} from './event-reliability.engine';
import {
  computeMarketVelocity,
  computeVelocityWindow,
} from './market-velocity.engine';
import {
  computeCompressionWindow,
  computeMarketCompression,
  detectMarketSignals,
} from './market-compression.engine';
import {
  correlateEventsWithMarket,
} from './event-correlation.engine';
import { computeConfidence } from './confidence.engine';
import {
  findSimilarEvents,
  predictEventImpact,
} from './event-prediction.engine';
import {
  generateRmsRecommendations,
} from './rms-recommendation.engine';

/* ────────────────────────────────────────────────────────────────────────── */
/* RE-EXPORTS — pour l'UI et les tests                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export * from './event-enrichment.engine';
export * from './event-impact-score.engine';
export * from './event-reliability.engine';
export * from './market-velocity.engine';
export * from './market-compression.engine';
export * from './event-correlation.engine';
export * from './confidence.engine';
export * from './event-prediction.engine';
export * from './rms-recommendation.engine';

/* ────────────────────────────────────────────────────────────────────────── */
/* HIGH-LEVEL API                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MarketIntelligenceContext {
  /** Tous les événements (filtrer par statut côté caller si besoin). */
  events: RMSMarketEvent[];
  /** Sources connues (utilisées pour la confidence). */
  sources: EventSource[];
  /** Série de snapshots compset, idéalement 1/jour sur les 60 derniers jours. */
  snapshots: MarketSnapshot[];
  /** Historique forecast vs réel par eventKey (pour Reliability). */
  history?: Map<string, EventActualVsForecast[]>;
  /** Taille compset par défaut (utilisée pour qualité données). */
  compsetSize?: number;
  /** Fraîcheur données marché en heures. */
  freshnessHours?: number;
  /** Date "aujourd'hui" (pour past_event, etc.) */
  today?: string;
}

export interface MarketIntelligenceResult {
  /** Événements enrichis avec scores. */
  enriched: EnrichedMarketEvent[];
  /** Reliability par eventKey. */
  reliabilities: Map<string, EventReliabilityScore>;
  /** Compression par date (sur la fenêtre des snapshots). */
  compression: Map<string, MarketCompressionScore>;
  /** Vélocité par date. */
  velocity: Map<string, MarketVelocity>;
  /** Forecasts d'impact par événement. */
  forecasts: Map<string, MarketImpactForecast>;
  /** Recommandations RMS par eventId — agrégées sur la fenêtre. */
  recommendations: Map<string, RmsRecommendation[]>;
  /** Heatmap : 1 cell par date sur la fenêtre snapshots. */
  heatmap: MarketHeatmapCell[];
  /** Alertes intelligence marché (compression brutale, etc.) */
  alerts: MarketIntelligenceAlert[];
}

/**
 * Calcule tout le pipeline Market Intelligence à partir d'un contexte.
 * À appeler une fois quand les données changent — le résultat est mémo-friendly.
 *
 * Le pipeline est intentionnellement séquentiel et lisible : chaque étape
 * dépend de la précédente. Aucune logique cachée, aucun magic.
 */
export function computeMarketIntelligence(
  ctx: MarketIntelligenceContext,
): MarketIntelligenceResult {
  const compsetSize = ctx.compsetSize ?? 10;
  const freshnessHours = ctx.freshnessHours ?? 12;
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const history = ctx.history ?? new Map();

  // ─── 1. Enrichments ──────────────────────────────────────────────────────
  const enrichments = enrichEvents(ctx.events);

  // ─── 2. Reliabilities ────────────────────────────────────────────────────
  const reliabilities = computeEventReliabilities(history);

  // ─── 3. Impact Scores ────────────────────────────────────────────────────
  const impactScores = computeEventImpactScores(ctx.events, enrichments, reliabilities);

  // ─── 4. Velocity + Compression sur la fenêtre snapshots ──────────────────
  const compression = new Map<string, MarketCompressionScore>();
  const velocity = new Map<string, MarketVelocity>();
  if (ctx.snapshots.length > 0) {
    const from = ctx.snapshots[0].date;
    const to = ctx.snapshots[ctx.snapshots.length - 1].date;
    const v = computeVelocityWindow(ctx.snapshots, from, to);
    for (const [d, vv] of v.entries()) velocity.set(d, vv);
    const c = computeCompressionWindow(ctx.snapshots, velocity);
    for (const [d, cc] of c.entries()) compression.set(d, cc);
  }

  // ─── 5. Correlation events ↔ marché ─────────────────────────────────────
  const reactions = correlateEventsWithMarket(
    ctx.events,
    ctx.snapshots,
    compression,
    velocity,
    impactScores,
  );

  // ─── 6. Forecasts par événement (Prediction Engine) ──────────────────────
  const forecasts = new Map<string, MarketImpactForecast>();
  const enrichedList: EnrichedMarketEvent[] = [];

  // Préparer pool de similars pour findSimilarEvents
  const pool = ctx.events.map((e) => ({
    event: e,
    enrichment: enrichments.get(e.id)!,
  })).filter((x) => x.enrichment);

  for (const ev of ctx.events) {
    const enr = enrichments.get(ev.id);
    if (!enr) continue;
    const imp = impactScores.get(ev.id)!;
    const ownReliability = reliabilities.get(ev.id) ?? null;

    // Find similars avec leur reliability
    const sims = findSimilarEvents({ event: ev, enrichment: enr }, pool, 5)
      .map((s) => ({
        similarity: s.similarity,
        reliability: reliabilities.get(s.eventId),
      }))
      .filter((s): s is { similarity: number; reliability: EventReliabilityScore } =>
        !!s.reliability && s.reliability.editionsObserved > 0,
      );

    const forecast = predictEventImpact({
      event: ev,
      enrichment: enr,
      impactScore: imp,
      ownReliability,
      similarEvents: sims,
    });
    forecasts.set(ev.id, forecast);

    // ─── 7. Confidence par événement ───────────────────────────────────────
    const reaction = reactions.get(ev.id);
    const evSources = ctx.sources.filter((s) => ev.sources.includes(s.id));
    const signals = reaction?.signals ?? [];
    const snapshot = reaction?.inEventSnapshot ?? null;

    const confidence = computeConfidence({
      event: ev,
      enrichment: enr,
      sources: evSources,
      reliability: ownReliability,
      signals,
      snapshot,
      compsetSize,
      freshnessHours,
      today,
      marketMedian: snapshot?.compsetMedian,
    });

    enrichedList.push({
      event: ev,
      enrichment: enr,
      impactScore: imp,
      reliability: ownReliability,
      confidence,
      inferredCategory: ev.category,
    });
  }

  // ─── 8. Recommandations RMS par événement ────────────────────────────────
  const recommendations = new Map<string, RmsRecommendation[]>();
  for (const enriched of enrichedList) {
    const ev = enriched.event;
    const reaction = reactions.get(ev.id);
    const forecast = forecasts.get(ev.id) ?? null;

    const recos = generateRmsRecommendations({
      targetDate: ev.startDate,
      targetEndDate: ev.endDate,
      compression: reaction?.observedCompression ?? null,
      velocity: reaction?.observedVelocity ?? null,
      signals: reaction?.signals ?? [],
      confidence: enriched.confidence,
      forecast,
      impactScore: enriched.impactScore,
      drivingEvents: [ev],
    });

    if (recos.length > 0) recommendations.set(ev.id, recos);
  }

  // ─── 9. Heatmap par date ─────────────────────────────────────────────────
  const heatmap = buildHeatmap(ctx.events, compression, velocity, impactScores);

  // ─── 10. Alertes ─────────────────────────────────────────────────────────
  const alerts = generateAlerts(enrichedList, compression, velocity, reactions);

  return {
    enriched: enrichedList,
    reliabilities,
    compression,
    velocity,
    forecasts,
    recommendations,
    heatmap,
    alerts,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HEATMAP                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function buildHeatmap(
  events: RMSMarketEvent[],
  compression: Map<string, MarketCompressionScore>,
  velocity: Map<string, MarketVelocity>,
  impactScores: Map<string, EventImpactScore>,
): MarketHeatmapCell[] {
  const cells: MarketHeatmapCell[] = [];
  const eventsByDate = new Map<string, RMSMarketEvent[]>();
  for (const ev of events) {
    if (ev.status === 'archived' || ev.status === 'cancelled') continue;
    const cur = new Date(`${ev.startDate}T00:00:00Z`);
    const end = new Date(`${ev.endDate}T00:00:00Z`);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (!eventsByDate.has(iso)) eventsByDate.set(iso, []);
      eventsByDate.get(iso)!.push(ev);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  // Pour chaque date présente en compression OU eventsByDate
  const allDates = new Set<string>([
    ...compression.keys(),
    ...eventsByDate.keys(),
  ]);

  for (const date of allDates) {
    const c = compression.get(date);
    const v = velocity.get(date);
    const evs = eventsByDate.get(date) ?? [];
    const topEvent = evs
      .map((e) => ({ e, s: impactScores.get(e.id)?.score ?? 0 }))
      .sort((a, b) => b.s - a.s)[0];

    cells.push({
      date,
      compression: c?.score ?? 0,
      velocity: v?.velocityIndex ?? 0,
      eventCount: evs.length,
      topEventId: topEvent?.e.id ?? null,
      classification: c?.classification ?? 'no_compression',
    });
  }

  return cells.sort((a, b) => a.date.localeCompare(b.date));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ALERTES                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function generateAlerts(
  enriched: EnrichedMarketEvent[],
  compression: Map<string, MarketCompressionScore>,
  velocity: Map<string, MarketVelocity>,
  // Le paramètre `reactions` n'est pas encore utilisé ici — réservé pour l'enrichissement
  // futur des alertes (ex: attribution score brut). Conservé pour stabilité d'API.
  _reactions: Map<string, unknown>,
): MarketIntelligenceAlert[] {
  const alerts: MarketIntelligenceAlert[] = [];
  const now = new Date().toISOString();
  let counter = 0;
  const makeId = () => `alert_${Date.now()}_${counter++}`;

  // Alerte 1 : compression brutale (delta jour > 25 pts vs hier)
  const sortedDates = Array.from(compression.keys()).sort();
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = compression.get(sortedDates[i - 1])!;
    const cur = compression.get(sortedDates[i])!;
    if (cur.score - prev.score >= 25) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'warning',
        code: 'brutal_compression',
        title: 'Compression marché brutale détectée',
        detail: `Score compression ${prev.score} → ${cur.score} (+${cur.score - prev.score} pts) sur ${sortedDates[i]}`,
        refs: { dates: [sortedDates[i]] },
      });
    }
  }

  // Alerte 2 : variation anormale médiane (delta J-1 > 8 %)
  for (const [d, v] of velocity.entries()) {
    if (Math.abs(v.medianDelta.d1) > 8) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'info',
        code: 'abnormal_variation',
        title: 'Variation médiane anormale',
        detail: `Médiane marché ${v.medianDelta.d1 > 0 ? '+' : ''}${v.medianDelta.d1.toFixed(1)}% vs J-1`,
        refs: { dates: [d] },
      });
    }
  }

  // Alerte 3 : disparition stock (delta J-7 < -25 pts)
  for (const [d, v] of velocity.entries()) {
    if (v.availabilityDelta.d7 < -25) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'warning',
        code: 'stock_disappearance',
        title: 'Disponibilité marché en chute libre',
        detail: `Disponibilité ${v.availabilityDelta.d7.toFixed(0)} pts sur 7 jours`,
        refs: { dates: [d] },
      });
    }
  }

  // Alerte 4 : événement critique détecté
  for (const e of enriched) {
    if (e.impactScore.classification === 'extreme_compression' && e.confidence.score >= 70) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'critical',
        code: 'critical_event_detected',
        title: `Événement critique : ${e.event.name}`,
        detail: `Score impact ${e.impactScore.score}/100 — confidence ${e.confidence.score}%`,
        refs: { eventIds: [e.event.id], dates: [e.event.startDate] },
      });
    }
  }

  // Alerte 5 : pickup acceleration soutenue
  for (const [d, v] of velocity.entries()) {
    if (v.pickupAcceleration >= 5) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'info',
        code: 'pickup_acceleration',
        title: 'Pickup en accélération',
        detail: `+${v.pickupAcceleration.toFixed(1)} res/jour vs tendance`,
        refs: { dates: [d] },
      });
    }
  }

  // Alerte 6 : reliability drift (événement où l'écart prévu / réel s'écarte fortement)
  for (const e of enriched) {
    if (e.reliability && e.reliability.editionsObserved >= 2 && e.reliability.score < 50) {
      alerts.push({
        id: makeId(),
        emittedAt: now,
        level: 'warning',
        code: 'reliability_drift',
        title: `Fiabilité prévisions dégradée : ${e.event.name}`,
        detail: `Score reliability ${e.reliability.score}/100 sur ${e.reliability.editionsObserved} éditions — recalibrer.`,
        refs: { eventIds: [e.event.id] },
      });
    }
  }

  return alerts;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS PUBLICS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Helper bas niveau : enrichit un seul événement avec scores + confidence.
 * Utile pour les détails événement dans l'UI.
 */
export function buildEnrichedMarketEvent(args: {
  event: RMSMarketEvent;
  sources: EventSource[];
  history?: EventActualVsForecast[];
  signals?: MarketSignal[];
  snapshot?: MarketSnapshot | null;
  compsetSize?: number;
  freshnessHours?: number;
  today?: string;
}): EnrichedMarketEvent {
  const enrichment = enrichEvent(args.event);
  const reliability = args.history && args.history.length > 0
    ? computeEventReliability(args.event.id, args.history)
    : null;
  const impactScore = computeEventImpactScore(args.event, enrichment, reliability);
  const confidence = computeConfidence({
    event: args.event,
    enrichment,
    sources: args.sources,
    reliability,
    signals: args.signals ?? [],
    snapshot: args.snapshot ?? null,
    compsetSize: args.compsetSize ?? 10,
    freshnessHours: args.freshnessHours ?? 12,
    today: args.today,
    marketMedian: args.snapshot?.compsetMedian,
  });
  return {
    event: args.event,
    enrichment,
    impactScore,
    reliability,
    confidence,
    inferredCategory: args.event.category,
  };
}

/**
 * Helper bas niveau : calcule signals + compression + velocity pour une date
 * et un snapshot donné. Utile pour les vues détail jour.
 */
export function buildMarketDayContext(
  snapshots: MarketSnapshot[],
  targetDate: string,
): {
  snapshot: MarketSnapshot | null;
  velocity: MarketVelocity | null;
  compression: MarketCompressionScore | null;
  signals: MarketSignal[];
} {
  const snap = snapshots.find((s) => s.date === targetDate) ?? null;
  if (!snap) return { snapshot: null, velocity: null, compression: null, signals: [] };
  const vel = computeMarketVelocity(snapshots, targetDate);
  const comp = computeMarketCompression(snap, vel);
  const sigs = detectMarketSignals(snap, vel);
  return { snapshot: snap, velocity: vel, compression: comp, signals: sigs };
}
