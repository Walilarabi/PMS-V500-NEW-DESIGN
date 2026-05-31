/**
 * FLOWTYM — Pickup J vs J-1 (depuis planning_daily_snapshots).
 *
 * Pickup(date) = occupation/revenu photographiés aujourd'hui pour `date`
 *                − ceux photographiés hier pour cette même `date`.
 *
 * Deux responsabilités :
 *   1. Écrire (1×/jour) la photo du jour à partir des KPIs réels calculés.
 *   2. Lire les photos d'aujourd'hui + d'hier et exposer le delta par date.
 *
 * Aucune donnée fictive : tout vient des KPIs réels et des snapshots persistés.
 * Si aucune photo de référence (hier) n'existe → `noBaseline=true` et l'UI
 * affiche « — » au lieu d'un faux 0.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  fetchSnapshots,
  upsertSnapshots,
  hasSnapshotForDate,
  computePickup,
  kpiToSnapshotRow,
  shiftIso,
  type PickupDelta,
} from '@/src/services/planning/planning-snapshot.service';
import { toIsoDate, type DayKpi } from '@/src/services/planning/planning-kpi.service';

export interface PickupResult {
  byDate: Record<string, PickupDelta>;
  /** Total chambres pickées sur la plage (jours avec baseline). */
  totalRooms: number;
  /** Total revenu pické sur la plage. */
  totalRevenue: number;
  /** true tant qu'aucune baseline (hier) n'existe pour aucune date. */
  noBaseline: boolean;
  isLoading: boolean;
  isError: boolean;
}

/**
 * @param startDate  premier jour de la plage affichée
 * @param rangeDays  nombre de jours
 * @param dayKpis    KPIs réels calculés (sert à écrire la photo du jour)
 */
export function usePickup(
  startDate: Date | string,
  rangeDays: number,
  dayKpis: DayKpi[] | undefined,
): PickupResult {
  const { status, session } = useAuth();
  const hotelId = session?.tenantId ?? null;
  const today = toIsoDate(new Date());
  const yesterday = shiftIso(today, -1);

  const start = toIsoDate(startDate);
  const endDt = new Date(`${start}T00:00:00`);
  endDt.setDate(endDt.getDate() + Math.max(1, rangeDays) - 1);
  const end = toIsoDate(endDt);

  // ── 1. Écriture idempotente de la photo du jour ─────────────────────────
  const writtenRef = useRef(false);
  useEffect(() => {
    if (status !== 'authenticated' || !hotelId) return;
    if (writtenRef.current) return;
    if (!dayKpis || dayKpis.length === 0) return;

    writtenRef.current = true;
    void (async () => {
      try {
        const already = await hasSnapshotForDate(today);
        if (already) return; // 1 photo / jour suffit
        const rows = dayKpis.map((d) => kpiToSnapshotRow(hotelId, today, d));
        await upsertSnapshots(rows);
      } catch {
        // Échec d'écriture non bloquant : le pickup affichera « — ».
        writtenRef.current = false;
      }
    })();
  }, [status, hotelId, dayKpis, today]);

  // ── 2. Lecture des photos d'aujourd'hui + d'hier ────────────────────────
  const query = useQuery({
    queryKey: ['planning', 'pickup', today, start, end],
    enabled: status === 'authenticated',
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const [cur, prior] = await Promise.all([
        fetchSnapshots(today, start, end),
        fetchSnapshots(yesterday, start, end),
      ]);
      return computePickup(cur, prior);
    },
  });

  return useMemo(() => {
    const deltas = query.data ?? [];
    const byDate: Record<string, PickupDelta> = {};
    let totalRooms = 0;
    let totalRevenue = 0;
    let anyBaseline = false;
    for (const d of deltas) {
      byDate[d.target_date] = d;
      if (!d.noBaseline) {
        anyBaseline = true;
        totalRooms += d.rooms;
        totalRevenue += d.revenue;
      }
    }
    return {
      byDate,
      totalRooms,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      noBaseline: deltas.length > 0 && !anyBaseline,
      isLoading: query.isLoading,
      isError: query.isError,
    };
  }, [query.data, query.isLoading, query.isError]);
}
