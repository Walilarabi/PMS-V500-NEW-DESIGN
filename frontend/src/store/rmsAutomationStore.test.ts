/**
 * FLOWTYM RMS — Tests rmsAutomationStore.
 *
 * Couvre les fonctions utilitaires exposées par le store (sans rendu) :
 *   - evaluateActivation : pas de crash sur config dégradée
 *   - Vérifie les AUTOMATION_LEVELS (UI lit `.find(...)!`)
 *
 * Préserve la cohérence métier de l'Autopilote — les bugs ici se
 * traduisent par un crash de la page entière (React #185 quand
 * activationState devient instable).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({
  supabase: {},
  getSupabase: () => ({}),
}));

import {
  evaluateActivation,
  AUTOMATION_LEVELS,
  type ActivationConfig,
  type ActivationContext,
  type AutomationLevel,
} from './rmsAutomationStore';

function ctx(overrides: Partial<ActivationContext> = {}): ActivationContext {
  return {
    now: new Date('2026-05-15T14:30:00.000Z'),
    isWeekend: false,
    isHoliday: false,
    rmAbsent: false,
    isHighSeason: false,
    isHighDemand: false,
    ...overrides,
  };
}

describe('evaluateActivation — pas de crash', () => {
  it('mode=always est toujours actif', () => {
    const cfg: ActivationConfig = {
      mode: 'always',
      schedule: { start: '08:00', end: '20:00' },
      periods: { weekends: true, holidays: true, rmAbsence: true, night: true, highSeason: false, highDemand: true },
    };
    const r = evaluateActivation(cfg, ctx());
    expect(r.active).toBe(true);
    expect(r.reason).toMatch(/24h\/24/);
  });

  it('mode=scheduled actif quand l\'heure est dans le créneau', () => {
    const cfg: ActivationConfig = {
      mode: 'scheduled',
      schedule: { start: '08:00', end: '20:00' },
      periods: { weekends: true, holidays: true, rmAbsence: true, night: true, highSeason: false, highDemand: true },
    };
    // 14:30 entre 08:00 et 20:00
    const r = evaluateActivation(cfg, ctx({ now: new Date('2026-05-15T14:30:00') }));
    expect(r.active).toBe(true);
  });

  it('mode=scheduled inactif quand l\'heure est hors du créneau', () => {
    const cfg: ActivationConfig = {
      mode: 'scheduled',
      schedule: { start: '08:00', end: '20:00' },
      periods: { weekends: true, holidays: true, rmAbsence: true, night: true, highSeason: false, highDemand: true },
    };
    // 22:30 hors plage
    const r = evaluateActivation(cfg, ctx({ now: new Date('2026-05-15T22:30:00') }));
    expect(r.active).toBe(false);
  });

  it('mode=scheduled gère un créneau qui chevauche minuit (22:00 → 06:00)', () => {
    const cfg: ActivationConfig = {
      mode: 'scheduled',
      schedule: { start: '22:00', end: '06:00' },
      periods: { weekends: false, holidays: false, rmAbsence: false, night: false, highSeason: false, highDemand: false },
    };
    // 02:00 dans le créneau de nuit
    const r1 = evaluateActivation(cfg, ctx({ now: new Date('2026-05-15T02:00:00') }));
    expect(r1.active).toBe(true);
    // 12:00 hors créneau
    const r2 = evaluateActivation(cfg, ctx({ now: new Date('2026-05-15T12:00:00') }));
    expect(r2.active).toBe(false);
  });

  it('mode=periods actif sur week-end si configuré', () => {
    const cfg: ActivationConfig = {
      mode: 'periods',
      schedule: { start: '20:00', end: '08:00' },
      periods: { weekends: true, holidays: false, rmAbsence: false, night: false, highSeason: false, highDemand: false },
    };
    const r = evaluateActivation(cfg, ctx({ isWeekend: true }));
    expect(r.active).toBe(true);
    expect(r.reason).toMatch(/week-end/);
  });

  it('mode=periods inactif sans aucune période remplie', () => {
    const cfg: ActivationConfig = {
      mode: 'periods',
      schedule: { start: '20:00', end: '08:00' },
      periods: { weekends: true, holidays: true, rmAbsence: true, night: false, highSeason: false, highDemand: false },
    };
    // jour de semaine, jour, RM présent, pas de saison, pas de demande forte
    const r = evaluateActivation(cfg, ctx({ now: new Date('2026-05-15T14:30:00') }));
    expect(r.active).toBe(false);
  });

  it('mode=periods cumule les triggers actifs dans la raison', () => {
    const cfg: ActivationConfig = {
      mode: 'periods',
      schedule: { start: '20:00', end: '08:00' },
      periods: { weekends: true, holidays: true, rmAbsence: false, night: false, highSeason: true, highDemand: true },
    };
    const r = evaluateActivation(cfg, ctx({ isWeekend: true, isHighDemand: true }));
    expect(r.active).toBe(true);
    expect(r.reason).toMatch(/week-end/);
    expect(r.reason).toMatch(/demande/);
  });
});

describe('AUTOMATION_LEVELS — invariants UI', () => {
  it('définit exactement 4 niveaux (1, 2, 3, 4)', () => {
    expect(AUTOMATION_LEVELS).toHaveLength(4);
    const levels = AUTOMATION_LEVELS.map((l) => l.level).sort();
    expect(levels).toEqual([1, 2, 3, 4]);
  });

  it('chaque niveau a name + description (UI les lit obligatoirement)', () => {
    AUTOMATION_LEVELS.forEach((l) => {
      expect(l.name).toBeTruthy();
      expect(l.description).toBeTruthy();
      expect(l.short).toBeTruthy();
    });
  });

  it('AUTOMATION_LEVELS.find((l) => l.level === N) ne retourne JAMAIS undefined pour N ∈ [1..4]', () => {
    // C'est ce que fait `AutopilotPage.tsx` avec `!` non-null assertion.
    // Si le find retourne undefined, la page crash.
    const validLevels: AutomationLevel[] = [1, 2, 3, 4];
    validLevels.forEach((n) => {
      const found = AUTOMATION_LEVELS.find((l) => l.level === n);
      expect(found).toBeDefined();
    });
  });
});
