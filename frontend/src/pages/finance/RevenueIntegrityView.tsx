/**
 * FLOWTYM — RevenueIntegrityView (SAS)
 * Moteur de détection d'anomalies tarifaires OTA — Revenue Integrity Engine.
 */
import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  RefreshCcw,
  Loader2,
  ChevronRight,
  X,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import {
  useRevenueAnomalies,
  useAnomalyStats,
  useResolveAnomaly,
} from '@/src/domains/finance/hooks';
import type { RevenueAnomalyRow, AnomalyType } from '@/src/domains/finance/schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  PRICE_MISMATCH: 'Tarif incohérent',
  COMMISSION_ERROR: 'Commission incorrecte',
  TAX_ERROR: 'Taxes incohérentes',
  PROMOTION_ERROR: 'Promotion invalide',
  PAYOUT_ERROR: 'Mauvais payout',
  CURRENCY_ERROR: 'Devise incorrecte',
  ROUNDING_ERROR: 'Arrondi suspect',
  MAPPING_ERROR: 'Mauvais mapping',
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critique', variant: 'error' as const, color: 'text-red-600 bg-red-50' },
  warning: { label: 'Avertissement', variant: 'warning' as const, color: 'text-amber-600 bg-amber-50' },
  info: { label: 'Info', variant: 'neutral' as const, color: 'text-blue-600 bg-blue-50' },
};

function fmtEur(v: number | null) {
  if (v === null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Resolve Dialog ───────────────────────────────────────────────────────────

function ResolveDialog({
  anomaly,
  onClose,
}: {
  anomaly: RevenueAnomalyRow;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const resolve = useResolveAnomaly();

  const handleResolve = () => {
    if (!note.trim()) return;
    resolve.mutate(
      { id: anomaly.id, note },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-md rounded-[28px] shadow-2xl p-8 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Résoudre l'anomalie</h3>
            <p className="text-xs text-gray-400 mt-1">
              {ANOMALY_LABELS[anomaly.anomaly_type] ?? anomaly.anomaly_type}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-2xl text-sm text-gray-600">
          {anomaly.description}
        </div>

        {anomaly.delta !== null && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex-1 p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Attendu</p>
              <p className="font-bold text-gray-900">{fmtEur(anomaly.expected_amount)}</p>
            </div>
            <div className="flex-1 p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Reçu</p>
              <p className="font-bold text-gray-900">{fmtEur(anomaly.actual_amount)}</p>
            </div>
            <div className="flex-1 p-3 bg-red-50 rounded-xl">
              <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Écart</p>
              <p className="font-bold text-red-600">{fmtEur(anomaly.delta)}</p>
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note de résolution (ex: erreur corrigée côté Booking, remboursement demandé…)"
          rows={3}
          className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none"
        />

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-bold">
            Annuler
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!note.trim() || resolve.isPending}
            className="flex-1 bg-[#8B5CF6] text-white font-bold gap-2 shadow-lg shadow-[#8B5CF6]/20"
          >
            {resolve.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Marquer résolu
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RevenueIntegrityView = () => {
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | ''>('open');
  const [severityFilter, setSeverityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<RevenueAnomalyRow | null>(null);

  const { data: anomalyData, isLoading, refetch, isFetching } = useRevenueAnomalies({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });
  const { data: stats } = useAnomalyStats();

  const rows = anomalyData?.rows ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-[#8B5CF6] rounded-2xl text-white shadow-lg shadow-[#8B5CF6]/20">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Revenue Integrity
            </h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">
              Moteur de détection d'anomalies tarifaires OTA — SAS
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 bg-white shadow-sm font-bold"
        >
          <RefreshCcw size={14} className={cn(isFetching && 'animate-spin')} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Anomalies ouvertes',
            value: stats?.open ?? 0,
            sub: 'À traiter',
            icon: <AlertTriangle size={18} className="text-amber-500" />,
            bg: 'bg-amber-50',
            color: 'text-amber-600',
          },
          {
            label: 'Critiques',
            value: stats?.critical ?? 0,
            sub: 'Blocage immédiat',
            icon: <AlertTriangle size={18} className="text-red-500" />,
            bg: 'bg-red-50',
            color: 'text-red-600',
          },
          {
            label: 'Perte potentielle',
            value: fmtEur(stats?.potentialLoss ?? 0),
            sub: 'Sur anomalies ouvertes',
            icon: <TrendingDown size={18} className="text-red-400" />,
            bg: 'bg-red-50',
            color: 'text-red-600',
          },
          {
            label: 'Résolues ce mois',
            value: stats?.resolvedThisMonth ?? 0,
            sub: 'Mois en cours',
            icon: <CheckCircle size={18} className="text-emerald-500" />,
            bg: 'bg-emerald-50',
            color: 'text-emerald-600',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5 bg-white border-transparent shadow-sm">
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-xl shrink-0', kpi.bg)}>{kpi.icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {kpi.label}
                </p>
                <p className={cn('text-2xl font-bold mt-0.5 truncate', kpi.color)}>
                  {kpi.value}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border-transparent shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[
              { label: 'Ouvertes', value: 'open' as const },
              { label: 'Résolues', value: 'resolved' as const },
              { label: 'Toutes', value: '' as const },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all',
                  statusFilter === f.value
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs font-bold bg-gray-50 border-0 rounded-xl px-3 py-2 text-gray-600 focus:outline-none"
          >
            <option value="">Toutes sévérités</option>
            <option value="critical">Critique</option>
            <option value="warning">Avertissement</option>
            <option value="info">Info</option>
          </select>
          <p className="ml-auto text-xs text-gray-400 font-medium">
            {anomalyData?.total ?? 0} anomalie{(anomalyData?.total ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
      </Card>

      {/* Anomalies table */}
      <Card className="bg-white border-transparent shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Analyse en cours…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Shield size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-bold">Aucune anomalie détectée</p>
            <p className="text-xs mt-1 opacity-60">
              Le moteur Revenue Integrity surveille vos flux en temps réel
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((row) => {
              const sevCfg = SEVERITY_CONFIG[row.severity] ?? SEVERITY_CONFIG.info;
              const isExpanded = expandedId === row.id;

              return (
                <React.Fragment key={row.id}>
                  <div
                    className={cn(
                      'p-5 hover:bg-gray-50/60 transition-colors',
                      isExpanded && 'bg-gray-50/60',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Severity indicator */}
                      <div className={cn('p-2 rounded-xl shrink-0 mt-0.5', sevCfg.color.split(' ')[1])}>
                        <AlertTriangle size={16} className={sevCfg.color.split(' ')[0]} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={sevCfg.variant} className="text-[10px] font-bold px-2 py-0.5">
                            {sevCfg.label}
                          </Badge>
                          <Badge variant="neutral" className="text-[10px] font-mono px-2 py-0.5">
                            {ANOMALY_LABELS[row.anomaly_type] ?? row.anomaly_type}
                          </Badge>
                          {row.source && (
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg uppercase">
                              {row.source}
                            </span>
                          )}
                          {row.score !== null && (
                            <span className={cn('text-sm font-bold', scoreColor(row.score))}>
                              Score {row.score}/100
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-gray-700 mt-1">{row.description}</p>

                        {row.delta !== null && (
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-400">
                              Attendu : <span className="font-bold text-gray-600">{fmtEur(row.expected_amount)}</span>
                            </span>
                            <span className="text-gray-400">
                              Reçu : <span className="font-bold text-gray-600">{fmtEur(row.actual_amount)}</span>
                            </span>
                            <span className="text-red-500 font-bold">
                              Écart : {fmtEur(row.delta)}
                            </span>
                          </div>
                        )}

                        <p className="text-[10px] text-gray-400 mt-2 font-mono">
                          {new Date(row.created_at).toLocaleString('fr-FR')}
                          {row.status === 'resolved' && row.resolution_note && (
                            <span className="ml-3 text-emerald-500 font-medium not-italic">
                              ✓ {row.resolution_note}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {row.details && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
                            title="Voir détails"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {row.status === 'open' && (
                          <Button
                            size="sm"
                            onClick={() => setResolveTarget(row)}
                            className="text-[10px] font-bold bg-[#8B5CF6] text-white gap-1 shadow-sm hover:bg-[#7C3AED]"
                          >
                            <CheckCircle size={11} />
                            Résoudre
                          </Button>
                        )}
                        {row.status === 'resolved' && (
                          <Badge variant="success" className="text-[10px] px-2.5 py-1 font-bold">
                            Résolu
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && row.details && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-gray-50/80 border-t border-gray-100"
                      >
                        <div className="px-6 py-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Détail du calcul
                          </p>
                          <pre className="text-[10px] font-mono text-gray-500 bg-white p-3 rounded-xl overflow-x-auto max-h-40 border border-gray-100">
                            {JSON.stringify(row.details, null, 2)}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Card>

      {/* Resolve Dialog */}
      <AnimatePresence>
        {resolveTarget && (
          <ResolveDialog
            anomaly={resolveTarget}
            onClose={() => setResolveTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
