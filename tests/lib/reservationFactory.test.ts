/**
 * FLOWTYM — reservationFactory unit tests.
 *
 * Covers buildReservation: field mapping, status derivation, defaults.
 */
import { describe, it, expect } from 'vitest';
import { buildReservation } from '@/src/lib/reservationFactory';
import type { ReservationInput } from '@/src/lib/reservationFactory';

// ── Helpers ───────────────────────────────────────────────────────────────────

function input(overrides: Partial<ReservationInput> = {}): ReservationInput {
  return {
    reference: 'RES-001',
    guestName: 'Alice Martin',
    roomNumber: '101',
    checkIn: '2026-06-10',
    checkOut: '2026-06-13',
    channel: 'Direct',
    totalTTC: 450,
    ...overrides,
  };
}

// ── Field mapping ─────────────────────────────────────────────────────────────

describe('buildReservation — field mapping', () => {
  it('maps reference → id', () => {
    const r = buildReservation(input({ reference: 'RES-XYZ' }));
    expect(r.id).toBe('RES-XYZ');
  });

  it('maps guestName → client', () => {
    const r = buildReservation(input({ guestName: 'Bob Dupont' }));
    expect(r.client).toBe('Bob Dupont');
  });

  it('maps roomNumber → room', () => {
    const r = buildReservation(input({ roomNumber: '205' }));
    expect(r.room).toBe('205');
  });

  it('maps totalTTC → totalAmount', () => {
    const r = buildReservation(input({ totalTTC: 999 }));
    expect(r.totalAmount).toBe(999);
  });

  it('maps checkIn with 16:00 arrival time', () => {
    const r = buildReservation(input({ checkIn: '2026-07-01' }));
    expect(r.arrival).toBe('2026-07-01 16:00');
    expect(r.checkIn).toBe('2026-07-01');
  });

  it('maps checkOut with 11:00 departure time', () => {
    const r = buildReservation(input({ checkOut: '2026-07-04' }));
    expect(r.departure).toBe('2026-07-04 11:00');
    expect(r.checkOut).toBe('2026-07-04');
  });

  it('uppercases channel for source', () => {
    const r = buildReservation(input({ channel: 'booking' }));
    expect(r.source).toBe('BOOKING');
  });

  it('maps optional email and phone', () => {
    const r = buildReservation(input({ email: 'a@b.com', phone: '+33600000000' }));
    expect(r.email).toBe('a@b.com');
    expect(r.phone).toBe('+33600000000');
  });

  it('maps nationality', () => {
    const r = buildReservation(input({ nationality: 'FR' }));
    expect(r.nationality).toBe('FR');
  });

  it('maps notes', () => {
    const r = buildReservation(input({ notes: 'Late arrival' }));
    expect(r.notes).toBe('Late arrival');
  });
});

// ── Status derivation ─────────────────────────────────────────────────────────

describe('buildReservation — status derivation', () => {
  it('defaults to confirmed status when not specified', () => {
    const r = buildReservation(input());
    expect(r.status).toBe('Confirmée');
    expect(r.reservationStatus).toBe('confirmed');
  });

  it('maps explicit confirmed status', () => {
    const r = buildReservation(input({ reservationStatus: 'confirmed' }));
    expect(r.status).toBe('Confirmée');
    expect(r.dotColor).toBe('bg-indigo-400');
    expect(r.statusColor).toBe('text-indigo-500/80');
  });

  it('maps cancelled status to Annulée', () => {
    const r = buildReservation(input({ reservationStatus: 'cancelled' }));
    expect(r.status).toBe('Annulée');
    expect(r.statusColor).toBe('text-red-500/80');
    expect(r.dotColor).toBe('bg-red-400');
  });
});

// ── Defaults ─────────────────────────────────────────────────────────────────

describe('buildReservation — defaults', () => {
  it('defaults roomType to STD/DLX when not provided', () => {
    const r = buildReservation(input());
    expect(r.roomType).toBe('STD/DLX');
  });

  it('uses provided roomType when given', () => {
    const r = buildReservation(input({ roomType: 'STE' }));
    expect(r.roomType).toBe('STE');
  });

  it('defaults adults to 2 and children to 0', () => {
    const r = buildReservation(input());
    expect(r.guests.adults).toBe(2);
    expect(r.guests.children).toBe(0);
  });

  it('uses provided adults and children', () => {
    const r = buildReservation(input({ adults: 1, children: 2 }));
    expect(r.guests.adults).toBe(1);
    expect(r.guests.children).toBe(2);
  });

  it('sets Direct channel source color to green', () => {
    const r = buildReservation(input({ channel: 'Direct' }));
    expect(r.sourceColor).toBe('bg-green-400');
  });

  it('sets non-Direct channel source color to indigo', () => {
    const r = buildReservation(input({ channel: 'Booking' }));
    expect(r.sourceColor).toBe('bg-indigo-400');
  });

  it('sets payment to Payé when paymentStatus is Payé', () => {
    const r = buildReservation(input({ paymentStatus: 'Payé' }));
    expect(r.payment).toBe('Payé');
  });

  it('defaults payment to Partiel for any other payment status', () => {
    const r = buildReservation(input({ paymentStatus: 'Pending' }));
    expect(r.payment).toBe('Partiel');
  });

  it('vip = true when segment is VIP', () => {
    const r = buildReservation(input({ segment: 'VIP' }));
    expect(r.vip).toBe(true);
  });

  it('vip = false for non-VIP segment', () => {
    const r = buildReservation(input({ segment: 'Corporate' }));
    expect(r.vip).toBe(false);
  });

  it('sets fixed owner fee rate to 20%', () => {
    const r = buildReservation(input());
    expect(r.ownerFeeRate).toBe(0.20);
  });

  it('sets fixed PMS fee rate to 15%', () => {
    const r = buildReservation(input());
    expect(r.pmsFeeRate).toBe(0.15);
  });

  it('sets fixed cleaning fee to 50', () => {
    const r = buildReservation(input());
    expect(r.cleaningFee).toBe(50);
  });

  it('propagates isOverbooking flag', () => {
    const r = buildReservation(input({ isOverbooking: true }));
    expect(r.isOverbooking).toBe(true);
  });

  it('propagates dynamicPriceApplied flag', () => {
    const r = buildReservation(input({ dynamicPriceApplied: true }));
    expect(r.dynamicPriceApplied).toBe(true);
  });

  it('propagates appliedPricingRules array', () => {
    const r = buildReservation(input({ appliedPricingRules: ['rule-high', 'rule-lastminute'] }));
    expect(r.appliedPricingRules).toEqual(['rule-high', 'rule-lastminute']);
  });
});
