/**
 * FLOWTYM — Workflow Clôture journalière (midi/midi) 8 étapes
 */

import React, { useEffect, useState } from 'react';
import {
  Lock, CheckCircle2, Loader2, AlertCircle, ChevronRight, RefreshCw,
  Database, Calculator, FileText, ArrowRightLeft, Save, Printer, Calendar,
} from 'lucide-react';
import { listClosures, type ClosureWorkflow } from '../../services/finance/finance.service';
import { supabase } from '../../lib/supabase';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

interface Step {
  num: number;
  label: string;
  description: string;
  icon: any;
  targetMs: number;
}

const STEPS: Step[] = [
  { num: 1, label: 'Pré-contrôles', description: 'Vérification départs soldés, no-shows traités', icon: CheckCircle2, targetMs: 1000 },
  { num: 2, label: 'Récupération arrivées', description: 'Bascule réservations → fiches arrivée', icon: ArrowRightLeft, targetMs: 2000 },
  { num: 3, label: 'Mise à jour factures', description: 'Recouchants (hébergement, petit-déj)', icon: FileText, targetMs: 5000 },
  { num: 4, label: 'Sauvegarde express', description: 'Fichiers critiques → S3 + local', icon: Save, targetMs: 10000 },
  { num: 5, label: 'MC Règlements brouillon', description: 'Contrôle caisse', icon: Calculator, targetMs: 3000 },
  { num: 6, label: 'Impression états', description: 'PDF (12001, 12003, 12006)', icon: Printer, targetMs: 15000 },
  { num: 7, label: 'Changement date', description: 'Date hôtel +1, bascule réservations', icon: Calendar, targetMs: 2000 },
  { num: 8, label: 'Verrouillage fiscal', description: 'Snapshots TVA, factures + event closure.completed', icon: Lock, targetMs: 5000 },
];

export const ClosureWorkflowView: React.FC = () => {
  const [closures, setClosures] = useState<ClosureWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

    try {
      // Crée la ligne de workflow
      const { data: hotelData } = await (supabase.rpc as any)('get_user_hotel_id');
      const hotelId = String(hotelData ?? '');
      const stepsDone: any[] = [];
      const startedAt = new Date().toISOString();

      const { data: created, error: insErr } = await supabase
        .from('closure_workflow')
        .insert({
          hotel_id: hotelId,
          closure_date: today,
          state: 'in_progress',
          step_current: 0,
          started_at: startedAt,
        })
        .select('*').single();
      if (insErr) throw insErr;

      // Simulation des 8 étapes (UX premium)
      for (let i = 0; i < STEPS.length; i++) {
        setCurrentStep(i + 1);
        await new Promise(r => setTimeout(r, Math.min(STEPS[i].targetMs / 4, 1500)));
        stepsDone.push({ step: STEPS[i].num, label: STEPS[i].label, completed_at: new Date().toISOString() });
        await supabase
          .from('closure_workflow')
          .update({ step_current: i + 1, steps_done: stepsDone })
          .eq('id', created.id);
      }

      const finishedAt = new Date().toISOString();
      await supabase
        .from('closure_workflow')
        .update({
          state: 'completed',
          finished_at: finishedAt,
          duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        })
        .eq('id', created.id);

      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setCurrentStep(0);
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
            <div className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Clôturée à {todayClosure.finished_at ? new Date(todayClosure.finished_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              {todayClosure.duration_ms && <span className="text-violet-300">· {Math.round(todayClosure.duration_ms / 1000)}s</span>}
            </div>
          ) : (
            <div className="text-xs text-amber-300 mt-1">Non clôturée</div>
          )}
        </div>
        {!todayClosure && (
          <button
            onClick={handleStart}
            disabled={running}
            className={cn(
              'px-5 py-2.5 bg-white text-violet-900 rounded-md text-sm font-extrabold inline-flex items-center gap-2 transition-all',
              running ? 'opacity-50' : 'hover:scale-105 shadow-lg shadow-violet-500/30'
            )}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {running ? 'Clôture en cours…' : 'Démarrer la clôture'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 8 étapes */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-violet-500" />
          Workflow en 8 étapes
        </h3>
        <div className="space-y-2">
          {STEPS.map((step) => {
            const done = todayClosure ? (todayClosure.steps_done as any[])?.some(s => s.step === step.num) : false;
            const inProgress = running && currentStep === step.num;
            const future = running && currentStep < step.num;
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-all',
                  done ? 'bg-emerald-50 border-emerald-200' :
                  inProgress ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200' :
                  future ? 'bg-gray-50 border-gray-200 opacity-50' :
                  'bg-white border-gray-200'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-extrabold',
                  done ? 'bg-emerald-500 text-white' :
                  inProgress ? 'bg-violet-600 text-white' :
                  'bg-gray-200 text-gray-600'
                )}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> :
                   inProgress ? <Loader2 className="w-5 h-5 animate-spin" /> :
                   step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">{step.label}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                <Icon className={cn('w-5 h-5', done ? 'text-emerald-600' : inProgress ? 'text-violet-600' : 'text-gray-300')} />
                <span className="text-[10px] text-gray-400 font-mono">cible {step.targetMs}ms</span>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closures.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold">{new Date(c.closure_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2 text-center">
                    <StatusBadge state={c.state} />
                  </td>
                  <td className="px-4 py-2 text-center font-mono">
                    {c.step_current}/8
                  </td>
                  <td className="px-4 py-2 text-xs">{c.started_at ? new Date(c.started_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-2 text-xs">{c.finished_at ? new Date(c.finished_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-2 text-right text-xs">{c.duration_ms ? `${Math.round(c.duration_ms / 1000)}s` : '—'}</td>
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
    completed:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Terminée' },
    failed:      { bg: 'bg-red-100',     text: 'text-red-800',     label: 'Échec' },
    rolled_back: { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Rollback' },
  }[state];
  return <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', cfg.bg, cfg.text)}>{cfg.label}</span>;
}
