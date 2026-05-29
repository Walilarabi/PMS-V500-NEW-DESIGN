/**
 * FLOWTYM RMS — Unit tests for rate restrictions validation.
 */
import { describe, it, expect } from 'vitest';
import {
  validatePrice,
  validateInventory,
  validateStayDuration,
  validateStayConsistency,
  validateRateCode,
  validateCommission,
} from './validation';

// ─── validatePrice ────────────────────────────────────────────────────────────

describe('validatePrice', () => {
  it('accepte un prix positif valide', () => {
    const r = validatePrice(150);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejette NaN', () => {
    const r = validatePrice(NaN);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('price');
  });

  it('rejette un prix négatif', () => {
    const r = validatePrice(-10);
    expect(r.valid).toBe(false);
  });

  it('accepte zéro (prix gratuit autorisé)', () => {
    const r = validatePrice(0);
    expect(r.valid).toBe(true);
  });

  it('avertit si en dessous du min contextuel (warning, pas erreur)', () => {
    const r = validatePrice(50, { min: 100 });
    expect(r.valid).toBe(true); // warning n'invalide pas
    expect(r.errors.some((e) => e.severity === 'warning')).toBe(true);
  });

  it('avertit si au-dessus du max contextuel (warning)', () => {
    const r = validatePrice(500, { max: 300 });
    expect(r.valid).toBe(true);
    expect(r.errors.some((e) => e.severity === 'warning')).toBe(true);
  });
});

// ─── validateInventory ────────────────────────────────────────────────────────

describe('validateInventory', () => {
  it('accepte inventaire dans la capacité', () => {
    const r = validateInventory(5, 10);
    expect(r.valid).toBe(true);
  });

  it('accepte jusqu\'à 110% (surbooking limité)', () => {
    const r = validateInventory(11, 10); // 110%
    expect(r.valid).toBe(true);
  });

  it('rejette au-delà de 110%', () => {
    const r = validateInventory(12, 10); // 120%
    expect(r.valid).toBe(false);
  });

  it('rejette inventaire négatif', () => {
    const r = validateInventory(-1, 10);
    expect(r.valid).toBe(false);
  });

  it('rejette NaN', () => {
    const r = validateInventory(NaN, 10);
    expect(r.valid).toBe(false);
  });
});

// ─── validateStayDuration ─────────────────────────────────────────────────────

describe('validateStayDuration', () => {
  it('accepte null (restriction absente)', () => {
    const r = validateStayDuration(null, 'min');
    expect(r.valid).toBe(true);
  });

  it('accepte 1 nuit minimum', () => {
    const r = validateStayDuration(1, 'min');
    expect(r.valid).toBe(true);
  });

  it('rejette valeur < 1', () => {
    const r = validateStayDuration(0, 'min');
    expect(r.valid).toBe(false);
  });

  it('avertit si > 30 nuits', () => {
    const r = validateStayDuration(31, 'max');
    expect(r.valid).toBe(true); // warning
    expect(r.errors.some((e) => e.severity === 'warning')).toBe(true);
  });

  it('rejette NaN', () => {
    const r = validateStayDuration(NaN, 'min');
    expect(r.valid).toBe(false);
  });
});

// ─── validateStayConsistency ──────────────────────────────────────────────────

describe('validateStayConsistency', () => {
  it('est valide quand min < max', () => {
    const r = validateStayConsistency(2, 7);
    expect(r.valid).toBe(true);
  });

  it('est valide quand min = max', () => {
    const r = validateStayConsistency(3, 3);
    expect(r.valid).toBe(true);
  });

  it('est invalide quand min > max', () => {
    const r = validateStayConsistency(7, 2);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('stayDuration');
  });

  it('est valide quand l\'un des deux est null', () => {
    expect(validateStayConsistency(null, 5).valid).toBe(true);
    expect(validateStayConsistency(3, null).valid).toBe(true);
    expect(validateStayConsistency(null, null).valid).toBe(true);
  });
});

// ─── validateRateCode ─────────────────────────────────────────────────────────

describe('validateRateCode', () => {
  it('accepte un code valide en majuscules', () => {
    const r = validateRateCode('BAR_2025');
    expect(r.valid).toBe(true);
  });

  it('rejette un code vide', () => {
    const r = validateRateCode('');
    expect(r.valid).toBe(false);
  });

  it('rejette des caractères invalides (minuscules, espace)', () => {
    expect(validateRateCode('bar-2025').valid).toBe(false);
    expect(validateRateCode('BAR 2025').valid).toBe(false);
  });

  it('rejette un code en doublon', () => {
    const r = validateRateCode('BAR', ['BAR', 'FLEX']);
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('existe déjà');
  });

  it('accepte un code non-présent dans la liste existante', () => {
    const r = validateRateCode('PROMO', ['BAR', 'FLEX']);
    expect(r.valid).toBe(true);
  });
});

// ─── validateCommission ───────────────────────────────────────────────────────

describe('validateCommission', () => {
  it('accepte 0%', () => {
    expect(validateCommission(0).valid).toBe(true);
  });

  it('accepte 100%', () => {
    expect(validateCommission(100).valid).toBe(true);
  });

  it('accepte 15.5%', () => {
    expect(validateCommission(15.5).valid).toBe(true);
  });

  it('rejette > 100%', () => {
    expect(validateCommission(101).valid).toBe(false);
  });

  it('rejette valeur négative', () => {
    expect(validateCommission(-5).valid).toBe(false);
  });

  it('rejette NaN', () => {
    expect(validateCommission(NaN).valid).toBe(false);
  });
});
