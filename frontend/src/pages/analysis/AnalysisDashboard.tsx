/**
 * FLOWTYM — Analysis Dashboard (Vue d'ensemble)
 *
 * Page d'atterrissage du module Analyse. Affiche :
 *  - 4 raccourcis : Bibliothèque, Favoris, Récents, Vues sauvegardées (avec compteurs)
 *  - Catégories de rapports (10) en grille cliquable
 *  - Rapports tendance / suggérés
 */

import React, { useMemo, useState } from 'react';
import { Star, Clock, FileText, BookOpen, ChevronRight, Sparkles, Lock, Tv } from 'lucide-react';
import { ALL_REPORTS, REPORT_CATEGORIES, getReportsByCategory, REPORT_STATS } from './reports/registry';
import { getFavorites, getRecent, getSavedViews } from '../../services/analysis/report-prefs.service';
import { DailyBriefing } from './DailyBriefing';
import { DirectionCockpit } from './cockpit/DirectionCockpit';
import { usePrefetchKeyReports } from '../../hooks/analysis/usePrefetchReports';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  violet:   { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200',   iconBg: 'bg-violet-100' },
  blue:     { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200',     iconBg: 'bg-blue-100' },
  emerald:  { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  iconBg: 'bg-emerald-100' },
  amber:    { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',    iconBg: 'bg-amber-100' },
  orange:   { bg: 'bg-orange-50',   text: 'text-orange-700',   border: 'border-orange-200',   iconBg: 'bg-orange-100' },
  cyan:     { bg: 'bg-cyan-50',     text: 'text-cyan-700',     border: 'border-cyan-200',     iconBg: 'bg-cyan-100' },
  rose:     { bg: 'bg-rose-50',     text: 'text-rose-700',     border: 'border-rose-200',     iconBg: 'bg-rose-100' },
  purple:   { bg: 'bg-purple-50',   text: 'text-purple-700',   border: 'border-purple-200',   iconBg: 'bg-purple-100' },
  slate:    { bg: 'bg-slate-50',    text: 'text-slate-700',    border: 'border-slate-200',    iconBg: 'bg-slate-200' },
  pink:     { bg: 'bg-pink-50',     text: 'text-pink-700',     border: 'border-pink-200',     iconBg: 'bg-pink-100' },
  teal:     { bg: 'bg-teal-50',     text: 'text-teal-700',     border: 'border-teal-200',     iconBg: 'bg-teal-100' },
};

export interface AnalysisDashboardProps {
  onNavigateSubPage?: (page: 'analysis_library' | 'analysis_favorites' | 'analysis_recent' | 'analysis_saved') => void;
  onOpenReport?: (reportId: string) => void;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ onNavigateSubPage, onOpenReport }) => {
  const [cockpitOpen, setCockpitOpen] = useState(false);

  // Prefetch des 4 rapports phares en arrière-plan → ouverture instantanée
  usePrefetchKeyReports();

  const stats = useMemo(() => ({
    total: ALL_REPORTS.length,
    favorites: getFavorites().length,
    recent: getRecent().length,
    saved: getSavedViews().length,
  }), []);

  return (
    <div className="space-y-6">
      {/* Bouton Cockpit Direction */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setCockpitOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-900 to-violet-900 text-white text-sm font-bold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
        >
          <Tv className="w-4 h-4" />
          Mode Cockpit Direction
        </button>
      </div>

      <DirectionCockpit open={cockpitOpen} onClose={() => setCockpitOpen(false)} />

      {/* Briefing matinal IA */}
      <DailyBriefing onOpenAlerts={() => onNavigateSubPage?.('analysis_alerts' as any)} />

      {/* 4 raccourcis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ShortcutCard
          icon={<BookOpen className="w-5 h-5 text-violet-600" />}
          label="Bibliothèque"
          value={`${stats.total}`}
          sub="rapports disponibles"
          onClick={() => onNavigateSubPage?.('analysis_library')}
        />
        <ShortcutCard
          icon={<Star className="w-5 h-5 text-amber-500" />}
          label="Mes favoris"
          value={`${stats.favorites}`}
          sub={stats.favorites > 0 ? 'rapports épinglés' : 'aucun favori encore'}
          onClick={() => onNavigateSubPage?.('analysis_favorites')}
        />
        <ShortcutCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Récents"
          value={`${stats.recent}`}
          sub={stats.recent > 0 ? 'derniers consultés' : 'aucun rapport récent'}
          onClick={() => onNavigateSubPage?.('analysis_recent')}
        />
        <ShortcutCard
          icon={<FileText className="w-5 h-5 text-emerald-600" />}
          label="Vues sauvegardées"
          value={`${stats.saved}`}
          sub={stats.saved > 0 ? 'rapports + filtres' : 'aucune vue sauvée'}
          onClick={() => onNavigateSubPage?.('analysis_saved')}
        />
      </div>

      {/* Catégories */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              Catégories de rapports
            </h3>
            <p className="text-xs text-gray-500 mt-1">10 catégories métier pour explorer rapidement</p>
          </div>
          <button
            onClick={() => onNavigateSubPage?.('analysis_library')}
            className="text-xs text-violet-700 hover:text-violet-900 font-semibold flex items-center gap-1"
          >
            Voir la bibliothèque
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {REPORT_CATEGORIES.map(cat => {
            const reports = getReportsByCategory(cat.id);
            const fiscal = reports.filter(r => r.flags?.fiscalLock).length;
            const charts = reports.filter(r => r.flags?.chart).length;
            const Icon = cat.icon;
            const colors = COLOR_MAP[cat.color] ?? COLOR_MAP.slate;
            return (
              <button
                key={cat.id}
                onClick={() => onNavigateSubPage?.('analysis_library')}
                className={cn(
                  'group text-left p-3 rounded-lg border transition-all hover:shadow-md',
                  colors.bg,
                  colors.border,
                )}
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <div className={cn('w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0', colors.iconBg)}>
                    <Icon className={cn('w-4 h-4', colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-bold leading-tight', colors.text)}>{cat.shortLabel ?? cat.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{reports.length} rapport{reports.length > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 line-clamp-2 mb-2">{cat.description}</div>
                <div className="flex items-center gap-2 text-[10px]">
                  {charts > 0 && <span className="text-gray-500">📊 {charts}</span>}
                  {fiscal > 0 && <span className="text-amber-700">🔒 {fiscal}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bandeau stats catalogue */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBadge label="Total rapports" value={REPORT_STATS.total} icon="📁" />
        <StatBadge label="Avec graphiques" value={REPORT_STATS.withChart} icon="📊" tone="emerald" />
        <StatBadge label="Verrouillage fiscal" value={REPORT_STATS.fiscalLocked} icon="🔒" tone="amber" />
        <StatBadge label="Temps réel" value={REPORT_STATS.realtime} icon="⏱️" tone="blue" />
      </div>

      {/* Quick win — rapports suggérés */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Rapports phares</h3>
        <p className="text-xs text-gray-500 mb-4">Sélection clé pour démarrer · cliquez pour ouvrir</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            getReportsByCategory('revenue_mgmt')[0],
            getReportsByCategory('exploitation_fo')[4], // Planning du jour
            getReportsByCategory('reservations')[2],    // Présents
            getReportsByCategory('comptabilite')[0],
            getReportsByCategory('statistiques')[0],    // Segmentation
            getReportsByCategory('housekeeping')[0],
          ].filter(Boolean).map(r => {
            if (!r) return null;
            const Icon = r.icon;
            const catColors = COLOR_MAP[REPORT_CATEGORIES.find(c => c.id === r.category)?.color ?? 'slate'];
            return (
              <button
                key={r.id}
                onClick={() => onOpenReport?.(r.id) ?? onNavigateSubPage?.('analysis_library')}
                className="text-left p-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all bg-gray-50/30"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', catColors.iconBg)}>
                    <Icon className={cn('w-3.5 h-3.5', catColors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{r.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function StatBadge({ label, value, icon, tone = 'default' }: {
  label: string;
  value: number;
  icon: string;
  tone?: 'default' | 'emerald' | 'amber' | 'blue';
}) {
  const color =
    tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/30' :
    tone === 'amber' ? 'border-amber-200 bg-amber-50/30' :
    tone === 'blue' ? 'border-blue-200 bg-blue-50/30' :
    'border-gray-200 bg-white';
  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-3', color)}>
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-xl font-extrabold text-gray-900">{value}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      </div>
    </div>
  );
}

function ShortcutCard({
  icon, label, value, sub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-violet-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </button>
  );
}
