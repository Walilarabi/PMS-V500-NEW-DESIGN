/**
 * FLOWTYM — Compression marché (hook de consommation).
 *
 * SOURCE : priorité au store Lighthouse (même source que RMS / veille concurrentielle),
 * sinon fallback sur lighthouse_days Supabase (si données persistées en base).
 * Cette dualité garantit que le Planning affiche toujours les mêmes valeurs que
 * la colonne « Pression » du tableau RMS Revenue Management, quel que soit l'état
 * de la persistance Supabase.
 *
 * Aucune donnée fictive : si aucune donnée Lighthouse n'existe, percent = null
 * (l'UI affiche « — » plutôt qu'un 0 % inventé).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { toIsoDate } from '@/src/services/planning/planning-kpi.service';
import {
  getMarketCompressionRange,
  compressionLevel,
  type CompressionLevel,
  type MarketCompressionPoint,
} from '@/src/services/planning/market-compression.service';
import { useLighthouseStore } from '@/src/store/lighthouseStore';

export type { CompressionLevel };
export { compressionLevel };

/** Alias rétro-compatible — un point de compression par date. */
export type CompressionDay = MarketCompressionPoint;

export interface MarketCompression {
  days: CompressionDay[];
  byDate: Record<string, CompressionDay>;
  /** Moyenne de la plage (sur les jours ayant une donnée), ou null. */
  avgPercent: number | null;
  isLoading: boolean;
  isError: boolean;
}

const EMPTY_POINT = (date: string): CompressionDay => ({
  date,
  percent: null,
  level: null,
  compsetMedian: null,
  ourPrice: null,
});

export function useMarketCompression(
  startDate: Date | string,
  rangeDays: number,
): MarketCompression {
  const { status, session } = useAuth();
  const hotelId = session?.tenantId ?? null;
  const start = toIsoDate(startDate);

  // Source 1 : store Lighthouse (même que RMS — prioritaire)
  const lighthouseImport = useLighthouseStore((s) => s.importData);

  // Index O(1) par date depuis le store
  const lhByDate = useMemo(() => {
    if (!lighthouseImport?.days?.length) return null;
    const map: Record<string, (typeof lighthouseImport.days)[0]> = {};
    for (const d of lighthouseImport.days) map[d.date] = d;
    return map;
  }, [lighthouseImport]);

  // Source 2 : lighthouse_days Supabase — uniquement si le store est vide
  const query = useQuery({
    queryKey: ['planning', 'market-compression', start, rangeDays],
    enabled: status === 'authenticated' && !lhByDate,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => getMarketCompressionRange(hotelId, startDate, rangeDays),
  });

  return useMemo(() => {
    // ── Chemin principal : store Lighthouse ─────────────────────────────────
    if (lhByDate) {
      const days: CompressionDay[] = [];
      const byDate: Record<string, CompressionDay> = {};

      for (let i = 0; i < Math.max(1, rangeDays); i++) {
        const dt = new Date(`${start}T00:00:00`);
        dt.setDate(dt.getDate() + i);
        const iso = toIsoDate(dt);
        const lh = lhByDate[iso];
        const point: CompressionDay = lh
          ? {
              date: iso,
              percent: lh.marketDemandPercent,
              level: compressionLevel(lh.marketDemandPercent),
              compsetMedian: lh.compsetMedian ?? null,
              ourPrice: lh.ourPrice ?? null,
            }
          : EMPTY_POINT(iso);
        days.push(point);
        byDate[iso] = point;
      }

      const withData = days.filter((d) => d.percent != null);
      const avgPercent =
        withData.length > 0
          ? Math.round(withData.reduce((s, d) => s + (d.percent ?? 0), 0) / withData.length)
          : null;

      return { days, byDate, avgPercent, isLoading: false, isError: false };
    }

    // ── Fallback : lighthouse_days Supabase ──────────────────────────────────
    const days = query.data?.days ?? [];
    const byDate = query.data?.byDate ?? {};

    const withData = days.filter((d) => d.percent != null);
    const avgPercent =
      withData.length > 0
        ? Math.round(withData.reduce((s, d) => s + (d.percent ?? 0), 0) / withData.length)
        : null;

    return {
      days,
      byDate,
      avgPercent,
      isLoading: query.isLoading,
      isError: query.isError,
    };
  }, [lhByDate, query.data, query.isLoading, query.isError, start, rangeDays]);
}
