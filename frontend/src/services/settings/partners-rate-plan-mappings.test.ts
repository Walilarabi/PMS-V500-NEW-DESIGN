/**
 * FLOWTYM — Tests de setPartnerRatePlanMappings.
 *
 * Couvre la logique delta (add / keep / remove) sans appel Supabase réel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockResolvedValue({ error: null });
const mockEqChain = vi.fn().mockReturnThis();
const mockInChain = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn();

function buildFrom(selectData: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: mockUpsert,
    update: vi.fn().mockReturnValue({
      eq: mockEqChain,
      in: vi.fn().mockResolvedValue({ error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      in: mockInChain,
    }),
    // resolve the initial select
    then: undefined as unknown,
  };
}

let fromImpl: (table: string) => unknown;

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    get from() { return fromImpl; },
  },
}));

vi.mock('@/src/lib/hotelId', () => ({
  resolveHotelId: vi.fn().mockResolvedValue('hotel-xyz'),
}));

import { setPartnerRatePlanMappings } from './partners.service';
import { resolveHotelId } from '@/src/lib/hotelId';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeExistingRows(entries: { id: string; rate_plan_id: string }[]) {
  return { data: entries, error: null };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('setPartnerRatePlanMappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne une erreur si hotel_id absent', async () => {
    vi.mocked(resolveHotelId).mockResolvedValueOnce(null);
    const result = await setPartnerRatePlanMappings('partner-1', ['rp1']);
    expect(result.error).toMatch(/Hôtel introuvable/);
  });

  it('ajoute les nouveaux plans (aucun existant)', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateInMock = vi.fn().mockResolvedValue({ error: null });
    const selectEqMock = vi.fn().mockResolvedValue({ data: [], error: null });

    fromImpl = () => ({
      select: () => ({ eq: selectEqMock }),
      upsert: upsertMock,
      update: () => ({ eq: () => ({ in: updateInMock }) }),
      delete: () => ({ in: vi.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await setPartnerRatePlanMappings('partner-1', ['rp1', 'rp2']);
    expect(result.error).toBeNull();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ rate_plan_id: 'rp1', partner_id: 'partner-1' }),
        expect.objectContaining({ rate_plan_id: 'rp2', partner_id: 'partner-1' }),
      ]),
      expect.objectContaining({ onConflict: 'hotel_id,rate_plan_id,partner_id' }),
    );
  });

  it('supprime les plans désélectionnés', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateInMock = vi.fn().mockResolvedValue({ error: null });

    // The service calls sb.from('rate_plan_partner_mappings') multiple times.
    // Route by keeping a single shared object that handles all methods.
    const sharedChain: Record<string, unknown> = {};
    sharedChain.select = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: 'row-1', rate_plan_id: 'rp1' },
          { id: 'row-2', rate_plan_id: 'rp2' },
        ],
      }),
    });
    sharedChain.upsert = upsertMock;
    sharedChain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ in: updateInMock }),
    });
    sharedChain.delete = vi.fn().mockReturnValue({ in: deleteMock });

    fromImpl = () => sharedChain;

    // Keep only rp1, remove rp2
    const result = await setPartnerRatePlanMappings('partner-1', ['rp1']);
    expect(result.error).toBeNull();
    // row-2 should be deleted (.delete().in('id', ['row-2']))
    expect(deleteMock).toHaveBeenCalledWith('id', ['row-2']);
  });

  it('ne supprime rien si tous les plans restent sélectionnés', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    fromImpl = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 'row-1', rate_plan_id: 'rp1' },
            { id: 'row-2', rate_plan_id: 'rp2' },
          ],
        }),
      }),
      upsert: upsertMock,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      delete: vi.fn().mockReturnValue({ in: deleteMock }),
    });

    const result = await setPartnerRatePlanMappings('partner-1', ['rp1', 'rp2']);
    expect(result.error).toBeNull();
    // Nothing to delete (toRemove is empty)
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
