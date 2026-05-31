/**
 * FLOWTYM — Compression marché (hook de consommation).
 *
 * Récupère la compression marché via le service centralisé
 * `getMarketCompressionRange` (source unique : lighthouse_days). Le Planning ne
 * recalcule jamais la compression : il consomme cette donnée.
 *
 * Aucune donnée fictive : si aucune ligne Lighthouse n'existe pour une date, la
 * compression est `null` (l'UI affiche « — » plutôt qu'un 0 % inventé).
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

export function useMarketCompression(
  startDate: Date | string,
  rangeDays: number,
): MarketCompression {
  const { status, session } = useAuth();
  const hotelId = session?.tenantId ?? null;
  const start = toIsoDate(startDate);

  const query = useQuery({
    queryKey: ['planning', 'market-compression', start, rangeDays],
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    queryFn: () => getMarketCompressionRange(hotelId, startDate, rangeDays),
  });

  return useMemo(() => {
    const days = query.data?.days ?? [];
    const byDate = query.data?.byDate ?? {};

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
  }, [query.data, query.isLoading, query.isError]);
}
