/**
 * FLOWTYM — i18n léger.
 *
 * Pas de framework externe : un store Zustand + un hook `useT()` qui retourne
 * une fonction de traduction `t(key, params?)` avec interpolation `{name}`.
 *
 * Conventions :
 *   - Locale par défaut : `fr` (cohérent avec le marché initial Flowtym).
 *   - Locale persistée dans localStorage (clé `flowtym.locale`).
 *   - Toute clé manquante retombe sur le FR par défaut, puis affiche la clé.
 */
import { create } from 'zustand';
import { fr } from './messages.fr';
import { en } from './messages.en';
import type { Messages } from './messages.fr';

export type Locale = 'fr' | 'en';

const CATALOGS: Record<Locale, Messages> = { fr, en };

const STORAGE_KEY = 'flowtym.locale';

function loadInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'fr';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {/* ignore */}
  return 'fr';
}

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: loadInitialLocale(),
  setLocale: (locale) => {
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch {/* ignore */}
    set({ locale });
  },
}));

// ─── Path resolver `t('rules.colPriority')` ────────────────────────────────
type PathOf<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${PathOf<T[K]>}`
      : never
  : never;

export type TKey = PathOf<Messages>;

function getDeep(obj: Record<string, unknown>, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as object)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj) as string | undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/**
 * Hook React : retourne la fonction de traduction `t(key, params?)`.
 *
 * Exemples :
 *   t('rules.colPriority')           → "Priorité"
 *   t('common.deleteConfirm', { name: 'Foo' }) → "Confirmer la suppression de « Foo » ?"
 */
export function useT(): (key: TKey, params?: Record<string, string | number>) => string {
  const locale = useI18nStore((s) => s.locale);
  const catalog = CATALOGS[locale] ?? fr;

  return (key, params) => {
    let value = getDeep(catalog as unknown as Record<string, unknown>, key);
    if (value === undefined) {
      // Fallback FR
      value = getDeep(fr as unknown as Record<string, unknown>, key);
    }
    if (value === undefined) return key;
    return interpolate(value, params);
  };
}

/** Version non-hook pour les services qui ont besoin d'un libellé ponctuel. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const { locale } = useI18nStore.getState();
  const catalog = CATALOGS[locale] ?? fr;
  let value = getDeep(catalog as unknown as Record<string, unknown>, key);
  if (value === undefined) {
    value = getDeep(fr as unknown as Record<string, unknown>, key);
  }
  if (value === undefined) return key;
  return interpolate(value, params);
}
