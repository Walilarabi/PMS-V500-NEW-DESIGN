/**
 * FLOWTYM — Reservations TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

import * as repo from './repository';
import {
  type CreateReservationInput,
  createReservationInputSchema,
  type ReservationRow,
} from './schemas';

const RESERVATIONS_KEY = ['reservations'] as const;

export function useReservations(params: repo.ListReservationsParams = {}) {
  const { status } = useAuth();
  return useQuery<{ rows: ReservationRow[]; total: number }>({
    queryKey: [...RESERVATIONS_KEY, 'list', params],
    queryFn: () => repo.listReservations(params),
    enabled: status === 'authenticated',
    staleTime: 0,              // toujours re-fetch si data potentiellement stale
    refetchOnWindowFocus: true,// rafraîchir quand l'onglet reprend le focus
    refetchInterval: 30_000,   // poll toutes les 30s en fallback au realtime
  });
}

export function useReservation(id: string | null) {
  return useQuery<ReservationRow>({
    queryKey: [...RESERVATIONS_KEY, 'one', id],
    queryFn: () => repo.getReservation(id as string),
    enabled: !!id,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<ReservationRow, Error, CreateReservationInput>({
    mutationFn: async (input) => {
      const parsed = createReservationInputSchema.parse(input);

      // Résolution hotel_id robuste — session.tenantId peut être null
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
        // Dernier recours: premier hôtel disponible (démo)
        const { data: h } = await supabase.from('hotels').select('id').limit(1).maybeSingle();
        hotelId = (h as any)?.id ?? '';
      }
      if (!hotelId) throw new Error('Hôtel introuvable — reconnectez-vous.');

      return repo.createReservation(hotelId, parsed);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
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
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
      void qc.invalidateQueries({ queryKey: [...RESERVATIONS_KEY, 'one', vars.id] });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, { id: string; expectedVersion: number }>({
    mutationFn: ({ id, expectedVersion }) =>
      repo.checkInReservation(id, expectedVersion),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
      void qc.invalidateQueries({ queryKey: [...RESERVATIONS_KEY, 'one', vars.id] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, { id: string; expectedVersion: number }>({
    mutationFn: ({ id, expectedVersion }) =>
      repo.checkOutReservation(id, expectedVersion),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
      void qc.invalidateQueries({ queryKey: [...RESERVATIONS_KEY, 'one', vars.id] });
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
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
      void qc.invalidateQueries({ queryKey: [...RESERVATIONS_KEY, 'one', vars.id] });
    },
  });
}
