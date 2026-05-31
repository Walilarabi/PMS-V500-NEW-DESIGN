/**
 * FLOWTYM — Blocages de chambres (table room_blocks).
 *
 * Lit les blocages actifs sur la plage du planning et expose des actions RÉELLES
 * (jamais de bouton mort, jamais de simulation) :
 *   - unblock : supprime la ligne room_blocks (la chambre redevient vendable).
 *   - extend  : prolonge la date de fin du blocage.
 *
 * Toutes les écritures sont scopées par RLS (hotel_id = get_user_hotel_id()).
 * Après mutation, on invalide `rooms` et `room-blocks` pour que le planning,
 * les chambres libres, le TO et la disponibilité soient recalculés.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { toIsoDate } from '@/src/services/planning/planning-kpi.service';

export interface RoomBlock {
  id: string;
  room_id: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  notes: string | null;
  created_at: string;
}

/** Libellés FR des motifs (cohérents avec BlockRoomsModal). */
export const BLOCK_REASON_LABELS: Record<string, string> = {
  maintenance: 'Maintenance / Travaux',
  cleaning: 'Nettoyage approfondi',
  out_of_order: 'Hors service',
  vip_hold: 'Réservation VIP',
  group_hold: 'Blocage groupe',
  other: 'Autre',
};

export function blockReasonLabel(reason: string): string {
  return BLOCK_REASON_LABELS[reason] ?? reason;
}

const BLOCKS_KEY = ['room-blocks'] as const;

export function useRoomBlocks(startDate: Date | string, rangeDays: number) {
  const { status } = useAuth();
  const qc = useQueryClient();

  const start = toIsoDate(startDate);
  const endDt = new Date(`${start}T00:00:00`);
  endDt.setDate(endDt.getDate() + Math.max(1, rangeDays) - 1);
  const end = toIsoDate(endDt);

  const query = useQuery<RoomBlock[]>({
    queryKey: [...BLOCKS_KEY, start, end],
    enabled: status === 'authenticated',
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      // Blocages qui chevauchent la plage : start <= rangeEnd ET end >= rangeStart.
      const { data, error } = await supabase
        .from('room_blocks')
        .select('id, room_id, start_date, end_date, reason, notes, created_at')
        .lte('start_date', end)
        .gte('end_date', start)
        .order('start_date', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as RoomBlock[];
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: BLOCKS_KEY });
    void qc.invalidateQueries({ queryKey: ['rooms'] });
  };

  const unblock = useMutation<void, Error, string>({
    mutationFn: async (blockId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('room_blocks').delete().eq('id', blockId);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: invalidate,
  });

  const extend = useMutation<void, Error, { id: string; newEndDate: string }>({
    mutationFn: async ({ id, newEndDate }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('room_blocks')
        .update({ end_date: newEndDate })
        .eq('id', id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: invalidate,
  });

  // Index par room_id → blocages, et la map "chambre actuellement bloquée" pour
  // une date de référence (aujourd'hui par défaut).
  const byRoomId = useMemo(() => {
    const map: Record<string, RoomBlock[]> = {};
    for (const b of query.data ?? []) {
      if (!b.room_id) continue;
      (map[b.room_id] ??= []).push(b);
    }
    return map;
  }, [query.data]);

  /** Renvoie le blocage actif d'une chambre à une date (ou null). */
  const getActiveBlock = (roomId: string, dateIso: string): RoomBlock | null => {
    const list = byRoomId[roomId];
    if (!list) return null;
    return list.find((b) => dateIso >= b.start_date && dateIso <= b.end_date) ?? null;
  };

  return {
    blocks: query.data ?? [],
    byRoomId,
    getActiveBlock,
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    unblock,
    extend,
  };
}
