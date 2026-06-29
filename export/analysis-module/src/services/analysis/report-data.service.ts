/**
 * FLOWTYM — Report Data Service
 *
 * Façade unique pour charger les données des rapports. Chaque rapport
 * possède un `loaderKey` (souvent identique à son `reportId`) qui mappe
 * vers une RPC Supabase ou un fallback mock.
 *
 * Convention RPC : `analytics_<loaderKey>` (ex: analytics_revenue_summary).
 * Tant qu'une RPC n'existe pas, le loader renvoie un mock structuré
 * identifié comme `source: 'mock'` pour qu'on sache distinguer.
 */

import { supabase } from '../../lib/supabase';
import type { ReportFilters } from '../../pages/analysis/ReportShell';

export interface ReportData<T = unknown> {
  source: 'supabase' | 'mock';
  rows: T[];
  meta?: Record<string, unknown>;
  warnings?: string[];
}

export interface ReportLoaderContext {
  reportId: string;
  filters: ReportFilters;
  hotelId?: string | null;
}

type Loader = (ctx: ReportLoaderContext) => Promise<ReportData>;

// ─── Registry des loaders ────────────────────────────────────────────────

const LOADERS: Record<string, Loader> = {};

export function registerLoader(reportId: string, loader: Loader) {
  LOADERS[reportId] = loader;
}

/**
 * Charge les données d'un rapport. Tente d'abord la RPC Supabase, puis le loader registry.
 */
export async function loadReport(ctx: ReportLoaderContext): Promise<ReportData> {
  const custom = LOADERS[ctx.reportId];
  if (custom) {
    return custom(ctx);
  }

  // Tentative RPC standard : analytics_<reportId avec . remplacé par _>
  const rpcName = `analytics_${ctx.reportId.replace(/\./g, '_')}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(rpcName, {
      p_start_date: ctx.filters.startDate,
      p_end_date: ctx.filters.endDate,
      p_granularity: ctx.filters.granularity,
      p_comparison: ctx.filters.comparison,
    });
    if (!error && Array.isArray(data)) {
      return { source: 'supabase', rows: data };
    }
    if (error) {
      console.warn(`[analytics] RPC ${rpcName} failed:`, error.message);
    }
  } catch (e) {
    console.warn(`[analytics] RPC ${rpcName} threw:`, e);
  }

  // Fallback : mock vide
  return {
    source: 'mock',
    rows: [],
    warnings: [`RPC ${rpcName} non implémentée. Affichage placeholder.`],
  };
}

/**
 * Helper : enregistre un loader qui renvoie des données mockées générées.
 * Utile en vague 2 le temps que les RPCs soient créées.
 */
export function registerMockLoader<T>(reportId: string, generator: (ctx: ReportLoaderContext) => T[]) {
  registerLoader(reportId, async (ctx) => ({
    source: 'mock',
    rows: generator(ctx),
  }));
}
