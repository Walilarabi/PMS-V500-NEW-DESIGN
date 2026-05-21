/**
 * FLOWTYM — Analysis Report Preferences
 *
 * Persistance localStorage pour :
 *   - Favoris (épinglage de rapports)
 *   - Récents (10 derniers consultés)
 *   - Vues sauvegardées (rapport + filtres + nom)
 *
 * Le pont Supabase pourra être ajouté plus tard (table user_report_prefs)
 * sans changer cette API.
 */

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

// ─── Favoris ──────────────────────────────────────────────────────────────

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFavorite(reportId: string): boolean {
  return getFavorites().includes(reportId);
}

export function toggleFavorite(reportId: string): boolean {
  const list = getFavorites();
  const idx = list.indexOf(reportId);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(reportId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  return idx < 0;
}

// ─── Récents ──────────────────────────────────────────────────────────────

interface RecentEntry {
  reportId: string;
  visitedAt: string;
}

export function getRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecent(reportId: string) {
  const list = getRecent().filter(r => r.reportId !== reportId);
  list.unshift({ reportId, visitedAt: new Date().toISOString() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

export function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}

// ─── Vues sauvegardées ────────────────────────────────────────────────────

export function getSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedViewsFor(reportId: string): SavedView[] {
  return getSavedViews().filter(v => v.reportId === reportId);
}

export function saveView(input: { reportId: string; name: string; filters: Record<string, unknown> }): SavedView {
  const now = new Date().toISOString();
  const view: SavedView = {
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    reportId: input.reportId,
    name: input.name.trim(),
    filters: input.filters,
    createdAt: now,
    updatedAt: now,
  };
  const list = getSavedViews();
  list.unshift(view);
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(list));
  return view;
}

export function deleteSavedView(id: string) {
  const list = getSavedViews().filter(v => v.id !== id);
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(list));
}

export function renameSavedView(id: string, newName: string) {
  const list = getSavedViews().map(v => v.id === id ? { ...v, name: newName.trim(), updatedAt: new Date().toISOString() } : v);
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(list));
}
