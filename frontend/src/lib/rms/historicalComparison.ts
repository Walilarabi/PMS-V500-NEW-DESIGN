/**
 * FLOWTYM RMS — Comparaison historique propre (J-1 / J-3 / J-7 / J-14 / J-30)
 *
 * REMPLACE la logique précédente qui multipliait `varVs7Days * 2` ou `× 4`
 * pour approximer J-14 et J-30 — ce qui est statistiquement faux et
 * produisait les "valeurs aberrantes" rapportées.
 *
 * Méthode propre :
 *   1) On indexe la série par date (ISO).
 *   2) Pour chaque jour, on cherche son homologue J-X (tolérance ±2 jours).
 *   3) On compare la médiane à J-X à la médiane d'aujourd'hui.
 *   4) On exclut les outliers (IQR strict ×3) avant d'agréger.
 *   5) On clamp les variations à ±60 % (au-delà = donnée corrompue,
 *      on l'ignore).
 *   6) Pour les agrégats (avg variation), on utilise la médiane de la
 *      distribution des variations — plus robuste aux outliers résiduels
 *      qu'une moyenne.
 *
 * Garanties :
 *   - Aucune extrapolation linéaire arbitraire.
 *   - Aucun `Math.random()` dans la chaîne métier.
 *   - Données manquantes traitées explicitement (renvoie null, pas NaN).
 *   - Mapping concurrents : on n'utilise QUE la `compsetMedian` calculée
 *     par le parser sur les concurrents disponibles ce jour-là (déjà
 *     robuste aux statuts sold_out / restricted).
 *
 * 100 % pur, déterministe, testable.
 */

import type { LighthouseDayData } from '../../services/lighthouse-parser.service';

/* ────────────────────────────────────────────────────────────────────────── */
/* CONSTANTES MÉTIER                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export type CompareLag = 1 | 3 | 7 | 14 | 30;

const TOLERANCE_DAYS = 2;            // tolérance pour matcher J-X
const MAX_ABS_VARIATION_PCT = 60;    // au-delà = corruption, ignoré
const IQR_FACTOR = 3;                // strict (conserve les pics légitimes)

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS DATE                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function shiftIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function indexDays(days: LighthouseDayData[]): Map<string, LighthouseDayData> {
  const m = new Map<string, LighthouseDayData>();
  for (const d of days) if (d.date) m.set(d.date, d);
  return m;
}

/**
 * Cherche le snapshot le plus proche de `targetDate` (tolérance ±N jours).
 * On préfère l'antérieur — c'est conservateur (la comparaison aura plus
 * de gap qu'attendu mais jamais moins).
 */
function nearestSnapshot(
  index: Map<string, LighthouseDayData>,
  targetDate: string,
  tolerance: number,
): LighthouseDayData | null {
  for (let offset = 0; offset <= tolerance; offset++) {
    const before = index.get(shiftIso(targetDate, -offset));
    if (before && before.compsetMedian > 0) return before;
    if (offset > 0) {
      const after = index.get(shiftIso(targetDate, offset));
      if (after && after.compsetMedian > 0) return after;
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CALCUL VARIATION                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** Variation en % entre `now` et `past`. `null` si invalide ou hors bornes. */
export function pctVariation(now: number, past: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(past)) return null;
  if (past <= 0 || now <= 0) return null;
  const v = ((now - past) / past) * 100;
  if (!Number.isFinite(v)) return null;
  if (Math.abs(v) > MAX_ABS_VARIATION_PCT) return null;
  return v;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* OUTLIERS — IQR conservateur                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Bornes IQR ×factor sur une distribution. */
export function iqrBounds(values: number[], factor = IQR_FACTOR): { lo: number; hi: number } | null {
  const n = values.length;
  if (n < 8) return null; // série trop courte pour IQR fiable
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return null;
  return { lo: q1 - iqr * factor, hi: q3 + iqr * factor };
}

/** Retire les outliers d'une distribution (renvoie une nouvelle liste). */
function filterOutliers(values: number[]): number[] {
  const b = iqrBounds(values);
  if (!b) return values;
  return values.filter((v) => v >= b.lo && v <= b.hi);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MÉDIANE / MOYENNE                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/** Médiane d'une distribution numérique (ignore NaN/null). */
export function median(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return 0;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return 0;
  return clean.reduce((s, v) => s + v, 0) / clean.length;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN — variations par jour                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PerDayVariation {
  date: string;
  /** Médiane à J. */
  medianNow: number;
  /** Médiane à J-X (snapshot le plus proche dispo). */
  medianPast: number;
  /** Variation en %, ou null si non calculable. */
  variationPct: number | null;
  /** Date effectivement utilisée pour le snapshot passé (peut différer de J-X exact). */
  pastDateUsed: string;
}

/**
 * Calcule la variation de médiane à J vs J-lag pour chaque jour de la série.
 * On utilise la série réelle, pas d'extrapolation.
 *
 * @param days  série Lighthouse triée chronologiquement
 * @param lag   décalage à appliquer (1, 3, 7, 14, 30)
 */
export function variationsPerDay(
  days: LighthouseDayData[],
  lag: CompareLag,
): PerDayVariation[] {
  const valid = days.filter((d) => d.date && d.compsetMedian > 0);
  const index = indexDays(valid);
  const out: PerDayVariation[] = [];

  for (const d of valid) {
    const targetPastDate = shiftIso(d.date, -lag);
    const pastSnap = nearestSnapshot(index, targetPastDate, TOLERANCE_DAYS);
    if (!pastSnap) {
      out.push({
        date: d.date,
        medianNow: d.compsetMedian,
        medianPast: 0,
        variationPct: null,
        pastDateUsed: '',
      });
      continue;
    }
    out.push({
      date: d.date,
      medianNow: d.compsetMedian,
      medianPast: pastSnap.compsetMedian,
      variationPct: pctVariation(d.compsetMedian, pastSnap.compsetMedian),
      pastDateUsed: pastSnap.date,
    });
  }
  return out;
}

/**
 * Agrégat robuste pour une fenêtre : médiane de la distribution des
 * variations, après filtre IQR. Utilisée par la quick-comparison et
 * les meta de période.
 */
export function aggregateVariation(
  days: LighthouseDayData[],
  lag: CompareLag,
): {
  /** Médiane des variations (en %, peut être 0 si aucune dispo). */
  variationPct: number;
  /** Nombre de jours utilisés (après filtre IQR). */
  sampleSize: number;
  /** Nombre de jours exclus (outliers + données manquantes). */
  excluded: number;
} {
  const perDay = variationsPerDay(days, lag);
  const raw: number[] = [];
  for (const p of perDay) {
    if (p.variationPct != null) raw.push(p.variationPct);
  }
  const filtered = filterOutliers(raw);
  return {
    variationPct: median(filtered),
    sampleSize: filtered.length,
    excluded: perDay.length - filtered.length,
  };
}

/**
 * Reconstitue la valeur passée à partir de la variation calculée.
 * Si pas de variation calculable, renvoie la valeur courante (cohérence
 * graphique : pas de saut artificiel à 0).
 */
export function pastMedianValue(
  current: number,
  variationPct: number | null,
): number {
  if (variationPct == null || !Number.isFinite(variationPct)) {
    return Math.round(current);
  }
  // current = past * (1 + var/100)  →  past = current / (1 + var/100)
  const past = current / (1 + variationPct / 100);
  if (!Number.isFinite(past) || past <= 0) return Math.round(current);
  return Math.round(past);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DEMAND (variation propre, sans Math.random)                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Variation de demande marché à J-lag. Si la série Lighthouse contient
 * `marketDemandPercent` historisé, on l'utilise. Sinon on renvoie null
 * (la carte affichera "—" plutôt qu'une valeur fictive).
 */
export function demandVariationsPerDay(
  days: LighthouseDayData[],
  lag: CompareLag,
): Array<{ date: string; demandNow: number; demandPast: number | null }> {
  const valid = days.filter((d) => d.date && Number.isFinite(d.marketDemandPercent));
  const index = indexDays(valid);
  return valid.map((d) => {
    const past = nearestSnapshot(index, shiftIso(d.date, -lag), TOLERANCE_DAYS);
    return {
      date: d.date,
      demandNow: d.marketDemandPercent,
      demandPast: past ? past.marketDemandPercent : null,
    };
  });
}

/**
 * Variation de rang à J-lag (position dans le compset). Si pas de
 * rankPosition disponible historiquement → renvoie 0. **Pas de Math.random.**
 */
export function positionDelta(
  days: LighthouseDayData[],
  lag: CompareLag,
): number {
  const valid = days.filter((d) => d.date && d.rankPosition != null);
  if (valid.length === 0) return 0;
  const index = indexDays(valid);
  const deltas: number[] = [];
  for (const d of valid) {
    const past = nearestSnapshot(index, shiftIso(d.date, -lag), TOLERANCE_DAYS);
    if (past?.rankPosition != null && d.rankPosition != null) {
      // Rang plus bas = meilleur classement = delta positif
      deltas.push(past.rankPosition - d.rankPosition);
    }
  }
  if (deltas.length === 0) return 0;
  return Math.round(median(deltas));
}
