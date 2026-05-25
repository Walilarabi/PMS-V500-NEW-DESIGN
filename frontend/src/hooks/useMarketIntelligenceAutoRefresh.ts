/**
 * FLOWTYM RMS — Auto-refresh hook pour Market Intelligence
 *
 * Force un re-render périodique du moteur Market Intelligence en
 * invalidant le cache des snapshots mock (cas démo) et/ou en
 * déclenchant un signal réactif partagé.
 *
 * Comportement :
 *   • Pause automatique quand l'onglet n'est pas visible (économie CPU)
 *   • Toggle on/off via état local
 *   • Renvoie `lastTick` (Date) pour afficher "Mis à jour il y a Xs"
 *
 * Le moteur lui-même est mémoïsé sur ses inputs ; pour vraiment forcer
 * le recalcul, on tick une variable d'état partagée injectée dans les
 * dépendances du useMemo via une callback `onTick`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AutoRefreshOptions {
  /** Intervalle de refresh en ms. Défaut 5 min. */
  intervalMs?: number;
  /** Démarré par défaut ? Défaut false. */
  defaultEnabled?: boolean;
  /** Callback appelée à chaque tick (utile pour invalider des caches). */
  onTick?: () => void;
}

export interface AutoRefreshState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  lastTick: Date | null;
  /** Compteur incrémenté à chaque tick. Utilisable comme dep useMemo. */
  tickCount: number;
  /** Force un refresh immédiat. */
  refreshNow: () => void;
}

export function useMarketIntelligenceAutoRefresh(
  options: AutoRefreshOptions = {},
): AutoRefreshState {
  const intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  const [enabled, setEnabled] = useState(options.defaultEnabled ?? false);
  const [lastTick, setLastTick] = useState<Date | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const onTickRef = useRef(options.onTick);
  useEffect(() => { onTickRef.current = options.onTick; }, [options.onTick]);

  const tick = useCallback(() => {
    setLastTick(new Date());
    setTickCount((n) => n + 1);
    try { onTickRef.current?.(); } catch (e) {
      // best-effort, log mais ne pas crash
      if (typeof console !== 'undefined') console.warn('[autoRefresh] onTick failed', e);
    }
  }, []);

  const refreshNow = useCallback(() => tick(), [tick]);

  useEffect(() => {
    if (!enabled) return;
    let timer: number | null = null;
    let docVisible = typeof document !== 'undefined' ? !document.hidden : true;

    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        if (!docVisible) return;
        tick();
      }, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      docVisible = !document.hidden;
      if (docVisible) {
        // Reprise immédiate après visibilité
        tick();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    start();

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [enabled, intervalMs, tick]);

  return { enabled, setEnabled, lastTick, tickCount, refreshNow };
}
