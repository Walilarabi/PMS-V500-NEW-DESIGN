/**
 * FLOWTYM — calendar-pricing.service unit tests.
 *
 * Tests getStayBreakdown and getPricePerNight by mocking the Zustand
 * rateCalendarStore via vi.mock + a controlled state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock rateCalendarStore ────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  roomTypes: [] as {
    roomTypeId: string;
    roomTypeName: string;
    ratePlans: {
      planId: string;
      planName: string;
      isReference?: boolean;
      prices?: { date: string; price: number; status?: string; planClosed?: boolean }[];
    }[];
    statuses?: { date: string; status: string }[];
  }[],
}));

vi.mock('@/src/components/rms/store/rateCalendarStore', () => ({
  useRateCalendarStore: {
    getState: () => mockState,
  },
}));

// ── Import after mock ─────────────────────────────────────────────────────────

const { getStayBreakdown, getPricePerNight, findRoomType, findRatePlan } = await import(
  '@/src/services/calendar-pricing.service'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function priceEntry(date: string, price: number, opts: { status?: string; planClosed?: boolean } = {}) {
  return { date, price, ...opts };
}

function roomType(id: string, plans: typeof mockState.roomTypes[0]['ratePlans'], statuses?: typeof mockState.roomTypes[0]['statuses']) {
  return { roomTypeId: id, roomTypeName: id + ' Room', ratePlans: plans, statuses };
}

// ── findRoomType ──────────────────────────────────────────────────────────────

describe('findRoomType', () => {
  beforeEach(() => {
    mockState.roomTypes = [
      roomType('std', [{ planId: 'bar', planName: 'BAR' }]),
      roomType('dbl', [{ planId: 'bar', planName: 'BAR' }]),
    ];
  });

  it('returns null for null/undefined query', () => {
    expect(findRoomType(null)).toBeNull();
    expect(findRoomType(undefined)).toBeNull();
  });

  it('matches by exact roomTypeId (case insensitive)', () => {
    const r = findRoomType('STD');
    expect(r?.roomTypeId).toBe('std');
  });

  it('matches by roomTypeName', () => {
    const r = findRoomType('dbl room');
    expect(r?.roomTypeId).toBe('dbl');
  });

  it('returns null when no match', () => {
    expect(findRoomType('penthouse')).toBeNull();
  });
});

// ── findRatePlan ──────────────────────────────────────────────────────────────

describe('findRatePlan', () => {
  const room = {
    roomTypeId: 'std',
    roomTypeName: 'Standard',
    ratePlans: [
      { planId: 'bar', planName: 'BAR Rate', isReference: true },
      { planId: 'bb', planName: 'Bed & Breakfast' },
    ],
  };

  it('returns null when room is null', () => {
    expect(findRatePlan(null, 'bar')).toBeNull();
  });

  it('returns reference plan when query is null/undefined', () => {
    const p = findRatePlan(room, null);
    expect(p?.planId).toBe('bar');
  });

  it('matches by planId', () => {
    const p = findRatePlan(room, 'bb');
    expect(p?.planId).toBe('bb');
  });

  it('matches by planName (case insensitive)', () => {
    const p = findRatePlan(room, 'bed & breakfast');
    expect(p?.planId).toBe('bb');
  });

  it('returns null for unknown plan', () => {
    expect(findRatePlan(room, 'mystery')).toBeNull();
  });
});

// ── getPricePerNight ──────────────────────────────────────────────────────────

describe('getPricePerNight', () => {
  beforeEach(() => {
    mockState.roomTypes = [
      roomType('std', [
        {
          planId: 'bar',
          planName: 'BAR',
          isReference: true,
          prices: [
            priceEntry('2026-06-10', 150),
            priceEntry('2026-06-11', 180),
            { date: '2026-06-12', price: 200, status: 'closed' },
          ],
        },
      ]),
    ];
  });

  it('returns source=fallback when room not found', () => {
    const r = getPricePerNight('unknown', 'bar', '2026-06-10');
    expect(r.source).toBe('fallback');
    expect(r.price).toBeNull();
  });

  it('returns source=fallback when plan not found', () => {
    const r = getPricePerNight('std', 'nonexistent', '2026-06-10');
    expect(r.source).toBe('fallback');
  });

  it('returns correct price from calendar', () => {
    const r = getPricePerNight('std', 'bar', '2026-06-10');
    expect(r.source).toBe('calendar');
    expect(r.price).toBe(150);
  });

  it('returns source=fallback when no price entry for that date', () => {
    const r = getPricePerNight('std', 'bar', '2026-09-01');
    expect(r.source).toBe('fallback');
    expect(r.price).toBeNull();
  });

  it('returns source=closed when price entry status is closed', () => {
    const r = getPricePerNight('std', 'bar', '2026-06-12');
    expect(r.source).toBe('closed');
    expect(r.closed).toBe(true);
  });

  it('returns source=closed when room status is closed', () => {
    mockState.roomTypes = [
      roomType(
        'std',
        [{ planId: 'bar', planName: 'BAR', prices: [priceEntry('2026-06-15', 120)] }],
        [{ date: '2026-06-15', status: 'closed' }],
      ),
    ];
    const r = getPricePerNight('std', 'bar', '2026-06-15');
    expect(r.source).toBe('closed');
  });
});

// ── getStayBreakdown ──────────────────────────────────────────────────────────

describe('getStayBreakdown', () => {
  beforeEach(() => {
    mockState.roomTypes = [
      roomType('std', [
        {
          planId: 'bar',
          planName: 'BAR',
          isReference: true,
          prices: [
            priceEntry('2026-06-10', 100),
            priceEntry('2026-06-11', 120),
            priceEntry('2026-06-12', 140),
          ],
        },
      ]),
    ];
  });

  it('returns empty breakdown for invalid dates', () => {
    const r = getStayBreakdown({ checkIn: 'bad', checkOut: '2026-06-13', roomQuery: 'std', planQuery: 'bar' });
    expect(r.nights).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it('returns empty breakdown when checkOut <= checkIn', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-13', checkOut: '2026-06-10', roomQuery: 'std', planQuery: 'bar' });
    expect(r.nights).toHaveLength(0);
  });

  it('returns empty breakdown when checkIn === checkOut', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-10', roomQuery: 'std', planQuery: 'bar' });
    expect(r.nights).toHaveLength(0);
  });

  it('generates one night entry per night of stay', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-13', roomQuery: 'std', planQuery: 'bar' });
    expect(r.nights).toHaveLength(3);
    expect(r.nights[0].date).toBe('2026-06-10');
    expect(r.nights[1].date).toBe('2026-06-11');
    expect(r.nights[2].date).toBe('2026-06-12');
  });

  it('totals prices correctly', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-13', roomQuery: 'std', planQuery: 'bar' });
    expect(r.total).toBe(360); // 100+120+140
  });

  it('allFromCalendar = true when all nights have calendar prices', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-13', roomQuery: 'std', planQuery: 'bar' });
    expect(r.allFromCalendar).toBe(true);
  });

  it('allFromCalendar = false when some nights lack calendar prices', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-14', roomQuery: 'std', planQuery: 'bar' });
    // 2026-06-13 has no price entry
    expect(r.allFromCalendar).toBe(false);
  });

  it('uses fallbackPrice for nights with no calendar entry', () => {
    const r = getStayBreakdown({
      checkIn: '2026-06-10',
      checkOut: '2026-06-14',
      roomQuery: 'std',
      planQuery: 'bar',
      fallbackPrice: 90,
    });
    // 3 nights from calendar (100+120+140) + 1 fallback (90) = 450
    expect(r.total).toBe(450);
  });

  it('anyClosed = false when no closed nights', () => {
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-13', roomQuery: 'std', planQuery: 'bar' });
    expect(r.anyClosed).toBe(false);
  });

  it('anyClosed = true when at least one night is closed', () => {
    mockState.roomTypes = [
      roomType('std', [
        {
          planId: 'bar',
          planName: 'BAR',
          prices: [
            priceEntry('2026-06-10', 100),
            { date: '2026-06-11', price: 120, status: 'closed' },
          ],
        },
      ]),
    ];
    const r = getStayBreakdown({ checkIn: '2026-06-10', checkOut: '2026-06-12', roomQuery: 'std', planQuery: 'bar' });
    expect(r.anyClosed).toBe(true);
  });
});
