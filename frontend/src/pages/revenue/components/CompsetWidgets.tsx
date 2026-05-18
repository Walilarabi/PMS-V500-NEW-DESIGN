/**
 * FLOWTYM — Composants Veille Concurrentielle
 *
 * Composants extraits utilisés par LighthouseMonthlyView :
 *   - CompsetKpiBlock : 8 KPIs métier
 *   - CompsetBarChart : graphique horizontal style Lighthouse
 *
 * Tous alimentés depuis des données réelles parsées.
 */

import React from 'react';
import { Target } from 'lucide-react';
import type { LighthouseDayData, LighthouseImport } from '../../../services/lighthouse-parser.service';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

// ─── Bloc 8 KPIs ──────────────────────────────────────────────────────────

export interface CompsetKpiBlockProps {
  monthData: LighthouseDayData[];
  ourHotelName: string;
}

export function CompsetKpiBlock({ monthData, ourHotelName }: CompsetKpiBlockProps) {
  if (monthData.length === 0) return null;

  // Tarif moyen compset (moyenne des prix concurrents disponibles)
  const compsetPrices: number[] = [];
  monthData.forEach(d => {
    d.competitors.forEach(c => {
      if (c.status === 'available' && c.price !== null) compsetPrices.push(c.price);
    });
  });
  const avgCompsetPrice = compsetPrices.length > 0
    ? Math.round(compsetPrices.reduce((s, p) => s + p, 0) / compsetPrices.length)
    : 0;

  // Médiane compset (moyenne des médianes journalières)
  const medians = monthData.map(d => d.compsetMedian).filter(m => m > 0);
  const medianAvg = medians.length > 0
    ? Math.round(medians.reduce((s, m) => s + m, 0) / medians.length)
    : 0;

  // Notre tarif moyen sur la période
  const ourPrices = monthData.map(d => d.ourPrice).filter(p => p > 0);
  const ourAvg = ourPrices.length > 0
    ? Math.round(ourPrices.reduce((s, p) => s + p, 0) / ourPrices.length)
    : 0;

  // Écart vs compset (notre prix vs médiane)
  const gap = medianAvg > 0 ? ourAvg - medianAvg : 0;
  const gapPct = medianAvg > 0 ? ((gap / medianAvg) * 100) : 0;

  // Pression marché moyenne
  const avgPressure = Math.round(
    monthData.reduce((s, d) => s + d.marketDemandPercent, 0) / monthData.length
  );

  // Concurrents plus chers / moins chers (sur toute la période)
  let morePricey = 0;
  let lessPricey = 0;
  monthData.forEach(d => {
    if (d.ourPrice <= 0) return;
    d.competitors.forEach(c => {
      if (c.status === 'available' && c.price !== null) {
        if (c.price > d.ourPrice) morePricey++;
        else if (c.price < d.ourPrice) lessPricey++;
      }
    });
  });

  // Ranking moyen (position dans le compset)
  const ranks = monthData.map(d => d.rankPosition).filter((r): r is number => r !== null);
  const avgRank = ranks.length > 0
    ? Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length)
    : 0;
  const totals = monthData.map(d => d.rankTotal).filter((r): r is number => r !== null);
  const avgTotal = totals.length > 0
    ? Math.round(totals.reduce((s, r) => s + r, 0) / totals.length)
    : 0;

  // Positionnement de notre hôtel (top tier / mid / low)
  let positioning: string;
  if (avgRank > 0 && avgTotal > 0) {
    const ratio = avgRank / avgTotal;
    positioning = ratio <= 0.33 ? 'Top tier' : ratio <= 0.66 ? 'Mid-market' : 'Bas de marché';
  } else {
    positioning = 'N/A';
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Tarif moyen compset"
        value={`${avgCompsetPrice}€`}
        sub="moyenne 10 concurrents"
      />
      <KpiCard
        label="Tarif médian"
        value={`${medianAvg}€`}
        sub="médiane compset"
        color="purple"
      />
      <KpiCard
        label="Notre tarif moyen"
        value={`${ourAvg}€`}
        sub={ourHotelName}
        color="blue"
      />
      <KpiCard
        label="Écart vs médiane"
        value={`${gap >= 0 ? '+' : ''}${gap}€`}
        sub={`${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%`}
        color={gap >= 0 ? 'green' : 'red'}
      />
      <KpiCard
        label="Pression marché"
        value={`${avgPressure}%`}
        sub="demande moyenne"
        color={avgPressure >= 70 ? 'red' : avgPressure >= 40 ? 'amber' : 'green'}
      />
      <KpiCard
        label="Concurrents + chers"
        value={String(morePricey)}
        sub="cumulé période"
        color="green"
      />
      <KpiCard
        label="Concurrents - chers"
        value={String(lessPricey)}
        sub="cumulé période"
        color="red"
      />
      <KpiCard
        label="Positionnement"
        value={positioning}
        sub={avgRank > 0 ? `#${avgRank} / ${avgTotal} en moyenne` : '—'}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'gray' }: { label: string; value: string; sub?: string; color?: string }) {
  const colorClass = {
    gray: 'text-gray-900',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }[color] ?? 'text-gray-900';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-xl font-bold', colorClass)}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Graphique compset horizontal (style Lighthouse) ──────────────────────

export interface CompsetBarChartProps {
  importData: LighthouseImport;
  selectedDate: string | null;
  onDateChange: (d: string) => void;
}

export function CompsetBarChart({ importData, selectedDate, onDateChange }: CompsetBarChartProps) {
  // Date par défaut : aujourd'hui ou première date dispo
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = selectedDate
    ?? (importData.days.find(d => d.date >= today)?.date)
    ?? importData.days[0]?.date;

  const dayData = importData.days.find(d => d.date === targetDate);
  if (!dayData) return null;

  // Construire la liste de tous les hôtels avec leur prix
  type HotelRow = { name: string; price: number; isUs: boolean; status: string };
  const rows: HotelRow[] = [
    { name: importData.ourHotelName, price: dayData.ourPrice, isUs: true, status: 'available' },
    ...dayData.competitors.map(c => ({
      name: c.hotelName,
      price: c.price ?? 0,
      isUs: false,
      status: c.status,
    })),
  ];

  // Trier par prix décroissant (les plus chers en haut)
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== 'available' && b.status === 'available') return 1;
    if (a.status === 'available' && b.status !== 'available') return -1;
    return b.price - a.price;
  });

  const maxPrice = Math.max(
    ...sorted.filter(r => r.status === 'available').map(r => r.price),
    1
  );

  // Liste des dates disponibles autour de la date sélectionnée
  const dateOptions = importData.days.slice(0, 60);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Positionnement Compset
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {dayData.dayName} {targetDate} · médiane {dayData.compsetMedian}€ · demande {dayData.marketDemandPercent}%
          </p>
        </div>
        <select
          value={targetDate}
          onChange={e => onDateChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {dateOptions.map(d => (
            <option key={d.date} value={d.date}>
              {d.dayName} {d.date.slice(5)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        {sorted.map((row, idx) => {
          if (row.status !== 'available') {
            return (
              <div key={row.name} className="flex items-center gap-3 px-3 py-2 rounded bg-gray-50 opacity-50">
                <span className="w-6 text-xs font-bold text-gray-400">—</span>
                <span className="flex-1 text-sm text-gray-500 line-through">{row.name}</span>
                <span className="text-xs text-gray-400">
                  {row.status === 'sold_out' ? 'Épuisé' : row.status === 'restricted' ? 'Restreint' : 'N/A'}
                </span>
              </div>
            );
          }

          const widthPct = (row.price / maxPrice) * 100;
          const ratio = dayData.compsetMedian > 0 ? row.price / dayData.compsetMedian : 1;
          let barColor: string;
          if (row.isUs) barColor = 'bg-blue-500';
          else if (ratio >= 1.1) barColor = 'bg-emerald-400';
          else if (ratio <= 0.9) barColor = 'bg-red-400';
          else barColor = 'bg-gray-400';

          // Position dans le ranking des disponibles
          const availables = sorted.filter(r => r.status === 'available');
          const rank = availables.indexOf(row) + 1;

          return (
            <div
              key={row.name}
              className={cn(
                'flex items-center gap-3 px-3 py-1.5 rounded',
                row.isUs && 'bg-blue-50 border border-blue-300'
              )}
            >
              <span className={cn(
                'w-6 text-xs font-bold',
                rank <= 3 ? 'text-emerald-600' : 'text-gray-500'
              )}>
                #{rank}
              </span>
              <span className={cn(
                'w-56 text-sm truncate',
                row.isUs ? 'font-bold text-blue-900' : 'text-gray-700'
              )}>
                {row.isUs && <Target className="inline w-3 h-3 mr-1" />}
                {row.name}
              </span>
              <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden relative">
                <div
                  className={cn('h-full transition-all duration-300', barColor)}
                  style={{ width: `${widthPct}%` }}
                />
                {/* Ligne médiane */}
                {dayData.compsetMedian > 0 && (
                  <div
                    className="absolute top-0 h-full border-l-2 border-dashed border-gray-700 opacity-50"
                    style={{ left: `${(dayData.compsetMedian / maxPrice) * 100}%` }}
                    title={`Médiane: ${dayData.compsetMedian}€`}
                  />
                )}
              </div>
              <span className={cn(
                'text-sm font-semibold w-16 text-right',
                row.isUs ? 'text-blue-900' : 'text-gray-900'
              )}>
                {Math.round(row.price)}€
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-500" /> Notre hôtel
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-400" /> ≥ médiane +10%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-400" /> ±10% médiane
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-400" /> ≤ médiane -10%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0.5 h-3 bg-gray-700 border-dashed" /> Ligne médiane
        </span>
      </div>
    </div>
  );
}
