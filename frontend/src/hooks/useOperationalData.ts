/**
 * FLOWTYM — useOperationalData
 *
 * Calcule pour chaque date donnée les métriques opérationnelles à partir
 * des VRAIES réservations (table `reservations`) et chambres (table `rooms`).
 *
 * Retourne, par date ISO YYYY-MM-DD :
 *   - occupancyRate : % d'occupation (rooms vendues / capacité totale)
 *   - availability  : nombre de chambres encore disponibles
 *   - leadTimeMajority : médiane (check_in - created_at) en jours, sur les résa couvrant cette date
 *   - pickupRate    : % de variation du nombre de résa pour cette date,
 *                     entre les résa créées les 7 derniers jours
 *                     et celles créées les 7 jours d'avant
 *
 * Schéma DB utilisé (table reservations) :
 *   - cancelled_at IS NULL AND no_show_at IS NULL = résa active
 *   - status IN ('confirmed', 'checked_in', etc.) = whitelist applicative
 *
 * Le paramètre optionnel `refreshToken` permet à un consumer (ex: bouton
 * "Rafraîchir" dans le RMS) de forcer un re-fetch sans changer la fenêtre
 * de dates. Bumper la valeur → le useEffect se ré-exécute.
 *
 * Si l'utilisateur n'est pas authentifié (pas de hotel_id) ou si la table
 * est vide → on retourne un Map vide, le composant appelant gère le fallback.
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  pricingPlanningSync,
  computeOccupancyRate,
  isRoomSellable,
} from '../services/revenue/pricingPlanningSync.service';

export type LeadTimeBucket = 'J-0/J-3' | 'J-4/J-7' | 'J-8/J-14' | 'J-15/J-30' | 'J+30';

export interface OperationalMetrics {
  occupancyRate: number;          // 0..100 (chambres vendues / chambres vendables)
  sellableCapacity: number;       // capacité vendable (hors service / blocked exclus)
  availability: number;           // chambres restantes (override-aware)
  availabilityOverridden: boolean; // true si override manuel actif
  leadTimeMajority: number;       // jours (médiane) — DEPRECATED, conservé pour compat
  leadTimeBucket: LeadTimeBucket; // classe dominante (nouveau)
  leadTimeDistribution: Record<LeadTimeBucket, number>; // nb résa par bucket
  pickupRooms: number;            // pickup chambres (Δ chambres réservées 7j vs 7j-7j)
  pickupRevenue: number;          // pickup revenu (€)
  pickupNights: number;           // pickup nuitées
  pickupRate: number;             // % variation 7j vs 7j-7j (DEPRECATED)
  roomsSold: number;              // brut
  reservationsCount: number;      // nb résa couvrant cette date
}

export interface UseOperationalDataResult {
  byDate: Map<string, OperationalMetrics>;
  totalCapacity: number;
  loading: boolean;
  error: Error | null;
  hasData: boolean;
}

interface ReservationRow {
  id: string;
  check_in: string;       // YYYY-MM-DD
  check_out: string;      // YYYY-MM-DD
  created_at: string;     // ISO timestamp
  status: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  total_amount?: number | null; // pour pickup revenu
}

interface RoomRow {
  id: string;
  active: boolean;
  status: string | null;
}

/** Classe de lead time métier (J-0/J-3, J-4/J-7, J-8/J-14, J-15/J-30, J+30). */
function leadTimeBucket(days: number): LeadTimeBucket {
  if (days <= 3) return 'J-0/J-3';
  if (days <= 7) return 'J-4/J-7';
  if (days <= 14) return 'J-8/J-14';
  if (days <= 30) return 'J-15/J-30';
  return 'J+30';
}

/** Retourne la classe avec le plus grand nombre de réservations. */
function dominantBucket(distribution: Record<LeadTimeBucket, number>): LeadTimeBucket {
  let best: LeadTimeBucket = 'J-0/J-3';
  let bestCount = -1;
  for (const k of Object.keys(distribution) as LeadTimeBucket[]) {
    if (distribution[k] > bestCount) {
      bestCount = distribution[k];
      best = k;
    }
  }
  return best;
}

// Statuts considérés "actifs" pour le comptage opérationnel
// (whitelist applicative, en plus du filtre cancelled_at/no_show_at au niveau DB)
const ACTIVE_STATUSES = new Set([
  'confirmed', 'checked_in', 'checked_out', 'guaranteed', 'pending', 'in_house',
  'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'GUARANTEED', 'PENDING', 'IN_HOUSE',
]);

function isActiveReservation(r: ReservationRow): boolean {
  // Filtre niveau 1 : pas annulée, pas no-show
  if (r.cancelled_at) return false;
  if (r.no_show_at) return false;
  // Filtre niveau 2 : statut applicatif
  if (!r.status) return true; // pas de status explicite → on compte par défaut
  return ACTIVE_STATUSES.has(r.status);
}

/** Médiane d'une liste de nombres */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Itère sur chaque nuit entre check_in (inclus) et check_out (exclu) */
function* iterateNights(checkIn: string, checkOut: string): Generator<string> {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const cur = new Date(start);
  while (cur < end) {
    yield cur.toISOString().slice(0, 10);
    cur.setDate(cur.getDate() + 1);
  }
}

export function useOperationalData(
  fromDate: string,
  toDate: string,
  refreshToken: number = 0,
): UseOperationalDataResult {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(0);     // capacité brute (rooms actives)
  const [sellableCapacity, setSellableCapacity] = useState(0); // hors service / blocked exclus
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // ── 1. Résoudre hotel_id courant ───────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hotelData, error: hotelErr } = await (supabase.rpc as any)('get_user_hotel_id');
        if (hotelErr || !hotelData) {
          if (hotelErr) {
            console.warn('[useOperationalData] hotel_id resolution failed:', hotelErr.message);
          }
          if (!cancelled) {
            setReservations([]);
            setTotalCapacity(0);
            setLoading(false);
          }
          return;
        }
        const hotelId = String(hotelData);

        // ── 2. Charger les réservations qui touchent [fromDate, toDate] ───
        //    Filtres DB :
        //      - hotel_id = current (RLS aussi appliquée)
        //      - check_out > lookbackDate (14j avant fromDate, pour calcul pickup)
        //      - check_in <= toDate
        //      - cancelled_at IS NULL  (résa non annulée)
        //      - no_show_at IS NULL    (pas de no-show)
        const lookbackDate = new Date(fromDate);
        lookbackDate.setDate(lookbackDate.getDate() - 14);
        const lookbackISO = lookbackDate.toISOString().slice(0, 10);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: resData, error: resErr } = await (supabase as any)
          .from('reservations')
          .select('id, check_in, check_out, created_at, status, cancelled_at, no_show_at, total_amount')
          .eq('hotel_id', hotelId)
          .gte('check_out', lookbackISO)
          .lte('check_in', toDate)
          .is('cancelled_at', null)
          .is('no_show_at', null)
          .limit(5000);

        if (resErr) {
          console.error('[useOperationalData] reservations fetch failed:', resErr);
          throw new Error(`Reservations fetch failed: ${resErr.message}`);
        }

        // ── 3. Capacité totale + vendable (rooms actives, hors service / blocked exclus) ─
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: roomsData, error: roomErr } = await (supabase as any)
          .from('rooms')
          .select('id, active, status')
          .eq('hotel_id', hotelId)
          .eq('active', true);

        if (roomErr) {
          console.error('[useOperationalData] rooms fetch failed:', roomErr);
          throw new Error(`Rooms fetch failed: ${roomErr.message}`);
        }

        const rooms = (roomsData ?? []) as RoomRow[];
        const totalActive = rooms.length;
        const sellable = rooms.reduce((n, r) => (isRoomSellable(r) ? n + 1 : n), 0);

        if (!cancelled) {
          setReservations((resData ?? []) as ReservationRow[]);
          setTotalCapacity(totalActive);
          setSellableCapacity(sellable);
          setLoading(false);

          // Logging utile en dev pour vérifier que les données arrivent
          if (typeof window !== 'undefined' && (resData?.length ?? 0) === 0) {
            console.warn(
              `[useOperationalData] 0 réservations chargées pour hotel ${hotelId} ` +
              `entre ${lookbackISO} et ${toDate}. Vérifiez le filtre RLS et les statuts.`
            );
          }
        }
      } catch (err) {
        console.error('[useOperationalData] fatal error:', err);
        if (!cancelled) {
          setError(err as Error);
          setReservations([]);
          setTotalCapacity(0);
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, refreshToken]);

  // ── 4. Calcul des métriques par date ─────────────────────────────────
  const byDate = useMemo(() => {
    const result = new Map<string, OperationalMetrics>();
    if (sellableCapacity === 0 && totalCapacity === 0) return result;

    const activeReservations = reservations.filter(isActiveReservation);

    // Index : pour chaque date, liste des résa qui couvrent cette nuit
    const reservationsPerDate = new Map<string, ReservationRow[]>();
    for (const r of activeReservations) {
      for (const night of iterateNights(r.check_in, r.check_out)) {
        if (!reservationsPerDate.has(night)) reservationsPerDate.set(night, []);
        reservationsPerDate.get(night)!.push(r);
      }
    }

    // Pour le pickup : segmenté par DATE DE SÉJOUR — on regarde les résa
    // créées récemment (≤ 7j) qui couvrent cette nuit, vs résa créées 7-14j
    // avant qui couvrent cette même nuit. Évite les confusions date_séjour
    // vs date_création.
    const now = new Date();
    const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);

    // Itérer sur les dates de la fenêtre
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const cur = new Date(start);
    while (cur <= end) {
      const dateISO = cur.toISOString().slice(0, 10);
      const reservationsForDate = reservationsPerDate.get(dateISO) ?? [];

      // ── Vendues / dispo / occupation ──
      const roomsSold = reservationsForDate.length;
      const override = pricingPlanningSync.getOverride(dateISO);
      const availabilityOverridden = override !== null;
      const availability = availabilityOverridden
        ? override!.availability
        : Math.max(0, sellableCapacity - roomsSold);

      // TO = vendues / capacité vendable (chambres hors service exclues)
      const occupancyRate = computeOccupancyRate(
        roomsSold,
        sellableCapacity,
        availabilityOverridden ? override!.availability : undefined,
      );

      // ── Lead time : distribution par bucket + classe dominante ──
      const distribution: Record<LeadTimeBucket, number> = {
        'J-0/J-3': 0, 'J-4/J-7': 0, 'J-8/J-14': 0, 'J-15/J-30': 0, 'J+30': 0,
      };
      const leadTimes = reservationsForDate.map((r) => {
        const created = new Date(r.created_at).getTime();
        const checkIn = new Date(r.check_in).getTime();
        const days = Math.max(0, Math.round((checkIn - created) / 86_400_000));
        distribution[leadTimeBucket(days)]++;
        return days;
      });
      const leadTimeMajority = leadTimes.length > 0 ? Math.round(median(leadTimes)) : 0;
      const leadTimeBucketDominant = leadTimes.length > 0
        ? dominantBucket(distribution)
        : 'J-0/J-3';

      // ── Pickup chambres : nb résa créées 7j vs 7-14j (couvrant cette date) ──
      // On exclut les annulations via le filtre isActiveReservation déjà appliqué.
      const created7d = reservationsForDate.filter((r) => {
        const c = new Date(r.created_at);
        return c >= cutoff7 && c <= now;
      });
      const createdPrev7d = reservationsForDate.filter((r) => {
        const c = new Date(r.created_at);
        return c >= cutoff14 && c < cutoff7;
      });

      const pickupRooms = created7d.length - createdPrev7d.length;
      const sumRevenue = (rows: ReservationRow[]) =>
        rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      const pickupRevenue = sumRevenue(created7d) - sumRevenue(createdPrev7d);
      // Pickup nuitées = nb total de nuits ajoutées (chaque résa peut compter
      // pour plusieurs nuits, mais ici on travaille par date donc 1 résa = 1 nuit)
      const pickupNights = pickupRooms;

      // Compat : pourcentage de variation (DEPRECATED)
      let pickupRate: number;
      if (createdPrev7d.length === 0) {
        pickupRate = created7d.length > 0 ? 100 : 0;
      } else {
        pickupRate = ((created7d.length - createdPrev7d.length) / createdPrev7d.length) * 100;
      }

      result.set(dateISO, {
        occupancyRate,
        sellableCapacity,
        availability,
        availabilityOverridden,
        leadTimeMajority,
        leadTimeBucket: leadTimeBucketDominant,
        leadTimeDistribution: distribution,
        pickupRooms,
        pickupRevenue,
        pickupNights,
        pickupRate,
        roomsSold,
        reservationsCount: reservationsForDate.length,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return result;
    // version() de pricingPlanningSync est inclus pour relire les overrides
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, totalCapacity, sellableCapacity, fromDate, toDate, pricingPlanningSync.version()]);

  return {
    byDate,
    totalCapacity,
    loading,
    error,
    hasData: reservations.length > 0 && totalCapacity > 0,
  };
}
