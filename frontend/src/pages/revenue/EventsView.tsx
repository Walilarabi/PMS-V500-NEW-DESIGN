/**
 * FLOWTYM RMS — Module Événements (page principale)
 *
 * Architecture stricte (validée par maquette) :
 *   • En-tête : titre + actions (Importer Excel, Ajouter un événement)
 *   • 5 cartes KPI horizontales
 *   • Menu interne horizontal : Liste | Calendrier | Heatmap | Vacances scolaires
 *   • Layout 2 colonnes (Liste & Calendrier uniquement) :
 *       - colonne principale : vue active
 *       - panneau droit (320 px) : mini-calendrier vacances + heatmap pays + recherche
 *   • Heatmap & Vacances scolaires : vue pleine largeur
 *
 * Conserve les deux menus globaux de Flowtym (vertical gauche + horizontal haut).
 * AUCUN second menu latéral interne dans la page.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, CalendarDays, Database, Euro, FileDown, FileSpreadsheet,
  Filter, Flame, History, LineChart, List, Plus, RotateCcw, Search, Sparkles,
  Upload, Users, X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { useEventsStore } from '@/src/store/eventsStore';
import { useConfigStore } from '@/src/store/configStore';
import type { EventCategory, EventImpactLevel, RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import { EventsList } from './events/EventsList';
import { EventsCalendar } from './events/EventsCalendar';
import { EventDetailPanel } from './events/EventDetailPanel';
import { EventImportModal } from './events/EventImportModal';
import { EventEditorModal } from './events/EventEditorModal';
import { EventValidationModal } from './events/EventValidationModal';
import { EventsRightPanel } from './events/EventsRightPanel';
import { EventsHeatmapView } from './events/EventsHeatmapView';
import { EventSchoolHolidaysView } from './events/EventSchoolHolidaysView';
import { EventLiveSearchModal } from './events/EventLiveSearchModal';
import { EventSearchPanel } from './events/EventSearchPanel';
import { EventsHistory } from './events/EventsHistory';
import { KpiTile } from './events/components/KpiTile';
import { YearSelector } from './events/components/YearSelector';
import { EventsNotificationBanner } from './events/components/EventsNotificationBanner';
import { CountryFlag } from './events/components/CountryFlag';
import { useEventSourcesAutoSync } from '@/src/hooks/useEventSourcesAutoSync';
import { exportEventsToExcel, exportEventsToPDF } from '@/src/services/event-export.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'list' | 'calendar' | 'heatmap' | 'holidays' | 'sources' | 'history';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'list',     label: 'Liste',              icon: List      },
  { id: 'calendar', label: 'Calendrier',         icon: CalendarDays },
  { id: 'heatmap',  label: 'Heatmap',            icon: Flame     },
  { id: 'holidays', label: 'Vacances scolaires', icon: Calendar  },
  { id: 'sources',  label: 'Sources & API',      icon: Database  },
  { id: 'history',  label: 'Import & Historique',icon: History   },
];

const STORAGE_TAB_KEY = 'flowtym_events_last_tab';

const QUICK_IMPACTS: { key: EventImpactLevel | 'all'; label: string }[] = [
  { key: 'all',      label: 'Tous' },
  { key: 'critical', label: 'Critique' },
  { key: 'high',     label: 'Fort' },
  { key: 'medium',   label: 'Moyen' },
  { key: 'low',      label: 'Faible' },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export const EventsView: React.FC = () => {
  const {
    filters, setFilters, resetFilters, getKpis, getFilteredEvents,
    pendingValidation, clearPendingValidation,
  } = useEventsStore();
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelCity = useConfigStore((s) => s.hotel.city);

  const [tab, setTabRaw] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAB_KEY);
      const valid: Tab[] = ['list', 'calendar', 'heatmap', 'holidays', 'sources', 'history'];
      return valid.includes(saved as Tab) ? (saved as Tab) : 'list';
    } catch { return 'list'; }
  });
  function setTab(t: Tab) {
    setTabRaw(t);
    try { localStorage.setItem(STORAGE_TAB_KEY, t); } catch { /* storage unavailable */ }
  }
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selected, setSelected] = useState<RMSMarketEvent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; initial?: RMSMarketEvent | null; defaultDate?: string }>({ open: false });
  const [validationOpen, setValidationOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [liveSearchOpen, setLiveSearchOpen] = useState(false);

  useEventSourcesAutoSync();
  const kpis = useMemo(() => getKpis(), [getKpis]);
  const lastSearchAt = useEventsStore((s) => s.lastSearchAt);

  // KPI Visiteurs estimés (somme des estimatedVisitors filtrés)
  const filteredEvents = getFilteredEvents();
  const estimatedVisitors = useMemo(
    () => filteredEvents.reduce((acc, e) => acc + (e.estimatedVisitors ?? 0), 0),
    [filteredEvents],
  );

  // Notification discrète à la place de l'ouverture automatique de la modale.
  // L'utilisateur peut ouvrir/masquer manuellement.
  const [notifDismissed, setNotifDismissed] = useState(false);
  useEffect(() => { if (lastSearchAt) setNotifDismissed(false); }, [lastSearchAt]);
  const showNotif = !notifDismissed && pendingValidation.length > 0;

  // Année sélectionnée — dérivée des filtres de dates ; fallback année en cours.
  const currentYear = new Date().getFullYear();
  const activeYear = useMemo<number>(() => {
    if (!filters.fromDate) return currentYear;
    const y = filters.fromDate.substring(0, 4);
    return Number(y) || currentYear;
  }, [filters.fromDate, currentYear]);

  // Sélection d'année : initialise une fenêtre 01/01–31/12 (synchronise
  // automatiquement liste, calendrier, heatmap, vacances scolaires).
  function selectYear(y: number) {
    setFilters({ fromDate: `${y}-01-01`, toDate: `${y}-12-31` });
  }

  // Au premier chargement, force l'année en cours si aucune fenêtre n'est définie.
  useEffect(() => {
    if (!filters.fromDate && !filters.toDate) selectYear(currentYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleLaunchSearch(query: string) {
    if (query.trim()) setFilters({ search: query.trim() });
    setLiveSearchOpen(true);
  }

  const showRightPanel = tab === 'list' || tab === 'calendar';
  const showFilters    = tab === 'list' || tab === 'calendar';
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-5 pb-10 space-y-4 max-w-[1600px] mx-auto">

        {/* ─── 1. EN-TÊTE ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <RevenueHeader
            icon={Calendar}
            title="Événements"
            subtitle="Anticipez et maximisez votre performance grâce à la veille événementielle."
            className="mb-0"
            actions={null}
          />
          <div className="flex items-center gap-2 relative">
            <YearSelector value={activeYear} onChange={selectYear} />
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
                        <div className="text-[11px] text-slate-400">Rapport premium réunion RM</div>
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
              <Upload className="w-3.5 h-3.5" /> Importer Excel
            </button>
            <button
              onClick={() => setEditor({ open: true })}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un événement
            </button>
          </div>
        </div>

        {/* ─── 2. KPI CARDS (5 cards) ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiTile icon={CalendarDays} tone="violet"  label="Événements à venir"     value={kpis.upcoming}                       hint="+8 ce mois-ci" />
          <KpiTile icon={AlertCircle}  tone="rose"    label="Événements à fort impact" value={kpis.critical}                   hint="+3 ce mois-ci" />
          <KpiTile icon={Euro}         tone="emerald" label="Impact ADR estimé"      value={`+${kpis.influencedAdrPct}%`}      hint="Moyenne pondérée" />
          <KpiTile icon={LineChart}    tone="amber"   label="Impact RevPAR estimé"   value={`+${kpis.influencedRevparPct} pts`} hint="Moyenne pondérée" />
          <KpiTile icon={Users}        tone="sky"     label="Visiteurs estimés"      value={formatBigNumber(estimatedVisitors)} hint="Sur les 90 prochains jours" />
        </div>

        {/* ─── Notification discrète (pas de modale auto) ──────────────────── */}
        {showNotif && (
          <EventsNotificationBanner
            count={pendingValidation.length}
            lastSearchAt={lastSearchAt}
            onOpen={() => setValidationOpen(true)}
            onDismiss={() => setNotifDismissed(true)}
          />
        )}

        {/* ─── 3. MENU HORIZONTAL INTERNE ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm">
          <div className="flex items-center gap-1 px-3 border-b border-slate-100">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors',
                    active
                      ? 'text-violet-700'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                  {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-violet-600 rounded-t" />}
                </button>
              );
            })}
          </div>

          {/* Filtres rapides (Liste & Calendrier uniquement) */}
          {showFilters && (
            <div className="px-4 py-3 space-y-2.5">
              {/* Recherche */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex-1 min-w-[260px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ search: e.target.value })}
                    placeholder="Rechercher un événement, lieu, ville, catégorie…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-400 outline-none text-[13px]"
                  />
                </div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={cn(
                    'px-3 py-2 rounded-lg ring-1 text-[12px] font-medium flex items-center gap-1.5 shrink-0',
                    showAdvanced
                      ? 'bg-violet-50 text-violet-700 ring-violet-200'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  <Filter className="w-3.5 h-3.5" /> Filtres avancés
                </button>
                <button
                  onClick={() => { resetFilters(); }}
                  className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                </button>
              </div>

              {/* Rangée filtres principaux : Pays / Ville / Catégorie / Impact / Statut */}
              <FilterRow filters={filters} setFilters={setFilters} />

              {/* Impacts rapides (l'année est gérée en haut via YearSelector) */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium">Impact</span>
                <div className="flex items-center gap-1">
                  {QUICK_IMPACTS.map((q) => {
                    const active = filters.minImpact === q.key || (q.key === 'all' && !filters.minImpact);
                    return (
                      <button
                        key={q.key}
                        onClick={() => setFilters({ minImpact: q.key === 'all' ? undefined : (q.key as EventImpactLevel) })}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[11px] font-medium ring-1',
                          active
                            ? 'bg-violet-50 text-violet-700 ring-violet-200'
                            : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 4-6. CORPS PRINCIPAL ───────────────────────────────────────── */}
        {showAdvanced && showFilters && (
          <AdvancedFilters onClose={() => setShowAdvanced(false)} onReset={resetFilters} />
        )}

        {/* Sources & API — pleine largeur */}
        {tab === 'sources' && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
            <EventSearchPanel open={true} onToggle={() => setTab('list')} />
          </div>
        )}

        {/* Import & Historique — pleine largeur */}
        {tab === 'history' && <EventsHistory />}

        {tab !== 'sources' && tab !== 'history' && (
        <div className={cn('flex gap-4 items-start', !showRightPanel && 'block')}>
          <div className="flex-1 min-w-0 space-y-4">
            {tab === 'list' && <EventsList onSelect={setSelected} />}
            {tab === 'calendar' && (
              <EventsCalendar
                onSelectEvent={setSelected}
                onCreate={(date) => setEditor({ open: true, defaultDate: date })}
              />
            )}
            {tab === 'heatmap'  && <EventsHeatmapView />}
            {tab === 'holidays' && <EventSchoolHolidaysView year={activeYear} onImportEvents={() => setValidationOpen(true)} />}

            <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-white/80 ring-1 ring-slate-100 rounded-2xl px-4 py-3 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
              <span>
                Chaque événement validé alimente automatiquement le RMS, l'autopilote, le calendrier tarifaire et les alertes.
              </span>
            </div>
          </div>

          {showRightPanel && (
            <EventsRightPanel
              year={activeYear}
              onLaunchSearch={handleLaunchSearch}
            />
          )}
        </div>
        )} {/* end tab !== sources && tab !== history */}

      </div>

      {/* ─── BARRE DE STATUT INFÉRIEURE ──────────────────────────────────────── */}
      <EventsStatusBar />

      {/* ─── PANNEAUX & MODALES ─────────────────────────────────────────────── */}
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
        onClose={() => { setValidationOpen(false); clearPendingValidation(); }}
      />
      <EventLiveSearchModal
        open={liveSearchOpen}
        onClose={() => setLiveSearchOpen(false)}
        onImportEvents={() => setValidationOpen(true)}
      />
    </div>
  );
};

// ─── Barre de statut inférieure ──────────────────────────────────────────────

function EventsStatusBar() {
  const { syncLogs, sources, lastSearchAt } = useEventsStore();
  const activeSources = sources.filter((s) => s.active).length;
  const lastLog = syncLogs[0];
  const autoSync = useEventsStore((s) => s.autoSync);

  function formatSyncTime(iso?: string): string {
    if (!iso) return 'Jamais';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      + ', ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function handleDailyReport() {
    const events = useEventsStore.getState().getFilteredEvents();
    import('@/src/services/event-export.service').then(({ exportEventsToPDF }) => {
      const ctx = {
        hotelName: '',
        city: 'Paris',
        fileBaseName: `flowtym_rapport_quotidien_${new Date().toISOString().slice(0, 10)}`,
        kpis: { upcoming: 0, critical: 0, influencedAdrPct: 0, influencedRevparPct: 0 },
      };
      exportEventsToPDF(events, ctx);
    });
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-slate-500">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Dernière synchronisation */}
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400">Dernière synchronisation :</span>
          <strong className="text-slate-700 tabular-nums">
            {formatSyncTime(lastSearchAt ?? lastLog?.at)}
          </strong>
        </span>
        <span className="text-slate-200">·</span>
        {/* Moteur */}
        <span className="flex items-center gap-1.5">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            autoSync ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-slate-300',
          )} />
          <span className={autoSync ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
            Moteur de recherche {autoSync ? 'actif' : 'inactif'}
          </span>
        </span>
        <span className="text-slate-200">·</span>
        {/* Sources */}
        <span className="flex items-center gap-1">
          <span className="text-slate-400">Sources actives :</span>
          <strong className="text-slate-700 tabular-nums">{activeSources}</strong>
        </span>
        {lastLog && lastLog.pending > 0 && (
          <>
            <span className="text-slate-200">·</span>
            <span className="flex items-center gap-1 text-violet-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              {lastLog.pending} nouveau{lastLog.pending > 1 ? 'x' : ''} détecté{lastLog.pending > 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
      <button
        onClick={handleDailyReport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 hover:ring-violet-300 hover:text-violet-700 transition-all"
      >
        <FileDown className="w-3.5 h-3.5" />
        Rapport quotidien
      </button>
    </div>
  );
}

// ─── Rangée filtres principaux ────────────────────────────────────────────────

function FilterRow({
  filters, setFilters,
}: {
  filters: ReturnType<typeof useEventsStore.getState>['filters'];
  setFilters: (patch: Partial<ReturnType<typeof useEventsStore.getState>['filters']>) => void;
}) {
  const allEvents = useEventsStore((s) => s.events);

  const countries = useMemo(() => Array.from(new Set(allEvents.map((e) => e.country).filter(Boolean))).sort(), [allEvents]);
  const cities    = useMemo(() => Array.from(new Set(allEvents.map((e) => e.city).filter(Boolean))).sort(),    [allEvents]);
  const allCategories = Object.keys(CATEGORY_LABELS) as EventCategory[];

  const cityValue     = filters.cities?.[0]     ?? '';
  const countryValue  = filters.countries?.[0]  ?? '';
  const catValue      = filters.categories?.[0] ?? '';

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <FilterField label="Pays">
        <div className="flex items-center gap-1.5 rounded-lg ring-1 ring-slate-200 bg-white px-1.5 py-0.5 focus-within:ring-violet-400">
          {countryValue ? <CountryFlag code={countryValue} size="xs" /> : <span className="w-[22px] h-4 rounded-sm bg-slate-100 ring-1 ring-slate-200" />}
          <select
            value={countryValue}
            onChange={(e) => setFilters({ countries: e.target.value ? [e.target.value] : [] })}
            className="w-full px-1 py-1 text-[12px] bg-white outline-none border-0 cursor-pointer"
          >
            <option value="">Tous les pays</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </FilterField>
      <FilterField label="Ville">
        <select
          value={cityValue}
          onChange={(e) => setFilters({ cities: e.target.value ? [e.target.value] : [] })}
          className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white outline-none focus:ring-violet-400"
        >
          <option value="">Toutes</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </FilterField>
      <FilterField label="Catégorie">
        <select
          value={catValue}
          onChange={(e) => setFilters({ categories: e.target.value ? [e.target.value as EventCategory] : [] })}
          className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white outline-none focus:ring-violet-400"
        >
          <option value="">Toutes</option>
          {allCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
      </FilterField>
      <FilterField label="Impact min.">
        <select
          value={filters.minImpact ?? ''}
          onChange={(e) => setFilters({ minImpact: (e.target.value || undefined) as EventImpactLevel | undefined })}
          className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white outline-none focus:ring-violet-400"
        >
          <option value="">Tous</option>
          {(['very_low', 'low', 'medium', 'high', 'critical', 'hyper_compression'] as EventImpactLevel[]).map((l) =>
            <option key={l} value={l}>{IMPACT_LABELS[l]}</option>,
          )}
        </select>
      </FilterField>
      <FilterField label="Statut">
        <select
          value={filters.activeOnly ? 'active' : 'all'}
          onChange={(e) => setFilters({ activeOnly: e.target.value === 'active' })}
          className="w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] bg-white outline-none focus:ring-violet-400"
        >
          <option value="all">Tous</option>
          <option value="active">Actifs uniquement</option>
        </select>
      </FilterField>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">{label}</div>
      {children}
    </div>
  );
}

// ─── Filtres avancés ──────────────────────────────────────────────────────────

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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Catégories (multi)</div>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  const on = filters.categories.includes(c);
                  setFilters({ categories: on ? filters.categories.filter((x) => x !== c) : [...filters.categories, c] });
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBigNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
