/**
 * FLOWTYM — Hook useConfigBlob<T>(namespace, default).
 *
 * Pattern "best-effort sync" :
 *   1. lecture localStorage immédiate (UX instantanée, mode offline)
 *   2. réconciliation Supabase en arrière-plan au chargement (si plus récent)
 *   3. écriture locale immédiate + sync Supabase en arrière-plan
 *
 * Toute page Paramètres qui n'a qu'une seule config peut consommer ce
 * hook pour basculer en persistance multi-tenant sans réécrire l'UI :
 *
 *   const [cfg, setCfg] = useConfigBlob('branding', DEFAULT_BRANDING);
 *
 * Si la session Supabase n'est pas disponible (dev / offline / pré-auth),
 * la branche localStorage tourne seule — l'app reste utilisable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  syncConfigBlobToSupabase,
  fetchConfigBlobFromSupabase,
} from '@/src/services/settings/settingsPersistence';

const STORAGE_PREFIX = 'flowtym.cfg.';

function readLocal<T>(namespace: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${namespace}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    // Merge avec defaults pour gérer les nouveaux champs ajoutés après coup
    return typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)
      ? ({ ...(fallback as object), ...(parsed as object) } as T)
      : ((parsed as T) ?? fallback);
  } catch {
    return fallback;
  }
}

function writeLocal<T>(namespace: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${namespace}`, JSON.stringify(data));
  } catch {
    /* quota dépassé — silent */
  }
}

export function useConfigBlob<T>(
  namespace: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void, { syncing: boolean; remoteReady: boolean }] {
  const [data, setData] = useState<T>(() => readLocal(namespace, defaultValue));
  const [syncing, setSyncing] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const mountedRef = useRef(true);

  // Réconciliation au mount : Supabase = source de vérité si dispo
  useEffect(() => {
    let cancelled = false;
    setSyncing(true);
    fetchConfigBlobFromSupabase<T>(namespace)
      .then((remote) => {
        if (cancelled || !mountedRef.current) return;
        if (remote != null) {
          const merged = typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)
            ? ({ ...(defaultValue as object), ...(remote as object) } as T)
            : remote;
          setData(merged);
          writeLocal(namespace, merged);
        }
        setRemoteReady(true);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setData((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeLocal(namespace, value);
        // Sync best-effort vers Supabase (n'attend pas)
        void syncConfigBlobToSupabase(namespace, value);
        return value;
      });
    },
    [namespace],
  );

  return [data, update, { syncing, remoteReady }];
}
