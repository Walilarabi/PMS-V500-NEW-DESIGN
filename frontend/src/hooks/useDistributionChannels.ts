/**
 * Agrège les réservations par canal (reservations.source) depuis Supabase
 * et retourne un tableau Channel[] compatible avec DistributionAnalytics.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import type { PeriodKey } from '@/src/components/revenue/premium/PremiumHeader';

/* ── Static channel metadata (commission rates, colors) ── */

const CHANNEL_META: Record<string, {
  color: string; iconBg: string; iconText: string;
  commissionRate: number; shortName: string;
}> = {
  'Booking.com':  { color: '#003580', iconBg: 'bg-[#003580]',   iconText: 'text-white',       commissionRate: 15, shortName: 'BK'  },
  'Expedia':      { color: '#FBBC05', iconBg: 'bg-amber-100',    iconText: 'text-amber-700',   commissionRate: 18, shortName: 'EX'  },
  'Expedia Group':{ color: '#FBBC05', iconBg: 'bg-amber-100',    iconText: 'text-amber-700',   commissionRate: 18, shortName: 'EX'  },
  'Airbnb':       { color: '#FF5A5F', iconBg: 'bg-[#FF5A5F]/10', iconText: 'text-[#FF5A5F]',  commissionRate: 14, shortName: 'AB'  },
  'Website':      { color: '#10B981', iconBg: 'bg-emerald-50',   iconText: 'text-emerald-600', commissionRate: 0,  shortName: 'WEB' },
  'Direct':       { color: '#10B981', iconBg: 'bg-emerald-50',   iconText: 'text-emerald-600', commissionRate: 0,  shortName: 'DIR' },
  'DIRECT':       { color: '#10B981', iconBg: 'bg-emerald-50',   iconText: 'text-emerald-600', commissionRate: 0,  shortName: 'DIR' },
  'HRS':          { color: '#1F2937', iconBg: 'bg-slate-800',    iconText: 'text-white',       commissionRate: 15, shortName: 'HRS' },
  'Hotelbeds':    { color: '#6366F1', iconBg: 'bg-indigo-50',    iconText: 'text-indigo-600',  commissionRate: 12, shortName: 'HB'  },
  'Agoda':        { color: '#E84142', iconBg: 'bg-red-50',       iconText: 'text-red-600',     commissionRate: 15, shortName: 'AG'  },
  'Ctrip':        { color: '#0077B6', iconBg: 'bg-blue-50',      iconText: 'text-blue-600',    commissionRate: 18, shortName: 'CT'  },
  'GDS':          { color: '#7C3AED', iconBg: 'bg-violet-50',    iconText: 'text-violet-600',  commissionRate: 20, shortName: 'GDS' },
  'Lastminute':   { color: '#EC4899', iconBg: 'bg-pink-50',      iconText: 'text-pink-600',    commissionRate: 18, shortName: 'LM'  },
  'TBO Holidays': { color: '#F97316', iconBg: 'bg-orange-50',    iconText: 'text-orange-600',  commissionRate: 12, shortName: 'TBO' },
  'Miki Travel Ltd':{ color: '#8B5CF6',iconBg:'bg-violet-50',    iconText: 'text-violet-600',  commissionRate: 10, shortName: 'MK'  },
  'Travco':       { color: '#0891B2', iconBg: 'bg-cyan-50',      iconText: 'text-cyan-700',    commissionRate: 12, shortName: 'TRV' },
  'SunHotels':    { color: '#EAB308', iconBg: 'bg-yellow-50',    iconText: 'text-yellow-700',  commissionRate: 12, shortName: 'SH'  },
};

const DEFAULT_META = {
  color: '#64748B', iconBg: 'bg-slate-100', iconText: 'text-slate-500',
  commissionRate: 10, shortName: '?',
};

function modeOf(arr: string[]): string {
  if (!arr.length) return '—';
  const freq: Record<string, number> = {};
  arr.forEach(x => { freq[x] = (freq[x] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

function periodStart(period: PeriodKey): string {
  const d = new Date();
  if (period === '7d')  d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else if (period === '90d') d.setDate(d.getDate() - 90);
  else if (period === 'ytd') d.setMonth(0, 1);
  else d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function periodDays(period: PeriodKey): number {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  if (period === 'ytd') {
    const now = new Date();
    return Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
  }
  return 30;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReservationRow = Record<string, any>;

export function useDistributionChannels(period: PeriodKey) {
  const since = useMemo(() => periodStart(period), [period]);
  const days  = periodDays(period);

  return useQuery({
    queryKey: ['distribution-channels', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('source, total_amount, nights, status, segment, room_type, created_at, check_in')
        .gte('created_at', since)
        .not('source', 'is', null);
      if (error) throw error;
      if (!data?.length) return [];

      type GroupAcc = {
        bookings: number; revenue: number; nights: number; cancels: number;
        nightsList: number[]; leadTimes: number[]; rooms: string[]; segments: string[];
        byWeek: Record<number, number>;
      };
      const groups: Record<string, GroupAcc> = {};
      const now = Date.now();

      for (const r of data as ReservationRow[]) {
        const src: string = r.source;
        if (!groups[src]) {
          groups[src] = { bookings: 0, revenue: 0, nights: 0, cancels: 0, nightsList: [], leadTimes: [], rooms: [], segments: [], byWeek: {} };
        }
        const g = groups[src];
        g.bookings++;
        g.revenue += Number(r.total_amount) || 0;
        g.nights  += Number(r.nights) || 0;
        if (r.status === 'cancelled') g.cancels++;
        if (r.nights)    g.nightsList.push(Number(r.nights));
        if (r.room_type) g.rooms.push(String(r.room_type));
        if (r.segment)   g.segments.push(String(r.segment));
        const lead = Math.round((new Date(r.check_in).getTime() - new Date(r.created_at).getTime()) / 86400000);
        if (lead >= 0 && lead < 365) g.leadTimes.push(lead);
        // 14-bucket sparkline (0 = oldest, 13 = most recent)
        const weeksAgo = Math.min(13, Math.floor((now - new Date(r.created_at).getTime()) / (7 * 86400000)));
        const bucket = 13 - weeksAgo;
        g.byWeek[bucket] = (g.byWeek[bucket] ?? 0) + 1;
      }

      return Object.entries(groups)
        .map(([source, g]) => {
          const meta = CHANNEL_META[source] ?? DEFAULT_META;
          const adr   = g.nights > 0 ? Math.round(g.revenue / g.nights) : 0;
          const avgLOS = g.nightsList.length
            ? +(g.nightsList.reduce((a, b) => a + b, 0) / g.nightsList.length).toFixed(1)
            : 0;
          const leadTime = g.leadTimes.length
            ? Math.round(g.leadTimes.reduce((a, b) => a + b, 0) / g.leadTimes.length)
            : 0;
          const cancelRate  = +(g.cancels / Math.max(1, g.bookings) * 100).toFixed(1);
          const commissionCost = Math.round(g.revenue * meta.commissionRate / 100);
          const netRevenue  = g.revenue - commissionCost;
          const revpar      = Math.round(g.revenue / Math.max(1, days));
          const score       = Math.max(10, Math.min(100, Math.round(
            100 - cancelRate * 0.5 - (leadTime < 3 ? 15 : 0) - (meta.commissionRate > 18 ? 5 : 0)
          )));
          const trend = Array.from({ length: 14 }, (_, i) => g.byWeek[i] ?? 0);
          const trendDelta = trend[13] > 0 && trend[6] > 0
            ? +((trend[13] - trend[6]) / trend[6] * 100).toFixed(1)
            : 0;

          return {
            id: source.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            name: source,
            shortName: meta.shortName,
            color: meta.color,
            iconBg: meta.iconBg,
            iconText: meta.iconText,
            commissionRate: meta.commissionRate,
            bookings: g.bookings,
            bookingsDelta: 0,
            roomNights: g.nights,
            adr,
            revenue: Math.round(g.revenue),
            netRevenue,
            commissionCost,
            revpar,
            conversion: 0,
            cancellationRate: cancelRate,
            leadTime,
            avgLOS,
            topSegment: modeOf(g.segments),
            topNationality: '—',
            topRoom: modeOf(g.rooms),
            performanceScore: score,
            trend,
            trendDelta,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);
    },
    staleTime: 60_000,
  });
}
