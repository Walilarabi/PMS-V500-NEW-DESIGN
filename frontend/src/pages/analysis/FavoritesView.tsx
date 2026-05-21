/**
 * FLOWTYM — Favoris rapports
 */

import React, { useMemo, useState } from 'react';
import { Star, ChevronRight, Search } from 'lucide-react';
import { ALL_REPORTS, REPORT_CATEGORIES } from './reports/registry';
import { getFavorites, toggleFavorite, pushRecent } from '../../services/analysis/report-prefs.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLOR_TEXT: Record<string, string> = {
  violet: 'text-violet-700', blue: 'text-blue-700', emerald: 'text-emerald-700',
  amber: 'text-amber-700', orange: 'text-orange-700', cyan: 'text-cyan-700',
  rose: 'text-rose-700', purple: 'text-purple-700', slate: 'text-slate-700', pink: 'text-pink-700',
};
const COLOR_BG: Record<string, string> = {
  violet: 'bg-violet-100', blue: 'bg-blue-100', emerald: 'bg-emerald-100',
  amber: 'bg-amber-100', orange: 'bg-orange-100', cyan: 'bg-cyan-100',
  rose: 'bg-rose-100', purple: 'bg-purple-100', slate: 'bg-slate-200', pink: 'bg-pink-100',
};

export const FavoritesView: React.FC<{ onNavigateLibrary: () => void; onOpenReport?: (id: string) => void }> = ({ onNavigateLibrary, onOpenReport }) => {
  const [favs, setFavs] = useState<string[]>(() => getFavorites());

  const reports = useMemo(
    () => favs.map(id => ALL_REPORTS.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
    [favs]
  );

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Star className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun rapport en favori</h3>
        <p className="text-sm text-gray-500 mb-4">
          Cliquez sur l'étoile depuis la bibliothèque pour épingler vos rapports les plus utilisés.
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {reports.map(r => {
        const Icon = r.icon;
        const cat = REPORT_CATEGORIES.find(c => c.id === r.category);
        const color = cat?.color ?? 'slate';
        return (
          <div
            key={r.id}
            className="group bg-white rounded-lg border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <button
              onClick={() => { pushRecent(r.id); onOpenReport?.(r.id); }}
              className="w-full p-4 text-left"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={cn('w-9 h-9 rounded-md flex items-center justify-center', COLOR_BG[color])}>
                  <Icon className={cn('w-4 h-4', COLOR_TEXT[color])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[10px] font-bold uppercase tracking-wide', COLOR_TEXT[color])}>
                    {cat?.label}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1 truncate">{r.title}</div>
                  <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{r.description}</div>
                </div>
              </div>
            </button>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={() => { toggleFavorite(r.id); setFavs(getFavorites()); }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"
              >
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                Retirer des favoris
              </button>
              <button
                onClick={() => { pushRecent(r.id); onOpenReport?.(r.id); }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700"
              >
                Ouvrir
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
