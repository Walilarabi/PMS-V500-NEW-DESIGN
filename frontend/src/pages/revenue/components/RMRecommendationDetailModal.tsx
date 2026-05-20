/**
 * FLOWTYM — RMRecommendationDetailModal
 *
 * Modal premium détail RM ouverte au clic sur une ligne du panel
 * Recommandation RM. Reprend le design de PremiumDayDetailModal en
 * version plus structurée avec onglets internes.
 *
 * Structure :
 *   - Header sombre compact (date + badges contextuels + navigation ←/→)
 *   - Bande KPI horizontale (7 KPIs)
 *   - Navigation par onglets (Marché · Concurrence · Recommandation · Restrictions · Historique)
 *   - Contenu de l'onglet (scrollable interne)
 *   - Pied d'action (Accepter / Maintenir / Refuser / Modifier le tarif)
 */

import React, { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Calendar, Activity, Target,
  Sparkles, Lock, Clock, AlertTriangle, Check, Minus, Edit3,
  TrendingUp, TrendingDown, Database, Info, Lightbulb,
} from 'lucide-react';
import type { DayRMSData } from '../RMSTableauPro';
import type { RMRecommendation, SourceMode } from '../../../services/recommandation-rm.service';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

function fmtDateLong(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
  'Très forte': 'bg-red-100 text-red-800 border-red-200',
  'Forte':      'bg-amber-100 text-amber-800 border-amber-200',
  'Moyenne':    'bg-blue-100 text-blue-800 border-blue-200',
  'Faible':     'bg-gray-100 text-gray-600 border-gray-200',
};

const SOURCE_MODE_BADGE: Record<SourceMode, { cls: string; label: string }> = {
  crossed:         { cls: 'bg-violet-50 text-violet-800 border-violet-200', label: 'Croisé LH + EX' },
  lighthouse_only: { cls: 'bg-blue-50 text-blue-800 border-blue-200',       label: 'Lighthouse seul' },
  expedia_only:    { cls: 'bg-orange-50 text-orange-800 border-orange-200', label: 'Expedia seul' },
  none:            { cls: 'bg-gray-50 text-gray-500 border-gray-200',       label: 'Aucune source' },
};

function pressureAccent(v: number): string {
  if (v >= 70) return 'text-red-700';
  if (v >= 40) return 'text-amber-700';
  return 'text-gray-700';
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RMDetailEnrichment {
  recommendation: RMRecommendation;
  demandScore: number;
  compressionScore: number;
  combinedPressure: number;
  scoreLH: number | null;
  scoreEX: number | null;
  dominantSourceLabel: string;
  confidenceScore: number;
  isContradiction: boolean;
}

interface Props {
  row: DayRMSData;
  enrichment: RMDetailEnrichment;
  onClose: () => void;
  onAccept: (date: string) => void;
  onReject: (date: string) => void;
  onMaintain: (date: string) => void;
  onPriceOverride?: (date: string, price: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

type Tab = 'marche' | 'concurrence' | 'recommandation' | 'restrictions' | 'historique';

const TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: 'marche',         label: 'Marché',         icon: Activity },
  { key: 'concurrence',    label: 'Concurrence',    icon: Target },
  { key: 'recommandation', label: 'Recommandation', icon: Sparkles },
  { key: 'restrictions',   label: 'Restrictions',   icon: Lock },
  { key: 'historique',     label: 'Historique',     icon: Clock },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

export function RMRecommendationDetailModal({
  row, enrichment, onClose,
  onAccept, onReject, onMaintain, onPriceOverride,
  onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const [tab, setTab] = useState<Tab>('recommandation');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState(String(row.suggestedPrice || row.currentPrice));

  const { recommendation: reco } = enrichment;
  const demandLevel = getDemandLevel(enrichment.demandScore);
  const compressionLevel = getCompressionLevel(enrichment.compressionScore);
  const sourceModeBadge = SOURCE_MODE_BADGE[reco.sourceMode];

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  const handlePriceCommit = () => {
    const n = parseInt(priceDraft, 10);
    if (isFinite(n) && n > 0 && onPriceOverride) {
      onPriceOverride(row.date, n);
      setEditingPrice(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{fmtDateLong(row.date)}</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Recommandation RM · {row.strategy} · Confiance {enrichment.confidenceScore}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  hasPrev ? 'hover:bg-white/10 text-white' : 'text-white/30 cursor-not-allowed',
                )}
                title="Date précédente (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  hasNext ? 'hover:bg-white/10 text-white' : 'text-white/30 cursor-not-allowed',
                )}
                title="Date suivante (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="ml-1 p-1.5 rounded hover:bg-white/10 text-white/80 hover:text-white"
                title="Fermer (Échap)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Badges contextuels */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Badge className={DEMAND_COLORS[demandLevel] + ' bg-opacity-90'}>
              <Activity className="w-3 h-3" />
              {demandLevel} · {Math.round(enrichment.demandScore)}%
            </Badge>
            <Badge className={sourceModeBadge.cls + ' bg-opacity-90'}>
              <Database className="w-3 h-3" />
              {sourceModeBadge.label}
            </Badge>
            {row.events.length > 0 && (
              <Badge className="bg-purple-500/20 text-purple-200 border-purple-400/30">
                🎉 {row.events.length} événement{row.events.length > 1 ? 's' : ''}
              </Badge>
            )}
            {enrichment.isContradiction && (
              <Badge className="bg-red-500/20 text-red-200 border-red-400/40">
                <AlertTriangle className="w-3 h-3" />
                Signal contradictoire
              </Badge>
            )}
          </div>
        </div>

        {/* ── KPI STRIP ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-200 bg-gray-50/50">
          <KpiCell label="Médiane"     value={row.medianPrice > 0 ? `${row.medianPrice}€` : '—'} />
          <KpiCell label="Min"         value={row.minPrice > 0 ? `${row.minPrice}€` : '—'} accent="text-emerald-600" />
          <KpiCell label="Max"         value={row.maxPrice > 0 ? `${row.maxPrice}€` : '—'} accent="text-orange-600" />
          <KpiCell label="Notre tarif" value={row.currentPrice > 0 ? `${row.currentPrice}€` : '—'} accent="text-blue-700" />
          <KpiCell
            label="Écart médiane"
            value={
              row.medianPrice > 0 && row.currentPrice > 0
                ? `${((row.currentPrice - row.medianPrice) / row.medianPrice * 100).toFixed(1)}%`
                : '—'
            }
            accent={
              row.medianPrice > 0 && row.currentPrice > row.medianPrice ? 'text-emerald-600' :
              row.medianPrice > 0 && row.currentPrice < row.medianPrice ? 'text-red-600' : 'text-gray-700'
            }
          />
          <KpiCell label="Compression" value={Math.round(enrichment.compressionScore)} sub={compressionLevel} />
          <KpiCell
            label="Sold-out comp."
            value={row.marketBundle?.expedia.soldOutCount ?? '—'}
            sub={row.marketBundle?.expedia.competitorCount ? `/ ${row.marketBundle.expedia.competitorCount}` : ''}
          />
        </div>

        {/* ── TABS ──────────────────────────────────────────────────── */}
        <div className="flex items-center border-b border-gray-200 bg-white px-3 gap-0.5 overflow-x-auto">
          {TABS.map(t => {
            const TabIcon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px',
                  active
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-gray-500 hover:text-gray-900',
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/40 px-6 py-5">
          {tab === 'marche'         && <MarcheTab        row={row} enrichment={enrichment} />}
          {tab === 'concurrence'    && <ConcurrenceTab   row={row} />}
          {tab === 'recommandation' && <RecommandationTab row={row} enrichment={enrichment} />}
          {tab === 'restrictions'   && <RestrictionsTab  reco={reco} />}
          {tab === 'historique'     && <HistoriqueTab    row={row} enrichment={enrichment} />}
        </div>

        {/* ── ACTION FOOTER ─────────────────────────────────────────── */}
        <div className="px-6 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Statut actuel :</span>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-semibold',
              row.validationStatus === 'Acceptée'  ? 'bg-emerald-100 text-emerald-800' :
              row.validationStatus === 'Refusée'   ? 'bg-red-100 text-red-800' :
              row.validationStatus === 'Maintenue' ? 'bg-gray-200 text-gray-700' :
              'bg-amber-100 text-amber-800',
            )}>
              {row.validationStatus}
            </span>
            {row.finalPrice !== null && (
              <span className="text-xs text-gray-600">
                Final : <span className="font-bold text-gray-900">{row.finalPrice}€</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editingPrice ? (
              <div className="flex items-center gap-1.5 bg-violet-50 px-2 py-1 rounded-md border border-violet-300">
                <input
                  type="number"
                  value={priceDraft}
                  onChange={e => setPriceDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handlePriceCommit();
                    if (e.key === 'Escape') { setEditingPrice(false); setPriceDraft(String(row.suggestedPrice || row.currentPrice)); }
                  }}
                  className="w-20 px-1.5 py-0.5 text-sm font-semibold border border-violet-300 rounded outline-none focus:ring-1 focus:ring-violet-500"
                  autoFocus
                />
                <span className="text-xs text-gray-600">€</span>
                <button onClick={handlePriceCommit} className="px-2 py-0.5 bg-violet-600 text-white text-xs font-semibold rounded hover:bg-violet-700">
                  Valider
                </button>
                <button onClick={() => setEditingPrice(false)} className="px-1 py-0.5 text-gray-500 hover:text-gray-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                {onPriceOverride && (
                  <button
                    onClick={() => setEditingPrice(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-700 border border-violet-300 rounded-md bg-white hover:bg-violet-50"
                  >
                    <Edit3 className="w-3 h-3" />
                    Modifier
                  </button>
                )}
                <button
                  onClick={() => onReject(row.date)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-300 rounded-md bg-white hover:bg-red-50"
                >
                  <X className="w-3 h-3" />
                  Refuser
                </button>
                <button
                  onClick={() => onMaintain(row.date)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-100"
                >
                  <Minus className="w-3 h-3" />
                  Maintenir
                </button>
                <button
                  onClick={() => onAccept(row.date)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                >
                  <Check className="w-3 h-3" />
                  Accepter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', className)}>
      {children}
    </span>
  );
}

function KpiCell({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={cn('text-base font-bold tabular-nums leading-tight', accent ?? 'text-gray-900')}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, children, action }: {
  title: string;
  icon?: typeof Activity;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB CONTENTS
// ═══════════════════════════════════════════════════════════════════════════

function MarcheTab({ row, enrichment }: { row: DayRMSData; enrichment: RMDetailEnrichment }) {
  const bundle = row.marketBundle;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card title="Pression marché" icon={Activity}>
        <div className="space-y-2 text-sm">
          <Row label="Pression composite" value={`${Math.round(enrichment.combinedPressure)}%`} accent={pressureAccent(enrichment.combinedPressure)} bold />
          <Row label="Score Lighthouse" value={enrichment.scoreLH !== null ? `${Math.round(enrichment.scoreLH)}/100` : 'Absent'} />
          <Row label="Score Expedia voisinage" value={enrichment.scoreEX !== null ? `${Math.round(enrichment.scoreEX)}/100` : 'Absent'} />
          <Row label="Source dominante" value={enrichment.dominantSourceLabel} />
          {bundle?.consensus.agreement === 'diverge' && bundle.consensus.contradictionDelta !== null && (
            <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Contradiction de {Math.round(bundle.consensus.contradictionDelta)} pts entre Lighthouse et Expedia.</span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Évolution tarifaire compset" icon={TrendingUp}>
        <div className="space-y-2 text-sm">
          <Row label="vs Hier"
            value={row.varVsYesterday !== null && row.varVsYesterday !== undefined
              ? `${row.varVsYesterday >= 0 ? '+' : ''}${row.varVsYesterday.toFixed(1)}%`
              : '—'}
            accent={row.varVsYesterday ? (row.varVsYesterday >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}
          />
          <Row label="vs 3 jours"
            value={row.varVs3Days !== null && row.varVs3Days !== undefined
              ? `${row.varVs3Days >= 0 ? '+' : ''}${row.varVs3Days.toFixed(1)}%`
              : '—'}
            accent={row.varVs3Days ? (row.varVs3Days >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}
          />
          <Row label="vs 7 jours"
            value={row.varVs7Days !== null && row.varVs7Days !== undefined
              ? `${row.varVs7Days >= 0 ? '+' : ''}${row.varVs7Days.toFixed(1)}%`
              : '—'}
            accent={row.varVs7Days ? (row.varVs7Days >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}
          />
        </div>
      </Card>

      <Card title="Demande & inventaire" icon={Database}>
        <div className="space-y-2 text-sm">
          <Row label="Taux d'occupation" value={`${Math.round(row.occupancyRate)}%`}
            accent={row.occupancyRate >= 85 ? 'text-red-700' : row.occupancyRate >= 70 ? 'text-amber-700' : 'text-gray-700'} />
          <Row label="Disponibilité" value={`${row.availability} chambres`} />
          <Row label="Lead time médian" value={`${row.leadTimeMajority} jours`} />
          <Row label="Pickup"
            value={`${row.pickupRate >= 0 ? '+' : ''}${row.pickupRate.toFixed(1)}%`}
            accent={row.pickupRate > 5 ? 'text-emerald-700' : row.pickupRate < 0 ? 'text-red-700' : 'text-gray-700'} />
        </div>
      </Card>

      <Card title="Événements" icon={Sparkles}>
        {row.events.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun événement répertorié sur cette date.</p>
        ) : (
          <ul className="space-y-1.5">
            {row.events.map((ev, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                <span>
                  <span className="font-medium">{ev.name}</span>
                  {ev.location && <span className="text-xs text-gray-500"> · {ev.location}</span>}
                  {ev.impact && <span className="text-xs text-amber-700 ml-1">({ev.impact})</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ConcurrenceTab({ row }: { row: DayRMSData }) {
  const bundle = row.marketBundle;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card title="Positionnement compset" icon={Target}>
        <div className="space-y-2 text-sm">
          <Row label="Médiane compset" value={row.medianPrice > 0 ? `${row.medianPrice}€` : '—'} bold />
          <Row label="Min compset" value={row.minPrice > 0 ? `${row.minPrice}€` : '—'} accent="text-emerald-600" />
          <Row label="Max compset" value={row.maxPrice > 0 ? `${row.maxPrice}€` : '—'} accent="text-orange-600" />
          <Row label="Notre tarif" value={row.currentPrice > 0 ? `${row.currentPrice}€` : '—'} accent="text-blue-700" bold />
          {row.medianPrice > 0 && row.currentPrice > 0 && (
            <Row
              label="Écart vs médiane"
              value={`${((row.currentPrice - row.medianPrice) / row.medianPrice * 100).toFixed(1)}%`}
              accent={row.currentPrice > row.medianPrice ? 'text-emerald-600' : 'text-red-600'}
            />
          )}
        </div>
      </Card>

      <Card title="Signaux concurrents" icon={Database}>
        <div className="space-y-2 text-sm">
          <Row label="Concurrents suivis (Expedia)" value={bundle?.expedia.competitorCount ?? '—'} />
          <Row label="Sold-out" value={bundle?.expedia.soldOutCount ?? '—'}
            accent={(bundle?.expedia.soldOutCount ?? 0) > 3 ? 'text-red-700' : 'text-gray-700'} />
          <Row label="En restriction" value={bundle?.expedia.restrictedCount ?? '—'}
            accent={(bundle?.expedia.restrictedCount ?? 0) > 3 ? 'text-amber-700' : 'text-gray-700'} />
          {bundle && bundle.expedia.competitorCount > 0 && (
            <Row
              label="Ratio sold-out"
              value={`${Math.round((bundle.expedia.soldOutCount / bundle.expedia.competitorCount) * 100)}%`}
              accent={(bundle.expedia.soldOutCount / bundle.expedia.competitorCount) >= 0.5 ? 'text-red-700' : 'text-gray-700'}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function RecommandationTab({ row, enrichment }: { row: DayRMSData; enrichment: RMDetailEnrichment }) {
  const reco = enrichment.recommendation;
  return (
    <div className="space-y-3">
      <div className={cn(
        'rounded-lg p-4 flex items-center justify-between gap-4',
        row.recommendation === 'Augmenter' ? 'bg-emerald-50 border border-emerald-200' :
        row.recommendation === 'Baisser'   ? 'bg-red-50 border border-red-200' :
        'bg-gray-50 border border-gray-200',
      )}>
        <div>
          <div className={cn(
            'text-2xl font-bold',
            row.recommendation === 'Augmenter' ? 'text-emerald-700' :
            row.recommendation === 'Baisser'   ? 'text-red-700' : 'text-gray-700',
          )}>
            {reco.actionLabel}
          </div>
          <div className="text-sm text-gray-700 mt-1">{reco.priceAction}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Confiance</div>
          <div className={cn(
            'text-2xl font-bold tabular-nums',
            enrichment.confidenceScore >= 80 ? 'text-emerald-700' :
            enrichment.confidenceScore >= 60 ? 'text-amber-700' : 'text-red-600',
          )}>
            {enrichment.confidenceScore}%
          </div>
        </div>
      </div>

      <Card title="Justification détaillée" icon={Info}>
        {reco.detailedExplanation.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Pas d'éléments d'analyse disponibles.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
            {reco.detailedExplanation.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Risques détectés" icon={AlertTriangle}>
          {reco.risks.length === 0 ? (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Aucun risque détecté.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {reco.risks.map((r, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Opportunités" icon={Lightbulb}>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li className="flex items-start gap-1.5">
              <span className="w-1 h-1 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
              Positionnement : {reco.pricePositioningLabel}
            </li>
            {reco.priceDeltaPercent > 0 && (
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                Yield potentiel : +{reco.priceDeltaAbsolute}€ par chambre vendue
              </li>
            )}
            {enrichment.combinedPressure >= 60 && (
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                Pression marché élevée — fenêtre de hausse limitée dans le temps
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function RestrictionsTab({ reco }: { reco: RMRecommendation }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card title="Restrictions recommandées" icon={Lock}>
        {reco.restrictions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune restriction calculée pour cette date.</p>
        ) : (
          <ul className="space-y-2">
            {reco.restrictions.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800 py-1.5 border-b border-gray-100 last:border-0">
                <Lock className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HistoriqueTab({ row, enrichment }: { row: DayRMSData; enrichment: RMDetailEnrichment }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
      <Card title="État actuel" icon={Clock}>
        <div className="space-y-2 text-sm">
          <Row label="Statut" value={row.validationStatus} />
          <Row label="Stratégie active" value={row.strategy} />
          <Row label="Recommandation" value={row.recommendation} />
          <Row label="Confiance moteur" value={`${enrichment.confidenceScore}%`} />
        </div>
      </Card>
      <Card title="Données disponibles" icon={Database}>
        <div className="space-y-2 text-sm">
          <Row label="Lighthouse" value={row.marketBundle?.lighthouse.available ? '✓ disponible' : '✗ absent'}
            accent={row.marketBundle?.lighthouse.available ? 'text-emerald-700' : 'text-gray-400'} />
          <Row label="Expedia" value={row.marketBundle?.expedia.available ? '✓ disponible' : '✗ absent'}
            accent={row.marketBundle?.expedia.available ? 'text-emerald-700' : 'text-gray-400'} />
          <Row label="Salons / événements" value={row.events.length > 0 ? `${row.events.length} référencés` : 'Aucun'} />
          <Row label="PMS opérationnel" value={row.availability > 0 || row.occupancyRate > 0 ? '✓ disponible' : '✗ absent'}
            accent={row.availability > 0 || row.occupancyRate > 0 ? 'text-emerald-700' : 'text-gray-400'} />
        </div>
      </Card>
      <Card title="Tarifs">
        <div className="space-y-2 text-sm">
          <Row label="Tarif actuel" value={row.currentPrice > 0 ? `${row.currentPrice}€` : '—'} />
          <Row label="Tarif suggéré" value={row.suggestedPrice > 0 ? `${row.suggestedPrice}€` : '—'}
            accent={row.suggestedPrice > row.currentPrice ? 'text-emerald-700' : row.suggestedPrice < row.currentPrice ? 'text-red-700' : 'text-gray-700'} />
          <Row label="Tarif final" value={row.finalPrice !== null ? `${row.finalPrice}€` : 'Non décidé'}
            accent={row.finalPrice !== null ? 'text-gray-900' : 'text-gray-400'} bold />
        </div>
      </Card>
      <Card title="Note">
        <p className="text-xs text-gray-500 leading-relaxed">
          L'historique des décisions par date sera enrichi en Palier 5 — persistance dans <code className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">rms_decisions</code>{' '}
          (audit append-only).
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string | number; accent?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      <span className={cn('tabular-nums', bold ? 'font-bold' : 'font-medium', accent ?? 'text-gray-900')}>{value}</span>
    </div>
  );
}
