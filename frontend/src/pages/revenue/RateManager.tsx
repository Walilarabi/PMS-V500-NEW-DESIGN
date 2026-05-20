/**
 * FLOWTYM RATE MANAGER — CŒUR INTELLIGENT
 * 
 * Mission : Maximiser RevPAR = ADR × Taux d'Occupation
 * 
 * Design inspiré : Duetto / IDeaS / Atomize / Base44
 * 
 * Architecture :
 * 1. Heatmap Prédictive 14j (TO + Pression marché)
 * 2. Toolbar ultra-performante (Période/Vue/AutoPilot/Export)
 * 3. Tableau RMS métier 23 colonnes
 * 4. Vue Jour (cards responsive)
 * 5. Vue Kanban (3 colonnes stratégiques)
 * 
 * Logique métier :
 * - 8 Stratégies automatiques
 * - 11 Facteurs pondérés
 * - Moteur recommandation IA
 * - Workflow propagation Channel Manager
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Minus,
  Eye,
  Grid3x3,
  LayoutList,
  Columns3,
  ChevronRight,
  Filter,
  Download,
  Zap,
  Target,
  Bot,
  RotateCw,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { RMSPropagationService, RMSValidation } from '../../services/rms-propagation.service';
import { syncRMSDecision } from '../../services/rms-calendar-sync.service';
import { getEventsForDate } from '../../utils/events-parser';
import { getMarketDataForDate, getMarketPressure, getMarketPressureColor } from '../../utils/lighthouse-parser';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES MÉTIER
// ═══════════════════════════════════════════════════════════════════════════

type Strategy =
  | 'Agressive'
  | 'Équilibrée'
  | 'Défensive'
  | 'Opportuniste'
  | 'Haute demande'
  | 'Last Minute'
  | 'Occupation faible'
  | 'Yield Max';

type Recommendation = 'Augmenter' | 'Baisser' | 'Maintenir';
type ValidationStatus = 'En attente' | 'Acceptée' | 'Refusée' | 'Maintenue';
type ViewMode = 'table' | 'cards' | 'kanban';
type ViewPeriod = '7days' | '1month' | '60days' | '90days';

interface DayData {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isWeekend: boolean;
  isToday: boolean;
  
  // Événements & Marché
  events: string[];
  marketPressure: number; // 0-100
  
  // Occupation & Disponibilité
  occupancyRate: number; // TO en %
  availability: number; // Chambres disponibles
  
  // Prix Compset
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  
  // Comportement Client
  leadTimeMajority: number;
  pickupRate: number;
  
  // Stratégie & Recommandation
  strategy: Strategy;
  recommendation: Recommendation;
  confidenceScore: number;
  
  // Prix
  currentPrice: number;
  suggestedPrice: number;
  finalPrice: number | null;
  
  // Validation
  validationStatus: ValidationStatus;
  selected: boolean;
}

interface HeatmapDay {
  date: string;
  dayName: string;
  dayNumber: number;
  to: number;
  pressure: number;
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE — LOGIQUE MÉTIER INTELLIGENTE
// ═══════════════════════════════════════════════════════════════════════════

function calculateStrategy(data: Partial<DayData>): Strategy {
  const {
    occupancyRate = 50,
    leadTimeMajority = 14,
    pickupRate = 0,
    marketPressure = 0,
    availability = 10,
    isWeekend = false,
  } = data;

  if (occupancyRate > 90 && marketPressure > 80) return 'Yield Max';
  if (occupancyRate > 85 && pickupRate > 15) return 'Haute demande';
  if (leadTimeMajority < 3 && availability > 15) return 'Last Minute';
  if (occupancyRate < 30 && leadTimeMajority < 7) return 'Occupation faible';
  if (marketPressure > 70 && occupancyRate < 60) return 'Opportuniste';
  if (occupancyRate < 40 && leadTimeMajority > 30) return 'Agressive';
  if (occupancyRate > 70 && leadTimeMajority < 7) return 'Défensive';
  
  return 'Équilibrée';
}

function calculateRecommendation(data: Partial<DayData>): {
  recommendation: Recommendation;
  suggestedPrice: number;
  confidence: number;
} {
  const {
    strategy = 'Équilibrée',
    currentPrice = 280,
    medianPrice = 300,
    minPrice = 250,
    maxPrice = 350,
    occupancyRate = 50,
    marketPressure = 0,
    pickupRate = 0,
  } = data;

  let recommendation: Recommendation = 'Maintenir';
  let priceAdjustment = 1.0;
  let confidence = 70;

  switch (strategy) {
    case 'Yield Max':
      recommendation = 'Augmenter';
      priceAdjustment = 1.20;
      confidence = 95;
      break;
    case 'Haute demande':
      recommendation = 'Augmenter';
      priceAdjustment = 1.15;
      confidence = 90;
      break;
    case 'Opportuniste':
      recommendation = 'Augmenter';
      priceAdjustment = 1.12;
      confidence = 85;
      break;
    case 'Défensive':
      if (currentPrice < medianPrice * 0.95) {
        recommendation = 'Augmenter';
        priceAdjustment = 1.08;
        confidence = 75;
      } else {
        recommendation = 'Maintenir';
        confidence = 80;
      }
      break;
    case 'Agressive':
      recommendation = 'Baisser';
      priceAdjustment = 0.88;
      confidence = 80;
      break;
    case 'Occupation faible':
      recommendation = 'Baisser';
      priceAdjustment = 0.90;
      confidence = 85;
      break;
    case 'Last Minute':
      if (occupancyRate < 50) {
        recommendation = 'Baisser';
        priceAdjustment = 0.92;
        confidence = 75;
      } else {
        recommendation = 'Maintenir';
        confidence = 70;
      }
      break;
    case 'Équilibrée':
      if (currentPrice < medianPrice * 0.92) {
        recommendation = 'Augmenter';
        priceAdjustment = 1.05;
        confidence = 65;
      } else if (currentPrice > medianPrice * 1.08) {
        recommendation = 'Baisser';
        priceAdjustment = 0.97;
        confidence = 65;
      }
      break;
  }

  if (marketPressure > 80) confidence += 10;
  if (pickupRate > 20) confidence += 5;

  const suggestedPrice = Math.round(currentPrice * priceAdjustment);
  confidence = Math.min(100, confidence);

  return { recommendation, suggestedPrice, confidence };
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateMockData(startDate: Date, days: number): DayData[] {
  const data: DayData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const daysSinceToday = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const occupancyRate = Math.min(95, Math.max(20, 60 + Math.random() * 30 + (isWeekend ? 10 : 0)));
    const availability = Math.round(30 - (occupancyRate / 100) * 25);
    const leadTimeMajority = Math.max(1, Math.round(daysSinceToday + Math.random() * 15));
    const pickupRate = Math.random() * 25;
    const marketPressure = Math.random() * 100;
    
    const medianPrice = 300 + Math.random() * 50 - 25;
    const minPrice = medianPrice * (0.85 + Math.random() * 0.05);
    const maxPrice = medianPrice * (1.10 + Math.random() * 0.10);
    const currentPrice = 280;

    const partialData: Partial<DayData> = {
      occupancyRate,
      leadTimeMajority,
      pickupRate,
      marketPressure,
      availability,
      isWeekend,
      currentPrice,
      medianPrice,
      minPrice,
      maxPrice,
    };

    const strategy = calculateStrategy(partialData);
    const { recommendation, suggestedPrice, confidence } = calculateRecommendation({
      ...partialData,
      strategy,
    });

    // ✅ ÉVÉNEMENTS RÉELS (depuis fichier salons)
    const realEvents = getEventsForDate(date);
    const events = realEvents.map(e => e.name);

    // ✅ MARKET PRESSURE RÉELLE (depuis Lighthouse)
    const marketData = getMarketDataForDate(date);
    const realMarketPressure = marketData 
      ? getMarketPressure(marketData.marketDemand)
      : marketPressure; // fallback sur mock si pas de data

    data.push({
      date: dateStr,
      dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
      dayNumber: date.getDate(),
      month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][date.getMonth()],
      isWeekend,
      isToday: date.getTime() === today.getTime(),
      events, // ✅ Vraies données événements
      marketPressure: realMarketPressure, // ✅ Vraie pression marché
      occupancyRate,
      availability,
      medianPrice: marketData?.compsetMedian || medianPrice, // ✅ Vraie médiane compset
      minPrice,
      maxPrice,
      leadTimeMajority,
      pickupRate,
      strategy,
      recommendation,
      confidenceScore: confidence,
      currentPrice: marketData?.ourPrice || currentPrice, // ✅ Vrai prix actuel
      suggestedPrice,
      finalPrice: null,
      validationStatus: 'En attente',
      selected: false,
    });
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function RateManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('1month');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [autoPilot, setAutoPilot] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [rmsData, setRmsData] = useState<DayData[]>([]);
  const [manualPrices, setManualPrices] = useState<Map<string, number>>(new Map());
  const [selectedDateForDetails, setSelectedDateForDetails] = useState<string | null>(null);
  
  // Propagation states
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagationProgress, setPropagationProgress] = useState(0);
  const [propagationMessage, setPropagationMessage] = useState('');

  // Génération données
  useMemo(() => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '1month' ? 30 : viewPeriod === '60days' ? 60 : 90;
    setRmsData(generateMockData(startDate, days));
  }, [startDate, viewPeriod]);

  // Heatmap data (14 premiers jours)
  const heatmapData: HeatmapDay[] = useMemo(() => {
    return rmsData.slice(0, 14).map((d) => ({
      date: d.date,
      dayName: d.dayName,
      dayNumber: d.dayNumber,
      to: d.occupancyRate,
      pressure: d.marketPressure,
    }));
  }, [rmsData]);

  // Navigation
  const navigateDays = (direction: 'prev' | 'next') => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '1month' ? 30 : viewPeriod === '60days' ? 60 : 90;
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
    setStartDate(newDate);
  };

  const handleNavigate = (page: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }));
  };

  // Handlers validation (avec sync immédiat vers Calendrier Tarifaire)
  const handleAccept = useCallback((date: string) => {
    setRmsData((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const next = { ...d, finalPrice: d.suggestedPrice, validationStatus: 'Acceptée' as ValidationStatus };
        syncRMSDecision({
          date: next.date,
          finalPrice: next.suggestedPrice,
          status: 'Acceptée',
          source: 'table',
        });
        return next;
      })
    );
  }, []);

  const handleReject = useCallback((date: string) => {
    setRmsData((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const finalPrice = manualPrices.get(date) || d.currentPrice;
        const next = { ...d, finalPrice, validationStatus: 'Refusée' as ValidationStatus };
        syncRMSDecision({
          date: next.date,
          finalPrice,
          status: 'Refusée',
          source: 'table',
        });
        return next;
      })
    );
  }, [manualPrices]);

  const handleManualPriceChange = useCallback((date: string, price: number) => {
    setManualPrices((prev) => {
      const newMap = new Map(prev);
      newMap.set(date, price);
      return newMap;
    });
    // Update finalPrice immédiatement
    setRmsData((prev) =>
      prev.map((d) =>
        d.date === date ? { ...d, finalPrice: price } : d
      )
    );
  }, []);

  const handleMaintain = useCallback((date: string) => {
    setRmsData((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const next = { ...d, finalPrice: d.currentPrice, validationStatus: 'Maintenue' as ValidationStatus };
        syncRMSDecision({
          date: next.date,
          finalPrice: d.currentPrice,
          status: 'Maintenue',
          source: 'table',
        });
        return next;
      })
    );
  }, []);

  const handleToggleSelect = useCallback((date: string) => {
    setRmsData((prev) =>
      prev.map((d) => (d.date === date ? { ...d, selected: !d.selected } : d))
    );
  }, []);

  // Propagation
  const handlePropagate = useCallback(async () => {
    const validated = rmsData.filter((d) => d.finalPrice !== null);
    
    if (validated.length === 0) {
      alert('Aucune validation à propager');
      return;
    }

    setIsPropagating(true);
    setPropagationProgress(0);
    setPropagationMessage('Préparation...');

    try {
      const validations: RMSValidation[] = validated.map((d) => ({
        date: d.date,
        finalPrice: d.finalPrice!,
        strategy: d.strategy,
        recommendation: d.recommendation,
        confidence: d.confidenceScore,
        currentPrice: d.currentPrice,
        suggestedPrice: d.suggestedPrice,
      }));

      const result = await RMSPropagationService.propagateWithProgress(
        validations,
        'tenant_demo',
        'user_demo',
        (progress, message) => {
          setPropagationProgress(progress);
          setPropagationMessage(message);
        }
      );

      if (result.success) {
        alert(
          `✅ Propagation réussie!\n\n` +
          `${result.validationsCount} tarifs propagés\n` +
          `Calendrier: ${result.pricingCalendarUpdated ? '✓' : '✗'}\n` +
          `Channel Manager: ${result.channelManagerSynced ? '✓' : '✗'}\n` +
          `Cache: ${result.cacheUpdated ? '✓' : '✗'}\n` +
          `Audit: ${result.auditLogCreated ? '✓' : '✗'}`
        );
      } else {
        alert(`❌ Propagation échouée:\n${result.errors.join('\n')}`);
      }
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setIsPropagating(false);
      setPropagationProgress(0);
      setPropagationMessage('');
    }
  }, [rmsData]);

  // Recalculate (force refresh)
  const handleRecalculate = () => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '1month' ? 30 : viewPeriod === '60days' ? 60 : 90;
    setRmsData(generateMockData(startDate, days));
  };

  // Export PDF
  const handleExportPDF = () => {
    alert('Export PDF en cours de développement');
  };

  const validatedCount = rmsData.filter((d) => d.validationStatus !== 'En attente').length;

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <RevenueHeader
        icon={Target}
        title="Rate Manager — Cœur Intelligent"
        subtitle="Calendrier dynamique avec AutoPilot et détection JJ critique"
        quickActions={[
          {
            label: 'Historique',
            icon: FileText,
            onClick: () => handleNavigate('rms_history'),
          },
          {
            label: 'Veille Compset',
            icon: Sparkles,
            onClick: () => handleNavigate('rev_compset'),
          },
        ]}
      />

      {/* HEATMAP PRÉDICTIVE — 14 JOURS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Heatmap Prédictive — Pression Marché</h3>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {heatmapData.map((day) => {
            // Couleur selon TO
            const bgColor =
              day.to >= 90
                ? 'bg-red-100 border-red-200'
                : day.to >= 75
                ? 'bg-amber-100 border-amber-200'
                : day.to >= 50
                ? 'bg-emerald-100 border-emerald-200'
                : 'bg-cyan-100 border-cyan-200';

            return (
              <div
                key={day.date}
                className={cn(
                  'rounded-lg border p-3 text-center transition-all hover:shadow-md',
                  bgColor
                )}
              >
                <div className="text-[10px] font-medium text-gray-600 uppercase mb-1">
                  {day.dayName}
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">{day.dayNumber}</div>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <span className="font-semibold text-gray-700">TO:</span>
                  <span className="font-bold">{day.to.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs mt-0.5">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    day.pressure > 70 ? 'bg-red-500' : day.pressure > 40 ? 'bg-amber-500' : 'bg-green-500'
                  )} />
                  <span className="text-[10px] font-medium">{day.pressure.toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Période */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['7days', '1month', '60days', '90days'] as ViewPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setViewPeriod(period)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded transition-all duration-150',
                  viewPeriod === period
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {period === '7days' ? '7j' : period === '1month' ? '1mois' : period === '60days' ? '60j' : '90j'}
              </button>
            ))}
          </div>

          {/* Vue */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all',
                viewMode === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tableau
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all',
                viewMode === 'cards' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              Jour
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all',
                viewMode === 'kanban' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              )}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>

          {/* AutoPilot */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <Bot className={cn('w-4 h-4', autoPilot ? 'text-blue-600' : 'text-gray-400')} />
            <span className="text-sm font-semibold text-gray-700">AutoPilot</span>
            <button
              onClick={() => setAutoPilot(!autoPilot)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                autoPilot ? 'bg-blue-600' : 'bg-gray-300'
              )}
              title={autoPilot ? 'AutoPilot activé' : 'AutoPilot désactivé'}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  autoPilot ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Recalculer */}
          <button
            onClick={handleRecalculate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Recalculer
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation */}
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

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* STATUS BAR */}
      {validatedCount > 0 && (
        <div className="flex items-center justify-between px-6 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-sm text-blue-700">
              <span className="font-bold">{validatedCount}</span> recommandation(s) validée(s)
            </div>
            
            {isPropagating && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{propagationMessage}</span>
                <span className="font-bold">{propagationProgress}%</span>
              </div>
            )}
          </div>
          
          <button
            onClick={handlePropagate}
            disabled={isPropagating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPropagating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Propagation...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Propager ({validatedCount})
              </>
            )}
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'table' && (
          <TableView 
            data={rmsData} 
            handlers={{ 
              handleAccept, 
              handleReject, 
              handleMaintain, 
              handleToggleSelect,
              handleManualPriceChange 
            }}
            onShowDetails={setSelectedDateForDetails}
          />
        )}
        {viewMode === 'cards' && (
          <CardsView data={rmsData} handlers={{ handleAccept, handleReject, handleMaintain }} />
        )}
        {viewMode === 'kanban' && (
          <KanbanView data={rmsData} handlers={{ handleAccept, handleReject, handleMaintain }} />
        )}
      </div>

      {/* MODAL DÉTAILS CONCURRENTS */}
      {selectedDateForDetails && (() => {
        const selectedDay = rmsData.find(d => d.date === selectedDateForDetails);
        if (!selectedDay) return null;

        // Générer 5 concurrents fictifs pour cette date
        const competitors = [
          { name: 'Hôtel du Louvre', stars: 5, price: selectedDay.maxPrice * 1.05, platform: 'Booking.com' },
          { name: 'Le Grand Haussmann', stars: 4, price: selectedDay.medianPrice * 1.02, platform: 'Expedia' },
          { name: 'Majestic Opéra', stars: 5, price: selectedDay.maxPrice * 0.98, platform: 'Direct' },
          { name: 'Paris Marriott', stars: 4, price: selectedDay.medianPrice * 0.95, platform: 'Booking.com' },
          { name: 'Mercure Lafayette', stars: 3, price: selectedDay.minPrice * 1.03, platform: 'Airbnb' },
        ];

        return (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSelectedDateForDetails(null)}
          >
            <div 
              className="bg-white rounded-lg shadow-2xl w-full max-w-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Détails Concurrents — {selectedDay.dayName} {selectedDay.dayNumber}/{selectedDay.month}
                </h2>
                <button
                  onClick={() => setSelectedDateForDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Notre prix:</span>
                    <span className="ml-2 font-bold text-blue-600">{selectedDay.currentPrice}€</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Prix suggéré:</span>
                    <span className="ml-2 font-bold text-violet-600">{selectedDay.suggestedPrice}€</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Médiane marché:</span>
                    <span className="ml-2 font-bold text-orange-600">{selectedDay.medianPrice.toFixed(0)}€</span>
                  </div>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Concurrent</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">★</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">Plateforme</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Prix</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((comp, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{comp.name}</td>
                      <td className="px-4 py-3 text-center text-amber-500">
                        {'★'.repeat(comp.stars)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                          {comp.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {comp.price.toFixed(0)}€
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-bold rounded',
                          comp.price > selectedDay.currentPrice
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {comp.price > selectedDay.currentPrice ? 'Nous < marché' : 'Nous > marché'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setSelectedDateForDetails(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLE VIEW
// ═══════════════════════════════════════════════════════════════════════════

function TableView({
  data,
  handlers,
  onShowDetails,
}: {
  data: DayData[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
    handleToggleSelect: (date: string) => void;
    handleManualPriceChange: (date: string, price: number) => void;
  };
  onShowDetails: (date: string) => void;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 w-10">☐</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 w-10">👁️</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Jour</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Date</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Événement</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Pression</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Dispo</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">TO</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Méd.</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Min</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Max</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Lead</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Pickup</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Stratégie</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Reco</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Actuel</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Suggéré</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Final</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Actions</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Statut</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.date}
              className={cn(
                'border-b border-gray-100 hover:bg-blue-50 transition-colors',
                row.selected && 'bg-blue-50'
              )}
            >
              <td className="px-2 py-2 border-r border-gray-200">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => handlers.handleToggleSelect(row.date)}
                  className="w-4 h-4 accent-blue-600"
                />
              </td>
              <td className="px-2 py-2 border-r border-gray-200">
                <button
                  onClick={() => onShowDetails(row.date)}
                  className="hover:bg-blue-100 p-1 rounded transition-colors"
                  title="Voir détails concurrents"
                >
                  <Eye className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                </button>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-700">{row.dayName}</td>
              <td className="px-3 py-2 border-r border-gray-200">
                {row.dayNumber}/{row.month}
              </td>
              <td className="px-3 py-2 border-r border-gray-200">
                {row.events.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                    {row.events[0]}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">
                <span
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-bold rounded',
                    row.marketPressure > 70
                      ? 'bg-red-100 text-red-700'
                      : row.marketPressure > 40
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  )}
                >
                  {row.marketPressure.toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center font-semibold">
                {row.availability}
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center font-bold">
                {row.occupancyRate.toFixed(0)}%
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-orange-700">
                {row.medianPrice.toFixed(0)}€
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-emerald-700">
                {row.minPrice.toFixed(0)}€
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-red-700">
                {row.maxPrice.toFixed(0)}€
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">{row.leadTimeMajority}j</td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">{row.pickupRate.toFixed(0)}%</td>
              <td className="px-3 py-2 border-r border-gray-200">
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded font-bold',
                    row.strategy === 'Yield Max' && 'bg-purple-100 text-purple-700',
                    row.strategy === 'Haute demande' && 'bg-red-100 text-red-700',
                    row.strategy === 'Agressive' && 'bg-blue-100 text-blue-700',
                    row.strategy === 'Défensive' && 'bg-green-100 text-green-700',
                    row.strategy === 'Opportuniste' && 'bg-yellow-100 text-yellow-700',
                    row.strategy === 'Last Minute' && 'bg-orange-100 text-orange-700',
                    row.strategy === 'Occupation faible' && 'bg-gray-100 text-gray-700',
                    row.strategy === 'Équilibrée' && 'bg-teal-100 text-teal-700'
                  )}
                >
                  {row.strategy}
                </span>
              </td>
              <td className="px-3 py-2 border-r border-gray-200">
                <div className="flex items-center gap-1">
                  {row.recommendation === 'Augmenter' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                  {row.recommendation === 'Baisser' && <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                  {row.recommendation === 'Maintenir' && <Minus className="w-3.5 h-3.5 text-blue-600" />}
                  <span className="text-[11px] font-semibold">{row.recommendation}</span>
                  <span
                    className={cn(
                      'ml-1 text-[10px] px-1 py-0.5 rounded font-bold',
                      row.confidenceScore >= 85 && 'bg-emerald-100 text-emerald-700',
                      row.confidenceScore >= 70 && row.confidenceScore < 85 && 'bg-yellow-100 text-yellow-700',
                      row.confidenceScore < 70 && 'bg-red-100 text-red-700'
                    )}
                  >
                    {row.confidenceScore}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold">{row.currentPrice}€</td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-bold text-blue-600">
                {row.suggestedPrice}€
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-bold text-blue-700">
                {row.validationStatus === 'Refusée' ? (
                  <input
                    type="number"
                    value={row.finalPrice || row.currentPrice}
                    onChange={(e) => handlers.handleManualPriceChange(row.date, parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-right border border-blue-500 rounded focus:ring-2 focus:ring-blue-600 focus:outline-none font-bold"
                    placeholder="Prix"
                  />
                ) : (
                  row.finalPrice ? `${row.finalPrice}€` : '—'
                )}
              </td>
              <td className="px-2 py-2 border-r border-gray-200">
                <div className="flex items-center gap-1 justify-center">
                  <button
                    onClick={() => handlers.handleAccept(row.date)}
                    className="p-1 rounded hover:bg-emerald-100 transition-colors"
                    title="Accepter"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button
                    onClick={() => handlers.handleReject(row.date)}
                    className="p-1 rounded hover:bg-red-100 transition-colors"
                    title="Refuser"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                  <button
                    onClick={() => handlers.handleMaintain(row.date)}
                    className="p-1 rounded hover:bg-blue-100 transition-colors"
                    title="Maintenir"
                  >
                    <Minus className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded font-bold',
                    row.validationStatus === 'Acceptée' && 'bg-emerald-100 text-emerald-700',
                    row.validationStatus === 'Refusée' && 'bg-red-100 text-red-700',
                    row.validationStatus === 'Maintenue' && 'bg-blue-100 text-blue-700',
                    row.validationStatus === 'En attente' && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {row.validationStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARDS VIEW
// ═══════════════════════════════════════════════════════════════════════════

function CardsView({
  data,
  handlers,
}: {
  data: DayData[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
  };
}) {
  return (
    <div className="p-6 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((row) => (
          <div
            key={row.date}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  {row.dayName}. {row.dayNumber}/{row.month}
                </span>
                {row.events.length > 0 && (
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                      {row.events[0]}
                    </span>
                  </div>
                )}
              </div>

              {row.validationStatus !== 'En attente' && (
                <span
                  className={cn(
                    'px-2 py-1 text-[10px] font-bold rounded',
                    row.validationStatus === 'Acceptée' && 'bg-emerald-100 text-emerald-700',
                    row.validationStatus === 'Refusée' && 'bg-red-100 text-red-700',
                    row.validationStatus === 'Maintenue' && 'bg-blue-100 text-blue-700'
                  )}
                >
                  {row.validationStatus}
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">TO</span>
                <span className="font-bold">{row.occupancyRate.toFixed(0)}%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Actuel</span>
                <span className="font-bold">{row.currentPrice}€</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Suggéré</span>
                <span className="font-bold text-blue-600">{row.suggestedPrice}€</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                <span className="text-gray-500">Confiance</span>
                <span
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-bold rounded',
                    row.confidenceScore >= 80 && 'bg-emerald-100 text-emerald-700',
                    row.confidenceScore >= 60 && row.confidenceScore < 80 && 'bg-yellow-100 text-yellow-700',
                    row.confidenceScore < 60 && 'bg-red-100 text-red-700'
                  )}
                >
                  {row.confidenceScore}%
                </span>
              </div>
            </div>

            {/* Validation Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlers.handleAccept(row.date)}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-all duration-150 hover:scale-105 active:scale-95',
                  row.validationStatus === 'Acceptée'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
                )}
              >
                ✓ OK
              </button>

              <button
                onClick={() => handlers.handleMaintain(row.date)}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-all duration-150 hover:scale-105 active:scale-95',
                  row.validationStatus === 'Maintenue'
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                )}
              >
                − Maintenir
              </button>

              <button
                onClick={() => handlers.handleReject(row.date)}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-all duration-150 hover:scale-105 active:scale-95',
                  row.validationStatus === 'Refusée'
                    ? 'bg-red-500 text-white border-red-500 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-red-500'
                )}
              >
                ✗ NON
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KANBAN VIEW — 3 colonnes (Augmenter / Maintenir / Baisser)
// ═══════════════════════════════════════════════════════════════════════════

function KanbanView({
  data,
  handlers,
}: {
  data: DayData[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
  };
}) {
  const columns: {
    key: Recommendation;
    title: string;
    accent: string;
    badge: string;
    icon: typeof TrendingUp;
  }[] = [
    {
      key: 'Augmenter',
      title: 'Augmenter',
      accent: 'border-emerald-300 bg-emerald-50',
      badge: 'bg-emerald-500 text-white',
      icon: TrendingUp,
    },
    {
      key: 'Maintenir',
      title: 'Maintenir',
      accent: 'border-blue-300 bg-blue-50',
      badge: 'bg-blue-500 text-white',
      icon: Minus,
    },
    {
      key: 'Baisser',
      title: 'Baisser',
      accent: 'border-red-300 bg-red-50',
      badge: 'bg-red-500 text-white',
      icon: TrendingDown,
    },
  ];

  const grouped = useMemo(() => {
    const map: Record<Recommendation, DayData[]> = {
      Augmenter: [],
      Maintenir: [],
      Baisser: [],
    };
    data.forEach((d) => {
      map[d.recommendation].push(d);
    });
    return map;
  }, [data]);

  return (
    <div className="p-6 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const items = grouped[col.key];
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              className={cn('border-2 rounded-lg flex flex-col', col.accent)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/60 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <span className={cn('flex items-center justify-center w-7 h-7 rounded-full', col.badge)}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-gray-800">{col.title}</h3>
                </div>
                <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-3 space-y-2 min-h-[200px]">
                {items.length === 0 && (
                  <div className="text-center text-xs text-gray-400 italic py-6">
                    Aucune date
                  </div>
                )}
                {items.map((row) => {
                  const delta = row.suggestedPrice - row.currentPrice;
                  const deltaPct = row.currentPrice
                    ? Math.round((delta / row.currentPrice) * 100)
                    : 0;
                  return (
                    <div
                      key={row.date}
                      className="bg-white border border-gray-200 rounded-md p-3 hover:shadow-md transition-shadow"
                    >
                      {/* Date + status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-gray-800">
                          {row.dayName}. {row.dayNumber}/{row.month}
                        </div>
                        {row.validationStatus !== 'En attente' && (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase',
                              row.validationStatus === 'Acceptée' && 'bg-emerald-100 text-emerald-700',
                              row.validationStatus === 'Refusée' && 'bg-red-100 text-red-700',
                              row.validationStatus === 'Maintenue' && 'bg-blue-100 text-blue-700'
                            )}
                          >
                            {row.validationStatus}
                          </span>
                        )}
                      </div>

                      {/* Event */}
                      {row.events.length > 0 && (
                        <div className="mb-2">
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                            {row.events[0]}
                          </span>
                        </div>
                      )}

                      {/* Prices */}
                      <div className="grid grid-cols-2 gap-2 mb-2 text-[11px]">
                        <div>
                          <div className="text-gray-500">Actuel</div>
                          <div className="font-bold text-gray-900">{row.currentPrice}€</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Suggéré</div>
                          <div
                            className={cn(
                              'font-bold',
                              col.key === 'Augmenter' && 'text-emerald-700',
                              col.key === 'Baisser' && 'text-red-700',
                              col.key === 'Maintenir' && 'text-blue-700'
                            )}
                          >
                            {row.suggestedPrice}€{' '}
                            <span className="text-[10px] font-semibold text-gray-500">
                              ({delta >= 0 ? '+' : ''}
                              {deltaPct}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* TO + confidence */}
                      <div className="flex items-center justify-between text-[10px] mb-2">
                        <span className="text-gray-500">
                          TO <span className="font-bold text-gray-700">{row.occupancyRate.toFixed(0)}%</span>
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 font-bold rounded',
                            row.confidenceScore >= 80 && 'bg-emerald-100 text-emerald-700',
                            row.confidenceScore >= 60 && row.confidenceScore < 80 && 'bg-yellow-100 text-yellow-700',
                            row.confidenceScore < 60 && 'bg-red-100 text-red-700'
                          )}
                        >
                          {row.confidenceScore}%
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlers.handleAccept(row.date)}
                          className={cn(
                            'flex-1 px-1 py-1 text-[10px] font-bold rounded border transition-colors',
                            row.validationStatus === 'Acceptée'
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
                          )}
                          title="Accepter"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handlers.handleMaintain(row.date)}
                          className={cn(
                            'flex-1 px-1 py-1 text-[10px] font-bold rounded border transition-colors',
                            row.validationStatus === 'Maintenue'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                          )}
                          title="Maintenir"
                        >
                          −
                        </button>
                        <button
                          onClick={() => handlers.handleReject(row.date)}
                          className={cn(
                            'flex-1 px-1 py-1 text-[10px] font-bold rounded border transition-colors',
                            row.validationStatus === 'Refusée'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-red-500'
                          )}
                          title="Refuser"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
