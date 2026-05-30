/**
 * FLOWTYM — Compression marché (depuis lighthouse_days).
 *
 * `market_demand_percent` (0-100) est fourni directement par Lighthouse pour
 * chaque date de séjour. On l'expose par date sur la plage du planning, plus
 * une moyenne de plage, pour colorer la barre KPI et les colonnes jour.
 *
 * Aucune donnée fictive : si aucune ligne Lighthouse n'existe pour une date,
 * la compression est `null` (et l'UI affiche « — » plutôt qu'un chiffre inventé).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { toIsoDate } from '@/src/services/planning/planning-kpi.service';

export type CompressionLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CompressionDay {
  date: string;
  /** 0-100, ou null si Lighthouse n'a pas de donnée pour cette date. */
  percent: number | null;
  level: CompressionLevel | null;
  compsetMedian: number | null;
  ourPrice: number | null;
}

/** Mappe un pourcentage de demande vers un niveau coloré. */
export function compressionLevel(percent: number): CompressionLevel {
  if (percent <= 40) return 'low';
  if (percent <= 60) return 'medium';
  if (percent <= 80) return 'high';
  return 'critical';
}

interface LighthouseDayLite {
  stay_date: string;
  market_demand_percent: number | null;
  compset_median: number | null;
  our_price: number | null;
}

export interface MarketCompression {
  days: CompressionDay[];
  byDate: Record<string, CompressionDay>;
  /** Moyenne de la plage (sur les jours ayant une donnée), ou null. */
  avgPercent: number | null;
  isLoading: boolean;
  isError: boolean;
}

export function useMarketCompression(
  startDate: Date | string,
  rangeDays: number,
): MarketCompression {
  const { status } = useAuth();
  const start = toIsoDate(startDate);
  const endDt = new Date(typeof startDate === 'string' ? `${start}T00:00:00` : startDate);
  endDt.setDate(endDt.getDate() + Math.max(1, rangeDays) - 1);
  const end = toIsoDate(endDt);

  const query = useQuery<LighthouseDayLite[]>({
    queryKey: ['planning', 'market-compression', start, end],
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lighthouse_days')
        .select('stay_date, market_demand_percent, compset_median, our_price')
        .gte('stay_date', start)
        .lte('stay_date', end)
        .order('stay_date', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as LighthouseDayLite[];
    },
  });

  return useMemo(() => {
    const byDate: Record<string, CompressionDay> = {};
    for (const row of query.data ?? []) {
      const percent = row.market_demand_percent;
      byDate[row.stay_date] = {
        date: row.stay_date,
        percent: percent ?? null,
        level: percent != null ? compressionLevel(percent) : null,
        compsetMedian: row.compset_median ?? null,
        ourPrice: row.our_price ?? null,
      };
    }

    const days: CompressionDay[] = [];
    for (let i = 0; i < Math.max(1, rangeDays); i += 1) {
      const dt = new Date(`${start}T00:00:00`);
      dt.setDate(dt.getDate() + i);
      const iso = toIsoDate(dt);
      days.push(byDate[iso] ?? { date: iso, percent: null, level: null, compsetMedian: null, ourPrice: null });
    }

    const withData = days.filter((d) => d.percent != null);
    const avgPercent = withData.length > 0
      ? Math.round(withData.reduce((s, d) => s + (d.percent ?? 0), 0) / withData.length)
      : null;

    return {
      days,
      byDate,
      avgPercent,
      isLoading: query.isLoading,
      isError: query.isError,
    };
  }, [query.data, query.isLoading, query.isError, start, rangeDays]);
}
