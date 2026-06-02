/**
 * FLOWTYM — Relances réservations.
 * Regroupe les réservations nécessitant une action de relance :
 * options expirant, paiements en attente/retard, pending sans réponse.
 *
 * Clic sur la carte (référence / client) → fiche réservation complète.
 */
import React, { useMemo, useState } from 'react';
import {
  Send, RefreshCw, Search, Clock, AlertCircle, CheckCircle2,
  Mail, Phone, ExternalLink,
} from 'lucide-react';
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
    guestId:     r.guest_id ?? undefined,
    reservationUuid: r.id,
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

type RelanceType = 'option_expire' | 'paiement_retard' | 'pending_sans_reponse' | 'acompte_manquant';

interface RelanceItem {
  id: string;
  row: ReservationRow;
  type: RelanceType;
  urgency: 'high' | 'medium' | 'low';
  reason: string;
  action: string;
}

const RELANCE_CFG: Record<RelanceType, { label: string; color: string; bg: string; ring: string }> = {
  option_expire:        { label: 'Option expirant',      color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200' },
  paiement_retard:      { label: 'Paiement en retard',   color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200'    },
  pending_sans_reponse: { label: 'En attente de réponse', color: 'text-amber-700', bg: 'bg-amber-50',  ring: 'ring-amber-200'  },
  acompte_manquant:     { label: 'Acompte manquant',     color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200' },
};

function buildRelances(rows: ReservationRow[]): RelanceItem[] {
  const now   = new Date();
  const items: RelanceItem[] = [];

  rows.forEach((r) => {
    if (r.status === 'cancelled' || r.status === 'checked_out') return;

    const checkIn       = new Date(r.check_in);
    const msToArrival   = checkIn.getTime() - now.getTime();
    const daysToArrival = msToArrival / 86_400_000;
    const balance       = r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0));

    if (r.status === 'hold' && daysToArrival <= 2) {
      items.push({
        id: `${r.id}-hold`, row: r, type: 'option_expire',
        urgency: daysToArrival <= 1 ? 'high' : 'medium',
        reason: daysToArrival <= 0 ? 'Option expirée' : `Expiration dans ${Math.round(daysToArrival * 24)}h`,
        action: 'Confirmer ou libérer',
      });
    }

    if (r.payment_status === 'overdue' && balance > 0) {
      items.push({
        id: `${r.id}-overdue`, row: r, type: 'paiement_retard',
        urgency: 'high',
        reason: `Solde en retard : ${money(balance)}`,
        action: 'Envoyer rappel paiement',
      });
    }

    if (r.status === 'pending') {
      const createdAt       = new Date(r.created_at ?? now);
      const hoursSinceCreate = (now.getTime() - createdAt.getTime()) / 3_600_000;
      if (hoursSinceCreate >= 24) {
        items.push({
          id: `${r.id}-pending`, row: r, type: 'pending_sans_reponse',
          urgency: hoursSinceCreate >= 48 ? 'high' : 'medium',
          reason: `En attente depuis ${Math.round(hoursSinceCreate)}h`,
          action: 'Confirmer ou refuser',
        });
      }
    }

    if (r.status === 'confirmed' && r.payment_status === 'pending' && balance > 0 && daysToArrival <= 7 && daysToArrival > 0) {
      items.push({
        id: `${r.id}-acompte`, row: r, type: 'acompte_manquant',
        urgency: daysToArrival <= 3 ? 'high' : 'medium',
        reason: `Arrivée dans ${Math.round(daysToArrival)}j · Solde : ${money(balance)}`,
        action: 'Demander acompte',
      });
    }
  });

  const order = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => {
    if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
    return (a.row.check_in ?? '').localeCompare(b.row.check_in ?? '');
  });
}

const URGENCY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-blue-500',
};

export const ResRelancesView: React.FC = () => {
  const { data, isLoading, refetch } = useReservations({ limit: 1000 });
  const updateStatus = useUpdateReservationStatus();
  const [search, setSearch]         = useState('');
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);

  const relances = useMemo(() => buildRelances(data?.rows ?? []), [data]);
  const filtered = useMemo(() => {
    let list = relances.filter((r) => !dismissed.has(r.id));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.row.guest_name ?? '').toLowerCase().includes(q) ||
          (r.row.reference  ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [relances, dismissed, search]);

  const counts = useMemo(() => ({
    high:   filtered.filter((r) => r.urgency === 'high').length,
    medium: filtered.filter((r) => r.urgency === 'medium').length,
    total:  filtered.length,
  }), [filtered]);

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  function confirmItem(item: RelanceItem) {
    if (item.type === 'option_expire' || item.type === 'pending_sans_reponse') {
      updateStatus.mutate({ id: item.row.id, status: 'confirmed' });
    }
    dismiss(item.id);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center shrink-0">
              <Send size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Relances</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Actions requises sur les réservations en attente</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total à traiter', value: counts.total,   color: 'text-slate-900',   alert: false               },
            { label: 'Urgentes',        value: counts.high,    color: 'text-red-600',     alert: counts.high > 0     },
            { label: 'Moyennes',        value: counts.medium,  color: 'text-amber-600',   alert: false               },
            { label: 'Traitées',        value: dismissed.size, color: 'text-emerald-600', alert: false               },
          ].map((k) => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Client, référence…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400"
          />
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <CheckCircle2 size={32} className="mb-3 text-emerald-400 opacity-70" />
            <p className="text-[13px] font-medium">Aucune relance à traiter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const cfg     = RELANCE_CFG[item.type];
              const balance = item.row.solde ?? Math.max(0, (item.row.total_amount ?? 0) - (item.row.paid_amount ?? 0));

              return (
                <div key={item.id} className={cn('bg-white rounded-2xl ring-1 px-5 py-4 flex items-start gap-4', cfg.ring)}>
                  {/* Dot urgence */}
                  <div className="flex flex-col items-center gap-1 pt-1.5 shrink-0">
                    <div className={cn('w-2.5 h-2.5 rounded-full', URGENCY_DOT[item.urgency])} />
                  </div>

                  {/* Contenu — cliquable pour ouvrir la fiche */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setSelectedRow(item.row)}
                    title="Ouvrir la fiche réservation"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ring-1', cfg.bg, cfg.ring, cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="font-mono text-[11.5px] font-semibold text-violet-700 hover:underline underline-offset-2 flex items-center gap-1">
                        {item.row.reference ?? item.row.id.slice(0, 8).toUpperCase()}
                        <ExternalLink size={10} className="opacity-50" />
                      </span>
                      <span className="text-[12px] text-slate-700 font-medium">{item.row.guest_name ?? 'Client inconnu'}</span>
                    </div>
                    <p className="text-[12.5px] text-slate-700 font-medium">{item.reason}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      {item.row.check_in  && <span><Clock size={10} className="inline mr-0.5" />Arrivée {fmt(item.row.check_in)}</span>}
                      {item.row.room_number && <span>Chambre {item.row.room_number}</span>}
                      {balance > 0 && <span className="text-red-500 font-semibold">Solde {money(balance)}</span>}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {item.row.guest_email && (
                      <button
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-600 hover:bg-slate-50"
                        title="Envoyer email"
                      >
                        <Mail size={12} />
                      </button>
                    )}
                    {item.row.guest_phone && (
                      <button
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-600 hover:bg-slate-50"
                        title="Appeler"
                      >
                        <Phone size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRow(item.row)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg ring-1 ring-violet-200 text-[11px] font-medium text-violet-600 hover:bg-violet-50"
                      title="Ouvrir la fiche réservation"
                    >
                      <ExternalLink size={11} /> Fiche
                    </button>
                    {(item.type === 'option_expire' || item.type === 'pending_sans_reponse') && (
                      <button
                        onClick={() => confirmItem(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11.5px] font-semibold hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={12} /> Confirmer
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(item.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-500 hover:bg-slate-50"
                    >
                      Ignorer
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
