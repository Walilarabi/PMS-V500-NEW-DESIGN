/**
 * FLOWTYM — Daily Briefing
 *
 * Lit en parallèle les 4-5 RPCs clés (RevPAR, activité, pickup, canaux, etc.)
 * sur la période courante (7-30 jours), agrège les insights et renvoie un
 * "briefing matinal" pour le Dashboard Analyse.
 *
 * Bonus : sépare les insights par sévérité, calcule des KPIs de pilotage.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { computeInsightsFor } from '../../services/analysis/insights-registry';
import { countUnacknowledged } from '../../services/analysis/alerts.service';
import type { Insight } from '../../components/analysis/insights/types';

const KEY_REPORT_IDS = ['54001', '21008', '21013', '54004'] as const;
type ReportId = typeof KEY_REPORT_IDS[number];

const ALLOWED_RPC_NAMES: ReadonlyMap<ReportId, string> = new Map([
  ['54001', 'analytics_54001'],
  ['21008', 'analytics_21008'],
  ['21013', 'analytics_21013'],
  ['54004', 'analytics_54004'],
]);

export interface DailyBriefing {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  insights: Insight[];
  byseverity: {
    critical: Insight[];
    warning: Insight[];
    positive: Insight[];
    info: Insight[];
  };
  kpis: {
    revparMoy: number;
    revparN1: number;
    occMoy: number;
    revenueTotal: number;
    arrivees7j: number;
    departs7j: number;
  };
  alertsUnackCount: number;
  sourceCount: { supabase: number; mock: number };
}

async function loadReport(reportId: ReportId, p_start_date: string, p_end_date: string): Promise<{ rows: any[]; source: 'supabase' | 'mock' }> {
  const rpcName = ALLOWED_RPC_NAMES.get(reportId);
  if (!rpcName) return { rows: [], source: 'mock' };
  try {
    const { data, error } = await (supabase.rpc as any)(rpcName, {
      p_start_date,
      p_end_date,
      p_granularity: 'day',
      p_comparison: 'N-1',
    });
    if (!error && Array.isArray(data)) {
      return { rows: data, source: 'supabase' };
    }
  } catch (e) {
    console.warn(`[briefing] RPC ${rpcName} failed`, e);
  }
  return { rows: [], source: 'mock' };
}

function severityRank(s: Insight['severity']): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : s === 'positive' ? 2 : 3;
}

export function useDailyBriefing() {
  return useQuery<DailyBriefing>({
    queryKey: ['analysis-daily-briefing'],
    queryFn: async () => {
      const today = new Date();
      const start = new Date();
      start.setDate(today.getDate() - 13); // 14 jours pour stats robustes
      const p_start_date = start.toISOString().slice(0, 10);
      const p_end_date = today.toISOString().slice(0, 10);

      // Appels parallèles
      const results = await Promise.all(KEY_REPORT_IDS.map(id => loadReport(id as ReportId, p_start_date, p_end_date)));

      // Agrégation insights par rapport
      const allInsights: Insight[] = [];
      let supaCount = 0;
      let mockCount = 0;
      KEY_REPORT_IDS.forEach((id, idx) => {
        const r = results[idx];
        if (r.source === 'supabase') supaCount++; else mockCount++;
        const ins = computeInsightsFor(id, r.rows);
        // Préfixer l'ID rapport pour éviter les collisions
        ins.forEach(i => allInsights.push({ ...i, id: `${id}.${i.id}` }));
      });

      // Trier : critical > warning > positive > info, puis garder Top 8
      const sortedInsights = allInsights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

      // KPIs depuis 54001
      const revparRows = results[0].rows as Array<{ revpar: number; revpar_n_1: number; occupancy_pct: number; revenue: number }>;
      const revparMoy = revparRows.length > 0 ? revparRows.reduce((s, r) => s + Number(r.revpar || 0), 0) / revparRows.length : 0;
      const revparN1 = revparRows.length > 0 ? revparRows.reduce((s, r) => s + Number(r.revpar_n_1 || 0), 0) / revparRows.length : 0;
      const occMoy = revparRows.length > 0 ? revparRows.reduce((s, r) => s + Number(r.occupancy_pct || 0), 0) / revparRows.length : 0;
      const revenueTotal = revparRows.reduce((s, r) => s + Number(r.revenue || 0), 0);

      // Arrivées / départs 7j depuis 21008
      const actRows = results[1].rows as Array<{ arrivees: number; departs: number }>;
      const arrivees7j = actRows.slice(-7).reduce((s, r) => s + Number(r.arrivees || 0), 0);
      const departs7j = actRows.slice(-7).reduce((s, r) => s + Number(r.departs || 0), 0);

      // Alertes non acquittées
      const alertsUnackCount = await countUnacknowledged().catch(() => 0);

      return {
        generatedAt: new Date().toISOString(),
        period: { startDate: p_start_date, endDate: p_end_date },
        insights: sortedInsights,
        byseverity: {
          critical: sortedInsights.filter(i => i.severity === 'critical'),
          warning: sortedInsights.filter(i => i.severity === 'warning'),
          positive: sortedInsights.filter(i => i.severity === 'positive'),
          info: sortedInsights.filter(i => i.severity === 'info'),
        },
        kpis: {
          revparMoy: Math.round(revparMoy),
          revparN1: Math.round(revparN1),
          occMoy: Math.round(occMoy),
          revenueTotal,
          arrivees7j,
          departs7j,
        },
        alertsUnackCount,
        sourceCount: { supabase: supaCount, mock: mockCount },
      };
    },
    staleTime: 10 * 60 * 1000, // 10 min
    refetchOnWindowFocus: false,
  });
}
