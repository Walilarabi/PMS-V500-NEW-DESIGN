/**
 * FLOWTYM RMS — Scoring concurrent (Mix intelligent Lighthouse + Expedia)
 *
 * Le mode Mix ne fusionne pas brutalement les deux fichiers. Il calcule un
 * score métier pour chaque concurrent identifié et ne retient que les TOP N
 * (10 par défaut) les plus pertinents.
 *
 * Pondération (cf. spec produit) :
 *   - 40 % proximité tarifaire avec notre hôtel
 *   - 25 % similarité de positionnement
 *   - 15 % fréquence de présence dans les fichiers
 *   - 10 % stabilité tarifaire (faible volatilité)
 *   - 10 % cohérence avec la tendance marché
 *
 * Fonctions pures.
 */

import type {
  LighthouseDayData,
  LighthouseImport,
} from '../../services/lighthouse-parser.service';
import type { ExpediaImport } from '../../services/expedia-parser.service';

const WEIGHTS = {
  priceProximity: 0.4,
  positioning: 0.25,
  frequency: 0.15,
  stability: 0.1,
  marketTrend: 0.1,
} as const;

const MIN_SCORE_TO_KEEP = 35; // sur 100
const MAX_COMPETITORS = 10;

export interface CompetitorScore {
  name: string;
  /** Score global 0-100. */
  score: number;
  /** Détail des sous-scores pour traçabilité UI. */
  components: {
    priceProximity: number;
    positioning: number;
    frequency: number;
    stability: number;
    marketTrend: number;
  };
  /** Métriques observées. */
  observed: {
    presence: number;       // 0..1 — fraction des jours où on a un prix
    avgPrice: number;       // moyenne des prix observés
    priceStdDev: number;    // écart-type des prix
    sampleCount: number;    // nombre de prix observés
    sources: Array<'lighthouse' | 'expedia'>;
  };
}

export interface CompetitorSelection {
  /** Top concurrents retenus pour le graphique (max 10). */
  selected: CompetitorScore[];
  /** Concurrents exclus avec leur score (pour le bandeau de traçabilité). */
  excluded: CompetitorScore[];
  /** Stats globales. */
  totalDetected: number;
  totalKept: number;
}

/* ───────────────────────────────────────────────────────────────────────── */
/* COLLECTE DES PRIX PAR HÔTEL                                                */
/* ───────────────────────────────────────────────────────────────────────── */

interface CompetitorObservations {
  name: string;
  // Map date → prix
  prices: Map<string, number>;
  sources: Set<'lighthouse' | 'expedia'>;
}

function collectFromLighthouse(
  data: LighthouseImport,
  acc: Map<string, CompetitorObservations>
): void {
  for (const day of data.days) {
    for (const comp of day.competitors) {
      if (comp.price == null || comp.status !== 'available') continue;
      const key = normalizeName(comp.hotelName);
      const entry = acc.get(key) ?? {
        name: comp.hotelName,
        prices: new Map<string, number>(),
        sources: new Set<'lighthouse' | 'expedia'>(),
      };
      entry.prices.set(day.date, comp.price);
      entry.sources.add('lighthouse');
      acc.set(key, entry);
    }
  }
}

function collectFromExpedia(
  data: ExpediaImport,
  acc: Map<string, CompetitorObservations>
): void {
  for (const day of data.days) {
    for (const comp of day.competitors) {
      if (comp.price == null || comp.status !== 'available') continue;
      const key = normalizeName(comp.hotelName);
      const entry = acc.get(key) ?? {
        name: comp.hotelName,
        prices: new Map<string, number>(),
        sources: new Set<'lighthouse' | 'expedia'>(),
      };
      // En cas de conflit Lighthouse/Expedia pour la même date,
      // on garde la valeur déjà présente (Lighthouse prioritaire si chargée).
      if (!entry.prices.has(day.date)) entry.prices.set(day.date, comp.price);
      entry.sources.add('expedia');
      acc.set(key, entry);
    }
  }
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ───────────────────────────────────────────────────────────────────────── */
/* SCORING                                                                    */
/* ───────────────────────────────────────────────────────────────────────── */

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/** Map distance pct → score 0-100 (proche = score haut). */
function priceProximityScore(competitorAvg: number, ourAvg: number): number {
  if (ourAvg <= 0) return 50;
  const diffPct = Math.abs(competitorAvg - ourAvg) / ourAvg;
  // 0% = 100, 5% = 90, 10% = 80, 20% = 60, 40% = 20, 50%+ = 0
  return Math.max(0, Math.round(100 - diffPct * 200));
}

/** Score de positionnement : pénalise les concurrents très en-dessous (low-cost)
 *  ou très au-dessus (palaces) de notre gamme. */
function positioningScore(competitorAvg: number, ourAvg: number): number {
  if (ourAvg <= 0) return 50;
  const ratio = competitorAvg / ourAvg;
  // 0.7 → 1.3 = score plein 100; en dehors, dégradation linéaire
  if (ratio >= 0.7 && ratio <= 1.3) return 100;
  if (ratio >= 0.5 && ratio <= 1.5) {
    const dist = Math.min(Math.abs(ratio - 0.7), Math.abs(ratio - 1.3));
    return Math.round(100 - dist * 200);
  }
  return Math.max(0, Math.round(40 - Math.abs(ratio - 1) * 40));
}

/** Score de fréquence : % de jours avec prix dispo. */
function frequencyScore(presence: number): number {
  return Math.round(Math.min(100, presence * 100));
}

/** Score de stabilité : faible coefficient de variation = haut score. */
function stabilityScore(avgPrice: number, std: number): number {
  if (avgPrice <= 0) return 0;
  const cv = std / avgPrice; // coefficient of variation
  // cv = 0 → 100 ; cv = 0.5 → 0
  return Math.max(0, Math.round(100 - cv * 200));
}

/** Cohérence avec la tendance marché : delta de tendance vs médiane marché. */
function marketTrendScore(
  prices: Map<string, number>,
  marketMedianByDate: Map<string, number>
): number {
  let sumDeviation = 0;
  let n = 0;
  for (const [date, price] of prices) {
    const median = marketMedianByDate.get(date);
    if (median == null || median <= 0) continue;
    const deviation = Math.abs(price - median) / median;
    sumDeviation += deviation;
    n++;
  }
  if (n === 0) return 50;
  const avgDeviation = sumDeviation / n;
  // 0% = 100, 30% = 0
  return Math.max(0, Math.round(100 - avgDeviation * 333));
}

/* ───────────────────────────────────────────────────────────────────────── */
/* ENTRY POINT                                                                */
/* ───────────────────────────────────────────────────────────────────────── */

export interface ScoringInput {
  lighthouse?: LighthouseImport | null;
  expedia?: ExpediaImport | null;
  /** Notre prix moyen de référence (pour proximity + positioning). */
  ourAvgPrice: number;
  /** Médiane marché par date (pour marketTrend). */
  marketMedianByDate: Map<string, number>;
  /** Nombre de dates de la fenêtre, pour le score de fréquence. */
  windowDays: number;
}

/**
 * Calcule les scores pour tous les concurrents détectés et sélectionne
 * les TOP MAX_COMPETITORS dont le score dépasse MIN_SCORE_TO_KEEP.
 */
export function scoreAndSelectCompetitors(
  input: ScoringInput
): CompetitorSelection {
  const observations = new Map<string, CompetitorObservations>();
  if (input.lighthouse) collectFromLighthouse(input.lighthouse, observations);
  if (input.expedia) collectFromExpedia(input.expedia, observations);

  const scores: CompetitorScore[] = [];

  for (const obs of observations.values()) {
    const prices = Array.from(obs.prices.values());
    if (prices.length < 3) continue; // pas assez de données pour scorer

    const avgPrice = mean(prices);
    const std = stdDev(prices);
    const presence = input.windowDays > 0 ? prices.length / input.windowDays : 0;

    const components = {
      priceProximity: priceProximityScore(avgPrice, input.ourAvgPrice),
      positioning: positioningScore(avgPrice, input.ourAvgPrice),
      frequency: frequencyScore(presence),
      stability: stabilityScore(avgPrice, std),
      marketTrend: marketTrendScore(obs.prices, input.marketMedianByDate),
    };

    const score = Math.round(
      components.priceProximity * WEIGHTS.priceProximity +
        components.positioning * WEIGHTS.positioning +
        components.frequency * WEIGHTS.frequency +
        components.stability * WEIGHTS.stability +
        components.marketTrend * WEIGHTS.marketTrend
    );

    scores.push({
      name: obs.name,
      score,
      components,
      observed: {
        presence: Math.min(1, presence),
        avgPrice: Math.round(avgPrice),
        priceStdDev: Math.round(std),
        sampleCount: prices.length,
        sources: Array.from(obs.sources),
      },
    });
  }

  scores.sort((a, b) => b.score - a.score);

  const kept: CompetitorScore[] = [];
  const excluded: CompetitorScore[] = [];

  for (const s of scores) {
    if (kept.length < MAX_COMPETITORS && s.score >= MIN_SCORE_TO_KEEP) {
      kept.push(s);
    } else {
      excluded.push(s);
    }
  }

  return {
    selected: kept,
    excluded,
    totalDetected: scores.length,
    totalKept: kept.length,
  };
}

export { MAX_COMPETITORS, MIN_SCORE_TO_KEEP, WEIGHTS };
