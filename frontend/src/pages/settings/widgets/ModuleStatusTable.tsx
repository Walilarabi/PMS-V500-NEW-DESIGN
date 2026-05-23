/**
 * FLOWTYM — Tableau "État des modules clés" du Control Center.
 *
 * Lit le DiagnosticReport et liste les 8 modules majeurs avec leur
 * statut (Opérationnel/Attention/Critique/Désactivé/Pending). Bouton
 * "Voir détails" → ouvre une modal détaillée (issues + actions).
 */
import React from 'react';
import { ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ModuleStatus, ModuleStatusLevel } from '@/src/types/settings/diagnostic';
import { STATUS_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';

const STATUS_TONE: Record<ModuleStatusLevel, { dot: string; pill: string; text: string }> = {
  operational:           { dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700' },
  attention:             { dot: 'bg-amber-500',   pill: 'bg-amber-50 ring-amber-100',     text: 'text-amber-700' },
  critical:              { dot: 'bg-rose-500',    pill: 'bg-rose-50 ring-rose-100',       text: 'text-rose-700' },
  disabled:              { dot: 'bg-slate-300',   pill: 'bg-slate-50 ring-slate-100',     text: 'text-slate-600' },
  pending_configuration: { dot: 'bg-sky-400',     pill: 'bg-sky-50 ring-sky-100',         text: 'text-sky-700' },
};

interface ModuleStatusTableProps {
  modules: ModuleStatus[];
  onInspect: (m: ModuleStatus) => void;
  onNavigate: (page: PageId) => void;
}

export const ModuleStatusTable: React.FC<ModuleStatusTableProps> = ({ modules, onInspect, onNavigate }) => (
  <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
    <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">État des modules clés</h3>
        <p className="text-[11.5px] text-slate-500 mt-0.5">{modules.length} modules surveillés en continu</p>
      </div>
      <button
        onClick={() => onNavigate('settings_audit' as PageId)}
        className="text-[12px] font-medium text-violet-600 hover:underline inline-flex items-center gap-1"
      >
        Journal d'audit <ExternalLink className="w-3 h-3" />
      </button>
    </header>
    <table className="w-full text-[13px]">
      <thead className="bg-slate-50/60">
        <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400">
          <th className="px-5 py-2.5 font-medium">Module</th>
          <th className="px-3 py-2.5 font-medium">Statut</th>
          <th className="px-3 py-2.5 font-medium">Dernière vérification</th>
          <th className="px-3 py-2.5 font-medium">Détails</th>
          <th className="px-3 py-2.5 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {modules.map((m) => {
          const tone = STATUS_TONE[m.status];
          return (
            <tr key={m.key} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
              <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
              <td className="px-3 py-3">
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold', tone.pill, tone.text)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
                  {STATUS_LABEL[m.status]}
                </span>
              </td>
              <td className="px-3 py-3 text-slate-600 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-slate-400" />
                  {new Date(m.lastCheckedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </td>
              <td className="px-3 py-3 text-slate-600 max-w-[360px]">
                {m.issues.length === 0 ? (
                  <span className="text-slate-400 italic">Aucun problème détecté</span>
                ) : (
                  <ul className="space-y-0.5 text-[12px]">
                    {m.issues.slice(0, 2).map((i, idx) => (
                      <li key={idx} className="truncate" title={i}>• {i}</li>
                    ))}
                    {m.issues.length > 2 && (
                      <li className="text-slate-400">+{m.issues.length - 2} autre(s)</li>
                    )}
                  </ul>
                )}
              </td>
              <td className="px-3 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  {m.recommendedAction && (
                    <button
                      onClick={() => onNavigate(m.recommendedAction!.target)}
                      className="px-2 py-1 rounded-lg text-[11.5px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100"
                    >
                      {m.recommendedAction.label}
                    </button>
                  )}
                  <button
                    onClick={() => onInspect(m)}
                    className="px-2 py-1 rounded-lg text-[11.5px] font-medium text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1"
                  >
                    Voir détails <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </section>
);
