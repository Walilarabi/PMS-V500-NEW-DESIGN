/**
 * FLOWTYM — Reservations TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: (newReservation) => {
      // Invalider TOUTES les queries avec le préfixe ['reservations']
      // Couvre : list, range (planning), one — par préfixe TanStack Query
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      // Invalider aussi les rooms (dispo peut avoir changé)
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      // Invalider les guests si un guest_id est lié
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

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => repo.deleteReservation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
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
  /** YYYY-MM-DD — premier jour de la période affichée */
  rangeStart: string;
  /** YYYY-MM-DD — dernier jour de la période affichée */
  rangeEnd: string;
}

/**
 * Récupère les réservations dont la période chevauche [rangeStart, rangeEnd].
 *
 * RÈGLE MÉTIER : chevauchement correct = check_in < rangeEnd ET check_out > rangeStart
 * (inclusif côté arrivée, exclusif côté départ — conforme au trigger anti-overbooking)
 *
 * BUG ÉVITÉ : ne pas utiliser check_in >= rangeStart AND check_in <= rangeEnd
 * car cela exclut les réservations qui commencent AVANT la fenêtre mais
 * sont encore présentes pendant (in-house).
 *
 * QueryKey inclut [rangeStart, rangeEnd] pour que chaque fenêtre soit
 * cachée indépendamment ET invalidée par useReservationsRealtime qui
 * invalide ['reservations'] (préfixe commun).
 */
export function useReservationsByRange(params: ReservationsByRangeParams) {
  const { status } = useAuth();
  return useQuery<ReservationRow[]>({
    queryKey: [...RESERVATIONS_KEY, 'range', params.rangeStart, params.rangeEnd],
    queryFn: async () => {
      // Chevauchement : check_in < rangeEnd ET check_out > rangeStart
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .lt('check_in', params.rangeEnd)   // check_in < rangeEnd
        .gt('check_out', params.rangeStart) // check_out > rangeStart
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

/**
 * Déplace une réservation (chambre et/ou dates) depuis le planning Gantt.
 * Utilise l'optimistic locking (fromVersion) pour détecter les conflits.
 * Invalide toutes les queries 'reservations' après succès.
 */
export function useMoveReservation() {
  const qc = useQueryClient();
  return useMutation<ReservationRow, Error, MoveReservationInput>({
    mutationFn: async ({ id, fromVersion, roomId, checkIn, checkOut }) => {
      const { data, error } = await supabase
        .from('reservations')
        .update({
          room_id: roomId,
          check_in: checkIn,
          check_out: checkOut,
        })
        .eq('id', id)
        .eq('version', fromVersion) // optimistic lock
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
    onSuccess: () => {
      // Invalider tout le préfixe ['reservations'] — couvre list, range, one
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
    },
    onError: (err) => {
      console.error('[useMoveReservation]', err);
    },
  });
}
