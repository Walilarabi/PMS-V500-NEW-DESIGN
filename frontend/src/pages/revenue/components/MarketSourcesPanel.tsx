/**
 * FLOWTYM — MarketSourcesPanel
 *
 * Onglet "Sources marché" de la Veille Concurrentielle.
 * Affiche l'état de chaque source importée (Lighthouse, Expedia, Salons),
 * la qualité du mapping (dates communes), et un bouton "Recalculer".
 *
 * Lit directement les stores Zustand — zéro props nécessaires.
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, Clock, FileSpreadsheet,
  CalendarDays, Database, RefreshCw, Info, X,
} from 'lucide-react';
import { useLighthouseStore } from '../../../store/lighthouseStore';
import { useExpediaStore } from '../../../store/expediaStore';
import { useSalonsStore } from '../../../store/salonsStore';
import type { SignalConfidence } from '../../../services/market-signal-normalizer';

// ─── Helpers ──────────────────────────────────────────────────────────────

function freshnessLabel(importedAt: string | null): { label: string; hours: number | null } {
  if (!importedAt) return { label: '–', hours: null };
  const hours = (Date.now() - new Date(importedAt).getTime()) / 3_600_000;
  if (hours < 1) return { label: "À l'instant", hours };
  if (hours < 24) return { label: `Il y a ${Math.round(hours)}h`, hours };
  const days = Math.floor(hours / 24);
  return { label: `Il y a ${days}j`, hours };
}

function hoursToConfidence(hours: number | null, hasPressure: boolean): SignalConfidence {
  if (hours === null) return 'absent';
  if (hours < 24 && hasPressure) return 'high';
  if (hours < 72) return 'medium';
  return 'low';
}

function confidenceBadge(conf: SignalConfidence) {
  const map: Record<SignalConfidence, { label: string; className: string }> = {
    high:   { label: 'Élevée',  className: 'bg-emerald-100 text-emerald-800' },
    medium: { label: 'Moyenne', className: 'bg-amber-100 text-amber-800'   },
    low:    { label: 'Faible',  className: 'bg-red-100 text-red-700'        },
    absent: { label: 'Absent',  className: 'bg-gray-100 text-gray-500'      },
  };
  const { label, className } = map[conf];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '–';
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Composant principal ──────────────────────────────────────────────────

export function MarketSourcesPanel() {
  const lhStore  = useLighthouseStore();
  const exStore  = useExpediaStore();
  const salStore = useSalonsStore();

  const [recalcToast, setRecalcToast] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState<'lh' | 'ex' | 'sal' | null>(null);

  // ── Fraîcheur et confiance ──────────────────────────────────────────
  const lhFreshness  = freshnessLabel(lhStore.importData?.importedAt ?? null);
  const exFreshness  = freshnessLabel(exStore.importData?.importedAt ?? null);
  const salFreshness = freshnessLabel(salStore.importData?.importedAt ?? null);

  const lhConf  = hoursToConfidence(lhFreshness.hours, lhStore.importData?.days.some(d => d.marketDemandPercent > 0) ?? false);
  const exConf  = hoursToConfidence(exFreshness.hours, exStore.importData?.days.some(d => d.marketPressureNeighborhoodPercent > 0) ?? false);
  const salConf = hoursToConfidence(salFreshness.hours, salStore.hasData());

  // ── Couverture dates ───────────────────────────────────────────────
  const coverage = useMemo(() => {
    const lhDates = new Set(lhStore.importData?.days.map(d => d.date) ?? []);
    const exDates = new Set(exStore.importData?.days.map(d => d.date) ?? []);

    const both   = [...lhDates].filter(d => exDates.has(d));
    const lhOnly = [...lhDates].filter(d => !exDates.has(d));
    const exOnly = [...exDates].filter(d => !lhDates.has(d));
    const total  = new Set([...lhDates, ...exDates]).size;

    return {
      lhTotal: lhDates.size,
      exTotal: exDates.size,
      overlap: both.length,
      lhOnly: lhOnly.length,
      exOnly: exOnly.length,
      total,
      overlapPct: total > 0 ? Math.round((both.length / total) * 100) : 0,
      lhOnlyPct:  total > 0 ? Math.round((lhOnly.length / total) * 100) : 0,
      exOnlyPct:  total > 0 ? Math.round((exOnly.length / total) * 100) : 0,
      lhFirst: lhStore.importData?.days[0]?.date ?? null,
      lhLast:  lhStore.importData?.days[lhStore.importData.days.length - 1]?.date ?? null,
      exFirst: exStore.importData?.days[0]?.date ?? null,
      exLast:  exStore.importData?.days[exStore.importData.days.length - 1]?.date ?? null,
    };
  }, [lhStore.importData, exStore.importData]);

  // ── Recalculer ────────────────────────────────────────────────────
  const handleRecalculate = () => {
    window.dispatchEvent(new CustomEvent('rms:recalculate'));
    setRecalcToast(true);
    setTimeout(() => setRecalcToast(false), 2500);
  };

  // ── Sources tableau ───────────────────────────────────────────────
  const sources = [
    {
      id: 'lh' as const,
      label: 'Lighthouse',
      icon: Database,
      color: 'blue',
      present: lhStore.hasData(),
      fileName: lhStore.importData?.fileName ?? null,
      importedAt: lhStore.importData?.importedAt ?? null,
      freshness: lhFreshness,
      confidence: lhConf,
      competitors: lhStore.importData?.competitorNames.length ?? 0,
      daysCount: lhStore.importData?.days.length ?? 0,
      firstDate: coverage.lhFirst,
      lastDate: coverage.lhLast,
      warnings: lhStore.importData?.warnings ?? [],
    },
    {
      id: 'ex' as const,
      label: 'Expedia',
      icon: FileSpreadsheet,
      color: 'orange',
      present: exStore.hasData(),
      fileName: exStore.importData?.fileName ?? null,
      importedAt: exStore.importData?.importedAt ?? null,
      freshness: exFreshness,
      confidence: exConf,
      competitors: exStore.importData?.competitorNames.length ?? 0,
      daysCount: exStore.importData?.days.length ?? 0,
      firstDate: coverage.exFirst,
      lastDate: coverage.exLast,
      warnings: exStore.importData?.warnings ?? [],
    },
    {
      id: 'sal' as const,
      label: 'Salons / Événements',
      icon: CalendarDays,
      color: 'purple',
      present: salStore.hasData(),
      fileName: salStore.importData?.fileName ?? null,
      importedAt: salStore.importData?.importedAt ?? null,
      freshness: salFreshness,
      confidence: salConf,
      competitors: null,
      daysCount: salStore.importData?.events.length ?? 0,
      firstDate: null,
      lastDate: null,
      warnings: salStore.importData?.warnings ?? [],
    },
  ];

  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-6">

      {/* ── Toast recalcul ────────────────────────────────────────────── */}
      {recalcToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-3 shadow-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Recalcul des recommandations demandé…
        </div>
      )}

      {/* ── Section 1 — Tableau des sources ─────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Sources de données importées</h3>
            <p className="text-xs text-gray-500 mt-0.5">État en temps réel des fichiers chargés en session</p>
          </div>
          <button
            onClick={handleRecalculate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculer les recommandations
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fichier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Importé le</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Fraîcheur</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Dates couvertes</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Volume</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Concurrents</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Confiance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sources.map(src => {
                const Icon = src.icon;
                return (
                  <tr key={src.id} className={src.present ? 'bg-white' : 'bg-gray-50 opacity-60'}>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-medium ${colorMap[src.color]}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {src.label}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {src.present ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Données actives
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <X className="w-4 h-4" />
                          Non importé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={src.fileName ?? undefined}>
                      {src.fileName ?? <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {src.importedAt
                        ? new Date(src.importedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {src.present ? (
                        <span className={`flex items-center justify-center gap-1 text-xs ${
                          (src.freshness.hours ?? 999) < 24 ? 'text-emerald-600' :
                          (src.freshness.hours ?? 999) < 72 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          {src.freshness.label}
                        </span>
                      ) : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      {src.firstDate && src.lastDate
                        ? <>{formatDate(src.firstDate)} → {formatDate(src.lastDate)}</>
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {src.present ? (
                        <span className="font-semibold text-gray-800">
                          {src.daysCount}
                          <span className="font-normal text-gray-400 ml-1">
                            {src.id === 'sal' ? 'événements' : 'jours'}
                          </span>
                        </span>
                      ) : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {src.competitors !== null
                        ? src.present
                          ? <span className="font-semibold text-gray-800">{src.competitors}</span>
                          : <span className="text-gray-400">–</span>
                        : <span className="text-gray-400 text-xs">N/A</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {confidenceBadge(src.confidence)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {src.warnings.length > 0 ? (
                        <button
                          onClick={() => setWarningsOpen(warningsOpen === src.id ? null : src.id)}
                          className="flex items-center justify-center gap-1 text-amber-600 hover:text-amber-800 text-xs font-medium"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {src.warnings.length}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warnings détail (inline expansible) */}
        {warningsOpen && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                <Info className="w-4 h-4" />
                Warnings — {sources.find(s => s.id === warningsOpen)?.label}
              </div>
              <button onClick={() => setWarningsOpen(null)} className="text-amber-500 hover:text-amber-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {(sources.find(s => s.id === warningsOpen)?.warnings ?? []).map((w, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>{w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Section 2 — Qualité du mapping (Lighthouse × Expedia) ────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Qualité du croisement Lighthouse × Expedia</h3>
        <p className="text-xs text-gray-500 mb-5">
          Seules les dates communes aux deux sources permettent un calcul de confiance croisé.
        </p>

        {coverage.total === 0 ? (
          <div className="text-sm text-gray-400 italic">
            Importez Lighthouse et Expedia pour voir le taux de couverture croisée.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Barre de couverture */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Couverture sur {coverage.total} jours uniques</span>
                <span className="font-medium text-gray-700">{coverage.overlapPct}% croisés</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 flex overflow-hidden">
                {coverage.overlapPct > 0 && (
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${coverage.overlapPct}%` }}
                    title={`${coverage.overlap} jours couverts par LH et EX`}
                  />
                )}
                {coverage.lhOnlyPct > 0 && (
                  <div
                    className="h-full bg-blue-300 transition-all"
                    style={{ width: `${coverage.lhOnlyPct}%` }}
                    title={`${coverage.lhOnly} jours Lighthouse seul`}
                  />
                )}
                {coverage.exOnlyPct > 0 && (
                  <div
                    className="h-full bg-orange-300 transition-all"
                    style={{ width: `${coverage.exOnlyPct}%` }}
                    title={`${coverage.exOnly} jours Expedia seul`}
                  />
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                  <span className="text-gray-600">{coverage.overlap} jours croisés ({coverage.overlapPct}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" />
                  <span className="text-gray-600">{coverage.lhOnly} Lighthouse seul ({coverage.lhOnlyPct}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-300 inline-block" />
                  <span className="text-gray-600">{coverage.exOnly} Expedia seul ({coverage.exOnlyPct}%)</span>
                </span>
              </div>
            </div>

            {/* KPI résumé */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{coverage.overlapPct}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Signal croisé possible</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{coverage.lhTotal}</p>
                <p className="text-xs text-gray-500 mt-0.5">Jours Lighthouse</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{coverage.exTotal}</p>
                <p className="text-xs text-gray-500 mt-0.5">Jours Expedia</p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
