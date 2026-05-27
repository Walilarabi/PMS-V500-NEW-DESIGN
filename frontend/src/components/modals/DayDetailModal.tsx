/**
 * FLOWTYM — DayDetailModal
 *
 * Opens when a day cell is clicked in the Revenue Calendar.
 * Shows real data for the selected day and exposes 7 action buttons:
 *   1. Nouvelle réservation
 *   2. Bloquer des chambres  (placeholder — opens confirmation)
 *   3. Modifier les tarifs
 *   4. Ajouter une restriction  (placeholder)
 *   5. Voir dans le Gantt
 *   6. Ajouter un événement
 *   7. Copier les tarifs  (disabled — coming soon)
 */

import React, { useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Lock,
  Euro,
  AlertTriangle,
  LayoutGrid,
  CalendarDays,
  Copy,
  TrendingUp,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { DayCell } from '@/src/pages/planning/RevenueCalendar';
import { fmtEUR } from '@/src/pages/planning/types';
import { OCC_THRESHOLDS, getOccThreshold } from '@/src/pages/planning/revenueThresholds';
import { cn } from '@/src/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DayDetailModalProps {
  isOpen: boolean;
  day: DayCell | null;
  totalRooms: number;
  pickup?: number;
  cancellations?: number;
  onClose: () => void;
  onNewReservation: (dateStr: string) => void;
  onBlockRooms: (dateStr: string) => void;
  onEditRates: (dateStr: string) => void;
  onAddRestriction: (dateStr: string) => void;
  onViewInGantt: (dateStr: string) => void;
  onAddEvent: (dateStr: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FR_MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const FR_DAY_NAMES = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];

function formatDate(date: Date): string {
  const dow = FR_DAY_NAMES[date.getDay()];
  const dom = date.getDate();
  const month = FR_MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dow} ${dom} ${month} ${year}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  day,
  totalRooms,
  pickup = 0,
  cancellations = 0,
  onClose,
  onNewReservation,
  onBlockRooms,
  onEditRates,
  onAddRestriction,
  onViewInGantt,
  onAddEvent,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !day) return null;

  const tone = getOccThreshold(day.occ);
  const threshold = tone; // getOccThreshold already returns the correct threshold

  // Source labels for reservations
  const getSourceLabel = (source: string | null | undefined): string => {
    const s = (source ?? 'DIRECT').toUpperCase();
    const labels: Record<string, string> = {
      DIRECT: 'Direct', BOOKING: 'Booking', EXPEDIA: 'Expedia',
      AIRBNB: 'Airbnb', WALKIN: 'Walk-in', PHONE: 'Téléphone',
    };
    return labels[s] ?? source ?? 'Direct';
  };

  const dateLabel = formatDate(day.date);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-title"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[201] flex flex-col overflow-hidden"
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">
              Détail du jour
            </p>
            <h2 id="day-detail-title" className="text-lg font-black text-gray-900 capitalize leading-tight">
              {dateLabel}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ring-1",
                tone.bg, tone.ring, threshold.labelColor
              )}>
                {day.occ}% — {threshold.label}
              </span>
              {day.isToday && (
                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black ring-1 ring-indigo-100">
                  Aujourd'hui
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-rose-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Content (scrollable) ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* KPI metrics */}
          <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
            <MetricTile
              label="Chambres"
              value={`${day.reservations.length}/${totalRooms}`}
              sub={`${day.occ}%`}
              tone="indigo"
            />
            <MetricTile
              label="ADR"
              value={day.adr > 0 ? `${day.adr} €` : '—'}
              sub="Moy. journée"
              tone="amber"
            />
            <MetricTile
              label="CA jour"
              value={fmtEUR(day.ca)}
              sub={`RevPAR ${day.revpar} €`}
              tone="emerald"
            />
          </div>

          {/* Pickup + Cancellations */}
          {(pickup > 0 || cancellations > 0) && (
            <div className="px-6 py-3 flex items-center gap-4 border-b border-gray-100 bg-gray-50/30">
              {pickup > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-700">
                    {pickup} pickup (7j)
                  </span>
                </div>
              )}
              {cancellations > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-rose-500" />
                  <span className="text-[11px] font-bold text-rose-600">
                    {cancellations} annulation{cancellations > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Events */}
          {day.events.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Événements
              </p>
              <div className="space-y-2">
                {day.events.map((evt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 bg-rose-50 rounded-xl border border-rose-100"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <CalendarDays size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-gray-900 truncate">{evt.name}</p>
                      <p className="text-[10px] text-gray-500">{evt.startDate} — {evt.endDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservations list */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Réservations présentes
              <span className="ml-2 bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 text-[9px]">
                {day.reservations.length}
              </span>
            </p>
            {day.reservations.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">Aucune réservation ce jour</p>
            ) : (
              <div className="space-y-2">
                {day.reservations.map((res, i) => (
                  <div
                    key={res.id ?? i}
                    className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                        <Users size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-gray-900 truncate">
                          {res.guest_name ?? 'Client inconnu'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Ch. {res.room_number ?? '—'} · {getSourceLabel(res.source)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-gray-700 tabular-nums shrink-0">
                      {res.total_amount ? `${res.total_amount} €` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                icon={<Plus size={15} />}
                label="Nouvelle réservation"
                tone="indigo"
                onClick={() => { onNewReservation(day.dateStr); onClose(); }}
              />
              <ActionButton
                icon={<Lock size={15} />}
                label="Bloquer des chambres"
                tone="slate"
                onClick={() => { onBlockRooms(day.dateStr); onClose(); }}
              />
              <ActionButton
                icon={<Euro size={15} />}
                label="Modifier les tarifs"
                tone="amber"
                onClick={() => { onEditRates(day.dateStr); onClose(); }}
              />
              <ActionButton
                icon={<ShieldCheck size={15} />}
                label="Ajouter restriction"
                tone="slate"
                onClick={() => { onAddRestriction(day.dateStr); onClose(); }}
              />
              <ActionButton
                icon={<LayoutGrid size={15} />}
                label="Voir dans le Gantt"
                tone="slate"
                onClick={() => { onViewInGantt(day.dateStr); onClose(); }}
              />
              <ActionButton
                icon={<CalendarDays size={15} />}
                label="Ajouter un événement"
                tone="rose"
                onClick={() => { onAddEvent(day.dateStr); onClose(); }}
              />
            </div>

            {/* Disabled action */}
            <button
              disabled
              title="Bientôt disponible"
              className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-300 text-[11px] font-bold cursor-not-allowed"
            >
              <Copy size={15} />
              <span>Copier les tarifs</span>
              <span className="ml-auto text-[9px] uppercase tracking-widest font-black bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">
                Bientôt
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_TONES: Record<string, string> = {
  indigo: 'bg-indigo-50/40 border-indigo-100/60 text-indigo-700',
  amber:  'bg-amber-50/40 border-amber-100/60 text-amber-700',
  emerald:'bg-emerald-50/40 border-emerald-100/60 text-emerald-700',
};

const MetricTile: React.FC<{
  label: string; value: string; sub: string; tone: 'indigo' | 'amber' | 'emerald';
}> = ({ label, value, sub, tone }) => (
  <div className={cn("p-2.5 rounded-xl border", METRIC_TONES[tone])}>
    <p className="text-[9px] uppercase font-black tracking-widest opacity-60 mb-0.5">{label}</p>
    <p className="text-sm font-black tabular-nums">{value}</p>
    <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>
  </div>
);

const ACTION_TONES: Record<string, string> = {
  indigo: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100',
  amber:  'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-100',
  rose:   'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-100',
  slate:  'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-100',
};

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  tone: 'indigo' | 'amber' | 'rose' | 'slate';
  onClick: () => void;
}> = ({ icon, label, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-colors text-left",
      ACTION_TONES[tone]
    )}
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);

export default DayDetailModal;
