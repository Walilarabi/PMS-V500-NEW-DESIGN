/**
 * FLOWTYM — Cartes KPI premium du Control Center.
 *
 * 5 cartes affichées en grille : Santé, Synchronisations, Alertes,
 * Conformité, Revenue Impact. Chaque carte expose un score 0-100
 * (sauf "Synchronisations" et "Alertes" qui sont des compteurs),
 * un mini-sparkline visuel et un détail explicatif.
 */
import React from 'react';
import { Activity, AlertOctagon, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { DiagnosticReport, HealthTier } from '@/src/types/settings/diagnostic';
import { TIER_LABEL } from '@/src/types/settings/diagnostic';

const TIER_TONE: Record<HealthTier, { ring: string; bar: string; text: string; bg: string; chip: string }> = {
  excellent: { ring: 'ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  chip: 'bg-emerald-100 text-emerald-700' },
  good:      { ring: 'ring-violet-200',  bar: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50',   chip: 'bg-violet-100 text-violet-700' },
  attention: { ring: 'ring-amber-200',   bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    chip: 'bg-amber-100 text-amber-700' },
  critical:  { ring: 'ring-rose-200',    bar: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',     chip: 'bg-rose-100 text-rose-700' },
};

interface KpiCardsProps {
  report: DiagnosticReport;
  onOpenRevenue?: () => void;
}

export const SystemHealthKpiCards: React.FC<KpiCardsProps> = ({ report, onOpenRevenue }) => {
  const sys = report.scores.system_health;
  const sync = report.connectors;
  const syncOk = sync.filter((c) => c.status === 'ok').length;
  const syncErr = sync.filter((c) => c.status === 'error').length;
  const lastSync = sync.map((c) => c.lastSyncAt).filter(Boolean).sort().slice(-1)[0];
  const alertsByGrav = {
    critical: report.alerts.filter((a) => a.severity === 'critical').length,
    high: report.alerts.filter((a) => a.severity === 'high').length,
    medium: report.alerts.filter((a) => a.severity === 'medium').length,
    low: report.alerts.filter((a) => a.severity === 'low').length,
  };
  const compliance = report.scores.compliance;
  const revenue = report.scores.revenue;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        icon={<Activity className="w-5 h-5" />}
        title="Santé système"
        chip={TIER_LABEL[sys.tier]}
        tier={sys.tier}
        value={`${sys.value}`}
        suffix="/100"
        caption={sys.caption}
        sparkline={sys.trend}
      />

      <KpiCard
        icon={<RefreshCw className="w-5 h-5" />}
        title="Synchronisations"
        chip={`${syncOk}/${sync.length}`}
        tier={syncErr > 0 ? 'attention' : 'good'}
        value={`${syncOk}`}
        suffix={` connecteurs à jour`}
        caption={lastSync ? `Dernière sync : ${new Date(lastSync).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Aucune synchronisation récente'}
        miniBars={sync.slice(0, 8).map((c) => c.status === 'ok' ? 100 : c.status === 'pending' ? 60 : 25)}
      />

      <KpiCard
        icon={<AlertOctagon className="w-5 h-5" />}
        title="Alertes critiques"
        chip={`${report.alerts.length} ouvertes`}
        tier={alertsByGrav.critical > 0 ? 'critical' : alertsByGrav.high > 0 ? 'attention' : 'good'}
        value={`${alertsByGrav.critical + alertsByGrav.high}`}
        suffix={` à traiter en priorité`}
        caption={`${alertsByGrav.critical} critique(s) · ${alertsByGrav.high} élevée(s) · ${alertsByGrav.medium} moyenne(s)`}
      />

      <KpiCard
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Conformité"
        chip={TIER_LABEL[compliance.tier]}
        tier={compliance.tier}
        value={`${compliance.value}`}
        suffix="/100"
        caption="RGPD · Fiscalité · Sécurité · Audit"
      />

      <KpiCard
        icon={<TrendingUp className="w-5 h-5" />}
        title="Revenue impact 30j"
        chip={TIER_LABEL[revenue.tier]}
        tier={revenue.tier}
        value={`${revenue.value}`}
        suffix="/100"
        caption="Cliquer pour ouvrir le Revenue"
        onClick={onOpenRevenue}
      />
    </div>
  );
};

// ─── Sous-composant carte ─────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  chip: string;
  tier: HealthTier;
  value: string;
  suffix?: string;
  caption?: string;
  sparkline?: number[];
  miniBars?: number[];
  onClick?: () => void;
}> = ({ icon, title, chip, tier, value, suffix, caption, sparkline, miniBars, onClick }) => {
  const t = TIER_TONE[tier];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-left rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4 transition-all',
        onClick && 'hover:ring-violet-200 hover:shadow-md cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-inset', t.bg, t.ring, t.text)}>
          {icon}
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider', t.chip)}>
          {chip}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-[26px] font-bold tabular-nums leading-none', t.text)}>{value}</span>
          {suffix && <span className="text-[12px] text-slate-500">{suffix}</span>}
        </div>
        <div className="text-[12.5px] font-medium text-slate-900 mt-1">{title}</div>
        {caption && <div className="text-[11px] text-slate-500 mt-1">{caption}</div>}
      </div>
      {sparkline && sparkline.length > 0 && <Sparkline values={sparkline} stroke={t.text} />}
      {miniBars && miniBars.length > 0 && <MiniBars values={miniBars} fill={t.bar} />}
    </button>
  );
};

const Sparkline: React.FC<{ values: number[]; stroke: string }> = ({ values, stroke }) => {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = 200; const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / Math.max(1, max - min)) * h;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('mt-2 w-full h-7', stroke)}>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const MiniBars: React.FC<{ values: number[]; fill: string }> = ({ values, fill }) => (
  <div className="flex items-end gap-1 mt-3 h-7">
    {values.map((v, i) => (
      <div key={i} className={cn('flex-1 rounded-sm', fill)} style={{ height: `${Math.max(8, v)}%` }} />
    ))}
  </div>
);
