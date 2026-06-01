/**
 * FLOWTYM RMS — Données mock Veille Concurrentielle.
 *
 * Reproduit fidèlement les valeurs des maquettes de référence :
 *   - Vue marché (juin 2026) — « Écart des tarifs »
 *   - Vue comparaison dynamique — « Aujourd'hui vs Hier / J-3 / J-7 / J-14 / J-30 »
 *
 * Hôtel de référence : Folkestone Opéra · Compset : 10 concurrents.
 */

import { isDateVisible } from '../../lib/rms/monthRange';

// ─── Types ──────────────────────────────────────────────────────────────────

export type KpiTone = 'slate' | 'violet' | 'blue' | 'red' | 'green';

export interface KpiDatum {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: KpiTone;
  icon: 'tag' | 'trending-up' | 'building' | 'trending-down' | 'gauge' | 'users' | 'award';
}

/** Statut tarifaire d'un jour — visible dans le tooltip et la barre de légende. */
export type MarketDayStatus =
  | 'ok'               // données complètes
  | 'sold_out'         // marché épuisé (tous concurrents sold_out)
  | 'restricted'       // restrictions LOS / CTA / etc. (aucun tarif exploitable)
  | 'no_pricing'       // notre hôtel sans tarif mais compset OK
  | 'insufficient_data'; // données insuffisantes pour calculer la médiane

export interface MarketDay {
  date: string;        // ISO
  label: string;       // « 16 juin »
  demand: number;      // 0-100 (toujours présent si Lighthouse le fournit)
  /** null quand notre hôtel est épuisé / sans tarif exploitable */
  ourPrice: number | null;
  /** null quand la médiane compset ne peut pas être calculée */
  median: number | null;
  mean: number | null;
  q25: number | null;
  q75: number | null;
  /** Statut tarifaire du jour — détermine l'affichage visuel. */
  marketStatus?: MarketDayStatus;
  /** Nombre de concurrents avec tarif disponible. */
  availableCount?: number;
  /** Nombre de concurrents épuisés. */
  soldOutCount?: number;
  /** Nombre de concurrents avec restriction (LOS, CTA, etc.). */
  restrictedCount?: number;
}

export interface ComparisonDay {
  date: string;
  label: string;       // « 18 juin »
  demandToday: number;
  demandPast: number;
  medianToday: number;
  medianPast: number;
  ourPrice: number;
}

export type ComparePeriodKey = 'hier' | 'j3' | 'j7' | 'j14' | 'j30';

export interface ComparePeriodMeta {
  key: ComparePeriodKey;
  label: string;       // « Hier », « J-3 »
  fullLabel: string;   // « Aujourd'hui vs Hier »
  date: string;        // « 31 mai 2026 »
  delta: number;       // écart tarif (€)
  deltaPct: number;    // %
}

export interface DistributionSegment {
  tierIndex: number;   // 0..5 → DEMAND_BANDS
  pct: number;
}

export interface QuickComparisonRow {
  key: ComparePeriodKey;
  label: string;
  demandDelta: number; // points de %
  medianDelta: number; // €
  gapDelta: number;    // €
  positionDelta: number; // places
}

// ─── KPI cards (identiques sur les 2 vues) ──────────────────────────────────

export const KPI_CARDS: KpiDatum[] = [
  { id: 'tarif-moyen', label: 'Tarif moyen compset', value: '354€', sub: 'moyenne 10 concurrents', tone: 'slate', icon: 'tag' },
  { id: 'tarif-median', label: 'Tarif médian', value: '340€', sub: 'médiane compset', tone: 'violet', icon: 'trending-up' },
  { id: 'notre-tarif', label: 'Notre tarif moyen', value: '326€', sub: 'Folkestone Opéra', tone: 'blue', icon: 'building' },
  { id: 'ecart', label: 'Écart vs médiane', value: '-14€', sub: '-4.1%', tone: 'red', icon: 'trending-down' },
  { id: 'pression', label: 'Pression marché', value: '87%', sub: 'demande moyenne', tone: 'red', icon: 'gauge' },
  { id: 'conc-plus', label: 'Concurrents + chers', value: '147', sub: 'cumulé période', tone: 'green', icon: 'users' },
  { id: 'conc-moins', label: 'Concurrents - chers', value: '83', sub: 'cumulé période', tone: 'red', icon: 'users' },
  { id: 'position', label: 'Positionnement', value: 'Bas de marché', sub: '#7 / 10 en moyenne', tone: 'violet', icon: 'award' },
];

// ─── Filtres Lighthouse ─────────────────────────────────────────────────────

export interface FilterDef {
  id: string;
  icon: 'tag' | 'booking' | 'globe' | 'moon' | 'user' | 'bed' | 'utensils' | 'compset';
  value: string;
}

export const LIGHTHOUSE_FILTERS: FilterDef[] = [
  { id: 'rate', icon: 'tag', value: 'Le plus bas' },
  { id: 'channel', icon: 'booking', value: 'Booking.com' },
  { id: 'device', icon: 'globe', value: 'Web' },
  { id: 'los', icon: 'moon', value: '1 nuit' },
  { id: 'pax', icon: 'user', value: 'pax' },
  { id: 'room', icon: 'bed', value: 'Tout type de chambre' },
  { id: 'board', icon: 'utensils', value: 'Toute pension' },
  { id: 'compset', icon: 'compset', value: 'Compset principal' },
];

// ─── Vue marché — juin 2026 (28 jours) ──────────────────────────────────────

export const MARKET_MONTH: MarketDay[] = [
  { date: '2026-06-01', label: '1 juin', demand: 24, ourPrice: 295, median: 268, mean: 278, q25: 240, q75: 295 },
  { date: '2026-06-02', label: '2 juin', demand: 28, ourPrice: 292, median: 272, mean: 282, q25: 244, q75: 300 },
  { date: '2026-06-03', label: '3 juin', demand: 22, ourPrice: 300, median: 285, mean: 292, q25: 250, q75: 312 },
  { date: '2026-06-04', label: '4 juin', demand: 19, ourPrice: 290, median: 278, mean: 286, q25: 246, q75: 305 },
  { date: '2026-06-05', label: '5 juin', demand: 26, ourPrice: 296, median: 282, mean: 290, q25: 250, q75: 308 },
  { date: '2026-06-06', label: '6 juin', demand: 30, ourPrice: 298, median: 286, mean: 294, q25: 252, q75: 312 },
  { date: '2026-06-07', label: '7 juin', demand: 17, ourPrice: 288, median: 270, mean: 280, q25: 240, q75: 298 },
  { date: '2026-06-08', label: '8 juin', demand: 48, ourPrice: 305, median: 295, mean: 304, q25: 262, q75: 322 },
  { date: '2026-06-09', label: '9 juin', demand: 58, ourPrice: 318, median: 330, mean: 338, q25: 290, q75: 360 },
  { date: '2026-06-10', label: '10 juin', demand: 64, ourPrice: 322, median: 342, mean: 350, q25: 300, q75: 372 },
  { date: '2026-06-11', label: '11 juin', demand: 68, ourPrice: 325, median: 348, mean: 356, q25: 305, q75: 378 },
  { date: '2026-06-12', label: '12 juin', demand: 55, ourPrice: 315, median: 322, mean: 332, q25: 285, q75: 352 },
  { date: '2026-06-13', label: '13 juin', demand: 62, ourPrice: 320, median: 338, mean: 346, q25: 295, q75: 368 },
  { date: '2026-06-14', label: '14 juin', demand: 60, ourPrice: 318, median: 332, mean: 340, q25: 292, q75: 360 },
  { date: '2026-06-15', label: '15 juin', demand: 33, ourPrice: 305, median: 296, mean: 304, q25: 262, q75: 322 },
  { date: '2026-06-16', label: '16 juin', demand: 87, ourPrice: 326, median: 340, mean: 354, q25: 300, q75: 372 },
  { date: '2026-06-17', label: '17 juin', demand: 91, ourPrice: 332, median: 358, mean: 368, q25: 312, q75: 392 },
  { date: '2026-06-18', label: '18 juin', demand: 88, ourPrice: 330, median: 350, mean: 360, q25: 306, q75: 384 },
  { date: '2026-06-19', label: '19 juin', demand: 84, ourPrice: 328, median: 345, mean: 356, q25: 302, q75: 378 },
  { date: '2026-06-20', label: '20 juin', demand: 86, ourPrice: 330, median: 348, mean: 358, q25: 305, q75: 382 },
  { date: '2026-06-21', label: '21 juin', demand: 89, ourPrice: 332, median: 352, mean: 362, q25: 308, q75: 386 },
  { date: '2026-06-22', label: '22 juin', demand: 92, ourPrice: 334, median: 356, mean: 366, q25: 312, q75: 390 },
  { date: '2026-06-23', label: '23 juin', demand: 85, ourPrice: 329, median: 346, mean: 357, q25: 304, q75: 380 },
  { date: '2026-06-24', label: '24 juin', demand: 90, ourPrice: 333, median: 353, mean: 363, q25: 309, q75: 387 },
  { date: '2026-06-25', label: '25 juin', demand: 93, ourPrice: 336, median: 360, mean: 370, q25: 314, q75: 394 },
  { date: '2026-06-26', label: '26 juin', demand: 88, ourPrice: 331, median: 349, mean: 359, q25: 305, q75: 383 },
  { date: '2026-06-27', label: '27 juin', demand: 91, ourPrice: 334, median: 357, mean: 365, q25: 312, q75: 391 },
  { date: '2026-06-28', label: '28 juin', demand: 90, ourPrice: 333, median: 355, mean: 363, q25: 310, q75: 389 },
  { date: '2026-06-29', label: '29 juin', demand: 89, ourPrice: 332, median: 354, mean: 364, q25: 311, q75: 388 },
  { date: '2026-06-30', label: '30 juin', demand: 92, ourPrice: 335, median: 358, mean: 366, q25: 313, q75: 392 },
];

/** Jour sélectionné par défaut dans la vue marché. */
export const MARKET_SELECTED_DATE = '16 juin';

/**
 * Jours du mois marché réellement visibles selon la règle d'affichage :
 *   - mois en cours → de aujourd'hui à la fin du mois
 *   - mois futur    → mois civil complet (jamais tronqué)
 *   - mois passé    → aucune date
 */
export function getVisibleMarketMonth(today: Date = new Date()): MarketDay[] {
  return MARKET_MONTH.filter((d) => isDateVisible(d.date, today));
}

// ─── Vue comparaison — 10 jours (12 → 22 juin) ──────────────────────────────

interface ComparisonTodayRow {
  date: string;
  label: string;
  demandToday: number;
  medianToday: number;
  ourPrice: number;
}

const COMPARISON_TODAY: ComparisonTodayRow[] = [
  { date: '2026-06-12', label: '12 juin', demandToday: 52, medianToday: 268, ourPrice: 256 },
  { date: '2026-06-13', label: '13 juin', demandToday: 30, medianToday: 260, ourPrice: 248 },
  { date: '2026-06-14', label: '14 juin', demandToday: 63, medianToday: 288, ourPrice: 274 },
  { date: '2026-06-15', label: '15 juin', demandToday: 35, medianToday: 240, ourPrice: 232 },
  { date: '2026-06-16', label: '16 juin', demandToday: 82, medianToday: 330, ourPrice: 316 },
  { date: '2026-06-18', label: '18 juin', demandToday: 87, medianToday: 340, ourPrice: 326 },
  { date: '2026-06-19', label: '19 juin', demandToday: 78, medianToday: 365, ourPrice: 348 },
  { date: '2026-06-20', label: '20 juin', demandToday: 46, medianToday: 280, ourPrice: 268 },
  { date: '2026-06-21', label: '21 juin', demandToday: 57, medianToday: 310, ourPrice: 296 },
  { date: '2026-06-22', label: '22 juin', demandToday: 28, medianToday: 260, ourPrice: 248 },
];

/** Valeurs passées « Hier » — exactement celles de la maquette de référence. */
const PAST_HIER: Array<{ demand: number; median: number }> = [
  { demand: 45, median: 238 },
  { demand: 38, median: 235 },
  { demand: 55, median: 252 },
  { demand: 42, median: 220 },
  { demand: 70, median: 290 },
  { demand: 62, median: 302 },
  { demand: 58, median: 325 },
  { demand: 37, median: 250 },
  { demand: 44, median: 280 },
  { demand: 35, median: 230 },
];

/** Offsets moyens par période — alignés sur la table « Comparaison rapide ». */
const PERIOD_OFFSET: Record<ComparePeriodKey, { demand: number; median: number }> = {
  hier: { demand: 25, median: 38 },
  j3: { demand: 18, median: 42 },
  j7: { demand: 9, median: 21 },
  j14: { demand: -3, median: -8 },
  j30: { demand: 14, median: 30 },
};

function clampDemand(v: number): number {
  return Math.max(2, Math.min(99, Math.round(v)));
}

/**
 * Construit la série de comparaison fusionnée (aujourd'hui + passé)
 * pour la période demandée, filtrée selon la règle d'affichage des dates
 * (aucune date passée dans le mois en cours).
 */
/**
 * Garde-fou tarifaire : une médiane hôtelière ne peut jamais être ≤ 0.
 * Plancher à 50€ (≈ tarif minimal réaliste sur le marché parisien) pour
 * éviter des médianes aberrantes en cas d'offset trop grand côté mock.
 */
const MIN_VALID_MEDIAN = 50;
function clampMedianPrice(v: number): number {
  if (!Number.isFinite(v) || v < MIN_VALID_MEDIAN) return MIN_VALID_MEDIAN;
  if (v > 100_000) return 100_000;
  return Math.round(v);
}

export function getComparisonData(
  period: ComparePeriodKey,
  today: Date = new Date(),
): ComparisonDay[] {
  return COMPARISON_TODAY
    .map((row, i) => {
      let demandPast: number;
      let medianPast: number;

      if (period === 'hier') {
        demandPast = PAST_HIER[i].demand;
        medianPast = PAST_HIER[i].median;
      } else {
        const off = PERIOD_OFFSET[period];
        demandPast = clampDemand(row.demandToday - off.demand);
        // Bug fix Phase 4 : si l'offset rend medianPast négatif, on
        // re-clamp via clampMedianPrice (plancher 50€). clampMedianPrice
        // ci-dessous garantit qu'aucune valeur négative ne passe à l'UI.
        medianPast = Math.max(MIN_VALID_MEDIAN, row.medianToday - off.median);
      }

      return {
        date: row.date,
        label: row.label,
        demandToday: row.demandToday,
        demandPast,
        medianToday: clampMedianPrice(row.medianToday),
        medianPast: clampMedianPrice(medianPast),
        ourPrice: clampMedianPrice(row.ourPrice),
      };
    })
    .filter((d) => isDateVisible(d.date, today));
}

/** Jour sélectionné par défaut dans la vue comparaison. */
export const COMPARISON_SELECTED_DATE = '18 juin';

// ─── Métadonnées des périodes de comparaison ────────────────────────────────

export const COMPARE_PERIODS: ComparePeriodMeta[] = [
  { key: 'hier', label: 'Hier', fullLabel: "Aujourd'hui vs Hier", date: '31 mai 2026', delta: -8, deltaPct: -2.4 },
  { key: 'j3', label: 'J-3', fullLabel: "Aujourd'hui vs J-3", date: '28 mai 2026', delta: 12, deltaPct: 3.7 },
  { key: 'j7', label: 'J-7', fullLabel: "Aujourd'hui vs J-7", date: '24 mai 2026', delta: -18, deltaPct: -5.1 },
  { key: 'j14', label: 'J-14', fullLabel: "Aujourd'hui vs J-14", date: '17 mai 2026', delta: -25, deltaPct: -7.3 },
  { key: 'j30', label: 'J-30', fullLabel: "Aujourd'hui vs J-30", date: '03 mai 2026', delta: -31, deltaPct: -8.7 },
];

/** Mini-comparatifs additionnels (vue marché, sidebar). */
export interface MiniComparison {
  label: string;
  delta: number;
  deltaPct: number;
  trend: 'up' | 'down';
}

export const MINI_COMPARISONS: MiniComparison[] = [
  { label: 'Vs. 30 jours', delta: -31, deltaPct: -8.7, trend: 'down' },
  { label: 'Vs. même jour N-7', delta: -6, deltaPct: -1.8, trend: 'down' },
  { label: 'Vs. même jour N-30', delta: 9, deltaPct: 2.6, trend: 'up' },
];

// ─── Comparaison rapide (table — vue comparaison) ───────────────────────────

export const QUICK_COMPARISON: QuickComparisonRow[] = [
  { key: 'hier', label: 'vs Hier', demandDelta: 25, medianDelta: 38, gapDelta: -14, positionDelta: 2 },
  { key: 'j3', label: 'vs J-3', demandDelta: 18, medianDelta: 42, gapDelta: -10, positionDelta: 1 },
  { key: 'j7', label: 'vs J-7', demandDelta: 9, medianDelta: 21, gapDelta: -7, positionDelta: 0 },
  { key: 'j14', label: 'vs J-14', demandDelta: -3, medianDelta: -8, gapDelta: 5, positionDelta: -1 },
];

// ─── Distribution tarifs compset (vue marché) ───────────────────────────────

export const COMPSET_DISTRIBUTION: DistributionSegment[] = [
  { tierIndex: 0, pct: 10 },
  { tierIndex: 1, pct: 20 },
  { tierIndex: 2, pct: 25 },
  { tierIndex: 3, pct: 20 },
  { tierIndex: 4, pct: 15 },
  { tierIndex: 5, pct: 10 },
];

// ─── Compset analysé ────────────────────────────────────────────────────────

export const COMPSET_HOTELS: string[] = [
  'Hôtel Madeleine Haussmann',
  "Hôtel De l'Arcade",
  'Hôtel Cordelia Opéra-Madeleine',
  'Queen Mary Opera',
  "Hôtel du Triangle d'Or - Proche Madeleine",
  'Best Western Plus Hotel Sydney Opera',
  'Hôtel Opéra Opal',
  'Hôtel Royal Opéra',
  'Hôtel George Sand Opéra Paris',
  'Hôtel Chavanel',
];

// ─── Méta page ──────────────────────────────────────────────────────────────

export const PAGE_META = {
  hotelName: 'Folkestone Opéra',
  compsetSize: 10,
  lastUpdate: 'il y a 10 heures',
  marketPeriodLabel: 'juin 2026',
  comparisonDayLabel: '18 juin 2026',
  rank: 7,
  rankTotal: 10,
};
