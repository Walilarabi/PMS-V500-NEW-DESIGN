/**
 * FLOWTYM — Widget "Évolution des scores" du Control Center.
 *
 * Affiche l'évolution des 6 dimensions de score sur les N derniers
 * runs du moteur de diagnostic (lus depuis settingsHistory). Présente
 * une grille de sparklines comparables avec mini-stats (valeur actuelle,
 * delta vs run précédent).
 */
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, LineChart } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ScoreCardId } from '@/src/types/settings/diagnostic';
import { TIER_LABEL } from '@/src/types/settings/diagnostic';
import { getHistory } from '@/src/services/settings/settingsHistory';
import type { DiagnosticReport } from '@/src/types/settings/diagnostic';

interface ScoreTrendsPanelProps {
  report: DiagnosticReport;
}

const DIM_LABEL: Record<ScoreCardId, string> = {
  system_health: 'Santé système',
  configuration: 'Configuration',
  compliance: 'Conformité',
  security: 'Sécurité',
  distribution: 'Distribution',
  revenue: 'Revenue',
};

const DIM_TONE: Record<ScoreCardId, string> = {
  system_health: 'text-violet-600',
  configuration: 'text-violet-600',
  compliance: 'text-sky-600',
  security: 'text-rose-600',
  distribution: 'text-emerald-600',
  revenue: 'text-amber-600',
};

export const ScoreTrendsPanel: React.FC<ScoreTrendsPanelProps> = ({ report }) => {
  const history = useMemo(() => getHistory(), [report.generatedAt]);

  // Seulement intéressant à partir de 2 runs
  if (history.length < 2) {
    return (
      <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-violet-500" />
          <h3 className="text-[13px] font-semibold text-slate-900">Évolution des scores</h3>
        </header>
        <div className="px-5 py-10 text-center text-slate-400 text-[12.5px]">
          <div className="text-slate-700 font-medium">Pas encore assez d'historique</div>
          <div className="text-[11.5px] mt-1">
            Les tendances apparaîtront après au moins 2 diagnostics. Cliquez sur "Lancer diagnostic PMS"
            pour ajouter un point.
          </div>
        </div>
      </section>
    );
  }

  const dims: ScoreCardId[] = ['system_health', 'configuration', 'compliance', 'security', 'distribution', 'revenue'];

  return (
    <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-violet-500" />
          <h3 className="text-[13px] font-semibold text-slate-900">Évolution des scores</h3>
        </div>
        <span className="text-[11px] text-slate-500">
          {history.length} runs · depuis {new Date(history[0].at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 p-4">
        {dims.map((d) => {
          const series = history.map((h) => h.scores[d]);
          const current = series[series.length - 1] ?? 0;
          const previous = series[series.length - 2] ?? current;
          const delta = current - previous;
          const sc = report.scores[d];
          return (
            <div key={d} className="rounded-xl ring-1 ring-slate-100 p-3 bg-slate-50/40">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="text-[11.5px] font-semibold text-slate-700">{DIM_LABEL[d]}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {TIER_LABEL[sc.tier]}
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn('text-[18px] font-bold tabular-nums', DIM_TONE[d])}>{current}</span>
                  <span className="text-[10px] text-slate-400">/100</span>
                </div>
              </div>

              {/* Sparkline */}
              <Sparkline values={series} colorClass={DIM_TONE[d]} />

              {/* Delta */}
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  Min {Math.min(...series)} · Max {Math.max(...series)}
                </span>
                <DeltaBadge delta={delta} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const Sparkline: React.FC<{ values: number[]; colorClass: string }> = ({ values, colorClass }) => {
  if (values.length === 0) return null;
  const w = 200; const h = 40;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const lastX = (values.length - 1) / Math.max(1, values.length - 1) * w;
  const lastY = h - ((values[values.length - 1] - min) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} className={cn('w-full h-10', colorClass)} preserveAspectRatio="none">
      {/* Area sous la courbe */}
      <polygon
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        fill="currentColor"
        opacity={0.08}
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
    </svg>
  );
};

const DeltaBadge: React.FC<{ delta: number }> = ({ delta }) => {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-slate-400">
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', up ? 'text-emerald-600' : 'text-rose-600')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{delta}
    </span>
  );
};
