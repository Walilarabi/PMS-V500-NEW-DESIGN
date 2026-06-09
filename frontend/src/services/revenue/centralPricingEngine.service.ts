/**
 * FLOWTYM — Central Pricing Engine
 *
 * SOURCE DE VÉRITÉ UNIQUE pour les recommandations tarifaires par date.
 *
 * Problème résolu : avant ce service, chaque module (Veille, RMS Tableau,
 * Recommandations RM, Analyse RM, Calendrier) calculait et stockait sa
 * propre recommandation. Résultat : pour le 28/05/2026, Veille affichait
 * 459€, le tableau RMS un autre prix, le calendrier encore un autre.
 *
 * Avec ce service :
 *   - UNE SEULE recommandation tarifaire par date
 *   - UN SEUL statut de validation (pending / accepted / rejected / maintained)
 *   - UN SEUL tarif final
 *   - UNE SEULE source d'écriture (tous les modules passent par ce service)
 *   - Synchronisation temps réel via Pub/Sub (useSyncExternalStore + bus RMS)
 *
 * Persistance :
 *   - Mémoire JS (Map) en source primaire
 *   - LocalStorage pour persister entre sessions (clé flowtym.pricing.records)
 *   - Tentative best-effort de push vers Supabase rms_decisions (déjà existant)
 *
 * Lecture :
 *   centralPricingEngine.get('2026-05-28') → PricingRecord | null
 *   centralPricingEngine.getOrSeed('2026-05-28', { current: 200, suggested: 459 })
 *
 * Écriture (toutes les actions UI passent par ces 3 méthodes) :
 *   centralPricingEngine.accept('2026-05-28', { source: 'veille' })
 *   centralPricingEngine.reject('2026-05-28', { manualPrice: 420, reason: '...', source: 'veille' })
 *   centralPricingEngine.maintain('2026-05-28', { source: 'rms-table' })
 */

import { emitRmsEvent } from '@/src/lib/rms/eventBus';
import { recordRmsDecision } from '@/src/services/rms-decisions.service';

export type PricingStatus = 'pending' | 'accepted' | 'rejected' | 'maintained';
export type PricingSource = 'veille' | 'rms-table' | 'rms-reco' | 'rms-analyse' | 'calendar' | 'autopilot' | 'api';

export interface PricingHistoryEntry {
  timestamp: string;
  action: 'create' | 'update' | 'accept' | 'reject' | 'maintain' | 'autopush';
  source: PricingSource;
  previousPrice?: number;
  newPrice?: number;
  reason?: string;
  comment?: string;
  userId?: string | null;
}

export interface PricingRecord {
  /** YYYY-MM-DD — clé unique par date pour le même hôtel/room/plan. */
  date: string;
  /** Code chambre (optionnel ; null = global pour le jour). */
  roomTypeCode: string | null;
  /** ID plan tarifaire (optionnel ; null = plan référent). */
  planId: string | null;
  /** Prix actuellement en vente (= source calendrier). */
  currentPrice: number;
  /** Prix recommandé par le moteur RMS (déjà pondéré NRF si applicable). */
  suggestedPrice: number;
  /** Prix final validé (null = pas encore décidé). */
  finalPrice: number | null;
  /** Statut de la décision. */
  status: PricingStatus;
  /** Module/UI qui a émis la dernière décision. */
  source: PricingSource;
  /** Confiance IA 0–100 (informationnel). */
  confidence?: number;
  /** Stratégie active au moment de la décision. */
  strategy?: string;
  /** Justification métier (motif refus, contexte…). */
  reason?: string;
  /** Commentaire libre RM. */
  comment?: string;
  /** Historique complet de toutes les actions sur cette date (append-only). */
  history: PricingHistoryEntry[];
  /** Dernière mise à jour. */
  updatedAt: string;
  /** User qui a effectué la dernière action. */
  updatedBy?: string | null;
}

const STORAGE_KEY = 'flowtym.pricing.records';

function loadFromStorage(): Map<string, PricingRecord> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as PricingRecord[];
    return new Map(arr.map((r) => [keyOf(r.date, r.roomTypeCode, r.planId), r]));
  } catch {
    return new Map();
  }
}

function persistToStorage(records: Map<string, PricingRecord>) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(records.values());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {/* quota / disabled */}
}

/** Clé unique : date + room + plan. Permet plusieurs records par date si besoin. */
function keyOf(date: string, roomTypeCode: string | null = null, planId: string | null = null): string {
  return `${date}|${roomTypeCode ?? '*'}|${planId ?? '*'}`;
}

let records: Map<string, PricingRecord> = loadFromStorage();
const listeners = new Set<() => void>();
let version = 0;

const MAX_HISTORY = 20;
function capHistory(history: PricingHistoryEntry[]): PricingHistoryEntry[] {
  return history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history;
}

function notify() {
  version++;
  listeners.forEach((l) => l());
  persistToStorage(records);
}

function nowISO() { return new Date().toISOString(); }

export interface UpsertSeed {
  current: number;
  suggested: number;
  confidence?: number;
  strategy?: string;
  roomTypeCode?: string | null;
  planId?: string | null;
}

export const centralPricingEngine = {
  version(): number { return version; },

  /** Toutes les entrées (utile pour debug + UI globale). */
  all(): PricingRecord[] {
    return Array.from(records.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** Lit un record (sans le créer). */
  get(date: string, roomTypeCode: string | null = null, planId: string | null = null): PricingRecord | null {
    return records.get(keyOf(date, roomTypeCode, planId)) ?? null;
  },

  /**
   * Lit OU crée un record en seedant avec les valeurs courantes. Idempotent :
   * si un record existe déjà avec des valeurs validées, ne les écrase pas.
   * Si le suggested du seed diffère du suggested existant ET aucune décision
   * n'a été prise, le suggested est mis à jour (nouvelle recommandation moteur).
   */
  getOrSeed(date: string, seed: UpsertSeed): PricingRecord {
    const key = keyOf(date, seed.roomTypeCode ?? null, seed.planId ?? null);
    const existing = records.get(key);
    if (existing) {
      // Si toujours en attente et le moteur a un nouveau suggested, on update
      // SANS toucher au statut ni à finalPrice.
      // Pas de notify() ici : getOrSeed est appelé depuis useEffect d'enrichissement
      // qui dépend de centralPricingEngineVersion — notifier ici crée une boucle infinie.
      if (existing.status === 'pending' && seed.suggested !== existing.suggestedPrice) {
        const updated: PricingRecord = {
          ...existing,
          currentPrice: seed.current,
          suggestedPrice: seed.suggested,
          confidence: seed.confidence,
          strategy: seed.strategy,
          updatedAt: nowISO(),
          history: capHistory([
            ...existing.history,
            {
              timestamp: nowISO(),
              action: 'update',
              source: 'api',
              previousPrice: existing.suggestedPrice,
              newPrice: seed.suggested,
            },
          ]),
        };
        records.set(key, updated);
        // Persist silencieusement sans notifier (évite la boucle de re-render).
        persistToStorage(records);
        return updated;
      }
      return existing;
    }
    const record: PricingRecord = {
      date,
      roomTypeCode: seed.roomTypeCode ?? null,
      planId: seed.planId ?? null,
      currentPrice: seed.current,
      suggestedPrice: seed.suggested,
      finalPrice: null,
      status: 'pending',
      source: 'api',
      confidence: seed.confidence,
      strategy: seed.strategy,
      history: [{
        timestamp: nowISO(),
        action: 'create',
        source: 'api',
        newPrice: seed.suggested,
      }],
      updatedAt: nowISO(),
    };
    records.set(key, record);
    // Persist silencieusement sans notifier (évite la boucle de re-render).
    persistToStorage(records);
    return record;
  },

  /**
   * Accepter la recommandation : finalPrice = suggestedPrice.
   * Propagé à tous les modules + bus.
   */
  accept(
    date: string,
    opts: { source: PricingSource; roomTypeCode?: string | null; planId?: string | null; userId?: string | null } = { source: 'api' },
  ): PricingRecord | null {
    const key = keyOf(date, opts.roomTypeCode ?? null, opts.planId ?? null);
    const r = records.get(key);
    if (!r) return null;
    const finalPrice = r.suggestedPrice;
    const updated: PricingRecord = {
      ...r,
      finalPrice,
      status: 'accepted',
      source: opts.source,
      updatedAt: nowISO(),
      updatedBy: opts.userId ?? null,
      history: capHistory([
        ...r.history,
        {
          timestamp: nowISO(),
          action: 'accept',
          source: opts.source,
          previousPrice: r.finalPrice ?? r.currentPrice,
          newPrice: finalPrice,
          userId: opts.userId ?? null,
        },
      ]),
    };
    records.set(key, updated);
    notify();
    recordRmsDecision({
      stayDate: date,
      roomTypeCode: opts.roomTypeCode ?? null,
      action: 'accepted',
      currentPrice: r.currentPrice,
      suggestedPrice: r.suggestedPrice,
      finalPrice,
      strategy: r.strategy ?? '',
      recommendation: 'accepted',
      confidenceScore: r.confidence ?? null,
    }).catch(() => {/* best-effort */});
    try {
      emitRmsEvent('rms-decision:accepted', {
        decisionId: `${date}-${opts.roomTypeCode ?? 'all'}-${Date.now()}`,
        date,
        delta: finalPrice - r.currentPrice,
      });
    } catch {/* bus */}
    return updated;
  },

  /**
   * Refuser : finalPrice = manualPrice (ou currentPrice si pas fourni).
   * Conserve la raison + commentaire pour apprentissage IA.
   */
  reject(
    date: string,
    opts: {
      source: PricingSource;
      manualPrice?: number;
      reason?: string;
      comment?: string;
      roomTypeCode?: string | null;
      planId?: string | null;
      userId?: string | null;
    },
  ): PricingRecord | null {
    const key = keyOf(date, opts.roomTypeCode ?? null, opts.planId ?? null);
    const r = records.get(key);
    if (!r) return null;
    const finalPrice = opts.manualPrice && opts.manualPrice > 0 ? Math.round(opts.manualPrice) : r.currentPrice;
    const updated: PricingRecord = {
      ...r,
      finalPrice,
      status: 'rejected',
      source: opts.source,
      reason: opts.reason,
      comment: opts.comment,
      updatedAt: nowISO(),
      updatedBy: opts.userId ?? null,
      history: capHistory([
        ...r.history,
        {
          timestamp: nowISO(),
          action: 'reject',
          source: opts.source,
          previousPrice: r.finalPrice ?? r.currentPrice,
          newPrice: finalPrice,
          reason: opts.reason,
          comment: opts.comment,
          userId: opts.userId ?? null,
        },
      ]),
    };
    records.set(key, updated);
    notify();
    recordRmsDecision({
      stayDate: date,
      roomTypeCode: opts.roomTypeCode ?? null,
      action: 'rejected',
      currentPrice: r.currentPrice,
      suggestedPrice: r.suggestedPrice,
      finalPrice,
      strategy: r.strategy ?? '',
      recommendation: 'rejected',
      confidenceScore: r.confidence ?? null,
    }).catch(() => {/* best-effort */});
    try {
      emitRmsEvent('rms-decision:rejected', {
        decisionId: `${date}-${opts.roomTypeCode ?? 'all'}-${Date.now()}`,
      });
    } catch {/* bus */}
    return updated;
  },

  /**
   * Maintenir : finalPrice = currentPrice (statu quo, mais traçé).
   */
  maintain(
    date: string,
    opts: {
      source: PricingSource;
      reason?: string;
      comment?: string;
      roomTypeCode?: string | null;
      planId?: string | null;
      userId?: string | null;
    },
  ): PricingRecord | null {
    const key = keyOf(date, opts.roomTypeCode ?? null, opts.planId ?? null);
    const r = records.get(key);
    if (!r) return null;
    const finalPrice = r.currentPrice;
    const updated: PricingRecord = {
      ...r,
      finalPrice,
      status: 'maintained',
      source: opts.source,
      reason: opts.reason,
      comment: opts.comment,
      updatedAt: nowISO(),
      updatedBy: opts.userId ?? null,
      history: capHistory([
        ...r.history,
        {
          timestamp: nowISO(),
          action: 'maintain',
          source: opts.source,
          previousPrice: r.finalPrice ?? r.currentPrice,
          newPrice: finalPrice,
          reason: opts.reason,
          comment: opts.comment,
          userId: opts.userId ?? null,
        },
      ]),
    };
    records.set(key, updated);
    notify();
    recordRmsDecision({
      stayDate: date,
      roomTypeCode: opts.roomTypeCode ?? null,
      action: 'maintained',
      currentPrice: r.currentPrice,
      suggestedPrice: r.suggestedPrice,
      finalPrice,
      strategy: r.strategy ?? '',
      recommendation: 'maintained',
      confidenceScore: r.confidence ?? null,
    }).catch(() => {/* best-effort */});
    try {
      emitRmsEvent('rms-decision:accepted', {
        decisionId: `${date}-${opts.roomTypeCode ?? 'all'}-${Date.now()}`,
        date,
        delta: 0,
      });
    } catch {/* bus */}
    return updated;
  },

  /** Marque un record comme poussé au Channel Manager. */
  markAutopush(date: string, finalPrice: number, source: PricingSource = 'autopilot', roomTypeCode: string | null = null, planId: string | null = null) {
    const key = keyOf(date, roomTypeCode, planId);
    const r = records.get(key);
    if (!r) return;
    const updated: PricingRecord = {
      ...r,
      finalPrice,
      updatedAt: nowISO(),
      history: capHistory([
        ...r.history,
        { timestamp: nowISO(), action: 'autopush', source, newPrice: finalPrice },
      ]),
    };
    records.set(key, updated);
    notify();
  },

  /** Subscribe pour les hooks React (useSyncExternalStore). */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Reset (tests uniquement). */
  clear() {
    records.clear();
    notify();
  },

  /** KPIs globaux (utile pour dashboard). */
  kpis(): { total: number; pending: number; accepted: number; rejected: number; maintained: number; revenueImpact: number } {
    let pending = 0, accepted = 0, rejected = 0, maintained = 0, revenueImpact = 0;
    for (const r of records.values()) {
      if (r.status === 'pending') pending++;
      else if (r.status === 'accepted') accepted++;
      else if (r.status === 'rejected') rejected++;
      else if (r.status === 'maintained') maintained++;
      if (r.finalPrice !== null) revenueImpact += (r.finalPrice - r.currentPrice);
    }
    return { total: records.size, pending, accepted, rejected, maintained, revenueImpact };
  },
};
