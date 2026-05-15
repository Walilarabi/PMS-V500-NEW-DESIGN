/**
 * FLOWTYM — Reservations realtime subscription.
 *
 * Subscribes to `postgres_changes` on `public.reservations` for the active
 * hotel and invalidates TanStack Query caches whenever a row changes.
 * Single subscription per app instance — calling the hook from multiple
 * pages is safe thanks to React Query's deduped cache invalidation.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

export function useReservationsRealtime(): void {
  const qc = useQueryClient();
  const { session, status } = useAuth();
  const hotelId = session?.tenantId ?? null;

  useEffect(() => {
    if (status !== 'authenticated' || !hotelId) return;
    const channel = supabase
      .channel(`reservations:${hotelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `hotel_id=eq.${hotelId}`,
        },
        () => {
          // Invalide TOUT le préfixe ['reservations'] :
          // couvre useReservations (list), useReservationsByRange (range), useReservation (one)
          // et par extension useFlowdayDataset qui consomme useReservations
          void qc.invalidateQueries({ queryKey: ['reservations'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `hotel_id=eq.${hotelId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['rooms'] });
          // Les rooms impactent aussi le planning Gantt
          void qc.invalidateQueries({ queryKey: ['reservations', 'range'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [status, hotelId, qc]);
}
