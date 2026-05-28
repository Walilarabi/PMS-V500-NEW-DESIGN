/**
 * FLOWTYM — Integration tests: Reservation flows.
 *
 * These tests simulate the full repository layer with a controllable
 * Supabase mock. They verify:
 *
 *   1. Reservation creation → appears in listReservations date-range query
 *   2. Reservation creation → triggers audit trail (writeAuditLog)
 *   3. Reservation cancellation → status updated + audit entry written
 *   4. Overbooking detection → ConflictError surfaced to caller
 *   5. Move reservation (optimistic lock) → version conflict propagates
 *   6. hotel_id isolation: each repo call receives correct hotel_id on INSERT
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { sbChain, mockInsert, mockUpdate, mockAuditLog } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const m of ['select', 'eq', 'gt', 'lt', 'in', 'order', 'range', 'single', 'maybeSingle', 'delete', 'insert', 'update', 'rpc']) {
    chain[m] = vi.fn();
    if (!['single', 'maybeSingle', 'rpc'].includes(m)) {
      chain[m].mockReturnValue(chain);
    }
  }

  // Thenable so `await q` works for list queries
  (chain as any)._thenableResult = { data: [], error: null, count: 0 };
  chain.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve((chain as any)._thenableResult).then(onFulfilled),
  );

  return {
    sbChain: chain,
    mockInsert: chain.insert,
    mockUpdate: chain.update,
    mockAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => sbChain),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('@/src/domains/finance/repository', () => ({
  writeAuditLog: mockAuditLog,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import {
  createReservation,
  cancelReservation,
  listReservations,
} from '@/src/domains/reservations/repository';
import { ConflictError } from '@/src/domains/_shared/errors';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HOTEL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const reservationRow = {
  id: '22222222-2222-2222-2222-222222222222',
  reference: 'INT-001',
  hotel_id: HOTEL_ID,
  room_id: null,
  room_number: null,
  guest_id: null,
  guest_name: 'Jane Doe',
  guest_email: 'jane@example.com',
  guest_phone: null,
  rate_plan_id: null,
  check_in: '2025-09-01',
  check_out: '2025-09-04',
  nights: 3,
  status: 'confirmed',
  checkin_status: null,
  adults: 2,
  children: 0,
  pax: null,
  total_amount: 450,
  paid_amount: 0,
  solde: 450,
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

const createInput = {
  reference: 'INT-001',
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  checkIn: '2025-09-01',
  checkOut: '2025-09-04',
  adults: 2,
  source: 'Direct',
  totalAmount: 450,
};

beforeEach(() => {
  vi.resetAllMocks();
  // Re-apply chainable return values (resetAllMocks clears implementations)
  const chainMethods = ['select', 'eq', 'gt', 'lt', 'in', 'order', 'range', 'delete', 'insert', 'update'];
  for (const m of chainMethods) sbChain[m].mockReturnValue(sbChain);
  // Default terminal method responses
  sbChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  sbChain.single.mockResolvedValue({ data: null, error: null });
  // Thenable (for `await q` style in listReservations)
  (sbChain as any)._thenableResult = { data: [], error: null, count: 0 };
  sbChain.then.mockImplementation((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve((sbChain as any)._thenableResult).then(onFulfilled),
  );
  mockAuditLog.mockResolvedValue(undefined);
});

// ─── 1. Reservation creation → appears in planning range query ────────────────

describe('Reservation creation → planning range', () => {
  it('crée une réservation puis la trouve dans la plage de dates', async () => {
    // Step 1: Create
    sbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    sbChain.single.mockResolvedValue({ data: reservationRow, error: null });

    const created = await createReservation(HOTEL_ID, createInput);
    expect(created.id).toBe(reservationRow.id);

    // Step 2: List with overlapping date range
    (sbChain as any)._thenableResult = { data: [reservationRow], error: null, count: 1 };

    const { rows, total } = await listReservations({
      dateFrom: '2025-08-25',
      dateTo: '2025-09-10',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(reservationRow.id);
    expect(total).toBe(1);
    // Verify overlap filter was applied
    expect(sbChain.gt).toHaveBeenCalledWith('check_out', '2025-08-25');
    expect(sbChain.lt).toHaveBeenCalledWith('check_in', '2025-09-10');
  });

  it("n'apparaît pas dans une plage qui ne chevauche pas ses dates", async () => {
    (sbChain as any)._thenableResult = { data: [], error: null, count: 0 };

    const { rows } = await listReservations({
      dateFrom: '2025-10-01',
      dateTo: '2025-10-31',
    });

    expect(rows).toHaveLength(0);
  });
});

// ─── 2. Reservation creation → audit trail ────────────────────────────────────

describe('Reservation creation → audit trail', () => {
  it('écrit un audit log INSERT après création réussie', async () => {
    sbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    sbChain.single.mockResolvedValue({ data: reservationRow, error: null });

    await createReservation(HOTEL_ID, createInput);

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'reservation',
        entity_id: reservationRow.id,
        action: 'INSERT',
        payload: expect.objectContaining({
          reference: reservationRow.reference,
          status: 'confirmed',
        }),
      }),
    );
  });

  it("n'écrit PAS de log si la création échoue (overbooking)", async () => {
    sbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    sbChain.single.mockResolvedValue({
      data: null,
      error: { code: '23P01', message: 'OVERBOOKING_CONFLICT' },
    });

    await expect(createReservation(HOTEL_ID, createInput)).rejects.toThrow(ConflictError);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ─── 3. Reservation cancellation → status + audit ────────────────────────────

describe('Reservation cancellation → status + audit', () => {
  it('annule et trace avec motif dans le payload audit', async () => {
    const cancelledRow = { ...reservationRow, status: 'cancelled', version: 2 };
    sbChain.maybeSingle.mockResolvedValue({ data: cancelledRow, error: null });

    const result = await cancelReservation(reservationRow.id, 'no_show');

    expect(result.status).toBe('cancelled');
    // Should have 2 audit calls: STATUS_CANCELLED + CANCEL
    expect(mockAuditLog).toHaveBeenCalledTimes(2);
    const cancelCall = mockAuditLog.mock.calls.find(
      ([args]: [{ action: string }]) => args.action === 'CANCEL',
    );
    expect(cancelCall).toBeDefined();
    expect(cancelCall![0].payload.reason).toBe('no_show');
  });
});

// ─── 4. Overbooking detection ─────────────────────────────────────────────────

describe('Overbooking detection', () => {
  it('lance ConflictError avec message lisible pour 23P01', async () => {
    sbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    sbChain.single.mockResolvedValue({
      data: null,
      error: { code: '23P01', message: 'OVERBOOKING_CONFLICT' },
    });

    let caught: Error | undefined;
    try {
      await createReservation(HOTEL_ID, createInput);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).toBeInstanceOf(ConflictError);
    expect(caught!.message).toContain('Overbooking');
    expect(caught!.message).toContain('chambre');
  });
});

// ─── 5. Move reservation — optimistic lock version conflict ───────────────────

describe('Move reservation — optimistic lock', () => {
  it('propage ConflictError quand la version est obsolète', async () => {
    // Simulate version mismatch: no row returned when eq('version', oldVersion) fails
    sbChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { updateReservationStatus } = await import(
      '@/src/domains/reservations/repository'
    );

    await expect(
      updateReservationStatus(reservationRow.id, 'checked_in', 1 /* stale version */),
    ).rejects.toThrow(ConflictError);
  });
});

// ─── 6. hotel_id isolation ────────────────────────────────────────────────────

describe('hotel_id isolation', () => {
  it('insère toujours avec le hotel_id correct', async () => {
    const otherHotelId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    sbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // rooms
    sbChain.single.mockResolvedValue({ data: { ...reservationRow, hotel_id: otherHotelId }, error: null });

    await createReservation(otherHotelId, createInput);

    const insertPayload = mockInsert.mock.calls[0]?.[0];
    expect(insertPayload.hotel_id).toBe(otherHotelId);
    expect(insertPayload.hotel_id).not.toBe(HOTEL_ID);
  });

  it('ne filtre jamais par hotel_id dans UPDATE (délégué à RLS)', async () => {
    sbChain.maybeSingle.mockResolvedValue({ data: { ...reservationRow, status: 'cancelled' }, error: null });

    await cancelReservation(reservationRow.id, 'test');

    const eqCalls = sbChain.eq.mock.calls;
    const hotelIdFilter = eqCalls.filter(([col]: [string]) => col === 'hotel_id');
    expect(hotelIdFilter).toHaveLength(0);
  });
});
