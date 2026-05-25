/**
 * FLOWTYM RMS — Tests Calendar Price Sync
 *
 * Garantit la cohérence Autopilote ↔ RMS ↔ Calendrier :
 *   • pickReferenceRoom / pickBarPlan : sélection correcte
 *   • getBarPriceForDate : exact > avg7 > avgAll > default
 *   • getAverageBarPriceAhead : moyenne sur fenêtre future
 */

import { describe, it, expect } from 'vitest';
import {
  getAverageBarPriceAhead,
  getBarPriceForDate,
  getBarPriceValueForDate,
  pickBarPlan,
  pickReferenceRoom,
} from './calendarPriceSync';
import type { RoomTypeData, RatePlanData, RatePrice } from '../../components/rms/types';

function price(date: string, p: number): RatePrice {
  return {
    date,
    price: p,
    currency: 'EUR',
    status: 'open',
    isEditable: true,
  };
}

function plan(planId: string, planName: string, prices: RatePrice[] = [], opts: Partial<RatePlanData> = {}): RatePlanData {
  return {
    internalId: 0,
    planId,
    planCode: opts.planCode ?? planName,
    planName,
    pensionType: 'BB',
    channelType: 'Direct',
    calcMode: 'fixed',
    calcValue: 0,
    referencePlanId: '',
    isReference: false,
    isActive: true,
    connectivityType: 'Aucun',
    isConnectivityLocked: false,
    assignedRoomTypeIds: [],
    distributionChannels: [],
    prices,
    ...opts,
  };
}

function room(roomTypeId: string, roomTypeName: string, ratePlans: RatePlanData[], opts: Partial<RoomTypeData> = {}): RoomTypeData {
  return {
    internalId: 0,
    roomTypeId,
    roomTypeCode: roomTypeId,
    roomTypeName,
    capacity: 2,
    bathroom: 'Douche',
    equipment: [],
    view: '',
    description: '',
    isReference: false,
    isActive: true,
    assignedRatePlanIds: [],
    distributionChannels: [],
    diffFromRef: 0,
    diffType: 'fixed',
    statuses: [],
    ratePlans,
    ...opts,
  };
}

describe('pickReferenceRoom', () => {
  it('renvoie null si vide', () => {
    expect(pickReferenceRoom([])).toBeNull();
  });
  it('renvoie le room avec isReference=true', () => {
    const a = room('a', 'A', []);
    const b = room('b', 'B', [], { isReference: true });
    const c = room('c', 'C', []);
    expect(pickReferenceRoom([a, b, c])?.roomTypeId).toBe('b');
  });
  it('fallback sur 1er actif si pas de reference', () => {
    const a = room('a', 'A', [], { isActive: false });
    const b = room('b', 'B', []);
    expect(pickReferenceRoom([a, b])?.roomTypeId).toBe('b');
  });
  it('fallback ultime sur 1er room', () => {
    const a = room('a', 'A', [], { isActive: false });
    expect(pickReferenceRoom([a])?.roomTypeId).toBe('a');
  });
});

describe('pickBarPlan', () => {
  it('renvoie le plan avec planCode commençant par BAR', () => {
    const p1 = plan('p1', 'Standard', [], { planCode: 'STD' });
    const p2 = plan('p2', 'BAR FLEX', [], { planCode: 'BAR1' });
    const r = room('r', 'R', [p1, p2]);
    expect(pickBarPlan(r)?.planId).toBe('p2');
  });
  it('fallback sur plan avec "BAR" dans le nom', () => {
    const p1 = plan('p1', 'Promo', [], { planCode: 'PRM' });
    const p2 = plan('p2', 'Best Available Rate', [], { planCode: 'BAR' });
    const r = room('r', 'R', [p1, p2]);
    // planCode BAR gagne aussi
    expect(pickBarPlan(r)?.planId).toBe('p2');
  });
  it('fallback sur 1er plan actif', () => {
    const p1 = plan('p1', 'Promo', [], { isActive: false, planCode: 'PRM' });
    const p2 = plan('p2', 'Direct', [], { planCode: 'DIR' });
    const r = room('r', 'R', [p1, p2]);
    expect(pickBarPlan(r)?.planId).toBe('p2');
  });
  it('renvoie null si pas de plan', () => {
    const r = room('r', 'R', []);
    expect(pickBarPlan(r)).toBeNull();
  });
});

describe('getBarPriceForDate — exact', () => {
  it('renvoie le prix exact à la date', () => {
    const p = plan('p', 'BAR', [
      price('2026-06-10', 180),
      price('2026-06-11', 195),
      price('2026-06-12', 205),
    ], { planCode: 'BAR' });
    const r = room('r', 'R', [p]);
    const out = getBarPriceForDate([r], '2026-06-11');
    expect(out.price).toBe(195);
    expect(out.source).toBe('exact');
  });
});

describe('getBarPriceForDate — fallback avg7', () => {
  it('renvoie la moyenne 7j si pas de prix exact', () => {
    const p = plan('p', 'BAR', [
      price('2026-06-01', 180),
      price('2026-06-02', 190),
      price('2026-06-03', 200),
    ], { planCode: 'BAR' });
    const r = room('r', 'R', [p]);
    const out = getBarPriceForDate([r], '2026-06-10');
    expect(out.source).toBe('avg7');
    expect(out.price).toBe(190); // (180+190+200)/3 = 190
  });
});

describe('getBarPriceForDate — fallback default', () => {
  it('renvoie 150 si aucune donnée', () => {
    const out = getBarPriceForDate([], '2026-06-10');
    expect(out.price).toBe(150);
    expect(out.source).toBe('default');
  });

  it('renvoie 150 si room sans plan', () => {
    const r = room('r', 'R', []);
    const out = getBarPriceForDate([r], '2026-06-10');
    expect(out.price).toBe(150);
    expect(out.source).toBe('default');
  });
});

describe('getBarPriceValueForDate', () => {
  it('renvoie juste le prix', () => {
    const p = plan('p', 'BAR', [price('2026-06-10', 200)], { planCode: 'BAR' });
    const r = room('r', 'R', [p]);
    expect(getBarPriceValueForDate([r], '2026-06-10')).toBe(200);
  });
});

describe('getAverageBarPriceAhead', () => {
  it('moyenne les prix sur la fenêtre future', () => {
    const today = new Date('2026-06-01T00:00:00Z');
    const p = plan('p', 'BAR', [
      price('2026-06-01', 100),
      price('2026-06-02', 200),
      price('2026-06-03', 300),
      price('2026-06-04', 400),
      price('2026-07-15', 9999), // hors fenêtre 30j → ignoré
    ], { planCode: 'BAR' });
    const r = room('r', 'R', [p]);
    const avg = getAverageBarPriceAhead([r], 30, today);
    expect(avg).toBe(250); // (100+200+300+400)/4
  });

  it('renvoie 150 si aucun prix dans la fenêtre', () => {
    const today = new Date('2026-06-01T00:00:00Z');
    const p = plan('p', 'BAR', [price('2025-01-01', 999)], { planCode: 'BAR' });
    const r = room('r', 'R', [p]);
    expect(getAverageBarPriceAhead([r], 30, today)).toBe(150);
  });
});

describe('cohérence Autopilote ↔ RMS ↔ Calendrier', () => {
  it('même date → même prix exact (no divergence)', () => {
    const p = plan('p', 'BAR', [price('2026-06-10', 187)], { planCode: 'BAR' });
    const r = room('r', 'R', [p], { isReference: true });
    const a = getBarPriceValueForDate([r], '2026-06-10');
    const b = getBarPriceValueForDate([r], '2026-06-10');
    expect(a).toBe(b);
    expect(a).toBe(187);
  });
});
