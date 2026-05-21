/**
 * FLOWTYM — Vues sauvegardées
 */

import React, { useMemo, useState } from 'react';
import { FileText, ChevronRight, Search, Trash2, Edit2 } from 'lucide-react';
import { ALL_REPORTS, REPORT_CATEGORIES } from './reports/registry';
import { getSavedViews, deleteSavedView, renameSavedView, pushRecent } from '../../services/analysis/report-prefs.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLOR_BG: Record<string, string> = {
  violet: 'bg-violet-100', blue: 'bg-blue-100', emerald: 'bg-emerald-100',
  amber: 'bg-amber-100', orange: 'bg-orange-100', cyan: 'bg-cyan-100',
  rose: 'bg-rose-100', purple: 'bg-purple-100', slate: 'bg-slate-200', pink: 'bg-pink-100',
  teal: 'bg-teal-100',
};
const COLOR_TEXT: Record<string, string> = {
  violet: 'text-violet-700', blue: 'text-blue-700', emerald: 'text-emerald-700',
  amber: 'text-amber-700', orange: 'text-orange-700', cyan: 'text-cyan-700',
  rose: 'text-rose-700', purple: 'text-purple-700', slate: 'text-slate-700', pink: 'text-pink-700',
  teal: 'text-teal-700',
};

export const SavedViewsView: React.FC<{ onNavigateLibrary: () => void; onOpenReport?: (id: string) => void }> = ({ onNavigateLibrary, onOpenReport }) => {
  const [views, setViews] = useState(() => getSavedViews());
  const enriched = useMemo(
    () => views.map(v => ({ view: v, report: ALL_REPORTS.find(r => r.id === v.reportId) })).filter(e => !!e.report),
    [views]
  );

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette vue sauvegardée ?')) return;
    deleteSavedView(id);
    setViews(getSavedViews());
  };

  const handleRename = (id: string, currentName: string) => {
    const next = prompt('Nouveau nom :', currentName);
    if (!next || next.trim() === currentName) return;
    renameSavedView(id, next.trim());
    setViews(getSavedViews());
  };

  if (enriched.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">Aucune vue sauvegardée</h3>
        <p className="text-sm text-gray-500 mb-4">
          Sauvegardez un rapport avec ses filtres pour le retrouver d'un clic.
        </p>
        <button
          onClick={onNavigateLibrary}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-md hover:bg-violet-700"
        >
          <Search className="w-3.5 h-3.5" />
          Explorer la bibliothèque
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {enriched.map(({ view, report }) => {
        if (!report) return null;
        const Icon = report.icon;
        const cat = REPORT_CATEGORIES.find(c => c.id === report.category);
        const color = cat?.color ?? 'slate';
        return (
          <div key={view.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className={cn('w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0', COLOR_BG[color])}>
              <Icon className={cn('w-4 h-4', COLOR_TEXT[color])} />
            </div>
            <button
              onClick={() => { pushRecent(view.reportId); onOpenReport?.(view.reportId); }}
              className="flex-1 min-w-0 text-left"
            >
              <div className="text-sm font-semibold text-gray-900 truncate">{view.name}</div>
              <div className="text-[11px] text-gray-500 truncate">
                {report.title} · sauvegardé le {new Date(view.createdAt).toLocaleDateString('fr-FR')}
                · {Object.keys(view.filters).length} filtre{Object.keys(view.filters).length > 1 ? 's' : ''}
              </div>
            </button>
            <button
              onClick={() => handleRename(view.id, view.name)}
              title="Renommer"
              className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(view.id)}
              title="Supprimer"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        );
      })}
    </div>
  );
};
