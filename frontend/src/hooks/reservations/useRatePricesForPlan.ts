/**
 * FLOWTYM — Tarifs nuitée depuis le Calendrier Tarifaire (table rate_prices).
 *
 * Retourne les prix exacts du Revenue → Calendrier Tarifaire pour un plan,
 * une plage de dates et optionnellement un type de chambre.
 *
 * Source unique : Supabase rate_prices. Identique aux prix affichés dans
 * le Calendrier Tarifaire du module Revenue — aucun calcul local.
 *
 * checkOut est la date de départ (non incluse dans les nuitées).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

export interface RatePricePerNight {
  stay_date: string;
  price: number;
  room_type_code: string;
  status: string | null;
  plan_closed: boolean | null;
}

export function useRatePricesForPlan(
  planId: string | null,
  checkIn: string | null,
  checkOut: string | null,
  roomTypeCode?: string | null,
) {
  const { status } = useAuth();

  return useQuery<RatePricePerNight[]>({
    queryKey: ['rate-prices-for-plan', planId, checkIn, checkOut, roomTypeCode ?? null],
    enabled: status === 'authenticated' && !!planId && !!checkIn && !!checkOut && checkIn < checkOut,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('rate_prices')
        .select('stay_date, price, room_type_code, status, plan_closed')
        .eq('plan_id', planId!)
        .gte('stay_date', checkIn!)
        .lt('stay_date', checkOut!)
        .order('stay_date', { ascending: true })
        .order('room_type_code', { ascending: true });

      if (roomTypeCode) q = q.eq('room_type_code', roomTypeCode);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RatePricePerNight[];
    },
  });
}

/** Calcule le total TTC d'un séjour depuis les prix du calendrier tarifaire. */
export function calcStayTotalFromPrices(
  prices: RatePricePerNight[],
  checkIn: string,
  checkOut: string,
  roomTypeCode: string | null,
): { total: number; nights: number; hasMissingDates: boolean } {
  const nights = Math.max(
    0,
    Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
    ),
  );
  if (nights === 0) return { total: 0, nights: 0, hasMissingDates: false };

  // Filter to the relevant room type if provided
  const relevant = roomTypeCode
    ? prices.filter((p) => p.room_type_code === roomTypeCode)
    : prices;

  // Build a map date → price
  const byDate = new Map<string, number>();
  for (const p of relevant) {
    if (!byDate.has(p.stay_date)) byDate.set(p.stay_date, Number(p.price));
  }

  let total = 0;
  let found = 0;
  for (let i = 0; i < nights; i++) {
    const dt = new Date(checkIn);
    dt.setDate(dt.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    const price = byDate.get(iso);
    if (price != null) {
      total += price;
      found++;
    }
  }

  return { total, nights, hasMissingDates: found < nights };
}
