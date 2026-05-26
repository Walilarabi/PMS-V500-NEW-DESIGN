/**
 * EventsNotificationBanner — bandeau de notification discret (non-bloquant).
 *
 * Remplace l'auto-ouverture de la modale de validation au chargement du module.
 * Affiche le nombre de candidats détectés, permet de les ouvrir manuellement
 * ou de fermer le bandeau (les candidats restent dans le store).
 */
import React from 'react';
import { Bell, X, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface Props {
  count: number;
  lastSearchAt?: string;
  onOpen: () => void;
  onDismiss: () => void;
}

function formatTimeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const diffSec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diffSec < 60)        return `il y a ${Math.floor(diffSec)} s`;
  if (diffSec < 3600)      return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86_400)    return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 86_400 * 7) return `il y a ${Math.floor(diffSec / 86_400)} j`;
  return d.toLocaleDateString('fr-FR');
}

export const EventsNotificationBanner: React.FC<Props> = ({
  count, lastSearchAt, onOpen, onDismiss,
}) => {
  if (count <= 0) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm',
        'bg-gradient-to-r from-violet-50 via-violet-50/70 to-white',
        'ring-1 ring-violet-200',
        'animate-in fade-in slide-in-from-top-2 duration-300',
      )}
    >
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center ring-1 ring-violet-200">
          <Bell className="w-4 h-4" />
        </div>
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">
          {count} nouvel événement{count > 1 ? 's' : ''} détecté{count > 1 ? 's' : ''}
        </div>
        <div className="text-[11.5px] text-slate-500 truncate">
          Détection automatique multi-sources{lastSearchAt && ` · ${formatTimeAgo(lastSearchAt)}`}
        </div>
      </div>
      <button
        onClick={onOpen}
        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 shadow-sm shadow-violet-600/20 flex items-center gap-1"
      >
        Examiner
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onDismiss}
        title="Masquer la notification"
        aria-label="Masquer la notification"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
