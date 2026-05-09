/**
 * FLOWTYM — Shared domain primitives.
 *
 * Branded types prevent accidental misuse (e.g. passing a UserId where a
 * HotelId is expected). They cost nothing at runtime.
 */

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, 'TenantId'>;
export type HotelId = Brand<string, 'HotelId'>;
export type UserId = Brand<string, 'UserId'>;
export type ReservationId = Brand<string, 'ReservationId'>;
export type RoomId = Brand<string, 'RoomId'>;
export type GuestId = Brand<string, 'GuestId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;

export const asTenantId = (v: string): TenantId => v as TenantId;
export const asHotelId = (v: string): HotelId => v as HotelId;
export const asUserId = (v: string): UserId => v as UserId;
export const asReservationId = (v: string): ReservationId => v as ReservationId;
export const asRoomId = (v: string): RoomId => v as RoomId;
export const asGuestId = (v: string): GuestId => v as GuestId;

/** Money is always stored as integer cents to avoid float drift. */
export type Cents = Brand<number, 'Cents'>;
export const asCents = (v: number): Cents => Math.round(v) as Cents;
export const centsToEuros = (c: Cents): number => c / 100;
export const eurosToCents = (e: number): Cents => Math.round(e * 100) as Cents;
