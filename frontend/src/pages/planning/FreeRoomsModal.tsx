/**
 * FLOWTYM — Modale chambres libres (maquette #8).
 *
 * Liste les chambres réellement libres à une date donnée et propose des
 * actions concrètes (toutes persistées en DB, aucun bouton mort) :
 *   - Créer une réservation (préremplit le formulaire planning)
 *   - Bloquer (rooms.status = 'out_of_order')
 *   - Mettre en maintenance (rooms.status = 'maintenance')
 *
 * Le statut housekeeping et le type sont affichés pour décision rapide.
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Lock, Wrench, DoorOpen } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { RoomRow } from '@/src/lib/supabase.types';
import { useUpdateRoom } from '@/src/domains/hotel/hooks';
import { hkTone } from './RoomRowLabel';

interface FreeRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Toutes les chambres (RoomRow). */
  rooms: RoomRow[];
  /** Numéros de chambre occupés à la date sélectionnée. */
  occupiedNumbers: Set<string>;
  /** Date concernée (YYYY-MM-DD) pour le libellé + préremplissage. */
  dateIso: string;
  /** Crée une réservation préremplie pour la chambre. */
  onCreateReservation: (room: RoomRow) => void;
}

export function FreeRoomsModal({
  isOpen,
  onClose,
  rooms,
  occupiedNumbers,
  dateIso,
  onCreateReservation,
}: FreeRoomsModalProps) {
  const updateRoom = useUpdateRoom();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chambres libres = actives, non occupées ce jour, non hors-service.
  const freeRooms = useMemo(
    () =>
      rooms.filter((r) => {
        if (r.active === false) return false;
        if (occupiedNumbers.has(r.number)) return false;
        if (r.status === 'out_of_order' || r.status === 'maintenance') return false;
        return true;
      }),
    [rooms, occupiedNumbers],
  );

  if (!isOpen) return null;

  const setStatus = (room: RoomRow, status: string) => {
    setError(null);
    setBusyId(room.id);
    updateRoom.mutate(
      { id: room.id, patch: { status } },
      {
        onError: (e) => setError(e instanceof Error ? e.message : 'Échec de la mise à jour.'),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Chambres libres"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <DoorOpen size={18} className="text-indigo-500" />
            <span className="text-sm font-black text-gray-800 uppercase tracking-wide">
              {freeRooms.length} chambre{freeRooms.length > 1 ? 's' : ''} libre{freeRooms.length > 1 ? 's' : ''}
            </span>
            <span className="text-[11px] font-bold text-gray-400">· {dateIso}</span>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="px-5 py-2 bg-rose-50 text-rose-600 text-xs font-semibold border-b border-rose-100">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {freeRooms.length === 0 && (
            <div className="text-center py-10" role="status">
              <DoorOpen className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm font-bold text-gray-500">Aucune chambre libre ce jour</p>
            </div>
          )}

          {freeRooms.map((room) => {
            const tone = hkTone(room.housekeeping_status);
            const busy = busyId === room.id;
            return (
              <div key={room.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', tone.dot)} title={`Ménage : ${tone.label}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-gray-900">{room.number}</div>
                  <div className="text-[10px] font-bold text-gray-400 truncate">
                    {[room.type, room.category].filter(Boolean).join(' · ') || '—'} · {tone.label}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onCreateReservation(room)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-all active:scale-95"
                    title="Créer une réservation"
                  >
                    <Plus size={12} /> Résa
                  </button>
                  <button
                    onClick={() => setStatus(room, 'out_of_order')}
                    disabled={busy}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
                    title="Bloquer la chambre"
                    aria-label={`Bloquer la chambre ${room.number}`}
                  >
                    <Lock size={13} />
                  </button>
                  <button
                    onClick={() => setStatus(room, 'maintenance')}
                    disabled={busy}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition-all"
                    title="Mettre en maintenance"
                    aria-label={`Mettre la chambre ${room.number} en maintenance`}
                  >
                    <Wrench size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
