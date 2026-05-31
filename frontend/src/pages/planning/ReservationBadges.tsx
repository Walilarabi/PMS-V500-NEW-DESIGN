/**
 * FLOWTYM — Badges d'une barre de réservation (maquette #3).
 *
 * Composant présentationnel : reçoit la liste de badges déjà dérivée par le
 * service pur `deriveBadges` et rend des pictogrammes compacts et accessibles.
 *
 * Les badges d'arrivée/départ sont gérés séparément (chevrons sur la barre) ;
 * ce composant rend les badges "attributs" : VIP, paiement, PdJ, groupe,
 * check-in en ligne, notes.
 */
import React from 'react';
import { Star, Check, Euro, Coffee, Users, Smartphone, StickyNote } from 'lucide-react';
import type { BadgeKey } from '@/src/services/planning/planning-reservation-badges.service';

interface BadgeMeta {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  className: string;
}

/** Métadonnées d'affichage par badge (icône, libellé a11y, couleur). */
const BADGE_META: Partial<Record<BadgeKey, BadgeMeta>> = {
  vip: { icon: Star, label: 'Client VIP', className: 'text-amber-500' },
  paid: { icon: Check, label: 'Réservation soldée', className: 'text-emerald-600' },
  unpaid: { icon: Euro, label: 'Solde dû', className: 'text-rose-600' },
  breakfast: { icon: Coffee, label: 'Petit-déjeuner inclus', className: 'text-orange-500' },
  group: { icon: Users, label: 'Réservation de groupe', className: 'text-indigo-600' },
  online: { icon: Smartphone, label: 'Check-in en ligne', className: 'text-sky-600' },
  notes: { icon: StickyNote, label: 'Demandes spéciales', className: 'text-violet-600' },
};

/** Ordre d'affichage stable des badges attributs. */
const ORDER: BadgeKey[] = ['vip', 'paid', 'unpaid', 'breakfast', 'group', 'online', 'notes'];

export function ReservationBadges({
  badges,
  size = 11,
  max,
}: {
  badges: BadgeKey[];
  size?: number;
  /** Nombre maximum de badges affichés (les surplus sont masqués). */
  max?: number;
}) {
  const present = ORDER.filter((k) => badges.includes(k));
  const shown = max != null ? present.slice(0, max) : present;
  if (shown.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 shrink-0" role="group" aria-label="Attributs de la réservation">
      {shown.map((key) => {
        const meta = BADGE_META[key];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span
            key={key}
            className="inline-flex items-center justify-center rounded-full bg-white/85 shadow-sm"
            style={{ width: size + 5, height: size + 5 }}
            title={meta.label}
            aria-label={meta.label}
          >
            <Icon size={size} className={meta.className} />
          </span>
        );
      })}
    </span>
  );
}
