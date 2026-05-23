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
 *  - Tooltip enrichie sur la colonne Événement (Palier A point 5)
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
  BarChart3,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { RMSPropagationService, RMSValidation } from '../../services/rms-propagation.service';
import { syncRMSDecision } from '../../services/rms-calendar-sync.service';
import { AnalyseRMTable } from './components/AnalyseRMTable';
import { RecommandationRMTable } from './components/RecommandationRMTable';
import { RMSRecommendationModal } from './components/RMSRecommendationModal';
import { useRateCalendarStore } from '../../components/rms/store/rateCalendarStore';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useSalonsStore } from '../../store/salonsStore';
import type { SalonEvent } from '../../services/salons-parser.service';
import { useOperationalData } from '../../hooks/useOperationalData';
import { recordRmsDecision } from '../../services/rms-decisions.service';
import { pricingPlanningSync } from '../../services/revenue/pricingPlanningSync.service';
import { OverrideStatusBanner } from '../../components/revenue/OverrideStatusBanner';
import {
  sourceWeighting,
  seasonFromDate,
  type WeightingSeason,
  type WeightingStrategy,
} from '../../services/revenue/sourceWeighting.service';
import { fetchRmsSettings, updateRmsSettings, applyMarkup, type RmsSettings } from '../../services/rms-settings.service';
import { EventTooltip, type EventTooltipData } from '../../components/shared/EventTooltip';

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

/**
 * Représentation interne unifiée d'un événement pour la colonne RMS.
 * Peut venir de plusieurs sources (salons importés, Lighthouse, planning manuel).
 */
interface RMSEventRow {
  name: string;
  startDate: string;
  endDate: string;
  location?: string | null;
  impact?: string | null;
  link?: string | null;
  source: 'salons_excel' | 'lighthouse' | 'planning_manual';
}

interface DayRMSData {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isWeekend: boolean;
  isToday: boolean;

  events: RMSEventRow[];   // ← changé de string[] vers RMSEventRow[]
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

  /** Détail pondération marché appliquée (NRF compensation), pour UI + audit. */
  weighting?: {
    percent: number;
    delta: number;
    applied: boolean;
    ruleId: string | null;
    rawSuggested: number;  // suggéré AVANT pondération
  };

  varVsYesterday?: number | null;
  varVs3Days?: number | null;
  varVs7Days?: number | null;

  validationStatus: ValidationStatus;
  selected: boolean;
}

type ViewMode = 'table' | 'kanban' | 'analyse' | 'recommandation';
type ViewPeriod = '7days' | '15days' | '30days' | '60days' | '90days';

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

/**
 * Adapte un événement interne (camelCase store) au format attendu par EventTooltip (snake_case).
 * Évite de modifier le store existant et garde l'isolation des contrats.
 */
function toTooltipData(ev: RMSEventRow): EventTooltipData {
  return {
    event_name: ev.name,
    start_date: ev.startDate,
    end_date: ev.endDate,
    location: ev.location ?? null,
    impact: ev.impact ?? null,
    link: ev.link ?? null,
    source: ev.source,
  };
}

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

function calculateRecommendation(data: Partial<DayRMSData> & {
  date?: string;
  source?: 'lighthouse' | 'expedia' | 'mix' | 'direct';
  roomTypeCode?: string | null;
  channel?: string | null;
}): {
  recommendation: Recommendation;
  suggestedPrice: number;
  confidence: number;
  /** Détail pondération marché appliquée (NRF compensation). */
  weighting: { percent: number; delta: number; applied: boolean; ruleId: string | null; rawSuggested: number };
} {
  const {
    strategy = 'Équilibrée', currentPrice = 280, medianPrice = 300,
    occupancyRate = 50, marketPressure = 0, pickupRate = 0,
    date,
    source = 'lighthouse',
    roomTypeCode = null,
    channel = null,
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

  // ─── Calcul du prix suggéré ──────────────────────────────────────────────
  // Ancienne formule : currentPrice * priceAdjustment → quand strat = Maintenir,
  // priceAdjustment = 1 → suggestedPrice === currentPrice (bug métier).
  //
  // Nouvelle formule :
  //   1. base = médiane marché si disponible et > 0, sinon currentPrice
  //   2. base est PONDÉRÉE pour compenser les tarifs NRF Lighthouse/Expedia
  //      (par défaut +5% paramétrable par source / canal / room / saison / stratégie)
  //   3. on applique le multiplicateur de la stratégie
  // → quand strat = Maintenir, suggestedPrice = base pondérée (≠ currentPrice
  //   en général), ce qui rend la recommandation utile et différenciée.
  const referencePrice = medianPrice > 0 ? medianPrice : currentPrice;
  const season: WeightingSeason = date ? seasonFromDate(date) : 'mid';
  const stratKey: WeightingStrategy =
    strategy === 'Yield Max' || strategy === 'Haute demande' || strategy === 'Opportuniste'
      ? 'aggressive'
      : strategy === 'Défensive' || strategy === 'Last Minute' || strategy === 'Occupation faible'
        ? 'defensive'
        : 'balanced';

  const weight = sourceWeighting.apply(referencePrice, {
    source,
    channel,
    roomTypeCode,
    season,
    strategy: stratKey,
  });
  const weightedReference = weight.weightedPrice;
  const rawSuggested = Math.round(weightedReference * priceAdjustment);

  return {
    recommendation,
    suggestedPrice: rawSuggested,
    confidence: Math.min(100, confidence),
    weighting: {
      percent: weight.percent,
      delta: weight.delta,
      applied: weight.applied,
      ruleId: weight.ruleId,
      rawSuggested: Math.round(referencePrice * priceAdjustment), // sans pondération
    },
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
  const { roomTypes, loadData } = useRateCalendarStore();

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
  const getSalonEvents = useCallback((date: string): SalonEvent[] => {
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

      // ── Événements unifiés (Palier A point 5) ──
      // Source 1 : salons importés (priorité, avec tous les détails)
      // Source 2 : événements Lighthouse (fallback)
      const events: RMSEventRow[] = [];

      // Ajouter d'abord les salons (les plus riches)
      for (const se of salonEvents) {
        events.push({
          name: se.name,
          startDate: se.startDate,
          endDate: se.endDate,
          location: se.location ?? null,
          impact: se.impact ?? null,
          link: null,  // pas encore extrait par le parser
          source: 'salons_excel',
        });
      }

      // Compléter avec les events Lighthouse si rien dans les salons pour cette date
      if (events.length === 0 && lhData?.events) {
        events.push({
          name: lhData.events,
          startDate: row.date,
          endDate: row.date,
          location: null,
          impact: null,
          link: null,
          source: 'lighthouse',
        });
      }

      const partial: Partial<DayRMSData> = {
        occupancyRate, availability, leadTimeMajority, pickupRate,
        marketPressure, isWeekend: row.isWeekend,
        currentPrice: ourPrice, medianPrice, minPrice, maxPrice,
      };
      const strategy = calculateStrategy(partial);
      // La source par défaut est 'lighthouse' (= source principale de
      // la médiane marché). Quand on aura un mix Expedia, on basculera.
      const reco = calculateRecommendation({
        ...partial,
        strategy,
        date: row.date,
        source: lhData ? 'lighthouse' : 'direct',
        roomTypeCode: null,
        channel: null,
      });

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
        weighting: reco.weighting,
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
      setRefreshToken(t => t + 1);
      await loadData();
      const s = await fetchRmsSettings();
      if (s) setRmsSettings(s);
    } catch (err) {
      console.warn('[RMS] refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [loadData]);

  // ─── Handlers validation ────────────────────────────────────────────────

  const handleAccept = useCallback(async (date: string) => {
    const row = rmsData.find(d => d.date === date);
    if (!row) return;

    // CORRECTION LOGIQUE MÉTIER : Accepter = Final reprend le Suggéré tel quel.
    // La pondération marché (NRF Lighthouse/Expedia) est DÉJÀ intégrée dans
    // row.suggestedPrice via sourceWeighting au moment du calcul. Pas de
    // double markup au push.
    const pushedPrice = row.suggestedPrice;

    setRmsData(prev => prev.map(d =>
      d.date === date
        ? { ...d, finalPrice: pushedPrice, validationStatus: 'Acceptée' as ValidationStatus }
        : d
    ));

    // Sync unifiée : injecte dans le Calendrier + déclenche push Channel Manager + journalise
    syncRMSDecision({
      date,
      finalPrice: pushedPrice,
      status: 'Acceptée',
      source: 'table',
      roomTypeId: referenceRoom?.roomTypeId,
      planId: referencePlan?.planId,
    });

    recordRmsDecision({
      stayDate: date,
      roomTypeCode: referenceRoom?.roomTypeCode ?? null,
      action: 'accepted',
      currentPrice: row.currentPrice,
      suggestedPrice: row.suggestedPrice,
      finalPrice: pushedPrice,
      strategy: row.strategy,
      recommendation: row.recommendation,
      confidenceScore: row.confidenceScore,
      marketPressurePercent: Math.round(row.marketPressure),
      occupancyRate: row.occupancyRate,
      medianPrice: row.medianPrice,
    });
  }, [rmsData, referenceRoom, referencePlan, rmsSettings]);

  /**
   * Refuser : Final = tarif manuel saisi par l'utilisateur (fallback
   * currentPrice si rien saisi). Logique métier corrigée — auparavant
   * Final tombait toujours sur currentPrice, perdant l'intention du RM.
   */
  const handleReject = useCallback(async (date: string, manualPrice?: number) => {
    const row = rmsData.find(d => d.date === date);
    if (!row) return;
    const finalPrice = manualPrice && manualPrice > 0 ? Math.round(manualPrice) : row.currentPrice;

    setRmsData(prev => prev.map(d =>
      d.date === date
        ? { ...d, finalPrice, validationStatus: 'Refusée' as ValidationStatus }
        : d
    ));

    syncRMSDecision({
      date,
      finalPrice,
      status: 'Refusée',
      source: 'table',
      roomTypeId: referenceRoom?.roomTypeId,
      planId: referencePlan?.planId,
    });

    recordRmsDecision({
      stayDate: date,
      roomTypeCode: referenceRoom?.roomTypeCode ?? null,
      action: 'rejected',
      currentPrice: row.currentPrice,
      suggestedPrice: row.suggestedPrice,
      finalPrice,
      strategy: row.strategy,
      recommendation: row.recommendation,
      confidenceScore: row.confidenceScore,
      marketPressurePercent: Math.round(row.marketPressure),
      occupancyRate: row.occupancyRate,
      medianPrice: row.medianPrice,
    });
  }, [rmsData, referenceRoom, referencePlan]);

  const handleMaintain = useCallback(async (date: string) => {
    const row = rmsData.find(d => d.date === date);
    if (!row) return;

    setRmsData(prev => prev.map(d =>
      d.date === date
        ? { ...d, finalPrice: d.currentPrice, validationStatus: 'Maintenue' as ValidationStatus }
        : d
    ));

    syncRMSDecision({
      date,
      finalPrice: row.currentPrice,
      status: 'Maintenue',
      source: 'table',
      roomTypeId: referenceRoom?.roomTypeId,
      planId: referencePlan?.planId,
    });

    recordRmsDecision({
      stayDate: date,
      roomTypeCode: referenceRoom?.roomTypeCode ?? null,
      action: 'maintained',
      currentPrice: row.currentPrice,
      suggestedPrice: row.suggestedPrice,
      finalPrice: row.currentPrice,
      strategy: row.strategy,
      recommendation: row.recommendation,
      confidenceScore: row.confidenceScore,
      marketPressurePercent: Math.round(row.marketPressure),
      occupancyRate: row.occupancyRate,
      medianPrice: row.medianPrice,
    });
  }, [rmsData, referenceRoom, referencePlan]);

  const handleToggleSelect = useCallback((date: string) => {
    setRmsData((prev) =>
      prev.map((d) => (d.date === date ? { ...d, selected: !d.selected } : d))
    );
  }, []);

  // ─── Override manuel de la disponibilité ───────────────────────────────
  // Branche le service pricingPlanningSync : la valeur manuelle prime pendant
  // 15 min, sync planning suspendue, badge affiché, action journalisée.
  const isAvailabilityOverridden = useCallback((date: string) => {
    return inventoryOverrides.has(date) || pricingPlanningSync.isOverrideActive(date);
  }, [inventoryOverrides]);

  const handleAvailabilityChange = useCallback((date: string, newValue: number) => {
    if (newValue < 0 || !Number.isFinite(newValue)) return;

    setInventoryOverrides(prev => {
      const next = new Map(prev);
      next.set(date, newValue);
      return next;
    });

    // Persistance + suspend sync 15 min + audit + emit événement
    pricingPlanningSync.setOverride(date, newValue, 'Modification manuelle Pricing & Recommandations');

    if (referenceRoom) {
      const { updateInventory } = useRateCalendarStore.getState();
      updateInventory(referenceRoom.roomTypeId, date, newValue);
    }
  }, [referenceRoom]);

  /** Réactive la sync auto pour une date donnée. */
  const handleResumeSync = useCallback((date: string) => {
    pricingPlanningSync.resumeSync(date);
    setInventoryOverrides(prev => {
      const next = new Map(prev);
      next.delete(date);
      return next;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPAGATION
  // ═══════════════════════════════════════════════════════════════════════════

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
          `✅ Propagation réussie!\n\n${result.validationsCount} tarifs propagés`
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

  const validatedCount = rmsData.filter((d) => d.validationStatus !== 'En attente').length;

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      <RevenueHeader
        icon={Target}
        title="RMS Revenue Management"
        subtitle={
          `Tableau de pilotage · ${rmsData.length} dates · ${validatedCount} validations` +
          (lighthouseImport ? ` · Lighthouse ✓` : ` · Lighthouse: absent`) +
          (hasOperationalData ? ` · Réservations ✓ (${totalCapacity} chambres)` : ` · Réservations: non chargées`)
        }
        quickActions={[
          {
            label: isRefreshing ? 'Rafraîchissement…' : 'Rafraîchir',
            icon: RefreshCw,
            onClick: handleRefresh,
          },
          {
            label: `Markup +${rmsSettings?.pushMarkupPercent ?? 5}%`,
            icon: Settings2,
            onClick: () => setShowSettingsModal(true),
          },
          {
            label: 'Veille Compset',
            icon: Building2,
            onClick: () => handleNavigate('rev_compset'),
          },
          {
            label: 'Calendrier Tarifaire',
            icon: Calendar,
            onClick: () => handleNavigate('rev_pricing'),
          },
        ]}
      />

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['7days', '15days', '30days', '60days', '90days'] as ViewPeriod[]).map((period) => (
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

          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all duration-150',
                viewMode === 'table' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tableau
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all duration-150',
                viewMode === 'kanban' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('analyse')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all duration-150',
                viewMode === 'analyse' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analyse RM
            </button>
            <button
              onClick={() => setViewMode('recommandation')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all duration-150',
                viewMode === 'recommandation' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Recommandation RM
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors border',
              isRefreshing
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
            title="Recharger les données (réservations, calendrier, paramètres)"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>

         <div className="flex items-center gap-2 border border-gray-300 rounded-md overflow-hidden">
            <button onClick={() => navigateDays('prev')} className="px-3 py-1.5 hover:bg-gray-100">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="px-3 py-1.5 text-sm font-semibold text-gray-700 border-x border-gray-300 whitespace-nowrap">
              {startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => navigateDays('next')} className="px-3 py-1.5 hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors border',
              showFilters ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* STATUS BAR */}
      {validatedCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-violet-50 border-b border-violet-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-sm text-violet-700">
              <span className="font-bold">{validatedCount}</span> recommandation(s) validée(s)
            </div>
            {isPropagating && (
              <div className="flex items-center gap-2 text-xs text-violet-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{propagationMessage}</span>
                <span className="font-bold">{propagationProgress}%</span>
              </div>
            )}
          </div>
          <button
            onClick={handlePropagate}
            disabled={isPropagating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-500 text-white text-sm font-bold rounded-md hover:bg-violet-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPropagating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Propagation en cours...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Propager au Channel Manager ({validatedCount})
              </>
            )}
          </button>
        </div>
      )}

      {/* Bandeau override manuel disponibilité — affiché uniquement si actif */}
      <div className="px-4 pt-2">
        <OverrideStatusBanner />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'table' && (
          <TableView data={rmsData} handlers={{
            handleAccept, handleReject, handleMaintain, handleToggleSelect,
            handleViewDetail: setDetailDate,
            handleAvailabilityChange,
            isAvailabilityOverridden,
          }} />
        )}
        {viewMode === 'kanban' && (
          <KanbanView data={rmsData} handlers={{ handleAccept, handleReject, handleMaintain }} />
        )}
        {viewMode === 'analyse' && <AnalyseRMTable data={rmsData} />}
        {viewMode === 'recommandation' && (
          <RecommandationRMTable
            data={rmsData}
            handlers={{ handleAccept, handleReject, handleMaintain, handleViewDetail: setDetailDate }}
          />
        )}
      </div>

      {detailDate && (() => {
        const day = rmsData.find(d => d.date === detailDate);
        if (!day) return null;
        return (
          <RMSRecommendationModal
            date={detailDate}
            rmsDay={day}
            lighthouseDay={lighthouseImport?.days.find(d => d.date === detailDate) ?? null}
            allDates={rmsData.map(d => d.date)}
            totalCapacity={totalCapacity}
            restrictions={undefined}
            onClose={() => setDetailDate(null)}
            onNavigate={(d) => setDetailDate(d)}
            onAccept={(d) => { handleAccept(d); setDetailDate(null); }}
            onReject={(d) => { handleReject(d); setDetailDate(null); }}
            onMaintain={(d) => { handleMaintain(d); setDetailDate(null); }}
          />
        );
      })()}

      {showSettingsModal && (
        <RmsSettingsModal
          current={rmsSettings}
          onClose={() => setShowSettingsModal(false)}
          onSaved={(next) => setRmsSettings(next)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLE VIEW
// ═══════════════════════════════════════════════════════════════════════════

function TableView({
  data,
  handlers,
}: {
  data: DayRMSData[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
    handleToggleSelect: (date: string) => void;
    handleViewDetail: (date: string) => void;
    handleAvailabilityChange: (date: string, value: number) => void;
    isAvailabilityOverridden: (date: string) => boolean;
  };
}) {
  const availabilityRefs = React.useRef<Map<string, () => void>>(new Map());

  const registerAvailabilityFocus = useCallback((date: string, focusFn: () => void) => {
    availabilityRefs.current.set(date, focusFn);
  }, []);

  const unregisterAvailabilityFocus = useCallback((date: string) => {
    availabilityRefs.current.delete(date);
  }, []);

  const focusNextAvailability = useCallback((currentDate: string) => {
    const idx = data.findIndex(r => r.date === currentDate);
    if (idx === -1 || idx >= data.length - 1) return;
    const nextDate = data[idx + 1].date;
    const focusFn = availabilityRefs.current.get(nextDate);
    if (focusFn) focusFn();
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 border-b-2 border-gray-300">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 w-10">☐</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 w-10">👁️</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Jour</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Date</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Événement</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Pression</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Dispo</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">TO</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Médiane</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Min</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200">Max</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200" title="Variation prix vs hier (Lighthouse)">Δ Hier</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200" title="Variation prix vs J-3 (Lighthouse)">Δ J-3</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-200" title="Variation prix vs J-7 (Lighthouse)">Δ J-7</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Lead Time</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Pickup</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Stratégie</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200">Recommandation</th>
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
                'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                row.selected && 'bg-violet-50',
                row.isToday && 'bg-blue-50/30'
              )}
            >
              <td className="px-2 py-2 border-r border-gray-200">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => handlers.handleToggleSelect(row.date)}
                  className="w-4 h-4"
                />
              </td>
              <td className="px-2 py-2 border-r border-gray-200">
                <button
                  onClick={() => handlers.handleViewDetail(row.date)}
                  className="text-gray-400 hover:text-violet-600 transition-colors"
                  title="Détail compset"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-700">{row.dayName}</td>
              <td className="px-3 py-2 border-r border-gray-200">
                {row.dayNumber}/{row.month}
                {row.isToday && <span className="ml-1 text-[9px] font-bold text-blue-600 uppercase">aujourd'hui</span>}
              </td>
              {/* ─── ÉVÉNEMENT (avec tooltip enrichie — Palier A point 5) ─── */}
              <td className="px-3 py-2 border-r border-gray-200">
                {row.events.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <EventTooltip event={toTooltipData(row.events[0])} label={row.events[0].source === 'salons_excel' ? 'Salon' : 'Événement'}>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold inline-block">
                        {row.events[0].name}
                      </span>
                    </EventTooltip>
                    {row.events.length > 1 && (
                      <EventTooltip event={toTooltipData(row.events[1])} label={row.events[1].source === 'salons_excel' ? 'Salon' : 'Événement'}>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold inline-block">
                          +{row.events.length - 1}
                        </span>
                      </EventTooltip>
                    )}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">
                <span className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded',
                  row.marketPressure > 70 ? 'bg-red-100 text-red-700' :
                  row.marketPressure > 40 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {row.marketPressure.toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center font-semibold">
                <EditableAvailability
                  date={row.date}
                  value={row.availability}
                  isOverride={handlers.isAvailabilityOverridden(row.date)}
                  onChange={(v) => handlers.handleAvailabilityChange(row.date, v)}
                  onCommitNext={() => focusNextAvailability(row.date)}
                  registerFocus={registerAvailabilityFocus}
                  unregisterFocus={unregisterAvailabilityFocus}
                />
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center font-bold">{row.occupancyRate.toFixed(0)}%</td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-orange-700">{row.medianPrice.toFixed(0)}€</td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-emerald-700">{row.minPrice.toFixed(0)}€</td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-red-700">{row.maxPrice.toFixed(0)}€</td>
              <td className={cn(
                'px-3 py-2 border-r border-gray-200 text-right text-xs font-medium',
                row.varVsYesterday == null ? 'text-gray-300'
                  : row.varVsYesterday > 0 ? 'text-emerald-600'
                  : row.varVsYesterday < 0 ? 'text-red-600'
                  : 'text-gray-500'
              )}>
                {row.varVsYesterday == null ? '—' : `${row.varVsYesterday > 0 ? '+' : ''}${row.varVsYesterday.toFixed(0)}€`}
              </td>
              <td className={cn(
                'px-3 py-2 border-r border-gray-200 text-right text-xs font-medium',
                row.varVs3Days == null ? 'text-gray-300'
                  : row.varVs3Days > 0 ? 'text-emerald-600'
                  : row.varVs3Days < 0 ? 'text-red-600'
                  : 'text-gray-500'
              )}>
                {row.varVs3Days == null ? '—' : `${row.varVs3Days > 0 ? '+' : ''}${row.varVs3Days.toFixed(0)}€`}
              </td>
              <td className={cn(
                'px-3 py-2 border-r border-gray-200 text-right text-xs font-medium',
                row.varVs7Days == null ? 'text-gray-300'
                  : row.varVs7Days > 0 ? 'text-emerald-600'
                  : row.varVs7Days < 0 ? 'text-red-600'
                  : 'text-gray-500'
              )}>
                {row.varVs7Days == null ? '—' : `${row.varVs7Days > 0 ? '+' : ''}${row.varVs7Days.toFixed(0)}€`}
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">{row.leadTimeMajority}j</td>
              <td className="px-3 py-2 border-r border-gray-200 text-center">{row.pickupRate.toFixed(0)}%</td>
              <td className="px-3 py-2 border-r border-gray-200">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded font-bold',
                  row.strategy === 'Yield Max' && 'bg-purple-100 text-purple-700',
                  row.strategy === 'Haute demande' && 'bg-red-100 text-red-700',
                  row.strategy === 'Agressive' && 'bg-blue-100 text-blue-700',
                  row.strategy === 'Défensive' && 'bg-green-100 text-green-700',
                  row.strategy === 'Opportuniste' && 'bg-yellow-100 text-yellow-700',
                  row.strategy === 'Last Minute' && 'bg-orange-100 text-orange-700',
                  row.strategy === 'Occupation faible' && 'bg-gray-100 text-gray-700',
                  row.strategy === 'Équilibrée' && 'bg-teal-100 text-teal-700'
                )}>
                  {row.strategy}
                </span>
              </td>
              <td className="px-3 py-2 border-r border-gray-200">
                <div className="flex items-center gap-1">
                  {row.recommendation === 'Augmenter' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                  {row.recommendation === 'Baisser' && <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                  {row.recommendation === 'Maintenir' && <Minus className="w-3.5 h-3.5 text-blue-600" />}
                  <span className="text-[11px] font-semibold">{row.recommendation}</span>
                  <span className={cn(
                    'ml-1 text-[10px] px-1 py-0.5 rounded font-bold',
                    row.confidenceScore >= 85 && 'bg-emerald-100 text-emerald-700',
                    row.confidenceScore >= 70 && row.confidenceScore < 85 && 'bg-yellow-100 text-yellow-700',
                    row.confidenceScore < 70 && 'bg-red-100 text-red-700'
                  )}>
                    {row.confidenceScore}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold">{row.currentPrice}€</td>
              <td className="px-3 py-2 border-r border-gray-200 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-bold text-violet-600">{row.suggestedPrice}€</span>
                  {row.weighting?.applied && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 cursor-help"
                      title={`Pondération marché : +${row.weighting.percent}% appliqué (NRF Lighthouse/Expedia). Tarif brut médiane : ${row.weighting.rawSuggested}€, pondéré : ${row.suggestedPrice}€`}
                    >
                      +{row.weighting.percent}%
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 border-r border-gray-200 text-right font-bold text-blue-700">
                {row.finalPrice ? `${row.finalPrice}€` : '—'}
              </td>
              <td className="px-2 py-2 border-r border-gray-200">
                <div className="flex items-center gap-1 justify-center">
                  <button onClick={() => handlers.handleAccept(row.date)} className="p-1 rounded hover:bg-emerald-100" title="Accepter">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button onClick={() => handlers.handleReject(row.date)} className="p-1 rounded hover:bg-red-100" title="Refuser">
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                  <button onClick={() => handlers.handleMaintain(row.date)} className="p-1 rounded hover:bg-blue-100" title="Maintenir">
                    <Minus className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </td>
              <td className="px-3 py-2">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded font-bold',
                  row.validationStatus === 'Acceptée' && 'bg-emerald-100 text-emerald-700',
                  row.validationStatus === 'Refusée' && 'bg-red-100 text-red-700',
                  row.validationStatus === 'Maintenue' && 'bg-blue-100 text-blue-700',
                  row.validationStatus === 'En attente' && 'bg-gray-100 text-gray-700'
                )}>
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
// KANBAN VIEW (inchangé)
// ═══════════════════════════════════════════════════════════════════════════

function KanbanView({
  data,
  handlers,
}: {
  data: DayRMSData[];
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
  };
}) {
  const grouped = useMemo(() => ({
    Augmenter: data.filter((d) => d.recommendation === 'Augmenter'),
    Maintenir: data.filter((d) => d.recommendation === 'Maintenir'),
    Baisser: data.filter((d) => d.recommendation === 'Baisser'),
  }), [data]);

  return (
    <div className="p-6 bg-gray-50 h-full">
      <div className="grid grid-cols-3 gap-4 h-full">
        <div className="flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-800">Augmenter</h3>
            <span className="ml-auto text-sm font-bold text-emerald-700">{grouped.Augmenter.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {grouped.Augmenter.map((row) => <KanbanCard key={row.date} row={row} handlers={handlers} />)}
          </div>
        </div>
        <div className="flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
            <Minus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">Maintenir</h3>
            <span className="ml-auto text-sm font-bold text-blue-700">{grouped.Maintenir.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {grouped.Maintenir.map((row) => <KanbanCard key={row.date} row={row} handlers={handlers} />)}
          </div>
        </div>
        <div className="flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-gray-800">Baisser</h3>
            <span className="ml-auto text-sm font-bold text-red-700">{grouped.Baisser.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {grouped.Baisser.map((row) => <KanbanCard key={row.date} row={row} handlers={handlers} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanCard({
  row,
  handlers,
}: {
  row: DayRMSData;
  handlers: {
    handleAccept: (date: string) => void;
    handleReject: (date: string) => void;
    handleMaintain: (date: string) => void;
  };
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800">{row.dayName}. {row.dayNumber}/{row.month}</span>
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded font-bold',
          row.confidenceScore >= 85 && 'bg-emerald-100 text-emerald-700',
          row.confidenceScore >= 70 && row.confidenceScore < 85 && 'bg-yellow-100 text-yellow-700',
          row.confidenceScore < 70 && 'bg-red-100 text-red-700'
        )}>
          {row.confidenceScore}%
        </span>
      </div>
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between"><span className="text-gray-500">TO</span><span className="font-semibold">{row.occupancyRate.toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Stratégie</span><span className="font-semibold text-violet-700">{row.strategy}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Actuel → Suggéré</span><span className="font-bold">{row.currentPrice}€ → {row.suggestedPrice}€</span></div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => handlers.handleAccept(row.date)} className={cn(
          'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors',
          row.validationStatus === 'Acceptée' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
        )}>✓ OK</button>
        <button onClick={() => handlers.handleReject(row.date)} className={cn(
          'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors',
          row.validationStatus === 'Refusée' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-700 border-gray-300 hover:border-red-500'
        )}>✗ NON</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL DÉTAIL COMPSET (inchangé)
// ═══════════════════════════════════════════════════════════════════════════

function CompsetDetailModal({ date, onClose }: { date: string; onClose: () => void }) {
  const importData = useLighthouseStore(s => s.importData);
  const dayData = useMemo(() => {
    if (!importData) return null;
    return importData.days.find(d => d.date === date) ?? null;
  }, [importData, date]);

  if (!dayData) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Détail compset</h2>
          <p className="text-sm text-gray-600 mb-4">
            Aucune donnée Lighthouse importée pour la date <strong>{date}</strong>.
          </p>
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const ourHotelName = importData!.ourHotelName;
  const allHotels: { name: string; price: number; isUs: boolean; status: string }[] = [
    { name: ourHotelName, price: dayData.ourPrice, isUs: true, status: 'available' },
    ...dayData.competitors.map(c => ({
      name: c.hotelName, price: c.price ?? Infinity, isUs: false, status: c.status,
    })),
  ];
  const ranked = allHotels
    .filter(h => h.status === 'available' && h.price > 0 && isFinite(h.price))
    .sort((a, b) => a.price - b.price);
  const unavailable = allHotels.filter(h => h.status !== 'available' || h.price === 0 || !isFinite(h.price));
  const ourPosition = ranked.findIndex(h => h.isUs) + 1;
  const totalRanked = ranked.length;
  const maxPrice = ranked.length > 0 ? ranked[ranked.length - 1].price : 1;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Compset {dayData.dayName} {date}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Positionnement · Demande {dayData.marketDemandPercent}% · Rang {dayData.ranking}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 grid grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-500 uppercase">Notre prix</p><p className="text-xl font-bold text-blue-600">{dayData.ourPrice}€</p></div>
          <div><p className="text-xs text-gray-500 uppercase">Médiane</p><p className="text-xl font-bold text-gray-900">{dayData.compsetMedian}€</p></div>
          <div><p className="text-xs text-gray-500 uppercase">Min – Max</p><p className="text-xl font-bold text-gray-900">{dayData.compsetMin ?? '—'}€ – {dayData.compsetMax ?? '—'}€</p></div>
          <div><p className="text-xs text-gray-500 uppercase">Notre rang</p><p className="text-xl font-bold text-emerald-600">{ourPosition > 0 ? `#${ourPosition} / ${totalRanked}` : '—'}</p></div>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Classement tarifaire</h3>
          <div className="space-y-1.5">
            {ranked.map((h, idx) => {
              const widthPct = (h.price / maxPrice) * 100;
              return (
                <div key={h.name} className={'flex items-center gap-3 px-3 py-2 rounded ' + (h.isUs ? 'bg-blue-50 border border-blue-300' : 'bg-gray-50')}>
                  <span className={'w-6 text-xs font-bold ' + (idx === 0 ? 'text-emerald-600' : idx < 3 ? 'text-blue-600' : 'text-gray-500')}>#{idx + 1}</span>
                  <span className={'flex-1 text-sm ' + (h.isUs ? 'font-bold text-blue-900' : 'text-gray-700')}>
                    {h.isUs && <Target className="inline w-3 h-3 mr-1" />}
                    {h.name}
                  </span>
                  <div className="flex-1 max-w-[200px] bg-white rounded overflow-hidden h-2">
                    <div className={'h-full rounded ' + (h.isUs ? 'bg-blue-500' : 'bg-gray-400')} style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className={'text-sm font-semibold w-16 text-right ' + (h.isUs ? 'text-blue-900' : 'text-gray-900')}>
                    {Math.round(h.price)}€
                  </span>
                </div>
              );
            })}
            {unavailable.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mt-3 mb-1">Non disponibles ({unavailable.length})</p>
                {unavailable.map(h => (
                  <div key={h.name} className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-400">
                    <span className="flex-1">{h.name}</span>
                    <span>{h.status === 'sold_out' ? 'Épuisé' : h.status === 'restricted' ? 'Restreint' : 'N/A'}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          {(dayData.events || dayData.holidays) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              {dayData.holidays && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" strokeWidth={1.75} />{dayData.holidays}</div>}
              {dayData.events && <div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" strokeWidth={1.75} />{dayData.events}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDITABLE AVAILABILITY — avec Enter → focus jour suivant
// ═══════════════════════════════════════════════════════════════════════════

function EditableAvailability({
  date,
  value,
  isOverride,
  onChange,
  onCommitNext,
  registerFocus,
  unregisterFocus,
}: {
  date: string;
  value: number;
  isOverride: boolean;
  onChange: (v: number) => void;
  onCommitNext: () => void;
  registerFocus: (date: string, focusFn: () => void) => void;
  unregisterFocus: (date: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    registerFocus(date, startEdit);
    return () => unregisterFocus(date);
  }, [date, startEdit, registerFocus, unregisterFocus]);

  const commit = useCallback((moveToNext: boolean) => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onChange(parsed);
    }
    setEditing(false);
    if (moveToNext) {
      setTimeout(() => onCommitNext(), 30);
    }
  }, [draft, value, onChange, onCommitNext]);

  const cancel = useCallback(() => {
    setDraft(String(value));
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="w-14 text-center text-sm font-semibold border-2 border-blue-500 rounded outline-none px-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(true);
          } else if (e.key === 'Tab') {
            commit(false);
          } else if (e.key === 'Escape') {
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        'inline-block px-2 py-0.5 rounded text-sm font-semibold transition-colors hover:bg-blue-50',
        isOverride && 'bg-amber-50 text-amber-800 ring-1 ring-amber-300'
      )}
      title={isOverride
        ? `Override manuel : ${value}. Cliquez pour modifier. Entrée pour passer au jour suivant.`
        : `Calculé depuis le Planning : ${value}. Cliquez pour saisir. Entrée pour saisir + passer au jour suivant.`
      }
    >
      {value}
      {isOverride && <span className="ml-0.5 text-[8px] align-top">●</span>}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL PARAMÈTRES RMS
// ═══════════════════════════════════════════════════════════════════════════

function RmsSettingsModal({
  current,
  onClose,
  onSaved,
}: {
  current: RmsSettings | null;
  onClose: () => void;
  onSaved: (next: RmsSettings) => void;
}) {
  const [markup, setMarkup] = useState(String(current?.pushMarkupPercent ?? 5));
  const [autoPush, setAutoPush] = useState(current?.autoPushEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minBound = current?.minMarkupPercent ?? -50;
  const maxBound = current?.maxMarkupPercent ?? 100;

  const handleSave = async () => {
    const v = parseFloat(markup);
    if (isNaN(v)) { setError('Valeur invalide'); return; }
    if (v < minBound || v > maxBound) {
      setError(`Le markup doit être entre ${minBound}% et ${maxBound}%`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ok = await updateRmsSettings({ pushMarkupPercent: v, autoPushEnabled: autoPush });
      if (!ok) {
        setError('Sauvegarde échouée. Vérifiez votre connexion.');
        setSaving(false);
        return;
      }
      onSaved({
        hotelId: current?.hotelId ?? '',
        pushMarkupPercent: v,
        autoPushEnabled: autoPush,
        minMarkupPercent: minBound,
        maxMarkupPercent: maxBound,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Paramètres RMS</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configuration du moteur de recommandation</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Majoration sur prix poussés</label>
            <p className="text-xs text-gray-500 mb-2">
              Pourcentage appliqué au tarif recommandé par l'IA avant push vers le calendrier tarifaire (chambre référente, plan de référence).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={markup}
                onChange={e => setMarkup(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-sm text-gray-600">%</span>
              <span className="text-xs text-gray-400 ml-2">({minBound}% → {maxBound}%)</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
              Exemple : tarif recommandé 200€ + markup {markup || 0}% = <span className="font-semibold">{Math.round(200 * (1 + (parseFloat(markup) || 0) / 100))}€</span> poussé dans le calendrier
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-900">Push automatique</label>
              <p className="text-xs text-gray-500">Pousse automatiquement les recommandations acceptées vers le calendrier</p>
            </div>
            <button
              onClick={() => setAutoPush(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                autoPush ? 'bg-blue-600' : 'bg-gray-300'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                autoPush ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-white">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

