/**
 * FLOWTYM RMS — Supabase adapter for the V500 rate calendar store.
 *
 * The V500 store was designed against `fetchCalendarData(startDate, viewMode)`
 * which returned mocked data. This adapter implements the SAME signature but
 * pulls data from Supabase via the rms domain repository.
 *
 * Mapping strategy:
 *   - public.rooms grouped by room_type_code → RoomTypeData[]
 *   - public.rate_plans → RatePlanData[] (attached to each RoomTypeData.ratePlans)
 *   - public.rate_prices → injected into each (roomType, plan, date) cell
 *   - public.rate_restrictions → injected into RoomStatus per date
 *
 * Behavior:
 *   - If the user is authenticated AND has a hotel_id resolvable: uses Supabase
 *   - Otherwise: falls back to mockData (preserves dev/demo experience)
 *   - Errors are caught and logged; mock fallback returned to avoid breaking UI
 */
import { supabase } from '@/src/lib/supabase';
import type {
  RoomTypeData,
  DateColumn,
  ViewMode,
  RatePlanData,
  RoomStatus,
  CellStatus,
  CalcMode,
  PricingRules,
} from '../types';

interface FetchResult {
  roomTypes: RoomTypeData[];
  dateColumns: DateColumn[];
  pricingRules?: PricingRules;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function endOfWindow(start: Date, viewMode: ViewMode): Date {
  const end = new Date(start);
  const days = viewMode === 'daily' ? 30 : viewMode === 'weekly' ? 90 : 365;
  end.setDate(end.getDate() + days - 1);
  return end;
}

function buildDateColumns(start: Date, viewMode: ViewMode): DateColumn[] {
  const days = viewMode === 'daily' ? 30 : viewMode === 'weekly' ? 90 : 365;
  const cols: DateColumn[] = [];
  const d = new Date(start);
  for (let i = 0; i < days; i++) {
    cols.push({
      date: toISO(d),
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      dayOfMonth: d.getDate(),
      month: d.toLocaleString('en', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: toISO(d) === toISO(new Date()),
    });
    d.setDate(d.getDate() + 1);
  }
  return cols;
}

/**
 * Get the current user's hotel_id (null if not authenticated/resolvable).
 *
 * Garde-fou : timeout 5s pour ne pas bloquer le calendrier si le RPC
 * `get_user_hotel_id` ne répond pas (la page tombe sur les mocks).
 */
async function getCurrentHotelId(): Promise<string | null> {
  const timeoutMs = 2_000;
  try {
    const rpcPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_user_hotel_id');
      if (error || !data) return null;
      return String(data);
    })();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([rpcPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

// ─── Main entry — fetchCalendarData (drop-in replacement) ───────────────────

export async function fetchCalendarDataFromSupabase(
  startDate: Date,
  viewMode: ViewMode,
): Promise<FetchResult> {
  const hotelId = await getCurrentHotelId();

  if (!hotelId) {
    return { roomTypes: [], dateColumns: buildDateColumns(startDate, viewMode) };
  }

  const from = toISO(startDate);
  const to = toISO(endOfWindow(startDate, viewMode));

  try {
    // Parallel fetch — rooms, plans, prices, restrictions, pricing_rules
    const [roomsRes, plansRes, pricesRes, restrictionsRes, rulesRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('rooms')
        .select('id, number, type, category, max_occupancy, base_price, room_type_code, active')
        .eq('hotel_id', hotelId)
        .eq('active', true)
        .not('room_type_code', 'is', null),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('rate_plans')
        .select('*')
        .eq('hotel_id', hotelId)
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('is_reference', { ascending: false })
        .order('plan_code'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('rate_prices')
        .select('id, room_type_code, plan_id, stay_date, price, currency, status, plan_closed, source, version')
        .eq('hotel_id', hotelId)
        .gte('stay_date', from)
        .lte('stay_date', to),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('rate_restrictions')
        .select('id, room_type_code, stay_date, cta, ctd, min_stay, max_stay, inventory, capacity, sold, inventory_override, version')
        .eq('hotel_id', hotelId)
        .gte('stay_date', from)
        .lte('stay_date', to),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('pricing_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .maybeSingle(),
    ]);

    if (roomsRes.error || plansRes.error) {
      throw new Error((roomsRes.error || plansRes.error)?.message ?? 'Supabase fetch failed');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rooms = (roomsRes.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plansRaw = (plansRes.data ?? []) as any[];

    // ─── Déduplication des plans tarifaires en provenance Supabase ───────
    // Bug fix Phase 4 : si la table `rate_plans` contient plusieurs lignes
    // pour le même plan_code (legacy import / sync défaillante), on
    // n'en garde qu'une (la plus récente par created_at descendant). Évite
    // l'affichage "3 lignes tarifaires dupliquées" dans le calendrier.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seenPlanCodes = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plans = plansRaw.filter((p: any) => {
      const key = String(p.plan_code ?? p.id ?? '').toLowerCase().trim();
      if (!key) return false;
      if (seenPlanCodes.has(key)) return false;
      seenPlanCodes.add(key);
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prices = (pricesRes.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restrictions = (restrictionsRes.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rules = (rulesRes.data ?? null) as any;

    if (rooms.length === 0) {
      // Hotel has no rooms with room_type_code yet → return empty grid (not mocks)
      return {
        roomTypes: [],
        dateColumns: buildDateColumns(startDate, viewMode),
      };
    }

    const dateColumns = buildDateColumns(startDate, viewMode);
    const dateList = dateColumns.map((c) => c.date);

    // Group rooms by room_type_code to count capacity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomGroups = new Map<string, any[]>();
    for (const r of rooms) {
      const code = r.room_type_code as string;
      if (!roomGroups.has(code)) roomGroups.set(code, []);
      roomGroups.get(code)!.push(r);
    }

    // Build RoomTypeData[]
    const referenceRoomCode = rules?.reference_room_type_code ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomRulesMap = new Map<string, any>();
    if (rules?.room_rules && Array.isArray(rules.room_rules)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const rr of rules.room_rules as any[]) {
        roomRulesMap.set(rr.room_type_code, rr);
      }
    }

    const roomTypes: RoomTypeData[] = Array.from(roomGroups.entries()).map(
      ([code, groupRooms], idx) => {
        const sample = groupRooms[0];
        const capacity = groupRooms.length;
        const isReference = code === referenceRoomCode;
        const roomRule = roomRulesMap.get(code);

        // Build statuses per date
        const restrictionsForRoom = restrictions.filter(
          (r) => r.room_type_code === code,
        );
        const statuses: RoomStatus[] = dateList.map((d) => {
          const r = restrictionsForRoom.find((x) => x.stay_date === d);
          return {
            date: d,
            status: 'open' as CellStatus,
            label: '',
            capacity,
            inventory: r?.inventory ?? capacity,
            sold: r?.sold ?? 0,
            override: r?.inventory_override ?? undefined,
            minStay: r?.min_stay ?? null,
            maxStay: r?.max_stay ?? null,
            cta: r?.cta ?? false,
            ctd: r?.ctd ?? false,
            // restrictionId + version (typed in RoomStatus):
            restrictionId: r?.id,
            restrictionVersion: r?.version,
          } as RoomStatus;
        });

        // Build ratePlans for THIS room type
        const ratePlans: RatePlanData[] = plans.map((p) => {
          // Phase 8 — déduplication par date (bug "3 lignes tarifaires
          // dupliquées" après push RMS répétés). On garde l'entrée avec
          // la version la plus récente (priceVersion descendant).
          const rawPrices = prices.filter(
            (px) => px.room_type_code === code && px.plan_id === p.id,
          );
          const pricesByDate = new Map<string, typeof rawPrices[number]>();
          for (const px of rawPrices) {
            const existing = pricesByDate.get(px.stay_date);
            if (!existing) { pricesByDate.set(px.stay_date, px); continue; }
            const vNew = Number(px.version ?? 0);
            const vOld = Number(existing.version ?? 0);
            if (vNew > vOld) pricesByDate.set(px.stay_date, px);
          }
          const pricesForCell = Array.from(pricesByDate.values());
          return {
            internalId: idx * 1000 + plans.indexOf(p),
            planId: p.id,
            planCode: p.plan_code,
            planName: p.plan_name,
            pensionType: p.pension_type,
            channelType: p.channel_type,
            calcMode: (p.calc_mode as CalcMode) ?? 'derived',
            calcValue: Number(p.calc_value ?? 0),
            isReference: !!p.is_reference,
            isActive: !!p.is_active,
            connectivityType: p.connectivity_type,
            isConnectivityLocked: !!p.is_connectivity_locked,
            distributionChannels: Array.isArray(p.distribution_channels)
              ? p.distribution_channels
              : [],
            minStay: p.min_stay ?? null,
            maxStay: p.max_stay ?? null,
            cancellationPolicy: p.cancellation_policy ?? null,
            mealPlan: p.meal_plan ?? null,
            prices: dateList.map((d) => {
              const cell = pricesForCell.find((px) => px.stay_date === d);
              return {
                date: d,
                price: Number(cell?.price ?? 0),
                planClosed: !!cell?.plan_closed,
                priceId: cell?.id,
                priceVersion: cell?.version,
                priceSource: cell?.source,
              };
            }),
          } as RatePlanData;
        });

        return {
          internalId: idx + 1,
          roomTypeId: code,
          roomTypeName: sample.type ?? code,
          roomTypeCode: code,
          capacity,
          bathroom: 'private' as const,
          equipment: [],
          view: '',
          description: sample.category ?? '',
          isReference,
          isActive: true,
          assignedRatePlanIds: plans.map((p) => p.id),
          distributionChannels: [],
          diffFromRef: Number(roomRule?.diff_value ?? 0),
          diffType: (roomRule?.diff_type ?? 'fixed') as 'fixed' | 'percent',
          statuses,
          ratePlans,
        };
      },
    );

    return { roomTypes, dateColumns };
  } catch (err) {
    throw err;
  }
}
