/**
 * Modal wrapper pour le moteur de recherche live multi-sources.
 * Reprend l'UI complète d'EventLiveSearchView sans encombrer le layout principal.
 */
import React from 'react';
import { X } from 'lucide-react';
import { EventLiveSearchView } from './EventLiveSearchView';

interface EventLiveSearchModalProps {
  open: boolean;
  onClose: () => void;
  onImportEvents: () => void;
}

export const EventLiveSearchModal: React.FC<EventLiveSearchModalProps> = ({
  open,
  onClose,
  onImportEvents,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-[1200px] ring-1 ring-slate-200 relative max-h-[calc(100vh-3rem)] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center shadow-sm"
          aria-label="Fermer la recherche"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6">
          <EventLiveSearchView
            onImportEvents={() => {
              onImportEvents();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
