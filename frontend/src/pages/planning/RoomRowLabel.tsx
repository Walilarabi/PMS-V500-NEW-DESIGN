/**
 * FLOWTYM — Label de ligne chambre (maquette #4, #5).
 *
 * Affiche le numéro + code chambre, une pastille de statut housekeeping
 * (vert/orange/bleu/gris) et une icône maintenance si la chambre est
 * hors-service. Données 100% réelles (rooms.housekeeping_status / rooms.status).
 */
import React from 'react';
import { Wrench } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type HkTone = { dot: string; label: string };

/** Mappe un statut housekeeping réel vers une pastille colorée. */
export function hkTone(status?: string | null): HkTone {
  switch ((status ?? '').toLowerCase()) {
    case 'clean':
      return { dot: 'bg-emerald-500', label: 'Propre' };
    case 'inspected':
      return { dot: 'bg-sky-500', label: 'Inspectée' };
    case 'dirty':
    case 'to_clean':
      return { dot: 'bg-amber-500', label: 'À nettoyer' };
    case 'out_of_order':
      return { dot: 'bg-gray-400', label: 'Hors service' };
    default:
      return { dot: 'bg-gray-300', label: 'Statut inconnu' };
  }
}

/** La chambre est-elle en maintenance / hors-service ? */
export function isUnderMaintenance(status?: string | null): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'maintenance' || s === 'out_of_order';
}

export function RoomRowLabel({
  number,
  code,
  housekeepingStatus,
  roomStatus,
  fullLabel,
}: {
  number: string;
  code: string;
  housekeepingStatus?: string | null;
  roomStatus?: string | null;
  /** Libellé complet pour le tooltip (ex: "201 - Double Deluxe"). */
  fullLabel?: string;
}) {
  const tone = hkTone(housekeepingStatus);
  const maintenance = isUnderMaintenance(roomStatus);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', tone.dot)}
        title={`Ménage : ${tone.label}`}
        aria-label={`Ménage : ${tone.label}`}
      />
      <span className="text-[14px] font-semibold text-gray-900 cursor-help" title={fullLabel}>
        {number}
      </span>
      <span className="text-gray-400">·</span>
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{code}</span>
      {maintenance && (
        <span
          className="ml-1 inline-flex items-center justify-center text-rose-500 shrink-0"
          title="Chambre en maintenance"
          aria-label="Chambre en maintenance"
        >
          <Wrench size={12} />
        </span>
      )}
    </div>
  );
}
