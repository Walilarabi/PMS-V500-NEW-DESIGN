/**
 * FLOWTYM — Report Renderers Registry
 *
 * Map<reportId, RendererComponent>. Chaque renderer reçoit data + filters
 * et rend le contenu spécifique au rapport (KPIs + charts + table).
 *
 * Les renderers de la vague 3 seront ajoutés ici.
 */

import React from 'react';
import type { ReportFilters } from '../ReportShell';

export interface ReportRendererProps {
  data: Array<Record<string, unknown>>;
  filters: ReportFilters;
  isLoading?: boolean;
  source: 'supabase' | 'mock';
}

export type ReportRenderer = React.FC<ReportRendererProps>;

// Map id → renderer. Sera enrichi en vague 3.
export const REPORT_RENDERERS: Record<string, ReportRenderer> = {};

export function registerRenderer(reportId: string, renderer: ReportRenderer) {
  REPORT_RENDERERS[reportId] = renderer;
}
