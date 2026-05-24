/**
 * FLOWTYM — Paramètres · Santé du système (monitoring & observabilité).
 *
 * Tableau de bord ops de Phase 3 : compteurs d'erreurs runtime,
 * permissions refusées, échecs de sync, taille du localStorage.
 *
 * Lit ses données depuis monitoringService (ring buffer local).
 */
import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Database, RefreshCw, ShieldOff, Trash2,
  XCircle, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  readErrorBuffer, readMetrics, getHealthSnapshot, clearErrorBuffer, resetMetrics,
  type CapturedError,
} from '@/src/services/settings/monitoringService';
import { usePermission, PermissionDeniedBanner } from '@/src/services/settings/permissionsService';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

const METRIC_LABELS: Record<string, string> = {
  rbac_denied: 'Permissions refusées',
  settings_sync_failed: 'Échecs de sync Supabase',
};

const METRIC_TONES: Record<string, string> = {
  rbac_denied: 'amber',
  settings_sync_failed: 'rose',
};

export const SystemHealthPage: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const canRead = usePermission('set_audit', 'read');

  const snapshot = useMemo(() => getHealthSnapshot(), [tick]);
  const errors = useMemo<CapturedError[]>(() => readErrorBuffer(50), [tick]);
  const metrics = useMemo(() => readMetrics(), [tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  function purgeErrors() {
    if (!confirm('Purger les erreurs locales ? Action irréversible.')) return;
    clearErrorBuffer();
    refresh();
  }

  function purgeMetrics() {
    if (!confirm('Réinitialiser tous les compteurs ? Action irréversible.')) return;
    resetMetrics();
    refresh();
  }

  if (!canRead) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10">
          <PermissionDeniedBanner capability="set_audit" required="read" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Observabilité</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Santé du système</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Erreurs runtime captées, compteurs métier (RBAC, sync), occupation du stockage local.
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
          </button>
        </header>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <HealthTile
            icon={XCircle}
            label="Erreurs 24h"
            value={String(snapshot.errorCount24h)}
            caption={snapshot.errorCount24h === 0 ? 'Tout va bien' : 'À investiguer'}
            tone={snapshot.errorCount24h === 0 ? 'emerald' : snapshot.errorCount24h > 10 ? 'rose' : 'amber'}
          />
          <HealthTile
            icon={AlertTriangle}
            label="Erreurs total"
            value={String(snapshot.errorCountTotal)}
            caption={`Buffer ${snapshot.errorCountTotal}/100`}
            tone={snapshot.errorCountTotal > 50 ? 'amber' : 'slate'}
          />
          <HealthTile
            icon={Database}
            label="Stockage local"
            value={formatBytes(snapshot.localStorageSize)}
            caption={`${snapshot.localStorageItems} entrées`}
            tone={snapshot.localStorageSize > 4_000_000 ? 'rose' : 'sky'}
          />
          <HealthTile
            icon={BarChart3}
            label="Compteurs actifs"
            value={String(metrics.length)}
            caption={metrics[0] ? `Top: ${METRIC_LABELS[metrics[0].name] ?? metrics[0].name}` : 'Aucune métrique'}
            tone="violet"
          />
        </div>

        {/* Compteurs métier */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" /> Compteurs métier
            </h3>
            <button
              onClick={purgeMetrics}
              disabled={metrics.length === 0}
              className="text-[11.5px] font-medium text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" /> Réinitialiser
            </button>
          </div>
          {metrics.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-[12.5px]">
              Aucun compteur enregistré pour le moment.
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Compteur</th>
                  <th className="px-3 py-2.5 font-medium text-right w-24">Total</th>
                  <th className="px-3 py-2.5 font-medium w-40">Dernière occurrence</th>
                  <th className="px-3 py-2.5 font-medium">Tags récents</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const label = METRIC_LABELS[m.name] ?? m.name;
                  const tone = METRIC_TONES[m.name] ?? 'slate';
                  return (
                    <tr key={m.name} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {m.name === 'rbac_denied' && <ShieldOff className="w-3.5 h-3.5 text-amber-500" />}
                          {m.name === 'settings_sync_failed' && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                          <span className="font-medium text-slate-800">{label}</span>
                          <span className="text-[10px] font-mono text-slate-400">{m.name}</span>
                        </div>
                      </td>
                      <td className={cn(
                        'px-3 py-2.5 text-right tabular-nums font-bold',
                        tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-800',
                      )}>
                        {m.count}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-[11.5px] tabular-nums">
                        {new Date(m.lastAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 text-[11px] font-mono truncate max-w-md">
                        {m.recentTags.length === 0
                          ? <span className="text-slate-400 italic">—</span>
                          : m.recentTags.slice(0, 1).map((t, i) => (
                              <span key={i} className="truncate">
                                {Object.entries(t.tags).map(([k, v]) => `${k}=${v}`).join(' · ')}
                              </span>
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Erreurs récentes */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" /> Erreurs runtime récentes
            </h3>
            <button
              onClick={purgeErrors}
              disabled={errors.length === 0}
              className="text-[11.5px] font-medium text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" /> Purger
            </button>
          </div>
          {errors.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-[12.5px]">
              Aucune erreur captée — système stable.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {errors.map((e) => {
                const isOpen = expandedError === e.id;
                return (
                  <li key={e.id} className="px-5 py-3">
                    <button
                      onClick={() => setExpandedError(isOpen ? null : e.id)}
                      className="w-full flex items-start gap-2 text-left"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900 text-[12.5px] truncate">{e.message}</div>
                          <span className="text-[10.5px] text-slate-400 tabular-nums shrink-0">
                            {new Date(e.at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        {e.url && (
                          <div className="text-[10.5px] text-slate-500 inline-flex items-center gap-1 truncate mt-0.5">
                            <ExternalLink className="w-2.5 h-2.5" /> {e.url.replace(window.location.origin, '')}
                          </div>
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-2 ml-6 space-y-2">
                        {e.stack && (
                          <pre className="text-[10.5px] font-mono text-slate-700 bg-slate-50 ring-1 ring-slate-100 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                            {e.stack}
                          </pre>
                        )}
                        {e.context && Object.keys(e.context).length > 0 && (
                          <div className="text-[11px]">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Contexte</div>
                            <pre className="font-mono text-slate-700 bg-slate-50 ring-1 ring-slate-100 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(e.context, null, 2)}
                            </pre>
                          </div>
                        )}
                        {e.userAgent && (
                          <div className="text-[10.5px] text-slate-400 font-mono truncate">{e.userAgent}</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800">
          <strong>Stockage local :</strong> les erreurs et compteurs sont gardés dans le navigateur
          (ring buffer 100 entrées). Ils sont aussi tracés dans le journal d'audit avec sévérité critique
          pour les erreurs, et propagés à Supabase via le canal audit.
        </div>
      </div>
    </div>
  );
};

function HealthTile({
  icon: Icon, label, value, caption, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caption: string;
  tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';
}) {
  const tones: Record<string, { ring: string; bg: string; text: string; valueColor: string }> = {
    emerald: { ring: 'ring-emerald-100', bg: 'bg-emerald-50/60', text: 'text-emerald-700', valueColor: 'text-emerald-700' },
    amber:   { ring: 'ring-amber-100',   bg: 'bg-amber-50/60',   text: 'text-amber-700',   valueColor: 'text-amber-700' },
    rose:    { ring: 'ring-rose-100',    bg: 'bg-rose-50/60',    text: 'text-rose-700',    valueColor: 'text-rose-700' },
    sky:     { ring: 'ring-sky-100',     bg: 'bg-sky-50/60',     text: 'text-sky-700',     valueColor: 'text-sky-700' },
    violet:  { ring: 'ring-violet-100',  bg: 'bg-violet-50/60',  text: 'text-violet-700',  valueColor: 'text-violet-700' },
    slate:   { ring: 'ring-slate-100',   bg: 'bg-white',         text: 'text-slate-700',   valueColor: 'text-slate-900' },
  };
  const t = tones[tone];
  return (
    <div className={cn('rounded-2xl ring-1 shadow-sm p-4', t.ring, t.bg)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', t.text)} />
        <div className={cn('text-[11px] uppercase tracking-wide font-semibold', t.text)}>{label}</div>
      </div>
      <div className={cn('text-[24px] font-bold tabular-nums mt-1.5', t.valueColor)}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
}
