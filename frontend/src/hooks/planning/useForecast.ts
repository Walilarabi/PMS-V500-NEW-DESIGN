/**
 * FLOWTYM — Forecast d'occupation par jour (calcul automatique).
 *
 * Assemble les signaux réels et applique le moteur pur `computeForecast` pour
 * chaque jour de la plage. Aucune saisie manuelle, aucune donnée fictive.
 *
 * Entrées :
 *   - dayKpis      : KPIs réels par jour (occupation actuelle, chambres total)
 *   - pickupByDate : pickup chambres J vs J-1 par date (depuis usePickup)
 *   - compByDate   : compression marché par date (depuis useMarketCompression)
 *   - reservations : échantillon pour estimer les taux d'attrition réels
 */
import { useMemo } from 'react';
import {
  computeForecast,
  computeAttritionRates,
} from '@/src/services/planning/planning-forecast.service';
import { toIsoDate, type DayKpi } from '@/src/services/planning/planning-kpi.service';
import type { PickupDelta } from '@/src/services/planning/planning-snapshot.service';
import type { CompressionDay } from './useMarketCompression';

export interface ForecastResult {
  /** Forecast 0-100 par date (YYYY-MM-DD). */
  byDate: Record<string, number>;
  /** Taux d'annulation estimé (0-1). */
  cancelRate: number;
  /** Taux de no-show estimé (0-1). */
  noshowRate: number;
}

export function useForecast(
  dayKpis: DayKpi[],
  pickupByDate: Record<string, PickupDelta>,
  compByDate: Record<string, CompressionDay>,
  reservations: { status: string }[],
): ForecastResult {
  return useMemo(() => {
    const { cancelRate, noshowRate } = computeAttritionRates(reservations);
    const todayIso = toIsoDate(new Date());
    const byDate: Record<string, number> = {};

    for (const day of dayKpis) {
      const remainingDays = Math.max(0, daysBetween(todayIso, day.date));
      const pickup = pickupByDate[day.date];
      const comp = compByDate[day.date];
      byDate[day.date] = computeForecast({
        currentToRate: day.toRate,
        pickupRooms: pickup && !pickup.noBaseline ? pickup.rooms : null,
        totalRooms: day.totalRooms,
        remainingDays,
        cancelRate,
        noshowRate,
        compressionPercent: comp?.percent ?? null,
      });
    }

    return { byDate, cancelRate, noshowRate };
  }, [dayKpis, pickupByDate, compByDate, reservations]);
}

function daysBetween(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = bIso.slice(0, 10).split('-').map(Number);
  const a = new Date(ay, (am ?? 1) - 1, ad ?? 1).getTime();
  const b = new Date(by, (bm ?? 1) - 1, bd ?? 1).getTime();
  return Math.round((b - a) / 86_400_000);
}
