/**
 * FLOWTYM — Tests des fonctions pures du service snapshot planning.
 * Couvre shiftIso, computePickup, kpiToSnapshotRow.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

import {
  shiftIso,
  computePickup,
  kpiToSnapshotRow,
  type SnapshotRow,
} from './planning-snapshot.service';
import type { DayKpi } from './planning-kpi.service';

function makeSnap(target: string, occupied: number, revenue: number, snappedOn = '2026-05-30'): SnapshotRow {
  return {
    hotel_id: 'h1',
    snapped_on: snappedOn,
    target_date: target,
    rooms_total: 50,
    rooms_occupied: occupied,
    revenue_total: revenue,
    arrivals_count: 0,
    departures_count: 0,
  };
}

describe('shiftIso', () => {
  it('avance d\'un jour', () => {
    expect(shiftIso('2026-05-30', 1)).toBe('2026-05-31');
  });
  it('recule d\'un jour (franchit le mois)', () => {
    expect(shiftIso('2026-06-01', -1)).toBe('2026-05-31');
  });
  it('tolère un timestamp et ne garde que la date', () => {
    expect(shiftIso('2026-05-30T12:00:00', 0)).toBe('2026-05-30');
  });
});

describe('computePickup', () => {
  it('calcule un pickup positif en chambres et revenu', () => {
    const today = [makeSnap('2026-06-10', 30, 4500)];
    const prior = [makeSnap('2026-06-10', 25, 3700, '2026-05-29')];
    const [p] = computePickup(today, prior);
    expect(p.rooms).toBe(5);
    expect(p.revenue).toBe(800);
    expect(p.noBaseline).toBe(false);
  });

  it('calcule un pickup négatif (annulations)', () => {
    const today = [makeSnap('2026-06-10', 20, 3000)];
    const prior = [makeSnap('2026-06-10', 25, 3700, '2026-05-29')];
    const [p] = computePickup(today, prior);
    expect(p.rooms).toBe(-5);
    expect(p.revenue).toBe(-700);
  });

  it('marque noBaseline quand hier est absent', () => {
    const today = [makeSnap('2026-06-10', 30, 4500)];
    const [p] = computePickup(today, []);
    expect(p.noBaseline).toBe(true);
    expect(p.rooms).toBe(0);
    expect(p.revenue).toBe(0);
  });

  it('apparie par target_date, pas par index', () => {
    const today = [makeSnap('2026-06-10', 30, 4500), makeSnap('2026-06-11', 10, 1500)];
    const prior = [makeSnap('2026-06-11', 8, 1200, '2026-05-29'), makeSnap('2026-06-10', 28, 4200, '2026-05-29')];
    const res = computePickup(today, prior);
    const d10 = res.find((r) => r.target_date === '2026-06-10')!;
    const d11 = res.find((r) => r.target_date === '2026-06-11')!;
    expect(d10.rooms).toBe(2);
    expect(d11.rooms).toBe(2);
  });
});

describe('kpiToSnapshotRow', () => {
  it('mappe un DayKpi vers une ligne snapshot', () => {
    const day: DayKpi = {
      date: '2026-06-10',
      occupied: 30,
      totalRooms: 50,
      toRate: 60,
      revenue: 4500.456,
      adr: 150,
      revpar: 90,
      free: 20,
      arrivals: 5,
      departures: 3,
    };
    const row = kpiToSnapshotRow('h1', '2026-05-30', day);
    expect(row).toEqual({
      hotel_id: 'h1',
      snapped_on: '2026-05-30',
      target_date: '2026-06-10',
      rooms_total: 50,
      rooms_occupied: 30,
      revenue_total: 4500.46,
      arrivals_count: 5,
      departures_count: 3,
    });
  });
});
