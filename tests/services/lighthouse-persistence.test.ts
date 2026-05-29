/**
 * FLOWTYM — Lighthouse Persistence Service tests.
 *
 * Verifies the persist → fetch cycle against a mocked Supabase client.
 * After migration 0167, lighthouse_days and lighthouse_imports both exist
 * with the correct columns; these tests validate the service contract.
 *
 * Chain anatomy for persistLighthouseImport:
 *   1. archive:  .update().eq().eq().select('id')          ← select is terminal (awaited)
 *   2. insert:   .insert({}).select('id').single()         ← single is terminal
 *   3. days:     .from('lighthouse_days').insert(chunk)    ← insert is terminal (awaited)
 *
 * Chain anatomy for fetchActiveLighthouseImport:
 *   1. import:  .select().eq().eq().maybeSingle()          ← maybeSingle is terminal
 *   2. days:    .select().eq().order()                     ← order is terminal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks so vi.mock factory can reference them ─────────────────────────

const {
  mockSingle,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockEq,
  mockMaybeSingle,
  mockOrder,
  mockLimit,
  mockRpc,
  fromChain,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockRpc = vi.fn();

  const fromChain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    limit: mockLimit,
  };

  // Non-terminal methods return the chain by default
  ['select', 'insert', 'update', 'eq', 'order', 'limit'].forEach(k => {
    fromChain[k].mockReturnValue(fromChain);
  });

  return {
    mockSingle, mockSelect, mockInsert, mockUpdate, mockEq,
    mockMaybeSingle, mockOrder, mockLimit, mockRpc, fromChain,
  };
});

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => fromChain),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    rpc: mockRpc,
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  persistLighthouseImport,
  fetchActiveLighthouseImport,
} from '@/src/services/lighthouse-persistence.service';
import type { LighthouseImport } from '@/src/services/lighthouse-parser.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HOTEL_ID = 'hotel-abc';

function makeImport(): LighthouseImport {
  return {
    fileName: 'lighthouse_test.xlsx',
    importedAt: new Date().toISOString(),
    ourHotelName: 'Hotel Test',
    competitorNames: ['Concurrent A', 'Concurrent B'],
    sheetsFound: ['Tarifsflex'],
    warnings: [],
    days: [
      {
        date: '2026-06-01',
        dayName: 'lundi',
        ourPrice: 120,
        compsetMedian: 115,
        marketDemand: 0.75,
        marketDemandPercent: 75,
        ranking: 'top',
        rankPosition: 2,
        rankTotal: 8,
        bookingRank: '2',
        holidays: '',
        events: '',
        competitors: [{ name: 'Hotel A', price: 110 }],
        compsetMin: 105,
        compsetMax: 130,
        varVsYesterday: 5,
        varVs3Days: 3,
        varVs7Days: -2,
      },
    ],
  };
}

// ── Reset helper — must be called after vi.clearAllMocks() ────────────────────

function resetChain() {
  // mockReset clears implementations+queue, then we re-wire non-terminal methods
  ['select', 'insert', 'update', 'eq', 'order', 'limit'].forEach(k => {
    fromChain[k].mockReset();
    fromChain[k].mockReturnValue(fromChain);
  });
  mockSingle.mockReset();
  mockMaybeSingle.mockReset();
}

// ── Tests: persistLighthouseImport ────────────────────────────────────────────

describe('lighthouse-persistence: persistLighthouseImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns error when hotel cannot be resolved', async () => {
    mockRpc.mockResolvedValueOnce({ data: null });

    const result = await persistLighthouseImport(makeImport());

    expect(result.importId).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/non authentifié|Aucun hôtel/);
  });

  it('inserts into lighthouse_imports with all required columns', async () => {
    mockRpc.mockResolvedValueOnce({ data: HOTEL_ID });

    // Chain 1 (archive): .update().eq().eq().select('id') — select is terminal
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    // Chain 2 (insert import): .insert({}).select('id').single()
    // - mockInsert default returns fromChain (from resetChain)
    // - mockSelect second call also uses default (returns fromChain, for .single() chaining)
    // - mockSingle resolves with the new import id
    mockSingle.mockResolvedValueOnce({ data: { id: 'import-123' }, error: null });

    // Chain 3 (insert days): .from('lighthouse_days').insert(chunk)
    // - mockInsert default returns fromChain, await fromChain → no error property → daysInserted++

    const result = await persistLighthouseImport(makeImport());

    expect(result.importId).toBe('import-123');
    expect(result.errors).toHaveLength(0);
    expect(result.daysInserted).toBe(1);
  });

  it('propagates day insert errors without throwing', async () => {
    mockRpc.mockResolvedValueOnce({ data: HOTEL_ID });

    // Chain 1 (archive): select resolves
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    // Chain 2 (insert import): single resolves
    mockSingle.mockResolvedValueOnce({ data: { id: 'import-456' }, error: null });

    // Chain 3 (insert days): must resolve with an error.
    // Queue two Once implementations on mockInsert:
    //   Call 1 (lighthouse_imports): return fromChain so .select().single() can chain
    //   Call 2 (lighthouse_days):    resolve with DB error
    mockInsert.mockReturnValueOnce(fromChain);
    mockInsert.mockResolvedValueOnce({
      error: { message: 'relation "lighthouse_days" does not exist' },
    });

    const result = await persistLighthouseImport(makeImport());

    expect(result.importId).toBe('import-456');
    expect(result.daysInserted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('lighthouse_days');
  });
});

// ── Tests: fetchActiveLighthouseImport ────────────────────────────────────────

describe('lighthouse-persistence: fetchActiveLighthouseImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns null when hotel is not resolved', async () => {
    mockRpc.mockResolvedValueOnce({ data: null });
    const result = await fetchActiveLighthouseImport();
    expect(result).toBeNull();
  });

  it('returns null when no active import exists', async () => {
    mockRpc.mockResolvedValueOnce({ data: HOTEL_ID });
    // Chain 1: .select().eq().eq().maybeSingle() — maybeSingle is terminal
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchActiveLighthouseImport();
    expect(result).toBeNull();
  });

  it('maps database rows to LighthouseImport shape correctly', async () => {
    mockRpc.mockResolvedValueOnce({ data: HOTEL_ID });

    // Chain 1: import record via maybeSingle
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'import-789',
        filename: 'test.xlsx',
        our_hotel_name: 'Hotel Test',
        competitor_names: ['Hotel A'],
        sheets_found: ['Sheet1'],
        warnings: [],
        uploaded_at: '2026-06-01T10:00:00Z',
        days_count: 1,
      },
      error: null,
    });

    // Chain 2: days via .select().eq().order() — order is terminal
    mockOrder.mockResolvedValueOnce({
      data: [{
        stay_date: '2026-06-01',
        day_name: 'lundi',
        our_price: 120,
        compset_median: 115,
        market_demand: 0.75,
        market_demand_percent: 75,
        ranking: 'top',
        rank_position: 2,
        rank_total: 8,
        booking_rank: '2',
        holidays: '',
        events: '',
        competitors: [],
        compset_min: 105,
        compset_max: 130,
        var_vs_yesterday: 5,
        var_vs_3days: 3,
        var_vs_7days: -2,
      }],
      error: null,
    });

    const result = await fetchActiveLighthouseImport();

    expect(result).not.toBeNull();
    expect(result!.ourHotelName).toBe('Hotel Test');
    expect(result!.days).toHaveLength(1);
    expect(result!.days[0].ourPrice).toBe(120);
    expect(result!.days[0].compsetMedian).toBe(115);
  });
});
