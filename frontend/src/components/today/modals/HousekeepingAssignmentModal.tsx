/**
 * FLOWTYM — HousekeepingAssignmentModal (Flowday).
 */
import { useState } from 'react';
import { X } from 'lucide-react';

import type { RoomRow } from '../types';
import { housekeepers } from '../helpers';

export const HousekeepingAssignmentModal = ({ rooms, onClose, onAssign }: { rooms: RoomRow[]; onClose: () => void; onAssign: (housekeeper: string) => void }) => {
  const [selectedHousekeeper, setSelectedHousekeeper] = useState(housekeepers[0]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-7 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">Attribuer le ménage</h3>
              <p className="mt-1 text-sm font-semibold text-white/70">{rooms.length} chambre(s) sélectionnée(s)</p>
            </div>
            <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={22} /></button>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Femme de chambre</label>
            <select value={selectedHousekeeper} onChange={(event) => setSelectedHousekeeper(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500">
              {housekeepers.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">Chambres à assigner</div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                  <div className="font-black text-slate-900">Ch. {room.room}</div>
                  <div className="truncate px-3 font-semibold text-slate-500">{room.guest}</div>
                  <div className="text-xs font-bold text-slate-400">{room.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-7 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={() => onAssign(selectedHousekeeper)} className="flex-1 rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors">Attribuer</button>
        </div>
      </div>
    </div>
  );
};
