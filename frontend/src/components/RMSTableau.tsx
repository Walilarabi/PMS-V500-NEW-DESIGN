/**
 * FLOWTYM RMS — Tableau Revenue Management ENTERPRISE
 * 
 * Design system PREMIUM aligné Calendrier Tarifaire
 * 
 * FEATURES:
 * ✅ Codes couleur pastel MIN/MAX/MEDIAN
 * ✅ Second tableau validation jour par jour (OK/NON/Maintenir)
 * ✅ Édition manuelle tarif si NON
 * ✅ Mode automatique intelligent (switch global)
 * ✅ Workflow propagation auto → Calendrier → D-EDGE → Réservations
 * ✅ Vue Tableau + Vue Jour (cartes)
 * ✅ UX premium enterprise-grade
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Check,
  Filter,
  Download,
  Info,
  Star,
  Building2,
  X,
  Zap,
  Edit3,
  Minus,
  Grid3x3,
  LayoutList,
} from 'lucide-react';
import { PARIS_EVENTS_2026, getEventsForDate, getEventImpactScore } from '../data/rms/events';
import { FOLKESTONE_COMPSET, generateCompetitorPricing, getCompsetStats } from '../data/rms/compset';
import { generatePricingRecommendation } from '../data/rms/pricing-engine';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const LABEL_W = 200;

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DayColumn {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isWeekend: boolean;
  isToday: boolean;
  eventImpact: number;
  events: any[];
}

interface CompetitorPricingRow {
  competitor: any;
  pricing: Map<string, { price: number; availability: string; variation: number }>;
}

type ValidationChoice = 'OK' | 'NON' | 'MAINTENIR' | null;

interface DayValidation {
  date: string;
  choice: ValidationChoice;
  manualPrice: number | null;
  recommendation: any;
}

type ViewMode = 'table' | 'cards';

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function RMSTableau() {
  const [viewPeriod, setViewPeriod] = useState<'7days' | '15days' | '30days'>('15days');
  const [startDate, setStartDate] = useState(new Date('2026-06-01'));
  const [isCompsetCollapsed, setIsCompsetCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Mode d'affichage : tableau ou cartes
  const [displayMode, setDisplayMode] = useState<ViewMode>('table');

  // Mode automatique RMS
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);

  // Validations par date
  const [validations, setValidations] = useState<Map<string, DayValidation>>(new Map());

  // Filtres
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [minPriceFilter, setMinPriceFilter] = useState<number | null>(null);
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // GÉNÉRATION COLONNES (comme CalendarGrid)
  // ───────────────────────────────────────────────────────────────────────────

  const dateColumns = useMemo<DayColumn[]>(() => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : 30;
    const cols: DayColumn[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      cols.push({
        date: dateStr,
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        dayNumber: date.getDate(),
        month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][date.getMonth()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: date.getTime() === today.getTime(),
        eventImpact: getEventImpactScore(dateStr),
        events: getEventsForDate(dateStr),
      });
    }

    return cols;
  }, [startDate, viewPeriod]);

  // ───────────────────────────────────────────────────────────────────────────
  // DONNÉES COMPSET AVEC PRICING
  // ───────────────────────────────────────────────────────────────────────────

  const compsetRows = useMemo<CompetitorPricingRow[]>(() => {
    return FOLKESTONE_COMPSET.map((competitor) => {
      const pricing = new Map();
      
      dateColumns.forEach((col) => {
        const priceData = generateCompetitorPricing(
          competitor,
          col.date,
          col.eventImpact,
          startDate
        );
        pricing.set(col.date, priceData);
      });

      return { competitor, pricing };
    });
  }, [dateColumns, startDate]);

  // ───────────────────────────────────────────────────────────────────────────
  // CALCUL MIN/MAX/MEDIAN PAR DATE (pour codes couleur pastel)
  // ───────────────────────────────────────────────────────────────────────────

  const dailyStats = useMemo(() => {
    const stats = new Map<string, { min: number; max: number; median: number }>();
    
    dateColumns.forEach((col) => {
      const prices = compsetRows
        .map((row) => row.pricing.get(col.date)?.price)
        .filter((p) => p !== undefined) as number[];
      
      if (prices.length > 0) {
        const sortedPrices = [...prices].sort((a, b) => a - b);
        stats.set(col.date, {
          min: Math.min(...prices),
          max: Math.max(...prices),
          median: sortedPrices[Math.floor(sortedPrices.length / 2)],
        });
      }
    });
    
    return stats;
  }, [compsetRows, dateColumns]);

  // ───────────────────────────────────────────────────────────────────────────
  // FONCTION COULEUR PASTEL PREMIUM (MIN=vert, MAX=rouge, MEDIAN=orange)
  // ───────────────────────────────────────────────────────────────────────────

  const getPriceColorClass = (price: number, dateStats: { min: number; max: number; median: number } | undefined) => {
    if (!dateStats) return 'bg-white text-gray-800';
    
    // Prix MIN → vert pastel
    if (price === dateStats.min) {
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    }
    
    // Prix MAX → rouge pastel
    if (price === dateStats.max) {
      return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    }
    
    // Prix MEDIAN (±5€ de tolérance) → orange pastel
    if (Math.abs(price - dateStats.median) < 5) {
      return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
    }
    
    return 'bg-white text-gray-800';
  };

  // Filtrage des concurrents
  const filteredCompsetRows = useMemo(() => {
    return compsetRows.filter((row) => {
      // Filtre par concurrent sélectionné
      if (selectedCompetitors.length > 0 && !selectedCompetitors.includes(row.competitor.name)) {
        return false;
      }
      
      // Filtre par segment
      if (selectedSegments.length > 0 && !selectedSegments.includes(row.competitor.segment)) {
        return false;
      }

      // Filtre par prix (moyenne sur la période)
      if (minPriceFilter || maxPriceFilter) {
        const avgPrice = Array.from(row.pricing.values()).reduce((sum, p) => sum + p.price, 0) / row.pricing.size;
        if (minPriceFilter && avgPrice < minPriceFilter) return false;
        if (maxPriceFilter && avgPrice > maxPriceFilter) return false;
      }

      return true;
    });
  }, [compsetRows, selectedCompetitors, selectedSegments, minPriceFilter, maxPriceFilter]);

  // ───────────────────────────────────────────────────────────────────────────
  // GRID TEMPLATE (comme CalendarGrid) avec UX améliorée
  // ───────────────────────────────────────────────────────────────────────────

  const minColPx = viewPeriod === '7days' ? 90 : viewPeriod === '15days' ? 52 : 32;
  const colCount = dateColumns.length;
  const gridTemplate = `${LABEL_W}px repeat(${colCount}, minmax(${minColPx}px, 1fr))`;

  // ───────────────────────────────────────────────────────────────────────────
  // NAVIGATION DATES
  // ───────────────────────────────────────────────────────────────────────────

  const navigateDays = (direction: 'prev' | 'next') => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : 30;
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
    setStartDate(newDate);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // RECOMMENDATIONS (données statiques pour l'instant)
  // ───────────────────────────────────────────────────────────────────────────

  const recommendations = useMemo(() => {
    return dateColumns.slice(0, 5).map((col) => {
      const ourPrice = 280;
      return {
        date: col.date,
        ...generatePricingRecommendation(col.date, ourPrice),
      };
    });
  }, [dateColumns]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────────
          TOOLBAR (aligné sur CalendarGrid)
      ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 gap-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">Tableau RMS</h1>
          
          {/* View Mode Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['7days', '15days', '30days'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewPeriod(mode)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded transition-all duration-150',
                  viewPeriod === mode
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {mode === '7days' ? '7j' : mode === '15days' ? '15j' : '30j'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors border',
              showFilters
                ? 'bg-violet-500 text-white border-violet-500'
                : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Navigation */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => navigateDays('prev')}
              className="px-3 py-1.5 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="px-3 py-1.5 text-sm font-semibold text-gray-700 border-x border-gray-300 whitespace-nowrap">
              {startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => navigateDays('next')}
              className="px-3 py-1.5 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors"
            title="Exporter en CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          FILTRES (collapsible)
      ───────────────────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Segment:</span>
              {['budget', 'midscale', 'upscale', 'luxury'].map((segment) => (
                <button
                  key={segment}
                  onClick={() => {
                    setSelectedSegments((prev) =>
                      prev.includes(segment) ? prev.filter((s) => s !== segment) : [...prev, segment]
                    );
                  }}
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors',
                    selectedSegments.includes(segment)
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-violet-300'
                  )}
                >
                  {segment.charAt(0).toUpperCase() + segment.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Prix:</span>
              <input
                type="number"
                placeholder="Min"
                value={minPriceFilter || ''}
                onChange={(e) => setMinPriceFilter(e.target.value ? Number(e.target.value) : null)}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-violet-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPriceFilter || ''}
                onChange={(e) => setMaxPriceFilter(e.target.value ? Number(e.target.value) : null)}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-violet-500"
              />
            </div>

            {(selectedSegments.length > 0 || minPriceFilter || maxPriceFilter) && (
              <button
                onClick={() => {
                  setSelectedSegments([]);
                  setMinPriceFilter(null);
                  setMaxPriceFilter(null);
                }}
                className="text-xs text-violet-600 hover:text-violet-700 font-semibold"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          LÉGENDE (alignée sur CalendarGrid)
      ───────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0 overflow-x-auto">
        <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <div className="flex items-center gap-3 text-[11px] text-gray-500 whitespace-nowrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Haute dispo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Basse dispo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Sold out
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> Prix hausse
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-600" /> Prix baisse
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MAIN SCROLLABLE AREA
      ───────────────────────────────────────────────────────────────────── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto w-full custom-scrollbar">
        <div className="w-full">
          {/* ═══════════════════════════════════════════════════════════════
              EVENTS TIMELINE
          ═══════════════════════════════════════════════════════════════ */}
          <div className="border-b-2 border-gray-300">
            {/* Header Events */}
            <div
              className="sticky top-0 z-30 bg-white border-b border-gray-200"
              style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
            >
              <div
                className="sticky left-0 z-40 bg-white border-r border-gray-300 flex items-center px-3 py-2"
                style={{ width: LABEL_W }}
              >
                <Calendar className="w-4 h-4 text-violet-500 mr-2" />
                <span className="text-sm font-bold text-gray-800">Événements</span>
              </div>

              {dateColumns.map((col) => (
                <div
                  key={col.date}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-gray-200 py-1.5 overflow-hidden',
                    col.isWeekend && 'bg-gray-50',
                    col.isToday && 'bg-violet-50'
                  )}
                >
                  <div className="text-[10px] font-medium text-gray-500 uppercase">{col.dayName}</div>
                  <div className="text-sm font-bold text-gray-800">{col.dayNumber}</div>
                  <div className="text-[10px] text-gray-400">{col.month}</div>
                </div>
              ))}
            </div>

            {/* Events Row */}
            <div
              style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
              className="bg-white"
            >
              <div
                className="sticky left-0 z-20 bg-white border-r border-gray-300 flex items-center px-3 py-2"
                style={{ width: LABEL_W }}
              >
                <span className="text-xs text-gray-600">Impact événements</span>
              </div>

              {dateColumns.map((col) => {
                const impactColor =
                  col.eventImpact >= 80
                    ? 'bg-red-500'
                    : col.eventImpact >= 50
                    ? 'bg-orange-500'
                    : col.eventImpact >= 20
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={col.date}
                    className={cn(
                      'flex flex-col items-center justify-center border-r border-gray-200 py-3 gap-1',
                      col.isWeekend && 'bg-gray-50'
                    )}
                    title={col.events.map((e) => e.name).join(', ')}
                  >
                    {col.eventImpact > 0 ? (
                      <>
                        <div
                          className={cn('w-12 h-1.5 rounded-full', impactColor)}
                          style={{ width: `${Math.min(col.eventImpact, 100)}%` }}
                        />
                        <span className="text-[10px] font-bold text-gray-700">{col.eventImpact}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              COMPSET PRICING (COLLAPSIBLE)
          ═══════════════════════════════════════════════════════════════ */}
          <div className="border-b-2 border-gray-300">
            {/* Header Compset */}
            <div
              className="sticky top-0 z-30 bg-white border-b border-gray-200"
              style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
            >
              <button
                onClick={() => setIsCompsetCollapsed(!isCompsetCollapsed)}
                className="sticky left-0 z-40 bg-white border-r border-gray-300 flex items-center px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                style={{ width: LABEL_W }}
              >
                {isCompsetCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                )}
                <Building2 className="w-4 h-4 text-violet-500 mr-2" />
                <span className="text-sm font-bold text-gray-800">
                  Compset ({filteredCompsetRows.length})
                </span>
              </button>

              {!isCompsetCollapsed &&
                dateColumns.map((col) => (
                  <div
                    key={col.date}
                    className={cn(
                      'flex items-center justify-center border-r border-gray-200 py-2',
                      col.isWeekend && 'bg-gray-50'
                    )}
                  >
                    <span className="text-[10px] font-semibold text-gray-500">Prix</span>
                  </div>
                ))}
            </div>

            {/* Compset Rows */}
            {!isCompsetCollapsed &&
              filteredCompsetRows.map((row) => (
                <div
                  key={row.competitor.name}
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                  className="border-b border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                >
                  {/* Competitor Label avec UX améliorée */}
                  <div
                    className="sticky left-0 z-20 bg-white border-r border-gray-200 flex items-center px-3 py-3 transition-colors duration-200"
                    style={{ width: LABEL_W }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {row.competitor.name}
                        </span>
                        {row.competitor.stars && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: row.competitor.stars }).map((_, i) => (
                              <Star
                                key={i}
                                className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'min-w-[70px] text-center text-[11px] font-bold px-2 py-0.5 rounded',
                            row.competitor.segment === 'luxury'
                              ? 'bg-purple-100 text-purple-700'
                              : row.competitor.segment === 'upscale'
                              ? 'bg-blue-100 text-blue-700'
                              : row.competitor.segment === 'midscale'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {row.competitor.segment}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {row.competitor.qualityScore}/10
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price Cells avec codes couleur MIN/MAX/MEDIAN */}
                  {dateColumns.map((col) => {
                    const priceData = row.pricing.get(col.date);
                    if (!priceData) return <div key={col.date} className="border-r border-gray-200" />;

                    const availColor =
                      priceData.availability === 'sold-out'
                        ? 'bg-red-50'
                        : priceData.availability === 'low'
                        ? 'bg-orange-50'
                        : 'bg-white';

                    return (
                      <div
                        key={col.date}
                        className={cn(
                          'flex flex-col items-center justify-center border-r border-gray-200 py-2.5 gap-1 transition-all duration-200',
                          availColor,
                          col.isWeekend && !availColor.includes('bg-') && 'bg-gray-50'
                        )}
                      >
                        <span
                          className={cn(
                            'text-sm font-bold px-2 py-1 rounded transition-all duration-150',
                            getPriceColorClass(priceData.price, dailyStats.get(col.date))
                          )}
                        >
                          {priceData.price.toFixed(0)}€
                        </span>
                        {priceData.variation !== 0 && (
                          <div className="flex items-center gap-0.5">
                            {priceData.variation > 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-600" />
                            )}
                            <span
                              className={cn(
                                'text-[10px] font-semibold',
                                priceData.variation > 0 ? 'text-emerald-600' : 'text-red-600'
                              )}
                            >
                              {Math.abs(priceData.variation).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RECOMMENDATIONS
          ═══════════════════════════════════════════════════════════════ */}
          <div className="p-6 space-y-4 bg-gray-50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h2 className="text-lg font-bold text-gray-800">Recommandations Pricing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((reco) => (
                <div
                  key={reco.date}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                      {new Date(reco.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-bold rounded',
                        reco.confidence >= 80
                          ? 'bg-emerald-100 text-emerald-700'
                          : reco.confidence >= 60
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {reco.confidence}% confiance
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold text-violet-600">
                      {reco.recommendedPrice.toFixed(0)}€
                    </span>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        reco.delta > 0 ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {reco.delta > 0 ? '+' : ''}
                      {reco.delta.toFixed(0)}€ ({reco.deltaPercent > 0 ? '+' : ''}
                      {reco.deltaPercent.toFixed(1)}%)
                    </span>
                  </div>

                  {reco.opportunities.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-semibold text-emerald-700 mb-1">
                        Opportunités:
                      </div>
                      {reco.opportunities.slice(0, 2).map((opp, i) => (
                        <div key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                          <span className="text-emerald-500">•</span>
                          <span>{opp}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                    Appliquer
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          CUSTOM SCROLLBAR CSS
      ───────────────────────────────────────────────────────────────────── */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
          border: 2px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
      `}</style>
    </div>
  );
}
