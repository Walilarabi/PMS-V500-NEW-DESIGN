/**
 * FLOWTYM — Panneau flottant ancré à la cellule cliquée
 *
 * Au clic sur une date du graphique Marché, ce panneau s'ouvre :
 *   - ancré à la position du clic (droite si espace, sinon gauche)
 *   - reste 100% visible dans le viewport (clamp X/Y)
 *   - animation fluide d'entrée
 *   - se ferme via X, Escape ou clic extérieur
 *
 * Contenu :
 *   1. Analyse concurrentielle (10 hôtels triés, rang, écart médiane,
 *      min/max, compression, agressivité marché)
 *   2. Décision RM : Accepter / Refuser / Maintenir
 *   3. Si Refus → mini questionnaire (raison + tarif manuel + commentaire
 *      + stratégie + durée + impact estimé) journalisé
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Check, Equal, AlertTriangle, Sparkles, TrendingUp, ChevronDown,
  Shield, ArrowUp, ArrowDown,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  recommendationFeedback,
  REJECTION_REASONS,
  type RejectionReasonCode,
  type FeedbackEntry,
} from '@/src/services/revenue/recommendationFeedback.service';

export interface MarketDay {
  label: string;
  date: string;
  demand: number;
  ourPrice: number;
  median: number;
  mean: number;
  q25: number;
  q75: number;
}

export interface MarketDayFloatingPanelProps {
  /** Jour sélectionné (ou null = fermé). */
  day: MarketDay | null;
  /** Liste des hôtels compset (10) — utilisé pour générer les prix. */
  compsetHotels: string[];
  /** Position du clic dans le viewport (x, y). */
  anchor: { x: number; y: number } | null;
  /** Fermeture (X, Escape, clic extérieur). */
  onClose: () => void;
}

const PANEL_WIDTH = 380;
const PANEL_MAX_HEIGHT = 620;
const PANEL_GAP = 12;

/** Génère les prix des 10 concurrents (mock déterministe basé sur q25/q75/median). */
function buildCompsetPrices(
  hotels: string[],
  q25: number,
  q75: number,
  median: number,
): Array<{ name: string; price: number; status: 'available' | 'closed' }> {
  if (hotels.length === 0) return [];
  const range = q75 - q25;
  return hotels.map((name, i) => {
    const t = (Math.sin(i * 1.7) + 1) / 2;
    const noise = Math.cos(i * 2.3) * (range * 0.15);
    const price = Math.max(50, Math.round(q25 + t * range + noise));
    const status: 'available' | 'closed' =
      i === hotels.length - 1 && Math.abs(price - median) > range ? 'closed' : 'available';
    return { name, price, status };
  });
}

export const MarketDayFloatingPanel: React.FC<MarketDayFloatingPanelProps> = ({
  day, compsetHotels, anchor, onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Mode questionnaire de refus
  const [showRefusalForm, setShowRefusalForm] = useState(false);
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | null>(null);
  const [manualPrice, setManualPrice] = useState<string>('');
  const [strategy, setStrategy] = useState<'aggressive' | 'balanced' | 'defensive'>('balanced');
  const [duration, setDuration] = useState<'1d' | '3d' | '7d' | '30d'>('7d');
  const [comment, setComment] = useState('');
  const [lastFeedback, setLastFeedback] = useState<FeedbackEntry | null>(null);

  // ─── Position auto droite / gauche / clamp viewport ───────────────────────
  useLayoutEffect(() => {
    if (!day || !anchor) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

    // Droite par défaut si il y a la place
    let left = anchor.x + PANEL_GAP;
    if (left + PANEL_WIDTH > vw - 16) {
      // Sinon à gauche
      left = anchor.x - PANEL_WIDTH - PANEL_GAP;
    }
    // Clamp si toujours trop à gauche
    left = Math.max(16, Math.min(left, vw - PANEL_WIDTH - 16));

    // Y centré sur l'ancre + clamp
    let top = anchor.y - PANEL_MAX_HEIGHT / 2;
    top = Math.max(16, Math.min(top, vh - PANEL_MAX_HEIGHT - 16));

    setPosition({ left, top });
  }, [day, anchor]);

  // ─── Fermeture Escape / clic extérieur ────────────────────────────────────
  useEffect(() => {
    if (!day) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Petite tempo pour ne pas fermer immédiatement sur le clic d'ouverture
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 100);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      clearTimeout(t);
    };
  }, [day, onClose]);

  // ─── Données enrichies ────────────────────────────────────────────────────
  const enrichedCompset = useMemo(() => {
    if (!day) return [];
    const prices = buildCompsetPrices(compsetHotels, day.q25, day.q75, day.median);
    const all = [
      ...prices,
      { name: 'Folkestone Opéra (vous)', price: day.ourPrice, status: 'available' as const, isUs: true },
    ];
    all.sort((a, b) => b.price - a.price);
    return all;
  }, [day, compsetHotels]);

  const ourRank = useMemo(() => {
    const i = enrichedCompset.findIndex((h) => 'isUs' in h && h.isUs);
    return i >= 0 ? i + 1 : null;
  }, [enrichedCompset]);

  if (!day || !position) return null;

  const gap = day.ourPrice - day.median;
  const gapPct = (gap / day.median) * 100;
  const compression = day.q75 - day.q25; // largeur IQR
  const aggressiveness =
    compression > 80 ? 'Forte' : compression > 50 ? 'Modérée' : 'Faible';
  const recommendedPrice = (() => {
    if (day.demand >= 75 && day.ourPrice < day.median) return Math.round(day.median * 0.98);
    if (day.demand <= 25 && day.ourPrice > day.median) return Math.round(day.median * 1.02);
    return day.ourPrice;
  })();
  const recommendationDelta = recommendedPrice - day.ourPrice;
  const pressureLabel =
    day.demand >= 85 ? 'Extrême' : day.demand >= 65 ? 'Forte' : day.demand >= 40 ? 'Modérée' : 'Faible';
  const strategyAuto =
    day.demand >= 70 ? 'Yield agressif' : day.demand <= 30 ? 'Défensive' : 'Équilibrée';

  const ctx = {
    ourPrice: day.ourPrice,
    recommendedPrice,
    median: day.median,
    rank: ourRank ?? undefined,
    pressure: (pressureLabel === 'Extrême' ? 'extreme'
      : pressureLabel === 'Forte' ? 'high'
      : pressureLabel === 'Modérée' ? 'medium' : 'low') as 'extreme' | 'high' | 'medium' | 'low',
    strategy: strategyAuto,
  };

  const handleAccept = () => {
    const e = recommendationFeedback.log({ date: day.date, action: 'accept', context: ctx });
    setLastFeedback(e);
    setTimeout(onClose, 700);
  };
  const handleMaintain = () => {
    const e = recommendationFeedback.log({
      date: day.date, action: 'maintain', context: { ...ctx, recommendedPrice: day.ourPrice },
    });
    setLastFeedback(e);
    setTimeout(onClose, 700);
  };
  const handleRefuse = () => setShowRefusalForm(true);

  const submitRefusal = () => {
    if (!reasonCode) return;
    const label = REJECTION_REASONS.find((r) => r.code === reasonCode)?.label;
    const e = recommendationFeedback.log({
      date: day.date,
      action: 'reject',
      reasonCode,
      reasonLabel: label,
      comment: [
        comment.trim(),
        manualPrice ? `Tarif manuel : ${manualPrice}€` : '',
        `Stratégie : ${strategy}`,
        `Durée : ${duration}`,
      ].filter(Boolean).join(' · '),
      context: { ...ctx, recommendedPrice: manualPrice ? Number(manualPrice) : recommendedPrice },
    });
    setLastFeedback(e);
    setTimeout(onClose, 700);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={day.date}
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        style={{ left: position.left, top: position.top, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div>
            <div className="text-[14px] font-bold text-slate-900">{day.label}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Pression {pressureLabel} · Demande {day.demand}% · IQR {compression}€
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* SECTION 1 — Analyse concurrentielle */}
          {!showRefusalForm && (
            <>
              <Section title="Analyse concurrentielle" icon={<Shield size={11} />}>
                <div className="grid grid-cols-3 gap-2 mb-2 text-[11px]">
                  <Stat label="Rang" value={`#${ourRank ?? '—'}/${enrichedCompset.length}`} accent="#3B82F6" />
                  <Stat
                    label="Δ médiane"
                    value={`${gap > 0 ? '+' : ''}${gap}€`}
                    accent={gap >= 0 ? '#EF4444' : '#10B981'}
                  />
                  <Stat label="Compression" value={`${compression}€`} accent="#8B5CF6" />
                </div>
                <div className="text-[10px] text-slate-500 mb-2">
                  Agressivité marché : <b className="text-slate-700">{aggressiveness}</b> ·
                  écart vs médiane : <b className="text-slate-700">{gapPct.toFixed(1)}%</b>
                </div>

                <div className="rounded-lg border border-slate-100 overflow-hidden max-h-44 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1 font-semibold text-slate-500">#</th>
                        <th className="text-left px-2 py-1 font-semibold text-slate-500">Hôtel</th>
                        <th className="text-right px-2 py-1 font-semibold text-slate-500">Tarif</th>
                        <th className="text-center px-2 py-1 font-semibold text-slate-500">État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichedCompset.map((h, i) => {
                        const isUs = 'isUs' in h && h.isUs;
                        return (
                          <tr key={h.name} className={cn(
                            'border-t border-slate-50',
                            isUs && 'bg-blue-50/40',
                          )}>
                            <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                            <td className={cn('px-2 py-1 truncate max-w-[160px]', isUs ? 'font-bold text-blue-700' : 'text-slate-700')}>
                              {h.name}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold text-slate-900">
                              {h.price}€
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                h.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400',
                              )}>
                                {h.status === 'available' ? 'Ouvert' : 'Fermé'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* SECTION 2 — Recommandation + Actions */}
              <Section title="Recommandation RM" icon={<Sparkles size={11} />}>
                <div className="rounded-lg bg-violet-50/60 border border-violet-100 p-2.5 mb-2">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[18px] font-bold text-slate-900 tabular-nums">{recommendedPrice}€</span>
                    {recommendationDelta !== 0 && (
                      <span className={cn(
                        'text-[11px] font-bold flex items-center gap-0.5',
                        recommendationDelta > 0 ? 'text-emerald-600' : 'text-rose-600',
                      )}>
                        {recommendationDelta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {recommendationDelta > 0 ? '+' : ''}{recommendationDelta}€
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Stratégie suggérée : <b>{strategyAuto}</b> · vs actuel <b>{day.ourPrice}€</b>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <ActionButton
                    onClick={handleAccept}
                    icon={<Check size={14} />}
                    label="Accepter"
                    color="emerald"
                  />
                  <ActionButton
                    onClick={handleRefuse}
                    icon={<X size={14} />}
                    label="Refuser"
                    color="rose"
                  />
                  <ActionButton
                    onClick={handleMaintain}
                    icon={<Equal size={14} />}
                    label="Maintenir"
                    color="slate"
                  />
                </div>

                {lastFeedback && (
                  <div className={cn(
                    'mt-2 text-[10px] font-medium px-2 py-1.5 rounded-lg flex items-center gap-1.5',
                    lastFeedback.action === 'accept' ? 'bg-emerald-50 text-emerald-700'
                    : lastFeedback.action === 'reject' ? 'bg-rose-50 text-rose-700'
                    : 'bg-slate-100 text-slate-700',
                  )}>
                    <Check size={10} />
                    {lastFeedback.action === 'accept'
                      ? 'Recommandation acceptée'
                      : lastFeedback.action === 'reject'
                        ? `Refusée — ${lastFeedback.reasonLabel ?? '—'}`
                        : 'Tarif maintenu'}
                  </div>
                )}
              </Section>
            </>
          )}

          {/* SECTION 3 — Questionnaire refus */}
          {showRefusalForm && (
            <Section title="Questionnaire de refus" icon={<AlertTriangle size={11} />}>
              <div className="space-y-2.5">
                <Field label="Raison principale">
                  <div className="grid grid-cols-1 gap-1">
                    {REJECTION_REASONS.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setReasonCode(r.code)}
                        className={cn(
                          'text-left text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors',
                          reasonCode === r.code
                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tarif manuel (€)">
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder={`${day.ourPrice}`}
                      className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                    />
                  </Field>
                  <Field label="Stratégie appliquée">
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                      className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                    >
                      <option value="aggressive">Agressive</option>
                      <option value="balanced">Équilibrée</option>
                      <option value="defensive">Défensive</option>
                    </select>
                  </Field>
                </div>

                <Field label="Durée d'application">
                  <div className="grid grid-cols-4 gap-1">
                    {(['1d', '3d', '7d', '30d'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-1 rounded-md border transition-colors',
                          duration === d
                            ? 'bg-violet-500 text-white border-violet-500'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Commentaire RM (optionnel)">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Contexte, motivation…"
                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  />
                </Field>

                {manualPrice && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-[10px] text-amber-800">
                    <b>Impact estimé :</b> {Number(manualPrice) - day.ourPrice > 0 ? '+' : ''}
                    {Number(manualPrice) - day.ourPrice}€ vs actuel
                    {' · '}vs reco {Number(manualPrice) - recommendedPrice > 0 ? '+' : ''}
                    {Number(manualPrice) - recommendedPrice}€
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setShowRefusalForm(false)}
                    className="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 px-2 py-1 rounded-md"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={submitRefusal}
                    disabled={!reasonCode}
                    className={cn(
                      'text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm',
                      reasonCode
                        ? 'text-white bg-rose-500 hover:bg-rose-600'
                        : 'text-slate-400 bg-slate-100 cursor-not-allowed',
                    )}
                  >
                    Enregistrer le refus
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title, icon, children,
}) => (
  <section>
    <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {icon}
      {title}
    </h4>
    {children}
  </section>
);

const Stat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="rounded-lg bg-slate-50/70 border border-slate-100 px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-[13px] font-bold mt-0.5 tabular-nums" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const ActionButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: 'emerald' | 'rose' | 'slate';
}> = ({ onClick, icon, label, color }) => {
  const cls = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    rose: 'bg-rose-500 hover:bg-rose-600 text-white',
    slate: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl text-[10.5px] font-bold shadow-sm transition-colors',
        cls,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
      {label}
    </label>
    {children}
  </div>
);
