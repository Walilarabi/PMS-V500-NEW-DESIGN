/**
 * 54002 — ADR par type de chambre
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { BedDouble, DollarSign, BarChart3, Users } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import { computeInsights54002 } from '../../../../components/analysis/insights/computers';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  room_type: string;
  reservations: number;
  nuitees: number;
  ca_total: number;
  adr: number;
  capacity: number;
}

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#A855F7'];

export const Renderer54002: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.ca_total || 0), 0);
    const nights = rows.reduce((s, r) => s + Number(r.nuitees || 0), 0);
    const totalCap = rows.reduce((s, r) => s + Number(r.capacity || 0), 0);
    const best = rows.reduce<Row | null>((best, r) => !best || Number(r.adr) > Number(best.adr) ? r : best, null);
    return {
      total,
      nights,
      adrGlobal: nights > 0 ? Math.round(total / nights) : 0,
      types: rows.length,
      best,
      totalCap,
    };
  }, [rows]);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'room_type', header: 'Type de chambre', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'capacity', header: 'Capacité', cell: ({ getValue }) => `${getValue() ?? 0} ch.` },
    { accessorKey: 'reservations', header: 'Résa.' },
    { accessorKey: 'nuitees', header: 'Nuitées' },
    { accessorKey: 'ca_total', header: 'CA Total', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'adr', header: 'ADR', cell: ({ getValue }) => <span className="font-bold text-violet-700">{Math.round(Number(getValue() ?? 0))}€</span> },
  ];

  const insights = useMemo(() => computeInsights54002(rows), [rows]);

  return (
    <div className="space-y-4">
      <InsightsPanel insights={insights} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CA Total" value={`${Math.round(stats.total / 1000)}K€`} icon={DollarSign} tone="emerald" />
        <KpiCard label="Nuitées" value={stats.nights} icon={BedDouble} tone="blue" />
        <KpiCard label="ADR global" value={`${stats.adrGlobal}€`} icon={BarChart3} tone="violet" />
        <KpiCard
          label="Meilleur ADR"
          value={`${Math.round(Number(stats.best?.adr ?? 0))}€`}
          icon={Users}
          tone="amber"
          sub={stats.best?.room_type ?? '—'}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-500" />
          ADR par type de chambre
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="room_type" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${v}€`} width={50} />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => `${Math.round(value)}€`}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            <Bar dataKey="adr" name="ADR" radius={[4, 4, 0, 0]}>
              {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable data={rows} columns={columns} stickyHeader />
    </div>
  );
};
