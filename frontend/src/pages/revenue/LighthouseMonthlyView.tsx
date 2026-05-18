/**
 * FLOWTYM — Veille Concurrentielle (Vue mensuelle)
 *
 * Affiche les données Lighthouse importées :
 *   - 10 concurrents réels (depuis feuille Tarifs)
 *   - Tarifs jour par jour
 *   - Positionnement (ranking, écart médiane, MIN/MAX)
 *   - Heatmap pression marché
 *   - Aucune donnée mock — uniquement le fichier importé
 *
 * État vide si aucun fichier importé → CTA Upload.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  BarChart3, Upload, AlertCircle, CheckCircle2, Loader2, X,
  FileSpreadsheet, Target, TrendingUp, TrendingDown, CalendarDays,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { parseLighthouseExcel } from '../../services/lighthouse-parser.service';
import { useSalonsStore } from '../../store/salonsStore';
import { parseSalonsExcel } from '../../services/salons-parser.service';
import { CompsetKpiBlock, CompsetBarChart } from './components/CompsetWidgets';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

// ─── Upload Banner ────────────────────────────────────────────────────────

function UploadBanner() {
  const { uploadStatus, uploadError, importData, clearImport } = useLighthouseStore();

  if (uploadStatus === 'idle' && !importData) return null;

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

  if (importData) {
    const importedDate = new Date(importData.importedAt).toLocaleString('fr-FR');
    return (
      <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">Fichier Lighthouse actif</p>
            <div className="grid grid-cols-4 gap-4 mt-2">
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Fichier</p>
                <p className="text-sm font-medium text-emerald-900 flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  {importData.fileName}
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Importé le</p>
                <p className="text-sm font-medium text-emerald-900">{importedDate}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Données</p>
                <p className="text-sm font-medium text-emerald-900">{importData.days.length} jours</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Concurrents</p>
                <p className="text-sm font-medium text-emerald-900">{importData.competitorNames.length} hôtels</p>
              </div>
            </div>
            {importData.warnings.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">
                ⚠ {importData.warnings.join(' · ')}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={clearImport}
          className="text-emerald-400 hover:text-emerald-600 flex-shrink-0"
          title="Retirer l'import"
        >
          <X className="w-4 h-4" />
        </button>
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
  const salonsStore = useSalonsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const salonsInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [compsetChartDate, setCompsetChartDate] = useState<string | null>(null);

  // ─── Upload Lighthouse ────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Permet re-upload du même fichier

    setUploadStatus('parsing');
    try {
      const result = await parseLighthouseExcel(file);
      setImportData(result);
      // Auto-sélectionner premier mois
      if (result.days.length > 0) {
        setSelectedMonth(result.days[0].date.slice(0, 7));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setUploadStatus('error', msg);
    }
  }, [setImportData, setUploadStatus]);

  // ─── Upload Salons (Dates Salon) ──────────────────────────────────────
  const handleSalonsFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    salonsStore.setUploadStatus('parsing');
    try {
      const result = await parseSalonsExcel(file);
      salonsStore.setImportData(result);
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

  // Auto-sélectionner premier mois quand on a des données
  React.useEffect(() => {
    if (monthsAvailable.length > 0 && !monthsAvailable.includes(selectedMonth)) {
      setSelectedMonth(monthsAvailable[0]);
    }
  }, [monthsAvailable, selectedMonth]);

  const monthData = useMemo(() => {
    if (!importData) return [];
    return importData.days.filter(d => d.date.startsWith(selectedMonth));
  }, [importData, selectedMonth]);

  const stats = useMemo(() => {
    if (monthData.length === 0) {
      return { median: 0, min: 0, max: 0, avgDemand: 0, avgRank: 0, totalRanked: 0 };
    }
    const medians = monthData.map(d => d.compsetMedian).filter(p => p > 0).sort((a, b) => a - b);
    const mins = monthData.map(d => d.compsetMin).filter((v): v is number => v !== null);
    const maxs = monthData.map(d => d.compsetMax).filter((v): v is number => v !== null);
    const ranks = monthData.map(d => d.rankPosition).filter((r): r is number => r !== null);

    return {
      median: medians.length > 0 ? Math.round(medians[Math.floor(medians.length / 2)]) : 0,
      min: mins.length > 0 ? Math.round(Math.min(...mins)) : 0,
      max: maxs.length > 0 ? Math.round(Math.max(...maxs)) : 0,
      avgDemand: Math.round((monthData.reduce((s, d) => s + d.marketDemand, 0) / monthData.length) * 100),
      avgRank: ranks.length > 0 ? Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length) : 0,
      totalRanked: ranks.length,
    };
  }, [monthData]);

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

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">
        <UploadBanner />

        {!hasData() ? (
          <EmptyState onUploadClick={() => fileInputRef.current?.click()} />
        ) : (
          <>
            {/* Toolbar */}
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
                <input
                  ref={salonsInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSalonsFileChange}
                  className="hidden"
                />
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

            {/* Bloc 8 KPIs métier */}
            <CompsetKpiBlock monthData={monthData} ourHotelName={importData?.ourHotelName ?? ''} />

            {/* Graph compset horizontal par date */}
            {importData && (
              <CompsetBarChart
                importData={importData}
                selectedDate={compsetChartDate}
                onDateChange={setCompsetChartDate}
              />
            )}

            {/* Graph prix */}
            <PriceChart days={monthData} />

            {/* Heatmap concurrents */}
            <CompetitorHeatmap
              days={monthData}
              competitorNames={importData?.competitorNames ?? []}
              ourHotelName={importData?.ourHotelName ?? ''}
              onDateClick={setSelectedDate}
            />

            {/* Tableau détail jour par jour */}
            <DailyTable days={monthData} onRowClick={setSelectedDate} />
          </>
        )}
      </div>

      {/* Modal détail par date */}
      {selectedDate && importData && (
        <DayDetailModal
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

function KpiCard({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colorClass = {
    gray: 'text-gray-900',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }[color] ?? 'text-gray-900';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', colorClass)}>{value}</p>
    </div>
  );
}

function PriceChart({ days }: { days: import('../../services/lighthouse-parser.service').LighthouseDayData[] }) {
  if (days.length === 0) return null;
  const allPrices = days.flatMap(d => [d.ourPrice, d.compsetMedian].filter(p => p > 0));
  const maxPrice = Math.max(...allPrices, 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Notre prix vs Médiane compset</h3>
      <div className="h-48 flex items-end gap-0.5">
        {days.map((day, idx) => {
          const ourH = (day.ourPrice / maxPrice) * 100;
          const medH = (day.compsetMedian / maxPrice) * 100;
          const ourAbove = day.ourPrice >= day.compsetMedian;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-0.5" title={
              `${day.dayName} ${day.date.slice(5)}\nNous: ${day.ourPrice}€\nMédiane: ${day.compsetMedian}€\nDemande: ${day.marketDemandPercent}%`
            }>
              <div className={cn('w-full rounded-t-sm', ourAbove ? 'bg-blue-500' : 'bg-orange-400')} style={{ height: `${Math.max(ourH, 2)}%` }} />
              <div className="w-full bg-gray-300 rounded-b-sm" style={{ height: `${Math.max(medH, 2)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-500" /> Notre prix ≥ médiane</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-400" /> Notre prix &lt; médiane</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-300" /> Médiane compset</span>
      </div>
    </div>
  );
}

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
  if (days.length === 0 || competitorNames.length === 0) return null;

  // Couleurs : vert si nous moins cher / rouge si plus cher / gris si épuisé
  const cellColor = (price: number | null, ourPrice: number, status: string) => {
    if (status === 'sold_out') return 'bg-gray-200 text-gray-500';
    if (status === 'restricted') return 'bg-amber-100 text-amber-700';
    if (price === null) return 'bg-gray-50 text-gray-400';
    if (ourPrice === 0) return 'bg-white text-gray-700';
    const diff = (price - ourPrice) / ourPrice;
    if (diff > 0.10) return 'bg-emerald-100 text-emerald-800';     // Eux plus chers de 10%+
    if (diff > 0.02) return 'bg-emerald-50 text-emerald-700';
    if (diff < -0.10) return 'bg-red-100 text-red-800';            // Eux moins chers de 10%+
    if (diff < -0.02) return 'bg-red-50 text-red-700';
    return 'bg-gray-50 text-gray-700';                              // ±2% équivalent
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Heatmap Tarifs Concurrents</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100" /> Nous moins chers</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100" /> Nous plus chers</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-200" /> Épuisé</span>
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
            {/* Ligne notre hôtel */}
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

            {/* Lignes concurrents */}
            {competitorNames.map((name) => (
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

function DailyTable({
  days,
  onRowClick,
}: {
  days: import('../../services/lighthouse-parser.service').LighthouseDayData[];
  onRowClick: (date: string) => void;
}) {
  if (days.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Détail jour par jour</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Notre prix</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Médiane</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Min compset</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Max compset</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Écart médiane</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Demande</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Rang</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {days.map((day) => {
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

// ─── Modal Détail par date ────────────────────────────────────────────────

function DayDetailModal({
  date,
  ourHotelName,
  dayData,
  onClose,
}: {
  date: string;
  ourHotelName: string;
  dayData: import('../../services/lighthouse-parser.service').LighthouseDayData | null;
  onClose: () => void;
}) {
  if (!dayData) return null;

  // Construire le ranking : nous + concurrents disponibles triés par prix
  const allHotels: { name: string; price: number; isUs: boolean; status: string }[] = [
    { name: ourHotelName, price: dayData.ourPrice, isUs: true, status: 'available' },
    ...dayData.competitors.map(c => ({
      name: c.hotelName,
      price: c.price ?? Infinity,
      isUs: false,
      status: c.status,
    })),
  ];
  const ranked = allHotels
    .filter(h => h.status === 'available' && h.price > 0 && isFinite(h.price))
    .sort((a, b) => a.price - b.price);
  const unavailable = allHotels.filter(h => h.status !== 'available' || h.price === 0 || !isFinite(h.price));
  const ourPosition = ranked.findIndex(h => h.isUs) + 1;
  const totalRanked = ranked.length;
  const maxPrice = ranked.length > 0 ? ranked[ranked.length - 1].price : 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Détail {dayData.dayName} {date}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Positionnement compset · Demande {dayData.marketDemandPercent}% · Rang {dayData.ranking}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats résumé */}
        <div className="px-6 py-4 border-b border-gray-200 grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Notre prix</p>
            <p className="text-xl font-bold text-blue-600">{dayData.ourPrice}€</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Médiane</p>
            <p className="text-xl font-bold text-gray-900">{dayData.compsetMedian}€</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Min – Max</p>
            <p className="text-xl font-bold text-gray-900">{dayData.compsetMin ?? '—'}€ – {dayData.compsetMax ?? '—'}€</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Notre rang</p>
            <p className="text-xl font-bold text-emerald-600">
              {ourPosition > 0 ? `#${ourPosition} / ${totalRanked}` : '—'}
            </p>
          </div>
        </div>

        {/* Liste classée */}
        <div className="px-6 py-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Classement tarifaire</h3>
          <div className="space-y-1.5">
            {ranked.map((h, idx) => {
              const widthPct = (h.price / maxPrice) * 100;
              return (
                <div
                  key={h.name}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded',
                    h.isUs ? 'bg-blue-50 border border-blue-300' : 'bg-gray-50',
                  )}
                >
                  <span className={cn(
                    'w-6 text-xs font-bold',
                    idx === 0 ? 'text-emerald-600' : idx < 3 ? 'text-blue-600' : 'text-gray-500',
                  )}>
                    #{idx + 1}
                  </span>
                  <span className={cn('flex-1 text-sm', h.isUs ? 'font-bold text-blue-900' : 'text-gray-700')}>
                    {h.isUs && <Target className="inline w-3 h-3 mr-1" />}
                    {h.name}
                  </span>
                  <div className="flex-1 max-w-[200px] bg-white rounded overflow-hidden h-2">
                    <div
                      className={cn('h-full rounded', h.isUs ? 'bg-blue-500' : 'bg-gray-400')}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className={cn('text-sm font-semibold w-16 text-right', h.isUs ? 'text-blue-900' : 'text-gray-900')}>
                    {Math.round(h.price)}€
                  </span>
                </div>
              );
            })}

            {unavailable.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mt-3 mb-1">Non disponibles ({unavailable.length})</p>
                {unavailable.map(h => (
                  <div key={h.name} className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-400">
                    <span className="flex-1">{h.name}</span>
                    <span>
                      {h.status === 'sold_out' ? 'Épuisé' : h.status === 'restricted' ? 'Restreint' : 'N/A'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {(dayData.events || dayData.holidays) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              {dayData.holidays && <div>📅 {dayData.holidays}</div>}
              {dayData.events && <div>🎉 {dayData.events}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
