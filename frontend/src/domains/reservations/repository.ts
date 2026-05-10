/**
 * FLOWTYM — Reservations repository.
 *
 * RLS guarantees hotel_id isolation; we never inject hotel_id manually here
 * (except on insert where the column is nullable and required for FK).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, NotFoundError } from '@/src/domains/_shared/errors';

import {
  type CreateReservationInput,
  type ReservationRow,
  reservationRowSchema,
} from './schemas';

export interface ListReservationsParams {
  limit?: number;
  offset?: number;
  status?: string[];
}

export async function listReservations(
  params: ListReservationsParams = {},
): Promise<{ rows: ReservationRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .order('check_in', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status?.length) q = q.in('status', params.status);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((d) => reservationRowSchema.parse(d));
  return { rows, total: count ?? rows.length };
}

export async function getReservation(id: string): Promise<ReservationRow> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new NotFoundError('Reservation', id);
  return reservationRowSchema.parse(data);
}

export async function createReservation(
  hotelId: string,
  input: CreateReservationInput,
): Promise<ReservationRow> {
  const adults = input.adults;
  const children = input.children ?? 0;
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  const nights = Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const insertPayload = {
    hotel_id: hotelId,
    reference: input.reference,
    guest_id: input.guestId ?? null,
    room_id: input.roomId ?? null,
    guest_name: input.guestName ?? null,
    check_in: input.checkIn,
    check_out: input.checkOut,
    nights,
    adults,
    children,
    pax: adults + children,
    total_amount: input.totalAmount,
    paid_amount: 0,
    solde: input.totalAmount,
    source: input.source ?? 'Direct',
    status: 'confirmed',
    payment_status: 'unpaid',
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('reservations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return reservationRowSchema.parse(data);
}

export async function updateReservationStatus(
  id: string,
  status: string,
): Promise<ReservationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('reservations') as any;
  const { data, error } = await builder
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new NotFoundError('Reservation', id);
  return reservationRowSchema.parse(data);
}

/* ----------------------------------------------------------------------- */
/*   Date-range listing for the Planning grid (rooms x dates)              */
/* ----------------------------------------------------------------------- */

export interface ListReservationsByRangeParams {
  rangeStart: string; // YYYY-MM-DD inclusive
  rangeEnd: string;   // YYYY-MM-DD inclusive
}

export async function listReservationsByRange(
  params: ListReservationsByRangeParams,
): Promise<ReservationRow[]> {
  // overlap test: check_in <= rangeEnd AND check_out >= rangeStart
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .lte('check_in', params.rangeEnd)
    .gte('check_out', params.rangeStart)
    .order('check_in', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => reservationRowSchema.parse(d));
}

/* ----------------------------------------------------------------------- */
/*   Drag&drop : move a reservation (room and/or dates) with optimistic    */
/*   locking via the `version` column.                                     */
/* ----------------------------------------------------------------------- */

export interface MoveReservationInput {
  id: string;
  fromVersion: number;
  roomId?: string | null;
  checkIn?: string;
  checkOut?: string;
}

export async function moveReservation(input: MoveReservationInput): Promise<ReservationRow> {
  const updates: Record<string, unknown> = {};
  if (input.roomId !== undefined) updates.room_id = input.roomId;
  if (input.checkIn) updates.check_in = input.checkIn;
  if (input.checkOut) updates.check_out = input.checkOut;
  if (input.checkIn && input.checkOut) {
    const a = new Date(input.checkIn);
    const b = new Date(input.checkOut);
    updates.nights = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('Aucun changement à appliquer');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('reservations') as any;
  const { data, error } = await builder
    .update(updates)
    .eq('id', input.id)
    .eq('version', input.fromVersion)
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) {
    throw new Error(
      'Réservation modifiée par un autre utilisateur, recharge le planning et réessaie.',
    );
  }
  return reservationRowSchema.parse(data);
}
