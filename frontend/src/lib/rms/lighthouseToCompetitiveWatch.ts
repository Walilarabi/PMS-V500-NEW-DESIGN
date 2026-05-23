/**
 * FLOWTYM — Adaptateur Lighthouse → Veille Concurrentielle
 *
 * Convertit un `LighthouseImport` en KPIs / agrégats utilisables directement
 * par la grille KPI de la Veille Concurrentielle. Permet à la page de
 * basculer du mock historique vers les données réellement importées sans
 * réécrire les composants en aval (fallback automatique sur le mock si
 * aucun import n'est disponible).
 *
 * Fonction pure — pas d'état React.
 */

import type { LighthouseImport } from '../../services/lighthouse-parser.service';
import type { KpiDatum } from '../../data/rms/mockCompetitiveWatchData';

interface ComputedKpis {
  averageCompset: number;
  medianCompset: number;
  ourAverage: number;
  gap: number;
  gapPct: number;
  marketPressure: number;
  cheaperHits: number;
  pricierHits: number;
  averageRankPosition: number | null;
  averageRankTotal: number | null;
  visibleDays: number;
}

/** Médiane d'un tableau numérique (ignore NaN/null). */
function median(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

function mean(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
}

/**
 * Calcule les agrégats Lighthouse sur tous les jours présents dans l'import.
 * Les jours sans `ourPrice` ou sans `compsetMedian` sont exclus.
 */
export function computeCompetitiveKpis(data: LighthouseImport): ComputedKpis {
  const days = data.days.filter((d) => d.ourPrice > 0 && d.compsetMedian > 0);
  if (days.length === 0) {
    return {
      averageCompset: 0,
      medianCompset: 0,
      ourAverage: 0,
      gap: 0,
      gapPct: 0,
      marketPressure: 0,
      cheaperHits: 0,
      pricierHits: 0,
      averageRankPosition: null,
      averageRankTotal: null,
      visibleDays: 0,
    };
  }

  // Tarif compset par jour = moyenne des prix concurrents valides
  const dailyCompsetAverage = days.map((d) => {
    const validPrices = d.competitors
      .filter((c) => c.price != null && c.status === 'available')
      .map((c) => c.price as number);
    return validPrices.length ? mean(validPrices) : d.compsetMedian;
  });

  const averageCompset = mean(dailyCompsetAverage);
  const medianCompset = mean(days.map((d) => d.compsetMedian));
  const ourAverage = mean(days.map((d) => d.ourPrice));
  const gap = ourAverage - medianCompset;
  const gapPct = medianCompset > 0 ? (gap / medianCompset) * 100 : 0;
  const marketPressure = mean(days.map((d) => d.marketDemandPercent));

  // Concurrents + chers / - chers (cumulés sur la période)
  let cheaperHits = 0;
  let pricierHits = 0;
  for (const d of days) {
    for (const c of d.competitors) {
      if (c.price == null || c.status !== 'available') continue;
      if (c.price > d.ourPrice) pricierHits++;
      else if (c.price < d.ourPrice) cheaperHits++;
    }
  }

  // Rang moyen
  const rankPositions = days
    .map((d) => d.rankPosition)
    .filter((v): v is number => v != null);
  const rankTotals = days
    .map((d) => d.rankTotal)
    .filter((v): v is number => v != null);

  return {
    averageCompset,
    medianCompset,
    ourAverage,
    gap,
    gapPct,
    marketPressure,
    cheaperHits,
    pricierHits,
    averageRankPosition: rankPositions.length ? mean(rankPositions) : null,
    averageRankTotal: rankTotals.length ? mean(rankTotals) : null,
    visibleDays: days.length,
  };
}

function fmtEUR(n: number): string {
  return `${Math.round(n)}€`;
}

function fmtSignedEUR(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r}€` : `${r}€`;
}

function fmtSignedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function gapTone(gap: number): KpiDatum['tone'] {
  if (gap < -3) return 'red';
  if (gap > 3) return 'green';
  return 'slate';
}

function positionLabel(rank: number | null, total: number | null): {
  value: string;
  sub: string;
  tone: KpiDatum['tone'];
} {
  if (rank == null || total == null || total === 0) {
    return { value: 'N/D', sub: 'sans ranking', tone: 'slate' };
  }
  const ratio = rank / total;
  let label = 'Milieu de marché';
  let tone: KpiDatum['tone'] = 'slate';
  if (ratio <= 0.25) {
    label = 'Haut de marché';
    tone = 'violet';
  } else if (ratio <= 0.5) {
    label = 'Milieu haut';
    tone = 'blue';
  } else if (ratio <= 0.75) {
    label = 'Milieu bas';
    tone = 'slate';
  } else {
    label = 'Bas de marché';
    tone = 'red';
  }
  return {
    value: label,
    sub: `#${Math.round(rank)} / ${Math.round(total)} en moyenne`,
    tone,
  };
}

/**
 * Produit les 8 cartes KPI de la Veille à partir d'un import Lighthouse réel.
 * Garde exactement la même structure et les mêmes IDs que le mock, pour que
 * `MarketKpiGrid` les consomme sans modification.
 */
export function buildCompetitiveKpiCards(data: LighthouseImport): KpiDatum[] {
  const k = computeCompetitiveKpis(data);
  const pos = positionLabel(k.averageRankPosition, k.averageRankTotal);

  return [
    {
      id: 'tarif-moyen',
      label: 'Tarif moyen compset',
      value: fmtEUR(k.averageCompset),
      sub: `moyenne sur ${k.visibleDays} jour(s)`,
      tone: 'slate',
      icon: 'tag',
    },
    {
      id: 'tarif-median',
      label: 'Tarif médian',
      value: fmtEUR(k.medianCompset),
      sub: 'médiane compset',
      tone: 'violet',
      icon: 'trending-up',
    },
    {
      id: 'notre-tarif',
      label: 'Notre tarif moyen',
      value: fmtEUR(k.ourAverage),
      sub: data.ourHotelName,
      tone: 'blue',
      icon: 'building',
    },
    {
      id: 'ecart',
      label: 'Écart vs médiane',
      value: fmtSignedEUR(k.gap),
      sub: fmtSignedPct(k.gapPct),
      tone: gapTone(k.gap),
      icon: k.gap >= 0 ? 'trending-up' : 'trending-down',
    },
    {
      id: 'pression',
      label: 'Pression marché',
      value: `${Math.round(k.marketPressure)}%`,
      sub: 'demande moyenne',
      tone: k.marketPressure >= 75 ? 'red' : k.marketPressure >= 50 ? 'violet' : 'slate',
      icon: 'gauge',
    },
    {
      id: 'conc-plus',
      label: 'Concurrents + chers',
      value: String(k.pricierHits),
      sub: 'cumulé période',
      tone: 'green',
      icon: 'users',
    },
    {
      id: 'conc-moins',
      label: 'Concurrents - chers',
      value: String(k.cheaperHits),
      sub: 'cumulé période',
      tone: 'red',
      icon: 'users',
    },
    {
      id: 'position',
      label: 'Positionnement',
      value: pos.value,
      sub: pos.sub,
      tone: pos.tone,
      icon: 'award',
    },
  ];
}
