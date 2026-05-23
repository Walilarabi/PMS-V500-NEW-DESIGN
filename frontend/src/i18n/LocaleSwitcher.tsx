/**
 * FLOWTYM — Sélecteur de langue compact.
 *
 * Cycle simple FR ↔ EN avec persistance localStorage.
 */
import React from 'react';
import { Globe } from 'lucide-react';
import { useI18nStore, type Locale } from './index';
import { cn } from '@/src/lib/utils';

export interface LocaleSwitcherProps {
  className?: string;
  /** Si true, affiche un label texte à côté de l'icône. */
  showLabel?: boolean;
}

const LABELS: Record<Locale, { short: string; label: string }> = {
  fr: { short: 'FR', label: 'Français' },
  en: { short: 'EN', label: 'English' },
};

export const LocaleSwitcher: React.FC<LocaleSwitcherProps> = ({ className, showLabel }) => {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const next: Locale = locale === 'fr' ? 'en' : 'fr';
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={`Passer en ${LABELS[next].label}`}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#E5E7EB] bg-white text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors',
        className,
      )}
    >
      <Globe size={12} className="text-gray-500" />
      <span>{LABELS[locale].short}</span>
      {showLabel && <span className="text-gray-400">→ {LABELS[next].short}</span>}
    </button>
  );
};
