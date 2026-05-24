/**
 * FLOWTYM — Tests i18n minimale.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { t, SUPPORTED_LOCALES } from './i18n';

describe('i18n.t', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("retourne la traduction française par défaut", () => {
    expect(t('common.save')).toBe('Enregistrer');
    expect(t('common.cancel')).toBe('Annuler');
  });

  it("retourne la traduction anglaise quand locale='en'", () => {
    expect(t('common.save', undefined, 'en')).toBe('Save');
    expect(t('common.delete', undefined, 'en')).toBe('Delete');
  });

  it("retourne le fallback si la clé n'existe pas", () => {
    expect(t('inconnu.cle', 'Fallback')).toBe('Fallback');
  });

  it("retourne la clé elle-même si pas de fallback ni de traduction", () => {
    expect(t('inconnu.cle')).toBe('inconnu.cle');
  });

  it("respecte le localStorage flowtym.locale", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('flowtym.locale', 'en');
    expect(t('common.save')).toBe('Save');
  });

  it("ignore les valeurs invalides de locale", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('flowtym.locale', 'jp');
    // jp n'est pas supporté → fallback fr
    expect(t('common.save')).toBe('Enregistrer');
  });
});

describe('SUPPORTED_LOCALES', () => {
  it("contient au moins fr et en", () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(codes).toContain('fr');
    expect(codes).toContain('en');
  });

  it("a un label et un flag par locale", () => {
    SUPPORTED_LOCALES.forEach((l) => {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.flag.length).toBeGreaterThan(0);
    });
  });
});
