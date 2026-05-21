/**
 * FLOWTYM — Comparison Badge
 *
 * Badge premium pour afficher une comparaison vs N-1 / budget / forecast.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface ComparisonBadgeProps {
  current: number;
  baseline: number;
  label?: string;          // ex: "vs N-1"
  unit?: '%' | '€' | 'pts';
  inverse?: boolean;       // true si une baisse est positive (commission, no-show…)
  size?: 'sm' | 'md';
}

export const ComparisonBadge: React.FC<ComparisonBadgeProps> = ({
  current, baseline, label, unit = '%', inverse = false, size = 'md',
}) => {
  if (!baseline || baseline === 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded font-bold',
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
        'bg-gray-100 text-gray-500'
      )}>
        <Minus className="w-3 h-3" />
        {label ? ` ${label}` : ''}
      </span>
    );
  }
  const diff = current - baseline;
  const pct = (diff / Math.abs(baseline)) * 100;
  const isPositive = inverse ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(pct) < 0.5;

  const tone = isNeutral ? 'neutral' : isPositive ? 'positive' : 'negative';
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const colorClass =
    tone === 'positive' ? 'bg-emerald-100 text-emerald-700' :
    tone === 'negative' ? 'bg-red-100 text-red-700' :
    'bg-gray-100 text-gray-600';

  const value = unit === '%'
    ? `${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%`
    : `${diff >= 0 ? '+' : ''}${Math.round(diff)}${unit}`;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded font-bold whitespace-nowrap',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      colorClass
    )}>
      <Icon className="w-3 h-3" />
      {value}
      {label && <span className="opacity-70 ml-0.5">{label}</span>}
    </span>
  );
};
