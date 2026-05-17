/**
 * FLOWTYM — VEILLE CONCURRENTIELLE
 * 
 * Module d'analyse marché dédié comprenant :
 * - Suivi concurrents temps réel
 * - Évolution tarifaire (historique 90j)
 * - Disponibilité estimée
 * - Pression marché dynamique
 * - Positionnement prix
 * - Comparaison multi-critères
 * - Historique variations
 * - Alertes pricing
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { FOLKESTONE_COMPSET, generateCompetitorPricing } from '../../data/rms/compset';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DateColumn {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isWeekend: boolean;
}

interface CompetitorRow {
  competitor: any;
  pricing: Map<string, { price: number; availability: string; variation: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function VeilleConcurrentielle() {
  const [viewPeriod, setViewPeriod] = useState<'7days' | '15days' | '30days' | '60days' | '90days'>('30days');
  const [startDate, setStartDate] = useState(new Date('2026-06-01'));
  const [isCompsetCollapsed, setIsCompsetCollapsed] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  // Génération colonnes dates
  const dateColumns = useMemo<DateColumn[]>(() => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : viewPeriod === '30days' ? 30 : viewPeriod === '60days' ? 60 : 90;
    const cols: DateColumn[] = [];

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
      });
    }

    return cols;
  }, [startDate, viewPeriod]);

  // Génération données compset
  const compsetRows = useMemo<CompetitorRow[]>(() => {
    return FOLKESTONE_COMPSET.map((competitor) => {
      const pricing = new Map();
      
      dateColumns.forEach((col) => {
        const priceData = generateCompetitorPricing(
          competitor,
          col.date,
          Math.random() * 100, // Mock event impact
          startDate
        );
        pricing.set(col.date, priceData);
      });

      return { competitor, pricing };
    });
  }, [dateColumns, startDate]);

  // Filtrage
  const filteredRows = useMemo(() => {
    if (selectedSegments.length === 0) return compsetRows;
    return compsetRows.filter((row) => selectedSegments.includes(row.competitor.segment));
  }, [compsetRows, selectedSegments]);

  // Stats globales
  const dailyStats = useMemo(() => {
    const stats = new Map<string, { min: number; max: number; median: number; avg: number }>();
    
    dateColumns.forEach((col) => {
      const prices = filteredRows
        .map((row) => row.pricing.get(col.date)?.price)
        .filter((p) => p !== undefined) as number[];
      
      if (prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a - b);
        stats.set(col.date, {
          min: Math.min(...prices),
          max: Math.max(...prices),
          median: sorted[Math.floor(sorted.length / 2)],
          avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
        });
      }
    });
    
    return stats;
  }, [filteredRows, dateColumns]);

  const gridTemplate = `200px repeat(${Math.min(dateColumns.length, 30)}, minmax(52px, 1fr))`;

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-violet-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Veille Concurrentielle</h1>
            <p className="text-sm text-gray-500">Analyse marché temps réel · {filteredRows.length} concurrents suivis</p>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          {/* Period */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['7days', '15days', '30days', '60days', '90days'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setViewPeriod(period)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded transition-all duration-150',
                  viewPeriod === period
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {period === '7days' ? '7j' : period === '15days' ? '15j' : period === '30days' ? '30j' : period === '60days' ? '60j' : '90j'}
              </button>
            ))}
          </div>

          {/* Filtres Segments */}
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
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors">
          <Download className="w-3.5 h-3.5" />
          Exporter
        </button>
      </div>

      {/* STATS RÉSUMÉ */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-emerald-700 mb-1">Prix MIN moyen</div>
            <div className="text-2xl font-bold text-emerald-700">
              {Array.from(dailyStats.values()).length > 0
                ? Math.round(
                    Array.from(dailyStats.values()).reduce((sum, s) => sum + s.min, 0) /
                      dailyStats.size
                  )
                : 0}
              €
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-orange-700 mb-1">Prix MÉDIANE moyen</div>
            <div className="text-2xl font-bold text-orange-700">
              {Array.from(dailyStats.values()).length > 0
                ? Math.round(
                    Array.from(dailyStats.values()).reduce((sum, s) => sum + s.median, 0) /
                      dailyStats.size
                  )
                : 0}
              €
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-red-700 mb-1">Prix MAX moyen</div>
            <div className="text-2xl font-bold text-red-700">
              {Array.from(dailyStats.values()).length > 0
                ? Math.round(
                    Array.from(dailyStats.values()).reduce((sum, s) => sum + s.max, 0) /
                      dailyStats.size
                  )
                : 0}
              €
            </div>
          </div>

          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-violet-700 mb-1">Écart moyen MIN-MAX</div>
            <div className="text-2xl font-bold text-violet-700">
              {Array.from(dailyStats.values()).length > 0
                ? Math.round(
                    Array.from(dailyStats.values()).reduce((sum, s) => sum + (s.max - s.min), 0) /
                      dailyStats.size
                  )
                : 0}
              €
            </div>
          </div>
        </div>
      </div>

      {/* TABLEAU COMPSET */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="border-b-2 border-gray-300">
          {/* Header */}
          <div
            className="sticky top-0 z-30 bg-white border-b border-gray-200"
            style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
          >
            <button
              onClick={() => setIsCompsetCollapsed(!isCompsetCollapsed)}
              className="sticky left-0 z-40 bg-white border-r border-gray-300 flex items-center px-3 py-2 hover:bg-gray-50 transition-colors text-left"
            >
              {isCompsetCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
              )}
              <Building2 className="w-4 h-4 text-violet-500 mr-2" />
              <span className="text-sm font-bold text-gray-800">
                Compset ({filteredRows.length})
              </span>
            </button>

            {!isCompsetCollapsed &&
              dateColumns.slice(0, 30).map((col) => (
                <div
                  key={col.date}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-gray-200 py-1.5 overflow-hidden',
                    col.isWeekend && 'bg-gray-50'
                  )}
                >
                  <div className="text-[10px] font-medium text-gray-500 uppercase">{col.dayName}</div>
                  <div className="text-sm font-bold text-gray-800">{col.dayNumber}</div>
                  <div className="text-[10px] text-gray-400">{col.month}</div>
                </div>
              ))}
          </div>

          {/* Rows */}
          {!isCompsetCollapsed &&
            filteredRows.map((row) => (
              <div
                key={row.competitor.name}
                style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                className="border-b border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
              >
                {/* Label */}
                <div className="sticky left-0 z-20 bg-white border-r border-gray-200 flex items-center px-3 py-3">
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

                {/* Price Cells */}
                {dateColumns.slice(0, 30).map((col) => {
                  const priceData = row.pricing.get(col.date);
                  const stats = dailyStats.get(col.date);
                  
                  if (!priceData) return <div key={col.date} className="border-r border-gray-200" />;

                  // Determine color
                  let colorClass = 'bg-white text-gray-800';
                  if (stats) {
                    if (priceData.price === stats.min) {
                      colorClass = 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
                    } else if (priceData.price === stats.max) {
                      colorClass = 'bg-red-50 text-red-700 ring-1 ring-red-200';
                    } else if (Math.abs(priceData.price - stats.median) < 5) {
                      colorClass = 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
                    }
                  }

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
                        'flex flex-col items-center justify-center border-r border-gray-200 py-2.5 gap-1',
                        col.isWeekend && !availColor.includes('bg-') && 'bg-gray-50'
                      )}
                    >
                      <span className={cn('text-sm font-bold px-2 py-1 rounded', colorClass)}>
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
      </div>

      {/* Custom Scrollbar */}
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
      `}</style>
    </div>
  );
}
