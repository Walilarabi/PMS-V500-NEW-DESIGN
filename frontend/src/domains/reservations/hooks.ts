/**
 * FLOWTYM — Reservations TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

import * as repo from './repository';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import {
  type CreateReservationInput,
  createReservationInputSchema,
  type ReservationRow,
  reservationRowSchema,
} from './schemas';

const RESERVATIONS_KEY = ['reservations'] as const;
const LIST_KEY        = [...RESERVATIONS_KEY, 'list']  as const;
const RANGE_KEY       = [...RESERVATIONS_KEY, 'range'] as const;

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Patches the updated reservation into every cached query that holds it:
 *   - ['reservations','one',id]            — detail view
 *   - ['reservations','list',...]          — all list pages (updates matching row in-place)
 *   - ['reservations','range',...]         — all planning range windows (updates row in-place)
 * Avoids network refetches for status-only mutations.
 */
function patchReservationInCaches(qc: QueryClient, updated: ReservationRow) {
  // Detail
  qc.setQueryData([...RESERVATIONS_KEY, 'one', updated.id], updated);

  // List pages
  qc.setQueriesData<{ rows: ReservationRow[]; total: number }>(
    { queryKey: LIST_KEY },
    (prev) => prev
      ? { ...prev, rows: prev.rows.map((r) => r.id === updated.id ? updated : r) }
      : prev,
  );

  // Range caches (planning Gantt)
  qc.setQueriesData<ReservationRow[]>(
    { queryKey: RANGE_KEY },
    (prev) => prev
      ? prev.map((r) => r.id === updated.id ? updated : r)
      : prev,
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useReservations(params: repo.ListReservationsParams = {}) {
  const { status } = useAuth();
  return useQuery<{ rows: ReservationRow[]; total: number }>({
    queryKey: [...LIST_KEY, params],
    queryFn: () => repo.listReservations(params),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useReservation(id: string | null) {
  return useQuery<ReservationRow>({
    queryKey: [...RESERVATIONS_KEY, 'one', id],
    queryFn: () => repo.getReservation(id as string),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateReservation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<ReservationRow, Error, CreateReservationInput>({
    mutationFn: async (input) => {
      const parsed = createReservationInputSchema.parse(input);

      let hotelId = session?.tenantId ?? '';
      if (!hotelId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: prof } = await supabase
            .from('users').select('hotel_id').eq('auth_id', user.id).maybeSingle();
          hotelId = (prof as any)?.hotel_id ?? '';
        }
      }
      if (!hotelId) {
        const { data: h } = await supabase.from('hotels').select('id').limit(1).maybeSingle();
        hotelId = (h as any)?.id ?? '';
      }
      if (!hotelId) throw new Error('Hôtel introuvable — reconnectez-vous.');

      return repo.createReservation(hotelId, parsed);
    },
    onSuccess: (newReservation) => {
      // New row: invalidate list + range (availability changed)
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: RANGE_KEY });
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      if (newReservation.guest_id) {
        void qc.invalidateQueries({ queryKey: ['guests-by-ids'] });
      }
    },
    onError: (err) => {
      console.error('[useCreateReservation]', err);
    },
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation<
    ReservationRow,
    Error,
    { id: string; status: string; expectedVersion?: number }
  >({
    mutationFn: ({ id, status, expectedVersion }) =>
      repo.updateReservationStatus(id, status, expectedVersion),
    onSuccess: (data) => {
      patchReservationInCaches(qc, data);
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, { id: string; expectedVersion: number }>({
    mutationFn: ({ id, expectedVersion }) =>
      repo.checkInReservation(id, expectedVersion),
    onSuccess: (data) => {
      patchReservationInCaches(qc, data);
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, { id: string; expectedVersion: number }>({
    mutationFn: ({ id, expectedVersion }) =>
      repo.checkOutReservation(id, expectedVersion),
    onSuccess: (data) => {
      patchReservationInCaches(qc, data);
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation<
    ReservationRow,
    Error,
    { id: string; reason: string; expectedVersion?: number }
  >({
    mutationFn: ({ id, reason, expectedVersion }) =>
      repo.cancelReservation(id, reason, expectedVersion),
    onSuccess: (data) => {
      patchReservationInCaches(qc, data);
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => repo.deleteReservation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: RANGE_KEY });
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err) => {
      console.error('[useDeleteReservation]', err);
    },
  });
}

// ============================================================================
// PLANNING HOOKS — ajoutés pour PlanningViewLive
// ============================================================================

export interface ReservationsByRangeParams {
  rangeStart: string;
  rangeEnd: string;
}

export function useReservationsByRange(params: ReservationsByRangeParams) {
  const { status } = useAuth();
  return useQuery<ReservationRow[]>({
    queryKey: [...RANGE_KEY, params.rangeStart, params.rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .lt('check_in', params.rangeEnd)
        .gt('check_out', params.rangeStart)
        .not('status', 'in', '("cancelled","no_show")')
        .order('check_in', { ascending: true })
        .limit(500);
      if (error) throw mapSupabaseError(error);
      return (data ?? []).map((d: unknown) => reservationRowSchema.parse(d));
    },
    enabled: status === 'authenticated' && !!params.rangeStart && !!params.rangeEnd,
    staleTime: 10_000,
  });
}

export interface MoveReservationInput {
  id: string;
  fromVersion: number;
  roomId: string;
  checkIn: string;
  checkOut: string;
}

export function useMoveReservation() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, MoveReservationInput>({
    mutationFn: async ({ id, fromVersion, roomId, checkIn, checkOut }) => {
      const { data, error } = await supabase
        .from('reservations')
        .update({ room_id: roomId, check_in: checkIn, check_out: checkOut })
        .eq('id', id)
        .eq('version', fromVersion)
        .select('*')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) {
        throw new Error(
          `Conflit de version sur la réservation ${id} — ` +
          `modification concurrente détectée. Rechargez et réessayez.`,
        );
      }
      return reservationRowSchema.parse(data);
    },
    onSuccess: (data) => {
      // Dates changed → patch detail + invalidate list and all range caches
      qc.setQueryData([...RESERVATIONS_KEY, 'one', data.id], data);
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: RANGE_KEY });
    },
    onError: (err) => {
      console.error('[useMoveReservation]', err);
    },
  });
}
