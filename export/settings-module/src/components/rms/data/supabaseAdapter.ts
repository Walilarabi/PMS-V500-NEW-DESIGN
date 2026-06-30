/**
 * FLOWTYM RMS — Supabase adapter for the V500 rate calendar store.
 *
 * Performance architecture:
 *   - fetchStaticData()  → room_types, rooms, rate_plans, pricing_rules (once per session)
 *   - fetchRangeData()   → rate_prices, rate_restrictions (per navigation, with LRU cache)
 *   - buildRoomTypes()   → O(1) Map lookups replacing O(N²) filter/find chains
 *   - prefetchRange()    → background pre-load of next period
 *
 * Static data is cached module-level (not in Zustand) so it survives period
 * navigation without triggering a re-render. Call invalidateStaticCache() after
 * any CRUD on room_types or rate_plans.
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
import type {
  RoomTypeData,
  DateColumn,
  ViewMode,
  RatePlanData,
  RoomStatus,
  CellStatus,
  CalcMode,
  PricingRules,
  BathroomType,
  VirtualRoomKind,
} from '../types';
import type { NewRatePlanPayload, UpdateRatePlanPayload } from '../types';

// ─── Types internes ──────────────────────────────────────────────────────────

interface FetchResult {
  roomTypes: RoomTypeData[];
  dateColumns: DateColumn[];
  pricingRules?: PricingRules;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface StaticData {
  roomTypesRaw: AnyRow[];
  rooms: AnyRow[];
  plans: AnyRow[];
  rules: AnyRow | null;
  hotelId: string;
}

interface RangeData {
  prices: AnyRow[];
  restrictions: AnyRow[];
}

// ─── Module-level caches (survive navigation, no re-renders) ─────────────────

/** Static data: invalidated only after CRUD on room_types / rate_plans. */
let _staticCache: StaticData | null = null;

/** Range data: keyed by "from_to", max 6 entries (LRU-ish). */
const _rangeCache = new Map<string, { data: RangeData; fetchedAt: number }>();
const RANGE_CACHE_TTL = 2 * 60 * 1000; // 2 min — fresh enough for UX
const RANGE_CACHE_MAX = 6;

export function invalidateStaticCache(): void {
  _staticCache = null;
  _rangeCache.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function endOfWindow(start: Date, viewMode: ViewMode): Date {
  const end = new Date(start);
  const days = viewMode === '7days' ? 7 : viewMode === '15days' ? 15 : 30;
  end.setDate(end.getDate() + days - 1);
  return end;
}

export function buildDateColumns(start: Date, viewMode: ViewMode): DateColumn[] {
  const days = viewMode === '7days' ? 7 : viewMode === '15days' ? 15 : 30;
  const cols: DateColumn[] = [];
  const d = new Date(start);
  const todayStr = toISO(new Date());
  for (let i = 0; i < days; i++) {
    cols.push({
      date: toISO(d),
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      dayOfMonth: d.getDate(),
      month: d.toLocaleString('en', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: toISO(d) === todayStr,
    });
    d.setDate(d.getDate() + 1);
  }
  return cols;
}

async function getCurrentHotelId(): Promise<string | null> {
  try {
    const rpcPromise = resolveHotelId();
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 2_000));
    return await Promise.race([rpcPromise, timeout]);
  } catch {
    return null;
  }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/** Fetches stable data (room_types, rooms, rate_plans, pricing_rules).
 *  Result is cached module-level; call invalidateStaticCache() after CRUD. */
async function fetchStaticData(hotelId: string): Promise<StaticData> {
  if (_staticCache && _staticCache.hotelId === hotelId) return _staticCache;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [roomTypesRes, roomsRes, plansRes, rulesRes] = await Promise.all([
    sb.from('room_types')
      .select('id, room_type_code, room_type_name, capacity, bathroom, equipment, view, description, is_reference, is_active, diff_from_ref, diff_type, partner_ids, is_virtual, virtual_kind, virtual_component_ids, virtual_components_required')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .order('is_reference', { ascending: false })
      .order('room_type_code'),
    sb.from('rooms')
      .select('id, number, type, category, max_occupancy, base_price, room_type_code, active')
      .eq('hotel_id', hotelId)
      .eq('active', true)
      .not('room_type_code', 'is', null),
    sb.from('rate_plans')
      .select('*')
      .eq('hotel_id', hotelId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('is_reference', { ascending: false })
      .order('plan_code'),
    sb.from('pricing_rules')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle(),
  ]);

  if (roomTypesRes.error) throw new Error(roomTypesRes.error.message);
  if (plansRes.error) throw new Error(plansRes.error.message);

  // Deduplicate plans by plan_code
  const seenCodes = new Set<string>();
  const plans: AnyRow[] = ((plansRes.data ?? []) as AnyRow[]).filter((p) => {
    const key = String(p.plan_code ?? p.id ?? '').toLowerCase().trim();
    if (!key || seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  });

  _staticCache = {
    hotelId,
    roomTypesRaw: (roomTypesRes.data ?? []) as AnyRow[],
    rooms: (roomsRes.data ?? []) as AnyRow[],
    plans,
    rules: (rulesRes.data ?? null) as AnyRow | null,
  };
  return _staticCache;
}

/** Fetches date-dependent data (rate_prices, rate_restrictions) with LRU cache. */
async function fetchRangeData(hotelId: string, from: string, to: string): Promise<RangeData> {
  const cacheKey = `${hotelId}_${from}_${to}`;
  const cached = _rangeCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < RANGE_CACHE_TTL) {
    return cached.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [pricesRes, restrictionsRes] = await Promise.all([
    sb.from('rate_prices')
      .select('id, room_type_code, plan_id, stay_date, price, currency, status, plan_closed, source, version')
      .eq('hotel_id', hotelId)
      .gte('stay_date', from)
      .lte('stay_date', to),
    sb.from('rate_restrictions')
      .select('id, room_type_code, stay_date, cta, ctd, min_stay, max_stay, inventory, capacity, sold, inventory_override, version')
      .eq('hotel_id', hotelId)
      .gte('stay_date', from)
      .lte('stay_date', to),
  ]);

  const data: RangeData = {
    prices: (pricesRes.data ?? []) as AnyRow[],
    restrictions: (restrictionsRes.data ?? []) as AnyRow[],
  };

  // LRU eviction: keep at most RANGE_CACHE_MAX entries
  if (_rangeCache.size >= RANGE_CACHE_MAX) {
    const oldest = [..._rangeCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) _rangeCache.delete(oldest[0]);
  }
  _rangeCache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Pre-fetch the next period in the background (fire-and-forget).
 * Call after loading current period so the next navigation is instant.
 */
export function prefetchRange(startDate: Date, viewMode: ViewMode): void {
  const nextStart = new Date(endOfWindow(startDate, viewMode));
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = endOfWindow(nextStart, viewMode);

  void getCurrentHotelId().then((hotelId) => {
    if (!hotelId) return;
    void fetchRangeData(hotelId, toISO(nextStart), toISO(nextEnd));
  });
}

// ─── O(1) Room type builder ──────────────────────────────────────────────────

function buildRoomTypes(static_: StaticData, range: RangeData, dateColumns: DateColumn[]): RoomTypeData[] {
  const { roomTypesRaw, rooms, plans, rules } = static_;
  const { prices, restrictions } = range;
  const dateList = dateColumns.map((c) => c.date);

  // Pre-build O(1) lookup indexes
  const roomGroups = new Map<string, AnyRow[]>();
  for (const r of rooms) {
    const code = r.room_type_code as string;
    const arr = roomGroups.get(code);
    if (arr) arr.push(r); else roomGroups.set(code, [r]);
  }

  // Map: "roomCode|date" → restriction row (highest version wins per slot)
  const restrictionIndex = new Map<string, AnyRow>();
  for (const r of restrictions) {
    const key = `${r.room_type_code}|${r.stay_date}`;
    const existing = restrictionIndex.get(key);
    if (!existing || Number(r.version ?? 0) > Number(existing.version ?? 0)) {
      restrictionIndex.set(key, r);
    }
  }

  // Map: "roomCode|planId|date" → price row (highest version wins per slot)
  const priceIndex = new Map<string, AnyRow>();
  for (const px of prices) {
    const key = `${px.room_type_code}|${px.plan_id}|${px.stay_date}`;
    const existing = priceIndex.get(key);
    if (!existing || Number(px.version ?? 0) > Number(existing.version ?? 0)) {
      priceIndex.set(key, px);
    }
  }

  const referenceRoomCode = rules?.reference_room_type_code ?? null;
  const roomRulesMap = new Map<string, AnyRow>();
  if (Array.isArray(rules?.room_rules)) {
    for (const rr of rules.room_rules as AnyRow[]) roomRulesMap.set(rr.room_type_code, rr);
  }

  function buildOne(code: string, idx: number, meta: {
    name: string; capacity: number; bathroom: string; equipment: AnyRow[];
    view: string; description: string; isReference: boolean; isActive: boolean;
    diffFromRef: number; diffType: string; partnerIds: string[];
    isVirtual: boolean; virtualKind: string | null;
    virtualComponentIds: string[] | null; virtualComponentsRequired: string | null;
  }): RoomTypeData {
    const physicalCount = roomGroups.get(code)?.length ?? meta.capacity;
    const capacity = physicalCount > 0 ? physicalCount : meta.capacity;
    const isReference = meta.isReference || code === referenceRoomCode;
    const roomRule = roomRulesMap.get(code);

    // O(1) per date — no filter
    const statuses: RoomStatus[] = dateList.map((d) => {
      const r = restrictionIndex.get(`${code}|${d}`);
      return {
        date: d, status: 'open' as CellStatus, label: '',
        capacity, inventory: r?.inventory ?? capacity,
        sold: r?.sold ?? 0, override: r?.inventory_override ?? undefined,
        minStay: r?.min_stay ?? null, maxStay: r?.max_stay ?? null,
        cta: r?.cta ?? false, ctd: r?.ctd ?? false,
        restrictionId: r?.id, restrictionVersion: r?.version,
      } as RoomStatus;
    });

    // O(1) per plan × date — no filter
    const ratePlans: RatePlanData[] = plans.map((p, pIdx) => ({
      internalId: idx * 1000 + pIdx,
      planId: p.id, planCode: p.plan_code, planName: p.plan_name,
      pensionType: p.pension_type, channelType: p.channel_type,
      calcMode: (p.calc_mode as CalcMode) ?? 'derived',
      calcValue: Number(p.calc_value ?? 0),
      isReference: !!p.is_reference, isActive: !!p.is_active,
      connectivityType: p.connectivity_type, isConnectivityLocked: !!p.is_connectivity_locked,
      distributionChannels: Array.isArray(p.distribution_channels) ? p.distribution_channels : [],
      minStay: p.min_stay ?? null, maxStay: p.max_stay ?? null,
      cancellationPolicy: p.cancellation_policy ?? null, mealPlan: p.meal_plan ?? null,
      prices: dateList.map((d) => {
        const cell = priceIndex.get(`${code}|${p.id}|${d}`);
        return { date: d, price: Number(cell?.price ?? 0), planClosed: !!cell?.plan_closed, priceId: cell?.id, priceVersion: cell?.version, priceSource: cell?.source };
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as RatePlanData));

    return {
      internalId: idx + 1,
      roomTypeId: code, roomTypeName: meta.name, roomTypeCode: code,
      capacity,
      bathroom: (meta.bathroom ?? 'Douche') as BathroomType,
      equipment: Array.isArray(meta.equipment) ? (meta.equipment as unknown as string[]) : [],
      view: meta.view ?? '', description: meta.description ?? '',
      isReference, isActive: meta.isActive,
      assignedRatePlanIds: plans.map((p) => p.id),
      distributionChannels: Array.isArray(meta.partnerIds) ? meta.partnerIds : [],
      partnerIds: Array.isArray(meta.partnerIds) ? meta.partnerIds : [],
      diffFromRef: Number(roomRule?.diff_value ?? meta.diffFromRef ?? 0),
      diffType: ((roomRule?.diff_type ?? meta.diffType) as 'fixed' | 'percent') ?? 'fixed',
      isVirtual: meta.isVirtual ?? false,
      virtualKind: meta.virtualKind as VirtualRoomKind | undefined ?? undefined,
      virtualComposition: meta.virtualComponentIds?.length
        ? { componentRoomTypeIds: meta.virtualComponentIds, componentsRequired: (meta.virtualComponentsRequired ?? 'all') as 'all' | 'any' }
        : undefined,
      statuses, ratePlans,
    };
  }

  if (roomTypesRaw.length > 0) {
    return roomTypesRaw.map((rt, idx) =>
      buildOne(rt.room_type_code, idx, {
        name: rt.room_type_name ?? rt.room_type_code,
        capacity: Number(rt.capacity ?? 2),
        bathroom: rt.bathroom ?? 'Douche',
        equipment: Array.isArray(rt.equipment) ? rt.equipment : [],
        view: rt.view ?? '', description: rt.description ?? '',
        isReference: !!rt.is_reference, isActive: !!rt.is_active,
        diffFromRef: Number(rt.diff_from_ref ?? 0), diffType: rt.diff_type ?? 'fixed',
        partnerIds: Array.isArray(rt.partner_ids) ? rt.partner_ids : [],
        isVirtual: !!rt.is_virtual, virtualKind: rt.virtual_kind ?? null,
        virtualComponentIds: rt.virtual_component_ids ?? null,
        virtualComponentsRequired: rt.virtual_components_required ?? null,
      }),
    );
  }

  // Fallback: build from physical rooms grouping
  return Array.from(roomGroups.entries()).map(([code, groupRooms], idx) => {
    const sample = groupRooms[0];
    return buildOne(code, idx, {
      name: sample.type ?? code, capacity: groupRooms.length,
      bathroom: 'Douche', equipment: [], view: '', description: sample.category ?? '',
      isReference: false, isActive: true, diffFromRef: 0, diffType: 'fixed',
      partnerIds: [], isVirtual: false, virtualKind: null,
      virtualComponentIds: null, virtualComponentsRequired: null,
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full load: static data (cached) + range data.
 * Used on mount and after CRUD operations.
 */
export async function fetchCalendarDataFromSupabase(
  startDate: Date,
  viewMode: ViewMode,
): Promise<FetchResult> {
  const hotelId = await getCurrentHotelId();
  if (!hotelId) return { roomTypes: [], dateColumns: buildDateColumns(startDate, viewMode) };

  const from = toISO(startDate);
  const to = toISO(endOfWindow(startDate, viewMode));

  try {
    const [static_, range] = await Promise.all([
      fetchStaticData(hotelId),
      fetchRangeData(hotelId, from, to),
    ]);

    if (static_.roomTypesRaw.length === 0 && static_.rooms.length === 0) {
      return { roomTypes: [], dateColumns: buildDateColumns(startDate, viewMode) };
    }

    const dateColumns = buildDateColumns(startDate, viewMode);
    const roomTypes = buildRoomTypes(static_, range, dateColumns);
    return { roomTypes, dateColumns };
  } catch (err) {
    throw err;
  }
}

/**
 * Range-only load: reuses cached static data, fetches only prices + restrictions.
 * Used on prev/next navigation — avoids re-fetching room_types, rate_plans, etc.
 */
export async function fetchCalendarRangeOnly(
  startDate: Date,
  viewMode: ViewMode,
): Promise<FetchResult | null> {
  if (!_staticCache) return null; // no static cache yet → fall back to full load

  const hotelId = _staticCache.hotelId;
  const from = toISO(startDate);
  const to = toISO(endOfWindow(startDate, viewMode));

  const range = await fetchRangeData(hotelId, from, to);
  const dateColumns = buildDateColumns(startDate, viewMode);
  const roomTypes = buildRoomTypes(_staticCache, range, dateColumns);
  return { roomTypes, dateColumns };
}

// ─── Rate plan mutations ──────────────────────────────────────────────────────

export async function persistAddRatePlan(payload: NewRatePlanPayload): Promise<void> {
  const hotelId = await getCurrentHotelId();
  if (!hotelId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('rate_plans').insert({
    hotel_id: hotelId, plan_code: payload.planCode, plan_name: payload.planName,
    pension_type: payload.pensionType, channel_type: payload.channelType,
    calc_mode: payload.calcMode, calc_value: payload.calcValue,
    connectivity_type: payload.connectivityType,
    distribution_channels: payload.distributionChannels,
    min_stay: payload.minStay, max_stay: payload.maxStay,
    cancellation_policy: payload.cancellationPolicy || null,
    meal_plan: payload.mealPlan || null,
    is_active: true, is_reference: false,
  });
  if (error) console.error('[RMS] persistAddRatePlan failed:', error.message);
  invalidateStaticCache(); // force re-fetch on next load
}

export async function persistUpdateRatePlan(payload: UpdateRatePlanPayload): Promise<void> {
  const hotelId = await getCurrentHotelId();
  if (!hotelId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('rate_plans')
    .update({
      plan_name: payload.planName, pension_type: payload.pensionType,
      channel_type: payload.channelType, calc_mode: payload.calcMode,
      calc_value: payload.calcValue, connectivity_type: payload.connectivityType,
      distribution_channels: payload.distributionChannels,
      updated_at: new Date().toISOString(),
    })
    .eq('hotel_id', hotelId)
    .eq('plan_code', payload.planCode);
  if (error) console.error('[RMS] persistUpdateRatePlan failed:', error.message);
  invalidateStaticCache();
}

export async function persistDeleteRatePlan(planCode: string): Promise<void> {
  const hotelId = await getCurrentHotelId();
  if (!hotelId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('rate_plans')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('hotel_id', hotelId)
    .eq('plan_code', planCode);
  if (error) console.error('[RMS] persistDeleteRatePlan failed:', error.message);
  invalidateStaticCache();
}
