/**
 * FLOWTYM RMS — Page Alertes (moteur réel)
 *
 * Le fil d'alertes est désormais calculé par `computeAlerts()` à partir des
 * données réelles (Lighthouse, Expedia, événements, calendrier tarifaire).
 * Les actions utilisateur (acquitter / résoudre / rejeter) sont persistées
 * dans `alertActionsStore`.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  History,
  Layers,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Undo2,
  X,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { cn } from '@/src/lib/utils';

import {
  computeAlerts,
  summarizeAlerts,
  type AlertKind,
  type AlertSeverity,
  type RmAlert,
  type SuggestedActionType,
} from '@/src/lib/rms/alertsEngine';
import { useLighthouseStore } from '@/src/store/lighthouseStore';
import { useExpediaStore } from '@/src/store/expediaStore';
import { useSalonsStore } from '@/src/store/salonsStore';
import { usePromotionsStore } from '@/src/store/promotionsStore';
import { useAlertActionsStore, type AlertStatus } from '@/src/store/alertActionsStore';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

interface KindMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const KIND_META: Record<AlertKind, KindMeta> = {
  opportunity: { label: 'Opportunité', icon: TrendingUp, color: '#16A34A', bg: '#ECFDF5' },
  risk: { label: 'Risque', icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  overheating: { label: 'Surchauffe', icon: Flame, color: '#EA580C', bg: '#FFF7ED' },
  compression: { label: 'Compression', icon: Layers, color: '#D97706', bg: '#FFFBEB' },
  underpricing: { label: 'Sous-pricing', icon: ArrowDownCircle, color: '#2563EB', bg: '#EFF6FF' },
  overpricing: { label: 'Overpricing', icon: ArrowUpCircle, color: '#7C3AED', bg: '#F5F3FF' },
};

const SEVERITY_META: Record<AlertSeverity, { label: string; tone: string; bg: string }> = {
  critical: { label: 'Critique', tone: 'text-rose-700', bg: 'bg-rose-50 ring-rose-200' },
  warning: { label: 'À surveiller', tone: 'text-amber-700', bg: 'bg-amber-50 ring-amber-200' },
  info: { label: 'Information', tone: 'text-sky-700', bg: 'bg-sky-50 ring-sky-200' },
};

const STATUS_META: Record<AlertStatus, { label: string; tone: string }> = {
  open: { label: 'Ouverte', tone: 'text-slate-500' },
  acknowledged: { label: 'Acquittée', tone: 'text-amber-600' },
  resolved: { label: 'Résolue', tone: 'text-emerald-600' },
  dismissed: { label: 'Rejetée', tone: 'text-slate-400' },
};

const ACTION_TARGET_PAGE: Record<SuggestedActionType, string> = {
  'open-recommendation': 'rev_pricing_reco',
  'open-calendar': 'rev_calendar',
  'open-distribution': 'rev_distribution',
  'open-strategies': 'rev_strategies',
  'open-competitive-watch': 'rev_market',
  'open-promotions': 'rev_promotions',
};

// ─── NAVIGATION HELPER ───────────────────────────────────────────────────────

function navigateTo(page: string) {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }));
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

type FilterKind = 'all' | AlertKind;
type StatusView = 'open' | 'all' | 'archive';

export const AlertsPage: React.FC = () => {
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [statusView, setStatusView] = useState<StatusView>('open');
  const [showHistory, setShowHistory] = useState(false);

  // Sources de données réelles
  const lighthouse = useLighthouseStore((s) => s.importData);
  const expedia = useExpediaStore((s) => s.importData);
  const events = useSalonsStore((s) => s.importData?.events ?? []);
  const promotions = usePromotionsStore((s) => s.promotions);

  // Actions utilisateur persistées
  const statusMap = useAlertActionsStore((s) => s.status);
  const log = useAlertActionsStore((s) => s.log);
  const acknowledge = useAlertActionsStore((s) => s.acknowledge);
  const resolve = useAlertActionsStore((s) => s.resolve);
  const dismiss = useAlertActionsStore((s) => s.dismiss);
  const reopen = useAlertActionsStore((s) => s.reopen);

  // Calcul du fil d'alertes en temps réel
  const allAlerts = useMemo(
    () => computeAlerts({ lighthouse, expedia, events, promotions }),
    [lighthouse, expedia, events, promotions]
  );

  // Filtrage : kind + statut courant
  const visible = useMemo(() => {
    let arr = allAlerts;
    if (filterKind !== 'all') arr = arr.filter((a) => a.kind === filterKind);

    if (statusView === 'open') {
      arr = arr.filter((a) => (statusMap[a.id] ?? 'open') === 'open');
    } else if (statusView === 'archive') {
      arr = arr.filter((a) => {
        const st = statusMap[a.id] ?? 'open';
        return st === 'resolved' || st === 'dismissed';
      });
    }
    return arr;
  }, [allAlerts, filterKind, statusView, statusMap]);

  // Synthèse pour les cartes du haut
  const stats = useMemo(() => summarizeAlerts(allAlerts), [allAlerts]);
  const openCount = useMemo(
    () =>
      allAlerts.filter((a) => (statusMap[a.id] ?? 'open') === 'open').length,
    [allAlerts, statusMap]
  );

  const summary = [
    {
      label: 'Critiques ouvertes',
      value: allAlerts.filter(
        (a) => a.severity === 'critical' && (statusMap[a.id] ?? 'open') === 'open'
      ).length,
      color: '#EF4444',
    },
    { label: 'Opportunités', value: stats.byKind.opportunity, color: '#16A34A' },
    { label: 'Risques', value: stats.byKind.risk, color: '#EA580C' },
    { label: 'Alertes ouvertes', value: openCount, color: '#8B5CF6' },
  ];

  // Empty state contextuel
  const noDataSource = !lighthouse && !expedia && events.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Bell}
          title="Alertes RMS"
          subtitle="Moteur temps réel — opportunités, risques et signaux marché calculés depuis vos données"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-slate-500">
                {allAlerts.length} alerte(s) générée(s)
              </span>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                Historique
              </button>
            </div>
          }
        />

        {/* Synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {summary.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4"
            >
              <div className="text-[12px] font-semibold text-gray-400">{s.label}</div>
              <div className="text-[28px] font-extrabold mt-1 tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Toolbar : filtre kind + vue statut */}
        <div className="flex items-center gap-2 flex-wrap mb-4 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { id: 'all', label: 'Toutes' },
              { id: 'opportunity', label: 'Opportunités' },
              { id: 'risk', label: 'Risques' },
              { id: 'overheating', label: 'Surchauffe' },
              { id: 'compression', label: 'Compression' },
              { id: 'underpricing', label: 'Sous-pricing' },
              { id: 'overpricing', label: 'Overpricing' },
            ] as { id: FilterKind; label: string }[]).map((f) => {
              const isActive = filterKind === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterKind(f.id)}
                  className={cn(
                    'h-9 px-3.5 rounded-xl text-[12.5px] font-semibold transition-colors',
                    isActive
                      ? 'bg-[#8B5CF6] text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white p-0.5">
            {([
              { id: 'open', label: 'Ouvertes' },
              { id: 'all', label: 'Toutes' },
              { id: 'archive', label: 'Archive' },
            ] as { id: StatusView; label: string }[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusView(s.id)}
                className={cn(
                  'h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors',
                  statusView === s.id
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fil d'alertes */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((alert, i) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                index={i}
                status={statusMap[alert.id] ?? 'open'}
                onAcknowledge={() => acknowledge(alert.id)}
                onResolve={() => resolve(alert.id)}
                onDismiss={() => dismiss(alert.id)}
                onReopen={() => reopen(alert.id)}
                onTreat={() => {
                  acknowledge(alert.id);
                  const target = ACTION_TARGET_PAGE[alert.suggestedAction.type];
                  if (target) navigateTo(target);
                }}
              />
            ))}
          </AnimatePresence>

          {visible.length === 0 && (
            <EmptyState
              noDataSource={noDataSource}
              filterKind={filterKind}
              statusView={statusView}
            />
          )}
        </div>
      </div>

      <HistoryDrawer
        open={showHistory}
        log={log}
        alerts={allAlerts}
        onClose={() => setShowHistory(false)}
        onReopen={reopen}
      />
    </div>
  );
};

export default AlertsPage;

// ─── ALERT CARD ──────────────────────────────────────────────────────────────

interface AlertCardProps {
  alert: RmAlert;
  index: number;
  status: AlertStatus;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDismiss: () => void;
  onReopen: () => void;
  onTreat: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  index,
  status,
  onAcknowledge,
  onResolve,
  onDismiss,
  onReopen,
  onTreat,
}) => {
  const meta = KIND_META[alert.kind];
  const sev = SEVERITY_META[alert.severity];
  const st = STATUS_META[status];
  const isClosed = status === 'resolved' || status === 'dismissed';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.28, delay: Math.min(0.03 * index, 0.18) }}
      className={cn(
        'bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex items-start gap-3.5',
        isClosed && 'opacity-70'
      )}
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: meta.bg }}
      >
        <meta.icon className="w-5 h-5" style={{ color: meta.color }} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className={cn(
              'text-[10.5px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset',
              sev.bg,
              sev.tone
            )}
          >
            {sev.label}
          </span>
          <span
            className={cn('text-[10.5px] font-bold px-2 py-0.5 rounded-full', st.tone)}
          >
            • {st.label}
          </span>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Confiance {alert.confidence}
          </span>
        </div>

        <h3 className="text-[14px] font-bold text-gray-900 mt-1.5">{alert.title}</h3>
        <p className="text-[12.5px] text-gray-500 leading-snug mt-0.5">{alert.message}</p>

        {/* Métriques clés */}
        {alert.metrics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alert.metrics.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
              >
                <span className="font-medium text-slate-400">{m.label}</span>
                <span className="font-semibold text-slate-700 tabular-nums">{m.value}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-2.5 text-[11.5px] font-semibold text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {alert.dateRange.start === alert.dateRange.end
              ? formatDateFR(alert.dateRange.start)
              : `${formatDateFR(alert.dateRange.start)} → ${formatDateFR(alert.dateRange.end)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Sources : {alert.source.join(', ')}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="self-stretch shrink-0 flex flex-col items-end justify-between gap-2">
        {!isClosed ? (
          <>
            <button
              type="button"
              onClick={onTreat}
              className="h-9 px-3 rounded-xl bg-[#8B5CF6] text-white text-[12.5px] font-semibold hover:bg-[#7C3AED] inline-flex items-center gap-1 shadow-sm shadow-violet-500/25 transition-colors"
            >
              {alert.suggestedAction.label}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1">
              {status === 'open' && (
                <IconAction
                  label="Acquitter"
                  icon={CheckCheck}
                  onClick={onAcknowledge}
                  tone="amber"
                />
              )}
              <IconAction
                label="Marquer résolue"
                icon={CheckCircle2}
                onClick={onResolve}
                tone="emerald"
              />
              <IconAction
                label="Rejeter"
                icon={X}
                onClick={onDismiss}
                tone="slate"
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onReopen}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Rouvrir
          </button>
        )}
      </div>
    </motion.div>
  );
};

const IconAction: React.FC<{
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone: 'amber' | 'emerald' | 'slate';
}> = ({ label, icon: Icon, onClick, tone }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={cn(
      'h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors',
      tone === 'amber' && 'text-amber-600 hover:bg-amber-50',
      tone === 'emerald' && 'text-emerald-600 hover:bg-emerald-50',
      tone === 'slate' && 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
    )}
  >
    <Icon className="w-4 h-4" />
  </button>
);

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  noDataSource: boolean;
  filterKind: FilterKind;
  statusView: StatusView;
}> = ({ noDataSource, filterKind, statusView }) => {
  if (noDataSource) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 mb-3">
          <Sparkles className="w-5 h-5" />
        </div>
        <p className="text-[14px] font-semibold text-slate-900">
          Aucune source de données importée
        </p>
        <p className="text-[12.5px] text-slate-500 mt-1 max-w-md mx-auto">
          Importez un fichier Lighthouse, Expedia ou Événements depuis la Veille
          Concurrentielle pour que le moteur génère les alertes.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('rev_market')}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/30"
        >
          Aller à la Veille Concurrentielle
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center">
      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
      <p className="text-[13.5px] font-semibold text-slate-700">
        Aucune alerte {filterKind !== 'all' ? `de type "${KIND_META[filterKind as AlertKind]?.label.toLowerCase() ?? filterKind}"` : ''}
        {statusView === 'open' ? ' ouverte' : statusView === 'archive' ? ' archivée' : ''}.
      </p>
      <p className="text-[12px] text-slate-500 mt-1">
        Le moteur RMS surveille en continu vos données.
      </p>
    </div>
  );
};

// ─── HISTORY DRAWER ──────────────────────────────────────────────────────────

const HistoryDrawer: React.FC<{
  open: boolean;
  log: ReturnType<typeof useAlertActionsStore.getState>['log'];
  alerts: RmAlert[];
  onClose: () => void;
  onReopen: (id: string) => void;
}> = ({ open, log, alerts, onClose, onReopen }) => {
  const alertById = useMemo(() => new Map(alerts.map((a) => [a.id, a])), [alerts]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[min(480px,90vw)] bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Historique des alertes</h3>
                  <p className="text-[11px] text-slate-500">{log.length} actions journalisées</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {log.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-500">
                  Aucune action utilisateur enregistrée pour le moment.
                </div>
              ) : (
                log.map((entry, i) => {
                  const a = alertById.get(entry.alertId);
                  return (
                    <div
                      key={`${entry.alertId}-${i}`}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-[11px] font-bold uppercase tracking-wider',
                            STATUS_META[entry.status].tone
                          )}
                        >
                          {STATUS_META[entry.status].label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(entry.at).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] font-medium text-slate-800 line-clamp-2">
                        {a?.title ?? 'Alerte non disponible'}
                      </p>
                      {a && entry.status !== 'open' && (
                        <button
                          type="button"
                          onClick={() => onReopen(entry.alertId)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rouvrir
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

function formatDateFR(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
