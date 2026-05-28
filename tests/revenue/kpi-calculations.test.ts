/**
 * FLOWTYM — KPI calculation unit tests.
 *
 * Tests pure functions from frontend/src/lib/pmsLogic.ts:
 *   - computeDayMetrics: TO, ADR, RevPAR per day
 *   - computeMonthlyKPIs: monthly aggregation
 *   - calculateKPIs: report-level KPIs
 *
 * No mocks required — these are pure functions.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDayMetrics,
  computeMonthlyKPIs,
  calculateKPIs,
} from '@/src/lib/pmsLogic';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Res = {
  check_in: string;
  check_out: string;
  total_amount: number;
  status?: string;
  room?: string;
};

function res(checkIn: string, checkOut: string, amount: number, status = 'confirmed'): Res {
  return { check_in: checkIn, check_out: checkOut, total_amount: amount, status };
}

// ── computeDayMetrics ─────────────────────────────────────────────────────────

describe('computeDayMetrics — occupancy rate (TO)', () => {
  it('0% when no reservations', () => {
    const m = computeDayMetrics([], '2026-06-15', 10);
    expect(m.occupancyRate).toBe(0);
    expect(m.occupiedRooms).toBe(0);
  });

  it('100% when all rooms occupied', () => {
    const reservations = Array.from({ length: 10 }, (_, i) =>
      res('2026-06-15', '2026-06-16', 100)
    );
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.occupancyRate).toBe(100);
    expect(m.occupiedRooms).toBe(10);
  });

  it('50% when half rooms occupied', () => {
    const reservations = [
      res('2026-06-15', '2026-06-17', 200),
      res('2026-06-15', '2026-06-16', 150),
      res('2026-06-15', '2026-06-18', 300),
      res('2026-06-15', '2026-06-16', 120),
      res('2026-06-15', '2026-06-17', 180),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.occupancyRate).toBe(50);
  });

  it('caps occupancy at 100% even with overbooking', () => {
    // 15 reservations for 10 rooms = overbooking scenario
    const reservations = Array.from({ length: 15 }, () =>
      res('2026-06-15', '2026-06-16', 100)
    );
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.occupancyRate).toBe(100);
  });

  it('excludes cancelled reservations from occupancy', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 200, 'confirmed'),
      res('2026-06-15', '2026-06-16', 150, 'cancelled'),
      res('2026-06-15', '2026-06-16', 120, 'cancelled'),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.occupiedRooms).toBe(1);
    expect(m.cancellations).toBe(2);
  });

  it('does not count reservation that checks out on that day', () => {
    // check_out = dateStr means the guest has left (interval [checkIn, checkOut))
    const reservations = [res('2026-06-14', '2026-06-15', 200)];
    const m = computeDayMetrics(reservations, '2026-06-15', 5);
    expect(m.occupiedRooms).toBe(0);
    expect(m.departures).toBe(1);
  });

  it('counts reservation that checks in on that day as present', () => {
    const reservations = [res('2026-06-15', '2026-06-16', 200)];
    const m = computeDayMetrics(reservations, '2026-06-15', 5);
    expect(m.occupiedRooms).toBe(1);
    expect(m.arrivals).toBe(1);
  });
});

describe('computeDayMetrics — ADR (Average Daily Rate)', () => {
  it('ADR = total revenue / occupied rooms', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 200),
      res('2026-06-15', '2026-06-16', 300),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.adr).toBe(250); // (200+300)/2
  });

  it('ADR = 0 when no occupied rooms', () => {
    const m = computeDayMetrics([], '2026-06-15', 10);
    expect(m.adr).toBe(0);
  });

  it('ADR rounds to nearest integer', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 100),
      res('2026-06-15', '2026-06-16', 101),
      res('2026-06-15', '2026-06-16', 102),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    // (100+101+102)/3 = 101
    expect(m.adr).toBe(101);
  });

  it('ADR excludes cancelled reservation revenue', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 200, 'confirmed'),
      res('2026-06-15', '2026-06-16', 500, 'cancelled'),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    expect(m.adr).toBe(200);
    expect(m.revenue).toBe(200);
  });
});

describe('computeDayMetrics — RevPAR', () => {
  it('RevPAR = total revenue / total available rooms', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 200),
      res('2026-06-15', '2026-06-16', 300),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 10);
    // (200+300)/10 = 50
    expect(m.revpar).toBe(50);
  });

  it('RevPAR = 0 when no revenue (no occupied rooms)', () => {
    const m = computeDayMetrics([], '2026-06-15', 10);
    expect(m.revpar).toBe(0);
  });

  it('RevPAR equals ADR when 100% occupied', () => {
    const reservations = [
      res('2026-06-15', '2026-06-16', 150),
      res('2026-06-15', '2026-06-16', 150),
    ];
    const m = computeDayMetrics(reservations, '2026-06-15', 2);
    // Full occupancy → RevPAR = ADR = 150
    expect(m.revpar).toBe(m.adr);
    expect(m.revpar).toBe(150);
  });

  it('RevPAR < ADR when occupancy < 100%', () => {
    const reservations = [res('2026-06-15', '2026-06-16', 200)];
    const m = computeDayMetrics(reservations, '2026-06-15', 4);
    // 1/4 occupied → RevPAR = 200/4 = 50, ADR = 200
    expect(m.revpar).toBe(50);
    expect(m.adr).toBe(200);
    expect(m.revpar).toBeLessThan(m.adr);
  });
});

// ── computeMonthlyKPIs ────────────────────────────────────────────────────────

describe('computeMonthlyKPIs', () => {
  it('returns zero metrics for empty reservation list', () => {
    const m = computeMonthlyKPIs([], 2026, 5, 10); // June 2026
    expect(m.totalRevenue).toBe(0);
    expect(m.avgOccupancy).toBe(0);
    expect(m.avgADR).toBe(0);
    expect(m.avgRevPAR).toBe(0);
  });

  it('computes correct monthly revenue from a single stay spanning 3 nights', () => {
    const reservations = [res('2026-06-10', '2026-06-13', 300)];
    const m = computeMonthlyKPIs(reservations, 2026, 5, 5); // 30 days in June
    // 300€ revenue spread across 3 days of 30
    expect(m.totalRevenue).toBe(300 * 3); // counted once per occupied day
  });

  it('avgOccupancy is bounded to [0, 100]', () => {
    const reservations = Array.from({ length: 20 }, () =>
      res('2026-06-01', '2026-06-30', 200)
    );
    const m = computeMonthlyKPIs(reservations, 2026, 5, 10);
    expect(m.avgOccupancy).toBeGreaterThanOrEqual(0);
    expect(m.avgOccupancy).toBeLessThanOrEqual(100);
  });

  it('aggregates arrivals and departures correctly', () => {
    const reservations = [
      res('2026-06-01', '2026-06-03', 200),
      res('2026-06-05', '2026-06-07', 300),
      res('2026-06-10', '2026-06-11', 100),
    ];
    const m = computeMonthlyKPIs(reservations, 2026, 5, 5);
    expect(m.totalArrivals).toBe(3);
    expect(m.totalDepartures).toBe(3);
  });

  it('returns correct year and month in result', () => {
    const m = computeMonthlyKPIs([], 2026, 8, 10); // September (month=8)
    expect(m.year).toBe(2026);
    expect(m.month).toBe(8);
  });
});

// calculateKPIs uses camelCase fields: checkIn, totalTTC, nights, status
function reportRes(checkIn: string, nights: number, totalTTC: number, status = 'confirmed') {
  return { checkIn, nights, totalTTC, status };
}

// ── calculateKPIs ─────────────────────────────────────────────────────────────

describe('calculateKPIs — report-level KPIs', () => {
  it('returns all-zero KPIs for empty reservation list', () => {
    const kpis = calculateKPIs([], 10);
    expect(kpis.occupancyRate).toBe(0);
    expect(kpis.adr).toBe(0);
    expect(kpis.revPar).toBe(0);
    expect(kpis.totalRevenue).toBe(0);
  });

  it('occupancyRate is a percentage between 0 and 100', () => {
    const reservations = [
      reportRes('2026-06-01', 2, 200),
      reportRes('2026-06-01', 1, 150),
    ];
    const kpis = calculateKPIs(reservations, 10);
    expect(kpis.occupancyRate).toBeGreaterThanOrEqual(0);
    expect(kpis.occupancyRate).toBeLessThanOrEqual(100);
  });

  it('totalNights sums all reservation durations', () => {
    const reservations = [
      reportRes('2026-06-01', 3, 300), // 3 nights
      reportRes('2026-06-10', 2, 200), // 2 nights
    ];
    const kpis = calculateKPIs(reservations, 10);
    expect(kpis.totalNights).toBe(5);
  });

  it('adr = totalRevenue / totalNights', () => {
    const reservations = [
      reportRes('2026-06-01', 2, 400), // 400€ for 2 nights → 200/night
    ];
    const kpis = calculateKPIs(reservations, 10);
    expect(kpis.adr).toBeCloseTo(200, 0);
  });

  it('excludes cancelled reservations', () => {
    const reservations = [
      reportRes('2026-06-01', 2, 400, 'confirmed'),
      reportRes('2026-06-01', 1, 200, 'cancelled'),
    ];
    const kpis = calculateKPIs(reservations, 10);
    expect(kpis.totalRevenue).toBe(400);
    expect(kpis.totalNights).toBe(2);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('computeDayMetrics — edge cases', () => {
  it('handles reservations with camelCase field names', () => {
    const reservation = {
      checkIn: '2026-06-15',
      checkOut: '2026-06-16',
      totalTTC: 180,
      status: 'confirmed',
    };
    const m = computeDayMetrics([reservation], '2026-06-15', 5);
    expect(m.occupiedRooms).toBe(1);
    expect(m.revenue).toBe(180);
  });

  it('handles reservations with invalid dates gracefully', () => {
    const reservation = {
      check_in: 'invalid-date',
      check_out: '2026-06-16',
      total_amount: 200,
      status: 'confirmed',
    };
    expect(() => computeDayMetrics([reservation], '2026-06-15', 5)).not.toThrow();
    const m = computeDayMetrics([reservation], '2026-06-15', 5);
    expect(m.occupiedRooms).toBe(0); // skipped
  });

  it('handles zero total rooms without division by zero', () => {
    const reservations = [res('2026-06-15', '2026-06-16', 200)];
    expect(() => computeDayMetrics(reservations, '2026-06-15', 0)).not.toThrow();
    const m = computeDayMetrics(reservations, '2026-06-15', 0);
    expect(Number.isFinite(m.revpar)).toBe(true);
  });
});
