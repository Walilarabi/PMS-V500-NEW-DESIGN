/**
 * 51060 — Nationalités (nuitées + CA par pays)
 */

import React, { useMemo } from 'react';
import { MapPin, Globe, BedDouble, Users } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DonutChart } from '../../../../components/analysis/DonutChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  nationalite: string;
  reservations: number;
  nuitees: number;
  ca_total: number;
  adr: number;
  part_pct: number;
}

const FALLBACK_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#A855F7', '#14B8A6', '#6366F1'];

export const Renderer51060: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.ca_total || 0), 0);
    const nights = rows.reduce((s, r) => s + Number(r.nuitees || 0), 0);
    const top = rows[0];
    return { total, nights, paysCount: rows.length, top };
  }, [rows]);

  const donutData = rows.slice(0, 8).map((r, i) => ({
    key: r.nationalite,
    label: r.nationalite,
    value: Number(r.nuitees || 0),
    color: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'nationalite', header: 'Pays', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées', cell: ({ getValue }) => <span className="font-bold">{getValue() as number ?? 0}</span> },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'part_pct', header: 'Part nuitées', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pays distincts" value={stats.paysCount} icon={Globe} tone="violet" />
        <KpiCard label="Nuitées totales" value={stats.nights} icon={BedDouble} tone="blue" />
        <KpiCard label="CA total" value={`${Math.round(stats.total / 1000)}K€`} icon={MapPin} tone="emerald" />
        <KpiCard
          label="Top marché"
          value={stats.top?.nationalite ?? '—'}
          icon={Users}
          tone="amber"
          sub={stats.top ? `${stats.top.part_pct.toFixed(1)}% des nuitées · ${Math.round(stats.top.ca_total)}€` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-500" />
            Top 8 nationalités — répartition nuitées
          </h3>
          <DonutChart
            data={donutData}
            centerLabel="Pays"
            centerValue={`${stats.paysCount}`}
            unitFormatter={(v) => `${v} nuitées`}
          />
        </div>
        <DataTable data={rows} columns={columns} stickyHeader />
      </div>
    </div>
  );
};
