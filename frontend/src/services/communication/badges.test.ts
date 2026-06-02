/**
 * FLOWTYM — Tests du catalogue de badges (normalisation + alias legacy).
 */
import { describe, it, expect } from 'vitest';
import { BADGE_CATALOG, normalizeBadges, badgeDef } from './badges';

describe('normalizeBadges', () => {
  it('retourne [] pour null/undefined/[]', () => {
    expect(normalizeBadges(null)).toEqual([]);
    expect(normalizeBadges(undefined)).toEqual([]);
    expect(normalizeBadges([])).toEqual([]);
  });

  it('conserve les clés canoniques connues', () => {
    expect(normalizeBadges(['vip', 'pmr', 'corporate'])).toEqual(['vip', 'pmr', 'corporate']);
  });

  it('mappe les badges legacy vers les clés canoniques', () => {
    expect(normalizeBadges(['prioritaire'])).toEqual(['attention']);
    expect(normalizeBadges(['nouveau'])).toEqual(['habitue']);
    expect(normalizeBadges(['fidele'])).toEqual(['habitue']);
    expect(normalizeBadges(['incident'])).toEqual(['litige']);
  });

  it('filtre les clés inconnues', () => {
    expect(normalizeBadges(['vip', 'unknown_badge', ''])).toEqual(['vip']);
  });

  it('dédoublonne (y compris après mapping legacy)', () => {
    expect(normalizeBadges(['habitue', 'fidele', 'nouveau'])).toEqual(['habitue']);
    expect(normalizeBadges(['vip', 'vip'])).toEqual(['vip']);
  });
});

describe('badgeDef', () => {
  it('résout une clé canonique', () => {
    expect(badgeDef('vip')?.label).toBe('VIP');
    expect(badgeDef('blacklist')?.label).toBe('Blacklisté');
  });
  it('résout un alias legacy', () => {
    expect(badgeDef('incident')?.key).toBe('litige');
  });
  it('retourne undefined pour l\'inconnu', () => {
    expect(badgeDef('nope')).toBeUndefined();
  });
});

describe('BADGE_CATALOG', () => {
  it('contient les 8 badges métier requis', () => {
    const keys = BADGE_CATALOG.map((b) => b.key);
    expect(keys).toEqual(['vip', 'habitue', 'corporate', 'attention', 'pmr', 'blacklist', 'litige', 'preference']);
  });
  it('chaque badge a label, icône et couleur', () => {
    for (const b of BADGE_CATALOG) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
      expect(b.color).toContain('border');
    }
  });
});
