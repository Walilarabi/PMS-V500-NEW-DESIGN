/**
 * FLOWTYM RMS — Panneau latéral détail événement (premium).
 *
 * Drawer à droite contenant :
 *   • en-tête (icône, nom, badge, dates, source)
 *   • coefficients d'impact (demande / ADR / TO / pickup / RevPAR / compression)
 *   • influence RMS (recommandations, alertes, stratégies, hôtels)
 *   • historique (sync, modifications, import)
 *   • actions (modifier, dupliquer, archiver)
 */
import React from 'react';
import { X, Sparkles, Activity, TrendingUp, ShieldAlert, Building2, History, Copy, Archive, Edit3 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { RMSMarketEvent } from '@/src/types/events';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import { useEventsStore } from '@/src/store/eventsStore';
import { ImpactBadge, impactColor } from './components/ImpactBadge';
import { CATEGORY_ICON } from './components/CategoryIcon';
import { aggregateImpact, daysBetween, formatDateRange } from '@/src/services/event-impact.engine';

interface EventDetailPanelProps {
  event: RMSMarketEvent | null;
  onClose: () => void;
  onEdit?: (ev: RMSMarketEvent) => void;
}

export const EventDetailPanel: React.FC<EventDetailPanelProps> = ({ event, onClose, onEdit }) => {
  const { duplicateEvent, setStatus } = useEventsStore();
  if (!event) return null;
  const c = impactColor(event.impact.level);
  const Icon = CATEGORY_ICON[event.category];
  const score = Math.round(aggregateImpact(event.impact));

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-[460px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center ring-1', c.soft, c.ring, c.text)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                  {CATEGORY_LABELS[event.category]} · {event.primarySource}
                </div>
                <h2 className="text-[18px] font-semibold text-slate-900 truncate mt-0.5">{event.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <ImpactBadge level={event.impact.level} size="md" />
                  <span className="text-[11px] text-slate-500">Score IA {score}/100 · confiance {event.impact.confidence}%</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <Field label="Dates" value={formatDateRange(event.startDate, event.endDate)} />
            <Field label="Durée" value={`${daysBetween(event.startDate, event.endDate)} jours`} />
            <Field label="Ville" value={event.city} />
            <Field label="Zone" value={event.zone ?? '—'} />
            {event.venue && <Field label="Lieu" value={event.venue} />}
            <Field label="Statut" value={event.status} />
          </div>
        </div>

        {/* Content scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Coefficients */}
          <Section icon={Activity} title="Coefficients d'impact RMS">
            <div className="grid grid-cols-2 gap-2.5">
              <Coef label="Demande" v={event.impact.demand} />
              <Coef label="ADR" v={event.impact.adr} />
              <Coef label="Occupation" v={event.impact.occupancy} />
              <Coef label="Pickup" v={event.impact.pickup} />
              <Coef label="RevPAR" v={event.impact.revpar} />
              <Coef label="Compression" v={event.impact.compression} max={100} />
            </div>
          </Section>

          {/* Influence RMS */}
          <Section icon={TrendingUp} title="Influence sur le moteur RMS">
            <ul className="space-y-2 text-[12.5px] text-slate-700">
              <li className="flex items-center justify-between">
                <span>Pression marché</span>
                <strong className={c.text}>{IMPACT_LABELS[event.impact.level]}</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Recommandation tarif</span>
                <strong className="text-violet-700">+{event.influencePrice}%</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Agressivité pricing</span>
                <strong className="text-slate-900">{score >= 70 ? 'Maximale' : score >= 40 ? 'Élevée' : 'Normale'}</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Promotions actives</span>
                <strong className={score >= 70 ? 'text-rose-600' : 'text-slate-700'}>
                  {score >= 70 ? 'Suspendues' : 'Maintenues'}
                </strong>
              </li>
            </ul>
          </Section>

          {/* Liaisons */}
          <Section icon={ShieldAlert} title="Liaisons stratégiques">
            <div className="space-y-2 text-[12.5px]">
              <LinkRow label="Alertes liées" value={event.linkedAlerts?.length ?? 0} />
              <LinkRow label="Recommandations" value={event.linkedRecommendations?.length ?? 0} />
              <LinkRow label="Stratégies tactiques" value={event.linkedStrategies?.length ?? 0} />
            </div>
          </Section>

          {/* Hotels */}
          <Section icon={Building2} title="Hôtels impactés">
            {event.attachedHotels && event.attachedHotels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {event.attachedHotels.map((h) => (
                  <span key={h} className="px-2 py-0.5 text-[11.5px] font-medium bg-slate-100 text-slate-700 rounded-md">
                    {h}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] text-slate-500">Tous les hôtels concernés par défaut (Paris).</div>
            )}
          </Section>

          {/* History */}
          <Section icon={History} title="Historique">
            {event.history.length === 0 ? (
              <div className="text-[12.5px] text-slate-500">Aucune entrée d'historique.</div>
            ) : (
              <ol className="relative border-l border-slate-200 ml-1.5 space-y-3">
                {event.history.slice(-6).reverse().map((h, i) => (
                  <li key={i} className="ml-3 text-[12px] text-slate-600">
                    <span className="absolute -left-[5px] mt-1 w-2 h-2 rounded-full bg-violet-500" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 capitalize">{h.action.replace('_', ' ')}</span>
                      {h.source && <span className="text-slate-400">— {h.source}</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(h.at).toLocaleString('fr-FR')}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-6 py-3 flex items-center gap-2">
          <button
            onClick={() => onEdit?.(event)}
            className="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-violet-700"
          >
            <Edit3 className="w-3.5 h-3.5" /> Modifier
          </button>
          <button
            onClick={() => duplicateEvent(event.id)}
            className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Dupliquer
          </button>
          <button
            onClick={() => { setStatus(event.id, 'archived'); onClose(); }}
            className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" /> Archiver
          </button>
        </div>
      </aside>
    </>
  );
};

// ─── Bricks ────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[12px] uppercase tracking-wide font-semibold text-slate-500 mb-2">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className="text-[13px] font-medium text-slate-900 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Coef({ label, v, max = 50 }: { label: string; v: number; max?: number }) {
  const pct = Math.min(100, (v / max) * 100);
  return (
    <div className="bg-white ring-1 ring-slate-100 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-slate-500">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums text-slate-900">+{v}%</span>
      </div>
      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LinkRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
      <span className="text-slate-600">{label}</span>
      <span className={cn(
        'inline-flex items-center justify-center min-w-[24px] h-5 rounded-full text-[11px] font-semibold px-1.5',
        value > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500',
      )}>
        {value}
      </span>
    </div>
  );
}
