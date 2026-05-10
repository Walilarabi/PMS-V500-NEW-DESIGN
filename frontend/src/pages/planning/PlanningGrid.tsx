/**
 * FLOWTYM — Planning Grid (Gantt mode).
 *
 * Auto-fit width strategy:
 *   • 7J/15J → cells fill 100% width (CSS Grid `1fr` with min-content)
 *   • Mois  → fixed minWidth 64px per cell, container scrolls horizontally
 *
 * Reservation bars use absolute positioning (computed via day index +
 * percentage when fillWidth, pixel offset when fixed). Channel colors come
 * from CHANNELS map. Stats rows (TO%, ADR, events) shown as sticky header.
 */
import React, { memo, useMemo } from 'react';
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Lock } from 'lucide-react';

import {
  CHANNELS, DAY_MS, computeSizeStrategy, getChannel, getContrastColor, isoDay,
  matchRoomToReservation, type ViewLength,
} from './types';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';
import type { HotelEvent } from '@/src/store/configStore';

interface Props {
  view: ViewLength;
  dates: Date[];
  rooms: RoomRow[];
  reservations: ReservationRow[];
  events: HotelEvent[];
  onMoveDrop: (e: DragEndEvent) => void;
  onResClick: (r: ReservationRow) => void;
  onEmptyCellClick: (room: RoomRow, date: Date) => void;
}

const ROOM_COL_PX = 168;
const ROW_H = 64;
const STATS_ROW_H = 32;
const HEADER_H = 64;

export const PlanningGrid: React.FC<Props> = ({
  view, dates, rooms, reservations, events, onMoveDrop, onResClick, onEmptyCellClick,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const strat = computeSizeStrategy(view);

  /* Per-day metrics for stats rows */
  const dayMetrics = useMemo(() => dates.map((d) => {
    const dStr = isoDay(d);
    const dt = d.getTime();
    const occRes = reservations.filter((r) => {
      const a = new Date(r.check_in).getTime();
      const b = new Date(r.check_out).getTime();
      return !isNaN(a) && !isNaN(b) && dt >= a && dt < b;
    });
    const ca = occRes.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const adr = occRes.length ? Math.round(ca / occRes.length) : 0;
    const occ = rooms.length ? Math.round((occRes.length / rooms.length) * 100) : 0;
    const evts = events.filter((e) => dStr >= e.startDate && dStr <= e.endDate);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isToday = dt === new Date().setHours(0, 0, 0, 0);
    return { dStr, dateNum: d.getDate(), monthShort: d.toLocaleString('fr-FR', { month: 'short' }), dayName: d.toLocaleString('fr-FR', { weekday: 'short' }), occ, adr, evts, isWeekend, isToday };
  }), [dates, reservations, rooms, events]);

  // Container width strategy via CSS Grid template
  const gridTemplate = strat.fillWidth
    ? `${ROOM_COL_PX}px repeat(${dates.length}, minmax(${strat.cellMinPx}px, 1fr))`
    : `${ROOM_COL_PX}px repeat(${dates.length}, ${strat.cellMinPx}px)`;

  const totalDays = dates.length;
  const startMs = dates[0]?.getTime() ?? 0;
  const endMs = (dates[totalDays - 1]?.getTime() ?? 0) + DAY_MS;

  return (
    <div className="flex-1 overflow-auto bg-white" data-testid="planning-grid">
      <DndContext sensors={sensors} onDragEnd={onMoveDrop}>
        <div className="min-w-full" style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
          {/* Sticky header rows (4 stats + dates) */}
          <StickyHeader dates={dates} dayMetrics={dayMetrics} />

          {/* Body rows */}
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              dates={dates}
              dayMetrics={dayMetrics}
              reservations={reservations}
              fillWidth={strat.fillWidth}
              cellMinPx={strat.cellMinPx}
              startMs={startMs}
              endMs={endMs}
              onResClick={onResClick}
              onEmptyCellClick={onEmptyCellClick}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
};

/* ============================ Sticky header =================== */

interface DayMetrics {
  dStr: string;
  dateNum: number;
  monthShort: string;
  dayName: string;
  occ: number;
  adr: number;
  evts: HotelEvent[];
  isWeekend: boolean;
  isToday: boolean;
}

const StickyHeader: React.FC<{ dates: Date[]; dayMetrics: DayMetrics[] }> = memo(({ dates, dayMetrics }) => (
  <>
    {/* Empty corner */}
    <div
      className="sticky top-0 left-0 z-40 bg-white border-b border-r border-gray-100"
      style={{ height: HEADER_H + STATS_ROW_H * 3, gridRow: 'span 4' }}
    >
      <div className="h-full flex flex-col">
        <StatsLabel label="TO" />
        <StatsLabel label="ADR" />
        <StatsLabel label="EVT" />
        <div className="flex-1 flex items-center justify-center text-[10px] uppercase tracking-widest font-black text-gray-400">Chambres</div>
      </div>
    </div>
    {/* Day columns header — 4 stacked rows in one cell using CSS grid spans */}
    {dates.map((d, i) => {
      const m = dayMetrics[i];
      return (
        <div key={d.toISOString()} className={`sticky top-0 z-30 bg-white border-b border-r border-gray-50 ${m.isWeekend ? 'bg-orange-50/30' : ''} ${m.isToday ? 'ring-2 ring-inset ring-indigo-200' : ''}`} style={{ height: HEADER_H + STATS_ROW_H * 3 }}>
          <div className="h-full flex flex-col">
            {/* TO row */}
            <div className="h-8 flex items-center justify-center border-b border-gray-50">
              <span className={`text-[11px] font-black tabular-nums ${m.occ > 80 ? 'text-emerald-500' : m.occ > 50 ? 'text-orange-400' : 'text-gray-400'}`}>{m.occ}%</span>
            </div>
            {/* ADR row */}
            <div className="h-8 flex items-center justify-center border-b border-gray-50 bg-gray-50/40">
              <span className="text-[11px] font-black text-violet-400 tabular-nums">{m.adr || '—'}€</span>
            </div>
            {/* Events row */}
            <div className="h-8 flex items-center justify-center border-b border-gray-50">
              {m.evts.length > 0 && (
                <span
                  className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ${
                    m.evts.some((e) => e.impact === 'critical' || e.impact === 'high')
                      ? 'bg-rose-300 text-white'
                      : m.evts.some((e) => e.impact === 'medium')
                      ? 'bg-orange-300 text-white'
                      : 'bg-emerald-300 text-white'
                  }`}
                  title={m.evts.map((e) => e.name).join(' · ')}
                >
                  {m.evts.length}
                </span>
              )}
            </div>
            {/* Date label */}
            <div className={`flex-1 flex flex-col items-center justify-center ${m.isToday ? 'bg-indigo-50/30' : ''}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${m.isWeekend ? 'text-orange-300' : 'text-gray-400'}`}>{m.dayName}</span>
              <div className="flex items-baseline gap-1 leading-none">
                <span className={`text-[16px] font-black ${m.isToday ? 'text-indigo-600' : m.isWeekend ? 'text-orange-400' : 'text-gray-900'}`}>{m.dateNum}</span>
                <span className={`text-[10px] font-black uppercase tracking-tighter ${m.isToday ? 'text-indigo-400' : m.isWeekend ? 'text-orange-300' : 'text-gray-400'}`}>{m.monthShort}</span>
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </>
));
StickyHeader.displayName = 'StickyHeader';

const StatsLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="h-8 px-3 flex items-center border-b border-gray-50 text-[9px] uppercase tracking-widest font-black text-gray-400 bg-gray-50/40">
    {label}
  </div>
);

/* ============================ Room row =================== */

interface RoomRowProps {
  room: RoomRow;
  dates: Date[];
  dayMetrics: DayMetrics[];
  reservations: ReservationRow[];
  fillWidth: boolean;
  cellMinPx: number;
  startMs: number;
  endMs: number;
  onResClick: (r: ReservationRow) => void;
  onEmptyCellClick: (room: RoomRow, date: Date) => void;
}

const RoomRow: React.FC<RoomRowProps> = memo(({ room, dates, dayMetrics, reservations, fillWidth, cellMinPx, startMs, endMs, onResClick, onEmptyCellClick }) => {
  const roomReservations = reservations.filter((r) => matchRoomToReservation(room, r));
  const isBlocked = room.status === 'out_of_order' || room.status === 'maintenance';

  return (
    <>
      <div
        className="sticky left-0 z-20 bg-white border-r border-b border-gray-100 flex items-center gap-2 px-3"
        style={{ height: ROW_H }}
        data-testid={`planning-room-${room.number}`}
      >
        <span className={`grid place-items-center w-9 h-9 rounded-lg text-xs font-black ${isBlocked ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
          {isBlocked ? <Lock size={14} /> : room.number}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black text-gray-800 truncate">{room.type ?? '—'}</p>
          <p className="text-[10px] text-gray-400 truncate">
            <span className="font-bold uppercase tracking-wider">{room.category ?? ''}</span>
            {room.floor ? ` · Ét. ${room.floor}` : ''}
          </p>
        </div>
      </div>

      {/* Drop cells (one per day) — keep it as positioning anchors only */}
      {dates.map((d, i) => (
        <DropCell
          key={`${room.id}-${d.toISOString()}`}
          roomId={room.id}
          date={d}
          isWeekend={dayMetrics[i].isWeekend}
          isToday={dayMetrics[i].isToday}
          isBlocked={isBlocked}
          height={ROW_H}
          onEmpty={() => onEmptyCellClick(room, d)}
        />
      ))}

      {/* Reservation bars overlay — absolutely positioned within the row using percentage */}
      {roomReservations.length > 0 && (
        <div
          className="pointer-events-none"
          style={{
            gridColumn: `2 / span ${dates.length}`,
            position: 'relative',
            height: 0, // logical height, bars are absolutely positioned with negative top
          }}
        >
          {roomReservations.map((r) => (
            <ReservationBar
              key={r.id}
              reservation={r}
              dates={dates}
              fillWidth={fillWidth}
              cellMinPx={cellMinPx}
              startMs={startMs}
              endMs={endMs}
              onClick={() => onResClick(r)}
            />
          ))}
        </div>
      )}
    </>
  );
});
RoomRow.displayName = 'RoomRow';

/* ============================ Drop cell =================== */

interface DropCellProps { roomId: string; date: Date; isWeekend: boolean; isToday: boolean; isBlocked: boolean; height: number; onEmpty: () => void }

const DropCell: React.FC<DropCellProps> = memo(({ roomId, date, isWeekend, isToday, isBlocked, height, onEmpty }) => {
  const id = `room:${roomId}:date:${isoDay(date)}`;
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-cell-${roomId}-${isoDay(date)}`}
      onClick={onEmpty}
      className={`border-r border-b border-gray-50 transition-colors cursor-pointer ${
        isBlocked ? 'bg-rose-50/30' : isOver ? 'bg-indigo-100' : isWeekend ? 'bg-orange-50/20' : 'hover:bg-indigo-50/20'
      } ${isToday ? 'bg-indigo-50/10' : ''}`}
      style={{ height }}
    />
  );
});
DropCell.displayName = 'DropCell';

/* ============================ Reservation bar =================== */

interface BarProps {
  reservation: ReservationRow;
  dates: Date[];
  fillWidth: boolean;
  cellMinPx: number;
  startMs: number;
  endMs: number;
  onClick: () => void;
}

const ReservationBar: React.FC<BarProps> = memo(({ reservation, dates, fillWidth, cellMinPx, startMs, endMs, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: reservation.id });

  const a = new Date(reservation.check_in).getTime();
  const b = new Date(reservation.check_out).getTime();
  if (b <= startMs || a >= endMs) return null;
  const visStart = Math.max(startMs, a);
  const visEnd = Math.min(endMs, b);
  const startIdx = Math.floor((visStart - startMs) / DAY_MS);
  const dayCount = Math.max(1, Math.ceil((visEnd - visStart) / DAY_MS));

  const channel = getChannel(reservation.source);
  const status = (reservation.status ?? 'confirmed').toLowerCase();
  const cancelled = status === 'cancelled' || status === 'no_show' || status === 'no-show';

  const bg = `${channel.color}E6`;
  const text = getContrastColor(channel.color);

  // Bar position calculations
  // We're positioned relative to the row overlay div which spans the date columns area.
  const leftPercent = (startIdx / dates.length) * 100;
  const widthPercent = (dayCount / dates.length) * 100;

  const style: React.CSSProperties = fillWidth
    ? { left: `calc(${leftPercent}% + 3px)`, width: `calc(${widthPercent}% - 6px)` }
    : { left: startIdx * cellMinPx + 3, width: dayCount * cellMinPx - 6 };

  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-bar-${reservation.id}`}
      data-reference={reservation.reference ?? ''}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${reservation.guest_name ?? ''} · ${reservation.check_in} → ${reservation.check_out} · ${channel.name}`}
      className={`pointer-events-auto absolute rounded-xl border-2 flex items-center px-3 gap-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all z-20 ${
        isDragging ? 'opacity-60 ring-2 ring-indigo-400' : ''
      } ${cancelled ? 'opacity-50 line-through' : ''}`}
      style={{
        ...style,
        top: -ROW_H + 8,
        height: ROW_H - 16,
        backgroundColor: bg,
        borderColor: channel.color,
        color: text,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : 20,
      }}
    >
      <div className="w-6 h-6 rounded-full bg-white/40 flex items-center justify-center shrink-0 text-[11px] font-black">
        {(reservation.guest_name ?? '?').charAt(0).toUpperCase()}
      </div>
      <span className="text-[11px] font-black truncate">
        {reservation.guest_name ?? reservation.reference ?? '—'}
      </span>
      <span className="ml-auto text-[10px] font-black tabular-nums opacity-90 shrink-0">
        {reservation.nights ?? '—'}n
      </span>
    </div>
  );
});
ReservationBar.displayName = 'ReservationBar';

export default PlanningGrid;
