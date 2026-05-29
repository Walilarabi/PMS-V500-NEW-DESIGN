import { describe, it, expect, vi } from 'vitest';
vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/lib/hotelId', () => ({ resolveHotelId: () => Promise.resolve('h1') }));
import { formatPolicySummary, computePenalty } from './cancellation.service';

describe('formatPolicySummary', () => {
  it('rend un résumé lisible selon la base', () => {
    expect(formatPolicySummary({ penalty_type: 'percentage', penalty_value: 100, penalty_base: 'first_night', currency: 'EUR' })).toBe('100 % de la 1ère nuit');
    expect(formatPolicySummary({ penalty_type: 'percentage', penalty_value: 50, penalty_base: 'total_stay', currency: 'EUR' })).toBe('50 % du montant total du séjour');
    expect(formatPolicySummary({ penalty_type: 'fixed_amount', penalty_value: 100, penalty_base: 'fixed_amount', currency: 'EUR' })).toBe('100 EUR de frais fixes');
  });
});

describe('computePenalty', () => {
  const ctx = { firstNightAmount: 120, totalStayAmount: 480, cancelledAmount: 300, remainingDue: 200, paidAmount: 280 };
  it('100% de la 1ère nuit', () => {
    expect(computePenalty({ penalty_type: 'percentage', penalty_value: 100, penalty_base: 'first_night' }, ctx)).toBe(120);
  });
  it('50% du montant total', () => {
    expect(computePenalty({ penalty_type: 'percentage', penalty_value: 50, penalty_base: 'total_stay' }, ctx)).toBe(240);
  });
  it('30% du montant annulé', () => {
    expect(computePenalty({ penalty_type: 'percentage', penalty_value: 30, penalty_base: 'cancelled_amount' }, ctx)).toBe(90);
  });
  it('montant fixe ignore la base', () => {
    expect(computePenalty({ penalty_type: 'fixed_amount', penalty_value: 100, penalty_base: 'fixed_amount' }, ctx)).toBe(100);
  });
});
