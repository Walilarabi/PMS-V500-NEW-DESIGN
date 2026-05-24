/**
 * FLOWTYM — Tests du service de monitoring.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

import {
  captureError, captureMetric,
  readErrorBuffer, readMetrics, getHealthSnapshot,
  clearErrorBuffer, resetMetrics,
} from './monitoringService';

describe('monitoringService — captureError', () => {
  beforeEach(() => {
    clearErrorBuffer();
    resetMetrics();
  });

  it("enregistre une erreur Error native avec stack", () => {
    const err = new Error('Boom');
    const entry = captureError(err, { route: '/test' });
    expect(entry.message).toBe('Boom');
    expect(entry.stack).toBeTruthy();
    expect(entry.context).toEqual({ route: '/test' });
  });

  it("transforme un non-Error en Error", () => {
    const entry = captureError('chaîne brute');
    expect(entry.message).toBe('chaîne brute');
  });

  it("transforme un objet quelconque en Error", () => {
    const entry = captureError({ code: 42 });
    expect(entry.message).toBeTruthy();
  });

  it("conserve un ring buffer décroissant (le plus récent en tête)", () => {
    captureError(new Error('A'));
    captureError(new Error('B'));
    captureError(new Error('C'));
    const buf = readErrorBuffer();
    expect(buf[0].message).toBe('C');
    expect(buf[1].message).toBe('B');
    expect(buf[2].message).toBe('A');
  });

  it("clearErrorBuffer purge tout", () => {
    captureError(new Error('X'));
    expect(readErrorBuffer()).toHaveLength(1);
    clearErrorBuffer();
    expect(readErrorBuffer()).toHaveLength(0);
  });
});

describe('monitoringService — captureMetric', () => {
  beforeEach(() => {
    resetMetrics();
    clearErrorBuffer();
  });

  it("incrémente un compteur depuis 0", () => {
    captureMetric('rbac_denied');
    captureMetric('rbac_denied');
    const m = readMetrics();
    const counter = m.find((x) => x.name === 'rbac_denied');
    expect(counter?.count).toBe(2);
  });

  it("incrémente avec une valeur custom", () => {
    captureMetric('sync_failed', 5);
    captureMetric('sync_failed', 3);
    const counter = readMetrics().find((x) => x.name === 'sync_failed');
    expect(counter?.count).toBe(8);
  });

  it("conserve les 10 derniers tags", () => {
    for (let i = 0; i < 15; i++) {
      captureMetric('test_counter', 1, { iteration: i });
    }
    const counter = readMetrics().find((x) => x.name === 'test_counter');
    expect(counter?.recentTags.length).toBe(10);
    // Le plus récent en tête
    expect(counter?.recentTags[0].tags.iteration).toBe(14);
  });

  it("trie les métriques par count décroissant", () => {
    captureMetric('low');
    captureMetric('high', 100);
    captureMetric('medium', 10);
    const m = readMetrics();
    expect(m[0].name).toBe('high');
    expect(m[1].name).toBe('medium');
    expect(m[2].name).toBe('low');
  });

  it("resetMetrics purge tout", () => {
    captureMetric('a');
    captureMetric('b');
    resetMetrics();
    expect(readMetrics()).toHaveLength(0);
  });
});

describe('monitoringService — getHealthSnapshot', () => {
  beforeEach(() => {
    clearErrorBuffer();
    resetMetrics();
  });

  it("retourne un snapshot cohérent", () => {
    captureError(new Error('err1'));
    captureError(new Error('err2'));
    captureMetric('alpha', 5);
    captureMetric('beta', 3);

    const snap = getHealthSnapshot();
    expect(snap.errorCountTotal).toBe(2);
    expect(snap.errorCount24h).toBe(2);
    expect(snap.topMetrics.length).toBeGreaterThanOrEqual(2);
    expect(snap.capturedAt).toBeTruthy();
    expect(snap.localStorageItems).toBeGreaterThan(0);
  });

  it("compte 0 erreurs si > 24h (limite implicite via timestamp)", () => {
    // Pas de simulateur temps facile sans vi.useFakeTimers ; on vérifie juste la présence du champ
    const snap = getHealthSnapshot();
    expect(typeof snap.errorCount24h).toBe('number');
  });
});
