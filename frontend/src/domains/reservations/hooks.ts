/**
 * FLOWTYM — Reservations TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export function useCreateReservation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<ReservationRow, Error, CreateReservationInput>({
    mutationFn: async (input) => {
      const parsed = createReservationInputSchema.parse(input);
      if (!session?.tenantId) throw new Error('Hôtel absent dans la session');
      return repo.createReservation(session.tenantId, parsed);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
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
