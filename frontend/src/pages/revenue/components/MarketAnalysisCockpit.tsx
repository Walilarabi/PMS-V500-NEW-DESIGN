/**
 * FLOWTYM — Market Analysis Cockpit
 *
 * Cockpit RMS de haut niveau pour la veille concurrentielle.
 * Layout en sections : Pulse → Alertes → Concurrence → Restrictions → Opportunités → Recos → Briefing.
 *
 * Pas de logique métier dans ce fichier : tout passe par `market-analysis-engine.ts`.
 * Ce composant est purement présentation + interaction (changement de période).
 *
 * Prop `view` (optionnelle, défaut 'full') permet d'afficher uniquement certaines sections :
 *   - 'full' : toutes les sections (utilisé dans l'onglet "Cockpit RMS")
 *   - 'recommendations' : uniquement les recommandations (onglet "Recommandations")
 *   - 'briefing' : uniquement le briefing texte (onglet "Briefing")
 */

import { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Target, FileText,
  Calendar, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, Building2,
  Shield, Sparkles, Activity, Zap, Copy, CheckCircle2,
} from 'lucide-react';
import type { LighthouseImport } from '../../../services/lighthouse-parser.service';
import {
  analyzeMarket, type AnalysisPeriod, type MarketTrend,
  type Recommendation, type HotelMovement,
} from '../../../services/market-analysis-engine';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Constantes UI ────────────────────────────────────────────────────────

const PERIODS: Array<{ key: AnalysisPeriod; label: string; sub: string }> = [
  { key: 'yesterday', label: 'VS Hier',     sub: 'J vs J-1' },
  { key: '3days',     label: 'VS 3 jours',  sub: 'J vs J-3' },
  { key: '7days',     label: 'VS 7 jours',  sub: 'Hebdo' },
];

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  increase_price: ArrowUpCircle,
  decrease_price: ArrowDownCircle,
  maintain_price: Minus,
  add_min_stay: Lock,
  remove_min_stay: Unlock,
  close_rate_plan: Lock,
  reopen_rate_plan: Unlock,
  limit_availability: Shield,
  allow_controlled_overbooking: Zap,
};

const ACTION_COLORS: Record<string, string> = {
  increase_price: 'text-emerald-600 bg-emerald-50',
  decrease_price: 'text-red-600 bg-red-50',
  maintain_price: 'text-blue-600 bg-blue-50',
  add_min_stay: 'text-amber-600 bg-amber-50',
  remove_min_stay: 'text-teal-600 bg-teal-50',
  close_rate_plan: 'text-purple-600 bg-purple-50',
  reopen_rate_plan: 'text-teal-600 bg-teal-50',
  limit_availability: 'text-orange-600 bg-orange-50',
  allow_controlled_overbooking: 'text-pink-600 bg-pink-50',
};

// ─── Helpers visuels ──────────────────────────────────────────────────────

function TrendIcon({ trend, className }: { trend: MarketTrend; className?: string }) {
  if (trend === 'up') return <TrendingUp className={cn('text-emerald-600', className)} />;
  if (trend === 'down') return <TrendingDown className={cn('text-red-600', className)} />;
  if (trend === 'stable') return <Minus className={cn('text-gray-500', className)} />;
  return <Minus className={cn('text-gray-300', className)} />;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? 'bg-emerald-100 text-emerald-700' :
    score >= 70 ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-600';
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', color)}>
      {score}% confiance
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export type CockpitView = 'full' | 'recommendations' | 'briefing';

export interface MarketAnalysisCockpitProps {
  importData: LighthouseImport;
  selectedMonth: string;
  onDateClick?: (date: string) => void;
  view?: CockpitView;
}

export function MarketAnalysisCockpit({
  importData,
  selectedMonth,
  onDateClick,
  view = 'full',
}: MarketAnalysisCockpitProps) {
  const [period, setPeriod] = useState<AnalysisPeriod>('yesterday');
  const [briefingCopied, setBriefingCopied] = useState(false);

  const report = useMemo(
    () => analyzeMarket(importData, period, selectedMonth),
    [importData, period, selectedMonth],
  );

  const handleCopyBriefing = async () => {
    try {
      await navigator.clipboard.writeText(report.briefing);
      setBriefingCopied(true);
      setTimeout(() => setBriefingCopied(false), 2000);
    } catch {
      // silently fail — clipboard rarely refused
    }
  };

  const handleDateClick = (date: string) => {
    if (onDateClick) onDateClick(date);
  };

  // ─── Empty state ───────────────────────────────────────────────────────
  if (report.daysAnalyzed === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          Aucune donnée Lighthouse disponible pour ce mois. Importez un fichier pour activer le cockpit RMS.
        </p>
      </div>
    );
  }

  // ─── HEADER (period selector) toujours affiché ───────────────────────
  const HeaderBlock = (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {view === 'recommendations' ? 'Recommandations actionnables' :
               view === 'briefing' ? 'Compte rendu marché' :
               'Cockpit Revenue Management'}
            </h2>
            <p className="text-xs text-slate-300">
              {report.daysAnalyzed} jours analysés · {report.competitorCount} concurrents · {report.ourHotelName}
            </p>
          </div>
        </div>

        {/* 3 boutons d'analyse temporelle (toujours présents) */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
          {PERIODS.map(p => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-semibold transition-all',
                  active ? 'bg-white text-slate-900 shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                <div>{p.label}</div>
                <div className={cn('text-[10px]', active ? 'text-slate-500' : 'text-white/50')}>{p.sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Section : Recommandations (utilisée en mode 'full' et 'recommendations') ──
  const RecommendationsBlock = (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-900">Recommandations actionnables</h3>
        <span className="text-xs text-gray-400">({report.recommendations.length})</span>
      </div>
      {report.recommendations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          Aucune action urgente détectée. Le marché est équilibré sur cette période.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {report.recommendations.map((r, i) => (
            <RecommendationCard key={i} reco={r} onDateClick={() => handleDateClick(r.date)} />
          ))}
        </div>
      )}
    </div>
  );

  // ─── Section : Briefing (utilisée en mode 'full' et 'briefing') ──
  const BriefingBlock = (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Compte rendu quotidien</h3>
        </div>
        <button
          onClick={handleCopyBriefing}
          className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50"
        >
          {briefingCopied ? (
            <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="text-emerald-600">Copié</span></>
          ) : (
            <><Copy className="w-3 h-3" /> Copier le briefing</>
          )}
        </button>
      </div>
      <pre className={cn(
        'px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed overflow-y-auto',
        view === 'briefing' ? 'max-h-[calc(100vh-260px)]' : 'max-h-96'
      )}>
        {report.briefing}
      </pre>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDU CONDITIONNEL selon view
  // ═══════════════════════════════════════════════════════════════════════

  // VIEW 'recommendations' — uniquement les recos avec le header de période
  if (view === 'recommendations') {
    return (
      <div className="space-y-4">
        {HeaderBlock}
        {RecommendationsBlock}
      </div>
    );
  }

  // VIEW 'briefing' — uniquement le briefing avec le header de période
  if (view === 'briefing') {
    return (
      <div className="space-y-4">
        {HeaderBlock}
        {BriefingBlock}
      </div>
    );
  }

  // VIEW 'full' — toutes les sections (comportement original du Cockpit RMS)
  return (
    <div className="space-y-4">
      {HeaderBlock}

      {/* ─── SECTION 1 — Pulse Marché (KPI bar) ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PulseCard
          icon={Activity}
          label="Pression marché"
          trend={report.pulse.marketPressureTrend}
          deltaText={`${report.pulse.marketPressureDeltaPercent >= 0 ? '+' : ''}${report.pulse.marketPressureDeltaPercent}%`}
          subtitle={`${report.pulse.daysUp}↑ ${report.pulse.daysStable}— ${report.pulse.daysDown}↓`}
        />
        <PulseCard
          icon={TrendingUp}
          label="Médiane compset"
          trend={report.pulse.medianPriceTrend}
          deltaText={`${report.pulse.medianPriceDeltaEuro >= 0 ? '+' : ''}${report.pulse.medianPriceDeltaEuro}€`}
          subtitle={`${report.pulse.medianPriceDeltaPercent >= 0 ? '+' : ''}${report.pulse.medianPriceDeltaPercent}% en moyenne`}
        />
        <PulseCard
          icon={Target}
          label="Notre position"
          trend={report.pulse.ourPriceTrend}
          deltaText={`${report.pulse.ourPriceDeltaEuro >= 0 ? '+' : ''}${report.pulse.ourPriceDeltaEuro}€`}
          subtitle="vs médiane compset"
        />
        <PulseCard
          icon={Shield}
          label="Compression"
          trend="unknown"
          deltaText={
            report.pulse.compressionLevel === 'high' ? 'Forte' :
            report.pulse.compressionLevel === 'low' ? 'Faible' : 'Modérée'
          }
          subtitle={`écart min/max ${(report.pulse.compressionMetric * 100).toFixed(0)}%`}
        />
      </div>

      {/* ─── Fenêtres haute demande ────────────────────────────────────── */}
      {report.pulse.highDemandWindows.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Fenêtres de forte demande détectées</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {report.pulse.highDemandWindows.map((w, i) => (
              <button
                key={i}
                onClick={() => handleDateClick(w.start)}
                className="text-xs bg-white border border-amber-300 hover:bg-amber-100 rounded-md px-3 py-1.5 text-amber-900 font-medium flex items-center gap-1.5"
              >
                <Calendar className="w-3 h-3" />
                {w.start.slice(5)} → {w.end.slice(5)} · {w.avgDemand}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 2 — Alertes datées ────────────────────────────────── */}
      {report.alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">Alertes datées</h3>
            <span className="text-xs text-gray-400">({report.alerts.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {report.alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => handleDateClick(a.date)}
                className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded uppercase',
                  a.severity === 'critical' && 'bg-red-100 text-red-700',
                  a.severity === 'warning' && 'bg-amber-100 text-amber-700',
                  a.severity === 'info' && 'bg-blue-100 text-blue-700',
                )}>
                  {a.severity === 'critical' ? 'Critique' : a.severity === 'warning' ? 'Alerte' : 'Info'}
                </span>
                <span className="text-sm font-semibold text-gray-700 w-24">{a.dayLabel}</span>
                <span className="flex-1 text-sm text-gray-700">{a.message}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 3 — Analyse concurrentielle ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CompetitiveCard
          title="Hôtels qui augmentent"
          icon={ArrowUpCircle}
          color="emerald"
          movements={report.competitiveAnalysis.biggestIncreases}
          formatVar={(v) => `+${v.variationPercent}%`}
        />
        <CompetitiveCard
          title="Hôtels qui baissent"
          icon={ArrowDownCircle}
          color="red"
          movements={report.competitiveAnalysis.biggestDecreases}
          formatVar={(v) => `${v.variationPercent}%`}
        />
        <CompetitiveCard
          title="Hôtels qui cassent le marché"
          icon={Zap}
          color="orange"
          movements={report.competitiveAnalysis.mostAggressive}
          formatVar={(v) => `${v.variationPercent}%`}
        />
        <CompetitiveCard
          title="Hôtels qui se remplissent"
          icon={Building2}
          color="purple"
          movements={report.competitiveAnalysis.fillingFastest}
          formatVar={(v) => `${v.daysSoldOut} jrs épuisés`}
        />
      </div>

      {/* ─── SECTION 4 — Restrictions par type ─────────────────────────── */}
      {(report.restrictions.totalRestrictedNights + report.restrictions.totalSoldOutNights > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">Restrictions concurrentes</h3>
            <span className="ml-auto text-xs text-gray-500">
              {report.restrictions.totalRestrictedNights} restreintes · {report.restrictions.totalSoldOutNights} épuisées
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 divide-x divide-gray-100">
            <RestrictionTypeCard label="Min Stay" data={report.restrictions.byType.minStay} />
            <RestrictionTypeCard label="CTA" data={report.restrictions.byType.cta} />
            <RestrictionTypeCard label="CTD" data={report.restrictions.byType.ctd} />
            <RestrictionTypeCard label="LOS Restrict." data={report.restrictions.byType.losRestriction} />
            <RestrictionTypeCard label="Tarifaires" data={report.restrictions.byType.rateRestriction} />
          </div>
        </div>
      )}

      {/* ─── SECTION 5 — Opportunités ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OpportunityCard
          label="Sous-valorisées"
          dates={report.opportunities.undervalued}
          color="emerald"
          icon={TrendingUp}
          onDateClick={handleDateClick}
        />
        <OpportunityCard
          label="Sur-positionnées"
          dates={report.opportunities.overpriced}
          color="red"
          icon={TrendingDown}
          onDateClick={handleDateClick}
        />
        <OpportunityCard
          label="Inventaire à protéger"
          dates={report.opportunities.protectInventory}
          color="amber"
          icon={Shield}
          onDateClick={handleDateClick}
        />
        <OpportunityCard
          label="À rouvrir"
          dates={report.opportunities.openRates}
          color="teal"
          icon={Unlock}
          onDateClick={handleDateClick}
        />
      </div>

      {/* ─── SECTION 6 — Recommandations actionnables ──────────────────── */}
      {RecommendationsBlock}

      {/* ─── SECTION 7 — Briefing texte ────────────────────────────────── */}
      {BriefingBlock}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS UI
// ═══════════════════════════════════════════════════════════════════════════

function PulseCard({
  icon: Icon, label, trend, deltaText, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trend: MarketTrend;
  deltaText: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">{label}</span>
        </div>
        <TrendIcon trend={trend} className="w-4 h-4" />
      </div>
      <div className={cn(
        'text-2xl font-bold',
        trend === 'up' && 'text-emerald-600',
        trend === 'down' && 'text-red-600',
        trend === 'stable' && 'text-gray-700',
        trend === 'unknown' && 'text-gray-700',
      )}>
        {deltaText}
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

function CompetitiveCard({
  title, icon: Icon, color, movements, formatVar,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'emerald' | 'red' | 'orange' | 'purple';
  movements: HotelMovement[];
  formatVar: (m: HotelMovement) => string;
}) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={cn('px-4 py-3 border-b flex items-center gap-2', colorMap[color])}>
        <Icon className="w-4 h-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {movements.length === 0 ? (
        <div className="px-4 py-4 text-xs text-gray-400 text-center">Pas de mouvement notable</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {movements.map((m, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate flex-1">{m.hotelName}</span>
              <span className="font-mono font-semibold text-gray-900 ml-2">{m.avgPrice}€</span>
              <span className={cn('font-bold ml-3 text-xs tabular-nums', colorMap[color].split(' ')[2])}>
                {formatVar(m)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestrictionTypeCard({
  label, data,
}: {
  label: string;
  data: { count: number; dates: string[]; hotels: string[] };
}) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{data.count}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {data.dates.length} dates · {data.hotels.length} hôtels
      </div>
    </div>
  );
}

function OpportunityCard({
  label, dates, color, icon: Icon, onDateClick,
}: {
  label: string;
  dates: string[];
  color: 'emerald' | 'red' | 'amber' | 'teal';
  icon: React.ComponentType<{ className?: string }>;
  onDateClick: (d: string) => void;
}) {
  const colorMap = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    teal: 'text-teal-600 bg-teal-50',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', colorMap[color].split(' ')[0])} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{dates.length}</div>
      <div className="text-xs text-gray-400 mb-2">date{dates.length > 1 ? 's' : ''}</div>
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dates.slice(0, 4).map(d => (
            <button
              key={d}
              onClick={() => onDateClick(d)}
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded hover:opacity-80',
                colorMap[color]
              )}
            >
              {d.slice(5)}
            </button>
          ))}
          {dates.length > 4 && (
            <span className="text-[10px] text-gray-400 px-1.5 py-0.5">+{dates.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  reco, onDateClick,
}: {
  reco: Recommendation;
  onDateClick: () => void;
}) {
  const Icon = ACTION_ICONS[reco.action] ?? Sparkles;
  const colorClass = ACTION_COLORS[reco.action] ?? 'text-gray-600 bg-gray-50';

  return (
    <div className="px-5 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={onDateClick}
              className="text-sm font-bold text-gray-900 hover:text-blue-600"
            >
              {reco.dayLabel}
            </button>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', colorClass)}>
              {reco.actionLabel}
            </span>
            <ConfidenceBadge score={reco.confidenceScore} />
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase',
              reco.priority === 'high' && 'bg-red-100 text-red-700',
              reco.priority === 'medium' && 'bg-amber-100 text-amber-700',
              reco.priority === 'low' && 'bg-gray-100 text-gray-600',
            )}>
              {reco.priority === 'high' ? 'Prio. haute' : reco.priority === 'medium' ? 'Moyenne' : 'Basse'}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{reco.justification}</p>
          <p className="text-xs font-semibold text-gray-800 mt-1">
            Impact : <span className="font-mono">{reco.numericImpact}</span>
          </p>
          <p className="text-[10px] text-gray-300 mt-1">
            Règle : {reco.ruleId.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
      </div>
    </div>
  );
}
