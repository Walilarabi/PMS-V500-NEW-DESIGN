/**
 * Channel Manager Panel
 *
 * Drawer affichant :
 * - les providers configurés et leur statut activé/désactivé
 * - l'historique des push (50 derniers)
 * - une action "Relancer" par push en erreur
 */

import React, { useEffect, useState } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Clock, Power, Trash2 } from 'lucide-react';
import {
  CMProvider,
  CMPushRecord,
  clearHistory,
  getHistory,
  getProviderConfigs,
  retryRecord,
  setProviderEnabled,
  subscribe,
} from '../../services/channel-manager.service';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  retrying: 'bg-amber-100 text-amber-700 border-amber-300',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  error: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  retrying: Clock,
  success: CheckCircle2,
  error: AlertTriangle,
};

export function ChannelManagerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<CMPushRecord[]>(() => getHistory(50));
  const [configs, setConfigs] = useState(() => getProviderConfigs());
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHistory(getHistory(50));
    const unsubscribe = subscribe((h) => setHistory(h.slice(0, 50)));
    return () => {
      unsubscribe();
    };
  }, [open]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await retryRecord(id);
    } finally {
      setRetrying(null);
    }
  };

  const toggleProvider = (provider: CMProvider) => {
    const next = !configs[provider].enabled;
    setProviderEnabled(provider, next);
    setConfigs(getProviderConfigs());
  };

  const handleClear = () => {
    if (!confirm('Effacer tout l\'historique des push ?')) return;
    clearHistory();
    setHistory([]);
  };

  if (!open) return null;

  const successCount = history.filter((r) => r.status === 'success').length;
  const errorCount = history.filter((r) => r.status === 'error').length;
  const pendingCount = history.filter(
    (r) => r.status === 'pending' || r.status === 'retrying'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <aside
        className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Channel Manager</h2>
            <p className="text-xs text-gray-500">Statut & historique des push tarifs</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* KPIs */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-gray-200">
          <KPI label="Succès" value={successCount} color="emerald" />
          <KPI label="En cours" value={pendingCount} color="amber" />
          <KPI label="Erreurs" value={errorCount} color="red" />
        </div>

        {/* Providers */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Providers</h3>
          <div className="space-y-1.5">
            {(Object.keys(configs) as CMProvider[]).map((p) => {
              const c = configs[p];
              return (
                <div
                  key={p}
                  className="flex items-center justify-between px-2 py-1.5 rounded border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <Power
                      className={cn('w-4 h-4', c.enabled ? 'text-emerald-500' : 'text-gray-300')}
                    />
                    <span className="text-sm font-semibold text-gray-800">{p}</span>
                  </div>
                  <button
                    onClick={() => toggleProvider(p)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      c.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                        c.enabled ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 sticky top-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
            <h3 className="text-xs font-semibold text-gray-600 uppercase">
              Historique ({history.length})
            </h3>
            <button
              onClick={handleClear}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Effacer
            </button>
          </div>
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
              Aucun push pour le moment
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((r) => {
                const Icon = STATUS_ICON[r.status] ?? Clock;
                return (
                  <li key={r.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span
                          className={cn(
                            'mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border flex items-center gap-1',
                            STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-700 border-gray-300'
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {r.status}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">
                            {r.provider} — {r.payload.date}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {r.payload.roomTypeId} / {r.payload.planId}
                            {r.payload.price !== undefined && ` · ${r.payload.price}€`}
                            {r.payload.minStay !== undefined && ` · MLOS ${r.payload.minStay}`}
                            {r.payload.cta && ' · CTA'}
                            {r.payload.ctd && ' · CTD'}
                          </div>
                          {r.lastError && (
                            <div className="text-[10px] text-red-600 mt-0.5 truncate">
                              {r.lastError}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(r.timestamp).toLocaleString('fr-FR')} · {r.attempts} tentative(s)
                          </div>
                        </div>
                      </div>
                      {r.status === 'error' && (
                        <button
                          onClick={() => handleRetry(r.id)}
                          disabled={retrying === r.id}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1"
                        >
                          <RefreshCw
                            className={cn('w-3 h-3', retrying === r.id && 'animate-spin')}
                          />
                          Relancer
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className={cn(
        'border rounded p-2 text-center',
        color === 'emerald' && 'border-emerald-200 bg-emerald-50',
        color === 'amber' && 'border-amber-200 bg-amber-50',
        color === 'red' && 'border-red-200 bg-red-50'
      )}
    >
      <div
        className={cn(
          'text-xl font-bold',
          color === 'emerald' && 'text-emerald-700',
          color === 'amber' && 'text-amber-700',
          color === 'red' && 'text-red-700'
        )}
      >
        {value}
      </div>
      <div className="text-[10px] font-semibold text-gray-600 uppercase">{label}</div>
    </div>
  );
}
