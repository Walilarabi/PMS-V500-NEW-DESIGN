import type {
  AnalyticsFilters,
  AnalyticsSourceData,
  GeneratedReport,
  ReportChartPoint,
  ReportDefinition,
  ReportMetric,
  ReportRow,
} from '@/src/domains/analytics/types/analytics.types';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { InvoiceRow } from '@/src/domains/billing/schemas';

const DAY_MS = 86_400_000;

function money(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function inPeriod(date: string | null | undefined, filters: AnalyticsFilters): boolean {
  if (!date) return false;
  return date.slice(0, 10) >= filters.period.from && date.slice(0, 10) <= filters.period.to;
}

function overlapsPeriod(start: string, end: string, filters: AnalyticsFilters): boolean {
  return start <= filters.period.to && end >= filters.period.from;
}

function nightsBetween(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.round(diff / DAY_MS));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function groupAmountBy<T>(
  rows: T[],
  labelOf: (row: T) => string,
  amountOf: (row: T) => number,
): ReportChartPoint[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = labelOf(row) || 'Non renseigne';
    grouped.set(label, (grouped.get(label) ?? 0) + amountOf(row));
  }
  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function reservationAmount(row: ReservationRow): number {
  return row.total_amount ?? 0;
}

function optionalString(row: ReservationRow, key: string): string | null {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function reservationRows(reservations: ReservationRow[]): ReportRow[] {
  return reservations.map((reservation) => ({
    id: reservation.id,
    label: reservation.reference ?? reservation.guest_name ?? reservation.id,
    date: reservation.check_in,
    guest: reservation.guest_name ?? undefined,
    room: reservation.room_number ?? reservation.room_type ?? undefined,
    status: reservation.status ?? undefined,
    source: reservation.source ?? undefined,
    amount: reservation.total_amount ?? 0,
    balance: reservation.solde ?? undefined,
    meta: {
      nights: reservation.nights ?? nightsBetween(reservation.check_in, reservation.check_out),
      adults: reservation.adults ?? 0,
      children: reservation.children ?? 0,
      checkOut: reservation.check_out,
      paymentStatus: reservation.payment_status ?? null,
    },
  }));
}

function invoiceRows(invoices: InvoiceRow[]): ReportRow[] {
  return invoices.map((invoice) => ({
    id: invoice.id,
    label: invoice.invoice_number,
    date: invoice.issued_at ?? invoice.created_at,
    guest: invoice.bill_to_name ?? undefined,
    status: invoice.status,
    amount: invoice.total_ttc,
    balance: invoice.balance ?? invoice.total_ttc - invoice.paid_amount,
    meta: {
      totalHt: invoice.total_ht,
      totalTva: invoice.total_tva,
      paid: invoice.paid_amount,
      dueDate: invoice.due_date,
    },
  }));
}

function buildMetrics(
  reservations: ReservationRow[],
  invoices: InvoiceRow[],
  roomCount: number,
): ReportMetric[] {
  const revenue = sum(reservations.map(reservationAmount));
  const paid = sum(invoices.map((invoice) => invoice.paid_amount));
  const balance = sum(invoices.map((invoice) => invoice.balance ?? invoice.total_ttc - invoice.paid_amount));
  const nights = sum(reservations.map((reservation) => reservation.nights ?? nightsBetween(reservation.check_in, reservation.check_out)));
  const occupiedRooms = new Set(reservations.filter((reservation) => reservation.status !== 'cancelled').map((reservation) => reservation.room_id ?? reservation.room_number ?? reservation.id)).size;
  const occupancy = roomCount > 0 ? (occupiedRooms / roomCount) * 100 : 0;
  const adr = nights > 0 ? revenue / nights : 0;
  const revpar = roomCount > 0 ? revenue / roomCount : 0;

  return [
    { label: 'CA reservationnel', value: money(revenue), tone: 'neutral' },
    { label: 'Occupation', value: percent(occupancy), tone: occupancy >= 75 ? 'good' : occupancy >= 45 ? 'warning' : 'neutral' },
    { label: 'ADR', value: money(adr), tone: 'neutral' },
    { label: 'RevPAR', value: money(revpar), tone: 'neutral' },
    { label: 'Encaisse', value: money(paid), tone: 'good' },
    { label: 'Solde ouvert', value: money(balance), tone: balance > 0 ? 'warning' : 'good' },
  ];
}

function filterReservations(source: AnalyticsSourceData, definition: ReportDefinition, filters: AnalyticsFilters): ReservationRow[] {
  const rows = source.reservations.filter((reservation) => {
    const periodMatch = definition.requiresPeriod
      ? overlapsPeriod(reservation.check_in, reservation.check_out, filters)
      : true;
    const channelMatch = filters.channel ? reservation.source === filters.channel : true;
    const segmentMatch = filters.segment ? reservation.segment === filters.segment : true;
    return periodMatch && channelMatch && segmentMatch;
  });

  if (definition.code === '21001') return rows.filter((reservation) => inPeriod(reservation.check_in, filters));
  if (definition.code === '21002' || definition.code === '11010') return rows.filter((reservation) => inPeriod(reservation.check_out, filters));
  if (definition.code === '21003') {
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((reservation) => reservation.check_in <= today && reservation.check_out >= today && reservation.status === 'checked_in');
  }
  if (definition.code === '21009') return rows.filter((reservation) => reservation.status === 'cancelled');
  if (definition.code === '21010') return rows.filter((reservation) => reservation.status === 'option' || reservation.status === 'pending');
  if (definition.code === '11009') return rows.filter((reservation) => reservation.status === 'confirmed' && inPeriod(reservation.check_in, filters));
  if (definition.code === '11008' || definition.code === '21005') return rows.filter((reservation) => Boolean(optionalString(reservation, 'group_code') ?? reservation.segment === 'group'));
  return rows;
}

function filterInvoices(source: AnalyticsSourceData, definition: ReportDefinition, filters: AnalyticsFilters): InvoiceRow[] {
  return source.invoices.filter((invoice) => {
    const date = invoice.issued_at ?? invoice.created_at;
    const periodMatch = definition.requiresPeriod ? inPeriod(date, filters) : true;
    if (!periodMatch) return false;
    if (definition.code === '33003' || definition.code === '33004' || definition.code === '33006') {
      return invoice.status !== 'paid' && (invoice.balance ?? invoice.total_ttc - invoice.paid_amount) > 0;
    }
    return true;
  });
}

function buildChart(definition: ReportDefinition, reservations: ReservationRow[], invoices: InvoiceRow[]): ReportChartPoint[] {
  if (definition.category === 'reservations' || definition.category === 'revenue') {
    if (definition.code === '21013' || definition.code === '54003' || definition.code === '54007') {
      return groupAmountBy(reservations, (row) => row.source ?? 'Direct', reservationAmount);
    }
    if (definition.code === '21014' || definition.code === '51020') {
      return groupAmountBy(reservations, (row) => row.rate_plan_id ?? row.room_type ?? 'Tarif standard', reservationAmount);
    }
    return groupAmountBy(reservations, (row) => row.check_in.slice(0, 7), reservationAmount).sort((a, b) => a.label.localeCompare(b.label));
  }

  if (definition.category === 'statistiques') {
    if (definition.code === '51010') return groupAmountBy(reservations, (row) => row.segment ?? 'Non segmente', reservationAmount);
    if (definition.code === '51060' || definition.code === '51070') return groupAmountBy(reservations, (row) => optionalString(row, 'nationality') ?? 'ND', (row) => row.nights ?? 1);
    return groupAmountBy(reservations, (row) => row.source ?? row.segment ?? 'Autre', reservationAmount);
  }

  if (definition.category === 'backoffice' || definition.category === 'comptabilite' || definition.category === 'tva') {
    return groupAmountBy(invoices, (row) => row.status, (row) => row.total_ttc);
  }

  return groupAmountBy(reservations, (row) => row.status ?? 'Actif', () => 1);
}

export function generateMappedReport(
  definition: ReportDefinition,
  source: AnalyticsSourceData,
  filters: AnalyticsFilters,
): GeneratedReport {
  const reservations = filterReservations(source, definition, filters);
  const invoices = filterInvoices(source, definition, filters);
  const useInvoiceRows = ['backoffice', 'comptabilite', 'tva'].includes(definition.category);
  const baseRows = useInvoiceRows ? invoiceRows(invoices) : reservationRows(reservations);
  const rows = baseRows.slice(0, 200);
  const warnings: string[] = [];

  if (definition.backendRequired) {
    warnings.push('Ce rapport exige une generation backend auditable avant usage production.');
  }
  if (definition.fiscal) {
    warnings.push('Rapport fiscal: snapshot immuable et journal audit requis cote backend.');
  }
  if (baseRows.length > rows.length) {
    warnings.push(`Resultat limite a ${rows.length} lignes pour proteger la fluidite de l interface.`);
  }

  return {
    definition,
    generatedAt: new Date().toISOString(),
    period: filters.period,
    metrics: buildMetrics(reservations, invoices, source.rooms.length),
    rows,
    chart: buildChart(definition, reservations, invoices),
    warnings,
  };
}
