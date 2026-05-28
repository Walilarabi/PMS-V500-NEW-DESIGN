/**
 * BlockRoomsModal — Bloquer une ou plusieurs chambres sur une plage de dates.
 * Insère dans la table `room_blocks`.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, CalendarDays, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';

interface Room {
  id: string;
  number: string;
  type: string;
}

interface Props {
  isOpen: boolean;
  dateStr: string | null;  // YYYY-MM-DD — pre-filled start date
  rooms: Room[];
  onClose: () => void;
  onSaved?: () => void;
}

const REASONS = [
  { value: 'maintenance', label: 'Maintenance / Travaux' },
  { value: 'cleaning', label: 'Nettoyage approfondi' },
  { value: 'out_of_order', label: 'Hors service' },
  { value: 'vip_hold', label: 'Réservation VIP' },
  { value: 'group_hold', label: 'Blocage groupe' },
  { value: 'other', label: 'Autre' },
];

export const BlockRoomsModal: React.FC<Props> = ({ isOpen, dateStr, rooms, onClose, onSaved }) => {
  const { session } = useAuth();
  const qc = useQueryClient();

  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(dateStr ?? '');
  const [endDate, setEndDate] = useState(dateStr ?? '');
  const [reason, setReason] = useState('maintenance');
  const [notes, setNotes] = useState('');
  const [blockAll, setBlockAll] = useState(false);

  // Reset form when opening
  React.useEffect(() => {
    if (isOpen) {
      setSelectedRooms([]);
      setStartDate(dateStr ?? '');
      setEndDate(dateStr ?? '');
      setReason('maintenance');
      setNotes('');
      setBlockAll(false);
    }
  }, [isOpen, dateStr]);

  const blockMut = useMutation({
    mutationFn: async () => {
      const hotelId = session?.tenantId;
      const roomsToBlock = blockAll ? rooms : rooms.filter(r => selectedRooms.includes(r.id));
      if (!roomsToBlock.length) throw new Error('Sélectionnez au moins une chambre');
      if (!startDate || !endDate) throw new Error('Dates requises');
      if (endDate < startDate) throw new Error('La date de fin doit être ≥ à la date de début');

      const rows = roomsToBlock.map(r => ({
        hotel_id: hotelId ?? null,
        room_id: r.id,
        start_date: startDate,
        end_date: endDate,
        reason,
        notes: notes || null,
      }));

      const { error } = await supabase.from('room_blocks').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
      void qc.invalidateQueries({ queryKey: ['room-blocks'] });
      toast.success('Chambres bloquées avec succès');
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleRoom = (id: string) =>
    setSelectedRooms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const roomCount = blockAll ? rooms.length : selectedRooms.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bloquer des chambres</h3>
                  <p className="text-[11px] text-slate-500">
                    {dateStr ? `À partir du ${dateStr}` : 'Sélectionnez une période'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <CalendarDays size={10} className="inline mr-1" />Début
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <CalendarDays size={10} className="inline mr-1" />Fin
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              </div>

              {/* Reason */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motif</span>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>

              {/* Room selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Chambres</span>
                  <button
                    onClick={() => setBlockAll(v => !v)}
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-md transition',
                      blockAll ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {blockAll ? 'Toutes sélectionnées' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="grid max-h-36 grid-cols-4 gap-1.5 overflow-y-auto">
                  {rooms.slice(0, 40).map(r => {
                    const active = blockAll || selectedRooms.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setBlockAll(false); toggleRoom(r.id); }}
                        className={cn(
                          'rounded-lg border py-1.5 text-[11px] font-bold transition',
                          active
                            ? 'border-orange-300 bg-orange-100 text-orange-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {r.number}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes (optionnel)</span>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Détails, contact responsable…"
                  className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </label>

              {roomCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[12px] text-orange-800">
                  <AlertTriangle size={13} />
                  <span><strong>{roomCount}</strong> chambre{roomCount > 1 ? 's' : ''} bloquée{roomCount > 1 ? 's' : ''} du {startDate} au {endDate}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                onClick={onClose}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                disabled={blockMut.isPending || roomCount === 0}
                onClick={() => blockMut.mutate()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition"
              >
                <Lock size={14} />
                {blockMut.isPending ? 'Blocage…' : `Bloquer ${roomCount > 0 ? roomCount + ' chambre' + (roomCount > 1 ? 's' : '') : ''}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
