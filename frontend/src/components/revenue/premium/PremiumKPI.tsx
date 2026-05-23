/**
 * FLOWTYM — Premium KPI Card
 *
 * Carte KPI ultra-moderne pour les modules Revenue (Promotions, Distribution, etc.).
 * Inclut sparkline, badge tendance, animation d'apparition douce, gradient subtil.
 */
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/src/lib/utils';

export type KPITone =
  | 'violet'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'slate';

const TONE: Record<
  KPITone,
  { iconBg: string; iconColor: string; stroke: string; fillFrom: string; chip: string }
> = {
  violet: {
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    stroke: '#8B5CF6',
    fillFrom: '#8B5CF6',
    chip: 'text-violet-700 bg-violet-50',
  },
  emerald: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    stroke: '#10B981',
    fillFrom: '#10B981',
    chip: 'text-emerald-700 bg-emerald-50',
  },
  sky: {
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    stroke: '#0EA5E9',
    fillFrom: '#0EA5E9',
    chip: 'text-sky-700 bg-sky-50',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    stroke: '#F59E0B',
    fillFrom: '#F59E0B',
    chip: 'text-amber-700 bg-amber-50',
  },
  rose: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    stroke: '#F43F5E',
    fillFrom: '#F43F5E',
    chip: 'text-rose-700 bg-rose-50',
  },
  indigo: {
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    stroke: '#6366F1',
    fillFrom: '#6366F1',
    chip: 'text-indigo-700 bg-indigo-50',
  },
  slate: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    stroke: '#64748B',
    fillFrom: '#64748B',
    chip: 'text-slate-700 bg-slate-100',
  },
};

export interface PremiumKPIProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  tone?: KPITone;
  delta?: number;
  deltaLabel?: string;
  invertDelta?: boolean;
  sparkline?: number[];
  hint?: string;
  index?: number;
}

export const PremiumKPI: React.FC<PremiumKPIProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'violet',
  delta,
  deltaLabel,
  invertDelta = false,
  sparkline,
  hint,
  index = 0,
}) => {
  const palette = TONE[tone];

  const deltaPositive = delta !== undefined && delta > 0;
  const deltaNegative = delta !== undefined && delta < 0;
  const isGood = invertDelta ? deltaNegative : deltaPositive;
  const isBad = invertDelta ? deltaPositive : deltaNegative;

  const deltaTone =
    delta === undefined || delta === 0
      ? 'text-slate-500 bg-slate-100'
      : isGood
        ? 'text-emerald-700 bg-emerald-50'
        : isBad
          ? 'text-rose-700 bg-rose-50'
          : 'text-slate-500 bg-slate-100';

  // ⚠️ useMemo OBLIGATOIRE — sinon `(sparkline ?? []).map(...)` crée un
  // NOUVEAU tableau à chaque render → Recharts AreaChart entre en boucle
  // infinie via son ChartDataContextProvider (useSyncExternalStore interne).
  // C'est la cause du crash « Cannot assign to read only property '0' »
  // observé sur Distribution & OTA.
  const chartData = useMemo(
    () => (sparkline ?? []).map((v, i) => ({ i, v })),
    [sparkline],
  );
  const gradientId = `kpi-grad-${label.replace(/\s/g, '')}-${index}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        'transition-shadow duration-300'
      )}
    >
      {/* Halo top accent */}
      <div
        aria-hidden
        className="absolute -top-12 -right-10 h-32 w-32 rounded-full opacity-[0.08] blur-2xl"
        style={{ background: palette.stroke }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl',
                palette.iconBg
              )}
            >
              <Icon className={cn('h-4 w-4', palette.iconColor)} strokeWidth={2.2} />
            </div>
            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-none text-slate-900 tabular-nums">
              {value}
            </span>
            {unit && (
              <span className="text-sm font-semibold text-slate-400">{unit}</span>
            )}
          </div>

          {(delta !== undefined || hint) && (
            <div className="mt-2 flex items-center gap-2">
              {delta !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    deltaTone
                  )}
                >
                  {delta === 0 ? (
                    <Minus className="h-3 w-3" />
                  ) : deltaPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              {(deltaLabel || hint) && (
                <span className="truncate text-[11px] font-medium text-slate-500">
                  {deltaLabel ?? hint}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="relative mt-3 -mx-1 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.fillFrom} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={palette.fillFrom} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={palette.stroke}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

export default PremiumKPI;
