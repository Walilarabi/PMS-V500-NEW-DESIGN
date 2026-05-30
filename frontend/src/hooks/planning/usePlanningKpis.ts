/**
 * FLOWTYM — Hook KPI planning (source unique).
 *
 * Branche le service KPI pur sur les données réelles (réservations + chambres)
 * issues des domaines. Memoized pour éviter tout recalcul inutile.
 *
 * Aucune donnée fictive : entrées 100% Supabase.
 */
import { useMemo } from 'react';
import {
  computeDayKpi,
  computeRangeKpis,
  aggregateKpis,
  type DayKpi,
  type KpiReservation,
  type KpiRoom,
} from '@/src/services/planning/planning-kpi.service';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/domains/hotel/schemas';

export interface PlanningKpis {
  /** KPI jour par jour sur la plage demandée. */
  days: DayKpi[];
  /** Agrégat de la plage (moyennes pondérées + totaux). */
  summary: ReturnType<typeof aggregateKpis>;
  /** KPI du jour sélectionné (premier jour de la plage). */
  today: DayKpi;
}

/** Mappe une ReservationRow vers le sous-ensemble nécessaire au calcul. */
function toKpiReservation(r: ReservationRow): KpiReservation {
  return {
    check_in: r.check_in,
    check_out: r.check_out,
    nights: r.nights ?? null,
    status: r.status,
    total_amount: r.total_amount ?? null,
  };
}

/** Mappe une RoomRow vers le sous-ensemble nécessaire au calcul. */
function toKpiRoom(r: RoomRow): KpiRoom {
  return { id: r.id, active: r.active ?? true, status: r.status ?? null };
}

/**
 * Calcule les KPIs planning pour une plage donnée.
 *
 * @param startDate Premier jour de la plage.
 * @param days      Nombre de jours (7 / 15 / 30…).
 * @param reservations Réservations réelles (peut être undefined pendant le load).
 * @param rooms     Chambres réelles (peut être undefined pendant le load).
 */
export function usePlanningKpis(
  startDate: Date | string,
  days: number,
  reservations: ReservationRow[] | undefined,
  rooms: RoomRow[] | undefined,
): PlanningKpis {
  return useMemo(() => {
    const kpiRes = (reservations ?? []).map(toKpiReservation);
    const kpiRooms = (rooms ?? []).map(toKpiRoom);
    const dayKpis = computeRangeKpis(startDate, Math.max(1, days), kpiRes, kpiRooms);
    return {
      days: dayKpis,
      summary: aggregateKpis(dayKpis),
      today: dayKpis[0] ?? computeDayKpi(startDate, kpiRes, kpiRooms),
    };
  }, [startDate, days, reservations, rooms]);
}
