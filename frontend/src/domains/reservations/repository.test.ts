/**
 * FLOWTYM — Reservation repository unit tests.
 *
 * Tests: cancellation logic, overbooking conflict, version conflict (move),
 * hotel_id isolation (no leak in SELECT queries), audit trail write.
 *
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── vi.hoisted — variables used inside vi.mock factories ────────────────────
// vi.mock calls are hoisted to the top by the Vitest transform; any variable
// referenced inside a factory must itself be hoisted via vi.hoisted().

const { mockChain, mockWriteAuditLog } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'update', 'insert', 'delete', 'select', 'eq', 'in',
    'gt', 'lt', 'order', 'range', 'single', 'maybeSingle',
  ];
  for (const m of methods) {
    chain[m] = vi.fn();
    // terminal methods default to unresolved promise; chaining methods return chain
    if (m !== 'single' && m !== 'maybeSingle') {
      chain[m].mockReturnValue(chain);
    }
  }
  // Make the chain thenable so `await q` (used in listReservations) works.
  // Tests can overwrite chain._thenableResult to control what the chain resolves to.
  chain._thenableResult = { data: null, error: null, count: 0 };
  chain.then = vi.fn((onFulfilled: (v: unknown) => unknown) => {
    return Promise.resolve(chain._thenableResult).then(onFulfilled);
  });
  return {
    mockChain: chain,
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('@/src/domains/finance/repository', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import {
  cancelReservation,
  updateReservationStatus,
  createReservation,
  listReservations,
} from './repository';
import { ConflictError, NotFoundError } from '@/src/domains/_shared/errors';

// A minimal valid reservation row returned by Supabase
const fakeRow = {
  id: '11111111-1111-1111-1111-111111111111',
  reference: 'FLT-001',
  hotel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  room_id: null,
  room_number: null,
  guest_id: null,
  guest_name: 'Test Guest',
  guest_email: null,
  guest_phone: null,
  rate_plan_id: null,
  check_in: '2025-06-01',
  check_out: '2025-06-03',
  nights: 2,
  status: 'confirmed',
  checkin_status: null,
  adults: 1,
  children: 0,
  pax: null,
  total_amount: 200,
  paid_amount: 0,
  solde: 200,
  source: 'Direct',
  segment: null,
  payment_status: 'pending',
  notes: null,
  special_requests: null,
  room_type: null,
  room_category: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  // Re-apply chainable return values (resetAllMocks clears implementations)
  const chainMethods = [
    'update', 'insert', 'delete', 'select', 'eq', 'in',
    'gt', 'lt', 'order', 'range',
  ];
  for (const m of chainMethods) {
    mockChain[m].mockReturnValue(mockChain);
  }
  // Default terminal method responses
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockChain.single.mockResolvedValue({ data: null, error: null });
  // Restore thenable behavior for `await q` style queries (listReservations)
  (mockChain as any)._thenableResult = { data: null, error: null, count: 0 };
  mockChain.then.mockImplementation((onFulfilled: (v: unknown) => unknown) => {
    return Promise.resolve((mockChain as any)._thenableResult).then(onFulfilled);
  });
  mockWriteAuditLog.mockResolvedValue(undefined);
});

// ─── cancelReservation ────────────────────────────────────────────────────────

describe('cancelReservation', () => {
  it('annule la réservation et écrit un audit log', async () => {
    const cancelledRow = { ...fakeRow, status: 'cancelled', version: 2 };
    mockChain.maybeSingle.mockResolvedValue({ data: cancelledRow, error: null });

    const result = await cancelReservation(fakeRow.id, 'guest_request');

    expect(result.status).toBe('cancelled');
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'reservation',
        entity_id: fakeRow.id,
        action: 'CANCEL',
        payload: expect.objectContaining({ reason: 'guest_request' }),
      }),
    );
  });

  it('lance ConflictError si la version ne correspond pas', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      cancelReservation(fakeRow.id, 'guest_request', 3 /* expectedVersion */),
    ).rejects.toThrow(ConflictError);
  });

  it("lance NotFoundError si l'ID n'existe pas (sans version)", async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      cancelReservation('11111111-0000-0000-0000-000000000000', 'test'),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── updateReservationStatus — verrouillage optimiste ────────────────────────

describe('updateReservationStatus — optimistic lock', () => {
  it('met à jour le statut avec la bonne version', async () => {
    const updatedRow = { ...fakeRow, status: 'checked_in', version: 2 };
    mockChain.maybeSingle.mockResolvedValue({ data: updatedRow, error: null });

    const result = await updateReservationStatus(fakeRow.id, 'checked_in', 1);
    expect(result.status).toBe('checked_in');
  });

  it('lance ConflictError si version erronée (aucune ligne retournée)', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      updateReservationStatus(fakeRow.id, 'checked_in', 999),
    ).rejects.toThrow(ConflictError);
  });

  it('lance NotFoundError si ID inexistant (sans version)', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      updateReservationStatus('00000000-0000-0000-0000-000000000000', 'cancelled'),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── createReservation — détection overbooking ────────────────────────────────

describe('createReservation — détection overbooking', () => {
  const hotelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const input = {
    reference: 'FLT-TEST',
    checkIn: '2025-07-01',
    checkOut: '2025-07-03',
    adults: 2,
    children: 0,
    source: 'Direct',
    totalAmount: 200,
  };

  it('lance ConflictError sur code Supabase 23P01 (exclusion_violation)', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms lookup
    mockChain.single.mockResolvedValue({
      data: null,
      error: { code: '23P01', message: 'OVERBOOKING_CONFLICT' },
    });

    await expect(createReservation(hotelId, input)).rejects.toThrow(ConflictError);
  });

  it('lance ConflictError si le message contient OVERBOOKING_CONFLICT', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms lookup
    mockChain.single.mockResolvedValue({
      data: null,
      error: { code: '23000', message: 'OVERBOOKING_CONFLICT: chambre déjà prise' },
    });

    await expect(createReservation(hotelId, input)).rejects.toThrow(ConflictError);
  });

  it('réussit et écrit un audit log sur insertion normale', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms lookup
    mockChain.single.mockResolvedValue({ data: fakeRow, error: null });

    const result = await createReservation(hotelId, input);
    expect(result.id).toBe(fakeRow.id);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'reservation',
        action: 'INSERT',
      }),
    );
  });
});

// ─── hotel_id isolation (RLS guard) ───────────────────────────────────────────

describe('hotel_id isolation — RLS guard', () => {
  it('ne filtre PAS hotel_id dans UPDATE (RLS le fait côté DB)', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    try { await updateReservationStatus(fakeRow.id, 'cancelled'); } catch {}

    // The repository must NOT call .eq('hotel_id', ...) in UPDATE — RLS handles that
    const eqCalls = mockChain.eq.mock.calls;
    const hotelIdFilters = eqCalls.filter(([col]: [string]) => col === 'hotel_id');
    expect(hotelIdFilters).toHaveLength(0);
  });

  it('inclut hotel_id dans le payload INSERT (requis pour la FK)', async () => {
    const hotelId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    mockChain.single.mockResolvedValue({ data: fakeRow, error: null });

    await createReservation(hotelId, {
      reference: 'FLT-RLS',
      checkIn: '2025-08-01',
      checkOut: '2025-08-03',
      adults: 1,
      source: 'Direct',
      totalAmount: 100,
    });

    const insertCall = mockChain.insert.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.hotel_id).toBe(hotelId);
  });
});

// ─── listReservations — filtre date ──────────────────────────────────────────

describe('listReservations', () => {
  it('ajoute les filtres de date corrects (chevauchement)', async () => {
    (mockChain as any)._thenableResult = { data: [], error: null, count: 0 };

    await listReservations({ dateFrom: '2025-01-01', dateTo: '2025-01-31' });

    // check_out > dateFrom (chevauchement)
    expect(mockChain.gt).toHaveBeenCalledWith('check_out', '2025-01-01');
    // check_in < dateTo (chevauchement)
    expect(mockChain.lt).toHaveBeenCalledWith('check_in', '2025-01-31');
  });

  it('retourne les résultats parsés par reservationRowSchema', async () => {
    (mockChain as any)._thenableResult = { data: [fakeRow], error: null, count: 1 };

    const { rows, total } = await listReservations();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(fakeRow.id);
    expect(total).toBe(1);
  });
});
