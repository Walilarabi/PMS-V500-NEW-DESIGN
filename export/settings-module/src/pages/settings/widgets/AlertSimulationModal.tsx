/**
 * FLOWTYM — Modal de simulation d'impact d'une alerte.
 *
 * Affichée quand l'utilisateur clique sur "Simuler" depuis le panneau
 * d'alertes. Montre :
 *   • la projection de l'impact sur les 6 scores avant/après ;
 *   • le delta sur le score système agrégé ;
 *   • l'effort estimé ;
 *   • un récit explicatif.
 *
 * L'utilisateur peut alors décider de naviguer pour corriger
 * réellement (via le bouton CTA habituel de l'alerte).
 */
import React from 'react';
import { X, TrendingUp, Sparkles, ArrowRight, Timer } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ConfigAlert, DiagnosticReport, ScoreCardId } from '@/src/types/settings/diagnostic';
import { MODULE_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { simulateAlertFix } from '@/src/services/settings/settingsSimulator';

interface AlertSimulationModalProps {
  alert: ConfigAlert | null;
  report: DiagnosticReport;
  onClose: () => void;
  onApplyAction: (target: PageId) => void;
}

const DIM_LABEL: Record<ScoreCardId, string> = {
  system_health: 'Santé système',
  configuration: 'Configuration',
  compliance: 'Conformité',
  security: 'Sécurité',
  distribution: 'Distribution',
  revenue: 'Revenue',
};

export const AlertSimulationModal: React.FC<AlertSimulationModalProps> = ({
  alert, report, onClose, onApplyAction,
}) => {
  if (!alert) return null;
  const sim = simulateAlertFix(alert);

  const dims: ScoreCardId[] = ['configuration', 'compliance', 'security', 'distribution', 'revenue'];
  const newSystemHealth = Math.min(100, Math.max(0, report.scores.system_health.value + sim.systemHealthDelta));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[640px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">
                Simulation d'impact · {MODULE_LABEL[alert.module]}
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900 mt-0.5 leading-tight">{alert.title}</h2>
              <p className="text-[12px] text-slate-500 mt-1">
                Si vous résolvez cette alerte, voici l'impact projeté sur vos scores.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Score système avant / après */}
        <div className="px-5 py-4 bg-gradient-to-br from-violet-50/40 to-white border-b border-violet-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Santé système</div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-[24px] font-bold tabular-nums text-slate-400 line-through decoration-2 decoration-slate-300">
                  {report.scores.system_health.value}
                </span>
                <ArrowRight className="w-5 h-5 text-violet-500" />
                <span className="text-[32px] font-bold tabular-nums text-violet-700">
                  {newSystemHealth}
                </span>
                <span className="text-[12px] text-slate-500">/100</span>
              </div>
            </div>
            <div className={cn(
              'rounded-2xl px-4 py-3 ring-1',
              sim.systemHealthDelta > 0
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-slate-50 text-slate-500 ring-slate-200',
            )}>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                <TrendingUp className="w-3 h-3" /> Gain estimé
              </div>
              <div className="text-[20px] font-bold tabular-nums mt-0.5">
                {sim.systemHealthDelta > 0 ? '+' : ''}{sim.systemHealthDelta} pts
              </div>
            </div>
          </div>
        </div>

        {/* Deltas par dimension */}
        <div className="px-5 py-4">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2.5">
            Impact par dimension
          </h3>
          <ul className="space-y-1.5">
            {dims.map((d) => {
              const current = report.scores[d].value;
              const delta = sim.deltas[d] ?? 0;
              const next = Math.min(100, Math.max(0, current + delta));
              const affected = delta !== 0;
              return (
                <li key={d} className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  affected ? 'bg-violet-50/40 ring-1 ring-violet-100' : 'bg-slate-50/40',
                )}>
                  <span className={cn('text-[12.5px] font-medium flex-1', affected ? 'text-slate-900' : 'text-slate-500')}>
                    {DIM_LABEL[d]}
                  </span>
                  <span className={cn('text-[12px] tabular-nums', affected ? 'text-slate-500' : 'text-slate-400')}>{current}</span>
                  {affected ? (
                    <>
                      <ArrowRight className={cn('w-3 h-3', delta > 0 ? 'text-emerald-500' : 'text-rose-500')} />
                      <span className={cn('text-[13px] font-bold tabular-nums', delta > 0 ? 'text-emerald-700' : 'text-rose-700')}>{next}</span>
                      <span className={cn(
                        'text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded ring-1 ring-inset',
                        delta > 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200',
                      )}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">non affecté</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Narrative + effort */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
            <p className="text-[12.5px] text-slate-700 leading-relaxed">{sim.narrative}</p>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
            <Timer className="w-3 h-3" />
            Effort estimé : <strong className="text-slate-700 capitalize">{sim.effort}</strong>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 italic">
            Projection basée sur le modèle d'impact métier — peut varier selon l'état réel.
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
            <button
              onClick={() => onApplyAction(alert.action.target)}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
            >
              {alert.action.label} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
