/**
 * FLOWTYM — Daily Briefing (Vague 6)
 *
 * Section "Top 5 actions du jour" qui s'affiche dans le Dashboard Analyse.
 * Agrège les insights des 4 rapports clés + alertes acknowledged + KPIs.
 */

import React from 'react';
import {
  Sparkles, TrendingUp, AlertCircle, Loader2, RefreshCw, BellRing,
  ChevronRight, Activity, BedDouble, DollarSign, ArrowRight,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { useDailyBriefing } from '../../hooks/analysis/useDailyBriefing';
import { SEVERITY_STYLE } from '../../components/analysis/insights/types';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const HOURLY_GREETINGS: Array<[number, string]> = [
  [5, 'Bonjour'],
  [12, 'Bon après-midi'],
  [18, 'Bonsoir'],
];

function greeting(): string {
  const h = new Date().getHours();
  for (let i = HOURLY_GREETINGS.length - 1; i >= 0; i--) {
    if (h >= HOURLY_GREETINGS[i][0]) return HOURLY_GREETINGS[i][1];
  }
  return 'Bonjour';
}

export const DailyBriefing: React.FC<{ onOpenAlerts?: () => void }> = ({ onOpenAlerts }) => {
  const { data, isLoading, refetch, isFetching } = useDailyBriefing();

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 rounded-lg border border-violet-200 p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
        <span className="text-sm text-violet-800 font-medium">Génération de votre briefing…</span>
      </div>
    );
  }

  if (!data) return null;

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const top5 = data.insights.slice(0, 5);

  const delta = data.kpis.revparN1 > 0
    ? ((data.kpis.revparMoy - data.kpis.revparN1) / data.kpis.revparN1) * 100
    : 0;

  return (
    <div className="bg-gradient-to-br from-violet-50 via-blue-50/30 to-emerald-50/40 rounded-lg border border-violet-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-900 text-white px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Briefing Direction</span>
            </div>
            <h2 className="text-xl font-extrabold">{greeting()} ! Voici votre {today}</h2>
            <p className="text-xs text-violet-200 mt-1">
              Synthèse automatique des 14 derniers jours · {data.sourceCount.supabase}/{data.sourceCount.supabase + data.sourceCount.mock} sources live
            </p>
          </div>
          <div className="flex items-center gap-1">
            {data.alertsUnackCount > 0 && (
              <button
                onClick={onOpenAlerts}
                className="relative p-2 rounded hover:bg-white/10 transition"
                title={`${data.alertsUnackCount} alerte${data.alertsUnackCount > 1 ? 's' : ''} non lue${data.alertsUnackCount > 1 ? 's' : ''}`}
              >
                <BellRing className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {data.alertsUnackCount > 9 ? '9+' : data.alertsUnackCount}
                </span>
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded hover:bg-white/10 transition"
              title="Rafraîchir"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs résumé */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 px-4 py-3 bg-white/60 border-b border-violet-100">
        <MiniKpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="RevPAR moy." value={`${data.kpis.revparMoy}€`} delta={delta} />
        <MiniKpi icon={<BedDouble className="w-3.5 h-3.5" />} label="Occupation" value={`${data.kpis.occMoy}%`} />
        <MiniKpi icon={<DollarSign className="w-3.5 h-3.5" />} label="CA 14j" value={`${Math.round(data.kpis.revenueTotal / 1000)}K€`} />
        <MiniKpi icon={<Activity className="w-3.5 h-3.5" />} label="Arrivées 7j" value={`${data.kpis.arrivees7j}`} />
        <MiniKpi icon={<Activity className="w-3.5 h-3.5" />} label="Départs 7j" value={`${data.kpis.departs7j}`} />
      </div>

      {/* Top 5 actions */}
      <div className="px-6 py-4">
        <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Top {Math.min(5, top5.length)} actions à mener aujourd'hui
        </h3>
        {top5.length === 0 ? (
          <div className="text-center py-6 text-sm text-violet-700">
            <Sparkles className="w-8 h-8 mx-auto text-violet-300 mb-2" />
            Aucune action prioritaire détectée. Vos KPIs sont sains.
          </div>
        ) : (
          <div className="space-y-2">
            {top5.map((insight, idx) => {
              const style = SEVERITY_STYLE[insight.severity];
              const Icon = style.icon;
              return (
                <div
                  key={insight.id}
                  className={cn('rounded-lg border p-3 flex items-start gap-3', style.bg, style.border)}
                >
                  <span className={cn('w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs flex-shrink-0', style.bg, style.text)}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('w-3.5 h-3.5', style.iconColor)} />
                      <span className={cn('text-sm font-bold', style.text)}>{insight.title}</span>
                    </div>
                    <p className={cn('text-xs leading-relaxed', style.text, 'opacity-90')}>{insight.message}</p>
                    {insight.action && (
                      <button
                        onClick={() => {
                          if (insight.action?.page) {
                            window.dispatchEvent(new CustomEvent('navigate', { detail: { page: insight.action.page } }));
                          }
                        }}
                        className={cn('mt-1.5 inline-flex items-center gap-1 text-xs font-bold hover:underline', style.text)}
                      >
                        {insight.action.label}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data.insights.length > 5 && (
          <div className="mt-3 text-center">
            <span className="text-xs text-violet-700">
              + {data.insights.length - 5} autres insights — ouvrez les rapports pour les détails
            </span>
          </div>
        )}
      </div>

      {/* Footer avec compteurs sévérité */}
      <div className="px-6 py-3 bg-white/40 border-t border-violet-100 flex items-center gap-4 text-[11px] font-semibold">
        {data.byseverity.critical.length > 0 && (
          <span className="text-red-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {data.byseverity.critical.length} critique{data.byseverity.critical.length > 1 ? 's' : ''}
          </span>
        )}
        {data.byseverity.warning.length > 0 && (
          <span className="text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {data.byseverity.warning.length} attention
          </span>
        )}
        {data.byseverity.positive.length > 0 && (
          <span className="text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {data.byseverity.positive.length} positif{data.byseverity.positive.length > 1 ? 's' : ''}
          </span>
        )}
        {data.byseverity.info.length > 0 && (
          <span className="text-blue-700 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {data.byseverity.info.length} info
          </span>
        )}
        <span className="ml-auto text-gray-400">
          Généré à {new Date(data.generatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

function MiniKpi({ icon, label, value, delta }: { icon: React.ReactNode; label: string; value: string; delta?: number }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded p-2 border border-gray-100">
      <span className="text-violet-600">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold truncate">{label}</div>
        <div className="text-sm font-extrabold text-gray-900 flex items-baseline gap-1">
          {value}
          {typeof delta === 'number' && (
            <span className={cn('text-[10px] font-bold', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
