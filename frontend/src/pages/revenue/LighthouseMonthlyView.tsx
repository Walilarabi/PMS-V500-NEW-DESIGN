/**
 * FLOWTYM LIGHTHOUSE — VEILLE CONCURRENTIELLE
 *
 * Vue mensuelle professionnelle :
 * - Parsing Excel Lighthouse réel (librairie xlsx)
 * - Feedback visuel complet (nom fichier, date import, statut, nb lignes)
 * - Métriques calculées : médiane, min, max, demande, ranking
 * - Heatmap tarifaire + pression marché
 * - Toutes données from real file — aucune donnée fictive
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Calendar,
  TrendingUp,
  Activity,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { LIGHTHOUSE_REAL_DATA } from '../../data/lighthouse-real-data';
import type { LighthouseData } from '../../data/lighthouse-real-data';
import { useLighthouseUpload } from '../../hooks/useLighthouseUpload';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ─── Upload Status Banner ────────────────────────────────────────────────────

interface UploadBannerProps {
  status: ReturnType<typeof useLighthouseUpload>['uploadStatus'];
  onReset: () => void;
}

function UploadBanner({ status, onReset }: UploadBannerProps) {
  if (status.state === 'idle') return null;

  if (status.state === 'parsing') {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <strong>Chargement en cours…</strong>
          {status.fileName && <span className="ml-2 text-blue-600">{status.fileName}</span>}
        </div>
      </div>
    );
  }

  if (status.state === 'success') {
    return (
      <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-emerald-900">Fichier importé avec succès</p>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Fichier</p>
                <p className="text-sm font-medium text-emerald-900 flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  {status.fileName}
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Importé le</p>
                <p className="text-sm font-medium text-emerald-900">{status.importedAt}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Données traitées</p>
                <p className="text-sm font-medium text-emerald-900">{status.rowCount} jours</p>
              </div>
            </div>
          </div>
        </div>
        <button onClick={onReset} className="text-emerald-400 hover:text-emerald-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-900">Erreur d'import</p>
            {status.fileName && (
              <p className="text-red-700 mt-1">Fichier : {status.fileName}</p>
            )}
            <p className="text-red-700 mt-1">{status.errorMessage}</p>
          </div>
        </div>
        <button onClick={onReset} className="text-red-400 hover:text-red-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

// ─── Calculs statistiques ────────────────────────────────────────────────────

function computeStats(data: LighthouseData[]) {
  if (data.length === 0) {
    return { median: 0, min: 0, max: 0, avgDemand: 0, avgRanking: 'N/A' };
  }

  const prices = data.map(d => d.compsetMedian).filter(p => p > 0).sort((a, b) => a - b);
  const median = prices.length > 0
    ? prices[Math.floor(prices.length / 2)]
    : 0;
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;
  const avgDemand = Math.round(
    (data.reduce((s, d) => s + d.marketDemand, 0) / data.length) * 100
  );

  // Parser rankings "X sur Y" → extraire X
  const ranks = data
    .map(d => {
      const m = d.ranking.match(/^(\d+)/);
      return m ? parseInt(m[1]) : null;
    })
    .filter((r): r is number => r !== null);
  const avgRank = ranks.length > 0
    ? Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length)
    : null;
  const avgRanking = avgRank !== null ? `#${avgRank} moyen` : 'N/A';

  return { median: Math.round(median), min: Math.round(min), max: Math.round(max), avgDemand, avgRanking };
}

// ─── Composant principal ─────────────────────────────────────────────────────

export const LighthouseMonthlyView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [customData, setCustomData] = useState<LighthouseData[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadStatus, handleFile, reset } = useLighthouseUpload();

  // Source de données : fichier importé ou données réelles embarquées
  const allData = customData ?? LIGHTHOUSE_REAL_DATA;

  // Filtrer par mois sélectionné
  const monthData = useMemo(() => {
    return allData.filter(d => d.date.startsWith(selectedMonth));
  }, [allData, selectedMonth]);

  // Mois disponibles
  const availableMonths = useMemo(() => {
    const months = new Set(allData.map(d => d.date.slice(0, 7)));
    return Array.from(months).sort();
  }, [allData]);

  const stats = useMemo(() => computeStats(monthData), [monthData]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input pour permettre re-upload même fichier
    e.target.value = '';

    const parsed = await handleFile(file);
    if (parsed.length > 0) {
      setCustomData(parsed);
      // Auto-sélectionner premier mois disponible
      const firstMonth = parsed[0]?.date.slice(0, 7);
      if (firstMonth) setSelectedMonth(firstMonth);
    }
  }, [handleFile]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={BarChart3}
          title="Veille Concurrentielle"
          subtitle="Analyse marché Lighthouse · données réelles · import Excel"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">

        {/* Banner feedback upload */}
        <UploadBanner status={uploadStatus} onReset={reset} />

        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Période :</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {availableMonths.length > 0
                ? availableMonths.map(m => {
                    const [y, mo] = m.split('-');
                    const label = new Date(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })
                : <option value={selectedMonth}>{selectedMonth}</option>
              }
            </select>
            <span className="text-xs text-gray-400">
              {customData ? `${allData.length} jours (fichier importé)` : `${allData.length} jours (données embarquées)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {customData && (
              <button
                onClick={() => { setCustomData(null); reset(); }}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Réinitialiser
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus.state === 'parsing'}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
            >
              {uploadStatus.state === 'parsing'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Upload className="w-4 h-4" />
              }
              Importer Lighthouse Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* KPI Cards — calculés sur vraies données */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Médiane compset</p>
            <p className="text-2xl font-bold text-gray-900">{stats.median}€</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Min compset</p>
            <p className="text-2xl font-bold text-blue-600">{stats.min}€</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Max compset</p>
            <p className="text-2xl font-bold text-purple-600">{stats.max}€</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Demande moy.</p>
            <p className={cn(
              'text-2xl font-bold',
              stats.avgDemand >= 70 ? 'text-red-600' : stats.avgDemand >= 40 ? 'text-yellow-600' : 'text-green-600'
            )}>{stats.avgDemand}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Ranking moyen</p>
            <p className="text-2xl font-bold text-gray-900">{stats.avgRanking}</p>
          </div>
        </div>

        {/* Graphique : Notre prix vs Médiane compset */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Notre Prix vs Médiane Compset</h3>

          {monthData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée pour ce mois. Importez un fichier Lighthouse ou sélectionnez un autre mois.
            </div>
          ) : (
            <>
              <div className="h-52 flex items-end gap-0.5">
                {monthData.map((day, idx) => {
                  const allPrices = monthData.flatMap(d => [d.ourPrice, d.compsetMedian]).filter(p => p > 0);
                  const maxPrice = Math.max(...allPrices, 1);
                  const ourH = (day.ourPrice / maxPrice) * 100;
                  const medH = (day.compsetMedian / maxPrice) * 100;
                  const ourAbove = day.ourPrice >= day.compsetMedian;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-0.5" title={
                      `${day.dayName} ${day.date.slice(5)}\nNous: ${day.ourPrice}€\nMédiane: ${day.compsetMedian}€\nDemande: ${Math.round(day.marketDemand * 100)}%\n${day.ranking}`
                    }>
                      <div className={cn('w-full rounded-t-sm', ourAbove ? 'bg-blue-500' : 'bg-orange-400')} style={{ height: `${ourH}%` }} />
                      <div className="w-full bg-gray-300 rounded-b-sm" style={{ height: `${medH}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-500" /> Notre prix ≥ médiane</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-400" /> Notre prix &lt; médiane</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-300" /> Médiane compset</span>
              </div>
            </>
          )}
        </div>

        {/* Pression marché */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Pression Marché (Demande 0–100%)</h3>

          {monthData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée disponible pour ce mois.
            </div>
          ) : (
            <div className="h-36 flex items-end gap-0.5">
              {monthData.map((day, idx) => {
                const pressure = Math.round(day.marketDemand * 100);
                const color = pressure >= 70 ? 'bg-red-500' : pressure >= 40 ? 'bg-yellow-400' : 'bg-emerald-500';
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center" title={`${day.dayName} ${day.date.slice(5)} : ${pressure}%`}>
                    <div className={cn('w-full rounded-t-sm', color)} style={{ height: `${Math.max(pressure, 2)}%` }} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> &lt; 40% faible</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-400" /> 40–70% moyen</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500" /> &gt; 70% fort</span>
          </div>
        </div>

        {/* Tableau détaillé ranking */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Détail Jour par Jour</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Notre prix</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Médiane</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Écart</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Demande</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ranking</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Booking</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fériés / Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthData.map((day, idx) => {
                  const diff = day.ourPrice - day.compsetMedian;
                  const diffPct = day.compsetMedian > 0 ? ((diff / day.compsetMedian) * 100).toFixed(1) : '—';
                  const pressure = Math.round(day.marketDemand * 100);
                  const pressureColor = pressure >= 70 ? 'text-red-600' : pressure >= 40 ? 'text-yellow-600' : 'text-emerald-600';

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {day.dayName} {day.date.slice(5)}
                        {day.holidays && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">{day.holidays}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{day.ourPrice > 0 ? `${day.ourPrice}€` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{day.compsetMedian > 0 ? `${day.compsetMedian}€` : '—'}</td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold', diff >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {day.ourPrice > 0 && day.compsetMedian > 0
                          ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}€ (${diff >= 0 ? '+' : ''}${diffPct}%)`
                          : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold', pressureColor)}>
                        {pressure}%
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{day.ranking || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{day.bookingRank || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{day.events || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {monthData.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                Aucune donnée pour ce mois.
                {allData === LIGHTHOUSE_REAL_DATA && (
                  <p className="mt-1 text-xs">Importez un fichier Excel Lighthouse ou sélectionnez mai–août 2026.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Source info */}
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {customData
            ? <span>Données issues du fichier importé · {allData.length} jours disponibles</span>
            : <span>Données embarquées : folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx · {allData.length} jours (mai–août 2026) · Importez votre dernier export Lighthouse pour actualiser</span>
          }
        </div>

      </div>
    </div>
  );
};
