/**
 * 54001 — RevPAR journalier (avec comparaison N-1 si demandée)
 */

import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, BedDouble, BarChart3 } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { TrendChart } from '../../../../components/analysis/TrendChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import { computeInsights54001 } from '../../../../components/analysis/insights/computers';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  date: string;
  revenue: number;
  rooms_sold: number;
  rooms_available: number;
  adr: number;
  occupancy_pct: number;
  revpar: number;
  revenue_n_1: number;
  revpar_n_1: number;
}

export const Renderer54001: ReportRenderer = ({ data, filters }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    if (rows.length === 0) return { revparMoy: 0, revparN1: 0, revenueTotal: 0, occMoy: 0, adrMoy: 0 };
    const revparTotal = rows.reduce((s, r) => s + Number(r.revpar || 0), 0);
    const revparN1Total = rows.reduce((s, r) => s + Number(r.revpar_n_1 || 0), 0);
    const revenueTotal = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const occTotal = rows.reduce((s, r) => s + Number(r.occupancy_pct || 0), 0);
    const adrSum = rows.reduce((s, r) => s + Number(r.adr || 0), 0);
    return {
      revparMoy: Math.round(revparTotal / rows.length),
      revparN1: Math.round(revparN1Total / rows.length),
      revenueTotal,
      occMoy: Math.round(occTotal / rows.length),
      adrMoy: Math.round(adrSum / rows.length),
    };
  }, [rows]);

  const chartData = rows.map(r => ({
    date: r.date.slice(5),
    RevPAR: Math.round(Number(r.revpar || 0)),
    'RevPAR N-1': Math.round(Number(r.revpar_n_1 || 0)),
    ADR: Math.round(Number(r.adr || 0)),
  }));

  const showN1 = filters.comparison === 'N-1';

  const series = [
    { key: 'RevPAR', label: 'RevPAR', color: '#8B5CF6', area: true },
    { key: 'ADR', label: 'ADR', color: '#3B82F6' },
    ...(showN1 ? [{ key: 'RevPAR N-1', label: 'RevPAR N-1', color: '#94A3B8', dashed: true }] : []),
  ];

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) },
    { accessorKey: 'rooms_sold', header: 'Vendues', cell: ({ getValue, row }) => `${getValue() ?? 0} / ${row.original.rooms_available}` },
    { accessorKey: 'occupancy_pct', header: 'TO%', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
    { accessorKey: 'revenue', header: 'CA', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'revpar', header: 'RevPAR', cell: ({ getValue }) => <span className="font-bold text-violet-700">{Math.round(Number(getValue() ?? 0))}€</span> },
    ...(showN1 ? [{
      accessorKey: 'revpar_n_1',
      header: 'RevPAR N-1',
      cell: ({ getValue }: { getValue: () => unknown }) => <span className="text-gray-500">{Math.round(Number(getValue() ?? 0))}€</span>,
    } satisfies ColumnDef<Row>] : []),
  ];

  const insights = useMemo(() => computeInsights54001(rows), [rows]);

  return (
    <div className="space-y-4">
      <InsightsPanel insights={insights} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="RevPAR moyen"
          value={`${stats.revparMoy}€`}
          icon={TrendingUp}
          tone="violet"
          comparison={showN1 ? { current: stats.revparMoy, baseline: stats.revparN1, label: 'vs N-1' } : undefined}
        />
        <KpiCard label="CA total période" value={`${Math.round(stats.revenueTotal / 1000)}K€`} icon={DollarSign} tone="emerald" />
        <KpiCard label="Occupation moy." value={`${stats.occMoy}%`} icon={BedDouble} tone={stats.occMoy >= 75 ? 'positive' : stats.occMoy >= 50 ? 'amber' : 'negative'} />
        <KpiCard label="ADR moyen" value={`${stats.adrMoy}€`} icon={BarChart3} tone="blue" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          RevPAR & ADR — évolution {showN1 && '· comparaison N-1'}
        </h3>
        <TrendChart data={chartData} xKey="date" series={series} variant="area" yTickFormatter={(v) => `${v}€`} />
      </div>

      <DataTable data={rows} columns={columns} stickyHeader maxHeight="500px" />
    </div>
  );
};
