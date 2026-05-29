/**
 * FLOWTYM — Persistance Supabase de l'import des plans tarifaires partenaires.
 *
 * Écrit RÉELLEMENT en base (aucun localStorage métier) :
 *   - public.distribution_partners        (dédup par hotel_id + name)
 *   - public.rate_plans                   (dédup par hotel_id + plan_code)
 *   - public.rate_plan_partner_mappings   (dédup par hotel_id + plan + partner)
 *
 * Renvoie des compteurs (créés / réutilisés / mis à jour) + erreurs.
 */

import { supabase } from '@/src/lib/supabase';
import type { PartnerRateImportReport } from './partner-rate-import.service';

export interface ImportResult {
  ok: boolean;
  partnersCreated: number;
  partnersReused: number;
  plansCreated: number;
  plansUpdated: number;
  mappingsCreated: number;
  mappingsUpdated: number;
  errors: string[];
}

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

const PENSION_ALLOWED = new Set(['RO', 'BB', 'HB', 'FB', 'AI', 'Package']);

/** Pour la prévisualisation : codes de plans et noms de partenaires déjà en base. */
export async function fetchExistingForPreview(): Promise<{ planCodes: Set<string>; partnerNames: Set<string> }> {
  const hotelId = await getHotelId();
  if (!hotelId) return { planCodes: new Set(), partnerNames: new Set() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: plans }, { data: partners }] = await Promise.all([
    sb.from('rate_plans').select('plan_code').eq('hotel_id', hotelId),
    sb.from('distribution_partners').select('name').eq('hotel_id', hotelId),
  ]);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planCodes: new Set((plans ?? []).map((p: any) => String(p.plan_code))),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partnerNames: new Set((partners ?? []).map((p: any) => String(p.name).toLowerCase())),
  };
}

export async function importPartnerRatePlans(report: PartnerRateImportReport): Promise<ImportResult> {
  const result: ImportResult = {
    ok: false, partnersCreated: 0, partnersReused: 0,
    plansCreated: 0, plansUpdated: 0, mappingsCreated: 0, mappingsUpdated: 0, errors: [],
  };

  const hotelId = await getHotelId();
  if (!hotelId) {
    result.errors.push("Hôtel introuvable (session expirée ?) — reconnectez-vous.");
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // ── Snapshot de l'existant (pour distinguer créés / mis à jour) ──────────
  const [{ data: existPartners }, { data: existPlans }, { data: existMappings }] = await Promise.all([
    sb.from('distribution_partners').select('id, name').eq('hotel_id', hotelId),
    sb.from('rate_plans').select('id, plan_code').eq('hotel_id', hotelId),
    sb.from('rate_plan_partner_mappings').select('rate_plan_id, partner_id').eq('hotel_id', hotelId),
  ]);
  const existingPartnerNames = new Set<string>((existPartners ?? []).map((p: any) => String(p.name).toLowerCase()));
  const existingPlanCodes = new Set<string>((existPlans ?? []).map((p: any) => String(p.plan_code)));
  const existingMappingPairs = new Set<string>((existMappings ?? []).map((m: any) => `${m.rate_plan_id}:${m.partner_id}`));

  // ── 1. Partenaires (dédup hotel_id + name) ───────────────────────────────
  const partnerPayload = report.partners.map((p) => ({
    hotel_id: hotelId, name: p.name, external_id: p.externalId, is_active: p.isActive,
  }));
  if (partnerPayload.length > 0) {
    const { error } = await sb.from('distribution_partners')
      .upsert(partnerPayload, { onConflict: 'hotel_id,name' });
    if (error) { result.errors.push(`Partenaires : ${error.message}`); return result; }
  }
  for (const p of report.partners) {
    if (existingPartnerNames.has(p.name.toLowerCase())) result.partnersReused++;
    else result.partnersCreated++;
  }

  // Carte name(lower) → partner_id
  const { data: allPartners, error: pErr } = await sb.from('distribution_partners')
    .select('id, name').eq('hotel_id', hotelId);
  if (pErr) { result.errors.push(`Lecture partenaires : ${pErr.message}`); return result; }
  const partnerIdByName = new Map<string, string>();
  for (const p of allPartners ?? []) partnerIdByName.set(String(p.name).toLowerCase(), p.id);

  // ── 2. Plans tarifaires (dédup hotel_id + plan_code) ─────────────────────
  // Un même code peut apparaître pour plusieurs partenaires : on déduplique.
  const planByCode = new Map<string, (typeof report.plans)[number]>();
  for (const pl of report.plans) if (!planByCode.has(pl.code)) planByCode.set(pl.code, pl);

  const planPayload = [...planByCode.values()].map((pl) => ({
    hotel_id: hotelId,
    plan_code: pl.code,
    plan_name: pl.name || pl.code,
    pension_type: pl.mealPlan && PENSION_ALLOWED.has(pl.mealPlan) ? pl.mealPlan : 'RO',
    channel_type: 'OTA',
    calc_mode: 'derived',
    calc_value: 0,
    connectivity_type: 'Aucun',
    is_active: pl.isActive,
    is_reference: false,
    meal_plan: pl.mealPlan,
    cancellation_type: pl.cancellationType,
    occupancy: pl.occupancy,
    deleted_at: null,
  }));
  if (planPayload.length > 0) {
    const { error } = await sb.from('rate_plans')
      .upsert(planPayload, { onConflict: 'hotel_id,plan_code' });
    if (error) { result.errors.push(`Plans tarifaires : ${error.message}`); return result; }
  }
  for (const code of planByCode.keys()) {
    if (existingPlanCodes.has(code)) result.plansUpdated++;
    else result.plansCreated++;
  }

  // Carte plan_code → rate_plan_id
  const { data: allPlans, error: rpErr } = await sb.from('rate_plans')
    .select('id, plan_code').eq('hotel_id', hotelId);
  if (rpErr) { result.errors.push(`Lecture plans : ${rpErr.message}`); return result; }
  const planIdByCode = new Map<string, string>();
  for (const p of allPlans ?? []) planIdByCode.set(String(p.plan_code), p.id);

  // ── 3. Mappings (dédup hotel_id + rate_plan_id + partner_id) ─────────────
  const mappingPayload: Record<string, unknown>[] = [];
  const seenPairs = new Set<string>();
  for (const pl of report.plans) {
    const ratePlanId = planIdByCode.get(pl.code);
    const partnerId = partnerIdByName.get(pl.partnerName.toLowerCase());
    if (!ratePlanId || !partnerId) continue;
    const pair = `${ratePlanId}:${partnerId}`;
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    mappingPayload.push({
      hotel_id: hotelId, rate_plan_id: ratePlanId, partner_id: partnerId,
      partner_rate_code: pl.code, partner_rate_name: pl.name,
      meal_plan: pl.mealPlan, cancellation_type: pl.cancellationType, occupancy: pl.occupancy,
      is_active: pl.isActive,
    });
    if (existingMappingPairs.has(pair)) result.mappingsUpdated++;
    else result.mappingsCreated++;
  }
  if (mappingPayload.length > 0) {
    const { error } = await sb.from('rate_plan_partner_mappings')
      .upsert(mappingPayload, { onConflict: 'hotel_id,rate_plan_id,partner_id' });
    if (error) { result.errors.push(`Mappings : ${error.message}`); return result; }
  }

  result.ok = result.errors.length === 0;
  return result;
}
