/**
 * FLOWTYM DISTRIBUTION & OTA — Premium 2026
 *
 * Cockpit de pilotage multicanal :
 * KPIs sparklines, top canaux premium, tableau dense ultra lisible,
 * analyses mix / dépendance / commissions, alertes intelligentes,
 * recommandations IA.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  BarChart3,
  Building2,
  Calendar,
  Compass,
  DollarSign,
  Filter,
  Gauge,
  Globe,
  LineChart as LineChartIcon,
  Network,
  PieChart as PieChartIcon,
  Plug,
  Repeat,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { PremiumHeader, type PeriodKey } from '@/src/components/revenue/premium/PremiumHeader';
import { PremiumKPI } from '@/src/components/revenue/premium/PremiumKPI';
import {
  exportDistributionExcel,
  exportDistributionPDF,
  type DistributionExportInput,
} from '@/src/services/revenueExport.service';
import { useShallow } from 'zustand/react/shallow';
import {
  usePromotionsStore,
  selectActivePromotionsByChannel,
} from '@/src/store/promotionsStore';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { useLighthouseStore } from '@/src/store/lighthouseStore';
import {
  computeRealTotals,
  getDataSourceStatus,
} from '@/src/lib/rms/distributionFromData';
import { Database, Info } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface Channel {
  id: string;
  name: string;
  shortName: string;
  color: string;
  iconBg: string;
  iconText: string;
  commissionRate: number;
  bookings: number;
  bookingsDelta: number;
  roomNights: number;
  adr: number;
  revenue: number;
  netRevenue: number;
  commissionCost: number;
  revpar: number;
  conversion: number;
  cancellationRate: number;
  leadTime: number;
  avgLOS: number;
  topSegment: string;
  topNationality: string;
  topRoom: string;
  performanceScore: number;
  trend: number[];
  trendDelta: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MOCK DATA                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const spark = (n: number, base = 50, jitter = 25) =>
  Array.from({ length: n }, (_, i) =>
    Math.max(2, Math.round(base + Math.sin(i / 1.4) * jitter + (Math.random() - 0.5) * jitter * 0.6))
  );

const CHANNELS: Channel[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    shortName: 'B',
    color: '#003580',
    iconBg: 'bg-[#003580]',
    iconText: 'text-white',
    commissionRate: 10,
    bookings: 412,
    bookingsDelta: 4.2,
    roomNights: 1068,
    adr: 243,
    revenue: 260000,
    netRevenue: 234000,
    commissionCost: 26000,
    revpar: 86,
    conversion: 13.7,
    cancellationRate: 14.2,
    leadTime: 18,
    avgLOS: 2.6,
    topSegment: 'Loisir',
    topNationality: '🇫🇷 France',
    topRoom: 'Supérieure',
    performanceScore: 92,
    trend: spark(14, 250, 60),
    trendDelta: 6.4,
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    shortName: 'A',
    color: '#FF5A5F',
    iconBg: 'bg-[#FF5A5F]',
    iconText: 'text-white',
    commissionRate: 15,
    bookings: 189,
    bookingsDelta: 11.8,
    roomNights: 445,
    adr: 283,
    revenue: 126000,
    netRevenue: 107000,
    commissionCost: 19000,
    revpar: 42,
    conversion: 19.2,
    cancellationRate: 8.1,
    leadTime: 24,
    avgLOS: 2.4,
    topSegment: 'Loisir',
    topNationality: '🇺🇸 USA',
    topRoom: 'Suite',
    performanceScore: 84,
    trend: spark(14, 120, 35),
    trendDelta: 8.1,
  },
  {
    id: 'expedia',
    name: 'Expedia',
    shortName: 'E',
    color: '#FBBC05',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    commissionRate: 18,
    bookings: 165,
    bookingsDelta: -2.4,
    roomNights: 389,
    adr: 238,
    revenue: 93000,
    netRevenue: 76000,
    commissionCost: 17000,
    revpar: 31,
    conversion: 9.7,
    cancellationRate: 18.3,
    leadTime: 21,
    avgLOS: 2.3,
    topSegment: 'Loisir',
    topNationality: '🇬🇧 UK',
    topRoom: 'Classique',
    performanceScore: 71,
    trend: spark(14, 95, 22),
    trendDelta: -3.1,
  },
  {
    id: 'hrs',
    name: 'HRS',
    shortName: 'H',
    color: '#1F2937',
    iconBg: 'bg-slate-800',
    iconText: 'text-white',
    commissionRate: 15,
    bookings: 186,
    bookingsDelta: 6.1,
    roomNights: 345,
    adr: 267,
    revenue: 92000,
    netRevenue: 78000,
    commissionCost: 14000,
    revpar: 31,
    conversion: 18.5,
    cancellationRate: 10.4,
    leadTime: 12,
    avgLOS: 1.8,
    topSegment: 'Affaires',
    topNationality: '🇩🇪 Allemagne',
    topRoom: 'Standard',
    performanceScore: 80,
    trend: spark(14, 90, 18),
    trendDelta: 4.7,
  },
  {
    id: 'direct',
    name: 'Direct',
    shortName: 'D',
    color: '#8B5CF6',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
    commissionRate: 0,
    bookings: 145,
    bookingsDelta: 9.3,
    roomNights: 363,
    adr: 230,
    revenue: 83000,
    netRevenue: 83000,
    commissionCost: 0,
    revpar: 28,
    conversion: 17.5,
    cancellationRate: 6.2,
    leadTime: 10,
    avgLOS: 2.5,
    topSegment: 'Fidèle',
    topNationality: '🇫🇷 France',
    topRoom: 'Deluxe',
    performanceScore: 95,
    trend: spark(14, 82, 18),
    trendDelta: 11.2,
  },
  {
    id: 'tbo',
    name: 'TBO.com',
    shortName: 'T',
    color: '#0EA5E9',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-700',
    commissionRate: 20,
    bookings: 122,
    bookingsDelta: -4.6,
    roomNights: 247,
    adr: 288,
    revenue: 71000,
    netRevenue: 57000,
    commissionCost: 14000,
    revpar: 23,
    conversion: 17.7,
    cancellationRate: 12.9,
    leadTime: 16,
    avgLOS: 2.0,
    topSegment: 'Affaires',
    topNationality: '🇮🇳 Inde',
    topRoom: 'Standard',
    performanceScore: 64,
    trend: spark(14, 70, 16),
    trendDelta: -2.4,
  },
  {
    id: 'agoda',
    name: 'Agoda',
    shortName: 'AG',
    color: '#5BA8FF',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
    commissionRate: 14.5,
    bookings: 114,
    bookingsDelta: -7.9,
    roomNights: 237,
    adr: 276,
    revenue: 65000,
    netRevenue: 56000,
    commissionCost: 9000,
    revpar: 21,
    conversion: 8.2,
    cancellationRate: 22.4,
    leadTime: 28,
    avgLOS: 2.1,
    topSegment: 'Loisir',
    topNationality: '🇰🇷 Corée',
    topRoom: 'Standard',
    performanceScore: 58,
    trend: spark(14, 60, 18),
    trendDelta: -6.8,
  },
  {
    id: 'lastminute',
    name: 'Lastminute',
    shortName: 'LM',
    color: '#EC4899',
    iconBg: 'bg-pink-100',
    iconText: 'text-pink-700',
    commissionRate: 18,
    bookings: 126,
    bookingsDelta: 3.2,
    roomNights: 305,
    adr: 190,
    revenue: 58000,
    netRevenue: 48000,
    commissionCost: 10000,
    revpar: 19,
    conversion: 18.4,
    cancellationRate: 11.7,
    leadTime: 5,
    avgLOS: 1.7,
    topSegment: 'Loisir',
    topNationality: '🇮🇹 Italie',
    topRoom: 'Classique',
    performanceScore: 72,
    trend: spark(14, 55, 14),
    trendDelta: 3.6,
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* UTILS                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const formatK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}K€` : `${n}€`;

const trendCellColor = (v: number) =>
  v > 0 ? 'text-emerald-600' : v < 0 ? 'text-rose-600' : 'text-slate-500';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  ytd: 'Depuis le 1er janvier',
  custom: 'Période personnalisée',
};

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function DistributionAnalytics() {
  const [period, setPeriod] = useState<PeriodKey>('30d');

  // ⚠️ Sparklines mémorisées une fois pour toutes — spark() utilise
  // Math.random() donc retourne un NOUVEAU tableau à chaque appel. Sans
  // useMemo, chaque render passait un nouvel array à PremiumKPI → Recharts
  // ChartDataContextProvider entrait en boucle infinie (« Maximum update
  // depth » + « Cannot assign to read only property »).
  const sparks = useMemo(() => ({
    revenue: spark(14, 850, 200),
    net: spark(14, 730, 180),
    commission: spark(14, 13, 2),
    bookings: spark(14, 1600, 220),
    adr: spark(14, 240, 22),
    revpar: spark(14, 95, 12),
  }), []);

  const [sortBy, setSortBy] = useState<
    'revenue' | 'netRevenue' | 'bookings' | 'commission' | 'score'
  >('revenue');
  const [compare, setCompare] = useState<'prev' | 'lastYear' | 'budget'>('prev');

  const channelData = CHANNELS;

  // Cross-module : promotions actives par canal, lu en temps réel depuis le
  // store. Mis à jour automatiquement à chaque toggle/edit côté Promotions.
  // ⚠️ useShallow OBLIGATOIRE : selectActivePromotionsByChannel retourne un
  // NOUVEL OBJET {} à chaque appel. Sans comparaison shallow, Zustand voit un
  // changement à chaque render → boucle infinie React #185 / « Maximum update
  // depth ». C'était la cause racine du crash sur Distribution & OTA.
  const activePromosByChannel = usePromotionsStore(useShallow(selectActivePromotionsByChannel));

  // Sources de données réelles (rateCalendar + Lighthouse) pour les totaux
  // globaux. La répartition par canal reste démonstrative car aucune donnée
  // de réservation par canal n'est encore disponible dans le PMS.
  const roomTypes = useRateCalendarStore((s) => s.roomTypes);
  const lighthouseData = useLighthouseStore((s) => s.importData);
  const dataStatus = useMemo(
    () => getDataSourceStatus({ roomTypes, lighthouse: lighthouseData }),
    [roomTypes, lighthouseData]
  );
  const realTotals = useMemo(() => computeRealTotals(roomTypes), [roomTypes]);

  const sorted = useMemo(() => {
    const arr = [...channelData];
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.revenue - a.revenue;
        case 'netRevenue':
          return b.netRevenue - a.netRevenue;
        case 'bookings':
          return b.bookings - a.bookings;
        case 'commission':
          return b.commissionRate - a.commissionRate;
        case 'score':
          return b.performanceScore - a.performanceScore;
      }
    });
    return arr;
  }, [channelData, sortBy]);

  /* KPIs globaux — bascule sur les totaux RÉELS quand rateCalendar a chargé */
  const totals = useMemo(() => {
    // Totaux démonstratifs (somme du mock CHANNELS) — toujours calculés pour
    // garantir une UI cohérente même sans connexion DB.
    const mockRevenue = channelData.reduce((s, c) => s + c.revenue, 0);
    const mockNet = channelData.reduce((s, c) => s + c.netRevenue, 0);
    const mockCommission = channelData.reduce((s, c) => s + c.commissionCost, 0);
    const mockBookings = channelData.reduce((s, c) => s + c.bookings, 0);
    const mockNights = channelData.reduce((s, c) => s + c.roomNights, 0);
    const mockADR = Math.round(mockRevenue / Math.max(1, mockNights));
    const mockRevPAR = Math.round(
      channelData.reduce((s, c) => s + c.revpar, 0) / channelData.length
    );

    // Si rateCalendar contient des données réelles, on remplace les agrégats
    // globaux par les valeurs calculées sur les ventes effectives.
    const totalRevenue = realTotals?.totalRevenue ?? mockRevenue;
    const totalBookings = realTotals?.totalBookings ?? mockBookings;
    const totalNights = realTotals?.totalRoomNights ?? mockNights;
    const avgADR = realTotals?.avgADR ?? mockADR;
    const avgRevPAR = realTotals?.avgRevPAR ?? mockRevPAR;

    // Commission moyenne pondérée — toujours dérivée du mix de canaux
    // (faute de mieux), mais appliquée au revenu réel.
    const mockCommissionPct = (mockCommission / Math.max(1, mockRevenue)) * 100;
    const totalCommission = realTotals
      ? Math.round((totalRevenue * mockCommissionPct) / 100)
      : mockCommission;
    const totalNet = totalRevenue - totalCommission;

    const avgConv = (
      channelData.reduce((s, c) => s + c.conversion, 0) / channelData.length
    ).toFixed(1);
    const avgCancel = (
      channelData.reduce((s, c) => s + c.cancellationRate, 0) / channelData.length
    ).toFixed(1);
    const commissionPct = (totalCommission / Math.max(1, totalRevenue)) * 100;
    const direct = channelData.find((c) => c.id === 'direct');
    const directShare = ((direct?.revenue ?? 0) / Math.max(1, mockRevenue)) * 100;
    const otaShare = 100 - directShare;
    return {
      totalRevenue,
      totalNet,
      totalCommission,
      totalBookings,
      totalNights,
      avgADR,
      avgRevPAR,
      avgConv,
      avgCancel,
      commissionPct,
      directShare,
      otaShare,
    };
  }, [channelData, realTotals]);

  /* derived */
  const top3 = sorted.slice(0, 3);

  const mixData = useMemo(
    () =>
      channelData.map((c) => ({
        name: c.name,
        value: c.revenue,
        color: c.color,
      })),
    [channelData]
  );

  const dependencyData = useMemo(() => {
    const sortedRev = [...channelData].sort((a, b) => b.revenue - a.revenue);
    const topOTA = sortedRev.find((c) => c.id !== 'direct');
    const direct = channelData.find((c) => c.id === 'direct');
    return {
      topOTAName: topOTA?.name ?? '',
      topOTAShare: ((topOTA?.revenue ?? 0) / totals.totalRevenue) * 100,
      directShare: ((direct?.revenue ?? 0) / totals.totalRevenue) * 100,
    };
  }, [channelData, totals]);

  /* build export payload — shared by Excel + PDF handlers */
  const buildExportInput = (): DistributionExportInput => ({
    period: PERIOD_LABELS[period],
    totals: {
      revenue: totals.totalRevenue,
      netRevenue: totals.totalNet,
      commission: totals.totalCommission,
      bookings: totals.totalBookings,
      adr: totals.avgADR,
      revpar: totals.avgRevPAR,
    },
    rows: sorted.map((c) => ({
      canal: c.name,
      bookings: c.bookings,
      nights: c.roomNights,
      adr: c.adr,
      revenue: c.revenue,
      commissionRate: c.commissionRate,
      commissionCost: c.commissionCost,
      netRevenue: c.netRevenue,
      revpar: c.revpar,
      conversion: c.conversion,
      cancellation: c.cancellationRate,
      score: c.performanceScore,
    })),
  });

  /* alerts */
  const alerts = useMemo(() => {
    const arr: { tone: 'warn' | 'critical' | 'info'; title: string; desc: string }[] = [];
    if (dependencyData.topOTAShare > 25)
      arr.push({
        tone: 'critical',
        title: `Forte dépendance ${dependencyData.topOTAName}`,
        desc: `${dependencyData.topOTAName} représente ${dependencyData.topOTAShare.toFixed(1)}% du CA. Diversifier le mix.`,
      });
    const highComm = channelData.find((c) => c.commissionRate > 17);
    if (highComm)
      arr.push({
        tone: 'warn',
        title: `Commission élevée — ${highComm.name}`,
        desc: `Commission ${highComm.commissionRate}% — supérieure à la moyenne. Renégocier ou réduire l'exposition.`,
      });
    const highCancel = channelData.find((c) => c.cancellationRate > 20);
    if (highCancel)
      arr.push({
        tone: 'warn',
        title: `Annulations ${highCancel.name}`,
        desc: `Taux d'annulation ${highCancel.cancellationRate}% — basculer sur tarif non-remb. recommandé.`,
      });
    if (dependencyData.directShare < 15)
      arr.push({
        tone: 'info',
        title: 'Sous-performance canal direct',
        desc: `Direct = ${dependencyData.directShare.toFixed(1)}% du CA. Pousser une campagne fidélité.`,
      });
    return arr.slice(0, 4);
  }, [channelData, dependencyData]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
      <div className="space-y-6 px-6 py-5">
        <PremiumHeader
          icon={Network}
          title="Distribution & OTA"
          subtitle="Cockpit de pilotage multicanal — performance, commissions et rentabilité"
          period={period}
          onPeriodChange={setPeriod}
          onExportExcel={() => exportDistributionExcel(buildExportInput())}
          onExportPDF={() => exportDistributionPDF(buildExportInput())}
          rightSlot={
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
              <span className="px-2 text-[11px] font-semibold text-slate-500">Comparer :</span>
              {(
                [
                  { id: 'prev', label: 'Préc.' },
                  { id: 'lastYear', label: 'N-1' },
                  { id: 'budget', label: 'Budget' },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setCompare(o.id)}
                  className={cn(
                    'h-7 rounded-lg px-2 text-[11px] font-semibold transition',
                    compare === o.id
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          }
        />

        {/* Bannière source de données */}
        <DataSourceBanner status={dataStatus} />

        {/* KPI ROW */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <PremiumKPI
            label="CA Total"
            value={`${Math.round(totals.totalRevenue / 1000)}K`}
            unit="€"
            icon={DollarSign}
            tone="emerald"
            delta={4.2}
            sparkline={sparks.revenue}
            deltaLabel="vs préc."
            index={0}
          />
          <PremiumKPI
            label="CA Net"
            value={`${Math.round(totals.totalNet / 1000)}K`}
            unit="€"
            icon={Wallet}
            tone="violet"
            delta={2.8}
            sparkline={sparks.net}
            deltaLabel="après commission"
            index={1}
          />
          <PremiumKPI
            label="Commission moy."
            value={`${totals.commissionPct.toFixed(1)}`}
            unit="%"
            icon={BadgePercent}
            tone="amber"
            delta={-0.4}
            invertDelta
            sparkline={sparks.commission}
            deltaLabel={`${Math.round(totals.totalCommission / 1000)}K€ coût`}
            index={2}
          />
          <PremiumKPI
            label="Réservations"
            value={totals.totalBookings.toLocaleString('fr-FR')}
            icon={Users}
            tone="sky"
            delta={3.1}
            sparkline={sparks.bookings}
            deltaLabel="vs préc."
            index={3}
          />
          <PremiumKPI
            label="ADR moyen"
            value={`${totals.avgADR}`}
            unit="€"
            icon={Calendar}
            tone="indigo"
            delta={2.6}
            sparkline={sparks.adr}
            deltaLabel="vs préc."
            index={4}
          />
          <PremiumKPI
            label="RevPAR"
            value={`${totals.avgRevPAR}`}
            unit="€"
            icon={Gauge}
            tone="emerald"
            delta={1.4}
            sparkline={sparks.revpar}
            deltaLabel="vs préc."
            index={5}
          />
        </div>

        {/* SECONDARY KPIS — share + perf */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Direct vs OTA */}
          <div className="lg:col-span-4">
            <DirectVsOTACard
              direct={totals.directShare}
              ota={totals.otaShare}
              cancel={parseFloat(totals.avgCancel)}
              conv={parseFloat(totals.avgConv)}
            />
          </div>

          {/* TOP 3 channels */}
          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-8">
            {top3.map((c, i) => (
              <TopChannelCard
                key={c.id}
                channel={c}
                rank={i + 1}
                activePromosCount={activePromosByChannel[c.name] ?? 0}
              />
            ))}
          </div>
        </div>

        {/* ALERTS */}
        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-rose-50/40 p-4 shadow-sm"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-amber-900">Alertes Distribution</h3>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {alerts.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-900/70">
                    Le moteur surveille en continu vos canaux : commissions, dépendance, conversion
                    et annulations.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {alerts.map((a, i) => (
                      <AlertCard key={i} {...a} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABLE + sort */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <BarChart3 className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Performance détaillée par canal
                </h3>
                <p className="text-[11px] text-slate-500">
                  {channelData.length} canaux analysés — tri dynamique
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Trier par
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-violet-400 focus:outline-none"
              >
                <option value="revenue">CA Total</option>
                <option value="netRevenue">CA Net</option>
                <option value="bookings">Réservations</option>
                <option value="commission">Commission</option>
                <option value="score">Score perf.</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <Th>Canal</Th>
                  <Th className="text-right">Résa</Th>
                  <Th className="text-right">Nuitées</Th>
                  <Th className="text-right">ADR</Th>
                  <Th className="text-right">CA Total</Th>
                  <Th className="text-right">Comm %</Th>
                  <Th className="text-right">Coût comm.</Th>
                  <Th className="text-right">CA Net</Th>
                  <Th className="text-right">RevPAR</Th>
                  <Th className="text-right">Conv %</Th>
                  <Th className="text-right">Annulation</Th>
                  <Th className="text-right">Lead time</Th>
                  <Th>Score</Th>
                  <Th>Tendance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((c) => (
                  <ChannelRow key={c.id} channel={c} totals={totals} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADVANCED ANALYTICS */}
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <MixDistributionCard data={mixData} />
          </div>
          <div className="xl:col-span-4">
            <DependencyCard
              data={mixData}
              total={totals.totalRevenue}
              topOTA={dependencyData.topOTAName}
              topShare={dependencyData.topOTAShare}
              directShare={dependencyData.directShare}
            />
          </div>
          <div className="xl:col-span-3">
            <CommissionFunnelCard
              gross={totals.totalRevenue}
              commission={totals.totalCommission}
              net={totals.totalNet}
            />
          </div>
        </div>

        {/* AI RECOMMENDATIONS */}
        <AIRecommendationsCard channels={channelData} totals={totals} />
      </div>
    </div>
  );
}

export default DistributionAnalytics;

/* ────────────────────────────────────────────────────────────────────────── */
/* SMALL UI                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <th className={cn('px-3 py-2.5 text-left font-semibold', className)}>{children}</th>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* TOP CHANNEL CARDS                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const TopChannelCard: React.FC<{
  channel: Channel;
  rank: number;
  activePromosCount?: number;
}> = ({ channel, rank, activePromosCount = 0 }) => {
  // useMemo obligatoire — cf. note dans ChannelRow.trendData
  const data = useMemo(
    () => channel.trend.map((v, i) => ({ i, v })),
    [channel.trend],
  );
  const positive = channel.trendDelta >= 0;
  const gradientId = `topchan-${channel.id}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: rank * 0.04 }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        aria-hidden
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-[0.10] blur-2xl"
        style={{ background: channel.color }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold',
              channel.iconBg,
              channel.iconText
            )}
          >
            {channel.shortName}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{channel.name}</div>
            <div className="text-[11px] text-slate-500">Commission {channel.commissionRate}%</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {activePromosCount > 0 && (
            <span
              title={`${activePromosCount} promotion(s) active(s) sur ${channel.name}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
            >
              <Sparkles className="h-3 w-3" />
              {activePromosCount} promo
            </span>
          )}
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            #{rank}
          </span>
        </div>
      </div>

      <div className="relative mt-3 flex items-baseline gap-2">
        <span className="text-[26px] font-bold tabular-nums" style={{ color: channel.color }}>
          {formatK(channel.revenue)}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
            positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          )}
        >
          {positive ? '+' : ''}
          {channel.trendDelta.toFixed(1)}%
        </span>
      </div>

      <div className="relative mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{channel.bookings} résa.</span>
        <span>ADR {channel.adr}€</span>
        <span>RevPAR {channel.revpar}€</span>
      </div>

      <div className="relative -mx-1 mt-2 h-14">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={channel.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={channel.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={channel.color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* DIRECT VS OTA                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const DirectVsOTACard: React.FC<{
  direct: number;
  ota: number;
  cancel: number;
  conv: number;
}> = ({ direct, ota, cancel, conv }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
  >
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Compass className="h-3.5 w-3.5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Direct vs OTA</h3>
        <p className="text-[11px] text-slate-500">Part de chiffre d'affaires</p>
      </div>
    </div>

    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-semibold text-violet-700">Direct {direct.toFixed(1)}%</span>
        <span className="font-semibold text-slate-700">OTA {ota.toFixed(1)}%</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${direct}%` }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-r from-violet-400 to-violet-600"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ota}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gradient-to-r from-slate-300 to-slate-400"
        />
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Conversion moy.
        </div>
        <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{conv}%</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Annulation moy.
        </div>
        <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{cancel}%</div>
      </div>
    </div>
  </motion.div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* CHANNEL TABLE ROW                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const ChannelRow: React.FC<{
  channel: Channel;
  totals: { totalRevenue: number };
}> = ({ channel, totals }) => {
  // ⚠️ IMPORTANT : useMemo OBLIGATOIRE — sinon `channel.trend.map(...)` crée
  // un NOUVEAU tableau à chaque render. Recharts utilise useSyncExternalStore
  // interne et son getSnapshot retourne le data array. Un nouvel array à
  // chaque render → React voit un changement → re-render → boucle infinie
  // qui fait crasher la page Distribution & OTA avec « Maximum update depth ».
  const trendData = useMemo(
    () => channel.trend.map((v, i) => ({ i, v })),
    [channel.trend],
  );
  const positive = channel.trendDelta >= 0;
  const commTone =
    channel.commissionRate === 0
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : channel.commissionRate <= 15
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-rose-50 text-rose-700 ring-rose-200';

  return (
    <motion.tr
      whileHover={{ backgroundColor: 'rgba(248,250,252,1)' }}
      className="text-slate-700"
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold',
              channel.iconBg,
              channel.iconText
            )}
          >
            {channel.shortName}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{channel.name}</div>
            <div className="text-[11px] text-slate-500">
              {((channel.revenue / totals.totalRevenue) * 100).toFixed(1)}% du CA
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{channel.bookings}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{channel.roomNights}</td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-semibold text-sky-700 tabular-nums">{channel.adr}€</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-bold text-emerald-700 tabular-nums">{formatK(channel.revenue)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            commTone
          )}
        >
          {channel.commissionRate}%
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-rose-600 tabular-nums">
          {channel.commissionCost > 0 ? formatK(channel.commissionCost) : '—'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-bold text-slate-900 tabular-nums">{formatK(channel.netRevenue)}</span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{channel.revpar}€</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span
          className={cn(
            channel.conversion >= 15
              ? 'text-emerald-600'
              : channel.conversion >= 10
                ? 'text-slate-700'
                : 'text-amber-600'
          )}
        >
          {channel.conversion.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span
          className={cn(
            channel.cancellationRate >= 20
              ? 'text-rose-600'
              : channel.cancellationRate >= 15
                ? 'text-amber-600'
                : 'text-slate-600'
          )}
        >
          {channel.cancellationRate.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{channel.leadTime}j</td>
      <td className="px-3 py-2.5">
        <ScoreBar value={channel.performanceScore} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-20">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={channel.color}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <span className={cn('text-[11px] font-semibold', trendCellColor(channel.trendDelta))}>
            {positive ? '+' : ''}
            {channel.trendDelta.toFixed(1)}%
          </span>
        </div>
      </td>
    </motion.tr>
  );
};

const ScoreBar: React.FC<{ value: number }> = ({ value }) => {
  const tone =
    value >= 85
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : value >= 70
        ? 'bg-gradient-to-r from-sky-400 to-sky-600'
        : value >= 55
          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
          : 'bg-gradient-to-r from-rose-400 to-rose-500';
  const text =
    value >= 85
      ? 'text-emerald-700'
      : value >= 70
        ? 'text-sky-700'
        : value >= 55
          ? 'text-amber-700'
          : 'text-rose-700';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6 }}
          className={cn('h-full rounded-full', tone)}
        />
      </div>
      <span className={cn('text-[11px] font-bold tabular-nums', text)}>{value}</span>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* MIX DISTRIBUTION                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Donut SVG natif — remplacement de Recharts PieChart.
 * Recharts 3 + React 19 strict mode produit une boucle infinie sur le
 * ChartDataContextProvider interne. Le donut SVG est immutable et stable.
 */
const DonutSvg: React.FC<{
  data: { name: string; value: number; color: string }[];
  total: number;
  size: number;
}> = ({ data, total, size }) => {
  const r = size / 2;
  const strokeWidth = 22;
  const inner = r - strokeWidth / 2;
  const circumference = 2 * Math.PI * inner;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r} cy={r} r={inner} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
      {data.map((d, i) => {
        const pct = total > 0 ? d.value / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const dashArray = `${dash} ${gap}`;
        const rotation = (offset / circumference) * 360 - 90;
        offset += dash;
        return (
          <circle
            key={`${d.name}-${i}`}
            cx={r}
            cy={r}
            r={inner}
            fill="none"
            stroke={d.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            transform={`rotate(${rotation} ${r} ${r})`}
          />
        );
      })}
    </svg>
  );
};

const MixDistributionCard: React.FC<{
  data: { name: string; value: number; color: string }[];
}> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  // ⚠️ Clone profond pour Recharts 3 + React 19 StrictMode : Recharts mute
  // les objets data en interne (ajout de `fill`, `cornerRadius`, etc.).
  // En strict mode, le 2e render reçoit des objets frozen → boucle infinie.
  // Le clone garantit que chaque render reçoit des objets mutables propres.
  const chartData = useMemo(
    () => data.map((d) => ({ ...d })),
    [data],
  );
  return (
    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <PieChartIcon className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Mix distribution</h3>
          <p className="text-[11px] text-slate-500">Répartition du CA par canal</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
        {/* Donut SVG natif au lieu de Recharts PieChart : Recharts 3 a un bug
            de boucle infinie (Maximum update depth / React #185) en
            combinaison avec React 19 strict mode. Le donut natif est plus
            rapide, plus léger et 100% sous contrôle. */}
        <div className="relative h-44 flex items-center justify-center">
          <DonutSvg data={chartData} total={total} size={160} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-900 tabular-nums">{formatK(total)}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">CA total</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {data.slice(0, 8).map((d) => {
            const pct = ((d.value / total) * 100).toFixed(1);
            return (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="truncate text-slate-700">{d.name}</span>
                <span className="ml-auto font-semibold text-slate-500 tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* DEPENDENCY                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const DependencyCard: React.FC<{
  data: { name: string; value: number; color: string }[];
  total: number;
  topOTA: string;
  topShare: number;
  directShare: number;
}> = ({ data, total, topOTA, topShare, directShare }) => {
  const dependencyScore = Math.round(100 - Math.min(100, topShare * 1.5));
  const tone =
    dependencyScore >= 70
      ? { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' }
      : dependencyScore >= 50
        ? { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' }
        : { text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200' };

  return (
    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Plug className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Dépendance OTA</h3>
          <p className="text-[11px] text-slate-500">Diversification du portefeuille</p>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 tabular-nums">{dependencyScore}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            tone.bg,
            tone.text,
            tone.ring
          )}
        >
          / 100 score sain
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {topOTA} pèse <strong className="text-slate-700">{topShare.toFixed(1)}%</strong> du CA
        (seuil sain {'<'} 30%). Direct ≈ <strong className="text-slate-700">{directShare.toFixed(1)}%</strong>.
      </p>

      <div className="mt-4 space-y-2">
        {/* ⚠️ [...data] OBLIGATOIRE : data.sort() mute le tableau reçu en
            prop, ce qui :
            - throw « Cannot assign to read only property '0' » en strict mode
            - ou trigger une boucle infinie de re-render via Recharts
            qui partage le même array. Clone avant tout tri. */}
        {[...data]
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
          .map((d) => {
            const pct = (d.value / total) * 100;
            return (
              <div key={d.name}>
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700">{d.name}</span>
                  <span className="font-semibold tabular-nums text-slate-500">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ background: d.color }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* COMMISSION FUNNEL                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const CommissionFunnelCard: React.FC<{
  gross: number;
  commission: number;
  net: number;
}> = ({ gross, commission, net }) => {
  const commPct = (commission / gross) * 100;
  return (
    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <BadgePercent className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Funnel commissions</h3>
          <p className="text-[11px] text-slate-500">Du CA brut au CA net</p>
        </div>
      </div>

      <FunnelRow
        label="CA brut"
        value={gross}
        pct={100}
        color="from-violet-400 to-violet-600"
        sub="Total ventes"
      />
      <FunnelRow
        label="Commissions OTA"
        value={commission}
        pct={commPct}
        color="from-amber-300 to-amber-500"
        sub={`${commPct.toFixed(1)}% du brut`}
        deductive
      />
      <FunnelRow
        label="CA net"
        value={net}
        pct={(net / gross) * 100}
        color="from-emerald-400 to-emerald-600"
        sub="Après commissions"
        emphasize
      />
    </div>
  );
};

const FunnelRow: React.FC<{
  label: string;
  value: number;
  pct: number;
  color: string;
  sub: string;
  deductive?: boolean;
  emphasize?: boolean;
}> = ({ label, value, pct, color, sub, deductive, emphasize }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex items-center justify-between text-xs">
      <div className="font-medium text-slate-700">{label}</div>
      <div
        className={cn(
          'font-semibold tabular-nums',
          deductive ? 'text-rose-600' : emphasize ? 'text-emerald-700' : 'text-slate-900'
        )}
      >
        {deductive ? '−' : ''}
        {formatK(value)}
      </div>
    </div>
    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6 }}
        className={cn('h-full rounded-full bg-gradient-to-r', color)}
      />
    </div>
    <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* ALERTS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const AlertCard: React.FC<{ tone: 'warn' | 'critical' | 'info'; title: string; desc: string }> = ({
  tone,
  title,
  desc,
}) => {
  const palette =
    tone === 'critical'
      ? { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', icon: 'text-rose-500' }
      : tone === 'warn'
        ? { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-200', icon: 'text-amber-500' }
        : { bg: 'bg-sky-50', text: 'text-sky-800', ring: 'ring-sky-200', icon: 'text-sky-500' };
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm ring-1 ring-inset',
        palette.ring
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn('mt-0.5', palette.icon)}>
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <div className={cn('text-sm font-semibold', palette.text)}>{title}</div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{desc}</p>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* AI RECOMMENDATIONS                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const AIRecommendationsCard: React.FC<{
  channels: Channel[];
  totals: { totalRevenue: number; commissionPct: number; directShare: number };
}> = ({ channels, totals }) => {
  const worstCommission = [...channels].sort((a, b) => b.commissionRate - a.commissionRate)[0];
  const bestPerf = [...channels].sort((a, b) => b.performanceScore - a.performanceScore)[0];
  const weakest = [...channels].sort((a, b) => a.performanceScore - b.performanceScore)[0];

  const recos = [
    {
      tone: 'violet' as const,
      icon: Sparkles,
      title: `Pousser le direct (${totals.directShare.toFixed(1)}% du CA)`,
      desc: 'Lancer une campagne fidélité + Mobile Rate exclusif → réduire la commission moyenne pondérée de 1.4 pt.',
      cta: 'Créer la campagne',
    },
    {
      tone: 'rose' as const,
      icon: TrendingDown,
      title: `Renégocier ${worstCommission.name}`,
      desc: `Commission ${worstCommission.commissionRate}% — coût ${formatK(worstCommission.commissionCost)}. Tester une réduction d'exposition de 20%.`,
      cta: 'Voir le plan',
    },
    {
      tone: 'emerald' as const,
      icon: ArrowUpRight,
      title: `Capitaliser sur ${bestPerf.name}`,
      desc: `Score performance ${bestPerf.performanceScore}/100. Augmenter l'allocation et tester un Genius-like.`,
      cta: 'Augmenter exposition',
    },
    {
      tone: 'amber' as const,
      icon: Target,
      title: `Sous-performance ${weakest.name}`,
      desc: `Score ${weakest.performanceScore}/100. Évaluer la fermeture temporaire ou un retargeting OTA.`,
      cta: 'Optimiser',
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-sky-50/40 p-5 shadow-sm">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/25">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Recommandations IA — optimisation du mix
            </h3>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              Flowtym RMS
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Suggestions générées à partir du mix actuel, des commissions et des scores de
            performance par canal.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recos.map((r) => (
              <RecoCard key={r.title} {...r} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RecoCard: React.FC<{
  tone: 'violet' | 'rose' | 'emerald' | 'amber';
  icon: React.ElementType;
  title: string;
  desc: string;
  cta: string;
}> = ({ tone, icon: Icon, title, desc, cta }) => {
  const palette =
    tone === 'violet'
      ? { iconBg: 'bg-violet-100', iconText: 'text-violet-600', btn: 'bg-violet-600 hover:bg-violet-700' }
      : tone === 'rose'
        ? { iconBg: 'bg-rose-100', iconText: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' }
        : tone === 'emerald'
          ? {
              iconBg: 'bg-emerald-100',
              iconText: 'text-emerald-600',
              btn: 'bg-emerald-600 hover:bg-emerald-700',
            }
          : {
              iconBg: 'bg-amber-100',
              iconText: 'text-amber-600',
              btn: 'bg-amber-600 hover:bg-amber-700',
            };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', palette.iconBg, palette.iconText)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-600">{desc}</p>
        </div>
      </div>
      <button
        className={cn(
          'mt-3 inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white shadow-sm transition',
          palette.btn
        )}
      >
        {cta}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* DATA SOURCE BANNER                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const DataSourceBanner: React.FC<{
  status: ReturnType<typeof getDataSourceStatus>;
}> = ({ status }) => {
  if (status.isLive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 p-3 shadow-sm"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <Database className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-emerald-900">
              Totaux globaux calculés sur ventes réelles
            </p>
            {status.periodLabel && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {status.periodLabel}
              </span>
            )}
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {status.daysCovered} jour(s)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-emerald-900/70">
            CA, réservations, ADR et RevPAR proviennent du calendrier tarifaire.
            La répartition par canal reste démonstrative jusqu'à l'intégration
            d'un Channel Manager source.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
        <Info className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">
          Données de démonstration
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Aucune donnée de réservation chargée. Les valeurs affichées proviennent
          d'un jeu de démonstration. Une fois le calendrier tarifaire alimenté,
          les KPIs globaux se calculeront sur les ventes réelles.
        </p>
      </div>
    </motion.div>
  );
};
