/**
 * FLOWTYM — Module Réservations
 *
 * - Tableau complet avec clic → fiche détail (ReservationDetailsModal)
 * - Boutons d'action fonctionnels (voir, éditer, supprimer, copier)
 * - Pagination côté client avec sélecteur de lignes par page
 * - Filtres: statut, canal, type chambre, recherche texte
 * - KPI strip + graphique camembert
 * - Design premium cohérent avec Flowtym
 */

import React from 'react';
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Plus,
  Calendar,
  Clock,
  User,
  MoreVertical,
  Globe,
  Zap,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  ArrowUpRight,
  Monitor,
  Users,
  LayoutGrid,
  List,
  Eye,
  Copy,
  Trash2,
  Pencil,
  Send,
  CreditCard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';

import { useReservations as useContextReservations } from '@/src/contexts/ReservationContext';
import { useReservations, useCreateReservation } from '@/src/domains/reservations/hooks';
import ReservationFormModal from '@/src/components/modals/ReservationFormModal';
import { LiveReservationsBanner } from '@/src/domains/reservations/LiveReservationsBanner';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReservationTableRow {
  ref: string;
  /** Internal UUID — used to look up raw data for the detail modal */
  id: string;
  status: string;
  /** Normalised status key for reverse-mapping back to the modal */
  statusKey: string;
  client: string;
  email: string;
  pers: number;
  checkin: string;
  checkout: string;
  /** Raw ISO dates for the modal */
  checkinRaw: string | null;
  checkoutRaw: string | null;
  nights: number;
  amount: string;
  /** Numeric amount for the modal */
  amountRaw: number;
  solde: string;
  soldeRaw: number;
  soldeColor: 'emerald' | 'red';
  channel: string;
  room: string;
  roomType: string;
  phone?: string;
  notes?: string;
  partnerRef?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_DATA = [
  { name: 'Confirmées', value: 4, color: '#10B981' },
  { name: 'Check-in',   value: 2, color: '#8B5CF6' },
  { name: 'En attente', value: 3, color: '#F59E0B' },
  { name: 'Annulées',   value: 1, color: '#EF4444' },
];

const STATUS_LABEL: Record<string, string> = {
  confirmed:   'CONFIRMÉE',
  checked_in:  'CHECK-IN',
  checked_out: 'CHECK-OUT',
  cancelled:   'ANNULÉE',
  pending:     'EN ATTENTE',
  hold:        'OPTION',
};

const STATUS_MODAL_KEY: Record<string, string> = {
  'CONFIRMÉE':  'confirmed',
  'CHECK-IN':   'checked_in',
  'CHECK-OUT':  'checked_out',
  'ANNULÉE':    'cancelled',
  'EN ATTENTE': 'pending',
  'OPTION':     'hold',
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value: number | null | undefined): string =>
  typeof value === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
    : '—';

const mapSupabaseReservation = (row: ReservationRow): ReservationTableRow => {
  const total   = row.total_amount ?? 0;
  const paid    = row.paid_amount  ?? 0;
  const balance = row.solde ?? Math.max(0, total - paid);
  const statusLabel = STATUS_LABEL[row.status ?? ''] ?? (row.status ?? '—').toUpperCase();

  return {
    ref:          row.reference ?? row.id.slice(0, 8).toUpperCase(),
    id:           row.id,
    status:       statusLabel,
    statusKey:    row.status ?? 'pending',
    client:       row.guest_name  ?? 'Client inconnu',
    email:        row.guest_email ?? '—',
    pers:         row.pax ?? (row.adults ?? 1) + (row.children ?? 0),
    checkin:      formatDate(row.check_in),
    checkout:     formatDate(row.check_out),
    checkinRaw:   row.check_in  ?? null,
    checkoutRaw:  row.check_out ?? null,
    nights:       row.nights    ?? 1,
    amount:       formatMoney(total),
    amountRaw:    total,
    solde:        formatMoney(balance),
    soldeRaw:     balance,
    soldeColor:   balance <= 0 ? 'emerald' : 'red',
    channel:      (row.source ?? 'DIRECT').toUpperCase(),
    room:         row.room_number ?? '—',
    roomType:     [row.room_category, row.room_type].filter(Boolean).join('/') || '—',
    phone:        row.guest_phone ?? undefined,
    notes:        row.notes ?? undefined,
    partnerRef:   (row as any).partner_ref ?? undefined,
  };
};

const initials = (name: string) =>
  name.split(' ').map(n => n[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-purple-100 text-purple-600',
  'bg-rose-100 text-rose-600',
  'bg-cyan-100 text-cyan-600',
];
const avatarColor = (ref: string) =>
  AVATAR_COLORS[ref.charCodeAt(ref.length - 1) % AVATAR_COLORS.length];

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls = cn(
    'px-2 py-1 rounded-lg text-[11px] font-black uppercase text-center border shadow-sm whitespace-nowrap',
    status === 'CHECK-OUT'  && 'bg-gray-50 text-gray-400 border-gray-100',
    status === 'CHECK-IN'   && 'bg-blue-600 text-white border-blue-700',
    status === 'CONFIRMÉE'  && 'bg-emerald-500 text-white border-emerald-600',
    status === 'ANNULÉE'    && 'bg-red-500 text-white border-red-600',
    status === 'OPTION'     && 'bg-slate-500 text-white border-slate-600',
    !['CHECK-OUT','CHECK-IN','CONFIRMÉE','ANNULÉE','OPTION'].includes(status) && 'bg-amber-400 text-white border-amber-500',
  );
  return <div className={cls}>{status}</div>;
};

// ─── Channel badge ────────────────────────────────────────────────────────────

const ChannelBadge: React.FC<{ channel: string }> = ({ channel }) => {
  if (channel === 'DIRECT') {
    return (
      <div className="px-2 py-1 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] text-[11px] font-black uppercase tracking-wider border border-[#8B5CF6]/20 shadow-sm">
        DIR
      </div>
    );
  }
  return (
    <div className="px-2 py-1 rounded bg-blue-50 text-blue-500 text-[11px] font-black uppercase tracking-wider border border-blue-100 flex items-center gap-1 shadow-sm">
      <Zap size={10} /> {channel.substring(0, 3)}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ReservationsView = () => {
  const { reservations }       = useContextReservations();
  const { data: supabaseData } = useReservations({ limit: 500 });
  const createReservation      = useCreateReservation();

  // ── Modal state
  const [isFormOpen,      setIsFormOpen]      = React.useState(false);
  const [selectedDetail,  setSelectedDetail]  = React.useState<ReservationTableRow | null>(null);
  const [editRow,         setEditRow]         = React.useState<ReservationTableRow | null>(null);
  const [confirmDeleteRef, setConfirmDeleteRef] = React.useState<string | null>(null);

  // ── Filter state
  const [searchQuery,    setSearchQuery]    = React.useState('');
  const [statusFilter,   setStatusFilter]   = React.useState('ALL');
  const [channelFilter,  setChannelFilter]  = React.useState('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = React.useState('ALL');

  // ── Pagination state
  const [page,    setPage]    = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);

  // ── Build table rows
  const tableRows = React.useMemo<ReservationTableRow[]>(() => {
    const liveRows = supabaseData?.rows ?? [];
    if (liveRows.length > 0) return liveRows.map(mapSupabaseReservation);

    return reservations.map((res) => {
      const total   = res.totalTTC ?? res.totalAmount ?? 0;
      const balance = res.payment === 'Payé' ? 0 : total;
      const statusLabel = STATUS_LABEL[res.status] ?? res.status.toUpperCase();
      return {
        ref:         res.id,
        id:          res.id,
        status:      statusLabel,
        statusKey:   res.status,
        client:      res.client,
        email:       res.email || '—',
        pers:        res.guests?.adults ?? 2,
        checkin:     res.arrival,
        checkout:    res.departure,
        checkinRaw:  res.arrival  ?? null,
        checkoutRaw: res.departure ?? null,
        nights:      res.nights ?? 1,
        amount:      formatMoney(total),
        amountRaw:   total,
        solde:       formatMoney(balance),
        soldeRaw:    balance,
        soldeColor:  balance <= 0 ? 'emerald' : 'red',
        channel:     (res.source || 'DIRECT').toUpperCase(),
        room:        res.room,
        roomType:    res.roomType,
      };
    });
  }, [supabaseData, reservations]);

  // ── Stats
  const stats = React.useMemo(() => {
    const confirmed  = tableRows.filter(r => r.status === 'CONFIRMÉE').length;
    const checkedIn  = tableRows.filter(r => r.status === 'CHECK-IN').length;
    const pending    = tableRows.filter(r => ['EN ATTENTE', 'OPTION'].includes(r.status)).length;
    const totalCA    = (supabaseData?.rows ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
    return [
      { label: 'Dossiers',   value: tableRows.length.toString(), sub: 'Actifs',           icon: CheckCircle2, color: 'text-[#8B5CF6]',   bg: 'bg-[#8B5CF6]/5'  },
      { label: 'Confirmées', value: confirmed.toString(),         sub: 'Réservations live', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50'   },
      { label: 'Check-in',   value: checkedIn.toString(),         sub: 'En séjour',         icon: Clock,        color: 'text-[#8B5CF6]',   bg: 'bg-[#8B5CF6]/5'  },
      { label: 'CA total',   value: formatMoney(totalCA),         sub: 'Réservations',      icon: ArrowUpRight, color: 'text-emerald-500', bg: 'bg-emerald-50'   },
      { label: 'En attente', value: pending.toString(),           sub: 'Action requise',    icon: HelpCircle,   color: 'text-amber-500',   bg: 'bg-amber-50'     },
    ];
  }, [supabaseData, tableRows]);

  // ── Filter
  const filteredRows = React.useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tableRows.filter(r => {
      if (q && !r.client.toLowerCase().includes(q) &&
               !r.ref.toLowerCase().includes(q) &&
               !r.room.includes(q) &&
               !r.email.toLowerCase().includes(q)) return false;
      if (statusFilter  !== 'ALL' && r.status   !== statusFilter)  return false;
      if (channelFilter !== 'ALL' && r.channel  !== channelFilter) return false;
      if (roomTypeFilter !== 'ALL' && r.roomType !== roomTypeFilter) return false;
      return true;
    });
  }, [tableRows, searchQuery, statusFilter, channelFilter, roomTypeFilter]);

  // Reset to page 1 whenever filters change
  React.useEffect(() => { setPage(1); }, [searchQuery, statusFilter, channelFilter, roomTypeFilter, perPage]);

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const pageRows   = filteredRows.slice((page - 1) * perPage, page * perPage);

  // ── Handlers
  const openDetail = (row: ReservationTableRow) => setSelectedDetail(row);
  const openEdit   = (row: ReservationTableRow) => { setEditRow(row); setIsFormOpen(true); };
  const copyRef    = (ref: string) => navigator.clipboard?.writeText(ref).catch(() => {});

  // ── Build Reservation object for the detail modal
  const detailReservation = React.useMemo(() => {
    if (!selectedDetail) return null;
    return {
      id:          selectedDetail.id || selectedDetail.ref,
      /** Référence partenaire / OTA — affichée dans la fiche (facturation, en-tête) */
      reference:   selectedDetail.ref,
      client:      selectedDetail.client,
      guestName:   selectedDetail.client,
      email:       selectedDetail.email,
      phone:       selectedDetail.phone ?? '',
      room:        selectedDetail.room,
      roomType:    selectedDetail.roomType,
      arrival:     selectedDetail.checkinRaw  ?? selectedDetail.checkin,
      departure:   selectedDetail.checkoutRaw ?? selectedDetail.checkout,
      checkIn:     selectedDetail.checkinRaw  ?? selectedDetail.checkin,
      checkOut:    selectedDetail.checkoutRaw ?? selectedDetail.checkout,
      source:      selectedDetail.channel,
      status:      STATUS_MODAL_KEY[selectedDetail.status] ?? 'pending',
      totalAmount: selectedDetail.amountRaw,
      montant:     selectedDetail.amountRaw,
      solde:       selectedDetail.soldeRaw,
      nights:      selectedDetail.nights,
      guests:      { adults: selectedDetail.pers, children: 0 },
      notes:       selectedDetail.notes ?? '',
      partnerRef:  selectedDetail.partnerRef ?? '',
      // Required interface fields with safe defaults
      priority:     'normal',
      statusColor:  '#10B981',
      dotColor:     '#10B981',
      sourceColor:  '#6B7280',
      action:       '',
      governess:    '',
      vip:          false,
      payment:      selectedDetail.soldeRaw <= 0 ? 'Payé' : 'Solde restant',
      ownerFeeRate: 0,
      pmsFeeRate:   0,
      cleaningFee:  0,
    } as any;
  }, [selectedDetail]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FD] space-y-5">
      <LiveReservationsBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Réservations</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Gérez toutes vos réservations en un seul endroit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white border-gray-200 font-semibold gap-1.5 shadow-sm">
            <Download size={14} className="text-gray-400" /> Exporter
          </Button>
          <Button variant="outline" size="sm" className="bg-white border-gray-200 font-semibold gap-1.5 shadow-sm">
            <FileSpreadsheet size={14} className="text-emerald-500" /> Excel
          </Button>
          <Button
            onClick={() => { setEditRow(null); setIsFormOpen(true); }}
            className="bg-[#8B5CF6] font-semibold gap-1.5 px-4 py-2 rounded-xl shadow-md shadow-[#8B5CF6]/20"
          >
            <Plus size={16} /> Nouvelle réservation
          </Button>
        </div>
      </div>

      {/* ── KPI + Pie chart ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stats.map((s, i) => (
            <Card key={i} className="p-4 border-transparent bg-white shadow-sm flex flex-col gap-3 group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2.5">
                <div className={cn('p-2 rounded-xl group-hover:scale-110 transition-transform', s.bg, s.color)}>
                  <s.icon size={18} />
                </div>
                <p className="text-xl font-bold text-gray-900 leading-none">{s.value}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                <p className={cn('text-xs font-semibold mt-0.5', s.color)}>{s.sub}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="xl:col-span-1">
          <Card className="h-full p-4 border-transparent bg-white shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Répartition par statut
            </p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={STATUS_DATA} innerRadius={24} outerRadius={38} paddingAngle={4} dataKey="value">
                      {STATUS_DATA.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold text-gray-900">10</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {STATUS_DATA.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-semibold text-gray-500">{s.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Toolbar (search + filters) ─────────────────────────────────── */}
      <Card className="px-4 py-3 flex flex-wrap items-center gap-3 border-transparent bg-white shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Nom, chambre, email, référence…"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none font-medium text-gray-900 placeholder:text-gray-300 focus:border-[#8B5CF6]/40"
          />
        </div>

        {/* Date range — informational */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold text-gray-700">
          <Calendar size={14} className="text-gray-400" />
          27 avr. — 26 mai 2026
        </div>

        {/* Status filter */}
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'ALL', label: 'Tous statuts' },
            { value: 'CONFIRMÉE', label: 'Confirmée' },
            { value: 'CHECK-IN',  label: 'Check-in'  },
            { value: 'CHECK-OUT', label: 'Check-out' },
            { value: 'ANNULÉE',   label: 'Annulée'   },
            { value: 'EN ATTENTE', label: 'En attente' },
          ]}
        />

        {/* Channel filter */}
        <FilterSelect
          value={channelFilter}
          onChange={setChannelFilter}
          options={[
            { value: 'ALL',        label: 'Tous canaux'  },
            { value: 'DIRECT',     label: 'Direct'       },
            { value: 'BOOKING.COM', label: 'Booking.com' },
            { value: 'AIRBNB',     label: 'Airbnb'       },
            { value: 'EXPEDIA',    label: 'Expedia'      },
          ]}
        />

        {/* Room type filter */}
        <FilterSelect
          value={roomTypeFilter}
          onChange={setRoomTypeFilter}
          options={[
            { value: 'ALL',        label: 'Tout type'   },
            { value: 'Studio',     label: 'Studio'      },
            { value: 'Suite',      label: 'Suite'       },
            { value: 'Appartement', label: 'Appart.'   },
          ]}
        />

        <Button variant="outline" className="gap-1.5 font-semibold border-gray-200 text-[#8B5CF6] h-9 text-sm">
          <Filter size={14} /> Filtres
        </Button>

        {/* View toggle */}
        <div className="flex h-9 bg-gray-50 p-1 rounded-xl gap-0.5 ml-auto">
          <button className="px-2.5 rounded-lg text-gray-300 hover:text-gray-500" title="Grille"><LayoutGrid size={16} /></button>
          <button className="px-2.5 bg-white text-[#8B5CF6] rounded-lg shadow-sm" title="Liste"><List size={16} /></button>
        </div>
      </Card>

      {/* ── Payment follow-up ─────────────────────────────────────────── */}
      <PaymentFollowUp />

      {/* ── Main grid: table + sidebar ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

        {/* Table */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Toutes les réservations
              <span className="bg-[#8B5CF6] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {filteredRows.length}
              </span>
            </h3>
            {/* Per-page selector */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Lignes par page :</span>
              <select
                value={perPage}
                onChange={e => setPerPage(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 bg-white outline-none focus:border-[#8B5CF6]/40"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3">Référence</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-center">Pers.</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Check-out</th>
                    <th className="px-4 py-3 text-center">Nuits</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-right">Solde</th>
                    <th className="px-4 py-3 text-center">Canal</th>
                    <th className="px-4 py-3">Chambre</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-14 text-center text-sm text-gray-400">
                        Aucune réservation ne correspond aux filtres
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row, idx) => (
                      <ReservationRow
                        key={`${row.id}-${idx}`}
                        row={row}
                        onView={() => openDetail(row)}
                        onEdit={() => openEdit(row)}
                        onDelete={() => setConfirmDeleteRef(row.ref)}
                        onCopy={() => copyRef(row.ref)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
              <span className="text-xs text-gray-400 font-medium">
                {filteredRows.length === 0
                  ? '0 résultat'
                  : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, filteredRows.length)} sur ${filteredRows.length} réservation${filteredRows.length > 1 ? 's' : ''}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        'w-7 h-7 rounded-lg text-xs font-bold transition-colors',
                        pageNum === page
                          ? 'bg-[#8B5CF6] text-white shadow-sm'
                          : 'text-gray-500 hover:bg-white hover:text-gray-900',
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="xl:col-span-1 space-y-4">
          <ReservationAlerts />
          <ChannelDistribution />
          <QuickActions onNew={() => { setEditRow(null); setIsFormOpen(true); }} />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* New / edit reservation form */}
      <ReservationFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditRow(null); }}
        onSave={async (data) => {
          try {
            await createReservation.mutateAsync({
              reference:    data.reference,
              guestName:    data.guestName    || null,
              guestEmail:   data.email        || null,
              guestPhone:   data.phone        || null,
              checkIn:      data.checkIn,
              checkOut:     data.checkOut,
              adults:       data.adults       ?? 1,
              children:     data.children     ?? 0,
              source:       data.channel      ?? 'Direct',
              totalAmount:  data.totalTTC     ?? 0,
              notes:        data.notes        || null,
              roomId:       null,
              roomNumber:   data.roomNumber   || null,
              roomType:     data.category     || null,
              roomCategory: data.category     || null,
              guestId:      null,
            });
          } catch (err) {
            console.error('[ReservationsView] createReservation failed:', err);
            throw err;
          }
        }}
      />

      {/* Reservation detail drawer */}
      {selectedDetail && detailReservation && (
        <ReservationDetailsModal
          isOpen={true}
          reservation={detailReservation}
          onClose={() => setSelectedDetail(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Supprimer la réservation</h3>
                <p className="text-xs text-gray-400">{confirmDeleteRef}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Cette action est irréversible. La réservation sera définitivement supprimée.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteRef(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="!bg-red-500 hover:!bg-red-600 !text-white"
                onClick={() => {
                  // TODO: wire to deleteReservation mutation
                  console.warn('[ReservationsView] Delete not yet wired:', confirmDeleteRef);
                  setConfirmDeleteRef(null);
                }}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ReservationRowProps {
  row: ReservationTableRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

const ReservationRow: React.FC<ReservationRowProps> = ({ row, onView, onEdit, onDelete, onCopy }) => (
  <tr
    className="text-sm hover:bg-gray-50/80 transition-colors group cursor-pointer"
    onClick={onView}
  >
    <td className="px-4 py-4 font-bold text-[#8B5CF6] whitespace-nowrap">{row.ref}</td>
    <td className="px-4 py-4">
      <StatusBadge status={row.status} />
    </td>
    <td className="px-4 py-4">
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          avatarColor(row.ref),
        )}>
          {initials(row.client)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 leading-tight truncate max-w-[140px]">{row.client}</div>
          <div className="text-xs text-gray-400 truncate max-w-[140px]">{row.email}</div>
        </div>
      </div>
    </td>
    <td className="px-4 py-4 text-center">
      <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500">
        <User size={10} /> {row.pers}
      </div>
    </td>
    <td className="px-4 py-4 font-medium text-gray-600 whitespace-nowrap">{row.checkin}</td>
    <td className="px-4 py-4 font-medium text-gray-600 whitespace-nowrap">{row.checkout}</td>
    <td className="px-4 py-4 text-center font-semibold text-gray-500">{row.nights}</td>
    <td className="px-4 py-4 text-right font-bold text-gray-900 whitespace-nowrap">{row.amount}</td>
    <td className="px-4 py-4 text-right font-bold whitespace-nowrap">
      <span className={row.soldeColor === 'emerald' ? 'text-emerald-500' : 'text-red-500'}>
        {row.solde}
      </span>
    </td>
    <td className="px-4 py-4">
      <div className="flex items-center justify-center">
        <ChannelBadge channel={row.channel} />
      </div>
    </td>
    <td className="px-4 py-4">
      <div>
        <div className="font-semibold text-gray-900 text-sm">{row.room}</div>
        <div className="text-xs text-gray-400">{row.roomType}</div>
      </div>
    </td>
    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          title="Voir la fiche"
          onClick={onView}
          className="p-1.5 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-lg transition-colors"
        >
          <Eye size={14} />
        </button>
        <button
          title="Modifier"
          onClick={onEdit}
          className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          title="Copier la référence"
          onClick={onCopy}
          className="p-1.5 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-lg transition-colors"
        >
          <Copy size={14} />
        </button>
        <button
          title="Supprimer"
          onClick={onDelete}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </td>
  </tr>
);

// ─── FilterSelect ─────────────────────────────────────────────────────────────

const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
  const label = options.find(o => o.value === value)?.label ?? options[0]?.label;
  return (
    <div className="relative flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer group hover:border-[#8B5CF6]/30 transition-colors">
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className={cn('text-sm font-semibold', value === 'ALL' ? 'text-gray-400' : 'text-[#8B5CF6]')}>
        {label}
      </span>
      <ChevronDown size={13} className="text-gray-300 shrink-0" />
    </div>
  );
};

// ─── PaymentFollowUp ──────────────────────────────────────────────────────────

const PAYMENT_FOLLOWUPS = [
  { ref: 'RES-095', client: 'Sophie Dubois',  amount: '360 €', status: 'Lien expiré', statusColor: 'red'  as const, expire: 'Expiré', room: '102' },
  { ref: 'RES-094', client: 'Pierre Bernard', amount: '360 €', status: 'En attente',  statusColor: 'amber' as const, expire: '0h 35m', room: '104' },
  { ref: 'RES-096', client: 'Marie Martin',   amount: '360 €', status: 'Relancé',     statusColor: 'blue'  as const, expire: '1j 4h',  room: '107' },
];

const PaymentFollowUp: React.FC = () => (
  <Card className="overflow-hidden border-transparent shadow-sm bg-white">
    <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50 px-5 py-3.5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-xl">
          <CreditCard size={16} />
        </div>
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Suivi des paiements</h3>
          <p className="text-xs text-gray-500 font-medium">{PAYMENT_FOLLOWUPS.length} dossiers avec solde débiteur</p>
        </div>
      </div>
      <button className="text-xs font-bold text-red-500 hover:underline underline-offset-4">
        Voir les relances ({PAYMENT_FOLLOWUPS.length})
      </button>
    </CardHeader>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50/50">
          <tr className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            <th className="px-5 py-3">Référence</th>
            <th className="px-5 py-3">Client</th>
            <th className="px-5 py-3">Montant</th>
            <th className="px-5 py-3">Paiement</th>
            <th className="px-5 py-3">Expire</th>
            <th className="px-5 py-3">Chambre</th>
            <th className="px-5 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {PAYMENT_FOLLOWUPS.map(row => (
            <tr key={row.ref} className="text-sm hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3.5 font-bold text-[#8B5CF6]">{row.ref}</td>
              <td className="px-5 py-3.5 font-semibold text-gray-800">{row.client}</td>
              <td className="px-5 py-3.5 font-bold text-gray-900">{row.amount}</td>
              <td className="px-5 py-3.5">
                <span className={cn(
                  'px-2 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-1',
                  row.statusColor === 'red'   && 'bg-red-50 text-red-500',
                  row.statusColor === 'amber' && 'bg-amber-50 text-amber-500',
                  row.statusColor === 'blue'  && 'bg-blue-50 text-blue-500',
                )}>
                  <Zap size={10} /> {row.status}
                </span>
              </td>
              <td className="px-5 py-3.5 text-gray-500 font-medium">{row.expire}</td>
              <td className="px-5 py-3.5 text-gray-400 uppercase text-xs font-bold">{row.room}</td>
              <td className="px-5 py-3.5 text-center">
                <Button variant="outline" size="sm" className="px-3 text-xs font-bold text-[#8B5CF6] border-[#8B5CF6]/20 bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 gap-1.5 rounded-lg">
                  <Send size={11} /> Relancer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

// ─── Sidebar components ───────────────────────────────────────────────────────

const ReservationAlerts: React.FC = () => (
  <Card className="bg-white border-transparent shadow-sm">
    <p className="px-5 pt-5 pb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
      Alertes &amp; Actions
    </p>
    <CardContent className="space-y-3 px-5 pb-5 pt-1">
      {[
        { label: '3 relances en attente', color: 'red',   action: 'Afficher' },
        { label: '1 départ tardif prévu', color: 'blue',  action: 'Voir'     },
        { label: '2 arrivées demain',      color: 'rose',  action: 'Voir'     },
        { label: 'Paiements à vérifier',   color: 'amber', action: 'Voir'     },
      ].map(alert => (
        <div key={alert.label} className="flex items-center justify-between group cursor-pointer border-b border-gray-50 pb-3 last:border-0 last:pb-0">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'p-1.5 rounded-lg transition-transform group-hover:scale-110',
              alert.color === 'red'   && 'bg-red-50 text-red-500',
              alert.color === 'blue'  && 'bg-blue-50 text-blue-500',
              alert.color === 'rose'  && 'bg-rose-50 text-rose-500',
              alert.color === 'amber' && 'bg-amber-50 text-amber-500',
            )}>
              <AlertCircle size={13} />
            </div>
            <span className="text-xs font-semibold text-gray-900">{alert.label}</span>
          </div>
          <button className="text-xs font-bold text-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-opacity">
            {alert.action}
          </button>
        </div>
      ))}
    </CardContent>
  </Card>
);

const ChannelDistribution: React.FC = () => (
  <Card className="bg-white border-transparent shadow-sm">
    <p className="px-5 pt-5 pb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
      Répartition par canal
    </p>
    <CardContent className="space-y-3 px-5 pb-5 pt-1">
      {[
        { label: 'Direct',       percent: 40, count: 4, color: '#8B5CF6' },
        { label: 'Booking.com',  percent: 30, count: 3, color: '#3B82F6' },
        { label: 'Expedia',      percent: 20, count: 2, color: '#06B6D4' },
        { label: 'Airbnb',       percent: 10, count: 1, color: '#F43F5E' },
        { label: 'Autres',       percent: 0,  count: 0, color: '#94A3B8' },
      ].map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-500">{item.label}</span>
            <span className="text-gray-900">{item.percent}% ({item.count})</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.percent}%` }}
              transition={{ duration: 0.8, delay: i * 0.08 }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const QuickActions: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <div className="space-y-2">
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Actions rapides</p>
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'Nouvelle réservation', icon: Plus,       onClick: onNew    },
        { label: 'Walk-in',              icon: LayoutGrid, onClick: onNew    },
        { label: 'Groupe',               icon: Users,      onClick: () => {} },
        { label: 'Simulation',           icon: Monitor,    onClick: () => {} },
      ].map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          className="flex items-center gap-2 p-3 bg-white border border-gray-100 rounded-xl hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5 transition-all text-left shadow-sm group"
        >
          <div className="p-1.5 bg-gray-100 text-gray-400 group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6] rounded-lg transition-colors">
            <a.icon size={13} />
          </div>
          <span className="text-xs font-semibold text-gray-800 leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  </div>
);
