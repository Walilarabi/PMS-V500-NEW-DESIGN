/**
 * FLOWTYM RMS — TABLEAU REVENUE MANAGEMENT ENTERPRISE
 *
 * Design: Duetto / IDeaS / Lighthouse / Atomize level
 * Logique métier: Intelligence artificielle revenue management
 *
 * Features:
 *  - 23 colonnes métier
 *  - Moteur recommandation 11 facteurs pondérés
 *  - 8 stratégies automatiques
 *  - Vue Tableau / Vue Kanban
 *  - Date du jour comme première colonne par défaut
 *  - Dispo éditable avec saut automatique au jour suivant (Enter)
 *  - Recalcul TO en cascade quand dispo modifiée
 *  - Markup +5% paramétrable appliqué au push prix
 *  - Bouton Rafraîchir (re-fetch données ops + calendrier)
 *  - Propagation Channel Manager
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Minus,
  Eye,
  Grid3x3,
  LayoutList,
  ChevronRight,
  Filter,
  Download,
  Zap,
  Target,
  Activity,
  Building2,
  Loader2,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { RMSPropagationService, RMSValidation } from '../../services/rms-propagation.service';
import { useRateCalendarStore } from '../../components/rms/store/rateCalendarStore';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useSalonsStore } from '../../store/salonsStore';
import { useOperationalData } from '../../hooks/useOperationalData';
import { recordRmsDecision } from '../../services/rms-decisions.service';
import { fetchRmsSettings, updateRmsSettings, applyMarkup, type RmsSettings } from '../../services/rms-settings.service';

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

interface DayRMSData {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isWeekend: boolean;
  isToday: boolean;

  events: string[];
  marketPressure: number;

  occupancyRate: number;
  availability: number;

  medianPrice: number;
  minPrice: number;
  maxPrice: number;

  leadTimeMajority: number;
  pickupRate: number;

  strategy: Strategy;
  recommendation: Recommendation;
  confidenceScore: number;

  currentPrice: number;
  suggestedPrice: number;
  finalPrice: number | null;

  varVsYesterday?: number | null;
  varVs3Days?: number | null;
  varVs7Days?: number | null;

  validationStatus: ValidationStatus;
  selected: boolean;
}

type ViewMode = 'table' | 'kanban';
type ViewPeriod = '7days' | '15days' | '30days' | '60days' | '90days';

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// ═══════════════════════════════════════════════════════════════════════════
// MOTEUR DE RECOMMANDATION (inchangé)
// ═══════════════════════════════════════════════════════════════════════════

function calculateStrategy(data: Partial<DayRMSData>): Strategy {
  const {
    occupancyRate = 50, leadTimeMajority = 14, pickupRate = 0,
    marketPressure = 0, availability = 10,
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

function calculateRecommendation(data: Partial<DayRMSData>): {
  recommendation: Recommendation;
  suggestedPrice: number;
  confidence: number;
} {
  const {
    strategy = 'Équilibrée', currentPrice = 280, medianPrice = 300,
    occupancyRate = 50, marketPressure = 0, pickupRate = 0,
  } = data;

  let recommendation: Recommendation = 'Maintenir';
  let priceAdjustment = 1.0;
  let confidence = 70;

  switch (strategy) {
    case 'Yield Max':
      recommendation = 'Augmenter'; priceAdjustment = 1.20; confidence = 95; break;
    case 'Haute demande':
      recommendation = 'Augmenter'; priceAdjustment = 1.15; confidence = 90; break;
    case 'Opportuniste':
      recommendation = 'Augmenter'; priceAdjustment = 1.12; confidence = 85; break;
    case 'Défensive':
      if (currentPrice < medianPrice * 0.95) {
        recommendation = 'Augmenter'; priceAdjustment = 1.08; confidence = 75;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 80;
      }
      break;
    case 'Agressive':
      recommendation = 'Baisser'; priceAdjustment = 0.88; confidence = 80; break;
    case 'Occupation faible':
      recommendation = 'Baisser'; priceAdjustment = 0.90; confidence = 85; break;
    case 'Last Minute':
      if (occupancyRate < 50) {
        recommendation = 'Baisser'; priceAdjustment = 0.92; confidence = 75;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 70;
      }
      break;
    case 'Équilibrée':
      if (currentPrice < medianPrice * 0.92) {
        recommendation = 'Augmenter'; priceAdjustment = 1.05; confidence = 65;
      } else if (currentPrice > medianPrice * 1.08) {
        recommendation = 'Baisser'; priceAdjustment = 0.97; confidence = 65;
      } else {
        recommendation = 'Maintenir'; priceAdjustment = 1.0; confidence = 70;
      }
      break;
  }

  if (marketPressure > 80) {
    confidence += 10;
    if (recommendation === 'Augmenter') priceAdjustment += 0.03;
  }
  if (pickupRate > 20) {
    confidence += 5;
    if (recommendation === 'Augmenter') priceAdjustment += 0.02;
  }

  return {
    recommendation,
    suggestedPrice: Math.round(currentPrice * priceAdjustment),
    confidence: Math.min(100, confidence),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUELETTE DÉTERMINISTE
// ═══════════════════════════════════════════════════════════════════════════

function generateSkeletonRMSData(startDate: Date, days: number): DayRMSData[] {
  const data: DayRMSData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    data.push({
      date: dateStr,
      dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
      dayNumber: date.getDate(),
      month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][date.getMonth()],
      isWeekend,
      isToday: date.getTime() === today.getTime(),
      events: [], marketPressure: 0, occupancyRate: 0, availability: 0,
      medianPrice: 0, minPrice: 0, maxPrice: 0,
      leadTimeMajority: 0, pickupRate: 0,
      strategy: 'Équilibrée', recommendation: 'Maintenir', confidenceScore: 0,
      currentPrice: 0, suggestedPrice: 0, finalPrice: null,
      validationStatus: 'En attente', selected: false,
      varVsYesterday: null, varVs3Days: null, varVs7Days: null,
    });
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function RMSTableauPro() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('15days');

  // Date du jour = première colonne par défaut
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [showFilters, setShowFilters] = useState(false);
  const [rmsData, setRmsData] = useState<DayRMSData[]>([]);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  // Token pour forcer un re-fetch (bump à chaque clic Rafraîchir)
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Propagation
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagationProgress, setPropagationProgress] = useState(0);
  const [propagationMessage, setPropagationMessage] = useState('');

  const handleNavigate = (page: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }));
  };

  // ─── Store RMS Calendrier ───────────────────────────────────────────────
  const { roomTypes, updatePrice, loadData } = useRateCalendarStore();

  useEffect(() => {
    if (roomTypes.length === 0) {
      loadData();
    }
  }, []);

  const referenceRoom = useMemo(() => {
    return roomTypes.find(r => r.isReference) ?? roomTypes[0] ?? null;
  }, [roomTypes]);

  const referencePlan = useMemo(() => {
    if (!referenceRoom) return null;
    return referenceRoom.ratePlans.find(p => p.isReference) ?? referenceRoom.ratePlans[0] ?? null;
  }, [referenceRoom]);

  const getPriceFromCalendar = useCallback((date: string): number => {
    if (!referenceRoom || !referencePlan) return 280;
    const cell = referencePlan.prices.find(p => p.date === date);
    return cell?.price ?? 280;
  }, [referenceRoom, referencePlan]);

  // ─── Lighthouse ────────────────────────────────────────────────────────
  const lighthouseImport = useLighthouseStore(s => s.importData);
  const getLighthouseData = useCallback((date: string) => {
    if (!lighthouseImport) return null;
    return lighthouseImport.days.find(d => d.date === date) ?? null;
  }, [lighthouseImport]);

  // ─── Réservations Supabase ─────────────────────────────────────────────
  const operationalRange = useMemo(() => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : viewPeriod === '30days' ? 30 : viewPeriod === '60days' ? 60 : 90;
    const from = startDate.toISOString().slice(0, 10);
    const to = new Date(startDate);
    to.setDate(to.getDate() + days - 1);
    return { from, to: to.toISOString().slice(0, 10) };
  }, [startDate, viewPeriod]);

  const { byDate: operationalByDate, totalCapacity, hasData: hasOperationalData } = useOperationalData(
    operationalRange.from,
    operationalRange.to,
    refreshToken, // bumped to force re-fetch
  );

  // ─── Salons ────────────────────────────────────────────────────────────
  const salonsImport = useSalonsStore(s => s.importData);
  const getSalonEvents = useCallback((date: string) => {
    if (!salonsImport) return [];
    return salonsImport.events.filter(e => date >= e.startDate && date <= e.endDate);
  }, [salonsImport]);

  // Override manuel d'inventaire
  const [inventoryOverrides, setInventoryOverrides] = useState<Map<string, number>>(new Map());

  // Paramètres RMS (markup paramétrable)
  const [rmsSettings, setRmsSettings] = useState<RmsSettings | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    fetchRmsSettings().then(s => { if (s) setRmsSettings(s); });
  }, []);

  // ─── EFFET 1 : génération du squelette (déterministe) ──────────────────
  useEffect(() => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : viewPeriod === '30days' ? 30 : viewPeriod === '60days' ? 60 : 90;
    setRmsData(generateSkeletonRMSData(startDate, days));
  }, [startDate, viewPeriod]);

  // ─── EFFET 2 : enrichissement avec sources réelles ─────────────────────
  // Préserve finalPrice + validationStatus (décisions utilisateur).
  // Recalcule TO en cascade quand override de disponibilité actif.
  useEffect(() => {
    setRmsData(prev => prev.map(row => {
      const realPrice = getPriceFromCalendar(row.date);
      const lhData = getLighthouseData(row.date);
      const opData = operationalByDate.get(row.date);
      const salonEvents = getSalonEvents(row.date);
      const inventoryOverride = inventoryOverrides.get(row.date);

      // ── Disponibilité ──
      const baseAvailability = opData ? opData.availability : 0;
      const availability = inventoryOverride !== undefined ? inventoryOverride : baseAvailability;

      // ── Recalcul TO en cascade quand dispo manuelle ──
      // TO = (capacité - dispo) / capacité × 100
      let occupancyRate: number;
      if (inventoryOverride !== undefined && totalCapacity > 0) {
        const newRoomsSold = Math.max(0, totalCapacity - inventoryOverride);
        occupancyRate = (newRoomsSold / totalCapacity) * 100;
      } else {
        occupancyRate = opData ? opData.occupancyRate : 0;
      }

      const leadTimeMajority = opData && opData.leadTimeMajority > 0 ? opData.leadTimeMajority : 0;
      const pickupRate = opData ? opData.pickupRate : 0;

      // ── Marché ──
      const ourPrice = realPrice > 0 ? realPrice : (lhData?.ourPrice ?? 0);
      const medianPrice = lhData?.compsetMedian ?? 0;
      const minPrice = lhData?.compsetMin ?? 0;
      const maxPrice = lhData?.compsetMax ?? 0;
      const marketPressure = lhData?.marketDemandPercent ?? 0;

      const events: string[] = salonEvents.length > 0
        ? salonEvents.map(e => e.name)
        : (lhData?.events ? [lhData.events] : []);

      const partial: Partial<DayRMSData> = {
        occupancyRate, availability, leadTimeMajority, pickupRate,
        marketPressure, isWeekend: row.isWeekend,
        currentPrice: ourPrice, medianPrice, minPrice, maxPrice,
      };
      const strategy = calculateStrategy(partial);
      const reco = calculateRecommendation({ ...partial, strategy });

      return {
        ...row,
        events, marketPressure,
        occupancyRate, availability,
        medianPrice, minPrice, maxPrice,
        leadTimeMajority, pickupRate,
        strategy,
        recommendation: reco.recommendation,
        confidenceScore: reco.confidence,
        currentPrice: ourPrice,
        suggestedPrice: reco.suggestedPrice,
        varVsYesterday: lhData?.varVsYesterday ?? null,
        varVs3Days: lhData?.varVs3Days ?? null,
        varVs7Days: lhData?.varVs7Days ?? null,
      };
    }));
  }, [
    getPriceFromCalendar,
    getLighthouseData,
    operationalByDate,
    totalCapacity,
    getSalonEvents,
    inventoryOverrides,
    startDate,
    viewPeriod,
  ]);

  // Navigation dates
  const navigateDays = (direction: 'prev' | 'next') => {
    const days = viewPeriod === '7days' ? 7 : viewPeriod === '15days' ? 15 : viewPeriod === '30days' ? 30 : viewPeriod === '60days' ? 60 : 90;
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
    setStartDate(newDate);
  };

  // ─── Bouton Rafraîchir ──────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Bumper le token pour forcer useOperationalData à re-fetch
      setRefreshToken(t => t + 1);
      // 2. Recharger le calendrier tarifaire
      await loadData();
      // 3. Recharger les settings RMS (markup éventuellement changé)
      const s = await fetchRmsSettings();
      if (s) setRmsSettings(s);
    } catch (err) {
      console.warn('[RMS] refresh failed:', err);
    } finally {
      // Petit délai pour rendre le spin visible (UX)
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [loadData]);

  // ─── Handlers validation ────────────────────────────────────────────────

  const handleAccept = useCallback(async (date: string) => {
    const row = rmsData.find(d => d.date === date);
    if (!row) return;

    const markup = rmsSettings?.pushMarkupPercent ?? 5;
    const pushedPrice = applyMarkup(row.suggestedPrice, markup);

    setRmsData(prev => prev.map(d =>
      d.date === date
        ? { ...d, finalPrice: pushedPrice, validationStatus: 'Acceptée' as ValidationStatus }
        : d
    ));

    if (refe
