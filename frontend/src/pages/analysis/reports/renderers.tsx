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
import { Renderer51010 } from './renderers/Renderer51010';
import { Renderer41003 } from './renderers/Renderer41003';
import { Renderer61001 } from './renderers/Renderer61001';
import {
  Renderer11001, Renderer11005, Renderer11006, Renderer11009, Renderer11010,
  Renderer21001, Renderer21002, Renderer21009, Renderer51020, Renderer54003,
} from './renderers/RenderersVague7';

export interface ReportRendererProps {
  data: Array<Record<string, unknown>>;
  filters: ReportFilters;
  isLoading?: boolean;
  source: 'supabase' | 'mock';
}

export type ReportRenderer = React.FC<ReportRendererProps>;

// Map id → renderer.
export const REPORT_RENDERERS: Record<string, ReportRenderer> = {
  // Vague 3
  '21008': Renderer21008,
  '21013': Renderer21013,
  '54001': Renderer54001,
  '54002': Renderer54002,
  '54004': Renderer54004,
  '51060': Renderer51060,
  // Vague 4
  '51010': Renderer51010,
  '41003': Renderer41003,
  '61001': Renderer61001,
  // Vague 7
  '11001': Renderer11001,
  '11005': Renderer11005,
  '11006': Renderer11006,
  '11009': Renderer11009,
  '11010': Renderer11010,
  '21001': Renderer21001,
  '21002': Renderer21002,
  '21009': Renderer21009,
  '51020': Renderer51020,
  '54003': Renderer54003,
};

export function registerRenderer(reportId: string, renderer: ReportRenderer) {
  REPORT_RENDERERS[reportId] = renderer;
}
