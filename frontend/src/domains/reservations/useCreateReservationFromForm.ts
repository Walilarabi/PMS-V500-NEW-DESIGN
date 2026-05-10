/**
 * FLOWTYM — Reservation form orchestration.
 *
 * Glue between the legacy `ReservationFormModal` payload and the strongly
 * typed Supabase repositories. Owns the "create guest if needed → create
 * reservation(s)" use case + cache invalidation + toast feedback.
 *
 * If the form payload contains multiple `selectedRoomNumbers`, ONE reservation
 * per room is created (shared guest, dates, channel — different room + ref).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { useRooms } from '@/src/domains/hotel/hooks';
import { findOrCreateGuest } from '@/src/domains/guests/repository';
import { createReservation } from '@/src/domains/reservations/repository';
import { createReservationInputSchema } from '@/src/domains/reservations/schemas';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { ReservationFormData } from '@/src/components/modals/ReservationFormModal';

/** Generates a deterministic uppercase reference if the form did not supply one. */
function genReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `RES-${ts.slice(-6)}`;
}

function normalizeReference(raw: string | undefined): string {
  if (!raw) return genReference();
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return cleaned.length >= 3 ? cleaned : genReference();
}

export function useCreateReservationFromForm(): {
  createFromForm: (data: ReservationFormData) => Promise<ReservationRow>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const { session } = useAuth();
  const roomsQ = useRooms();

  const mutation = useMutation<ReservationRow, Error, ReservationFormData>({
    mutationFn: async (form) => {
      const hotelId = session?.tenantId;
      if (!hotelId) throw new Error('Hôtel actif inconnu — reconnecte-toi.');

      // Determine the room numbers to create reservations for (multi-select aware)
      const roomNumbers = form.selectedRoomNumbers && form.selectedRoomNumbers.length > 0
        ? form.selectedRoomNumbers
        : [form.roomNumber];
      if (roomNumbers.length === 0) throw new Error('Aucune chambre sélectionnée.');

      // 1. Guest (find by email or create) — shared across all reservations
      const guest = await findOrCreateGuest({
        hotelId,
        fullName: form.guestName.trim() || 'Walk-in',
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        nationality: form.nationality?.trim() || null,
        segment: form.segment?.trim() || null,
      });

      // 2. Pre-resolve room ids
      const rooms = roomsQ.data ?? [];
      const baseRef = normalizeReference(form.reference);
      const totalRooms = roomNumbers.length;
      const totalPerRoom = totalRooms > 0 ? form.totalTTC / totalRooms : form.totalTTC;

      // 3. Create one reservation per selected room
      let firstRow: ReservationRow | null = null;
      for (let i = 0; i < roomNumbers.length; i++) {
        const number = roomNumbers[i];
        const room = rooms.find((r) => r.number === number);
        const ref = roomNumbers.length === 1 ? baseRef : `${baseRef}-${String(i + 1).padStart(2, '0')}`;
        const payload = createReservationInputSchema.parse({
          reference: ref,
          guestId: guest.id,
          roomId: room?.id ?? null,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: form.adults,
          children: form.children ?? 0,
          source: form.channel || 'Direct',
          totalAmount: totalPerRoom,
          notes: form.notes ?? null,
          guestName: form.guestName,
        });
        const row = await createReservation(hotelId, payload);
        if (!firstRow) firstRow = row;
      }
      if (!firstRow) throw new Error('Aucune réservation créée.');
      return firstRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reservations'] });
      void qc.invalidateQueries({ queryKey: ['guests-by-ids'] });
    },
  });

  return {
    createFromForm: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
