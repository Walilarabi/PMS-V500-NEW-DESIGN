/**
 * FLOWTYM — Paiements sécurisés.
 * Suivi des pré-autorisations, captures et garanties carte sur les réservations.
 * Alerte sur les arrivées sans garantie de paiement.
 */
import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, RefreshCw, Search, AlertCircle, CheckCircle2,
  Clock, CreditCard, XCircle, Download,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useReservations } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function money(v: number | null | undefined) {
  return typeof v === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
    : '—';
}
function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

// ─── Secure payment status derivation ────────────────────────────────────────

type SecureStatus = 'guaranteed' | 'partial' | 'at_risk' | 'unpaid_arrival' | 'cleared';

function deriveSecureStatus(r: ReservationRow): SecureStatus {
  if (r.status === 'checked_out' || r.status === 'cancelled') return 'cleared';
  if (r.payment_status === 'paid') return 'guaranteed';
  if (r.payment_status === 'partial') {
    const days = daysUntil(r.check_in);
    if (days !== null && days <= 3) return 'at_risk';
    return 'partial';
  }
  const days = daysUntil(r.check_in);
  if (days !== null && days <= 1 && r.status === 'confirmed') return 'unpaid_arrival';
  return 'at_risk';
}

const SECURE_CFG: Record<SecureStatus, { label: string; color: string; bg: string; ring: string; icon: typeof CreditCard }> = {
  guaranteed:    { label: 'Garanti',         color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', icon: CheckCircle2 },
  partial:       { label: 'Partiel',         color: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200',   icon: Clock        },
  at_risk:       { label: 'À risque',        color: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200',     icon: AlertCircle  },
  unpaid_arrival:{ label: 'Arrivée non payée',color:'text-red-900',     bg: 'bg-red-100',     ring: 'ring-red-300',     icon: XCircle      },
  cleared:       { label: 'Soldé',           color: 'text-slate-500',   bg: 'bg-slate-100',   ring: 'ring-slate-200',   icon: CheckCircle2 },
};

// ─── Main View ───────────────────────────────────────────────────────────────

const FILTER_OPTIONS: (SecureStatus | 'ALL')[] = ['ALL', 'at_risk', 'unpaid_arrival', 'partial', 'guaranteed'];

export const PaiementsSecurisesView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<SecureStatus | 'ALL'>('ALL');
  const [search, setSearch]             = useState('');

  const { data, isLoading, refetch } = useReservations({
    status: ['confirmed', 'checked_in', 'pending', 'hold'],
    limit: 500,
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const enriched = useMemo(() =>
    rows.map(r => ({ ...r, secureStatus: deriveSecureStatus(r), balance: r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0)) })),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (statusFilter !== 'ALL') list = list.filter(r => r.secureStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.guest_name ?? '').toLowerCase().includes(q) ||
        (r.reference ?? '').toLowerCase().includes(q) ||
        (r.room_number ?? '').toLowerCase().includes(q)
      );
    }
    // Sort: unpaid_arrival first, then at_risk, then partial, then guaranteed/cleared
    const ORDER: SecureStatus[] = ['unpaid_arrival','at_risk','partial','guaranteed','cleared'];
    return [...list].sort((a, b) => ORDER.indexOf(a.secureStatus) - ORDER.indexOf(b.secureStatus));
  }, [enriched, statusFilter, search]);

  const kpis = useMemo(() => ({
    atRisk:         enriched.filter(r => r.secureStatus === 'at_risk').length,
    unpaidArrivals: enriched.filter(r => r.secureStatus === 'unpaid_arrival').length,
    partial:        enriched.filter(r => r.secureStatus === 'partial').length,
    guaranteed:     enriched.filter(r => r.secureStatus === 'guaranteed').length,
    totalExposed:   enriched.filter(r => ['at_risk','unpaid_arrival'].includes(r.secureStatus)).reduce((s, r) => s + r.balance, 0),
  }), [enriched]);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-violet-600" /> Paiements sécurisés
          </h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Garanties & pré-autorisations — arrivées sans couverture</p>
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
          { label: 'Arrivées non payées', value: kpis.unpaidArrivals, color: 'text-red-700',    alert: kpis.unpaidArrivals > 0 },
          { label: 'À risque',            value: kpis.atRisk,         color: 'text-red-600',    alert: kpis.atRisk > 0         },
          { label: 'Partiel',             value: kpis.partial,        color: 'text-amber-600',  alert: false                   },
          { label: 'Garantis',            value: kpis.guaranteed,     color: 'text-emerald-600',alert: false                   },
          { label: 'Montant exposé',      value: money(kpis.totalExposed), color: 'text-red-700', alert: kpis.totalExposed > 0 },
        ].map(k => (
          <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
            <p className={cn('text-[18px] font-bold mt-0.5', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Client, référence, chambre…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
        </div>
        <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1 flex-wrap">
          {FILTER_OPTIONS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
              {s === 'ALL' ? 'Tous' : SECURE_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShieldCheck size={28} className="mb-2 text-emerald-400 opacity-70" />
            <p className="text-[12.5px] font-medium">Aucune réservation à risque</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Réservation', 'Client', 'Chambre', 'Arrivée', 'Départ', 'Montant', 'Solde dû', 'Canal', 'Garantie'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(row => {
                  const cfg = SECURE_CFG[row.secureStatus];
                  const SIcon = cfg.icon;
                  const days = daysUntil(row.check_in);
                  return (
                    <tr key={row.id} className={cn('hover:bg-slate-50/60 transition-colors', row.secureStatus === 'unpaid_arrival' && 'bg-red-50/30')}>
                      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-violet-700">
                        {row.reference ?? row.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.guest_name ?? '—'}</p>
                        <p className="text-[10.5px] text-slate-400">{row.guest_email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.room_number ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span>{fmtDate(row.check_in)}</span>
                        {days !== null && days >= 0 && days <= 7 && (
                          <span className={cn('ml-1 text-[10px] font-semibold', days <= 1 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-slate-400')}>
                            J{days > 0 ? `-${days}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(row.check_out)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{money(row.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-semibold', row.balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {money(row.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {(row.source ?? 'DIRECT').toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
                          <SIcon size={10} /> {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};
