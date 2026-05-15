/**
 * FLOWTYM — Flowday data adapter.
 *
 * Maps live Supabase reservations + rooms + guests data into the
 * `RoomRow` shape consumed by the legacy Flowday operations table.
 *
 * The transformation also derives KPIs and `movement` (arrival/inhouse/
 * departure) from the current date.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { useReservations } from '@/src/domains/reservations/hooks';
import { useRooms } from '@/src/domains/hotel/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow as DbRoomRow, GuestRow } from '@/src/lib/supabase.types';

/* ------------------------------------------------------------------------- */
/*                       RoomRow shape used by Flowday UI                    */
/* ------------------------------------------------------------------------- */

export type FlowdayBadge = 'vip' | 'prioritaire' | 'nouveau' | 'fidele' | 'incident';

export type FlowdayRoomRow = {
  id: number;
  priority: 'Critique' | 'Élevée' | 'Moyenne' | 'Faible';
  room: string;
  type: string;
  status: string;
  guest: string;
  initials: string;
  reservationId: string;
  guestCount: number;
  etaTime: string;
  etaNote: string;
  movement: 'arrival' | 'departure' | 'inhouse' | 'other';
  nights: number;
  stayAmount: string;
  vip: string | null;
  payment: 'Payé' | 'Partiel' | 'En attente';
  arrival: string;
  departure: string;
  source: string;
  action: string;
  taskStatus: 'À faire' | 'En cours' | 'À valider' | 'Validé';
  badges?: FlowdayBadge[];
  email?: string;
  phone?: string;
  assignedTo?: string;
  isGroup?: boolean;
  category?: string;
  adults?: number;
  children?: number;
  nationality?: string;
  bookingRef?: string;
  ratePlan?: string;
  /** Stable reference to the underlying Supabase row id. */
  reservationUuid: string;
};

/* ------------------------------------------------------------------------- */
/*                              Helpers                                      */
/* ------------------------------------------------------------------------- */

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtEUR = (n: number | null | undefined): string => {
  if (typeof n !== 'number') return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
};

const initialsOf = (name: string | null | undefined): string => {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const computeMovement = (
  checkIn: string,
  checkOut: string,
  status: string | null,
): FlowdayRoomRow['movement'] => {
  const today = todayKey();
  if (status === 'cancelled' || status === 'no_show') return 'other';
  if (checkIn === today) return 'arrival';
  if (checkOut === today) return 'departure';
  if (checkIn < today && checkOut > today) return 'inhouse';
  return 'other';
};

const computePriority = (
  movement: FlowdayRoomRow['movement'],
  paymentStatus: string | null,
): FlowdayRoomRow['priority'] => {
  if (movement === 'arrival' && paymentStatus !== 'paid') return 'Critique';
  if (movement === 'arrival') return 'Élevée';
  if (movement === 'departure') return 'Moyenne';
  if (movement === 'inhouse') return 'Moyenne';
  return 'Faible';
};

const computeStatus = (
  movement: FlowdayRoomRow['movement'],
  reservationStatus: string | null,
  roomStatus: string | null,
): string => {
  if (reservationStatus === 'checked_out') return 'Check-out fait';
  if (reservationStatus === 'checked_in') return 'Occupée';
  if (movement === 'arrival') {
    if (roomStatus === 'clean' || roomStatus === 'inspected') return 'Arrivée < 1h';
    if (roomStatus === 'dirty' || roomStatus === 'maintenance' || roomStatus === 'out_of_order')
      return 'Non prête';
    return 'Arrivée < 1h';
  }
  if (movement === 'departure') return 'Départ aujourd’hui';
  if (movement === 'inhouse') return 'Occupée';
  return 'À planifier';
};

const mapPayment = (
  paymentStatus: string | null,
  paid: number | null,
  total: number | null,
): FlowdayRoomRow['payment'] => {
  if (paymentStatus === 'paid') return 'Payé';
  if (paymentStatus === 'partial') return 'Partiel';
  if (typeof paid === 'number' && typeof total === 'number') {
    if (paid >= total && total > 0) return 'Payé';
    if (paid > 0) return 'Partiel';
  }
  return 'En attente';
};

const computeAction = (movement: FlowdayRoomRow['movement']): string => {
  if (movement === 'departure') return 'Inspection';
  if (movement === 'arrival') return 'Lancer ménage';
  return 'Lancer ménage';
};

const computeEtaTime = (movement: FlowdayRoomRow['movement']): string => {
  if (movement === 'arrival') return '15:00';
  if (movement === 'departure') return '11:00';
  return '—';
};

const computeEtaNote = (movement: FlowdayRoomRow['movement']): string => {
  if (movement === 'arrival') return 'prévu · fenêtre 15h-22h';
  if (movement === 'departure') return 'prévu · avant 11h';
  return 'recouche';
};

/* ------------------------------------------------------------------------- */
/*                          Guests batch fetch                               */
/* ------------------------------------------------------------------------- */

function useGuestsByIds(ids: string[]) {
  return useQuery<Record<string, GuestRow>>({
    queryKey: ['guests-by-ids', [...ids].sort()],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .in('id', ids);
      if (error) throw mapSupabaseError(error);
      const map: Record<string, GuestRow> = {};
      for (const g of (data ?? []) as GuestRow[]) map[g.id] = g;
      return map;
    },
  });
}

/* ------------------------------------------------------------------------- */
/*                             Public hook                                   */
/* ------------------------------------------------------------------------- */

export interface FlowdayKpis {
  occupancy: number;
  totalRooms: number;
  dirtyRooms: number;
  cleanPct: number;
  arrivalsToday: number;
  vipCount: number;
  unpaidAmount: number;
  unpaidCount: number;
}

export interface FlowdayDataset {
  rows: FlowdayRoomRow[];
  kpis: FlowdayKpis;
  isLoading: boolean;
  error: Error | null;
}

export function useFlowdayDataset(): FlowdayDataset {
  const { status } = useAuth();
  const enabled = status === 'authenticated';

  const reservationsQ = useReservations({ limit: 200 });
  const roomsQ = useRooms();

  const reservationRows: ReservationRow[] = enabled ? reservationsQ.data?.rows ?? [] : [];
  const dbRooms: DbRoomRow[] = enabled ? roomsQ.data ?? [] : [];

  const guestIds = useMemo(
    () => Array.from(new Set(reservationRows.map((r) => r.guest_id).filter(Boolean) as string[])),
    [reservationRows],
  );
  const guestsQ = useGuestsByIds(guestIds);
  const guestsById = useMemo(() => guestsQ.data ?? {}, [guestsQ.data]);

  const roomsByNumber = useMemo(() => {
    const m: Record<string, DbRoomRow> = {};
    for (const r of dbRooms) if (r.number) m[r.number] = r;
    return m;
  }, [dbRooms]);
  const roomsById = useMemo(() => {
    const m: Record<string, DbRoomRow> = {};
    for (const r of dbRooms) m[r.id] = r;
    return m;
  }, [dbRooms]);

  const rows = useMemo<FlowdayRoomRow[]>(() => {
    return reservationRows.map((res, idx) => {
      const dbRoom = (res.room_id && roomsById[res.room_id]) ||
        (res.room_number && roomsByNumber[res.room_number]) ||
        null;
      const guest = res.guest_id ? guestsById[res.guest_id] : null;
      const guestName =
        res.guest_name ??
        (guest ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() : '—');
      const movement = computeMovement(res.check_in, res.check_out, res.status);
      const total = res.total_amount ?? 0;
      const paid = res.paid_amount ?? 0;
      return {
        id: idx + 1,
        reservationUuid: res.id,
        priority: computePriority(movement, res.payment_status),
        room: dbRoom?.number ?? res.room_number ?? '—',
        type: dbRoom?.type ?? res.room_type ?? 'STD',
        status: computeStatus(movement, res.status, dbRoom?.status ?? null),
        guest: guestName,
        initials: initialsOf(guestName),
        reservationId: res.reference ?? res.id.slice(0, 8).toUpperCase(),
        guestCount: res.pax ?? (res.adults ?? 1) + (res.children ?? 0),
        etaTime: computeEtaTime(movement),
        etaNote: computeEtaNote(movement),
        movement,
        nights: res.nights ?? 1,
        stayAmount: fmtEUR(total),
        vip: guest?.loyalty_level ? `VIP ${guest.loyalty_level}` : null,
        payment: mapPayment(res.payment_status, paid, total),
        arrival: `${res.check_in} 15:00`,
        departure: `${res.check_out} 11:00`,
        source: (res.source ?? 'DIRECT').toUpperCase(),
        action: computeAction(movement),
        taskStatus: movement === 'inhouse' ? 'Validé' : 'À faire',
        email: guest?.email ?? undefined,
        phone: guest?.phone ?? undefined,
        adults: res.adults ?? 1,
        children: res.children ?? 0,
        category: dbRoom?.category ?? undefined,
        nationality: guest?.nationality ?? undefined,
        bookingRef: res.reference ? `REF: ${res.reference}` : undefined,
        ratePlan: undefined,
      };
    });
  }, [reservationRows, roomsById, roomsByNumber, guestsById]);

  const kpis = useMemo<FlowdayKpis>(() => {
    const today = todayKey();
    const totalRooms = dbRooms.length;
    const dirtyRooms = dbRooms.filter(
      (r) => r.status === 'dirty' || r.status === 'maintenance' || r.status === 'out_of_order',
    ).length;
    const cleanPct = totalRooms > 0 ? Math.round(((totalRooms - dirtyRooms) / totalRooms) * 100) : 0;
    const inhouseToday = reservationRows.filter(
      (r) => r.check_in <= today && r.check_out > today && r.status !== 'cancelled',
    );
    const occupancy = totalRooms > 0 ? Math.round((inhouseToday.length / totalRooms) * 100) : 0;
    const arrivalsToday = reservationRows.filter(
      (r) => r.check_in === today && r.status !== 'cancelled',
    ).length;
    const vipCount = reservationRows.filter((r) => {
      const g = r.guest_id ? guestsById[r.guest_id] : null;
      return !!g?.loyalty_level;
    }).length;
    const unpaid = reservationRows.filter(
      (r) => r.payment_status !== 'paid' && r.status !== 'cancelled',
    );
    const unpaidAmount = unpaid.reduce(
      (s, r) => s + Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0)),
      0,
    );
    return {
      occupancy,
      totalRooms,
      dirtyRooms,
      cleanPct,
      arrivalsToday,
      vipCount,
      unpaidAmount,
      unpaidCount: unpaid.length,
    };
  }, [reservationRows, dbRooms, guestsById]);

  return {
    rows,
    kpis,
    isLoading: reservationsQ.isLoading || roomsQ.isLoading,
    error: (reservationsQ.error as Error | null) ?? (roomsQ.error as Error | null) ?? null,
  };
}
