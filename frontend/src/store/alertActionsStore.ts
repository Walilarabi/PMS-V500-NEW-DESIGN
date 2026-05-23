/**
 * FLOWTYM RMS — Alert actions store
 *
 * Persiste l'état utilisateur de chaque alerte (acquittée / résolue / rejetée)
 * + un journal des actions pour audit trail. Les IDs d'alertes étant stables
 * (cf. alertsEngine.ts), la persistance survit aux recalculs : si l'utilisateur
 * acquitte une alerte, elle reste acquittée quand l'engine la régénère.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

export interface AlertActionLog {
  alertId: string;
  status: AlertStatus;
  at: string; // ISO
  note?: string;
}

interface AlertActionsStore {
  /** Statut courant de chaque alerte. Les alertes non listées sont 'open'. */
  status: Record<string, AlertStatus>;
  /** Journal complet (les 200 dernières actions). */
  log: AlertActionLog[];

  acknowledge: (alertId: string, note?: string) => void;
  resolve: (alertId: string, note?: string) => void;
  dismiss: (alertId: string, note?: string) => void;
  reopen: (alertId: string) => void;

  getStatus: (alertId: string) => AlertStatus;
  clearAll: () => void;
}

const MAX_LOG = 200;

function setStatus(
  state: AlertActionsStore,
  alertId: string,
  status: AlertStatus,
  note?: string
) {
  const next = { ...state.status, [alertId]: status };
  const entry: AlertActionLog = {
    alertId,
    status,
    at: new Date().toISOString(),
    note,
  };
  const log = [entry, ...state.log].slice(0, MAX_LOG);
  return { status: next, log };
}

export const useAlertActionsStore = create<AlertActionsStore>()(
  persist(
    (set, get) => ({
      status: {},
      log: [],

      acknowledge: (alertId, note) =>
        set((s) => setStatus(s, alertId, 'acknowledged', note)),
      resolve: (alertId, note) => set((s) => setStatus(s, alertId, 'resolved', note)),
      dismiss: (alertId, note) => set((s) => setStatus(s, alertId, 'dismissed', note)),
      reopen: (alertId) =>
        set((s) => {
          const next = { ...s.status };
          delete next[alertId];
          const entry: AlertActionLog = {
            alertId,
            status: 'open',
            at: new Date().toISOString(),
            note: 'Réouverte',
          };
          return { status: next, log: [entry, ...s.log].slice(0, MAX_LOG) };
        }),

      getStatus: (alertId) => get().status[alertId] ?? 'open',
      clearAll: () => set({ status: {}, log: [] }),
    }),
    {
      name: 'flowtym_alert_actions',
      partialize: (state) => ({ status: state.status, log: state.log }),
    }
  )
);
