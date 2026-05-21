/**
 * 21013 — Détail par canal (CA + nuitées + ADR + part %)
 */

import React, { useMemo } from 'react';
import { Globe, DollarSign, BedDouble, TrendingUp } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DonutChart } from '../../../../components/analysis/DonutChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  canal: string;
  reservations: number;
  nuitees: number;
  ca_total: number;
  adr: number;
  part_pct: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  Direct:           '#10B981',
  'Booking.com':    '#3B82F6',
  Booking:          '#3B82F6',
  Expedia:          '#F59E0B',
  Airbnb:           '#F43F5E',
  Hotelbeds:        '#06B6D4',
  Hotelbeds_API:    '#06B6D4',
};

const FALLBACK_COLORS = ['#8B5CF6', '#EC4899', '#14B8A6', '#A855F7', '#F97316', '#6366F1'];

export const Renderer21013: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.ca_total || 0), 0);
    const nights = rows.reduce((s, r) => s + Number(r.nuitees || 0), 0);
    const res = rows.reduce((s, r) => s + Number(r.reservations || 0), 0);
    return {
      total,
      nights,
      res,
      adr: nights > 0 ? Math.round(total / nights) : 0,
      topCanal: rows[0]?.canal ?? '—',
      topPart: rows[0]?.part_pct ?? 0,
    };
  }, [rows]);

  const donutData = rows.map((r, i) => ({
    key: r.canal,
    label: r.canal,
    value: Number(r.ca_total || 0),
    color: CHANNEL_COLORS[r.canal] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'canal', header: 'Canal', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées' },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => <span className="font-bold">{Math.round(Number(getValue() ?? 0))}€</span> },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'part_pct', header: 'Part', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CA Total" value={`${Math.round(stats.total / 1000)}K€`} icon={DollarSign} tone="emerald" />
        <KpiCard label="Réservations" value={stats.res} icon={Globe} tone="violet" />
        <KpiCard label="Nuitées" value={stats.nights} icon={BedDouble} tone="blue" />
        <KpiCard label="ADR moyen" value={`${stats.adr}€`} icon={TrendingUp} tone="amber" sub={`Top : ${stats.topCanal} (${stats.topPart}%)`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-500" />
            Répartition CA par canal
          </h3>
          <DonutChart
            data={donutData}
            centerLabel="Canaux"
            centerValue={`${rows.length}`}
            unitFormatter={(v) => `${Math.round(v)}€`}
          />
        </div>
        <DataTable data={rows} columns={columns} stickyHeader />
      </div>
    </div>
  );
};
