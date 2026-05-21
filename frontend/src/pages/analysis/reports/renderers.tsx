/**
 * FLOWTYM — Report Renderers Registry
 *
 * Map<reportId, RendererComponent>. Chaque renderer reçoit data + filters
 * et rend le contenu spécifique au rapport (KPIs + charts + table).
 */

import React from 'react';
import type { ReportFilters } from '../ReportShell';
import { Renderer21008 } from './renderers/Renderer21008';
import { Renderer21013 } from './renderers/Renderer21013';
import { Renderer54001 } from './renderers/Renderer54001';
import { Renderer54002 } from './renderers/Renderer54002';
import { Renderer54004 } from './renderers/Renderer54004';
import { Renderer51060 } from './renderers/Renderer51060';

export interface ReportRendererProps {
  data: Array<Record<string, unknown>>;
  filters: ReportFilters;
  isLoading?: boolean;
  source: 'supabase' | 'mock';
}

export type ReportRenderer = React.FC<ReportRendererProps>;

// Map id → renderer.
export const REPORT_RENDERERS: Record<string, ReportRenderer> = {
  '21008': Renderer21008,
  '21013': Renderer21013,
  '54001': Renderer54001,
  '54002': Renderer54002,
  '54004': Renderer54004,
  '51060': Renderer51060,
};

export function registerRenderer(reportId: string, renderer: ReportRenderer) {
  REPORT_RENDERERS[reportId] = renderer;
}
