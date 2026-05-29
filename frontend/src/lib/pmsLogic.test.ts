/**
 * FLOWTYM — Unit tests for pmsLogic.ts
 * Covers: TO (occupancy), ADR, RevPAR, monthly aggregation, period KPIs.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDayMetrics,
  computeMonthlyKPIs,
  calculateKPIs,
} from './pmsLogic';

// ─── computeDayMetrics ────────────────────────────────────────────────────────

describe('computeDayMetrics — cas nominal', () => {
  it('calcule occupancy/ADR/RevPAR sur 2 chambres occupées sur 10', () => {
    const reservations = [
      { check_in: '2025-01-15', check_out: '2025-01-17', total_amount: 200, status: 'confirmed' },
      { check_in: '2025-01-14', check_out: '2025-01-16', total_amount: 150, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.occupiedRooms).toBe(2);
    expect(m.occupancyRate).toBe(20); // 2/10 * 100
    expect(m.revenue).toBe(350);      // 200 + 150
    expect(m.adr).toBe(175);          // 350 / 2
    expect(m.revpar).toBe(35);        // 350 / 10
  });

  it('retourne 0 ADR et RevPAR si aucune chambre occupée', () => {
    const m = computeDayMetrics([], '2025-01-15', 10);

    expect(m.occupiedRooms).toBe(0);
    expect(m.adr).toBe(0);
    expect(m.revpar).toBe(0);
    expect(m.occupancyRate).toBe(0);
  });

  it('plafonne occupancy à 100% même si occupiedRooms > totalRooms', () => {
    const reservations = Array.from({ length: 15 }, (_, i) => ({
      check_in: '2025-01-15',
      check_out: '2025-01-17',
      total_amount: 100,
      status: 'confirmed',
    }));
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.occupancyRate).toBe(100);
    expect(m.occupiedRooms).toBe(15);
  });

  it('accepte les champs camelCase (legacy shape)', () => {
    const reservations = [
      { checkIn: '2025-01-15', checkOut: '2025-01-16', totalTTC: 120, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 4);

    expect(m.occupiedRooms).toBe(1);
    expect(m.revenue).toBe(120);
    expect(m.adr).toBe(120);
  });

  it('ne compte pas une réservation check_out le même jour (non-inclusive)', () => {
    const reservations = [
      { check_in: '2025-01-14', check_out: '2025-01-15', total_amount: 100, status: 'confirmed' },
    ];
    // check_out = '2025-01-15' → la nuit du 14 est passée, le client part le 15 matin
    const m = computeDayMetrics(reservations, '2025-01-15', 5);

    expect(m.occupiedRooms).toBe(0);
    expect(m.revenue).toBe(0);
  });
});

describe('computeDayMetrics — arrivées et départs', () => {
  it('compte les arrivées (check_in == dateStr)', () => {
    const reservations = [
      { check_in: '2025-06-01', check_out: '2025-06-03', total_amount: 200, status: 'confirmed' },
      { check_in: '2025-06-01', check_out: '2025-06-04', total_amount: 300, status: 'confirmed' },
      { check_in: '2025-05-31', check_out: '2025-06-02', total_amount: 150, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-06-01', 10);

    expect(m.arrivals).toBe(2);
  });

  it('compte les départs (check_out == dateStr)', () => {
    const reservations = [
      { check_in: '2025-05-30', check_out: '2025-06-01', total_amount: 100, status: 'confirmed' },
      { check_in: '2025-05-31', check_out: '2025-06-01', total_amount: 150, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-06-01', 10);

    expect(m.departures).toBe(2);
  });
});

describe('computeDayMetrics — annulations', () => {
  it('exclut les réservations annulées du revenu/occupancy', () => {
    const reservations = [
      { check_in: '2025-01-15', check_out: '2025-01-17', total_amount: 200, status: 'confirmed' },
      { check_in: '2025-01-15', check_out: '2025-01-17', total_amount: 999, status: 'cancelled' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.occupiedRooms).toBe(1);
    expect(m.revenue).toBe(200);
  });

  it('compte les annulations par check_in original', () => {
    const reservations = [
      { check_in: '2025-01-15', check_out: '2025-01-17', total_amount: 0, status: 'cancelled' },
      { check_in: '2025-01-15', check_out: '2025-01-18', total_amount: 0, status: 'cancelled' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.cancellations).toBe(2);
    expect(m.occupiedRooms).toBe(0);
  });
});

describe('computeDayMetrics — données invalides', () => {
  it('ignore les lignes sans check_in/check_out', () => {
    const reservations = [
      { check_in: '', check_out: '2025-01-17', total_amount: 200, status: 'confirmed' },
      { total_amount: 300, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.occupiedRooms).toBe(0);
    expect(m.revenue).toBe(0);
  });

  it('ignore les dates invalides (NaN)', () => {
    const reservations = [
      { check_in: 'invalid-date', check_out: 'also-invalid', total_amount: 200, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 10);

    expect(m.occupiedRooms).toBe(0);
  });

  it('utilise totalRooms=1 minimum pour éviter division par zéro', () => {
    const reservations = [
      { check_in: '2025-01-15', check_out: '2025-01-17', total_amount: 100, status: 'confirmed' },
    ];
    const m = computeDayMetrics(reservations, '2025-01-15', 0);

    expect(m.revpar).toBeGreaterThan(0);
    expect(Number.isFinite(m.revpar)).toBe(true);
  });
});

// ─── computeMonthlyKPIs ───────────────────────────────────────────────────────

describe('computeMonthlyKPIs', () => {
  it('agrège les métriques quotidiennes sur tout le mois', () => {
    // Une réservation couvrant 3 nuits en janvier
    const reservations = [
      { check_in: '2025-01-10', check_out: '2025-01-13', total_amount: 300, status: 'confirmed' },
    ];
    const m = computeMonthlyKPIs(reservations, 2025, 0 /* janvier */, 10);

    expect(m.year).toBe(2025);
    expect(m.month).toBe(0);
    expect(m.totalRevenue).toBe(900); // 300 × 3 nuits (revenue compté par jour)
    expect(m.totalArrivals).toBe(1);
    expect(m.totalDepartures).toBe(1);
    expect(m.avgADR).toBeGreaterThan(0);
    expect(m.avgOccupancy).toBeGreaterThanOrEqual(0);
  });

  it('retourne zéro pour un mois sans réservations', () => {
    const m = computeMonthlyKPIs([], 2025, 0, 10);

    expect(m.totalRevenue).toBe(0);
    expect(m.avgADR).toBe(0);
    expect(m.avgOccupancy).toBe(0);
    expect(m.avgRevPAR).toBe(0);
  });

  it('calcule correctement avgRevPAR = totalRevenue / (rooms * daysInMonth)', () => {
    const totalRooms = 5;
    const reservations = [
      // 1 chambre occupée tous les jours de janvier = 31 nuits
      { check_in: '2025-01-01', check_out: '2025-02-01', total_amount: 100, status: 'confirmed' },
    ];
    const m = computeMonthlyKPIs(reservations, 2025, 0, totalRooms);

    // totalRevenue = 100 × 31 jours
    const expectedRevPAR = Math.round((100 * 31) / (5 * 31));
    expect(m.avgRevPAR).toBe(expectedRevPAR);
  });
});

// ─── calculateKPIs (période 30 jours) ─────────────────────────────────────────

describe('calculateKPIs', () => {
  it('calcule les KPIs pour une liste de réservations', () => {
    const reservations = [
      { status: 'confirmed', nights: 3, totalTTC: 300, checkIn: '2025-01-10', checkOut: '2025-01-13' },
      { status: 'confirmed', nights: 2, totalTTC: 200, checkIn: '2025-01-15', checkOut: '2025-01-17' },
    ];
    const kpis = calculateKPIs(reservations, 10);

    expect(kpis.totalRevenue).toBe(500);
    expect(kpis.totalNights).toBe(5);
    expect(kpis.adr).toBe(100); // 500 / 5
    expect(kpis.avgStayLength).toBe(2.5); // 5 / 2
  });

  it('exclut les réservations annulées', () => {
    const reservations = [
      { status: 'confirmed', nights: 2, totalTTC: 200, checkIn: '2025-01-10', checkOut: '2025-01-12' },
      { status: 'cancelled', nights: 3, totalTTC: 999, checkIn: '2025-01-10', checkOut: '2025-01-13' },
    ];
    const kpis = calculateKPIs(reservations, 10);

    expect(kpis.totalRevenue).toBe(200);
    expect(kpis.totalNights).toBe(2);
  });

  it('filtre par période si fournie', () => {
    const reservations = [
      { status: 'confirmed', nights: 2, totalTTC: 200, checkIn: '2025-01-10', checkOut: '2025-01-12' },
      { status: 'confirmed', nights: 2, totalTTC: 300, checkIn: '2025-03-01', checkOut: '2025-03-03' }, // hors période
    ];
    const kpis = calculateKPIs(reservations, 10, {
      start: '2025-01-01',
      end: '2025-01-31',
    });

    expect(kpis.totalRevenue).toBe(200);
  });

  it('retourne 0 pour toutes métriques si aucune réservation', () => {
    const kpis = calculateKPIs([], 10);

    expect(kpis.adr).toBe(0);
    expect(kpis.revPar).toBe(0);
    expect(kpis.occupancyRate).toBe(0);
    expect(kpis.avgStayLength).toBe(0);
  });

  it('plafonne occupancyRate à 100%', () => {
    // 100 nuits sur 10 chambres × 30 jours = 300 → > 100%
    const reservations = Array.from({ length: 20 }, (_, i) => ({
      status: 'confirmed',
      nights: 15,
      totalTTC: 1000,
      checkIn: '2025-01-01',
      checkOut: '2025-01-16',
    }));
    const kpis = calculateKPIs(reservations, 5);

    expect(kpis.occupancyRate).toBeLessThanOrEqual(100);
  });

  it('ne divise pas par zéro si totalRoomsCount = 0', () => {
    const reservations = [
      { status: 'confirmed', nights: 2, totalTTC: 200, checkIn: '2025-01-10', checkOut: '2025-01-12' },
    ];
    const kpis = calculateKPIs(reservations, 0);

    expect(kpis.occupancyRate).toBe(0);
    expect(kpis.revPar).toBe(0);
    expect(Number.isFinite(kpis.adr)).toBe(true);
  });
});
