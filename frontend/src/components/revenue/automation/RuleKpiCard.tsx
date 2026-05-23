/**
 * FLOWTYM — KPI card pour Règles tactiques
 * Carte premium clair avec valeur, label, sparkline / accent et icône optionnelle.
 */
import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface RuleKpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;       // ex: 'text-emerald-500'
  trend?: number[];
  trendColor?: string;      // ex: '#8B5CF6'
  badge?: React.ReactNode;
  className?: string;
}

const TINY_DATA_KEY = 'v';

export const RuleKpiCard: React.FC<RuleKpiCardProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  iconColor,
  trend,
  trendColor = '#8B5CF6',
  badge,
  className,
}) => {
  const data = trend?.map((v) => ({ [TINY_DATA_KEY]: v }));
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2 min-w-0',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-500 truncate">{label}</span>
        {Icon && (
          <Icon size={16} className={cn('shrink-0', iconColor ?? 'text-gray-400')} strokeWidth={2} />
        )}
        {badge && !Icon && badge}
      </div>

      <div className="flex items-end justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-[28px] font-bold text-gray-900 leading-tight truncate">{value}</div>
          {hint && <div className="text-[12px] text-gray-500 mt-1 leading-snug">{hint}</div>}
        </div>
        {data && data.length > 1 && (
          <div className="w-[100px] h-10 shrink-0 opacity-90">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey={TINY_DATA_KEY}
                  stroke={trendColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
