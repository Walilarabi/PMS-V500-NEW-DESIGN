/**
 * FLOWTYM RMS — Market Intelligence Dashboard
 *
 * Dashboard premium type Bloomberg Terminal hôtelier. Vue agrégée de
 * l'état du marché sur toute la fenêtre. Composé de :
 *
 *   • KPI Bar : compression moyenne, velocity index, événements actifs,
 *     alertes critiques, recos en attente
 *   • Alertes : liste prioritaire (critical → info)
 *   • Heatmap compression : 60+ jours visuels
 *   • Top événements critiques : tri par Impact Score + Confidence
 *   • Forecast ADR/TO : prochains 30 jours
 *
 * Design system : sobre, dense, typographie compacte, tabular numerals,
 * couleurs sémantiques. Pas de chartjunk.
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  Gauge,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useMarketIntelligence } from '@/src/hooks/useMarketIntelligence';
import { CompressionHeatmap } from './CompressionHeatmap';
import { CriticalEventsList } from './CriticalEventsList';
import { MarketAlertsPanel } from './MarketAlertsPanel';
import { VelocityRadar } from './VelocityRadar';
import { ForecastTimeline } from './ForecastTimeline';
import {
  COMPRESSION_CLASSIFICATION_LABELS,
  type MarketCompressionScore,
} from '@/src/types/marketIntelligence';

export const MarketIntelligenceDashboard: React.FC = () => {
  const intelligence = useMarketIntelligence();
  const [windowDays, setWindowDays] = useState<30 | 60 | 90 | 180>(60);

  // Fenêtre visible (à partir d'aujourd'hui)
  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + windowDays);
    return d.toISOString().slice(0, 10);
  }, [today, windowDays]);

  const heatmapVisible = useMemo(
    () => intelligence.heatmap.filter((c) => c.date >= today && c.date <= windowEnd),
    [intelligence.heatmap, today, windowEnd],
  );

  // KPIs
  const kpis = useMemo(() => {
    const visibleCompression = Array.from(intelligence.compression.values())
      .filter((c) => c.date >= today && c.date <= windowEnd);
    const avgCompression = visibleCompression.length === 0
      ? 0
      : Math.round(
        visibleCompression.reduce((s, c) => s + c.score, 0) / visibleCompression.length,
      );
    const peakCompression = visibleCompression.reduce<MarketCompressionScore | null>(
      (max, c) => (!max || c.score > max.score ? c : max),
      null,
    );
    const avgVelocity = (() => {
      const vs = Array.from(intelligence.velocity.values())
        .filter((v) => v.date >= today && v.date <= windowEnd);
      if (vs.length === 0) return 0;
      return Math.round(vs.reduce((s, v) => s + v.velocityIndex, 0) / vs.length);
    })();
    const upcomingCritical = intelligence.enriched.filter(
      (e) => e.event.endDate >= today &&
        (e.impactScore.classification === 'extreme_compression' ||
         e.impactScore.classification === 'very_high_tension'),
    ).length;
    const criticalAlerts = intelligence.alerts.filter((a) => a.level === 'critical').length;
    const totalRecos = Array.from(intelligence.recommendations.values()).reduce(
      (s, list) => s + list.length, 0,
    );
    return { avgCompression, peakCompression, avgVelocity, upcomingCritical, criticalAlerts, totalRecos };
  }, [intelligence, today, windowEnd]);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              Intelligence Marché
              <SourceBadge source={intelligence.source} freshnessHours={intelligence.freshnessHours} snapshotCount={intelligence.snapshotCount} />
            </h3>
            <p className="text-[11.5px] text-slate-500">
              Compression · vélocité · prédictions · recommandations RMS
            </p>
          </div>
        </div>

        {/* Window selector */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {([30, 60, 90, 180] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              className={cn(
                'px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors',
                windowDays === w
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {w}j
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-100 border-b border-slate-100">
        <KpiCell
          icon={Gauge}
          label="Compression moy."
          value={`${kpis.avgCompression}`}
          unit="/100"
          tone={toneForScore(kpis.avgCompression)}
          hint={kpis.peakCompression ? `Pic ${kpis.peakCompression.score} le ${formatShortDate(kpis.peakCompression.date)}` : undefined}
        />
        <KpiCell
          icon={Activity}
          label="Velocity Index"
          value={`${kpis.avgVelocity}`}
          unit="/100"
          tone={toneForScore(kpis.avgVelocity)}
          hint="Vitesse moy. marché"
        />
        <KpiCell
          icon={Target}
          label="Événements critiques"
          value={`${kpis.upcomingCritical}`}
          tone={kpis.upcomingCritical > 0 ? 'rose' : 'slate'}
          hint="À venir, score ≥ 75"
        />
        <KpiCell
          icon={Bell}
          label="Alertes critiques"
          value={`${kpis.criticalAlerts}`}
          tone={kpis.criticalAlerts > 0 ? 'rose' : 'emerald'}
          hint="Niveau critical"
        />
        <KpiCell
          icon={Zap}
          label="Recos RMS"
          value={`${kpis.totalRecos}`}
          tone={kpis.totalRecos > 0 ? 'violet' : 'slate'}
          hint="En attente d'action"
        />
        <KpiCell
          icon={Layers}
          label="Pic à venir"
          value={kpis.peakCompression?.classification
            ? COMPRESSION_CLASSIFICATION_LABELS[kpis.peakCompression.classification]
            : '—'}
          tone={
            kpis.peakCompression?.classification === 'extreme' ? 'rose'
            : kpis.peakCompression?.classification === 'strong' ? 'amber'
            : 'slate'
          }
          hint={kpis.peakCompression ? formatShortDate(kpis.peakCompression.date) : undefined}
        />
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
        {/* Heatmap principale */}
        <div className="lg:col-span-2 space-y-5">
          <section>
            <SectionTitle icon={TrendingUp}>Heatmap compression marché</SectionTitle>
            <div className="mt-2">
              <CompressionHeatmap cells={heatmapVisible} />
            </div>
          </section>

          <section>
            <SectionTitle icon={Target}>Forecast impact ADR / TO</SectionTitle>
            <div className="mt-2">
              <ForecastTimeline
                forecasts={Array.from(intelligence.forecasts.values())}
                enriched={intelligence.enriched}
                from={today}
                to={windowEnd}
              />
            </div>
          </section>
        </div>

        {/* Sidebar — alertes + radar + top events */}
        <div className="space-y-5">
          <section>
            <SectionTitle icon={Bell}>Alertes intelligentes</SectionTitle>
            <div className="mt-2">
              <MarketAlertsPanel alerts={intelligence.alerts} />
            </div>
          </section>

          <section>
            <SectionTitle icon={Activity}>Radar vélocité marché</SectionTitle>
            <div className="mt-2">
              <VelocityRadar velocity={intelligence.velocity} from={today} to={windowEnd} />
            </div>
          </section>

          <section>
            <SectionTitle icon={AlertTriangle}>Top événements critiques</SectionTitle>
            <div className="mt-2">
              <CriticalEventsList
                enriched={intelligence.enriched}
                recommendations={intelligence.recommendations}
                today={today}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* COMPOSANTS UTILS                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-wide font-semibold text-slate-500">
      <Icon className="w-3 h-3" /> {children}
    </h4>
  );
}

interface KpiCellProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  tone: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
  hint?: string;
}

function KpiCell({ icon: Icon, label, value, unit, tone, hint }: KpiCellProps) {
  const toneClasses = {
    violet:  { iconBg: 'bg-violet-50 text-violet-600',   value: 'text-violet-700' },
    emerald: { iconBg: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
    amber:   { iconBg: 'bg-amber-50 text-amber-600',     value: 'text-amber-700' },
    rose:    { iconBg: 'bg-rose-50 text-rose-600',       value: 'text-rose-700' },
    slate:   { iconBg: 'bg-slate-100 text-slate-600',    value: 'text-slate-900' },
  }[tone];
  return (
    <div className="bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <div className={cn('w-5 h-5 rounded-md flex items-center justify-center', toneClasses.iconBg)}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500 truncate">
          {label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn('text-[18px] font-semibold tabular-nums leading-none', toneClasses.value)}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[10.5px] text-slate-400 truncate">{hint}</div>}
    </div>
  );
}

function toneForScore(score: number): KpiCellProps['tone'] {
  if (score >= 80) return 'rose';
  if (score >= 60) return 'amber';
  if (score >= 40) return 'violet';
  if (score >= 20) return 'emerald';
  return 'slate';
}

function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SOURCE BADGE                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const SourceBadge: React.FC<{
  source: 'lighthouse' | 'expedia' | 'mock';
  freshnessHours: number;
  snapshotCount: number;
}> = ({ source, freshnessHours, snapshotCount }) => {
  const isLive = source !== 'mock';
  const label = source === 'lighthouse' ? 'Lighthouse'
    : source === 'expedia' ? 'Expedia'
    : 'Démo';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] uppercase font-bold tracking-wide ring-1',
        isLive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-amber-50 text-amber-700 ring-amber-200',
      )}
      title={`Source ${label} · ${snapshotCount} snapshots · ${isLive ? `Fraîcheur ${freshnessHours}h` : 'Données synthétiques de démonstration'}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
      {isLive ? `Live · ${label}` : 'Démo'}
    </span>
  );
};
