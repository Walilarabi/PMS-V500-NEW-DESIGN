/**
 * FLOWTYM — i18n minimale (sans dépendance externe).
 *
 * Premier jet : `t('key', fallback)` retourne le fallback si la clé n'existe
 * pas dans le dictionnaire actif. Permet de migrer progressivement les
 * chaînes hardcodées vers des clés sans tout réécrire d'un coup.
 *
 * Phase 2 : remplacer par react-i18next quand la traduction EN sera prête.
 */
import { useEffect, useState } from 'react';

export type Locale = 'fr' | 'en';

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = {
  fr: {
    // Settings — actions communes
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.add': 'Ajouter',
    'common.edit': 'Modifier',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement…',
    'common.no_results': 'Aucun résultat',
    // RBAC
    'rbac.denied.title': 'Accès restreint',
    'rbac.denied.description': 'Votre rôle ne dispose pas des permissions requises. Contactez un administrateur.',
    // Settings — navigation
    'settings.search.placeholder': 'Rechercher une page (taxes, langues, RGPD…)',
    'settings.search.shortcut_hint': 'Rechercher',
  },
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.loading': 'Loading…',
    'common.no_results': 'No results',
    'rbac.denied.title': 'Access restricted',
    'rbac.denied.description': 'Your role does not have the required permissions. Contact an administrator.',
    'settings.search.placeholder': 'Search a page (taxes, languages, GDPR…)',
    'settings.search.shortcut_hint': 'Search',
  },
};

const LOCALE_STORAGE_KEY = 'flowtym.locale';
const LOCALE_EVENT = 'flowtym:locale-change';

function readLocale(): Locale {
  if (typeof window === 'undefined') return 'fr';
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'fr';
}

/** Retourne la traduction de `key` ou `fallback` (ou la clé) si absent. */
export function t(key: string, fallback?: string, locale?: Locale): string {
  const effectiveLocale = locale ?? readLocale();
  return DICTIONARIES[effectiveLocale]?.[key] ?? fallback ?? key;
}

/**
 * Hook React : `useT()` retourne `t` réactif à un changement de langue.
 * Le composant se re-render automatiquement sur `setLocale()`.
 */
export function useT(): {
  t: (key: string, fallback?: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
} {
  const [locale, setLocaleState] = useState<Locale>(readLocale);

  useEffect(() => {
    function onChange(e: Event) {
      const next = (e as CustomEvent<Locale>).detail;
      if (next === 'fr' || next === 'en') setLocaleState(next);
    }
    window.addEventListener(LOCALE_EVENT, onChange);
    return () => window.removeEventListener(LOCALE_EVENT, onChange);
  }, []);

  function setLocale(next: Locale) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: next }));
    }
    setLocaleState(next);
  }

  return {
    t: (key: string, fallback?: string) => t(key, fallback, locale),
    locale,
    setLocale,
  };
}

/** Liste des locales supportées (pour les sélecteurs UI). */
export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];
