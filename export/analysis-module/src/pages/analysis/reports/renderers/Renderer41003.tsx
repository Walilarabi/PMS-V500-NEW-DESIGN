/**
 * 41003 — MC Règlements cumulés (par mode de paiement)
 */

import React, { useMemo } from 'react';
import { CreditCard, Banknote, Receipt, Calculator } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DonutChart } from '../../../../components/analysis/DonutChart';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import { computeInsights41003 } from '../../../../components/analysis/insights/computers';
import type { ReportRenderer } from '../renderers';
import type { ColumnDef } from '@tanstack/react-table';

interface Row {
  payment_method: string;
  payment_type: string;
  nb_transactions: number;
  montant_total: number;
  part_pct: number;
}

const METHOD_COLORS: Record<string, string> = {
  'carte':   '#3B82F6',
  'cb':      '#3B82F6',
  'card':    '#3B82F6',
  'visa':    '#1E40AF',
  'mastercard': '#1E40AF',
  'amex':    '#0EA5E9',
  'espece':  '#10B981',
  'especes': '#10B981',
  'cash':    '#10B981',
  'cheque':  '#F59E0B',
  'check':   '#F59E0B',
  'virement':'#8B5CF6',
  'transfer':'#8B5CF6',
  'debiteur':'#F43F5E',
};
const FALLBACK = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

function colorFor(method: string, i: number): string {
  const k = method.toLowerCase();
  for (const [key, color] of Object.entries(METHOD_COLORS)) {
    if (k.includes(key)) return color;
  }
  return FALLBACK[i % FALLBACK.length];
}

export const Renderer41003: ReportRenderer = ({ data }) => {
  const rows = data as unknown as Row[];

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.montant_total || 0), 0);
    const tx = rows.reduce((s, r) => s + Number(r.nb_transactions || 0), 0);
    const moyTx = tx > 0 ? Math.round(total / tx) : 0;
    const top = rows[0];
    return { total, tx, moyTx, top, methodCount: rows.length };
  }, [rows]);

  const donutData = rows.map((r, i) => ({
    key: r.payment_method,
    label: r.payment_method,
    value: Number(r.montant_total || 0),
    color: colorFor(r.payment_method, i),
  }));

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'payment_method', header: 'Mode', cell: ({ getValue }) => <span className="font-semibold capitalize">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'payment_type', header: 'Type', cell: ({ getValue }) => <span className="text-gray-500 text-xs">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'nb_transactions', header: 'Transactions' },
    { accessorKey: 'montant_total', header: 'Montant', cell: ({ getValue }) => <span className="font-bold">{Math.round(Number(getValue() ?? 0))}€</span> },
    { accessorKey: 'part_pct', header: 'Part', cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%` },
  ];

  const insights = useMemo(() => computeInsights41003(rows), [rows]);

  return (
    <div className="space-y-4">
      <InsightsPanel insights={insights} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Montant total" value={`${Math.round(stats.total / 1000)}K€`} icon={Banknote} tone="emerald" />
        <KpiCard label="Transactions" value={stats.tx} icon={Receipt} tone="violet" />
        <KpiCard label="Ticket moyen" value={`${stats.moyTx}€`} icon={Calculator} tone="blue" />
        <KpiCard
          label="Mode dominant"
          value={stats.top?.payment_method ?? '—'}
          icon={CreditCard}
          tone="amber"
          sub={stats.top ? `${Number(stats.top.part_pct).toFixed(1)}% des règlements` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-violet-500" />
            Répartition par mode de paiement
          </h3>
          <DonutChart
            data={donutData}
            centerLabel="Modes"
            centerValue={`${stats.methodCount}`}
            unitFormatter={(v) => `${Math.round(v)}€`}
          />
        </div>
        <DataTable data={rows} columns={columns} stickyHeader />
      </div>
    </div>
  );
};
