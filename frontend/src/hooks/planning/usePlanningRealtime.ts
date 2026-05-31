/**
 * FLOWTYM — Temps réel planning (Supabase Realtime).
 *
 * Abonne le planning aux changements des tables opérationnelles qui ne sont
 * PAS déjà couvertes globalement par useReservationsRealtime (App.tsx) :
 *   - rooms              (statut housekeeping / hors-service)
 *   - hk_tasks           (tâches de ménage)
 *   - maintenance_tasks  (interventions techniques)
 *
 * À chaque changement, invalide le cache TanStack Query correspondant pour
 * que la vue reflète instantanément les actions des autres utilisateurs.
 * Les invalidations sont throttlées pour éviter une tempête de re-renders.
 *
 * À monter une seule fois dans le composant racine du planning.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

type RealtimeChannel = ReturnType<typeof supabase.channel>;

/** Tables surveillées → clés TanStack Query à invalider. */
const TABLE_QUERY_KEYS: Record<string, string[]> = {
  rooms: ['rooms'],
  hk_tasks: ['hk_tasks'],
  maintenance_tasks: ['maintenance_tasks'],
};

interface Options {
  /** Délai d'agrégation des invalidations (ms). */
  throttleMs?: number;
}

export function usePlanningRealtime(opts: Options = {}): void {
  const { throttleMs = 500 } = opts;
  const qc = useQueryClient();
  const { status } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const flush = () => {
      const tables = [...pending.current];
      pending.current.clear();
      timer.current = null;
      for (const t of tables) {
        const key = TABLE_QUERY_KEYS[t];
        if (key) void qc.invalidateQueries({ queryKey: key });
      }
    };

    const schedule = (table: string) => {
      pending.current.add(table);
      if (timer.current) return;
      timer.current = setTimeout(flush, throttleMs);
    };

    const channel = supabase.channel('flowtym:planning:live');
    for (const table of Object.keys(TABLE_QUERY_KEYS)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => schedule(table),
      );
    }
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [status, qc, throttleMs]);
}
