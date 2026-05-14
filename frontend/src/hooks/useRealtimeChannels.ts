/**
 * FLOWTYM — useReservationsRealtime
 *
 * Ouvre un canal Supabase Realtime sur la table `reservations`.
 * À chaque INSERT / UPDATE / DELETE, invalide le cache TanStack Query
 * pour que PlanningView et TodayView se mettent à jour automatiquement
 * sans polling.
 *
 * Usage :
 *   // Dans App.tsx ou un provider haut placé (une seule instance)
 *   useReservationsRealtime();
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

type RealtimeChannel = ReturnType<typeof supabase.channel>;

export function useReservationsRealtime() {
  const qc = useQueryClient();
  const { status } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Ne pas ouvrir si non authentifié
    if (status !== 'authenticated') return;

    // Éviter les doublons de canal
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('flowtym:reservations:live')
      .on(
        'postgres_changes',
        {
          event: '*',          // INSERT | UPDATE | DELETE
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          // Invalider toutes les queries reservations
          void qc.invalidateQueries({ queryKey: ['reservations'] });

          // Invalider aussi l'audit log (chaque mutation y écrit)
          void qc.invalidateQueries({ queryKey: ['audit-logs'] });

          // Si UPDATE sur une réservation spécifique → invalider son détail
          const id =
            (payload.new as { id?: string } | undefined)?.id ??
            (payload.old as { id?: string } | undefined)?.id;

          if (id) {
            void qc.invalidateQueries({ queryKey: ['reservations', 'one', id] });
          }
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          console.info('[realtime] reservations channel subscribed');
        }
        if (subscriptionStatus === 'CHANNEL_ERROR') {
          console.error('[realtime] reservations channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [status, qc]);
}

/**
 * useReconciliationRealtime
 * Même pattern pour reconciliation_lines — utilisé par ReconciliationView.
 */
export function useReconciliationRealtime() {
  const qc = useQueryClient();
  const { status } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('flowtym:reconciliation:live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reconciliation_lines' },
        () => {
          void qc.invalidateQueries({ queryKey: ['reconciliation'] });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [status, qc]);
}

/**
 * useSasIncomingRealtime
 * Canal sur sas_incoming_reservations — mise à jour bulle nav en temps réel.
 */
export function useSasIncomingRealtime() {
  const qc = useQueryClient();
  const { status } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('flowtym:sas-incoming:live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sas_incoming_reservations' },
        () => {
          void qc.invalidateQueries({ queryKey: ['sas', 'nav'] });
          void qc.invalidateQueries({ queryKey: ['sas', 'incoming'] });
          void qc.invalidateQueries({ queryKey: ['sas', 'stats'] });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [status, qc]);
}

/**
 * useRevenueAnomaliesRealtime
 * Canal sur revenue_anomalies — utilisé par RevenueIntegrityView.
 */
export function useRevenueAnomaliesRealtime() {
  const qc = useQueryClient();
  const { status } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('flowtym:revenue-anomalies:live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'revenue_anomalies' },
        () => {
          void qc.invalidateQueries({ queryKey: ['revenue-anomalies'] });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [status, qc]);
}
