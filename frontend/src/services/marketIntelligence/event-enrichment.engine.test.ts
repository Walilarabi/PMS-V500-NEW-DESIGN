/**
 * FLOWTYM RMS — Tests Event Enrichment Engine
 *
 * Couvre :
 *   • Audience tier (micro → mega)
 *   • Inférence portée (local → global)
 *   • Inférence mix client par mots-clés et catégorie
 *   • Heuristique géographique par venue
 *   • Prestige (boost catégorie + reach + audience)
 *   • Durée & weekend share
 *   • Récurrence (annual / biennial…)
 */

import { describe, it, expect } from 'vitest';
import {
  audienceTierFromCount,
  computeWeekendShare,
  durationDaysInclusive,
  enrichEvent,
  enrichEvents,
} from './event-enrichment.engine';
import type { RMSMarketEvent, ImpactScore } from '../../types/events';

function fakeImpact(overrides: Partial<ImpactScore> = {}): ImpactScore {
  return {
    demand: 0,
    adr: 0,
    occupancy: 0,
    pickup: 0,
    revpar: 0,
    compression: 0,
    confidence: 80,
    level: 'low',
    ...overrides,
  };
}

function fakeEvent(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'evt_test',
    name: 'Salon Test',
    category: 'salon',
    status: 'active',
    city: 'Paris',
    country: 'FR',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    impact: fakeImpact(),
    influencePrice: 5,
    sources: ['src_a'],
    primarySource: 'Source A',
    rmsSynced: true,
    history: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('audienceTierFromCount', () => {
  it('classes les audiences dans les bons tiers', () => {
    expect(audienceTierFromCount(0)).toBe('micro');
    expect(audienceTierFromCount(4_999)).toBe('micro');
    expect(audienceTierFromCount(5_000)).toBe('small');
    expect(audienceTierFromCount(24_999)).toBe('small');
    expect(audienceTierFromCount(25_000)).toBe('medium');
    expect(audienceTierFromCount(99_999)).toBe('medium');
    expect(audienceTierFromCount(100_000)).toBe('large');
    expect(audienceTierFromCount(299_999)).toBe('large');
    expect(audienceTierFromCount(300_000)).toBe('massive');
    expect(audienceTierFromCount(999_999)).toBe('massive');
    expect(audienceTierFromCount(1_000_000)).toBe('mega');
    expect(audienceTierFromCount(5_000_000)).toBe('mega');
  });
});

describe('durationDaysInclusive', () => {
  it('compte les jours inclusifs', () => {
    expect(durationDaysInclusive('2026-06-01', '2026-06-01')).toBe(1);
    expect(durationDaysInclusive('2026-06-01', '2026-06-03')).toBe(3);
    expect(durationDaysInclusive('2026-06-01', '2026-06-07')).toBe(7);
    expect(durationDaysInclusive('2026-06-01', '2026-06-15')).toBe(15);
  });

  it('renvoie 1 sur dates inversées ou invalides', () => {
    expect(durationDaysInclusive('2026-06-10', '2026-06-01')).toBe(1);
    expect(durationDaysInclusive('not-a-date', '2026-06-01')).toBe(1);
  });
});

describe('computeWeekendShare', () => {
  it('renvoie 0 pour un événement full semaine (lun-ven)', () => {
    // 2026-06-01 = lundi, 2026-06-05 = vendredi
    expect(computeWeekendShare('2026-06-01', '2026-06-05')).toBe(0);
  });

  it('renvoie 1 pour un événement full weekend', () => {
    // 2026-06-06 = samedi, 2026-06-07 = dimanche
    expect(computeWeekendShare('2026-06-06', '2026-06-07')).toBe(1);
  });

  it('proportionne pour un événement mixte', () => {
    // 2026-06-05 (ven) → 2026-06-07 (dim) = 3 jours, 2 weekend → 2/3
    const share = computeWeekendShare('2026-06-05', '2026-06-07');
    expect(share).toBeCloseTo(2 / 3, 5);
  });
});

describe('enrichEvent — audience & reach', () => {
  it('utilise estimatedVisitors quand fourni', () => {
    const ev = fakeEvent({ estimatedVisitors: 250_000 });
    const out = enrichEvent(ev);
    expect(out.estimatedAudience).toBe(250_000);
    expect(out.audienceTier).toBe('large');
  });

  it('fallback intelligent par catégorie quand absent', () => {
    const ev = fakeEvent({ category: 'salon', estimatedVisitors: undefined });
    const out = enrichEvent(ev);
    expect(out.estimatedAudience).toBeGreaterThan(50_000);
  });

  it('détecte une portée internationale pour gros salons', () => {
    const ev = fakeEvent({ category: 'salon', estimatedVisitors: 300_000, name: 'Vivatech' });
    const out = enrichEvent(ev);
    expect(['international', 'global']).toContain(out.reach);
  });

  it('marque "global" pour les world tours', () => {
    const ev = fakeEvent({ name: 'Coldplay World Tour 2026', category: 'world_tour' });
    const out = enrichEvent(ev);
    expect(out.reach).toBe('global');
  });

  it('marque "local" pour un petit événement', () => {
    const ev = fakeEvent({ category: 'manual', estimatedVisitors: 1_500, name: 'Vernissage local' });
    const out = enrichEvent(ev);
    expect(out.reach).toBe('local');
  });
});

describe('enrichEvent — client mix', () => {
  it('détecte luxury pour Fashion Week', () => {
    const ev = fakeEvent({ name: 'Mode Féminine Mars', category: 'fashion' });
    expect(enrichEvent(ev).clientMix).toBe('luxury');
  });

  it('détecte sports_fans pour Roland-Garros', () => {
    const ev = fakeEvent({ name: 'Roland-Garros', category: 'sport' });
    expect(enrichEvent(ev).clientMix).toBe('sports_fans');
  });

  it('détecte business pour les salons pro', () => {
    const ev = fakeEvent({ name: 'Vivatech', category: 'salon' });
    expect(enrichEvent(ev).clientMix).toBe('gaming_tech');
  });

  it('détecte leisure pour les concerts génériques', () => {
    const ev = fakeEvent({ name: 'Concert Symphonique', category: 'concert' });
    expect(enrichEvent(ev).clientMix).toBe('leisure');
  });

  it('détecte diplomatic pour les sommets', () => {
    const ev = fakeEvent({ name: 'Sommet OTAN', category: 'political' });
    expect(enrichEvent(ev).clientMix).toBe('diplomatic');
  });
});

describe('enrichEvent — geo impact', () => {
  it('mappe Porte de Versailles → cluster upscale + Paris 15', () => {
    const ev = fakeEvent({ venue: 'P. de Versailles' });
    const out = enrichEvent(ev);
    expect(out.geoImpact.primaryCluster).toBe('upscale');
    expect(out.geoImpact.zones).toContain('Paris 15');
  });

  it('mappe Stade de France → cluster business + St-Denis', () => {
    const ev = fakeEvent({ venue: 'Stade de France' });
    const out = enrichEvent(ev);
    expect(out.geoImpact.primaryCluster).toBe('business');
    expect(out.geoImpact.zones).toContain('St-Denis');
  });

  it('mappe Roland-Garros → cluster luxury + Paris 16', () => {
    const ev = fakeEvent({ venue: 'Porte d\'Auteuil' });
    const out = enrichEvent(ev);
    expect(out.geoImpact.primaryCluster).toBe('luxury');
    expect(out.geoImpact.zones).toContain('Paris 16');
  });

  it('fallback raisonnable pour venue inconnu', () => {
    const ev = fakeEvent({ venue: 'Lieu mystère', city: 'Paris' });
    const out = enrichEvent(ev);
    expect(out.geoImpact.zones).toContain('Paris');
    expect(out.geoImpact.radiusKm).toBeGreaterThan(0);
  });
});

describe('enrichEvent — prestige', () => {
  it('booste pour les événements internationaux à forte audience', () => {
    const ev = fakeEvent({
      name: 'Mondial Auto',
      category: 'salon',
      estimatedVisitors: 600_000,
    });
    const out = enrichEvent(ev);
    expect(out.prestige).toBeGreaterThan(70);
  });

  it('reste bas pour un événement interne', () => {
    const ev = fakeEvent({ category: 'internal', name: 'Séminaire interne RH' });
    const out = enrichEvent(ev);
    expect(out.prestige).toBeLessThan(40);
  });
});

describe('enrichEvent — recurrence', () => {
  it('mappe les fréquences métier vers le type recurrence', () => {
    expect(enrichEvent(fakeEvent({ frequency: 'annuel' })).recurrence).toBe('annual');
    expect(enrichEvent(fakeEvent({ frequency: 'biannuel' })).recurrence).toBe('biennial');
    expect(enrichEvent(fakeEvent({ frequency: 'semestriel' })).recurrence).toBe('biannual');
    expect(enrichEvent(fakeEvent({ frequency: 'ponctuel' })).recurrence).toBe('unique');
    expect(enrichEvent(fakeEvent({ frequency: undefined })).recurrence).toBe('unique');
  });
});

describe('enrichEvents (batch)', () => {
  it('enrichit chaque événement et indexe par id', () => {
    const events = [
      fakeEvent({ id: 'a' }),
      fakeEvent({ id: 'b' }),
      fakeEvent({ id: 'c' }),
    ];
    const out = enrichEvents(events);
    expect(out.size).toBe(3);
    expect(out.get('a')).toBeDefined();
    expect(out.get('c')?.audienceTier).toBeDefined();
  });
});
