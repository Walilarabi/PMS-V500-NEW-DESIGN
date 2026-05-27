/**
 * FLOWTYM — DayDetailModal
 *
 * Opens when a day cell is clicked in the Revenue Calendar.
 *
 * Affiche :
 *   - Métriques clés : TO %, ADR €, RevPAR €, CA €
 *   - Opérationnel : arrivées, départs, en-maison, no-show
 *   - Canaux : répartition du CA et des réservations par source
 *   - Types de chambre : répartition par room_type
 *   - Pickup 7j + annulations
 *   - Événements
 *   - Recommandations RMS (si disponibles)
 *   - Liste des réservations présentes
 *   - 7 boutons d'action
 *
 * Formules :
 *   TO%     = inHouse / totalRooms × 100  (= day.occ)
 *   ADR €   = CA / max(1, inHouse)        (= day.adr)
 *   RevPAR€ = CA / totalRooms             (= day.revpar)
 */

import React, { useEffect, useMemo, useRef } from 'react';
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
  ArrowDownToLine,
  ArrowUpFromLine,
  UserX,
  BedDouble,
  Zap,
  ChevronRight,
} from 'lucide-react';
import type { DayCell } from '@/src/pages/planning/RevenueCalendar';
import type { RMSPricingRecommendation } from '@/src/hooks/useRMSData';
import { fmtEUR } from '@/src/pages/planning/types';
import { getOccThreshold } from '@/src/pages/planning/revenueThresholds';
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
  /** RMS pricing recommendations for this day (optional) */
  rmsRecommendations?: RMSPricingRecommendation[];
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

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: 'Direct', BOOKING: 'Booking', EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb', WALKIN: 'Walk-in', PHONE: 'Téléphone',
  OTA: 'OTA', GDS: 'GDS',
};

const getSourceLabel = (source: string | null | undefined): string => {
  const s = (source ?? 'DIRECT').toUpperCase();
  return SOURCE_LABELS[s] ?? (source ?? 'Direct');
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  day,
  totalRooms,
  pickup = 0,
  cancellations = 0,
  rmsRecommendations = [],
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

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Channel breakdown ──────────────────────────────────────────────────────
  const channelStats = useMemo(() => {
    if (!day) return [];
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of day.reservations) {
      const key = (r.source ?? 'DIRECT').toUpperCase();
      const existing = map.get(key) ?? { count: 0, revenue: 0 };
      map.set(key, { count: existing.count + 1, revenue: existing.revenue + (r.total_amount ?? 0) });
    }
    return Array.from(map.entries())
      .map(([source, data]) => ({ source, label: getSourceLabel(source), ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [day?.reservations]);

  // ── Room type breakdown ────────────────────────────────────────────────────
  const roomTypeStats = useMemo(() => {
    if (!day) return [];
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of day.reservations) {
      const key = r.room_type ?? r.room_category ?? 'Non défini';
      const existing = map.get(key) ?? { count: 0, revenue: 0 };
      map.set(key, { count: existing.count + 1, revenue: existing.revenue + (r.total_amount ?? 0) });
    }
    return Array.from(map.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [day?.reservations]);

  if (!isOpen || !day) return null;

  const tone = getOccThreshold(day.occ);
  const dateLabel = formatDate(day.date);

  // Availability = totalRooms - inHouse
  const available = Math.max(0, totalRooms - day.inHouse);

  // RMS recommendations for this day
  const dayRecs = rmsRecommendations.filter(r => r.date === day.dateStr && r.status === 'pending');
  const hasRmsAlert = dayRecs.some(r => r.warnings && r.warnings.length > 0);

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
        className="fixed right-0 top-0 h-full w-full max-w-[460px] bg-white shadow-2xl z-[201] flex flex-col overflow-hidden"
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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ring-1",
                tone.bg, tone.ring, tone.labelColor
              )}>
                {day.occ}% — {tone.label}
              </span>
              {day.isToday && (
                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black ring-1 ring-indigo-100">
                  Aujourd'hui
                </span>
              )}
              {hasRmsAlert && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black ring-1 ring-amber-100">
                  <Zap size={9} />
                  Alerte RMS
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-rose-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Content (scrollable) ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Section : KPI Revenue ─────────────────────────────────────── */}
          <div className="px-6 py-4 grid grid-cols-4 gap-2.5 border-b border-gray-100">
            <MetricTile
              label="TO"
              value={`${day.occ}%`}
              sub={`${day.inHouse}/${totalRooms} ch.`}
              tone="indigo"
            />
            <MetricTile
              label="ADR"
              value={day.adr > 0 ? fmtEUR(day.adr) : '—'}
              sub="Moy. nuit"
              tone="amber"
            />
            <MetricTile
              label="RevPAR"
              value={fmtEUR(day.revpar)}
              sub="/ chambre"
              tone="violet"
            />
            <MetricTile
              label="CA"
              value={fmtEUR(day.ca)}
              sub="Jour"
              tone="emerald"
            />
          </div>

          {/* ── Section : Opérationnel ─────────────────────────────────────── */}
          <div className="px-6 py-3 border-b border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Opérationnel
            </p>
            <div className="grid grid-cols-4 gap-2">
              <OpChip
                icon={<ArrowDownToLine size={12} />}
                label="Arrivées"
                val={String(day.arrivals)}
                tone="sky"
              />
              <OpChip
                icon={<ArrowUpFromLine size={12} />}
                label="Départs"
                val={String(day.departures)}
                tone="slate"
              />
              <OpChip
                icon={<BedDouble size={12} />}
                label="En-maison"
                val={String(day.inHouse)}
                tone="indigo"
              />
              <OpChip
                icon={<UserX size={12} />}
                label="No-show"
                val={String(day.noShow)}
                tone={day.noShow > 0 ? 'amber' : 'slate'}
              />
            </div>
            {/* Availability */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
              <span>Disponible : <strong className="text-gray-700">{available} ch.</strong></span>
              <span>Capacité totale : <strong className="text-gray-700">{totalRooms} ch.</strong></span>
            </div>
          </div>

          {/* ── Section : Pickup + Annulations ────────────────────────────── */}
          {(pickup > 0 || cancellations > 0) && (
            <div className="px-6 py-3 flex items-center gap-4 border-b border-gray-100 bg-gray-50/30">
              {pickup > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-700">
                    +{pickup} pickup (7j)
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

          {/* ── Section : Canaux ──────────────────────────────────────────── */}
          {channelStats.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">
                Canaux de distribution
              </p>
              <div className="space-y-1.5">
                {channelStats.map(ch => {
                  const pct = day.reservations.length > 0
                    ? Math.round((ch.count / day.reservations.length) * 100)
                    : 0;
                  return (
                    <div key={ch.source} className="flex items-center gap-2.5">
                      <span className="text-[11px] font-bold text-gray-700 w-20 shrink-0 truncate">
                        {ch.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-gray-500 w-8 text-right shrink-0">
                        {pct}%
                      </span>
                      <span className="text-[10px] tabular-nums text-gray-700 font-bold w-16 text-right shrink-0">
                        {fmtEUR(ch.revenue)}
                      </span>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {ch.count} ch.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section : Types de chambres ───────────────────────────────── */}
          {roomTypeStats.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">
                Types de chambre
              </p>
              <div className="flex flex-wrap gap-1.5">
                {roomTypeStats.map(rt => (
                  <div
                    key={rt.type}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg"
                  >
                    <BedDouble size={11} className="text-gray-400 shrink-0" />
                    <span className="text-[10px] font-bold text-gray-700">{rt.type}</span>
                    <span className="text-[10px] text-gray-400">× {rt.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section : Recommandations RMS ─────────────────────────────── */}
          {dayRecs.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5 flex items-center gap-1.5">
                <Zap size={10} />
                Recommandations RMS
              </p>
              <div className="space-y-2">
                {dayRecs.map((rec, i) => (
                  <div
                    key={rec.id ?? i}
                    className={cn(
                      "p-3 rounded-xl border",
                      rec.delta_percent > 0
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-rose-50 border-rose-100"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-black text-gray-800">
                        {fmtEUR(rec.current_price)} → {fmtEUR(rec.recommended_price)}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md",
                        rec.delta_percent > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      )}>
                        {rec.delta_percent > 0 ? '+' : ''}{rec.delta_percent}%
                      </span>
                    </div>
                    {/* Confidence */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${Math.round(rec.confidence_score * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-500">
                        {Math.round(rec.confidence_score * 100)}% confiance
                      </span>
                    </div>
                    {/* Triggered rules */}
                    {rec.triggered_rules && rec.triggered_rules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {rec.triggered_rules.slice(0, 3).map((rule, ri) => (
                          <span
                            key={ri}
                            className="text-[8px] font-bold px-1.5 py-0.5 bg-white/80 border border-gray-200 rounded text-gray-600"
                          >
                            {rule}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Warnings */}
                    {rec.warnings && rec.warnings.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {rec.warnings.slice(0, 2).map((w, wi) => (
                          <p key={wi} className="text-[9px] text-amber-700 flex items-center gap-1">
                            <AlertTriangle size={8} />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                    {/* Opportunities */}
                    {rec.opportunities && rec.opportunities.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {rec.opportunities.slice(0, 2).map((op, oi) => (
                          <p key={oi} className="text-[9px] text-emerald-700 flex items-center gap-1">
                            <ChevronRight size={8} />
                            {op}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section : Événements ──────────────────────────────────────── */}
          {day.events.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">
                Événements impactants
              </p>
              <div className="space-y-2">
                {day.events.map((evt, i) => (
                  <div
                    key={evt.id ?? i}
                    className="flex items-center gap-3 p-2.5 bg-rose-50 rounded-xl border border-rose-100"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <CalendarDays size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-gray-900 truncate">{evt.name}</p>
                      <p className="text-[10px] text-gray-500">{evt.startDate} — {evt.endDate}</p>
                    </div>
                    {evt.impact && (
                      <span className={cn(
                        "shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                        evt.impact === 'high' ? 'bg-rose-100 text-rose-700' :
                        evt.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {evt.impact === 'high' ? 'Fort' : evt.impact === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section : Réservations présentes ──────────────────────────── */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">
              Réservations présentes
              <span className="ml-2 bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 text-[9px]">
                {day.reservations.length}
              </span>
            </p>
            {day.reservations.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">Aucune réservation ce jour</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                        <p className="text-[10px] text-gray-500 truncate">
                          {res.room_type ? `${res.room_type} · ` : ''}
                          Ch. {res.room_number ?? '—'} · {getSourceLabel(res.source)}
                          {res.status === 'no_show' && (
                            <span className="ml-1 text-amber-600 font-bold">NS</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-gray-700 tabular-nums shrink-0">
                      {res.total_amount != null ? fmtEUR(res.total_amount) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section : Actions ─────────────────────────────────────────── */}
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

            {/* Disabled: Copier les tarifs */}
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
  indigo:  'bg-indigo-50/40 border-indigo-100/60 text-indigo-700',
  amber:   'bg-amber-50/40 border-amber-100/60 text-amber-700',
  emerald: 'bg-emerald-50/40 border-emerald-100/60 text-emerald-700',
  violet:  'bg-violet-50/40 border-violet-100/60 text-violet-700',
};

const MetricTile: React.FC<{
  label: string; value: string; sub: string;
  tone: 'indigo' | 'amber' | 'emerald' | 'violet';
}> = ({ label, value, sub, tone }) => (
  <div className={cn("p-2.5 rounded-xl border", METRIC_TONES[tone])}>
    <p className="text-[9px] uppercase font-black tracking-widest opacity-60 mb-0.5">{label}</p>
    <p className="text-sm font-black tabular-nums leading-tight">{value}</p>
    <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{sub}</p>
  </div>
);

const OP_CHIP_TONES: Record<string, string> = {
  sky:    'bg-sky-50 border-sky-100 text-sky-700',
  slate:  'bg-gray-50 border-gray-100 text-gray-600',
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
  amber:  'bg-amber-50 border-amber-100 text-amber-700',
};

const OpChip: React.FC<{
  icon: React.ReactNode; label: string; val: string;
  tone: 'sky' | 'slate' | 'indigo' | 'amber';
}> = ({ icon, label, val, tone }) => (
  <div className={cn("flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border", OP_CHIP_TONES[tone])}>
    <span className="opacity-60">{icon}</span>
    <p className="text-sm font-black tabular-nums leading-tight">{val}</p>
    <p className="text-[8px] uppercase tracking-widest font-bold opacity-60 text-center leading-tight">{label}</p>
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
