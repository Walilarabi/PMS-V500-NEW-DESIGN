/**
 * FLOWTYM — RecommandationRMPanel
 *
 * Onglet "Recommandation RM" du module RMS.
 * Couche d'explication des décisions du moteur déterministe.
 *
 * Structure :
 *   - Sélecteur de date en haut (dropdown + navigation ←/→)
 *   - Vue détail inline (sections A → E) calquée sur PremiumDayDetailModal
 *   - Tableau 17 colonnes en bas — clic sur ligne = sélection de la date
 *
 * Alimenté par les mêmes données que le Tableau RMS (data: DayRMSData[]).
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Target, TrendingUp, TrendingDown, Minus, Activity,
  AlertTriangle, AlertCircle, Calendar, Sparkles,
  Check, X, Edit3, Lock, Database, ChevronLeft, ChevronRight,
  Info,
} from 'lucide-react';
import type { DayRMSData } from '../RMSTableauPro';
import {
  buildRMRecommendation,
  type RMRecommendation,
  type SourceMode,
} from '../../../services/recommandation-rm.service';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

function fmtDateLong(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtDateShort(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short',
  });
}

type DemandLevel = 'Faible' | 'Moyenne' | 'Forte' | 'Très forte';
type CompressionLevel = 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée';

function getDemandLevel(score: number): DemandLevel {
  if (score >= 80) return 'Très forte';
  if (score >= 60) return 'Forte';
  if (score >= 30) return 'Moyenne';
  return 'Faible';
}

function getCompressionLevel(score: number): CompressionLevel {
  if (score >= 75) return 'Très élevée';
  if (score >= 50) return 'Élevée';
  if (score >= 25) return 'Moyenne';
  return 'Faible';
}

const DEMAND_COLORS: Record<DemandLevel, string> = {
  'Très forte': 'bg-red-100 text-red-800',
  'Forte':      'bg-amber-100 text-amber-800',
  'Moyenne':    'bg-blue-100 text-blue-800',
  'Faible':     'bg-gray-100 text-gray-600',
};

const COMPRESSION_COLORS: Record<CompressionLevel, string> = {
  'Très élevée': 'bg-red-100 text-red-800',
  'Élevée':      'bg-orange-100 text-orange-800',
  'Moyenne':     'bg-amber-100 text-amber-800',
  'Faible':      'bg-gray-100 text-gray-600',
};

const SOURCE_LABEL: Record<string, string> = {
  lighthouse: 'LH',
  expedia:    'EX',
  tie:        'LH=EX',
  none:       '–',
};

const SOURCE_BADGE_COLOR: Record<string, string> = {
  LH:      'bg-blue-100 text-blue-800',
  EX:      'bg-orange-100 text-orange-800',
  'LH=EX': 'bg-violet-100 text-violet-800',
  '–':     'bg-gray-100 text-gray-400',
};

const SOURCE_MODE_BADGE: Record<SourceMode, { cls: string; icon: typeof Database }> = {
  crossed:         { cls: 'bg-violet-50 text-violet-800 border-violet-200', icon: Database },
  lighthouse_only: { cls: 'bg-blue-50 text-blue-800 border-blue-200',       icon: Database },
  expedia_only:    { cls: 'bg-orange-50 text-orange-800 border-orange-200', icon: Database },
  none:            { cls: 'bg-gray-50 text-gray-500 border-gray-200',       icon: AlertCircle },
};

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHED ROW (mémoïsé)
// ═══════════════════════════════════════════════════════════════════════════

interface EnrichedRow {
  raw: DayRMSData;
  recommendation: RMRecommendation;
  demandScore: number;
  demandLevel: DemandLevel;
  compressionScore: number;
  compressionLevel: CompressionLevel;
  combinedPressure: number;
  scoreLH: number | null;
  scoreEX: number | null;
  dominantSourceLabel: string;
  confidenceScore: number;
  isContradiction: boolean;
  validationStatus: DayRMSData['validationStatus'];
}

function enrichRow(row: DayRMSData, totalCapacity: number): EnrichedRow {
  const bundle = row.marketBundle;
  const breakdown = row.recommendationBreakdown;
  const combinedPressure = bundle?.consensus.combinedPressure ?? row.marketPressure;
  const demandScore = breakdown?.demandScore.value ?? combinedPressure;
  const compressionScore = breakdown?.compressionScore.value ?? 0;
  const confidenceBonus = breakdown?.confidenceBonus ?? 0;
  const confidenceScore = Math.min(100, row.confidenceScore + confidenceBonus);

  const recommendation = buildRMRecommendation({
    date: row.date,
    bundle,
    breakdown,
    currentPrice: row.currentPrice,
    suggestedPrice: row.suggestedPrice,
    medianPrice: row.medianPrice,
    occupancyRate: row.occupancyRate,
    availability: row.availability,
    totalCapacity,
    pickupRate: row.pickupRate,
    varVsYesterday: row.varVsYesterday ?? null,
    varVs3Days: row.varVs3Days ?? null,
    varVs7Days: row.varVs7Days ?? null,
    eventsCount: row.events.length,
    recommendationLabel: row.recommendation,
    strategy: row.strategy,
  });

  const dominantSourceLabel = SOURCE_LABEL[bundle?.consensus.dominantSource ?? 'none'] ?? '–';

  return {
    raw: row,
    recommendation,
    demandScore,
    demandLevel: getDemandLevel(demandScore),
    compressionScore,
    compressionLevel: getCompressionLevel(compressionScore),
    combinedPressure,
    scoreLH: bundle?.lighthouse.pressurePercent ?? null,
    scoreEX: bundle?.expedia.pressurePercentNeighborhood ?? null,
    dominantSourceLabel,
    confidenceScore,
    isContradiction: bundle?.consensus.agreement === 'diverge',
    validationStatus: row.validationStatus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

interface Handlers {
  onAccept: (date: string) => void;
  onReject: (date: string) => void;
  onMaintain: (date: string) => void;
}

interface Props {
  data: DayRMSData[];
  totalCapacity: number;
  handlers: Handlers;
}

export function RecommandationRMPanel({ data, totalCapacity, handlers }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const enriched = useMemo(() => data.map(r => enrichRow(r, totalCapacity)), [data, totalCapacity]);

  // Sélectionne automatiquement la 1re date si rien n'est choisi
  useEffect(() => {
    if (!selectedDate && enriched.length > 0) {
      const today = enriched.find(r => r.raw.isToday);
      setSelectedDate(today?.raw.date ?? enriched[0].raw.date);
    }
  }, [enriched, selectedDate]);

  const selected = useMemo(
    () => enriched.find(r => r.raw.date === selectedDate) ?? null,
    [enriched, selectedDate],
  );

  const selectedIdx = selected ? enriched.findIndex(r => r.raw.date === selected.raw.date) : -1;
  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx >= 0 && selectedIdx < enriched.length - 1;

  const navigatePrev = () => { if (canPrev) setSelectedDate(enriched[selectedIdx - 1].raw.date); };
  const navigateNext = () => { if (canNext) setSelectedDate(enriched[selectedIdx + 1].raw.date); };

  return (
    <div className="p-4 space-y-5">
      {/* ── DATE SELECTOR ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
        <Calendar className="w-4 h-4 text-violet-600" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date analysée</span>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={navigatePrev}
            disabled={!canPrev}
            className={cn(
              'p-1.5 rounded transition-colors',
              canPrev ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed',
            )}
            title="Date précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={selectedDate ?? ''}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm font-semibold border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:outline-none min-w-[260px]"
          >
            {enriched.map(r => (
              <option key={r.raw.date} value={r.raw.date}>
                {fmtDateLong(r.raw.date)}{r.raw.isToday ? ' — aujourd\'hui' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={navigateNext}
            disabled={!canNext}
            className={cn(
              'p-1.5 rounded transition-colors',
              canNext ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed',
            )}
            title="Date suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {selectedIdx + 1} / {enriched.length} dates · couche d'explication des recommandations RMS
        </span>
      </div>

      {/* ── DETAIL VIEW ────────────────────────────────────────────────── */}
      {selected && <DetailView row={selected} handlers={handlers} />}

      {/* ── 17-COLUMN TABLE ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Toutes les recommandations · {enriched.length} dates
        </h3>
        <RecoTable
          rows={enriched}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL VIEW — sections A → E
// ═══════════════════════════════════════════════════════════════════════════

function DetailView({ row, handlers }: { row: EnrichedRow; handlers: Handlers }) {
  const reco = row.recommendation;
  const bundle = row.raw.marketBundle;

  const demandColor =
    row.demandScore >= 80 ? 'bg-red-50 text-red-700 border-red-200' :
    row.demandScore >= 60 ? 'bg-orange-50 text-orange-700 border-orange-200' :
    row.demandScore >= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-emerald-50 text-emerald-700 border-emerald-200';

  const sourceModeBadge = SOURCE_MODE_BADGE[reco.sourceMode];
  const SourceIcon = sourceModeBadge.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ─── HEADER premium ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-7 py-5 relative">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{fmtDateLong(row.raw.date)}</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Recommandation RM · {row.raw.strategy} · Confiance {row.confidenceScore}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
            demandColor,
          )}>
            <Activity className="w-3 h-3" />
            Demande {Math.round(row.demandScore)}% — {row.demandLevel}
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
            sourceModeBadge.cls,
          )}>
            <SourceIcon className="w-3 h-3" />
            {reco.sourceModeLabel}
          </span>
          {row.raw.events.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-medium border border-purple-400/30">
              🎉 {row.raw.events.length} événement{row.raw.events.length > 1 ? 's' : ''}
            </span>
          )}
          {reco.hasContradiction && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-200 text-xs font-medium border border-red-400/40">
              <AlertTriangle className="w-3 h-3" />
              Signal contradictoire
            </span>
          )}
        </div>
      </div>

      {/* ─── Contradiction banner ─────────────────────────────────── */}
      {reco.contradictionMessage && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 font-medium">{reco.contradictionMessage}</p>
        </div>
      )}

      {/* ─── SECTION A — Résumé KPI ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-gray-100 border-b border-gray-100">
        <KpiTile label="Pression marché"  value={`${Math.round(row.combinedPressure)}%`} accent={pressureAccent(row.combinedPressure)} />
        <KpiTile label="Compression"      value={Math.round(row.compressionScore)}        accent={compressionAccent(row.compressionScore)} sub={row.compressionLevel} />
        <KpiTile label="Confiance"        value={`${row.confidenceScore}%`}               accent={confidenceAccent(row.confidenceScore)} />
        <KpiTile label="Score Lighthouse" value={row.scoreLH !== null ? `${Math.round(row.scoreLH)}` : '–'} sub={row.scoreLH !== null ? '/ 100' : 'absent'} />
        <KpiTile label="Score Expedia"    value={row.scoreEX !== null ? `${Math.round(row.scoreEX)}` : '–'} sub={row.scoreEX !== null ? '/ 100' : 'absent'} />
        <KpiTile label="Source dominante" value={row.dominantSourceLabel} sub="signal arbitré" />
      </div>

      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── SECTION B — Analyse marché ───────────────────────── */}
        <Section title="Analyse marché" icon={Activity}>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <strong>Lecture pression :</strong>{' '}
              {row.combinedPressure >= 70 ? 'Marché tendu, opportunité de yield agressif.' :
               row.combinedPressure >= 40 ? 'Marché actif, ajustement modéré recommandé.' :
               'Marché calme, prudence sur les hausses.'}
            </li>
            <li>
              <strong>Tendance tarifaire compset :</strong>{' '}
              {row.raw.varVsYesterday !== null && Math.abs(row.raw.varVsYesterday) >= 0.5
                ? `${row.raw.varVsYesterday >= 0 ? '+' : ''}${row.raw.varVsYesterday.toFixed(1)}% vs hier`
                : 'stable vs hier'}
              {row.raw.varVs7Days !== null && Math.abs(row.raw.varVs7Days) >= 0.5
                ? `, ${row.raw.varVs7Days >= 0 ? '+' : ''}${row.raw.varVs7Days.toFixed(1)}% vs J-7`
                : ''}
            </li>
            <li>
              <strong>Niveau de tension :</strong>{' '}
              <span className={cn('px-2 py-0.5 rounded text-xs font-semibold ml-1', COMPRESSION_COLORS[row.compressionLevel])}>
                {row.compressionLevel}
              </span>
            </li>
            {bundle?.expedia.available && bundle.expedia.competitorCount > 0 && (
              <li>
                <strong>Risque sold-out concurrent :</strong>{' '}
                {bundle.expedia.soldOutCount} / {bundle.expedia.competitorCount} concurrents épuisés
                {bundle.expedia.soldOutCount / bundle.expedia.competitorCount >= 0.5 && (
                  <span className="ml-2 text-red-700 font-semibold">⚠ élevé</span>
                )}
              </li>
            )}
          </ul>
        </Section>

        {/* ─── SECTION C — Analyse concurrence ──────────────────── */}
        <Section title="Analyse concurrence" icon={Target}>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <CompsetMetric label="Médiane" value={row.raw.medianPrice ? `${row.raw.medianPrice}€` : '–'} />
            <CompsetMetric label="Min"     value={row.raw.minPrice    ? `${row.raw.minPrice}€`    : '–'} accent="text-emerald-600" />
            <CompsetMetric label="Max"     value={row.raw.maxPrice    ? `${row.raw.maxPrice}€`    : '–'} accent="text-orange-600" />
            <CompsetMetric label="Notre tarif" value={row.raw.currentPrice ? `${row.raw.currentPrice}€` : '–'} accent="text-blue-700" wide />
            {row.raw.medianPrice > 0 && row.raw.currentPrice > 0 && (
              <CompsetMetric
                label="Écart médiane"
                value={`${((row.raw.currentPrice - row.raw.medianPrice) / row.raw.medianPrice * 100).toFixed(1)}%`}
                accent={
                  row.raw.currentPrice > row.raw.medianPrice ? 'text-emerald-600' : 'text-red-600'
                }
                wide
              />
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Positionnement :</span>{' '}
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-semibold',
              reco.pricePositioning === 'sous_marche' ? 'bg-blue-100 text-blue-800' :
              reco.pricePositioning === 'mid_market'  ? 'bg-gray-100 text-gray-700' :
              reco.pricePositioning === 'premium'     ? 'bg-emerald-100 text-emerald-800' :
              reco.pricePositioning === 'trop_cher'   ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-400',
            )}>
              {reco.pricePositioningLabel}
            </span>
          </div>
        </Section>
      </div>

      {/* ─── SECTION D — Recommandation explicative ───────────────── */}
      <div className="px-6 py-5 bg-violet-50/30 border-t border-violet-100">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recommandation RM</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Recommandation principale + action tarifaire */}
          <div className="space-y-3">
            <div className="bg-white border border-violet-200 rounded-lg p-4">
              <div className="text-xs text-violet-700 font-semibold uppercase tracking-wide mb-1">Recommandation principale</div>
              <div className={cn(
                'text-xl font-bold mb-2',
                row.raw.recommendation === 'Augmenter' ? 'text-emerald-700' :
                row.raw.recommendation === 'Baisser'   ? 'text-red-700' :
                'text-gray-700',
              )}>
                {reco.actionLabel}
              </div>
              <div className="text-sm text-gray-700">{reco.priceAction}</div>
            </div>

            {/* Restrictions */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">Restrictions recommandées</span>
              </div>
              {reco.restrictions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune restriction calculée.</p>
              ) : (
                <ul className="space-y-1">
                  {reco.restrictions.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Risques + explication */}
          <div className="space-y-3">
            {/* Risques */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">Risques détectés</span>
              </div>
              {reco.risks.length === 0 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Aucun risque détecté sur cette date.
                </p>
              ) : (
                <ul className="space-y-1">
                  {reco.risks.map((r, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Explication détaillée — bloc large pleine largeur */}
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">Explication détaillée</span>
          </div>
          {reco.detailedExplanation.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Pas d'éléments d'analyse disponibles pour cette date.</p>
          ) : (
            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
              {reco.detailedExplanation.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── SECTION E — Actions ──────────────────────────────────── */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-2 justify-between">
        <div className="text-xs text-gray-600">
          Statut actuel :{' '}
          <span className={cn(
            'px-2 py-0.5 rounded font-semibold',
            row.validationStatus === 'Acceptée'  ? 'bg-emerald-100 text-emerald-800' :
            row.validationStatus === 'Refusée'   ? 'bg-red-100 text-red-800' :
            row.validationStatus === 'Maintenue' ? 'bg-gray-200 text-gray-700' :
            'bg-amber-100 text-amber-800',
          )}>
            {row.validationStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlers.onAccept(row.raw.date)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Accepter
          </button>
          <button
            onClick={() => handlers.onMaintain(row.raw.date)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-sm font-semibold rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
            Maintenir
          </button>
          <button
            onClick={() => handlers.onReject(row.raw.date)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 text-sm font-semibold rounded-md border border-red-300 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Refuser
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-400 text-sm font-semibold rounded-md border border-gray-200 cursor-not-allowed"
            title="Modification manuelle du tarif final — disponible dans le tableau RMS principal"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 17-COLUMN TABLE
// ═══════════════════════════════════════════════════════════════════════════

function RecoTable({
  rows, selectedDate, onSelect,
}: {
  rows: EnrichedRow[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 whitespace-nowrap">Date</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700">Jour</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 min-w-[140px]">Événement</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Niv. demande</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-700">Pression</th>
            <th className="px-2 py-2 text-center font-semibold text-blue-700">LH</th>
            <th className="px-2 py-2 text-center font-semibold text-orange-700">EX</th>
            <th className="px-2 py-2 text-center font-semibold text-violet-700 whitespace-nowrap">Score croisé</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Niv. compression</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-700">Source</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-700">Confiance</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 whitespace-nowrap">Recommandation</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 whitespace-nowrap">Action tarifaire</th>
            <th className="px-2 py-2 text-left  font-semibold text-amber-700 min-w-[140px]">Restriction</th>
            <th className="px-2 py-2 text-left  font-semibold text-red-700 min-w-[140px]">Risque</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 min-w-[220px]">Explication</th>
            <th className="px-2 py-2 text-left  font-semibold text-gray-700 whitespace-nowrap">Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isSelected = r.raw.date === selectedDate;
            const eventStr   = r.raw.events.map(e => e.name).join(', ') || '–';
            const restrictionStr = r.recommendation.restrictions.join(' · ') || '–';
            const riskStr = r.recommendation.risks.length > 0
              ? r.recommendation.risks[0] + (r.recommendation.risks.length > 1 ? ` (+${r.recommendation.risks.length - 1})` : '')
              : '–';
            const explanationFirst = r.recommendation.detailedExplanation[0] ?? '–';

            return (
              <tr
                key={r.raw.date}
                onClick={() => onSelect(r.raw.date)}
                className={cn(
                  'border-b border-gray-100 cursor-pointer transition-colors',
                  isSelected         ? 'bg-violet-100 hover:bg-violet-100 ring-1 ring-inset ring-violet-300' :
                  r.raw.isToday      ? 'bg-blue-50/30 hover:bg-blue-50' :
                  r.raw.isWeekend    ? 'bg-gray-50/40 hover:bg-gray-100' :
                  'hover:bg-gray-50',
                )}
              >
                <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{fmtDateShort(r.raw.date)}</td>
                <td className="px-2 py-1.5 text-gray-600">{r.raw.dayName}</td>
                <td className="px-2 py-1.5 text-gray-700 truncate max-w-[140px]" title={eventStr}>{eventStr}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', DEMAND_COLORS[r.demandLevel])}>
                    {r.demandLevel}
                  </span>
                </td>
                <td className={cn('px-2 py-1.5 text-center font-bold tabular-nums',
                  r.combinedPressure >= 70 ? 'text-red-700' :
                  r.combinedPressure >= 40 ? 'text-amber-700' : 'text-gray-600',
                )}>
                  {Math.round(r.combinedPressure)}%
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-blue-700">
                  {r.scoreLH !== null ? Math.round(r.scoreLH) : <span className="text-gray-300">–</span>}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-orange-700">
                  {r.scoreEX !== null ? Math.round(r.scoreEX) : <span className="text-gray-300">–</span>}
                </td>
                <td className={cn('px-2 py-1.5 text-center font-bold tabular-nums',
                  r.combinedPressure >= 70 ? 'text-red-700' :
                  r.combinedPressure >= 40 ? 'text-amber-700' : 'text-gray-600',
                )}>
                  {Math.round(r.combinedPressure)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', COMPRESSION_COLORS[r.compressionLevel])}>
                    {r.compressionLevel}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', SOURCE_BADGE_COLOR[r.dominantSourceLabel] ?? 'bg-gray-100 text-gray-400')}>
                    {r.dominantSourceLabel}
                  </span>
                </td>
                <td className={cn('px-2 py-1.5 text-center font-semibold tabular-nums',
                  r.confidenceScore >= 80 ? 'text-emerald-700' :
                  r.confidenceScore >= 60 ? 'text-amber-700' : 'text-red-600',
                )}>
                  {r.confidenceScore}%
                </td>
                <td className={cn('px-2 py-1.5 font-semibold whitespace-nowrap',
                  r.raw.recommendation === 'Augmenter' ? 'text-emerald-700' :
                  r.raw.recommendation === 'Baisser'   ? 'text-red-700' : 'text-gray-700',
                )}>
                  {r.recommendation.actionLabel}
                </td>
                <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{r.recommendation.priceAction}</td>
                <td className="px-2 py-1.5 text-amber-800 truncate max-w-[140px]" title={restrictionStr}>{restrictionStr}</td>
                <td className="px-2 py-1.5 text-red-700 truncate max-w-[140px]" title={riskStr}>
                  {r.recommendation.risks.length > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {riskStr}
                </td>
                <td className="px-2 py-1.5 text-gray-600 truncate max-w-[220px]" title={explanationFirst}>{explanationFirst}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap',
                    r.validationStatus === 'Acceptée'  ? 'bg-emerald-100 text-emerald-800' :
                    r.validationStatus === 'Refusée'   ? 'bg-red-100 text-red-800' :
                    r.validationStatus === 'Maintenue' ? 'bg-gray-200 text-gray-700' :
                    'bg-amber-100 text-amber-800',
                  )}>
                    {r.validationStatus}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={17} className="px-6 py-12 text-center text-gray-400 text-sm">
                Aucune donnée à afficher.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

function KpiTile({
  label, value, sub, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={cn('text-xl font-bold tabular-nums', accent ?? 'text-gray-900')}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({
  title, icon: Icon, children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</h3>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        {children}
      </div>
    </div>
  );
}

function CompsetMetric({
  label, value, accent, wide,
}: {
  label: string;
  value: string;
  accent?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('px-2 py-1.5', wide && 'col-span-3 sm:col-span-2 md:col-span-3 lg:col-span-3 border-t border-gray-100 mt-1 pt-2')}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={cn('text-base font-bold tabular-nums', accent ?? 'text-gray-900')}>{value}</div>
    </div>
  );
}

// ─── Accent helpers ─────────────────────────────────────────────────────────

function pressureAccent(v: number): string {
  if (v >= 70) return 'text-red-700';
  if (v >= 40) return 'text-amber-700';
  return 'text-gray-700';
}

function compressionAccent(v: number): string {
  if (v >= 75) return 'text-red-700';
  if (v >= 50) return 'text-orange-700';
  return 'text-gray-700';
}

function confidenceAccent(v: number): string {
  if (v >= 80) return 'text-emerald-700';
  if (v >= 60) return 'text-amber-700';
  return 'text-red-600';
}
