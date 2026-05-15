/**
 * FLOWTYM — Planning orchestrator (Gantt + Revenue calendar).
 *
 * Replaces `PlanningViewLive` with a multi-file architecture:
 *   • PlanningHeader      — toolbar (mode, view, datepicker, filters, create btn)
 *   • PlanningGrid        — Gantt grid with drag&drop + auto-fit
 *   • RevenueCalendar     — monthly KPI heatmap + Graphiques
 *   • ConfirmMoveDialog   — délogement supplement workflow
 *
 * Data sources : Supabase (reservations, rooms, planning_channels, planning_events).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel, useRooms } from '@/src/domains/hotel/hooks';
import { useReservationsByRange, useMoveReservation } from '@/src/domains/reservations/hooks';
import { useReservations as useReservationsList } from '@/src/domains/reservations/hooks';
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';
import { useChannels, useEvents } from '@/src/domains/planning/hooks';
import type { PlanningEventRow } from '@/src/domains/planning/schemas';
import type { HotelEvent } from '@/src/store/configStore';
import ReservationFormModal, {
  type ReservationFormData,
} from '@/src/components/modals/ReservationFormModal';
import { useCreateReservationFromForm } from '@/src/domains/reservations/useCreateReservationFromForm';
import { supabase } from '@/src/lib/supabase';

import {
  buildDateRange, computeViewLength, isoDay, CATEGORY_PRICES,
  type ChannelDef,
  type DisplayMode, type RevenueSubView, type ViewLength,
} from './planning/types';
import PlanningHeader from './planning/PlanningHeader';
import PlanningGrid from './planning/PlanningGrid';
import RevenueCalendar from './planning/RevenueCalendar';
import ConfirmMoveDialog, { type ConfirmMovePayload } from './planning/ConfirmMoveDialog';

/** Map a Supabase planning_event row to the legacy HotelEvent shape consumed by Grid/Calendar. */
const toHotelEvent = (e: PlanningEventRow): HotelEvent => ({
  id: e.id,
  name: e.name,
  startDate: e.start_date,
  endDate: e.end_date,
  impact: e.impact,
  description: e.description ?? undefined,
  source: e.source ?? undefined,
  location: e.location ?? undefined,
});

const PlanningView: React.FC = () => {
  const { toast } = useToast();
  const hotelQ = useActiveHotel();
  const roomsQ = useRooms();
  const channelsQ = useChannels();
  const eventsQ = useEvents();

  const channels: ChannelDef[] = useMemo(
    () => (channelsQ.data ?? []).map((c) => ({ code: c.code, name: c.name, color: c.color })),
    [channelsQ.data],
  );
  const storeEvents: HotelEvent[] = useMemo(
    () => (eventsQ.data ?? []).map(toHotelEvent),
    [eventsQ.data],
  );

  const [displayMode, setDisplayMode] = useState<DisplayMode>('Gantt');
  const [view, setView] = useState<ViewLength>('15J');
  const [anchor, setAnchor] = useState<Date>(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; });
  const [monthDate, setMonthDate] = useState<Date>(() => { const t = new Date(); t.setDate(1); t.setHours(0, 0, 0, 0); return t; });
  const [revenueSubView, setRevenueSubView] = useState<RevenueSubView>('KPI');
  const [showRightPanel, setShowRightPanel] = useState(false);

  /* Filters */
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tous Types');
  const [statusFilter, setStatusFilter] = useState('Tous Statuts');
  const [channelFilter, setChannelFilter] = useState('Tous Canaux');

  /* Modals */
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<Partial<ReservationFormData> | null>(null);
  const [confirmMove, setConfirmMove] = useState<ConfirmMovePayload | null>(null);
  const [resDetails, setResDetails] = useState<ReservationRow | null>(null);

  /* Data */
  const viewLen = computeViewLength(view);
  const dates = useMemo(() => buildDateRange(anchor, viewLen), [anchor, viewLen]);
  const rangeStart = isoDay(dates[0]);
  const rangeEnd = isoDay(dates[dates.length - 1]);

  // Gantt mode: range query; Revenue mode: full month query
  const ganttQ = useReservationsByRange({ rangeStart, rangeEnd });
  const monthStart = isoDay(monthDate);
  const monthEnd = isoDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  const monthQ = useReservationsByRange({ rangeStart: monthStart, rangeEnd: monthEnd });
  const allReservationsQ = useReservationsList({ limit: 200 });

  const ganttReservations: ReservationRow[] = ganttQ.data ?? [];
  const monthReservations: ReservationRow[] = monthQ.data ?? [];
  const move = useMoveReservation();
  const createFromForm = useCreateReservationFromForm();

  /* Filtered rooms */
  const allRooms: RoomRow[] = (roomsQ.data ?? []).slice().sort((a, b) =>
    (a.number ?? '').localeCompare(b.number ?? '', 'fr', { numeric: true }),
  );
  const roomTypes = useMemo(() => Array.from(new Set(allRooms.map((r) => r.type ?? '—'))).filter(Boolean), [allRooms]);
  const roomCategories = useMemo(() => Array.from(new Set(allRooms.map((r) => r.category ?? '—'))).filter(Boolean), [allRooms]);

  const filteredRooms: RoomRow[] = useMemo(() => allRooms.filter((r) => {
    if (typeFilter !== 'Tous Types' && r.type !== typeFilter && r.category !== typeFilter) return false;
    if (search && !`${r.number} ${r.type} ${r.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'Libres' && r.status !== 'clean') return false;
    if (statusFilter === 'Ménage' && r.status !== 'dirty' && r.status !== 'cleaning') return false;
    return true;
  }), [allRooms, typeFilter, statusFilter, search]);

  /* Filtered reservations (channel + search) */
  const visibleGanttReservations: ReservationRow[] = useMemo(() => ganttReservations.filter((r) => {
    if (channelFilter !== 'Tous Canaux' && (r.source ?? '').toUpperCase() !== channelFilter) return false;
    if (search && !`${r.guest_name ?? ''} ${r.reference ?? ''} ${r.room_number ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [ganttReservations, channelFilter, search]);

  /* Navigation */
  const handlePrev = useCallback(() => {
    if (displayMode === 'Revenue') {
      setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    } else {
      const step = view === '7J' ? 7 : view === '15J' ? 15 : 30;
      setAnchor((a) => new Date(a.getTime() - step * 86_400_000));
    }
  }, [displayMode, view]);

  const handleNext = useCallback(() => {
    if (displayMode === 'Revenue') {
      setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    } else {
      const step = view === '7J' ? 7 : view === '15J' ? 15 : 30;
      setAnchor((a) => new Date(a.getTime() + step * 86_400_000));
    }
  }, [displayMode, view]);

  const handleToday = useCallback(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    setAnchor(t);
    setMonthDate(new Date(t.getFullYear(), t.getMonth(), 1));
  }, []);

  /* Drag&drop with confirm-move */
  const handleMoveDrop = useCallback(async (e: DragEndEvent) => {
    if (!e.over || !e.active) return;
    const reservationId = String(e.active.id);
    const overId = String(e.over.id);
    const matched = overId.match(/^room:([^:]+):date:(.+)$/);
    if (!matched) return;
    const newRoomId = matched[1];
    const newCheckIn = matched[2];

    const reservation = ganttReservations.find((x) => x.id === reservationId);
    if (!reservation) return;

    const oldRoom = filteredRooms.find((r) => (reservation.room_id ? r.id === reservation.room_id : r.number === reservation.room_number)) ?? null;
    const newRoom = allRooms.find((r) => r.id === newRoomId);
    if (!newRoom) return;

    const oldCheckIn = new Date(reservation.check_in);
    const oldCheckOut = new Date(reservation.check_out);
    const nights = Math.max(1, Math.round((oldCheckOut.getTime() - oldCheckIn.getTime()) / 86_400_000));
    const newCheckOut = isoDay(new Date(new Date(newCheckIn).getTime() + nights * 86_400_000));

    if (newRoom.id === reservation.room_id && isoDay(oldCheckIn) === newCheckIn) return;

    // Different category → ConfirmMove dialog
    if (oldRoom && oldRoom.category !== newRoom.category) {
      setConfirmMove({
        reservationId,
        fromVersion: reservation.version ?? 1,
        fromRoomNumber: oldRoom.number ?? null,
        toRoomNumber: newRoom.number,
        toRoomId: newRoom.id,
        oldCategory: oldRoom.category ?? null,
        newCategory: newRoom.category ?? null,
        oldPrice: CATEGORY_PRICES[oldRoom.category ?? 'STD'] ?? 100,
        newPrice: CATEGORY_PRICES[newRoom.category ?? 'STD'] ?? 100,
        nights,
        currentTotal: reservation.total_amount ?? 0,
        newCheckIn,
        newCheckOut,
      });
      return;
    }

    // Same category — direct move
    try {
      await move.mutateAsync({
        id: reservationId,
        fromVersion: reservation.version ?? 1,
        roomId: newRoom.id,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
      });
      toast({
        title: 'Réservation déplacée',
        description: `${reservation.guest_name ?? reservation.reference ?? 'Dossier'} → ${newRoom.number}`,
        variant: 'success',
      });
    } catch (err) {
      toast({ title: 'Conflit', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  }, [ganttReservations, allRooms, filteredRooms, move, toast]);

  const handleConfirmMove = useCallback(async (deltaTotal: number, note: string) => {
    if (!confirmMove) return;
    try {
      // 1) move
      await move.mutateAsync({
        id: confirmMove.reservationId,
        fromVersion: confirmMove.fromVersion,
        roomId: confirmMove.toRoomId,
        checkIn: confirmMove.newCheckIn,
        checkOut: confirmMove.newCheckOut,
      });
      // 2) bump total_amount if delta != 0 (respect version bumped already)
      if (deltaTotal !== 0) {
        const newTotal = (confirmMove.currentTotal ?? 0) + deltaTotal;
        const builder = supabase.from('reservations');
        await builder.update({ total_amount: newTotal }).eq('id', confirmMove.reservationId);
      }
      toast({ title: 'Délogement confirmé', description: note, variant: 'success' });
    } catch (err) {
      toast({ title: 'Échec', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setConfirmMove(null);
    }
  }, [confirmMove, move, toast]);

  /* Empty cell click → pre-filled create modal */
  const handleEmptyCellClick = useCallback((room: RoomRow, date: Date) => {
    setCreateInitial({
      checkIn: isoDay(date),
      checkOut: isoDay(new Date(date.getTime() + 86_400_000)),
      roomNumber: room.number,
      roomType: room.type ?? 'DBL',
    });
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback(async (data: ReservationFormData) => {
    try {
      await createFromForm.createFromForm(data);
      toast({ title: 'Réservation créée', variant: 'success' });
      setCreateOpen(false);
      setCreateInitial(null);
    } catch (err) {
      toast({ title: 'Échec', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  }, [createFromForm, toast]);

  /* Keyboard shortcuts (legacy parity) */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      switch (detail?.action) {
        case 'prev': handlePrev(); break;
        case 'next': handleNext(); break;
        case 'view15': setView('15J'); break;
        case 'viewWeek': setView('7J'); break;
        case 'zoomIn':
          if (view === 'Mois') setView('15J');
          else if (view === '15J') setView('7J');
          break;
        case 'zoomOut':
          if (view === '7J') setView('15J');
          else if (view === '15J') setView('Mois');
          break;
      }
    };
    window.addEventListener('flowtym:planning-nav', handler);
    return () => window.removeEventListener('flowtym:planning-nav', handler);
  }, [handlePrev, handleNext, view]);

  /* Range label */
  const rangeLabel = displayMode === 'Gantt'
    ? `${dates[0].toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — ${dates[dates.length - 1].toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : `${monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden font-sans select-none" data-testid="planning-page">
      <PlanningHeader
        displayMode={displayMode} setDisplayMode={setDisplayMode}
        view={view} setView={setView}
        rangeLabel={rangeLabel}
        onPrev={handlePrev} onNext={handleNext} onToday={handleToday}
        anchorMonth={displayMode === 'Gantt' ? anchor.getMonth() : monthDate.getMonth()}
        anchorYear={displayMode === 'Gantt' ? anchor.getFullYear() : monthDate.getFullYear()}
        onPickMonth={(y, m) => {
          if (displayMode === 'Gantt') setAnchor(new Date(y, m, 1));
          else setMonthDate(new Date(y, m, 1));
        }}
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        channelFilter={channelFilter} setChannelFilter={setChannelFilter}
        channels={channels}
        roomTypes={[...roomCategories, ...roomTypes]}
        showRightPanel={showRightPanel} toggleRightPanel={() => setShowRightPanel((s) => !s)}
        onCreate={() => { setCreateInitial(null); setCreateOpen(true); }}
      />

      {displayMode === 'Gantt' ? (
        <PlanningGrid
          view={view}
          dates={dates}
          rooms={filteredRooms}
          reservations={visibleGanttReservations}
          events={storeEvents}
          onMoveDrop={handleMoveDrop}
          onResClick={(r) => setResDetails(r)}
          onEmptyCellClick={handleEmptyCellClick}
          onDragCreateRelease={(room, startDate, endDate) => {
            setCreateInitial({
              checkIn: isoDay(startDate),
              checkOut: isoDay(endDate),
              roomNumber: room.number,
              roomType: room.type ?? 'Double Classique',
              nights: Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)),
            });
            setCreateOpen(true);
          }}
        />
      ) : (
        <RevenueCalendar
          monthDate={monthDate}
          reservations={monthReservations.length ? monthReservations : (allReservationsQ.data?.rows ?? [])}
          rooms={allRooms}
          events={storeEvents}
          subView={revenueSubView}
          setSubView={setRevenueSubView}
        />
      )}

      <ReservationFormModal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setCreateInitial(null); }}
        onSave={handleCreate}
        initialData={createInitial}
      />

      <ConfirmMoveDialog
        payload={confirmMove}
        onConfirm={handleConfirmMove}
        onClose={() => setConfirmMove(null)}
      />

      {/* Lightweight reservation details popover (replaces legacy ReservationDetailsModal for now) */}
      {resDetails && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fermer le détail"
          onClick={() => setResDetails(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setResDetails(null); }}
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="planning-res-details"
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl text-left cursor-default" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-indigo-600">Réservation</p>
            <h3 className="text-lg font-bold text-gray-900 mt-1">{resDetails.guest_name ?? '—'}</h3>
            <p className="text-xs text-gray-500 mt-1 font-mono">{resDetails.reference}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Chambre" v={`${resDetails.room_number ?? '—'} · ${resDetails.room_type ?? ''}`} />
              <Row k="Arrivée" v={new Date(resDetails.check_in).toLocaleDateString('fr-FR')} />
              <Row k="Départ" v={new Date(resDetails.check_out).toLocaleDateString('fr-FR')} />
              <Row k="Nuits" v={String(resDetails.nights ?? '—')} />
              <Row k="Canal" v={(resDetails.source ?? '—').toUpperCase()} />
              <Row k="Statut" v={resDetails.status ?? '—'} />
              <Row k="Total" v={resDetails.total_amount ? `${resDetails.total_amount.toLocaleString('fr-FR')} €` : '—'} />
            </dl>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setResDetails(null)} data-testid="planning-res-close" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Hint banner when there's no reservation visible */}
      {displayMode === 'Gantt' && hotelQ.data && visibleGanttReservations.length === 0 && (
        <div className="absolute bottom-6 right-6 bg-white border border-indigo-100 rounded-xl px-4 py-2 shadow-sm text-[11px] text-gray-500" data-testid="planning-empty-hint">
          Aucune réservation dans cette fenêtre · clique une cellule vide pour en créer une.
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
    <dt className="text-[10px] uppercase tracking-widest font-black text-gray-400">{k}</dt>
    <dd className="text-sm font-bold text-gray-800 tabular-nums">{v}</dd>
  </div>
);

export default PlanningView;
