/**
 * FLOWTYM — Flux live des événements RMS Enterprise
 *
 * Affiche les dernières actions du moteur (règles déclenchées, garde-fous
 * bloquants, conflits résolus, poussées autopilote). Source : rmsAuditLogger
 * + bus RMS (en cas d'événements non journalisés).
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Cpu, Shield, Zap, Plane, RotateCcw, AlertCircle, Activity } from 'lucide-react';
import { rmsAuditLogger, type AuditEvent, type AuditEventType } from '@/src/services/revenue/rmsAuditLogger';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';
import { cn } from '@/src/lib/utils';

const ICON_BY_TYPE: Record<AuditEventType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  rule_triggered:    { icon: Zap,       color: 'text-violet-500' },
  rule_adjusted:     { icon: Activity,  color: 'text-amber-500' },
  rule_blocked:      { icon: AlertCircle, color: 'text-rose-500' },
  guardrail_block:   { icon: Shield,    color: 'text-rose-500' },
  guardrail_warn:    { icon: Shield,    color: 'text-amber-500' },
  guardrail_adjust:  { icon: Shield,    color: 'text-emerald-500' },
  conflict_detected: { icon: AlertCircle, color: 'text-rose-500' },
  conflict_resolved: { icon: AlertCircle, color: 'text-emerald-500' },
  priority_changed:  { icon: Cpu,       color: 'text-blue-500' },
  autopilot_push:    { icon: Plane,     color: 'text-violet-500' },
  rollback:          { icon: RotateCcw, color: 'text-rose-500' },
};

const TYPE_LABEL: Record<AuditEventType, string> = {
  rule_triggered:    'Règle déclenchée',
  rule_adjusted:     'Règle ajustée',
  rule_blocked:      'Règle bloquée',
  guardrail_block:   'Garde-fou bloquant',
  guardrail_warn:    'Garde-fou (alerte)',
  guardrail_adjust:  'Garde-fou (ajustement)',
  conflict_detected: 'Conflit détecté',
  conflict_resolved: 'Conflit résolu',
  priority_changed:  'Priorité modifiée',
  autopilot_push:    'Autopilote → push',
  rollback:          'Rollback',
};

export interface RmsEnterpriseFeedProps {
  /** Nombre d'événements à afficher (10 par défaut) */
  limit?: number;
  className?: string;
}

export const RmsEnterpriseFeed: React.FC<RmsEnterpriseFeedProps> = ({ limit = 10, className }) => {
  // Snapshot stable : version() (entier) au lieu d'une array — évite la boucle.
  useSyncExternalStore(
    (cb) => rmsAuditLogger.subscribe(cb),
    () => rmsAuditLogger.version(),
    () => rmsAuditLogger.version(),
  );
  const events = rmsAuditLogger.all();

  // Force re-render pour la "fraîcheur" des timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Compteur d'événements live par type (pour le header)
  const counters: Partial<Record<AuditEventType, number>> = {};
  events.forEach((e) => { counters[e.type] = (counters[e.type] ?? 0) + 1; });

  const visible = events.slice(0, limit);

  return (
    <section className={cn(
      'bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5',
      className,
    )}>
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#8B5CF6] text-white">
            <Cpu size={16} />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-gray-900">Moteur RMS Enterprise — flux live</h4>
            <p className="text-[11px] text-gray-500">
              Décisions automatiques, blocages garde-fous, conflits résolus
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {Object.entries(counters).map(([type, count]) => {
            const meta = ICON_BY_TYPE[type as AuditEventType];
            if (!meta || !count) return null;
            const Icon = meta.icon;
            return (
              <span
                key={type}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F3F4F6] text-gray-700 flex items-center gap-1"
                title={TYPE_LABEL[type as AuditEventType]}
              >
                <Icon size={10} className={meta.color} />
                {count}
              </span>
            );
          })}
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="text-[12px] text-gray-400 text-center py-6">
          Aucun événement RMS pour le moment. Le moteur observe les imports, les promotions, les stratégies et l'autopilote.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => {
            const meta = ICON_BY_TYPE[e.type];
            const Icon = meta?.icon ?? Activity;
            return (
              <li key={e.id} className="flex items-start gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
                <Icon size={14} className={cn('mt-0.5 shrink-0', meta?.color ?? 'text-gray-400')} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-gray-900">
                    {TYPE_LABEL[e.type] ?? e.type}
                    {' · '}
                    <span className="text-gray-600">{e.actor}</span>
                  </div>
                  <div className="text-[11.5px] text-gray-500 mt-0.5">{e.detail}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{e.context}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gray-400">
                    {new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {typeof e.impact === 'number' && (
                    <div className={cn(
                      'text-[11px] font-semibold mt-0.5',
                      e.impact > 0 ? 'text-emerald-600' : e.impact < 0 ? 'text-rose-600' : 'text-gray-500',
                    )}>
                      {e.impact > 0 ? '+' : ''}{Math.round(e.impact)}€
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/**
 * Hook qui maintient un compteur des événements RMS Enterprise — utile pour
 * un badge "X nouvelles décisions" sur les pages connexes.
 */
export function useRmsEnterpriseEventCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsubs = [
      subscribeRmsEvent('tactical-rule:triggered', () => setCount((n) => n + 1)),
      subscribeRmsEvent('guardrail:blocked', () => setCount((n) => n + 1)),
      subscribeRmsEvent('conflict:resolved', () => setCount((n) => n + 1)),
      subscribeRmsEvent('autopilot:pushed', () => setCount((n) => n + 1)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);
  return count;
}
