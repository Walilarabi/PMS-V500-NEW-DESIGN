/**
 * FLOWTYM PROMOTIONS — Premium 2026
 *
 * Cockpit premium pour la gestion des campagnes promotionnelles :
 * KPIs sparklines, tableau ultra lisible, alertes intelligentes,
 * analytics (impact / répartition / heatmap calendrier), modal détaillée.
 *
 * Pensé pour : Revenue Manager, Directeur d'hôtel, Groupe multi-établissements.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  BadgePercent,
  BarChart3,
  Calendar,
  CalendarRange,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  Eye,
  Flame,
  Globe,
  LineChart as LineChartIcon,
  MoreHorizontal,
  Pause,
  PauseCircle,
  PieChart as PieChartIcon,
  Play,
  PlayCircle,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  exportPromotionsExcel,
  exportPromotionsPDF,
  type PromotionsExportInput,
} from '@/src/services/revenueExport.service';
import {
  usePromotionsStore,
  type Promotion,
  type PromoAlert,
  type PromoPriority,
  type PromoStatus,
  type PromoType,
} from '@/src/store/promotionsStore';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  ytd: 'Depuis le 1er janvier',
  custom: 'Période personnalisée',
};

/* Types Promotion/PromoStatus/PromoType/PromoAlert/PromoPriority sont
 * désormais centralisés dans @/src/store/promotionsStore — importés en tête. */

/** Sparkline synthétique pour les KPIs agrégés (cosmétique uniquement). */
const spark = (n: number, base = 50, jitter = 25): number[] =>
  Array.from({ length: n }, (_, i) =>
    Math.max(
      2,
      Math.round(base + Math.sin(i / 1.4) * jitter + Math.sin(i * 3.7 + base) * jitter * 0.3)
    )
  );


/* ────────────────────────────────────────────────────────────────────────── */
/* DESIGN TOKENS                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_META: Record<
  PromoStatus,
  { label: string; dot: string; text: string; bg: string; ring: string }
> = {
  active: {
    label: 'Active',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
  },
  scheduled: {
    label: 'Programmée',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    ring: 'ring-violet-200',
  },
  paused: {
    label: 'En pause',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  draft: {
    label: 'Brouillon',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    bg: 'bg-slate-100',
    ring: 'ring-slate-200',
  },
  ended: {
    label: 'Terminée',
    dot: 'bg-slate-400',
    text: 'text-slate-500',
    bg: 'bg-slate-100',
    ring: 'ring-slate-200',
  },
};

const TYPE_PALETTE: Record<PromoType, { text: string; bg: string; ring: string }> = {
  mobile_rate: { text: 'text-sky-700', bg: 'bg-sky-50', ring: 'ring-sky-200' },
  early_booker: { text: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200' },
  last_minute: { text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200' },
  long_stay: { text: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
  non_refundable: { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  genius: { text: 'text-fuchsia-700', bg: 'bg-fuchsia-50', ring: 'ring-fuchsia-200' },
  romantic: { text: 'text-pink-700', bg: 'bg-pink-50', ring: 'ring-pink-200' },
  family: { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  free_breakfast: { text: 'text-teal-700', bg: 'bg-teal-50', ring: 'ring-teal-200' },
  secret: { text: 'text-slate-700', bg: 'bg-slate-100', ring: 'ring-slate-200' },
  package: { text: 'text-cyan-700', bg: 'bg-cyan-50', ring: 'ring-cyan-200' },
  corporate: { text: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  flash: { text: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200' },
  weekend: { text: 'text-lime-700', bg: 'bg-lime-50', ring: 'ring-lime-200' },
  seasonal: { text: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200' },
};

const TYPE_FILTERS: { id: PromoType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous les types' },
  { id: 'early_booker', label: 'Early Booker' },
  { id: 'last_minute', label: 'Last Minute' },
  { id: 'long_stay', label: 'Long Stay' },
  { id: 'mobile_rate', label: 'Mobile Rate' },
  { id: 'genius', label: 'Genius' },
  { id: 'non_refundable', label: 'Non Refundable' },
  { id: 'family', label: 'Famille' },
  { id: 'free_breakfast', label: 'Petit Déj.' },
  { id: 'secret', label: 'Secret' },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* UTILS                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const formatK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}K€` : `${n}€`;

const formatDateFR = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((+new Date(b) - +new Date(a)) / (1000 * 60 * 60 * 24)));

const daysFromNow = (iso: string) =>
  Math.round((+new Date(iso) - Date.now()) / (1000 * 60 * 60 * 24));

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function PromotionsCompact() {
  // Source de vérité = store persisté + bus d'événements RMS
  const promotions = usePromotionsStore((s) => s.promotions);
  const storeToggleStatus = usePromotionsStore((s) => s.toggleStatus);
  const storeDuplicate = usePromotionsStore((s) => s.duplicatePromotion);
  const storeDelete = usePromotionsStore((s) => s.deletePromotion);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PromoType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PromoStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const allChannels = useMemo(() => {
    const set = new Set<string>();
    promotions.forEach((p) => p.channels.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [promotions]);

  const filtered = useMemo(() => {
    return promotions.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (channelFilter !== 'all' && !p.channels.includes(channelFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.typeLabel.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q) &&
          !(p.code?.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
  }, [promotions, search, statusFilter, typeFilter, channelFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => setPage(1), [search, statusFilter, typeFilter, channelFilter]);

  /* KPIs */
  const activeCount = promotions.filter((p) => p.status === 'active').length;
  const totalBookings = promotions.reduce((s, p) => s + p.bookings, 0);
  const totalRevenue = promotions.reduce((s, p) => s + p.revenue, 0);
  const avgDiscount =
    promotions
      .filter((p) => p.discountValue > 0)
      .reduce((s, p) => s + p.discountValue, 0) /
    Math.max(1, promotions.filter((p) => p.discountValue > 0).length);
  const weightedRoi =
    promotions.reduce((s, p) => s + p.roi * p.revenue, 0) / Math.max(1, totalRevenue);

  const intelligentAlerts = promotions.filter(
    (p) =>
      (p.status === 'draft' || p.status === 'paused' || p.status === 'scheduled') &&
      p.alert?.priority === 'high'
  );

  /* analytics data */
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    promotions.forEach((p) =>
      map.set(p.typeLabel, (map.get(p.typeLabel) ?? 0) + (p.bookings || 1))
    );
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [promotions]);

  const channelPerf = useMemo(() => {
    const map = new Map<string, number>();
    promotions.forEach((p) => {
      const share = p.bookings / Math.max(1, p.channels.length);
      p.channels.forEach((c) => map.set(c, (map.get(c) ?? 0) + share));
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [promotions]);

  const impactData = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const base = 60 + Math.sin(i / 1.3) * 8;
        const jitter = Math.sin(i * 7.3) * 2; // deterministic visual jitter
        return {
          day: `J${i - 13}`,
          avant: Math.round(base + jitter),
          apres: Math.round(base + 12 + jitter * 0.5),
        };
      }),
    []
  );

  /* handlers — délégués au store, qui émet les événements RMS */
  const toggleStatus = (id: string) => storeToggleStatus(id);
  const duplicatePromo = (p: Promotion) => storeDuplicate(p.id);
  const deletePromo = (id: string) => {
    storeDelete(id);
    setSelectedPromo(null);
  };

  /* build export payload — shared by Excel + PDF handlers */
  const buildExportInput = (): PromotionsExportInput => ({
    period: PERIOD_LABELS[period],
    totals: {
      active: activeCount,
      total: promotions.length,
      bookings: totalBookings,
      revenue: totalRevenue,
      avgDiscount,
      roi: weightedRoi,
    },
    rows: filtered.map((p) => ({
      status: STATUS_META[p.status].label,
      name: p.name,
      description: p.description,
      type: p.typeLabel,
      discount: p.discount,
      channels: p.channels.join(', '),
      startDate: p.startDate,
      endDate: p.endDate,
      bookings: p.bookings,
      revenue: p.revenue,
      roi: p.roi,
      conversion: p.conversion,
    })),
  });

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-slate-50 to-white">
      <div className="space-y-6 px-6 py-5">
        <PremiumHeader
          icon={Tag}
          title="Promotions"
          subtitle="Gestion des campagnes et alertes d'activation intelligentes"
          period={period}
          onPeriodChange={setPeriod}
          onExportExcel={() => exportPromotionsExcel(buildExportInput())}
          onExportPDF={() => exportPromotionsPDF(buildExportInput())}
          actions={[
            {
              label: 'Nouvelle promotion',
              icon: Plus,
              onClick: () => setShowCreate(true),
            },
          ]}
        />

        {/* KPI ROW */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <PremiumKPI
            label="Promotions actives"
            value={`${activeCount}`}
            unit={`/ ${promotions.length}`}
            icon={Sparkles}
            tone="violet"
            delta={2}
            deltaLabel="vs période préc."
            sparkline={spark(14, 6, 3)}
            index={0}
          />
          <PremiumKPI
            label="Réservations générées"
            value={totalBookings.toLocaleString('fr-FR')}
            icon={Users}
            tone="sky"
            delta={18.6}
            deltaLabel="vs période préc."
            sparkline={spark(14, 100, 30)}
            index={1}
          />
          <PremiumKPI
            label="Revenu généré"
            value={`${Math.round(totalRevenue / 1000)}K`}
            unit="€"
            icon={Wallet}
            tone="emerald"
            delta={21.3}
            deltaLabel="vs période préc."
            sparkline={spark(14, 110, 28)}
            index={2}
          />
          <PremiumKPI
            label="Réduction moyenne"
            value={`${avgDiscount.toFixed(1)}`}
            unit="%"
            icon={BadgePercent}
            tone="amber"
            delta={-1.2}
            invertDelta
            deltaLabel="vs période préc."
            sparkline={spark(14, 17, 4)}
            index={3}
          />
          <PremiumKPI
            label="ROI moyen"
            value={`${weightedRoi.toFixed(1)}`}
            unit="x"
            icon={TrendingUp}
            tone="indigo"
            delta={0.6}
            deltaLabel="vs période préc."
            sparkline={spark(14, 40, 8)}
            index={4}
          />
        </div>

        {/* INTELLIGENT ALERTS */}
        <AnimatePresence>
          {intelligentAlerts.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-violet-50/40 p-4 shadow-sm"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-amber-900">
                      Recommandations IA — promotions à activer
                    </h3>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {intelligentAlerts.length} suggestion{intelligentAlerts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-900/70">
                    Le moteur RMS détecte des opportunités d'activation immédiate basées sur le
                    pickup, l'occupation prévisionnelle et le mix canal.
                  </p>

                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {intelligentAlerts.map((p) => (
                      <AlertCard
                        key={p.id}
                        promo={p}
                        onActivate={() => toggleStatus(p.id)}
                        onOpen={() => setSelectedPromo(p)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* SEARCH + FILTERS */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
          <div className="relative min-w-[220px] flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une promotion, un code, un type…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <FilterSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as PromoType | 'all')}
            options={TYPE_FILTERS.map((t) => ({ value: t.id, label: t.label }))}
          />
          <FilterSelect
            value={channelFilter}
            onChange={setChannelFilter}
            options={[{ value: 'all', label: 'Tous les canaux' }, ...allChannels.map((c) => ({ value: c, label: c }))]}
          />

          <SegmentedStatus value={statusFilter} onChange={setStatusFilter} />
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <Th className="w-[120px]">Statut</Th>
                  <Th>Nom / description</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Réduction</Th>
                  <Th>Canaux</Th>
                  <Th>Période / état</Th>
                  <Th className="text-right">Résa.</Th>
                  <Th className="text-right">Revenu</Th>
                  <Th className="text-right">ROI</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((promo) => (
                  <PromoRow
                    key={promo.id}
                    promo={promo}
                    onOpen={() => setSelectedPromo(promo)}
                    onToggle={() => toggleStatus(promo.id)}
                    onDuplicate={() => duplicatePromo(promo)}
                    onDelete={() => deletePromo(promo.id)}
                  />
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <Tag className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          Aucune promotion ne correspond
                        </p>
                        <p className="text-xs text-slate-500">
                          Modifiez vos filtres ou créez une nouvelle campagne.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Affichage <strong className="text-slate-700">{(page - 1) * pageSize + 1}</strong>–
              <strong className="text-slate-700">
                {Math.min(page * pageSize, filtered.length)}
              </strong>{' '}
              sur <strong className="text-slate-700">{filtered.length}</strong> promotions
            </div>
            <div className="flex items-center gap-1">
              <PaginationButton disabled={page === 1} onClick={() => setPage(page - 1)}>
                Précédent
              </PaginationButton>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-8 rounded-lg px-2.5 text-xs font-semibold transition',
                    p === page
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {p}
                </button>
              ))}
              <PaginationButton
                disabled={page === pageCount}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </PaginationButton>
            </div>
          </div>
        </div>

        {/* ANALYTICS GRID */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <ImpactCard data={impactData} />
          <TypeBreakdownCard data={typeBreakdown} />
          <ChannelBarsCard data={channelPerf} />
          <CalendarHeatmap promotions={promotions} />
        </div>
      </div>

      {/* DETAIL MODAL */}
      <PromoDetailModal
        promo={selectedPromo}
        onClose={() => setSelectedPromo(null)}
        onToggle={() => selectedPromo && toggleStatus(selectedPromo.id)}
        onDuplicate={() => selectedPromo && duplicatePromo(selectedPromo)}
        onDelete={() => selectedPromo && deletePromo(selectedPromo.id)}
      />

      {/* CREATE MODAL (placeholder) */}
      <CreatePromoModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

export default PromotionsCompact;

/* ────────────────────────────────────────────────────────────────────────── */
/* SMALL UI                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <th className={cn('px-4 py-3 text-left font-semibold', className)}>{children}</th>
);

const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const SegmentedStatus: React.FC<{
  value: PromoStatus | 'all';
  onChange: (v: PromoStatus | 'all') => void;
}> = ({ value, onChange }) => {
  const options: { id: PromoStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'Actives' },
    { id: 'scheduled', label: 'Programmées' },
    { id: 'paused', label: 'Pausées' },
    { id: 'draft', label: 'Brouillon' },
  ];
  return (
    <div className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'h-8 rounded-lg px-3 text-xs font-semibold transition',
            value === o.id
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

const PaginationButton: React.FC<
  React.PropsWithChildren<{ disabled?: boolean; onClick?: () => void }>
> = ({ children, disabled, onClick }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'h-8 rounded-lg px-2.5 text-xs font-semibold transition',
      disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-slate-100'
    )}
  >
    {children}
  </button>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* ROW                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

const PromoRow: React.FC<{
  promo: Promotion;
  onOpen: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ promo, onOpen, onToggle, onDuplicate, onDelete }) => {
  const status = STATUS_META[promo.status];
  const type = TYPE_PALETTE[promo.type];

  const dur = daysBetween(promo.startDate, promo.endDate);
  const remaining = daysFromNow(promo.endDate);
  const startsIn = daysFromNow(promo.startDate);
  let progress = 0;
  if (promo.status === 'active') {
    const total = dur || 1;
    const done = total - Math.max(0, remaining);
    progress = Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  } else if (promo.status === 'ended') {
    progress = 100;
  }

  return (
    <motion.tr
      whileHover={{ backgroundColor: 'rgba(248,250,252,1)' }}
      className="group cursor-pointer text-sm text-slate-700"
      onClick={onOpen}
    >
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            status.bg,
            status.text,
            status.ring
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-slate-900">{promo.name}</div>
          {promo.alert?.priority === 'high' && (
            <Flame className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
          <span>{promo.description}</span>
          {promo.code && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {promo.code}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            type.bg,
            type.text,
            type.ring
          )}
        >
          {promo.typeLabel}
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-slate-900 tabular-nums">{promo.discount}</span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {promo.channels.slice(0, 2).map((c) => (
            <span
              key={c}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {c}
            </span>
          ))}
          {promo.channels.length > 2 && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
              +{promo.channels.length - 2}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="text-[12px] font-medium text-slate-700">
          {formatDateFR(promo.startDate)} <span className="text-slate-400">→</span>{' '}
          {formatDateFR(promo.endDate)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                promo.status === 'active'
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : promo.status === 'scheduled'
                    ? 'bg-gradient-to-r from-violet-400 to-violet-500'
                    : 'bg-slate-300'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500">
            {promo.permanent
              ? 'Permanente'
              : promo.status === 'scheduled'
                ? `Débute dans ${Math.max(0, startsIn)}j`
                : promo.status === 'active'
                  ? `${Math.max(0, remaining)}j restants`
                  : promo.status === 'ended'
                    ? 'Terminée'
                    : '—'}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="text-sm font-semibold text-slate-900 tabular-nums">{promo.bookings}</div>
        {promo.bookingsDelta !== 0 && (
          <DeltaPill value={promo.bookingsDelta} />
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="text-sm font-semibold text-slate-900 tabular-nums">
          {formatK(promo.revenue)}
        </div>
        {promo.revenueDelta !== 0 && <DeltaPill value={promo.revenueDelta} />}
      </td>

      <td className="px-4 py-3 text-right">
        {promo.roi > 0 ? (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
              promo.roi >= 4
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : promo.roi >= 3
                  ? 'bg-sky-50 text-sky-700 ring-sky-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
            )}
          >
            {promo.roi.toFixed(1)}x
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-70 transition group-hover:opacity-100">
          <IconButton
            label={promo.status === 'active' ? 'Mettre en pause' : 'Activer'}
            onClick={onToggle}
          >
            {promo.status === 'active' ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </IconButton>
          <IconButton label="Éditer" onClick={onOpen}>
            <Edit3 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Dupliquer" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Supprimer" onClick={onDelete} tone="rose">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </td>
    </motion.tr>
  );
};

const DeltaPill: React.FC<{ value: number }> = ({ value }) => {
  const positive = value > 0;
  return (
    <div
      className={cn(
        'mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
        positive ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {positive ? '+' : ''}
      {value}%
    </div>
  );
};

const IconButton: React.FC<
  React.PropsWithChildren<{ label: string; tone?: 'default' | 'rose'; onClick?: () => void }>
> = ({ children, label, tone = 'default', onClick }) => (
  <button
    title={label}
    onClick={onClick}
    className={cn(
      'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition',
      tone === 'rose' ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-900'
    )}
  >
    {children}
  </button>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* ALERTS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const AlertCard: React.FC<{
  promo: Promotion;
  onActivate: () => void;
  onOpen: () => void;
}> = ({ promo, onActivate, onOpen }) => (
  <div className="group relative overflow-hidden rounded-xl border border-amber-200/80 bg-white/90 p-3 shadow-sm transition hover:shadow-md">
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{promo.name}</p>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
            Haute
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">
          <strong className="text-slate-700">Pourquoi : </strong>
          {promo.alert?.why}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
          <Clock className="mr-1 inline h-3 w-3" />
          {promo.alert?.when}
        </p>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <button
        onClick={onOpen}
        className="text-[11px] font-semibold text-violet-700 hover:underline"
      >
        Voir le détail →
      </button>
      <button
        onClick={onActivate}
        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm shadow-violet-500/30 hover:shadow-md"
      >
        <Zap className="h-3 w-3" />
        Activer
      </button>
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* ANALYTICS WIDGETS                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const PanelHeading: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}> = ({ title, subtitle, icon }) => (
  <div className="mb-3 flex items-center gap-2">
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
      {icon}
    </div>
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
    </div>
  </div>
);

const ImpactCard: React.FC<{ data: { day: string; avant: number; apres: number }[] }> = ({
  data,
}) => {
  const avgBefore = data.reduce((s, d) => s + d.avant, 0) / data.length;
  const avgAfter = data.reduce((s, d) => s + d.apres, 0) / data.length;
  const uplift = ((avgAfter - avgBefore) / avgBefore) * 100;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <PanelHeading
        title="Impact promotions"
        subtitle="RevPAR avant / après activation"
        icon={<LineChartIcon className="h-3.5 w-3.5" />}
      />
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">
          +{uplift.toFixed(1)}%
        </span>
        <span className="text-xs text-slate-500">uplift moyen RevPAR</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gradImpactA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradImpactB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <Tooltip
              cursor={{ stroke: '#E2E8F0' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                fontSize: 12,
                boxShadow: '0 8px 30px rgba(15,23,42,.08)',
              }}
            />
            <Area
              type="monotone"
              dataKey="avant"
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="4 3"
              fill="url(#gradImpactB)"
              name="Avant"
            />
            <Area
              type="monotone"
              dataKey="apres"
              stroke="#8B5CF6"
              strokeWidth={2.4}
              fill="url(#gradImpactA)"
              name="Après"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PIE_COLORS = ['#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6'];

const TypeBreakdownCard: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <PanelHeading
        title="Répartition par type"
        subtitle={`${data.length} types actifs`}
        icon={<PieChartIcon className="h-3.5 w-3.5" />}
      />
      <div className="flex items-center gap-3">
        <div className="relative h-32 w-32">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={56}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  fontSize: 12,
                  boxShadow: '0 8px 30px rgba(15,23,42,.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-900 tabular-nums">{total}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">résa.</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {data.slice(0, 5).map((d, i) => {
            const pct = ((d.value / Math.max(1, total)) * 100).toFixed(0);
            return (
              <div key={d.label} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="truncate text-slate-700">{d.label}</span>
                <span className="ml-auto font-semibold text-slate-500 tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ChannelBarsCard: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <PanelHeading
        title="Performance par canal"
        subtitle="Réservations attribuées"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
      />
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{d.label}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{d.value} résa.</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(d.value / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CalendarHeatmap: React.FC<{ promotions: Promotion[] }> = ({ promotions }) => {
  const months = ['Mai', 'Juin', 'Juil.'];
  const monthIndexes = [4, 5, 6];
  const cells = monthIndexes.flatMap((m) =>
    Array.from({ length: 14 }, (_, i) => ({ m, i, intensity: (Math.sin(m * 3.7 + i * 1.9) + 1) / 2 }))
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <PanelHeading
        title="Calendrier des promotions"
        subtitle="Densité d'activation par jour"
        icon={<CalendarRange className="h-3.5 w-3.5" />}
      />

      <div className="mt-1 space-y-3">
        {promotions.slice(0, 5).map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-28 truncate text-[11px] font-medium text-slate-600">{p.name}</span>
            <div className="flex flex-1 gap-1">
              {cells
                .slice(0, 24)
                .map((cell, idx) => {
                  const intensity = (Math.sin(p.id.charCodeAt(0) * 0.4 + idx * 1.7) + 1) / 2;
                  const tone = TYPE_PALETTE[p.type];
                  return (
                    <span
                      key={idx}
                      className={cn(
                        'h-3 flex-1 rounded-sm transition hover:scale-y-150',
                        tone.bg,
                        intensity > 0.7 ? 'opacity-100' : intensity > 0.4 ? 'opacity-70' : 'opacity-30'
                      )}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
        <span>{months.join(' • ')}</span>
        <span className="flex items-center gap-1">
          Intensité
          <span className="h-2 w-3 rounded-sm bg-violet-100" />
          <span className="h-2 w-3 rounded-sm bg-violet-300" />
          <span className="h-2 w-3 rounded-sm bg-violet-500" />
        </span>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/* DETAIL MODAL                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const DETAIL_TABS = [
  { id: 'overview', label: 'Vue générale' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'restrictions', label: 'Restrictions' },
  { id: 'channels', label: 'OTA concernés' },
  { id: 'performance', label: 'Performance' },
  { id: 'revenue', label: 'Revenus' },
  { id: 'clients', label: 'Clients touchés' },
  { id: 'ai', label: 'Analyse IA' },
  { id: 'history', label: 'Historique' },
  { id: 'logs', label: 'Logs' },
] as const;

type TabId = (typeof DETAIL_TABS)[number]['id'];

const PromoDetailModal: React.FC<{
  promo: Promotion | null;
  onClose: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ promo, onClose, onToggle, onDuplicate, onDelete }) => {
  const [tab, setTab] = React.useState<TabId>('overview');
  React.useEffect(() => {
    if (promo) setTab('overview');
  }, [promo]);

  return (
    <AnimatePresence>
      {promo && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid h-[680px] w-[min(960px,95vw)] grid-cols-[220px_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Sidebar */}
            <div className="flex flex-col border-r border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-3 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-3 text-white shadow-lg shadow-violet-500/20">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    Promotion
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-tight">{promo.name}</p>
                <p className="mt-0.5 text-[11px] text-violet-100/90">{promo.typeLabel}</p>
              </div>

              <nav className="flex-1 space-y-0.5">
                {DETAIL_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition',
                      tab === t.id
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                    )}
                  >
                    {t.label}
                    {tab === t.id && <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </nav>

              <div className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3">
                <button
                  onClick={onToggle}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  {promo.status === 'active' ? (
                    <>
                      <PauseCircle className="h-4 w-4" /> Mettre en pause
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" /> Activer
                    </>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={onDuplicate}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" /> Dupliquer
                  </button>
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Suppr.
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative flex h-full flex-col">
              <button
                onClick={onClose}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex-1 overflow-y-auto p-6">
                {tab === 'overview' && <OverviewTab promo={promo} />}
                {tab === 'conditions' && <ConditionsTab promo={promo} />}
                {tab === 'restrictions' && <RestrictionsTab promo={promo} />}
                {tab === 'channels' && <ChannelsTab promo={promo} />}
                {tab === 'performance' && <PerformanceTab promo={promo} />}
                {tab === 'revenue' && <RevenueTab promo={promo} />}
                {tab === 'clients' && <ClientsTab promo={promo} />}
                {tab === 'ai' && <AITab promo={promo} />}
                {tab === 'history' && <HistoryTab promo={promo} />}
                {tab === 'logs' && <LogsTab promo={promo} />}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const StatBlock: React.FC<{
  label: string;
  value: string;
  tone?: 'violet' | 'emerald' | 'sky' | 'amber';
  hint?: string;
}> = ({ label, value, tone = 'violet', hint }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
    </div>
    <div
      className={cn(
        'mt-1.5 text-xl font-bold tabular-nums',
        tone === 'violet' && 'text-violet-700',
        tone === 'emerald' && 'text-emerald-700',
        tone === 'sky' && 'text-sky-700',
        tone === 'amber' && 'text-amber-700'
      )}
    >
      {value}
    </div>
    {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
  </div>
);

const OverviewTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            STATUS_META[promo.status].bg,
            STATUS_META[promo.status].text,
            STATUS_META[promo.status].ring
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[promo.status].dot)} />
          {STATUS_META[promo.status].label}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            TYPE_PALETTE[promo.type].bg,
            TYPE_PALETTE[promo.type].text,
            TYPE_PALETTE[promo.type].ring
          )}
        >
          {promo.typeLabel}
        </span>
        {promo.code && (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
            {promo.code}
          </span>
        )}
      </div>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{promo.name}</h2>
      <p className="text-sm text-slate-500">{promo.description}</p>
    </div>

    <div className="grid grid-cols-4 gap-3">
      <StatBlock label="Réduction" value={promo.discount} tone="violet" />
      <StatBlock label="Réservations" value={`${promo.bookings}`} tone="sky" />
      <StatBlock label="Revenu" value={formatK(promo.revenue)} tone="emerald" />
      <StatBlock label="ROI" value={promo.roi > 0 ? `${promo.roi.toFixed(1)}x` : '—'} tone="amber" />
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarRange className="h-4 w-4 text-violet-600" />
        Période d'activation
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Début
          </div>
          <div className="font-semibold text-slate-900">{formatDateFR(promo.startDate)}</div>
        </div>
        <div className="flex-1 px-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-400 to-violet-600" />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Fin
          </div>
          <div className="font-semibold text-slate-900">{formatDateFR(promo.endDate)}</div>
        </div>
      </div>
    </div>

    {promo.alert && (
      <div className="rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
          <Sparkles className="h-4 w-4" />
          Recommandation IA
        </div>
        <ul className="space-y-1.5 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <Target className="mt-0.5 h-3.5 w-3.5 text-violet-500" />
            <span>
              <strong>Pourquoi : </strong>
              {promo.alert.why}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 text-violet-500" />
            <span>
              <strong>Quand : </strong>
              {promo.alert.when}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-3.5 w-3.5 text-violet-500" />
            <span>
              <strong>Pour qui : </strong>
              {promo.alert.who}
            </span>
          </li>
        </ul>
      </div>
    )}
  </div>
);

const RowKV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-start justify-between border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-xs font-medium text-slate-500">{k}</span>
    <span className="text-sm font-semibold text-slate-900">{v}</span>
  </div>
);

const ConditionsTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
    <RowKV k="Nuits minimum" v={`${promo.minNights} nuit${promo.minNights > 1 ? 's' : ''}`} />
    <RowKV k="Réduction" v={promo.discount} />
    <RowKV k="Code promo" v={promo.code ?? '—'} />
    <RowKV k="Permanent" v={promo.permanent ? 'Oui' : 'Non'} />
    <RowKV k="Chambres éligibles" v={promo.rooms.join(', ')} />
    <RowKV k="Segments cibles" v={promo.segments.join(', ')} />
  </div>
);

const RestrictionsTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="space-y-3">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">Restrictions appliquées</h4>
      <ul className="space-y-2 text-sm text-slate-600">
        {[
          `Séjour ≥ ${promo.minNights} nuit(s)`,
          promo.permanent ? 'Pas de restriction de saison' : 'Plage de dates spécifique',
          `Limité à ${promo.channels.join(' + ')}`,
          'Non cumulable avec d’autres promotions',
          'Réservations annulables sous J-3 (sauf non-remb.)',
        ].map((r) => (
          <li key={r} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const ChannelsTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="grid gap-2 md:grid-cols-2">
    {promo.channels.map((c) => (
      <div key={c} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{c}</div>
            <div className="text-[11px] text-slate-500">Diffusion active</div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Synchronisé
        </span>
      </div>
    ))}
  </div>
);

const PerformanceTab: React.FC<{ promo: Promotion }> = ({ promo }) => {
  const data = promo.sparkline.map((v, i) => ({ d: `J${i + 1}`, v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatBlock label="Réservations" value={`${promo.bookings}`} tone="sky" />
        <StatBlock label="Conversion" value={`${promo.conversion.toFixed(1)}%`} tone="violet" />
        <StatBlock label="Performance" value={`${promo.performance}/100`} tone="emerald" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Évolution réservations</h4>
        <div className="h-44">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPerf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="#8B5CF6" strokeWidth={2.4} fill="url(#gradPerf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const RevenueTab: React.FC<{ promo: Promotion }> = ({ promo }) => {
  const data = Array.from({ length: 8 }, (_, i) => ({
    w: `S${i + 1}`,
    revenu: Math.round(promo.revenue / 8 + Math.sin(i) * 600),
    cout: Math.round((promo.revenue / 8) * 0.25 + Math.cos(i) * 300),
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatBlock label="Revenu généré" value={formatK(promo.revenue)} tone="emerald" />
        <StatBlock label="Coût estimé" value={formatK(Math.round(promo.revenue * 0.18))} tone="amber" />
        <StatBlock label="ROI" value={promo.roi > 0 ? `${promo.roi.toFixed(1)}x` : '—'} tone="violet" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Revenu vs coût (8 semaines)</h4>
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="w" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="revenu" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cout" fill="#FCD34D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const ClientsTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      <StatBlock label="Clients touchés" value={`${promo.bookings}`} tone="sky" />
      <StatBlock label="Nationalité dom." value="🇫🇷 FR" />
      <StatBlock label="Segment dom." value={promo.segments[0]} />
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p>
        La majorité des clients touchés par <strong>{promo.name}</strong> sont issus du segment{' '}
        <strong>{promo.segments[0]}</strong>, en provenance principalement de France et du Benelux.
        Le panier moyen observé est de{' '}
        <strong>
          {formatK(Math.round(promo.revenue / Math.max(1, promo.bookings)))}
        </strong>{' '}
        par réservation.
      </p>
    </div>
  </div>
);

const AITab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-white p-5">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
      <Sparkles className="h-4 w-4" /> Analyse IA — moteur Flowtym RMS
    </div>
    <p className="text-sm text-slate-700">
      La promotion <strong>{promo.name}</strong> performe à{' '}
      <strong className="text-violet-700">{promo.performance}/100</strong> par rapport aux campagnes
      historiques comparables. Le moteur recommande de :
    </p>
    <ul className="mt-3 space-y-2 text-sm text-slate-700">
      <li className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
        Conserver l'activation sur les canaux à forte conversion ({promo.channels.join(', ')}).
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
        Ajuster la réduction à <strong>{Math.max(5, promo.discountValue - 2)}%</strong> les
        week-ends à forte demande.
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
        Étendre à <strong>Direct</strong> pour réduire la commission moyenne pondérée.
      </li>
    </ul>
  </div>
);

const HistoryTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <div className="rounded-xl border border-slate-200 bg-white">
    {[
      { d: 'Aujourd’hui · 10:32', who: 'Marc D.', what: `Mise à jour de la réduction (${promo.discount})` },
      { d: 'Hier · 18:04', who: 'Système', what: 'Synchronisation Booking.com OK' },
      { d: 'Il y a 3j', who: 'Sophie L.', what: 'Activation manuelle de la promotion' },
      { d: 'Il y a 5j', who: 'IA RMS', what: 'Recommandation d’activation détectée' },
    ].map((h, i) => (
      <div
        key={i}
        className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
      >
        <div className="mt-1 h-2 w-2 rounded-full bg-violet-500" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900">{h.what}</div>
          <div className="text-[11px] text-slate-500">
            {h.who} · {h.d}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const LogsTab: React.FC<{ promo: Promotion }> = ({ promo }) => (
  <pre className="max-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-200">
    {[
      `[INFO] Promotion ${promo.id} (${promo.name}) loaded`,
      `[INFO] Channels: ${promo.channels.join(', ')}`,
      `[INFO] Status: ${promo.status}`,
      `[OK]   Push booking.com — 200 OK (124ms)`,
      `[OK]   Push expedia      — 200 OK (188ms)`,
      `[WARN] direct rate parity — minor drift detected (+0.4€)`,
      `[INFO] Bookings since activation: ${promo.bookings}`,
      `[INFO] Net revenue: ${promo.revenue}€`,
      `[OK]   Webhook delivered to RMS engine`,
    ].join('\n')}
  </pre>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* CREATE MODAL (light placeholder, premium look)                             */
/* ────────────────────────────────────────────────────────────────────────── */

const CreatePromoModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[min(620px,95vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/30">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nouvelle promotion</h3>
                <p className="text-[11px] text-slate-500">
                  Configurez votre campagne — synchronisation automatique vers vos OTAs
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nom de la campagne">
              <input className="form-input" placeholder="Ex: Été 2026" />
            </Field>
            <Field label="Code promo (optionnel)">
              <input className="form-input" placeholder="Ex: SUMMER20" />
            </Field>
            <Field label="Type de promotion">
              <select className="form-input">
                {TYPE_FILTERS.filter((t) => t.id !== 'all').map((t) => (
                  <option key={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Réduction (%)">
              <input className="form-input" type="number" placeholder="20" />
            </Field>
            <Field label="Date de début">
              <input className="form-input" type="date" />
            </Field>
            <Field label="Date de fin">
              <input className="form-input" type="date" />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button
              onClick={onClose}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:shadow-lg"
            >
              <Sparkles className="h-4 w-4" />
              Créer la promotion
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
    {children}
    <style>{`
      .form-input {
        height: 38px;
        width: 100%;
        border-radius: 12px;
        border: 1px solid #E2E8F0;
        background: white;
        padding: 0 12px;
        font-size: 13px;
        color: #0F172A;
        outline: none;
        transition: border-color .15s, box-shadow .15s, background .15s;
      }
      .form-input:focus {
        border-color: #A78BFA;
        box-shadow: 0 0 0 3px rgba(167,139,250,.18);
      }
    `}</style>
  </label>
);
