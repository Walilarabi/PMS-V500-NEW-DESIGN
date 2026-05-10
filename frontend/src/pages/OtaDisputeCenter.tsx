/**
 * FLOWTYM — OTA Dispute Management System (ODMS) — Dispute Center.
 *
 * Single-page command center exposing :
 *   * 4 KPI tiles (open / sent / corrected / recovered amount)
 *   * Smart RIE — Partner reliability table (rolling 30 days)
 *   * Quarantine virtual rooms summary (Chambres fictives techniques)
 *   * Disputes list with status filter
 *   * Right-side dispute drawer : timeline (history + messages),
 *     email preview, PDF download, status FSM actions
 */
import React, { useMemo, useState } from 'react';
import {
  ShieldAlert, Mail, FileDown, Send, RefreshCw, Plus, X,
  Clock, CheckCircle2, XCircle, Eye, Banknote, Lock, Building2, TrendingDown,
  Bell, SkipForward,
} from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import {
  useDisputes,
  useDisputeDetail,
  useDisputeTimeline,
  useChangeDisputeStatus,
  usePartnerReliability,
  useReminders,
  useRemindersByDispute,
  useMarkReminderSent,
  useSendReminderEmail,
  useSkipReminder,
} from '@/src/domains/odms/hooks';
import { useRieConfiguration } from '@/src/domains/rie/hooks';
import { DisputeWorkflowEngine } from '@/src/domains/odms/engines';
import { downloadDisputePdf } from '@/src/domains/odms/pdf';
import type { DisputeRow, DisputeStatus, DraftEmail } from '@/src/domains/odms/types';
import type { ReminderRow } from '@/src/domains/odms/reminders';
import { CreateDisputeModal } from '@/src/components/modals/CreateDisputeModal';
import { supabase } from '@/src/lib/supabase';

const fmtEUR = (n: number | null | undefined, currency = 'EUR'): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
    : '—';

const STATUS_TONE: Record<DisputeStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  SENT: 'bg-violet-50 text-violet-700 border-violet-100',
  ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-100',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-100',
  CORRECTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
  CLOSED: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<DisputeStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACKNOWLEDGED: 'Accusé de réception',
  IN_REVIEW: 'En examen',
  CORRECTED: 'Corrigé',
  REJECTED: 'Rejeté',
  CLOSED: 'Clôturé',
};

export const OtaDisputeCenter: React.FC = () => {
  const hotelQ = useActiveHotel();
  const disputesQ = useDisputes(100);
  const reliabilityQ = usePartnerReliability();
  const cfgQ = useRieConfiguration();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const disputes = (disputesQ.data ?? []) as DisputeRow[];

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? disputes : disputes.filter((d) => d.status === statusFilter)),
    [disputes, statusFilter],
  );

  const kpis = useMemo(() => {
    const open = disputes.filter((d) => !DisputeWorkflowEngine.isTerminal(d.status)).length;
    const sent = disputes.filter((d) => d.status === 'SENT' || d.status === 'IN_REVIEW' || d.status === 'ACKNOWLEDGED').length;
    const corrected = disputes.filter((d) => d.status === 'CORRECTED' || d.status === 'CLOSED').length;
    const recovered = disputes.reduce((s, d) => s + (d.recovered_amount ?? 0), 0);
    const totalDelta = disputes.reduce((s, d) => s + Math.abs(d.delta_amount ?? 0), 0);
    return { open, sent, corrected, recovered, totalDelta };
  }, [disputes]);

  const partnerById = useMemo(() => {
    const m: Record<string, { code: string; name: string }> = {};
    for (const p of cfgQ.data?.partners ?? []) m[p.id] = { code: p.code, name: p.name };
    return m;
  }, [cfgQ.data]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="odms-dashboard">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-6">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
              SAS · OTA Dispute Management
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="odms-title">
              Centre de gestion des litiges OTA{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Réclamations automatiques, suivi du cycle de vie, génération de preuves PDF & email — natif PMS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void disputesQ.refetch();
                void reliabilityQ.refetch();
              }}
              data-testid="odms-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} className={disputesQ.isFetching ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              data-testid="odms-create-open"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={14} /> Nouveau litige
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi testid="odms-kpi-open" label="Litiges ouverts" value={String(kpis.open)} hint="En cours" icon={ShieldAlert} tone="amber" />
          <Kpi testid="odms-kpi-sent" label="Envoyés / en examen" value={String(kpis.sent)} hint="SLA partenaire" icon={Mail} tone="violet" />
          <Kpi testid="odms-kpi-corrected" label="Corrigés / clôturés" value={String(kpis.corrected)} hint="Résolutions" icon={CheckCircle2} tone="emerald" />
          <Kpi testid="odms-kpi-recovered" label="Montant récupéré" value={fmtEUR(kpis.recovered)} hint={`Litiges total ${fmtEUR(kpis.totalDelta)}`} icon={Banknote} tone="emerald" />
        </section>

        {/* Smart RIE - Partner reliability */}
        <PartnerReliabilitySection rows={reliabilityQ.data ?? []} partnerById={partnerById} />

        {/* ODMS Reminders queue (J+2 / J+5 / J+10) */}
        <RemindersQueueSection />

        {/* Two-pane: list + drawer */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <header className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900">Litiges</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(['ALL', 'DRAFT', 'SENT', 'IN_REVIEW', 'CORRECTED', 'CLOSED'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    data-testid={`odms-filter-${s}`}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      statusFilter === s
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {s === 'ALL' ? 'Tous' : STATUS_LABEL[s as DisputeStatus]}
                  </button>
                ))}
              </div>
            </header>
            <DisputesTable
              rows={filtered}
              partnerById={partnerById}
              onPick={(id) => setSelectedId(id)}
              activeId={selectedId}
            />
          </section>

          <DisputeDrawer
            disputeId={selectedId}
            partnerById={partnerById}
            hotelName={hotelQ.data?.name ?? '—'}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </main>

      <CreateDisputeModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

/* ----------------------------------------------------- KPI ---------- */

interface KpiProps {
  testid?: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'amber' | 'violet' | 'emerald' | 'rose';
}

const TONE_BG: Record<KpiProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
};

const Kpi: React.FC<KpiProps> = ({ testid, label, value, hint, icon: Icon, tone }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3" data-testid={testid}>
    <span className={`grid place-items-center w-10 h-10 rounded-xl ${TONE_BG[tone]} shrink-0`}>
      <Icon size={18} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  </div>
);

/* ----------------------------------------- Partner reliability ------- */

interface ReliabilityRow {
  partner_id: string | null;
  runs: number;
  avg_score_30d: number | null;
  auto_count: number;
  warning_count: number;
  manual_count: number;
  quarantine_count: number;
  cumulative_delta_30d: number | null;
}

const PartnerReliabilitySection: React.FC<{
  rows: ReliabilityRow[];
  partnerById: Record<string, { code: string; name: string }>;
}> = ({ rows, partnerById }) => (
  <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" data-testid="odms-reliability">
    <header className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <TrendingDown size={14} className="text-violet-600" /> Smart RIE — Fiabilité partenaire (30j)
      </h2>
      <span className="text-[10px] text-gray-400">
        Plus le score est haut, plus le partenaire est fiable.
      </span>
    </header>
    {rows.length === 0 ? (
      <p className="text-xs text-gray-400 py-6 text-center">
        Aucune donnée encore. Lance des validations RIE pour alimenter cet historique.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full text-sm" data-testid="odms-reliability-table">
          <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Partenaire</th>
              <th className="text-right px-3 py-2 font-semibold">Validations</th>
              <th className="text-right px-3 py-2 font-semibold">Score moyen</th>
              <th className="text-right px-3 py-2 font-semibold">Auto</th>
              <th className="text-right px-3 py-2 font-semibold">Vigilance</th>
              <th className="text-right px-3 py-2 font-semibold">Manuel</th>
              <th className="text-right px-3 py-2 font-semibold">Quarantaine</th>
              <th className="text-right px-3 py-2 font-semibold">Écart cumulé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.partner_id ? partnerById[r.partner_id] : null;
              const score = r.avg_score_30d ?? 0;
              const tone = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600';
              return (
                <tr
                  key={r.partner_id ?? 'unknown'}
                  className="border-t border-gray-100"
                  data-testid={`odms-reliability-${p?.code ?? r.partner_id ?? 'na'}`}
                >
                  <td className="px-3 py-2 font-semibold text-gray-800">{p?.name ?? '—'}<span className="text-gray-400 ml-2 text-[10px]">{p?.code}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.runs}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${tone}`}>{score.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.auto_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{r.warning_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-violet-700">{r.manual_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">{r.quarantine_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtEUR(r.cumulative_delta_30d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

/* --------------------------------------------------- list ---------- */

const DisputesTable: React.FC<{
  rows: DisputeRow[];
  partnerById: Record<string, { code: string; name: string }>;
  onPick: (id: string) => void;
  activeId: string | null;
}> = ({ rows, partnerById, onPick, activeId }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm" data-testid="odms-disputes-table">
      <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
        <tr>
          <th className="text-left px-4 py-3 font-semibold">Référence</th>
          <th className="text-left px-4 py-3 font-semibold">OTA</th>
          <th className="text-left px-4 py-3 font-semibold">Statut</th>
          <th className="text-right px-4 py-3 font-semibold">Écart</th>
          <th className="text-right px-4 py-3 font-semibold">Recouvré</th>
          <th className="text-left px-4 py-3 font-semibold">Quarantaine</th>
          <th className="text-left px-4 py-3 font-semibold">Créé</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
              Aucun litige correspondant. Crée-en un depuis une validation à risque.
            </td>
          </tr>
        ) : (
          rows.map((d) => {
            const p = d.partner_id ? partnerById[d.partner_id] : null;
            return (
              <tr
                key={d.id}
                onClick={() => onPick(d.id)}
                data-testid={`odms-row-${d.reference}`}
                className={`border-t border-gray-100 cursor-pointer transition-colors ${
                  activeId === d.id ? 'bg-violet-50/60' : 'hover:bg-violet-50/20'
                }`}
              >
                <td className="px-4 py-3 font-bold text-gray-800 tabular-nums">{d.reference}</td>
                <td className="px-4 py-3 text-gray-700">
                  {p?.name ?? <em className="text-gray-400">—</em>}
                  <span className="text-[10px] text-gray-400 ml-1">{p?.code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[d.status]}`}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={Math.abs(d.delta_amount ?? 0) > 0.5 ? 'text-rose-600 font-semibold' : 'text-gray-500'}>
                    {fmtEUR(d.delta_amount, d.currency)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-semibold">
                  {fmtEUR(d.recovered_amount, d.currency)}
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500">
                  {d.virtual_room_id ? (
                    <span className="inline-flex items-center gap-1 text-violet-700">
                      <Lock size={11} /> Isolée
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500">
                  {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

/* --------------------------------------------------- drawer -------- */

const DisputeDrawer: React.FC<{
  disputeId: string | null;
  partnerById: Record<string, { code: string; name: string }>;
  hotelName: string;
  onClose: () => void;
}> = ({ disputeId, partnerById, hotelName, onClose }) => {
  const detailQ = useDisputeDetail(disputeId);
  const timelineQ = useDisputeTimeline(disputeId);
  const change = useChangeDisputeStatus();
  const { toast } = useToast();

  const dispute = detailQ.data ?? null;

  const handleStatus = async (to: DisputeStatus) => {
    if (!dispute) return;
    if (!DisputeWorkflowEngine.canTransition(dispute.status, to)) {
      toast({ title: 'Transition refusée', description: `Impossible : ${dispute.status} → ${to}`, variant: 'destructive' });
      return;
    }
    try {
      const reasonMap: Record<DisputeStatus, string> = {
        DRAFT: 'Repassé en brouillon',
        SENT: 'Email envoyé au partenaire',
        ACKNOWLEDGED: 'Accusé de réception du partenaire',
        IN_REVIEW: 'Partenaire en cours d\u2019examen',
        CORRECTED: 'Correction appliquée par le partenaire',
        REJECTED: 'Partenaire refuse la réclamation',
        CLOSED: 'Dossier clôturé',
      };
      await change.mutateAsync({
        disputeId: dispute.id,
        from: dispute.status,
        to,
        reason: reasonMap[to],
        email: to === 'SENT' ? (dispute.computed_email as DraftEmail) : null,
      });
      toast({ title: 'Statut mis à jour', description: `${STATUS_LABEL[dispute.status]} → ${STATUS_LABEL[to]}`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    }
  };

  const remindersQ = useRemindersByDispute(disputeId);

  const handlePdf = async () => {
    if (!dispute) return;
    const partner = dispute.partner_id ? partnerById[dispute.partner_id] : null;

    // Fetch the linked reservation evidence (best-effort, soft-fail).
    let reservation: import('@/src/domains/odms/pdf').DisputeReservationSummary | null = null;
    if (dispute.reservation_id) {
      try {
        const { data: resv } = await supabase
          .from('reservations')
          .select('id, reference, guest_first_name, guest_last_name, check_in, check_out, total_amount, channel, status')
          .eq('id', dispute.reservation_id)
          .maybeSingle();
        if (resv) {
          reservation = resv as import('@/src/domains/odms/pdf').DisputeReservationSummary;
        }
      } catch {
        /* keep null */
      }
    }

    const reminders = (remindersQ.data ?? []).map((r) => {
      const payload = (r.email_payload ?? null) as { subject?: string } | null;
      return {
        step: r.step,
        status: r.status,
        due_at: r.due_at,
        sent_at: r.sent_at,
        subject: payload?.subject ?? null,
      };
    });

    downloadDisputePdf({
      hotelName,
      partnerName: partner?.name ?? null,
      partnerCode: partner?.code ?? null,
      dispute,
      email: (dispute.computed_email as DraftEmail | null) ?? null,
      reservation,
      reminders,
    });
  };

  if (!disputeId) {
    return (
      <aside className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px]" data-testid="odms-drawer-empty">
        <Eye size={28} className="text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Sélectionne un litige pour afficher le détail.</p>
      </aside>
    );
  }

  return (
    <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden" data-testid="odms-drawer">
      <header className="px-5 py-4 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-violet-50 to-white">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold">Litige</p>
          <h3 className="text-base font-bold text-gray-900 tabular-nums" data-testid="odms-drawer-reference">
            {dispute?.reference ?? '…'}
          </h3>
          {dispute && (
            <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[dispute.status]}`}>
              {STATUS_LABEL[dispute.status]}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="odms-drawer-close"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>
      </header>

      <div className="overflow-y-auto p-5 space-y-4 flex-1">
        {detailQ.isLoading || !dispute ? (
          <p className="text-xs text-gray-400">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FieldStat label="Attendu" value={fmtEUR(dispute.expected_amount, dispute.currency)} />
              <FieldStat label="Reçu" value={fmtEUR(dispute.received_amount, dispute.currency)} />
              <FieldStat label="Réclamé" value={fmtEUR(dispute.claimed_amount, dispute.currency)} tone="rose" />
              <FieldStat label="Recouvré" value={fmtEUR(dispute.recovered_amount, dispute.currency)} tone="emerald" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Sujet</p>
              <p className="text-sm text-gray-800 mt-1">{dispute.subject}</p>
            </div>

            {dispute.anomaly_codes?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Codes anomalies</p>
                <div className="flex flex-wrap gap-1.5">
                  {dispute.anomaly_codes.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-semibold border border-rose-100">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {dispute.virtual_room_id && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 flex items-start gap-2">
                <Building2 size={14} className="text-violet-700 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-violet-700">Chambre fictive technique</p>
                  <p className="text-[11px] text-gray-700">
                    La réservation est isolée dans une chambre virtuelle pour ne pas impacter le planning opérationnel.
                  </p>
                </div>
              </div>
            )}

            {/* Email preview */}
            {dispute.computed_email && (
              <details className="rounded-xl border border-gray-100 bg-gray-50/40 overflow-hidden">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-gray-700 flex items-center gap-2">
                  <Mail size={12} /> Aperçu de l'email
                </summary>
                <div className="p-3 text-xs text-gray-700 space-y-1 border-t border-gray-100">
                  <p><span className="text-gray-500">À : </span>{((dispute.computed_email as DraftEmail).to ?? []).join(', ')}</p>
                  <p><span className="text-gray-500">Sujet : </span>{(dispute.computed_email as DraftEmail).subject}</p>
                  <pre className="mt-2 text-[10px] whitespace-pre-wrap font-mono bg-white rounded-lg p-2 max-h-40 overflow-y-auto">
                    {(dispute.computed_email as DraftEmail).body_text}
                  </pre>
                </div>
              </details>
            )}

            {/* Timeline */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Chronologie</p>
              <Timeline data={timelineQ.data} disputeStatus={dispute.status} />
            </div>

            {/* Per-dispute reminders */}
            <DrawerReminders disputeId={dispute.id} />

            {/* Status FSM */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                {DisputeWorkflowEngine.next(dispute.status).map((to) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => handleStatus(to)}
                    disabled={change.isPending}
                    data-testid={`odms-action-${to}`}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                      to === 'SENT' || to === 'CORRECTED'
                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                        : to === 'REJECTED'
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {to === 'SENT' && <Send size={11} />}
                    {to === 'CORRECTED' && <CheckCircle2 size={11} />}
                    {to === 'REJECTED' && <XCircle size={11} />}
                    {STATUS_LABEL[to]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePdf}
                  data-testid="odms-action-pdf"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <FileDown size={11} /> Télécharger PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

const FieldStat: React.FC<{ label: string; value: string; tone?: 'rose' | 'emerald' | 'default' }> = ({ label, value, tone }) => (
  <div className="rounded-xl bg-gray-50/40 border border-gray-100 p-3">
    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
    <p className={`text-sm font-bold tabular-nums ${tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
  </div>
);

const Timeline: React.FC<{
  data: { messages: unknown[]; history: unknown[] } | undefined;
  disputeStatus: DisputeStatus;
}> = ({ data, disputeStatus }) => {
  if (!data) return <p className="text-[11px] text-gray-400">Chargement…</p>;
  const events = [
    ...((data.history ?? []) as Array<{ id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }>).map((h) => ({
      id: h.id,
      kind: 'STATUS' as const,
      label: `${h.from_status ?? '∅'} → ${h.to_status}`,
      detail: h.reason,
      at: h.created_at,
    })),
    ...((data.messages ?? []) as Array<{ id: string; kind: string; subject: string | null; created_at: string }>).map((m) => ({
      id: m.id,
      kind: 'MESSAGE' as const,
      label: m.kind,
      detail: m.subject,
      at: m.created_at,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (events.length === 0) {
    return <p className="text-[11px] text-gray-400">Aucun événement enregistré.</p>;
  }
  return (
    <ol className="space-y-2" data-testid="odms-timeline">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-[11px]">
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${e.kind === 'MESSAGE' ? 'bg-violet-500' : 'bg-gray-400'}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-700">{e.label}</span>
              <span className="text-gray-400 tabular-nums flex items-center gap-1">
                <Clock size={10} /> {new Date(e.at).toLocaleString('fr-FR')}
              </span>
            </div>
            {e.detail && <p className="text-gray-500 mt-0.5">{e.detail}</p>}
          </div>
        </li>
      ))}
      <li className="flex items-start gap-2 text-[11px] opacity-60">
        <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="font-semibold text-gray-700">État actuel : {STATUS_LABEL[disputeStatus]}</span>
      </li>
    </ol>
  );
};

export default OtaDisputeCenter;

/* -------------------------------------- Reminders queue --- */

const DrawerReminders: React.FC<{ disputeId: string }> = ({ disputeId }) => {
  const q = useRemindersByDispute(disputeId);
  const reminders = q.data ?? [];
  if (reminders.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 flex items-center gap-1">
        <Bell size={11} className="text-amber-500" /> Relances planifiées
      </p>
      <ul className="space-y-1.5">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-[11px] bg-amber-50/40 border border-amber-100 rounded-lg px-2 py-1.5">
            <span className="font-bold text-amber-700">J+{[2, 5, 10][r.step - 1] ?? '?'}</span>
            <span className="text-gray-600 flex-1 truncate">{new Date(r.due_at).toLocaleString('fr-FR')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              r.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
              : r.status === 'SENT' ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-200 text-gray-500'
            }`}>
              {r.status === 'PENDING' ? 'En attente' : r.status === 'SENT' ? 'Envoyée' : 'Ignorée'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
const REMINDER_STEP_DAYS = [2, 5, 10] as const;

const RemindersQueueSection: React.FC = () => {
  const remQ = useReminders();
  const markSent = useMarkReminderSent();
  const sendEmail = useSendReminderEmail();
  const skip = useSkipReminder();
  const { toast } = useToast();
  const all = remQ.data ?? [];
  const pending = all.filter((r) => r.status === 'PENDING');

  const handleSendEmail = async (r: ReminderRow) => {
    try {
      const res = await sendEmail.mutateAsync(r.id);
      toast({
        title: res.status === 'already_sent' ? 'Déjà envoyée' : 'Email envoyé',
        description: `Destinataire(s) : ${res.recipients.join(', ')}`,
        variant: 'success',
      });
      // Schedule the next reminder step locally (same logic as handleMarkSent)
      if (res.status === 'sent' && r.step < 3) {
        const nextStep = (r.step + 1) as 2 | 3;
        const days = REMINDER_STEP_DAYS[r.step] ?? 5;
        const due = new Date(Date.now() + days * 86_400_000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder = supabase.from('ota_dispute_reminders') as any;
        const payload = r.email_payload as DraftEmail | null;
        const stepDays = REMINDER_STEP_DAYS[nextStep - 1];
        await builder.insert({
          hotel_id: r.hotel_id,
          dispute_id: r.dispute_id,
          step: nextStep,
          due_at: due,
          status: 'PENDING',
          email_payload: payload
            ? { ...payload, subject: `[RELANCE J+${stepDays}] ${payload.subject.replace(/^\[RELANCE J\+\d+\] /, '')}` }
            : null,
        });
      }
      void remQ.refetch();
    } catch (e) {
      toast({ title: 'Échec envoi', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const handleMarkSent = async (r: ReminderRow) => {
    try {
      await markSent.mutateAsync(r.id);
      // schedule the next step if any
      if (r.step < 3) {
        const nextStep = (r.step + 1) as 2 | 3;
        const days = REMINDER_STEP_DAYS[r.step] ?? 5;
        const due = new Date(Date.now() + days * 86_400_000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder = supabase.from('ota_dispute_reminders') as any;
        const payload = r.email_payload as DraftEmail | null;
        const stepDays = REMINDER_STEP_DAYS[nextStep - 1];
        await builder.insert({
          hotel_id: r.hotel_id,
          dispute_id: r.dispute_id,
          step: nextStep,
          due_at: due,
          status: 'PENDING',
          email_payload: payload
            ? { ...payload, subject: `[RELANCE J+${stepDays}] ${payload.subject.replace(/^\[RELANCE J\+\d+\] /, '')}` }
            : null,
        });
      }
      void remQ.refetch();
      toast({
        title: 'Relance marquée envoyée',
        description: r.step < 3 ? `Prochaine relance planifiée à J+${REMINDER_STEP_DAYS[r.step]}` : 'Cycle de relances terminé',
        variant: 'success',
      });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" data-testid="odms-reminders-queue">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Bell size={14} className="text-amber-500" /> File de relances ODMS
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
          {pending.length} en attente
        </span>
      </header>
      {all.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          Aucune relance planifiée. Une relance J+2 est créée automatiquement à chaque transition DRAFT → SENT.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm" data-testid="odms-reminders-table">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Litige</th>
                <th className="text-center px-3 py-2 font-semibold">Étape</th>
                <th className="text-left px-3 py-2 font-semibold">Échéance</th>
                <th className="text-left px-3 py-2 font-semibold">Statut</th>
                <th className="text-left px-3 py-2 font-semibold">Sujet email</th>
                <th className="text-right px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const payload = r.email_payload as DraftEmail | null;
                const overdue = r.status === 'PENDING' && new Date(r.due_at) < new Date();
                return (
                  <tr key={r.id} className="border-t border-gray-100" data-testid={`odms-reminder-${r.id}`}>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-600">{r.dispute_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-center font-bold text-violet-700">J+{REMINDER_STEP_DAYS[r.step - 1] ?? '?'}</td>
                    <td className="px-3 py-2 text-[11px]">
                      <span className={overdue ? 'text-rose-600 font-bold' : 'text-gray-600'}>
                        {new Date(r.due_at).toLocaleString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : r.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {r.status === 'PENDING' ? 'En attente' : r.status === 'SENT' ? 'Envoyée' : 'Ignorée'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600 max-w-[280px] truncate">
                      {payload?.subject ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === 'PENDING' && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendEmail(r)}
                            disabled={sendEmail.isPending}
                            data-testid={`odms-reminder-send-email-${r.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          >
                            <Send size={11} /> {sendEmail.isPending ? 'Envoi…' : 'Envoyer email'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkSent(r)}
                            data-testid={`odms-reminder-sent-${r.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            <Send size={11} /> Marquer envoyée
                          </button>
                          <button
                            type="button"
                            onClick={() => skip.mutate(r.id)}
                            data-testid={`odms-reminder-skip-${r.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600"
                          >
                            <SkipForward size={11} /> Ignorer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
