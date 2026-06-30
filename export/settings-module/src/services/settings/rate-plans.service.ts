/**
 * FLOWTYM — Plans tarifaires (lecture directe Supabase, sans dépendance au store RMS).
 *
 * Utilisé par la page Paramètres > Plans tarifaires pour ne pas déclencher
 * le chargement complet du Calendrier tarifaire au montage.
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface RatePlanRow {
  id: string;
  plan_code: string;
  plan_name: string;
  pension_type: string | null;
  channel_type: string | null;
  connectivity_type: string | null;
  is_active: boolean;
  is_reference: boolean;
  calc_mode: string | null;
  room_type_id: string | null;
}

export interface RoomTypeRow {
  id: string;
  room_type_code: string;
  room_type_name: string;
}

export interface RatePlanWithRoom extends RatePlanRow {
  room: RoomTypeRow | null;
}

export async function listRatePlansWithRooms(): Promise<RatePlanWithRoom[]> {
  const hid = await resolveHotelId();
  if (!hid) return [];

  const [{ data: plans }, { data: rooms }] = await Promise.all([
    sb.from('rate_plans').select('*').eq('hotel_id', hid).is('deleted_at', null).order('plan_name'),
    sb.from('room_types').select('id, room_type_code, room_type_name').eq('hotel_id', hid).eq('is_active', true),
  ]);

  const roomMap = new Map<string, RoomTypeRow>((rooms ?? []).map((r: RoomTypeRow) => [r.id, r]));

  return (plans ?? []).map((p: RatePlanRow) => ({
    ...p,
    room: p.room_type_id ? (roomMap.get(p.room_type_id) ?? null) : null,
  }));
}

export async function listRoomTypeRows(): Promise<RoomTypeRow[]> {
  const hid = await resolveHotelId();
  if (!hid) return [];
  const { data } = await sb.from('room_types').select('id, room_type_code, room_type_name').eq('hotel_id', hid).eq('is_active', true).order('room_type_name');
  return data ?? [];
}
