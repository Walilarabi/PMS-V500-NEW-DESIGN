/**
 * FLOWTYM — Premium Page Header
 *
 * En-tête haut de gamme : titre, sous-titre, sélecteur de période,
 * exports, et zone d'actions principales.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type PeriodKey = '7d' | '30d' | '90d' | 'ytd' | 'custom';

const PERIOD_LABEL: Record<PeriodKey, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  ytd: 'Depuis le 1er janvier',
  custom: 'Période personnalisée',
};

export interface PremiumHeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'secondary';
}

export interface PremiumHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  period?: PeriodKey;
  onPeriodChange?: (p: PeriodKey) => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onFilters?: () => void;
  actions?: PremiumHeaderAction[];
  rightSlot?: React.ReactNode;
}

export const PremiumHeader: React.FC<PremiumHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  period,
  onPeriodChange,
  searchValue,
  onSearchChange,
  onExportExcel,
  onExportPDF,
  onFilters,
  actions,
  rightSlot,
}) => {
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-violet-500 to-violet-700 text-white',
            'shadow-lg shadow-violet-500/25'
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold leading-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher…"
              className={cn(
                'h-9 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm',
                'placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100',
                'transition'
              )}
            />
          </div>
        )}

        {onFilters && (
          <button
            onClick={onFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
        )}

        {period && onPeriodChange && (
          <div className="relative">
            <button
              onClick={() => {
                setPeriodOpen((v) => !v);
                setExportOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4 text-slate-500" />
              {PERIOD_LABEL[period]}
              <ChevronDown
                className={cn('h-3.5 w-3.5 text-slate-400 transition', periodOpen && 'rotate-180')}
              />
            </button>
            {periodOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      onPeriodChange(key);
                      setPeriodOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                      period === key
                        ? 'font-semibold text-violet-600'
                        : 'text-slate-700'
                    )}
                  >
                    {PERIOD_LABEL[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(onExportExcel || onExportPDF) && (
          <div className="relative">
            <button
              onClick={() => {
                setExportOpen((v) => !v);
                setPeriodOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Exporter
              <ChevronDown
                className={cn('h-3.5 w-3.5 text-slate-400 transition', exportOpen && 'rotate-180')}
              />
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {onExportExcel && (
                  <button
                    onClick={() => {
                      onExportExcel();
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Excel
                  </button>
                )}
                {onExportPDF && (
                  <button
                    onClick={() => {
                      onExportPDF();
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 text-rose-500" />
                    Export PDF
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {actions?.map((a, i) => {
          const ButtonIcon = a.icon;
          const isPrimary = (a.variant ?? 'primary') === 'primary';
          return (
            <button
              key={i}
              onClick={a.onClick}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition',
                isPrimary
                  ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30'
                  : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              )}
            >
              {ButtonIcon && <ButtonIcon className="h-4 w-4" />}
              {a.label}
            </button>
          );
        })}

        {rightSlot}
      </div>
    </motion.header>
  );
};

export default PremiumHeader;
