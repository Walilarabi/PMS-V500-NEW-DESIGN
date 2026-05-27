/**
 * FLOWTYM — Anomalies financières réservations.
 * Détecte client-side : solde négatif, données manquantes, doublons potentiels,
 * montants anormaux, dates incohérentes.
 *
 * Clic sur la référence / nom du client → fiche réservation complète.
 */
import React, { useMemo, useState } from 'react';
import { AlertOctagon, RefreshCw, Search, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useReservations, useUpdateReservationStatus } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';

function fmt(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}
function money(v: number | null | undefined) {
  return typeof v === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
    : '—';
}

function toModalRes(r: ReservationRow): any {
  const balance = r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0));
  return {
    id:          r.id,
    reference:   r.reference ?? r.id.slice(0, 8).toUpperCase(),
    client:      r.guest_name  ?? 'Client inconnu',
    guestName:   r.guest_name  ?? 'Client inconnu',
    email:       r.guest_email ?? '',
    phone:       r.guest_phone ?? '',
    room:        r.room_number ?? '',
    roomType:    r.room_type   ?? r.room_category ?? '',
    arrival:     r.check_in    ?? '',
    departure:   r.check_out   ?? '',
    checkIn:     r.check_in    ?? '',
    checkOut:    r.check_out   ?? '',
    source:      r.source      ?? 'DIRECT',
    status:      r.status      ?? 'pending',
    totalAmount: r.total_amount ?? 0,
    montant:     r.total_amount ?? 0,
    solde:       balance,
    nights:      r.nights ?? 1,
    notes:       r.notes ?? '',
    priority:    'normal',
    statusColor: '#10B981',
    dotColor:    '#10B981',
    sourceColor: '#6B7280',
    action:      '',
    governess:   '',
    vip:         false,
    payment:     balance <= 0 ? 'Payé' : 'Solde restant',
    ownerFeeRate: 0,
    pmsFeeRate:   0,
    cleaningFee:  0,
  };
}

type Severity = 'error' | 'warning' | 'info';
interface Anomaly {
  id: string;
  reservationId: string;
  reference: string;
  client: string;
  type: string;
  message: string;
  severity: Severity;
  row: ReservationRow;
}

function detectAnomalies(rows: ReservationRow[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const emailMap = new Map<string, string[]>();
  rows.forEach((r) => {
    if (r.guest_email) {
      const key = r.guest_email.toLowerCase();
      if (!emailMap.has(key)) emailMap.set(key, []);
      emailMap.get(key)!.push(r.id);
    }
  });

  rows.forEach((r) => {
    const ref    = r.reference ?? r.id.slice(0, 8).toUpperCase();
    const client = r.guest_name ?? 'Client inconnu';
    const push = (type: string, message: string, severity: Severity) => {
      anomalies.push({ id: `${r.id}-${type}`, reservationId: r.id, reference: ref, client, type, message, severity, row: r });
    };

    if (r.check_in && r.check_out && r.check_out <= r.check_in) {
      push('DATES_INVALIDES', `Départ (${fmt(r.check_out)}) ≤ Arrivée (${fmt(r.check_in)})`, 'error');
    }
    if ((r.total_amount ?? 0) < 0) {
      push('MONTANT_NEGATIF', `Montant total négatif : ${money(r.total_amount)}`, 'error');
    }
    const balance = r.solde ?? ((r.total_amount ?? 0) - (r.paid_amount ?? 0));
    if (balance < -0.5) {
      push('SOLDE_NEGATIF', `Solde négatif : ${money(balance)} — remboursement non documenté ?`, 'warning');
    }
    if (r.status === 'checked_out' && balance > 0.5) {
      push('PAIEMENT_INCOMPLET', `Client parti avec solde dû : ${money(balance)}`, 'error');
    }
    if (!r.guest_name && !r.guest_email) {
      push('CLIENT_MANQUANT', 'Aucune information client (nom ni email)', 'warning');
    }
    if (!r.room_number && !r.room_id) {
      push('CHAMBRE_MANQUANTE', 'Aucune chambre attribuée', 'warning');
    }
    if (r.payment_status === 'overdue') {
      push('PAIEMENT_RETARD', `Paiement en retard · Solde : ${money(balance)}`, 'error');
    }
    const emailIds = emailMap.get((r.guest_email ?? '').toLowerCase()) ?? [];
    if (emailIds.length > 1 && emailIds[0] !== r.id) {
      const others = emailIds.filter((id) => id !== r.id);
      push('DOUBLON_POTENTIEL', `Même email utilisé dans ${others.length} autre(s) réservation(s)`, 'info');
    }
    if ((r.total_amount ?? 0) === 0 && r.status !== 'cancelled') {
      push('MONTANT_ZERO', 'Montant total à 0 € sur réservation active', 'warning');
    }
  });

  return anomalies;
}

const SEVERITY_CFG: Record<Severity, { label: string; color: string; bg: string; ring: string; icon: typeof AlertOctagon }> = {
  error:   { label: 'Erreur',        color: 'text-red-700',   bg: 'bg-red-50',   ring: 'ring-red-200',   icon: XCircle       },
  warning: { label: 'Avertissement', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', icon: AlertTriangle  },
  info:    { label: 'Info',          color: 'text-blue-700',  bg: 'bg-blue-50',  ring: 'ring-blue-200',  icon: AlertTriangle  },
};

export const ResAnomaliesView: React.FC = () => {
  const { data, isLoading, refetch } = useReservations({ limit: 1000 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateStatus = useUpdateReservationStatus();
  const [search, setSearch]       = useState('');
  const [sevFilter, setSevFilter] = useState<Severity | 'ALL'>('ALL');
  const [resolved, setResolved]   = useState<Set<string>>(new Set());
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);

  const allAnomalies = useMemo(() => detectAnomalies(data?.rows ?? []), [data]);

  const filtered = useMemo(() => {
    let list = allAnomalies.filter((a) => !resolved.has(a.id));
    if (sevFilter !== 'ALL') list = list.filter((a) => a.severity === sevFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.reference.toLowerCase().includes(q) ||
          a.client.toLowerCase().includes(q)    ||
          a.message.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allAnomalies, resolved, sevFilter, search]);

  const counts = useMemo(() => ({
    error:   allAnomalies.filter((a) => a.severity === 'error'   && !resolved.has(a.id)).length,
    warning: allAnomalies.filter((a) => a.severity === 'warning' && !resolved.has(a.id)).length,
    info:    allAnomalies.filter((a) => a.severity === 'info'    && !resolved.has(a.id)).length,
  }), [allAnomalies, resolved]);

  function dismiss(id: string) {
    setResolved((prev) => new Set([...prev, id]));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center shrink-0">
              <AlertOctagon size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Anomalies financières</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Détection automatique des incohérences sur les réservations</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Erreurs critiques', value: counts.error,                         color: 'text-red-600',   bg: 'bg-red-50',   alert: counts.error > 0   },
            { label: 'Avertissements',    value: counts.warning,                        color: 'text-amber-600', bg: 'bg-amber-50', alert: counts.warning > 0 },
            { label: 'Informations',      value: counts.info,                           color: 'text-blue-600',  bg: 'bg-blue-50',  alert: false              },
            { label: 'Total détectées',   value: counts.error + counts.warning + counts.info, color: 'text-slate-700', bg: 'bg-slate-50', alert: false },
          ].map((k) => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Référence, client, message…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400"
            />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {(['ALL', 'error', 'warning', 'info'] as const).map((s) => (
              <button key={s} onClick={() => setSevFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  sevFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50',
                )}
              >
                {s === 'ALL' ? 'Toutes' : SEVERITY_CFG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
            <p className="text-[13px] font-medium">Aucune anomalie détectée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((anomaly) => {
              const cfg  = SEVERITY_CFG[anomaly.severity];
              const Icon = cfg.icon;
              return (
                <div
                  key={anomaly.id}
                  className={cn('flex items-start gap-3 px-4 py-3.5 rounded-2xl ring-1 bg-white', cfg.ring)}
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                    <Icon size={13} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Cliquable → fiche réservation */}
                      <button
                        onClick={() => setSelectedRow(anomaly.row)}
                        className="font-mono text-[11.5px] font-semibold text-violet-700 hover:underline underline-offset-2 flex items-center gap-1"
                        title="Ouvrir la fiche réservation"
                      >
                        {anomaly.reference}
                        <ExternalLink size={10} className="opacity-60" />
                      </button>
                      <button
                        onClick={() => setSelectedRow(anomaly.row)}
                        className="text-[11.5px] text-slate-600 hover:text-violet-700 hover:underline underline-offset-2"
                        title="Ouvrir la fiche réservation"
                      >
                        {anomaly.client}
                      </button>
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1', cfg.bg, cfg.ring, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-slate-700 mt-0.5">{anomaly.message}</p>
                    <p className="text-[10.5px] text-slate-400 mt-1">Type : {anomaly.type}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setSelectedRow(anomaly.row)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-600 hover:bg-violet-50 ring-1 ring-violet-200"
                      title="Ouvrir la fiche réservation"
                    >
                      <ExternalLink size={11} /> Fiche
                    </button>
                    <button
                      onClick={() => dismiss(anomaly.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                      title="Ignorer cette anomalie"
                    >
                      <CheckCircle2 size={12} /> Ignorer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fiche réservation */}
      {selectedRow && (
        <ReservationDetailsModal
          isOpen={true}
          reservation={toModalRes(selectedRow)}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
};
