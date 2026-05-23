/**
 * FLOWTYM — Modale décision RM sur une date du marché
 *
 * Au clic sur une date du graphique Veille Concurrentielle, ouvre une
 * modale centrée (overlay semi-transparent) avec :
 *
 *   - Tous les hôtels du compset + tarifs + statut Ouvert/Fermé
 *   - Positionnement de notre hôtel (rang)
 *   - Tarif médian / min / max + écart vs marché
 *   - Tarif recommandé par le RMS + explication métier
 *   - 3 actions : Accepter / Refuser / Maintenir
 *
 * Si Refuser :
 *   - champ tarif manuel
 *   - formulaire de justification : 7 motifs (dont commentaire libre)
 *   - enregistrement dans recommendationFeedback (apprentissage IA)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Check, Equal, AlertTriangle, Sparkles, Shield, ArrowUp, ArrowDown,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  recommendationFeedback,
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

export interface MarketDayDecisionModalProps {
  day: MarketDay | null;
  compsetHotels: string[];
  onClose: () => void;
}

/** 7 motifs prédéfinis pour le refus (cohérent avec la demande métier). */
type ExtendedReasonCode =
  | 'tarif_trop_agressif'
  | 'tarif_trop_bas'
  | 'tarif_trop_eleve'
  | 'evenement_non_pris'
  | 'strategie_commerciale'
  | 'contrainte_operationnelle'
  | 'autre';

const REJECTION_REASONS_VEILLE: { code: ExtendedReasonCode; label: string; mapTo: RejectionReasonCode }[] = [
  { code: 'tarif_trop_agressif',     label: 'Tarif recommandé trop agressif',     mapTo: 'tarif_trop_eleve' },
  { code: 'tarif_trop_bas',          label: 'Tarif recommandé trop bas',          mapTo: 'tarif_trop_bas' },
  { code: 'tarif_trop_eleve',        label: 'Tarif recommandé trop élevé',        mapTo: 'tarif_trop_eleve' },
  { code: 'evenement_non_pris',      label: 'Événement local non pris en compte', mapTo: 'evenement_non_pertinent' },
  { code: 'strategie_commerciale',   label: 'Stratégie commerciale différente',   mapTo: 'decision_commerciale_autre' },
  { code: 'contrainte_operationnelle', label: 'Contrainte opérationnelle',        mapTo: 'decision_commerciale_autre' },
  { code: 'autre',                   label: 'Autre raison (commentaire libre)',   mapTo: 'decision_commerciale_autre' },
];

/** Génère les prix des concurrents (déterministe, basé sur q25/q75/median). */
function buildCompsetPrices(
  hotels: string[],
  q25: number,
  q75: number,
  median: number,
): Array<{ name: string; price: number; status: 'available' | 'closed' }> {
  if (hotels.length === 0) return [];
  const range = Math.max(1, q75 - q25);
  return hotels.map((name, i) => {
    const t = (Math.sin(i * 1.7) + 1) / 2;
    const noise = Math.cos(i * 2.3) * (range * 0.15);
    const price = Math.max(50, Math.round(q25 + t * range + noise));
    const status: 'available' | 'closed' =
      i === hotels.length - 1 && Math.abs(price - median) > range ? 'closed' : 'available';
    return { name, price, status };
  });
}

export const MarketDayDecisionModal: React.FC<MarketDayDecisionModalProps> = ({
  day, compsetHotels, onClose,
}) => {
  // Mode formulaire : 'reject' (Refuser) ou 'maintain' (Maintenir).
  // Les deux modes partagent le même formulaire (tarif manuel + 7 motifs +
  // commentaire + impact estimé) afin que la décision « Maintenir » soit
  // tout autant explicable et exploitable pour l'apprentissage IA.
  const [formMode, setFormMode] = useState<'reject' | 'maintain' | null>(null);
  const [reasonCode, setReasonCode] = useState<ExtendedReasonCode | null>(null);
  const [manualPrice, setManualPrice] = useState<string>('');
  const [comment, setComment] = useState('');
  const [lastFeedback, setLastFeedback] = useState<FeedbackEntry | null>(null);

  // Reset state quand le jour change
  useEffect(() => {
    if (!day) return;
    setFormMode(null);
    setReasonCode(null);
    setManualPrice('');
    setComment('');
    setLastFeedback(null);
  }, [day?.date]);

  // Fermeture par Escape
  useEffect(() => {
    if (!day) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [day, onClose]);

  const compset = useMemo(() => {
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
    const i = compset.findIndex((h) => 'isUs' in h && h.isUs);
    return i >= 0 ? i + 1 : null;
  }, [compset]);

  if (!day) return null;

  const gap = day.ourPrice - day.median;
  const gapPct = (gap / day.median) * 100;
  const min = day.q25;
  const max = day.q75;

  // Tarif recommandé : logique simple basée sur demande + écart médiane
  const recommendedPrice = (() => {
    if (day.demand >= 75 && day.ourPrice < day.median) return Math.round(day.median * 0.98);
    if (day.demand <= 25 && day.ourPrice > day.median) return Math.round(day.median * 1.02);
    if (day.demand >= 60 && day.ourPrice < day.median * 0.95) return Math.round(day.median * 0.96);
    return day.ourPrice;
  })();
  const recommendationDelta = recommendedPrice - day.ourPrice;
  const recommendationDirection: 'up' | 'down' | 'hold' =
    recommendationDelta > 0 ? 'up' : recommendationDelta < 0 ? 'down' : 'hold';

  const pressureLabel =
    day.demand >= 85 ? 'Extrême' : day.demand >= 65 ? 'Forte'
    : day.demand >= 40 ? 'Modérée' : 'Faible';
  const strategy =
    day.demand >= 70 ? 'Yield agressif' : day.demand <= 30 ? 'Défensive' : 'Équilibrée';

  // Explication métier
  const explanation = (() => {
    if (recommendationDirection === 'up') {
      return `La demande marché est ${pressureLabel.toLowerCase()} (${day.demand}%) et notre tarif est sous la médiane (-${Math.abs(gap)}€). Une hausse à ${recommendedPrice}€ vous repositionne au cœur du marché sans casser votre rang #${ourRank}/${compset.length}.`;
    }
    if (recommendationDirection === 'down') {
      return `La demande marché est ${pressureLabel.toLowerCase()} (${day.demand}%) et notre tarif est au-dessus de la médiane (+${gap}€). Une baisse à ${recommendedPrice}€ améliore la conversion sans dégrader l'ADR sur cette journée.`;
    }
    return `Notre tarif est aligné avec le marché. Pression ${pressureLabel.toLowerCase()} (${day.demand}%). Maintien recommandé.`;
  })();

  const ctx = {
    ourPrice: day.ourPrice,
    recommendedPrice,
    median: day.median,
    rank: ourRank ?? undefined,
    pressure: (pressureLabel === 'Extrême' ? 'extreme'
      : pressureLabel === 'Forte' ? 'high'
      : pressureLabel === 'Modérée' ? 'medium' : 'low') as 'extreme' | 'high' | 'medium' | 'low',
    strategy,
  };

  const handleAccept = () => {
    const e = recommendationFeedback.log({ date: day.date, action: 'accept', context: ctx });
    setLastFeedback(e);
    setTimeout(onClose, 700);
  };
  const handleRefuse = () => {
    setFormMode('reject');
    setManualPrice(String(day.ourPrice));
  };
  const handleMaintain = () => {
    setFormMode('maintain');
    // En mode maintien, on pré-remplit avec le tarif actuel — c'est ce que
    // le RM veut garder. Il peut l'ajuster légèrement si besoin.
    setManualPrice(String(day.ourPrice));
  };

  const submitForm = () => {
    if (!formMode || !reasonCode) return;
    const reasonMeta = REJECTION_REASONS_VEILLE.find((r) => r.code === reasonCode);
    const e = recommendationFeedback.log({
      date: day.date,
      action: formMode,
      reasonCode: reasonMeta?.mapTo,
      reasonLabel: reasonMeta?.label,
      comment: [
        comment.trim(),
        manualPrice ? `Tarif ${formMode === 'maintain' ? 'maintenu' : 'manuel'} : ${manualPrice}€` : '',
      ].filter(Boolean).join(' · '),
      context: {
        ...ctx,
        recommendedPrice: manualPrice
          ? Number(manualPrice)
          : (formMode === 'maintain' ? day.ourPrice : recommendedPrice),
      },
    });
    setLastFeedback(e);
    setTimeout(onClose, 800);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={day.date}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 8, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 8, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-slate-900 leading-tight">
                  Décision RM — {day.label}
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Pression {pressureLabel} · Demande {day.demand}% · Stratégie {strategy}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {!formMode ? (
              <>
                {/* KPIs marché */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Kpi label="Médiane" value={`${day.median}€`} accent="text-emerald-600" />
                  <Kpi label="Min" value={`${min}€`} accent="text-slate-700" />
                  <Kpi label="Max" value={`${max}€`} accent="text-slate-700" />
                  <Kpi
                    label="Écart vs marché"
                    value={`${gap > 0 ? '+' : ''}${gap}€`}
                    accent={gap >= 0 ? 'text-rose-600' : 'text-emerald-600'}
                    sub={`${gap > 0 ? '+' : ''}${gapPct.toFixed(1)}%`}
                  />
                </div>

                {/* Compset complet */}
                <section>
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Shield size={12} className="text-violet-500" />
                      Compset analysé ({compset.length} hôtels)
                    </h4>
                    {ourRank && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                        Votre rang : #{ourRank} / {compset.length}
                      </span>
                    )}
                  </header>
                  <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-500 w-10">#</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-500">Hôtel</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-500">Tarif</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-500">Δ médiane</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-500">État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compset.map((h, i) => {
                          const isUs = 'isUs' in h && h.isUs;
                          const dlt = h.price - day.median;
                          return (
                            <tr
                              key={h.name}
                              className={cn(
                                'border-t border-slate-100',
                                isUs && 'bg-blue-50/50',
                              )}
                            >
                              <td className="px-3 py-2 text-slate-500 tabular-nums">{i + 1}</td>
                              <td className={cn(
                                'px-3 py-2 truncate max-w-[280px]',
                                isUs ? 'font-bold text-blue-700' : 'text-slate-700',
                              )}>
                                {h.name}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                                {h.price}€
                              </td>
                              <td className={cn(
                                'px-3 py-2 text-right tabular-nums',
                                dlt > 0 ? 'text-rose-600' : dlt < 0 ? 'text-emerald-600' : 'text-slate-500',
                              )}>
                                {dlt > 0 ? '+' : ''}{dlt}€
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                  h.status === 'available'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-400',
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
                </section>

                {/* Recommandation + explication */}
                <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-1">
                        Tarif recommandé
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[28px] font-extrabold text-slate-900 tabular-nums leading-none">
                          {recommendedPrice}€
                        </span>
                        {recommendationDelta !== 0 && (
                          <span className={cn(
                            'text-[13px] font-bold flex items-center gap-0.5',
                            recommendationDelta > 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {recommendationDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            {recommendationDelta > 0 ? '+' : ''}{recommendationDelta}€
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        vs tarif actuel <b>{day.ourPrice}€</b>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-violet-100 p-3 text-[12.5px] text-slate-700 leading-relaxed">
                    {explanation}
                  </div>
                </section>

                {/* 3 actions principales */}
                <section>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Votre décision
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Action
                      onClick={handleAccept}
                      icon={<Check size={18} />}
                      label="Accepter"
                      hint={`Appliquer ${recommendedPrice}€`}
                      color="emerald"
                    />
                    <Action
                      onClick={handleRefuse}
                      icon={<X size={18} />}
                      label="Refuser"
                      hint="Saisie manuelle"
                      color="rose"
                    />
                    <Action
                      onClick={handleMaintain}
                      icon={<Equal size={18} />}
                      label="Maintenir"
                      hint={`Garder ${day.ourPrice}€`}
                      color="slate"
                    />
                  </div>

                  {lastFeedback && (
                    <div className={cn(
                      'mt-3 text-[12px] font-medium px-3 py-2 rounded-xl flex items-center gap-2',
                      lastFeedback.action === 'accept' ? 'bg-emerald-50 text-emerald-700'
                      : lastFeedback.action === 'reject' ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-100 text-slate-700',
                    )}>
                      <Check size={12} />
                      Décision enregistrée — {lastFeedback.action === 'accept' ? 'Acceptée'
                        : lastFeedback.action === 'reject' ? `Refusée (${lastFeedback.reasonLabel ?? '—'})`
                        : 'Maintenue'}
                    </div>
                  )}
                </section>
              </>
            ) : (
              /* MODE REFUS ou MAINTIEN — même formulaire de justification */
              <section>
                <header className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl shrink-0',
                    formMode === 'reject' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700',
                  )}>
                    {formMode === 'reject' ? <AlertTriangle size={14} /> : <Equal size={14} />}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-slate-900">
                      {formMode === 'reject'
                        ? 'Pourquoi refusez-vous cette recommandation ?'
                        : 'Pourquoi maintenez-vous le tarif actuel ?'}
                    </h4>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      Votre retour alimente l'apprentissage du moteur RMS et améliore les futures recommandations.
                    </p>
                  </div>
                </header>

                <Field label={
                  formMode === 'reject'
                    ? 'Tarif souhaité (saisie manuelle)'
                    : 'Tarif maintenu (modifiable)'
                }>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      className="flex-1 px-3 py-2 text-[14px] font-semibold tabular-nums border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                    <span className="text-[12px] text-slate-500">€</span>
                    <span className="text-[11px] text-slate-400 ml-2">
                      Reco {recommendedPrice}€ · Actuel {day.ourPrice}€
                    </span>
                  </div>
                </Field>

                <Field
                  label={formMode === 'reject' ? 'Raison principale du refus' : 'Raison du maintien'}
                  className="mt-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {REJECTION_REASONS_VEILLE.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setReasonCode(r.code)}
                        className={cn(
                          'text-left text-[12px] font-medium px-3 py-2 rounded-xl border transition-colors',
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

                <Field label="Commentaire libre (optionnel)" className="mt-3">
                  <div className="relative">
                    <MessageSquare size={12} className="absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder={
                        formMode === 'reject'
                          ? 'Précisez votre contexte (événement, contrainte, stratégie…)'
                          : 'Pourquoi conservez-vous ce tarif ? (politique, fidélité, contrat…)'
                      }
                      className="w-full pl-9 pr-3 py-2 text-[12.5px] border border-slate-200 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                </Field>

                {/* Impact estimé */}
                {manualPrice && Number(manualPrice) > 0 && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-[11.5px] text-amber-800">
                    <b>Impact estimé :</b>{' '}
                    {Number(manualPrice) - day.ourPrice > 0 ? '+' : ''}
                    {Number(manualPrice) - day.ourPrice}€ vs actuel ·{' '}
                    {Number(manualPrice) - recommendedPrice > 0 ? '+' : ''}
                    {Number(manualPrice) - recommendedPrice}€ vs reco
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Footer actions (mode formulaire — refus ou maintien) */}
          {formMode && (
            <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setFormMode(null)}
                className="px-4 py-2 text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                ← Retour
              </button>
              <button
                onClick={submitForm}
                disabled={!reasonCode}
                className={cn(
                  'px-5 py-2 text-[13px] font-bold rounded-xl shadow-sm transition-colors',
                  !reasonCode
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                    : formMode === 'reject'
                      ? 'text-white bg-rose-500 hover:bg-rose-600'
                      : 'text-white bg-slate-600 hover:bg-slate-700',
                )}
              >
                {formMode === 'reject' ? 'Enregistrer le refus' : 'Enregistrer le maintien'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const Kpi: React.FC<{ label: string; value: string; accent?: string; sub?: string }> = ({
  label, value, accent, sub,
}) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={cn('text-[18px] font-extrabold tabular-nums mt-0.5', accent ?? 'text-slate-900')}>
      {value}
    </div>
    {sub && <div className="text-[10.5px] font-semibold text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

const Action: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  color: 'emerald' | 'rose' | 'slate';
}> = ({ onClick, icon, label, hint, color }) => {
  const cls = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20',
    rose: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20',
    slate: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-2xl font-bold shadow-sm transition-all hover:scale-[1.02]',
        cls,
      )}
    >
      {icon}
      <span className="text-[14px]">{label}</span>
      <span className={cn('text-[10.5px] opacity-80', color === 'slate' ? 'text-slate-500' : '')}>
        {hint}
      </span>
    </button>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className,
}) => (
  <div className={className}>
    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {label}
    </label>
    {children}
  </div>
);
