/**
 * FLOWTYM — KPI Strip
 * 
 * Bande KPI réutilisable style HTML de référence
 * Design: flowtym_rms.html
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KPICardData {
  label: string;
  value: string | number;
  unit?: string;
  delta?: {
    value: number;
    type: 'up' | 'down' | 'flat';
  };
  subtitle?: string;
  color?: 'violet' | 'green' | 'red' | 'amber' | 'blue';
}

interface KPIStripProps {
  cards: KPICardData[];
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export function KPIStrip({ cards }: KPIStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cards.map((card, idx) => (
        <KPICard key={idx} {...card} />
      ))}
    </div>
  );
}

function KPICard({ label, value, unit, delta, subtitle, color = 'violet' }: KPICardData) {
  const colorClasses = {
    violet: 'before:bg-violet-500',
    green: 'before:bg-emerald-500',
    red: 'before:bg-red-500',
    amber: 'before:bg-amber-500',
    blue: 'before:bg-blue-500',
  };

  return (
    <div className={cn(
      'relative bg-white border border-gray-200 rounded-xl p-3 overflow-hidden',
      'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:rounded-t-xl',
      colorClasses[color]
    )}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </div>
      
      <div className="flex items-baseline gap-1">
        <div className="text-2xl font-bold text-gray-900 leading-none">
          {value}
        </div>
        {unit && (
          <div className="text-sm font-medium text-gray-500">
            {unit}
          </div>
        )}
      </div>

      {(delta || subtitle) && (
        <div className="flex items-center gap-2 mt-1.5">
          {delta && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
              delta.type === 'up' && 'bg-emerald-100 text-emerald-700',
              delta.type === 'down' && 'bg-red-100 text-red-700',
              delta.type === 'flat' && 'bg-amber-100 text-amber-700'
            )}>
              {delta.type === 'up' && <TrendingUp className="w-3 h-3" />}
              {delta.type === 'down' && <TrendingDown className="w-3 h-3" />}
              {delta.type === 'flat' && <Minus className="w-3 h-3" />}
              {Math.abs(delta.value)}%
            </span>
          )}
          
          {subtitle && (
            <span className="text-[10px] text-gray-500">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
