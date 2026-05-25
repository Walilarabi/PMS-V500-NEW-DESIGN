/**
 * FLOWTYM RMS — Compset Clustering Engine
 *
 * Classifie automatiquement les hôtels du compset en clusters
 * (luxury/upscale/midscale/budget/lifestyle/business/leisure/aparthotel)
 * à partir de signaux disponibles :
 *   • prix moyen observé (% vs notre prix moyen)
 *   • indices nom (Hilton, Ibis, Mama Shelter, AccorHotel…)
 *   • capacité d'apparition en haut/bas de fourchette
 *
 * Le clustering permet de produire des snapshots SEGMENTÉS (1 par cluster)
 * et donc de calculer une compression PAR SEGMENT — ce qui distingue
 * Flowtym d'un calendrier événementiel classique :
 *
 *   "Compression LUXURY 82/100, MIDSCALE 45/100, BUDGET 18/100 → Roland-Garros
 *    impacte massivement le luxe mais peu le budget."
 *
 * 100 % pur, déterministe, testable.
 */

import type {
  CompetitorRate,
  LighthouseDayData,
} from '../lighthouse-parser.service';
import type {
  HotelCluster,
  MarketSnapshot,
} from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* SIGNAUX NOM → CLUSTER                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Heuristiques nom → cluster basées sur les enseignes connues + mots-clés.
 * Ordre = priorité : le 1er match gagne. Construit pour Paris mais
 * extensible (mots-clés génériques en bas).
 */
const NAME_PATTERNS: Array<{ match: RegExp; cluster: HotelCluster }> = [
  // ─── LUXURY (palaces + 5★ établis) ────────────────────────────────────
  { match: /\b(ritz|crillon|plaza athénée|plaza athenee|bristol|four seasons|george v|royal monceau|cheval blanc|le meurice|peninsula|mandarin oriental|shangri-?la|park hyatt|prince de galles|lutetia|raffles|st\.? regis|st regis|edition hotel|edition\b|sofitel le)\b/i, cluster: 'luxury' },
  // ─── UPSCALE (4★ haut + groupes premium) ──────────────────────────────
  { match: /\b(sofitel|pullman|hilton|conrad|waldorf|hyatt regency|grand hotel|grand hôtel|intercontinental|westin|sheraton|renaissance|melia|melía|kimpton|marriott|jw marriott|le scribe|fairmont)\b/i, cluster: 'upscale' },
  // ─── LIFESTYLE / BOUTIQUE ─────────────────────────────────────────────
  { match: /\b(mama shelter|hoxton|standard hotel|moxy|25hours|generator|jo&joe|jojoe|citizenm|w hotel|w paris|nh collection|exki design|design hotel|boutique|townhouse|maison|hôtel particulier|hotel particulier|grand pigalle|pigalle|providence|amour|josephine|sinner)\b/i, cluster: 'lifestyle' },
  // ─── MIDSCALE (3★ groupes + chaînes milieu de gamme) ──────────────────
  { match: /\b(novotel|mercure|holiday inn(?!\sexpress)|courtyard|nh hotel|nh hotels|nh paris|best western premier|leonardo|barceló|barcelo|hampton inn|park inn|tulip inn)\b/i, cluster: 'midscale' },
  // ─── BUDGET (2★ + super-budget) ───────────────────────────────────────
  { match: /\b(ibis(?:\s(budget|styles|red))?|b&b|premier inn|formule 1|f1|première classe|premiere classe|hotelf1|easyhotel|easy hotel|première class|holiday inn express|express by|kyriad direct|best western (?!premier)|adagio access)\b/i, cluster: 'budget' },
  // ─── APARTHOTEL ───────────────────────────────────────────────────────
  { match: /\b(adagio|citadines|aparthotel|appart\s?hotel|appart-?hôtel|appart-?hotel|residhome|residhotel|sweetome|stayci|fraser|short stay|extended stay)\b/i, cluster: 'aparthotel' },
  // ─── BUSINESS (par convention : nom à connotation aff./congrès) ──────
  { match: /\b(business|congress|congres|courtyard|airport|aerogare|aéroport|cdg|orly|expo|euro|exhibition|park inn airport)\b/i, cluster: 'business' },
  // ─── LEISURE (resort, spa, beach) ─────────────────────────────────────
  { match: /\b(resort|spa\b|beach|plage|club med|sea|seaside|thalasso|seignosse|relais|relais & châteaux)\b/i, cluster: 'leisure' },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* SIGNAUX PRIX → CLUSTER                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Tiers de prix relatifs à la médiane marché.
 * Une fois la médiane connue, on positionne chaque hôtel sur un palier.
 *
 *   • luxury :   ≥ 1.7×  médiane  (palaces + 5★)
 *   • upscale :  1.25-1.7×        (4★+)
 *   • midscale : 0.85-1.25×       (3★)
 *   • budget :   < 0.85×          (2★ et moins)
 */
const PRICE_TIER_THRESHOLDS = {
  luxury: 1.7,
  upscale: 1.25,
  midscale: 0.85,
} as const;

function priceTierCluster(price: number, median: number): HotelCluster | null {
  if (median <= 0 || price <= 0) return null;
  const ratio = price / median;
  if (ratio >= PRICE_TIER_THRESHOLDS.luxury) return 'luxury';
  if (ratio >= PRICE_TIER_THRESHOLDS.upscale) return 'upscale';
  if (ratio >= PRICE_TIER_THRESHOLDS.midscale) return 'midscale';
  return 'budget';
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CLASSIFICATION                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface HotelClassification {
  hotelName: string;
  cluster: HotelCluster;
  /** Confidence 0-100 — combine signaux nom + prix. */
  confidence: number;
  /** Indique d'où vient la décision (utile pour le debugging). */
  reason: 'name_pattern' | 'price_tier' | 'price_fallback';
}

/**
 * Classifie un hôtel à partir de son nom + prix moyen observé + médiane
 * marché. La règle : signal nom = très fiable (confidence 90+), sinon
 * fallback prix (confidence 65 à 75).
 */
export function classifyHotel(args: {
  hotelName: string;
  avgPrice: number;
  marketMedian: number;
}): HotelClassification {
  const { hotelName, avgPrice, marketMedian } = args;

  // 1. Match nom (priorité)
  for (const { match, cluster } of NAME_PATTERNS) {
    if (match.test(hotelName)) {
      return {
        hotelName,
        cluster,
        confidence: 92,
        reason: 'name_pattern',
      };
    }
  }

  // 2. Fallback prix
  const priceCluster = priceTierCluster(avgPrice, marketMedian);
  if (priceCluster) {
    return {
      hotelName,
      cluster: priceCluster,
      confidence: avgPrice > 0 ? 70 : 50,
      reason: 'price_tier',
    };
  }

  // 3. Fallback ultime : midscale
  return {
    hotelName,
    cluster: 'midscale',
    confidence: 30,
    reason: 'price_fallback',
  };
}

/**
 * Calcule le prix moyen d'un compétiteur sur une série de jours
 * Lighthouse — utilisé comme signal pour le clustering.
 */
export function avgCompetitorPrice(
  hotelName: string,
  days: LighthouseDayData[],
): number {
  const prices: number[] = [];
  for (const d of days) {
    for (const c of d.competitors) {
      if (c.hotelName === hotelName && c.price != null && c.price > 0) {
        prices.push(c.price);
      }
    }
  }
  if (prices.length === 0) return 0;
  return prices.reduce((s, p) => s + p, 0) / prices.length;
}

/**
 * Classifie tout le compset d'un import Lighthouse.
 * Renvoie une map { hotelName → HotelClassification }.
 */
export function classifyCompset(args: {
  hotelNames: string[];
  days: LighthouseDayData[];
}): Map<string, HotelClassification> {
  const out = new Map<string, HotelClassification>();
  // Médiane "globale" = moyenne des médianes journalières
  const meds = args.days.map((d) => d.compsetMedian).filter((m) => m > 0);
  const marketMedian = meds.length === 0
    ? 0
    : meds.reduce((s, m) => s + m, 0) / meds.length;

  for (const name of args.hotelNames) {
    const avg = avgCompetitorPrice(name, args.days);
    out.set(name, classifyHotel({
      hotelName: name,
      avgPrice: avg,
      marketMedian,
    }));
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SNAPSHOTS SEGMENTÉS                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Construit un snapshot AGRÉGÉ par cluster pour un jour donné.
 * Réutilise la logique de l'adapter Lighthouse mais en filtrant les
 * compétiteurs au cluster cible.
 *
 * Si aucun compétiteur du cluster n'est présent ce jour-là, renvoie null
 * (le moteur de compression ignorera ce segment).
 */
export function buildClusterSnapshot(args: {
  day: LighthouseDayData;
  cluster: HotelCluster;
  classifications: Map<string, HotelClassification>;
  capturedAt?: string;
}): MarketSnapshot | null {
  const { day, cluster, classifications } = args;

  const inCluster: CompetitorRate[] = day.competitors.filter((c) => {
    const cls = classifications.get(c.hotelName);
    return cls?.cluster === cluster;
  });

  if (inCluster.length === 0) return null;

  // Prix médian du cluster
  const prices = inCluster
    .filter((c) => c.price != null && c.price > 0)
    .map((c) => c.price as number)
    .sort((a, b) => a - b);
  const median = prices.length === 0 ? 0 :
    (prices.length % 2 === 1
      ? prices[Math.floor(prices.length / 2)]
      : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2);

  // Ratios par statut (sur les compétiteurs du cluster)
  const known = inCluster.filter((c) => c.status !== 'unknown');
  const soldOutRatio = known.length === 0 ? 0
    : known.filter((c) => c.status === 'sold_out').length / known.length;
  const restrictedRatio = known.length === 0 ? 0
    : known.filter((c) => c.status === 'restricted').length / known.length;

  return {
    date: day.date,
    capturedAt: args.capturedAt ?? new Date().toISOString(),
    compsetMedian: Math.round(median),
    ourPrice: day.ourPrice, // pas segmenté ; on garde le nôtre
    availability: round2(Math.max(0, 1 - soldOutRatio - restrictedRatio * 0.25)),
    minStayShare: round2(Math.min(1, restrictedRatio * 0.6)),
    ctaCtdShare: round2(Math.min(1, restrictedRatio * 0.4)),
    flexibleClosedShare: round2(Math.min(1, restrictedRatio * 0.5)),
    otaClosedShare: round2(Math.min(1, soldOutRatio * 0.3)),
    pickup: Math.max(0, Math.round(8 * (1 + day.marketDemand))),
    inventoryShrinkShare: round2(Math.min(1, (soldOutRatio + restrictedRatio) * 0.25)),
  };
}

/**
 * Construit la série segmentée : pour chaque cluster, une liste de
 * snapshots quotidiens. Permet d'alimenter `computeMarketCompression`
 * avec un scope segmenté.
 *
 * @returns Map<cluster, MarketSnapshot[]>
 */
export function buildSegmentedSnapshots(args: {
  days: LighthouseDayData[];
  classifications: Map<string, HotelClassification>;
  capturedAt?: string;
}): Map<HotelCluster, MarketSnapshot[]> {
  const clusters: HotelCluster[] = [
    'luxury', 'upscale', 'midscale', 'budget', 'lifestyle', 'business', 'leisure', 'aparthotel',
  ];
  const out = new Map<HotelCluster, MarketSnapshot[]>();
  for (const cluster of clusters) {
    const series: MarketSnapshot[] = [];
    for (const day of args.days) {
      const snap = buildClusterSnapshot({
        day,
        cluster,
        classifications: args.classifications,
        capturedAt: args.capturedAt,
      });
      if (snap) series.push(snap);
    }
    if (series.length > 0) out.set(cluster, series);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DISTRIBUTION CLUSTER                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Distribution des clusters dans le compset — utile pour afficher la
 * composition du compset dans l'UI.
 */
export function compsetDistribution(
  classifications: Map<string, HotelClassification>,
): Array<{ cluster: HotelCluster; count: number; share: number }> {
  const counts = new Map<HotelCluster, number>();
  for (const c of classifications.values()) {
    counts.set(c.cluster, (counts.get(c.cluster) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  if (total === 0) return [];
  return Array.from(counts.entries())
    .map(([cluster, count]) => ({
      cluster,
      count,
      share: count / total,
    }))
    .sort((a, b) => b.count - a.count);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
