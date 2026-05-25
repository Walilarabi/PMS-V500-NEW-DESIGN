/**
 * FLOWTYM RMS — Adapter Lighthouse → MarketSnapshot
 *
 * Convertit la série Lighthouse/Expedia (importée par l'utilisateur ou
 * scrapée) en série de `MarketSnapshot` consommable par le moteur
 * Market Intelligence.
 *
 * Mapping :
 *   • date                  → date
 *   • ourPrice              → ourPrice
 *   • compsetMedian         → compsetMedian
 *   • marketDemand          → seed pour pickup synthétique
 *   • compétiteurs sold_out → availability (1 - ratio sold_out)
 *   • compétiteurs restricted → minStayShare / flexibleClosedShare
 *                                (heuristique : restricted = restriction prix
 *                                = combinaison Min Stay + CTA/CTD)
 *
 * Tous les calculs sont conservateurs et bornés. Les champs qu'on ne
 * peut pas dériver fiablement (otaClosedShare, inventoryShrinkShare) sont
 * estimés à partir de heuristiques simples (proportion d'hôtels sold_out
 * et restricted).
 *
 * 100 % pur, déterministe, testable.
 */

import type {
  CompetitorRate,
  LighthouseDayData,
  LighthouseImport,
} from '../lighthouse-parser.service';
import type { MarketSnapshot } from '../../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Ratio de compétiteurs dans un statut donné, sur ceux avec un prix ou un statut connu. */
function ratioByStatus(competitors: CompetitorRate[], status: CompetitorRate['status']): number {
  const known = competitors.filter((c) => c.status !== 'unknown');
  if (known.length === 0) return 0;
  return known.filter((c) => c.status === status).length / known.length;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AdapterOptions {
  /** Pickup synthétique baseline si pas d'historique. */
  basePickup?: number;
  /** Date capture pour timestamp. */
  capturedAt?: string;
}

/**
 * Convertit un seul `LighthouseDayData` en `MarketSnapshot`.
 *
 * Hypothèses :
 *   • availability ≈ 1 - ratio_sold_out
 *   • restricted ≈ combinaison Min Stay (60 %) + CTA/CTD (40 %)
 *   • flexibleClosedShare estimé à 50 % du ratio restricted
 *   • otaClosedShare estimé à 30 % du ratio sold_out (très conservateur)
 *   • inventoryShrinkShare estimé à 25 % de (sold_out + restricted)
 *   • pickup estimé à basePickup * (1 + marketDemand) si non fourni
 */
export function lighthouseDayToSnapshot(
  day: LighthouseDayData,
  options: AdapterOptions = {},
): MarketSnapshot {
  const soldOutRatio = ratioByStatus(day.competitors, 'sold_out');
  const restrictedRatio = ratioByStatus(day.competitors, 'restricted');
  const tensionRatio = soldOutRatio + restrictedRatio;

  const availability = Math.max(0, 1 - soldOutRatio - restrictedRatio * 0.25);
  const minStayShare = Math.min(1, restrictedRatio * 0.6);
  const ctaCtdShare = Math.min(1, restrictedRatio * 0.4);
  const flexibleClosedShare = Math.min(1, restrictedRatio * 0.5);
  const otaClosedShare = Math.min(1, soldOutRatio * 0.3);
  const inventoryShrinkShare = Math.min(1, tensionRatio * 0.25);

  const basePickup = options.basePickup ?? 8;
  const pickup = Math.max(0, Math.round(basePickup * (1 + day.marketDemand)));

  return {
    date: day.date,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    compsetMedian: Math.max(0, day.compsetMedian),
    ourPrice: Math.max(0, day.ourPrice),
    availability: round2(availability),
    minStayShare: round2(minStayShare),
    ctaCtdShare: round2(ctaCtdShare),
    flexibleClosedShare: round2(flexibleClosedShare),
    otaClosedShare: round2(otaClosedShare),
    pickup,
    inventoryShrinkShare: round2(inventoryShrinkShare),
  };
}

/**
 * Convertit tout un import Lighthouse / Expedia en série de snapshots.
 * Trie chronologiquement et filtre les jours sans données (ourPrice ≤ 0 ou
 * médiane ≤ 0 — exclusions du quality gate).
 */
export function lighthouseImportToSnapshots(
  data: LighthouseImport,
  options: AdapterOptions = {},
): MarketSnapshot[] {
  return data.days
    .filter((d) => d.date && d.ourPrice > 0 && d.compsetMedian > 0)
    .map((d) => lighthouseDayToSnapshot(d, {
      ...options,
      capturedAt: options.capturedAt ?? data.importedAt,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
