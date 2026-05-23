/**
 * FLOWTYM — Widget « Moteur tactique »
 *
 * Affiche en live l'évaluation du pipeline RMS Enterprise :
 *   Stratégie → Règles tactiques → Conflits → Garde-fous → Recommandation
 *
 * Réutilisable dans AutopilotPage, SimulationPage et la page Règles tactiques.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Cpu, Zap, Shield, ArrowRight, Play, RotateCcw, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { rmsRuleEvaluator } from '@/src/services/revenue/rmsRuleEvaluator';
import { rmsAuditLogger, type AuditEvent } from '@/src/services/revenue/rmsAuditLogger';
import type { MarketContext } from '@/src/types/revenue/tacticalRules.types';
import { cn } from '@/src/lib/utils';

export interface TacticalEngineWidgetProps {
  /** Si true, exécute automatiquement à chaque changement de contexte */
  autoEvaluate?: boolean;
  /** Permet à un parent de fournir un contexte fixe */
  contextOverride?: Partial<MarketContext>;
  /** Permet à un parent de récupérer l'output */
  onResult?: (result: ReturnType<typeof rmsRuleEvaluator.evaluate>) => void;
  className?: string;
}

export const TacticalEngineWidget: React.FC<TacticalEngineWidgetProps> = ({
  autoEvaluate = false,
  contextOverride,
  onResult,
  className,
}) => {
  // Snapshot stable via version() — pas de boucle infinie même quand
  // l'évaluation déclenche des notifications sur d'autres stores.
  const rulesVersion = useSyncExternalStore(
    (cb) => tacticalRulesEngine.subscribe(cb),
    () => tacticalRulesEngine.version(),
    () => tacticalRulesEngine.version(),
  );

  const ctx = useMemo<MarketContext>(
    () => ({ ...tacticalRulesEngine.getContext(), ...contextOverride }),
    [rulesVersion, contextOverride],
  );

  const [autopilot, setAutopilot] = useState(false);
  const [basePrice, setBasePrice] = useState(150);
  const [previousPrice, setPreviousPrice] = useState(150);
  const [result, setResult] = useState<ReturnType<typeof rmsRuleEvaluator.evaluate> | null>(null);

  const run = () => {
    const r = rmsRuleEvaluator.evaluate({
      autopilot,
      context: ctx,
      basePrice,
      previousPrice,
      date: new Date().toISOString().slice(0, 10),
    });
    setResult(r);
    onResult?.(r);
  };

  useEffect(() => {
    if (autoEvaluate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEvaluate, ctx, autopilot, basePrice, previousPrice]);

  // Snapshot stable : version() est un primitif, pas un array fraîchement créé.
  // On lit ensuite les 5 derniers événements directement (référence stable car
  // le store interne est remplacé immutablement à chaque log).
  useSyncExternalStore(
    (cb) => rmsAuditLogger.subscribe(cb),
    () => rmsAuditLogger.version(),
    () => rmsAuditLogger.version(),
  );
  const audit = rmsAuditLogger.all().slice(0, 5);

  return (
    <section className={cn(
      'bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5',
      className,
    )}>
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#8B5CF6] text-white shadow shadow-[#8B5CF6]/30">
            <Cpu size={18} />
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-gray-900">Moteur tactique RMS</h4>
            <p className="text-[12px] text-gray-500">
              Évaluation de bout en bout : règles → conflits → garde-fous → recommandation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-700 cursor-pointer">
            <span>Autopilote</span>
            <button
              type="button"
              onClick={() => setAutopilot((v) => !v)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                autopilot ? 'bg-[#8B5CF6]' : 'bg-gray-300',
              )}
              aria-pressed={autopilot}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                autopilot ? 'translate-x-[18px]' : 'translate-x-[2px]',
              )} />
            </button>
          </label>
          <button
            type="button"
            onClick={run}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl px-3 py-1.5 shadow-sm"
          >
            <Play size={12} /> Évaluer
          </button>
        </div>
      </header>

      {/* Contexte marché + prix */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Tile label="Pression marché" value={ctx.marketPressure} />
        <Tile label="Occupation" value={`${ctx.occupancy}%`} />
        <Tile label="Pickup 24h" value={`${ctx.pickup24h}`} />
        <Tile
          label="Événement majeur"
          value={ctx.hasMajorEvent ? 'Oui' : 'Non'}
          tone={ctx.hasMajorEvent ? 'positive' : 'neutral'}
        />
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1 block">Prix de base</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1 block">Prix précédent (J-1)</label>
          <input
            type="number"
            value={previousPrice}
            onChange={(e) => setPreviousPrice(Number(e.target.value))}
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
        </div>
      </div>

      {/* Output */}
      {result && (
        <div className="space-y-3">
          <Pipeline result={result} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card title="Règles appliquées" icon={<Zap size={14} className="text-[#8B5CF6]" />}>
              {result.appliedRules.length === 0 ? (
                <p className="text-[12px] text-gray-500">Aucune règle déclenchée dans ce contexte.</p>
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {result.appliedRules.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span><b>{r.ruleName}</b> — {r.reason} ({(r.magnitude * 100).toFixed(1)}%)</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.suppressedRules.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Suspendues</div>
                  <ul className="text-[12px] space-y-1">
                    {result.suppressedRules.map((r, i) => (
                      <li key={i} className="text-gray-600">
                        <span className="line-through">{r.ruleName}</span> — {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="Garde-fous activés" icon={<Shield size={14} className="text-emerald-500" />}>
              {result.guardrails.triggered.length === 0 ? (
                <p className="text-[12px] text-gray-500">Aucun garde-fou n'a été nécessaire.</p>
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {result.guardrails.triggered.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle size={12} className={cn('mt-0.5 shrink-0', t.outcome === 'blocked' ? 'text-rose-500' : 'text-amber-500')} />
                      <span><b>{t.guardrail.name}</b> — {t.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className={cn(
            'rounded-2xl p-4',
            result.pushed ? 'bg-emerald-50 border border-emerald-100' : 'bg-violet-50 border border-violet-100',
          )}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[12px] text-gray-700">{result.explanation}</div>
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <span className="text-gray-600">{result.basePrice}€</span>
                <ArrowRight size={14} className="text-gray-400" />
                <span className={cn(result.recommendedPrice > result.basePrice ? 'text-emerald-600' : result.recommendedPrice < result.basePrice ? 'text-rose-600' : 'text-gray-900')}>
                  {result.recommendedPrice}€
                </span>
              </div>
            </div>
            {result.pushed && (
              <button
                type="button"
                onClick={() => rmsRuleEvaluator.rollback(new Date().toISOString().slice(0, 10))}
                className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-100"
              >
                <RotateCcw size={11} /> Rollback
              </button>
            )}
          </div>
        </div>
      )}

      {/* Audit live */}
      {audit.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 cursor-pointer hover:text-gray-700">
            Journal d'audit ({audit.length} dernières entrées)
          </summary>
          <ul className="mt-2 space-y-1 text-[11px]">
            {audit.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-gray-600">
                <span className="text-gray-400 shrink-0">{new Date(e.timestamp).toLocaleTimeString('fr-FR')}</span>
                <span className="font-semibold text-gray-800">{e.actor}</span>
                <span className="text-gray-500">— {e.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; tone?: 'positive' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={cn(
    'rounded-xl p-2.5',
    tone === 'positive' ? 'bg-emerald-50' : 'bg-[#FAFAFB]',
  )}>
    <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
    <div className={cn('text-[14px] font-bold mt-0.5', tone === 'positive' ? 'text-emerald-700' : 'text-gray-900')}>{value}</div>
  </div>
);

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-xl border border-[#F3F4F6] bg-[#FAFAFB] p-3">
    <header className="flex items-center gap-2 mb-2">
      {icon}
      <h5 className="text-[11px] uppercase tracking-wider font-bold text-gray-700">{title}</h5>
    </header>
    {children}
  </div>
);

const Pipeline: React.FC<{ result: NonNullable<ReturnType<typeof rmsRuleEvaluator.evaluate>> }> = ({ result }) => {
  const steps = [
    { label: 'Base', value: `${result.basePrice}€` },
    { label: 'Règles', value: result.appliedRules.length, accent: '#8B5CF6' },
    { label: 'Conflits', value: result.suppressedRules.length, accent: '#F59E0B' },
    { label: 'Garde-fous', value: result.guardrails.triggered.length, accent: '#10B981' },
    { label: 'Final', value: `${result.recommendedPrice}€`, accent: '#8B5CF6' },
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="shrink-0 text-center px-3 py-1.5 rounded-lg bg-[#FAFAFB] border border-[#F3F4F6]">
            <div className="text-[9px] uppercase tracking-wider text-gray-500">{s.label}</div>
            <div className="text-[13px] font-bold" style={{ color: s.accent ?? '#111827' }}>{s.value}</div>
          </div>
          {i < steps.length - 1 && <ArrowRight size={14} className="text-gray-300 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
};
