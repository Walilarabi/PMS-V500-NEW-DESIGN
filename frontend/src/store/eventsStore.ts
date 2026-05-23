/**
 * FLOWTYM RMS — Events Store (Zustand + persistance)
 *
 * Source unique de vérité pour le module Événements.
 * Consommé par :
 *   • le module Événements (liste, calendrier, recherche, import)
 *   • le RMS (pression marché, recommandations, agressivité pricing)
 *   • le calendrier tarifaire, la veille concurrentielle, le planning,
 *     les alertes — via les sélecteurs getEventsForDate / getPressureForDate.
 *
 * Le store conserve aussi les sources actives et les logs de synchronisation
 * pour alimenter le panneau de recherche premium.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  EventCategory,
  EventImpactLevel,
  EventSource,
  EventStatus,
  RMSMarketEvent,
  MarketPressureIndex,
  EventSearchResult,
} from '../types/events';
import { IMPACT_LEVEL_ORDER } from '../types/events';
import { EVENT_SOURCE_LIBRARY, SEED_PARIS_EVENTS } from '../data/eventSourceLibrary';
import {
  aggregateImpact,
  buildMarketPressureIndex,
  dedupEvents,
  scoreToLevel,
} from '../services/event-impact.engine';

export interface SyncLogEntry {
  at: string;
  city: string;
  sourcesQueried: number;
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
  durationMs: number;
}

export interface EventFilters {
  search: string;
  categories: EventCategory[];
  cities: string[];
  minImpact?: EventImpactLevel;
  statuses: EventStatus[];
  sources: string[];
  fromDate?: string;
  toDate?: string;
  activeOnly: boolean;
}

const DEFAULT_FILTERS: EventFilters = {
  search: '',
  categories: [],
  cities: [],
  minImpact: undefined,
  statuses: [],
  sources: [],
  activeOnly: false,
};

interface EventsStore {
  events: RMSMarketEvent[];
  sources: EventSource[];
  filters: EventFilters;
  syncLogs: SyncLogEntry[];
  autoSync: boolean;
  lastSearchAt?: string;

  // mutations
  addEvent: (ev: RMSMarketEvent) => void;
  updateEvent: (id: string, patch: Partial<RMSMarketEvent>) => void;
  deleteEvent: (id: string) => void;
  duplicateEvent: (id: string) => void;
  setStatus: (id: string, status: EventStatus) => void;
  attachHotels: (id: string, hotelIds: string[]) => void;
  bulkUpsert: (events: RMSMarketEvent[]) => { added: number; updated: number; duplicates: number };
  applySearchResult: (r: EventSearchResult) => SyncLogEntry;

  // sources
  toggleSource: (id: string, active: boolean) => void;
  setAutoSync: (v: boolean) => void;

  // filters
  setFilters: (patch: Partial<EventFilters>) => void;
  resetFilters: () => void;

  // selectors
  getFilteredEvents: () => RMSMarketEvent[];
  getEventsForDate: (date: string) => RMSMarketEvent[];
  getPressureForDate: (date: string) => MarketPressureIndex | undefined;
  getPressureWindow: (from: string, to: string) => Record<string, MarketPressureIndex>;
  getKpis: () => {
    upcoming: number;
    critical: number;
    influencedAdrPct: number;
    influencedRevparPct: number;
    activeSources: number;
    avgReliability: number;
  };
}

const now = () => new Date().toISOString();

export const useEventsStore = create<EventsStore>()(
  persist(
    (set, get) => ({
      events: SEED_PARIS_EVENTS,
      sources: EVENT_SOURCE_LIBRARY,
      filters: DEFAULT_FILTERS,
      syncLogs: [],
      autoSync: true,

      addEvent: (ev) =>
        set((s) => ({
          events: [
            ...s.events,
            {
              ...ev,
              impact: { ...ev.impact, level: scoreToLevel(aggregateImpact(ev.impact)) },
              createdAt: ev.createdAt ?? now(),
              updatedAt: now(),
              history: [
                ...(ev.history ?? []),
                { at: now(), action: 'created' as const, source: 'manual' },
              ],
            },
          ],
        })),

      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...patch,
                  impact: patch.impact
                    ? { ...patch.impact, level: scoreToLevel(aggregateImpact(patch.impact)) }
                    : e.impact,
                  updatedAt: now(),
                  history: [
                    ...e.history,
                    { at: now(), action: 'manual_edit' as const },
                  ],
                }
              : e,
          ),
        })),

      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      duplicateEvent: (id) =>
        set((s) => {
          const src = s.events.find((e) => e.id === id);
          if (!src) return s;
          const copy: RMSMarketEvent = {
            ...src,
            id: `${src.id}_copy_${Date.now()}`,
            name: `${src.name} (copie)`,
            status: 'planned',
            rmsSynced: false,
            createdAt: now(),
            updatedAt: now(),
            history: [{ at: now(), action: 'created' as const, source: 'duplicate' }],
          };
          return { events: [...s.events, copy] };
        }),

      setStatus: (id, status) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status,
                  updatedAt: now(),
                  history: [
                    ...e.history,
                    { at: now(), action: 'manual_edit' as const, diff: `status → ${status}` },
                  ],
                }
              : e,
          ),
        })),

      attachHotels: (id, hotelIds) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, attachedHotels: hotelIds, updatedAt: now() } : e,
          ),
        })),

      bulkUpsert: (incoming) => {
        const state = get();
        const byId = new Map(state.events.map((e) => [e.id, e]));
        let added = 0;
        let updated = 0;
        for (const ev of incoming) {
          if (byId.has(ev.id)) {
            byId.set(ev.id, { ...byId.get(ev.id)!, ...ev, updatedAt: now() });
            updated++;
          } else {
            byId.set(ev.id, ev);
            added++;
          }
        }
        const merged = Array.from(byId.values());
        const { deduped, merged: dups } = dedupEvents(merged);
        set({ events: deduped });
        return { added, updated, duplicates: dups };
      },

      applySearchResult: (r) => {
        const start = Date.now();
        const stats = get().bulkUpsert(r.events);
        const entry: SyncLogEntry = {
          at: now(),
          city: r.query.city,
          sourcesQueried: r.sourcesQueried,
          added: stats.added,
          updated: stats.updated,
          duplicates: r.duplicatesMerged + stats.duplicates,
          errors: r.errors.length,
          durationMs: Date.now() - start,
        };
        set((s) => ({
          syncLogs: [entry, ...s.syncLogs].slice(0, 30),
          lastSearchAt: entry.at,
        }));
        return entry;
      },

      toggleSource: (id, active) =>
        set((s) => ({
          sources: s.sources.map((src) => (src.id === id ? { ...src, active } : src)),
        })),

      setAutoSync: (v) => set({ autoSync: v }),

      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      getFilteredEvents: () => {
        const { events, filters } = get();
        const q = filters.search.trim().toLowerCase();
        return events
          .filter((e) => {
            if (filters.activeOnly && e.status !== 'active') return false;
            if (filters.statuses.length && !filters.statuses.includes(e.status)) return false;
            if (filters.categories.length && !filters.categories.includes(e.category)) return false;
            if (filters.cities.length && !filters.cities.includes(e.city)) return false;
            if (filters.sources.length && !e.sources.some((s) => filters.sources.includes(s))) return false;
            if (filters.fromDate && e.endDate < filters.fromDate) return false;
            if (filters.toDate && e.startDate > filters.toDate) return false;
            if (
              filters.minImpact &&
              IMPACT_LEVEL_ORDER[e.impact.level] < IMPACT_LEVEL_ORDER[filters.minImpact]
            )
              return false;
            if (q) {
              const blob =
                `${e.name} ${e.city} ${e.zone ?? ''} ${e.venue ?? ''} ${e.primarySource}`.toLowerCase();
              if (!blob.includes(q)) return false;
            }
            return true;
          })
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
      },

      getEventsForDate: (date) =>
        get().events.filter((e) => e.startDate <= date && e.endDate >= date && e.status !== 'archived'),

      getPressureForDate: (date) => {
        const idx = buildMarketPressureIndex(get().events, date, date);
        return idx[date];
      },

      getPressureWindow: (from, to) => buildMarketPressureIndex(get().events, from, to),

      getKpis: () => {
        const today = now().slice(0, 10);
        const { events, sources } = get();
        const upcoming = events.filter((e) => e.endDate >= today && e.status !== 'archived').length;
        const critical = events.filter(
          (e) => e.endDate >= today && (e.impact.level === 'critical' || e.impact.level === 'high'),
        ).length;
        const activeSrc = sources.filter((s) => s.active);
        const avgRel = activeSrc.length
          ? Math.round(activeSrc.reduce((s, x) => s + x.reliabilityScore, 0) / activeSrc.length)
          : 0;
        const adrWeighted = events
          .filter((e) => e.endDate >= today)
          .reduce((s, e) => s + e.impact.adr * (e.impact.confidence / 100), 0);
        const revparWeighted = events
          .filter((e) => e.endDate >= today)
          .reduce((s, e) => s + e.impact.revpar * (e.impact.confidence / 100), 0);
        const n = Math.max(1, upcoming);
        return {
          upcoming,
          critical,
          influencedAdrPct: +(adrWeighted / n).toFixed(1),
          influencedRevparPct: +(revparWeighted / n).toFixed(1),
          activeSources: activeSrc.length,
          avgReliability: avgRel,
        };
      },
    }),
    {
      name: 'flowtym_events_module',
      partialize: (s) => ({
        events: s.events,
        sources: s.sources,
        autoSync: s.autoSync,
        syncLogs: s.syncLogs,
      }),
    },
  ),
);
