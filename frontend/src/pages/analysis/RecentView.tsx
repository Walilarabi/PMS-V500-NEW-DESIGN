/**
 * FLOWTYM — Rapports récents
 */

import React, { useMemo, useState } from 'react';
import { Clock, ChevronRight, Search, Trash2 } from 'lucide-react';
import { ALL_REPORTS, REPORT_CATEGORIES } from './reports/registry';
import { getRecent, clearRecent, pushRecent } from '../../services/analysis/report-prefs.service';

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

export const RecentView: React.FC<{ onNavigateLibrary: () => void; onOpenReport?: (id: string) => void }> = ({ onNavigateLibrary, onOpenReport }) => {
  const [recent, setRecent] = useState(() => getRecent());
  const entries = useMemo(
    () => recent
      .map(r => ({ entry: r, report: ALL_REPORTS.find(rep => rep.id === r.reportId) }))
      .filter(e => !!e.report),
    [recent]
  );

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun rapport récent</h3>
        <p className="text-sm text-gray-500 mb-4">
          Vos 10 derniers rapports consultés apparaîtront ici.
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
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => { if (confirm('Effacer l\'historique récent ?')) { clearRecent(); setRecent([]); } }}
          className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Effacer l'historique
        </button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {entries.map(({ entry, report }) => {
          if (!report) return null;
          const Icon = report.icon;
          const cat = REPORT_CATEGORIES.find(c => c.id === report.category);
          const color = cat?.color ?? 'slate';
          const visited = new Date(entry.visitedAt);
          return (
            <button
              key={entry.reportId}
              onClick={() => { pushRecent(entry.reportId); onOpenReport?.(entry.reportId); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={cn('w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0', COLOR_BG[color])}>
                <Icon className={cn('w-4 h-4', COLOR_TEXT[color])} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{report.title}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {cat?.label} · ouvert le {visited.toLocaleDateString('fr-FR')} à {visited.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
