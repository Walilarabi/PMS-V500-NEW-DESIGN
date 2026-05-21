/**
 * FLOWTYM — Workflow Clôture journalière (midi/midi) 8 étapes — VRAIES RPCs
 *
 * Vague F2 : exécute chaque étape via Supabase RPC (vs simulation setTimeout).
 * Avec gestion d'erreur + rollback.
 */

import React, { useEffect, useState } from 'react';
import {
  Lock, CheckCircle2, Loader2, AlertCircle, RefreshCw, RotateCcw,
  Database, Calculator, FileText, ArrowRightLeft, Save, Printer, Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  listClosures, startClosure, executeClosureStep, rollbackClosure,
  type ClosureWorkflow, type ClosureStepResult,
} from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

interface Step {
  num: number;
  label: string;
  description: string;
  icon: any;
  reversible: boolean;
}

const STEPS: Step[] = [
  { num: 1, label: 'Pré-contrôles', description: 'Départs soldés, no-shows, chambres sales', icon: CheckCircle2, reversible: false },
  { num: 2, label: 'Récupération arrivées', description: 'Marquage no-shows passés', icon: ArrowRightLeft, reversible: true },
  { num: 3, label: 'Recouchants', description: 'Création prestations Nuitée pour présents', icon: FileText, reversible: true },
  { num: 4, label: 'Sauvegarde express', description: 'Snapshot transactionnel + audit log', icon: Save, reversible: false },
  { num: 5, label: 'MC Règlements', description: 'Total Espèces/CB/Virement/Débiteur', icon: Calculator, reversible: false },
  { num: 6, label: 'Impression états', description: 'Rapports 12001/12003/12006 marqués prêts', icon: Printer, reversible: false },
  { num: 7, label: 'Changement date', description: 'Date hôtel +1 (audit log)', icon: Calendar, reversible: false },
  { num: 8, label: 'Verrouillage fiscal', description: 'Snapshot TVA + signature SHA-256', icon: Lock, reversible: false },
];

export const ClosureWorkflowView: React.FC = () => {
  const [closures, setClosures] = useState<ClosureWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<ClosureStepResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rollbacking, setRollbacking] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setClosures(await listClosures(15)); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayClosure = closures.find(c => c.closure_date === today);

  const handleStart = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setCurrentStep(0);
    setStepResults([]);

    try {
      const closureId = await startClosure(today);
      const results: ClosureStepResult[] = [];

      for (let i = 1; i <= 8; i++) {
        setCurrentStep(i);
        const result = await executeClosureStep(closureId, i);
        results.push(result);
        setStepResults([...results]);
        // Petite pause UX entre les étapes pour permettre à l'utilisateur de voir
        await new Promise(r => setTimeout(r, 400));
      }

      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setCurrentStep(0);
    }
  };

  const handleRollback = async (closureId: string) => {
    if (!confirm("Rollback : annuler les étapes 2 (no-shows) et 3 (recouchants) ?\nLes étapes 4-8 ne sont pas réversibles.")) return;
    setRollbacking(true);
    setError(null);
    try {
      const result = await rollbackClosure(closureId);
      alert(`Rollback effectué :\n${result.recouchants_reverted} recouchants supprimés\n${result.noshows_reverted} no-shows annulés`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRollbacking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bandeau action */}
      <div className="bg-gradient-to-r from-slate-900 to-violet-900 text-white rounded-lg p-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Clôture journalière</div>
          <div className="text-xl font-extrabold">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          {todayClosure ? (
            <div className="text-xs mt-1 flex items-center gap-2">
              <StatusBadge state={todayClosure.state} />
              {todayClosure.finished_at && (
                <span className="text-violet-200">
                  Terminée à {new Date(todayClosure.finished_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {todayClosure.duration_ms && <> · {Math.round(todayClosure.duration_ms / 1000)}s</>}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-amber-300 mt-1">Non clôturée</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {todayClosure && todayClosure.state !== 'completed' && (
            <button
              onClick={() => handleRollback(todayClosure.id)}
              disabled={rollbacking || running}
              className="px-4 py-2 bg-amber-100 text-amber-900 rounded-md text-sm font-bold inline-flex items-center gap-2 hover:bg-amber-200 disabled:opacity-50"
              title="Annuler les étapes réversibles (2 et 3)"
            >
              {rollbacking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Rollback
            </button>
          )}
          {(!todayClosure || todayClosure.state === 'failed' || todayClosure.state === 'rolled_back') && (
            <button
              onClick={handleStart}
              disabled={running}
              className={cn(
                'px-5 py-2.5 bg-white text-violet-900 rounded-md text-sm font-extrabold inline-flex items-center gap-2 transition-all',
                running ? 'opacity-50' : 'hover:scale-105 shadow-lg shadow-violet-500/30'
              )}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {running ? `Étape ${currentStep}/8 en cours…` : todayClosure?.state === 'failed' ? 'Réessayer' : 'Démarrer la clôture'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Erreur d'exécution</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* 8 étapes */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-violet-500" />
          Workflow en 8 étapes (RPCs Supabase atomiques)
        </h3>
        <div className="space-y-2">
          {STEPS.map((step) => {
            const result = stepResults.find(r => r.step === step.num)
              ?? (todayClosure?.steps_done as ClosureStepResult[])?.find((s: any) => s.step === step.num);
            const done = !!result?.success;
            const inProgress = running && currentStep === step.num;
            const future = (running && currentStep < step.num) || (!running && !done && !todayClosure);
            const failed = !!todayClosure?.steps_errors?.[String(step.num)];
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-all',
                  done ? 'bg-emerald-50 border-emerald-200' :
                  failed ? 'bg-red-50 border-red-200' :
                  inProgress ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200' :
                  future ? 'bg-gray-50 border-gray-200 opacity-50' :
                  'bg-white border-gray-200'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-extrabold',
                  done ? 'bg-emerald-500 text-white' :
                  failed ? 'bg-red-500 text-white' :
                  inProgress ? 'bg-violet-600 text-white' :
                  'bg-gray-200 text-gray-600'
                )}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> :
                   failed ? <AlertTriangle className="w-5 h-5" /> :
                   inProgress ? <Loader2 className="w-5 h-5 animate-spin" /> :
                   step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {step.label}
                    {step.reversible && (
                      <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Réversible</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                  {result && (
                    <div className="text-[11px] text-emerald-700 mt-1 font-mono">
                      {renderStepSummary(step.num, result)}
                    </div>
                  )}
                  {failed && todayClosure?.steps_errors?.[String(step.num)] && (
                    <div className="text-[11px] text-red-700 mt-1 font-mono">
                      ⚠ {todayClosure.steps_errors[String(step.num)]}
                    </div>
                  )}
                </div>
                <Icon className={cn('w-5 h-5', done ? 'text-emerald-600' : inProgress ? 'text-violet-600' : 'text-gray-300')} />
                {result?.duration_ms !== undefined && (
                  <span className="text-[10px] text-gray-400 font-mono">{result.duration_ms}ms</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Historique des clôtures ({closures.length})</h3>
          <button onClick={reload} className="text-xs text-violet-700 hover:text-violet-900 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Rafraîchir
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : closures.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucune clôture enregistrée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-4 py-2 text-left font-bold">Date</th>
                <th className="px-4 py-2 text-center font-bold">État</th>
                <th className="px-4 py-2 text-center font-bold">Étapes</th>
                <th className="px-4 py-2 text-left font-bold">Démarrée</th>
                <th className="px-4 py-2 text-left font-bold">Terminée</th>
                <th className="px-4 py-2 text-right font-bold">Durée</th>
                <th className="px-4 py-2 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closures.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold">{new Date(c.closure_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge state={c.state} /></td>
                  <td className="px-4 py-2 text-center font-mono">{c.step_current}/8</td>
                  <td className="px-4 py-2 text-xs">{c.started_at ? new Date(c.started_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-2 text-xs">{c.finished_at ? new Date(c.finished_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-2 text-right text-xs">{c.duration_ms ? `${Math.round(c.duration_ms / 1000)}s` : '—'}</td>
                  <td className="px-4 py-2 text-center">
                    {(c.state === 'in_progress' || c.state === 'failed') && c.step_current < 8 && (
                      <button
                        onClick={() => handleRollback(c.id)}
                        disabled={rollbacking}
                        className="text-xs text-amber-700 hover:underline inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback
                      </button>
                    )}
                    {c.state === 'completed' && c.step_current === 8 && (
                      <span className="text-[10px] text-emerald-700 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Verrouillée
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

function StatusBadge({ state }: { state: ClosureWorkflow['state'] }) {
  const cfg = {
    pending:     { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'En attente' },
    in_progress: { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'En cours' },
    completed:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '✓ Terminée' },
    failed:      { bg: 'bg-red-100',     text: 'text-red-800',     label: '✗ Échec' },
    rolled_back: { bg: 'bg-orange-100',  text: 'text-orange-800',  label: '↶ Rollback' },
  }[state];
  return <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', cfg.bg, cfg.text)}>{cfg.label}</span>;
}

function renderStepSummary(step: number, r: ClosureStepResult): string {
  switch (step) {
    case 1: return `Présents ${r.unfinished_departures ?? 0} départs non libérés, ${r.pending_arrivals ?? 0} arrivées en attente`;
    case 2: return `${r.no_shows_marked ?? 0} no-shows marqués`;
    case 3: return `${r.recouchants_created ?? 0} recouchants créés · ${r.total_amount?.toLocaleString?.('fr-FR') ?? 0}€`;
    case 4: return `Snapshot : ${r.reservations_snapshot ?? 0} résa · ${r.payments_snapshot ?? 0} paiements`;
    case 5: return `Total caisse ${r.total?.toLocaleString?.('fr-FR') ?? 0}€ sur ${r.transactions ?? 0} transactions`;
    case 6: return `Rapports prêts : ${r.reports_ready?.join?.(', ') ?? '—'}`;
    case 7: return `Date avancée : ${r.previous_date} → ${r.next_date}`;
    case 8: return r.is_month_end
      ? `Snapshot TVA verrouillé · ${r.fiscal_stamp ?? '—'}`
      : `Verrouillage appliqué · ${r.invoices_locked ?? 0} factures · pas fin de mois`;
    default: return JSON.stringify(r);
  }
}
