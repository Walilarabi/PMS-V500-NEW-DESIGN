/**
 * FLOWTYM — Clients Kanban view (Wave C2)
 *
 * Vue Kanban : colonnes par niveau de fidélité, cartes clients cliquables.
 */

import React from 'react';
import { Crown, Gem, Star, Medal, Sparkles, ShieldAlert, Moon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { GuestRowDto } from '@/src/domains/guests/schemas';

const COLUMNS: { key: string; label: string; icon: React.ReactNode; head: string }[] = [
  { key: 'Platinum', label: 'Platinum', icon: <Gem size={13} fill="currentColor" />,   head: 'bg-blue-50 text-blue-600 border-blue-100' },
  { key: 'Gold',     label: 'Gold',     icon: <Crown size={13} fill="currentColor" />, head: 'bg-amber-50 text-amber-600 border-amber-100' },
  { key: 'Silver',   label: 'Argent',   icon: <Star size={13} fill="currentColor" />,  head: 'bg-gray-100 text-gray-500 border-gray-200' },
  { key: 'Standard', label: 'Standard', icon: <Medal size={13} />,                     head: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/15' },
];

const initials = (g: GuestRowDto) =>
  [g.first_name, g.last_name].filter(Boolean).map((n) => n![0].toUpperCase()).join('');

const fullName = (g: GuestRowDto) =>
  [g.first_name, g.last_name].filter(Boolean).join(' ') || g.last_name;

const GuestCard: React.FC<{ g: GuestRowDto; onSelect: (id: string) => void }> = ({ g, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(g.id)}
    className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 hover:border-[#8B5CF6]/40 hover:shadow-sm transition-all group"
  >
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-[11px] font-bold text-[#8B5CF6] shrink-0">
        {initials(g)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-gray-900 truncate group-hover:text-[#8B5CF6] transition-colors">
          {fullName(g)}
        </div>
        <div className="text-[10px] text-gray-400 truncate">{g.email || g.phone || '—'}</div>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2.5">
      <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
        <Moon size={10} /> {g.total_stays ?? 0} séjour{(g.total_stays ?? 0) !== 1 ? 's' : ''}
      </span>
      <span className="text-[11px] font-bold text-gray-900">
        {(g.total_spent ?? 0).toLocaleString('fr-FR')} €
      </span>
    </div>
    {(g.vip || g.blacklisted) && (
      <div className="flex gap-1 mt-2">
        {g.vip && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
            <Sparkles size={8} /> VIP
          </span>
        )}
        {g.blacklisted && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
            <ShieldAlert size={8} /> Blacklist
          </span>
        )}
      </div>
    )}
  </button>
);

export const ClientsKanban = ({
  guests,
  onSelect,
}: {
  guests: GuestRowDto[];
  onSelect: (id: string) => void;
}) => {
  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: guests
      .filter((g) => (g.loyalty_level ?? 'Standard') === col.key)
      .sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0)),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {grouped.map((col) => (
        <div key={col.key} className="flex flex-col min-h-0">
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-xl border mb-3',
            col.head,
          )}>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              {col.icon} {col.label}
            </span>
            <span className="text-[11px] font-bold bg-white/60 px-1.5 rounded">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {col.items.map((g) => (
              <GuestCard key={g.id} g={g} onSelect={onSelect} />
            ))}
            {col.items.length === 0 && (
              <div className="text-[11px] text-gray-300 font-medium text-center py-6 border border-dashed border-gray-200 rounded-xl">
                Aucun client
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClientsKanban;
