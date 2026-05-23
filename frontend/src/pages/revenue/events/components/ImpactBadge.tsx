/**
 * Premium 5-level impact badge — Flowtym design system.
 *
 * Palette pensée pour le RMS (lisible sur fond clair, pas agressive) :
 *   • critical → rouge corail
 *   • high     → orange ambre
 *   • medium   → ambre doré
 *   • low      → menthe
 *   • very_low → ardoise
 */
import React from 'react';
import { cn } from '@/src/lib/utils';
import type { EventImpactLevel } from '@/src/types/events';
import { IMPACT_LABELS } from '@/src/types/events';

const STYLES: Record<EventImpactLevel, { dot: string; pill: string; text: string }> = {
  critical: {
    dot: 'bg-rose-500',
    pill: 'bg-rose-50 ring-1 ring-inset ring-rose-100',
    text: 'text-rose-700',
  },
  high: {
    dot: 'bg-orange-500',
    pill: 'bg-orange-50 ring-1 ring-inset ring-orange-100',
    text: 'text-orange-700',
  },
  medium: {
    dot: 'bg-amber-400',
    pill: 'bg-amber-50 ring-1 ring-inset ring-amber-100',
    text: 'text-amber-700',
  },
  low: {
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-50 ring-1 ring-inset ring-emerald-100',
    text: 'text-emerald-700',
  },
  very_low: {
    dot: 'bg-slate-300',
    pill: 'bg-slate-50 ring-1 ring-inset ring-slate-100',
    text: 'text-slate-600',
  },
};

export const ImpactBadge: React.FC<{ level: EventImpactLevel; size?: 'sm' | 'md' }> = ({
  level,
  size = 'sm',
}) => {
  const s = STYLES[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tracking-tight',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        s.pill,
        s.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {IMPACT_LABELS[level]}
    </span>
  );
};

export const impactColor = (level: EventImpactLevel): { soft: string; ring: string; bar: string; text: string } => {
  switch (level) {
    case 'critical':
      return { soft: 'bg-rose-50', ring: 'ring-rose-200', bar: 'bg-rose-500', text: 'text-rose-700' };
    case 'high':
      return { soft: 'bg-orange-50', ring: 'ring-orange-200', bar: 'bg-orange-500', text: 'text-orange-700' };
    case 'medium':
      return { soft: 'bg-amber-50', ring: 'ring-amber-200', bar: 'bg-amber-400', text: 'text-amber-700' };
    case 'low':
      return { soft: 'bg-emerald-50', ring: 'ring-emerald-200', bar: 'bg-emerald-400', text: 'text-emerald-700' };
    default:
      return { soft: 'bg-slate-50', ring: 'ring-slate-200', bar: 'bg-slate-300', text: 'text-slate-700' };
  }
};
