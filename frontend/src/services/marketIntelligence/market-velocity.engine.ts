/**
 * FLOWTYM RMS — Market Velocity Engine
 *
 * Mesure la **vitesse à laquelle le marché évolue** — la dérivée des
 * métriques marché. Indispensable pour :
 *   • détecter une compression en formation AVANT les concurrents,
 *   • alerter sur une accélération anormale du pickup,
 *   • détecter une chute brutale de la disponibilité,
 *   • alimenter le moteur de recommandations RMS.
 *
 * Pour chaque date donnée, le moteur calcule :
 *   • les deltas multi-échelles vs J-1, J-3, J-7, J-14, J-30
 *   • la vitesse d'augmentation ADR (€/jour, lissée)
 *   • la vitesse de disparition stock (points / jour)
 *   • l'accélération compression (dérivée seconde)
 *   • l'accélération pickup
 *   • un Velocity Index 0-100 synthétique pour radar / UI
 *
 * Entrées : série de `MarketSnapshot` triée chronologiquement (1/jour).
 *
 * 100 % pur, déterministe, testable.
 */

import type {
  MarketDeltaSet,
  MarketSnapshot,
  MarketVelocity,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Indexe une série de snapshots par date pour O(1) lookup.
 */
function indexByDate(snapshots: MarketSnapshot[]): Map<string, MarketSnapshot> {
  const m = new Map<string, MarketSnapshot>();
  for (const s of snapshots) m.set(s.date, s);
  return m;
}

/** Soustrait n jours à une date ISO. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Renvoie le snapshot antérieur disponible le plus proche d'une date cible. */
function nearestBefore(
  index: Map<string, MarketSnapshot>,
  target: string,
  toleranceDays = 2,
): MarketSnapshot | null {
  for (let i = 0; i <= toleranceDays; i++) {
    const t = shiftDate(target, -i);
    const s = index.get(t);
    if (s) return s;
  }
  return null;
}

/** Δ en % entre `now` et `base` (signé). Renvoie 0 si base ≤ 0. */
export function pctDelta(now: number, base: number): number {
  if (base <= 0) return 0;
  return ((now - base) / base) * 100;
}

/** Δ absolu en points (utile pour les % de disponibilité). */
export function pointsDelta(now: number, base: number): number {
  return (now - base) * 100;
}

/** Clamp 0-100. */
function clamp100(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DELTA SETS                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Construit un `MarketDeltaSet` pour une métrique extraite d'un snapshot.
 * Les deltas s'expriment en points de pourcentage (pour median = %).
 */
export function buildDeltaSet(
  index: Map<string, MarketSnapshot>,
  current: MarketSnapshot,
  selector: (s: MarketSnapshot) => number,
  mode: 'percent' | 'points' = 'percent',
): MarketDeltaSet {
  const now = selector(current);
  const compute = (offset: number): number => {
    const before = nearestBefore(index, shiftDate(current.date, offset));
    if (!before) return 0;
    const base = selector(before);
    return mode === 'percent' ? pctDelta(now, base) : pointsDelta(now, base);
  };
  return {
    d1: compute(1),
    d3: compute(3),
    d7: compute(7),
    d14: compute(14),
    d30: compute(30),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* VITESSES & ACCÉLÉRATIONS                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Vitesse moyenne d'une métrique sur la fenêtre [date - windowDays, date].
 * Renvoie une valeur par jour (€/jour pour ADR, points/jour pour dispo).
 */
function avgVelocity(
  index: Map<string, MarketSnapshot>,
  current: MarketSnapshot,
  selector: (s: MarketSnapshot) => number,
  windowDays: number,
): number {
  const before = nearestBefore(index, shiftDate(current.date, windowDays));
  if (!before) return 0;
  const span = Math.max(1, windowDays);
  return (selector(current) - selector(before)) / span;
}

/**
 * Accélération : différence des vitesses entre deux fenêtres glissantes.
 * Détecte les phénomènes "le marché s'emballe" / "le marché ralentit".
 */
function acceleration(
  index: Map<string, MarketSnapshot>,
  current: MarketSnapshot,
  selector: (s: MarketSnapshot) => number,
  fastWindow = 3,
  slowWindow = 7,
): number {
  const vFast = avgVelocity(index, current, selector, fastWindow);
  const vSlow = avgVelocity(index, current, selector, slowWindow);
  return vFast - vSlow;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* VELOCITY INDEX 0-100                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Index synthétique 0-100 — utilisé pour le radar / gauge UI.
 *
 * Pondérations :
 *   • |ADR Δ J-7|         × 0.35  (clamp 25 % = 100 pts)
 *   • |Dispo Δ J-7|       × 0.30  (clamp 40 pts = 100)
 *   • |Accel compression| × 0.20  (clamp 5 pts/j = 100)
 *   • |Accel pickup|      × 0.15  (clamp 10 res/j = 100)
 */
export function computeVelocityIndex(args: {
  adrDelta7d: number;
  availabilityDelta7d: number;
  compressionAcceleration: number;
  pickupAcceleration: number;
}): number {
  const a = Math.min(100, Math.abs(args.adrDelta7d) / 25 * 100);
  const b = Math.min(100, Math.abs(args.availabilityDelta7d) / 40 * 100);
  const c = Math.min(100, Math.abs(args.compressionAcceleration) / 5 * 100);
  const d = Math.min(100, Math.abs(args.pickupAcceleration) / 10 * 100);
  return Math.round(clamp100(a * 0.35 + b * 0.30 + c * 0.20 + d * 0.15));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Calcule la vélocité marché pour une date donnée à partir d'une série
 * de snapshots. Les snapshots peuvent être incomplets — le moteur tolère
 * jusqu'à 2 jours de gap (nearestBefore).
 *
 * @param snapshots série triée chronologiquement (1/jour idéalement)
 * @param targetDate date pour laquelle on calcule la vélocité
 */
export function computeMarketVelocity(
  snapshots: MarketSnapshot[],
  targetDate: string,
): MarketVelocity | null {
  if (snapshots.length === 0) return null;
  const index = indexByDate(snapshots);
  const current = index.get(targetDate);
  if (!current) return null;

  // Deltas multi-échelles
  const medianDelta = buildDeltaSet(index, current, (s) => s.compsetMedian, 'percent');
  const availabilityDelta = buildDeltaSet(index, current, (s) => s.availability, 'points');

  // Vitesses (lissées)
  const adrVelocity = avgVelocity(index, current, (s) => s.compsetMedian, 7);
  const inventoryDepletionVelocity = avgVelocity(
    index,
    current,
    (s) => 1 - s.availability,
    7,
  ) * 100;

  // Accélérations (fast vs slow)
  const compressionAcceleration = acceleration(
    index,
    current,
    (s) => 1 - s.availability + s.minStayShare * 0.5 + s.ctaCtdShare * 0.3,
    3,
    7,
  ) * 100;

  const pickupAcceleration = acceleration(index, current, (s) => s.pickup, 3, 7);

  const velocityIndex = computeVelocityIndex({
    adrDelta7d: medianDelta.d7,
    availabilityDelta7d: availabilityDelta.d7,
    compressionAcceleration,
    pickupAcceleration,
  });

  return {
    date: targetDate,
    adrVelocity,
    inventoryDepletionVelocity,
    compressionAcceleration,
    pickupAcceleration,
    medianDelta,
    availabilityDelta,
    velocityIndex,
  };
}

/**
 * Compute la vélocité pour toute la fenêtre [from, to] (inclus).
 * Utile pour les graphes timeline et la heatmap.
 */
export function computeVelocityWindow(
  snapshots: MarketSnapshot[],
  from: string,
  to: string,
): Map<string, MarketVelocity> {
  const out = new Map<string, MarketVelocity>();
  if (snapshots.length === 0) return out;
  const dates = enumerateDates(from, to);
  for (const d of dates) {
    const v = computeMarketVelocity(snapshots, d);
    if (v) out.set(d, v);
  }
  return out;
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const s = new Date(`${from}T00:00:00Z`);
  const e = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
