/**
 * FLOWTYM — PremiumDayDetailModal
 *
 * Modal premium réutilisable pour afficher le détail d'une date compset.
 * Remplace DayDetailModal (Veille) et CompsetDetailModal (RMS) pour éviter la duplication.
 *
 * Affichage :
 *   - Header : date + badges contextuels (événements, holidays, demande)
 *   - 3 KPI premium : notre prix, médiane, notre rang (avec deltas)
 *   - Carte "Notre hôtel" mise en évidence
 *   - Classement tarifaire avec barre de position + écart vs médiane + badges restrictions
 *   - Footer événements/jours fériés
 *
 * Source des données : LighthouseDayData (issu du store)
 */

import { useMemo } from 'react';
import {
  X, Target, TrendingUp, TrendingDown, Minus, Activity,
  Lock, Calendar, Sparkles, AlertCircle,
} from 'lucide-react';
import type { LighthouseDayData } from '../../../services/lighthouse-parser.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Helper : classifier une restriction depuis son rawValue ──────────────

function classifyRestriction(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  const v = rawValue.toLowerCase().trim();
  if (/\b(mins?|minstay|min ?stay|minimum stay)\b/.test(v)) return 'Min Stay';
  if (/\bcta\b/.test(v)) return 'CTA';
  if (/\bctd\b/.test(v)) return 'CTD';
  // LOS — extraire le chiffre si présent (ex: "LOS2" → "LOS 2")
  const losMatch = v.match(/los\s*(\d+)/);
  if (losMatch) return `LOS ${losMatch[1]}`;
  if (/\blos\b|\bmaxlos\b|\bminlos\b/.test(v)) return 'LOS';
  if (/\brestrict|closed|fermé|ferme\b/.test(v)) return 'Fermé';
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────

export interface PremiumDayDetailModalProps {
  date: string;
  ourHotelName: string;
  dayData: LighthouseDayData | null;
  onClose: () => void;
}

export function PremiumDayDetailModal({
  date, ourHotelName, dayData, onClose,
}: PremiumDayDetailModalProps) {
  // Empty state
  if (!dayData) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Détail indisponible</h2>
          <p className="text-sm text-gray-600 mb-6">
            Aucune donnée Lighthouse pour la date <strong>{date}</strong>.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
          >
            Fermer
          </button>
        </div>
      </Backdrop>
    );
  }

  // ─── Calculs de ranking ────────────────────────────────────────────
  const { ranked, unavailable, ourPosition, totalRanked, maxPrice, minPrice } = useMemo(() => {
    const allHotels: Array<{
      name: string;
      price: number;
      isUs: boolean;
      status: string;
      restriction: string | null;
    }> = [
      { name: ourHotelName, price: dayData.ourPrice, isUs: true, status: 'available', restriction: null },
      ...dayData.competitors.map(c => ({
        name: c.hotelName,
        price: c.price ?? Infinity,
        isUs: false,
        status: c.status,
        restriction: classifyRestriction(c.rawValue),
      })),
    ];
    const ranked = allHotels
      .filter(h => h.status === 'available' && h.price > 0 && isFinite(h.price))
      .sort((a, b) => a.price - b.price);
    const unavailable = allHotels.filter(h => h.status !== 'available' || h.price === 0 || !isFinite(h.price));
    const ourPosition = ranked.findIndex(h => h.isUs) + 1;
    const totalRanked = ranked.length;
    const maxPrice = ranked.length > 0 ? ranked[ranked.length - 1].price : 1;
    const minPrice = ranked.length > 0 ? ranked[0].price : 0;
    return { ranked, unavailable, ourPosition, totalRanked, maxPrice, minPrice };
  }, [dayData, ourHotelName]);

  // ─── Deltas vs médiane ──
  const ourPriceDeltaVsMedian = dayData.ourPrice - dayData.compsetMedian;
  const ourPriceDeltaPercent = dayData.compsetMedian > 0
    ? (ourPriceDeltaVsMedian / dayData.compsetMedian) * 100
    : 0;

  // ─── Comptages restrictions ──
  const restrictionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of dayData.competitors) {
      if (c.status === 'restricted') {
        const type = classifyRestriction(c.rawValue) || 'Autre';
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    const soldOut = dayData.competitors.filter(c => c.status === 'sold_out').length;
    return { counts, soldOut, totalRestricted: dayData.competitors.filter(c => c.status === 'restricted').length };
  }, [dayData]);

  // ─── Pressure color ──
  const demand = dayData.marketDemandPercent;
  const demandColor =
    demand >= 85 ? 'bg-red-50 text-red-700 border-red-200' :
    demand >= 70 ? 'bg-orange-50 text-orange-700 border-orange-200' :
    demand >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── HEADER premium ──────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-7 py-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {dayData.dayName} {date}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Détail compset · {totalRanked} hôtels disponibles · {restrictionStats.totalRestricted + restrictionStats.soldOut} en restriction
              </p>
            </div>
          </div>

          {/* Badges contextuels */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
              demandColor,
            )}>
              <Activity className="w-3 h-3" />
              Demande {demand}%
            </span>
            {dayData.ranking && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-xs text-white/90">
                Rang Lighthouse : <span className="font-semibold">{dayData.ranking}</span>
              </span>
            )}
            {dayData.holidays && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs font-medium border border-amber-400/30">
                📅 {dayData.holidays}
              </span>
            )}
            {dayData.events && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-medium border border-purple-400/30">
                🎉 {dayData.events}
              </span>
            )}
          </div>
        </div>

        {/* ─── 3 KPI premium ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {/* Notre prix */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Notre prix</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-blue-700 tabular-nums">{dayData.ourPrice}€</p>
              {dayData.compsetMedian > 0 && (
                <DeltaBadge value={ourPriceDeltaVsMedian} suffix="€" tone={ourPriceDeltaPercent > 0 ? 'up' : ourPriceDeltaPercent < 0 ? 'down' : 'flat'} />
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {ourPriceDeltaPercent !== 0 ? `${ourPriceDeltaPercent > 0 ? '+' : ''}${ourPriceDeltaPercent.toFixed(1)}% vs médiane` : 'À la médiane'}
            </p>
          </div>

          {/* Médiane + range */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Minus className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Compset</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{dayData.compsetMedian}€</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Min <span className="font-mono font-semibold text-emerald-600">{dayData.compsetMin ?? '—'}€</span> ·
              Max <span className="font-mono font-semibold text-orange-600 ml-1">{dayData.compsetMax ?? '—'}€</span>
            </p>
          </div>

          {/* Notre rang */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Notre rang</span>
            </div>
            {ourPosition > 0 ? (
              <>
                <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                  #{ourPosition}<span className="text-base text-gray-400 font-medium"> / {totalRanked}</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {ourPosition === 1 ? 'Plus cher du compset' :
                   ourPosition === totalRanked ? 'Plus accessible du compset' :
                   ourPosition <= Math.ceil(totalRanked / 3) ? 'Positionnement premium' :
                   ourPosition >= Math.floor(totalRanked * 2 / 3) ? 'Positionnement compétitif' :
                   'Positionnement médian'}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-400">—</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Pas de prix disponible</p>
              </>
            )}
          </div>
        </div>

        {/* ─── Bandeau restrictions (si présentes) ─────────────────── */}
        {(restrictionStats.totalRestricted > 0 || restrictionStats.soldOut > 0) && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-wrap">
            <Lock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-900">Restrictions détectées :</span>
            {Object.entries(restrictionStats.counts).map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-800">
                {type}
                <span className="font-bold">×{count}</span>
              </span>
            ))}
            {restrictionStats.soldOut > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-red-100 border border-red-200 text-red-800">
                Épuisés
                <span className="font-bold">×{restrictionStats.soldOut}</span>
              </span>
            )}
          </div>
        )}

        {/* ─── Classement tarifaire ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Classement tarifaire</h3>
            <span className="text-[11px] text-gray-400">Trié du moins cher au plus cher</span>
          </div>

          <div className="space-y-1">
            {ranked.map((h, idx) => {
              const widthPct = maxPrice > 0 ? (h.price / maxPrice) * 100 : 0;
              const diffMedian = dayData.compsetMedian > 0 ? ((h.price - dayData.compsetMedian) / dayData.compsetMedian) * 100 : 0;
              return (
                <RankRow
                  key={h.name}
                  rank={idx + 1}
                  total={totalRanked}
                  hotelName={h.name}
                  isUs={h.isUs}
                  price={h.price}
                  widthPct={widthPct}
                  diffMedian={diffMedian}
                  isBestPrice={idx === 0}
                  isHighestPrice={idx === totalRanked - 1}
                />
              );
            })}
          </div>

          {/* Non disponibles */}
          {unavailable.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2 font-medium">
                Non disponibles ({unavailable.length})
              </p>
              <div className="space-y-1">
                {unavailable.map(h => (
                  <div key={h.name} className="flex items-center gap-3 px-3 py-2 rounded bg-gray-50 text-xs">
                    <span className="flex-1 text-gray-600">{h.name}</span>
                    {h.restriction && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {h.restriction}
                      </span>
                    )}
                    <span className={cn(
                      'px-2 py-0.5 rounded font-semibold',
                      h.status === 'sold_out' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                    )}>
                      {h.status === 'sold_out' ? 'Épuisé' : h.status === 'restricted' ? 'Restreint' : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function DeltaBadge({ value, suffix, tone }: { value: number; suffix?: string; tone: 'up' | 'down' | 'flat' }) {
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;
  const colorClass =
    tone === 'up' ? 'bg-emerald-100 text-emerald-700' :
    tone === 'down' ? 'bg-red-100 text-red-700' :
    'bg-gray-100 text-gray-600';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded', colorClass)}>
      <Icon className="w-3 h-3" />
      {value >= 0 ? '+' : ''}{Math.round(value)}{suffix}
    </span>
  );
}

function RankRow({
  rank, total, hotelName, isUs, price, widthPct, diffMedian, isBestPrice, isHighestPrice,
}: {
  rank: number;
  total: number;
  hotelName: string;
  isUs: boolean;
  price: number;
  widthPct: number;
  diffMedian: number;
  isBestPrice: boolean;
  isHighestPrice: boolean;
}) {
  // Couleur du rang : top 3 = vert/bleu, mid = gris, bas = orange
  const rankColor =
    isBestPrice ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300' :
    rank <= 3 ? 'bg-blue-100 text-blue-700' :
    rank > total * 0.66 ? 'bg-orange-50 text-orange-600' :
    'bg-gray-100 text-gray-600';

  const barColor =
    isUs ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
    isBestPrice ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
    isHighestPrice ? 'bg-gradient-to-r from-orange-300 to-orange-400' :
    'bg-gradient-to-r from-gray-300 to-gray-400';

  const diffColor =
    Math.abs(diffMedian) < 3 ? 'text-gray-400' :
    diffMedian > 0 ? 'text-emerald-600' : 'text-red-600';

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
        isUs
          ? 'bg-blue-50 border-2 border-blue-400 shadow-sm'
          : 'hover:bg-gray-50 border border-transparent',
      )}
    >
      {/* Rang */}
      <span className={cn(
        'w-7 h-7 inline-flex items-center justify-center text-xs font-bold rounded-full flex-shrink-0',
        rankColor,
      )}>
        {rank}
      </span>

      {/* Nom hôtel */}
      <span className={cn(
        'flex-shrink-0 max-w-[180px] truncate text-sm flex items-center gap-1.5',
        isUs ? 'font-bold text-blue-900' : 'text-gray-700',
      )}>
        {isUs && <Target className="w-3 h-3 text-blue-500" />}
        {hotelName}
        {isBestPrice && !isUs && (
          <span className="text-[9px] font-bold px-1 py-0.5 bg-emerald-200 text-emerald-800 rounded uppercase">
            Best
          </span>
        )}
      </span>

      {/* Barre de position visuelle */}
      <div className="flex-1 min-w-0 mx-2 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.max(widthPct, 4)}%` }}
        />
      </div>

      {/* Écart vs médiane */}
      <span className={cn('text-[10px] font-semibold w-12 text-right tabular-nums', diffColor)}>
        {Math.abs(diffMedian) >= 0.5 ? `${diffMedian > 0 ? '+' : ''}${diffMedian.toFixed(0)}%` : '—'}
      </span>

      {/* Prix */}
      <span className={cn(
        'text-sm font-bold w-20 text-right tabular-nums flex-shrink-0',
        isUs ? 'text-blue-700' : 'text-gray-900',
      )}>
        {Math.round(price)}€
      </span>
    </div>
  );
}
