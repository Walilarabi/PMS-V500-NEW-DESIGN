/**
 * FLOWTYM — RMS Settings Service
 *
 * Markup paramétrable par hôtel, appliqué aux recommandations IA
 * acceptées avant push vers le calendrier tarifaire.
 */

import { supabase } from '../lib/supabase';

export interface RmsSettings {
  hotelId: string;
  pushMarkupPercent: number;
  autoPushEnabled: boolean;
  minMarkupPercent: number;
  maxMarkupPercent: number;
}

const DEFAULT_SETTINGS = {
  pushMarkupPercent: 5,
  autoPushEnabled: true,
  minMarkupPercent: -50,
  maxMarkupPercent: 100,
};

async function getHotelId(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    return data ? String(data) : null;
  } catch { return null; }
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export async function fetchRmsSettings(): Promise<RmsSettings | null> {
  const hotelId = await getHotelId();
  if (!hotelId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('rms_settings')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle();

    if (error) {
      console.warn('[rms-settings] fetch failed:', error.message);
      return null;
    }

    if (!data) {
      return { hotelId, ...DEFAULT_SETTINGS };
    }

    return {
      hotelId,
      pushMarkupPercent: Number(data.push_markup_percent),
      autoPushEnabled: Boolean(data.auto_push_enabled),
      minMarkupPercent: Number(data.min_markup_percent),
      maxMarkupPercent: Number(data.max_markup_percent),
    };
  } catch (err) {
    console.warn('[rms-settings] fetch exception:', err);
    return null;
  }
}

export async function updateRmsSettings(updates: Partial<Omit<RmsSettings, 'hotelId'>>): Promise<boolean> {
  const hotelId = await getHotelId();
  if (!hotelId) return false;

  const userId = await getUserId();

  const payload: Record<string, unknown> = {
    hotel_id: hotelId,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (updates.pushMarkupPercent !== undefined) payload.push_markup_percent = updates.pushMarkupPercent;
  if (updates.autoPushEnabled !== undefined) payload.auto_push_enabled = updates.autoPushEnabled;
  if (updates.minMarkupPercent !== undefined) payload.min_markup_percent = updates.minMarkupPercent;
  if (updates.maxMarkupPercent !== undefined) payload.max_markup_percent = updates.maxMarkupPercent;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rms_settings')
      .upsert(payload, { onConflict: 'hotel_id' });

    if (error) {
      console.warn('[rms-settings] upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[rms-settings] upsert exception:', err);
    return false;
  }
}

/**
 * Pure function — applique le markup sur un prix recommandé.
 */
export function applyMarkup(recommendedPrice: number, markupPercent: number): number {
  if (!isFinite(recommendedPrice) || recommendedPrice <= 0) return recommendedPrice;
  return Math.round(recommendedPrice * (1 + markupPercent / 100));
}
