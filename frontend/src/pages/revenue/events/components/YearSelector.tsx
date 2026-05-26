/**
 * YearSelector — sélecteur d'année premium pour le module Événements.
 *
 * UI : bouton compact + popover liste verticale (5 années : passée(s), en cours
 * surlignée, à venir). Synchronise instantanément tous les filtres dépendants.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface YearSelectorProps {
  value: number;
  onChange: (year: number) => void;
  /** Fenêtre [min, max] inclusive. Défaut : currentYear-2 → currentYear+2. */
  range?: [number, number];
}

export const YearSelector: React.FC<YearSelectorProps> = ({
  value,
  onChange,
  range,
}) => {
  const currentYear = new Date().getFullYear();
  const [from, to] = range ?? [currentYear - 2, currentYear + 2];
  const years = [] as number[];
  for (let y = to; y >= from; y--) years.push(y);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-[13px] font-semibold text-slate-800 hover:ring-violet-300 hover:bg-violet-50/30 transition-all shadow-sm"
      >
        <Calendar className="w-4 h-4 text-violet-600" />
        <span className="tabular-nums">{value}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-44 z-30 bg-white rounded-xl ring-1 ring-slate-200 shadow-xl py-1 origin-top-right animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {years.map((y) => {
            const isActive  = y === value;
            const isCurrent = y === currentYear;
            const isPast    = y < currentYear;
            const isFuture  = y > currentYear;
            return (
              <button
                key={y}
                role="option"
                aria-selected={isActive}
                onClick={() => { onChange(y); setOpen(false); }}
                className={cn(
                  'w-full px-3 py-2 flex items-center justify-between text-[13px] hover:bg-slate-50 transition-colors',
                  isActive && 'bg-violet-50',
                )}
              >
                <span className={cn(
                  'tabular-nums font-semibold',
                  isActive ? 'text-violet-700' : isCurrent ? 'text-slate-900' : 'text-slate-600',
                )}>
                  {y}
                </span>
                <span className={cn(
                  'text-[10.5px] font-medium px-1.5 py-0.5 rounded-md ring-1 ring-inset',
                  isCurrent && 'text-violet-700 bg-violet-50 ring-violet-200',
                  isPast    && 'text-slate-500 bg-slate-50 ring-slate-200',
                  isFuture  && 'text-emerald-700 bg-emerald-50 ring-emerald-200',
                )}>
                  {isCurrent ? 'En cours' : isPast ? 'Passé' : 'À venir'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
