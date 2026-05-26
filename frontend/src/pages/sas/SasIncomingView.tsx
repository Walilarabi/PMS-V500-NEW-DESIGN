/**
 * FLOWTYM — SAS Réservations entrantes OTA.
 * Flux en temps réel des réservations reçues via canaux OTA.
 */
import React, { useState, useMemo } from 'react';
import {
  Inbox, RefreshCw, Search, CheckCircle2, AlertTriangle, Clock,
  ChevronDown, Eye, Filter,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useSasIncoming, useUpdateIncomingStatus, useSasPartners } from '@/src/domains/sas/hooks';
import type { SasIncomingRow, RieStatus } from '@/src/domains/sas/schemas';

// ─── Config ──────────────────────────────────────────────────────────────────

const RIE_CFG: Record<RieStatus, { label: string; color: string; bg: string; ring: string; icon: typeof Clock }> = {
  pending:       { label: 'En attente',   color: 'text-slate-600',   bg: 'bg-slate-100',   ring: 'ring-slate-200',   icon: Clock        },
  validating:    { label: 'Validation',   color: 'text-blue-700',    bg: 'bg-blue-50',     ring: 'ring-blue-200',    icon: RefreshCw    },
  approved:      { label: 'Approuvé',     color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', icon: CheckCircle2 },
  warning:       { label: 'Avertissement',color: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200',   icon: AlertTriangle},
  manual_review: { label: 'Révision',     color: 'text-violet-700',  bg: 'bg-violet-50',   ring: 'ring-violet-200',  icon: Eye          },
  quarantined:   { label: 'Quarantaine',  color: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200',     icon: AlertTriangle},
  rejected:      { label: 'Rejeté',       color: 'text-red-800',     bg: 'bg-red-100',     ring: 'ring-red-300',     icon: AlertTriangle},
};

const ALL_STATUSES: RieStatus[] = ['pending','validating','approved','warning','manual_review','quarantined','rejected'];

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fmtDatetime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function money(v: number | null | undefined, currency = 'EUR') {
  return typeof v === 'number'
    ? new Intl.NumberFormat('fr-FR', { style:'currency', currency: currency ?? 'EUR' }).format(v)
    : '—';
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ row, onClose, onApprove, onQuarantine }: {
  row: SasIncomingRow;
  onClose: () => void;
  onApprove: (id: string) => void;
  onQuarantine: (id: string) => void;
}) {
  const cfg = RIE_CFG[row.rie_status];
  const Icon = cfg.icon;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Réservation OTA</p>
            <p className="text-[15px] font-bold text-slate-900">{row.ota_reference}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 text-[12px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
            <Icon size={12} /> {cfg.label}
            {typeof row.rie_score === 'number' && <span className="ml-1 opacity-60">Score: {Math.round(row.rie_score)}</span>}
          </div>
          {/* Guest */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Client</p>
            <p className="text-[13px] font-semibold text-slate-800">{row.guest_name ?? '—'}</p>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
              <div><span className="text-slate-400">Arrivée : </span>{fmtDate(row.check_in)}</div>
              <div><span className="text-slate-400">Départ : </span>{fmtDate(row.check_out)}</div>
              <div><span className="text-slate-400">Adultes : </span>{row.adults ?? '—'}</div>
              <div><span className="text-slate-400">Enfants : </span>{row.children ?? '—'}</div>
              <div><span className="text-slate-400">Type chambre : </span>{row.room_type ?? '—'}</div>
            </div>
          </div>
          {/* Financier */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Financier</p>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
              <div><span className="text-slate-400">Montant OTA : </span><span className="font-semibold text-slate-800">{money(row.ota_amount, row.ota_currency ?? 'EUR')}</span></div>
              <div><span className="text-slate-400">Commission : </span><span className="font-semibold">{money(row.ota_commission)}</span></div>
              <div><span className="text-slate-400">Mode paiement : </span>{row.collection_type ?? '—'}</div>
            </div>
          </div>
          {/* Dates */}
          <div className="text-[11px] text-slate-400">
            <p>Reçu : {fmtDatetime(row.received_at)}</p>
            {row.processed_at && <p>Traité : {fmtDatetime(row.processed_at)}</p>}
          </div>
          {/* Actions */}
          {(row.rie_status === 'pending' || row.rie_status === 'warning' || row.rie_status === 'manual_review') && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => { onApprove(row.id); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700">
                Approuver
              </button>
              <button onClick={() => { onQuarantine(row.id); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-xl ring-1 ring-red-200 text-red-700 text-[13px] font-semibold hover:bg-red-50">
                Quarantaine
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const SasIncomingView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<RieStatus | 'ALL'>('ALL');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState<SasIncomingRow | null>(null);

  const { data: incoming, isLoading, refetch } = useSasIncoming({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    limit: 500,
  });
  const rows = incoming && !Array.isArray(incoming) ? incoming.rows : (Array.isArray(incoming) ? incoming : []);
  const updateStatus = useUpdateIncomingStatus();
  const { data: partners = [] } = useSasPartners();

  const partnerMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of partners) m[p.id] = p.name;
    return m;
  }, [partners]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.ota_reference.toLowerCase().includes(q) ||
      (r.guest_name ?? '').toLowerCase().includes(q) ||
      (r.partner_id ? (partnerMap[r.partner_id] ?? '').toLowerCase().includes(q) : false)
    );
  }, [rows, search, partnerMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    for (const s of ALL_STATUSES) c[s] = rows.filter(r => r.rie_status === s).length;
    return c;
  }, [rows]);

  const kpis = useMemo(() => ({
    pending:     rows.filter(r => r.rie_status === 'pending').length,
    approved:    rows.filter(r => r.rie_status === 'approved').length,
    issues:      rows.filter(r => ['warning','manual_review','quarantined','rejected'].includes(r.rie_status)).length,
    total:       rows.length,
  }), [rows]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 ring-1 ring-blue-100 flex items-center justify-center shrink-0">
              <Inbox size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Réservations entrantes OTA</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Flux en temps réel — validation RIE automatique</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total reçues',   value: kpis.total,    color: 'text-slate-700'   },
            { label: 'En attente',     value: kpis.pending,  color: 'text-amber-600',  alert: kpis.pending > 0 },
            { label: 'Approuvées',     value: kpis.approved, color: 'text-emerald-600' },
            { label: 'Anomalies',      value: kpis.issues,   color: 'text-red-600',    alert: kpis.issues > 0  },
          ].map(k => (
            <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Référence OTA, client, partenaire…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1 flex-wrap">
            <button onClick={() => setStatusFilter('ALL')}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', statusFilter === 'ALL' ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
              Tous ({counts.ALL})
            </button>
            {(['pending','approved','warning','manual_review','quarantined'] as RieStatus[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all', statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {RIE_CFG[s].label} {counts[s] > 0 && `(${counts[s]})`}
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Inbox size={32} className="mb-3 opacity-30" />
              <p className="text-[13px] font-medium">Aucune réservation entrante</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Référence OTA', 'Partenaire', 'Client', 'Séjour', 'Montant', 'RIE Score', 'Statut', 'Reçu le'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(row => {
                    const cfg = RIE_CFG[row.rie_status];
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setSelected(row)}>
                        <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-violet-700">{row.ota_reference}</td>
                        <td className="px-4 py-3 text-slate-600">{row.partner_id ? (partnerMap[row.partner_id] ?? row.partner_id.slice(0,8)) : '—'}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.guest_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {fmtDate(row.check_in)} → {fmtDate(row.check_out)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{money(row.ota_amount, row.ota_currency ?? 'EUR')}</td>
                        <td className="px-4 py-3">
                          {typeof row.rie_score === 'number' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className={cn('h-full rounded-full', row.rie_score >= 80 ? 'bg-emerald-400' : row.rie_score >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                                  style={{ width: `${Math.min(100, row.rie_score)}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600">{Math.round(row.rie_score)}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold', cfg.bg, cfg.ring, cfg.color)}>
                            <StatusIcon size={10} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">{fmtDatetime(row.received_at)}</td>
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

      {selected && (
        <DetailPanel
          row={selected}
          onClose={() => setSelected(null)}
          onApprove={id => updateStatus.mutate({ id, status: 'approved' })}
          onQuarantine={id => updateStatus.mutate({ id, status: 'quarantined' })}
        />
      )}
    </div>
  );
};
