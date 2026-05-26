/**
 * FLOWTYM RMS — Module Événements
 *
 * Architecture à 3 sections clairement séparées :
 *   • Événements       — calendrier, liste, intelligence RM, recos, historique
 *   • Vacances scolaires — calendrier officiel France 2024 → 2027
 *   • Recherche Live     — Ticketmaster · OpenAgenda en temps réel
 *
 * Navigation : panneau gauche fixe (200 px) + contenu scrollable.
 * Filtres     : barre horizontale contextuelle, uniquement section Événements.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Backpack, Calendar, CalendarDays, CalendarRange, ChevronRight,
  Euro, FileDown, FileSpreadsheet, Filter, Gauge, LineChart, List, ListChecks,
  Plus, Radio, Search, Sparkles, Upload, X,
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
import { EventLiveSearchView } from './events/EventLiveSearchView';
import { EventSchoolHolidaysView } from './events/EventSchoolHolidaysView';
import { useEventSourcesAutoSync } from '@/src/hooks/useEventSourcesAutoSync';
import { exportEventsToExcel, exportEventsToPDF } from '@/src/services/event-export.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type MainSection  = 'events' | 'holidays' | 'livesearch';
type EventSubView = 'calendar' | 'list' | 'intelligence' | 'recos' | 'history';

const EVENT_SUB_VIEWS: {
  id: EventSubView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  title?: string;
}[] = [
  { id: 'calendar',     label: 'Calendrier',     icon: CalendarDays },
  { id: 'list',         label: 'Liste',           icon: List },
  { id: 'intelligence', label: 'Intelligence RM', icon: Gauge,       badge: 'Pro', title: 'Compression, vélocité, recommandations RMS' },
  { id: 'recos',        label: 'Recos RMS',       icon: ListChecks,               title: 'Inbox recommandations — toutes dates' },
  { id: 'history',      label: 'Historique',      icon: CalendarRange },
];

const QUICK_FILTERS: { key: EventImpactLevel | 'all'; label: string }[] = [
  { key: 'all',      label: 'Tous' },
  { key: 'critical', label: 'Critique' },
  { key: 'high',     label: 'Fort' },
  { key: 'medium',   label: 'Moyen' },
  { key: 'low',      label: 'Faible' },
];

const YEAR_PRESETS = [2024, 2025, 2026, 2027] as const;

// ─── Panneau de navigation gauche ────────────────────────────────────────────

function ModuleNav({
  section,
  onSection,
  eventsView,
  onEventsView,
}: {
  section: MainSection;
  onSection: (s: MainSection) => void;
  eventsView: EventSubView;
  onEventsView: (v: EventSubView) => void;
}) {
  return (
    <nav
      aria-label="Navigation module événements"
      className="w-52 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-y-auto"
    >
      <div className="px-3 pt-5 pb-6 flex flex-col gap-0.5">

        {/* ── Événements ─────────────────── */}
        <button
          onClick={() => onSection('events')}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-colors',
            section === 'events'
              ? 'bg-violet-50 text-violet-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Événements</span>
          {section !== 'events' && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {section === 'events' && (
          <div className="ml-3 flex flex-col gap-0.5 mt-0.5 mb-1">
            {EVENT_SUB_VIEWS.map((sv) => {
              const active = eventsView === sv.id;
              return (
                <button
                  key={sv.id}
                  onClick={() => onEventsView(sv.id)}
                  title={sv.title}
                  className={cn(
                    'w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-[12px] transition-colors',
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-100 font-medium'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                  )}
                >
                  <sv.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">{sv.label}</span>
                  {sv.badge && (
                    <span className="text-[8px] uppercase font-bold tracking-wide bg-gradient-to-r from-violet-600 to-indigo-500 text-white px-1 py-px rounded">
                      {sv.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Vacances scolaires ──────────── */}
        <div className="pt-2">
          <div className="h-px bg-slate-100 mb-2" />
          <button
            onClick={() => onSection('holidays')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-colors',
              section === 'holidays'
                ? 'bg-rose-50 text-rose-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <Backpack className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left leading-tight">Vacances scolaires</span>
            {section !== 'holidays' && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {/* ── Recherche Live ──────────────── */}
        <div className="pt-2">
          <div className="h-px bg-slate-100 mb-2" />
          <button
            onClick={() => onSection('livesearch')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-colors',
              section === 'livesearch'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <Radio className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Recherche Live</span>
            {section !== 'livesearch' && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

      </div>
    </nav>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export const EventsView: React.FC = () => {
  const {
    filters, setFilters, resetFilters, getKpis, getFilteredEvents,
    pendingValidation, clearPendingValidation,
  } = useEventsStore();
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelCity = useConfigStore((s) => s.hotel.city);

  const [section,   setSection]   = useState<MainSection>('events');
  const [eventsView, setEventsView] = useState<EventSubView>('calendar');
  const [showFilters, setShowFilters] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);
  const [selected, setSelected] = useState<RMSMarketEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editor, setEditor] = useState<{
    open: boolean; initial?: RMSMarketEvent | null; defaultDate?: string;
  }>({ open: false });
  const [validationOpen, setValidationOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEventSourcesAutoSync();
  const kpis = useMemo(() => getKpis(), [getKpis]);
  const lastSearchAt = useEventsStore((s) => s.lastSearchAt);

  useEffect(() => {
    if (lastSearchAt && pendingValidation.length > 0) setValidationOpen(true);
  }, [lastSearchAt, pendingValidation.length]);

  // Déduit l'année active depuis les filtres dates (ex: 2026-01-01 → 2026-12-31 = année 2026)
  const activeYear = useMemo<number | undefined>(() => {
    if (!filters.fromDate) return undefined;
    const y = filters.fromDate.substring(0, 4);
    return (filters.fromDate === `${y}-01-01` && filters.toDate === `${y}-12-31`)
      ? Number(y) : undefined;
  }, [filters.fromDate, filters.toDate]);

  function selectYear(y: number | undefined) {
    if (!y) setFilters({ fromDate: undefined, toDate: undefined });
    else     setFilters({ fromDate: `${y}-01-01`, toDate: `${y}-12-31` });
  }

  function handleSetSection(s: MainSection) {
    setSection(s);
    setExportMenuOpen(false);
    setShowFilters(false);
  }

  function handleExport(kind: 'excel' | 'pdf') {
    const events = getFilteredEvents();
    const ctx = {
      hotelName, city: hotelCity,
      fileBaseName: `flowtym_evenements_${(hotelCity || 'paris').toLowerCase()}`,
      kpis: {
        upcoming: kpis.upcoming, critical: kpis.critical,
        influencedAdrPct: kpis.influencedAdrPct, influencedRevparPct: kpis.influencedRevparPct,
      },
    };
    if (kind === 'excel') exportEventsToExcel(events, ctx);
    else                  exportEventsToPDF(events, ctx);
    setExportMenuOpen(false);
  }

  return (
    <div className="flex-1 overflow-hidden flex">

      {/* ─── PANNEAU NAVIGATION GAUCHE ────────────────────────────────────── */}
      <ModuleNav
        section={section}
        onSection={handleSetSection}
        eventsView={eventsView}
        onEventsView={setEventsView}
      />

      {/* ─── CONTENU PRINCIPAL (scrollable) ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60">

        {/* ══ SECTION : ÉVÉNEMENTS ══════════════════════════════════════════ */}
        {section === 'events' && (
          <div className="px-6 pt-5 pb-10 space-y-4">

            {/* En-tête + boutons d'action */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <RevenueHeader
                icon={Calendar}
                title="Événements"
                subtitle="Visualisez et anticipez les événements impactant votre marché."
                className="mb-0"
                actions={null}
              />
              <div className="flex items-center gap-2 relative">
                {/* Export */}
                <div className="relative">
                  <button
                    onClick={() => setExportMenuOpen((v) => !v)}
                    className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Exporter
                  </button>
                  {exportMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-56 z-20 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg py-1 text-[13px]">
                        <button onClick={() => handleExport('excel')} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <div>
                            <div className="font-medium text-slate-900">Exporter en Excel</div>
                            <div className="text-[11px] text-slate-400">Couleurs d'impact + filtres</div>
                          </div>
                        </button>
                        <button onClick={() => handleExport('pdf')} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
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
                {/* Importer */}
                <button
                  onClick={() => setImportOpen(true)}
                  className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Importer
                </button>
                {/* Ajouter */}
                <button
                  onClick={() => setEditor({ open: true })}
                  className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter un événement
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile icon={CalendarDays} tone="violet"  label="Événements à venir"  value={kpis.upcoming}                    hint="+8 ce mois-ci" />
              <KpiTile icon={AlertCircle}  tone="rose"    label="Impact fort / critique" value={kpis.critical}                 hint="+3 ce mois-ci" />
              <KpiTile icon={Euro}         tone="emerald" label="Impact ADR estimé"    value={`+${kpis.influencedAdrPct}%`}    hint="Moyenne pondérée" />
              <KpiTile icon={LineChart}    tone="amber"   label="Impact TO estimé"     value={`+${kpis.influencedRevparPct} pts`} hint="Moyenne pondérée" />
            </div>

            {/* Barre de filtres */}
            <div className="flex flex-wrap items-center gap-2.5 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">

              {/* Sélecteur d'année */}
              <div className="flex items-center gap-1 shrink-0" aria-label="Filtrer par année">
                <button
                  onClick={() => selectYear(undefined)}
                  className={cn(
                    'px-2 py-1 text-[11.5px] font-medium rounded-md ring-1 transition-all',
                    !activeYear
                      ? 'bg-violet-50 text-violet-700 ring-violet-200'
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  Tous
                </button>
                {YEAR_PRESETS.map((y) => (
                  <button
                    key={y}
                    onClick={() => selectYear(activeYear === y ? undefined : y)}
                    title={y === 2026 ? 'Année en cours' : y < 2026 ? 'Passé' : 'À venir'}
                    className={cn(
                      'px-2 py-1 text-[11.5px] font-bold rounded-md ring-1 transition-all tabular-nums',
                      activeYear === y
                        ? y === 2026
                          ? 'bg-violet-600 text-white ring-violet-600 shadow-sm'
                          : y === 2027
                            ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm'
                            : 'bg-slate-700 text-white ring-slate-700 shadow-sm'
                        : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Recherche texte */}
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  placeholder="Nom, lieu, catégorie…"
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-400 outline-none text-[13px]"
                />
              </div>

              {/* Filtres d'impact rapides */}
              <div className="flex items-center gap-1 shrink-0">
                {QUICK_FILTERS.map((q) => (
                  <button
                    key={q.key}
                    onClick={() =>
                      setFilters({ minImpact: q.key === 'all' ? undefined : (q.key as EventImpactLevel) })
                    }
                    className={cn(
                      'px-2 py-1 rounded-md text-[11.5px] font-medium ring-1 transition-all',
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
                  'px-2.5 py-1.5 rounded-lg ring-1 text-[12px] font-medium flex items-center gap-1.5 shrink-0',
                  showFilters
                    ? 'bg-violet-50 text-violet-700 ring-violet-200'
                    : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                )}
              >
                <Filter className="w-3.5 h-3.5" /> Filtres avancés
              </button>
            </div>

            {/* Tiroir filtres avancés */}
            {showFilters && (
              <AdvancedFilters
                onClose={() => setShowFilters(false)}
                onReset={resetFilters}
              />
            )}

            {/* Corps : vue principale + panneau sources */}
            <div className="flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                {eventsView === 'list'         && <EventsList onSelect={setSelected} />}
                {eventsView === 'calendar'     && (
                  <EventsCalendar
                    onSelectEvent={setSelected}
                    onCreate={(date) => setEditor({ open: true, defaultDate: date })}
                  />
                )}
                {eventsView === 'history'      && <EventsHistory />}
                {eventsView === 'intelligence' && <MarketIntelligenceDashboard />}
                {eventsView === 'recos'        && <RecommendationsInbox />}

                <div className="mt-4 flex items-start gap-2 text-[12px] text-slate-500 bg-white/80 ring-1 ring-slate-100 rounded-2xl px-4 py-3">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                  <span>
                    Les événements impactent automatiquement vos recommandations tarifaires, la pression marché et vos alertes.
                  </span>
                </div>
              </div>
              <EventSearchPanel open={searchOpen} onToggle={() => setSearchOpen((v) => !v)} />
            </div>
          </div>
        )}

        {/* ══ SECTION : VACANCES SCOLAIRES ══════════════════════════════════ */}
        {section === 'holidays' && (
          <div className="px-6 pt-5 pb-10">
            <EventSchoolHolidaysView onImportEvents={() => setValidationOpen(true)} />
          </div>
        )}

        {/* ══ SECTION : RECHERCHE LIVE ══════════════════════════════════════ */}
        {section === 'livesearch' && (
          <div className="px-6 pt-5 pb-10">
            <EventLiveSearchView onImportEvents={() => setValidationOpen(true)} />
          </div>
        )}

      </div>

      {/* ─── PANNEAUX & MODALES ───────────────────────────────────────────── */}
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

// ─── Filtres avancés ──────────────────────────────────────────────────────────

function AdvancedFilters({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { filters, setFilters } = useEventsStore();
  const allCategories = Object.keys(CATEGORY_LABELS) as EventCategory[];
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-slate-900">Filtres avancés</h4>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-[12px] text-slate-500 hover:text-slate-700">
            Réinitialiser
          </button>
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
                    categories: isOn
                      ? filters.categories.filter((x) => x !== c)
                      : [...filters.categories, c],
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
            <span className="text-slate-400 shrink-0">→</span>
            <input
              type="date"
              value={filters.toDate ?? ''}
              onChange={(e) => setFilters({ toDate: e.target.value || undefined })}
              className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px]"
            />
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">
            Impact minimum
          </div>
          <select
            value={filters.minImpact ?? ''}
            onChange={(e) =>
              setFilters({ minImpact: (e.target.value || undefined) as EventImpactLevel | undefined })
            }
            className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white"
          >
            <option value="">Tous</option>
            {(['very_low', 'low', 'medium', 'high', 'critical', 'hyper_compression'] as EventImpactLevel[]).map(
              (l) => <option key={l} value={l}>{IMPACT_LABELS[l]}</option>,
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
