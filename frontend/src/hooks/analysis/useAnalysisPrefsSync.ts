/**
 * FLOWTYM — Sync préférences utilisateur au mount du module Analyse.
 *
 * Lance les 3 syncs en parallèle (favoris / récents / vues sauvegardées)
 * et renvoie un statut pour afficher un badge "Synchronisé" éventuel.
 */

import { useEffect, useState } from 'react';
import { syncAllPreferences } from '../../services/analysis/report-prefs.service';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'offline';
  lastSyncAt: string | null;
}

export function useAnalysisPrefsSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', lastSyncAt: null });

  useEffect(() => {
    let cancelled = false;
    setStatus(s => ({ ...s, state: 'syncing' }));

    syncAllPreferences()
      .then(() => {
        if (!cancelled) {
          setStatus({ state: 'synced', lastSyncAt: new Date().toISOString() });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ state: 'offline', lastSyncAt: null });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return status;
}
