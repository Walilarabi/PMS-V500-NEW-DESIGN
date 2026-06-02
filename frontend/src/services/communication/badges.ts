/**
 * FLOWTYM — Catalogue canonique des badges client.
 *
 * Source de vérité partagée entre la modal Flowday, la persistance (RPC
 * set_guest_badges) et l'affichage (Planning, fiche réservation, CRM).
 * Les clés sont stockées telles quelles dans guests.badges (text[]).
 */

export type BadgeKey =
  | 'vip'
  | 'habitue'
  | 'corporate'
  | 'attention'
  | 'pmr'
  | 'blacklist'
  | 'litige'
  | 'preference';

export interface BadgeDef {
  key: BadgeKey;
  label: string;
  icon: string;
  /** Classes Tailwind pour l'état sélectionné. */
  color: string;
  /** Classes Tailwind pour un chip compact (affichage liste). */
  chip: string;
  description: string;
}

export const BADGE_CATALOG: BadgeDef[] = [
  { key: 'vip',        label: 'VIP',                   icon: '👑', color: 'bg-amber-50 text-amber-600 border-amber-200',     chip: 'bg-amber-100 text-amber-700',   description: 'Client prioritaire, attentions spéciales' },
  { key: 'habitue',    label: 'Client habitué',        icon: '🔁', color: 'bg-violet-50 text-violet-600 border-violet-200',   chip: 'bg-violet-100 text-violet-700', description: 'Revient régulièrement' },
  { key: 'corporate',  label: 'Corporate',             icon: '🏢', color: 'bg-sky-50 text-sky-600 border-sky-200',           chip: 'bg-sky-100 text-sky-700',       description: 'Compte entreprise / société' },
  { key: 'attention',  label: 'Attention particulière', icon: '⚠️', color: 'bg-orange-50 text-orange-600 border-orange-200', chip: 'bg-orange-100 text-orange-700', description: 'Nécessite un suivi attentif' },
  { key: 'pmr',        label: 'PMR',                   icon: '♿', color: 'bg-teal-50 text-teal-600 border-teal-200',         chip: 'bg-teal-100 text-teal-700',     description: 'Mobilité réduite — chambre adaptée' },
  { key: 'blacklist',  label: 'Blacklisté',            icon: '⛔', color: 'bg-red-50 text-red-600 border-red-200',           chip: 'bg-red-100 text-red-700',       description: 'Refus de réservation' },
  { key: 'litige',     label: 'Litige',                icon: '⚖️', color: 'bg-rose-50 text-rose-600 border-rose-200',        chip: 'bg-rose-100 text-rose-700',     description: 'Différend en cours' },
  { key: 'preference', label: 'Préférence chambre',    icon: '🛏️', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', chip: 'bg-emerald-100 text-emerald-700', description: 'Préférences de chambre enregistrées' },
];

const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.key, b]),
);

/** Alias des badges legacy (ancien BadgeType Flowday) vers les clés canoniques. */
const LEGACY_ALIASES: Record<string, BadgeKey> = {
  prioritaire: 'attention',
  nouveau: 'habitue',
  fidele: 'habitue',
  incident: 'litige',
};

/** Normalise une liste de clés (filtre l'inconnu, mappe le legacy, dédoublonne). */
export function normalizeBadges(raw: readonly string[] | null | undefined): BadgeKey[] {
  if (!raw) return [];
  const out = new Set<BadgeKey>();
  for (const r of raw) {
    const k = (BADGE_BY_KEY[r] ? r : LEGACY_ALIASES[r]) as BadgeKey | undefined;
    if (k) out.add(k);
  }
  return [...out];
}

export function badgeDef(key: string): BadgeDef | undefined {
  return BADGE_BY_KEY[key] ?? (LEGACY_ALIASES[key] ? BADGE_BY_KEY[LEGACY_ALIASES[key]] : undefined);
}
