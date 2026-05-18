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
 * Si l'utilisateur n'est pas authentifié (pas de hotel_id) ou si la table
 * est vide → on retourne un Map vide, le composant appelant gère le fallback.
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface OperationalMetrics {
  occupancyRate: number;        // 0..100
  availability: number;         // chambres restantes
  leadTimeMajority: number;     // jours (médiane)
  pickupRate: number;           // % variation 7j vs 7j-7j
  roomsSold: number;            // brut
  reservationsCount: number;    // nb résa couvrant cette date
}

export interface UseOperationalDataResult {
  // Métriques indexées par date ISO
  byDate: Map<string, OperationalMetrics>;
  // Capacité hôtel totale (chambres actives)
  totalCapacity: number;
  // État
  loading: boolean;
  error: Error | null;
  // True si on a au moins une réservation chargée
  hasData: boolean;
}

interface ReservationRow {
  id: string;
  check_in: string;       // YYYY-MM-DD
  check_out: string;      // YYYY-MM-DD
  created_at: string;     // ISO timestamp
  status: string | null;
  deleted_at: string | null;
}

// Statuts considérés "actifs" pour le comptage (excluent annulations, no-shows)
const ACTIVE_STATUSES = new Set([
  'confirmed', 'checked_in', 'checked_out', 'guaranteed', 'pending', 'in_house',
  'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'GUARANTEED', 'PENDING', 'IN_HOUSE',
]);

function isActiveReservation(r: ReservationRow): boolean {
  if (r.deleted_at) return false;
  if (!r.status) return true; // pas de status → on compte par défaut
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
): UseOperationalDataResult {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(0);
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
          // Pas d'auth → on s'arrête proprement avec un dataset vide
          if (!cancelled) {
            setReservations([]);
            setTotalCapacity(0);
            setLoading(false);
          }
          return;
        }
        const hotelId = String(hotelData);

        // ── 2. Charger les réservations qui touchent [fromDate, toDate] ───
        //    Critère : check_out > fromDate ET check_in <= toDate
        //    + on inclut aussi les résa créées sur l'année passée
        //    pour pouvoir calculer pickup vs 7j-7j
        const lookbackDate = new Date(fromDate);
        lookbackDate.setDate(lookbackDate.getDate() - 14);
        const lookbackISO = lookbackDate.toISOString().slice(0, 10);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: resData, error: resErr } = await (supabase as any)
          .from('reservations')
          .select('id, check_in, check_out, created_at, status, deleted_at')
          .eq('hotel_id', hotelId)
          .gte('check_out', lookbackISO)
          .lte('check_in', toDate)
          .limit(5000);

        if (resErr) {
          throw new Error(`Reservations fetch failed: ${resErr.message}`);
        }

        // ── 3. Capacité totale (rooms actives) ───────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: roomCount, error: roomErr } = await (supabase as any)
          .from('rooms')
          .select('*', { count: 'exact', head: true })
          .eq('hotel_id', hotelId)
          .eq('active', true);

        if (roomErr) {
          throw new Error(`Rooms fetch failed: ${roomErr.message}`);
        }

        if (!cancelled) {
          setReservations((resData ?? []) as ReservationRow[]);
          setTotalCapacity(roomCount ?? 0);
          setLoading(false);
        }
      } catch (err) {
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
  }, [fromDate, toDate]);

  // ── 4. Calcul des métriques par date ─────────────────────────────────
  const byDate = useMemo(() => {
    const result = new Map<string, OperationalMetrics>();
    if (totalCapacity === 0) return result;

    const activeReservations = reservations.filter(isActiveReservation);

    // Index : pour chaque date, liste des résa qui couvrent cette nuit
    const reservationsPerDate = new Map<string, ReservationRow[]>();
    for (const r of activeReservations) {
      for (const night of iterateNights(r.check_in, r.check_out)) {
        if (!reservationsPerDate.has(night)) reservationsPerDate.set(night, []);
        reservationsPerDate.get(night)!.push(r);
      }
    }

    // Pour le pickup : créées récemment (≤ 7j) vs précédent (7..14j)
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
      const availability = Math.max(0, totalCapacity - roomsSold);
      const occupancyRate = totalCapacity > 0
        ? (roomsSold / totalCapacity) * 100
        : 0;

      // ── Lead time (médiane jours entre booking et check-in) ──
      const leadTimes = reservationsForDate.map(r => {
        const created = new Date(r.created_at).getTime();
        const checkIn = new Date(r.check_in).getTime();
        const days = (checkIn - created) / 86_400_000;
        return Math.max(0, Math.round(days));
      });
      const leadTimeMajority = leadTimes.length > 0 ? Math.round(median(leadTimes)) : 0;

      // ── Pickup : variation 7j vs 7-14j (sur les résa créées dans ces fenêtres pour cette date) ──
      const created7d = reservationsForDate.filter(r => {
        const c = new Date(r.created_at);
        return c >= cutoff7 && c <= now;
      }).length;
      const createdPrev7d = reservationsForDate.filter(r => {
        const c = new Date(r.created_at);
        return c >= cutoff14 && c < cutoff7;
      }).length;
      // Formule : si pas d'historique précédent et qu'on a du récent → +100%
      let pickupRate: number;
      if (createdPrev7d === 0) {
        pickupRate = created7d > 0 ? 100 : 0;
      } else {
        pickupRate = ((created7d - createdPrev7d) / createdPrev7d) * 100;
      }

      result.set(dateISO, {
        occupancyRate,
        availability,
        leadTimeMajority,
        pickupRate,
        roomsSold,
        reservationsCount: reservationsForDate.length,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }, [reservations, totalCapacity, fromDate, toDate]);

  return {
    byDate,
    totalCapacity,
    loading,
    error,
    hasData: reservations.length > 0 && totalCapacity > 0,
  };
}
