/**
 * FLOWTYM — Premium Compset Chart
 * Graphique veille concurrentielle premium (type Lighthouse mais redesigné)
 *
 *   - Area ombrée min↔max compset
 *   - Ligne médiane actuelle (vert fort, dominant)
 *   - Ligne notre hôtel (bleu épais, premium)
 *   - Barres demande marché : arrondies, palette pastel température, translucides
 *   - 3 courbes de référence simultanées (J-1 / J-3 / J-7) — toggles indépendants
 *     Hiérarchie visuelle : J-1 vert atténué, J-3 gris, J-7 gris clair
 *   - 3 courbes de demande référence (lignes minces violet → atténué)
 *   - Tooltip riche multi-périodes
 *   - KPIs synthèse mois en header
 *   - Légende interactive (cliquer pour masquer/afficher)
 */

import { useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, GitCompare, Eye, EyeOff } from 'lucide-react';
import type { LighthouseImport } from '../../../services/lighthouse-parser.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ── Palette de couleurs avec hiérarchie visuelle ──────────────────────────
const COLORS = {
  ourHotel:      '#2563eb',   // Bleu fort — notre tarif (dominant)
  median:        '#059669',   // Vert émeraude fort — médiane actuelle (primaire)
  median1:       '#34d399',   // Vert clair — médiane J-1 (secondaire)
  median3:       '#9ca3af',   // Gris — médiane J-3 (tertiaire)
  median7:       '#d1d5db',   // Gris clair — médiane J-7 (quaternaire)
  demand1:       '#7c3aed',   // Violet — demande J-1
  demand3:       '#a78bfa',   // Violet pastel — demande J-3
  demand7:       '#c4b5fd',   // Violet très clair — demande J-7
  compsetRange:  '#fbbf24',
  grid:          '#f3f4f6',
  axis:          '#9ca3af',
};

// ── Palette température pour les barres de demande ────────────────────────
function getDemandColor(demand: number): string {
  if (demand >= 90) return '#ef4444';
  if (demand >= 80) return '#fca5a5';
  if (demand >= 70) return '#fdba74';
  if (demand >= 50) return '#fde68a';
  if (demand >= 30) return '#bbf7d0';
  return '#bfdbfe';
}

// ── Types ─────────────────────────────────────────────────────────────────

interface ChartDatum {
  date: string;
  dateLabel: string;
  ourPrice: number | null;
  compsetMedian: number | null;
  compsetMin: number | null;
  compsetMax: number | null;
  demand: number;
  events: string;
  ranking: string;
  competitors: Array<{ name: string; price: number | null; status: string }>;
  // Référence J-1 (vs Hier)
  ref1Median: number | null;
  ref1Demand: number | null;
  // Référence J-3
  ref3Median: number | null;
  ref3Demand: number | null;
  // Référence J-7
  ref7Median: number | null;
  ref7Demand: number | null;
}

interface RefPeriodConfig {
  key: 'j1' | 'j3' | 'j7';
  label: string;
  medianKey: keyof ChartDatum;
  demandKey: keyof ChartDatum;
  medianColor: string;
  demandColor: string;
  medianWidth: number;
  medianDash: string;
  demandDash: string;
}

const REF_PERIODS: RefPeriodConfig[] = [
  {
    key: 'j1',
    label: 'vs Hier',
    medianKey: 'ref1Median',
    demandKey: 'ref1Demand',
    medianColor: COLORS.median1,
    demandColor: COLORS.demand1,
    medianWidth: 1.5,
    medianDash: '8 4',
    demandDash: '5 3',
  },
  {
    key: 'j3',
    label: 'vs 3j',
    medianKey: 'ref3Median',
    demandKey: 'ref3Demand',
    medianColor: COLORS.median3,
    demandColor: COLORS.demand3,
    medianWidth: 1.5,
    medianDash: '5 4',
    demandDash: '4 3',
  },
  {
    key: 'j7',
    label: 'vs 7j',
    medianKey: 'ref7Median',
    demandKey: 'ref7Demand',
    medianColor: COLORS.median7,
    demandColor: COLORS.demand7,
    medianWidth: 1,
    medianDash: '3 3',
    demandDash: '3 3',
  },
];

// ── Tooltip premium ───────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  ourHotelName: string;
  showJ1: boolean;
  showJ3: boolean;
  showJ7: boolean;
}

function PremiumTooltip({ active, payload, ourHotelName, showJ1, showJ3, showJ7 }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;

  const allHotels = [
    { name: ourHotelName, price: d.ourPrice ?? 0, isUs: true, status: 'available' },
    ...d.competitors.map(c => ({ name: c.name, price: c.price ?? 0, isUs: false, status: c.status })),
  ];
  const ranked = allHotels
    .filter(h => h.status === 'available' && h.price > 0)
    .sort((a, b) => b.price - a.price);

  const refData: Array<{ label: string; median: number | null; demand: number | null; color: string }> = [];
  if (showJ1 && (d.ref1Median !== null || d.ref1Demand !== null))
    refData.push({ label: 'vs Hier',  median: d.ref1Median, demand: d.ref1Demand, color: COLORS.median1 });
  if (showJ3 && (d.ref3Median !== null || d.ref3Demand !== null))
    refData.push({ label: 'vs 3j',    median: d.ref3Median, demand: d.ref3Demand, color: COLORS.median3 });
  if (showJ7 && (d.ref7Median !== null || d.ref7Demand !== null))
    refData.push({ label: 'vs 7j',    median: d.ref7Median, demand: d.ref7Demand, color: COLORS.median7 });

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-gray-200 px-4 py-3 min-w-[280px] max-w-[400px]">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
        <div className="font-semibold text-sm text-gray-900">{d.dateLabel}</div>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: getDemandColor(d.demand) + '40', color: '#374151' }}
        >
          Demande {d.demand}%
        </div>
      </div>

      {/* Comparaison multi-périodes */}
      {refData.length > 0 && (
        <div className="mb-3 pb-2 border-b border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
            <GitCompare className="w-3 h-3" />
            Comparaison temporelle
          </div>
          <div className="space-y-1.5">
            {/* En-tête */}
            <div className="grid grid-cols-4 gap-1 text-[9px] text-gray-400 uppercase tracking-wide font-medium pb-1 border-b border-gray-100">
              <div>Période</div>
              <div className="text-right">Médiane</div>
              <div className="text-right">Δ méd.</div>
              <div className="text-right">Demande</div>
            </div>
            {/* Ligne actuelle */}
            <div className="grid grid-cols-4 gap-1 text-xs items-center">
              <div className="flex items-center gap-1">
                <span className="w-2 h-0.5 rounded" style={{ background: COLORS.median, display: 'inline-block' }} />
                <span className="font-semibold text-gray-800">Actuel</span>
              </div>
              <div className="text-right font-bold text-gray-900">{d.compsetMedian ?? '—'}€</div>
              <div className="text-right text-gray-400">—</div>
              <div className="text-right font-semibold text-gray-800">{d.demand}%</div>
            </div>
            {refData.map(ref => {
              const deltaMedian = d.compsetMedian !== null && ref.median !== null
                ? Math.round(d.compsetMedian - ref.median) : null;
              const deltaDemand = ref.demand !== null
                ? Math.round(d.demand - ref.demand) : null;
              return (
                <div key={ref.label} className="grid grid-cols-4 gap-1 text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-0.5 rounded border-dashed" style={{ background: ref.color, display: 'inline-block' }} />
                    <span className="text-gray-600">{ref.label}</span>
                  </div>
                  <div className="text-right text-gray-600">{ref.median !== null ? `${Math.round(ref.median)}€` : '—'}</div>
                  <div className={cn(
                    'text-right font-semibold',
                    deltaMedian === null ? 'text-gray-300' :
                    deltaMedian > 0 ? 'text-emerald-600' : deltaMedian < 0 ? 'text-red-600' : 'text-gray-400',
                  )}>
                    {deltaMedian !== null ? `${deltaMedian > 0 ? '+' : ''}${deltaMedian}€` : '—'}
                  </div>
                  <div className={cn(
                    'text-right',
                    deltaDemand === null ? 'text-gray-300' :
                    deltaDemand > 0 ? 'text-emerald-600' : deltaDemand < 0 ? 'text-red-600' : 'text-gray-400',
                  )}>
                    {deltaDemand !== null ? `${deltaDemand > 0 ? '+' : ''}${deltaDemand}pts` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Min / Médiane / Max */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Min</div>
          <div className="text-sm font-semibold text-emerald-600">{d.compsetMin ?? '—'}€</div>
        </div>
        <div className="border-x border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Médiane</div>
          <div className="text-sm font-semibold text-gray-900">{d.compsetMedian ?? '—'}€</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Max</div>
          <div className="text-sm font-semibold text-orange-600">{d.compsetMax ?? '—'}€</div>
        </div>
      </div>

      {/* Classement concurrents */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {ranked.map((h, idx) => {
          const median = d.compsetMedian ?? 0;
          const diff = median > 0 ? ((h.price - median) / median) * 100 : 0;
          return (
            <div key={h.name} className={cn(
              'flex items-center justify-between gap-2 px-2 py-1 rounded text-xs',
              h.isUs && 'bg-blue-50 border border-blue-200',
            )}>
              <span className="text-gray-400 w-4 text-center">#{idx + 1}</span>
              <span className={cn('flex-1 truncate', h.isUs ? 'font-bold text-blue-900' : 'text-gray-700')}>
                {h.isUs && <Target className="inline w-2.5 h-2.5 mr-1" />}
                {h.name}
              </span>
              <span className={cn('font-mono font-semibold tabular-nums', h.isUs ? 'text-blue-700' : 'text-gray-900')}>
                {Math.round(h.price)}€
              </span>
              <span className={cn(
                'w-12 text-right text-[10px]',
                diff > 5 ? 'text-emerald-600' : diff < -5 ? 'text-red-600' : 'text-gray-400',
              )}>
                {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      {d.events && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
          🎉 {d.events}
        </div>
      )}
    </div>
  );
}

// ── Props publiques ───────────────────────────────────────────────────────

export interface PremiumCompsetChartProps {
  importData: LighthouseImport;
  selectedMonth: string;
  onDateClick?: (date: string) => void;
}

// ── Composant principal ────────────────────────────────────────────────────

export function PremiumCompsetChart({ importData, selectedMonth, onDateClick }: PremiumCompsetChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [showJ1, setShowJ1] = useState(false);
  const [showJ3, setShowJ3] = useState(false);
  const [showJ7, setShowJ7] = useState(false);

  // ── Données graphique ─────────────────────────────────────────────
  const data = useMemo<ChartDatum[]>(() => {
    return importData.days
      .filter(d => d.date.startsWith(selectedMonth))
      .map(d => ({
        date: d.date,
        dateLabel: `${d.dayName} ${d.date.slice(8, 10)}`,
        ourPrice: d.ourPrice > 0 ? d.ourPrice : null,
        compsetMedian: d.compsetMedian > 0 ? d.compsetMedian : null,
        compsetMin: d.compsetMin,
        compsetMax: d.compsetMax,
        demand: d.marketDemandPercent,
        events: d.events,
        ranking: d.ranking,
        competitors: d.competitors.map(c => ({ name: c.hotelName, price: c.price, status: c.status })),
        ref1Median: d.vsYesterday?.compsetMedian ?? null,
        ref1Demand: d.vsYesterday?.demandPercent ?? null,
        ref3Median: d.vs3Days?.compsetMedian ?? null,
        ref3Demand: d.vs3Days?.demandPercent ?? null,
        ref7Median: d.vs7Days?.compsetMedian ?? null,
        ref7Demand: d.vs7Days?.demandPercent ?? null,
      }));
  }, [importData, selectedMonth]);

  // ── KPIs mensuels ─────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (data.length === 0) return null;
    const ourPrices = data.map(d => d.ourPrice).filter((v): v is number => v !== null);
    const medians   = data.map(d => d.compsetMedian).filter((v): v is number => v !== null);
    const avgOur    = ourPrices.length > 0 ? Math.round(ourPrices.reduce((s, p) => s + p, 0) / ourPrices.length) : 0;
    const avgMedian = medians.length   > 0 ? Math.round(medians.reduce((s, p) => s + p, 0) / medians.length) : 0;
    const gap    = avgOur - avgMedian;
    const gapPct = avgMedian > 0 ? (gap / avgMedian) * 100 : 0;
    return { avgOur, avgMedian, gap, gapPct };
  }, [data]);

  // ── Détection feuilles VS disponibles ─────────────────────────────
  const hasVsSheets = useMemo(() => {
    const day = importData.days[0];
    if (!day) return { j1: false, j3: false, j7: false };
    return {
      j1: day.vsYesterday != null,
      j3: day.vs3Days     != null,
      j7: day.vs7Days     != null,
    };
  }, [importData]);

  const anyRefEnabled = showJ1 || showJ3 || showJ7;

  // ── KPI delta agrégé (pour la barre de comparaison) ───────────────
  const refSummary = useMemo(() => {
    if (!anyRefEnabled) return null;
    const results: Array<{ label: string; deltaMedian: number | null; deltaDemand: number | null; count: number }> = [];

    const compute = (enabled: boolean, medianKey: keyof ChartDatum, demandKey: keyof ChartDatum, label: string) => {
      if (!enabled) return;
      const pairs = data.filter(d => d[medianKey] !== null && d.compsetMedian !== null);
      if (pairs.length === 0) { results.push({ label, deltaMedian: null, deltaDemand: null, count: 0 }); return; }
      const avgDelta = Math.round(pairs.reduce((s, d) => s + ((d.compsetMedian ?? 0) - (d[medianKey] as number)), 0) / pairs.length);
      const demandPairs = data.filter(d => d[demandKey] !== null);
      const avgDemandDelta = demandPairs.length > 0
        ? Math.round(demandPairs.reduce((s, d) => s + (d.demand - (d[demandKey] as number)), 0) / demandPairs.length)
        : null;
      results.push({ label, deltaMedian: avgDelta, deltaDemand: avgDemandDelta, count: pairs.length });
    };

    compute(showJ1, 'ref1Median', 'ref1Demand', 'vs Hier');
    compute(showJ3, 'ref3Median', 'ref3Demand', 'vs 3j');
    compute(showJ7, 'ref7Median', 'ref7Demand', 'vs 7j');
    return results;
  }, [anyRefEnabled, showJ1, showJ3, showJ7, data]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        Aucune donnée disponible pour ce mois.
      </div>
    );
  }

  // ── Rendu ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Écart des tarifs</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Notre positionnement face au compset · {data.length} jours analysés
          </p>
        </div>

        {kpis && (
          <div className="flex items-center gap-5 text-xs">
            <div>
              <div className="text-gray-400">Notre tarif moyen</div>
              <div className="text-sm font-semibold text-blue-600">{kpis.avgOur}€</div>
            </div>
            <div>
              <div className="text-gray-400">Médiane compset</div>
              <div className="text-sm font-semibold" style={{ color: COLORS.median }}>{kpis.avgMedian}€</div>
            </div>
            <div>
              <div className="text-gray-400">Écart moyen</div>
              <div className={cn(
                'text-sm font-bold flex items-center gap-1',
                kpis.gap >= 0 ? 'text-emerald-600' : 'text-red-600',
              )}>
                {kpis.gap >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpis.gap >= 0 ? '+' : ''}{kpis.gap}€ ({kpis.gapPct >= 0 ? '+' : ''}{kpis.gapPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOUTONS COMPARAISON TEMPORELLE ──────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <GitCompare className="w-3.5 h-3.5" />
          <span className="font-medium">Superposer :</span>
        </div>

        {REF_PERIODS.map(period => {
          const available = hasVsSheets[period.key];
          const active = period.key === 'j1' ? showJ1 : period.key === 'j3' ? showJ3 : showJ7;
          const toggle = () => {
            if (!available) return;
            if (period.key === 'j1') setShowJ1(p => !p);
            else if (period.key === 'j3') setShowJ3(p => !p);
            else setShowJ7(p => !p);
          };
          return (
            <button
              key={period.key}
              onClick={toggle}
              disabled={!available}
              title={
                available
                  ? `${active ? 'Masquer' : 'Afficher'} la médiane et la demande ${period.label}`
                  : `Feuille vs. ${period.label} non présente dans le fichier Lighthouse`
              }
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                active
                  ? 'text-white shadow-sm border-transparent'
                  : available
                  ? 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed',
              )}
              style={active ? { backgroundColor: period.medianColor, borderColor: period.medianColor } : {}}
            >
              {active
                ? <EyeOff className="w-3 h-3" />
                : <Eye className="w-3 h-3 opacity-60" />
              }
              {period.label}
            </button>
          );
        })}

        {anyRefEnabled && (
          <button
            onClick={() => { setShowJ1(false); setShowJ3(false); setShowJ7(false); }}
            className="px-3 py-1 rounded-full text-xs font-semibold border bg-white text-gray-500 border-gray-200 hover:text-gray-700 ml-1"
          >
            ✕ Tout retirer
          </button>
        )}

        {/* KPI delta synthétique */}
        {refSummary && refSummary.length > 0 && (
          <div className="ml-auto flex items-center gap-4 text-xs bg-gray-50 rounded-full px-3 py-1 border border-gray-200 flex-wrap">
            {refSummary.map((r, i) => (
              <span key={r.label} className={cn('flex items-center gap-2', i > 0 && 'border-l border-gray-200 pl-4')}>
                <span className="text-gray-500 font-medium">{r.label} :</span>
                {r.count > 0 ? (
                  <>
                    <span className={cn(
                      'font-bold',
                      r.deltaMedian === null ? 'text-gray-400' :
                      r.deltaMedian > 0 ? 'text-emerald-600' : r.deltaMedian < 0 ? 'text-red-600' : 'text-gray-600',
                    )}>
                      {r.deltaMedian !== null ? `${r.deltaMedian > 0 ? '+' : ''}${r.deltaMedian}€` : '—'}
                    </span>
                    {r.deltaDemand !== null && (
                      <span className={cn(
                        'text-gray-400',
                        r.deltaDemand > 0 ? 'text-emerald-600' : r.deltaDemand < 0 ? 'text-red-600' : '',
                      )}>
                        {r.deltaDemand > 0 ? '+' : ''}{r.deltaDemand}pts
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-600 text-[10px]">non disponible</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── GRAPHIQUE ──────────────────────────────────────────────────── */}
      <div className="px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(e: any) => {
              if (e?.activePayload?.[0]?.payload?.date && onDateClick) {
                onDateClick(e.activePayload[0].payload.date);
              }
            }}
          >
            <defs>
              <linearGradient id="compset-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.compsetRange} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.compsetRange} stopOpacity={0.04} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />

            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={{ stroke: COLORS.grid }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}€`}
            />
            <YAxis
              yAxisId="demand"
              orientation="right"
              tick={{ fontSize: 11, fill: COLORS.axis }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              width={45}
            />

            <Tooltip
              content={
                <PremiumTooltip
                  ourHotelName={importData.ourHotelName}
                  showJ1={showJ1}
                  showJ3={showJ3}
                  showJ7={showJ7}
                />
              }
              cursor={{ stroke: COLORS.ourHotel, strokeWidth: 1, strokeDasharray: '3 3' }}
              animationDuration={150}
            />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(e: any) => toggleSeries(e.dataKey)}
            />

            {/* ── Barres demande marché (translucides, fond) ──────── */}
            {!hiddenSeries.has('demand') && (
              <Bar
                yAxisId="demand"
                dataKey="demand"
                name="Demande marché"
                radius={[6, 6, 0, 0]}
                maxBarSize={18}
                isAnimationActive
                animationDuration={400}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={getDemandColor(entry.demand)}
                    fillOpacity={0.65}
                  />
                ))}
              </Bar>
            )}

            {/* ── Référence J-7 demande (la plus atténuée — d'abord) ── */}
            {showJ7 && !hiddenSeries.has('ref7Demand') && (
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="ref7Demand"
                name="Demande vs 7j"
                stroke={COLORS.demand7}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 3, fill: COLORS.demand7 }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Référence J-3 demande ───────────────────────────── */}
            {showJ3 && !hiddenSeries.has('ref3Demand') && (
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="ref3Demand"
                name="Demande vs 3j"
                stroke={COLORS.demand3}
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3, fill: COLORS.demand3 }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Référence J-1 demande ───────────────────────────── */}
            {showJ1 && !hiddenSeries.has('ref1Demand') && (
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="ref1Demand"
                name="Demande vs Hier"
                stroke={COLORS.demand1}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.demand1 }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Zone compset min↔max (fond) ──────────────────────── */}
            {!hiddenSeries.has('compsetMax') && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="compsetMax"
                name="Max compset"
                stroke="none"
                fill="url(#compset-area)"
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}
            {!hiddenSeries.has('compsetMin') && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="compsetMin"
                name="Min compset"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
                isAnimationActive={false}
                connectNulls
              />
            )}

            {/* ── Références médiane (J-7 en premier, plus atténué) ── */}
            {showJ7 && !hiddenSeries.has('ref7Median') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ref7Median"
                name="Médiane vs 7j"
                stroke={COLORS.median7}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.median7, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Référence médiane J-3 ───────────────────────────── */}
            {showJ3 && !hiddenSeries.has('ref3Median') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ref3Median"
                name="Médiane vs 3j"
                stroke={COLORS.median3}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.median3, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Référence médiane J-1 ───────────────────────────── */}
            {showJ1 && !hiddenSeries.has('ref1Median') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ref1Median"
                name="Médiane vs Hier"
                stroke={COLORS.median1}
                strokeWidth={1.5}
                strokeDasharray="8 4"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.median1, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Médiane actuelle (primaire, au-dessus des références) */}
            {!hiddenSeries.has('compsetMedian') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="compsetMedian"
                name="Médiane compset"
                stroke={COLORS.median}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: COLORS.median, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Notre tarif (dominant, tout au-dessus) ─────────── */}
            {!hiddenSeries.has('ourPrice') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ourPrice"
                name={importData.ourHotelName}
                stroke={COLORS.ourHotel}
                strokeWidth={3}
                dot={{ r: 3, stroke: COLORS.ourHotel, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, stroke: COLORS.ourHotel, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* ── Ligne médiane moyenne (référence horizontale) ───── */}
            {kpis && (
              <ReferenceLine
                yAxisId="price"
                y={kpis.avgMedian}
                stroke={COLORS.median}
                strokeOpacity={0.25}
                strokeDasharray="5 5"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── LÉGENDE TEMPÉRATURE ──────────────────────────────────────── */}
      <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
        <span className="font-medium text-gray-600">Demande marché :</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#bfdbfe' }} />&lt; 30 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#bbf7d0' }} />30-50 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fde68a' }} />50-70 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fdba74' }} />70-80 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fca5a5' }} />80-90 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#ef4444' }} />&gt; 90 %</span>

        {anyRefEnabled && (
          <>
            <span className="border-l border-gray-200 h-3 mx-1" />
            <span className="font-medium text-gray-600">Références :</span>
            {showJ1 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-0 rounded" style={{ borderTop: `2px dashed ${COLORS.median1}` }} />
                vs Hier
              </span>
            )}
            {showJ3 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-0 rounded" style={{ borderTop: `2px dashed ${COLORS.median3}` }} />
                vs 3j
              </span>
            )}
            {showJ7 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-0 rounded" style={{ borderTop: `1px dashed ${COLORS.median7}` }} />
                vs 7j
              </span>
            )}
          </>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
        <span>
          Cliquez sur un point pour le détail · Cliquez sur une légende pour masquer.
          {anyRefEnabled && ' · Les courbes en pointillés sont les références temporelles.'}
        </span>
        <span>{importData.competitorNames.length} concurrents · MAJ {new Date(importData.importedAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
}
