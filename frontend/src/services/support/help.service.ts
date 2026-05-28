import { supabase } from '@/src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HelpArticle {
  id: string;
  module: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string;
  tags: string[];
  sort_order: number;
  is_published: boolean;
  view_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertArticleInput {
  id?: string;
  module: string;
  title: string;
  excerpt?: string;
  body: string;
  tags?: string[];
  sort_order?: number;
  is_published?: boolean;
}

// Modules de documentation — alignés sur la navigation principale
export const HELP_MODULES = [
  'Flowday',
  'SAS',
  'Réservations',
  'Clients',
  'Revenue',
  'Finance',
  'Analyse',
  'Paramètres',
  'Aide & Support',
] as const;

// ─── Repository ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('help_articles');

export async function listArticles(opts?: { includeUnpublished?: boolean }): Promise<HelpArticle[]> {
  let q = table().select('*').order('module', { ascending: true }).order('sort_order', { ascending: true });
  if (!opts?.includeUnpublished) q = q.eq('is_published', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HelpArticle[];
}

export async function getArticle(id: string): Promise<HelpArticle | null> {
  const { data, error } = await table().select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as HelpArticle | null;
}

export async function upsertArticle(input: UpsertArticleInput): Promise<HelpArticle> {
  const payload = {
    module:       input.module,
    title:        input.title,
    excerpt:      input.excerpt ?? null,
    body:         input.body,
    tags:         input.tags ?? [],
    sort_order:   input.sort_order ?? 0,
    is_published: input.is_published ?? false,
  };
  const query = input.id
    ? table().update(payload).eq('id', input.id).select('*').single()
    : table().insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data as HelpArticle;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id);
  if (error) throw error;
}

export async function incrementViewCount(id: string, current: number): Promise<void> {
  await table().update({ view_count: current + 1 }).eq('id', id);
}
