/**
 * 61001 — État quotidien des chambres (housekeeping + occupation)
 */

import React, { useMemo } from 'react';
import { Sparkles, BedDouble, Lock, AlertTriangle } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import { computeInsights61001 } from '../../../../components/analysis/insights/computers';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  housekeeping_status: string;
  occupation_status: string;
  nb_chambres: number;
  numeros: string[];
}

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

function statusBadge(status: string): { label: string; bg: string; text: string } {
  const s = status.toLowerCase();
  if (/propre|clean/.test(s))    return { label: 'Propre', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (/sale|dirty/.test(s))      return { label: 'Sale',   bg: 'bg-amber-100',   text: 'text-amber-800' };
  if (/cours|progress/.test(s))  return { label: 'En cours', bg: 'bg-blue-100',  text: 'text-blue-800' };
  if (/inspect/.test(s))         return { label: 'Inspectée', bg: 'bg-violet-100', text: 'text-violet-800' };
  if (/oos|hors|out/.test(s))    return { label: 'Hors service', bg: 'bg-red-100', text: 'text-red-800' };
  return { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
}

export const Renderer61001: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    let propres = 0, sales = 0, occupees = 0, libres = 0, hs = 0;
    let total = 0;
    rows.forEach(r => {
      const n = Number(r.nb_chambres || 0);
      total += n;
      const s = r.housekeeping_status.toLowerCase();
      if (/propre|clean/.test(s)) propres += n;
      if (/sale|dirty/.test(s)) sales += n;
      if (/oos|hors|out/.test(s)) hs += n;
      if (r.occupation_status === 'Occupée') occupees += n;
      else libres += n;
    });
    return { propres, sales, occupees, libres, hs, total, occRate: total > 0 ? Math.round(occupees / total * 100) : 0 };
  }, [rows]);

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: 'housekeeping_status',
      header: 'Statut ménage',
      cell: ({ getValue }) => {
        const b = statusBadge(String(getValue() ?? '—'));
        return <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-semibold', b.bg, b.text)}>{b.label}</span>;
      },
    },
    {
      accessorKey: 'occupation_status',
      header: 'Occupation',
      cell: ({ getValue }) => {
        const v = String(getValue() ?? '');
        return <span className={cn(
          'inline-block px-2 py-0.5 rounded text-xs font-semibold',
          v === 'Occupée' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
        )}>{v}</span>;
      },
    },
    { accessorKey: 'nb_chambres', header: 'Nombre', cell: ({ getValue }) => <span className="font-bold">{getValue() as number ?? 0}</span> },
    {
      accessorKey: 'numeros',
      header: 'N° chambres',
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {arr.slice(0, 12).map(n => (
              <span key={n} className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 rounded">{n}</span>
            ))}
            {arr.length > 12 && <span className="text-[10px] text-gray-400">+ {arr.length - 12}</span>}
          </div>
        );
      },
    },
  ];

  const insights = useMemo(() => computeInsights61001(rows), [rows]);

  return (
    <div className="space-y-4">
      <InsightsPanel insights={insights} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total chambres" value={stats.total} icon={BedDouble} tone="violet" />
        <KpiCard label="Occupées" value={stats.occupees} icon={Lock} tone="blue" sub={`${stats.occRate}% du parc`} />
        <KpiCard label="Propres" value={stats.propres} icon={Sparkles} tone="positive" />
        <KpiCard label="Sales" value={stats.sales} icon={AlertTriangle} tone={stats.sales >= 10 ? 'negative' : 'amber'} />
        <KpiCard label="Hors service" value={stats.hs} icon={Lock} tone={stats.hs > 0 ? 'negative' : 'neutral'} />
      </div>

      <DataTable data={rows} columns={columns} stickyHeader />
    </div>
  );
};
