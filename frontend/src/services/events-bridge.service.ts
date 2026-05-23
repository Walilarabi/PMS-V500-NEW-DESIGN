/**
 * FLOWTYM RMS — Pont entre useEventsStore et les modules consommateurs
 * (Planning, RMS Tableau, Veille, Pricing Calendar).
 *
 * Tous ces modules ont besoin de la liste agrégée des événements
 * actifs sur une date donnée — sans dépendre directement du domaine.
 * Ce service expose des helpers neutres (data only), faciles à
 * memoiser côté UI.
 */

import type { EventImpactLevel, RMSMarketEvent } from '../types/events';
import { IMPACT_LEVEL_ORDER } from '../types/events';
import { aggregateImpact } from './event-impact.engine';

export interface AggregatedDayEvents {
  date: string;
  events: RMSMarketEvent[];
  count: number;
  level: EventImpactLevel;
  /** Indice 0-100 combiné — utilisable pour gradient/couleur. */
  pressure: number;
  /** Recommandation prix combinée (max). */
  influencePrice: number;
  label: string;
}

const LEVEL_LABEL: Record<EventImpactLevel, string> = {
  critical: 'Impact Critique',
  high: 'Impact Fort',
  medium: 'Impact Moyen',
  low: 'Impact Faible',
  very_low: 'Impact Très faible',
};

/**
 * Filtre les événements impactant `date` (active uniquement).
 */
export function eventsActiveOn(events: RMSMarketEvent[], date: string): RMSMarketEvent[] {
  return events.filter(
    (e) => e.startDate <= date && e.endDate >= date && e.status !== 'archived' && e.status !== 'cancelled',
  );
}

/**
 * Agrège les événements d'une date en une seule entrée enrichie.
 * Le niveau global = niveau maximum parmi les events actifs.
 * La pression = combinaison atténuée (1 - prod(1-x/100)).
 */
export function aggregateEventsForDate(events: RMSMarketEvent[], date: string): AggregatedDayEvents {
  const active = eventsActiveOn(events, date);
  if (active.length === 0) {
    return {
      date,
      events: [],
      count: 0,
      level: 'very_low',
      pressure: 0,
      influencePrice: 0,
      label: '',
    };
  }
  // niveau max
  const level = active.reduce<EventImpactLevel>((lvl, e) =>
    IMPACT_LEVEL_ORDER[e.impact.level] > IMPACT_LEVEL_ORDER[lvl] ? e.impact.level : lvl,
  'very_low');
  // pression combinée
  const scores = active.map((e) => aggregateImpact(e.impact));
  const combined = 1 - scores.reduce((acc, x) => acc * (1 - x / 100), 1);
  const pressure = Math.round(combined * 100);
  const influencePrice = Math.max(0, ...active.map((e) => e.influencePrice));
  return {
    date,
    events: active.sort((a, b) => aggregateImpact(b.impact) - aggregateImpact(a.impact)),
    count: active.length,
    level,
    pressure,
    influencePrice,
    label: active.length === 1 ? active[0].name : `${active.length} événements`,
  };
}

/**
 * Classes Tailwind pour colorer une cellule selon le niveau global.
 * Conservatrices : pastel + texte lisible — alignées avec le module Événements.
 */
export function eventCellTone(level: EventImpactLevel): {
  bg: string;
  text: string;
  ring: string;
  dot: string;
} {
  switch (level) {
    case 'critical': return { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    dot: 'bg-rose-500' };
    case 'high':     return { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200',  dot: 'bg-orange-500' };
    case 'medium':   return { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400' };
    case 'low':      return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-400' };
    default:         return { bg: 'bg-slate-50',   text: 'text-slate-600',   ring: 'ring-slate-200',   dot: 'bg-slate-300' };
  }
}

export function impactLevelLabel(level: EventImpactLevel): string {
  return LEVEL_LABEL[level];
}
