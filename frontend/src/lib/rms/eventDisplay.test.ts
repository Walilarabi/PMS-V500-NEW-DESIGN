/**
 * FLOWTYM RMS — Tests helpers d'affichage Événements.
 *
 * Garantit que `safeImpact` / `normalizeImpact` / `fmtSignedPct` /
 * `safeScore` ne peuvent JAMAIS jeter d'exception, même sur les entrées
 * dégénérées qui faisaient crasher le module Événement en pilote :
 *   - impact absent
 *   - impact null
 *   - impact partiel ({ adr: 10 } seulement)
 *   - impact vide {}
 *   - événement importé incomplet (sans `impact`, `history`, `sources`)
 *   - champs NaN / Infinity / string / bool
 *   - événement entier null
 *
 * Reproduit l'incident métier :
 *   « Cannot read properties of undefined (reading 'compression') »
 *   qui faisait remonter une TypeError jusqu'à l'ErrorBoundary Revenue
 *   et rendait la page Événements inaccessible après une recherche live.
 */
import { describe, expect, it } from 'vitest';
import type { RMSMarketEvent } from '@/src/types/events';
import {
  fmtSignedPct,
  normalizeImpact,
  safeImpact,
  safeScore,
} from './eventDisplay';

function makeEvent(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'evt_test',
    name: 'Test',
    category: 'salon',
    status: 'planned',
    city: 'Paris',
    country: 'FR',
    venue: null,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    impact: {
      level: 'medium',
      demand: 30,
      occupancy: 10,
      adr: 20,
      pickup: 5,
      revpar: 15,
      compression: 40,
      confidence: 80,
    },
    influencePrice: 12,
    sources: ['manual'],
    primarySource: 'manual',
    rmsSynced: false,
    estimatedVisitors: 0,
    history: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as RMSMarketEvent;
}

// ─── safeImpact ──────────────────────────────────────────────────────────────

describe('safeImpact — défense en profondeur', () => {
  it('extrait les valeurs nominales', () => {
    const i = safeImpact(makeEvent());
    expect(i).toEqual({
      level: 'medium',
      demand: 30,
      occupancy: 10,
      adr: 20,
      pickup: 5,
      revpar: 15,
      compression: 40,
      confidence: 80,
    });
  });

  it('event null → defaults sans crash', () => {
    const i = safeImpact(null);
    expect(i.level).toBe('very_low');
    expect(i.demand).toBe(0);
    expect(i.compression).toBe(0);
    expect(i.confidence).toBe(0);
    expect(i.adr).toBeNull();
    expect(i.occupancy).toBeNull();
    expect(i.revpar).toBeNull();
  });

  it('event undefined → defaults sans crash', () => {
    const i = safeImpact(undefined);
    expect(i.level).toBe('very_low');
    expect(i.compression).toBe(0);
  });

  it('impact absent (clé manquante) → defaults', () => {
    const e = makeEvent();
    delete (e as { impact?: unknown }).impact;
    const i = safeImpact(e);
    expect(i.level).toBe('very_low');
    expect(i.compression).toBe(0);
    expect(i.demand).toBe(0);
    expect(i.confidence).toBe(0);
    expect(i.adr).toBeNull();
  });

  it('impact null explicite → defaults', () => {
    const e = makeEvent({ impact: null as unknown as RMSMarketEvent['impact'] });
    const i = safeImpact(e);
    expect(i.level).toBe('very_low');
    expect(i.compression).toBe(0);
  });

  it('impact partiel { adr: 10 } → autres champs en defaults', () => {
    const e = makeEvent({
      impact: { adr: 10 } as unknown as RMSMarketEvent['impact'],
    });
    const i = safeImpact(e);
    expect(i.adr).toBe(10);
    expect(i.level).toBe('very_low');
    expect(i.compression).toBe(0);
    expect(i.confidence).toBe(0);
    expect(i.occupancy).toBeNull();
  });

  it('impact vide {} → tous les defaults sans crash', () => {
    const e = makeEvent({
      impact: {} as unknown as RMSMarketEvent['impact'],
    });
    const i = safeImpact(e);
    expect(i.level).toBe('very_low');
    expect(i.demand).toBe(0);
    expect(i.compression).toBe(0);
    expect(i.adr).toBeNull();
    expect(i.occupancy).toBeNull();
    expect(i.revpar).toBeNull();
  });

  it('événement importé incomplet (sans impact/history/sources) ne crashe pas', () => {
    const partial = {
      id: 'partial',
      name: 'Import Excel ligne 42',
      category: 'salon',
      city: 'Lyon',
      country: 'FR',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      // pas d'impact, pas de history, pas de sources
    } as unknown as RMSMarketEvent;
    expect(() => safeImpact(partial)).not.toThrow();
    const i = safeImpact(partial);
    expect(i.compression).toBe(0);
    expect(i.level).toBe('very_low');
  });

  it('champs NaN / Infinity ramenés à 0 (numériques) ou null (affichage)', () => {
    const e = makeEvent({
      impact: {
        level: 'high',
        demand: Number.NaN,
        occupancy: Number.POSITIVE_INFINITY,
        adr: Number.NEGATIVE_INFINITY,
        pickup: Number.NaN,
        revpar: 0,
        compression: Number.NaN,
        confidence: Number.NaN,
      } as unknown as RMSMarketEvent['impact'],
    });
    const i = safeImpact(e);
    expect(i.level).toBe('high');
    expect(i.demand).toBe(0);
    expect(i.compression).toBe(0);
    expect(i.confidence).toBe(0);
    expect(i.pickup).toBe(0);
    expect(i.occupancy).toBeNull();
    expect(i.adr).toBeNull();
    expect(i.revpar).toBe(0);
  });

  it('level invalide (string libre) → fallback very_low', () => {
    const e = makeEvent({
      impact: { level: 'bogus_level' } as unknown as RMSMarketEvent['impact'],
    });
    expect(safeImpact(e).level).toBe('very_low');
  });

  it('level numérique (mauvais type) → fallback very_low', () => {
    const e = makeEvent({
      impact: { level: 3 } as unknown as RMSMarketEvent['impact'],
    });
    expect(safeImpact(e).level).toBe('very_low');
  });

  it('reproduit le crash original : lecture .compression sur impact absent', () => {
    const e = makeEvent();
    delete (e as { impact?: unknown }).impact;
    // Avant le fix : crash « Cannot read properties of undefined (reading 'compression') »
    expect(() => safeImpact(e).compression).not.toThrow();
    expect(safeImpact(e).compression).toBe(0);
  });
});

// ─── normalizeImpact ─────────────────────────────────────────────────────────

describe('normalizeImpact — ImpactScore complet jamais null', () => {
  it('event partiel → ImpactScore complet avec 0 partout', () => {
    const n = normalizeImpact({} as RMSMarketEvent);
    expect(n).toEqual({
      level: 'very_low',
      demand: 0,
      occupancy: 0,
      adr: 0,
      pickup: 0,
      revpar: 0,
      compression: 0,
      confidence: 0,
    });
  });

  it('event null → ImpactScore complet', () => {
    const n = normalizeImpact(null);
    expect(n.compression).toBe(0);
    expect(n.adr).toBe(0);
  });

  it('event nominal → valeurs préservées', () => {
    const n = normalizeImpact(makeEvent());
    expect(n.compression).toBe(40);
    expect(n.adr).toBe(20);
    expect(n.level).toBe('medium');
  });

  it('aucun champ ne sort jamais null (contrat fort pour le store)', () => {
    const sources = [
      null,
      undefined,
      {},
      { impact: null },
      { impact: {} },
      { impact: { adr: 5 } },
      makeEvent(),
    ];
    for (const s of sources) {
      const n = normalizeImpact(s as RMSMarketEvent);
      expect(typeof n.compression).toBe('number');
      expect(typeof n.adr).toBe('number');
      expect(typeof n.occupancy).toBe('number');
      expect(typeof n.revpar).toBe('number');
      expect(Number.isFinite(n.compression)).toBe(true);
      expect(Number.isFinite(n.adr)).toBe(true);
    }
  });
});

// ─── fmtSignedPct ────────────────────────────────────────────────────────────

describe('fmtSignedPct — tolérance NaN/null/undefined', () => {
  it('formate un nombre positif avec +', () => {
    expect(fmtSignedPct(5)).toBe('+5%');
  });
  it('formate un nombre négatif sans +', () => {
    expect(fmtSignedPct(-3)).toBe('-3%');
  });
  it('retourne « — » sur null', () => {
    expect(fmtSignedPct(null)).toBe('—');
  });
  it('retourne « — » sur undefined', () => {
    expect(fmtSignedPct(undefined)).toBe('—');
  });
  it('retourne « — » sur NaN', () => {
    expect(fmtSignedPct(Number.NaN)).toBe('—');
  });
  it('retourne « — » sur Infinity', () => {
    expect(fmtSignedPct(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('option plus=false : pas de signe sur positif', () => {
    expect(fmtSignedPct(5, false)).toBe('5%');
  });
});

// ─── safeScore ───────────────────────────────────────────────────────────────

describe('safeScore — bornes 0–100', () => {
  it('arrondit à l\'entier', () => {
    expect(safeScore(72.6)).toBe(73);
  });
  it('borne à 100 max', () => {
    expect(safeScore(150)).toBe(100);
  });
  it('borne à 0 min', () => {
    expect(safeScore(-20)).toBe(0);
  });
  it('null → 0', () => {
    expect(safeScore(null)).toBe(0);
  });
  it('undefined → 0', () => {
    expect(safeScore(undefined)).toBe(0);
  });
  it('NaN → 0', () => {
    expect(safeScore(Number.NaN)).toBe(0);
  });
});
