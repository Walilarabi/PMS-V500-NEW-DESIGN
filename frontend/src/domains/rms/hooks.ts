/**
 * FLOWTYM RMS — TanStack Query hooks
 *
 * Pattern (consistent with reservations/hooks.ts):
 *   - useRmsCalendar — main query, batched, cache 30s
 *   - useUpdatePrice — single price update with optimistic UI
 *   - useCascadeReferencePrice — reference price + cascade in one server call
 *   - useUpdateRestriction — restriction toggle/edit
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';

import * as repo from './repository';
import type {
  RatePriceRow,
  RateRestrictionRow,
} from './schemas';

const RMS_KEY = ['rms'] as const;

const calendarKey = (hotelId: string, from: string, to: string) =>
  [...RMS_KEY, 'calendar', hotelId, from, to] as const;

// ─── Calendar fetch ─────────────────────────────────────────────────────────

export function useRmsCalendar(params: {
  hotelId: string | null;
  from: string;
  to: string;
  includeCompetitors?: boolean;
}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: calendarKey(params.hotelId ?? '', params.from, params.to),
    queryFn: () =>
      repo.fetchCalendar({
        hotelId: params.hotelId!,
        from: params.from,
        to: params.to,
        includeCompetitors: params.includeCompetitors,
      }),
    enabled: status === 'authenticated' && !!params.hotelId,
    staleTime: 30_000,
  });
}

// ─── Single price update ────────────────────────────────────────────────────

export function useUpdatePrice(hotelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; price: number; version: number; source?: string }) => {
      if (!hotelId) throw new Error('hotelId required');
      return repo.updatePrice({ ...input, hotelId });
    },
    // Optimistic update — applies immediately to all cached calendars
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: RMS_KEY });
      const snapshots = qc.getQueriesData({ queryKey: RMS_KEY });
      qc.setQueriesData(
        { queryKey: RMS_KEY },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.prices) return old;
          return {
            ...old,
            prices: old.prices.map((p: RatePriceRow) =>
              p.id === input.id
                ? { ...p, price: input.price, version: input.version + 1, source: input.source ?? 'manual' }
                : p,
            ),
          };
        },
      );
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      // Rollback all cached calendars
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: RMS_KEY }),
  });
}

// ─── Cascade reference price ────────────────────────────────────────────────

export function useCascadeReferencePrice(hotelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stayDate: string; newPrice: number }) => {
      if (!hotelId) throw new Error('hotelId required');
      return repo.cascadeReferencePrice({ ...input, hotelId });
    },
    onSuccess: () => {
      // Cascade touches many rows — full refetch is safest
      qc.invalidateQueries({ queryKey: RMS_KEY });
    },
  });
}

// ─── Restriction update ─────────────────────────────────────────────────────

export function useUpdateRestriction(hotelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      version: number;
      patch: Partial<{
        cta: boolean;
        ctd: boolean;
        min_stay: number | null;
        max_stay: number | null;
        inventory_override: 'manual_closed' | 'force_open' | null;
      }>;
    }) => {
      if (!hotelId) throw new Error('hotelId required');
      return repo.updateRestriction({ ...input, hotelId });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: RMS_KEY });
      const snapshots = qc.getQueriesData({ queryKey: RMS_KEY });
      qc.setQueriesData(
        { queryKey: RMS_KEY },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.restrictions) return old;
          return {
            ...old,
            restrictions: old.restrictions.map((r: RateRestrictionRow) =>
              r.id === input.id
                ? { ...r, ...input.patch, version: input.version + 1 }
                : r,
            ),
          };
        },
      );
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: RMS_KEY }),
  });
}
