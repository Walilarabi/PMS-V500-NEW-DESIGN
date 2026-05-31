/**
 * FLOWTYM — Planning KPI service (source unique de vérité).
 *
 * Fonctions pures, sans dépendance React ni Supabase, pour calculer les
 * indicateurs opérationnels et revenue du planning à partir des données
 * réelles (réservations + chambres). Testables unitairement.
 *
 * Aucune donnée fictive : toutes les entrées proviennent du PMS.
 */

/** Statuts de réservation qui n'occupent PAS réellement une chambre. */
const NON_OCCUPYING_STATUSES = new Set(['cancelled', 'no_show', 'option', 'waitlist']);

/** Sous-ensemble minimal d'une réservation nécessaire aux calculs KPI. */
export interface KpiReservation {
  check_in: string;        // ISO date (YYYY-MM-DD)
  check_out: string;       // ISO date (YYYY-MM-DD)
  nights: number | null;
  status: string;
  total_amount: number | null;
}

/** Sous-ensemble minimal d'une chambre. */
export interface KpiRoom {
  id: string;
  active?: boolean | null;
  status?: string | null;
}

export interface DayKpi {
  /** Date au format YYYY-MM-DD. */
  date: string;
  /** Chambres occupées ce jour-là. */
  occupied: number;
  /** Chambres exploitables (actives, hors hors-service). */
  totalRooms: number;
  /** Taux d'occupation 0-100. */
  toRate: number;
  /** Chiffre d'affaires du jour (réparti par nuitée). */
  revenue: number;
  /** ADR = revenue / occupied. */
  adr: number;
  /** RevPAR = revenue / totalRooms. */
  revpar: number;
  /** Chambres libres = totalRooms - occupied. */
  free: number;
  /** Arrivées ce jour (check_in == date). */
  arrivals: number;
  /** Départs ce jour (check_out == date). */
  departures: number;
}

/** Normalise une date (Date | string) en YYYY-MM-DD. */
export function toIsoDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Une réservation occupe-t-elle réellement une chambre (statut valide) ? */
export function isOccupyingStatus(status: string): boolean {
  return !NON_OCCUPYING_STATUSES.has(status);
}

/**
 * Une réservation est-elle "présente" la nuit du `date` donné ?
 * Convention hôtelière : présent si check_in <= date < check_out.
 */
export function isPresentOn(res: KpiReservation, date: string): boolean {
  if (!isOccupyingStatus(res.status)) return false;
  const ci = res.check_in.slice(0, 10);
  const co = res.check_out.slice(0, 10);
  return ci <= date && date < co;
}

/** Compte les chambres exploitables (actives et non hors-service). */
export function countSellableRooms(rooms: KpiRoom[]): number {
  return rooms.filter((r) => {
    if (r.active === false) return false;
    if (r.status === 'out_of_order' || r.status === 'maintenance') return false;
    return true;
  }).length;
}

/**
 * Calcule l'ensemble des KPIs pour une journée donnée.
 * Le revenu du jour est la somme de (total_amount / nights) des réservations
 * présentes — répartition linéaire du montant sur la durée du séjour.
 */
export function computeDayKpi(
  date: Date | string,
  reservations: KpiReservation[],
  rooms: KpiRoom[],
): DayKpi {
  const iso = toIsoDate(date);
  const totalRooms = countSellableRooms(rooms);

  let occupied = 0;
  let revenue = 0;
  let arrivals = 0;
  let departures = 0;

  for (const res of reservations) {
    if (!isOccupyingStatus(res.status)) continue;
    const ci = res.check_in.slice(0, 10);
    const co = res.check_out.slice(0, 10);
    if (ci === iso) arrivals += 1;
    if (co === iso) departures += 1;
    if (ci <= iso && iso < co) {
      occupied += 1;
      const nights = res.nights && res.nights > 0
        ? res.nights
        : Math.max(1, daysBetween(ci, co));
      const amount = res.total_amount ?? 0;
      revenue += amount / nights;
    }
  }

  const toRate = totalRooms > 0 ? round1((occupied / totalRooms) * 100) : 0;
  const adr = occupied > 0 ? round2(revenue / occupied) : 0;
  const revpar = totalRooms > 0 ? round2(revenue / totalRooms) : 0;

  return {
    date: iso,
    occupied,
    totalRooms,
    toRate,
    revenue: round2(revenue),
    adr,
    revpar,
    free: Math.max(0, totalRooms - occupied),
    arrivals,
    departures,
  };
}

/** Calcule les KPIs sur une plage de dates (incluse). */
export function computeRangeKpis(
  startDate: Date | string,
  days: number,
  reservations: KpiReservation[],
  rooms: KpiRoom[],
): DayKpi[] {
  const start = typeof startDate === 'string' ? parseIso(startDate) : new Date(startDate);
  const out: DayKpi[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(computeDayKpi(d, reservations, rooms));
  }
  return out;
}

/** Agrège un ensemble de DayKpi en moyenne TO / ADR / RevPAR + total CA. */
export function aggregateKpis(days: DayKpi[]): {
  avgToRate: number;
  avgAdr: number;
  avgRevpar: number;
  totalRevenue: number;
  totalArrivals: number;
  totalDepartures: number;
} {
  if (days.length === 0) {
    return { avgToRate: 0, avgAdr: 0, avgRevpar: 0, totalRevenue: 0, totalArrivals: 0, totalDepartures: 0 };
  }
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalOccupied = days.reduce((s, d) => s + d.occupied, 0);
  const totalRoomNights = days.reduce((s, d) => s + d.totalRooms, 0);
  const avgToRate = totalRoomNights > 0 ? round1((totalOccupied / totalRoomNights) * 100) : 0;
  const avgAdr = totalOccupied > 0 ? round2(totalRevenue / totalOccupied) : 0;
  const avgRevpar = totalRoomNights > 0 ? round2(totalRevenue / totalRoomNights) : 0;
  return {
    avgToRate,
    avgAdr,
    avgRevpar,
    totalRevenue: round2(totalRevenue),
    totalArrivals: days.reduce((s, d) => s + d.arrivals, 0),
    totalDepartures: days.reduce((s, d) => s + d.departures, 0),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseIso(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = parseIso(aIso).getTime();
  const b = parseIso(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
