/**
 * FLOWTYM — Reservations repository.
 *
 * Single source of Supabase access for the reservation aggregate. RLS
 * guarantees tenant isolation; we never inject tenant_id manually here. We
 * still validate every row through Zod before returning it to the service.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, NotFoundError } from '@/src/domains/_shared/errors';

import {
  type CreateReservationInput,
  type ReservationRow,
  reservationRowSchema,
} from './schemas';

export interface ListReservationsParams {
  hotelId?: string;
  limit?: number;
  offset?: number;
  status?: ReservationRow['status'][];
}

export async function listReservations(params: ListReservationsParams = {}): Promise<{
  rows: ReservationRow[];
  total: number;
}> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .order('check_in', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.hotelId) q = q.eq('hotel_id', params.hotelId);
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
  tenantId: string,
  input: CreateReservationInput,
): Promise<ReservationRow> {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      hotel_id: input.hotelId,
      reference: input.reference,
      guest_id: input.guestId ?? null,
      room_id: input.roomId ?? null,
      check_in: input.checkIn,
      check_out: input.checkOut,
      adults: input.adults,
      children: input.children ?? 0,
      channel: input.channel ?? 'direct',
      rate_plan: input.ratePlan ?? null,
      total_cents: input.totalCents,
      currency: input.currency ?? 'EUR',
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return reservationRowSchema.parse(data);
}

/** Optimistic update: caller MUST pass the version they read. */
export async function updateReservationStatus(
  id: string,
  expectedVersion: number,
  status: ReservationRow['status'],
): Promise<ReservationRow> {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  if (!data) throw new NotFoundError('Reservation', `${id}@v${expectedVersion}`);
  return reservationRowSchema.parse(data);
}
