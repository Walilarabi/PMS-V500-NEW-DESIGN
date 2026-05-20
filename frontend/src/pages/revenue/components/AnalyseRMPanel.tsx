/**
 * FLOWTYM — AnalyseRMPanel
 *
 * Vue "Analyse RM" — calquée sur la structure Excel "Analyse jour par jour".
 * Reçoit data: DayRMSData[] (lignes déjà enrichies par EFFET 2) — zéro re-fetch.
 *
 * 14 colonnes :
 *   Date · Jour · Pression % · Niv. demande · Score compression · Niv. compression ·
 *   TO% · Événement · ⚠ Manquant · Tarif actuel · Tarif suggéré ·
 *   Opportunité · Source · Confiance
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { DayRMSData } from '../RMSTableauPro';

// ─── Niveau types ─────────────────────────────────────────────────────────

type DemandLevel = 'Faible' | 'Moyenne' | 'Forte' | 'Très forte';
type CompressionLevel = 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée';
type SortKey = 'date' | 'demand' | 'confidence';
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────

function getDemandLevel(score: number): DemandLevel {
  if (score >= 80) return 'Très forte';
  if (score >= 60) return 'Forte';
  if (score >= 30) return 'Moyenne';
  return 'Faible';
}

function getCompressionLevel(score: number): CompressionLevel {
  if (score >= 75) return 'Très élevée';
  if (score >= 50) return 'Élevée';
  if (score >= 25) return 'Moyenne';
  return 'Faible';
}

function getPricingOpportunity(demandScore: number, compressionScore: number): string {
  if (demandScore < 30) return '–';
  if (demandScore < 60) return '+5% à +10%';
  if (demandScore < 80) return '+10% à +25%';
  if (compressionScore >= 50) return '+25% à +50%';
  return '+15% à +30%';
}

function getMissingEventAlert(marketPressure: number, eventsCount: number): boolean {
  return marketPressure > 70 && eventsCount === 0;
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ─── Colour maps ──────────────────────────────────────────────────────────

const DEMAND_COLORS: Record<DemandLevel, string> = {
  'Très forte': 'bg-red-100 text-red-800',
  'Forte':      'bg-amber-100 text-amber-800',
  'Moyenne':    'bg-blue-100 text-blue-800',
  'Faible':     'bg-gray-100 text-gray-600',
};

const COMPRESSION_COLORS: Record<CompressionLevel, string> = {
  'Très élevée': 'bg-red-100 text-red-800',
  'Élevée':      'bg-orange-100 text-orange-800',
  'Moyenne':     'bg-amber-100 text-amber-800',
  'Faible':      'bg-gray-100 text-gray-600',
};

// ─── Enriched row ─────────────────────────────────────────────────────────

interface AnalyseRow {
  date: string;
  dayName: string;
  isWeekend: boolean;
  isToday: boolean;
  marketPressure: number;
  demandScore: number;
  demandLevel: DemandLevel;
  compressionScore: number;
  compressionLevel: CompressionLevel;
  occupancyRate: number;
  events: string;
  missingEventAlert: boolean;
  currentPrice: number;
  suggestedPrice: number;
  pricingOpportunity: string;
  dominantSource: string;
  confidenceScore: number;
}

const SOURCE_LABEL: Record<string, string> = {
  lighthouse: 'LH',
  expedia:    'EX',
  tie:        'LH=EX',
  none:       '–',
};

function enrichRow(row: DayRMSData): AnalyseRow {
  const marketPressure = row.marketBundle?.consensus.combinedPressure ?? row.marketPressure;
  const demandScore    = row.recommendationBreakdown?.demandScore.value ?? marketPressure;
  const compressionScore = row.recommendationBreakdown?.compressionScore.value ?? 0;
  const confidenceBonus  = row.recommendationBreakdown?.confidenceBonus ?? 0;
  const confidenceScore  = Math.min(100, row.confidenceScore + confidenceBonus);

  const dominantSource = SOURCE_LABEL[row.recommendationBreakdown?.dominantSource ?? 'none'] ?? '–';
  const events = row.events.map(e => e.name).join(', ');
  const demandLevel    = getDemandLevel(demandScore);
  const compressionLevel = getCompressionLevel(compressionScore);

  return {
    date: row.date,
    dayName: row.dayName,
    isWeekend: row.isWeekend,
    isToday: row.isToday,
    marketPressure,
    demandScore,
    demandLevel,
    compressionScore,
    compressionLevel,
    occupancyRate: row.occupancyRate,
    events,
    missingEventAlert: getMissingEventAlert(marketPressure, row.events.length),
    currentPrice: row.currentPrice,
    suggestedPrice: row.suggestedPrice,
    pricingOpportunity: getPricingOpportunity(demandScore, compressionScore),
    dominantSource,
    confidenceScore,
  };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export function AnalyseRMPanel({ data }: { data: DayRMSData[] }) {
  const [searchEvent, setSearchEvent]         = useState('');
  const [filterDemand, setFilterDemand]       = useState<DemandLevel[]>([]);
  const [filterCompression, setFilterCompression] = useState<CompressionLevel[]>([]);
  const [sortKey, setSortKey]                 = useState<SortKey>('date');
  const [sortDir, setSortDir]                 = useState<SortDir>('asc');

  const rows = useMemo(() => data.map(enrichRow), [data]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterDemand.length > 0 && !filterDemand.includes(r.demandLevel)) return false;
    if (filterCompression.length > 0 && !filterCompression.includes(r.compressionLevel)) return false;
    if (searchEvent && !r.events.toLowerCase().includes(searchEvent.toLowerCase())) return false;
    return true;
  }), [rows, filterDemand, filterCompression, searchEvent]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date')       cmp = a.date.localeCompare(b.date);
    else if (sortKey === 'demand')     cmp = a.demandScore - b.demandScore;
    else if (sortKey === 'confidence') cmp = a.confidenceScore - b.confidenceScore;
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  const avgDemand       = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.demandScore, 0) / rows.length) : 0;
  const nbHighDemand    = rows.filter(r => r.demandLevel === 'Forte' || r.demandLevel === 'Très forte').length;
  const nbHighCompr     = rows.filter(r => r.compressionLevel === 'Élevée' || r.compressionLevel === 'Très élevée').length;
  const avgConfidence   = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.confidenceScore, 0) / rows.length) : 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-gray-300 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-violet-600 inline" />
      : <ChevronDown className="w-3 h-3 text-violet-600 inline" />;
  }

  const toggleDemandFilter = (level: DemandLevel) =>
    setFilterDemand(prev => prev.includes(level) ? prev.filter(x => x !== level) : [...prev, level]);

  const toggleCompressionFilter = (level: CompressionLevel) =>
    setFilterCompression(prev => prev.includes(level) ? prev.filter(x => x !== level) : [...prev, level]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, AnalyseRow[]>();
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(r);
    }
    return Array.from(map.entries()).map(([month, rs]) => ({
      month,
      total:           rs.length,
      avgDemand:       Math.round(rs.reduce((s, r) => s + r.demandScore, 0) / rs.length),
      avgCompression:  Math.round(rs.reduce((s, r) => s + r.compressionScore, 0) / rs.length),
      nbHighDemand:    rs.filter(r => r.demandLevel === 'Forte' || r.demandLevel === 'Très forte').length,
      nbHighCompr:     rs.filter(r => r.compressionLevel === 'Élevée' || r.compressionLevel === 'Très élevée').length,
      nbAlerts:        rs.filter(r => r.missingEventAlert).length,
      avgConfidence:   Math.round(rs.reduce((s, r) => s + r.confidenceScore, 0) / rs.length),
    }));
  }, [rows]);

  const hasActiveFilters = filterDemand.length > 0 || filterCompression.length > 0 || searchEvent !== '';

  return (
    <div className="p-4 space-y-5">

      {/* ── KPI Banner ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <KpiCard
          label="Période analysée"
          value={`${data.length}j`}
          sub={data.length > 0 ? `${data[0].date} → ${data[data.length - 1].date}` : ''}
        />
        <KpiCard
          label="Demande moyenne"
          value={`${avgDemand}%`}
          sub="Score composite multi-sources"
        />
        <KpiCard
          label="Forte demande"
          value={nbHighDemand}
          sub="Dates Forte ou Très forte"
        />
        <KpiCard
          label="Forte compression"
          value={nbHighCompr}
          sub="Dates Élevée ou Très élevée"
        />
        <KpiCard
          label="Confiance moyenne"
          value={`${avgConfidence}%`}
          sub="Score moteur + bonus consensus"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtres</span>

        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
          <span className="text-xs text-gray-500">Demande :</span>
          {(['Faible', 'Moyenne', 'Forte', 'Très forte'] as DemandLevel[]).map(level => (
            <button
              key={level}
              onClick={() => toggleDemandFilter(level)}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                filterDemand.includes(level)
                  ? DEMAND_COLORS[level] + ' border-current'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              )}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
          <span className="text-xs text-gray-500">Compression :</span>
          {(['Faible', 'Moyenne', 'Élevée', 'Très élevée'] as CompressionLevel[]).map(level => (
            <button
              key={level}
              onClick={() => toggleCompressionFilter(level)}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                filterCompression.includes(level)
                  ? COMPRESSION_COLORS[level] + ' border-current'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              )}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un événement…"
            value={searchEvent}
            onChange={e => setSearchEvent(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-gray-400"
          />
          {searchEvent && (
            <button onClick={() => setSearchEvent('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setFilterDemand([]); setFilterCompression([]); setSearchEvent(''); }}
            className="text-xs text-violet-600 hover:text-violet-800 border-l border-gray-200 pl-3"
          >
            Effacer
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">{sorted.length} / {rows.length} dates</span>
      </div>

      {/* ── Day-by-day table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-violet-700">
                  Date <SortIcon k="date" />
                </button>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Jour</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">
                <button onClick={() => toggleSort('demand')} className="flex items-center gap-1 mx-auto hover:text-violet-700">
                  Pression % <SortIcon k="demand" />
                </button>
              </th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Niv. demande</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Compression</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Niv. compression</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">TO%</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Événement</th>
              <th className="px-3 py-2 text-center font-semibold text-amber-700 whitespace-nowrap">⚠ Manquant</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Tarif actuel</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Tarif suggéré</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Opportunité</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Source</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">
                <button onClick={() => toggleSort('confidence')} className="flex items-center gap-1 mx-auto hover:text-violet-700">
                  Confiance <SortIcon k="confidence" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr
                key={row.date}
                className={cn(
                  'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  row.isToday && 'bg-blue-50/30',
                  row.isWeekend && 'bg-gray-50/40'
                )}
              >
                <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                  {new Date(row.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {row.isToday && <span className="ml-1.5 text-[9px] bg-blue-600 text-white rounded px-1 py-0.5">Auj.</span>}
                </td>
                <td className="px-3 py-2 text-gray-600">{row.dayName}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'font-bold',
                    row.marketPressure >= 70 ? 'text-red-700' :
                    row.marketPressure >= 40 ? 'text-amber-700' : 'text-gray-600'
                  )}>
                    {Math.round(row.marketPressure)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', DEMAND_COLORS[row.demandLevel])}>
                    {row.demandLevel}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'font-semibold text-sm',
                    row.compressionScore >= 75 ? 'text-red-700' :
                    row.compressionScore >= 50 ? 'text-orange-700' : 'text-gray-600'
                  )}>
                    {Math.round(row.compressionScore)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', COMPRESSION_COLORS[row.compressionLevel])}>
                    {row.compressionLevel}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'font-medium',
                    row.occupancyRate >= 85 ? 'text-red-700' :
                    row.occupancyRate >= 70 ? 'text-amber-700' : 'text-gray-700'
                  )}>
                    {Math.round(row.occupancyRate)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 max-w-[180px] truncate" title={row.events || '–'}>
                  {row.events || <span className="text-gray-300">–</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.missingEventAlert ? (
                    <span className="inline-flex items-center justify-center gap-1 text-amber-700" title="Pression élevée sans événement répertorié">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Possible</span>
                    </span>
                  ) : (
                    <span className="text-gray-200 text-xs">–</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">
                  {row.currentPrice > 0 ? `${row.currentPrice}€` : <span className="text-gray-300">–</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    'font-bold',
                    row.suggestedPrice > row.currentPrice ? 'text-emerald-700' :
                    row.suggestedPrice < row.currentPrice ? 'text-red-700' : 'text-gray-700'
                  )}>
                    {row.suggestedPrice > 0 ? `${row.suggestedPrice}€` : '–'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap',
                    row.pricingOpportunity !== '–' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-300'
                  )}>
                    {row.pricingOpportunity}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded',
                    row.dominantSource === 'LH'    ? 'bg-blue-100 text-blue-800' :
                    row.dominantSource === 'EX'    ? 'bg-orange-100 text-orange-800' :
                    row.dominantSource === 'LH=EX' ? 'bg-violet-100 text-violet-800' :
                    'bg-gray-100 text-gray-400'
                  )}>
                    {row.dominantSource}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          row.confidenceScore >= 80 ? 'bg-emerald-500' :
                          row.confidenceScore >= 60 ? 'bg-amber-400' : 'bg-red-400'
                        )}
                        style={{ width: `${row.confidenceScore}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-xs font-semibold tabular-nums',
                      row.confidenceScore >= 80 ? 'text-emerald-700' :
                      row.confidenceScore >= 60 ? 'text-amber-700' : 'text-red-600'
                    )}>
                      {row.confidenceScore}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={14} className="px-6 py-12 text-center text-gray-400 text-sm">
                  Aucune date ne correspond aux filtres actifs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Monthly summary ────────────────────────────────────────────── */}
      {monthGroups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Synthèse mensuelle</h3>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Mois</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Jours</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Demande moy.</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Compression moy.</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Forte demande</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Forte compression</th>
                  <th className="px-4 py-2 text-center font-semibold text-amber-700">⚠ Alertes</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-700">Confiance moy.</th>
                </tr>
              </thead>
              <tbody>
                {monthGroups.map(mg => (
                  <tr key={mg.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">
                      {new Date(mg.month + '-01T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-600">{mg.total}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'font-bold',
                        mg.avgDemand >= 60 ? 'text-red-700' :
                        mg.avgDemand >= 30 ? 'text-amber-700' : 'text-gray-600'
                      )}>
                        {mg.avgDemand}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'font-semibold',
                        mg.avgCompression >= 50 ? 'text-orange-700' : 'text-gray-600'
                      )}>
                        {mg.avgCompression}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-bold',
                        mg.nbHighDemand > 0 ? 'bg-amber-100 text-amber-800' : 'text-gray-400'
                      )}>
                        {mg.nbHighDemand}j
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-bold',
                        mg.nbHighCompr > 0 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'
                      )}>
                        {mg.nbHighCompr}j
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {mg.nbAlerts > 0 ? (
                        <span className="inline-flex items-center justify-center gap-1 text-amber-700 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {mg.nbAlerts}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'text-xs font-semibold',
                        mg.avgConfidence >= 80 ? 'text-emerald-700' :
                        mg.avgConfidence >= 60 ? 'text-amber-700' : 'text-red-600'
                      )}>
                        {mg.avgConfidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
