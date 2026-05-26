/**
 * Tuile KPI premium réutilisée dans le header du module Événements.
 */
import React from 'react';
import { cn } from '@/src/lib/utils';
import type { LucideIcon } from 'lucide-react';

export const KpiTile: React.FC<{
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'violet' | 'rose' | 'emerald' | 'amber' | 'sky';
}> = ({ icon: Icon, label, value, hint, tone = 'violet' }) => {
  const tones = {
    violet:  { ring: 'ring-violet-100',  soft: 'bg-violet-50',  text: 'text-violet-600' },
    rose:    { ring: 'ring-rose-100',    soft: 'bg-rose-50',    text: 'text-rose-600' },
    emerald: { ring: 'ring-emerald-100', soft: 'bg-emerald-50', text: 'text-emerald-600' },
    amber:   { ring: 'ring-amber-100',   soft: 'bg-amber-50',   text: 'text-amber-600' },
    sky:     { ring: 'ring-sky-100',     soft: 'bg-sky-50',     text: 'text-sky-600' },
  }[tone];
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-inset', tones.soft, tones.ring, tones.text)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[20px] leading-none font-semibold text-slate-900">{value}</div>
        <div className="text-[12px] text-slate-500 mt-1 truncate">{label}</div>
        {hint && <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">{hint}</div>}
      </div>
    </div>
  );
};
