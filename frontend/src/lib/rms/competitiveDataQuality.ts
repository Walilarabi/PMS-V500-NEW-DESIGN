/**
 * FLOWTYM RMS — Contrôle qualité des données Veille
 *
 * Avant qu'une donnée Lighthouse / Expedia n'alimente le graphique, on filtre :
 *   - doublons (même date pour le même hôtel)
 *   - dates invalides
 *   - prix non numériques (texte "Épuisé", "MinStay 2", etc.)
 *   - valeurs aberrantes (outliers IQR sur ourPrice et medianCompset)
 *   - lignes incohérentes (prix négatifs, dates hors période, etc.)
 *
 * Fonctions pures. Aucun side-effect. Aucune dépendance UI.
 */

import type {
  LighthouseDayData,
  LighthouseImport,
} from '../../services/lighthouse-parser.service';

export type ExclusionReason =
  | 'duplicate'
  | 'invalid-date'
  | 'invalid-price'
  | 'out-of-window'
  | 'outlier'
  | 'low-confidence';

export interface Exclusion {
  date: string;
  reason: ExclusionReason;
  detail?: string;
}

export interface QualityReport {
  /** Jours retenus dans la fenêtre, après dédup + validation + outlier. */
  keptDays: LighthouseDayData[];
  /** Détail des exclusions (utile pour le bandeau de traçabilité). */
  exclusions: Exclusion[];
  totalBefore: number;
  totalAfter: number;
}

const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  duplicate: 'Doublon de date',
  'invalid-date': 'Date invalide',
  'invalid-price': 'Prix non numérique',
  'out-of-window': 'Hors période sélectionnée',
  outlier: 'Valeur aberrante',
  'low-confidence': 'Score concurrent insuffisant',
};

export function describeExclusion(reason: ExclusionReason): string {
  return EXCLUSION_LABEL[reason];
}

/* ───────────────────────────────────────────────────────────────────────── */
/* DATE                                                                       */
/* ───────────────────────────────────────────────────────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* ───────────────────────────────────────────────────────────────────────── */
/* OUTLIERS                                                                   */
/* ───────────────────────────────────────────────────────────────────────── */

function quartile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx];
}

/**
 * IQR avec facteur 3 — conservateur. Évite de couper des jours légitimes
 * lors d'événements (Salon de l'auto, JO, etc.) qui font naturellement
 * exploser les prix.
 */
function detectOutliersIQR(values: number[], factor = 3): Set<number> {
  if (values.length < 8) return new Set();
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quartile(sorted, 0.25);
  const q3 = quartile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return new Set();
  const lo = q1 - iqr * factor;
  const hi = q3 + iqr * factor;
  const out = new Set<number>();
  for (const v of values) {
    if (v < lo || v > hi) out.add(v);
  }
  return out;
}

/* ───────────────────────────────────────────────────────────────────────── */
/* QUALITY GATE                                                               */
/* ───────────────────────────────────────────────────────────────────────── */

export interface QualityGateOptions {
  /** Fenêtre temporelle inclusive. Tout jour hors fenêtre est exclu. */
  window: { start: string; end: string };
  /** Active le filtre outliers (par défaut true). */
  filterOutliers?: boolean;
}

/**
 * Filtre et nettoie les jours Lighthouse pour la fenêtre demandée.
 * Garantit qu'aucune donnée hors période n'arrive au composant graphique.
 */
export function applyQualityGate(
  data: LighthouseImport,
  options: QualityGateOptions
): QualityReport {
  const exclusions: Exclusion[] = [];
  const { start, end } = options.window;
  const seen = new Set<string>();
  const valid: LighthouseDayData[] = [];

  for (const day of data.days) {
    // 1) Date valide
    if (!day.date || !isValidISODate(day.date)) {
      exclusions.push({
        date: day.date ?? '(vide)',
        reason: 'invalid-date',
      });
      continue;
    }

    // 2) Fenêtre temporelle
    if (day.date < start || day.date > end) {
      // On ne logue pas chaque jour hors fenêtre dans `exclusions` détaillées
      // (sinon c'est 350+ lignes) — on les compte agrégés en fin de fonction.
      exclusions.push({
        date: day.date,
        reason: 'out-of-window',
      });
      continue;
    }

    // 3) Doublon
    if (seen.has(day.date)) {
      exclusions.push({ date: day.date, reason: 'duplicate' });
      continue;
    }
    seen.add(day.date);

    // 4) Prix valides
    if (
      !Number.isFinite(day.ourPrice) ||
      day.ourPrice <= 0 ||
      !Number.isFinite(day.compsetMedian) ||
      day.compsetMedian <= 0
    ) {
      exclusions.push({
        date: day.date,
        reason: 'invalid-price',
        detail: `our=${day.ourPrice} median=${day.compsetMedian}`,
      });
      continue;
    }

    valid.push(day);
  }

  // 5) Outliers (sur la fenêtre nettoyée)
  let kept = valid;
  if (options.filterOutliers !== false && valid.length >= 8) {
    const ourPrices = valid.map((d) => d.ourPrice);
    const medians = valid.map((d) => d.compsetMedian);
    const ourOutliers = detectOutliersIQR(ourPrices);
    const medOutliers = detectOutliersIQR(medians);

    kept = valid.filter((d) => {
      if (ourOutliers.has(d.ourPrice) || medOutliers.has(d.compsetMedian)) {
        exclusions.push({
          date: d.date,
          reason: 'outlier',
          detail: `our=${d.ourPrice} median=${d.compsetMedian}`,
        });
        return false;
      }
      return true;
    });
  }

  return {
    keptDays: kept,
    exclusions,
    totalBefore: data.days.length,
    totalAfter: kept.length,
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/* SUMMARY                                                                    */
/* ───────────────────────────────────────────────────────────────────────── */

/**
 * Agrège les exclusions par raison — utile pour afficher en clair dans
 * le bandeau de traçabilité ("12 doublons, 3 outliers, 280 hors période").
 */
export function summarizeExclusions(
  exclusions: Exclusion[]
): Array<{ reason: ExclusionReason; count: number; label: string }> {
  const counts = new Map<ExclusionReason, number>();
  for (const e of exclusions) {
    counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      label: EXCLUSION_LABEL[reason],
    }))
    .sort((a, b) => b.count - a.count);
}
