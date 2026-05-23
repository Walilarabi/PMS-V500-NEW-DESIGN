/**
 * FLOWTYM — Journal d'audit RMS
 * Enregistre toutes les décisions, blocages, ajustements et conflits.
 */

import { emitRmsEvent } from '@/src/lib/rms/eventBus';
import { persistAuditEvent, loadAuditLog } from './rmsEnterprisePersistence.service';

export type AuditEventType =
  | 'rule_triggered'
  | 'rule_adjusted'
  | 'rule_blocked'
  | 'guardrail_block'
  | 'guardrail_warn'
  | 'guardrail_adjust'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'priority_changed'
  | 'autopilot_push'
  | 'rollback';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  actor: string;             // ex: "Compression marché", "Plancher tarifaire"
  context: string;           // ex: "Chambre Standard - 19/05"
  detail: string;
  impact?: number;
  metadata?: Record<string, unknown>;
}

const MAX_EVENTS = 500;
let store: AuditEvent[] = [];
let version = 0;
const listeners = new Set<(events: AuditEvent[]) => void>();

function notify() {
  version++;
  listeners.forEach((l) => l(store));
}

export const rmsAuditLogger = {
  log(event: Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: string }): AuditEvent {
    const entry: AuditEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: event.timestamp ?? new Date().toISOString(),
      ...event,
    };
    store = [entry, ...store].slice(0, MAX_EVENTS);
    notify();
    try {
      emitRmsEvent('audit:logged', {
        eventId: entry.id,
        type: entry.type,
        actor: entry.actor,
      });
    } catch {
      // Bus indisponible (SSR / test) — on n'interrompt pas le journal
    }
    // Persistance (append-only) — fire-and-forget
    persistAuditEvent(entry).catch(() => {/* DB indisponible — journal local intact */});
    return entry;
  },

  /** Hydrate depuis Supabase (les N derniers événements). */
  async hydrate(limit = 50): Promise<void> {
    const rows = await loadAuditLog(limit);
    if (rows && rows.length > 0) {
      // Préserver tout ce qui a été loggé en mémoire après hydrate, en
      // évitant les doublons par id.
      const seen = new Set(store.map((e) => e.id));
      const incoming = rows.filter((e) => !seen.has(e.id));
      store = [...store, ...incoming]
        .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
        .slice(0, MAX_EVENTS);
      notify();
    }
  },

  all(): AuditEvent[] {
    return store;
  },

  byActor(actor: string): AuditEvent[] {
    return store.filter((e) => e.actor === actor);
  },

  byType(type: AuditEventType): AuditEvent[] {
    return store.filter((e) => e.type === type);
  },

  subscribe(listener: (events: AuditEvent[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Compteur référentiellement stable pour useSyncExternalStore. */
  version(): number { return version; },

  seed(events: AuditEvent[]) {
    store = [...events, ...store].slice(0, MAX_EVENTS);
    notify();
  },

  clear() {
    store = [];
    notify();
  },
};
