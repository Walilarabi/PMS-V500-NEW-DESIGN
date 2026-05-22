/**
 * FLOWTYM — Lighthouse Comparison Service
 *
 * Récupère les snapshots historiques pour alimenter la vue
 * "Comparaison dynamique" de la Veille Concurrentielle.
 *
 * Stratégie :
 *   - "vs Hier"  → import uploadé le plus proche d'hier
 *   - "vs J-3"   → import le plus proche d'il y a 3 jours
 *   - etc.
 *   - Fallback : N-ième import dans l'historique trié par date desc
 */

import { supabase } from '../lib/supabase';
import type { LighthouseImport } from './lighthouse-parser.service';

export interface HistoricalImportMeta {
  id: string;
  filename: string;
  processed_at: string;
  days_count: number;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveHotelId(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    if (data) return String(data);
  } catch { /* ignore */ }
  return null;
}

// ─── Lister tous les imports (actifs + archivés) ──────────────────────────

export async function listAllLighthouseImports(
  limit = 50,
): Promise<HistoricalImportMeta[]> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lighthouse_imports')
    .select('id, filename, processed_at, days_count, is_active')
    .eq('hotel_id', hotelId)
    .order('processed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[lighthouse-comparison] list imports failed:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as HistoricalImportMeta[];
}

// ─── Récupérer un import complet par ID ───────────────────────────────────

export async function fetchImportById(
  importId: string,
): Promise<LighthouseImport | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: imp, error: impErr } = await (supabase as any)
      .from('lighthouse_imports')
      .select('id, filename, our_hotel_name, competitor_names, sheets_found, warnings, processed_at, days_count')
      .eq('id', importId)
      .single();

    if (impErr || !imp) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: days, error: daysErr } = await (supabase as any)
      .from('lighthouse_days')
      .select('*')
      .eq('import_id', imp.id)
      .order('stay_date', { ascending: true });

    if (daysErr) {
      console.warn('[lighthouse-comparison] fetch days failed:', daysErr.message);
      return null;
    }

    return {
      fileName: imp.filename,
      importedAt: imp.processed_at,
      ourHotelName: imp.our_hotel_name ?? 'Notre hôtel',
      competitorNames: Array.isArray(imp.competitor_names) ? imp.competitor_names : [],
      sheetsFound: Array.isArray(imp.sheets_found) ? imp.sheets_found : [],
      warnings: Array.isArray(imp.warnings) ? imp.warnings : [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      days: ((days ?? []) as any[]).map(d => ({
        date: d.stay_date,
        dayName: d.day_name ?? '',
        ourPrice: Number(d.our_price ?? 0),
        compsetMedian: Number(d.compset_median ?? 0),
        marketDemand: Number(d.market_demand ?? 0),
        marketDemandPercent: Number(d.market_demand_percent ?? 0),
        ranking: d.ranking ?? '',
        rankPosition: d.rank_position,
        rankTotal: d.rank_total,
        bookingRank: d.booking_rank ?? '',
        holidays: d.holidays ?? '',
        events: d.events ?? '',
        competitors: Array.isArray(d.competitors) ? d.competitors : [],
        compsetMin: d.compset_min !== null ? Number(d.compset_min) : null,
        compsetMax: d.compset_max !== null ? Number(d.compset_max) : null,
        varVsYesterday: d.var_vs_yesterday !== null ? Number(d.var_vs_yesterday) : null,
        varVs3Days: d.var_vs_3days !== null ? Number(d.var_vs_3days) : null,
        varVs7Days: d.var_vs_7days !== null ? Number(d.var_vs_7days) : null,
      })),
    };
  } catch (err) {
    console.warn('[lighthouse-comparison] fetchImportById exception:', err);
    return null;
  }
}

// ─── Trouver l'import le plus proche d'il y a N jours ─────────────────────

export async function findImportForDaysAgo(
  daysAgo: number,
): Promise<LighthouseImport | null> {
  const hotelId = await resolveHotelId();
  if (!hotelId) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetIso = targetDate.toISOString();

  // Chercher l'import uploadé juste avant la date cible (ce qui était actif à ce moment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lighthouse_imports')
    .select('id, processed_at')
    .eq('hotel_id', hotelId)
    .lte('processed_at', targetIso)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return fetchImportById(data.id);
  }

  // Fallback : N-ième dans l'historique si pas de données avant la date cible
  const allImports = await listAllLighthouseImports(50);
  // Ignorer l'import actif (index 0) ; prendre le N-ième
  const fallbackIndex =
    daysAgo <= 1 ? 1 :
    daysAgo <= 3 ? 2 :
    daysAgo <= 7 ? 3 :
    daysAgo <= 14 ? 4 : 5;
  const fallback = allImports[Math.min(fallbackIndex, allImports.length - 1)];
  if (!fallback || fallback.is_active) return null; // pas d'archive disponible

  return fetchImportById(fallback.id);
}
