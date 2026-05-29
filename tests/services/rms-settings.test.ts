/**
 * FLOWTYM — rms-settings.service unit tests.
 *
 * Tests the pure applyMarkup function. The async DB functions
 * (fetchRmsSettings, updateRmsSettings) are covered by integration tests.
 */
import { describe, it, expect } from 'vitest';
import { applyMarkup } from '@/src/services/rms-settings.service';

describe('applyMarkup', () => {
  it('applies positive markup correctly', () => {
    expect(applyMarkup(100, 5)).toBe(105);
  });

  it('applies negative markup correctly', () => {
    expect(applyMarkup(200, -10)).toBe(180);
  });

  it('returns price unchanged for 0% markup', () => {
    expect(applyMarkup(150, 0)).toBe(150);
  });

  it('rounds to nearest integer', () => {
    // 101 * 1.05 = 106.05 → 106
    expect(applyMarkup(101, 5)).toBe(106);
    // 102 * 1.05 = 107.1 → 107
    expect(applyMarkup(102, 5)).toBe(107);
  });

  it('returns price unchanged for non-finite input', () => {
    expect(applyMarkup(NaN, 10)).toBeNaN();
    expect(applyMarkup(Infinity, 10)).toBe(Infinity);
  });

  it('returns price unchanged for zero price', () => {
    expect(applyMarkup(0, 10)).toBe(0);
  });

  it('returns price unchanged for negative price', () => {
    // Guard: price <= 0
    expect(applyMarkup(-50, 10)).toBe(-50);
  });

  it('handles large markup (100%)', () => {
    expect(applyMarkup(200, 100)).toBe(400);
  });

  it('handles very small markup (0.5%)', () => {
    expect(applyMarkup(200, 0.5)).toBe(201); // 200 * 1.005 = 201
  });

  it('handles max markup boundary (100%)', () => {
    expect(applyMarkup(300, 100)).toBe(600);
  });

  it('handles min markup boundary (-50%)', () => {
    expect(applyMarkup(300, -50)).toBe(150);
  });
});
