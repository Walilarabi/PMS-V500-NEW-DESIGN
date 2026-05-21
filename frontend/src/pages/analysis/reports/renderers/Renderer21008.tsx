/**
 * 21008 — Activité journalière (arrivées / départs / présents / TO%)
 */

import React, { useMemo } from 'react';
import { Calendar, Plane, Users, BedDouble } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { TrendChart } from '../../../../components/analysis/TrendChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  date: string;
  arrivees: number;
  departs: number;
  presents: number;
  occupation_pct: number;
}

export const Renderer21008: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    if (rows.length === 0) return { arrivees: 0, departs: 0, presents: 0, occMoy: 0 };
    return {
      arrivees: rows.reduce((s, r) => s + (r.arrivees || 0), 0),
      departs: rows.reduce((s, r) => s + (r.departs || 0), 0),
      presents: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.presents || 0), 0) / rows.length) : 0,
      occMoy: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + Number(r.occupation_pct || 0), 0) / rows.length) : 0,
    };
  }, [rows]);

  const chartData = rows.map(r => ({
    date: r.date.slice(5),
    Arrivées: r.arrivees,
    Départs: r.departs,
    Présents: r.presents,
  }));

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) },
    { accessorKey: 'arrivees', header: 'Arrivées', cell: ({ getValue }) => <span className="font-semibold text-emerald-700">{(getValue() as number) ?? 0}</span> },
    { accessorKey: 'departs',  header: 'Départs',  cell: ({ getValue }) => <span className="font-semibold text-blue-700">{(getValue() as number) ?? 0}</span> },
    { accessorKey: 'presents', header: 'Présents', cell: ({ getValue }) => <span className="font-bold">{(getValue() as number) ?? 0}</span> },
    { accessorKey: 'occupation_pct', header: 'Occupation', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Arrivées total" value={stats.arrivees} icon={Plane}    tone="emerald" />
        <KpiCard label="Départs total"  value={stats.departs}  icon={Plane}    tone="blue" />
        <KpiCard label="Présents moy."  value={stats.presents} icon={Users}    tone="violet" />
        <KpiCard label="Occupation moy."value={`${stats.occMoy}%`} icon={BedDouble} tone={stats.occMoy >= 75 ? 'positive' : stats.occMoy >= 50 ? 'amber' : 'negative'} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          Tendance arrivées / départs / présents
        </h3>
        <TrendChart
          data={chartData}
          xKey="date"
          series={[
            { key: 'Présents',  label: 'Présents',  color: '#8B5CF6', area: true },
            { key: 'Arrivées',  label: 'Arrivées',  color: '#10B981' },
            { key: 'Départs',   label: 'Départs',   color: '#3B82F6' },
          ]}
          variant="area"
        />
      </div>

      <DataTable data={rows} columns={columns} stickyHeader maxHeight="500px" />
    </div>
  );
};
