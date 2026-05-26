/**
 * FLOWTYM — Suivi des paiements réservations.
 */
import React, { useMemo, useState } from 'react';
import {
  CreditCard, Search, RefreshCw, Download, TrendingUp,
  AlertCircle, CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useReservations } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

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

const PAY_CFG: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
  paid:     { label: 'Payé',        color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-200', icon: CheckCircle2 },
  partial:  { label: 'Partiel',     color: 'text-amber-700',   bg: 'bg-amber-50 ring-amber-200',     icon: Clock        },
  pending:  { label: 'En attente',  color: 'text-slate-600',   bg: 'bg-slate-100 ring-slate-200',    icon: Clock        },
  overdue:  { label: 'En retard',   color: 'text-red-700',     bg: 'bg-red-50 ring-red-200',         icon: AlertCircle  },
  refunded: { label: 'Remboursé',   color: 'text-blue-700',    bg: 'bg-blue-50 ring-blue-200',       icon: RefreshCw    },
};

const ALL_PAY_STATUSES = ['paid', 'partial', 'pending', 'overdue', 'refunded'];

export const ResPaymentsView: React.FC = () => {
  const { data, isLoading, refetch } = useReservations({ limit: 1000 });
  const [search, setSearch]       = useState('');
  const [payFilter, setPayFilter] = useState('ALL');

  const rows = useMemo(() => {
    let list = data?.rows ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.guest_name ?? '').toLowerCase().includes(q) ||
          (r.reference ?? '').toLowerCase().includes(q),
      );
    }
    if (payFilter !== 'ALL') list = list.filter((r) => r.payment_status === payFilter);
    return list;
  }, [data, search, payFilter]);

  const stats = useMemo(() => {
    const all = data?.rows ?? [];
    return {
      totalCA:    all.reduce((s, r) => s + (r.total_amount ?? 0), 0),
      totalPaid:  all.reduce((s, r) => s + (r.paid_amount ?? 0), 0),
      totalSolde: all.reduce((s, r) => s + (r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0))), 0),
      overdue:    all.filter((r) => r.payment_status === 'overdue').length,
      pending:    all.filter((r) => r.payment_status === 'pending').length,
    };
  }, [data]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Suivi des paiements</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">État des règlements pour toutes les réservations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw size={13} /> Actualiser
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
              <Download size={13} /> Exporter
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'CA total',   value: money(stats.totalCA),    icon: TrendingUp,  color: 'text-violet-600',  bg: 'bg-violet-50' },
            { label: 'Encaissé',   value: money(stats.totalPaid),  icon: CheckCircle2,color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Solde dû',   value: money(stats.totalSolde), icon: CreditCard,  color: 'text-red-600',     bg: 'bg-red-50',    alert: stats.totalSolde > 0 },
            { label: 'En retard',  value: stats.overdue.toString(),icon: AlertCircle, color: 'text-red-600',     bg: 'bg-red-50',    alert: stats.overdue > 0 },
            { label: 'En attente', value: stats.pending.toString(),icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50',  alert: stats.pending > 0 },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', k.bg)}>
                    <Icon size={12} className={k.color} />
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
                </div>
                <p className={cn('text-[16px] font-bold', k.alert ? 'text-red-600' : 'text-slate-900')}>{k.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Référence, client…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400"
            />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {['ALL', ...ALL_PAY_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setPayFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  payFilter === s
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50',
                )}
              >
                {s === 'ALL' ? 'Tous' : PAY_CFG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <CreditCard size={32} className="mb-3 opacity-30" />
              <p className="text-[13px] font-medium">Aucun paiement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Référence', 'Client', 'Chambre', 'Séjour', 'Montant total', 'Encaissé', 'Solde', 'Statut paiement', 'Canal'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const balance = row.solde ?? Math.max(0, (row.total_amount ?? 0) - (row.paid_amount ?? 0));
                    const payCfg = PAY_CFG[row.payment_status ?? ''] ?? PAY_CFG.pending;
                    const PayIcon = payCfg.icon;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-violet-700">
                          {row.reference ?? row.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 truncate max-w-[140px]">{row.guest_name ?? '—'}</p>
                          <p className="text-[10.5px] text-slate-400 truncate">{row.guest_email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.room_number ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {fmt(row.check_in)} → {fmt(row.check_out)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{money(row.total_amount)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{money(row.paid_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('font-semibold', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                            {money(balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold', payCfg.bg, payCfg.color)}>
                            <PayIcon size={10} />
                            {payCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                          {(row.source ?? 'DIRECT').toUpperCase()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && rows.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400">
              {rows.length} résultat{rows.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
