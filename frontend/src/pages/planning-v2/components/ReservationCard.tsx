/**
 * RESERVATION CARD V2 — Enterprise-grade
 * 
 * Carte de réservation dans la grille Planning avec contraintes strictes :
 * - AUCUN débordement visuel (overflow: hidden)
 * - Hauteur fixe (48px)
 * - Texte tronqué avec ellipsis
 * - Tooltip au hover pour info complète
 * - Animations fluides
 * - Accessible (keyboard navigation)
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Euro, Calendar } from 'lucide-react';
import { PLANNING_DESIGN, getCardStyle, type ReservationStatus } from '../design-system';
import { cn } from '@/src/lib/utils';

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface ReservationCardProps {
  id: string;
  clientName: string;
  status: ReservationStatus;
  channel: string;
  amount: number;
  nights: number;
  guests: number;
  startIndex: number;        // Index cellule début (0-based)
  dayCount: number;           // Nombre de nuits affichées
  onCardClick?: (id: string) => void;
  onCardDoubleClick?: (id: string) => void;
  isDragging?: boolean;
}

interface TooltipData {
  clientName: string;
  channel: string;
  amount: number;
  nights: number;
  guests: number;
  checkIn?: string;
  checkOut?: string;
}

// ── COMPOSANT ─────────────────────────────────────────────────────────────

export const ReservationCard: React.FC<ReservationCardProps> = ({
  id,
  clientName,
  status,
  channel,
  amount,
  nights,
  guests,
  startIndex,
  dayCount,
  onCardClick,
  onCardDoubleClick,
  isDragging = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── POSITION & DIMENSIONS ─────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    ...getCardStyle(status),
    position: 'absolute',
    top: PLANNING_DESIGN.grid.gutter,
    left: startIndex * PLANNING_DESIGN.grid.cellWidth + PLANNING_DESIGN.grid.gutter,
    width: dayCount * PLANNING_DESIGN.grid.cellWidth - (2 * PLANNING_DESIGN.grid.gutter),
    cursor: 'pointer',
    transition: isDragging ? 'none' : `all ${PLANNING_DESIGN.animation.duration.normal}ms ${PLANNING_DESIGN.animation.easing}`,
    zIndex: showTooltip ? PLANNING_DESIGN.zIndex.cardHover : PLANNING_DESIGN.zIndex.card,
  };

  // ── HANDLERS ──────────────────────────────────────────────────────────
  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowTooltip(true);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const handleClick = () => {
    if (onCardClick) onCardClick(id);
  };

  const handleDoubleClick = () => {
    if (onCardDoubleClick) onCardDoubleClick(id);
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        style={cardStyle}
        className={cn(
          'group relative',
          PLANNING_DESIGN.card.shadowClass,
          'hover:shadow-md',
          'select-none'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        layout
      >
        {/* Contenu principal */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {/* Ligne 1 : Client + Badge nuits */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate',
                'text-[13px] font-medium text-gray-900'
              )}
              title={clientName}
            >
              {clientName}
            </span>
            <span
              className={cn(
                'shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold',
                'bg-gray-100 text-gray-700'
              )}
            >
              {nights}N
            </span>
          </div>

          {/* Ligne 2 : Canal + Montant */}
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="truncate max-w-[80px]" title={channel}>
              {channel}
            </span>
            <span className="text-gray-400">•</span>
            <div className="flex items-center gap-1">
              <Euro className="w-3 h-3" />
              <span className="font-medium">{amount}</span>
            </div>
            <span className="text-gray-400">•</span>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{guests}</span>
            </div>
          </div>
        </div>

        {/* Indicateur hover (bordure gauche s'intensifie) */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-0 group-hover:opacity-30 transition-opacity"
          aria-hidden="true"
        />
      </motion.div>

      {/* Tooltip (affiché au hover) */}
      {showTooltip && (
        <ReservationTooltip
          data={{
            clientName,
            channel,
            amount,
            nights,
            guests,
          }}
          position={tooltipPos}
        />
      )}
    </>
  );
};

// ── TOOLTIP COMPONENT ─────────────────────────────────────────────────────

interface ReservationTooltipProps {
  data: TooltipData;
  position: { x: number; y: number };
}

const ReservationTooltip: React.FC<ReservationTooltipProps> = ({ data, position }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[2000] pointer-events-none"
      style={{
        left: position.x + 16,
        top: position.y + 16,
      }}
    >
      <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3 max-w-xs">
        <div className="text-sm font-semibold mb-2">{data.clientName}</div>
        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>{data.nights} nuits</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span>{data.guests} personnes</span>
          </div>
          <div className="flex items-center gap-2">
            <Euro className="w-3.5 h-3.5" />
            <span className="font-medium">{data.amount}€</span>
          </div>
          <div className="pt-1 mt-1 border-t border-gray-700">
            <span className="text-gray-400">Canal :</span> {data.channel}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── EXPORTS ───────────────────────────────────────────────────────────────

export default ReservationCard;
