/**
 * FLOWTYM — Reservation form orchestration.
 *
 * Glue between the legacy `ReservationFormModal` payload and the strongly
 * typed Supabase repositories. Owns the "create guest if needed → create
 * reservation" use case + cache invalidation + toast feedback.
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

      // 1. Guest (find by email or create)
      const guest = await findOrCreateGuest({
        hotelId,
        fullName: form.guestName.trim() || 'Walk-in',
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        nationality: form.nationality?.trim() || null,
        segment: form.segment?.trim() || null,
      });

      // 2. Resolve room id from room number when possible
      const roomId = (roomsQ.data ?? []).find((r) => r.number === form.roomNumber)?.id ?? null;

      // 3. Build + validate the typed insert payload
      const payload = createReservationInputSchema.parse({
        reference: normalizeReference(form.reference),
        guestId: guest.id,
        roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: form.adults,
        children: form.children ?? 0,
        source: form.channel || 'Direct',
        totalAmount: form.totalTTC,
        notes: form.notes ?? null,
        guestName: form.guestName,
      });

      return createReservation(hotelId, payload);
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
