/**
 * FLOWTYM — useReportData
 *
 * Hook React Query pour charger les données d'un rapport.
 */

import { useQuery } from '@tanstack/react-query';
import { loadReport, type ReportData } from '../../services/analysis/report-data.service';
import type { ReportFilters } from '../../pages/analysis/ReportShell';

export interface UseReportDataOptions {
  reportId: string;
  filters: ReportFilters;
  enabled?: boolean;
}

export function useReportData<T = unknown>({ reportId, filters, enabled = true }: UseReportDataOptions) {
  return useQuery<ReportData<T>>({
    queryKey: ['analytics-report', reportId, filters],
    queryFn: () => loadReport({ reportId, filters }) as Promise<ReportData<T>>,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
