/**
 * FLOWTYM — Icônes des modèles de communication.
 *
 * Iconographie moderne, minimaliste et épurée (lucide), associée au « type »
 * de modèle plutôt qu'à des emojis. Couleur d'accent par type pour un repère
 * visuel immédiat dans la liste.
 */
import React from 'react';
import {
  CheckCircle2, CalendarClock, KeyRound, Receipt, BellRing, PenLine,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { TemplateKind } from '@/src/services/communication/templates';

const KIND_ICON: Record<TemplateKind, LucideIcon> = {
  confirmation: CheckCircle2,
  pre_arrival: CalendarClock,
  checkin: KeyRound,
  invoice: Receipt,
  reminder: BellRing,
  free: PenLine,
};

/** Classes de pastille (fond + texte) par type — tons doux et épurés. */
export const KIND_BADGE: Record<TemplateKind, string> = {
  confirmation: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  pre_arrival: 'bg-sky-50 text-sky-600 ring-sky-100',
  checkin: 'bg-violet-50 text-violet-600 ring-violet-100',
  invoice: 'bg-amber-50 text-amber-600 ring-amber-100',
  reminder: 'bg-rose-50 text-rose-600 ring-rose-100',
  free: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const KindIcon: React.FC<{ kind: TemplateKind; className?: string }> = ({ kind, className }) => {
  const Icon = KIND_ICON[kind] ?? PenLine;
  return <Icon className={className ?? 'h-4 w-4'} strokeWidth={1.75} />;
};

/** Pastille ronde colorée contenant l'icône du type. */
export const KindBadge: React.FC<{ kind: TemplateKind; size?: 'sm' | 'md' }> = ({ kind, size = 'md' }) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-xl ring-1',
      size === 'md' ? 'h-10 w-10' : 'h-8 w-8',
      KIND_BADGE[kind] ?? KIND_BADGE.free,
    )}
  >
    <KindIcon kind={kind} className={size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
  </span>
);
