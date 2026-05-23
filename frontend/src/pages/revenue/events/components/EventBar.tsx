/**
 * Barre événement utilisée dans la vue calendrier — design premium
 * inspiré Linear/Lighthouse : pastille colorée à gauche, icône catégorie,
 * indicateur RMS, tooltip à survol.
 */
import React from 'react';
import { cn } from '@/src/lib/utils';
import type { RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS } from '@/src/types/events';
import { impactColor } from './ImpactBadge';
import { CATEGORY_ICON } from './CategoryIcon';
import { Sparkles } from 'lucide-react';

interface EventBarProps {
  event: RMSMarketEvent;
  span: number;          // nombre de cellules à occuper
  truncatedLeft?: boolean;
  truncatedRight?: boolean;
  onClick?: () => void;
}

export const EventBar: React.FC<EventBarProps> = ({
  event,
  span,
  truncatedLeft,
  truncatedRight,
  onClick,
}) => {
  const c = impactColor(event.impact.level);
  const Icon = CATEGORY_ICON[event.category];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${event.name} · ${CATEGORY_LABELS[event.category]} · ${event.impact.level}`}
      className={cn(
        'group w-full h-7 px-2 flex items-center gap-1.5 text-left',
        'rounded-md ring-1 ring-inset transition-all',
        'hover:shadow-sm hover:-translate-y-[0.5px]',
        c.soft, c.ring,
        truncatedLeft && 'rounded-l-none border-l-2 border-l-white',
        truncatedRight && 'rounded-r-none',
      )}
      style={{ gridColumn: `span ${span} / span ${span}` }}
    >
      <span className={cn('w-1 h-4 rounded-sm shrink-0', c.bar)} />
      <Icon className={cn('w-3 h-3 shrink-0', c.text)} />
      <span className={cn('text-[11.5px] font-medium truncate', c.text)}>{event.name}</span>
      {event.rmsSynced && (
        <Sparkles
          className={cn('w-3 h-3 ml-auto shrink-0 opacity-70 group-hover:opacity-100', c.text)}
        />
      )}
    </button>
  );
};
