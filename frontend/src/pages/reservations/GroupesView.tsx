/**
 * FLOWTYM — Groupes.
 * Affiche les réservations de groupe, regroupées par préfixe de référence
 * ou par segment. Permet de créer / gérer des dossiers groupes.
 *
 * Clic sur une ligne → fiche réservation complète.
 */
import React, { useMemo, useState } from 'react';
import {
  Users, Plus, Search, ChevronDown, ChevronRight, RefreshCw,
  Download, Calendar, CreditCard, FileText,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useReservations } from '@/src/domains/reservations/hooks';
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

/** Map a Supabase ReservationRow to the shape ReservationDetailsModal expects. */
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

interface Group {
  key: string;
  label: string;
  rows: ReservationRow[];
  totalCA: number;
  totalSolde: number;
  checkIn: string;
  checkOut: string;
}

function buildGroups(rows: ReservationRow[]): Group[] {
  const map = new Map<string, ReservationRow[]>();

  rows.forEach((r) => {
    if ((r.segment ?? '').toLowerCase().includes('group')) {
      const key = r.segment ?? 'groupe';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
      return;
    }
    const ref = r.reference ?? '';
    const match = ref.match(/^(GRP-\d{4}-\d+)/i);
    if (match) {
      const key = match[1];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
      return;
    }
    if ((r.source ?? '').toLowerCase().includes('group')) {
      const key = r.source ?? 'groupe';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
  });

  if (map.size === 0 && rows.length > 0) {
    map.set('toutes', rows);
  }

  return Array.from(map.entries()).map(([key, grpRows]) => {
    const checkIn    = grpRows.map((r) => r.check_in).sort()[0] ?? '';
    const checkOut   = grpRows.map((r) => r.check_out).sort().at(-1) ?? '';
    const totalCA    = grpRows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const totalSolde = grpRows.reduce(
      (s, r) => s + (r.solde ?? Math.max(0, (r.total_amount ?? 0) - (r.paid_amount ?? 0))),
      0,
    );
    return { key, label: key.toUpperCase(), rows: grpRows, totalCA, totalSolde, checkIn, checkOut };
  }).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

const STATUS_COLOR: Record<string, string> = {
  confirmed:   'bg-emerald-100 text-emerald-700',
  checked_in:  'bg-violet-100 text-violet-700',
  pending:     'bg-amber-100 text-amber-700',
  hold:        'bg-blue-100 text-blue-700',
  cancelled:   'bg-red-100 text-red-600',
  checked_out: 'bg-slate-100 text-slate-500',
};

const GroupRow: React.FC<{
  group: Group;
  onRowClick: (r: ReservationRow) => void;
}> = ({ group, onRowClick }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden mb-3">
      {/* Group header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-3.5 bg-white hover:bg-slate-50/60 transition-colors text-left"
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {expanded
            ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          <div className="w-8 h-8 rounded-lg bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <Users size={14} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-900 truncate">{group.label}</p>
            <p className="text-[11px] text-slate-400">
              {fmt(group.checkIn)} → {fmt(group.checkOut)} · {group.rows.length} chambre{group.rows.length > 1 ? 's' : ''}
            </p>
          </div>
        </span>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-slate-400">CA groupe</p>
            <p className="text-[13px] font-bold text-slate-800">{money(group.totalCA)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">Solde dû</p>
            <p className={cn('text-[13px] font-bold', group.totalSolde > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {money(group.totalSolde)}
            </p>
          </div>
        </div>
      </button>

      {/* Détail réservations */}
      {expanded && (
        <div className="border-t border-slate-100">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {['Réf.', 'Client', 'Chambre', 'Arrivée', 'Départ', 'Nuits', 'Montant', 'Statut'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {group.rows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-violet-50/40 transition-colors cursor-pointer group"
                  onClick={() => onRowClick(r)}
                  title="Ouvrir la fiche réservation"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-violet-600 text-[11.5px] group-hover:underline underline-offset-2">
                    {r.reference ?? r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-[140px] truncate">{r.guest_name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700">
                    {r.room_number ?? '—'}{' '}
                    <span className="text-slate-400 font-normal text-[10.5px]">{r.room_type ?? ''}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(r.check_in)}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(r.check_out)}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-center">{r.nights ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{money(r.total_amount)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset',
                      STATUS_COLOR[r.status ?? ''] ?? 'bg-slate-100 text-slate-500 ring-slate-200',
                    )}>
                      {r.status?.replace(/_/g, ' ').toUpperCase() ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Actions groupe */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50">
              <FileText size={12} /> Rooming list
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50">
              <CreditCard size={12} /> Acompte groupe
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50">
              <Download size={12} /> Exporter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const GroupesView: React.FC = () => {
  const { data, isLoading, refetch } = useReservations({ limit: 1000 });
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);

  const groups = useMemo(() => {
    const rows = data?.rows ?? [];
    const filtered = search
      ? rows.filter((r) =>
          (r.guest_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (r.reference ?? '').toLowerCase().includes(search.toLowerCase()),
        )
      : rows;
    return buildGroups(filtered);
  }, [data, search]);

  const totalCA    = useMemo(() => groups.reduce((s, g) => s + g.totalCA, 0), [groups]);
  const totalRooms = useMemo(() => groups.reduce((s, g) => s + g.rows.length, 0), [groups]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Users size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Groupes</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Gestion des réservations de groupe et rooming lists</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={13} /> Actualiser
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[12.5px] font-semibold hover:bg-violet-700 shadow-sm shadow-violet-600/20"
            >
              <Plus size={14} /> Créer un groupe
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Groupes actifs',  value: groups.length.toString(), sub: 'dossiers' },
            { label: 'Chambres totales', value: totalRooms.toString(),   sub: 'nuits de groupe' },
            { label: 'CA groupes',       value: money(totalCA),          sub: 'montant total' },
            { label: 'Ratio groupe', value: isLoading ? '—' : `${Math.round((totalRooms / Math.max(1, data?.total ?? 1)) * 100)}%`, sub: 'du portefeuille' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className="text-[18px] font-bold text-slate-900 mt-0.5">{k.value}</p>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Nom, référence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400"
          />
        </div>

        {/* Groupes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <Users size={32} className="mb-3 opacity-30" />
            <p className="text-[13px] font-medium">Aucun groupe trouvé</p>
            <p className="text-[12px] mt-1">Créez un groupe ou taguez des réservations avec le segment "groupe".</p>
          </div>
        ) : (
          groups.map((g) => (
            <GroupRow key={g.key} group={g} onRowClick={setSelectedRow} />
          ))
        )}
      </div>

      {/* Modal création groupe */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 w-full max-w-md p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-slate-900">Créer un groupe</h2>
            <p className="text-[12.5px] text-slate-500">
              Pour créer un groupe, créez des réservations individuelles avec le préfixe de référence
              <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px]">GRP-YYYY-XXX</code>
              (ex: GRP-2026-001-A, GRP-2026-001-B…) ou assignez le segment{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px]">groupe</code>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl ring-1 ring-slate-200 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

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
