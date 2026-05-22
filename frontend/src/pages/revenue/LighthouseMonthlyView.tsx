/**
 * FLOWTYM — Veille Concurrentielle (Vue mensuelle organisée en onglets)
 *
 * Onglets :
 *   1. Cockpit RMS        → Analyse marché premium (Pulse, alertes, recos, briefing)
 *   2. Marché             → KPIs + Graphique premium (area + line + bars + tooltip)
 *   3. Positionnement     → Vue par-date barchart horizontal (CompsetBarChart)
 *   4. Heatmap Tarifs     → Tableau croisé concurrents × dates
 *   5. Détail jour        → Tableau dense jour par jour
 *   6. Recommandations    → Recos actionnables uniquement (Palier A.5)
 *   7. Briefing           → Compte rendu texte uniquement (Palier A.5)
 *
 * Persistance :
 *   - Import Lighthouse → snapshot versionné (archive ancien, active nouveau)
 *   - Import Salons (Dates Salons) → append-only (préserve historique)
 *   - Hydratation depuis DB au mount pour survivre aux refresh / autres devices
 *
 * Améliorations Palier A :
 *   - Bandeau Lighthouse compact et repliable (LighthouseFileBanner)
 *   - Modal détail journalier premium (PremiumDayDetailModal)
 *
 * Améliorations Palier A.5 :
 *   - Onglets dédiés "Recommandations" et "Briefing" pour aération de la vue Cockpit
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  BarChart3, Upload, AlertCircle, CheckCircle2, Loader2, X,
  FileSpreadsheet, Target, CalendarDays, LineChart, Layers, Table, ListFilter,
  Activity, Sparkles, FileText,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useExpediaStore } from '../../store/expediaStore';
import { parseLighthouseExcel } from '../../services/lighthouse-parser.service';
import { parseExpediaExcel } from '../../services/expedia-parser.service';
import { useSalonsStore } from '../../store/salonsStore';
import { parseSalonsExcel } from '../../services/salons-parser.service';
import { persistLighthouseImport, fetchActiveLighthouseImport } from '../../services/lighthouse-persistence.service';
import { persistSalonEvents, fetchSalonEvents } from '../../services/salon-events.service';
import { CompsetKpiBlock, CompsetBarChart } from './components/CompsetWidgets';
import { PremiumCompsetChart } from './components/PremiumCompsetChart';
import { ComparisonChart } from './components/ComparisonChart';
import { MarketAnalysisCockpit } from './components/MarketAnalysisCockpit';
import { LighthouseFileBanner } from './components/LighthouseFileBanner';
import { PremiumDayDetailModal } from './components/PremiumDayDetailModal';
import type { LighthouseImport } from '../../services/lighthouse-parser.service';
import { findImportForDaysAgo } from '../../services/lighthouse-comparison.service';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

type CompareLabel = 'Hier' | 'J-3' | 'J-7' | 'J-14' | 'J-30';

const COMPARE_DAYS: Record<CompareLabel, number> = {
  'Hier': 1, 'J-3': 3, 'J-7': 7, 'J-14': 14, 'J-30': 30,
};

// ─── Onglets ──────────────────────────────────────────────────────────────

type TabKey = 'cockpit' | 'marche' | 'positionnement' | 'heatmap' | 'detail' | 'recos' | 'briefing';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'cockpit',        label: 'Cockpit RMS',           icon: Activity },
  { key: 'marche',         label: 'Marché',                icon: LineChart },
  { key: 'positionnement', label: 'Positionnement Compset', icon: Target },
  { key: 'heatmap',        label: 'Heatmap Tarifs Compset', icon: Layers },
  { key: 'detail',         label: 'Détail jour par jour',   icon: Table },
  { key: 'recos',          label: 'Recommandations',        icon: Sparkles },
  { key: 'briefing',       label: 'Briefing',               icon: FileText },
];

// ─── Upload Banner Lighthouse (états parsing/error uniquement) ──────────────
// Le bandeau "actif" est désormais géré par LighthouseFileBanner (compact + repliable)

function UploadStatusBanner() {
  const { uploadStatus, uploadError } = useLighthouseStore();

  if (uploadStatus === 'parsing') {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
        <div className="text-sm text-blue-800"><strong>Analyse du fichier Excel en cours…</strong></div>
      </div>
    );
  }

  if (uploadStatus === 'error') {
    return (
      <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-900">Erreur d'import</p>
            <p className="text-red-700 mt-1">{uploadError}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Importez votre fichier Lighthouse
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Pour afficher la veille concurrentielle, importez l'export Excel de votre dernier rapport Lighthouse.
          Les données seront ensuite injectées automatiquement dans le tableau RMS, le détail par date, et tous les indicateurs.
        </p>
        <button
          onClick={onUploadClick}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-2 text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          Importer un fichier Excel Lighthouse
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Le fichier doit contenir au minimum la feuille « Aperçu » avec les colonnes : Jour, Date, Notre prix, Médiane compset, Demande marché.
          Idéalement aussi la feuille « Tarifs » avec les 10 hôtels concurrents.
        </p>
      </div>
    </div>
  );
}

// ─── Vue principale ───────────────────────────────────────────────────────

export const LighthouseMonthlyView: React.FC = () => {
  const { importData, hasData, setImportData, setUploadStatus, clearImport } = useLighthouseStore();
  const expediaStore = useExpediaStore();
  const salonsStore = useSalonsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expediaInputRef = useRef<HTMLInputElement>(null);
  const salonsInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [compsetChartDate, setCompsetChartDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('cockpit');

  // ─── Vue Marché : toggle Données du jour / Comparatif ─────────────────
  const [marcheView, setMarcheView] = useState<'jour' | 'comparatif'>('jour');
  const [compareLabel, setCompareLabel] = useState<CompareLabel>('Hier');
  const [compareData, setCompareData] = useState<LighthouseImport | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const loadCompareData = useCallback(async (label: CompareLabel) => {
    setCompareLoading(true);
    setCompareData(null);
    try {
      const data = await findImportForDaysAgo(COMPARE_DAYS[label]);
      setCompareData(data);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  // ─── Upload Lighthouse ────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadStatus('parsing');
    try {
      const result = await parseLighthouseExcel(file);
      setImportData(result);
      if (result.days.length > 0) {
        setSelectedMonth(result.days[0].date.slice(0, 7));
      }
      persistLighthouseImport(result).then(r => {
        if (r.errors.length > 0) console.warn('[lighthouse] persist warnings:', r.errors);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setUploadStatus('error', msg);
    }
  }, [setImportData, setUploadStatus]);

  // ─── Upload Expedia ───────────────────────────────────────────────────
  const handleExpediaFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    expediaStore.setUploadStatus('parsing');
    try {
      const result = await parseExpediaExcel(file);
      expediaStore.setImportData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      expediaStore.setUploadStatus('error', msg);
    }
  }, [expediaStore]);

  // ─── Upload Salons ────────────────────────────────────────────────────
  const handleSalonsFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    salonsStore.setUploadStatus('parsing');
    try {
      const result = await parseSalonsExcel(file);
      salonsStore.setImportData(result);
      persistSalonEvents(result.events, file.name).then(r => {
        if (r.errors.length > 0) console.warn('[salons] persist warnings:', r.errors);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      salonsStore.setUploadStatus('error', msg);
    }
  }, [salonsStore]);

  // ─── Données dérivées ─────────────────────────────────────────────────
  const monthsAvailable = useMemo(() => {
    if (!importData) return [];
    const set = new Set(importData.days.map(d => d.date.slice(0, 7)));
    return Array.from(set).sort();
  }, [importData]);

  // ─── Hydratation depuis DB au mount ───────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    if (!importData) {
      fetchActiveLighthouseImport().then(persisted => {
        if (!cancelled && persisted && persisted.days.length > 0) {
          setImportData(persisted);
          setSelectedMonth(persisted.days[0].date.slice(0, 7));
        }
      });
    }

    if (!salonsStore.hasData()) {
      fetchSalonEvents().then(events => {
        if (!cancelled && events.length > 0) {
          salonsStore.setImportData({
            fileName: 'persisted_events',
            importedAt: new Date().toISOString(),
            events,
            sheetsProcessed: [],
            warnings: [],
          });
        }
      });
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (monthsAvailable.length > 0 && !monthsAvailable.includes(selectedMonth)) {
      setSelectedMonth(monthsAvailable[0]);
    }
  }, [monthsAvailable, selectedMonth]);

  const monthData = useMemo(() => {
    if (!importData) return [];
    return importData.days.filter(d => d.date.startsWith(selectedMonth));
  }, [importData, selectedMonth]);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] min-h-0">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={BarChart3}
          title="Veille Concurrentielle"
          subtitle="Données Lighthouse · positionnement vs compset · 10 hôtels concurrents"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={expediaInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExpediaFileChange}
        className="hidden"
      />
      <input
        ref={salonsInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleSalonsFileChange}
        className="hidden"
      />

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-4">
        {/* Bandeau d'erreur ou loader si import en cours */}
        <UploadStatusBanner />

        {/* Bandeau Lighthouse compact + repliable (point 3) */}
        {importData && (
          <LighthouseFileBanner
            fileName={importData.fileName}
            importedAt={importData.importedAt}
            daysCount={importData.days.length}
            competitorsCount={importData.competitorNames.length}
            warnings={importData.warnings}
            onClear={clearImport}
          />
        )}

        {!hasData() ? (
          <EmptyState onUploadClick={() => fileInputRef.current?.click()} />
        ) : (
          <>
            {/* Toolbar : mois + boutons imports — toujours visible au-dessus des onglets */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Période :</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {monthsAvailable.map(m => {
                    const label = new Date(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
                <span className="text-xs text-gray-400">
                  {monthData.length} jours · {importData?.competitorNames.length ?? 0} concurrents
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => salonsInputRef.current?.click()}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                  title="Importer le fichier Excel Dates Salons (multi-feuilles)"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {salonsStore.hasData()
                    ? `Salons ✓ (${salonsStore.importData?.events.length ?? 0})`
                    : 'Importer Dates Salons'}
                </button>
                <button
                  onClick={() => { clearImport(); }}
                  className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Nouvel import Lighthouse
                </button>
                <button
                  onClick={() => expediaInputRef.current?.click()}
                  className={cn(
                    'px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium border transition-colors',
                    expediaStore.hasData()
                      ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                      : 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                  )}
                  title="Importer le fichier Excel Expedia Revenue Management"
                >
                  <Upload className="w-4 h-4" />
                  {expediaStore.hasData()
                    ? `Expedia ✓ (${expediaStore.importData?.days.length ?? 0}j)`
                    : 'Upload Expedia'}
                </button>
              </div>
            </div>

            {/* Banner upload salons */}
            {salonsStore.uploadStatus === 'success' && salonsStore.importData && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1">
                  <strong>{salonsStore.importData.events.length} événements importés</strong>
                  {' '}depuis {salonsStore.importData.fileName}
                  {' · '}feuilles : {salonsStore.importData.sheetsProcessed.join(', ')}
                </div>
                <button
                  onClick={() => salonsStore.clearImport()}
                  className="text-emerald-400 hover:text-emerald-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {salonsStore.uploadStatus === 'error' && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Erreur import salons :</strong> {salonsStore.uploadError}
                </div>
                <button
                  onClick={() => salonsStore.setUploadStatus('idle')}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ─── BARRE D'ONGLETS ────────────────────────────────────────── */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap flex-shrink-0',
                        isActive
                          ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                          : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── CONTENU DES ONGLETS ────────────────────────────────────── */}
            {activeTab === 'cockpit' && importData && (
              <MarketAnalysisCockpit
                importData={importData}
                selectedMonth={selectedMonth}
                onDateClick={setSelectedDate}
              />
            )}

            {activeTab === 'marche' && (
              <div className="space-y-4">
                {/* ─── Sélecteur de vue ────────────────────────────────── */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Toggle Données du jour / Comparatif */}
                  <div className="bg-gray-100 rounded-xl p-1 flex items-center gap-0.5">
                    <button
                      onClick={() => setMarcheView('jour')}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                        marcheView === 'jour'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800',
                      )}
                    >
                      Données du jour
                    </button>
                    <button
                      onClick={() => {
                        setMarcheView('comparatif');
                        if (!compareData && !compareLoading) {
                          loadCompareData(compareLabel);
                        }
                      }}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                        marcheView === 'comparatif'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800',
                      )}
                    >
                      Comparatif
                    </button>
                  </div>

                  {/* Sous-onglets période (visible uniquement en mode Comparatif) */}
                  {marcheView === 'comparatif' && (
                    <div className="bg-gray-100 rounded-xl p-1 flex items-center gap-0.5">
                      {(Object.keys(COMPARE_DAYS) as CompareLabel[]).map(label => (
                        <button
                          key={label}
                          onClick={() => {
                            setCompareLabel(label);
                            loadCompareData(label);
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                            compareLabel === label
                              ? 'bg-white text-violet-700 shadow-sm'
                              : 'text-gray-500 hover:text-gray-800',
                          )}
                        >
                          vs {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── KPI strip ───────────────────────────────────────── */}
                <CompsetKpiBlock monthData={monthData} ourHotelName={importData?.ourHotelName ?? ''} />

                {/* ─── Graphique actif ─────────────────────────────────── */}
                {marcheView === 'jour'
                  ? importData && (
                    <PremiumCompsetChart
                      importData={importData}
                      selectedMonth={selectedMonth}
                      onDateClick={setSelectedDate}
                    />
                  )
                  : importData && (
                    <ComparisonChart
                      currentData={importData}
                      compareData={compareData}
                      compareLabel={compareLabel}
                      selectedMonth={selectedMonth}
                      isLoading={compareLoading}
                      onDateClick={setSelectedDate}
                    />
                  )
                }
              </div>
            )}

            {activeTab === 'positionnement' && importData && (
              <CompsetBarChart
                importData={importData}
                selectedDate={compsetChartDate}
                onDateChange={setCompsetChartDate}
              />
            )}

            {activeTab === 'heatmap' && (
              <CompetitorHeatmap
                days={monthData}
                competitorNames={importData?.competitorNames ?? []}
                ourHotelName={importData?.ourHotelName ?? ''}
                onDateClick={setSelectedDate}
              />
            )}

            {activeTab === 'detail' && (
              <DailyTable days={monthData} onRowClick={setSelectedDate} />
            )}

            {/* ─── Nouveaux onglets dédiés (Palier A.5) ────────────────── */}
            {activeTab === 'recos' && importData && (
              <MarketAnalysisCockpit
                importData={importData}
                selectedMonth={selectedMonth}
                onDateClick={setSelectedDate}
                view="recommendations"
              />
            )}

            {activeTab === 'briefing' && importData && (
              <MarketAnalysisCockpit
                importData={importData}
                selectedMonth={selectedMonth}
                onDateClick={setSelectedDate}
                view="briefing"
              />
            )}
          </>
        )}
      </div>

      {/* Modal détail premium (remplace l'ancien DayDetailModal interne) */}
      {selectedDate && importData && (
        <PremiumDayDetailModal
          date={selectedDate}
          ourHotelName={importData.ourHotelName}
          dayData={importData.days.find(d => d.date === selectedDate) ?? null}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────

function CompetitorHeatmap({
  days,
  competitorNames,
  ourHotelName,
  onDateClick,
}: {
  days: import('../../services/lighthouse-parser.service').LighthouseDayData[];
  competitorNames: string[];
  ourHotelName: string;
  onDateClick: (date: string) => void;
}) {
  const [competitorSearch, setCompetitorSearch] = useState('');
  if (days.length === 0 || competitorNames.length === 0) return null;

  const q = competitorSearch.trim().toLowerCase();
  const filteredCompetitors = q
    ? competitorNames.filter((n) => n.toLowerCase().includes(q))
    : competitorNames;

  const cellColor = (price: number | null, ourPrice: number, status: string) => {
    if (status === 'sold_out') return 'bg-gray-200 text-gray-500';
    if (status === 'restricted') return 'bg-amber-100 text-amber-700';
    if (price === null) return 'bg-gray-50 text-gray-400';
    if (ourPrice === 0) return 'bg-white text-gray-700';
    const diff = (price - ourPrice) / ourPrice;
    if (diff > 0.10) return 'bg-emerald-100 text-emerald-800';
    if (diff > 0.02) return 'bg-emerald-50 text-emerald-700';
    if (diff < -0.10) return 'bg-red-100 text-red-800';
    if (diff < -0.02) return 'bg-red-50 text-red-700';
    return 'bg-gray-50 text-gray-700';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-base font-semibold text-gray-900">Heatmap Tarifs Concurrents</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={competitorSearch}
            onChange={(e) => setCompetitorSearch(e.target.value)}
            placeholder="Filtrer concurrent..."
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none w-48"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filteredCompetitors.length}/{competitorNames.length}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100" /> Nous moins chers</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100" /> Nous plus chers</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-200" /> Épuisé</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Hôtel</th>
              {days.map(d => (
                <th
                  key={d.date}
                  onClick={() => onDateClick(d.date)}
                  className="px-1 py-2 text-center font-semibold text-gray-600 cursor-pointer hover:bg-blue-50"
                  title={`Cliquer pour voir le détail du ${d.dayName} ${d.date}`}
                >
                  <div>{d.dayName}</div>
                  <div className="text-gray-400">{d.date.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50/50 border-b-2 border-blue-200">
              <td className="px-2 py-2 font-bold text-blue-900 sticky left-0 bg-blue-50/50 flex items-center gap-1">
                <Target className="w-3 h-3" />
                {ourHotelName}
              </td>
              {days.map(d => (
                <td key={d.date} className="px-1 py-1 text-center bg-blue-100/60 text-blue-900 font-semibold">
                  {d.ourPrice > 0 ? `${d.ourPrice}€` : '—'}
                </td>
              ))}
            </tr>
            {filteredCompetitors.map((name) => (
              <tr key={name} className="hover:bg-gray-50">
                <td className="px-2 py-2 text-gray-700 sticky left-0 bg-white hover:bg-gray-50">{name}</td>
                {days.map(d => {
                  const comp = d.competitors.find(c => c.hotelName === name);
                  if (!comp) return <td key={d.date} className="px-1 py-1 text-center text-gray-300">—</td>;
                  return (
                    <td
                      key={d.date}
                      className={cn('px-1 py-1 text-center text-xs font-medium', cellColor(comp.price, d.ourPrice, comp.status))}
                      title={`${d.dayName} ${d.date.slice(5)} · ${name}\n${comp.rawValue || '—'}`}
                    >
                      {comp.price !== null
                        ? `${Math.round(comp.price)}€`
                        : comp.status === 'sold_out' ? '✕'
                        : comp.status === 'restricted' ? '⚠'
                        : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DailySortKey = 'date' | 'ourPrice' | 'compsetMedian' | 'compsetMin' | 'compsetMax' | 'diff' | 'pressure';

function DailyTable({
  days,
  onRowClick,
}: {
  days: import('../../services/lighthouse-parser.service').LighthouseDayData[];
  onRowClick: (date: string) => void;
}) {
  const [sortKey, setSortKey] = useState<DailySortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  if (days.length === 0) return null;

  const toggleSort = (key: DailySortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedDays = [...days].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case 'date': av = a.date; bv = b.date; break;
      case 'ourPrice': av = a.ourPrice; bv = b.ourPrice; break;
      case 'compsetMedian': av = a.compsetMedian; bv = b.compsetMedian; break;
      case 'compsetMin': av = a.compsetMin ?? 0; bv = b.compsetMin ?? 0; break;
      case 'compsetMax': av = a.compsetMax ?? 0; bv = b.compsetMax ?? 0; break;
      case 'diff': av = a.ourPrice - a.compsetMedian; bv = b.ourPrice - b.compsetMedian; break;
      case 'pressure': av = a.marketDemandPercent; bv = b.marketDemandPercent; break;
    }
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
    return ((av as number) - (bv as number)) * dir;
  });

  const arrow = (k: DailySortKey) => sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Détail jour par jour</h3>
        <p className="text-xs text-gray-500 mt-1">Cliquer sur un en-tête pour trier</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th onClick={() => toggleSort('date')} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Date{arrow('date')}</th>
              <th onClick={() => toggleSort('ourPrice')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Notre prix{arrow('ourPrice')}</th>
              <th onClick={() => toggleSort('compsetMedian')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Médiane{arrow('compsetMedian')}</th>
              <th onClick={() => toggleSort('compsetMin')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Min compset{arrow('compsetMin')}</th>
              <th onClick={() => toggleSort('compsetMax')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Max compset{arrow('compsetMax')}</th>
              <th onClick={() => toggleSort('diff')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Écart médiane{arrow('diff')}</th>
              <th onClick={() => toggleSort('pressure')} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">Demande{arrow('pressure')}</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Rang</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedDays.map((day) => {
              const diff = day.ourPrice - day.compsetMedian;
              const diffPct = day.compsetMedian > 0 ? ((diff / day.compsetMedian) * 100).toFixed(1) : '—';
              const pressure = day.marketDemandPercent;
              const pressureColor = pressure >= 70 ? 'text-red-600' : pressure >= 40 ? 'text-amber-600' : 'text-emerald-600';

              return (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {day.dayName} {day.date.slice(5)}
                    {day.holidays && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">{day.holidays}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-600">{day.ourPrice > 0 ? `${day.ourPrice}€` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{day.compsetMedian > 0 ? `${day.compsetMedian}€` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{day.compsetMin !== null ? `${day.compsetMin}€` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{day.compsetMax !== null ? `${day.compsetMax}€` : '—'}</td>
                  <td className={cn('px-3 py-2 text-right font-semibold', diff >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {day.ourPrice > 0 && day.compsetMedian > 0
                      ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}€ (${diff >= 0 ? '+' : ''}${diffPct}%)`
                      : '—'}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-semibold', pressureColor)}>{pressure}%</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{day.ranking || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onRowClick(day.date)}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Voir détail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
