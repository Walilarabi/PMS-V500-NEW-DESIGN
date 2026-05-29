/**
 * FLOWTYM — Persistance Supabase pour les entités RMS
 *
 * Helpers fire-and-forget pour persister les mutations du store
 * (addRoomType / updateRoomType / addRatePlan / updateRatePlan…)
 * dans les tables Supabase.
 *
 * Stratégie :
 *   - best-effort : une erreur réseau ne bloque jamais l'UI
 *   - upsert sur `room_type_code` / `plan_code` + `hotel_id`
 *   - hotel_id récupéré via RPC `get_user_hotel_id` (déjà utilisé dans le store)
 */

import { supabase } from '@/src/lib/supabase';
import type { RoomTypeData, RatePlanData } from '@/src/components/rms/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHotelId(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_user_hotel_id');
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

// ─── Room Types ───────────────────────────────────────────────────────────────

/**
 * Upsert une chambre dans `public.room_types`.
 * Identifié par `(hotel_id, room_type_code)`.
 */
export async function upsertRoomTypeToSupabase(room: RoomTypeData): Promise<void> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) {
      console.warn('[rms-persist] No hotel_id — skipping room upsert');
      return;
    }

    const payload = {
      hotel_id:         hotelId,
      room_type_code:   room.roomTypeCode,
      room_type_name:   room.roomTypeName,
      capacity:         room.capacity,
      bathroom:         room.bathroom,
      equipment:        room.equipment,
      view:             room.view ?? null,
      description:      room.description ?? null,
      is_reference:     room.isReference,
      is_active:        room.isActive,
      diff_from_ref:    room.diffFromRef ?? 0,
      diff_type:        room.diffType ?? 'fixed',
      partner_ids:      room.partnerIds ?? room.distributionChannels ?? [],
      is_virtual:       room.isVirtual ?? false,
      virtual_kind:     room.virtualKind ?? null,
      // Stocker les IDs composants si chambre virtuelle
      virtual_component_ids: room.virtualComposition?.componentRoomTypeIds ?? null,
      virtual_components_required: room.virtualComposition?.componentsRequired ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('room_types')
      .upsert(payload, { onConflict: 'hotel_id,room_type_code' });

    if (error) {
      console.warn('[rms-persist] upsertRoomType failed:', error.message);
    } else {
      console.info(`[rms-persist] ✅ Room upserted: ${room.roomTypeCode}`);
    }
  } catch (err) {
    console.warn('[rms-persist] upsertRoomType threw:', err);
  }
}

/**
 * Supprime une chambre de `public.room_types`.
 */
export async function deleteRoomTypeFromSupabase(roomTypeCode: string): Promise<void> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('room_types')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('room_type_code', roomTypeCode);

    if (error) {
      console.warn('[rms-persist] deleteRoomType failed:', error.message);
    } else {
      console.info(`[rms-persist] ✅ Room deleted: ${roomTypeCode}`);
    }
  } catch (err) {
    console.warn('[rms-persist] deleteRoomType threw:', err);
  }
}

// ─── Rate Plans ───────────────────────────────────────────────────────────────

/**
 * Upsert un plan tarifaire dans `public.rate_plans`.
 * Identifié par `(hotel_id, plan_code)`.
 */
export async function upsertRatePlanToSupabase(plan: RatePlanData): Promise<void> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) {
      console.warn('[rms-persist] No hotel_id — skipping rate plan upsert');
      return;
    }

    const payload = {
      hotel_id:              hotelId,
      plan_code:             plan.planCode,
      plan_name:             plan.planName,
      pension_type:          plan.pensionType,
      channel_type:          plan.channelType,
      calc_mode:             plan.calcMode,
      calc_value:            plan.calcValue ?? 0,
      reference_plan_id:     plan.referencePlanId ?? null,
      connectivity_type:     plan.connectivityType,
      is_reference:          plan.isReference,
      is_active:             plan.isActive,
      distribution_channels: plan.partnerIds ?? plan.distributionChannels ?? [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rate_plans')
      .upsert(payload, { onConflict: 'hotel_id,plan_code' });

    if (error) {
      console.warn('[rms-persist] upsertRatePlan failed:', error.message);
    } else {
      console.info(`[rms-persist] ✅ Rate plan upserted: ${plan.planCode}`);
    }
  } catch (err) {
    console.warn('[rms-persist] upsertRatePlan threw:', err);
  }
}

/**
 * Supprime un plan tarifaire de `public.rate_plans`.
 */
export async function deleteRatePlanFromSupabase(planCode: string): Promise<void> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rate_plans')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('plan_code', planCode);

    if (error) {
      console.warn('[rms-persist] deleteRatePlan failed:', error.message);
    } else {
      console.info(`[rms-persist] ✅ Rate plan deleted: ${planCode}`);
    }
  } catch (err) {
    console.warn('[rms-persist] deleteRatePlan threw:', err);
  }
}
