/**
 * FLOWTYM — Service partenaires de distribution.
 *
 * CRUD complet, 100 % Supabase, filtré par hotel_id (RLS) :
 *   distribution_partners, partner_room_mappings, rate_plan_partner_mappings,
 *   partner_commissions, partner_promotions.
 *
 * Aucune donnée fake, aucun localStorage.
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type CommissionType = 'percent' | 'fixed';
export type PartnerType = 'OTA' | 'direct' | 'corporate' | 'wholesaler' | 'GDS' | 'other';

export interface Partner {
  id: string;
  name: string;
  external_id: string | null;
  partner_type: PartnerType;
  default_commission_type: CommissionType;
  default_commission_value: number;
  currency: string;
  is_active: boolean;
  updated_at: string;
}

export interface PartnerSummary extends Partner {
  rooms_mapped: number;
  plans_mapped: number;
  active_promotions: number;
}

export interface RoomMapping {
  id: string; partner_id: string; room_type_id: string;
  partner_room_code: string | null; partner_room_name: string | null;
  capacity: number | null; display_priority: number; is_active: boolean;
}
export interface PlanMapping {
  id: string; partner_id: string; rate_plan_id: string;
  partner_rate_code: string | null; partner_rate_name: string | null;
  meal_plan: string | null; cancellation_type: string | null; occupancy: string | null;
  is_active: boolean;
}
export interface Commission {
  id: string; partner_id: string; room_type_id: string | null; rate_plan_id: string | null;
  commission_type: CommissionType; commission_value: number;
  start_date: string | null; end_date: string | null; is_active: boolean;
}
export interface Promotion {
  id: string; partner_id: string; room_type_id: string | null; rate_plan_id: string | null;
  name: string; code: string | null; discount_type: CommissionType; discount_value: number;
  start_date: string | null; end_date: string | null; is_stackable: boolean; is_active: boolean;
}

export interface Option { id: string; code: string; name: string; isVirtual?: boolean; }

/** Types de chambres ACTIVES (id UUID + code + nom) pour les mappings.
 *  Inclut les chambres virtuelles (distribuables) ; exclut les inactives. */
export async function listRoomTypeOptions(): Promise<Option[]> {
  const hid = await hotelId();
  if (!hid) return [];
  const { data } = await sb.from('room_types')
    .select('id, room_type_code, room_type_name, is_virtual')
    .eq('hotel_id', hid).eq('is_active', true).order('room_type_name');
  return (data ?? []).map((r: { id: string; room_type_code: string; room_type_name: string; is_virtual: boolean }) =>
    ({ id: r.id, code: r.room_type_code, name: r.room_type_name, isVirtual: !!r.is_virtual }));
}

/**
 * Synchronise en une fois les chambres mappées d'un partenaire :
 * upsert (dédup hotel_id+partner_id+room_type_id) pour les sélectionnées,
 * suppression pour celles décochées. Évite les doublons.
 */
export async function setPartnerRoomMappings(partnerId: string, roomTypeIds: string[]): Promise<{ error: string | null }> {
  const hid = await hotelId();
  if (!hid) return { error: 'Hôtel introuvable — reconnectez-vous.' };
  const { data: existing } = await sb.from('partner_room_mappings').select('id, room_type_id').eq('partner_id', partnerId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingRows: { id: string; room_type_id: string }[] = existing ?? [];
  const selected = new Set(roomTypeIds);
  const existingIds = new Set(existingRows.map((r) => r.room_type_id));
  const toAdd = roomTypeIds.filter((id) => !existingIds.has(id));
  const toRemove = existingRows.filter((r) => !selected.has(r.room_type_id)).map((r) => r.id);

  if (toAdd.length) {
    const payload = toAdd.map((rid) => ({ hotel_id: hid, partner_id: partnerId, room_type_id: rid, is_active: true }));
    const { error } = await sb.from('partner_room_mappings').upsert(payload, { onConflict: 'hotel_id,partner_id,room_type_id' });
    if (error) return { error: error.message };
  }
  if (roomTypeIds.length) {
    await sb.from('partner_room_mappings').update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('partner_id', partnerId).in('room_type_id', roomTypeIds);
  }
  if (toRemove.length) {
    const { error } = await sb.from('partner_room_mappings').delete().in('id', toRemove);
    if (error) return { error: error.message };
  }
  return { error: null };
}
/** Plans tarifaires (id UUID + code + nom) pour les dropdowns de mapping. */
export async function listRatePlanOptions(): Promise<Option[]> {
  const hid = await hotelId();
  if (!hid) return [];
  const { data } = await sb.from('rate_plans').select('id, plan_code, plan_name').eq('hotel_id', hid).is('deleted_at', null).order('plan_name');
  return (data ?? []).map((r: { id: string; plan_code: string; plan_name: string }) => ({ id: r.id, code: r.plan_code, name: r.plan_name }));
}

const hotelId = resolveHotelId; // résolveur mémoïsé partagé

// ─── Partners list (with counts) ──────────────────────────────────────────────
export async function listPartners(): Promise<PartnerSummary[]> {
  const hid = await hotelId();
  if (!hid) return [];
  const [{ data: partners }, { data: rooms }, { data: plans }, { data: promos }] = await Promise.all([
    sb.from('distribution_partners').select('*').eq('hotel_id', hid).order('name'),
    sb.from('partner_room_mappings').select('partner_id').eq('hotel_id', hid).eq('is_active', true),
    sb.from('rate_plan_partner_mappings').select('partner_id').eq('hotel_id', hid).eq('is_active', true),
    sb.from('dist_partner_promotions').select('partner_id').eq('hotel_id', hid).eq('is_active', true),
  ]);
  const count = (rows: { partner_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.partner_id === id).length;
  return (partners ?? []).map((p: Partner) => ({
    ...p,
    rooms_mapped: count(rooms, p.id),
    plans_mapped: count(plans, p.id),
    active_promotions: count(promos, p.id),
  }));
}

export async function upsertPartner(p: Partial<Partner> & { name: string }): Promise<{ id: string | null; error: string | null }> {
  const hid = await hotelId();
  if (!hid) return { id: null, error: 'Hôtel introuvable — reconnectez-vous.' };
  const payload: Record<string, unknown> = {
    hotel_id: hid, name: p.name, external_id: p.external_id ?? null,
    partner_type: p.partner_type ?? 'OTA',
    default_commission_type: p.default_commission_type ?? 'percent',
    default_commission_value: p.default_commission_value ?? 0,
    currency: p.currency ?? 'EUR', is_active: p.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  if (p.id) payload.id = p.id;
  const { data, error } = await sb.from('distribution_partners')
    .upsert(payload, { onConflict: 'hotel_id,name' }).select('id').maybeSingle();
  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? p.id ?? null, error: null };
}

export async function deletePartner(id: string): Promise<{ error: string | null }> {
  const { error } = await sb.from('distribution_partners').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ─── Generic detail loaders ───────────────────────────────────────────────────
export async function getRoomMappings(partnerId: string): Promise<RoomMapping[]> {
  const { data } = await sb.from('partner_room_mappings').select('*').eq('partner_id', partnerId).order('display_priority');
  return data ?? [];
}
export async function getPlanMappings(partnerId: string): Promise<PlanMapping[]> {
  const { data } = await sb.from('rate_plan_partner_mappings').select('*').eq('partner_id', partnerId);
  return data ?? [];
}
export async function getCommissions(partnerId: string): Promise<Commission[]> {
  const { data } = await sb.from('dist_partner_commissions').select('*').eq('partner_id', partnerId);
  return data ?? [];
}
export async function getPromotions(partnerId: string): Promise<Promotion[]> {
  const { data } = await sb.from('dist_partner_promotions').select('*').eq('partner_id', partnerId);
  return data ?? [];
}

// ─── Upserts / deletes ──────────────────────────────────────────────────────
async function withHotel(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const hid = await hotelId();
  if (!hid) return null;
  return { ...payload, hotel_id: hid, updated_at: new Date().toISOString() };
}

export async function upsertRoomMapping(m: Partial<RoomMapping> & { partner_id: string; room_type_id: string }): Promise<{ error: string | null }> {
  const payload = await withHotel(m as Record<string, unknown>);
  if (!payload) return { error: 'Hôtel introuvable.' };
  const { error } = await sb.from('partner_room_mappings').upsert(payload, { onConflict: 'hotel_id,partner_id,room_type_id' });
  return { error: error?.message ?? null };
}
export async function upsertPlanMapping(m: Partial<PlanMapping> & { partner_id: string; rate_plan_id: string }): Promise<{ error: string | null }> {
  const payload = await withHotel(m as Record<string, unknown>);
  if (!payload) return { error: 'Hôtel introuvable.' };
  const { error } = await sb.from('rate_plan_partner_mappings').upsert(payload, { onConflict: 'hotel_id,rate_plan_id,partner_id' });
  return { error: error?.message ?? null };
}
export async function upsertCommission(c: Partial<Commission> & { partner_id: string }): Promise<{ error: string | null }> {
  const payload = await withHotel(c as Record<string, unknown>);
  if (!payload) return { error: 'Hôtel introuvable.' };
  const { error } = await sb.from('dist_partner_commissions').upsert(payload);
  return { error: error?.message ?? null };
}
export async function upsertPromotion(p: Partial<Promotion> & { partner_id: string; name: string }): Promise<{ error: string | null }> {
  const payload = await withHotel(p as Record<string, unknown>);
  if (!payload) return { error: 'Hôtel introuvable.' };
  const { error } = await sb.from('dist_partner_promotions').upsert(payload);
  return { error: error?.message ?? null };
}

export async function deleteRow(table: 'partner_room_mappings' | 'rate_plan_partner_mappings' | 'dist_partner_commissions' | 'dist_partner_promotions', id: string): Promise<{ error: string | null }> {
  const { error } = await sb.from(table).delete().eq('id', id);
  return { error: error?.message ?? null };
}
