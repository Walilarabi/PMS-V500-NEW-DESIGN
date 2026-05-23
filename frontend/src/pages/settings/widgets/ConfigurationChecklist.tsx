/**
 * FLOWTYM — Widget "Checklist de configuration" du Control Center.
 *
 * Progression globale + progression par domaine + tâches détaillées
 * cliquables pour ouvrir la bonne page de paramètres.
 */
import React from 'react';
import { Check, CircleDashed, Lock } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ChecklistDomain } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';

interface ConfigurationChecklistProps {
  domains: ChecklistDomain[];
  onNavigate: (page: PageId) => void;
}

export const ConfigurationChecklist: React.FC<ConfigurationChecklistProps> = ({ domains, onNavigate }) => {
  const totalTasks = domains.reduce((acc, d) => acc + d.tasks.length, 0);
  const doneTasks = domains.reduce((acc, d) => acc + d.tasks.filter((t) => t.done).length, 0);
  const overall = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return (
    <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">Checklist de configuration</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">{doneTasks}/{totalTasks} tâches terminées</p>
        </div>
        <div className="flex items-center gap-2 min-w-[180px]">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn('h-full transition-all', overall >= 80 ? 'bg-emerald-500' : overall >= 50 ? 'bg-violet-500' : 'bg-amber-500')}
              style={{ width: `${overall}%` }}
            />
          </div>
          <span className="text-[13px] font-bold tabular-nums text-slate-900">{overall}%</span>
        </div>
      </header>

      <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {domains.map((d) => {
          const done = d.tasks.filter((t) => t.done).length;
          return (
            <div key={d.id} className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12.5px] font-semibold text-slate-900">{d.label}</div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full', d.progress >= 100 ? 'bg-emerald-500' : d.progress >= 50 ? 'bg-violet-500' : 'bg-amber-400')}
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">{done}/{d.tasks.length}</span>
                </div>
              </div>
              <ul className="space-y-1">
                {d.tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => onNavigate(t.target)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-[12.5px]',
                        t.done ? 'text-slate-500 hover:bg-slate-50' : 'text-slate-700 hover:bg-violet-50',
                      )}
                    >
                      {t.done ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : t.blockedBy ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <CircleDashed className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={cn(t.done && 'line-through decoration-emerald-300')}>{t.label}</span>
                      {t.blockedBy && (
                        <span className="ml-auto text-[10px] font-semibold text-slate-400 uppercase">{t.blockedBy}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};
