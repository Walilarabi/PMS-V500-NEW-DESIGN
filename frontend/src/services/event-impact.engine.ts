/**
 * FLOWTYM RMS — Event Impact & Market Pressure Engine
 *
 * Calcule pour chaque événement :
 *   • un niveau d'impact (très faible → critique)
 *   • un score IA agrégé (demande, ADR, TO, pickup, RevPAR, compression)
 *
 * Et pour chaque date :
 *   • un Market Pressure Index cumulant les impacts des événements actifs
 *     (gestion des chevauchements / stacking intelligent)
 *
 * Le moteur expose également :
 *   • dedupEvents       — détection et fusion des doublons inter-sources
 *   • mergeEvents       — fusion de deux événements (préserve historique)
 *   • daysBetween       — utilitaire date
 */

import type {
  EventImpactLevel,
  ImpactScore,
  MarketPressureIndex,
  RMSMarketEvent,
} from '../types/events';
import { IMPACT_LEVEL_ORDER } from '../types/events';

// ─── Niveaux ──────────────────────────────────────────────────────────────

/**
 * Convertit un score 0-100 vers un niveau d'impact.
 * Le palier hyper_compression (≥ 95) est réservé aux phénomènes globaux
 * (BTS, Taylor Swift, Beyoncé, Coldplay…) — il déclenche automatiquement
 * une stratégie agressive, une alerte RM et un recalcul des recommandations.
 */
export function scoreToLevel(score: number): EventImpactLevel {
  if (score >= 95) return 'hyper_compression';
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'low';
  return 'very_low';
}

/**
 * Score agrégé d'un événement (0-100).
 */
export function aggregateImpact(impact: ImpactScore): number {
  // pondération métier : compression et demande > pickup > ADR
  const raw =
    impact.compression * 0.35 +
    impact.demand * 0.25 +
    impact.pickup * 0.15 +
    impact.adr * 0.10 +
    impact.occupancy * 0.10 +
    impact.revpar * 0.05;
  return Math.max(0, Math.min(100, raw));
}

// ─── Stacking / Market Pressure Index ─────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDate(d));
  }
  return out;
}

/**
 * Construit l'index de pression marché jour par jour à partir d'une liste
 * d'événements. Cumule intelligemment les impacts (les events critiques
 * dominent, les events faibles s'additionnent en log).
 */
export function buildMarketPressureIndex(
  events: RMSMarketEvent[],
  windowFrom: string,
  windowTo: string,
): Record<string, MarketPressureIndex> {
  const result: Record<string, MarketPressureIndex> = {};
  const allDates = eachDateInRange(windowFrom, windowTo);
  for (const d of allDates) {
    result[d] = { date: d, eventIds: [], pressure: 0, level: 'very_low', drivers: [] };
  }

  for (const ev of events) {
    if (ev.status === 'archived' || ev.status === 'cancelled') continue;
    const dates = eachDateInRange(ev.startDate, ev.endDate);
    const score = aggregateImpact(ev.impact);
    for (const d of dates) {
      if (!result[d]) continue;
      result[d].eventIds.push(ev.id);
      result[d].drivers.push({ eventId: ev.id, weight: score });
    }
  }

  // Combine drivers using attenuated sum (1 - prod(1 - x/100))
  for (const d of Object.keys(result)) {
    const drivers = result[d].drivers;
    if (drivers.length === 0) continue;
    const combined = 1 - drivers.reduce((acc, x) => acc * (1 - x.weight / 100), 1);
    const pressure = Math.round(combined * 100);
    result[d].pressure = pressure;
    result[d].level = scoreToLevel(pressure);
  }

  return result;
}

// ─── Dédoublonnage ────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameSimilarity(a: string, b: string): number {
  const an = normalizeName(a);
  const bn = normalizeName(b);
  if (an === bn) return 1;
  if (an.includes(bn) || bn.includes(an)) return 0.85;
  const aTok = new Set(an.split(' '));
  const bTok = new Set(bn.split(' '));
  let inter = 0;
  aTok.forEach((t) => { if (bTok.has(t)) inter++; });
  return inter / Math.max(aTok.size, bTok.size);
}

function datesOverlap(a: RMSMarketEvent, b: RMSMarketEvent): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/**
 * Détecte des doublons (même événement entre 2 sources). Renvoie les
 * groupes potentiels — la fusion est faite par mergeEvents.
 */
export function findDuplicates(events: RMSMarketEvent[]): RMSMarketEvent[][] {
  const groups: RMSMarketEvent[][] = [];
  const used = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (used.has(ev.id)) continue;
    const group = [ev];
    for (let j = i + 1; j < events.length; j++) {
      const other = events[j];
      if (used.has(other.id)) continue;
      if (
        ev.city.toLowerCase() === other.city.toLowerCase() &&
        nameSimilarity(ev.name, other.name) >= 0.8 &&
        datesOverlap(ev, other)
      ) {
        group.push(other);
        used.add(other.id);
      }
    }
    if (group.length > 1) groups.push(group);
    used.add(ev.id);
  }
  return groups;
}

/**
 * Fusionne plusieurs événements en un seul (préserve historique, sources).
 * Le score de l'événement résultant prend le max pour chaque dimension.
 */
export function mergeEvents(events: RMSMarketEvent[]): RMSMarketEvent {
  if (events.length === 0) throw new Error('mergeEvents: empty list');
  const base = events.reduce((best, e) =>
    aggregateImpact(e.impact) > aggregateImpact(best.impact) ? e : best,
  events[0]);
  const sources = Array.from(new Set(events.flatMap((e) => e.sources)));
  const history = events
    .flatMap((e) => e.history)
    .concat([{ at: new Date().toISOString(), action: 'merged' as const, source: 'engine' }])
    .sort((a, b) => a.at.localeCompare(b.at));
  const impact: ImpactScore = {
    demand: Math.max(...events.map((e) => e.impact.demand)),
    adr: Math.max(...events.map((e) => e.impact.adr)),
    occupancy: Math.max(...events.map((e) => e.impact.occupancy)),
    pickup: Math.max(...events.map((e) => e.impact.pickup)),
    revpar: Math.max(...events.map((e) => e.impact.revpar)),
    compression: Math.max(...events.map((e) => e.impact.compression)),
    confidence: Math.round(
      events.reduce((s, e) => s + e.impact.confidence, 0) / events.length,
    ),
    level: events.reduce<EventImpactLevel>((lvl, e) =>
      IMPACT_LEVEL_ORDER[e.impact.level] > IMPACT_LEVEL_ORDER[lvl] ? e.impact.level : lvl,
    'very_low'),
  };
  return {
    ...base,
    sources,
    impact,
    history,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Applique findDuplicates + mergeEvents pour produire une liste sans doublon.
 */
export function dedupEvents(events: RMSMarketEvent[]): {
  deduped: RMSMarketEvent[];
  merged: number;
} {
  const groups = findDuplicates(events);
  const groupedIds = new Set(groups.flat().map((e) => e.id));
  const untouched = events.filter((e) => !groupedIds.has(e.id));
  const mergedItems = groups.map((g) => mergeEvents(g));
  return {
    deduped: [...untouched, ...mergedItems],
    merged: groups.reduce((acc, g) => acc + g.length - 1, 0),
  };
}

// ─── Utilitaires UI ───────────────────────────────────────────────────────

export function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

export function formatDateRange(start: string, end: string, locale = 'fr-FR'): string {
  if (start === end) {
    return new Date(start).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  }
  const s = new Date(start).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  const e = new Date(end).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} → ${e}`;
}
