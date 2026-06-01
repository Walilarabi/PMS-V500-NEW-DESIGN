/**
 * FLOWTYM RMS — Détail du jour.
 *
 * Deux variantes :
 *   - 'market'      → « Détail du jour » : 6 indicateurs + distribution +
 *                     compset analysé
 *   - 'comparison'  → « Focus » : mini-tableau Hier / Aujourd'hui / Écart
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Info, ArrowUp, Check, X as XIcon, Equal, Sparkles, AlertTriangle } from 'lucide-react';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { useCompetitiveWatchData } from '../../../lib/rms/useCompetitiveWatchData';
import { getDemandColor } from '../../../lib/rms/marketDemandRules';
import { DEMAND_BANDS } from '../../../lib/rms/chartColors';
import { CompsetDistributionBar } from './CompsetDistributionBar';
import { RejectionReasonModal } from './RejectionReasonModal';
import { recommendationFeedback, type FeedbackEntry } from '../../../services/revenue/recommendationFeedback.service';
import { cn } from '@/src/lib/utils';

/* ── Variante marché ────────────────────────────────────────────────────── */

interface StatCellProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  info?: boolean;
  /** Texte affiché au survol de l'icône ⓘ */
  tooltip?: string;
}

const StatCell: React.FC<StatCellProps> = ({ label, value, valueColor, sub, info, tooltip }) => (
  <div className="px-4 py-1 first:pl-0">
    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
      {label}
      {info && (
        <Info
          className="w-3 h-3 shrink-0"
          title={tooltip}
        />
      )}
    </div>
    <div
      className="text-[20px] font-extrabold leading-tight mt-1"
      style={{ color: valueColor ?? 'inherit' }}
    >
      {value}
    </div>
    {sub && <div className="text-[11px] font-semibold mt-0.5">{sub}</div>}
  </div>
);

const EmptyDetail: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
    Aucune donnée à afficher pour la période sélectionnée.
  </div>
);

/**
 * Construit les prix des 10 hôtels du compset à partir des stats du jour.
 * Pour le mock : interpole entre q25 et q75 avec un peu de bruit déterministe
 * (basé sur l'index, donc stable d'un render à l'autre).
 */
function buildCompsetPrices(
  hotels: string[],
  q25: number,
  q75: number,
  median: number,
): Array<{ name: string; price: number; status: 'available' | 'closed' }> {
  if (hotels.length === 0) return [];
  const range = q75 - q25;
  return hotels.map((name, i) => {
    // Position pseudo-aléatoire mais déterministe entre q25 et q75
    const t = (Math.sin(i * 1.7) + 1) / 2; // 0..1
    const noise = Math.cos(i * 2.3) * (range * 0.15);
    const price = Math.max(50, Math.round(q25 + t * range + noise));
    // 1 hôtel sur 10 « fermé » pour rappeler les exclusions
    const status: 'available' | 'closed' = i === hotels.length - 1 && Math.abs(price - median) > range
      ? 'closed'
      : 'available';
    return { name, price, status };
  });
}

const MarketDetail: React.FC<{ selectedLabel: string }> = ({ selectedLabel }) => {
  const { visibleMarketMonth, compsetHotels, meta } = useCompetitiveWatchData();
  const day = visibleMarketMonth.find((d) => d.label === selectedLabel) ?? visibleMarketMonth[0];
  const [rejectOpen, setRejectOpen] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<FeedbackEntry | null>(null);

  // ─── Calculs métier (ordres, rang, recommandation) ─────────────────────────
  const enrichedCompset = useMemo(() => {
    if (!day) return [];
    const prices = buildCompsetPrices(compsetHotels, day.q25 ?? 0, day.q75 ?? 0, day.median ?? 0);
    const all = [
      ...prices,
      {
        name: meta.hotelName ? `${meta.hotelName} (vous)` : 'Notre hôtel (vous)',
        price: day.ourPrice ?? 0,
        status: day.ourPrice != null ? ('available' as const) : ('sold_out' as const),
        isUs: true,
      },
    ];
    all.sort((a, b) => b.price - a.price);
    return all;
  }, [day, compsetHotels]);

  const ourRank = useMemo(() => {
    const i = enrichedCompset.findIndex((h) => 'isUs' in h && h.isUs);
    return i >= 0 ? i + 1 : null;
  }, [enrichedCompset]);

  if (!day) return <EmptyDetail />;
  const gap = day.ourPrice != null && day.median != null ? day.ourPrice - day.median : null;
  const gapPct = gap != null && day.median != null && day.median > 0
    ? ((gap / day.median) * 100).toFixed(1)
    : null;
  const demandColor = getDemandColor(day.demand);

  // Recommandation : uniquement si les données tarifaires sont disponibles
  const recommendedPrice = (() => {
    if (day.ourPrice == null || day.median == null) return null;
    if (day.demand >= 75 && day.ourPrice < day.median) return Math.round(day.median * 0.98);
    if (day.demand <= 25 && day.ourPrice > day.median) return Math.round(day.median * 1.02);
    return day.ourPrice;
  })();
  const recommendationDelta = recommendedPrice != null && day.ourPrice != null
    ? recommendedPrice - day.ourPrice
    : null;

  // Stratégie / pression / statut dérivés
  const pressureLabel: 'Faible' | 'Modérée' | 'Forte' | 'Extrême' =
    day.demand >= 85 ? 'Extrême' : day.demand >= 60 ? 'Forte' : day.demand >= 35 ? 'Modérée' : 'Faible';
  const strategy = day.demand >= 70 ? 'Yield agressif' : day.demand <= 30 ? 'Défensive' : 'Équilibrée';

  const handleAccept = () => {
    const entry = recommendationFeedback.log({
      date: day.date,
      action: 'accept',
      context: {
        ourPrice: day.ourPrice ?? 0,
        recommendedPrice: recommendedPrice ?? day.ourPrice ?? 0,
        median: day.median ?? 0,
        rank: ourRank ?? undefined,
        pressure: pressureLabel === 'Extrême' ? 'extreme' : pressureLabel === 'Forte' ? 'high' : pressureLabel === 'Modérée' ? 'medium' : 'low',
        strategy,
      },
    });
    setLastFeedback(entry);
  };

  const handleMaintain = () => {
    const entry = recommendationFeedback.log({
      date: day.date,
      action: 'maintain',
      context: {
        ourPrice: day.ourPrice ?? 0,
        recommendedPrice: day.ourPrice ?? 0,
        median: day.median ?? 0,
        rank: ourRank ?? undefined,
        strategy,
      },
    });
    setLastFeedback(entry);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-5"
    >
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50 mb-4">
        Détail du jour <span className="text-slate-400 font-semibold">- {day.label} 2026</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 6 indicateurs */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-y-3 divide-slate-100 dark:divide-slate-800">
          <StatCell
            label="Prix observé (relevé)"
            value={day.ourPrice != null ? `${day.ourPrice}€` : 'N/A'}
            valueColor="#2563EB"
            info
            tooltip="Valeur issue du dernier relevé concurrentiel Lighthouse. Peut différer du tarif actuellement publié dans le calendrier tarifaire."
          />
          <StatCell label="Tarif médian compset" value={day.median != null ? `${day.median}€` : 'N/A'} valueColor="#16A34A" info />
          <StatCell label="Tarif moyen compset" value={day.mean != null ? `${day.mean}€` : 'N/A'} info />
          <StatCell
            label="Écart vs médiane"
            value={gap != null ? `${gap >= 0 ? '+' : ''}${gap}€` : 'N/A'}
            valueColor="#EF4444"
            sub={gapPct != null ? <span className="text-red-400">({gapPct}%)</span> : undefined}
          />
          <div className="px-4 py-1">
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Demande du marché
            </div>
            <div className="text-[20px] font-extrabold leading-tight mt-1" style={{ color: demandColor }}>
              {day.demand}%
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${day.demand}%`, backgroundColor: demandColor }}
              />
            </div>
          </div>
          <StatCell
            label="Positionnement"
            value={`#${meta.rank} / ${meta.rankTotal}`}
            sub={<span className="text-slate-400">Bas de marché</span>}
          />
        </div>

        {/* Distribution */}
        <div className="lg:col-span-5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-5">
          <CompsetDistributionBar />
        </div>
      </div>

      {/* Compset trié — 10 hôtels + notre hôtel en gras + statut */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11.5px] font-bold text-slate-600 dark:text-slate-300">
            Compset analysé ({compsetHotels.length} hôtels) — tri par tarif décroissant
          </span>
          {ourRank && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Votre rang : #{ourRank} / {enrichedCompset.length}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-1.5 font-semibold w-8">#</th>
                <th className="text-left px-3 py-1.5 font-semibold">Hôtel</th>
                <th className="text-right px-3 py-1.5 font-semibold">Tarif</th>
                <th className="text-right px-3 py-1.5 font-semibold">Δ médiane</th>
                <th className="text-center px-3 py-1.5 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {enrichedCompset.map((hotel, i) => {
                const isUs = 'isUs' in hotel && hotel.isUs;
                const delta = day.median != null ? hotel.price - day.median : null;
                return (
                  <tr
                    key={hotel.name}
                    className={cn(
                      'border-t border-slate-100 dark:border-slate-800',
                      isUs ? 'bg-blue-50/40 dark:bg-blue-900/10' : '',
                    )}
                  >
                    <td className="px-3 py-1.5 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className={cn('px-3 py-1.5 truncate', isUs ? 'font-bold text-blue-700' : 'text-slate-700')}>
                      {hotel.name}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">
                      {hotel.price}€
                    </td>
                    <td className={cn(
                      'px-3 py-1.5 text-right tabular-nums',
                      delta == null ? 'text-slate-400' : delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-500',
                    )}>
                      {delta != null ? `${delta > 0 ? '+' : ''}${delta}€` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        hotel.status === 'available'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500',
                      )}>
                        {hotel.status === 'available' ? 'Ouvert' : 'Fermé'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panneau d'actions : recommandation + Accepter / Refuser / Maintenir */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
              Recommandation RMS
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[22px] font-extrabold text-slate-900">{recommendedPrice}€</span>
            {recommendationDelta !== 0 && (
              <span className={cn(
                'text-[12px] font-bold',
                recommendationDelta > 0 ? 'text-emerald-600' : 'text-rose-600',
              )}>
                {recommendationDelta > 0 ? '+' : ''}{recommendationDelta}€
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-1">
            <div><b>Stratégie :</b> {strategy}</div>
            <div><b>Pression :</b> {pressureLabel}</div>
            <div><b>Écart vs médiane :</b> {gap > 0 ? '+' : ''}{gap}€ ({gapPct}%)</div>
            <div><b>Restrictions :</b> Aucune</div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3.5">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">
            Vos actions
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 shadow-sm"
            >
              <Check size={14} />
              <span>Accepter</span>
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600 shadow-sm"
            >
              <XIcon size={14} />
              <span>Refuser</span>
            </button>
            <button
              type="button"
              onClick={handleMaintain}
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-300 shadow-sm"
            >
              <Equal size={14} />
              <span>Maintenir</span>
            </button>
          </div>
          {lastFeedback && (
            <div className={cn(
              'mt-2 text-[10.5px] font-medium px-2 py-1.5 rounded-lg',
              lastFeedback.action === 'accept' ? 'bg-emerald-50 text-emerald-700'
              : lastFeedback.action === 'reject' ? 'bg-rose-50 text-rose-700'
              : 'bg-slate-100 text-slate-700',
            )}>
              <AlertTriangle size={10} className="inline mr-1" />
              Décision enregistrée — {lastFeedback.action === 'accept' ? 'Acceptée'
                : lastFeedback.action === 'reject' ? `Refusée (${lastFeedback.reasonLabel ?? '—'})`
                : 'Maintenue'}
            </div>
          )}
        </div>
      </div>

      {/* Modal raisons de refus */}
      <RejectionReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        date={day.date}
        context={{
          ourPrice: day.ourPrice ?? 0,
          recommendedPrice: recommendedPrice ?? day.ourPrice ?? 0,
          median: day.median ?? 0,
          rank: ourRank ?? undefined,
          pressure: pressureLabel === 'Extrême' ? 'extreme' : pressureLabel === 'Forte' ? 'high' : pressureLabel === 'Modérée' ? 'medium' : 'low',
          strategy,
        }}
        onLogged={(e) => setLastFeedback(e)}
      />
    </motion.div>
  );
};

/* ── Variante comparaison (Focus) ───────────────────────────────────────── */

const FocusDetail: React.FC<{ period: ComparePeriodKey; selectedLabel: string }> = ({
  period,
  selectedLabel,
}) => {
  const { comparePeriods: COMPARE_PERIODS, getComparisonData } = useCompetitiveWatchData();
  const periodMeta = COMPARE_PERIODS.find((p) => p.key === period) ?? COMPARE_PERIODS[0];
  const days = getComparisonData(period);
  const day = days.find((d) => d.label === selectedLabel) ?? days[0];
  if (!day) return <EmptyDetail />;

  const demandDelta = day.demandToday - day.demandPast;
  const medianDelta = day.medianToday - day.medianPast;

  const rows = [
    {
      label: 'Demande marché',
      past: `${day.demandPast}%`,
      today: `${day.demandToday}%`,
      delta: `${demandDelta >= 0 ? '+' : ''}${demandDelta} pts`,
      positive: demandDelta >= 0,
    },
    {
      label: 'Médiane compset',
      past: `${day.medianPast}€`,
      today: `${day.medianToday}€`,
      delta: `${medianDelta >= 0 ? '+' : ''}${medianDelta}€`,
      positive: medianDelta >= 0,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4"
    >
      <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-slate-50 mb-3">
        Focus <span className="text-slate-400 font-semibold">– {day.label} 2026</span>
      </h3>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <th className="text-left pb-2 font-semibold" />
            <th className="text-center pb-2 font-semibold">{periodMeta.label}</th>
            <th className="text-center pb-2 font-semibold">Aujourd'hui</th>
            <th className="text-center pb-2 font-semibold">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
                {row.label}
              </td>
              <td className="py-3 text-center text-[14px] font-bold text-slate-400 dark:text-slate-500">
                {row.past}
              </td>
              <td className="py-3 text-center text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
                {row.today}
              </td>
              <td className="py-3 text-center">
                <span
                  className={`inline-flex items-center gap-0.5 text-[13px] font-extrabold ${
                    row.positive ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {row.delta}
                  <ArrowUp
                    className={`w-3.5 h-3.5 ${row.positive ? '' : 'rotate-180'}`}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

/* ── Composant exporté ──────────────────────────────────────────────────── */

export interface DayDetailPanelProps {
  variant: 'market' | 'comparison';
  period: ComparePeriodKey;
  selectedLabel: string;
}

export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  variant,
  period,
  selectedLabel,
}) => {
  if (variant === 'market') return <MarketDetail selectedLabel={selectedLabel} />;
  return <FocusDetail period={period} selectedLabel={selectedLabel} />;
};
