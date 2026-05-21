/**
 * 54004 — Pickup curve (distribution lead time réservation → arrivée)
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { TrendingUp, Calendar, Activity, Hash } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DataTable } from '../../../../components/analysis/DataTable';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  bucket: string;
  bucket_order: number;
  reservations: number;
  nuitees: number;
  ca_total: number;
  part_pct: number;
}

const BUCKET_COLOR = (order: number): string => {
  if (order <= 2) return '#F43F5E'; // last minute = rouge
  if (order <= 4) return '#F59E0B'; // courte = orange
  if (order <= 6) return '#3B82F6'; // moyenne = bleu
  return '#10B981';                 // longue = vert
};

export const Renderer54004: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.reservations || 0), 0);
    const ca = rows.reduce((s, r) => s + Number(r.ca_total || 0), 0);
    const lastMinute = rows.filter(r => r.bucket_order <= 2).reduce((s, r) => s + Number(r.part_pct || 0), 0);
    const longLead = rows.filter(r => r.bucket_order >= 6).reduce((s, r) => s + Number(r.part_pct || 0), 0);
    const peak = rows.reduce<Row | null>((best, r) => !best || Number(r.reservations) > Number(best.reservations) ? r : best, null);
    return { total, ca, lastMinute, longLead, peak };
  }, [rows]);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'bucket', header: 'Bucket', cell: ({ getValue }) => <span className="font-semibold">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'reservations', header: 'Réservations', cell: ({ getValue }) => <span className="font-bold">{getValue() as number ?? 0}</span> },
    { accessorKey: 'nuitees', header: 'Nuitées' },
    { accessorKey: 'ca_total', header: 'CA', cell: ({ getValue }) => `${Math.round(Number(getValue() ?? 0))}€` },
    { accessorKey: 'part_pct', header: 'Part', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Réservations" value={stats.total} icon={Hash} tone="violet" />
        <KpiCard label="CA total" value={`${Math.round(stats.ca / 1000)}K€`} icon={Activity} tone="emerald" />
        <KpiCard
          label="Last minute (≤J-3)"
          value={`${stats.lastMinute.toFixed(1)}%`}
          icon={TrendingUp}
          tone={stats.lastMinute >= 30 ? 'negative' : stats.lastMinute >= 15 ? 'amber' : 'positive'}
          sub="Pression conversion"
        />
        <KpiCard
          label="Long lead (≥J-60)"
          value={`${stats.longLead.toFixed(1)}%`}
          icon={Calendar}
          tone={stats.longLead >= 25 ? 'positive' : stats.longLead >= 15 ? 'amber' : 'negative'}
          sub={stats.peak ? `Pic : ${stats.peak.bucket}` : undefined}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          Distribution lead time — réservations par fenêtre
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="bucket" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="reservations" name="Réservations" radius={[4, 4, 0, 0]}>
              {rows.map((r) => <Cell key={r.bucket} fill={BUCKET_COLOR(r.bucket_order)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable data={rows} columns={columns} stickyHeader />
    </div>
  );
};
