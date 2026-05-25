/**
 * FLOWTYM RMS — Auto-sync des sources événementielles
 *
 * Déclenche périodiquement le moteur de recherche événementielle
 * (`searchEvents`) en respectant la fréquence configurée par source
 * (realtime / 6h / daily / weekly / monthly / manual).
 *
 * Stratégie :
 *   • Toutes les 15 minutes (cadence de l'interval), on regarde quelles
 *     sources ont expiré leur fenêtre de sync et on les interroge.
 *   • Les résultats vont dans `pendingValidation` du store events —
 *     l'utilisateur conserve le contrôle via la modale de validation.
 *   • Le hook respecte la flag `autoSync` du store (off → rien ne tourne).
 *   • Pause sur visibilité (économie réseau quand l'onglet n'est pas actif).
 */

import { useEffect, useRef } from 'react';
import { useEventsStore } from '../store/eventsStore';
import { useConfigStore } from '../store/configStore';
import { searchEvents } from '../services/event-search.engine';
import { selectSourcesToSync } from '../services/marketIntelligence/sync-scheduler';

export interface AutoSyncOptions {
  /** Période de vérification (toutes les sources). Défaut 15 min. */
  checkIntervalMs?: number;
  /** Force activé même si store.autoSync = false (pour debug). */
  forceEnabled?: boolean;
}

/**
 * Lance la boucle de sync auto. À utiliser une fois au top-level de
 * l'application (ex: dans App ou un composant de session).
 */
export function useEventSourcesAutoSync(options: AutoSyncOptions = {}): void {
  const checkIntervalMs = options.checkIntervalMs ?? 15 * 60 * 1000;
  const storeRef = useRef({
    autoSync: useEventsStore.getState().autoSync,
    sources: useEventsStore.getState().sources,
    applySearchResult: useEventsStore.getState().applySearchResult,
  });
  const hotelCity = useConfigStore((s) => s.hotel.city);

  useEffect(() => {
    // Sync ref avec le store réel
    const unsub = useEventsStore.subscribe((state) => {
      storeRef.current = {
        autoSync: state.autoSync,
        sources: state.sources,
        applySearchResult: state.applySearchResult,
      };
    });
    return unsub;
  }, []);

  useEffect(() => {
    let docVisible = typeof document !== 'undefined' ? !document.hidden : true;

    const runCheck = async () => {
      const { autoSync, sources, applySearchResult } = storeRef.current;
      if (!options.forceEnabled && !autoSync) return;
      if (!docVisible) return;

      const now = Date.now();
      const city = hotelCity ?? 'Paris';
      const dueSources = selectSourcesToSync({ sources, city, now });
      if (dueSources.length === 0) return;

      // Fenêtre glissante : aujourd'hui → +6 mois
      const today = new Date().toISOString().slice(0, 10);
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      const fromDate = today;
      const toDate = sixMonthsLater.toISOString().slice(0, 10);

      try {
        const result = await searchEvents({
          city,
          fromDate,
          toDate,
          sourceIds: dueSources.map((s) => s.id),
        });
        applySearchResult(result);
      } catch (e) {
        // best-effort silencieux : la prochaine boucle réessayera
        if (typeof console !== 'undefined') {
          console.warn('[autoSync] event sources sync failed', e);
        }
      }
    };

    const onVisibility = () => {
      docVisible = !document.hidden;
      if (docVisible) {
        // Reprise après visibilité → check immédiat
        runCheck();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    // Premier check au démarrage (différé pour ne pas bloquer le mount)
    const initialTimer = window.setTimeout(runCheck, 2000);
    // Boucle régulière
    const interval = window.setInterval(runCheck, checkIntervalMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [checkIntervalMs, hotelCity, options.forceEnabled]);
}
