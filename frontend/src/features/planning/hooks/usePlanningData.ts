/**
 * FLOWTYM — PLANNING DATA HOOK
 * 
 * Centralise la récupération et la synchronisation temps réel des données
 * du Planning : rooms + reservations.
 * 
 * Stratégie :
 * 1. Fetch initial depuis Supabase au mount
 * 2. Subscribe aux changements realtime (INSERT, UPDATE, DELETE)
 * 3. Merge automatique dans l'état local
 * 4. Expose des helpers pour mutations optimistes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { normalizeStatus, getStatusDisplay, type NormalizedStatus } from '@/src/lib/status-mapper';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PlanningRoom {
  id: string;
  number: string;
  type: string;
  category: string;
  floor: string;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';
  active: boolean;
}

export interface PlanningReservation {
  id: string;
  reference: string;
  roomId: string;
  roomNumber: string;
  
  // Guest
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  
  // Dates
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  nights: number;
  
  // Status
  status: NormalizedStatus;
  statusLabel: string;
  statusColor: string;
  statusDot: string;
  
  // Pricing
  totalAmount: number | null;
  paidAmount: number | null;
  balance: number | null;
  pricePerNight: number | null;
  
  // Meta
  source: string | null;
  sourceColor: string;
  adults: number;
  children: number;
  pax: number;
  notes: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface UsePlanningDataReturn {
  rooms: PlanningRoom[];
  reservations: PlanningReservation[];
  loading: boolean;
  error: Error | null;
  
  // Mutations (optimistic updates)
  moveReservation: (reservationId: string, newRoomId: string) => Promise<void>;
  updateReservationStatus: (reservationId: string, newStatus: NormalizedStatus) => Promise<void>;
  deleteReservation: (reservationId: string) => Promise<void>;
  
  // Refetch manuel si besoin
  refetch: () => Promise<void>;
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function usePlanningData(): UsePlanningDataReturn {
  const { session } = useAuth();
  const tenantId = session?.tenantId ?? null;
  
  const [rooms, setRooms] = useState<PlanningRoom[]>([]);
  const [reservations, setReservations] = useState<PlanningReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ─── FETCH INITIAL ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setRooms([]);
      setReservations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, number, type, category, room_type_code, active')
        .eq('hotel_id', tenantId)
        .eq('active', true)
        .order('number', { ascending: true });

      if (roomsError) throw roomsError;

      const mappedRooms: PlanningRoom[] = (roomsData ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type ?? r.room_type_code ?? 'Standard',
        category: r.category ?? 'Classique',
        floor: inferFloor(r.number),
        status: 'clean',
        active: r.active ?? true,
      }));

      setRooms(mappedRooms);

      // Fetch reservations (30 jours avant → 365 jours après pour avoir un bon horizon)
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      const dateTo = new Date();
      dateTo.setDate(dateTo.getDate() + 365);

      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('hotel_id', tenantId)
        .gte('check_out', dateFrom.toISOString().split('T')[0])
        .lte('check_in', dateTo.toISOString().split('T')[0])
        .order('check_in', { ascending: true });

      if (resError) throw resError;

      const mappedRes: PlanningReservation[] = (resData ?? []).map(mapReservation);
      setReservations(mappedRes);
    } catch (err) {
      console.error('[usePlanningData] Fetch failed:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Subscribe to reservations changes
    const channel = supabase
      .channel(`planning-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `hotel_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[Planning Realtime]', payload.eventType, payload.new);

          if (payload.eventType === 'INSERT') {
            const newRes = mapReservation(payload.new as any);
            setReservations((prev) => [...prev, newRes]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapReservation(payload.new as any);
            setReservations((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setReservations((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tenantId]);

  // ─── MUTATIONS ──────────────────────────────────────────────────────────────

  const moveReservation = useCallback(
    async (reservationId: string, newRoomId: string) => {
      // Optimistic update
      const targetRoom = rooms.find((r) => r.id === newRoomId);
      if (!targetRoom) return;

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, roomId: newRoomId, roomNumber: targetRoom.number }
            : r
        )
      );

      // Real update
      const { error } = await supabase
        .from('reservations')
        .update({ room_id: newRoomId, room_number: targetRoom.number })
        .eq('id', reservationId);

      if (error) {
        console.error('[moveReservation] Failed:', error);
        // Rollback on error (refetch)
        fetchData();
      }
    },
    [rooms, fetchData]
  );

  const updateReservationStatus = useCallback(
    async (reservationId: string, newStatus: NormalizedStatus) => {
      // Optimistic
      const display = getStatusDisplay(newStatus);
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                status: newStatus,
                statusLabel: display.label,
                statusColor: display.color,
                statusDot: display.dotColor,
              }
            : r
        )
      );

      // Real
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId);

      if (error) {
        console.error('[updateReservationStatus] Failed:', error);
        fetchData();
      }
    },
    [fetchData]
  );

  const deleteReservation = useCallback(
    async (reservationId: string) => {
      // Optimistic
      setReservations((prev) => prev.filter((r) => r.id !== reservationId));

      // Real
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) {
        console.error('[deleteReservation] Failed:', error);
        fetchData();
      }
    },
    [fetchData]
  );

  return {
    rooms,
    reservations,
    loading,
    error,
    moveReservation,
    updateReservationStatus,
    deleteReservation,
    refetch: fetchData,
  };
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function inferFloor(roomNumber: string): string {
  const trimmed = roomNumber.trim();
  if (trimmed.length < 2) return '—';
  const firstChar = trimmed[0];
  const digit = parseInt(firstChar, 10);
  if (Number.isNaN(digit)) return '—';
  if (digit === 0) return 'RDC';
  return `Étage ${digit}`;
}

function mapReservation(raw: any): PlanningReservation {
  const normalizedStatus = normalizeStatus(raw.status, 'db');
  const display = getStatusDisplay(normalizedStatus);

  const totalAmount = raw.total_amount ?? 0;
  const paidAmount = raw.paid_amount ?? 0;
  const balance = totalAmount - paidAmount;
  const nights = raw.nights ?? 1;
  const pricePerNight = nights > 0 ? totalAmount / nights : totalAmount;

  return {
    id: raw.id,
    reference: raw.reference ?? raw.external_ref ?? raw.id.slice(0, 8),
    roomId: raw.room_id ?? '',
    roomNumber: raw.room_number ?? '—',
    
    guestName: raw.guest_name ?? 'Client',
    guestEmail: raw.guest_email,
    guestPhone: raw.guest_phone,
    
    checkIn: raw.check_in,
    checkOut: raw.check_out,
    nights,
    
    status: normalizedStatus,
    statusLabel: display.label,
    statusColor: display.color,
    statusDot: display.dotColor,
    
    totalAmount,
    paidAmount,
    balance,
    pricePerNight,
    
    source: raw.source ?? 'Direct',
    sourceColor: getChannelColor(raw.source),
    adults: raw.adults ?? 2,
    children: raw.children ?? 0,
    pax: raw.pax ?? (raw.adults ?? 2) + (raw.children ?? 0),
    notes: raw.notes,
    
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function getChannelColor(source: string | null): string {
  const s = (source ?? '').toLowerCase();
  if (s.includes('booking')) return 'bg-[#003580]';
  if (s.includes('airbnb')) return 'bg-[#FF5A5F]';
  if (s.includes('expedia')) return 'bg-[#FFCB05]';
  if (s.includes('agoda')) return 'bg-[#E74C3C]';
  return 'bg-[#8B5CF6]';  // Direct
}
