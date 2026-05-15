/**
 * FLOWTYM — RoomChangeModal (Flowday).
 */
import { useState } from 'react';
import { ArrowRightLeft, BedDouble, Hotel, X } from 'lucide-react';

import type { RoomRow } from '../types';
import { cn, formatReservationDate } from '../helpers';

export const RoomChangeModal = ({ row, onClose, onSave }: { row: RoomRow; onClose: () => void; onSave: (row: RoomRow, destinationRoom: string) => void }) => {
  const [destinationRoom, setDestinationRoom] = useState('');
  const availableRooms = ['103', '104', '106', '108', '109', '110', '201', '203', '204', '205'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-8 text-white">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15">
                <ArrowRightLeft size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Délogement - Changement de chambre</h3>
                <p className="mt-1 text-sm text-white/75">PMS FLOWTYM - OPÉRATIONS</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
              <h4 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-violet-600"><BedDouble size={18} />Chambre Source</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Chambre</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.room}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Catégorie</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.type}</div></div>
                </div>
                <div><label className="text-xs font-bold text-slate-400">Client</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.guest}</div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Arrivée</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{formatReservationDate(row.arrival)}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Départ</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{formatReservationDate(row.departure)}</div></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-xs font-bold text-slate-400">Adultes</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">{row.guestCount}</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Enfants</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-slate-900">0</div></div>
                  <div><label className="text-xs font-bold text-slate-400">Source</label><div className="mt-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900">{row.source}</div></div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
              <h4 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-violet-600"><Hotel size={18} />Chambre Destination</h4>
              <label className="text-xs font-bold text-slate-400">Sélectionner une chambre libre</label>
              <select value={destinationRoom} onChange={(e) => setDestinationRoom(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">-- Choisir une chambre --</option>
                {availableRooms.map((r) => <option key={r} value={r}>Ch. {r}</option>)}
              </select>
              <div className="mt-6 rounded-2xl bg-violet-50 p-5 text-sm text-violet-600">
                <p className="font-semibold">Note :</p>
                <p className="mt-1 text-violet-500">Le délogement transférera automatiquement la réservation et les informations client vers la nouvelle chambre.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Quitter</button>
          <button disabled={!destinationRoom} onClick={() => onSave(row, destinationRoom)} className={cn('ml-auto rounded-2xl px-8 py-3 font-bold text-white transition-colors', destinationRoom ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/25' : 'bg-slate-300 cursor-not-allowed')}>Valider le délogement</button>
        </div>
      </div>
    </div>
  );
};
