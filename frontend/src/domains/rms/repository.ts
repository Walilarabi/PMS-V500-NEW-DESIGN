/**
 * FLOWTYM RMS — Supabase repository (data access layer)
 *
 * Pattern (consistent with reservations/repository.ts):
 *   - Pure functions, no React state
 *   - Returns typed Zod-parsed rows or throws mapped errors
 *   - All requests are tenant-scoped by RLS (no manual hotel_id filter needed
 *     for SELECT, but we pass it for clarity and to satisfy INSERT policies)
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, ConflictError } from '@/src/domains/_shared/errors';
import {
  type RatePlanRow,
  type RatePriceRow,
  type RateRestrictionRow,
  type PricingRulesRow,
  type CompetitorRateRow,
  ratePlanRowSchema,
  ratePriceRowSchema,
  rateRestrictionRowSchema,
  pricingRulesRowSchema,
  competitorRateRowSchema,
} from './schemas';

// ─── Fetch full calendar payload ────────────────────────────────────────────

export interface CalendarPayload {
  ratePlans: RatePlanRow[];
  pricingRules: PricingRulesRow | null;
  prices: RatePriceRow[];
  restrictions: RateRestrictionRow[];
  competitorRates: CompetitorRateRow[];
}

export interface FetchCalendarParams {
  hotelId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  includeCompetitors?: boolean;
}

/** Fetch everything needed to render the Revenue Calendar for a date window. */
export async function fetchCalendar(params: FetchCalendarParams): Promise<CalendarPayload> {
  const { hotelId, from, to, includeCompetitors = false } = params;

  const [
    plansRes,
    rulesRes,
    pricesRes,
    restrictionsRes,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rate_plans')
      .select('*')
      .eq('hotel_id', hotelId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('is_reference', { ascending: false })
      .order('plan_code', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('pricing_rules')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rate_prices')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('stay_date', from)
      .lte('stay_date', to),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rate_restrictions')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('stay_date', from)
      .lte('stay_date', to),
  ]);

  if (plansRes.error) throw mapSupabaseError(plansRes.error);
  if (rulesRes.error) throw mapSupabaseError(rulesRes.error);
  if (pricesRes.error) throw mapSupabaseError(pricesRes.error);
  if (restrictionsRes.error) throw mapSupabaseError(restrictionsRes.error);

  let competitorRates: CompetitorRateRow[] = [];
  if (includeCompetitors) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compRes = await (supabase as any)
      .from('competitor_rates_latest')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('stay_date', from)
      .lte('stay_date', to);
    if (compRes.error) throw mapSupabaseError(compRes.error);
    competitorRates = ((compRes.data ?? []) as unknown[])
      .map((r) => {
        const parsed = competitorRateRowSchema.safeParse(r);
        return parsed.success ? parsed.data : null;
      })
      .filter((r): r is CompetitorRateRow => r !== null);
  }

  return {
    ratePlans: ((plansRes.data ?? []) as unknown[]).map((r) => ratePlanRowSchema.parse(r)),
    pricingRules: rulesRes.data ? pricingRulesRowSchema.parse(rulesRes.data) : null,
    prices: ((pricesRes.data ?? []) as unknown[]).map((r) => ratePriceRowSchema.parse(r)),
    restrictions: ((restrictionsRes.data ?? []) as unknown[]).map((r) =>
      rateRestrictionRowSchema.parse(r),
    ),
    competitorRates,
  };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Update a single price with optimistic concurrency check.
 * If version doesn't match, throws ConflictError → client must reload.
 *
 * This DOES NOT cascade. Use cascadeReferencePrice() for reference prices.
 */
export async function updatePrice(input: {
  id: string;
  hotelId: string;
  price: number;
  version: number;
  source?: string;
}): Promise<RatePriceRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rate_prices')
    .update({
      price: input.price,
      source: input.source ?? 'manual',
      version: input.version + 1,
    })
    .eq('id', input.id)
    .eq('hotel_id', input.hotelId)
    .eq('version', input.version) // optimistic lock
    .select()
    .single();

  if (error) {
    // PGRST116 = no rows = version mismatch (someone else updated)
    if (error.code === 'PGRST116') {
      throw new ConflictError(
        'Ce prix a été modifié par un autre utilisateur. Rechargez la grille.',
      );
    }
    throw mapSupabaseError(error);
  }
  return ratePriceRowSchema.parse(data);
}

/**
 * Trigger the server-side cascade RPC.
 * Updates the reference price + all derived prices for a given stay_date.
 *
 * Returns the list of updated rows.
 */
export async function cascadeReferencePrice(input: {
  hotelId: string;
  stayDate: string;
  newPrice: number;
}): Promise<Array<{ id: string; room_type_code: string; plan_id: string; price: number; source: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('cascade_reference_price', {
    p_hotel_id: input.hotelId,
    p_stay_date: input.stayDate,
    p_new_price: input.newPrice,
  });

  if (error) throw mapSupabaseError(error);

  // RPC returns rows with prefixed column names (out_id, out_room_type_code, ...)
  // Normalize to clean field names.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.out_id ?? r.id,
    room_type_code: r.out_room_type_code ?? r.room_type_code,
    plan_id: r.out_plan_id ?? r.plan_id,
    price: r.out_price ?? r.price,
    source: r.out_source ?? r.source,
  }));
}

/** Update one restriction (CTA/CTD/MinLOS/MaxLOS/override) with optimistic lock. */
export async function updateRestriction(input: {
  id: string;
  hotelId: string;
  version: number;
  patch: Partial<{
    cta: boolean;
    ctd: boolean;
    min_stay: number | null;
    max_stay: number | null;
    inventory_override: 'manual_closed' | 'force_open' | null;
  }>;
}): Promise<RateRestrictionRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rate_restrictions')
    .update({ ...input.patch, version: input.version + 1 })
    .eq('id', input.id)
    .eq('hotel_id', input.hotelId)
    .eq('version', input.version)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ConflictError(
        'Cette restriction a été modifiée par un autre utilisateur. Rechargez la grille.',
      );
    }
    throw mapSupabaseError(error);
  }
  return rateRestrictionRowSchema.parse(data);
}
