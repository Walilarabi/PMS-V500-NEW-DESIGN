/**
 * FLOWTYM — useRevenueCalendarData
 *
 * Centralised hook for the Revenue Calendar.
 * Returns:
 * - reservations   : active reservations (status != 'cancelled')
 * - cancellations  : reservations with status = 'cancelled'
 * - pickupByDate   : Map<dateStr, count> — new reservations created in last 7 days, keyed by check_in date
 * - cancellationsByDate : Map<dateStr, count> — cancellations keyed by check_in date
 * - isLoading      : true while initial fetch is in progress
 * - lastUpdated    : Date of last data refresh (updated on real-time events)
 *
 * Real-time: subscribes to Supabase Postgres changes on `reservations` table and
 * invalidates the React Query cache when a change occurs. The subscription is
 * cleaned up automatically when the component unmounts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useReservations } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseRevenueCalendarDataReturn {
  /** Active reservations (cancelled ones excluded) */
  reservations: ReservationRow[];
  /** Cancelled reservations for the tracked period */
  cancellations: ReservationRow[];
  /** Maps dateStr (YYYY-MM-DD) → number of reservations whose check_in is that date
   *  AND whose created_at is within the last 7 days (pickup N-7). */
  pickupByDate: Map<string, number>;
  /** Maps dateStr (YYYY-MM-DD) → number of cancellations whose check_in was that date */
  cancellationsByDate: Map<string, number>;
  /** True while initial query is loading */
  isLoading: boolean;
  /** Timestamp of last successful data update (real-time or initial) */
  lastUpdated: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Number of days to consider for pickup calculation */
const PICKUP_WINDOW_DAYS = 7;

/** Supabase channel name for the real-time subscription */
const CHANNEL_NAME = 'revenue-calendar-reservations';

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRevenueCalendarData(params: {
  limit?: number;
} = {}): UseRevenueCalendarDataReturn {
  const { limit = 500 } = params;
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Base query ─────────────────────────────────────────────────────────────
  const { data, isLoading } = useReservations({ limit });

  // Mark first successful load
  const hasLoaded = useRef(false);
  useEffect(() => {
    if (!isLoading && data && !hasLoaded.current) {
      hasLoaded.current = true;
      setLastUpdated(new Date());
    }
  }, [isLoading, data]);

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          // Invalidate the React Query cache for all reservation queries.
          // The query will automatically re-fetch and update the UI.
          queryClient.invalidateQueries({ queryKey: ['reservations'] });
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const allRows: ReservationRow[] = useMemo(() => data?.rows ?? [], [data]);

  /** Active reservations (not cancelled) */
  const reservations = useMemo(
    () => allRows.filter(r => r.status !== 'cancelled'),
    [allRows]
  );

  /** Cancelled reservations */
  const cancellations = useMemo(
    () => allRows.filter(r => r.status === 'cancelled'),
    [allRows]
  );

  /** Pickup: Map<check_in_date, count of reservations created in last PICKUP_WINDOW_DAYS days> */
  const pickupByDate = useMemo<Map<string, number>>(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PICKUP_WINDOW_DAYS);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffTs = cutoff.getTime();

    const map = new Map<string, number>();

    for (const r of reservations) {
      if (!r.created_at) continue;

      const createdTs = new Date(r.created_at).getTime();
      if (isNaN(createdTs) || createdTs < cutoffTs) continue;

      // Only count future check-ins (pickup is forward-looking)
      const checkInDate = r.check_in?.slice(0, 10);
      if (!checkInDate) continue;

      const checkInTs = new Date(checkInDate).getTime();
      if (checkInTs < Date.now()) continue; // Skip past dates

      map.set(checkInDate, (map.get(checkInDate) ?? 0) + 1);
    }

    return map;
  }, [reservations]);

  /** Cancellations grouped by original check_in date */
  const cancellationsByDate = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const r of cancellations) {
      const date = r.check_in?.slice(0, 10);
      if (date) map.set(date, (map.get(date) ?? 0) + 1);
    }
    return map;
  }, [cancellations]);

  return {
    reservations,
    cancellations,
    pickupByDate,
    cancellationsByDate,
    isLoading,
    lastUpdated,
  };
}
