/**
 * FLOWTYM — Paramètres · Audit / Logs.
 *
 * Affiche l'historique complet des actions tracées par
 * settingsAuditLogger (diagnostics lancés, alertes résolues, exports,
 * customisation dashboard, navigation modules, étapes config reprises).
 * Filtre par action et recherche full-text. Export CSV.
 */
import React, { useMemo, useState } from 'react';
import { Fingerprint, Search, Download, RefreshCw, Filter, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { clearAudit, readAudit, type AuditAction, type AuditEntry } from '@/src/services/settings/settingsAuditLogger';
import { MODULE_LABEL } from '@/src/types/settings/diagnostic';

const ACTION_LABEL: Record<AuditAction, string> = {
  diagnostic_run: 'Diagnostic lancé',
  alert_resolved: 'Alerte résolue',
  alert_dismissed: 'Alerte écartée',
  config_exported: 'Configuration exportée',
  dashboard_customized: 'Tableau personnalisé',
  module_inspected: 'Module inspecté',
  guided_step_resumed: 'Étape config reprise',
};

const ACTION_TONE: Record<AuditAction, string> = {
  diagnostic_run: 'bg-violet-50 text-violet-700 ring-violet-200',
  alert_resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  alert_dismissed: 'bg-amber-50 text-amber-700 ring-amber-200',
  config_exported: 'bg-sky-50 text-sky-700 ring-sky-200',
  dashboard_customized: 'bg-slate-50 text-slate-700 ring-slate-200',
  module_inspected: 'bg-slate-50 text-slate-700 ring-slate-200',
  guided_step_resumed: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export const AuditPage: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);

  const entries = useMemo<AuditEntry[]>(() => readAudit(200), [tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (q) {
        const blob = `${ACTION_LABEL[e.action]} ${e.module ? MODULE_LABEL[e.module] : ''} ${e.detail ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, actionFilter]);

  function refresh() {
    setTick((t) => t + 1);
    notify('Historique rafraîchi');
  }

  function purge() {
    if (!confirm('Purger tout l\'historique d\'audit local ? Cette action est irréversible.')) return;
    clearAudit();
    setTick((t) => t + 1);
    notify('Historique purgé');
  }

  function exportCsv() {
    const rows = [
      ['Date', 'Action', 'Module', 'Détail'],
      ...filtered.map((e) => [
        new Date(e.at).toLocaleString('fr-FR'),
        ACTION_LABEL[e.action],
        e.module ? MODULE_LABEL[e.module] : '',
        e.detail ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowtym_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(`${filtered.length} entrées exportées`);
  }

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  // Stats par action
  const stats = useMemo(() => {
    const m = new Map<AuditAction, number>();
    entries.forEach((e) => m.set(e.action, (m.get(e.action) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Journal d'audit</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Traçabilité des actions du Control Center et des éditeurs Paramètres.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
            </button>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={purge}
              disabled={entries.length === 0}
              className="px-3 py-2 rounded-lg ring-1 ring-rose-200 bg-white text-[13px] font-medium text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purger
            </button>
          </div>
        </header>

        {/* Stats par action */}
        {stats.length > 0 && (
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {stats.map(([action, count]) => (
              <button
                key={action}
                onClick={() => setActionFilter(actionFilter === action ? 'all' : action)}
                className={cn(
                  'rounded-xl ring-1 px-3 py-2 text-left transition-all',
                  actionFilter === action
                    ? 'ring-violet-300 bg-violet-50/60'
                    : 'ring-slate-100 bg-white hover:ring-violet-200',
                )}
              >
                <div className="text-[18px] font-bold tabular-nums text-slate-900">{count}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2">{ACTION_LABEL[action]}</div>
              </button>
            ))}
          </div>
        )}

        {/* Filtres */}
        <section className="flex flex-wrap items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer par module, détail, action…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none text-[13px]"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | 'all')}
            className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px]"
          >
            <option value="all">Toutes les actions</option>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
          <span className="text-[11.5px] text-slate-500 inline-flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {filtered.length} / {entries.length}
          </span>
        </section>

        {/* Tableau */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-slate-400">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-700">Aucune entrée</div>
              <div className="text-[12px] text-slate-500 mt-1">
                {entries.length === 0
                  ? 'L\'historique d\'audit est vide. Les actions sur le Control Center et les éditeurs Paramètres apparaîtront ici.'
                  : 'Aucune entrée ne correspond à vos filtres.'}
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium w-44">Date</th>
                  <th className="px-3 py-2.5 font-medium w-48">Action</th>
                  <th className="px-3 py-2.5 font-medium w-44">Module</th>
                  <th className="px-3 py-2.5 font-medium">Détail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 text-slate-600 tabular-nums text-[12px]">
                      {new Date(e.at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold', ACTION_TONE[e.action])}>
                        {ACTION_LABEL[e.action]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 text-[12px]">
                      {e.module ? MODULE_LABEL[e.module] : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[12px]">
                      {e.detail || <span className="text-slate-400 italic">Aucun détail</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};
