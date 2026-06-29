/**
 * FLOWTYM — Prefetch rapports phares
 *
 * Au mount du Dashboard, on prefetch les RPCs des 4 rapports clés
 * pour qu'ils soient instantanés à l'ouverture par l'utilisateur.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadReport } from '../../services/analysis/report-data.service';
import type { ReportFilters } from '../../pages/analysis/ReportShell';

const PREFETCH_IDS = ['54001', '21008', '21013', '54004'];

export function usePrefetchKeyReports() {
  const qc = useQueryClient();

  useEffect(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);
    const filters: ReportFilters = {
      startDate: start.toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10),
      granularity: 'day',
      comparison: 'N-1',
    };

    PREFETCH_IDS.forEach(reportId => {
      qc.prefetchQuery({
        queryKey: ['analytics-report', reportId, filters],
        queryFn: () => loadReport({ reportId, filters }),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [qc]);
}
