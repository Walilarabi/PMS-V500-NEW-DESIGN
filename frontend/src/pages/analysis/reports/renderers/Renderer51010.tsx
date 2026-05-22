/**
 * 51010 — Segmentation (CA / nuitées / ADR par segment)
 */

import React, { useMemo } from 'react';
import { Users, DollarSign, BedDouble, BarChart3 } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DonutChart } from '../../../../components/analysis/DonutChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import { computeInsights51010 } from '../../../../components/analysis/insights/computers';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  segment: string;
  reservations: number;
  nuitees: number;
  ca_total: number;
  adr: number;
  part_pct: number;
}

const SEG_COLORS: Record<string, string> = {
  'Loisir':   '#10B981',
  'Business': '#3B82F6',
  'Corpo':    '#8B5CF6',
  'Corporate':'#8B5CF6',
  'Groupe':   '#F59E0B',
  'Famille':  '#EC4899',
  'VIP':      '#F97316',
  'Agence':   '#06B6D4',
  'TO':       '#A855F7',
  'Non segmenté': '#94A3B8',
};
const FALLBACK = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

export const Renderer51010: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.ca_total || 0), 0);
    const nights = rows.reduce((s, r) => s + Number(r.nuitees || 0), 0);
    const segments = rows.length;
    const top = rows[0];
    return { total, nights, segments, top };
  }, [rows]);

  const donutData = rows.map((r, i) => ({
    key: r.segment,
    label: r.segment,
    value: Number(r.ca_total || 0),
    color: SEG_COLORS[r.segment] ?? FALLBACK[i % FALLBACK.length],
  }));

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'segment', header: 'Segment', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées' },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => <span className="font-bold">{Math.round(Number(getValue() ?? 0))}€</span> },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => <span className="text-violet-700 font-bold">{Math.round(Number(getValue() ?? 0))}€</span> },
    { accessorKey: 'part_pct', header: 'Part', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  const insights = useMemo(() => computeInsights51010(rows), [rows]);

  return (
    <div className="space-y-4">
      <InsightsPanel insights={insights} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Segments actifs" value={stats.segments} icon={Users} tone="violet" />
        <KpiCard label="CA Total" value={`${Math.round(stats.total / 1000)}K€`} icon={DollarSign} tone="emerald" />
        <KpiCard label="Nuitées" value={stats.nights} icon={BedDouble} tone="blue" />
        <KpiCard
          label="Top segment"
          value={stats.top?.segment ?? '—'}
          icon={BarChart3}
          tone="amber"
          sub={stats.top ? `${Number(stats.top.part_pct).toFixed(1)}% du CA · ADR ${Math.round(Number(stats.top.adr))}€` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" />
            Répartition CA par segment
          </h3>
          <DonutChart
            data={donutData}
            centerLabel="Segments"
            centerValue={`${stats.segments}`}
            unitFormatter={(v) => `${Math.round(v)}€`}
          />
        </div>
        <DataTable data={rows} columns={columns} stickyHeader />
      </div>
    </div>
  );
};
