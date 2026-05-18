/**
 * FLOWTYM — Lighthouse Persistence Service
 *
 * STRATÉGIE :
 *   - Chaque import = snapshot complet versionné dans `lighthouse_imports`
 *   - Un seul import "actif" à la fois (le plus récent)
 *   - Les anciens passent en mode archivé (archived_at != null, is_active = false)
 *   - Les `lighthouse_days` restent rattachées à leur import (FK)
 *   - Permet l'audit, les comparaisons historiques, le rollback
 */

import { supabase } from '../lib/supabase';
import type { LighthouseImport } from './lighthouse-parser.service';

export interface LighthousePersistResult {
  importId: string | null;
  daysInserted: number;
  archivedCount: number;
  errors: string[];
}

async function resolveHotelAndUser(): Promise<{ hotelId: string | null; userId: string | null }> {
  let hotelId: string | null = null;
  let userId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    if (data) hotelId = String(data);
  } catch { /* ignore */ }
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) userId = userData.user.id;
  } catch { /* ignore */ }
  return { hotelId, userId };
}

export async function persistLighthouseImport(
  importData: LighthouseImport,
): Promise<LighthousePersistResult> {
  const result: LighthousePersistResult = {
    importId: null,
    daysInserted: 0,
    archivedCount: 0,
    errors: [],
  };

  const { hotelId, userId } = await resolveHotelAndUser();
  if (!hotelId) {
    result.errors.push('Aucun hôtel résolu (utilisateur non authentifié) — non persisté en base.');
    return result;
  }

  const nowIso = new Date().toISOString();

  // 1. Archiver les imports actifs existants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: archived, error: archiveErr } = await (supabase as any)
    .from('lighthouse_imports')
    .update({ is_active: false, archived_at: nowIso })
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .select('id');

  if (archiveErr) {
    result.errors.push(`Archivage échoué: ${archiveErr.message}`);
  } else {
    result.archivedCount = (archived ?? []).length;
  }

  // 2. Insérer le nouveau snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newImport, error: insertErr } = await (supabase as any)
    .from('lighthouse_imports')
    .insert({
      hotel_id: hotelId,
      filename: importData.fileName,
      our_hotel_name: importData.ourHotelName,
      competitor_names: importData.competitorNames,
      sheets_found: importData.sheetsFound,
      warnings: importData.warnings,
      is_active: true,
      days_count: importData.days.length,
      rows_ingested: importData.days.length,
      status: 'completed',
      uploaded_by: userId,
      processed_at: nowIso,
    })
    .select('id')
    .single();

  if (insertErr || !newImport) {
    result.errors.push(`Insert import échoué: ${insertErr?.message ?? 'unknown'}`);
    return result;
  }

  const importId = String(newImport.id);
  result.importId = importId;

  // 3. Insérer les jours par chunks de 500
  const CHUNK = 500;
  const daysPayload = importData.days.map(d => ({
    import_id: importId,
    hotel_id: hotelId,
    stay_date: d.date,
    day_name: d.dayName,
    our_price: d.ourPrice,
    compset_median: d.compsetMedian,
    market_demand: d.marketDemand,
    market_demand_percent: d.marketDemandPercent,
    ranking: d.ranking,
    rank_position: d.rankPosition,
    rank_total: d.rankTotal,
    booking_rank: d.bookingRank,
    holidays: d.holidays,
    events: d.events,
    competitors: d.competitors,
    compset_min: d.compsetMin,
    compset_max: d.compsetMax,
    var_vs_yesterday: d.varVsYesterday,
    var_vs_3days: d.varVs3Days,
    var_vs_7days: d.varVs7Days,
  }));

  for (let i = 0; i < daysPayload.length; i += CHUNK) {
    const chunk = daysPayload.slice(i, i + CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('lighthouse_days').insert(chunk);
    if (error) {
      result.errors.push(`Insert chunk ${i / CHUNK + 1}: ${error.message}`);
    } else {
      result.daysInserted += chunk.length;
    }
  }

  return result;
}

export async function fetchActiveLighthouseImport(): Promise<LighthouseImport | null> {
  const { hotelId } = await resolveHotelAndUser();
  if (!hotelId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: imp, error: impErr } = await (supabase as any)
      .from('lighthouse_imports')
      .select('id, filename, our_hotel_name, competitor_names, sheets_found, warnings, uploaded_at, days_count')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .maybeSingle();

    if (impErr || !imp) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: days, error: daysErr } = await (supabase as any)
      .from('lighthouse_days')
      .select('*')
      .eq('import_id', imp.id)
      .order('stay_date', { ascending: true });

    if (daysErr) {
      console.warn('[lighthouse-persist] fetch days failed:', daysErr.message);
      return null;
    }

    return {
      fileName: imp.filename,
      importedAt: imp.uploaded_at,
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
    console.warn('[lighthouse-persist] fetch active exception:', err);
    return null;
  }
}

export async function listLighthouseImportHistory(limit = 20): Promise<Array<{
  id: string;
  filename: string;
  uploaded_at: string;
  days_count: number;
  is_active: boolean;
}>> {
  const { hotelId } = await resolveHotelAndUser();
  if (!hotelId) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lighthouse_imports')
    .select('id, filename, uploaded_at, days_count, is_active')
    .eq('hotel_id', hotelId)
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[lighthouse-persist] history fetch failed:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}
