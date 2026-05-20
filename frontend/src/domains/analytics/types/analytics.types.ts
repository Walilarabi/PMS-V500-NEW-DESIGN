import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { InvoiceRow } from '@/src/domains/billing/schemas';
import type {
  FecExportRow,
  ReconciliationLineRow,
  RevenueAnomalyRow,
} from '@/src/domains/finance/schemas';
import type { HotelRow, RoomRow } from '@/src/lib/supabase.types';

export type ReportCategory =
  | 'exploitation'
  | 'reservations'
  | 'backoffice'
  | 'comptabilite'
  | 'tva'
  | 'statistiques'
  | 'revenue'
  | 'housekeeping'
  | 'technique';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'fec' | 'ubl' | 'sage' | 'ebp';
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | null;
export type ReportDefaultPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';
export type ReportDataSource =
  | 'reservations'
  | 'billing'
  | 'finance'
  | 'hotel'
  | 'rooms'
  | 'housekeeping'
  | 'revenue'
  | 'external_backend';

export interface ReportDefinition {
  code: string;
  label: string;
  category: ReportCategory;
  subcategory: string | null;
  description: string;
  formats: ReportFormat[];
  requiresPeriod: boolean;
  requiresHotel: boolean;
  fiscal: boolean;
  immutableOnceClosed: boolean;
  chartType?: ChartType;
  defaultPeriod: ReportDefaultPeriod;
  dataSources: ReportDataSource[];
  backendRequired?: boolean;
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
}

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  hotelId?: string;
  segment?: string;
  channel?: string;
}

export interface AnalyticsSourceData {
  hotel: HotelRow | null;
  rooms: RoomRow[];
  reservations: ReservationRow[];
  invoices: InvoiceRow[];
  reconciliationLines: ReconciliationLineRow[];
  revenueAnomalies: RevenueAnomalyRow[];
  fecExports: FecExportRow[];
}

export interface ReportMetric {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface ReportRow {
  id: string;
  label: string;
  date?: string;
  guest?: string;
  room?: string;
  status?: string;
  source?: string;
  amount?: number;
  balance?: number;
  meta?: Record<string, string | number | boolean | null>;
}

export interface ReportChartPoint {
  label: string;
  value: number;
}

export interface GeneratedReport {
  definition: ReportDefinition;
  generatedAt: string;
  period: AnalyticsPeriod;
  metrics: ReportMetric[];
  rows: ReportRow[];
  chart: ReportChartPoint[];
  warnings: string[];
}
