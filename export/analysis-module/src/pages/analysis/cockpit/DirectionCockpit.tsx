/**
 * FLOWTYM — Mode Direction Cockpit (Vague 9)
 *
 * Vue plein écran TV/tablette/présentation pour comité de direction.
 *  - Overlay fixed sur tout le viewport (au-dessus de la sidebar/topbar)
 *  - Auto-refresh des données toutes les 5 minutes
 *  - Cycling auto entre 3 slides (RevPAR, Occupation, Compset/Canaux)
 *  - Horloge live, météo business, indicateur sync
 *  - ESC ou bouton Sortir pour revenir
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Play, Pause, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  TrendingUp, BedDouble, DollarSign, Users, Plane, Activity,
  AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Sparkles,
} from 'lucide-react';
import { useDailyBriefing } from '../../../hooks/analysis/useDailyBriefing';
import { SEVERITY_STYLE } from '../../../components/analysis/insights/types';
import { useConfigStore } from '../../../store/configStore';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const SLIDE_DURATION_MS = 12_000; // 12s par slide
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export interface DirectionCockpitProps {
  open: boolean;
  onClose: () => void;
}

type Slide = 'revenue' | 'occupation' | 'top-actions';
const SLIDES: Slide[] = ['revenue', 'occupation', 'top-actions'];

export const DirectionCockpit: React.FC<DirectionCockpitProps> = ({ open, onClose }) => {
  const briefing = useDailyBriefing();
  const [slideIdx, setSlideIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hotelName = useConfigStore(s => s.hotel?.name ?? 'Hôtel');

  // Horloge live
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Auto-cycling
  useEffect(() => {
    if (!open || !autoPlay) return;
    const t = setInterval(() => {
      setSlideIdx(i => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(t);
  }, [open, autoPlay]);

  // Auto-refresh briefing
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => { briefing.refetch(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [open, briefing]);

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setSlideIdx(i => (i + 1) % SLIDES.length);
      if (e.key === 'ArrowLeft') setSlideIdx(i => (i - 1 + SLIDES.length) % SLIDES.length);
      if (e.key === ' ') { e.preventDefault(); setAutoPlay(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Block body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Fullscreen API
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  const slide = SLIDES[slideIdx];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Cockpit Direction</div>
            <div className="text-xl font-extrabold tracking-tight">{hotelName}</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => briefing.refetch()}
              disabled={briefing.isFetching}
              className="p-2.5 rounded-lg hover:bg-white/10 transition"
              title="Rafraîchir maintenant"
            >
              <RefreshCw className={cn('w-4 h-4', briefing.isFetching && 'animate-spin')} />
            </button>
            <button
              onClick={() => setAutoPlay(p => !p)}
              className="p-2.5 rounded-lg hover:bg-white/10 transition"
              title={autoPlay ? 'Pause cycling' : 'Lancer cycling'}
            >
              {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-lg hover:bg-white/10 transition"
              title="Plein écran"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-red-500/20 transition ml-2"
              title="Sortir du Cockpit (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden relative px-12 py-10">
        {briefing.isLoading ? (
          <LoadingState />
        ) : !briefing.data ? (
          <div className="h-full flex items-center justify-center text-violet-300 text-2xl">
            Données indisponibles
          </div>
        ) : (
          <>
            {slide === 'revenue' && <SlideRevenue data={briefing.data} />}
            {slide === 'occupation' && <SlideOccupation data={briefing.data} />}
            {slide === 'top-actions' && <SlideTopActions data={briefing.data} />}
          </>
        )}
      </div>

      {/* Footer / Navigation slides */}
      <div className="px-8 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setSlideIdx(i => (i - 1 + SLIDES.length) % SLIDES.length)}
          className="p-2 rounded-lg hover:bg-white/10 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              onClick={() => setSlideIdx(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === slideIdx ? 'w-12 bg-violet-500' : 'w-6 bg-white/20 hover:bg-white/40'
              )}
              title={SLIDE_LABELS[s]}
            />
          ))}
          <span className="ml-3 text-[10px] uppercase tracking-widest text-violet-300 font-bold">
            {SLIDE_LABELS[slide]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-violet-300 uppercase tracking-wider font-bold">
          {briefing.data && (
            <>
              <span>
                Source : {briefing.data.sourceCount.supabase}/{briefing.data.sourceCount.supabase + briefing.data.sourceCount.mock} live
              </span>
              <span className="text-violet-500">·</span>
            </>
          )}
          <span>Auto-refresh 5 min · ESC pour sortir</span>
          <button
            onClick={() => setSlideIdx(i => (i + 1) % SLIDES.length)}
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const SLIDE_LABELS: Record<Slide, string> = {
  revenue: 'Performance Revenue',
  occupation: 'Occupation & Activité',
  'top-actions': 'Top Actions du jour',
};

// ─── Loading ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
      <span className="text-xl text-violet-300 font-semibold tracking-wide">Initialisation du cockpit…</span>
    </div>
  );
}

// ─── Slide 1 : Revenue ───────────────────────────────────────────────────

function SlideRevenue({ data }: { data: NonNullable<ReturnType<typeof useDailyBriefing>['data']> }) {
  const { revparMoy, revparN1, occMoy, revenueTotal } = data.kpis;
  const delta = revparN1 > 0 ? ((revparMoy - revparN1) / revparN1) * 100 : 0;

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-6">
      {/* RevPAR géant */}
      <div className="col-span-7 row-span-4 rounded-2xl bg-gradient-to-br from-violet-700/40 to-violet-900/40 border border-violet-500/30 p-10 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-widest text-violet-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            RevPAR moyen (14 jours)
          </span>
          <DeltaBadgeBig value={delta} />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-9xl font-black tracking-tight tabular-nums">{revparMoy}</span>
          <span className="text-5xl font-extrabold text-violet-300">€</span>
        </div>
        <div className="text-base text-violet-200">
          vs N-1 : <strong className="font-extrabold">{revparN1}€</strong>
          {delta !== 0 && <span className="ml-3">({delta >= 0 ? '+' : ''}{delta.toFixed(1)}%)</span>}
        </div>
      </div>

      {/* CA total */}
      <div className="col-span-5 row-span-2 rounded-2xl bg-gradient-to-br from-emerald-700/30 to-emerald-900/30 border border-emerald-500/30 p-8 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-300 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          CA 14 jours
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-black tabular-nums">{Math.round(revenueTotal / 1000)}</span>
          <span className="text-3xl font-bold text-emerald-300">K€</span>
        </div>
      </div>

      {/* Occupation */}
      <div className="col-span-5 row-span-2 rounded-2xl bg-gradient-to-br from-blue-700/30 to-blue-900/30 border border-blue-500/30 p-8 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-300 flex items-center gap-2">
          <BedDouble className="w-4 h-4" />
          Occupation moy.
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-black tabular-nums">{occMoy}</span>
          <span className="text-3xl font-bold text-blue-300">%</span>
        </div>
      </div>

      {/* Arrivées/Départs 7j */}
      <div className="col-span-6 row-span-2 rounded-2xl bg-white/5 border border-white/10 p-6 flex items-center justify-around">
        <div className="text-center">
          <Plane className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <div className="text-5xl font-black tabular-nums">{data.kpis.arrivees7j}</div>
          <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold mt-1">Arrivées 7j</div>
        </div>
        <div className="text-center">
          <Plane className="w-6 h-6 text-blue-400 mx-auto mb-2 rotate-180" />
          <div className="text-5xl font-black tabular-nums">{data.kpis.departs7j}</div>
          <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold mt-1">Départs 7j</div>
        </div>
        <div className="text-center">
          <Activity className="w-6 h-6 text-violet-400 mx-auto mb-2" />
          <div className="text-5xl font-black tabular-nums">{data.kpis.arrivees7j - data.kpis.departs7j >= 0 ? '+' : ''}{data.kpis.arrivees7j - data.kpis.departs7j}</div>
          <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold mt-1">Solde net</div>
        </div>
      </div>

      {/* Statut sévérité */}
      <div className="col-span-6 row-span-2 rounded-2xl bg-white/5 border border-white/10 p-6 flex items-center justify-around">
        <SeverityCount n={data.byseverity.critical.length} label="Critiques" color="red" />
        <SeverityCount n={data.byseverity.warning.length} label="À surveiller" color="amber" />
        <SeverityCount n={data.byseverity.positive.length} label="Positifs" color="emerald" />
        <SeverityCount n={data.alertsUnackCount} label="Alertes" color="violet" />
      </div>
    </div>
  );
}

// ─── Slide 2 : Occupation ────────────────────────────────────────────────

function SlideOccupation({ data }: { data: NonNullable<ReturnType<typeof useDailyBriefing>['data']> }) {
  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-6">
      <div className="col-span-12 row-span-3 rounded-2xl bg-gradient-to-br from-blue-700/40 to-indigo-900/40 border border-blue-500/30 p-10 flex flex-col justify-between">
        <span className="text-sm font-bold uppercase tracking-widest text-blue-200 flex items-center gap-2">
          <BedDouble className="w-5 h-5" />
          Taux d'occupation moyen — 14 prochains jours
        </span>
        <div className="flex items-end gap-6">
          <div className="flex items-baseline gap-3">
            <span className="text-[12rem] leading-none font-black tabular-nums">{data.kpis.occMoy}</span>
            <span className="text-7xl font-extrabold text-blue-300">%</span>
          </div>
          <div className="pb-6">
            <OccupancyGauge value={data.kpis.occMoy} />
          </div>
        </div>
      </div>

      <div className="col-span-4 row-span-3 rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-300 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Arrivées 7j
        </span>
        <div className="text-7xl font-black tabular-nums text-emerald-400">{data.kpis.arrivees7j}</div>
      </div>

      <div className="col-span-4 row-span-3 rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-300 flex items-center gap-2">
          <Users className="w-4 h-4 rotate-180" />
          Départs 7j
        </span>
        <div className="text-7xl font-black tabular-nums text-blue-400">{data.kpis.departs7j}</div>
      </div>

      <div className="col-span-4 row-span-3 rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-300 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Solde net
        </span>
        <div className={cn(
          'text-7xl font-black tabular-nums',
          data.kpis.arrivees7j >= data.kpis.departs7j ? 'text-emerald-400' : 'text-orange-400'
        )}>
          {data.kpis.arrivees7j - data.kpis.departs7j >= 0 ? '+' : ''}{data.kpis.arrivees7j - data.kpis.departs7j}
        </div>
        <div className="text-sm text-violet-300">
          {data.kpis.arrivees7j >= data.kpis.departs7j
            ? 'Pipeline en croissance'
            : 'Plus de départs que d\'arrivées'}
        </div>
      </div>
    </div>
  );
}

// ─── Slide 3 : Top actions ───────────────────────────────────────────────

function SlideTopActions({ data }: { data: NonNullable<ReturnType<typeof useDailyBriefing>['data']> }) {
  const top5 = data.insights.slice(0, 5);

  if (top5.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <CheckCircle2 className="w-32 h-32 text-emerald-400 mb-6" />
        <div className="text-6xl font-black tracking-tight mb-3">Tout est sous contrôle</div>
        <div className="text-xl text-emerald-300">Aucune action prioritaire détectée. Vos KPIs sont sains.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-violet-400" />
          Top {top5.length} actions à mener aujourd'hui
        </h2>
        <div className="flex items-center gap-3 text-sm font-bold">
          {data.byseverity.critical.length > 0 && (
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {data.byseverity.critical.length} critique{data.byseverity.critical.length > 1 ? 's' : ''}
            </span>
          )}
          {data.byseverity.warning.length > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {data.byseverity.warning.length} attention
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 gap-3">
        {top5.map((insight, idx) => {
          const style = COCKPIT_SEVERITY[insight.severity] ?? COCKPIT_SEVERITY.info;
          return (
            <div
              key={insight.id}
              className={cn(
                'rounded-xl border-2 p-5 flex items-center gap-5',
                style.bg, style.border
              )}
            >
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black flex-shrink-0',
                style.numberBg, style.numberText
              )}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-2xl font-extrabold tracking-tight mb-1', style.title)}>
                  {insight.title}
                </div>
                <p className={cn('text-base leading-relaxed', style.message)}>
                  {insight.message}
                </p>
              </div>
              {insight.action && (
                <span className={cn('text-sm font-bold uppercase tracking-widest', style.title)}>
                  → {insight.action.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COCKPIT_SEVERITY: Record<string, {
  bg: string; border: string; numberBg: string; numberText: string; title: string; message: string;
}> = {
  critical: {
    bg: 'bg-red-950/40', border: 'border-red-500/50',
    numberBg: 'bg-red-500', numberText: 'text-white',
    title: 'text-red-300', message: 'text-red-100',
  },
  warning: {
    bg: 'bg-amber-950/40', border: 'border-amber-500/50',
    numberBg: 'bg-amber-500', numberText: 'text-white',
    title: 'text-amber-300', message: 'text-amber-100',
  },
  positive: {
    bg: 'bg-emerald-950/40', border: 'border-emerald-500/50',
    numberBg: 'bg-emerald-500', numberText: 'text-white',
    title: 'text-emerald-300', message: 'text-emerald-100',
  },
  info: {
    bg: 'bg-blue-950/40', border: 'border-blue-500/50',
    numberBg: 'bg-blue-500', numberText: 'text-white',
    title: 'text-blue-300', message: 'text-blue-100',
  },
};

// ─── Sous-composants ─────────────────────────────────────────────────────

function DeltaBadgeBig({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return <span className="text-2xl font-bold text-gray-400">±0%</span>;
  }
  const positive = value > 0;
  return (
    <span className={cn(
      'text-2xl font-extrabold tabular-nums',
      positive ? 'text-emerald-400' : 'text-red-400'
    )}>
      {positive ? '+' : ''}{value.toFixed(1)}% vs N-1
    </span>
  );
}

function SeverityCount({ n, label, color }: { n: number; label: string; color: 'red' | 'amber' | 'emerald' | 'violet' }) {
  const colorMap = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
  };
  return (
    <div className="text-center">
      <div className={cn('text-5xl font-black tabular-nums', colorMap[color])}>{n}</div>
      <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold mt-1">{label}</div>
    </div>
  );
}

function OccupancyGauge({ value }: { value: number }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const offset = c * (1 - v / 100);
  const color = v >= 75 ? '#10B981' : v >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <svg width="160" height="160" viewBox="-80 -80 160 160" className="-rotate-90">
      <circle r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
      <circle
        r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}
