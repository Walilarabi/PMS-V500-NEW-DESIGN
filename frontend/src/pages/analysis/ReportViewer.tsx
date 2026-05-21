/**
 * FLOWTYM — Report Viewer
 *
 * Composant orchestrateur d'un rapport :
 *  - Récupère la définition depuis le registry
 *  - Charge les données via useReportData
 *  - Rend le Shell + le renderer du rapport
 *
 * Les renderers sont enregistrés dans REPORT_RENDERERS (vague 3+).
 */

import React, { useState, useEffect } from 'react';
import { Construction } from 'lucide-react';
import { getReportById, type ReportDefinition } from './reports/registry';
import { ReportShell, type ReportFilters, type Granularity, type ComparisonMode } from './ReportShell';
import { useReportData } from '../../hooks/analysis/useReportData';
import { REPORT_RENDERERS } from './reports/renderers';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export interface ReportViewerProps {
  reportId: string;
  initialFilters?: Partial<ReportFilters>;
  onBack: () => void;
}

function defaultFilters(report: ReportDefinition): ReportFilters {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
    granularity: 'day' as Granularity,
    comparison: (report.comparisons && report.comparisons.length > 0
      ? report.comparisons[0]
      : 'none') as ComparisonMode,
  };
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, initialFilters, onBack }) => {
  const report = getReportById(reportId);
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    ...(report ? defaultFilters(report) : {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      granularity: 'day' as Granularity,
      comparison: 'none' as ComparisonMode,
    }),
    ...initialFilters,
  }));

  const query = useReportData({ reportId, filters, enabled: !!report });

  useEffect(() => {
    if (report) {
      // Refetch automatique sur changement de filtres géré par useReportData (queryKey).
    }
  }, [report, filters]);

  if (!report) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Construction className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">Rapport introuvable</h3>
        <p className="text-sm text-gray-500 mb-4">L'ID <code>{reportId}</code> n'existe pas dans le registry.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-md hover:bg-violet-700"
        >
          Retour à la bibliothèque
        </button>
      </div>
    );
  }

  const Renderer = REPORT_RENDERERS[reportId];

  return (
    <ReportShell
      report={report}
      filters={filters}
      onFiltersChange={setFilters}
      onBack={onBack}
      onRefresh={() => query.refetch()}
      onExportPDF={() => alert('Export PDF — vague 5')}
      onExportExcel={() => alert('Export Excel — vague 5')}
      loading={query.isFetching}
    >
      {!Renderer ? (
        <UnimplementedReport reportId={reportId} title={report.title} source={query.data?.source} />
      ) : (
        <Renderer
          data={query.data?.rows ?? []}
          filters={filters}
          isLoading={query.isLoading}
          source={query.data?.source ?? 'mock'}
        />
      )}
      {query.error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          Erreur de chargement : {(query.error as Error).message}
        </div>
      )}
      {query.data?.warnings && query.data.warnings.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
          {query.data.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
    </ReportShell>
  );
};

function UnimplementedReport({ reportId, title, source }: { reportId: string; title: string; source?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <Construction className="w-12 h-12 mx-auto text-violet-300 mb-3" />
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">
        Renderer non encore branché pour <code className="text-xs">{reportId}</code>.
      </p>
      <div className="text-[11px] text-gray-400">
        Vague 3 — implémentation des renderers métier en cours · Source actuelle : <strong>{source ?? '—'}</strong>
      </div>
    </div>
  );
}
