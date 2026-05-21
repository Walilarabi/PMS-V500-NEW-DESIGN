/**
 * FLOWTYM — Report Shell
 *
 * Layout commun à TOUS les rapports :
 *  - Breadcrumb retour
 *  - Header (titre + description + badges catégorie + comparaisons)
 *  - Toolbar (filtres période, granularité, comparaisons, actions favori/sauver/export)
 *  - Zone de contenu (rendue par le renderer du rapport)
 *
 * Le shell est stable ; seule la zone de contenu change selon le rapport.
 */

import React, { useState } from 'react';
import {
  ChevronLeft, Star, Save, Download, FileSpreadsheet, FileText, Calendar,
  Sliders, RefreshCw, Loader2,
} from 'lucide-react';
import type { ReportDefinition } from './reports/registry';
import { REPORT_CATEGORIES } from './reports/registry';
import { isFavorite, toggleFavorite, saveView } from '../../services/analysis/report-prefs.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export type Granularity = 'day' | 'week' | 'month';
export type ComparisonMode = 'none' | 'N-1' | 'budget' | 'forecast';

export interface ReportFilters {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  comparison: ComparisonMode;
  [key: string]: unknown; // filtres custom par rapport
}

export interface ReportShellProps {
  report: ReportDefinition;
  filters: ReportFilters;
  onFiltersChange: (next: ReportFilters) => void;
  onBack: () => void;
  onRefresh?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

const COLOR_MAP: Record<string, { text: string; iconBg: string }> = {
  violet: { text: 'text-violet-700', iconBg: 'bg-violet-100' },
  blue: { text: 'text-blue-700', iconBg: 'bg-blue-100' },
  emerald: { text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  amber: { text: 'text-amber-700', iconBg: 'bg-amber-100' },
  orange: { text: 'text-orange-700', iconBg: 'bg-orange-100' },
  cyan: { text: 'text-cyan-700', iconBg: 'bg-cyan-100' },
  rose: { text: 'text-rose-700', iconBg: 'bg-rose-100' },
  purple: { text: 'text-purple-700', iconBg: 'bg-purple-100' },
  slate: { text: 'text-slate-700', iconBg: 'bg-slate-200' },
  pink: { text: 'text-pink-700', iconBg: 'bg-pink-100' },
  teal: { text: 'text-teal-700', iconBg: 'bg-teal-100' },
};

export const ReportShell: React.FC<ReportShellProps> = ({
  report, filters, onFiltersChange, onBack, onRefresh, onExportPDF, onExportExcel,
  loading, children,
}) => {
  const cat = REPORT_CATEGORIES.find(c => c.id === report.category);
  const colors = COLOR_MAP[cat?.color ?? 'slate'];
  const Icon = report.icon;

  const [fav, setFav] = useState<boolean>(() => isFavorite(report.id));
  const [savingView, setSavingView] = useState(false);

  const handleToggleFav = () => {
    toggleFavorite(report.id);
    setFav(isFavorite(report.id));
  };

  const handleSaveView = () => {
    const name = prompt('Nom de la vue à sauvegarder :', `${report.title} — ${filters.startDate} → ${filters.endDate}`);
    if (!name) return;
    setSavingView(true);
    try {
      saveView({ reportId: report.id, name: name.trim(), filters });
      alert(`Vue "${name.trim()}" sauvegardée.`);
    } finally {
      setSavingView(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + retour */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 hover:text-violet-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Bibliothèque
        </button>
        <span className="text-gray-300">/</span>
        <span className={cn('font-semibold', colors.text)}>{cat?.label}</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold">{report.title}</span>
      </div>

      {/* Header rapport */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', colors.iconBg)}>
            <Icon className={cn('w-6 h-6', colors.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', colors.text)}>{cat?.label}</span>
              <span className="text-[10px] text-gray-400">· ID : {report.id}</span>
              {report.comparisons && report.comparisons.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  · Comparaisons : {report.comparisons.join(' / ')}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 leading-tight">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{report.description}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleToggleFav}
              title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={cn(
                'p-2 rounded transition-colors',
                fav ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
              )}
            >
              <Star className={cn('w-4 h-4', fav && 'fill-amber-500')} />
            </button>
            <button
              onClick={handleSaveView}
              disabled={savingView}
              title="Sauvegarder cette vue"
              className="p-2 rounded text-gray-500 hover:text-violet-700 hover:bg-violet-50"
            >
              <Save className="w-4 h-4" />
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Rafraîchir"
                className="p-2 rounded text-gray-500 hover:text-violet-700 hover:bg-violet-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar filtres */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="date"
            value={filters.startDate}
            onChange={e => onFiltersChange({ ...filters, startDate: e.target.value })}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={e => onFiltersChange({ ...filters, endDate: e.target.value })}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border border-gray-300 rounded p-0.5">
          {(['day', 'week', 'month'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => onFiltersChange({ ...filters, granularity: g })}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded transition-colors',
                filters.granularity === g
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {g === 'day' ? 'Jour' : g === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>

        {report.comparisons && report.comparisons.length > 0 && (
          <select
            value={filters.comparison}
            onChange={e => onFiltersChange({ ...filters, comparison: e.target.value as ComparisonMode })}
            className="px-2.5 py-1 text-[11px] border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
          >
            <option value="none">Pas de comparaison</option>
            {report.comparisons.includes('N-1') && <option value="N-1">vs N-1</option>}
            {report.comparisons.includes('budget') && <option value="budget">vs Budget</option>}
            {report.comparisons.includes('forecast') && <option value="forecast">vs Forecast</option>}
          </select>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center gap-1"
              title="Exporter en PDF"
            >
              <FileText className="w-3 h-3" />
              PDF
            </button>
          )}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 inline-flex items-center gap-1"
              title="Exporter en Excel"
            >
              <FileSpreadsheet className="w-3 h-3" />
              Excel
            </button>
          )}
        </div>
      </div>

      {/* Contenu rapport */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2 text-sm text-violet-700 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement…
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
