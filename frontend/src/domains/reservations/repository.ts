/**
 * FLOWTYM — Reservations repository.
 *
 * RLS guarantees hotel_id isolation; we never inject hotel_id manually here
 * (except on insert where the column is nullable and required for FK).
 *
 * Audit trail: every mutation calls writeAuditLog() as a non-blocking
 * side-effect. The DB trigger trg_reservations_audit (migration 0030)
 * is the authoritative source — the client-side call is belt-and-suspenders
 * for cases where the trigger cannot resolve auth.uid() (e.g. service role).
 *
 * Optimistic locking: updateReservationStatus / updateReservation accept an
 * optional `expectedVersion` to prevent lost updates. If the row version
 * doesn't match, a ConflictError is thrown.
 */
import { supabase } from '@/src/lib/supabase';
import {
  mapSupabaseError,
  NotFoundError,
  ConflictError,
} from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';

import {
  type CreateReservationInput,
  type ReservationRow,
  reservationRowSchema,
} from './schemas';

export interface ListReservationsParams {
  limit?: number;
  offset?: number;
  status?: string[];
  /** YYYY-MM-DD — filtre check_in >= dateFrom */
  dateFrom?: string;
  /** YYYY-MM-DD — filtre check_out <= dateTo */
  dateTo?: string;
  /** ilike search on reference, guest_name, room_number, guest_email */
  search?: string;
  /** exact match on source column */
  source?: string;
  /** exact match on room_type column */
  roomType?: string;
}

export async function listReservations(
  params: ListReservationsParams = {},
): Promise<{ rows: ReservationRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 1000);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .order('check_in', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status?.length) q = q.in('status', params.status);
  if (params.dateFrom) q = q.gt('check_out', params.dateFrom);
  if (params.dateTo)   q = q.lt('check_in',  params.dateTo);
  if (params.source)   q = q.eq('source',    params.source);
  if (params.roomType) q = q.eq('room_type', params.roomType);
  if (params.search) {
    const s = `%${params.search}%`;
    q = q.or(`reference.ilike.${s},guest_name.ilike.${s},room_number.ilike.${s},guest_email.ilike.${s}`);
  }

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((d: unknown) => reservationRowSchema.parse(d));
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
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) /
        86_400_000,
    ),
  );

  let roomSnapshot: { number: string | null; type: string | null; category: string | null } | null = null;
  if (input.roomId) {
    const { data, error } = await supabase
      .from('rooms')
      .select('number,type,category')
      .eq('id', input.roomId)
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error);
    } else {
      roomSnapshot = data ?? null;
    }
  }

  if (input.roomId && !roomSnapshot?.number) {
    throw new NotFoundError('Room', input.roomId);
  }

  const insertPayload = {
    hotel_id: hotelId,
    reference: input.reference,
    guest_id: input.guestId ?? null,
    guest_email: input.guestEmail ?? null,
    guest_phone: input.guestPhone ?? null,
    room_id: input.roomId ?? null,
    room_number: roomSnapshot?.number ?? input.roomNumber ?? null,
    room_type: roomSnapshot?.type ?? input.roomType ?? null,
    room_category: roomSnapshot?.category ?? input.roomCategory ?? null,
    check_in: input.checkIn,
    check_out: input.checkOut,
    nights,
    adults: input.adults,
    children: input.children ?? 0,
    source: input.source,
    total_amount: input.totalAmount,
    notes: input.notes ?? null,
    guest_name: input.guestName ?? null,
    status: 'confirmed',
    payment_status: 'pending',
    version: 1,
  };

  const { data, error } = await supabase
    .from('reservations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select('*')
    .single();

  if (error) {
    // Erreur overbooking : code 23P01 (exclusion_violation) ou message OVERBOOKING_CONFLICT
    if (
      error.code === '23P01' ||
      error.message?.includes('OVERBOOKING_CONFLICT')
    ) {
      throw new ConflictError(
        `Overbooking détecté : la chambre est déjà réservée sur cette période. Choisissez une autre chambre ou modifiez les dates.`,
      );
    }
    throw mapSupabaseError(error);
  }

  const row = reservationRowSchema.parse(data);

  // Audit trail (belt-and-suspenders — DB trigger est autoritaire)
  await writeAuditLog({
    entity: 'reservation',
    entity_id: row.id,
    action: 'INSERT',
    payload: {
      reference: row.reference,
      guest_name: row.guest_name,
      check_in: row.check_in,
      check_out: row.check_out,
      total_amount: row.total_amount,
      source: row.source,
      status: row.status,
    },
  });

  return row;
}

export async function updateReservationStatus(
  id: string,
  status: string,
  expectedVersion?: number,
): Promise<ReservationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder = (supabase.from('reservations') as any)
    .update({ status })
    .eq('id', id);

  // Optimistic locking : on n'écrase pas si version a changé entre-temps
  if (expectedVersion !== undefined) {
    builder = builder.eq('version', expectedVersion);
  }

  const { data, error } = await builder.select('*').maybeSingle();
  if (error) throw mapSupabaseError(error);

  // Si expectedVersion fourni et aucune ligne retournée → conflit
  if (!data && expectedVersion !== undefined) {
    throw new ConflictError(
      `Version conflict on reservation ${id} — expected v${expectedVersion}. Reload and retry.`,
    );
  }
  if (!data) throw new NotFoundError('Reservation', id);

  const row = reservationRowSchema.parse(data);

  // Audit trail
  await writeAuditLog({
    entity: 'reservation',
    entity_id: id,
    action: `STATUS_${status.toUpperCase()}`,
    payload: {
      new_status: status,
      version: row.version ?? null,
      expected_version: expectedVersion ?? null,
    },
  });

  return row;
}

/**
 * persistReservationMove — Persiste un déplacement de réservation (délogement)
 * dans Supabase : nouvelle chambre + total éventuellement réajusté.
 *
 * Corrige P6 (drag-move non persisté → perte au rechargement). RLS scope par
 * hôtel. Audit trail via writeAuditLog.
 */
export async function persistReservationMove(input: {
  id: string;
  roomId: string;
  roomNumber: string;
  totalAmount?: number;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    room_id: input.roomId,
    room_number: input.roomNumber,
  };
  if (input.totalAmount !== undefined) patch.total_amount = input.totalAmount;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('reservations') as any).update(patch).eq('id', input.id);
  if (error) throw mapSupabaseError(error);

  void writeAuditLog({
    entity: 'reservation',
    entity_id: input.id,
    action: 'MOVE',
    payload: {
      room_id: input.roomId,
      room_number: input.roomNumber,
      total_amount: input.totalAmount ?? null,
    },
  });
}

/**
 * checkIn — Statut confirmed → checked_in
 * Exige expectedVersion pour éviter double check-in concurrent.
 */
export async function checkInReservation(
  id: string,
  expectedVersion: number,
): Promise<ReservationRow> {
  const row = await updateReservationStatus(id, 'checked_in', expectedVersion);

  await writeAuditLog({
    entity: 'reservation',
    entity_id: id,
    action: 'CHECK_IN',
    payload: { checked_in_at: new Date().toISOString(), version: row.version ?? null },
  });

  return row;
}

/**
 * checkOut — Statut checked_in → checked_out
 */
export async function checkOutReservation(
  id: string,
  expectedVersion: number,
): Promise<ReservationRow> {
  const row = await updateReservationStatus(id, 'checked_out', expectedVersion);

  await writeAuditLog({
    entity: 'reservation',
    entity_id: id,
    action: 'CHECK_OUT',
    payload: { checked_out_at: new Date().toISOString(), version: row.version ?? null },
  });

  return row;
}

/**
 * deleteReservation — Suppression physique, réservée aux annulations définitives.
 * Requiert que la réservation soit à l'état 'cancelled' ou 'no_show' (vérifié côté RLS).
 */
export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
  void writeAuditLog({
    entity: 'reservation',
    entity_id: id,
    action: 'DELETE',
    payload: { deleted_at: new Date().toISOString() },
  });
}

/**
 * cancelReservation — Annulation avec motif obligatoire pour l'audit.
 */
export async function cancelReservation(
  id: string,
  reason: string,
  expectedVersion?: number,
): Promise<ReservationRow> {
  const row = await updateReservationStatus(id, 'cancelled', expectedVersion);

  await writeAuditLog({
    entity: 'reservation',
    entity_id: id,
    action: 'CANCEL',
    payload: {
      reason,
      cancelled_at: new Date().toISOString(),
      version: row.version ?? null,
    },
  });

  return row;
}
