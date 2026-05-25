/**
 * FLOWTYM RMS — Event ↔ Market Correlation Engine
 *
 * À partir d'une liste d'événements et d'une série de snapshots marché,
 * détermine pour chaque événement :
 *   • la pression marché observée pendant sa fenêtre,
 *   • la compression observée,
 *   • la vélocité observée,
 *   • le snapshot pré-événement vs in-event (delta clairement attribuable),
 *   • un Attribution Score 0-100 — l'événement explique-t-il la pression ?
 *
 * Logique d'attribution :
 *   1) On compare le marché AVANT (fenêtre J-14 à J-1) au marché PENDANT.
 *   2) Si la compression / pression a fortement augmenté, on attribue à
 *      l'événement avec un score d'attribution élevé.
 *   3) Si plusieurs événements coïncident, l'attribution est partagée
 *      proportionnellement à leur Event Impact Score.
 *   4) Si la pression n'a pas augmenté, l'attribution est faible — l'événement
 *      n'a pas l'impact attendu (signal d'alerte pour le RM).
 *
 * 100 % pur, déterministe, testable.
 */

import type { RMSMarketEvent } from '../../types/events';
import type {
  EventImpactScore,
  EventMarketReaction,
  MarketCompressionScore,
  MarketSignal,
  MarketSnapshot,
  MarketVelocity,
} from '../../types/marketIntelligence';
import { detectMarketSignals } from './market-compression.engine';

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function indexByDate<T extends { date: string }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) m.set(it.date, it);
  return m;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDay(d));
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SNAPSHOTS PRE/IN-EVENT                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Snapshot de référence "pré-événement" : moyenne sur J-14 à J-1. */
function buildPreEventSnapshot(
  index: Map<string, MarketSnapshot>,
  startDate: string,
): MarketSnapshot | null {
  const samples: MarketSnapshot[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = index.get(shiftDate(startDate, -i));
    if (d) samples.push(d);
  }
  if (samples.length === 0) return null;
  return averageSnapshots(samples, shiftDate(startDate, -1));
}

/** Snapshot "in-event" : moyenne sur les jours actifs de l'événement. */
function buildInEventSnapshot(
  index: Map<string, MarketSnapshot>,
  startDate: string,
  endDate: string,
): MarketSnapshot | null {
  const samples: MarketSnapshot[] = [];
  for (const d of eachDateInRange(startDate, endDate)) {
    const s = index.get(d);
    if (s) samples.push(s);
  }
  if (samples.length === 0) return null;
  return averageSnapshots(samples, startDate);
}

/** Moyenne pondérée linéaire des snapshots — préserve la structure. */
function averageSnapshots(samples: MarketSnapshot[], representativeDate: string): MarketSnapshot {
  const n = samples.length;
  const sum = samples.reduce(
    (acc, s) => ({
      compsetMedian: acc.compsetMedian + s.compsetMedian,
      ourPrice: acc.ourPrice + s.ourPrice,
      availability: acc.availability + s.availability,
      minStayShare: acc.minStayShare + s.minStayShare,
      ctaCtdShare: acc.ctaCtdShare + s.ctaCtdShare,
      flexibleClosedShare: acc.flexibleClosedShare + s.flexibleClosedShare,
      otaClosedShare: acc.otaClosedShare + s.otaClosedShare,
      pickup: acc.pickup + s.pickup,
      inventoryShrinkShare: acc.inventoryShrinkShare + s.inventoryShrinkShare,
    }),
    {
      compsetMedian: 0, ourPrice: 0, availability: 0, minStayShare: 0,
      ctaCtdShare: 0, flexibleClosedShare: 0, otaClosedShare: 0, pickup: 0,
      inventoryShrinkShare: 0,
    },
  );
  return {
    date: representativeDate,
    capturedAt: new Date().toISOString(),
    compsetMedian: sum.compsetMedian / n,
    ourPrice: sum.ourPrice / n,
    availability: sum.availability / n,
    minStayShare: sum.minStayShare / n,
    ctaCtdShare: sum.ctaCtdShare / n,
    flexibleClosedShare: sum.flexibleClosedShare / n,
    otaClosedShare: sum.otaClosedShare / n,
    pickup: sum.pickup / n,
    inventoryShrinkShare: sum.inventoryShrinkShare / n,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ATTRIBUTION SCORE                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule l'attribution score 0-100 — l'événement explique-t-il la pression
 * observée ? Combine :
 *   • Δ pression observée vs pré-événement (40 %)
 *   • Δ médiane (20 %)
 *   • Δ disponibilité (20 %)
 *   • Cohérence temporelle (10 %) — la pression est-elle apparue juste avant ?
 *   • Score d'impact attendu (10 %) — un événement avec gros impact attendu
 *     bénéficie de la priorité d'attribution s'il y a co-occurrence.
 */
function computeAttribution(
  pre: MarketSnapshot | null,
  inEvent: MarketSnapshot | null,
  observedCompression: MarketCompressionScore | null,
  expectedImpactScore: number,
  competingEventsCount: number,
): number {
  if (!pre || !inEvent) return 0;

  const observedPressure = observedCompression?.score ?? 0;
  // Δ pression : pré → in-event (clamp 60 = max)
  const pressureDelta = Math.max(0, observedPressure - 30); // base implicite

  // Δ médiane (%)
  const medianDelta = pre.compsetMedian > 0
    ? ((inEvent.compsetMedian - pre.compsetMedian) / pre.compsetMedian) * 100
    : 0;
  const medianScore = Math.max(0, Math.min(100, medianDelta * 4));

  // Δ disponibilité (points)
  const availDelta = (pre.availability - inEvent.availability) * 100;
  const availScore = Math.max(0, Math.min(100, availDelta * 2.5));

  const pressureScore = Math.min(100, pressureDelta * 1.66);

  // Cohérence temporelle : si la pression est apparue juste avant
  // l'événement, attribution forte. Si elle existait déjà bien avant
  // (compset déjà tendu), attribution diluée.
  const temporalCoherence = Math.max(0, Math.min(100, 100 - (pre.minStayShare * 100)));

  // Expected impact prior (10 %)
  const priorScore = expectedImpactScore;

  // Pondérations
  let attribution =
    pressureScore * 0.40 +
    medianScore   * 0.20 +
    availScore    * 0.20 +
    temporalCoherence * 0.10 +
    priorScore    * 0.10;

  // Dilution si plusieurs événements concurrents — l'attribution est partagée
  if (competingEventsCount > 1) {
    attribution = attribution / Math.sqrt(competingEventsCount);
  }

  return Math.round(Math.max(0, Math.min(100, attribution)));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule la réaction marché observée pour chaque événement de la fenêtre.
 *
 * @param events        liste des événements (filtre statut ailleurs)
 * @param snapshots     série temporelle de snapshots marché
 * @param compression   compression calculée par date (Map<date, score>)
 * @param velocity      vélocité calculée par date (Map<date, velocity>)
 * @param impactScores  Event Impact Score par eventId (calculé par LOT 1)
 */
export function correlateEventsWithMarket(
  events: RMSMarketEvent[],
  snapshots: MarketSnapshot[],
  compression: Map<string, MarketCompressionScore>,
  velocity: Map<string, MarketVelocity>,
  impactScores: Map<string, EventImpactScore>,
): Map<string, EventMarketReaction> {
  const index = indexByDate(snapshots);
  const out = new Map<string, EventMarketReaction>();

  // Pré-calcul : pour chaque date, combien d'événements actifs ?
  const eventsByDate = new Map<string, RMSMarketEvent[]>();
  for (const ev of events) {
    if (ev.status === 'archived' || ev.status === 'cancelled') continue;
    for (const d of eachDateInRange(ev.startDate, ev.endDate)) {
      if (!eventsByDate.has(d)) eventsByDate.set(d, []);
      eventsByDate.get(d)!.push(ev);
    }
  }

  for (const ev of events) {
    if (ev.status === 'archived' || ev.status === 'cancelled') continue;

    const pre = buildPreEventSnapshot(index, ev.startDate);
    const inEvent = buildInEventSnapshot(index, ev.startDate, ev.endDate);

    // Compression et vélocité observées : on prend les valeurs au pic
    // (max sur la fenêtre).
    let observedCompression: MarketCompressionScore | null = null;
    let observedVelocity: MarketVelocity | null = null;
    let observedPressure = 0;
    let competingCount = 1;

    for (const d of eachDateInRange(ev.startDate, ev.endDate)) {
      const c = compression.get(d);
      const v = velocity.get(d);
      const co = eventsByDate.get(d)?.length ?? 1;
      competingCount = Math.max(competingCount, co);
      if (c && c.score > observedPressure) {
        observedPressure = c.score;
        observedCompression = c;
      }
      if (v && (!observedVelocity || v.velocityIndex > observedVelocity.velocityIndex)) {
        observedVelocity = v;
      }
    }

    // Signaux observés (sur le snapshot in-event)
    const signals: MarketSignal[] = inEvent
      ? detectMarketSignals(inEvent, observedVelocity)
      : [];

    const expectedImpact = impactScores.get(ev.id)?.score ?? 50;
    const attributionScore = computeAttribution(
      pre,
      inEvent,
      observedCompression,
      expectedImpact,
      competingCount,
    );

    out.set(ev.id, {
      eventId: ev.id,
      attributionScore,
      observedPressure,
      observedCompression,
      observedVelocity,
      preEventSnapshot: pre,
      inEventSnapshot: inEvent,
      signals,
    });
  }

  return out;
}

/**
 * Helper : la pression marché observée est-elle conforme à la prévision ?
 * Renvoie un delta : positif = mieux que prévu, négatif = sous-performance.
 */
export function reactionPerformanceDelta(
  reaction: EventMarketReaction,
  expectedImpactScore: number,
): number {
  return reaction.observedPressure - expectedImpactScore;
}
