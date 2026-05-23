/**
 * FLOWTYM RMS — Modale de validation des événements détectés.
 *
 * Centre intelligent de validation événementielle :
 *   • le moteur de recherche ne pousse PLUS les événements directement
 *     dans le store ; il ouvre cette modale avec la liste détectée ;
 *   • l'utilisateur garde le contrôle : Accepter / Refuser / Voir détail ;
 *   • multi-sélection avec actions en masse ;
 *   • les refus alimentent un historique avec motif (apprentissage IA) ;
 *   • à l'acceptation, l'événement est intégré dans le store et
 *     propagé automatiquement à tous les modules consommateurs
 *     (Liste, Calendrier, Planning, RMS, Veille, Pricing, Alertes, …).
 *
 * Design : modale large, sticky header, sans scroll horizontal,
 * animations sobres, identité Flowtym premium.
 */
import React, { useMemo, useState } from 'react';
import {
  X, Check, Ban, Eye, Search as SearchIcon, ChevronRight, AlertCircle, Sparkles,
  Building2, CalendarDays, MapPin, Activity, ExternalLink,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import { aggregateImpact, daysBetween, formatDateRange } from '@/src/services/event-impact.engine';
import { ImpactBadge, impactColor } from './components/ImpactBadge';
import { CATEGORY_ICON } from './components/CategoryIcon';

export type ValidationDecision =
  | { type: 'accept'; ids: string[] }
  | { type: 'reject'; ids: string[]; reason: RefusalReason; comment?: string };

export type RefusalReason =
  | 'irrelevant'
  | 'duplicate'
  | 'impact_overestimated'
  | 'wrong_location'
  | 'cancelled'
  | 'false_positive'
  | 'other';

const REFUSAL_LABELS: Record<RefusalReason, string> = {
  irrelevant: 'Événement non pertinent',
  duplicate: 'Doublon',
  impact_overestimated: 'Impact surestimé',
  wrong_location: 'Mauvaise localisation',
  cancelled: 'Événement annulé',
  false_positive: 'Faux positif',
  other: 'Autre',
};

interface EventValidationModalProps {
  open: boolean;
  candidates: RMSMarketEvent[];
  onClose: () => void;
}

export const EventValidationModal: React.FC<EventValidationModalProps> = ({
  open, candidates, onClose,
}) => {
  const { bulkUpsert, addRefusedEvents } = useEventsStore();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((c) => c.id)));
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pendingRefusal, setPendingRefusal] = useState<{ ids: string[] } | null>(null);
  const [refusalReason, setRefusalReason] = useState<RefusalReason>('irrelevant');
  const [refusalComment, setRefusalComment] = useState('');

  React.useEffect(() => {
    if (open) {
      setSelected(new Set(candidates.map((c) => c.id)));
      setPendingRefusal(null);
      setPreviewId(null);
      setQuery('');
    }
  }, [open, candidates]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      `${c.name} ${c.city} ${c.zone ?? ''} ${c.venue ?? ''} ${c.primarySource}`
        .toLowerCase()
        .includes(q),
    );
  }, [candidates, query]);

  const allChecked = visible.length > 0 && visible.every((e) => selected.has(e.id));
  const preview = previewId ? candidates.find((c) => c.id === previewId) ?? null : null;

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        visible.forEach((e) => next.delete(e.id));
      } else {
        visible.forEach((e) => next.add(e.id));
      }
      return next;
    });
  }

  function acceptOne(id: string) {
    const ev = candidates.find((c) => c.id === id);
    if (!ev) return;
    bulkUpsert([ev]);
    // retire de la sélection ET de la liste affichée
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // si plus rien à valider, on ferme
    if (candidates.length === 1) onClose();
  }

  function acceptSelected() {
    const ids = [...selected];
    const toAccept = candidates.filter((c) => ids.includes(c.id));
    if (toAccept.length === 0) return;
    bulkUpsert(toAccept);
    onClose();
  }

  function openRefusal(ids: string[]) {
    if (ids.length === 0) return;
    setPendingRefusal({ ids });
    setRefusalReason('irrelevant');
    setRefusalComment('');
  }

  function confirmRefusal() {
    if (!pendingRefusal) return;
    const refused = candidates.filter((c) => pendingRefusal.ids.includes(c.id));
    addRefusedEvents(refused, { reason: refusalReason, comment: refusalComment });
    setSelected((prev) => {
      const next = new Set(prev);
      pendingRefusal.ids.forEach((id) => next.delete(id));
      return next;
    });
    setPendingRefusal(null);
    if (refused.length === candidates.length) onClose();
  }

  // ─── render ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[1100px] max-w-[95vw] max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Sticky header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold text-slate-900">Validation des événements détectés</h2>
              <p className="text-[12px] text-slate-500">
                {candidates.length} événement{candidates.length > 1 ? 's' : ''} détecté{candidates.length > 1 ? 's' : ''}.
                Sélectionnez ceux à intégrer dans votre RMS.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer la liste…"
                className="pl-8 pr-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12.5px] focus:ring-violet-500 outline-none w-56"
              />
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50/60 sticky top-0 z-[5]">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 accent-violet-600"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Événement</th>
                  <th className="px-3 py-2.5 font-medium">Catégorie</th>
                  <th className="px-3 py-2.5 font-medium">Dates</th>
                  <th className="px-3 py-2.5 font-medium">Ville / Lieu</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Impact</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pression</th>
                  <th className="px-3 py-2.5 font-medium text-right">ADR</th>
                  <th className="px-3 py-2.5 font-medium text-right">TO</th>
                  <th className="px-3 py-2.5 font-medium text-right">Confiance</th>
                  <th className="px-3 py-2.5 font-medium text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const Icon = CATEGORY_ICON[e.category];
                  const score = Math.round(aggregateImpact(e.impact));
                  const isSelected = selected.has(e.id);
                  return (
                    <tr
                      key={e.id}
                      className={cn(
                        'border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors',
                        isSelected && 'bg-violet-50/30',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(e.id)}
                          className="w-3.5 h-3.5 accent-violet-600"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">{e.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {daysBetween(e.startDate, e.endDate)} jour{daysBetween(e.startDate, e.endDate) > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium">
                          {CATEGORY_LABELS[e.category]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 tabular-nums">
                        {formatDateRange(e.startDate, e.endDate)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <div className="font-medium">{e.city}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{e.venue || e.zone}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 truncate max-w-[160px]">{e.primarySource}</td>
                      <td className="px-3 py-2.5"><ImpactBadge level={e.impact.level} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{score}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 font-medium">+{e.impact.adr}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 font-medium">+{e.impact.occupancy}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{e.impact.confidence}%</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewId(e.id)}
                            title="Voir le détail"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => acceptOne(e.id)}
                            title="Accepter"
                            className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openRefusal([e.id])}
                            title="Refuser"
                            className="p-1.5 rounded-md hover:bg-rose-50 text-rose-700"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Sticky footer — actions multi */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between sticky bottom-0">
          <div className="text-[12px] text-slate-500">
            <strong className="text-slate-900">{selected.size}</strong> sélectionné{selected.size > 1 ? 's' : ''} ·
            <span className="ml-1">{candidates.length} détectés au total</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Plus tard
            </button>
            <button
              onClick={() => openRefusal([...selected])}
              disabled={selected.size === 0}
              className="px-3 py-2 rounded-lg ring-1 ring-rose-200 bg-white text-rose-700 text-[13px] font-medium hover:bg-rose-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              Refuser la sélection
            </button>
            <button
              onClick={acceptSelected}
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
            >
              <Check className="w-3.5 h-3.5" />
              Accepter la sélection
            </button>
          </div>
        </div>
      </div>

      {/* Panneau de détail (overlay sur la modale) */}
      {preview && <DetailDrawer event={preview} onClose={() => setPreviewId(null)} />}

      {/* Sous-modale motif de refus */}
      {pendingRefusal && (
        <RefusalModal
          count={pendingRefusal.ids.length}
          reason={refusalReason}
          comment={refusalComment}
          onChangeReason={setRefusalReason}
          onChangeComment={setRefusalComment}
          onCancel={() => setPendingRefusal(null)}
          onConfirm={confirmRefusal}
        />
      )}
    </div>
  );
};

// ─── Drawer détail ─────────────────────────────────────────────────────────

function DetailDrawer({ event, onClose }: { event: RMSMarketEvent; onClose: () => void }) {
  const c = impactColor(event.impact.level);
  const Icon = CATEGORY_ICON[event.category];
  const score = Math.round(aggregateImpact(event.impact));
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 z-[55]" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-[440px] bg-white shadow-2xl z-[60] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1', c.soft, c.ring, c.text)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                {CATEGORY_LABELS[event.category]}
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900 truncate">{event.name}</h3>
              <div className="mt-1.5"><ImpactBadge level={event.impact.level} size="md" /></div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <Block icon={CalendarDays} title="Dates et durée">
            <div className="text-[13px] text-slate-700">{formatDateRange(event.startDate, event.endDate)}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">{daysBetween(event.startDate, event.endDate)} jours</div>
          </Block>

          <Block icon={MapPin} title="Localisation">
            <div className="text-[13px] text-slate-700">{event.city}</div>
            <div className="text-[11.5px] text-slate-500">{event.venue || event.zone}</div>
          </Block>

          <Block icon={Building2} title="Source">
            <div className="text-[13px] text-slate-700">{event.primarySource}</div>
            {event.sources.length > 1 && (
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                Référencée par {event.sources.length} sources distinctes.
              </div>
            )}
            <a
              href="#"
              className="inline-flex items-center gap-1 mt-2 text-[12px] text-violet-600 hover:underline"
            >
              Ouvrir la source <ExternalLink className="w-3 h-3" />
            </a>
          </Block>

          <Block icon={Activity} title="Impact RMS simulé">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Stat label="Score IA" value={`${score}/100`} />
              <Stat label="Confiance" value={`${event.impact.confidence}%`} />
              <Stat label="Pression marché" value={`${Math.round(event.impact.compression)}%`} />
              <Stat label="Influence prix" value={`+${event.influencePrice}%`} accent />
              <Stat label="ADR estimé" value={`+${event.impact.adr}%`} />
              <Stat label="TO estimé" value={`+${event.impact.occupancy}%`} />
              <Stat label="Pickup" value={`+${event.impact.pickup}%`} />
              <Stat label="RevPAR" value={`+${event.impact.revpar}%`} />
            </div>
          </Block>

          {event.description && (
            <Block icon={Sparkles} title="Description">
              <p className="text-[12.5px] text-slate-700">{event.description}</p>
            </Block>
          )}
        </div>
      </aside>
    </>
  );
}

function Block({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">
        <Icon className="w-3 h-3" /> {title}
      </h4>
      {children}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg ring-1 ring-slate-100 bg-white px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className={cn('text-[13px] font-semibold mt-0.5', accent ? 'text-violet-700' : 'text-slate-900')}>{value}</div>
    </div>
  );
}

// ─── Sous-modale motif de refus ───────────────────────────────────────────

function RefusalModal({
  count, reason, comment, onChangeReason, onChangeComment, onCancel, onConfirm,
}: {
  count: number;
  reason: RefusalReason;
  comment: string;
  onChangeReason: (r: RefusalReason) => void;
  onChangeComment: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <h3 className="text-[15px] font-semibold text-slate-900">
            Refuser {count > 1 ? `${count} événements` : 'cet événement'}
          </h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1.5">Motif</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(REFUSAL_LABELS) as RefusalReason[]).map((r) => (
                <button
                  key={r}
                  onClick={() => onChangeReason(r)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-[12px] font-medium ring-1 text-left',
                    reason === r
                      ? 'bg-rose-50 text-rose-700 ring-rose-200'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {REFUSAL_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1.5">Commentaire (optionnel)</div>
            <textarea
              value={comment}
              onChange={(e) => onChangeComment(e.target.value)}
              rows={3}
              placeholder="Précisez la raison pour aider le moteur IA à apprendre…"
              className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 focus:ring-rose-300 outline-none resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-[13px] font-medium hover:bg-rose-700 flex items-center gap-1.5"
          >
            <Ban className="w-3.5 h-3.5" />
            Confirmer le refus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-20 text-center text-slate-500">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>
      <div className="text-[13px] font-medium text-slate-700">Aucun événement à valider</div>
      <div className="text-[12px] mt-1">Tous les événements détectés ont été traités.</div>
    </div>
  );
}
