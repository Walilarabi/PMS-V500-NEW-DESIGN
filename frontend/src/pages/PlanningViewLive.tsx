/**
 * FLOWTYM — Planning (live + drag & drop).
 *
 * Grid: rooms × dates. Each reservation is rendered as a draggable bar
 * spanning N cells. Drag onto another room row to reassign the room
 * (`room_id`); drag along the same row to shift the dates (preserves
 * duration). Optimistic locking via `version` is enforced server-side.
 */
import React, { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Calendar as CalendarIcon, Users,
  Lock, AlertCircle,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel, useRooms } from '@/src/domains/hotel/hooks';
import { useReservationsByRange, useMoveReservation } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';
import ReservationFormModal, {
  type ReservationFormData,
} from '@/src/components/modals/ReservationFormModal';
import { useCreateReservationFromForm } from '@/src/domains/reservations/useCreateReservationFromForm';

const DAY_MS = 86_400_000;
const CELL_W = 88; // px per day column
const ROW_H = 56;  // px per room row

const fmtEUR = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : '—';

const STATUS_TONE: Record<string, string> = {
  confirmed: 'bg-violet-500 text-white border-violet-600',
  pending: 'bg-amber-500 text-white border-amber-600',
  checkout: 'bg-sky-500 text-white border-sky-600',
  cleaning: 'bg-orange-500 text-white border-orange-600',
  arriving: 'bg-emerald-500 text-white border-emerald-600',
  cancelled: 'bg-gray-300 text-gray-700 border-gray-400 line-through',
};

function buildDateRange(anchor: Date, days: number): Date[] {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS));
}

const isoDay = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const PlanningViewLive: React.FC = () => {
  const hotelQ = useActiveHotel();
  const roomsQ = useRooms();
  const [anchor, setAnchor] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [span, setSpan] = useState<7 | 15 | 30>(15);
  const [createOpen, setCreateOpen] = useState(false);

  const dates = useMemo(() => buildDateRange(anchor, span), [anchor, span]);
  const rangeStart = isoDay(dates[0]);
  const rangeEnd = isoDay(dates[dates.length - 1]);
  const reservationsQ = useReservationsByRange({ rangeStart, rangeEnd });
  const move = useMoveReservation();
  const createFromForm = useCreateReservationFromForm();
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const rooms: RoomRow[] = (roomsQ.data ?? []).slice().sort((a, b) =>
    (a.number ?? '').localeCompare(b.number ?? '', 'fr', { numeric: true }),
  );
  const reservations: ReservationRow[] = reservationsQ.data ?? [];

  /* KPIs */
  const kpis = useMemo(() => {
    const total = rooms.length * span;
    let occupied = 0;
    for (const r of reservations) {
      const ci = new Date(r.check_in);
      const co = new Date(r.check_out);
      const start = ci < dates[0] ? dates[0] : ci;
      const end = co > dates[dates.length - 1] ? new Date(dates[dates.length - 1].getTime() + DAY_MS) : co;
      occupied += Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    }
    const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const revenue = reservations.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    return { total, occupied, occRate, revenue, count: reservations.length };
  }, [reservations, rooms, span, dates]);

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over || !e.active) return;
    const reservationId = String(e.active.id);
    const overId = String(e.over.id);   // format: "room:<roomId>:date:<isoDay>"
    const matched = overId.match(/^room:([^:]+):date:(.+)$/);
    if (!matched) return;
    const newRoomId = matched[1];
    const newCheckIn = matched[2];

    const r = reservations.find((x) => x.id === reservationId);
    if (!r) return;

    const oldCheckIn = new Date(r.check_in);
    const oldCheckOut = new Date(r.check_out);
    const nights = Math.max(1, Math.round((oldCheckOut.getTime() - oldCheckIn.getTime()) / DAY_MS));
    const newCheckOutDate = new Date(new Date(newCheckIn).getTime() + nights * DAY_MS);
    const newCheckOut = isoDay(newCheckOutDate);

    if (r.room_id === newRoomId && isoDay(oldCheckIn) === newCheckIn) return;

    try {
      await move.mutateAsync({
        id: r.id,
        fromVersion: r.version ?? 1,
        roomId: newRoomId,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
      });
      toast({
        title: 'Réservation déplacée',
        description: `${r.reference ?? r.guest_name ?? 'Dossier'} → chambre déplacée au ${new Date(newCheckIn).toLocaleDateString('fr-FR')}`,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Conflit',
        description: err instanceof Error ? err.message : 'Échec du déplacement',
        variant: 'destructive',
      });
    }
  };

  const shiftAnchor = (delta: number) => {
    setAnchor((a) => new Date(a.getTime() + delta * DAY_MS));
  };

  const handleCreate = async (data: ReservationFormData) => {
    try {
      await createFromForm.createFromForm(data);
      toast({ title: 'Réservation créée', variant: 'success' });
      setCreateOpen(false);
    } catch (err) {
      toast({ title: 'Échec', description: err instanceof Error ? err.message : 'Erreur', variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="planning-live">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-5">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
              Operations · Planning
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="planning-title">
              Planning chambres{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Glisse-dépose une réservation pour la déplacer entre chambres ou dates · verrouillage optimiste activé.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-white rounded-xl border border-gray-200 overflow-hidden">
              {([7, 15, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSpan(d)}
                  data-testid={`planning-span-${d}`}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    span === d ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}j
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => shiftAnchor(-7)}
              data-testid="planning-prev"
              className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-violet-700 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                t.setHours(0, 0, 0, 0);
                setAnchor(t);
              }}
              data-testid="planning-today"
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:text-violet-700"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(7)}
              data-testid="planning-next"
              className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-violet-700 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => void reservationsQ.refetch()}
              data-testid="planning-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw size={13} className={reservationsQ.isFetching ? 'animate-spin' : ''} />
              Live
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              data-testid="planning-create-open"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus size={13} /> Nouvelle réservation
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi testid="planning-kpi-occ" label="Occupation" value={`${kpis.occRate}%`} hint={`${kpis.occupied} / ${kpis.total} nuits-chambre`} icon={CalendarIcon} tone="violet" />
          <Kpi testid="planning-kpi-count" label="Dossiers visibles" value={String(kpis.count)} hint={`${rangeStart} → ${rangeEnd}`} icon={Users} tone="sky" />
          <Kpi testid="planning-kpi-revenue" label="CA fenêtre" value={fmtEUR(kpis.revenue)} hint="Total montants" icon={CalendarIcon} tone="emerald" />
          <Kpi testid="planning-kpi-rooms" label="Chambres actives" value={String(rooms.length)} hint="Inventaire live" icon={Lock} tone="amber" />
          <Kpi testid="planning-kpi-conflict" label="Conflits version" value={move.isError ? '1' : '0'} hint="Optimistic locking" icon={AlertCircle} tone="rose" />
        </section>

        {/* Grid */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="planning-grid">
          {roomsQ.isLoading ? (
            <p className="text-xs text-gray-400 p-8 text-center">Chargement des chambres…</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-gray-400 p-8 text-center">Aucune chambre dans cet hôtel.</p>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
                <div style={{ width: 200 + dates.length * CELL_W }}>
                  {/* Header row */}
                  <div
                    className="sticky top-0 z-20 bg-white border-b border-gray-200 flex"
                    style={{ height: 48 }}
                  >
                    <div
                      className="sticky left-0 z-30 bg-white border-r border-gray-200 flex items-center px-3 text-[10px] uppercase tracking-wider font-bold text-gray-500"
                      style={{ width: 200, minWidth: 200 }}
                    >
                      Chambres
                    </div>
                    {dates.map((d) => {
                      const isToday = isoDay(d) === isoDay(new Date());
                      const isWE = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div
                          key={d.toISOString()}
                          className={`flex flex-col items-center justify-center border-r border-gray-100 ${
                            isToday ? 'bg-violet-50' : isWE ? 'bg-gray-50' : ''
                          }`}
                          style={{ width: CELL_W, minWidth: CELL_W }}
                        >
                          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
                            {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                          </span>
                          <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-violet-700' : 'text-gray-700'}`}>
                            {d.getDate()}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {d.toLocaleDateString('fr-FR', { month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Body rows */}
                  {rooms.map((room) => (
                    <RoomRowComponent
                      key={room.id}
                      room={room}
                      dates={dates}
                      reservations={reservations.filter((r) =>
                        r.room_id ? r.room_id === room.id : r.room_number === room.number,
                      )}
                    />
                  ))}
                </div>
              </div>
            </DndContext>
          )}
        </section>

        {move.isPending && (
          <p className="text-xs text-violet-600 font-semibold">Déplacement en cours…</p>
        )}
      </main>

      <ReservationFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
};

/* ================================ KPI ================================== */

interface KpiProps {
  testid?: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';
}

const TONE_BG: Record<KpiProps['tone'], string> = {
  violet: 'bg-violet-50 text-violet-700',
  sky: 'bg-sky-50 text-sky-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
};

const Kpi: React.FC<KpiProps> = ({ testid, label, value, hint, icon: Icon, tone }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3" data-testid={testid}>
    <span className={`grid place-items-center w-9 h-9 rounded-xl ${TONE_BG[tone]} shrink-0`}>
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-base font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[9px] text-gray-400 truncate">{hint}</p>
    </div>
  </div>
);

/* ================================ Row ================================== */

const RoomRowComponent: React.FC<{
  room: RoomRow;
  dates: Date[];
  reservations: ReservationRow[];
}> = ({ room, dates, reservations }) => {
  return (
    <div className="flex border-b border-gray-100 relative" style={{ height: ROW_H }}>
      <div
        className="sticky left-0 z-10 bg-white border-r border-gray-200 flex items-center gap-2 px-3"
        style={{ width: 200, minWidth: 200 }}
      >
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold">
          {room.number}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{room.type ?? '—'}</p>
          <p className="text-[10px] text-gray-400 truncate">Étage {room.floor ?? '—'}</p>
        </div>
      </div>
      {dates.map((d) => (
        <DropCell key={d.toISOString()} roomId={room.id} date={d} />
      ))}
      {reservations.map((r) => (
        <ReservationBar key={r.id} reservation={r} dates={dates} />
      ))}
    </div>
  );
};

/* ============================== Drop cell ============================= */

const DropCell: React.FC<{ roomId: string; date: Date }> = ({ roomId, date }) => {
  const id = `room:${roomId}:date:${isoDay(date)}`;
  const { isOver, setNodeRef } = useDroppable({ id });
  const isWE = date.getDay() === 0 || date.getDay() === 6;
  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-cell-${roomId}-${isoDay(date)}`}
      className={`border-r border-gray-100 transition-colors ${
        isOver ? 'bg-violet-100' : isWE ? 'bg-gray-50/50' : ''
      }`}
      style={{ width: CELL_W, minWidth: CELL_W }}
    />
  );
};

/* ============================== Bar =================================== */

const ReservationBar: React.FC<{ reservation: ReservationRow; dates: Date[] }> = ({
  reservation,
  dates,
}) => {
  const checkIn = new Date(reservation.check_in);
  const checkOut = new Date(reservation.check_out);
  const rangeStart = dates[0];
  const rangeEnd = new Date(dates[dates.length - 1].getTime() + DAY_MS);

  const start = checkIn < rangeStart ? rangeStart : checkIn;
  const end = checkOut > rangeEnd ? rangeEnd : checkOut;
  const offsetCells = Math.round((start.getTime() - rangeStart.getTime()) / DAY_MS);
  const widthCells = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: reservation.id,
  });

  const tone = STATUS_TONE[reservation.status ?? 'confirmed'] ?? STATUS_TONE.confirmed;
  const guest = reservation.guest_name ?? reservation.reference ?? '—';

  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-bar-${reservation.id}`}
      {...listeners}
      {...attributes}
      className={`absolute top-1.5 rounded-lg px-2 py-1 cursor-grab active:cursor-grabbing shadow-sm border text-[11px] font-semibold flex items-center justify-between gap-2 truncate ${tone} ${isDragging ? 'opacity-60 ring-2 ring-violet-400' : ''}`}
      style={{
        left: 200 + offsetCells * CELL_W + 2,
        width: widthCells * CELL_W - 4,
        height: ROW_H - 12,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 30 : 5,
      }}
      title={`${guest} · ${reservation.check_in} → ${reservation.check_out}`}
    >
      <span className="truncate">{guest}</span>
      <span className="text-[10px] tabular-nums opacity-90 shrink-0">
        {reservation.nights ?? '—'}n · {fmtEUR(reservation.total_amount)}
      </span>
    </div>
  );
};

export default PlanningViewLive;
