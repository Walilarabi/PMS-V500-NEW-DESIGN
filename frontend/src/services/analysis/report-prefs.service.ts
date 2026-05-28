/**
 * FLOWTYM — Analysis Report Preferences (Vague 8)
 *
 * Sync multi-device favoris / récents / vues sauvegardées :
 *   - Source de vérité : Supabase (tables analysis_user_favorites/recent/saved_views)
 *   - Cache local : localStorage (lectures synchrones offline-friendly)
 *
 * Stratégie write-through : chaque action écrit local + Supabase (best-effort).
 * Stratégie read : retourne le cache local immédiatement, hydraté en arrière-plan
 * via les fonctions `sync*` à appeler au mount des vues.
 */

import { supabase } from '../../lib/supabase';

const FAVORITES_KEY = 'flowtym_analysis_favorites';
const RECENT_KEY = 'flowtym_analysis_recent';
const SAVED_VIEWS_KEY = 'flowtym_analysis_saved_views';
const MAX_RECENT = 10;

export interface SavedView {
  id: string;
  reportId: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface RecentEntry {
  reportId: string;
  visitedAt: string;
}

// ─── Auth helper ─────────────────────────────────────────────────────────

async function getAuthContext(): Promise<{ userId: string | null; hotelId: string | null }> {
  try {
    const [{ data: userData }, { data: hotelData }] = await Promise.all([
      supabase.auth.getUser(),
      (supabase.rpc as any)('get_user_hotel_id'),
    ]);
    return {
      userId: userData?.user?.id ?? null,
      hotelId: hotelData ? String(hotelData) : null,
    };
  } catch {
    return { userId: null, hotelId: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFavorite(reportId: string): boolean {
  return getFavorites().includes(reportId);
}

function persistFavoritesLocal(list: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}

export function toggleFavorite(reportId: string): boolean {
  const list = getFavorites();
  const idx = list.indexOf(reportId);
  const added = idx < 0;
  if (added) list.unshift(reportId);
  else list.splice(idx, 1);
  persistFavoritesLocal(list);

  // Sync Supabase (fire-and-forget)
  void (async () => {
    const { userId, hotelId } = await getAuthContext();
    if (!userId || !hotelId) return;
    if (added) {
      await supabase.from('analysis_user_favorites')
        .upsert({ user_id: userId, hotel_id: hotelId, report_id: reportId }, { onConflict: 'user_id,hotel_id,report_id' });
    } else {
      await supabase.from('analysis_user_favorites')
        .delete()
        .eq('user_id', userId).eq('hotel_id', hotelId).eq('report_id', reportId);
    }
  })();

  return added;
}

/** À appeler au mount : récupère favoris depuis Supabase, merge avec local. */
export async function syncFavorites(): Promise<string[]> {
  const { userId, hotelId } = await getAuthContext();
  if (!userId || !hotelId) return getFavorites();

  const { data, error } = await supabase
    .from('analysis_user_favorites')
    .select('report_id, created_at')
    .order('created_at', { ascending: false });
  if (error) return getFavorites();

  const remote = (data ?? []).map(r => r.report_id);
  const local = getFavorites();
  // Merge : union, en gardant l'ordre Supabase puis ajouts locaux non syncés
  const merged = [...remote, ...local.filter(id => !remote.includes(id))];
  persistFavoritesLocal(merged);

  // Push éventuels favoris locaux non présents sur Supabase
  const missing = local.filter(id => !remote.includes(id));
  if (missing.length > 0) {
    await supabase.from('analysis_user_favorites').upsert(
      missing.map(report_id => ({ user_id: userId, hotel_id: hotelId, report_id })),
      { onConflict: 'user_id,hotel_id,report_id' }
    );
  }
  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT
// ═══════════════════════════════════════════════════════════════════════════

export function getRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecent(reportId: string) {
  const list = getRecent().filter(r => r.reportId !== reportId);
  list.unshift({ reportId, visitedAt: new Date().toISOString() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));

  // Sync Supabase via RPC dédié (qui gère le upsert + élagage)
  void (async () => {
    try { await (supabase.rpc as any)('push_user_recent', { p_report_id: reportId }); }
    catch { /* offline */ }
  })();
}

export function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
  void (async () => {
    const { userId, hotelId } = await getAuthContext();
    if (!userId || !hotelId) return;
    await supabase.from('analysis_user_recent')
      .delete().eq('user_id', userId).eq('hotel_id', hotelId);
  })();
}

export async function syncRecent(): Promise<RecentEntry[]> {
  const { userId, hotelId } = await getAuthContext();
  if (!userId || !hotelId) return getRecent();

  const { data, error } = await supabase
    .from('analysis_user_recent')
    .select('report_id, visited_at')
    .order('visited_at', { ascending: false })
    .limit(MAX_RECENT);
  if (error) return getRecent();

  const remote: RecentEntry[] = (data ?? []).map(r => ({
    reportId: r.report_id,
    visitedAt: r.visited_at,
  }));
  localStorage.setItem(RECENT_KEY, JSON.stringify(remote));
  return remote;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVED VIEWS
// ═══════════════════════════════════════════════════════════════════════════

export function getSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedViewsFor(reportId: string): SavedView[] {
  return getSavedViews().filter(v => v.reportId === reportId);
}

function persistSavedViewsLocal(list: SavedView[]) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(list));
}

export function saveView(input: { reportId: string; name: string; filters: Record<string, unknown> }): SavedView {
  const now = new Date().toISOString();
  const view: SavedView = {
    id: `view_${Date.now()}_${Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
    reportId: input.reportId,
    name: input.name.trim(),
    filters: input.filters,
    createdAt: now,
    updatedAt: now,
  };
  const list = getSavedViews();
  list.unshift(view);
  persistSavedViewsLocal(list);

  // Supabase
  void (async () => {
    const { userId, hotelId } = await getAuthContext();
    if (!userId || !hotelId) return;
    const { data, error } = await supabase.from('analysis_saved_views').insert({
      user_id: userId,
      hotel_id: hotelId,
      report_id: view.reportId,
      name: view.name,
      filters: view.filters,
    }).select('*').single();
    if (!error && data) {
      // Mettre à jour l'ID local avec celui généré par Supabase
      const updated = getSavedViews();
      const idx = updated.findIndex(v => v.id === view.id);
      if (idx >= 0) {
        updated[idx] = {
          ...view,
          id: data.id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        persistSavedViewsLocal(updated);
      }
    }
  })();

  return view;
}

export function deleteSavedView(id: string) {
  const list = getSavedViews().filter(v => v.id !== id);
  persistSavedViewsLocal(list);
  void (async () => {
    const { userId, hotelId } = await getAuthContext();
    if (!userId || !hotelId) return;
    await supabase.from('analysis_saved_views').delete()
      .eq('id', id).eq('user_id', userId).eq('hotel_id', hotelId);
  })();
}

export function renameSavedView(id: string, newName: string) {
  const list = getSavedViews().map(v =>
    v.id === id ? { ...v, name: newName.trim(), updatedAt: new Date().toISOString() } : v
  );
  persistSavedViewsLocal(list);
  void (async () => {
    const { userId, hotelId } = await getAuthContext();
    if (!userId || !hotelId) return;
    await supabase.from('analysis_saved_views')
      .update({ name: newName.trim(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId).eq('hotel_id', hotelId);
  })();
}

export async function syncSavedViews(): Promise<SavedView[]> {
  const { userId, hotelId } = await getAuthContext();
  if (!userId || !hotelId) return getSavedViews();

  const { data, error } = await supabase
    .from('analysis_saved_views')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return getSavedViews();

  const remote: SavedView[] = (data ?? []).map(v => ({
    id: v.id,
    reportId: v.report_id,
    name: v.name,
    filters: (v.filters ?? {}) as Record<string, unknown>,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  }));
  persistSavedViewsLocal(remote);
  return remote;
}

// ─── Sync globale au login ───────────────────────────────────────────────

export async function syncAllPreferences(): Promise<void> {
  await Promise.all([
    syncFavorites().catch(() => null),
    syncRecent().catch(() => null),
    syncSavedViews().catch(() => null),
  ]);
}
