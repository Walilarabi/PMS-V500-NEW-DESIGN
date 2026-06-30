/**
 * FLOWTYM — Panneau "Derniers journaux système" du Control Center.
 *
 * Affiche un flux des derniers événements système (synchros,
 * décisions, sauvegardes, erreurs). Lien direct vers le journal
 * d'audit complet (settings_audit).
 */
import React from 'react';
import { ChevronRight, CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { SystemLogEntry } from '@/src/types/settings/diagnostic';
import { MODULE_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';

const LEVEL_TONE: Record<SystemLogEntry['level'], { icon: React.ComponentType<{ className?: string }>; text: string }> = {
  success: { icon: CheckCircle2,  text: 'text-emerald-600' },
  info:    { icon: Info,          text: 'text-slate-500' },
  warn:    { icon: AlertTriangle, text: 'text-amber-600' },
  error:   { icon: AlertOctagon,  text: 'text-rose-600' },
};

interface SystemLogsPanelProps {
  logs: SystemLogEntry[];
  onNavigate: (page: PageId) => void;
}

export const SystemLogsPanel: React.FC<SystemLogsPanelProps> = ({ logs, onNavigate }) => (
  <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
    <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">Derniers journaux système</h3>
        <p className="text-[11.5px] text-slate-500 mt-0.5">{logs.length} entrée{logs.length > 1 ? 's' : ''} récente{logs.length > 1 ? 's' : ''}</p>
      </div>
      <button
        onClick={() => onNavigate('settings_audit' as PageId)}
        className="text-[12px] font-medium text-violet-600 hover:underline inline-flex items-center gap-1"
      >
        Voir le journal complet <ChevronRight className="w-3 h-3" />
      </button>
    </header>

    {logs.length === 0 ? (
      <div className="px-5 py-10 text-center text-slate-400 text-[12.5px]">Aucun événement système récent.</div>
    ) : (
      <ul className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
        {logs.map((l) => {
          const t = LEVEL_TONE[l.level];
          const Icon = t.icon;
          return (
            <li
              key={l.id}
              onClick={() => l.auditTarget && onNavigate(l.auditTarget)}
              className={cn(
                'px-5 py-2.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors',
                l.auditTarget && 'cursor-pointer',
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', t.text)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {MODULE_LABEL[l.module]}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {new Date(l.at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[12.5px] font-medium text-slate-900 mt-0.5 truncate">{l.title}</div>
                {l.detail && <div className="text-[11.5px] text-slate-500 mt-0.5 truncate">{l.detail}</div>}
              </div>
              {l.auditTarget && <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-1" />}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
