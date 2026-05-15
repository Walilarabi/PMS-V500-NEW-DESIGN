/**
 * FLOWTYM — BadgesModal (Flowday).
 */
import { useState } from 'react';
import { Check, X } from 'lucide-react';

import type { BadgeType, RoomRow } from '../types';
import { cn } from '../helpers';

export const BadgesModal = ({ row, onClose, onSave }: { row: RoomRow; onClose: () => void; onSave: (row: RoomRow, badges: BadgeType[]) => void }) => {
  const [selectedBadges, setSelectedBadges] = useState<BadgeType[]>(row.badges ?? (row.vip ? ['vip'] : []));

  const toggleBadge = (badge: BadgeType) => {
    setSelectedBadges((prev) => prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]);
  };

  const badgeOptions: { id: BadgeType; label: string; icon: string; color: string }[] = [
    { id: 'vip', label: 'VIP', icon: '👑', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { id: 'prioritaire', label: 'Prioritaire', icon: '⚡', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'nouveau', label: 'Nouveau client', icon: '✨', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: 'fidele', label: 'Fidèle', icon: '❤️', color: 'bg-pink-50 text-pink-600 border-pink-200' },
    { id: 'incident', label: 'Incident', icon: '🚩', color: 'bg-red-50 text-red-600 border-red-200' },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Gérer les badges</h3>
            <p className="text-sm text-slate-400">CHAMBRE {row.room}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-3">
          {badgeOptions.map((badge) => (
            <button key={badge.id} onClick={() => toggleBadge(badge.id)} className={cn('flex w-full items-center justify-between rounded-2xl border-2 p-4 transition-all', selectedBadges.includes(badge.id) ? cn(badge.color, 'border-current shadow-sm') : 'border-slate-100 bg-slate-50 hover:bg-slate-100')}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{badge.icon}</span>
                <span className={cn('font-semibold', selectedBadges.includes(badge.id) ? 'text-current' : 'text-slate-600')}>{badge.label}</span>
              </div>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', selectedBadges.includes(badge.id) ? 'border-violet-600 bg-violet-600' : 'border-slate-300')}>
                {selectedBadges.includes(badge.id) && <Check size={14} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={() => onSave(row, selectedBadges)} className="flex-1 rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors">Enregistrer</button>
        </div>
      </div>
    </div>
  );
};
