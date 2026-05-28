/**
 * FLOWTYM — Module Réservations
 *
 * • Source de données : Supabase uniquement (aucune donnée mockée)
 * • Référence affichée : référence partenaire / OTA (colonne `reference`)
 * • UUID Supabase : uniquement en backend, jamais affiché
 * • Tableau pleine largeur, sans volet droit
 * • KPIs opérationnels calculés depuis les données réelles
 * • Statuts pastels cohérents avec le design Flowtym premium
 */

import React from 'react';
import * as XLSX from 'xlsx';
import { useDebounce } from '@/src/hooks/useDebounce';
import { ReservationDetailsModal } from '@/src/components/modals/ReservationDetailsModal';
import {
  Search, Filter, Download, FileSpreadsheet, Plus,
  Calendar, Clock, User, Zap, CheckCircle2, HelpCircle,
  ArrowUpRight, Eye, Copy, Trash2, Pencil,
  CreditCard, ChevronDown, ChevronLeft, ChevronRight,
  BedDouble, TrendingUp, AlertTriangle, X,
} from 'lucide-react';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { TableSkeleton } from '@/src/components/ui/TableSkeleton';
import { cn } from '@/src/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { useReservations as useContextReservations } from '@/src/contexts/ReservationContext';
import { useReservations, useCreateReservation, useDeleteReservation } from '@/src/domains/reservations/hooks';
import ReservationFormModal from '@/src/components/modals/ReservationFormModal';
import { LiveReservationsBanner } from '@/src/domains/reservations/LiveReservationsBanner';
import type { ReservationRow } from '@/src/domains/reservations/schemas';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ResTableRow {
  /** Référence partenaire / OTA — affichée à l'utilisateur */
  ref: string;
  /** UUID Supabase — uniquement pour les relations backend */
  id: string;
  status: string;
  statusKey: string;
  client: string;
  email: string;
  pers: number;
  checkin: string;
  checkout: string;
  checkinRaw: string | null;
  checkoutRaw: string | null;
  nights: number;
  amount: string;
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

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  confirmed:   'CONFIRMÉE',
  checked_in:  'CHECK-IN',
  checked_out: 'CHECK-OUT',
  cancelled:   'ANNULÉE',
  pending:     'EN ATTENTE',
  hold:        'OPTION',
  no_show:     'NO-SHOW',
  noshow:      'NO-SHOW',
};

const STATUS_MODAL_KEY: Record<string, string> = {
  'CONFIRMÉE':  'confirmed',
  'CHECK-IN':   'checked_in',
  'CHECK-OUT':  'checked_out',
  'ANNULÉE':    'cancelled',
  'EN ATTENTE': 'pending',
  'OPTION':     'hold',
  'NO-SHOW':    'noshow',
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value: number | null | undefined): string =>
  typeof value === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
    : '—';

const todayISO = (): string => new Date().toISOString().split('T')[0];
const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const mapRow = (row: ReservationRow): ResTableRow => {
  const total   = row.total_amount ?? 0;
  const paid    = row.paid_amount  ?? 0;
  const balance = row.solde ?? Math.max(0, total - paid);
  const statusLabel = STATUS_LABEL[row.status ?? ''] ?? (row.status ?? '—').toUpperCase();

  return {
    // Référence partenaire : external_ref > reference > fallback court
    ref:         row.external_ref ?? row.reference ?? row.id.slice(0, 8).toUpperCase(),
    id:          row.id,
    status:      statusLabel,
    statusKey:   row.status ?? 'pending',
    client:      row.guest_name  ?? 'Client inconnu',
    email:       row.guest_email ?? '—',
    pers:        row.pax ?? (row.adults ?? 1) + (row.children ?? 0),
    checkin:     formatDate(row.check_in),
    checkout:    formatDate(row.check_out),
    checkinRaw:  row.check_in  ?? null,
    checkoutRaw: row.check_out ?? null,
    nights:      row.nights    ?? 1,
    amount:      formatMoney(total),
    amountRaw:   total,
    solde:       formatMoney(balance),
    soldeRaw:    balance,
    soldeColor:  balance <= 0 ? 'emerald' : 'red',
    channel:     (row.source ?? 'DIRECT').toUpperCase(),
    room:        row.room_number ?? '—',
    roomType:    [row.room_category, row.room_type].filter(Boolean).join('/') || '—',
    phone:       row.guest_phone ?? undefined,
    notes:       row.notes ?? undefined,
    partnerRef:  row.external_ref ?? row.reference ?? undefined,
  };
};

const initials = (name: string) =>
  name.split(' ').map(n => n[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-600',   'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600', 'bg-purple-100 text-purple-600',
  'bg-rose-100 text-rose-600',   'bg-cyan-100 text-cyan-600',
];
const avatarColor = (ref: string) =>
  AVATAR_COLORS[ref.charCodeAt(ref.length - 1) % AVATAR_COLORS.length];

// ─── Export helpers ───────────────────────────────────────────────────────

const EXPORT_HEADERS = ['Référence','Statut','Client','Email','Téléphone','Pers.','Check-in','Check-out','Nuits','Montant (€)','Solde (€)','Canal','Chambre','Type'];

function rowsToCsvBlob(rows: ResTableRow[]): Blob {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    EXPORT_HEADERS.join(';'),
    ...rows.map(r => [
      r.ref, r.status, r.client, r.email, r.phone ?? '',
      r.pers, r.checkin, r.checkout, r.nights,
      r.amountRaw, r.soldeRaw, r.channel, r.room, r.roomType,
    ].map(v => esc(String(v ?? ''))).join(';')),
  ];
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportToXlsx(rows: ResTableRow[], filename: string) {
  const data = [
    EXPORT_HEADERS,
    ...rows.map(r => [
      r.ref, r.status, r.client, r.email, r.phone ?? '',
      r.pers, r.checkin, r.checkout, r.nights,
      r.amountRaw, r.soldeRaw, r.channel, r.room, r.roomType,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Réservations');
  XLSX.writeFile(wb, filename);
}

const buildFilename = (ext: 'csv' | 'xlsx') => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `reservations-${d}.${ext}`;
};

// ─── Status badge — pastel ────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls = cn(
    'px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase text-center border whitespace-nowrap inline-block',
    status === 'CHECK-IN'   && 'bg-blue-50    text-blue-700    border-blue-200',
    status === 'CHECK-OUT'  && 'bg-gray-50    text-gray-500    border-gray-200',
    status === 'CONFIRMÉE'  && 'bg-emerald-50 text-emerald-700 border-emerald-200',
    status === 'ANNULÉE'    && 'bg-red-50     text-red-600     border-red-200',
    status === 'NO-SHOW'    && 'bg-orange-50  text-orange-700  border-orange-200',
    status === 'OPTION'     && 'bg-violet-50  text-violet-700  border-violet-200',
    !['CHECK-IN','CHECK-OUT','CONFIRMÉE','ANNULÉE','NO-SHOW','OPTION'].includes(status)
      && 'bg-amber-50 text-amber-700 border-amber-200',
  );
  return <div className={cls}>{status}</div>;
};

// ─── Channel badge ────────────────────────────────────────────────────────

const ChannelBadge: React.FC<{ channel: string }> = ({ channel }) => {
  const isDirect = channel === 'DIRECT' || channel === 'WEBSITE';
  if (isDirect) {
    return (
      <div className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 text-[10px] font-bold uppercase tracking-wider border border-violet-200">
        DIR
      </div>
    );
  }
  return (
    <div className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-100 flex items-center gap-1">
      <Zap size={9} /> {channel.substring(0, 4)}
    </div>
  );
};

// ─── FilterSelect ─────────────────────────────────────────────────────────

const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
  const label = options.find(o => o.value === value)?.label ?? options[0]?.label;
  return (
    <div className="relative flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-violet-300 transition-colors">
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className={cn('text-[13px] font-semibold', value === 'ALL' ? 'text-gray-400' : 'text-violet-600')}>
        {label}
      </span>
      <ChevronDown size={13} className="text-gray-300 shrink-0" />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────

export const ReservationsView = () => {
  const { reservations: _ctxReservations } = useContextReservations(); // kept for potential write-back
  const createReservation                  = useCreateReservation();
  const deleteReservation                  = useDeleteReservation();

  // Modal state
  const [isFormOpen,     setIsFormOpen]     = React.useState(false);
  const [selectedDetail, setSelectedDetail] = React.useState<ResTableRow | null>(null);
  const [editRow,        setEditRow]        = React.useState<ResTableRow | null>(null);
  const [confirmDelete,  setConfirmDelete]  = React.useState<{ id: string; ref: string } | null>(null);

  // Filter state
  const [searchQuery,    setSearchQuery]    = React.useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter,   setStatusFilter]   = React.useState('ALL');
  const [channelFilter,  setChannelFilter]  = React.useState('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = React.useState('ALL');
  const [showDateFilter, setShowDateFilter] = React.useState(false);
  const [dateFrom,       setDateFrom]       = React.useState('');
  const [dateTo,         setDateTo]         = React.useState('');

  // Pagination
  const [page,    setPage]    = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);

  // ── Wide query for KPIs and filter dropdowns (no pagination, no text filter)
  const { data: kpiData } = useReservations({ limit: 1000 });

  // ── Paginated + server-filtered query for the table
  const serverStatus  = statusFilter  !== 'ALL' ? [STATUS_MODAL_KEY[statusFilter]].filter(Boolean) as string[] : undefined;
  const serverSource  = channelFilter !== 'ALL' ? channelFilter.toLowerCase() : undefined;
  const { data: tableData, isLoading } = useReservations({
    limit:    perPage,
    offset:   (page - 1) * perPage,
    search:   debouncedSearch || undefined,
    status:   serverStatus,
    source:   serverSource,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
  });

  React.useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, channelFilter, roomTypeFilter, dateFrom, dateTo, perPage]);

  // ── KPI source: wide unfiltered data
  const kpiRawRows = kpiData?.rows ?? [];
  const kpiRows    = React.useMemo(() => kpiRawRows.map(mapRow), [kpiRawRows]);

  // ── Table rows: paginated server data, client-side roomType filter only
  const tableRows = React.useMemo<ResTableRow[]>(() => {
    const rows = (tableData?.rows ?? []).map(mapRow);
    return roomTypeFilter !== 'ALL'
      ? rows.filter(r => r.roomType === roomTypeFilter)
      : rows;
  }, [tableData, roomTypeFilter]);

  const totalPages = Math.max(1, Math.ceil((tableData?.total ?? 0) / perPage));

  // ── KPI metrics from wide unfiltered data
  const kpis = React.useMemo(() => {
    const today    = todayISO();
    const tomorrow = tomorrowISO();

    const confirmed    = kpiRows.filter(r => r.status === 'CONFIRMÉE').length;
    const checkedIn    = kpiRows.filter(r => r.status === 'CHECK-IN').length;
    const totalCA      = kpiRawRows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const arrivals     = kpiRawRows.filter(r => r.check_in  === tomorrow).length;
    const departures   = kpiRawRows.filter(r => r.check_out === today).length;
    const unpaid       = kpiRawRows.filter(r => (r.solde ?? 0) > 0 && !['cancelled','no_show'].includes(r.status ?? '')).length;

    return [
      { label: 'Dossiers actifs',   value: (kpiData?.total ?? kpiRows.length).toString(), sub: 'En base',         icon: BedDouble,      color: 'text-violet-600', bg: 'bg-violet-50'  },
      { label: 'Confirmées',        value: confirmed.toString(),         sub: 'Réservations',    icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'En séjour',         value: checkedIn.toString(),         sub: 'Check-in actif',  icon: Clock,          color: 'text-blue-600',   bg: 'bg-blue-50'    },
      { label: 'CA total',          value: formatMoney(totalCA),         sub: 'Réservations',    icon: TrendingUp,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Arrivées demain',   value: arrivals.toString(),          sub: 'À préparer',      icon: ArrowUpRight,   color: 'text-amber-600',  bg: 'bg-amber-50'   },
      { label: 'Départs auj.',      value: departures.toString(),        sub: 'À libérer',       icon: HelpCircle,     color: 'text-orange-600', bg: 'bg-orange-50'  },
      { label: 'Soldes débiteurs',  value: unpaid.toString(),            sub: 'Paiements à vérif', icon: AlertTriangle, color: 'text-red-500',   bg: 'bg-red-50'     },
    ];
  }, [kpiData, kpiRawRows, kpiRows]);

  // ── Pie chart data from wide data
  const pieData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of kpiRows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    const COLORS: Record<string, string> = {
      'CONFIRMÉE':  '#10B981',
      'CHECK-IN':   '#3B82F6',
      'EN ATTENTE': '#F59E0B',
      'ANNULÉE':    '#F87171',
      'OPTION':     '#8B5CF6',
      'NO-SHOW':    '#FB923C',
      'CHECK-OUT':  '#94A3B8',
    };
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: COLORS[name] ?? '#CBD5E1' }));
  }, [kpiRows]);

  // ── Dynamic filter options from wide data
  const channelOptions = React.useMemo(() => {
    const channels = [...new Set(kpiRows.map(r => r.channel))].sort();
    return [{ value: 'ALL', label: 'Tous canaux' }, ...channels.map(c => ({ value: c, label: c }))];
  }, [kpiRows]);

  const roomTypeOptions = React.useMemo(() => {
    const types = [...new Set(kpiRows.map(r => r.roomType).filter(t => t !== '—'))].sort();
    return [{ value: 'ALL', label: 'Tout type' }, ...types.map(t => ({ value: t, label: t }))];
  }, [kpiRows]);

  // ── Handlers
  const openDetail = (row: ResTableRow) => setSelectedDetail(row);
  const openEdit   = (row: ResTableRow) => { setEditRow(row); setIsFormOpen(true); };
  const copyRef    = (ref: string) => navigator.clipboard?.writeText(ref).catch(() => {});

  // ── Build Reservation for detail modal
  const detailReservation = React.useMemo(() => {
    if (!selectedDetail) return null;
    return {
      id:          selectedDetail.id,
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
      priority:    'normal', statusColor: '#10B981', dotColor: '#10B981',
      sourceColor: '#6B7280', action: '', governess: '', vip: false,
      payment:     selectedDetail.soldeRaw <= 0 ? 'Payé' : 'Solde restant',
      ownerFeeRate: 0, pmsFeeRate: 0, cleaningFee: 0,
    } as any;
  }, [selectedDetail]);

  const serverTotal = tableData?.total ?? 0;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F8F9FD]">
      <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
        <LiveReservationsBanner />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-black text-gray-900 leading-tight tracking-tight">Réservations</h1>
            <p className="text-[13px] text-gray-400 font-medium mt-0.5">
              {isLoading ? 'Chargement…' : `${serverTotal} réservation${serverTotal !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="bg-white border-gray-200 font-semibold gap-1.5 shadow-sm text-[13px]"
              onClick={() => downloadBlob(rowsToCsvBlob(tableRows), buildFilename('csv'))}
              disabled={tableRows.length === 0}
            >
              <Download size={14} className="text-gray-400" /> Exporter
            </Button>
            <Button
              variant="outline" size="sm"
              className="bg-white border-gray-200 font-semibold gap-1.5 shadow-sm text-[13px]"
              onClick={() => exportToXlsx(tableRows, buildFilename('xlsx'))}
              disabled={tableRows.length === 0}
            >
              <FileSpreadsheet size={14} className="text-emerald-500" /> Excel
            </Button>
            <Button
              onClick={() => { setEditRow(null); setIsFormOpen(true); }}
              data-testid="btn-new-reservation"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-2 px-4 py-2 rounded-xl shadow-md shadow-violet-200 text-[13px]"
            >
              <Plus size={15} /> Nouvelle réservation
            </Button>
          </div>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {kpis.map((s, i) => (
            <Card key={i} className="p-3.5 border-transparent bg-white shadow-sm flex flex-col gap-2.5 group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg', s.bg, s.color)}>
                  <s.icon size={15} />
                </div>
                <p className="text-[18px] font-black text-gray-900 leading-none tabular-nums">{s.value}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{s.label}</p>
                <p className={cn('text-[11px] font-semibold mt-1 leading-none', s.color)}>{s.sub}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Pie chart + toolbar in one row ──────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">

          {/* Mini pie */}
          {pieData.length > 0 && (
            <div className="flex items-center gap-3 pr-4 border-r border-gray-100 shrink-0">
              <div className="w-12 h-12 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={16} outerRadius={24} paddingAngle={3} dataKey="value">
                      {pieData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [`${v}`, n]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-0.5">
                {pieData.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] font-semibold text-gray-500">{s.name}</span>
                    <span className="text-[10px] font-bold text-gray-900 ml-1">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Nom, chambre, email, référence…"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none font-medium text-gray-900 placeholder:text-gray-300 focus:border-violet-300 transition-colors"
            />
          </div>

          {/* Status filter */}
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL',         label: 'Tous statuts' },
              { value: 'CONFIRMÉE',   label: 'Confirmée'    },
              { value: 'CHECK-IN',    label: 'Check-in'     },
              { value: 'CHECK-OUT',   label: 'Check-out'    },
              { value: 'ANNULÉE',     label: 'Annulée'      },
              { value: 'EN ATTENTE',  label: 'En attente'   },
              { value: 'OPTION',      label: 'Option'       },
              { value: 'NO-SHOW',     label: 'No-show'      },
            ]}
          />

          {/* Channel filter — dynamique */}
          <FilterSelect value={channelFilter} onChange={setChannelFilter} options={channelOptions} />

          {/* Room type filter — dynamique */}
          {roomTypeOptions.length > 1 && (
            <FilterSelect value={roomTypeFilter} onChange={setRoomTypeFilter} options={roomTypeOptions} />
          )}

          <Button
            variant="outline"
            className={cn(
              'gap-1.5 font-semibold h-9 text-[13px]',
              showDateFilter
                ? 'border-violet-400 text-violet-700 bg-violet-50'
                : 'border-gray-200 text-violet-600',
            )}
            onClick={() => setShowDateFilter(v => !v)}
          >
            <Filter size={13} /> Filtres
            {(dateFrom || dateTo) && (
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600 ml-0.5" />
            )}
          </Button>

          {/* Date info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-semibold text-gray-600 ml-auto shrink-0">
            <Calendar size={13} className="text-gray-400" />
            {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* ── Date range filter panel ────────────────────────────────── */}
        {showDateFilter && (
          <div className="flex items-center gap-4 px-4 py-3 bg-white rounded-2xl border border-violet-100 shadow-sm">
            <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider shrink-0">Période</span>
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-gray-500 font-medium shrink-0">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-700 bg-white outline-none focus:border-violet-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-gray-500 font-medium shrink-0">Au</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-700 bg-white outline-none focus:border-violet-400 transition-colors"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="flex items-center gap-1 text-[12px] text-red-400 hover:text-red-600 font-semibold transition-colors"
              >
                <X size={12} /> Effacer
              </button>
            )}
            <span className="text-[12px] text-gray-400 ml-auto">
              {serverTotal} résultat{serverTotal !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Table pleine largeur ─────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Table header row */}
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              Toutes les réservations
              <span className="bg-violet-600 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                {serverTotal}
              </span>
            </h3>
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <span>Lignes :</span>
              <select
                value={perPage}
                onChange={e => setPerPage(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-[12px] font-semibold text-gray-700 bg-white outline-none focus:border-violet-300"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3">Réf. partenaire</th>
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={12} className="p-0">
                        <TableSkeleton rows={perPage} cols={9} />
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                            <BedDouble size={22} className="text-gray-300" />
                          </div>
                          <p className="text-[13px] font-semibold text-gray-500">
                            {serverTotal === 0
                              ? 'Aucune réservation en base'
                              : 'Aucun résultat pour ces filtres'}
                          </p>
                          {serverTotal === 0 && (
                            <Button
                              size="sm"
                              onClick={() => { setEditRow(null); setIsFormOpen(true); }}
                              className="bg-violet-600 text-white mt-1 gap-1.5"
                            >
                              <Plus size={13} /> Créer la première réservation
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row, idx) => (
                      <ResRow
                        key={`${row.id}-${idx}`}
                        row={row}
                        onView={() => openDetail(row)}
                        onEdit={() => openEdit(row)}
                        onDelete={() => setConfirmDelete({ id: row.id, ref: row.ref })}
                        onCopy={() => copyRef(row.ref)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
              <span className="text-[12px] text-gray-400 font-medium">
                {serverTotal === 0
                  ? '0 résultat'
                  : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, serverTotal)} sur ${serverTotal}`}
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
                  let n: number;
                  if (totalPages <= 7)           n = i + 1;
                  else if (page <= 4)            n = i + 1;
                  else if (page >= totalPages - 3) n = totalPages - 6 + i;
                  else                           n = page - 3 + i;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        'w-7 h-7 rounded-lg text-[12px] font-bold transition-colors',
                        n === page
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-white hover:text-gray-900',
                      )}
                    >
                      {n}
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

        {/* ── Modals ───────────────────────────────────────────────────── */}

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

        {selectedDetail && detailReservation && (
          <ReservationDetailsModal
            isOpen={true}
            reservation={detailReservation}
            onClose={() => setSelectedDetail(null)}
          />
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-gray-900">Supprimer la réservation</h3>
                  <p className="text-[12px] text-gray-400 font-mono">{confirmDelete.ref}</p>
                </div>
              </div>
              <p className="text-[13px] text-gray-600 mb-5">
                Cette action est irréversible. La réservation sera définitivement supprimée.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleteReservation.isPending}>Annuler</Button>
                <Button
                  size="sm"
                  className="!bg-red-500 hover:!bg-red-600 !text-white gap-1.5"
                  disabled={deleteReservation.isPending}
                  onClick={async () => {
                    try {
                      await deleteReservation.mutateAsync(confirmDelete.id);
                      setConfirmDelete(null);
                    } catch (err) {
                      console.error('[ReservationsView] delete failed:', err);
                    }
                  }}
                >
                  {deleteReservation.isPending ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Suppression…</>
                  ) : 'Supprimer'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Table row sub-component ──────────────────────────────────────────────

interface ResRowProps {
  row: ResTableRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

const ResRow: React.FC<ResRowProps> = ({ row, onView, onEdit, onDelete, onCopy }) => (
  <tr
    className="hover:bg-violet-50/20 transition-colors group cursor-pointer"
    onClick={onView}
  >
    {/* Référence partenaire */}
    <td className="px-4 py-3.5 font-bold text-violet-600 whitespace-nowrap text-[13px] font-mono tracking-wide">
      {row.ref}
    </td>
    <td className="px-4 py-3.5">
      <StatusBadge status={row.status} />
    </td>
    <td className="px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', avatarColor(row.ref))}>
          {initials(row.client)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-[13px] leading-tight truncate max-w-[160px]">{row.client}</div>
          <div className="text-[11px] text-gray-400 truncate max-w-[160px]">{row.email}</div>
        </div>
      </div>
    </td>
    <td className="px-4 py-3.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[12px] font-semibold text-gray-500">
        <User size={10} /> {row.pers}
      </div>
    </td>
    <td className="px-4 py-3.5 text-[13px] font-medium text-gray-600 whitespace-nowrap">{row.checkin}</td>
    <td className="px-4 py-3.5 text-[13px] font-medium text-gray-600 whitespace-nowrap">{row.checkout}</td>
    <td className="px-4 py-3.5 text-center text-[13px] font-semibold text-gray-500">{row.nights}</td>
    <td className="px-4 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap text-[13px]">{row.amount}</td>
    <td className="px-4 py-3.5 text-right font-bold whitespace-nowrap text-[13px]">
      <span className={row.soldeColor === 'emerald' ? 'text-emerald-600' : 'text-red-500'}>{row.solde}</span>
    </td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-center">
        <ChannelBadge channel={row.channel} />
      </div>
    </td>
    <td className="px-4 py-3.5">
      <div>
        <div className="font-semibold text-gray-900 text-[13px]">{row.room}</div>
        <div className="text-[11px] text-gray-400">{row.roomType}</div>
      </div>
    </td>
    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button title="Voir"     onClick={onView}   className="p-1.5 text-gray-300 hover:text-violet-600  hover:bg-violet-50   rounded-lg transition-colors"><Eye    size={14} /></button>
        <button title="Modifier" onClick={onEdit}   className="p-1.5 text-gray-300 hover:text-amber-500  hover:bg-amber-50    rounded-lg transition-colors"><Pencil size={14} /></button>
        <button title="Copier"   onClick={onCopy}   className="p-1.5 text-gray-300 hover:text-violet-600  hover:bg-violet-50   rounded-lg transition-colors"><Copy   size={14} /></button>
        <button title="Supprimer"onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500    hover:bg-red-50      rounded-lg transition-colors"><Trash2 size={14} /></button>
      </div>
    </td>
  </tr>
);
