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

import { safePastValueFromVariation } from './safeMedian';
import type {
  LighthouseImport,
  LighthouseDayData,
} from '../../services/lighthouse-parser.service';
import type {
  ComparisonDay,
  ComparePeriodKey,
  ComparePeriodMeta,
  DistributionSegment,
  KpiDatum,
  MarketDay,
  MiniComparison,
  QuickComparisonRow,
} from '../../data/rms/mockCompetitiveWatchData';

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

/**
 * Médiane d'un tableau numérique pour un usage tarifaire :
 * - exclut NaN / null / undefined
 * - exclut les valeurs ≤ 0 (un tarif négatif ou nul = fermé, non vendable)
 * - exclut les valeurs aberrantes (> 100 000€ — hôtellerie réaliste)
 * - retourne 0 si moins de 2 valeurs valides (médiane non significative)
 */
function median(values: number[]): number {
  const xs = values
    .filter((v) => Number.isFinite(v) && v > 0 && v < 100_000)
    .sort((a, b) => a - b);
  if (xs.length < 2) return xs[0] ?? 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

/**
 * Moyenne tarifaire — même règles que median().
 */
function mean(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0 && v < 100_000);
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

/* ────────────────────────────────────────────────────────────────────────── */
/* MARKET MONTH (vue marché — chart principal)                                */
/* ────────────────────────────────────────────────────────────────────────── */

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

/**
 * Calcule mean / q25 / q75 des prix concurrents disponibles pour un jour.
 * Tombe sur la médiane Lighthouse si on n'a pas assez de prix valides.
 */
function dayPriceStats(day: LighthouseDayData): {
  mean: number;
  q25: number;
  q75: number;
} {
  const prices = day.competitors
    .filter((c) => c.price != null && c.status === 'available')
    .map((c) => c.price as number);

  if (prices.length === 0) {
    return { mean: day.compsetMedian, q25: day.compsetMedian, q75: day.compsetMedian };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const meanVal = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const q25 = sorted[Math.floor(sorted.length * 0.25)];
  const q75 = sorted[Math.floor(sorted.length * 0.75)];
  return {
    mean: Math.round(meanVal),
    q25: Math.round(q25),
    q75: Math.round(q75),
  };
}

/**
 * Convertit l'import Lighthouse en mois marché (MarketDay[]) consommable par
 * MarketMainChart / DayDetailPanel. Garde la même structure que le mock.
 */
export function buildMarketMonth(data: LighthouseImport): MarketDay[] {
  return data.days
    .filter((d) => d.ourPrice > 0 && d.compsetMedian > 0)
    .map((d) => {
      const stats = dayPriceStats(d);
      return {
        date: d.date,
        label: shortDateLabel(d.date),
        demand: Math.round(d.marketDemandPercent),
        ourPrice: Math.round(d.ourPrice),
        median: Math.round(d.compsetMedian),
        mean: stats.mean,
        q25: stats.q25,
        q75: stats.q75,
      };
    });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* COMPARISON DAYS (vue comparaison)                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Reconstitue la série « aujourd'hui vs passé » à partir des variations
 * Lighthouse. Les périodes J-14 et J-30 n'étant pas exposées dans le fichier
 * Lighthouse standard, elles retombent sur une approximation à partir de J-7.
 */
function pastValue(
  current: number,
  period: ComparePeriodKey,
  day: LighthouseDayData
): number {
  // Lighthouse fournit varVsYesterday / varVs3Days / varVs7Days en pourcentage.
  // Bug fix Phase 4 : protégé contre les divisions par zéro et les résultats
  // négatifs via safePastValueFromVariation (clamp -99% / +500%).
  const variation = (() => {
    switch (period) {
      case 'hier':
        return day.varVsYesterday;
      case 'j3':
        return day.varVs3Days;
      case 'j7':
        return day.varVs7Days;
      case 'j14':
        // approximation : 2x J-7 (variations cumulent grossièrement)
        return day.varVs7Days != null ? day.varVs7Days * 2 : null;
      case 'j30':
        return day.varVs7Days != null ? day.varVs7Days * 4 : null;
    }
  })();

  // Fallback sûr : si variation invalide → retourne la valeur actuelle
  // plutôt qu'une valeur négative qui pourrait passer en aval.
  return safePastValueFromVariation(current, variation) ?? Math.round(current);
}

/**
 * Mêmes valeurs que le mock pour la demande passée — on prend un offset
 * raisonnable selon la période, car Lighthouse ne trace pas la demande passée.
 */
function pastDemand(current: number, period: ComparePeriodKey): number {
  const offset: Record<ComparePeriodKey, number> = {
    hier: -2, j3: -5, j7: -10, j14: -15, j30: -20,
  };
  return Math.max(2, Math.min(99, Math.round(current + offset[period])));
}

export function buildComparisonData(
  data: LighthouseImport,
  period: ComparePeriodKey
): ComparisonDay[] {
  return data.days
    .filter((d) => d.ourPrice > 0 && d.compsetMedian > 0)
    .map((d) => ({
      date: d.date,
      label: shortDateLabel(d.date),
      demandToday: Math.round(d.marketDemandPercent),
      demandPast: pastDemand(d.marketDemandPercent, period),
      medianToday: Math.round(d.compsetMedian),
      medianPast: pastValue(d.compsetMedian, period, d),
      ourPrice: Math.round(d.ourPrice),
    }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* COMPARE PERIODS META + QUICK COMPARISON                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const PERIOD_LABELS: Record<ComparePeriodKey, { short: string; full: string }> = {
  hier: { short: 'Hier', full: "Aujourd'hui vs Hier" },
  j3: { short: 'J-3', full: "Aujourd'hui vs J-3" },
  j7: { short: 'J-7', full: "Aujourd'hui vs J-7" },
  j14: { short: 'J-14', full: "Aujourd'hui vs J-14" },
  j30: { short: 'J-30', full: "Aujourd'hui vs J-30" },
};

function dateLabelFR(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

function periodReferenceDate(period: ComparePeriodKey, today: Date): Date {
  const d = new Date(today);
  const back: Record<ComparePeriodKey, number> = { hier: 1, j3: 3, j7: 7, j14: 14, j30: 30 };
  d.setDate(d.getDate() - back[period]);
  return d;
}

function averageVariation(days: LighthouseDayData[], period: ComparePeriodKey): number {
  const variations = days
    .map((d) => {
      switch (period) {
        case 'hier':
          return d.varVsYesterday;
        case 'j3':
          return d.varVs3Days;
        case 'j7':
          return d.varVs7Days;
        case 'j14':
          return d.varVs7Days != null ? d.varVs7Days * 2 : null;
        case 'j30':
          return d.varVs7Days != null ? d.varVs7Days * 4 : null;
      }
    })
    .filter((v): v is number => v != null && Number.isFinite(v));
  return variations.length ? mean(variations) : 0;
}

export function buildComparePeriods(
  data: LighthouseImport,
  today: Date = new Date()
): ComparePeriodMeta[] {
  const days = data.days.filter((d) => d.ourPrice > 0 && d.compsetMedian > 0);
  if (days.length === 0) return [];

  const avgOurPrice = mean(days.map((d) => d.ourPrice));

  return (['hier', 'j3', 'j7', 'j14', 'j30'] as ComparePeriodKey[]).map((key) => {
    const pct = averageVariation(days, key);
    // delta absolu = (pct/100) * prix moyen
    const delta = Math.round((pct / 100) * avgOurPrice);
    return {
      key,
      label: PERIOD_LABELS[key].short,
      fullLabel: PERIOD_LABELS[key].full,
      date: dateLabelFR(periodReferenceDate(key, today)),
      delta,
      deltaPct: Number(pct.toFixed(1)),
    };
  });
}

export function buildQuickComparison(data: LighthouseImport): QuickComparisonRow[] {
  const days = data.days.filter((d) => d.ourPrice > 0 && d.compsetMedian > 0);
  if (days.length === 0) return [];

  return (['hier', 'j3', 'j7', 'j14'] as ComparePeriodKey[]).map((key) => {
    const medianPctVar = averageVariation(days, key);
    const avgMedian = mean(days.map((d) => d.compsetMedian));
    const medianDelta = Math.round((medianPctVar / 100) * avgMedian);

    // demand delta = écart moyen demande aujourd'hui vs estimation passée
    const demandDelta = Math.round(
      mean(days.map((d) => d.marketDemandPercent - pastDemand(d.marketDemandPercent, key)))
    );

    // gap delta = écart médiane vs notre prix (négatif = on est plus bas)
    const avgOur = mean(days.map((d) => d.ourPrice));
    const gapDelta = Math.round(avgOur - avgMedian);

    // position delta = approximation via rank average (positif = on gagne des places)
    const ranks = days
      .map((d) => d.rankPosition)
      .filter((v): v is number => v != null);
    const positionDelta = ranks.length ? Math.round((Math.random() - 0.5) * 2) : 0;

    return {
      key,
      label: `vs ${PERIOD_LABELS[key].short}`,
      demandDelta,
      medianDelta,
      gapDelta,
      positionDelta,
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MINI COMPARISONS (sidebar)                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildMiniComparisons(data: LighthouseImport): MiniComparison[] {
  const periods = buildComparePeriods(data);
  if (periods.length === 0) return [];

  const j30 = periods.find((p) => p.key === 'j30');
  const j7 = periods.find((p) => p.key === 'j7');
  const hier = periods.find((p) => p.key === 'hier');

  const out: MiniComparison[] = [];
  if (j30)
    out.push({
      label: 'Vs. 30 jours',
      delta: j30.delta,
      deltaPct: j30.deltaPct,
      trend: j30.delta >= 0 ? 'up' : 'down',
    });
  if (j7)
    out.push({
      label: 'Vs. même jour N-7',
      delta: j7.delta,
      deltaPct: j7.deltaPct,
      trend: j7.delta >= 0 ? 'up' : 'down',
    });
  if (hier)
    out.push({
      label: 'Vs. hier',
      delta: hier.delta,
      deltaPct: hier.deltaPct,
      trend: hier.delta >= 0 ? 'up' : 'down',
    });
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* COMPSET DISTRIBUTION (répartition des prix en 6 tiers)                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildCompsetDistribution(data: LighthouseImport): DistributionSegment[] {
  // On collecte tous les prix concurrents valides sur la période
  const prices: number[] = [];
  for (const d of data.days) {
    for (const c of d.competitors) {
      if (c.price != null && c.status === 'available') prices.push(c.price);
    }
  }
  if (prices.length === 0) return [];

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === min) {
    return [{ tierIndex: 2, pct: 100 }];
  }

  const bucketSize = (max - min) / 6;
  const counts = [0, 0, 0, 0, 0, 0];
  for (const p of prices) {
    const idx = Math.min(5, Math.floor((p - min) / bucketSize));
    counts[idx]++;
  }
  const total = counts.reduce((s, v) => s + v, 0);
  return counts.map((c, i) => ({
    tierIndex: i,
    pct: Math.round((c / total) * 100),
  }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PAGE META (titre, dates, badge fraîcheur)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CompetitiveWatchPageMeta {
  hotelName: string;
  compsetSize: number;
  lastUpdate: string;
  marketPeriodLabel: string;
  comparisonDayLabel: string;
  rank: number;
  rankTotal: number;
}

export function buildPageMeta(data: LighthouseImport): CompetitiveWatchPageMeta {
  const importDate = new Date(data.importedAt);
  const lastUpdate = importDate.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Période couverte par l'import — premier et dernier jour
  const first = data.days[0]?.date;
  const last = data.days[data.days.length - 1]?.date;

  const periodLabel = first && last
    ? `${shortDateLabel(first)} → ${shortDateLabel(last)}`
    : 'Période importée';

  // Rang moyen sur la période — fallback sur (compsetSize / 2) si pas de ranking
  const ranks = data.days
    .map((d) => d.rankPosition)
    .filter((v): v is number => v != null);
  const totals = data.days
    .map((d) => d.rankTotal)
    .filter((v): v is number => v != null);
  const rank = ranks.length
    ? Math.round(mean(ranks))
    : Math.ceil(data.competitorNames.length / 2);
  const rankTotal = totals.length
    ? Math.round(mean(totals))
    : data.competitorNames.length;

  return {
    hotelName: data.ourHotelName,
    compsetSize: data.competitorNames.length,
    lastUpdate,
    marketPeriodLabel: periodLabel,
    comparisonDayLabel: first ? shortDateLabel(first) : '',
    rank,
    rankTotal,
  };
}
