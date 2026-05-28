/**
 * React Query hooks for promo_campaigns table.
 * Replaces the Zustand promotionsStore localStorage layer.
 *
 * NOTE: promo_campaigns is not in the generated Supabase types yet.
 * All DML calls use `as any` until `supabase gen types` is re-run.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { emitRmsEvent } from '@/src/lib/rms/eventBus';
import type { Promotion, PromoStatus } from '@/src/store/promotionsStore';

const QK = ['promo-campaigns'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function mapRow(r: AnyRecord): Promotion {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? '',
    type: r.type as Promotion['type'],
    typeLabel: (r.type_label as string) ?? (r.type as string),
    discount: r.discount as string,
    discountValue: Number(r.discount_value) || 0,
    code: (r.code as string | null) ?? null,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    permanent: Boolean(r.permanent),
    channels: (r.channels as string[]) ?? [],
    rooms: (r.rooms as string[]) ?? [],
    segments: (r.segments as string[]) ?? [],
    minNights: Number(r.min_nights) || 1,
    bookings: Number(r.bookings) || 0,
    bookingsDelta: Number(r.bookings_delta) || 0,
    revenue: Number(r.revenue) || 0,
    revenueDelta: Number(r.revenue_delta) || 0,
    roi: Number(r.roi) || 0,
    conversion: Number(r.conversion) || 0,
    performance: Number(r.performance) || 0,
    status: (r.status as PromoStatus) ?? 'draft',
    alert: (r.alert as Promotion['alert']) ?? undefined,
    sparkline: (r.sparkline as number[]) ?? Array(14).fill(2),
  };
}

function nextStatus(current: PromoStatus): PromoStatus {
  if (current === 'active') return 'paused';
  if (current === 'paused' || current === 'scheduled' || current === 'draft') return 'active';
  return current;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function usePromoCampaigns() {
  return useQuery({
    queryKey: [...QK],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('promo_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as AnyRecord[]).map(mapRow);
    },
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useTogglePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase as any)
        .from('promo_campaigns')
        .select('status')
        .eq('id', id)
        .single();
      const previousStatus: PromoStatus = (current?.status as PromoStatus) ?? 'draft';
      const newStatus = nextStatus(previousStatus);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('promo_campaigns')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id, previousStatus, newStatus };
    },
    onSuccess: ({ id, previousStatus, newStatus }) => {
      void qc.invalidateQueries({ queryKey: QK });
      emitRmsEvent('promotion:status-changed', {
        promotionId: id,
        nextStatus: newStatus,
        previousStatus,
      });
    },
  });
}

export function useDeletePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('promo_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: QK });
      emitRmsEvent('promotion:deleted', { promotionId: id });
    },
  });
}

export function useDuplicatePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (source: Promotion) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('promo_campaigns')
        .insert({
          name: `${source.name} (copie)`,
          description: source.description,
          type: source.type,
          type_label: source.typeLabel,
          discount: source.discount,
          discount_value: source.discountValue,
          code: source.code,
          start_date: source.startDate,
          end_date: source.endDate,
          permanent: source.permanent,
          channels: source.channels,
          rooms: source.rooms,
          segments: source.segments,
          min_nights: source.minNights,
          bookings: 0, bookings_delta: 0,
          revenue: 0, revenue_delta: 0,
          roi: 0, conversion: 0, performance: 0,
          status: 'draft',
          alert: null,
          sparkline: Array(14).fill(2),
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as AnyRecord).id as string;
    },
    onSuccess: (newId, source) => {
      void qc.invalidateQueries({ queryKey: QK });
      emitRmsEvent('promotion:duplicated', { sourceId: source.id, newId });
    },
  });
}

export interface CreatePromoCampaignInput {
  name: string;
  description?: string;
  type: Promotion['type'];
  typeLabel: string;
  discount: string;
  discountValue: number;
  code?: string | null;
  startDate: string;
  endDate: string;
  channels?: string[];
}

export function useCreatePromoCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePromoCampaignInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('promo_campaigns')
        .insert({
          name: input.name,
          description: input.description ?? '',
          type: input.type,
          type_label: input.typeLabel,
          discount: input.discount || `${input.discountValue}%`,
          discount_value: input.discountValue,
          code: input.code ?? null,
          start_date: input.startDate,
          end_date: input.endDate,
          permanent: false,
          channels: input.channels ?? [],
          rooms: ['Toutes'],
          segments: [],
          min_nights: 1,
          bookings: 0, bookings_delta: 0,
          revenue: 0, revenue_delta: 0,
          roi: 0, conversion: 0, performance: 0,
          status: 'draft',
          alert: null,
          sparkline: Array(14).fill(2),
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as AnyRecord).id as string;
    },
    onSuccess: (newId, input) => {
      void qc.invalidateQueries({ queryKey: QK });
      emitRmsEvent('promotion:created', { promotionId: newId, name: input.name });
    },
  });
}
