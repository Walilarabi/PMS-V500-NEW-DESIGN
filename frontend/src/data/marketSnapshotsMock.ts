/**
 * FLOWTYM RMS — Mock snapshots marché pour la démo
 *
 * Génère une série synthétique de 60-90 jours de snapshots compset autour
 * des événements Paris 2026. La courbe simule le comportement marché
 * réel : calme par défaut, pression croissante autour des événements à
 * fort impact (Roland-Garros, VivaTech, Mondial Auto, Fashion Week…).
 *
 * Cette mock alimente le dashboard Intelligence Marché tant qu'on n'a
 * pas le brancement live avec la veille concurrentielle.
 */

import type { MarketSnapshot } from '../types/marketIntelligence';
import { SEED_PARIS_EVENTS } from './eventSourceLibrary';

interface PressurePoint {
  start: string;
  end: string;
  /** Intensité 0-1 — pilote l'amplitude des modifications. */
  intensity: number;
}

/**
 * Construit les "zones de pression" connues à partir des événements seed.
 * Chaque événement à impact ≥ medium ajoute une zone.
 */
function buildPressureZones(): PressurePoint[] {
  return SEED_PARIS_EVENTS
    .filter((e) => ['medium', 'high', 'critical', 'hyper_compression'].includes(e.impact.level))
    .map((e) => ({
      start: e.startDate,
      end: e.endDate,
      intensity: Math.min(1, (e.impact.compression ?? 50) / 100),
    }));
}

/** Calcule l'intensité de pression en vigueur à une date. */
function pressureAt(date: string, zones: PressurePoint[]): number {
  let max = 0;
  for (const z of zones) {
    if (date >= z.start && date <= z.end) {
      if (z.intensity > max) max = z.intensity;
    }
    // pré-pression (J-7 à J-1) : 50 % de l'intensité
    const preStart = shiftIso(z.start, -7);
    if (date >= preStart && date < z.start) {
      const ratio = 1 - (daysBetween(date, z.start) / 7);
      max = Math.max(max, z.intensity * 0.5 * ratio);
    }
  }
  return max;
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const aa = new Date(`${a}T00:00:00Z`).getTime();
  const bb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(Math.round((bb - aa) / 86_400_000));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GÉNÉRATION SNAPSHOT                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE_MEDIAN = 195;     // EUR — médiane marché calme
const BASE_OUR = 188;
const BASE_AVAILABILITY = 0.82;
const BASE_PICKUP = 9;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function snapshotForDate(date: string, dayIndex: number, zones: PressurePoint[]): MarketSnapshot {
  const p = pressureAt(date, zones);
  const noise = (pseudoRandom(dayIndex) - 0.5) * 0.05;

  // Médiane : +0 à +40 % selon pression
  const median = BASE_MEDIAN * (1 + p * 0.40 + noise);

  // Notre prix : suit la médiane avec un petit lag
  const ourPrice = BASE_OUR * (1 + p * 0.30 + noise);

  // Disponibilité : 0.82 → 0.20 sur forte pression
  const availability = Math.max(0.10, BASE_AVAILABILITY - p * 0.62 + noise * 0.1);

  // Min Stay : explose à partir de p > 0.5
  const minStayShare = Math.min(1, Math.max(0, (p - 0.3) * 1.4));
  // CTA/CTD : > 0.7
  const ctaCtdShare = Math.min(1, Math.max(0, (p - 0.55) * 1.2));
  // Fermeture flexible : > 0.4
  const flexibleClosedShare = Math.min(1, Math.max(0, (p - 0.35) * 1.3));
  // Fermeture OTA : > 0.6
  const otaClosedShare = Math.min(1, Math.max(0, (p - 0.5) * 0.8));
  // Inventory shrink : > 0.55
  const inventoryShrinkShare = Math.min(1, Math.max(0, (p - 0.5) * 0.9));

  // Pickup : 9 base → 28 sur pression extrême
  const pickup = BASE_PICKUP + p * 19 + noise * 4;

  return {
    date,
    capturedAt: `${date}T08:00:00Z`,
    compsetMedian: Math.round(median),
    ourPrice: Math.round(ourPrice),
    availability: Math.round(availability * 100) / 100,
    minStayShare: Math.round(minStayShare * 100) / 100,
    ctaCtdShare: Math.round(ctaCtdShare * 100) / 100,
    flexibleClosedShare: Math.round(flexibleClosedShare * 100) / 100,
    otaClosedShare: Math.round(otaClosedShare * 100) / 100,
    pickup: Math.max(0, Math.round(pickup)),
    inventoryShrinkShare: Math.round(inventoryShrinkShare * 100) / 100,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PUBLIC API                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Génère N jours de snapshots marché à partir d'une date de départ.
 * Par défaut : du 1er janvier 2026 au 31 décembre 2026 (couvre tous les
 * événements seed).
 */
export function generateParisMarketSnapshots(
  startDate = '2026-01-01',
  endDate = '2026-12-31',
): MarketSnapshot[] {
  const zones = buildPressureZones();
  const out: MarketSnapshot[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  let i = 0;
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    out.push(snapshotForDate(iso, i++, zones));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Snapshot d'aujourd'hui (utilisé par défaut pour la confidence quand on
 * n'a pas de série complète).
 */
export function generateSingleSnapshot(date: string): MarketSnapshot {
  return snapshotForDate(date, 0, buildPressureZones());
}
