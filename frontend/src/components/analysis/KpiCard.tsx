/**
 * FLOWTYM — KPI Card uniforme
 *
 * Carte KPI premium réutilisable, 4 variantes de couleur.
 * Supporte comparaison + tendance + sub-info + onClick.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ComparisonBadge } from './ComparisonBadge';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export type KpiTone = 'default' | 'positive' | 'negative' | 'neutral' | 'violet' | 'blue' | 'emerald' | 'amber';

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: KpiTone;
  sub?: string;
  comparison?: {
    baseline: number;
    current: number;
    label?: string;
    unit?: '%' | '€' | 'pts';
    inverse?: boolean;
  };
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const TONE_STYLES: Record<KpiTone, { ring: string; valueColor: string; iconColor: string; iconBg: string }> = {
  default:  { ring: '',                              valueColor: 'text-gray-900',    iconColor: 'text-gray-500',    iconBg: 'bg-gray-100' },
  positive: { ring: 'ring-2 ring-emerald-100',       valueColor: 'text-emerald-700', iconColor: 'text-emerald-500', iconBg: 'bg-emerald-100' },
  negative: { ring: 'ring-2 ring-red-100',           valueColor: 'text-red-700',     iconColor: 'text-red-500',     iconBg: 'bg-red-100' },
  neutral:  { ring: '',                              valueColor: 'text-gray-700',    iconColor: 'text-gray-400',    iconBg: 'bg-gray-100' },
  violet:   { ring: '',                              valueColor: 'text-violet-700',  iconColor: 'text-violet-500',  iconBg: 'bg-violet-100' },
  blue:     { ring: '',                              valueColor: 'text-blue-700',    iconColor: 'text-blue-500',    iconBg: 'bg-blue-100' },
  emerald:  { ring: '',                              valueColor: 'text-emerald-700', iconColor: 'text-emerald-500', iconBg: 'bg-emerald-100' },
  amber:    { ring: '',                              valueColor: 'text-amber-700',   iconColor: 'text-amber-500',   iconBg: 'bg-amber-100' },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, icon: Icon, tone = 'default', sub, comparison, loading, onClick, className,
}) => {
  const styles = TONE_STYLES[tone];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 text-left w-full transition-all',
        styles.ring,
        onClick && 'hover:border-violet-300 hover:shadow-sm cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', styles.iconBg)}>
            <Icon className={cn('w-3.5 h-3.5', styles.iconColor)} />
          </div>
        )}
      </div>
      <div className={cn('text-2xl font-extrabold tabular-nums', styles.valueColor)}>
        {loading ? (
          <span className="inline-block h-6 w-24 bg-gray-100 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5 min-h-[16px]">
        {comparison && !loading && (
          <ComparisonBadge
            current={comparison.current}
            baseline={comparison.baseline}
            label={comparison.label}
            unit={comparison.unit ?? '%'}
            inverse={comparison.inverse}
            size="sm"
          />
        )}
        {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
      </div>
    </Tag>
  );
};
