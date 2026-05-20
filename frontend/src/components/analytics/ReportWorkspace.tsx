import React from 'react';
import { AlertTriangle, Database, Download, FileText, LockKeyhole, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import type {
  AnalyticsFilters,
  GeneratedReport,
  ReportFormat,
} from '@/src/domains/analytics/types/analytics.types';
import { cn } from '@/src/lib/utils';

interface ReportWorkspaceProps {
  report: GeneratedReport;
  filters: AnalyticsFilters;
  isLoading: boolean;
  errors: Error[];
  onFiltersChange: (filters: AnalyticsFilters) => void;
}

const toneClass = {
  neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  good: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-rose-50 text-rose-700 border-rose-100',
};

function exportRows(report: GeneratedReport, format: ReportFormat) {
  const filename = `flowtym_${report.definition.code}_${report.period.from}_${report.period.to}`;
  const rows = report.rows.map((row) => ({
    id: row.id,
    libelle: row.label,
    date: row.date ?? '',
    client: row.guest ?? '',
    chambre: row.room ?? '',
    statut: row.status ?? '',
    source: row.source ?? '',
    montant: row.amount ?? '',
    solde: row.balance ?? '',
    ...row.meta,
  }));

  if (format === 'xlsx') {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Rapport');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }

  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportWorkspace({
  report,
  filters,
  isLoading,
  errors,
  onFiltersChange,
}: ReportWorkspaceProps) {
  const { definition } = report;
  const browserFormats = definition.formats.filter((format) => format === 'xlsx' || format === 'csv');

  return (
    <section className="flex-1 min-w-0 bg-[#F8FAFC] flex flex-col">
      <div className="h-20 shrink-0 border-b border-gray-200 bg-white px-6 flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <input
            type="date"
            value={filters.period.from}
            onChange={(event) =>
              onFiltersChange({ ...filters, period: { ...filters.period, from: event.target.value } })
            }
            className="bg-transparent text-xs font-black text-gray-700 outline-none"
          />
          <span className="text-gray-300">/</span>
          <input
            type="date"
            value={filters.period.to}
            onChange={(event) =>
              onFiltersChange({ ...filters, period: { ...filters.period, to: event.target.value } })
            }
            className="bg-transparent text-xs font-black text-gray-700 outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-lg">
            <RefreshCw size={14} />
            Actualiser
          </Button>
          {browserFormats.map((format) => (
            <Button
              key={format}
              variant="primary"
              size="sm"
              className="rounded-lg"
              onClick={() => exportRows(report, format)}
              disabled={report.rows.length === 0}
            >
              <Download size={14} />
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-gray-950">
                {definition.label}
              </h1>
              <Badge variant="neutral" className="bg-white font-black tabular-nums">
                {definition.code}
              </Badge>
              {definition.immutableOnceClosed && (
                <Badge variant="warning" className="gap-1">
                  <LockKeyhole size={11} />
                  Immuable
                </Badge>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-sm font-medium text-gray-500">
              {definition.description}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Sources</div>
            <div className="mt-1 flex flex-wrap justify-end gap-1">
              {definition.dataSources.map((source) => (
                <span key={source} className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                  {source}
                </span>
              ))}
            </div>
          </div>
        </div>

        {(errors.length > 0 || report.warnings.length > 0) && (
          <div className="space-y-2">
            {errors.map((error) => (
              <div key={error.message} className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <AlertTriangle size={16} />
                {error.message}
              </div>
            ))}
            {report.warnings.map((warning) => (
              <div key={warning} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                <AlertTriangle size={16} />
                {warning}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {report.metrics.map((metric) => (
            <div key={metric.label} className={cn('rounded-lg border p-4', toneClass[metric.tone])}>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{metric.label}</div>
              <div className="mt-2 text-xl font-black tracking-tight">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-gray-900">
                <FileText size={16} className="text-[#8B5CF6]" />
                Donnees mappees
              </div>
              <span className="text-xs font-bold text-gray-400">{report.rows.length} lignes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Libelle</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Chambre</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center font-semibold text-gray-400">
                        Chargement des donnees sources...
                      </td>
                    </tr>
                  ) : report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center font-semibold text-gray-400">
                        Aucun enregistrement pour cette periode.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-black text-gray-900">{row.label}</td>
                        <td className="px-4 py-3 font-semibold text-gray-500">{row.date?.slice(0, 10) ?? '-'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-600">{row.guest ?? '-'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-600">{row.room ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-600">
                            {row.status ?? 'ND'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-gray-900">
                          {typeof row.amount === 'number' ? row.amount.toLocaleString('fr-FR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-gray-900">
                          {typeof row.balance === 'number' ? row.balance.toLocaleString('fr-FR') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-black text-gray-900">
              <Database size={16} className="text-[#8B5CF6]" />
              Synthese graphique
            </div>
            <div className="p-4 space-y-3">
              {report.chart.length === 0 ? (
                <div className="py-12 text-center text-sm font-semibold text-gray-400">Pas assez de donnees.</div>
              ) : (
                report.chart.map((point) => {
                  const max = Math.max(...report.chart.map((item) => item.value), 1);
                  return (
                    <div key={point.label} className="space-y-1">
                      <div className="flex justify-between gap-3 text-xs font-bold text-gray-600">
                        <span className="truncate">{point.label}</span>
                        <span>{point.value.toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="h-2 rounded bg-gray-100">
                        <div
                          className="h-2 rounded bg-[#8B5CF6]"
                          style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
