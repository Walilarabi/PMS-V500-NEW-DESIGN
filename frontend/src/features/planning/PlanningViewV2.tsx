/**
 * FLOWTYM — PLANNING VIEW V2
 * 
 * Refonte complète du Planning selon standards enterprise.
 * 
 * ARCHITECTURE:
 * - usePlanningData() centralise fetch + realtime
 * - ReservationCard gère l'affichage sans overflow
 * - Grid layout strict avec cellules fixes
 * - Design premium, minimaliste, performant
 * 
 * TODO (phases suivantes):
 * - Drag & drop avec conflict detection
 * - Filtres avancés (floor, type, status)
 * - Revenue overlay
 * - Quick actions toolbar
 */

import React, { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePlanningData } from './hooks/usePlanningData';
import { ReservationCard } from './components/ReservationCard';
import { typography, spacing } from '@/src/design-system/tokens';
import { cn } from '@/src/lib/utils';

const CELL_WIDTH = 50;  // Largeur cellule en px
const ROW_HEIGHT = 40;  // Hauteur ligne chambre
const VIEW_LENGTH = 14; // Nombre de jours affichés

export const PlanningView = () => {
  const { rooms, reservations, loading } = usePlanningData();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Générer les dates affichées
  const displayedDates = useMemo(() => {
    const start = startOfDay(currentDate);
    return Array.from({ length: VIEW_LENGTH }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Filtrer réservations visibles dans la fenêtre
  const visibleReservations = useMemo(() => {
    const startMs = displayedDates[0].getTime();
    const endMs = displayedDates[displayedDates.length - 1].getTime() + 86400000;

    return reservations.filter((res) => {
      const checkInMs = new Date(res.checkIn).getTime();
      const checkOutMs = new Date(res.checkOut).getTime();
      return checkOutMs > startMs && checkInMs < endMs;
    });
  }, [reservations, displayedDates]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4" />
          <p className={cn(typography.body.base, 'text-gray-600')}>
            Chargement du planning...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className={cn('bg-white border-b border-gray-200', spacing.section.padding)}>
        <div className="flex items-center justify-between">
          <h1 className={typography.heading.h2}>Planning</h1>
          
          {/* Navigation dates */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate((d) => addDays(d, -VIEW_LENGTH))}
              className={cn(
                typography.ui.button.md,
                'px-4 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50'
              )}
            >
              ← {VIEW_LENGTH}j
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className={cn(
                typography.ui.button.md,
                'px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryHover'
              )}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setCurrentDate((d) => addDays(d, VIEW_LENGTH))}
              className={cn(
                typography.ui.button.md,
                'px-4 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50'
              )}
            >
              {VIEW_LENGTH}j →
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Timeline header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 flex">
            {/* Room column header */}
            <div
              className={cn(
                'sticky left-0 bg-white border-r border-gray-200 flex items-center justify-center',
                typography.table.header
              )}
              style={{ width: '120px', height: `${ROW_HEIGHT}px` }}
            >
              Chambre
            </div>

            {/* Date headers */}
            {displayedDates.map((date, idx) => {
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-gray-200',
                    isToday && 'bg-brand-primary/5'
                  )}
                  style={{ width: `${CELL_WIDTH}px`, height: `${ROW_HEIGHT}px` }}
                >
                  <span className={typography.planning.dateDay}>
                    {format(date, 'd', { locale: fr })}
                  </span>
                  <span className={typography.planning.dateMonth}>
                    {format(date, 'MMM', { locale: fr })}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {rooms.map((room) => {
            const roomReservations = visibleReservations.filter(
              (res) => res.roomNumber === room.number
            );

            return (
              <div key={room.id} className="flex border-b border-gray-100">
                {/* Room label */}
                <div
                  className={cn(
                    'sticky left-0 bg-white border-r border-gray-200 flex flex-col justify-center px-3',
                    'z-10'
                  )}
                  style={{ width: '120px', height: `${ROW_HEIGHT}px` }}
                >
                  <span className={typography.planning.roomNumber}>{room.number}</span>
                  <span className={typography.planning.roomType}>{room.type}</span>
                </div>

                {/* Date cells + reservations */}
                <div className="relative flex">
                  {displayedDates.map((date, idx) => {
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'border-r border-gray-100',
                          isToday && 'bg-brand-primary/5'
                        )}
                        style={{ width: `${CELL_WIDTH}px`, height: `${ROW_HEIGHT}px` }}
                      />
                    );
                  })}

                  {/* Render reservations as overlays */}
                  {roomReservations.map((res) => {
                    const checkInMs = new Date(res.checkIn).getTime();
                    const checkOutMs = new Date(res.checkOut).getTime();
                    const startMs = displayedDates[0].getTime();

                    const startOffset = Math.max(0, (checkInMs - startMs) / 86400000);
                    const daySpan = Math.ceil((checkOutMs - checkInMs) / 86400000);

                    return (
                      <div
                        key={res.id}
                        style={{
                          position: 'absolute',
                          left: `${startOffset * CELL_WIDTH + 2}px`,
                          top: '4px',
                        }}
                      >
                        <ReservationCard
                          reservation={res}
                          daySpan={daySpan}
                          cellWidth={CELL_WIDTH}
                          onClick={() => console.log('Open reservation', res.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
