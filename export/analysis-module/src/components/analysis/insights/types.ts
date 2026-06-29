/**
 * FLOWTYM — Report Insights
 *
 * Système réutilisable d'insights automatiques par rapport.
 * Chaque rapport peut fournir une fonction `computeInsights(rows, filters)`
 * qui retourne une liste de signaux actionnables affichés au-dessus des KPIs.
 */

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target } from 'lucide-react';

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';

export interface InsightAction {
  label: string;
  page?: string;               // PageId à ouvrir (event 'navigate')
  href?: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  action?: InsightAction;
}

export const SEVERITY_STYLE: Record<InsightSeverity, { icon: LucideIcon; bg: string; border: string; text: string; iconColor: string }> = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-800',     iconColor: 'text-red-600' },
  warning:  { icon: AlertTriangle, bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   iconColor: 'text-amber-600' },
  positive: { icon: TrendingUp,    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconColor: 'text-emerald-600' },
  info:     { icon: Lightbulb,     bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    iconColor: 'text-blue-600' },
};

// Re-export utilisés par certains insight computers
export { TrendingDown, Target };
