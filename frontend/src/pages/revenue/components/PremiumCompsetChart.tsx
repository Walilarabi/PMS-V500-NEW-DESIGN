/**
 * FLOWTYM — Premium Compset Chart
 * Graphique veille concurrentielle premium (type Lighthouse mais redesigné)
 *
 *   - Area ombrée min↔max compset
 *   - Ligne médiane (vert)
 *   - Ligne notre hôtel (bleu épais avec points)
 *   - Barres demande marché : arrondies, fines, palette pastel température
 *     (bleu froid si <30%, vert pastel <50%, jaune <70%, orange <80%, rouge >90%)
 *   - Tooltip riche : 11 hôtels triés par prix avec écart vs médiane
 *   - Animations subtiles (400ms)
 *   - Légende interactive (cliquer pour masquer/afficher série)
 *   - KPIs synthèse du mois en header
 *   - Boutons VS Hier / VS 3j / VS 7j : overlay référence médiane + demande
 */

import { useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, GitCompare } from 'lucide-react';
import type { LighthouseImport } from '../../../services/lighthouse-parser.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const COLORS = {
  ourHotel:     '#2563eb',
  median:       '#10b981',
  medianRef:    '#6b7280',   // ligne référence médiane — gris dashed
  demandRef:    '#a78bfa',   // barres/ligne demande référence — violet pastel
  compsetRange: '#fbbf24',
  grid:         '#f3f4f6',
  axis:         '#9ca3af',
};

type CompareMode = 'none' | 'hier' | '3j' | '7j';

const COMPARE_LABELS: Record<CompareMode, string> = {
  none: 'Actuel',
  hier: 'vs Hier',
  '3j': 'vs 3j',
  '7j': 'vs 7j',
};

/**
 * Palette pastel "température" pour les barres de demande.
 */
function getDemandColor(demand: number): string {
  if (demand >= 90) return '#ef4444';
  if (demand >= 80) return '#fca5a5';
  if (demand >= 70) return '#fdba74';
  if (demand >= 50) return '#fde68a';
  if (demand >= 30) return '#bbf7d0';
  return '#bfdbfe';
}

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
  // Snapshot référence (vs Hier / 3j / 7j)
  refMedian: number | null;
  refDemand: number | null;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  ourHotelName: string;
  compareMode: CompareMode;
}

function PremiumTooltip({ active, payload, ourHotelName, compareMode }: TooltipProps) {
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

  const hasRef = compareMode !== 'none' && (d.refMedian !== null || d.refDemand !== null);

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-gray-200 px-4 py-3 min-w-[280px] max-w-[380px]">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
        <div className="font-semibold text-sm text-gray-900">{d.dateLabel}</div>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: getDemandColor(d.demand) + '40', color: '#374151' }}
        >
          Demande {d.demand}%
        </div>
      </div>

      {/* Comparaison médiane si référence disponible */}
      {hasRef && (
        <div className="mb-3 pb-2 border-b border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 font-semibold">
            Comparaison {COMPARE_LABELS[compareMode]}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] text-emerald-600 font-medium">Médiane actuelle</div>
              <div className="font-bold text-gray-900">{d.compsetMedian ?? '—'}€</div>
            </div>
            {d.refMedian !== null && (
              <div>
                <div className="text-[10px] text-gray-500 font-medium">Médiane référence</div>
                <div className="font-bold text-gray-600">{Math.round(d.refMedian)}€</div>
                {d.compsetMedian !== null && (
                  <div className={cn(
                    'text-[10px] font-semibold',
                    d.compsetMedian > d.refMedian ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {d.compsetMedian > d.refMedian ? '+' : ''}{Math.round(d.compsetMedian - d.refMedian)}€
                  </div>
                )}
              </div>
            )}
            {d.refDemand !== null && (
              <>
                <div>
                  <div className="text-[10px] text-violet-600 font-medium">Demande actuelle</div>
                  <div className="font-bold text-gray-900">{d.demand}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium">Demande référence</div>
                  <div className="font-bold text-gray-600">{Math.round(d.refDemand)}%</div>
                  <div className={cn(
                    'text-[10px] font-semibold',
                    d.demand > d.refDemand ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {d.demand > d.refDemand ? '+' : ''}{Math.round(d.demand - d.refDemand)} pts
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                diff > 5 ? 'text-emerald-600' : diff < -5 ? 'text-red-600' : 'text-gray-400'
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

export interface PremiumCompsetChartProps {
  importData: LighthouseImport;
  selectedMonth: string;
  onDateClick?: (date: string) => void;
}

export function PremiumCompsetChart({ importData, selectedMonth, onDateClick }: PremiumCompsetChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState<CompareMode>('none');

  const data = useMemo<ChartDatum[]>(() => {
    return importData.days
      .filter(d => d.date.startsWith(selectedMonth))
      .map(d => {
        // Sélectionner les données de référence selon le mode actif
        const ref =
          compareMode === 'hier' ? d.vsYesterday :
          compareMode === '3j'   ? d.vs3Days     :
          compareMode === '7j'   ? d.vs7Days     :
          null;

        return {
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
          refMedian: ref?.compsetMedian ?? null,
          refDemand: ref?.demandPercent ?? null,
        };
      });
  }, [importData, selectedMonth, compareMode]);

  const kpis = useMemo(() => {
    if (data.length === 0) return null;
    const ourPrices = data.map(d => d.ourPrice).filter((v): v is number => v !== null);
    const medians = data.map(d => d.compsetMedian).filter((v): v is number => v !== null);
    const avgOur = ourPrices.length > 0 ? Math.round(ourPrices.reduce((s, p) => s + p, 0) / ourPrices.length) : 0;
    const avgMedian = medians.length > 0 ? Math.round(medians.reduce((s, p) => s + p, 0) / medians.length) : 0;
    const gap = avgOur - avgMedian;
    const gapPct = avgMedian > 0 ? (gap / avgMedian) * 100 : 0;
    return { avgOur, avgMedian, gap, gapPct };
  }, [data]);

  // Calcul delta KPI entre médiane actuelle et médiane référence
  const refKpis = useMemo(() => {
    if (compareMode === 'none') return null;
    const withRef = data.filter(d => d.refMedian !== null && d.compsetMedian !== null);
    if (withRef.length === 0) return null;
    const avgCurrent = withRef.reduce((s, d) => s + d.compsetMedian!, 0) / withRef.length;
    const avgRef = withRef.reduce((s, d) => s + d.refMedian!, 0) / withRef.length;
    const deltaMedian = Math.round(avgCurrent - avgRef);

    const withDemandRef = data.filter(d => d.refDemand !== null);
    const avgCurrentDemand = data.length > 0 ? data.reduce((s, d) => s + d.demand, 0) / data.length : 0;
    const avgRefDemand = withDemandRef.length > 0
      ? withDemandRef.reduce((s, d) => s + d.refDemand!, 0) / withDemandRef.length
      : null;

    return { deltaMedian, avgCurrentDemand: Math.round(avgCurrentDemand), avgRefDemand: avgRefDemand !== null ? Math.round(avgRefDemand) : null, datesWithRef: withRef.length };
  }, [compareMode, data]);

  const hasVsSheets = useMemo(() => {
    const day = importData.days[0];
    if (!day) return { hier: false, j3: false, j7: false };
    return {
      hier: day.vsYesterday !== undefined && day.vsYesterday !== null,
      j3:   day.vs3Days     !== undefined && day.vs3Days     !== null,
      j7:   day.vs7Days     !== undefined && day.vs7Days     !== null,
    };
  }, [importData]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCompare = (mode: CompareMode) => {
    setCompareMode(prev => prev === mode ? 'none' : mode);
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        Aucune donnée disponible pour ce mois.
      </div>
    );
  }

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

        {/* ── KPIs synthèse ───────────────────────────────────────── */}
        {kpis && (
          <div className="flex items-center gap-5 text-xs">
            <div>
              <div className="text-gray-400">Notre tarif moyen</div>
              <div className="text-sm font-semibold text-blue-600">{kpis.avgOur}€</div>
            </div>
            <div>
              <div className="text-gray-400">Médiane compset</div>
              <div className="text-sm font-semibold text-emerald-600">{kpis.avgMedian}€</div>
            </div>
            <div>
              <div className="text-gray-400">Écart moyen</div>
              <div className={cn(
                'text-sm font-bold flex items-center gap-1',
                kpis.gap >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {kpis.gap >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpis.gap >= 0 ? '+' : ''}{kpis.gap}€ ({kpis.gapPct >= 0 ? '+' : ''}{kpis.gapPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOUTONS COMPARAISON ─────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <GitCompare className="w-3.5 h-3.5" />
          <span className="font-medium">Comparer à :</span>
        </div>

        {([ 'hier', '3j', '7j' ] as CompareMode[]).map(mode => {
          const available = mode === 'hier' ? hasVsSheets.hier : mode === '3j' ? hasVsSheets.j3 : hasVsSheets.j7;
          const active = compareMode === mode;
          return (
            <button
              key={mode}
              onClick={() => available && toggleCompare(mode)}
              disabled={!available}
              title={available ? `Comparer médiane et demande marché avec les données d'il y a ${mode === 'hier' ? '1 jour' : mode === '3j' ? '3 jours' : '7 jours'}` : 'Feuille vs. non présente dans le fichier Lighthouse importé'}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                active
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : available
                  ? 'bg-white text-gray-700 border-gray-300 hover:border-violet-400 hover:text-violet-700'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed',
              )}
            >
              {COMPARE_LABELS[mode]}
            </button>
          );
        })}

        {compareMode !== 'none' && (
          <button
            onClick={() => setCompareMode('none')}
            className="px-3 py-1 rounded-full text-xs font-semibold border bg-white text-gray-500 border-gray-200 hover:text-gray-700 ml-1"
          >
            ✕ Retirer
          </button>
        )}

        {/* Delta KPI en mode comparaison */}
        {refKpis && compareMode !== 'none' && (
          <div className="ml-auto flex items-center gap-4 text-xs bg-gray-50 rounded-full px-3 py-1 border border-gray-200">
            {refKpis.datesWithRef > 0 && (
              <>
                <span className="text-gray-500">{refKpis.datesWithRef} dates avec référence</span>
                <span className="border-l border-gray-200 h-3" />
                <span>
                  <span className="text-gray-500">Δ médiane : </span>
                  <span className={cn(
                    'font-bold',
                    refKpis.deltaMedian > 0 ? 'text-emerald-600' : refKpis.deltaMedian < 0 ? 'text-red-600' : 'text-gray-600',
                  )}>
                    {refKpis.deltaMedian >= 0 ? '+' : ''}{refKpis.deltaMedian}€
                  </span>
                </span>
                {refKpis.avgRefDemand !== null && (
                  <>
                    <span className="border-l border-gray-200 h-3" />
                    <span>
                      <span className="text-gray-500">Δ demande : </span>
                      <span className={cn(
                        'font-bold',
                        refKpis.avgCurrentDemand > refKpis.avgRefDemand ? 'text-emerald-600' :
                        refKpis.avgCurrentDemand < refKpis.avgRefDemand ? 'text-red-600' : 'text-gray-600',
                      )}>
                        {refKpis.avgCurrentDemand > refKpis.avgRefDemand ? '+' : ''}{refKpis.avgCurrentDemand - refKpis.avgRefDemand} pts
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
            {refKpis.datesWithRef === 0 && (
              <span className="text-amber-700 text-xs">Données de référence non disponibles pour ce mois</span>
            )}
          </div>
        )}
      </div>

      {/* ── GRAPHIQUE ─────────────────────────────────────────────────── */}
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
                <stop offset="0%" stopColor={COLORS.compsetRange} stopOpacity={0.30} />
                <stop offset="100%" stopColor={COLORS.compsetRange} stopOpacity={0.05} />
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
              content={<PremiumTooltip ourHotelName={importData.ourHotelName} compareMode={compareMode} />}
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

            {/* Barres demande marché (actuelle) */}
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
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            )}

            {/* Ligne demande marché référence (mode comparaison) */}
            {compareMode !== 'none' && !hiddenSeries.has('refDemand') && (
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="refDemand"
                name={`Demande ${COMPARE_LABELS[compareMode]}`}
                stroke={COLORS.demandRef}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.demandRef }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

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

            {/* Ligne médiane actuelle */}
            {!hiddenSeries.has('compsetMedian') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="compsetMedian"
                name="Médiane compset"
                stroke={COLORS.median}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: COLORS.median, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

            {/* Ligne médiane référence (mode comparaison) — dashed gris */}
            {compareMode !== 'none' && !hiddenSeries.has('refMedian') && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="refMedian"
                name={`Médiane ${COMPARE_LABELS[compareMode]}`}
                stroke={COLORS.medianRef}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 5, stroke: COLORS.medianRef, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            )}

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

            {kpis && (
              <ReferenceLine
                yAxisId="price"
                y={kpis.avgMedian}
                stroke={COLORS.median}
                strokeOpacity={0.3}
                strokeDasharray="5 5"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Légende température des barres demande */}
      <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
        <span className="font-medium text-gray-600">Demande marché :</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#bfdbfe' }} />&lt; 30 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#bbf7d0' }} />30-50 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fde68a' }} />50-70 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fdba74' }} />70-80 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#fca5a5' }} />80-90 %</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#ef4444' }} />&gt; 90 %</span>
        {compareMode !== 'none' && (
          <>
            <span className="border-l border-gray-200 h-3" />
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0 border border-gray-400 border-dashed" />
              Médiane {COMPARE_LABELS[compareMode]}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0 border border-violet-400 border-dashed" />
              Demande {COMPARE_LABELS[compareMode]}
            </span>
          </>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
        <span>
          Cliquez sur un point pour le détail. Cliquez sur une légende pour masquer/afficher.
          {compareMode !== 'none' && ' · Lignes pointillées = données de référence.'}
        </span>
        <span>{importData.competitorNames.length} concurrents · MAJ {new Date(importData.importedAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
}
