/**
 * Tests de régression — Distribution & OTA agrégats.
 *
 * Cause racine du crash signalé en conditions réelles : quand aucun canal
 * n'a de données (channelData = []) et que totalRevenue = 0, les divisions
 * dans `totals` et `dependencyData` produisaient NaN, qui se propageait
 * jusqu'à Recharts → boucle infinie → crash de la page Distribution & OTA.
 *
 * Ces tests verrouillent les garde-fous Math.max(1, ...) sur tous les
 * diviseurs critiques.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDistributionTotals,
  computeDistributionDependency,
  type DistributionChannelLike,
} from './distributionAggregates';

const makeChannel = (
  over: Partial<DistributionChannelLike> = {}
): DistributionChannelLike => ({
  id: 'booking',
  name: 'Booking.com',
  revenue: 10_000,
  netRevenue: 9_000,
  commissionCost: 1_000,
  bookings: 50,
  roomNights: 80,
  revpar: 95,
  conversion: 3.2,
  cancellationRate: 8.1,
  ...over,
});

const expectNoNaN = (obj: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${key} must be finite, got ${value}`).toBe(
        true
      );
    }
    if (typeof value === 'string') {
      expect(value, `${key} must not contain NaN`).not.toMatch(/NaN/i);
    }
  }
};

describe('computeDistributionTotals — garde-fous anti-NaN', () => {
  it('channelData vide + realTotals null → aucun NaN/Infinity', () => {
    const totals = computeDistributionTotals([], null);
    expectNoNaN(totals as unknown as Record<string, unknown>);
    expect(totals.totalRevenue).toBe(0);
    expect(totals.totalNet).toBe(0);
    expect(totals.totalCommission).toBe(0);
    expect(totals.avgADR).toBe(0);
    expect(totals.avgRevPAR).toBe(0);
    expect(totals.avgConv).toBe('0.0');
    expect(totals.avgCancel).toBe('0.0');
    expect(totals.commissionPct).toBe(0);
    expect(totals.directShare).toBe(0);
    expect(totals.otaShare).toBe(100);
  });

  it('channelData vide + realTotals avec valeurs nulles → pas de NaN', () => {
    const totals = computeDistributionTotals([], {
      totalRevenue: 0,
      totalBookings: 0,
      totalRoomNights: 0,
      avgADR: 0,
      avgRevPAR: 0,
    });
    expectNoNaN(totals as unknown as Record<string, unknown>);
    expect(totals.commissionPct).toBe(0);
  });

  it('données partielles (1 seul canal sans direct) → calculs cohérents', () => {
    const totals = computeDistributionTotals(
      [makeChannel({ id: 'booking', revenue: 5000, roomNights: 30 })],
      null
    );
    expectNoNaN(totals as unknown as Record<string, unknown>);
    expect(totals.totalRevenue).toBe(5000);
    expect(totals.directShare).toBe(0);
    expect(totals.otaShare).toBe(100);
  });

  it('OTA + Direct → directShare + otaShare = 100', () => {
    const totals = computeDistributionTotals(
      [
        makeChannel({ id: 'booking', revenue: 7000 }),
        makeChannel({ id: 'direct', name: 'Direct', revenue: 3000 }),
      ],
      null
    );
    expectNoNaN(totals as unknown as Record<string, unknown>);
    expect(totals.directShare).toBeCloseTo(30, 1);
    expect(totals.otaShare).toBeCloseTo(70, 1);
  });

  it('realTotals override mockRevenue mais reste safe si mockRevenue = 0', () => {
    // Cas réel : Lighthouse/rateCalendar a chargé des totaux, mais aucune
    // ventilation par canal n'est disponible → channelData = [] mais
    // realTotals.totalRevenue > 0.
    const totals = computeDistributionTotals([], {
      totalRevenue: 50_000,
      totalBookings: 200,
      totalRoomNights: 300,
      avgADR: 167,
      avgRevPAR: 120,
    });
    expectNoNaN(totals as unknown as Record<string, unknown>);
    expect(totals.totalRevenue).toBe(50_000);
    // commissionPct = (mockCommissionPct=0 → totalCommission=0) / 50000 = 0
    expect(totals.commissionPct).toBe(0);
    expect(totals.totalNet).toBe(50_000);
  });
});

describe('computeDistributionDependency — garde-fous anti-NaN', () => {
  it('channelData vide + totalRevenue = 0 → pas de NaN', () => {
    const dep = computeDistributionDependency([], 0);
    expectNoNaN(dep as unknown as Record<string, unknown>);
    expect(dep.topOTAName).toBe('');
    expect(dep.topOTAShare).toBe(0);
    expect(dep.directShare).toBe(0);
  });

  it('channelData non vide + totalRevenue = 0 → pas de division par zéro', () => {
    const dep = computeDistributionDependency(
      [makeChannel({ id: 'booking', revenue: 0 })],
      0
    );
    expectNoNaN(dep as unknown as Record<string, unknown>);
    expect(dep.topOTAShare).toBe(0);
  });

  it('top OTA correctement identifié, exclut direct', () => {
    const dep = computeDistributionDependency(
      [
        makeChannel({ id: 'direct', name: 'Direct', revenue: 9000 }),
        makeChannel({ id: 'booking', name: 'Booking.com', revenue: 6000 }),
        makeChannel({ id: 'airbnb', name: 'Airbnb', revenue: 3000 }),
      ],
      18_000
    );
    expectNoNaN(dep as unknown as Record<string, unknown>);
    expect(dep.topOTAName).toBe('Booking.com');
    expect(dep.topOTAShare).toBeCloseTo((6000 / 18_000) * 100, 1);
    expect(dep.directShare).toBeCloseTo((9000 / 18_000) * 100, 1);
  });

  it('aucun canal direct → directShare = 0', () => {
    const dep = computeDistributionDependency(
      [makeChannel({ id: 'booking', revenue: 10_000 })],
      10_000
    );
    expectNoNaN(dep as unknown as Record<string, unknown>);
    expect(dep.directShare).toBe(0);
  });
});
