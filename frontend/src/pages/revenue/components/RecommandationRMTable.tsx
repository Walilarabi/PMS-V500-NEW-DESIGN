/**
 * FLOWTYM — Recommandation RM (vue tableau dans Tableau RMS)
 *
 * Tableau des recommandations à valider avec :
 *   - Toolbar : recherche, "Futur seul", source, statut, KPIs inline, Exporter CSV
 *   - Tableau : Jour, Date, Événement, Pression (point + %), Compression, Médiane,
 *     Notre tarif, Recommandation (↗ +17% / ↘ -10%), Confiance, Statut (pastille),
 *     Actions (✓ — ✗ 👁)
 */

import React, { useMemo, useState } from 'react';
import { Check, Minus, X, Eye, TrendingUp, TrendingDown, Download } from 'lucide-react';

export interface RMSRecoDay {
  date: string;
  dayName: string;
  events: Array<{ label: string }>;
  marketPressure: number;
  occupancyRate: number;
  medianPrice: number;
  currentPrice: number;
  suggestedPrice: number;
  confidenceScore: number;
  validationStatus: 'En attente' | 'Acceptée' | 'Refusée' | 'Maintenue';
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-9 text-right">{value}%</span>
    </div>
  );
}

function KpiInline({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'emerald' | 'violet' | 'default' }) {
  const color =
    tone === 'amber' ? 'text-amber-600' :
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'violet' ? 'text-violet-600' :
    'text-gray-700';
  return (
    <div className="flex flex-col items-end">
      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
      <span className={cn('text-sm font-extrabold', color)}>{value}</span>
    </div>
  );
}

export function RecommandationRMTable({
  data,
  handlers,
}: {
  data: RMSRecoDay[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
    handleViewDetail: (date: string) => void;
  };
}) {
  const [search, setSearch] = useState('');
  const [futurOnly, setFuturOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'lighthouse'>('lighthouse');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'validated'>('all');

  const enriched = useMemo(() => data.map(d => ({
    ...d,
    compressionValue: Math.round((d.occupancyRate * d.marketPressure) / 100),
  })), [data]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (futurOnly) {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter(d => d.date >= today);
    }
    if (sourceFilter === 'lighthouse') list = list.filter(d => d.medianPrice > 0);
    if (statusFilter === 'pending') list = list.filter(d => d.validationStatus === 'En attente');
    if (statusFilter === 'validated') list = list.filter(d => d.validationStatus !== 'En attente');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(d =>
        d.date.includes(q) ||
        d.dayName.toLowerCase().includes(q) ||
        d.events.some(e => e.label.toLowerCase().includes(q))
      );
    }
    return list;
  }, [enriched, futurOnly, sourceFilter, statusFilter, search]);

  const stats = useMemo(() => {
    if (enriched.length === 0) {
      return { avgPressure: 0, strongDemand: 0, strongCompression: 0, avgConfidence: 0, toValidate: 0 };
    }
    return {
      avgPressure: Math.round(enriched.reduce((s, d) => s + d.marketPressure, 0) / enriched.length),
      strongDemand: enriched.filter(d => d.marketPressure >= 70).length,
      strongCompression: enriched.filter(d => d.compressionValue >= 50).length,
      avgConfidence: Math.round(enriched.reduce((s, d) => s + d.confidenceScore, 0) / enriched.length),
      toValidate: enriched.filter(d => d.validationStatus === 'En attente').length,
    };
  }, [enriched]);

  const exportCSV = () => {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const headers = ['Date', 'Jour', 'Événement', 'Pression %', 'Compression', 'Médiane', 'Notre tarif', 'Tarif suggéré', 'Recommandation %', 'Confiance %', 'Statut'];
    const rows = filtered.map(d => {
      const delta = d.currentPrice > 0 ? ((d.suggestedPrice - d.currentPrice) / d.currentPrice) * 100 : 0;
      return [
        d.date, d.dayName,
        d.events.map(e => e.label).join(' / '),
        Math.round(d.marketPressure),
        d.compressionValue,
        Math.round(d.medianPrice),
        d.currentPrice,
        d.suggestedPrice,
        `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`,
        d.confidenceScore,
        d.validationStatus,
      ].map(escape).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommandations_rms_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-3">
      {/* Toolbar avec KPIs */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Date, jour, événement..."
          className="flex-1 min-w-[200px] max-w-sm px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        />
        <button
          onClick={() => setFuturOnly(v => !v)}
          className={cn(
            'px-3 py-1.5 text-xs rounded border flex items-center gap-1.5',
            futurOnly ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-300'
          )}
        >🕓 Futur seul</button>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value as 'all' | 'lighthouse')}
          className="px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          <option value="all">Toutes sources</option>
          <option value="lighthouse">Lighthouse seul</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'pending' | 'validated')}
          className="px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          <option value="all">Toutes</option>
          <option value="pending">En attente</option>
          <option value="validated">Validées</option>
        </select>

        <div className="flex items-center gap-3 ml-auto">
          <KpiInline label="Pression moy." value={`${stats.avgPressure}%`} tone="amber" />
          <KpiInline label="Forte demande" value={`${stats.strongDemand}`} tone="default" />
          <KpiInline label="Forte compr." value={`${stats.strongCompression}`} tone="default" />
          <KpiInline label="Confiance moy." value={`${stats.avgConfidence}%`} tone="emerald" />
          <KpiInline label="À valider" value={`${stats.toValidate}`} tone="violet" />
        </div>

        <button
          onClick={exportCSV}
          className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1.5 font-semibold"
        >
          <Download className="w-3 h-3" />
          Exporter
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] text-gray-600 uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left font-semibold">Jour</th>
                <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Événement</th>
                <th className="px-3 py-2.5 text-left font-semibold">Pression</th>
                <th className="px-3 py-2.5 text-right font-semibold">Compression</th>
                <th className="px-3 py-2.5 text-right font-semibold">Médiane</th>
                <th className="px-3 py-2.5 text-right font-semibold">Notre tarif</th>
                <th className="px-3 py-2.5 text-left font-semibold">Recommandation</th>
                <th className="px-3 py-2.5 text-left font-semibold">Confiance</th>
                <th className="px-3 py-2.5 text-center font-semibold">Statut</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const delta = d.currentPrice > 0 ? ((d.suggestedPrice - d.currentPrice) / d.currentPrice) * 100 : 0;
                const isUp = delta > 1;
                const isDown = delta < -1;
                const statusColor =
                  d.validationStatus === 'Acceptée' ? 'bg-emerald-500' :
                  d.validationStatus === 'Refusée' ? 'bg-red-500' :
                  d.validationStatus === 'Maintenue' ? 'bg-gray-400' :
                  'bg-amber-400';
                return (
                  <tr key={d.date} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{d.dayName}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{d.events.length === 0 ? '—' : d.events[0].label}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn(
                          'inline-block w-1.5 h-1.5 rounded-full',
                          d.marketPressure >= 70 ? 'bg-red-500' :
                          d.marketPressure >= 40 ? 'bg-blue-500' : 'bg-amber-400'
                        )} />
                        <span className={cn(
                          'font-bold',
                          d.marketPressure >= 70 ? 'text-red-600' :
                          d.marketPressure >= 40 ? 'text-blue-600' : 'text-amber-600'
                        )}>{Math.round(d.marketPressure)}%</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                        {d.compressionValue}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{Math.round(d.medianPrice)}€</td>
                    <td className="px-3 py-2 text-right text-blue-600 font-medium">{Math.round(d.currentPrice)}€</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold',
                        isUp ? 'bg-emerald-50 text-emerald-700' :
                        isDown ? 'bg-red-50 text-red-700' :
                        'bg-gray-50 text-gray-600'
                      )}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> :
                          isDown ? <TrendingDown className="w-3 h-3" /> :
                          <Minus className="w-3 h-3" />}
                        {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2"><ConfidenceBar value={d.confidenceScore} /></td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn('inline-block w-2.5 h-2.5 rounded-full', statusColor)}
                        title={d.validationStatus}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlers.handleAccept(d.date)}
                          title="Accepter"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-emerald-50 text-emerald-600"
                        ><Check className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => handlers.handleMaintain(d.date)}
                          title="Maintenir"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                        ><Minus className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => handlers.handleReject(d.date)}
                          title="Refuser"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-600"
                        ><X className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => handlers.handleViewDetail(d.date)}
                          title="Voir détail"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-blue-600"
                        ><Eye className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-sm text-gray-400">
                    Aucune recommandation ne correspond aux filtres
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
