/**
 * FLOWTYM RMS — Tests Sync Scheduler
 */

import { describe, it, expect } from 'vitest';
import { frequencyToMs, isDueForSync, selectSourcesToSync } from './sync-scheduler';
import type { EventSource } from '../../types/events';

function src(overrides: Partial<EventSource> = {}): EventSource {
  return {
    id: 's',
    city: 'Paris',
    country: 'FR',
    name: 'Source X',
    type: 'salon',
    method: 'api',
    syncFrequency: 'daily',
    status: 'ok',
    reliabilityScore: 90,
    active: true,
    apiAvailable: true,
    priority: 'recommended',
    ...overrides,
  };
}

describe('frequencyToMs', () => {
  it('mappe chaque fréquence en ms', () => {
    expect(frequencyToMs('realtime')).toBe(5 * 60 * 1000);
    expect(frequencyToMs('6h')).toBe(6 * 3600 * 1000);
    expect(frequencyToMs('daily')).toBe(24 * 3600 * 1000);
    expect(frequencyToMs('weekly')).toBe(7 * 24 * 3600 * 1000);
    expect(frequencyToMs('monthly')).toBe(30 * 24 * 3600 * 1000);
    expect(frequencyToMs('manual')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('isDueForSync', () => {
  const NOW = new Date('2026-06-15T12:00:00Z').getTime();

  it('inactive → non', () => {
    expect(isDueForSync(src({ active: false }), NOW)).toBe(false);
  });

  it('manual → jamais', () => {
    expect(isDueForSync(src({ syncFrequency: 'manual' }), NOW)).toBe(false);
  });

  it('jamais syncée → oui', () => {
    expect(isDueForSync(src({ lastSyncAt: undefined }), NOW)).toBe(true);
  });

  it('lastSyncAt invalide → oui', () => {
    expect(isDueForSync(src({ lastSyncAt: 'not-a-date' }), NOW)).toBe(true);
  });

  it('daily syncée il y a 23h → non', () => {
    const last = new Date(NOW - 23 * 3600 * 1000).toISOString();
    expect(isDueForSync(src({ syncFrequency: 'daily', lastSyncAt: last }), NOW)).toBe(false);
  });

  it('daily syncée il y a 25h → oui', () => {
    const last = new Date(NOW - 25 * 3600 * 1000).toISOString();
    expect(isDueForSync(src({ syncFrequency: 'daily', lastSyncAt: last }), NOW)).toBe(true);
  });

  it('6h syncée il y a 7h → oui', () => {
    const last = new Date(NOW - 7 * 3600 * 1000).toISOString();
    expect(isDueForSync(src({ syncFrequency: '6h', lastSyncAt: last }), NOW)).toBe(true);
  });

  it('weekly syncée il y a 3 jours → non', () => {
    const last = new Date(NOW - 3 * 24 * 3600 * 1000).toISOString();
    expect(isDueForSync(src({ syncFrequency: 'weekly', lastSyncAt: last }), NOW)).toBe(false);
  });
});

describe('selectSourcesToSync', () => {
  const NOW = new Date('2026-06-15T12:00:00Z').getTime();

  it('filtre par ville + due + tri par priorité', () => {
    const sources: EventSource[] = [
      src({ id: 'a', city: 'Paris', priority: 'standard', lastSyncAt: undefined }),
      src({ id: 'b', city: 'Paris', priority: 'recommended', lastSyncAt: undefined }),
      src({ id: 'c', city: 'Lyon', priority: 'recommended', lastSyncAt: undefined }), // mauvaise ville
      src({ id: 'd', city: 'Paris', priority: 'optional', lastSyncAt: undefined }),
      src({ id: 'e', city: 'Paris', priority: 'recommended', active: false }),         // inactive
    ];
    const out = selectSourcesToSync({ sources, city: 'Paris', now: NOW });
    // Tri par priorité : recommended → standard → optional
    expect(out.map((s) => s.id)).toEqual(['b', 'a', 'd']);
  });

  it('renvoie liste vide si aucune source due', () => {
    const recent = new Date(NOW - 60_000).toISOString();
    const sources: EventSource[] = [
      src({ id: 'a', city: 'Paris', syncFrequency: 'daily', lastSyncAt: recent }),
      src({ id: 'b', city: 'Paris', syncFrequency: '6h', lastSyncAt: recent }),
    ];
    const out = selectSourcesToSync({ sources, city: 'Paris', now: NOW });
    expect(out).toHaveLength(0);
  });

  it('insensible à la casse de la ville', () => {
    const sources: EventSource[] = [
      src({ id: 'a', city: 'paris', lastSyncAt: undefined }),
      src({ id: 'b', city: 'PARIS', lastSyncAt: undefined }),
    ];
    const out = selectSourcesToSync({ sources, city: 'Paris', now: NOW });
    expect(out).toHaveLength(2);
  });
});
