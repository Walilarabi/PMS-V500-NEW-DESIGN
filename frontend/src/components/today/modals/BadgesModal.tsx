/**
 * FLOWTYM — BadgesModal (Flowday).
 *
 * Persistance RÉELLE des badges client : RPC set_guest_badges (met à jour
 * guests.badges, dérive vip/blacklisted, historise). Le badge remonte ensuite
 * partout (Flowday, Planning, fiche réservation, CRM) car lu depuis la base.
 */
import { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, History, Loader2 } from 'lucide-react';

import type { BadgeType, RoomRow } from '../types';
import { cn } from '../helpers';
import { BADGE_CATALOG, normalizeBadges, badgeDef } from '@/src/services/communication/badges';
import { setGuestBadges, listBadgeHistory, type BadgeHistoryEntry } from '@/src/services/communication/badgeService';

export const BadgesModal = ({ row, onClose, onSave }: { row: RoomRow; onClose: () => void; onSave: (row: RoomRow, badges: BadgeType[]) => void }) => {
  const [selectedBadges, setSelectedBadges] = useState<BadgeType[]>(
    () => normalizeBadges(row.badges) as BadgeType[],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BadgeHistoryEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const canPersist = Boolean(row.guestId);

  useEffect(() => {
    if (showHistory && history === null && row.guestId) {
      listBadgeHistory(row.guestId).then(setHistory).catch(() => setHistory([]));
    }
  }, [showHistory, history, row.guestId]);

  const toggleBadge = (badge: BadgeType) => {
    setSelectedBadges((prev) => prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]);
  };

  const handleSave = async () => {
    setError(null);
    if (!row.guestId) {
      setError('Ce client n\'est pas relié à une fiche client : impossible d\'enregistrer le badge.');
      return;
    }
    setSaving(true);
    try {
      const persisted = await setGuestBadges({
        guestId: row.guestId,
        badges: selectedBadges,
        reservationId: row.reservationUuid ?? null,
        source: 'flowday',
      });
      onSave(row, persisted as BadgeType[]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'enregistrement des badges.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Gérer les badges</h3>
            <p className="text-sm text-slate-400">{row.guest} · CHAMBRE {row.room}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>

        {!canPersist && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Client non relié à une fiche : les badges ne pourront pas être enregistrés.</span>
          </div>
        )}

        <div className="max-h-[46vh] overflow-y-auto p-6 space-y-3">
          {BADGE_CATALOG.map((badge) => {
            const active = selectedBadges.includes(badge.key as BadgeType);
            return (
              <button key={badge.key} onClick={() => toggleBadge(badge.key as BadgeType)} className={cn('flex w-full items-center justify-between rounded-2xl border-2 p-4 transition-all', active ? cn(badge.color, 'border-current shadow-sm') : 'border-slate-100 bg-slate-50 hover:bg-slate-100')}>
                <div className="flex items-center gap-3 text-left">
                  <span className="text-xl">{badge.icon}</span>
                  <div>
                    <span className={cn('block font-semibold', active ? 'text-current' : 'text-slate-700')}>{badge.label}</span>
                    <span className="block text-xs text-slate-400">{badge.description}</span>
                  </div>
                </div>
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-violet-600 bg-violet-600' : 'border-slate-300')}>
                  {active && <Check size={14} className="text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mx-6 mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canPersist && (
          <div className="px-6">
            <button onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
              <History size={14} />{showHistory ? 'Masquer' : 'Afficher'} l'historique
            </button>
            {showHistory && (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                {history === null ? 'Chargement…' : history.length === 0 ? 'Aucun changement enregistré.' : (
                  <ul className="space-y-1.5">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <span>{new Date(h.changed_at).toLocaleString('fr-FR')}</span>
                        <span className="truncate text-slate-600">
                          {(h.new_badges ?? []).map((b) => badgeDef(b)?.icon ?? '•').join(' ') || '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Annuler</button>
          <button onClick={handleSave} disabled={saving || !canPersist} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />}Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
