/**
 * FLOWTYM — Insights Registry
 *
 * Map<reportId, computeInsights> pour ré-utilisation depuis l'export
 * et le briefing IA (vague 6).
 */

import type { Insight } from '../../components/analysis/insights/types';
import {
  computeInsights21008, computeInsights21013, computeInsights54001,
  computeInsights54002, computeInsights54004, computeInsights51060,
  computeInsights51010, computeInsights41003, computeInsights61001,
} from '../../components/analysis/insights/computers';

type Computer = (rows: any[]) => Insight[];

export const INSIGHTS_REGISTRY: Record<string, Computer> = {
  '21008': computeInsights21008 as Computer,
  '21013': computeInsights21013 as Computer,
  '54001': computeInsights54001 as Computer,
  '54002': computeInsights54002 as Computer,
  '54004': computeInsights54004 as Computer,
  '51060': computeInsights51060 as Computer,
  '51010': computeInsights51010 as Computer,
  '41003': computeInsights41003 as Computer,
  '61001': computeInsights61001 as Computer,
};

export function computeInsightsFor(reportId: string, rows: any[]): Insight[] {
  const fn = INSIGHTS_REGISTRY[reportId];
  return fn ? fn(rows) : [];
}
