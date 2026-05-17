/**
 * FLOWTYM — RESERVATION CARD (Planning Grid)
 * 
 * Carte réservation ultra-propre pour le Planning.
 * 
 * CRITICAL REQUIREMENTS:
 * - NO OVERFLOW — tout reste contenu dans la cellule parent
 * - Texte tronqué intelligemment avec ellipsis
 * - Design premium, minimaliste, équilibré
 * - Hauteur fixe, padding cohérent
 * - Hover state fluide
 * - Support drag & drop
 */

import React from 'react';
import { typography, spacing, shadows, transitions } from '@/design-system/tokens';
import { cn } from '@/src/lib/utils';
import type { PlanningReservation } from '../hooks/usePlanningData';

export interface ReservationCardProps {
  reservation: PlanningReservation;
  daySpan: number;              // Nombre de jours affichés
  cellWidth: number;            // Largeur d'une cellule en px
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isSelected?: boolean;
  className?: string;
}

export const ReservationCard = React.memo<ReservationCardProps>(({
  reservation,
  daySpan,
  cellWidth,
  onClick,
  onDragStart,
  isSelected = false,
  className,
}) => {
  const totalWidth = daySpan * cellWidth;
  const isShortStay = daySpan <= 1;  // Affichage compact si 1 nuit

  return (
    <div
      className={cn(
        // Container
        'absolute top-0.5 flex items-center overflow-hidden cursor-pointer select-none',
        spacing.grid.cardPadding,
        'rounded-md border',
        transitions.base,
        
        // Couleurs statut
        reservation.statusColor,
        
        // States
        'hover:shadow-md hover:-translate-y-0.5',
        isSelected && 'ring-2 ring-offset-1 ring-brand-primary shadow-lg',
        
        className
      )}
      style={{
        width: `${totalWidth - 4}px`,  // -4px pour gap entre cellules
        height: '28px',                 // Hauteur fixe pour cohérence
      }}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable={!!onDragStart}
      title={`${reservation.guestName} • ${reservation.reference} • ${reservation.nights}n`}
    >
      {/* Indicateur canal (dot) */}
      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1.5', reservation.sourceColor)} />
      
      {/* Contenu — strictement contenu, pas de débordement */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {/* Nom client — priorité max */}
        <span className={cn(typography.planning.guestName, typography.truncate)}>
          {reservation.guestName}
        </span>
        
        {/* Métadonnées — affichées seulement si assez de place */}
        {!isShortStay && (
          <span className={cn(typography.planning.reservationMeta, typography.truncate)}>
            • {reservation.nights}n
            {reservation.pax > 2 && ` • ${reservation.pax}p`}
          </span>
        )}
        
        {/* Ref ID — ultra compact, affiché seulement si place */}
        {daySpan >= 3 && (
          <span className={cn(typography.planning.reservationId, typography.truncate)}>
            #{reservation.reference}
          </span>
        )}
      </div>
      
      {/* Indicateur prix — fixé à droite si place */}
      {daySpan >= 2 && reservation.totalAmount && (
        <div className="flex-shrink-0 ml-1.5">
          <span className={cn(typography.planning.reservationMeta, 'font-semibold')}>
            {formatPrice(reservation.totalAmount)}€
          </span>
        </div>
      )}
    </div>
  );
});

ReservationCard.displayName = 'ReservationCard';

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return amount >= 1000 
    ? `${(amount / 1000).toFixed(1)}k` 
    : amount.toFixed(0);
}
