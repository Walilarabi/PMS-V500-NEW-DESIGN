import { useMemo } from 'react';
import {
  computeDayMetrics,
  computeMonthlyKPIs,
  type DayMetric,
  type MonthMetric,
} from '../lib/pmsLogic';

interface UsePlanningMetricsParams {
  reservations: any[];
  totalRoomsCount: number;
  startDate: Date;
  viewLength: number;
  monthDate: Date;
}

interface UsePlanningMetricsReturn {
  dayMetrics: Map<string, DayMetric>;
  monthMetrics: MonthMetric;
}

export function usePlanningMetrics({
  reservations,
  totalRoomsCount,
  startDate,
  viewLength,
  monthDate,
}: UsePlanningMetricsParams): UsePlanningMetricsReturn {
  const dayMetrics = useMemo(() => {
    const map = new Map<string, DayMetric>();
    if (totalRoomsCount === 0) return map;

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < viewLength; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      if (!map.has(dateStr)) {
        map.set(dateStr, computeDayMetrics(reservations, dateStr, totalRoomsCount));
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!map.has(dateStr)) {
        map.set(dateStr, computeDayMetrics(reservations, dateStr, totalRoomsCount));
      }
    }

    return map;
  }, [reservations, totalRoomsCount, startDate, viewLength, monthDate]);

  const monthMetrics = useMemo(
    () =>
      computeMonthlyKPIs(
        reservations,
        monthDate.getFullYear(),
        monthDate.getMonth(),
        totalRoomsCount
      ),
    [reservations, monthDate, totalRoomsCount]
  );

  return { dayMetrics, monthMetrics };
}
