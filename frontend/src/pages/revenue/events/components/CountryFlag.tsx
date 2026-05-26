/**
 * CountryFlag — drapeau pays haute qualité.
 *
 * Source : flagcdn.com (PNG officiels, libres, CDN edge mondial).
 * Format : flagcdn.com/w{size}/{iso2}.png  → 20, 40, 80, 160…
 *
 * Tente d'abord le code ISO-3166-1 alpha-2 (FR, DE, GB…) ; si la prop
 * `code` est un nom de pays français ("France", "Allemagne"…) on tente
 * une normalisation via la table COUNTRY_CODE_BY_NAME.
 */
import React from 'react';
import { cn } from '@/src/lib/utils';

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  france: 'fr',         allemagne: 'de',     germany: 'de',
  'royaume-uni': 'gb',  'royaume uni': 'gb', uk: 'gb',          'united kingdom': 'gb',
  espagne: 'es',        spain: 'es',
  italie: 'it',         italy: 'it',
  belgique: 'be',       belgium: 'be',
  suisse: 'ch',         switzerland: 'ch',
  'pays-bas': 'nl',     'pays bas': 'nl',    netherlands: 'nl',
  autriche: 'at',       austria: 'at',
  portugal: 'pt',
  luxembourg: 'lu',
  'états-unis': 'us',   'etats-unis': 'us',  'united states': 'us', usa: 'us',
  canada: 'ca',
  japon: 'jp',          japan: 'jp',
  chine: 'cn',          china: 'cn',
  'corée du sud': 'kr', korea: 'kr',
  brésil: 'br',         brazil: 'br',
  mexique: 'mx',        mexico: 'mx',
  irlande: 'ie',        ireland: 'ie',
  danemark: 'dk',       denmark: 'dk',
  suède: 'se',          sweden: 'se',
  norvège: 'no',        norway: 'no',
  finlande: 'fi',       finland: 'fi',
  pologne: 'pl',        poland: 'pl',
  grèce: 'gr',          greece: 'gr',
  turquie: 'tr',        turkey: 'tr',
  maroc: 'ma',          morocco: 'ma',
  tunisie: 'tn',        tunisia: 'tn',
  algérie: 'dz',        algeria: 'dz',
  émirats: 'ae',        'émirats arabes unis': 'ae', uae: 'ae',
  australie: 'au',      australia: 'au',
};

const SIZE_PX = {
  xs: 16,   // table cell inline
  sm: 20,   // chip / filter
  md: 28,   // panel item
  lg: 40,   // header / dialog
} as const;

const SIZE_CDN = {
  xs: 'w20',
  sm: 'w40',
  md: 'w40',
  lg: 'w80',
} as const;

export type FlagSize = keyof typeof SIZE_PX;

interface CountryFlagProps {
  /** ISO-3166-1 alpha-2 ("FR") OR French/English name ("France", "Germany"). */
  code: string;
  size?: FlagSize;
  /** Override pour le label accessibility / tooltip ; défaut : le code reçu. */
  label?: string;
  className?: string;
  /** Affiche le nom du pays à côté du drapeau. */
  withLabel?: boolean;
  rounded?: boolean;
}

function normalizeCode(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toLowerCase();
  return COUNTRY_CODE_BY_NAME[trimmed.toLowerCase()] ?? null;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  code,
  size = 'sm',
  label,
  className,
  withLabel = false,
  rounded = true,
}) => {
  const iso = normalizeCode(code);
  const px = SIZE_PX[size];
  const cdn = SIZE_CDN[size];

  if (!iso) {
    return (
      <span
        aria-label={label ?? code}
        title={label ?? code}
        className={cn(
          'inline-flex items-center justify-center bg-slate-100 text-slate-400 text-[9px] font-bold uppercase tracking-tighter ring-1 ring-slate-200',
          rounded && 'rounded-sm',
          className,
        )}
        style={{ width: px * 1.4, height: px }}
      >
        {(code || '??').slice(0, 2)}
      </span>
    );
  }

  const src   = `https://flagcdn.com/${cdn}/${iso}.png`;
  const src2x = `https://flagcdn.com/${SIZE_CDN.lg}/${iso}.png`;

  const img = (
    <img
      src={src}
      srcSet={`${src} 1x, ${src2x} 2x`}
      alt={label ?? iso.toUpperCase()}
      title={label ?? iso.toUpperCase()}
      loading="lazy"
      decoding="async"
      width={Math.round(px * 1.4)}
      height={px}
      className={cn(
        'object-cover shrink-0 ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        rounded && 'rounded-sm',
        className,
      )}
      style={{ width: Math.round(px * 1.4), height: px }}
    />
  );

  if (!withLabel) return img;

  return (
    <span className="inline-flex items-center gap-1.5">
      {img}
      <span className="text-[12px] text-slate-700">{label ?? iso.toUpperCase()}</span>
    </span>
  );
};
