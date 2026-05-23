/**
 * FLOWTYM — Journal d'audit RMS
 * Enregistre toutes les décisions, blocages, ajustements et conflits.
 */

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
const listeners = new Set<(events: AuditEvent[]) => void>();

function notify() {
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
    return entry;
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

  seed(events: AuditEvent[]) {
    store = [...events, ...store].slice(0, MAX_EVENTS);
    notify();
  },

  clear() {
    store = [];
    notify();
  },
};
