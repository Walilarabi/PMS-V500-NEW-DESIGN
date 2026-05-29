/**
 * FLOWTYM — useCreateReservationFromForm
 *
 * Bridge entre ReservationFormModal (ReservationFormData) et
 * useCreateReservation (CreateReservationInput).
 *
 * Responsabilités :
 *   1. Mapper ReservationFormData → CreateReservationInput
 *   2. Générer une référence unique si absente
 *   3. Appeler useCreateReservation().mutateAsync()
 *   4. L'invalidation du cache est gérée par useCreateReservation.onSuccess
 *      qui invalide ['reservations'] → couvre list, range, et TodayView
 */
import { useCallback } from 'react';
import type { ReservationFormData } from '@/src/components/modals/ReservationFormModal';
import { useCreateReservation } from './hooks';

function generateReference(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const buf = crypto.getRandomValues(new Uint8Array(3));
  const randPart = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 4).toUpperCase();
  return `RES-${datePart}-${randPart}`;
}

export function useCreateReservationFromForm() {
  const mutation = useCreateReservation();

  const createFromForm = useCallback(
    async (data: ReservationFormData): Promise<void> => {
      // Référence : utiliser celle du formulaire ou en générer une
      const reference = data.reference?.trim()
        ? data.reference.trim().toUpperCase().replace(/\s+/g, '-')
        : generateReference();

      await mutation.mutateAsync({
        reference,
        guestName: data.guestName || null,
        guestEmail: data.email || null,
        guestPhone: data.phone || null,
        roomNumber: data.roomNumber || null,
        roomType: data.roomType || null,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        // nights est calculé par le repository depuis checkIn/checkOut
        adults: data.adults,
        children: data.children,
        source: data.channel || 'Direct',
        totalAmount: data.totalTTC,
        notes: data.notes || null,
      });
    },
    [mutation],
  );

  return {
    createFromForm,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
