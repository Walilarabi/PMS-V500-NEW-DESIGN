import { useMemo } from 'react';

import { useInvoices } from '@/src/domains/billing/hooks';
import { useFecExports, useReconciliationLines, useRevenueAnomalies } from '@/src/domains/finance/hooks';
import { useActiveHotel, useRooms } from '@/src/domains/hotel/hooks';
import { useReservations } from '@/src/domains/reservations/hooks';
import { REPORT_BY_CODE, REPORT_CATALOG } from '@/src/domains/analytics/data/reportCatalog';
import { generateMappedReport } from '@/src/domains/analytics/services/reportDataMapper';
import type {
  AnalyticsFilters,
  AnalyticsSourceData,
  GeneratedReport,
  ReportDefinition,
} from '@/src/domains/analytics/types/analytics.types';

export function useAnalyticsSources(filters: AnalyticsFilters) {
  const hotel = useActiveHotel();
  const rooms = useRooms();
  const reservations = useReservations({
    limit: 200,
    dateFrom: filters.period.from,
    dateTo: filters.period.to,
  });
  const invoices = useInvoices();
  const reconciliation = useReconciliationLines({ limit: 200 });
  const anomalies = useRevenueAnomalies();
  const fecExports = useFecExports();

  return {
    isLoading:
      hotel.isLoading ||
      rooms.isLoading ||
      reservations.isLoading ||
      invoices.isLoading ||
      reconciliation.isLoading ||
      anomalies.isLoading ||
      fecExports.isLoading,
    errors: [
      hotel.error,
      rooms.error,
      reservations.error,
      invoices.error,
      reconciliation.error,
      anomalies.error,
      fecExports.error,
    ].filter((error): error is Error => error instanceof Error),
    data: {
      hotel: hotel.data ?? null,
      rooms: rooms.data ?? [],
      reservations: reservations.data?.rows ?? [],
      invoices: invoices.data?.rows ?? [],
      reconciliationLines: reconciliation.data?.rows ?? [],
      revenueAnomalies: anomalies.data?.rows ?? [],
      fecExports: fecExports.data ?? [],
    } satisfies AnalyticsSourceData,
  };
}

export function useAnalyticsReport(code: string, filters: AnalyticsFilters): {
  report: GeneratedReport;
  definition: ReportDefinition;
  isLoading: boolean;
  errors: Error[];
} {
  const definition = REPORT_BY_CODE[code] ?? REPORT_CATALOG[0];
  const sources = useAnalyticsSources(filters);

  const report = useMemo(
    () => generateMappedReport(definition, sources.data, filters),
    [definition, filters, sources.data],
  );

  return {
    report,
    definition,
    isLoading: sources.isLoading,
    errors: sources.errors,
  };
}
