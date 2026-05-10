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
 *
 * Drag-to-create : pressing on a room row cell and dragging right starts
 * a creation selection. A floating popup follows the cursor showing
 * arrival/departure dates + nights. Conflict with existing reservations
 * is detected live and blocks the release. On pointer up the parent is
 * notified via `onDragCreateRelease` to open the pre-filled form modal.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Lock, AlertTriangle } from 'lucide-react';

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
  onDragCreateRelease: (room: RoomRow, startDate: Date, endDate: Date) => void;
}

const ROOM_COL_PX = 168;
const ROW_H = 64;
const STATS_ROW_H = 32;
const HEADER_H = 64;
const AVAIL_ROW_H = 32;

interface DragCreateState {
  roomId: string;
  startIdx: number;
  endIdx: number;
  mouseX: number;
  mouseY: number;
  conflict: boolean;
}

export const PlanningGrid: React.FC<Props> = ({
  view, dates, rooms, reservations, events, onMoveDrop, onResClick, onEmptyCellClick, onDragCreateRelease,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const strat = computeSizeStrategy(view);

  /* Per-day metrics */
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

  /* Available rooms per category per day */
  const availabilityRows = useMemo(() => {
    const cats = Array.from(new Set(rooms.map((r) => r.category ?? '—'))).filter(Boolean);
    return cats.map((cat) => {
      const catRooms = rooms.filter((r) => r.category === cat);
      const perDay = dates.map((d) => {
        const dt = d.getTime();
        const occupied = catRooms.filter((r) =>
          reservations.some((res) =>
            matchRoomToReservation(r, res) &&
            new Date(res.check_in).getTime() <= dt &&
            new Date(res.check_out).getTime() > dt,
          ),
        ).length;
        const blocked = catRooms.filter((r) => r.status === 'out_of_order' || r.status === 'maintenance').length;
        return Math.max(0, catRooms.length - occupied - blocked);
      });
      return { category: cat, total: catRooms.length, perDay };
    });
  }, [rooms, dates, reservations]);

  /* CSS Grid template */
  const gridTemplate = strat.fillWidth
    ? `${ROOM_COL_PX}px repeat(${dates.length}, minmax(${strat.cellMinPx}px, 1fr))`
    : `${ROOM_COL_PX}px repeat(${dates.length}, ${strat.cellMinPx}px)`;

  const totalDays = dates.length;
  const startMs = dates[0]?.getTime() ?? 0;
  const endMs = (dates[totalDays - 1]?.getTime() ?? 0) + DAY_MS;

  /* ===================== Drag-to-create state ===================== */
  const [dragCreate, setDragCreate] = useState<DragCreateState | null>(null);
  const dragCreateRef = useRef<DragCreateState | null>(null);
  dragCreateRef.current = dragCreate;
  const downAtRef = useRef<{ x: number; y: number; roomId: string; dayIdx: number; t: number } | null>(null);

  const cellAtClient = (clientX: number, clientY: number): { roomId: string | null; dayIdx: number | null } => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return { roomId: null, dayIdx: null };
    const cell = el.closest('[data-cell-room]') as HTMLElement | null;
    if (!cell) return { roomId: null, dayIdx: null };
    const roomId = cell.getAttribute('data-cell-room');
    const dayIdx = parseInt(cell.getAttribute('data-cell-day') ?? '-1', 10);
    return { roomId, dayIdx: Number.isFinite(dayIdx) && dayIdx >= 0 ? dayIdx : null };
  };

  const checkConflict = (roomId: string, startIdx: number, endIdx: number): boolean => {
    const a = startIdx <= endIdx ? startIdx : endIdx;
    const b = startIdx <= endIdx ? endIdx + 1 : startIdx + 1;
    const startTs = startMs + a * DAY_MS;
    const endTs = startMs + b * DAY_MS;
    return reservations.some((r) => {
      const room = rooms.find((rr) => rr.id === roomId);
      if (!room) return false;
      if (!matchRoomToReservation(room, r)) return false;
      const ra = new Date(r.check_in).getTime();
      const rb = new Date(r.check_out).getTime();
      return ra < endTs && rb > startTs;
    });
  };

  /* Cell pointerDown handler — initiates either click (release without move) or drag-create */
  const handleCellPointerDown = (e: React.PointerEvent, roomId: string, dayIdx: number) => {
    if (e.button !== 0) return;
    downAtRef.current = { x: e.clientX, y: e.clientY, roomId, dayIdx, t: Date.now() };
  };

  /* Global pointermove / pointerup listeners, attached only when a candidate drag starts */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const down = downAtRef.current;
      if (!down) return;

      // Activate drag-create if moved past threshold
      if (!dragCreateRef.current) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) < 6) return;
        const conflictAtStart = checkConflict(down.roomId, down.dayIdx, down.dayIdx);
        const init: DragCreateState = {
          roomId: down.roomId,
          startIdx: down.dayIdx,
          endIdx: down.dayIdx,
          mouseX: e.clientX,
          mouseY: e.clientY,
          conflict: conflictAtStart,
        };
        setDragCreate(init);
        dragCreateRef.current = init;
        return;
      }

      // Update active drag-create
      const cur = cellAtClient(e.clientX, e.clientY);
      const newEnd = cur.dayIdx ?? dragCreateRef.current.endIdx;
      const conflict = checkConflict(dragCreateRef.current.roomId, dragCreateRef.current.startIdx, newEnd);
      const next: DragCreateState = {
        ...dragCreateRef.current,
        endIdx: newEnd,
        mouseX: e.clientX,
        mouseY: e.clientY,
        conflict,
      };
      setDragCreate(next);
      dragCreateRef.current = next;
    };

    const onUp = () => {
      const down = downAtRef.current;
      const dc = dragCreateRef.current;
      downAtRef.current = null;
      if (!dc) {
        // Pure click without drag-create → was already handled via cell click handler
        return;
      }
      // Finalize
      const a = Math.min(dc.startIdx, dc.endIdx);
      const b = Math.max(dc.startIdx, dc.endIdx);
      const room = rooms.find((r) => r.id === dc.roomId);
      if (!dc.conflict && room && dates[a] && dates[b]) {
        const startDate = dates[a];
        const endDate = new Date(dates[b].getTime() + DAY_MS);
        onDragCreateRelease(room, startDate, endDate);
      }
      setDragCreate(null);
      dragCreateRef.current = null;
      void down;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [rooms, dates, reservations, onDragCreateRelease, startMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-auto bg-white relative" data-testid="planning-grid">
      <DndContext sensors={sensors} onDragEnd={onMoveDrop}>
        <div className="min-w-full" style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
          {/* Sticky header */}
          <StickyHeader dates={dates} dayMetrics={dayMetrics} />

          {/* Room rows */}
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
              dragCreate={dragCreate?.roomId === room.id ? dragCreate : null}
              onResClick={onResClick}
              onEmptyCellClick={onEmptyCellClick}
              onCellPointerDown={handleCellPointerDown}
            />
          ))}

          {/* Availability rows (per category) */}
          <AvailabilityRows rows={availabilityRows} dates={dates} dayMetrics={dayMetrics} />
        </div>
      </DndContext>

      {/* Floating popup */}
      {dragCreate && (
        <DragCreatePopup
          dates={dates}
          state={dragCreate}
          roomNumber={rooms.find((r) => r.id === dragCreate.roomId)?.number ?? '—'}
        />
      )}
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
    <div
      className="sticky top-0 left-0 z-40 bg-white border-b border-r border-gray-100"
      style={{ height: HEADER_H + STATS_ROW_H * 3 }}
    >
      <div className="h-full flex flex-col">
        <StatsLabel label="TO" />
        <StatsLabel label="ADR" />
        <StatsLabel label="EVT" />
        <div className="flex-1 flex items-center justify-center text-[10px] uppercase tracking-widest font-black text-gray-400">Chambres</div>
      </div>
    </div>
    {dates.map((d, i) => {
      const m = dayMetrics[i];
      return (
        <div key={d.toISOString()} className={`sticky top-0 z-30 bg-white border-b border-r border-gray-50 ${m.isWeekend ? 'bg-orange-50/30' : ''} ${m.isToday ? 'ring-2 ring-inset ring-indigo-200' : ''}`} style={{ height: HEADER_H + STATS_ROW_H * 3 }}>
          <div className="h-full flex flex-col">
            <div className="h-8 flex items-center justify-center border-b border-gray-50">
              <span className={`text-[11px] font-black tabular-nums ${m.occ > 80 ? 'text-emerald-500' : m.occ > 50 ? 'text-orange-400' : 'text-gray-400'}`}>{m.occ}%</span>
            </div>
            <div className="h-8 flex items-center justify-center border-b border-gray-50 bg-gray-50/40">
              <span className="text-[11px] font-black text-violet-400 tabular-nums">{m.adr || '—'}€</span>
            </div>
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
  dragCreate: DragCreateState | null;
  onResClick: (r: ReservationRow) => void;
  onEmptyCellClick: (room: RoomRow, date: Date) => void;
  onCellPointerDown: (e: React.PointerEvent, roomId: string, dayIdx: number) => void;
}

const RoomRow: React.FC<RoomRowProps> = memo(({ room, dates, dayMetrics, reservations, fillWidth, cellMinPx, startMs, endMs, dragCreate, onResClick, onEmptyCellClick, onCellPointerDown }) => {
  const roomReservations = reservations.filter((r) => matchRoomToReservation(room, r));
  const isBlocked = room.status === 'out_of_order' || room.status === 'maintenance';

  // selection rectangle for drag-create
  const selRect = useMemo(() => {
    if (!dragCreate) return null;
    const a = Math.min(dragCreate.startIdx, dragCreate.endIdx);
    const b = Math.max(dragCreate.startIdx, dragCreate.endIdx);
    const widthCells = b - a + 1;
    if (fillWidth) {
      return {
        leftPercent: (a / dates.length) * 100,
        widthPercent: (widthCells / dates.length) * 100,
        widthPx: undefined,
        leftPx: undefined,
      };
    }
    return {
      leftPercent: undefined,
      widthPercent: undefined,
      leftPx: a * cellMinPx,
      widthPx: widthCells * cellMinPx,
    };
  }, [dragCreate, fillWidth, dates.length, cellMinPx]);

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

      {dates.map((d, i) => (
        <DropCell
          key={`${room.id}-${d.toISOString()}`}
          roomId={room.id}
          dayIdx={i}
          date={d}
          isWeekend={dayMetrics[i].isWeekend}
          isToday={dayMetrics[i].isToday}
          isBlocked={isBlocked}
          height={ROW_H}
          onEmpty={() => onEmptyCellClick(room, d)}
          onPointerDownCell={onCellPointerDown}
        />
      ))}

      {/* Selection overlay (drag-create) */}
      {selRect && dragCreate && (
        <div
          className="pointer-events-none"
          style={{
            gridColumn: `2 / span ${dates.length}`,
            position: 'relative',
            height: 0,
          }}
          data-testid={`planning-drag-create-overlay-${room.number}`}
        >
          <div
            className={`absolute rounded-xl border-2 ${dragCreate.conflict ? 'border-rose-500 bg-rose-100/50' : 'border-emerald-500 bg-emerald-100/50'} shadow-sm`}
            style={{
              top: -ROW_H + 8,
              height: ROW_H - 16,
              left: fillWidth ? `${selRect.leftPercent ?? 0}%` : (selRect.leftPx ?? 0),
              width: fillWidth ? `calc(${selRect.widthPercent ?? 0}% - 4px)` : ((selRect.widthPx ?? 0) - 4),
            }}
          />
        </div>
      )}

      {/* Reservation bars overlay */}
      {roomReservations.length > 0 && (
        <div
          className="pointer-events-none"
          style={{
            gridColumn: `2 / span ${dates.length}`,
            position: 'relative',
            height: 0,
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

interface DropCellProps {
  roomId: string;
  dayIdx: number;
  date: Date;
  isWeekend: boolean;
  isToday: boolean;
  isBlocked: boolean;
  height: number;
  onEmpty: () => void;
  onPointerDownCell: (e: React.PointerEvent, roomId: string, dayIdx: number) => void;
}

const DropCell: React.FC<DropCellProps> = memo(({ roomId, dayIdx, date, isWeekend, isToday, isBlocked, height, onEmpty, onPointerDownCell }) => {
  const id = `room:${roomId}:date:${isoDay(date)}`;
  const { isOver, setNodeRef } = useDroppable({ id });

  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-cell-${roomId}-${isoDay(date)}`}
      data-cell-room={roomId}
      data-cell-day={dayIdx}
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        onPointerDownCell(e, roomId, dayIdx);
      }}
      onPointerUp={(e) => {
        // Treat as click if no significant move and quick
        const d = downAt.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) < 5 && Date.now() - d.t < 350) {
          onEmpty();
        }
        downAt.current = null;
      }}
      className={`border-r border-b border-gray-50 transition-colors cursor-cell ${
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

/* ============================ Availability rows ============== */

interface AvailRow { category: string; total: number; perDay: number[] }

const AvailabilityRows: React.FC<{ rows: AvailRow[]; dates: Date[]; dayMetrics: DayMetrics[] }> = ({ rows, dates, dayMetrics }) => (
  <>
    {/* Section header */}
    <div
      className="sticky left-0 z-20 bg-indigo-50/60 border-r border-t-2 border-b border-indigo-100 flex items-center px-3"
      style={{ height: AVAIL_ROW_H, gridColumn: '1 / 2' }}
      data-testid="planning-avail-header"
    >
      <span className="text-[10px] uppercase tracking-widest font-black text-indigo-700">Disponibles à la vente</span>
    </div>
    {dates.map((d, i) => {
      const m = dayMetrics[i];
      return (
        <div
          key={`avail-spacer-${d.toISOString()}`}
          className={`bg-indigo-50/30 border-r border-t-2 border-b border-indigo-100 ${m.isWeekend ? 'bg-orange-50/30' : ''}`}
          style={{ height: AVAIL_ROW_H }}
        />
      );
    })}

    {/* Per-category rows */}
    {rows.map((row) => (
      <React.Fragment key={`avail-${row.category}`}>
        <div
          className="sticky left-0 z-20 bg-white border-r border-b border-gray-100 flex items-center px-3"
          style={{ height: AVAIL_ROW_H }}
          data-testid={`planning-avail-cat-${row.category}`}
        >
          <span className="text-[10px] uppercase tracking-widest font-black text-gray-500">{row.category}</span>
          <span className="ml-2 text-[9px] font-black text-gray-300">/ {row.total}</span>
        </div>
        {row.perDay.map((avail, i) => {
          const m = dayMetrics[i];
          const tone = avail === 0
            ? 'bg-rose-50 text-rose-600'
            : avail <= Math.max(1, Math.floor(row.total * 0.2))
            ? 'bg-amber-50 text-amber-600'
            : 'text-emerald-600';
          return (
            <div
              key={`avail-${row.category}-${dates[i].toISOString()}`}
              className={`border-r border-b border-gray-50 flex items-center justify-center text-[12px] font-black tabular-nums ${tone} ${m.isWeekend ? 'bg-orange-50/10' : ''}`}
              style={{ height: AVAIL_ROW_H }}
              data-testid={`planning-avail-${row.category}-${dates[i].toISOString().slice(0, 10)}`}
            >
              {avail}
            </div>
          );
        })}
      </React.Fragment>
    ))}
  </>
);

/* ============================ Drag-create popup ============== */

const DragCreatePopup: React.FC<{
  state: DragCreateState;
  dates: Date[];
  roomNumber: string;
}> = ({ state, dates, roomNumber }) => {
  const a = Math.min(state.startIdx, state.endIdx);
  const b = Math.max(state.startIdx, state.endIdx);
  const startDate = dates[a];
  const endDate = new Date(dates[b].getTime() + DAY_MS);
  const nights = b - a + 1;
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div
      data-testid="planning-drag-create-popup"
      className={`fixed z-[80] pointer-events-none rounded-xl border-2 shadow-xl p-3 text-xs font-bold transition-colors ${
        state.conflict ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-emerald-300 text-emerald-700'
      }`}
      style={{
        left: state.mouseX + 18,
        top: state.mouseY + 18,
        minWidth: 220,
      }}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black opacity-80">
        {state.conflict ? <AlertTriangle size={12} /> : null}
        Chambre {roomNumber}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-700">
        <p><span className="text-gray-400">Arrivée : </span>{fmt(startDate)}</p>
        <p><span className="text-gray-400">Départ : </span>{fmt(endDate)}</p>
        <p className="font-black tabular-nums"><span className="text-gray-400 font-bold">Nuits : </span>{nights}</p>
      </div>
      {state.conflict && (
        <p className="mt-2 text-[10px] text-rose-600 font-black uppercase tracking-widest">
          Période occupée — relâchez pour annuler
        </p>
      )}
    </div>
  );
};

export default PlanningGrid;
