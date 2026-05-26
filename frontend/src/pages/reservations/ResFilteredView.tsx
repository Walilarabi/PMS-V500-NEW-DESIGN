/**
 * FLOWTYM — Vue réservations filtrée par statut(s).
 * Utilisée par : Confirmées, En option (Hold), Pending.
 */
import React, { useMemo, useState } from 'react';
import {
  Search, Download, MoreVertical, CheckCircle2, XCircle,
  Clock, LogIn, Eye, ChevronDown, RefreshCw, Calendar,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useReservations, useUpdateReservationStatus } from '@/src/domains/reservations/hooks';
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { LucideIcon } from 'lucide-react';

// ─── Types & helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:   { label: 'Confirmée',  color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-200' },
  checked_in:  { label: 'Check-in',   color: 'text-violet-700',  bg: 'bg-violet-50 ring-violet-200'  },
  checked_out: { label: 'Check-out',  color: 'text-slate-600',   bg: 'bg-slate-100 ring-slate-200'   },
  cancelled:   { label: 'Annulée',    color: 'text-red-700',     bg: 'bg-red-50 ring-red-200'        },
  pending:     { label: 'En attente', color: 'text-amber-700',   bg: 'bg-amber-50 ring-amber-200'    },
  hold:        { label: 'Option',     color: 'text-blue-700',    bg: 'bg-blue-50 ring-blue-200'      },
};

const PAY_LABEL: Record<string, { label: string; color: string }> = {
  paid:     { label: 'Payé',     color: 'text-emerald-600' },
  partial:  { label: 'Partiel',  color: 'text-amber-600'   },
  pending:  { label: 'En attente', color: 'text-slate-500' },
  overdue:  { label: 'En retard', color: 'text-red-600'    },
  refunded: { label: 'Remboursé', color: 'text-blue-600'   },
};

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

/** Temps restant avant expiration (pour les options Hold). */
function holdCountdown(checkIn: string): string {
  const expire = new Date(checkIn);
  expire.setDate(expire.getDate() - 2); // expiration 48h avant arrivée
  const ms = expire.getTime() - Date.now();
  if (ms <= 0) return 'Expirée';
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h restantes`;
  return `${Math.floor(h / 24)}j ${h % 24}h`;
}

// ─── Action dropdown par ligne ────────────────────────────────────────────────

interface RowActionsProps {
  row: ReservationRow;
  statuses: string[];
  onView: () => void;
}

const RowActions: React.FC<RowActionsProps> = ({ row, statuses, onView }) => {
  const [open, setOpen] = useState(false);
  const updateStatus = useUpdateReservationStatus();

  const isHold      = statuses.includes('hold');
  const isPending   = statuses.includes('pending');
  const isConfirmed = statuses.includes('confirmed');

  function act(status: string) {
    setOpen(false);
    updateStatus.mutate({ id: row.id, status });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl ring-1 ring-slate-200 py-1 w-44 text-[12.5px]">
            <button
              onClick={() => { onView(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
            >
              <Eye size={12} /> Voir le dossier
            </button>
            {(isHold || isPending) && (
              <button
                onClick={() => act('confirmed')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 text-emerald-700"
              >
                <CheckCircle2 size={12} /> Confirmer
              </button>
            )}
            {isHold && (
              <button
                onClick={() => act('cancelled')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-500"
              >
                <XCircle size={12} /> Libérer l'option
              </button>
            )}
            {isConfirmed && (
              <button
                onClick={() => act('checked_in')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-violet-50 text-violet-700"
              >
                <LogIn size={12} /> Check-in
              </button>
            )}
            {isPending && (
              <button
                onClick={() => act('cancelled')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600"
              >
                <XCircle size={12} /> Refuser
              </button>
            )}
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={() => act('cancelled')}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-500"
            >
              <XCircle size={12} /> Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export interface ResFilteredViewProps {
  statuses: string[];
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accentColor?: string;
  emptyMessage?: string;
  showCountdown?: boolean;
}

export const ResFilteredView: React.FC<ResFilteredViewProps> = ({
  statuses,
  title,
  subtitle,
  icon: Icon,
  accentColor = '#8B5CF6',
  emptyMessage = 'Aucune réservation dans cette catégorie.',
  showCountdown = false,
}) => {
  const { data, isLoading, refetch } = useReservations({ status: statuses, limit: 500 });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = data?.rows ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.guest_name ?? '').toLowerCase().includes(q) ||
          (r.reference ?? '').toLowerCase().includes(q) ||
          (r.room_number ?? '').toLowerCase().includes(q) ||
          (r.guest_email ?? '').toLowerCase().includes(q),
      );
    }
    if (dateFrom) list = list.filter((r) => r.check_in >= dateFrom);
    if (dateTo)   list = list.filter((r) => r.check_out <= dateTo);
    return list;
  }, [data, search, dateFrom, dateTo]);

  const totalCA = useMemo(
    () => rows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    [rows],
  );
  const totalSolde = useMemo(
    () => rows.reduce((s, r) => s + (r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0))), 0),
    [rows],
  );

  const selectedRow = useMemo(
    () => (data?.rows ?? []).find((r) => r.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}15` }}
            >
              <Icon size={20} style={{ color: accentColor }} />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{title}</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={13} /> Actualiser
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
              <Download size={13} /> Exporter
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: isLoading ? '…' : rows.length.toString(), sub: 'dossiers' },
            { label: 'Arrivées', value: isLoading ? '…' : rows.filter((r) => r.check_in >= new Date().toISOString().slice(0, 10)).length.toString(), sub: 'à venir' },
            { label: 'CA total', value: isLoading ? '…' : money(totalCA), sub: 'montant brut' },
            { label: 'Solde dû', value: isLoading ? '…' : money(totalSolde), sub: 'à encaisser', alert: totalSolde > 0 },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{kpi.label}</p>
              <p className={cn('text-[18px] font-bold mt-0.5 leading-tight', kpi.alert ? 'text-red-600' : 'text-slate-900')}>
                {kpi.value}
              </p>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Référence, client, chambre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400"
            />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl px-3 py-2">
            <Calendar size={13} className="text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-[12.5px] bg-transparent outline-none text-slate-700 w-32"
            />
            <span className="text-slate-300 mx-1">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-[12.5px] bg-transparent outline-none text-slate-700 w-32"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-[13px]">
              <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Icon size={32} className="mb-3 opacity-30" />
              <p className="text-[13px] font-medium">{emptyMessage}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Référence', 'Client', 'Arrivée', 'Départ', 'Nuits', 'Chambre', 'Montant', 'Solde', 'Statut paiement', showCountdown ? 'Expiration' : 'Source', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const stCfg = STATUS_LABEL[row.status ?? ''] ?? { label: row.status ?? '—', color: 'text-slate-600', bg: 'bg-slate-100 ring-slate-200' };
                    const payCfg = PAY_LABEL[row.payment_status ?? ''] ?? { label: row.payment_status ?? '—', color: 'text-slate-500' };
                    const balance = row.solde ?? Math.max(0, (row.total_amount ?? 0) - (row.paid_amount ?? 0));

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-violet-700">
                          {row.reference ?? row.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 truncate max-w-[160px]">{row.guest_name ?? '—'}</p>
                          <p className="text-[10.5px] text-slate-400 truncate max-w-[160px]">{row.guest_email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmt(row.check_in)}</td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmt(row.check_out)}</td>
                        <td className="px-4 py-3 text-slate-500 text-center">{row.nights ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-700">{row.room_number ?? '—'}</span>
                          <span className="text-slate-400 ml-1 text-[10.5px]">{row.room_type ?? ''}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{money(row.total_amount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('font-semibold', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                            {money(balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] font-semibold', payCfg.color)}>
                            {payCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {showCountdown ? (
                            <span className={cn(
                              'text-[11px] font-semibold',
                              holdCountdown(row.check_in).includes('Expir') ? 'text-red-600' :
                              holdCountdown(row.check_in).includes('h') && !holdCountdown(row.check_in).includes('j') ? 'text-amber-600' :
                              'text-slate-500',
                            )}>
                              {holdCountdown(row.check_in)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">{(row.source ?? 'Direct').toUpperCase()}</span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <RowActions row={row} statuses={statuses} onView={() => setSelectedId(row.id)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {!isLoading && rows.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400">
              {rows.length} résultat{rows.length > 1 ? 's' : ''} · CA {money(totalCA)} · Solde {money(totalSolde)}
            </div>
          )}
        </div>
      </div>

      {/* Détail modal */}
      {selectedId && selectedRow && (
        <ReservationDetailsModal
          reservation={selectedRow as any}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
};
