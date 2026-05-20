/**
 * FLOWTYM — RMS Recommendation Modal
 *
 * Modale dédiée à la décision RM sur une date donnée.
 *
 * Caractéristiques :
 * - Taille FIXE (largeur + hauteur identiques pour TOUS les onglets)
 * - Header / KPIs / tabs / footer fixes — seule la zone de contenu scroll
 * - Navigation date précédente / suivante
 * - 5 onglets : Marché · Concurrence · Recommandation · Restrictions · Historique
 *
 * Logique métier — la recommandation tient compte de :
 *  · disponibilité réelle (planning)
 *  · taux d'occupation
 *  · pickup
 *  · lead time
 *  · pression marché
 *  · événements / salons
 *  · tarifs concurrents (médiane / min / max / sold-out)
 *  · prix actuel & prix suggéré
 *  · stratégie (Agressive / Équilibrée / Défensive / Yield Max / Last Minute / etc.)
 *  · restrictions (CTA / CTD / MLOS / Stop Sale)
 *  · historique des décisions (acceptée / refusée / maintenue)
 */

import React, { useMemo, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Activity, Target, Lightbulb, Lock,
  History as HistoryIcon, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Check, Edit3, Calendar, Sparkles, Clock,
} from 'lucide-react';
import type { LighthouseDayData } from '../../../services/lighthouse-parser.service';
import { getSyncHistory } from '../../../services/rms-calendar-sync.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Types miroirs (évite cycle d'import RMSTableauPro) ──────────────────

export interface RMSModalDay {
  date: string;
  dayName: string;
  isToday: boolean;
  isWeekend: boolean;

  events: Array<{ label: string; source?: string; impact?: string | null }>;
  marketPressure: number;          // 0-100

  occupancyRate: number;            // 0-100
  availability: number;             // chambres restantes
  pickupRate: number;               // %
  leadTimeMajority: number;         // jours

  medianPrice: number;
  minPrice: number;
  maxPrice: number;

  strategy: string;
  recommendation: 'Augmenter' | 'Baisser' | 'Maintenir';
  confidenceScore: number;          // 0-100

  currentPrice: number;
  suggestedPrice: number;
  finalPrice: number | null;
  validationStatus: 'En attente' | 'Acceptée' | 'Refusée' | 'Maintenue';
}

export interface RMSRestrictions {
  minStay: number | null;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  closed: boolean;
}

type Tab = 'marche' | 'concurrence' | 'recommandation' | 'restrictions' | 'historique';

export interface RMSRecommendationModalProps {
  date: string;
  rmsDay: RMSModalDay;
  lighthouseDay: LighthouseDayData | null;
  allDates: string[];                                     // toutes les dates du tableau
  restrictions?: RMSRestrictions;                         // si dispo
  totalCapacity: number;                                  // nb chambres
  onClose: () => void;
  onNavigate: (date: string) => void;                     // change de jour
  onAccept: (date: string) => void;
  onReject: (date: string) => void;
  onMaintain: (date: string) => void;
  onEdit?: (date: string) => void;                        // édition prix manuel
}

// ─── Helpers métier ──────────────────────────────────────────────────────

function deltaPct(from: number, to: number): number {
  if (!from || from <= 0) return 0;
  return ((to - from) / from) * 100;
}

function compressionFor(d: RMSModalDay): { value: number; level: 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée' } {
  const value = Math.round((d.occupancyRate * d.marketPressure) / 100);
  let level: 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée' = 'Faible';
  if (value >= 75) level = 'Très élevée';
  else if (value >= 50) level = 'Élevée';
  else if (value >= 25) level = 'Moyenne';
  return { value, level };
}

function recoIntent(day: RMSModalDay): { action: 'Augmenter' | 'Baisser' | 'Maintenir'; pct: number; targetPrice: number; deltaEur: number } {
  const pct = deltaPct(day.currentPrice, day.suggestedPrice);
  let action: 'Augmenter' | 'Baisser' | 'Maintenir';
  if (pct >= 1.5) action = 'Augmenter';
  else if (pct <= -1.5) action = 'Baisser';
  else action = 'Maintenir';
  return {
    action,
    pct,
    targetPrice: day.suggestedPrice,
    deltaEur: day.suggestedPrice - day.currentPrice,
  };
}

interface Signal {
  kind: 'positive' | 'warning' | 'critical' | 'neutral';
  text: string;
}

function buildJustification(day: RMSModalDay, lh: LighthouseDayData | null, totalCapacity: number, restrictions?: RMSRestrictions): {
  narrative: string[];
  signals: Signal[];
  risks: string[];
  opportunities: Array<{ label: string; tone: 'positive' | 'warning' }>;
  expectedImpact: { revenue: number; occupancy: string };
} {
  const narrative: string[] = [];
  const signals: Signal[] = [];
  const risks: string[] = [];
  const opportunities: Array<{ label: string; tone: 'positive' | 'warning' }> = [];

  // 1. Lecture compset
  const medianDiffPct = day.medianPrice > 0 ? deltaPct(day.medianPrice, day.currentPrice) : 0;
  const positionLabel = medianDiffPct >= 10
    ? `au-dessus du marché (+${medianDiffPct.toFixed(1)}%)`
    : medianDiffPct <= -10
      ? `sous le marché (${medianDiffPct.toFixed(1)}%)`
      : `proche de la médiane (${medianDiffPct >= 0 ? '+' : ''}${medianDiffPct.toFixed(1)}%)`;
  narrative.push(
    `Lecture compset Lighthouse : notre tarif (${Math.round(day.currentPrice)}€) est ${positionLabel} (médiane ${Math.round(day.medianPrice)}€, min ${Math.round(day.minPrice)}€, max ${Math.round(day.maxPrice)}€).`
  );

  // 2. Pression marché
  const pressureLabel = day.marketPressure >= 85 ? 'extrême' : day.marketPressure >= 70 ? 'élevée' : day.marketPressure >= 40 ? 'modérée' : 'faible';
  narrative.push(
    `Pression marché ${pressureLabel} (${Math.round(day.marketPressure)}/100) — score composite issu de Lighthouse seul.`
  );

  // 3. Évolution tarifaire compset (vs hier / J-3 / J-7)
  if (lh) {
    const vsHier = lh.varVsYesterday ?? null;
    const vs3 = lh.varVs3Days ?? null;
    const vs7 = lh.varVs7Days ?? null;
    if (vsHier !== null || vs3 !== null || vs7 !== null) {
      const parts: string[] = [];
      if (vsHier !== null) parts.push(`${vsHier >= 0 ? '+' : ''}${vsHier.toFixed(1)}% vs hier`);
      if (vs3 !== null) parts.push(`${vs3 >= 0 ? '+' : ''}${vs3.toFixed(1)}% vs J-3`);
      if (vs7 !== null) parts.push(`${vs7 >= 0 ? '+' : ''}${vs7.toFixed(1)}% vs J-7`);
      narrative.push(`Évolution tarifaire compset (Lighthouse) : ${parts.join(' · ')}.`);
    }
  }

  // 4. Événements / Salons
  if (day.events.length > 0) {
    const labels = day.events.map(e => e.label).join(' · ');
    narrative.push(`✦ Événement(s) identifié(s) : ${labels}.`);
    opportunities.push({ label: `Événement local "${day.events[0].label}" — exploiter le pic de demande`, tone: 'positive' });
  } else if (day.marketPressure >= 70) {
    narrative.push(`⚠ Aucun événement répertorié malgré une pression marché élevée. Vérifier événements locaux non listés (salons, congrès, événements sportifs/culturels) avant d'agir agressivement sur le tarif.`);
    risks.push(`Risque de fausse demande — pression élevée sans événement répertorié`);
  }

  // 5. Inventaire & pickup
  const roomsTotal = totalCapacity || (day.availability + Math.round(day.occupancyRate * (totalCapacity || 45) / 100));
  const sold = Math.max(0, roomsTotal - day.availability);
  const pickupText = day.pickupRate >= 0
    ? `pick-up +${day.pickupRate.toFixed(1)}%`
    : `pick-up ${day.pickupRate.toFixed(1)}%`;

  if (day.availability <= 3 && day.occupancyRate >= 90) {
    narrative.push(`Inventaire critique : ${day.availability} chambres restantes (taux d'occupation ${Math.round(day.occupancyRate)}%, ${pickupText}). Yield maximum recommandé.`);
    opportunities.push({ label: `Yield max — inventaire ≤ 3 chambres`, tone: 'positive' });
  } else if (day.availability >= 20 && day.occupancyRate < 40) {
    narrative.push(`Inventaire large : ${day.availability} chambres disponibles sur ${roomsTotal} (taux d'occupation ${Math.round(day.occupancyRate)}%, ${pickupText}). Stimulation conversion conseillée.`);
    risks.push(`Sous-vente potentielle — forte demande détectée mais inventaire encore largement ouvert`);
  } else {
    narrative.push(`Inventaire : ${day.availability} chambres disponibles sur ${roomsTotal} (taux d'occupation ${Math.round(day.occupancyRate)}%, ${pickupText}). Inventaire encore large malgré la pression — accélérer la conversion.`);
    if (day.marketPressure >= 70 && day.availability >= 15) {
      risks.push(`Sous-vente potentielle — forte demande détectée mais inventaire encore largement ouvert`);
    }
  }

  // 6. Lead time
  if (day.leadTimeMajority < 7 && day.occupancyRate < 50) {
    narrative.push(`Lead time court (${day.leadTimeMajority}j) avec faible occupation — focus last-minute conseillé.`);
    opportunities.push({ label: `Fenêtre last-minute (J-${day.leadTimeMajority})`, tone: 'warning' });
  }

  // 7. Positionnement opportunités
  if (medianDiffPct <= -10) {
    opportunities.push({ label: `Positionnement : Sous le marché (≤ −10% médiane)`, tone: 'positive' });
  }
  if (day.marketPressure >= 75) {
    opportunities.push({ label: `Pression marché élevée — fenêtre de hausse limitée dans le temps`, tone: 'warning' });
  }

  // 8. Risques restrictions
  if (restrictions?.cta) risks.push(`Restriction CTA active — arrivée fermée ce jour`);
  if (restrictions?.ctd) risks.push(`Restriction CTD active — départ fermé ce jour`);
  if (restrictions?.minStay && restrictions.minStay > 1) {
    risks.push(`Minimum stay imposé : ${restrictions.minStay} nuit${restrictions.minStay > 1 ? 's' : ''} — conversion potentiellement réduite`);
  }
  if (restrictions?.closed) risks.push(`Stop sale activé — vente bloquée sur ce jour`);

  // 9. Signaux de synthèse
  signals.push({ kind: day.occupancyRate >= 70 ? 'positive' : day.occupancyRate <= 30 ? 'critical' : 'neutral', text: `Occupation ${Math.round(day.occupancyRate)}%` });
  signals.push({ kind: day.marketPressure >= 70 ? 'critical' : day.marketPressure >= 40 ? 'warning' : 'neutral', text: `Pression ${Math.round(day.marketPressure)}%` });
  signals.push({ kind: day.pickupRate >= 10 ? 'positive' : day.pickupRate <= -5 ? 'critical' : 'neutral', text: `Pickup ${day.pickupRate >= 0 ? '+' : ''}${day.pickupRate.toFixed(0)}%` });

  // 10. Impact attendu
  const reco = recoIntent(day);
  const expectedRoomsSold = Math.min(roomsTotal, sold + (reco.action === 'Baisser' ? Math.round(day.availability * 0.4) : reco.action === 'Augmenter' ? Math.max(0, Math.round(day.availability * 0.1)) : Math.round(day.availability * 0.25)));
  const baselineRevenue = sold * day.currentPrice;
  const expectedRevenue = expectedRoomsSold * reco.targetPrice;
  const expectedImpact = {
    revenue: Math.round(expectedRevenue - baselineRevenue),
    occupancy: roomsTotal > 0 ? `${Math.round((expectedRoomsSold / roomsTotal) * 100)}%` : '—',
  };

  return { narrative, signals, risks, opportunities, expectedImpact };
}

// ─── Composant principal ─────────────────────────────────────────────────

export function RMSRecommendationModal({
  date, rmsDay, lighthouseDay, allDates, restrictions, totalCapacity,
  onClose, onNavigate, onAccept, onReject, onMaintain, onEdit,
}: RMSRecommendationModalProps) {
  const [tab, setTab] = useState<Tab>('recommandation');

  const idx = allDates.indexOf(date);
  const prevDate = idx > 0 ? allDates[idx - 1] : null;
  const nextDate = idx >= 0 && idx < allDates.length - 1 ? allDates[idx + 1] : null;

  const compr = useMemo(() => compressionFor(rmsDay), [rmsDay]);
  const ecartMedianePct = useMemo(
    () => rmsDay.medianPrice > 0 ? deltaPct(rmsDay.medianPrice, rmsDay.currentPrice) : 0,
    [rmsDay]
  );

  const justification = useMemo(
    () => buildJustification(rmsDay, lighthouseDay, totalCapacity, restrictions),
    [rmsDay, lighthouseDay, totalCapacity, restrictions]
  );

  const reco = useMemo(() => recoIntent(rmsDay), [rmsDay]);

  // Historique des décisions sur cette date (depuis log de sync)
  const historyForDate = useMemo(() => {
    return getSyncHistory(200).filter(r => r.payload.date === date);
  }, [date]);

  // Compteur sold-out compset
  const soldOutCompset = lighthouseDay
    ? lighthouseDay.competitors.filter(c => c.status === 'sold_out').length
    : 0;

  const occLevel = rmsDay.occupancyRate >= 80 ? 'Occupation forte' :
                   rmsDay.occupancyRate >= 50 ? 'Occupation moyenne' :
                   'Occupation faible';

  const headerLabel = `Recommandation RM · ${occLevel} · Confiance ${rmsDay.confidenceScore}%`;

  // Action color
  const actionColor =
    reco.action === 'Augmenter' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
    reco.action === 'Baisser' ? 'bg-red-50 border-red-200 text-red-800' :
    'bg-gray-50 border-gray-200 text-gray-800';

  const actionTitle =
    reco.action === 'Augmenter' ? 'Augmenter le tarif' :
    reco.action === 'Baisser' ? 'Baisser le tarif' :
    'Maintenir le tarif';

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '1100px',
          height: 'min(900px, 92vh)', // ← TAILLE FIXE pour tous les onglets
        }}
      >
        {/* ─── HEADER FIXE ──────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight truncate">
                  {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <p className="text-xs text-slate-300 truncate">{headerLabel}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-100 text-[11px] font-semibold border border-blue-400/30">
                    <Activity className="w-3 h-3" />
                    {compr.level} · {Math.round(rmsDay.marketPressure)}%
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium border border-white/20">
                    Lighthouse seul
                  </span>
                  {rmsDay.events.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-100 text-[11px] font-medium border border-purple-400/30">
                      🎉 {rmsDay.events[0].label}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => prevDate && onNavigate(prevDate)}
                disabled={!prevDate}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title={prevDate ?? 'Première date'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => nextDate && onNavigate(nextDate)}
                disabled={!nextDate}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title={nextDate ?? 'Dernière date'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-white/10"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── KPIs FIXES (7 KPIs) ──────────────────────────────────── */}
        <div className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
          <Kpi label="Médiane" value={`${Math.round(rmsDay.medianPrice)}€`} tone="default" />
          <Kpi label="Min" value={`${Math.round(rmsDay.minPrice)}€`} tone="emerald" />
          <Kpi label="Max" value={`${Math.round(rmsDay.maxPrice)}€`} tone="orange" />
          <Kpi label="Notre tarif" value={`${Math.round(rmsDay.currentPrice)}€`} tone="blue" />
          <Kpi
            label="Écart médiane"
            value={`${ecartMedianePct >= 0 ? '+' : ''}${ecartMedianePct.toFixed(1)}%`}
            tone={Math.abs(ecartMedianePct) < 5 ? 'default' : ecartMedianePct > 0 ? 'emerald' : 'red'}
          />
          <Kpi label="Compression" value={`${compr.value}`} sub={compr.level} tone="default" />
          <Kpi label="Sold-out comp." value={`${soldOutCompset}`} tone="default" />
        </div>

        {/* ─── TABS FIXES ───────────────────────────────────────────── */}
        <div className="border-b border-gray-200 flex-shrink-0 px-4">
          <div className="flex items-center gap-1">
            <TabBtn icon={<Activity className="w-3.5 h-3.5" />} label="Marché" active={tab === 'marche'} onClick={() => setTab('marche')} />
            <TabBtn icon={<Target className="w-3.5 h-3.5" />} label="Concurrence" active={tab === 'concurrence'} onClick={() => setTab('concurrence')} />
            <TabBtn icon={<Sparkles className="w-3.5 h-3.5" />} label="Recommandation" active={tab === 'recommandation'} onClick={() => setTab('recommandation')} />
            <TabBtn icon={<Lock className="w-3.5 h-3.5" />} label="Restrictions" active={tab === 'restrictions'} onClick={() => setTab('restrictions')} />
            <TabBtn icon={<HistoryIcon className="w-3.5 h-3.5" />} label="Historique" active={tab === 'historique'} onClick={() => setTab('historique')} />
          </div>
        </div>

        {/* ─── CONTENU SCROLLABLE ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'marche' && (
            <MarcheTab day={rmsDay} lighthouseDay={lighthouseDay} totalCapacity={totalCapacity} />
          )}
          {tab === 'concurrence' && (
            <ConcurrenceTab day={rmsDay} lighthouseDay={lighthouseDay} />
          )}
          {tab === 'recommandation' && (
            <RecommandationTab
              day={rmsDay}
              reco={reco}
              actionTitle={actionTitle}
              actionColor={actionColor}
              justification={justification}
            />
          )}
          {tab === 'restrictions' && (
            <RestrictionsTab restrictions={restrictions} day={rmsDay} />
          )}
          {tab === 'historique' && (
            <HistoriqueTab history={historyForDate} day={rmsDay} />
          )}
        </div>

        {/* ─── FOOTER FIXE ──────────────────────────────────────────── */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Statut actuel :</span>
            <StatusBadge status={rmsDay.validationStatus} />
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(date)}
                className="px-3 py-1.5 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-white flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Modifier
              </button>
            )}
            <button
              onClick={() => onReject(date)}
              className="px-3 py-1.5 text-sm font-semibold border border-red-300 text-red-700 rounded-md hover:bg-red-50 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Refuser
            </button>
            <button
              onClick={() => onMaintain(date)}
              className="px-3 py-1.5 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-white flex items-center gap-1.5"
            >
              <Minus className="w-3.5 h-3.5" />
              Maintenir
            </button>
            <button
              onClick={() => onAccept(date)}
              className="px-3 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'default' | 'blue' | 'emerald' | 'red' | 'orange' }) {
  const color =
    tone === 'blue' ? 'text-blue-700' :
    tone === 'emerald' ? 'text-emerald-700' :
    tone === 'red' ? 'text-red-700' :
    tone === 'orange' ? 'text-orange-700' :
    'text-gray-900';
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={cn('text-xl font-extrabold mt-0.5 tabular-nums', color)}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-3 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 transition-colors',
        active
          ? 'border-violet-600 text-violet-700'
          : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: RMSModalDay['validationStatus'] }) {
  const config =
    status === 'Acceptée' ? { bg: 'bg-emerald-100', text: 'text-emerald-800' } :
    status === 'Refusée' ? { bg: 'bg-red-100', text: 'text-red-800' } :
    status === 'Maintenue' ? { bg: 'bg-gray-100', text: 'text-gray-700' } :
    { bg: 'bg-amber-100', text: 'text-amber-800' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', config.bg, config.text)}>
      {status}
    </span>
  );
}

// ─── Tab : Marché ─────────────────────────────────────────────────────────

function MarcheTab({ day, lighthouseDay, totalCapacity }: { day: RMSModalDay; lighthouseDay: LighthouseDayData | null; totalCapacity: number }) {
  const compr = compressionFor(day);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Pression marché" value={`${Math.round(day.marketPressure)}%`} sub={compr.level} />
        <MetricCard title="Occupation" value={`${Math.round(day.occupancyRate)}%`} sub={`${day.availability}/${totalCapacity} disponibles`} />
        <MetricCard title="Pick-up" value={`${day.pickupRate >= 0 ? '+' : ''}${day.pickupRate.toFixed(1)}%`} sub="7j vs 7j précédents" />
        <MetricCard title="Lead time" value={`${day.leadTimeMajority}j`} sub="médiane résa créées → arrivée" />
      </div>

      {lighthouseDay && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            Évolution tarifaire compset (Lighthouse)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <DeltaCell label="vs hier" value={lighthouseDay.varVsYesterday ?? null} />
            <DeltaCell label="vs J-3" value={lighthouseDay.varVs3Days ?? null} />
            <DeltaCell label="vs J-7" value={lighthouseDay.varVs7Days ?? null} />
          </div>
        </div>
      )}

      {day.events.length > 0 ? (
        <div className="bg-purple-50/50 rounded-lg border border-purple-200 p-4">
          <h3 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Événements détectés ({day.events.length})
          </h3>
          <ul className="space-y-1">
            {day.events.map((e, i) => (
              <li key={i} className="text-sm text-purple-800">
                • {e.label}
                {e.impact && <span className="ml-2 text-[11px] text-purple-600">— impact {e.impact}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-amber-50/50 rounded-lg border border-amber-200 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            Aucun événement répertorié sur ce jour. Vérifier les sources externes (salons, congrès, festivals).
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{title}</div>
      <div className="text-xl font-extrabold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function DeltaCell({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="text-center py-2 px-3 bg-gray-50 rounded">
        <div className="text-[10px] text-gray-400 uppercase">{label}</div>
        <div className="text-sm text-gray-400">—</div>
      </div>
    );
  }
  const isUp = value > 0.5;
  const isDown = value < -0.5;
  const color = isUp ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                isDown ? 'text-red-700 bg-red-50 border-red-200' :
                'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <div className={cn('text-center py-2 px-3 rounded border', color)}>
      <div className="text-[10px] uppercase opacity-70">{label}</div>
      <div className="text-sm font-bold">
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </div>
    </div>
  );
}

// ─── Tab : Concurrence ────────────────────────────────────────────────────

function ConcurrenceTab({ day, lighthouseDay }: { day: RMSModalDay; lighthouseDay: LighthouseDayData | null }) {
  if (!lighthouseDay || lighthouseDay.competitors.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        Aucune donnée concurrence Lighthouse pour cette date.
      </div>
    );
  }
  const available = lighthouseDay.competitors.filter(c => c.status === 'available' && c.price !== null && c.price > 0);
  const sortedComps = [...available].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const unavailable = lighthouseDay.competitors.filter(c => c.status !== 'available' || c.price === null || c.price === 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Classement concurrents — du moins cher au plus cher</h3>
        <span className="text-xs text-gray-400">{sortedComps.length} disponibles · {unavailable.length} en restriction</span>
      </div>
      <div className="space-y-1">
        {/* Notre hôtel */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 border-2 border-blue-400">
          <span className="w-7 h-7 inline-flex items-center justify-center text-xs font-bold rounded-full bg-blue-100 text-blue-700">★</span>
          <span className="flex-1 text-sm font-bold text-blue-900 truncate flex items-center gap-1.5">
            <Target className="w-3 h-3 text-blue-500" />
            {lighthouseDay.ourHotelName}
          </span>
          <span className="text-sm font-bold text-blue-700 tabular-nums">{Math.round(day.currentPrice)}€</span>
        </div>
        {sortedComps.map((c, i) => (
          <div key={c.hotelName} className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-gray-50">
            <span className="w-7 h-7 inline-flex items-center justify-center text-xs font-bold rounded-full bg-gray-100 text-gray-700">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-700 truncate">{c.hotelName}</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{Math.round(c.price ?? 0)}€</span>
          </div>
        ))}
      </div>
      {unavailable.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Non disponibles</h4>
          <div className="space-y-1">
            {unavailable.map((c) => (
              <div key={c.hotelName} className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-50 text-xs">
                <span className="flex-1 text-gray-600 truncate">{c.hotelName}</span>
                <span className={cn(
                  'px-2 py-0.5 rounded font-semibold',
                  c.status === 'sold_out' ? 'bg-red-100 text-red-700' :
                  c.status === 'restricted' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-200 text-gray-600'
                )}>
                  {c.status === 'sold_out' ? 'Épuisé' : c.status === 'restricted' ? 'Restreint' : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab : Recommandation ────────────────────────────────────────────────

function RecommandationTab({
  day, reco, actionTitle, actionColor, justification,
}: {
  day: RMSModalDay;
  reco: { action: 'Augmenter' | 'Baisser' | 'Maintenir'; pct: number; targetPrice: number; deltaEur: number };
  actionTitle: string;
  actionColor: string;
  justification: ReturnType<typeof buildJustification>;
}) {
  return (
    <div className="space-y-5">
      {/* Action principale */}
      <div className={cn('rounded-lg border p-4 flex items-start justify-between', actionColor)}>
        <div>
          <h2 className="text-2xl font-extrabold mb-1">{actionTitle}</h2>
          <div className="text-sm font-medium opacity-80">
            {reco.pct >= 0 ? '+' : ''}{reco.pct.toFixed(1)}% ({Math.round(day.currentPrice)}€ → {Math.round(reco.targetPrice)}€, {reco.deltaEur >= 0 ? '+' : ''}{Math.round(reco.deltaEur)}€)
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Confiance</div>
          <div className={cn(
            'text-2xl font-extrabold',
            day.confidenceScore >= 80 ? 'text-emerald-700' :
            day.confidenceScore >= 60 ? 'text-amber-700' : 'text-red-700'
          )}>{day.confidenceScore}%</div>
        </div>
      </div>

      {/* Justification détaillée */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Justification détaillée</h3>
        </div>
        <div className="p-4 space-y-3 text-sm text-gray-700 leading-relaxed">
          {justification.narrative.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      {/* Risques + Opportunités */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Risques détectés</h3>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {justification.risks.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun risque significatif détecté.</p>
            ) : (
              justification.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{r}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Opportunités</h3>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {justification.opportunities.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune opportunité spécifique identifiée.</p>
            ) : (
              justification.opportunities.map((o, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn(
                    'inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                    o.tone === 'positive' ? 'bg-violet-500' : 'bg-amber-500'
                  )} />
                  <span className="text-gray-700">{o.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Impact attendu */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg border border-violet-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider">Impact attendu</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-violet-700 uppercase">Variation CA estimée</div>
            <div className={cn(
              'text-xl font-extrabold',
              justification.expectedImpact.revenue >= 0 ? 'text-emerald-700' : 'text-red-700'
            )}>
              {justification.expectedImpact.revenue >= 0 ? '+' : ''}{justification.expectedImpact.revenue}€
            </div>
          </div>
          <div>
            <div className="text-[11px] text-violet-700 uppercase">Occupation cible</div>
            <div className="text-xl font-extrabold text-violet-900">{justification.expectedImpact.occupancy}</div>
          </div>
        </div>
        <p className="text-[11px] text-violet-700 mt-2">
          Décision appliquée → push automatique vers Calendrier tarifaire + Channel Manager.
        </p>
      </div>
    </div>
  );
}

// ─── Tab : Restrictions ──────────────────────────────────────────────────

function RestrictionsTab({ restrictions, day }: { restrictions?: RMSRestrictions; day: RMSModalDay }) {
  if (!restrictions) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        Aucune restriction configurée sur cette date.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <RestrictionRow
        label="Stop sale (fermeture)"
        active={restrictions.closed}
        description="Bloque toute vente sur ce jour, tous canaux confondus"
      />
      <RestrictionRow
        label="CTA (Closed To Arrival)"
        active={restrictions.cta}
        description="Aucune nouvelle arrivée autorisée ce jour"
      />
      <RestrictionRow
        label="CTD (Closed To Departure)"
        active={restrictions.ctd}
        description="Aucun départ autorisé ce jour"
      />
      <RestrictionRow
        label={`Minimum stay${restrictions.minStay ? ` : ${restrictions.minStay} nuit${restrictions.minStay > 1 ? 's' : ''}` : ''}`}
        active={!!restrictions.minStay && restrictions.minStay > 1}
        description="Durée minimale de séjour imposée"
      />
      <RestrictionRow
        label={`Maximum stay${restrictions.maxStay ? ` : ${restrictions.maxStay} nuits` : ''}`}
        active={!!restrictions.maxStay}
        description="Durée maximale de séjour imposée"
      />

      <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        💡 Les restrictions actives impactent automatiquement la confiance et l'opportunité de la recommandation.
        Occupation actuelle : <strong>{Math.round(day.occupancyRate)}%</strong> · Disponibilité : <strong>{day.availability} chambres</strong>.
      </div>
    </div>
  );
}

function RestrictionRow({ label, active, description }: { label: string; active: boolean; description: string }) {
  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 rounded-lg border',
      active ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
    )}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        active ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-400'
      )}>
        <Lock className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className={cn('text-sm font-semibold', active ? 'text-amber-900' : 'text-gray-500')}>
          {label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <span className={cn(
        'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
        active ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'
      )}>
        {active ? 'Actif' : 'Inactif'}
      </span>
    </div>
  );
}

// ─── Tab : Historique ────────────────────────────────────────────────────

type SyncRecord = {
  id: string;
  timestamp: string;
  payload: {
    date: string;
    finalPrice: number;
    status: string;
    source: string;
  };
  applied: boolean;
  error?: string;
};

function HistoriqueTab({ history, day }: { history: SyncRecord[]; day: RMSModalDay }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        <Clock className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        Aucune décision enregistrée pour cette date.
        <div className="text-xs mt-1">
          Statut actuel : <strong>{day.validationStatus}</strong>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-2">
        {history.length} décision{history.length > 1 ? 's' : ''} sur cette date (le plus récent en premier)
      </div>
      {history.map((h) => (
        <div key={h.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-start gap-3">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            h.payload.status === 'Acceptée' ? 'bg-emerald-100 text-emerald-700' :
            h.payload.status === 'Refusée' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {h.payload.status === 'Acceptée' ? <Check className="w-4 h-4" /> :
              h.payload.status === 'Refusée' ? <X className="w-4 h-4" /> :
              <Minus className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{h.payload.status}</span>
              <span className="text-xs text-gray-400">→ {Math.round(h.payload.finalPrice)}€</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {new Date(h.timestamp).toLocaleString('fr-FR')} · source : {h.payload.source}
            </div>
            {h.error && (
              <div className="text-[11px] text-red-600 mt-1">⚠ {h.error}</div>
            )}
          </div>
          <span className={cn(
            'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
            h.applied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
          )}>
            {h.applied ? 'Appliquée' : 'Loggée'}
          </span>
        </div>
      ))}
    </div>
  );
}
