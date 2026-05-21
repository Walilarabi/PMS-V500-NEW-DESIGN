/**
 * FLOWTYM — Analyse & Rapports
 *
 * Shell principal du nouveau module Analyse. Une seule sidebar.
 * Rend l'une des 5 vues selon `activePage` (passée via App.tsx) :
 *   - analysis            → Dashboard
 *   - analysis_library    → Bibliothèque (catégories + recherche)
 *   - analysis_favorites  → Favoris
 *   - analysis_recent     → Récents
 *   - analysis_saved      → Vues sauvegardées
 *
 * Tous partagent un header commun avec recherche globale.
 */

import React, { useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { AnalysisDashboard } from './AnalysisDashboard';
import { ReportLibrary } from './ReportLibrary';
import { FavoritesView } from './FavoritesView';
import { RecentView } from './RecentView';
import { SavedViewsView } from './SavedViewsView';
import { ReportViewer } from './ReportViewer';
import { pushRecent } from '../../services/analysis/report-prefs.service';

type AnalysisPage = 'analysis' | 'analysis_library' | 'analysis_favorites' | 'analysis_recent' | 'analysis_saved';

const TITLES: Record<AnalysisPage, { title: string; subtitle: string }> = {
  analysis:           { title: 'Analyse & Rapports', subtitle: "Vue d'ensemble pilotage et reporting" },
  analysis_library:   { title: 'Bibliothèque',       subtitle: '30+ rapports organisés par catégorie' },
  analysis_favorites: { title: 'Mes favoris',        subtitle: 'Rapports épinglés pour accès rapide' },
  analysis_recent:    { title: 'Récents',            subtitle: 'Vos 10 derniers rapports consultés' },
  analysis_saved:     { title: 'Vues sauvegardées',  subtitle: 'Rapports + filtres mémorisés' },
};

export interface AnalysisLayoutProps {
  activePage: AnalysisPage;
  onNavigateSubPage?: (page: AnalysisPage) => void;
}

export const AnalysisLayout: React.FC<AnalysisLayoutProps> = ({ activePage, onNavigateSubPage }) => {
  const [search, setSearch] = useState('');
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const cfg = TITLES[activePage] ?? TITLES.analysis;

  const openReport = (reportId: string) => {
    pushRecent(reportId);
    setOpenReportId(reportId);
  };

  const closeReport = () => setOpenReportId(null);

  // Recherche → toujours rediriger vers la bibliothèque pour afficher les résultats
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim() && activePage !== 'analysis_library') {
      onNavigateSubPage?.('analysis_library');
    }
  };

  // Si un rapport est ouvert, on remplace tout le contenu par le ReportViewer
  if (openReportId) {
    return (
      <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <ReportViewer reportId={openReportId} onBack={closeReport} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={BarChart3}
          title={cfg.title}
          subtitle={cfg.subtitle}
          actions={
            <form onSubmit={handleSearchSubmit} className="relative w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un rapport… (Cmd+K)"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </form>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {activePage === 'analysis' && <AnalysisDashboard onNavigateSubPage={onNavigateSubPage} onOpenReport={openReport} />}
        {activePage === 'analysis_library' && <ReportLibrary initialSearch={search} onOpenReport={openReport} />}
        {activePage === 'analysis_favorites' && <FavoritesView onNavigateLibrary={() => onNavigateSubPage?.('analysis_library')} onOpenReport={openReport} />}
        {activePage === 'analysis_recent' && <RecentView onNavigateLibrary={() => onNavigateSubPage?.('analysis_library')} onOpenReport={openReport} />}
        {activePage === 'analysis_saved' && <SavedViewsView onNavigateLibrary={() => onNavigateSubPage?.('analysis_library')} onOpenReport={openReport} />}
      </div>
    </div>
  );
};
