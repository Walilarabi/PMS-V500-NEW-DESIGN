/**
 * FLOWTYM — Persistance Supabase pour les entités RMS
 *
 * Helpers pour persister les mutations du store
 * (addRoomType / updateRoomType / addRatePlan / updateRatePlan…)
 * dans les tables Supabase.
 *
 * Stratégie :
 *   - chaque fonction renvoie { error: string | null } ; AUCUNE erreur
 *     n'est avalée silencieusement (le store l'affiche en toast et
 *     annule l'ajout optimiste si la persistance échoue) ;
 *   - upsert sur `room_type_code` / `plan_code` + `hotel_id` ;
 *   - hotel_id récupéré via RPC `get_user_hotel_id`.
 */

import { supabase } from '@/src/lib/supabase';
import type { RoomTypeData, RatePlanData } from '@/src/components/rms/types';

export interface PersistResult {
  error: string | null;
}

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
export async function upsertRoomTypeToSupabase(room: RoomTypeData): Promise<PersistResult> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) {
      return { error: "Hôtel introuvable (session expirée ?) — reconnectez-vous." };
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
      virtual_component_ids: room.virtualComposition?.componentRoomTypeIds ?? null,
      virtual_components_required: room.virtualComposition?.componentsRequired ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('room_types')
      .upsert(payload, { onConflict: 'hotel_id,room_type_code' });

    if (error) {
      console.error('[rms-persist] upsertRoomType failed:', error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rms-persist] upsertRoomType threw:', msg);
    return { error: msg };
  }
}

/**
 * Supprime une chambre de `public.room_types`.
 */
export async function deleteRoomTypeFromSupabase(roomTypeCode: string): Promise<PersistResult> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) return { error: "Hôtel introuvable — reconnectez-vous." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('room_types')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('room_type_code', roomTypeCode);

    if (error) {
      console.error('[rms-persist] deleteRoomType failed:', error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rms-persist] deleteRoomType threw:', msg);
    return { error: msg };
  }
}

// ─── Rate Plans ───────────────────────────────────────────────────────────────

/**
 * Upsert un plan tarifaire dans `public.rate_plans`.
 * Identifié par `(hotel_id, plan_code)`.
 */
export async function upsertRatePlanToSupabase(plan: RatePlanData): Promise<PersistResult> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) {
      return { error: "Hôtel introuvable (session expirée ?) — reconnectez-vous." };
    }

    const payload = {
      hotel_id:              hotelId,
      plan_code:             plan.planCode,
      plan_name:             plan.planName,
      pension_type:          plan.pensionType,
      channel_type:          plan.channelType,
      calc_mode:             plan.calcMode,
      calc_value:            plan.calcValue ?? 0,
      // UUID column : une chaîne vide ("") provoque "invalid input syntax for
      // type uuid" → on coerce vers null (cas des plans importés sans référent).
      reference_plan_id:     plan.referencePlanId ? plan.referencePlanId : null,
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
      console.error('[rms-persist] upsertRatePlan failed:', error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rms-persist] upsertRatePlan threw:', msg);
    return { error: msg };
  }
}

/**
 * Supprime un plan tarifaire de `public.rate_plans`.
 */
export async function deleteRatePlanFromSupabase(planCode: string): Promise<PersistResult> {
  try {
    const hotelId = await getHotelId();
    if (!hotelId) return { error: "Hôtel introuvable — reconnectez-vous." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rate_plans')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('plan_code', planCode);

    if (error) {
      console.error('[rms-persist] deleteRatePlan failed:', error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rms-persist] deleteRatePlan threw:', msg);
    return { error: msg };
  }
}
