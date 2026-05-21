/**
 * Renderers Vague 7 — 10 rapports métier (Front Office, Réservations, Stats)
 */

import React from 'react';
import {
  BedDouble, Users, DollarSign, Plane, AlertCircle, Sparkles, Tag, Globe,
  ClipboardList, CheckCircle2,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { GenericListReport, sumOf, fmtEur, countWhere } from './GenericListReport';
import { DonutChart } from '../../../../components/analysis/DonutChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import type { ReportRenderer } from '../renderers';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
const flagBadge = (f: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    A: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Arrivée' },
    D: { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'Départ' },
    P: { bg: 'bg-violet-100',  text: 'text-violet-800',  label: 'Présent' },
  };
  const c = map[f] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: f };
  return <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', c.bg, c.text)}>{c.label}</span>;
};

const hkBadge = (s: string) => {
  const v = s.toLowerCase();
  if (/propre|clean/.test(v)) return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Propre</span>;
  if (/sale|dirty/.test(v))   return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Sale</span>;
  if (/cours|progress/.test(v)) return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">En cours</span>;
  if (/inspect/.test(v)) return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800">Inspectée</span>;
  if (/oos|hors|out/.test(v)) return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Hors service</span>;
  return <span className="text-xs text-gray-500">{s}</span>;
};

const payStatus = (s: string) => {
  const v = s.toLowerCase();
  if (/paid|payé/.test(v))      return <span className="text-emerald-700 font-bold text-xs">{s}</span>;
  if (/partial|partiel/.test(v))return <span className="text-amber-700 font-bold text-xs">{s}</span>;
  if (/pending|attente/.test(v))return <span className="text-red-700 font-bold text-xs">{s}</span>;
  return <span className="text-gray-600 text-xs">{s}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11001 — Clients / Chambres (in-house)
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer11001: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'status_flag', header: 'Statut', cell: ({ getValue }) => flagBadge(String(getValue() ?? '')) },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="text-xs text-gray-500 font-mono">{String(getValue() ?? '')}</span> },
    { accessorKey: 'check_in', header: 'Arrivée', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'check_out', header: 'Départ', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
    { accessorKey: 'adults', header: 'Adultes' },
    { accessorKey: 'children', header: 'Enfants' },
    { accessorKey: 'room_type', header: 'Type', cell: ({ getValue }) => <span className="text-xs">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'source', header: 'Canal', cell: ({ getValue }) => <span className="text-xs">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'total_amount', header: 'Total', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'solde', header: 'Solde', cell: ({ getValue }) => {
      const v = Number(getValue() ?? 0);
      return <span className={cn('font-bold', v > 0 ? 'text-red-700' : 'text-emerald-700')}>{fmtEur(v)}</span>;
    } },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Chambres occupées', icon: BedDouble, tone: 'violet', compute: (r) => r.length },
      { label: 'Arrivées du jour', icon: Plane, tone: 'emerald', compute: (r) => countWhere(r, x => x.status_flag === 'A') },
      { label: 'Départs du jour', icon: Plane, tone: 'blue', compute: (r) => countWhere(r, x => x.status_flag === 'D') },
      { label: 'Solde dû total', icon: DollarSign, tone: 'amber', compute: (r) => fmtEur(sumOf(r.filter((x:any)=>Number(x.solde)>0), 'solde')) },
    ]}
    emptyMessage="Aucun client présent aujourd'hui"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11005 — Planning du jour
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer11005: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_type', header: 'Type' },
    { accessorKey: 'hk_status', header: 'Ménage', cell: ({ getValue }) => hkBadge(String(getValue() ?? '')) },
    { accessorKey: 'occupation', header: 'Statut', cell: ({ getValue }) => {
      const v = String(getValue() ?? '');
      return <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', v === 'Occupée' ? 'bg-violet-100 text-violet-800' : 'bg-gray-100 text-gray-600')}>{v}</span>;
    } },
    { accessorKey: 'status_flag', header: 'Action', cell: ({ getValue }) => flagBadge(String(getValue() ?? '')) },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'check_in', header: 'Arrivée', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'check_out', header: 'Départ', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Total chambres', icon: BedDouble, tone: 'violet', compute: (r) => r.length },
      { label: 'Occupées', icon: Users, tone: 'emerald', compute: (r) => countWhere(r, x => x.occupation === 'Occupée') },
      { label: 'Libres', icon: BedDouble, tone: 'blue', compute: (r) => countWhere(r, x => x.occupation === 'Libre') },
      { label: 'Arrivées + départs', icon: Plane, tone: 'amber', compute: (r) => countWhere(r, x => x.status_flag === 'A' || x.status_flag === 'D') },
    ]}
    emptyMessage="Aucune chambre"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11006 — Gouvernante (priorité ménage)
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer11006: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'priorite', header: 'Priorité', cell: ({ getValue }) => {
      const p = Number(getValue() ?? 4);
      const styles = ['', 'bg-red-500 text-white', 'bg-amber-500 text-white', 'bg-blue-500 text-white', 'bg-gray-300 text-gray-700'];
      return <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold', styles[p] ?? styles[4])}>{p}</span>;
    } },
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_type', header: 'Type' },
    { accessorKey: 'hk_status', header: 'État ménage', cell: ({ getValue }) => hkBadge(String(getValue() ?? '')) },
    { accessorKey: 'occupation', header: 'Statut' },
    { accessorKey: 'next_arrival', header: 'Prochaine arrivée', cell: ({ getValue }) => {
      const v = String(getValue() ?? '');
      const isToday = v === new Date().toISOString().slice(0, 10);
      return <span className={isToday ? 'text-red-700 font-bold' : 'text-xs text-gray-600'}>{v === '—' ? '—' : fmtDate(v)}{isToday && ' ⚡ AUJ.'}</span>;
    } },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold text-sm">{String(getValue() ?? '—')}</span> },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Total chambres', icon: BedDouble, tone: 'violet', compute: (r) => r.length },
      { label: 'Sales à nettoyer', icon: AlertCircle, tone: 'negative', compute: (r) => countWhere(r, x => /sale|dirty/i.test(String(x.hk_status ?? ''))) },
      { label: 'Urgent (priorité 1)', icon: Sparkles, tone: 'amber', compute: (r) => countWhere(r, x => x.priorite === 1) },
      { label: 'Propres', icon: CheckCircle2, tone: 'positive', compute: (r) => countWhere(r, x => /propre|clean/i.test(String(x.hk_status ?? ''))) },
    ]}
    pageSize={50}
    emptyMessage="Aucune chambre à traiter"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11009 — Clients non arrivés
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer11009: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="font-mono font-bold text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_type', header: 'Type' },
    { accessorKey: 'check_in', header: 'Arrivée', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
    { accessorKey: 'source', header: 'Canal' },
    { accessorKey: 'total_amount', header: 'Total', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'payment_status', header: 'Paiement', cell: ({ getValue }) => payStatus(String(getValue() ?? '')) },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Non arrivés', icon: AlertCircle, tone: 'negative', compute: (r) => r.length },
      { label: 'CA en attente', icon: DollarSign, tone: 'amber', compute: (r) => fmtEur(sumOf(r, 'total_amount')) },
    ]}
    emptyMessage="Tous les clients prévus sont arrivés"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11010 — Départs restants
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer11010: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'check_in', header: 'Arrivée', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'check_out', header: 'Départ', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'total_amount', header: 'Total', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'paid_amount', header: 'Payé', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'solde', header: 'Solde', cell: ({ getValue }) => {
      const v = Number(getValue() ?? 0);
      return <span className={cn('font-bold', v > 0 ? 'text-red-700' : 'text-emerald-700')}>{fmtEur(v)}</span>;
    } },
    { accessorKey: 'payment_status', header: 'Statut', cell: ({ getValue }) => payStatus(String(getValue() ?? '')) },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Départs à libérer', icon: Plane, tone: 'blue', compute: (r) => r.length },
      { label: 'Solde dû total', icon: DollarSign, tone: 'amber', compute: (r) => fmtEur(sumOf(r, 'solde')), sub: (r) => `${countWhere(r, x => Number(x.solde) > 0)} comptes ouverts` },
      { label: 'CA en attente', icon: CheckCircle2, tone: 'emerald', compute: (r) => fmtEur(sumOf(r, 'paid_amount')) },
    ]}
    emptyMessage="Tous les départs sont libérés"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 21001 — Arrivées d'une journée
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer21001: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'check_in', header: 'Date', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'guest_email', header: 'Email', cell: ({ getValue }) => <span className="text-xs text-gray-600">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_phone', header: 'Tél.', cell: ({ getValue }) => <span className="text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_type', header: 'Type' },
    { accessorKey: 'check_out', header: 'Départ', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
    { accessorKey: 'adults', header: 'Ad.' },
    { accessorKey: 'children', header: 'Enf.' },
    { accessorKey: 'source', header: 'Canal' },
    { accessorKey: 'total_amount', header: 'Total', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'payment_status', header: 'Paiement', cell: ({ getValue }) => payStatus(String(getValue() ?? '')) },
    { accessorKey: 'guarantee_status', header: 'Garantie', cell: ({ getValue }) => <span className="text-xs">{String(getValue() ?? '—')}</span> },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Arrivées', icon: Plane, tone: 'emerald', compute: (r) => r.length },
      { label: 'Personnes', icon: Users, tone: 'violet', compute: (r) => sumOf(r, 'adults') + sumOf(r, 'children') },
      { label: 'Nuitées totales', icon: BedDouble, tone: 'blue', compute: (r) => sumOf(r, 'nights') },
      { label: 'CA prévu', icon: DollarSign, tone: 'amber', compute: (r) => fmtEur(sumOf(r, 'total_amount')) },
    ]}
    emptyMessage="Aucune arrivée prévue"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 21002 — Départs prévus
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer21002: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'check_out', header: 'Date départ', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'room_number', header: 'Chambre', cell: ({ getValue }) => <span className="font-mono font-bold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'check_in', header: 'Arrivée', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
    { accessorKey: 'total_amount', header: 'Total', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'paid_amount', header: 'Payé', cell: ({ getValue }) => fmtEur(Number(getValue() ?? 0)) },
    { accessorKey: 'solde', header: 'Solde', cell: ({ getValue }) => {
      const v = Number(getValue() ?? 0);
      return <span className={cn('font-bold', v > 0 ? 'text-red-700' : 'text-emerald-700')}>{fmtEur(v)}</span>;
    } },
    { accessorKey: 'payment_status', header: 'Statut', cell: ({ getValue }) => payStatus(String(getValue() ?? '')) },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Départs', icon: Plane, tone: 'blue', compute: (r) => r.length },
      { label: 'CA total', icon: DollarSign, tone: 'emerald', compute: (r) => fmtEur(sumOf(r, 'total_amount')) },
      { label: 'Soldes ouverts', icon: AlertCircle, tone: 'amber', compute: (r) => fmtEur(sumOf(r, 'solde')) },
      { label: 'Comptes à régler', icon: AlertCircle, tone: 'negative', compute: (r) => countWhere(r, x => Number(x.solde) > 0) },
    ]}
    emptyMessage="Aucun départ prévu"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 21009 — Annulations
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer21009: ReportRenderer = ({ data }) => {
  const cols: ColumnDef<any>[] = [
    { accessorKey: 'cancelled_at', header: 'Annulée le', cell: ({ getValue }) => {
      const v = getValue() as string;
      return v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    } },
    { accessorKey: 'reference', header: 'Réf.', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'guest_name', header: 'Client', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'check_in', header: 'Arrivée prévue', cell: ({ getValue }) => fmtDate(String(getValue() ?? '')) },
    { accessorKey: 'nights', header: 'Nuits' },
    { accessorKey: 'source', header: 'Canal' },
    { accessorKey: 'total_amount', header: 'CA perdu', cell: ({ getValue }) => <span className="font-bold text-red-700">{fmtEur(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'delai_jours', header: 'Délai (j)', cell: ({ getValue }) => {
      const v = Number(getValue() ?? 0);
      return <span className={cn('text-xs font-bold', v <= 3 ? 'text-red-700' : v <= 7 ? 'text-amber-700' : 'text-emerald-700')}>{v}j</span>;
    } },
    { accessorKey: 'cancellation_reason', header: 'Motif', cell: ({ getValue }) => <span className="text-xs">{String(getValue() ?? '—')}</span> },
  ];
  return <GenericListReport
    data={data} columns={cols}
    kpis={[
      { label: 'Annulations', icon: AlertCircle, tone: 'negative', compute: (r) => r.length },
      { label: 'CA perdu', icon: DollarSign, tone: 'negative', compute: (r) => fmtEur(sumOf(r, 'total_amount')) },
      { label: 'Last-minute (≤3j)', icon: AlertCircle, tone: 'amber', compute: (r) => countWhere(r, x => Number(x.delai_jours) <= 3) },
      { label: 'Nuitées annulées', icon: BedDouble, tone: 'violet', compute: (r) => sumOf(r, 'nights') },
    ]}
    emptyMessage="Aucune annulation sur la période"
  />;
};

// ═══════════════════════════════════════════════════════════════════════════
// 51020 — Tarifs / Rate plans
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer51020: ReportRenderer = ({ data }) => {
  const rows = data as any[];
  const total = sumOf(rows, 'ca_total');
  const top = rows[0];

  const donutData = rows.slice(0, 8).map((r, i) => ({
    key: r.plan_code,
    label: `${r.plan_code} — ${r.plan_name}`,
    value: Number(r.ca_total || 0),
    color: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'][i % 8],
  }));

  const cols: ColumnDef<any>[] = [
    { accessorKey: 'plan_code', header: 'Code', cell: ({ getValue }) => <span className="font-mono font-bold text-xs">{String(getValue() ?? '')}</span> },
    { accessorKey: 'plan_name', header: 'Plan tarifaire', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'pension_type', header: 'Pension' },
    { accessorKey: 'channel_type', header: 'Canal' },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées' },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => <span className="font-bold">{fmtEur(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => <span className="text-violet-700 font-bold">{fmtEur(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'part_pct', header: 'Part', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Plans tarifaires actifs" value={rows.length} icon={Tag} tone="violet" />
        <KpiCard label="CA total" value={fmtEur(total)} icon={DollarSign} tone="emerald" />
        <KpiCard label="Nuitées" value={sumOf(rows, 'nuitees')} icon={BedDouble} tone="blue" />
        <KpiCard label="Top plan" value={top?.plan_name?.slice(0, 20) ?? '—'} icon={ClipboardList} tone="amber" sub={top ? `${Number(top.part_pct).toFixed(1)}% du CA` : undefined} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-500" />
            Répartition CA par plan
          </h3>
          <DonutChart data={donutData} centerLabel="Plans" centerValue={`${rows.length}`} unitFormatter={(v) => fmtEur(v)} />
        </div>
        <DataTable data={rows} columns={cols} stickyHeader />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 54003 — Taux d'occupation par canal
// ═══════════════════════════════════════════════════════════════════════════

export const Renderer54003: ReportRenderer = ({ data }) => {
  const rows = data as any[];
  const total = sumOf(rows, 'ca_total');
  const top = rows[0];

  const donutData = rows.map((r, i) => ({
    key: r.canal,
    label: r.canal,
    value: Number(r.nuitees || 0),
    color: ['#3B82F6', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#06B6D4', '#A855F7', '#F97316'][i % 8],
  }));

  const cols: ColumnDef<any>[] = [
    { accessorKey: 'canal', header: 'Canal', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées', cell: ({ getValue }) => <span className="font-bold">{getValue() as number ?? 0}</span> },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => <span className="font-bold">{fmtEur(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => <span className="text-violet-700 font-bold">{fmtEur(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'occupancy_contribution_pct', header: 'Contrib. TO%', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
    { accessorKey: 'part_ca_pct', header: 'Part CA', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Canaux actifs" value={rows.length} icon={Globe} tone="violet" />
        <KpiCard label="CA total" value={fmtEur(total)} icon={DollarSign} tone="emerald" />
        <KpiCard label="Nuitées" value={sumOf(rows, 'nuitees')} icon={BedDouble} tone="blue" />
        <KpiCard label="Canal dominant" value={top?.canal ?? '—'} icon={ClipboardList} tone="amber" sub={top ? `${Number(top.part_ca_pct).toFixed(1)}% du CA` : undefined} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-500" />
            Contribution nuitées par canal
          </h3>
          <DonutChart data={donutData} centerLabel="Canaux" centerValue={`${rows.length}`} unitFormatter={(v) => `${v} nuitées`} />
        </div>
        <DataTable data={rows} columns={cols} stickyHeader />
      </div>
    </div>
  );
};
