/**
 * Renderer générique pour rapports "liste" : KPIs auto-calculés + table TanStack.
 * Utilisé pour les rapports tabulaires sans graphique spécifique.
 */

import React, { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Hash, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { KpiCard } from '../../../../components/analysis/KpiCard';
import { DataTable } from '../../../../components/analysis/DataTable';
import { InsightsPanel } from '../../../../components/analysis/insights/InsightsPanel';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReportRendererProps } from '../renderers';
import type { Insight } from '../../../../components/analysis/insights/types';

export interface GenericListReportProps extends ReportRendererProps {
  columns: ColumnDef<any>[];
  kpis?: Array<{
    label: string;
    icon?: LucideIcon;
    tone?: 'default' | 'violet' | 'blue' | 'emerald' | 'amber' | 'positive' | 'negative';
    compute: (rows: any[]) => string | number;
    sub?: (rows: any[]) => string | undefined;
  }>;
  insights?: Insight[];
  emptyMessage?: string;
  pageSize?: number;
}

export const GenericListReport: React.FC<GenericListReportProps> = ({
  data, columns, kpis = [], insights = [], emptyMessage, pageSize = 25,
}) => {
  const rows = data;

  const computedKpis = useMemo(() => {
    if (kpis.length === 0) {
      // KPIs auto par défaut
      return [
        { label: 'Lignes', value: String(rows.length), icon: Hash, tone: 'default' as const, sub: undefined },
      ];
    }
    return kpis.map(k => ({
      label: k.label,
      value: String(k.compute(rows)),
      icon: k.icon ?? Hash,
      tone: k.tone ?? 'default',
      sub: k.sub?.(rows),
    }));
  }, [rows, kpis]);

  return (
    <div className="space-y-4">
      {insights.length > 0 && <InsightsPanel insights={insights} />}
      {computedKpis.length > 0 && (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(computedKpis.length, 4)} gap-3`}>
          {computedKpis.map((k, i) => (
            <KpiCard key={i} label={k.label} value={k.value} icon={k.icon} tone={k.tone} sub={k.sub} />
          ))}
        </div>
      )}
      <DataTable
        data={rows}
        columns={columns}
        stickyHeader
        maxHeight="600px"
        pageSize={pageSize}
        emptyMessage={emptyMessage ?? 'Aucune donnée'}
      />
    </div>
  );
};

// Helpers communs
export const sumOf = (rows: any[], key: string) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
export const avgOf = (rows: any[], key: string) => rows.length > 0 ? rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length : 0;
export const countWhere = (rows: any[], pred: (r: any) => boolean) => rows.filter(pred).length;
export const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}€`;
