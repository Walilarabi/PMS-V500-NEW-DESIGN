/**
 * Lighthouse API — competitive intelligence (rate shopping, parity, ranking).
 *
 * Base client ready for wiring. Set VITE_LIGHTHOUSE_API_KEY in .env.local.
 * Full API docs: see .claude/docs/lighthouse-api.md
 */

const BASE_URL = import.meta.env.VITE_LIGHTHOUSE_API_URL ?? 'https://api.mylighthouse.com';
const API_KEY  = import.meta.env.VITE_LIGHTHOUSE_API_KEY ?? '';

export interface LighthouseRate {
  hotel_id: string;
  hotel_name: string;
  check_in: string;
  room_type: string;
  rate: number;
  currency: string;
  ota: string;
  captured_at: string;
}

export interface LighthouseParityViolation {
  ota: string;
  your_rate: number;
  competitor_rate: number;
  delta_pct: number;
  room_type: string;
  stay_date: string;
}

export interface LighthouseRanking {
  ota: string;
  rank: number;
  total_hotels: number;
  score: number;
  captured_at: string;
}

// ── Internal fetch wrapper ────────────────────────────────────────────────────

async function lhFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_KEY) throw new Error('VITE_LIGHTHOUSE_API_KEY not set — see .claude/docs/lighthouse-api.md');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lighthouse API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch competitor rates for a hotel for a given date range. */
export async function fetchCompetitorRates(
  hotelId: string,
  checkIn: string,
  checkOut: string,
): Promise<LighthouseRate[]> {
  return lhFetch<LighthouseRate[]>(
    `/v1/hotels/${hotelId}/rates?check_in=${checkIn}&check_out=${checkOut}`,
  );
}

/** Fetch rate parity violations (your price vs OTA displayed price). */
export async function fetchParityViolations(
  hotelId: string,
  date: string,
): Promise<LighthouseParityViolation[]> {
  return lhFetch<LighthouseParityViolation[]>(
    `/v1/hotels/${hotelId}/parity?date=${date}`,
  );
}

/** Fetch OTA ranking signals for a hotel. */
export async function fetchRanking(hotelId: string): Promise<LighthouseRanking[]> {
  return lhFetch<LighthouseRanking[]>(`/v1/hotels/${hotelId}/ranking`);
}

/** Force a fresh rate capture (use sparingly — triggers a live crawl). */
export async function refreshRates(hotelId: string): Promise<void> {
  await lhFetch(`/v1/hotels/${hotelId}/refresh`, { method: 'POST' });
}
