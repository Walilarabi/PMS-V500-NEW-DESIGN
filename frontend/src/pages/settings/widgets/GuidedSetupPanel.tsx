/**
 * FLOWTYM — Panneau "Configuration guidée" du Control Center.
 *
 * Affiche les 8 étapes du parcours d'installation. Statut par étape
 * (Complété/En cours/À faire/Bloqué). Bouton "Reprendre la
 * configuration" navigue vers la première étape incomplète.
 */
import React from 'react';
import { ArrowRight, Check, Hourglass, Lock, Circle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { GuidedStep, GuidedStepStatus } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const STATUS_ICON: Record<GuidedStepStatus, { icon: React.ComponentType<{ className?: string }>; pill: string; text: string }> = {
  completed:   { icon: Check,    pill: 'bg-emerald-50 ring-emerald-200', text: 'text-emerald-700' },
  in_progress: { icon: Hourglass, pill: 'bg-violet-50 ring-violet-200', text: 'text-violet-700' },
  todo:        { icon: Circle,   pill: 'bg-slate-50 ring-slate-200',   text: 'text-slate-500' },
  blocked:     { icon: Lock,     pill: 'bg-amber-50 ring-amber-200',   text: 'text-amber-700' },
};

const STATUS_LABEL: Record<GuidedStepStatus, string> = {
  completed: 'Complété',
  in_progress: 'En cours',
  todo: 'À faire',
  blocked: 'Bloqué',
};

interface GuidedSetupPanelProps {
  steps: GuidedStep[];
  onNavigate: (page: PageId) => void;
}

export const GuidedSetupPanel: React.FC<GuidedSetupPanelProps> = ({ steps, onNavigate }) => {
  const next = steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status === 'todo');
  const completed = steps.filter((s) => s.status === 'completed').length;

  function resume() {
    if (!next) return;
    logAudit({ action: 'guided_step_resumed', detail: `Reprise étape ${next.index} — ${next.label}` });
    onNavigate(next.target);
  }

  return (
    <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">Configuration guidée</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">{completed}/{steps.length} étapes complétées</p>
        </div>
        {next && (
          <button
            onClick={resume}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
          >
            Reprendre la configuration <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </header>

      <ol className="px-3 py-3 space-y-1">
        {steps.map((s) => {
          const t = STATUS_ICON[s.status];
          const Icon = t.icon;
          return (
            <li key={s.index}>
              <button
                onClick={() => onNavigate(s.target)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 hover:bg-slate-50 transition-colors',
                  next?.index === s.index && 'bg-violet-50/40 ring-1 ring-violet-100',
                )}
              >
                <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-inset shrink-0 tabular-nums', t.pill, t.text)}>
                  {s.status === 'completed' ? <Icon className="w-3.5 h-3.5" /> : (
                    <span className="text-[12px] font-bold">{s.index}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-slate-900">{s.label}</div>
                  {s.blockedBy ? (
                    <div className="text-[11px] text-amber-600 mt-0.5">Bloqué : {s.blockedBy}</div>
                  ) : null}
                </div>
                <span className={cn('text-[10.5px] font-semibold uppercase tracking-wider', t.text)}>
                  {STATUS_LABEL[s.status]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
