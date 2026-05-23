/**
 * FLOWTYM — Tests i18n (résolution clés, interpolation, fallback FR, switch locale)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useT, useI18nStore, t } from '@/src/i18n';

describe('i18n', () => {
  beforeEach(() => {
    // Reset à FR par défaut entre les tests
    useI18nStore.getState().setLocale('fr');
  });

  it('retourne une clé FR par défaut', () => {
    const { result } = renderHook(() => useT());
    expect(result.current('rules.title')).toBe('Règles tactiques');
    expect(result.current('common.save')).toBe('Enregistrer');
  });

  it('switch vers EN et retraduit', () => {
    const { result } = renderHook(() => useT());
    act(() => useI18nStore.getState().setLocale('en'));
    expect(result.current('rules.title')).toBe('Tactical Rules');
    expect(result.current('common.save')).toBe('Save');
  });

  it('interpolation {name} fonctionne', () => {
    const { result } = renderHook(() => useT());
    const out = result.current('common.deleteConfirm', { name: 'TestRule' });
    expect(out).toContain('TestRule');
  });

  it('retombe sur la clé si introuvable', () => {
    const { result } = renderHook(() => useT());
    // @ts-expect-error : clé invalide volontairement
    const out = result.current('inexistant.cle');
    expect(out).toBe('inexistant.cle');
  });

  it('helper t() (non-hook) lit la locale actuelle du store', () => {
    useI18nStore.getState().setLocale('fr');
    expect(t('common.save')).toBe('Enregistrer');
    useI18nStore.getState().setLocale('en');
    expect(t('common.save')).toBe('Save');
  });

  it('catalogue EN possède toutes les clés FR (structure miroir)', async () => {
    const { fr } = await import('@/src/i18n/messages.fr');
    const { en } = await import('@/src/i18n/messages.en');
    // Compare structures clé-à-clé au niveau racine + un niveau de namespace
    for (const ns of Object.keys(fr) as Array<keyof typeof fr>) {
      expect(en).toHaveProperty(ns);
      for (const key of Object.keys(fr[ns])) {
        expect(en[ns], `EN.${ns} missing key "${key}"`).toHaveProperty(key);
      }
    }
  });
});
