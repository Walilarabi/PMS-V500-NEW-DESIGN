import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Command, History, Search } from 'lucide-react';

import { ReportSidebar } from '@/src/components/analytics/ReportSidebar';
import { ReportWorkspace } from '@/src/components/analytics/ReportWorkspace';
import { REPORT_CATALOG } from '@/src/domains/analytics/data/reportCatalog';
import { useAnalyticsReport } from '@/src/domains/analytics/hooks/useAnalyticsReport';
import { useAnalyticsStore } from '@/src/domains/analytics/stores/analytics.store';
import type { AnalyticsFilters } from '@/src/domains/analytics/types/analytics.types';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';

function currentMonthPeriod() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export const AnalysisView = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report');
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({
    period: currentMonthPeriod(),
  }));
  const lastHistoryKey = useRef<string | null>(null);
  const {
    activeCategory,
    activeReportCode,
    shortcutBuffer,
    history,
    setActiveCategory,
    setActiveReportCode,
    appendShortcutDigit,
    clearShortcut,
    addHistoryItem,
  } = useAnalyticsStore();

  const safeCode = useMemo(
    () => REPORT_CATALOG.some((report) => report.code === activeReportCode) ? activeReportCode : REPORT_CATALOG[0].code,
    [activeReportCode],
  );
  const { report, isLoading, errors } = useAnalyticsReport(safeCode, filters);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditableTarget) return;

      if (/^[0-9]$/.test(event.key)) {
        appendShortcutDigit(event.key);
        return;
      }

      if (event.key === 'Enter' && shortcutBuffer.length === 5) {
        if (REPORT_CATALOG.some((item) => item.code === shortcutBuffer)) {
          setActiveReportCode(shortcutBuffer);
          setActiveTab('report');
        }
        clearShortcut();
        return;
      }

      if (event.key === 'Escape') clearShortcut();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appendShortcutDigit, clearShortcut, setActiveReportCode, shortcutBuffer]);

  useEffect(() => {
    if (isLoading || errors.length > 0) return;
    const key = `${report.definition.code}:${report.period.from}:${report.period.to}`;
    if (lastHistoryKey.current === key) return;
    lastHistoryKey.current = key;
    addHistoryItem({
      code: report.definition.code,
      label: report.definition.label,
      category: report.definition.category,
      periodFrom: report.period.from,
      periodTo: report.period.to,
      generatedAt: report.generatedAt,
      fiscal: report.definition.fiscal,
      rowsCount: report.rows.length,
    });
  }, [addHistoryItem, errors.length, isLoading, report]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-white">
      <ReportSidebar
        selectedCode={safeCode}
        activeCategory={activeCategory}
        search={search}
        onSearchChange={setSearch}
        onCategoryChange={setActiveCategory}
        onSelect={setActiveReportCode}
      />
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 shrink-0 border-b border-gray-200 bg-white px-6 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <Search size={14} />
            {REPORT_CATALOG.length} rapports mappees
          </div>
          {shortcutBuffer && (
            <div className="flex items-center gap-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2 text-xs font-black text-[#6D28D9]">
              <Command size={14} />
              <span className="font-mono">{shortcutBuffer}</span>
              <span className="text-[#8B5CF6]">+ Entree</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-gray-50 p-1">
            <Button
              variant={activeTab === 'report' ? 'primary' : 'ghost'}
              size="sm"
              className={cn('rounded-md', activeTab !== 'report' && 'text-gray-500 hover:text-[#8B5CF6]')}
              onClick={() => setActiveTab('report')}
            >
              <BarChart3 size={14} />
              Generer
            </Button>
            <Button
              variant={activeTab === 'history' ? 'primary' : 'ghost'}
              size="sm"
              className={cn('rounded-md', activeTab !== 'history' && 'text-gray-500 hover:text-[#8B5CF6]')}
              onClick={() => setActiveTab('history')}
            >
              <History size={14} />
              Historique
            </Button>
          </div>
        </div>

        {activeTab === 'history' ? (
          <ReportHistory
            history={history}
            onSelect={(code) => {
              setActiveReportCode(code);
              setActiveTab('report');
            }}
          />
        ) : (
          <ReportWorkspace
            report={report}
            filters={filters}
            isLoading={isLoading}
            errors={errors}
            onFiltersChange={setFilters}
          />
        )}
      </section>
    </div>
  );
};

function ReportHistory({
  history,
  onSelect,
}: {
  history: ReturnType<typeof useAnalyticsStore.getState>['history'];
  onSelect: (code: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h2 className="text-xl font-black text-gray-950">Historique local</h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Metadonnees uniquement : aucune ligne financiere ou fiscale n est stockee dans le navigateur.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-semibold text-gray-400">
              Aucun rapport consulte pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <button
                  key={`${item.code}:${item.periodFrom}:${item.periodTo}`}
                  onClick={() => onSelect(item.code)}
                  className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-black tabular-nums text-gray-600">
                      {item.code}
                    </span>
                    <span className="font-black text-gray-950">{item.label}</span>
                    {item.fiscal && (
                      <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                        Fiscal
                      </span>
                    )}
                    <span className="ml-auto text-xs font-bold text-gray-400">
                      {new Date(item.generatedAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-gray-500">
                    {item.periodFrom} / {item.periodTo} - {item.rowsCount} lignes mappees
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
