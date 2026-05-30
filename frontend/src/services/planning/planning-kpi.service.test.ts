/**
 * Tests du service KPI planning — source unique TO/ADR/RevPAR.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDayKpi,
  computeRangeKpis,
  aggregateKpis,
  isPresentOn,
  isOccupyingStatus,
  countSellableRooms,
  toIsoDate,
  type KpiReservation,
  type KpiRoom,
} from './planning-kpi.service';

function res(over: Partial<KpiReservation>): KpiReservation {
  return {
    check_in: '2026-05-30',
    check_out: '2026-06-02',
    nights: 3,
    status: 'confirmed',
    total_amount: 300,
    ...over,
  };
}

const rooms10: KpiRoom[] = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, active: true, status: 'clean' }));

describe('toIsoDate', () => {
  it('normalise une string', () => {
    expect(toIsoDate('2026-05-30T12:00:00Z')).toBe('2026-05-30');
  });
  it('normalise un Date', () => {
    expect(toIsoDate(new Date(2026, 4, 30))).toBe('2026-05-30');
  });
});

describe('isOccupyingStatus', () => {
  it('confirmed/checked_in/pending occupent', () => {
    expect(isOccupyingStatus('confirmed')).toBe(true);
    expect(isOccupyingStatus('checked_in')).toBe(true);
    expect(isOccupyingStatus('pending')).toBe(true);
  });
  it('cancelled/no_show/option/waitlist n\'occupent pas', () => {
    expect(isOccupyingStatus('cancelled')).toBe(false);
    expect(isOccupyingStatus('no_show')).toBe(false);
    expect(isOccupyingStatus('option')).toBe(false);
    expect(isOccupyingStatus('waitlist')).toBe(false);
  });
});

describe('isPresentOn', () => {
  it('présent la nuit d\'arrivée mais pas celle du départ', () => {
    const r = res({ check_in: '2026-05-30', check_out: '2026-06-02' });
    expect(isPresentOn(r, '2026-05-30')).toBe(true);
    expect(isPresentOn(r, '2026-06-01')).toBe(true);
    expect(isPresentOn(r, '2026-06-02')).toBe(false); // jour de départ = libre
    expect(isPresentOn(r, '2026-05-29')).toBe(false);
  });
  it('annulée jamais présente', () => {
    const r = res({ status: 'cancelled' });
    expect(isPresentOn(r, '2026-05-30')).toBe(false);
  });
});

describe('countSellableRooms', () => {
  it('exclut inactives et hors-service', () => {
    const rooms: KpiRoom[] = [
      { id: '1', active: true, status: 'clean' },
      { id: '2', active: false, status: 'clean' },
      { id: '3', active: true, status: 'out_of_order' },
      { id: '4', active: true, status: 'maintenance' },
      { id: '5', active: true, status: 'dirty' },
    ];
    expect(countSellableRooms(rooms)).toBe(2); // #1 et #5
  });
});

describe('computeDayKpi', () => {
  it('calcule TO/ADR/RevPAR correctement', () => {
    const reservations = [
      res({ check_in: '2026-05-30', check_out: '2026-06-02', nights: 3, total_amount: 300 }), // 100/nuit
      res({ check_in: '2026-05-29', check_out: '2026-05-31', nights: 2, total_amount: 200 }), // 100/nuit
    ];
    const k = computeDayKpi('2026-05-30', reservations, rooms10);
    expect(k.occupied).toBe(2);
    expect(k.totalRooms).toBe(10);
    expect(k.toRate).toBe(20);          // 2/10
    expect(k.revenue).toBe(200);        // 100 + 100
    expect(k.adr).toBe(100);            // 200/2
    expect(k.revpar).toBe(20);          // 200/10
    expect(k.free).toBe(8);
  });

  it('compte arrivées et départs', () => {
    const reservations = [
      res({ check_in: '2026-05-30', check_out: '2026-06-02' }),      // arrivée
      res({ check_in: '2026-05-28', check_out: '2026-05-30' }),      // départ
    ];
    const k = computeDayKpi('2026-05-30', reservations, rooms10);
    expect(k.arrivals).toBe(1);
    expect(k.departures).toBe(1);
    expect(k.occupied).toBe(1); // seule la première est présente la nuit du 30
  });

  it('ignore les réservations annulées', () => {
    const reservations = [
      res({ status: 'cancelled' }),
      res({ status: 'no_show' }),
    ];
    const k = computeDayKpi('2026-05-30', reservations, rooms10);
    expect(k.occupied).toBe(0);
    expect(k.toRate).toBe(0);
    expect(k.adr).toBe(0);
  });

  it('TO/ADR/RevPAR à 0 si aucune chambre exploitable', () => {
    const k = computeDayKpi('2026-05-30', [res({})], []);
    expect(k.totalRooms).toBe(0);
    expect(k.toRate).toBe(0);
    expect(k.revpar).toBe(0);
  });

  it('déduit nights si manquant', () => {
    const k = computeDayKpi('2026-05-30', [
      res({ check_in: '2026-05-30', check_out: '2026-06-02', nights: null, total_amount: 300 }),
    ], rooms10);
    expect(k.revenue).toBe(100); // 300 / 3 nuits déduites
  });
});

describe('computeRangeKpis', () => {
  it('produit un KPI par jour', () => {
    const days = computeRangeKpis('2026-05-30', 7, [res({})], rooms10);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-05-30');
    expect(days[6].date).toBe('2026-06-05');
  });
});

describe('aggregateKpis', () => {
  it('moyenne pondérée TO + total CA', () => {
    const reservations = [res({ check_in: '2026-05-30', check_out: '2026-06-02', nights: 3, total_amount: 300 })];
    const days = computeRangeKpis('2026-05-30', 3, reservations, rooms10);
    const agg = aggregateKpis(days);
    expect(agg.totalRevenue).toBe(300);    // 100 × 3 nuits
    expect(agg.avgToRate).toBe(10);        // 1 occupée / 10 chaque jour
    expect(agg.avgAdr).toBe(100);
  });

  it('renvoie des zéros sur tableau vide', () => {
    const agg = aggregateKpis([]);
    expect(agg.avgToRate).toBe(0);
    expect(agg.totalRevenue).toBe(0);
  });
});
