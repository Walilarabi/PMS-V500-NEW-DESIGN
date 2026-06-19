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
import { EVENT_SOURCE_LIBRARY } from '../data/eventSourceLibrary';
import {
  aggregateImpact,
  buildMarketPressureIndex,
  dedupEvents,
  scoreToLevel,
} from '../services/event-impact.engine';
import {
  loadEventsFromSupabase,
  createEventInSupabase,
  updateEventInSupabase,
  deleteEventFromSupabase,
  batchUpsertEventsInSupabase,
} from '../services/events/eventsRepository';
import { normalizeImpact, safeImpact } from '../lib/rms/eventDisplay';

export interface SyncLogEntry {
  at: string;
  city: string;
  sourcesQueried: number;
  /** Événements en attente de validation utilisateur (post-recherche). */
  pending: number;
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
  durationMs: number;
  /** Détail par source — utilisé pour le rapport de synchronisation UI */
  perSource?: { sourceId: string; sourceName: string; events: number; status: 'ok' | 'error'; message?: string }[];
  /** Liste des erreurs détaillées (sourceId + message) */
  errorDetails?: { sourceId: string; message: string }[];
}

/**
 * Trace d'un événement refusé par l'utilisateur dans la modale de validation.
 * Alimente l'historique de décisions et permet au moteur IA d'ajuster ses
 * futures détections (apprentissage métier).
 */
export interface RefusedEventEntry {
  id: string;            // id de l'événement original
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  primarySource: string;
  reason: 'irrelevant' | 'duplicate' | 'impact_overestimated' | 'wrong_location' | 'cancelled' | 'false_positive' | 'other';
  comment?: string;
  refusedAt: string;
}

export interface EventFilters {
  search: string;
  categories: EventCategory[];
  cities: string[];
  countries: string[];
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
  countries: [],
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
  refusedEvents: RefusedEventEntry[];
  /** Événements détectés en attente de validation utilisateur (modale). */
  pendingValidation: RMSMarketEvent[];
  autoSync: boolean;
  lastSearchAt?: string;
  /** true après le premier chargement réussi depuis Supabase. */
  supabaseSynced: boolean;
  /** Non-null quand la dernière écriture Supabase a échoué (affiché dans l'UI). */
  saveError: string | null;
  clearSaveError: () => void;

  // mutations
  addEvent: (ev: RMSMarketEvent) => void;
  updateEvent: (id: string, patch: Partial<RMSMarketEvent>) => void;
  deleteEvent: (id: string) => void;
  /** Charge les événements depuis Supabase et remplace le store (sans toucher au cache local). */
  syncFromSupabase: () => Promise<void>;
  duplicateEvent: (id: string) => void;
  setStatus: (id: string, status: EventStatus) => void;
  attachHotels: (id: string, hotelIds: string[]) => void;
  bulkUpsert: (events: RMSMarketEvent[]) => { added: number; updated: number; duplicates: number };
  applySearchResult: (r: EventSearchResult) => SyncLogEntry;
  /** Ouvre la modale de validation avec les candidats. */
  setPendingValidation: (events: RMSMarketEvent[]) => void;
  clearPendingValidation: () => void;
  /** Trace les refus utilisateurs — feedback IA. */
  addRefusedEvents: (events: RMSMarketEvent[], opts: { reason: RefusedEventEntry['reason']; comment?: string }) => void;

  // sources
  toggleSource: (id: string, active: boolean) => void;
  addSource: (source: EventSource) => void;
  removeSource: (id: string) => void;
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
      events: [],
      sources: EVENT_SOURCE_LIBRARY,
      filters: DEFAULT_FILTERS,
      syncLogs: [],
      refusedEvents: [],
      pendingValidation: [],
      autoSync: true,
      supabaseSynced: false,
      saveError: null,

      syncFromSupabase: async () => {
        const result = await loadEventsFromSupabase();
        if (result === null) return; // pas d'auth — on garde le localStorage
        // Sanitisation OBLIGATOIRE : Supabase peut renvoyer des events legacy
        // (snapshots v<5) sans `impact.compression` / `.demand` / `.level`.
        // Sans cette passe, les selectors `getPressureForDate` /
        // `getPressureWindow` (consommés par RMS Tableau, Calendar, Planning)
        // crashent dès le premier accès via aggregateImpact.
        if (result.events.length > 0) {
          const sanitizedEvents = result.events.map((e) => ({
            ...e,
            impact: normalizeImpact(e),
            history: e.history ?? [],
            sources: e.sources ?? [],
          })) as RMSMarketEvent[];
          set({ events: sanitizedEvents, supabaseSynced: true });
        } else {
          set({ supabaseSynced: true });
        }
      },

      clearSaveError: () => set({ saveError: null }),

      addEvent: (ev) => {
        // Garde-fou : un event manuel ou injecté peut avoir un impact partiel.
        // On normalise avant tout calcul pour éviter `aggregateImpact(undefined)`.
        const normalizedImpact = normalizeImpact(ev);
        const enriched: RMSMarketEvent = {
          ...ev,
          impact: { ...normalizedImpact, level: scoreToLevel(aggregateImpact(normalizedImpact)) },
          createdAt: ev.createdAt ?? now(),
          updatedAt: now(),
          history: [
            ...(ev.history ?? []),
            { at: now(), action: 'created' as const, source: 'manual' },
          ],
        };
        set((s) => ({ events: [...s.events, enriched] }));
        createEventInSupabase(enriched)
          .then((r) => { if (!r.ok) set({ saveError: r.error ?? 'Événement non sauvegardé (Supabase)' }); })
          .catch(() => { /* hors-ligne — silencieux */ });
      },

      updateEvent: (id, patch) => {
        let updated: RMSMarketEvent | null = null;
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== id) return e;
            // patch.impact peut être partiel (slider unique modifié) :
            // on normalise avant d'agréger pour éviter NaN/undefined.
            const patchedImpact = patch.impact
              ? normalizeImpact({ impact: { ...e.impact, ...patch.impact } })
              : null;
            const next: RMSMarketEvent = {
              ...e,
              ...patch,
              impact: patchedImpact
                ? { ...patchedImpact, level: scoreToLevel(aggregateImpact(patchedImpact)) }
                : normalizeImpact(e),
              updatedAt: now(),
              history: [
                ...e.history,
                { at: now(), action: 'manual_edit' as const },
              ],
            };
            updated = next;
            return next;
          }),
        }));
        if (updated) {
          updateEventInSupabase(id, updated)
            .then((r) => { if (!r.ok) set({ saveError: r.error ?? 'Modification non sauvegardée (Supabase)' }); })
            .catch(() => { /* hors-ligne — silencieux */ });
        }
      },

      deleteEvent: (id) => {
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
        deleteEventFromSupabase(id)
          .then((r) => { if (!r.ok) set({ saveError: r.error ?? 'Suppression non sauvegardée (Supabase)' }); })
          .catch(() => { /* hors-ligne — silencieux */ });
      },

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
        const today = now().slice(0, 10);
        const byId = new Map(state.events.map((e) => [e.id, e]));
        let added = 0;
        let updated = 0;
        // Sanitisation à l'entrée du store : un import live (Ticketmaster,
        // OpenAgenda, Excel) peut livrer des events à impact partiel ou
        // absent. On normalise UNE fois ici → plus aucun consommateur en
        // aval (engine, bridge RMS, composants UI) n'a à se défendre.
        const sanitized = incoming.map((ev) => ({
          ...ev,
          impact: normalizeImpact(ev),
          history: ev.history ?? [],
          sources: ev.sources ?? [],
        })) as RMSMarketEvent[];
        for (const ev of sanitized) {
          const existing = byId.get(ev.id);
          if (existing) {
            // règle métier : on ne met à jour QUE les événements futurs ;
            // l'historique des événements passés est préservé.
            if (existing.endDate < today) continue;
            byId.set(ev.id, {
              ...existing,
              ...ev,
              history: [
                ...existing.history,
                { at: now(), action: 'updated' as const, source: ev.primarySource },
              ],
              updatedAt: now(),
            });
            updated++;
          } else {
            byId.set(ev.id, ev);
            added++;
          }
        }
        const merged = Array.from(byId.values());
        const { deduped, merged: dups } = dedupEvents(merged);
        set({ events: deduped });
        // Sync Supabase batch (fire-and-forget) — uniquement les nouveaux/modifiés.
        const toSync = deduped.filter((e) => sanitized.some((i) => i.id === e.id));
        if (toSync.length > 0) {
          batchUpsertEventsInSupabase(toSync)
            .then((r) => { if (!r.ok) set({ saveError: r.error ?? 'Import non sauvegardé (Supabase)' }); })
            .catch(() => { /* hors-ligne — silencieux */ });
        }
        // Propagation RMS automatique — déclenche le Central Pricing Engine et
        // le signal eventIntensity pour l'autopilote (effets de bord async).
        // `sanitized` garantit `impact.compression` numérique : plus de
        // TypeError quand l'event vient d'une source live à valider.
        const newAndUpdated = sanitized.filter(
          (ev) => ev.impact.compression >= 0, // toutes les gammes
        );
        if (newAndUpdated.length > 0) {
          import('@/src/services/event-rms-integration.service')
            .then(({ integrateEventsToRMS }) => integrateEventsToRMS(newAndUpdated))
            .catch(() => { /* best-effort — ne bloque pas l'UI */ });
        }
        return { added, updated, duplicates: dups };
      },

      applySearchResult: (r) => {
        const start = Date.now();
        // L'utilisateur garde le contrôle : on présente TOUS les événements
        // détectés (sauf ceux explicitement refusés) dans la modale de
        // validation. Les événements déjà intégrés seront simplement
        // ré-affichés (badge "déjà intégré") et l'acceptation est idempotente.
        const state = get();
        const refusedIds = new Set(state.refusedEvents.map((e) => e.id));
        const knownIds = new Set(state.events.map((e) => e.id));
        // Sanitisation des candidats : le moteur live peut renvoyer un
        // event sans impact (compression/level absents) — on garantit un
        // ImpactScore complet pour que la modale de validation et la
        // propagation RMS ne crash plus.
        const candidates = r.events
          .filter((e) => !refusedIds.has(e.id))
          .map((e) => ({ ...e, impact: normalizeImpact(e) }) as RMSMarketEvent);
        const newCount = candidates.filter((e) => !knownIds.has(e.id)).length;
        const extended = r as EventSearchResult & {
          perSource?: SyncLogEntry['perSource'];
        };
        const entry: SyncLogEntry = {
          at: now(),
          city: r.query.city,
          sourcesQueried: r.sourcesQueried,
          pending: newCount,
          added: 0,
          updated: 0,
          duplicates: r.duplicatesMerged,
          errors: r.errors.length,
          durationMs: Date.now() - start,
          perSource: extended.perSource,
          errorDetails: r.errors,
        };
        set((s) => ({
          syncLogs: [entry, ...s.syncLogs].slice(0, 30),
          lastSearchAt: entry.at,
          pendingValidation: candidates,
        }));
        return entry;
      },

      setPendingValidation: (events) => set({
        // Idem applySearchResult : tout event entrant dans le store doit
        // arriver avec un ImpactScore complet.
        pendingValidation: events.map((e) => ({ ...e, impact: normalizeImpact(e) }) as RMSMarketEvent),
      }),
      clearPendingValidation: () => set({ pendingValidation: [] }),

      addRefusedEvents: (events, opts) =>
        set((s) => {
          const refusedAt = now();
          const entries: RefusedEventEntry[] = events.map((e) => ({
            id: e.id,
            name: e.name,
            city: e.city,
            startDate: e.startDate,
            endDate: e.endDate,
            primarySource: e.primarySource,
            reason: opts.reason,
            comment: opts.comment,
            refusedAt,
          }));
          return {
            refusedEvents: [...entries, ...s.refusedEvents].slice(0, 200),
            pendingValidation: s.pendingValidation.filter((e) => !events.some((x) => x.id === e.id)),
          };
        }),

      toggleSource: (id, active) =>
        set((s) => ({
          sources: s.sources.map((src) => (src.id === id ? { ...src, active } : src)),
        })),

      addSource: (source) => {
        set((s) => ({ sources: [...s.sources, source] }));
        // Sync Supabase best-effort (uniquement pour les sources custom)
        if (source.id.startsWith('custom_')) {
          import('@/src/services/settings/settingsPersistence')
            .then((m) => m.syncEventSourceToSupabase(source))
            .catch(() => { /* offline ok */ });
        }
      },

      removeSource: (id) => {
        set((s) => ({ sources: s.sources.filter((src) => src.id !== id) }));
        if (id.startsWith('custom_')) {
          import('@/src/services/settings/settingsPersistence')
            .then((m) => m.deleteEventSourceFromSupabase(id))
            .catch(() => { /* offline ok */ });
        }
      },

      setAutoSync: (v) => set({ autoSync: v }),

      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      getFilteredEvents: () => {
        const { events, filters } = get();
        const q = filters.search.trim().toLowerCase();
        // Ceinture+bretelles : si un event échappe à la sanitisation amont
        // (cache localStorage corrompu, hot-reload partiel, etc.), on
        // re-normalise à la volée. Aucun consumer ne peut crasher en aval.
        const safeEvents = events.map((e) => ({
          ...e,
          impact: normalizeImpact(e),
          history: e.history ?? [],
          sources: e.sources ?? [],
        })) as RMSMarketEvent[];
        return safeEvents
          .filter((e) => {
            if (filters.activeOnly && e.status !== 'active') return false;
            if (filters.statuses.length && !filters.statuses.includes(e.status)) return false;
            if (filters.categories.length && !filters.categories.includes(e.category)) return false;
            if (filters.cities.length && !filters.cities.includes(e.city)) return false;
            if ((filters.countries ?? []).length && !filters.countries!.includes(e.country)) return false;
            if (filters.sources.length && !e.sources.some((s) => filters.sources.includes(s))) return false;
            if (filters.fromDate && e.endDate < filters.fromDate) return false;
            if (filters.toDate && e.startDate > filters.toDate) return false;
            if (
              filters.minImpact &&
              IMPACT_LEVEL_ORDER[safeImpact(e).level] < IMPACT_LEVEL_ORDER[filters.minImpact]
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
        // Garde-fous : un événement venant de Supabase ou d'une recherche
        // live à valider peut avoir impact partiel (impact undefined, ou
        // impact sans level/adr/revpar/confidence). Avant ces guards,
        // `e.impact.level` crashait au filter → EventsView ne s'affichait
        // jamais (TypeError remontait à l'ErrorBoundary global).
        const safeNum = (v: unknown): number =>
          typeof v === 'number' && Number.isFinite(v) ? v : 0;
        const today = now().slice(0, 10);
        const { events, sources } = get();
        const upcoming = events.filter(
          (e) => (e.endDate ?? '') >= today && e.status !== 'archived',
        ).length;
        const critical = events.filter(
          (e) =>
            (e.endDate ?? '') >= today &&
            (e.impact?.level === 'critical' || e.impact?.level === 'high'),
        ).length;
        const activeSrc = sources.filter((s) => s.active);
        const avgRel = activeSrc.length
          ? Math.round(
              activeSrc.reduce((s, x) => s + safeNum(x.reliabilityScore), 0) / activeSrc.length,
            )
          : 0;
        const adrWeighted = events
          .filter((e) => (e.endDate ?? '') >= today)
          .reduce(
            (s, e) =>
              s + safeNum(e.impact?.adr) * (safeNum(e.impact?.confidence) / 100),
            0,
          );
        const revparWeighted = events
          .filter((e) => (e.endDate ?? '') >= today)
          .reduce(
            (s, e) =>
              s + safeNum(e.impact?.revpar) * (safeNum(e.impact?.confidence) / 100),
            0,
          );
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
      // v6 : force re-normalize via migrate sur tous les snapshots existants
      // pour éliminer les events legacy avec impact partiel responsables
      // du crash « Cannot read properties of undefined (reading
      // 'compression') » à l'ouverture du module Événements.
      version: 6,
      migrate: (persisted, _version) => {
        // Quel que soit le format précédent, on re-normalise tous les
        // events. Pas de perte de données utilisateur.
        const p = (persisted ?? {}) as Partial<EventsStore>;
        const sanitizedEvents = (p.events ?? []).map((e) => ({
          ...e,
          impact: normalizeImpact(e),
          history: e.history ?? [],
          sources: e.sources ?? [],
        })) as RMSMarketEvent[];
        return { ...p, events: sanitizedEvents } as EventsStore;
      },
      partialize: (s) => ({
        events: s.events,
        sources: s.sources,
        autoSync: s.autoSync,
        syncLogs: s.syncLogs,
        refusedEvents: s.refusedEvents,
        // Mémorisation des filtres entre sessions (dernière vue utilisateur).
        filters: s.filters,
      }),
      // Merge robuste : garantit que les champs récents (countries…) ne sont
      // jamais `undefined` même si le snapshot persistant date d'avant leur
      // ajout. Indispensable pour éviter les crashs au démarrage.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<EventsStore>;
        // Sanitise les events persistés : un snapshot v<5 peut contenir
        // des events sans `impact.compression` (champ ajouté plus tard).
        // Sans cette passe, le premier `bulkUpsert` ou `getFilteredEvents`
        // après reload crashait avec « Cannot read properties of undefined ».
        const sanitizedEvents = (p.events ?? []).map((e) => ({
          ...e,
          impact: normalizeImpact(e),
          history: e.history ?? [],
          sources: e.sources ?? [],
        })) as RMSMarketEvent[];
        return {
          ...current,
          ...p,
          events: sanitizedEvents,
          filters: { ...DEFAULT_FILTERS, ...(p.filters ?? {}) },
          // Réinitialise supabaseSynced à chaque démarrage — force un rechargement Supabase.
          supabaseSynced: false,
        };
      },
    },
  ),
);
