/**
 * FLOWTYM — Report Library
 *
 * Bibliothèque des rapports avec :
 *  - Tabs catégories (10) en haut
 *  - Recherche
 *  - Filtres tags (tendance, direction, opérationnel)
 *  - Grille de cartes rapport avec bouton "Étoile" pour favori
 */

import React, { useMemo, useState } from 'react';
import { Search, Star, ChevronRight, Lock, Timer, BarChart3, Table } from 'lucide-react';
import { ALL_REPORTS, REPORT_CATEGORIES, ReportCategory, searchReports } from './reports/registry';
import { getFavorites, toggleFavorite, pushRecent } from '../../services/analysis/report-prefs.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLOR_MAP: Record<string, { text: string; iconBg: string; border: string }> = {
  violet:   { text: 'text-violet-700',   iconBg: 'bg-violet-100',   border: 'border-violet-200' },
  blue:     { text: 'text-blue-700',     iconBg: 'bg-blue-100',     border: 'border-blue-200' },
  emerald:  { text: 'text-emerald-700',  iconBg: 'bg-emerald-100',  border: 'border-emerald-200' },
  amber:    { text: 'text-amber-700',    iconBg: 'bg-amber-100',    border: 'border-amber-200' },
  orange:   { text: 'text-orange-700',   iconBg: 'bg-orange-100',   border: 'border-orange-200' },
  cyan:     { text: 'text-cyan-700',     iconBg: 'bg-cyan-100',     border: 'border-cyan-200' },
  rose:     { text: 'text-rose-700',     iconBg: 'bg-rose-100',     border: 'border-rose-200' },
  purple:   { text: 'text-purple-700',   iconBg: 'bg-purple-100',   border: 'border-purple-200' },
  slate:    { text: 'text-slate-700',    iconBg: 'bg-slate-200',    border: 'border-slate-200' },
  pink:     { text: 'text-pink-700',     iconBg: 'bg-pink-100',     border: 'border-pink-200' },
  teal:     { text: 'text-teal-700',     iconBg: 'bg-teal-100',     border: 'border-teal-200' },
};

export interface ReportLibraryProps {
  initialSearch?: string;
  onOpenReport?: (reportId: string) => void;
}

export const ReportLibrary: React.FC<ReportLibraryProps> = ({ initialSearch = '', onOpenReport }) => {
  const [category, setCategory] = useState<ReportCategory | 'all'>('all');
  const [search, setSearch] = useState(initialSearch);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());

  const filtered = useMemo(() => {
    let list = search ? searchReports(search) : ALL_REPORTS;
    if (category !== 'all') list = list.filter(r => r.category === category);
    return list;
  }, [category, search]);

  const handleToggleFav = (reportId: string) => {
    toggleFavorite(reportId);
    setFavorites(getFavorites());
  };

  const handleOpenReport = (reportId: string) => {
    pushRecent(reportId);
    onOpenReport?.(reportId);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par titre, description, ID…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
          />
        </div>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} / {ALL_REPORTS.length} rapport{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabs catégories */}
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded transition-colors',
              category === 'all' ? 'bg-violet-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            Toutes ({ALL_REPORTS.length})
          </button>
          {REPORT_CATEGORIES.map(cat => {
            const count = ALL_REPORTS.filter(r => r.category === cat.id).length;
            const Icon = cat.icon;
            const colors = COLOR_MAP[cat.color] ?? COLOR_MAP.slate;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5',
                  category === cat.id
                    ? cn('bg-white border-2', colors.border, colors.text)
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-3 h-3" />
                {cat.label}
                <span className="text-[10px] opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grille rapports */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Aucun rapport ne correspond à votre recherche</p>
          <button
            onClick={() => { setSearch(''); setCategory('all'); }}
            className="mt-3 text-xs text-violet-700 hover:text-violet-900 font-semibold"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(r => {
            const Icon = r.icon;
            const cat = REPORT_CATEGORIES.find(c => c.id === r.category);
            const colors = COLOR_MAP[cat?.color ?? 'slate'];
            const isFav = favorites.includes(r.id);
            return (
              <div
                key={r.id}
                className="group bg-white rounded-lg border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all overflow-hidden"
              >
                <button
                  onClick={() => handleOpenReport(r.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className={cn('w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0', colors.iconBg)}>
                      <Icon className={cn('w-4 h-4', colors.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[9px] font-bold text-gray-400 tabular-nums">#{r.id}</span>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide', colors.text)}>
                          {cat?.shortLabel ?? cat?.label}
                        </span>
                        {r.flags?.fiscalLock && <Lock className="w-3 h-3 text-amber-600" strokeWidth={1.75} aria-label="Verrouillé après clôture" />}
                        {r.flags?.realtime && <Timer className="w-3 h-3 text-blue-600" strokeWidth={1.75} aria-label="Temps réel" />}
                        {r.flags?.chart && <BarChart3 className="w-3 h-3 text-violet-600" strokeWidth={1.75} aria-label="Avec graphique" />}
                        {r.flags?.table && <Table className="w-3 h-3 text-gray-500" strokeWidth={1.75} aria-label="Avec tableau" />}
                      </div>
                      <div className="text-sm font-bold text-gray-900 truncate">{r.title}</div>
                      <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{r.description}</div>
                      {r.comparisons && r.comparisons.length > 0 && (
                        <div className="text-[9px] text-gray-400 font-medium mt-1">
                          Comparaisons : {r.comparisons.join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleFav(r.id)}
                    className={cn(
                      'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
                      isFav ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'
                    )}
                  >
                    <Star className={cn('w-3 h-3', isFav && 'fill-amber-500 text-amber-500')} />
                    {isFav ? 'Favori' : 'Ajouter aux favoris'}
                  </button>
                  <button
                    onClick={() => handleOpenReport(r.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                  >
                    Ouvrir
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
