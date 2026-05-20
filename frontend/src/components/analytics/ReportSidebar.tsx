import React, { useMemo } from 'react';
import { BarChart3, FileText, Search } from 'lucide-react';

import {
  REPORT_CATEGORY_LABELS,
  REPORTS_BY_CATEGORY,
} from '@/src/domains/analytics/data/reportCatalog';
import type { ReportCategory } from '@/src/domains/analytics/types/analytics.types';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';

type SidebarCategory = ReportCategory | 'all';

const categoryOrder: ReportCategory[] = [
  'exploitation',
  'reservations',
  'backoffice',
  'comptabilite',
  'tva',
  'statistiques',
  'revenue',
  'housekeeping',
  'technique',
];

interface ReportSidebarProps {
  selectedCode: string;
  activeCategory: SidebarCategory;
  search: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: SidebarCategory) => void;
  onSelect: (code: string) => void;
}

export function ReportSidebar({
  selectedCode,
  activeCategory,
  search,
  onSearchChange,
  onCategoryChange,
  onSelect,
}: ReportSidebarProps) {
  const query = search.trim().toLowerCase();
  const groups = useMemo(
    () =>
      categoryOrder.map((category) => ({
        category,
        reports: (activeCategory === 'all' || activeCategory === category ? REPORTS_BY_CATEGORY[category] : []).filter((report) => {
          if (!query) return true;
          return `${report.code} ${report.label} ${report.description} ${report.subcategory ?? ''}`
            .toLowerCase()
            .includes(query);
        }),
      })),
    [activeCategory, query],
  );
  const totalReports = categoryOrder.reduce((total, category) => total + REPORTS_BY_CATEGORY[category].length, 0);

  return (
    <aside className="w-[360px] shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-0">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#8B5CF6] text-white flex items-center justify-center">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-950">Analyse & rapports</h2>
            <p className="text-[11px] font-semibold text-gray-500">Catalogue officiel Flowtym</p>
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full bg-transparent text-xs font-semibold text-gray-700 outline-none"
            placeholder="Code, rapport, module..."
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <section className="space-y-1">
          <button
            onClick={() => onCategoryChange('all')}
            className={cn(
              'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-black transition-colors',
              activeCategory === 'all' ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            Tous les rapports
            <span className={cn('rounded px-2 py-0.5 text-[10px]', activeCategory === 'all' ? 'bg-white/15' : 'bg-gray-100')}>
              {totalReports}
            </span>
          </button>
          <div className="grid grid-cols-2 gap-1">
            {categoryOrder.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  'rounded-lg px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-[0.08em] transition-colors',
                  activeCategory === category ? 'bg-[#8B5CF6] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
                )}
              >
                {REPORT_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </section>
        {groups.map(({ category, reports }) => {
          if (reports.length === 0) return null;
          return (
            <section key={category} className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                  {REPORT_CATEGORY_LABELS[category]}
                </span>
                <Badge variant="neutral" className="border-none bg-gray-100 text-gray-500">
                  {reports.length}
                </Badge>
              </div>
              {reports.map((report) => (
                <button
                  key={report.code}
                  onClick={() => onSelect(report.code)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left transition-colors',
                    selectedCode === report.code
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className={selectedCode === report.code ? 'text-white' : 'text-gray-400'} />
                    <span className="text-xs font-black tabular-nums">{report.code}</span>
                    {report.fiscal && (
                      <span
                        className={cn(
                          'ml-auto rounded px-1.5 py-0.5 text-[9px] font-black uppercase',
                          selectedCode === report.code ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        Fiscal
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-semibold line-clamp-2">{report.label}</div>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
