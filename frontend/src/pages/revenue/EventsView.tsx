/**
 * FLOWTYM RMS — Module Événements (page principale).
 *
 * Centre intelligent de gestion des événements marché. Sous-module premium
 * du module Revenue, intégré au moteur RMS Flowtym :
 *   • la pression marché, les recommandations, alertes, stratégies,
 *     l'agressivité pricing et l'autopilote sont alimentés directement
 *     depuis ce module via useEventsStore.
 *
 * Structure :
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Header — titre, KPIs, recherche, filtres, Importer, Ajouter     │
 *   ├──────────────────────────────────────────┬──────────────────────┤
 *   │  Vue Liste │ Vue Calendrier (toggle)     │  Panneau Recherche   │
 *   │  Filtres rapides + tableau / calendrier  │  (moteur multi-src)  │
 *   └──────────────────────────────────────────┴──────────────────────┘
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Calendar, CalendarDays, CalendarRange, Euro, FileDown, FileSpreadsheet, Filter,
  LineChart, List, Plus, Search, Sparkles, Upload, X, Gauge, ListChecks,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { useEventsStore } from '@/src/store/eventsStore';
import { useConfigStore } from '@/src/store/configStore';
import type { EventCategory, EventImpactLevel, RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import { EventsList } from './events/EventsList';
import { EventsCalendar } from './events/EventsCalendar';
import { EventsHistory } from './events/EventsHistory';
import { EventDetailPanel } from './events/EventDetailPanel';
import { EventSearchPanel } from './events/EventSearchPanel';
import { EventImportModal } from './events/EventImportModal';
import { EventEditorModal } from './events/EventEditorModal';
import { EventValidationModal } from './events/EventValidationModal';
import { KpiTile } from './events/components/KpiTile';
import { MarketIntelligenceDashboard } from './events/intelligence/MarketIntelligenceDashboard';
import { RecommendationsInbox } from './events/intelligence/RecommendationsInbox';
import { useEventSourcesAutoSync } from '@/src/hooks/useEventSourcesAutoSync';
import { exportEventsToExcel, exportEventsToPDF } from '@/src/services/event-export.service';

type ViewMode = 'list' | 'calendar' | 'history' | 'intelligence' | 'recos';

export const EventsView: React.FC = () => {
  const {
    filters, setFilters, resetFilters, getKpis, getFilteredEvents,
    pendingValidation, clearPendingValidation,
  } = useEventsStore();
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelCity = useConfigStore((s) => s.hotel.city);

  const [view, setView] = useState<ViewMode>('calendar');
  const [showFilters, setShowFilters] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);

  // Auto-sync des sources événementielles (respecte autoSync du store +
  // fréquence configurée par source + pause sur visibilité).
  useEventSourcesAutoSync();

  const [selected, setSelected] = useState<RMSMarketEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; initial?: RMSMarketEvent | null; defaultDate?: string }>({ open: false });
  const [validationOpen, setValidationOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const kpis = useMemo(() => getKpis(), [getKpis]);

  const lastSearchAt = useEventsStore((s) => s.lastSearchAt);

  // Ouvre la modale de validation après chaque recherche qui remonte des
  // candidats — on s'abonne à lastSearchAt (et pas à la longueur du tableau)
  // pour rouvrir la modale même si la recherche renvoie le même nombre
  // d'événements qu'une recherche précédente.
  useEffect(() => {
    if (lastSearchAt && pendingValidation.length > 0) {
      setValidationOpen(true);
    }
  }, [lastSearchAt, pendingValidation.length]);

  function handleExport(kind: 'excel' | 'pdf') {
    const events = getFilteredEvents();
    const ctx = {
      hotelName,
      city: hotelCity,
      fileBaseName: `flowtym_evenements_${(hotelCity || 'paris').toLowerCase()}`,
      kpis: {
        upcoming: kpis.upcoming,
        critical: kpis.critical,
        influencedAdrPct: kpis.influencedAdrPct,
        influencedRevparPct: kpis.influencedRevparPct,
      },
    };
    if (kind === 'excel') exportEventsToExcel(events, ctx);
    else exportEventsToPDF(events, ctx);
    setExportMenuOpen(false);
  }

  const QUICK_FILTERS: { key: EventImpactLevel | 'all'; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'critical', label: 'Critique' },
    { key: 'high', label: 'Fort' },
    { key: 'medium', label: 'Moyen' },
    { key: 'low', label: 'Faible' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        {/* ─── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <RevenueHeader
            icon={Calendar}
            title="Événements"
            subtitle="Visualisez et anticipez les événements impactant votre marché."
            className="mb-0"
            actions={null}
          />
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                Exporter
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 z-20 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg py-1 text-[13px]">
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-medium text-slate-900">Exporter en Excel</div>
                        <div className="text-[11px] text-slate-400">Couleurs d'impact + filtres</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4 text-rose-600" />
                      <div>
                        <div className="font-medium text-slate-900">Exporter en PDF</div>
                        <div className="text-[11px] text-slate-400">Document premium pour réunion RM</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setImportOpen(true)}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Importer
            </button>
            <button
              onClick={() => setEditor({ open: true })}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un événement
            </button>
          </div>
        </div>

        {/* ─── KPIs ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            icon={CalendarDays}
            tone="violet"
            label="Événements à venir"
            value={kpis.upcoming}
            hint="+8 ce mois-ci"
          />
          <KpiTile
            icon={AlertCircle}
            tone="rose"
            label="Impact fort / critique"
            value={kpis.critical}
            hint="+3 ce mois-ci"
          />
          <KpiTile
            icon={Euro}
            tone="emerald"
            label="Impact ADR estimé"
            value={`+${kpis.influencedAdrPct}%`}
            hint="Moyenne pondérée"
          />
          <KpiTile
            icon={LineChart}
            tone="amber"
            label="Impact TO estimé"
            value={`+${kpis.influencedRevparPct} pts`}
            hint="Moyenne pondérée"
          />
        </div>

        {/* ─── TOOLBAR ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          {/* View toggle */}
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-1.5 text-[12.5px] font-medium rounded-md flex items-center gap-1.5',
                view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <List className="w-3.5 h-3.5" /> Vue liste
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'px-3 py-1.5 text-[12.5px] font-medium rounded-md flex items-center gap-1.5',
                view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Vue calendrier
            </button>
            <button
              onClick={() => setView('history')}
              className={cn(
                'px-3 py-1.5 text-[12.5px] font-medium rounded-md flex items-center gap-1.5',
                view === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Historique
            </button>
            <button
              onClick={() => setView('intelligence')}
              className={cn(
                'px-3 py-1.5 text-[12.5px] font-medium rounded-md flex items-center gap-1.5 relative',
                view === 'intelligence' ? 'bg-white text-violet-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
              title="Intelligence Marché — compression, vélocité, recommandations RMS"
            >
              <Gauge className="w-3.5 h-3.5" /> Intelligence
              <span className="text-[9px] uppercase font-bold tracking-wide bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-px rounded-sm">
                Pro
              </span>
            </button>
            <button
              onClick={() => setView('recos')}
              className={cn(
                'px-3 py-1.5 text-[12.5px] font-medium rounded-md flex items-center gap-1.5 relative',
                view === 'recos' ? 'bg-white text-amber-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
              title="Inbox des recommandations RMS — toutes dates, filtrables, actions par lot"
            >
              <ListChecks className="w-3.5 h-3.5" /> Recos RMS
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Rechercher un événement…"
              className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none text-[13px]"
            />
          </div>

          {/* Quick filters */}
          <div className="flex items-center gap-1.5">
            {QUICK_FILTERS.map((q) => (
              <button
                key={q.key}
                onClick={() =>
                  setFilters({ minImpact: q.key === 'all' ? undefined : (q.key as EventImpactLevel) })
                }
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[12px] font-medium ring-1',
                  filters.minImpact === q.key || (q.key === 'all' && !filters.minImpact)
                    ? 'bg-violet-50 text-violet-700 ring-violet-200'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[12.5px] font-medium flex items-center gap-1.5',
              showFilters ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <Filter className="w-3.5 h-3.5" /> Filtres
          </button>
        </div>

        {/* Advanced filters drawer */}
        {showFilters && (
          <AdvancedFilters onClose={() => setShowFilters(false)} onReset={resetFilters} />
        )}

        {/* ─── BODY ──────────────────────────────────────────────────── */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            {view === 'list' && <EventsList onSelect={(e) => setSelected(e)} />}
            {view === 'calendar' && (
              <EventsCalendar
                onSelectEvent={(e) => setSelected(e)}
                onCreate={(date) => setEditor({ open: true, defaultDate: date })}
              />
            )}
            {view === 'history' && <EventsHistory />}
            {view === 'intelligence' && <MarketIntelligenceDashboard />}
            {view === 'recos' && <RecommendationsInbox />}

            {/* Footer info */}
            <div className="mt-4 flex items-start gap-2 text-[12px] text-slate-500 bg-white/80 ring-1 ring-slate-100 rounded-2xl px-4 py-3">
              <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5" />
              <span>
                Les événements impactent automatiquement vos recommandations tarifaires, la pression marché et vos alertes.
              </span>
              <a className="ml-auto text-[12px] font-medium text-violet-600 hover:underline cursor-pointer">
                En savoir plus sur l'impact des événements →
              </a>
            </div>
          </div>

          <EventSearchPanel open={searchOpen} onToggle={() => setSearchOpen((v) => !v)} />
        </div>
      </div>

      {/* Modals & drawers */}
      <EventDetailPanel
        event={selected}
        onClose={() => setSelected(null)}
        onEdit={(ev) => { setSelected(null); setEditor({ open: true, initial: ev }); }}
      />
      <EventImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <EventEditorModal
        open={editor.open}
        initial={editor.initial}
        defaultDate={editor.defaultDate}
        onClose={() => setEditor({ open: false })}
      />
      <EventValidationModal
        open={validationOpen && pendingValidation.length > 0}
        candidates={pendingValidation}
        onClose={() => {
          setValidationOpen(false);
          clearPendingValidation();
        }}
      />
    </div>
  );
};

// ─── Advanced Filters ─────────────────────────────────────────────────────

function AdvancedFilters({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { filters, setFilters } = useEventsStore();
  const allCategories = Object.keys(CATEGORY_LABELS) as EventCategory[];
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-slate-900">Filtres avancés</h4>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-[12px] text-slate-500 hover:text-slate-700">Réinitialiser</button>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Catégorie</div>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  const isOn = filters.categories.includes(c);
                  setFilters({
                    categories: isOn ? filters.categories.filter((x) => x !== c) : [...filters.categories, c],
                  });
                }}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-medium ring-1',
                  filters.categories.includes(c)
                    ? 'bg-violet-50 text-violet-700 ring-violet-200'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Période</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.fromDate ?? ''}
              onChange={(e) => setFilters({ fromDate: e.target.value || undefined })}
              className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px]"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={filters.toDate ?? ''}
              onChange={(e) => setFilters({ toDate: e.target.value || undefined })}
              className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px]"
            />
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Impact minimum</div>
          <select
            value={filters.minImpact ?? ''}
            onChange={(e) => setFilters({ minImpact: (e.target.value || undefined) as EventImpactLevel | undefined })}
            className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white"
          >
            <option value="">Tous</option>
            {(['very_low', 'low', 'medium', 'high', 'critical', 'hyper_compression'] as EventImpactLevel[]).map((l) =>
              <option key={l} value={l}>{IMPACT_LABELS[l]}</option>,
            )}
          </select>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Options</div>
          <label className="flex items-center gap-2 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={filters.activeOnly}
              onChange={(e) => setFilters({ activeOnly: e.target.checked })}
              className="w-3.5 h-3.5 accent-violet-600"
            />
            Événements actifs uniquement
          </label>
        </div>
      </div>
    </div>
  );
}
