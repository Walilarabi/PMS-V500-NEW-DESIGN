/**
 * FLOWTYM — Tests de la dérivation des badges réservation.
 */
import { describe, it, expect } from 'vitest';
import { deriveBadges, planHasBreakfast, type BadgeInput } from './planning-reservation-badges.service';

const TODAY = '2026-05-30';

function input(overrides: Partial<BadgeInput> = {}): BadgeInput {
  return {
    checkInIso: '2026-05-20',
    checkOutIso: '2026-06-05',
    ...overrides,
  };
}

describe('planHasBreakfast', () => {
  it('reconnaît les codes courts', () => {
    expect(planHasBreakfast('BB')).toBe(true);
    expect(planHasBreakfast('hb')).toBe(true);
    expect(planHasBreakfast('AI')).toBe(true);
  });
  it('reconnaît les libellés longs', () => {
    expect(planHasBreakfast('Bed & Breakfast')).toBe(true);
    expect(planHasBreakfast('Demi-pension')).toBe(true);
  });
  it('refuse room only / vide', () => {
    expect(planHasBreakfast('RO')).toBe(false);
    expect(planHasBreakfast('')).toBe(false);
    expect(planHasBreakfast(null)).toBe(false);
  });
});

describe('deriveBadges', () => {
  it('aucune réservation banale → aucun badge', () => {
    expect(deriveBadges(input(), TODAY)).toEqual([]);
  });

  it('arrivée du jour', () => {
    expect(deriveBadges(input({ checkInIso: TODAY }), TODAY)).toContain('arrival');
  });

  it('départ du jour', () => {
    expect(deriveBadges(input({ checkOutIso: TODAY }), TODAY)).toContain('departure');
  });

  it('VIP via flag ou fidélité', () => {
    expect(deriveBadges(input({ vip: true }), TODAY)).toContain('vip');
    expect(deriveBadges(input({ loyaltyLevel: 'gold' }), TODAY)).toContain('vip');
    expect(deriveBadges(input({ loyaltyLevel: '  ' }), TODAY)).not.toContain('vip');
  });

  it('payée vs solde dû (exclusifs)', () => {
    expect(deriveBadges(input({ paymentStatus: 'paid', solde: 0 }), TODAY)).toContain('paid');
    const unpaid = deriveBadges(input({ paymentStatus: 'pending', solde: 120 }), TODAY);
    expect(unpaid).toContain('unpaid');
    expect(unpaid).not.toContain('paid');
  });

  it('petit-déjeuner depuis le plan', () => {
    expect(deriveBadges(input({ mealPlan: 'BB' }), TODAY)).toContain('breakfast');
    expect(deriveBadges(input({ mealPlan: 'RO' }), TODAY)).not.toContain('breakfast');
  });

  it('groupe / online / notes', () => {
    const b = deriveBadges(
      input({ groupId: 'g1', checkinStatus: 'online', specialRequests: 'lit bébé' }),
      TODAY,
    );
    expect(b).toEqual(expect.arrayContaining(['group', 'online', 'notes']));
  });

  it('cumule arrivée + VIP + payée + groupe', () => {
    const b = deriveBadges(
      input({ checkInIso: TODAY, vip: true, paymentStatus: 'paid', groupId: 'g9' }),
      TODAY,
    );
    expect(b).toEqual(['arrival', 'vip', 'paid', 'group']);
  });
});
