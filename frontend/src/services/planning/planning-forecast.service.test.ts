/**
 * FLOWTYM — Tests du moteur de forecast (fonctions pures).
 */
import { describe, it, expect } from 'vitest';
import {
  computeForecast,
  computeAttritionRates,
  leadTimeFactor,
  type ForecastInput,
} from './planning-forecast.service';

const base: ForecastInput = {
  currentToRate: 60,
  pickupRooms: 0,
  totalRooms: 50,
  remainingDays: 0,
  cancelRate: 0,
  noshowRate: 0,
  compressionPercent: null,
};

describe('computeAttritionRates', () => {
  it('renvoie 0 sur échantillon vide', () => {
    expect(computeAttritionRates([])).toEqual({ cancelRate: 0, noshowRate: 0 });
  });
  it('compte annulations et no-shows (deux orthographes)', () => {
    const r = computeAttritionRates([
      { status: 'confirmed' }, { status: 'cancelled' }, { status: 'no_show' },
      { status: 'noshow' }, { status: 'confirmed' },
    ]);
    expect(r.cancelRate).toBeCloseTo(1 / 5);
    expect(r.noshowRate).toBeCloseTo(2 / 5);
  });
});

describe('leadTimeFactor', () => {
  it('vaut 0.5 le jour même', () => {
    expect(leadTimeFactor(0)).toBe(0.5);
  });
  it('vaut 1.5 à 30 jours et plafonne au-delà', () => {
    expect(leadTimeFactor(30)).toBe(1.5);
    expect(leadTimeFactor(60)).toBe(1.5);
  });
});

describe('computeForecast', () => {
  it('sans signal = occupation actuelle', () => {
    expect(computeForecast(base)).toBe(60);
  });

  it('intègre la survie après attrition', () => {
    // 60 × (1 − 0.1 − 0.05) = 60 × 0.85 = 51
    const f = computeForecast({ ...base, cancelRate: 0.1, noshowRate: 0.05 });
    expect(f).toBeCloseTo(51, 1);
  });

  it('ajoute la tendance pickup pondérée par le lead time', () => {
    // pickup 5/50 = 10% × leadFactor(15)=1.0 → +10 ; base 60 → 70
    const f = computeForecast({ ...base, pickupRooms: 5, remainingDays: 15 });
    expect(f).toBeCloseTo(70, 1);
  });

  it('applique le boost de compression au-delà de 70%', () => {
    // base 60 + (90−70)×0.15 = 60 + 3 = 63
    const f = computeForecast({ ...base, compressionPercent: 90 });
    expect(f).toBeCloseTo(63, 1);
  });

  it('aucun boost si compression ≤ 70%', () => {
    expect(computeForecast({ ...base, compressionPercent: 70 })).toBe(60);
  });

  it('plafonne à 100', () => {
    const f = computeForecast({ ...base, currentToRate: 95, pickupRooms: 20, remainingDays: 30 });
    expect(f).toBe(100);
  });

  it('plancher à 0', () => {
    const f = computeForecast({ ...base, currentToRate: 5, cancelRate: 0.9, noshowRate: 0.1 });
    expect(f).toBe(0);
  });

  it('pickup null = pas de tendance', () => {
    expect(computeForecast({ ...base, pickupRooms: null, remainingDays: 20 })).toBe(60);
  });
});
