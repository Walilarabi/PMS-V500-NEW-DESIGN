/**
 * FLOWTYM — Hook de synchronisation Supabase → stores locaux
 *
 * Pour faire fonctionner le Planning et la Vue du Jour avec des données
 * Supabase RÉELLES (Folkestone et autres hôtels), sans tout refactoriser,
 * ce hook lit Supabase et injecte les données dans :
 *
 *   - configStore (rooms) : pour que le Planning affiche les vraies chambres
 *   - ReservationContext (réservations) : pour que toutes les vues partagent
 *     les mêmes données
 *
 * Stratégie :
 *   1. Au login (changement de tenantId), vérifier si l'hôtel a des données
 *   2. Si oui → MIGRATION : remplace les stores locaux par les vraies données
 *   3. Si non → garde les mocks (cas Mas Provençal demo)
 *
 * Le hook est idempotent : il marque le store comme "synchronisé via Supabase"
 * et ne le re-synchronise qu'à chaque changement d'hôtel.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useConfigStore } from '@/src/store/configStore';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useReservations as useReservationContext } from '@/src/contexts/ReservationContext';
import type { Reservation } from '@/src/contexts/ReservationContext';

// Types intermédiaires pour mapping
interface SupabaseRoom {
  id: string;
  number: string;
  type: string | null;
  category: string | null;
  room_type_code: string | null;
  active: boolean | null;
}

interface SupabaseReservation {
  id: string;
  reference: string | null;
  room_id: string | null;
  room_number: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  status: string | null;
  adults: number | null;
  children: number | null;
  pax: number | null;
  total_amount: number | null;
  source: string | null;
  notes: string | null;
  room_type: string | null;
  room_category: string | null;
}

/**
 * Déduit l'étage depuis le numéro de chambre (ex: "201" → "Étage 2").
 */
function inferFloor(roomNumber: string): string {
  const trimmed = roomNumber.trim();
  if (trimmed.length < 2) return '—';
  const firstChar = trimmed[0];
  const digit = parseInt(firstChar, 10);
  if (Number.isNaN(digit)) return '—';
  if (digit === 0) return 'RDC';
  return `Étage ${digit}`;
}

function mapSupabaseRoomToStore(r: SupabaseRoom): {
  id: string;
  number: string;
  type: string;
  category: string;
  floor: string;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';
  price?: number;
} {
  return {
    id: r.id,
    number: r.number,
    type: r.type ?? r.room_type_code ?? 'Standard',
    category: r.category ?? 'Classique',
    floor: inferFloor(r.number),
    status: 'clean',
  };
}

/**
 * Mappe le status DB vers le status opérationnel du contexte.
 */
function mapStatus(dbStatus: string | null): { label: string; reservationStatus: 'option' | 'pending' | 'confirmed' | 'cancelled' | 'noshow'; color: string; dot: string } {
  switch (dbStatus) {
    case 'confirmed':
      return { label: 'Confirmée', reservationStatus: 'confirmed', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
    case 'checked_in':
      return { label: 'Check-in', reservationStatus: 'confirmed', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
    case 'checked_out':
      return { label: 'Check-out', reservationStatus: 'confirmed', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' };
    case 'cancelled':
      return { label: 'Annulée', reservationStatus: 'cancelled', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
    case 'pending':
      return { label: 'En attente', reservationStatus: 'pending', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
    default:
      return { label: dbStatus ?? '—', reservationStatus: 'confirmed', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' };
  }
}

/**
 * Formate une date ISO en "DD MMM" (ex: "16 mai").
 */
function formatDateShort(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return isoDate;
  }
}

function mapSupabaseReservationToContext(r: SupabaseReservation): Reservation {
  const statusInfo = mapStatus(r.status);
  const source = r.source ?? 'Direct';
  return {
    id: r.id,
    priority: 'normal',
    room: r.room_number ?? '—',
    roomType: r.room_type ?? r.room_category ?? '—',
    status: statusInfo.label,
    statusColor: statusInfo.color,
    dotColor: statusInfo.dot,
    client: r.guest_name ?? 'Client',
    arrival: `${r.check_in} 14:00`,
    departure: `${r.check_out} 11:00`,
    source,
    sourceColor: 'bg-violet-100 text-violet-700',
    pax: r.pax ?? (r.adults ?? 1) + (r.children ?? 0),
    payment: 'En attente',
    totalAmount: r.total_amount ?? 0,
    totalTTC: r.total_amount ?? 0,
    ownerFeeRate: 0.20,
    pmsFeeRate: 0.15,
    cleaningFee: 40,
    email: r.guest_email ?? '',
    reservationStatus: statusInfo.reservationStatus,
    checkIn: r.check_in,
    checkOut: r.check_out,
    guests: { adults: r.adults ?? 2, children: r.children ?? 0 },
    logs: [],
  } as Reservation;
}

/**
 * Hook principal — à monter au niveau de l'app (App.tsx).
 *
 * Surveille tenantId. Quand il change ET qu'on est authentifié, fetch les
 * rooms et réservations depuis Supabase et les injecte dans les stores locaux.
 */
export function useSupabaseSync() {
  const { status, session } = useAuth();
  const updateRooms = useConfigStore((s) => s.updateRooms);
  const { replaceAll: replaceAllReservations } = useReservationContext();
  const tenantId = session?.tenantId ?? null;

  // Garde une trace du dernier tenantId synchronisé pour éviter les re-syncs inutiles
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !tenantId) return;
    if (lastSyncedRef.current === tenantId) return;

    let cancelled = false;

    async function syncAll() {
      try {
        // 1. ROOMS
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('id,number,type,category,room_type_code,active')
          .eq('hotel_id', tenantId)
          .eq('active', true)
          .order('number', { ascending: true });

        if (cancelled) return;
        if (roomsError) {
          console.warn('[useSupabaseSync] rooms fetch failed:', roomsError.message);
        } else {
          const supabaseRooms = (roomsData ?? []) as SupabaseRoom[];
          if (supabaseRooms.length > 0) {
            const mappedRooms = supabaseRooms.map(mapSupabaseRoomToStore);
            updateRooms(mappedRooms);
            console.info(`[useSupabaseSync] Synced ${mappedRooms.length} rooms from Supabase`);
          } else {
            console.info('[useSupabaseSync] No rooms in DB, keeping mocks');
          }
        }

        // 2. RESERVATIONS
        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select(
            'id,reference,room_id,room_number,guest_name,guest_email,guest_phone,' +
              'check_in,check_out,nights,status,adults,children,pax,total_amount,source,' +
              'notes,room_type,room_category'
          )
          .eq('hotel_id', tenantId)
          .order('check_in', { ascending: true })
          .limit(1000);

        if (cancelled) return;
        if (resError) {
          console.warn('[useSupabaseSync] reservations fetch failed:', resError.message);
        } else {
          const supabaseReservations = (resData ?? []) as SupabaseReservation[];
          if (supabaseReservations.length > 0) {
            const mapped = supabaseReservations.map(mapSupabaseReservationToContext);
            replaceAllReservations(mapped);
            console.info(
              `[useSupabaseSync] Synced ${mapped.length} reservations from Supabase`
            );
          } else {
            console.info('[useSupabaseSync] No reservations in DB, keeping mocks');
          }
        }

        lastSyncedRef.current = tenantId;
      } catch (e) {
        console.error('[useSupabaseSync] Unexpected error:', e);
      }
    }

    syncAll();

    return () => {
      cancelled = true;
    };
  }, [status, tenantId, updateRooms, replaceAllReservations]);
}
