/**
 * DEBUG PANEL
 * 
 * Affiche l'état actuel des stores pour diagnostiquer les problèmes de sync.
 * À monter temporairement dans App.tsx pour vérifier que la sync fonctionne.
 * 
 * Usage:
 *   import { DebugPanel } from './components/DebugPanel';
 *   <DebugPanel />
 */

import React from 'react';
import { useConfigStore } from '@/src/store/configStore';
import { useReservations } from '@/src/contexts/ReservationContext';
import { useAuth } from '@/src/domains/auth/AuthContext';

export const DebugPanel: React.FC = () => {
  const { status, session } = useAuth();
  const { rooms } = useConfigStore();
  const { reservations } = useReservations();

  const [isOpen, setIsOpen] = React.useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 font-mono text-xs"
      >
        🐛 DEBUG
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-white border-2 border-purple-600 rounded-lg shadow-2xl w-96 max-h-[600px] overflow-auto">
      <div className="sticky top-0 bg-purple-600 text-white px-4 py-2 flex items-center justify-between">
        <span className="font-bold">🐛 DEBUG PANEL</span>
        <button onClick={() => setIsOpen(false)} className="hover:bg-purple-700 px-2 py-1 rounded">
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 font-mono text-xs">
        {/* AUTH */}
        <div>
          <div className="font-bold text-purple-600 mb-1">AUTH</div>
          <div className="bg-gray-50 p-2 rounded">
            <div>Status: <span className="font-bold">{status}</span></div>
            <div>Hotel ID: <span className="font-bold text-xs break-all">{session?.tenantId ?? 'null'}</span></div>
          </div>
        </div>

        {/* ROOMS */}
        <div>
          <div className="font-bold text-purple-600 mb-1">ROOMS (configStore)</div>
          <div className="bg-gray-50 p-2 rounded">
            <div>Count: <span className="font-bold text-lg">{rooms.length}</span></div>
            {rooms.length > 0 && (
              <div className="mt-2 text-[10px]">
                <div>First: {rooms[0].number} ({rooms[0].type})</div>
                <div>Last: {rooms[rooms.length - 1].number} ({rooms[rooms.length - 1].type})</div>
              </div>
            )}
            {rooms.length === 0 && (
              <div className="text-red-600 mt-1">⚠️ EMPTY</div>
            )}
          </div>
        </div>

        {/* RESERVATIONS */}
        <div>
          <div className="font-bold text-purple-600 mb-1">RESERVATIONS (context)</div>
          <div className="bg-gray-50 p-2 rounded">
            <div>Count: <span className="font-bold text-lg">{reservations.length}</span></div>
            {reservations.length > 0 && (
              <div className="mt-2 text-[10px] space-y-1">
                <div>
                  First: {reservations[0].client} - Room {reservations[0].room}
                </div>
                <div className="truncate">
                  CheckIn: {reservations[0].checkIn ?? reservations[0].arrival}
                </div>
              </div>
            )}
            {reservations.length === 0 && (
              <div className="text-red-600 mt-1">⚠️ EMPTY</div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="pt-2 border-t">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 font-bold text-xs"
          >
            🔥 CLEAR ALL & RELOAD
          </button>
        </div>
      </div>
    </div>
  );
};
