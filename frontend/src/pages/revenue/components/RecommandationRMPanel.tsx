/**
 * FLOWTYM — RecommandationRMPanel (cockpit refonte)
 *
 * Cockpit RMS premium · zéro scroll vertical sur la page principale.
 *
 * Layout :
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Toolbar fixe (filtres · mode source · KPI · recalcul · export)   │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Table compacte (sticky header + sticky 1re colonne)              │
 *   │   ↳ 11 colonnes maximum · pas de texte long                      │
 *   │   ↳ clic ligne → modal détail premium                            │
 *   │   ↳ scroll interne uniquement                                    │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Pagination + compteur                                            │
 *   └──────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw, Download, Filter, Search, Check, X, Minus, Eye,
  ChevronLeft, ChevronRight, AlertTriangle, Database, Lightbulb,
  TrendingUp, TrendingDown, ChevronDown,
} from 'lucide-react';
import type { DayRMSData } from '../RMSTableauPro';
import {
  buildRMRecommendation,
  type RMRecommendation,
  type SourceMode,
} from '../../../services/recommandation-rm.service';
import { RMRecommendationDetailModal, type RMDetailEnrichment } from './RMRecommendationDetailModal';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

function fmtDateShort(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

type DemandLevel = 'Faible' | 'Moyenne' | 'Forte' | 'Très forte';
type CompressionLevel = 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée';

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

const DEMAND_DOT: Record<DemandLevel, string> = {
  'Très forte': 'bg-red-500',
  'Forte':      'bg-amber-500',
  'Moyenne':    'bg-blue-500',
  'Faible':     'bg-gray-300',
};

const COMPRESSION_DOT: Record<CompressionLevel, string> = {
  'Très élevée': 'bg-red-500',
  'Élevée':      'bg-orange-500',
  'Moyenne':     'bg-amber-400',
  'Faible':      'bg-gray-300',
};

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHED ROW
// ═══════════════════════════════════════════════════════════════════════════

interface EnrichedRow {
  raw: DayRMSData;
  recommendation: RMRecommendation;
  demandScore: number;
  demandLevel: DemandLevel;
  compressionScore: number;
  compressionLevel: CompressionLevel;
  combinedPressure: number;
  scoreLH: number | null;
  scoreEX: number | null;
  dominantSourceLabel: string;
  confidenceScore: number;
  isContradiction: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  lighthouse: 'LH', expedia: 'EX', tie: 'LH=EX', none: '–',
};

function enrichRow(row: DayRMSData, totalCapacity: number): EnrichedRow {
  const bundle = row.marketBundle;
  const breakdown = row.recommendationBreakdown;
  const combinedPressure = bundle?.consensus.combinedPressure ?? row.marketPressure;
  const demandScore = breakdown?.demandScore.value ?? combinedPressure;
  const compressionScore = breakdown?.compressionScore.value ?? 0;
  const confidenceScore = Math.min(100, row.confidenceScore + (breakdown?.confidenceBonus ?? 0));

  const recommendation = buildRMRecommendation({
    date: row.date,
    bundle,
    breakdown,
    currentPrice: row.currentPrice,
    suggestedPrice: row.suggestedPrice,
    medianPrice: row.medianPrice,
    occupancyRate: row.occupancyRate,
    availability: row.availability,
    totalCapacity,
    pickupRate: row.pickupRate,
    varVsYesterday: row.varVsYesterday ?? null,
    varVs3Days: row.varVs3Days ?? null,
    varVs7Days: row.varVs7Days ?? null,
    eventsCount: row.events.length,
    recommendationLabel: row.recommendation,
    strategy: row.strategy,
  });

  return {
    raw: row,
    recommendation,
    demandScore,
    demandLevel: getDemandLevel(demandScore),
    compressionScore,
    compressionLevel: getCompressionLevel(compressionScore),
    combinedPressure,
    scoreLH: bundle?.lighthouse.pressurePercent ?? null,
    scoreEX: bundle?.expedia.pressurePercentNeighborhood ?? null,
    dominantSourceLabel: SOURCE_LABEL[bundle?.consensus.dominantSource ?? 'none'] ?? '–',
    confidenceScore,
    isContradiction: bundle?.consensus.agreement === 'diverge',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

interface Handlers {
  onAccept: (date: string) => void;
  onReject: (date: string) => void;
  onMaintain: (date: string) => void;
  onPriceOverride?: (date: string, price: number) => void;
  onRecalculate?: () => void;
}

interface Props {
  data: DayRMSData[];
  totalCapacity: number;
  handlers: Handlers;
}

const PAGE_SIZE = 15;

export function RecommandationRMPanel({ data, totalCapacity, handlers }: Props) {
  const [page, setPage] = useState(0);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'lighthouse' | 'expedia' | 'crossed'>('all');
  const [filterReco, setFilterReco] = useState<'all' | 'Augmenter' | 'Baisser' | 'Maintenir'>('all');

  const enriched = useMemo(() => data.map(r => enrichRow(r, totalCapacity)), [data, totalCapacity]);

  // ─── Filtrage ──────────────────────────────────────────────────────
  const filtered = useMemo(() => enriched.filter(r => {
    if (filterSource !== 'all') {
      const mode = r.recommendation.sourceMode;
      if (filterSource === 'lighthouse' && mode !== 'lighthouse_only') return false;
      if (filterSource === 'expedia'    && mode !== 'expedia_only')    return false;
      if (filterSource === 'crossed'    && mode !== 'crossed')         return false;
    }
    if (filterReco !== 'all' && r.raw.recommendation !== filterReco) return false;
    if (search) {
      const q = search.toLowerCase();
      const eventStr = r.raw.events.map(e => e.name).join(' ').toLowerCase();
      if (!r.raw.date.includes(q) && !eventStr.includes(q) && !r.raw.dayName.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  }), [enriched, filterSource, filterReco, search]);

  // ─── Pagination ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  React.useEffect(() => {
    if (page > 0 && safePage !== page) setPage(safePage);
  }, [filtered.length, page, safePage]);

  // ─── KPI synthèse ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (enriched.length === 0) return null;
    const avgPressure  = Math.round(enriched.reduce((s, r) => s + r.combinedPressure, 0) / enriched.length);
    const nbHighDemand = enriched.filter(r => r.demandLevel === 'Forte' || r.demandLevel === 'Très forte').length;
    const nbHighCompr  = enriched.filter(r => r.compressionLevel === 'Élevée' || r.compressionLevel === 'Très élevée').length;
    const avgConfidence = Math.round(enriched.reduce((s, r) => s + r.confidenceScore, 0) / enriched.length);
    const nbToValidate  = enriched.filter(r => r.raw.validationStatus === 'En attente').length;
    return { avgPressure, nbHighDemand, nbHighCompr, avgConfidence, nbToValidate };
  }, [enriched]);

  // ─── Mode source global ────────────────────────────────────────────
  const globalSourceMode = useMemo((): SourceMode => {
    const modes = enriched.map(r => r.recommendation.sourceMode);
    const hasLH = modes.some(m => m === 'lighthouse_only' || m === 'crossed');
    const hasEX = modes.some(m => m === 'expedia_only'    || m === 'crossed');
    if (hasLH && hasEX) return 'crossed';
    if (hasLH) return 'lighthouse_only';
    if (hasEX) return 'expedia_only';
    return 'none';
  }, [enriched]);

  // ─── Selected detail row ───────────────────────────────────────────
  const detailRow = useMemo(
    () => detailDate ? enriched.find(r => r.raw.date === detailDate) ?? null : null,
    [enriched, detailDate],
  );

  const detailIdx = detailRow ? enriched.findIndex(r => r.raw.date === detailRow.raw.date) : -1;
  const hasPrevDetail = detailIdx > 0;
  const hasNextDetail = detailIdx >= 0 && detailIdx < enriched.length - 1;

  const openDetail = useCallback((date: string) => setDetailDate(date), []);
  const navPrev = useCallback(() => { if (hasPrevDetail) setDetailDate(enriched[detailIdx - 1].raw.date); }, [enriched, detailIdx, hasPrevDetail]);
  const navNext = useCallback(() => { if (hasNextDetail) setDetailDate(enriched[detailIdx + 1].raw.date); }, [enriched, detailIdx, hasNextDetail]);

  // ─── Export CSV ────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const header = ['Date', 'Jour', 'Événement', 'Pression', 'Compression', 'Médiane', 'Notre tarif', 'Recommandation', 'Confiance', 'Statut'];
    const rows = filtered.map(r => [
      r.raw.date,
      r.raw.dayName,
      r.raw.events.map(e => e.name).join(' | '),
      Math.round(r.combinedPressure),
      Math.round(r.compressionScore),
      r.raw.medianPrice,
      r.raw.currentPrice,
      `${r.raw.recommendation} (${r.recommendation.priceDeltaPercent >= 0 ? '+' : ''}${r.recommendation.priceDeltaPercent.toFixed(1)}%)`,
      r.confidenceScore,
      r.raw.validationStatus,
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommandation_rm_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleRecalculate = useCallback(() => {
    if (handlers.onRecalculate) handlers.onRecalculate();
    else window.dispatchEvent(new CustomEvent('rms:recalculate'));
  }, [handlers]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50/40">

      {/* ═══ TOOLBAR ════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Date, jour, événement…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter source */}
        <FilterSelect
          icon={Database}
          label="Source"
          value={filterSource}
          onChange={v => setFilterSource(v as typeof filterSource)}
          options={[
            { value: 'all',        label: 'Toutes sources' },
            { value: 'lighthouse', label: 'Lighthouse seul' },
            { value: 'expedia',    label: 'Expedia seul' },
            { value: 'crossed',    label: 'Croisé LH + EX' },
          ]}
        />

        {/* Filter reco */}
        <FilterSelect
          icon={Filter}
          label="Reco"
          value={filterReco}
          onChange={v => setFilterReco(v as typeof filterReco)}
          options={[
            { value: 'all',       label: 'Toutes' },
            { value: 'Augmenter', label: '↑ Augmenter' },
            { value: 'Baisser',   label: '↓ Baisser' },
            { value: 'Maintenir', label: '= Maintenir' },
          ]}
        />

        {/* Source mode badge */}
        <SourceModeBadge mode={globalSourceMode} />

        {/* Divider */}
        <div className="border-l border-gray-200 h-6" />

        {/* KPIs */}
        {kpis && (
          <div className="flex items-center gap-4 text-xs">
            <KpiInline label="Pression moy."  value={`${kpis.avgPressure}%`}  accent={kpis.avgPressure >= 60 ? 'text-red-700' : kpis.avgPressure >= 40 ? 'text-amber-700' : 'text-gray-700'} />
            <KpiInline label="Forte demande"  value={kpis.nbHighDemand}       accent={kpis.nbHighDemand > 0 ? 'text-amber-700' : 'text-gray-600'} />
            <KpiInline label="Forte compr."   value={kpis.nbHighCompr}        accent={kpis.nbHighCompr > 0 ? 'text-orange-700' : 'text-gray-600'} />
            <KpiInline label="Confiance moy." value={`${kpis.avgConfidence}%`} accent={kpis.avgConfidence >= 80 ? 'text-emerald-700' : kpis.avgConfidence >= 60 ? 'text-amber-700' : 'text-red-600'} />
            <KpiInline label="À valider"      value={kpis.nbToValidate}       accent={kpis.nbToValidate > 0 ? 'text-violet-700' : 'text-gray-600'} />
          </div>
        )}

        {/* Spacer + actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleRecalculate}
            title="Recalculer toutes les recommandations RMS"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-3 h-3" />
            Recalculer
          </button>
          <button
            onClick={handleExport}
            title="Exporter CSV des recommandations filtrées"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-md hover:bg-violet-700"
          >
            <Download className="w-3 h-3" />
            Exporter
          </button>
        </div>
      </div>

      {/* ═══ TABLE (zone flex avec scroll interne) ═══════════════════ */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-2 overflow-hidden">
        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">

          {/* Table avec sticky header + sticky first col */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th sticky className="text-left">Jour</Th>
                  <Th className="text-left">Date</Th>
                  <Th className="text-left">Événement</Th>
                  <Th className="text-center">Pression</Th>
                  <Th className="text-center">Compression</Th>
                  <Th className="text-right">Médiane</Th>
                  <Th className="text-right">Notre tarif</Th>
                  <Th className="text-center">Recommandation</Th>
                  <Th className="text-center">Confiance</Th>
                  <Th className="text-center">Statut</Th>
                  <Th className="text-right pr-3">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center text-gray-400">
                      Aucune date ne correspond aux filtres actifs.
                    </td>
                  </tr>
                )}
                {pageRows.map(r => (
                  <TableRow
                    key={r.raw.date}
                    row={r}
                    onOpen={openDetail}
                    onAccept={handlers.onAccept}
                    onReject={handlers.onReject}
                    onMaintain={handlers.onMaintain}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-200 bg-white px-3 py-2 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-500">
              {filtered.length === 0 ? '0' : `${safePage * PAGE_SIZE + 1}-${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`}
              {' '}sur {filtered.length} dates
              {filtered.length !== enriched.length && <span className="text-gray-400"> ({enriched.length} total)</span>}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  safePage === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-semibold text-gray-700 tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  safePage >= totalPages - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL DÉTAIL ═══════════════════════════════════════════ */}
      {detailRow && (
        <RMRecommendationDetailModal
          row={detailRow.raw}
          enrichment={{
            recommendation: detailRow.recommendation,
            demandScore: detailRow.demandScore,
            compressionScore: detailRow.compressionScore,
            combinedPressure: detailRow.combinedPressure,
            scoreLH: detailRow.scoreLH,
            scoreEX: detailRow.scoreEX,
            dominantSourceLabel: detailRow.dominantSourceLabel,
            confidenceScore: detailRow.confidenceScore,
            isContradiction: detailRow.isContradiction,
          }}
          onClose={() => setDetailDate(null)}
          onAccept={handlers.onAccept}
          onReject={handlers.onReject}
          onMaintain={handlers.onMaintain}
          onPriceOverride={handlers.onPriceOverride}
          onPrev={navPrev}
          onNext={navNext}
          hasPrev={hasPrevDetail}
          hasNext={hasNextDetail}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Th({ children, sticky, className }: { children: React.ReactNode; sticky?: boolean; className?: string }) {
  return (
    <th className={cn(
      'px-3 py-2 font-semibold text-gray-600 uppercase text-[10px] tracking-wide whitespace-nowrap',
      sticky && 'sticky left-0 z-20 bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]',
      className,
    )}>
      {children}
    </th>
  );
}

function TableRow({
  row, onOpen, onAccept, onReject, onMaintain,
}: {
  row: EnrichedRow;
  onOpen: (date: string) => void;
  onAccept: (date: string) => void;
  onReject: (date: string) => void;
  onMaintain: (date: string) => void;
}) {
  const r = row.raw;
  const reco = row.recommendation;
  const events = r.events.map(e => e.name).join(', ');

  const pressureCls =
    row.combinedPressure >= 70 ? 'text-red-700 font-bold' :
    row.combinedPressure >= 40 ? 'text-amber-700 font-semibold' : 'text-gray-600';

  const compressionCls =
    row.compressionScore >= 75 ? 'text-red-700 font-bold' :
    row.compressionScore >= 50 ? 'text-orange-700 font-semibold' : 'text-gray-600';

  const recoIcon =
    r.recommendation === 'Augmenter' ? TrendingUp :
    r.recommendation === 'Baisser'   ? TrendingDown : Minus;

  const recoColor =
    r.recommendation === 'Augmenter' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    r.recommendation === 'Baisser'   ? 'text-red-700 bg-red-50 border-red-200' :
    'text-gray-700 bg-gray-50 border-gray-200';

  return (
    <tr
      onClick={() => onOpen(r.date)}
      className={cn(
        'border-b border-gray-100 cursor-pointer transition-colors group',
        r.isToday      ? 'bg-blue-50/40 hover:bg-blue-50' :
        r.isWeekend    ? 'bg-gray-50/40 hover:bg-gray-100' :
        'hover:bg-violet-50/40',
      )}
    >
      {/* Sticky : Jour */}
      <td className="px-3 py-2 sticky left-0 z-10 bg-inherit font-medium text-gray-900 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{r.dayName}</span>
          {r.isToday && <span className="text-[9px] bg-blue-600 text-white rounded px-1 font-bold">Auj.</span>}
          {row.isContradiction && (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
        </div>
      </td>

      {/* Date */}
      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDateShort(r.date)}</td>

      {/* Événement */}
      <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={events || 'Aucun événement'}>
        {events ? (
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-purple-500" />
            <span className="truncate">{events}</span>
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Pression */}
      <td className="px-3 py-2 text-center whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', DEMAND_DOT[row.demandLevel])} />
          <span className={cn('tabular-nums', pressureCls)}>{Math.round(row.combinedPressure)}%</span>
        </div>
      </td>

      {/* Compression */}
      <td className="px-3 py-2 text-center whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', COMPRESSION_DOT[row.compressionLevel])} />
          <span className={cn('tabular-nums', compressionCls)}>{Math.round(row.compressionScore)}</span>
        </div>
      </td>

      {/* Médiane */}
      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
        {r.medianPrice > 0 ? `${r.medianPrice}€` : <span className="text-gray-300">—</span>}
      </td>

      {/* Notre tarif */}
      <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">
        {r.currentPrice > 0 ? `${r.currentPrice}€` : <span className="text-gray-300">—</span>}
      </td>

      {/* Recommandation */}
      <td className="px-3 py-2 text-center">
        <span
          className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border', recoColor)}
          title={reco.priceAction}
        >
          {React.createElement(recoIcon, { className: 'w-3 h-3' })}
          {r.recommendation === 'Maintenir' ? '0%' : `${reco.priceDeltaPercent >= 0 ? '+' : ''}${reco.priceDeltaPercent.toFixed(0)}%`}
        </span>
      </td>

      {/* Confiance */}
      <td className="px-3 py-2 text-center">
        <div className="inline-flex items-center gap-1.5">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                row.confidenceScore >= 80 ? 'bg-emerald-500' :
                row.confidenceScore >= 60 ? 'bg-amber-400' : 'bg-red-400',
              )}
              style={{ width: `${row.confidenceScore}%` }}
            />
          </div>
          <span className={cn(
            'text-xs font-semibold tabular-nums',
            row.confidenceScore >= 80 ? 'text-emerald-700' :
            row.confidenceScore >= 60 ? 'text-amber-700' : 'text-red-600',
          )}>
            {row.confidenceScore}%
          </span>
        </div>
      </td>

      {/* Statut */}
      <td className="px-3 py-2 text-center">
        <span className={cn(
          'inline-block w-2 h-2 rounded-full',
          r.validationStatus === 'Acceptée'  ? 'bg-emerald-500' :
          r.validationStatus === 'Refusée'   ? 'bg-red-500' :
          r.validationStatus === 'Maintenue' ? 'bg-gray-400' :
          'bg-amber-400',
        )}
        title={r.validationStatus}
        />
      </td>

      {/* Actions */}
      <td className="px-2 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="inline-flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={Check}   color="emerald" title="Accepter"  onClick={() => onAccept(r.date)} />
          <ActionBtn icon={Minus}   color="gray"    title="Maintenir" onClick={() => onMaintain(r.date)} />
          <ActionBtn icon={X}       color="red"     title="Refuser"   onClick={() => onReject(r.date)} />
          <ActionBtn icon={Eye}     color="violet"  title="Détail"    onClick={() => onOpen(r.date)} />
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  icon: Icon, color, title, onClick,
}: {
  icon: typeof Check;
  color: 'emerald' | 'gray' | 'red' | 'violet';
  title: string;
  onClick: () => void;
}) {
  const colorMap = {
    emerald: 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50',
    gray:    'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
    red:     'text-gray-400 hover:text-red-600 hover:bg-red-50',
    violet:  'text-gray-400 hover:text-violet-600 hover:bg-violet-50',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('p-1 rounded transition-colors', colorMap[color])}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function KpiInline({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold leading-none">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums leading-tight', accent ?? 'text-gray-900')}>{value}</span>
    </div>
  );
}

function SourceModeBadge({ mode }: { mode: SourceMode }) {
  const cfg: Record<SourceMode, { label: string; cls: string }> = {
    crossed:         { label: 'Croisé LH + EX',    cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    lighthouse_only: { label: 'Lighthouse seul',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    expedia_only:    { label: 'Expedia seul',      cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    none:            { label: 'Aucune source',     cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  };
  const c = cfg[mode];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border', c.cls)}>
      <Database className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function FilterSelect<T extends string>({
  icon: Icon, label, value, onChange, options,
}: {
  icon: typeof Filter;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="appearance-none pl-6 pr-7 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-md text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        title={label}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Icon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  );
}
