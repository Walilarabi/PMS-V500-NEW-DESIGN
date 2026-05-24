/**
 * FLOWTYM — Paramètres · Sauvegardes & Résilience.
 *
 * Page de pilotage de la stratégie de sauvegarde. Phase 1 = simulation
 * persistée en localStorage (toggles + dernier run mocké). Phase 2 =
 * branchement réel sur le job backend de snapshots.
 *
 * Toute modification alimente le moteur de diagnostic (driver
 * "Sauvegardes quotidiennes" + alerte "backup_failed").
 */
import React, { useState, useEffect } from 'react';
import {
  HardDrive, Save, Play, RotateCcw, Download, CheckCircle2, AlertCircle,
  RefreshCw, Database, ShieldCheck, Clock,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const STORAGE_KEY = 'flowtym.backups.config';

interface BackupConfig {
  dailyEnabled: boolean;
  hourlyCriticalEnabled: boolean;
  monthlyArchiveEnabled: boolean;
  multiZoneReplication: boolean;
  retentionDays: number;
  lastDailyRun?: string;        // ISO
  lastDailyStatus?: 'success' | 'failed';
}

const DEFAULT: BackupConfig = {
  dailyEnabled: true,
  hourlyCriticalEnabled: true,
  monthlyArchiveEnabled: true,
  multiZoneReplication: false,
  retentionDays: 90,
  lastDailyRun: new Date(Date.now() - 6 * 3600_000).toISOString(),
  lastDailyStatus: 'success',
};

function load(): BackupConfig {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch { return DEFAULT; }
}
function save(c: BackupConfig) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export const BackupsPage: React.FC = () => {
  const [cfg, setCfg] = useState<BackupConfig>(() => load());
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function update(patch: Partial<BackupConfig>) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    save(next);
    logAudit({ action: 'module_inspected', module: 'security_backups', detail: `Config sauvegardes mise à jour : ${Object.keys(patch).join(', ')}` });
  }

  async function runNow() {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 1200));
    const success = Math.random() > 0.05;
    const next: BackupConfig = {
      ...cfg,
      lastDailyRun: new Date().toISOString(),
      lastDailyStatus: success ? 'success' : 'failed',
    };
    setCfg(next);
    save(next);
    logAudit({
      action: 'module_inspected', module: 'security_backups',
      detail: success ? 'Sauvegarde manuelle réussie' : 'Sauvegarde manuelle échouée',
    });
    notify(success ? 'Sauvegarde terminée avec succès' : 'Erreur durant la sauvegarde');
    setRunning(false);
  }

  // Score résilience : 4 leviers + dernière sauvegarde réussie
  const score =
    (cfg.dailyEnabled ? 25 : 0) +
    (cfg.hourlyCriticalEnabled ? 20 : 0) +
    (cfg.monthlyArchiveEnabled ? 15 : 0) +
    (cfg.multiZoneReplication ? 25 : 0) +
    (cfg.lastDailyStatus === 'success' ? 15 : 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Sauvegardes & Résilience</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Stratégie de sauvegarde, rétention et restauration des données critiques.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runNow}
              disabled={running}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20 disabled:opacity-60"
            >
              {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
            </button>
            <button
              onClick={() => notify('Restauration : opération sensible, à confirmer en Phase 2')}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restaurer
            </button>
          </div>
        </header>

        {/* Score résilience */}
        <section className={cn(
          'rounded-2xl ring-1 p-5 flex items-start gap-4',
          score >= 80 ? 'ring-emerald-200 bg-emerald-50/60' :
          score >= 50 ? 'ring-amber-200 bg-amber-50/60' :
          'ring-rose-200 bg-rose-50/60',
        )}>
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center ring-1',
            score >= 80 ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' :
            score >= 50 ? 'bg-amber-100 text-amber-700 ring-amber-200' :
            'bg-rose-100 text-rose-700 ring-rose-200',
          )}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold tabular-nums">{score}</span>
              <span className="text-[12px] text-slate-500">/100</span>
              <span className="text-[12.5px] text-slate-600 ml-2">Score de résilience</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
              <div
                className={cn('h-full', score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-[12px] text-slate-600 mt-2">
              {score >= 80
                ? 'Excellente couverture. Le PMS est protégé contre toute perte de données majeure.'
                : score >= 50
                  ? 'Couverture partielle. Activez plus de stratégies pour atteindre le niveau enterprise.'
                  : 'Couverture insuffisante. Vos données critiques sont exposées.'}
            </p>
          </div>
        </section>

        {/* Stratégies */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-[13px] font-semibold text-slate-900">Stratégies de sauvegarde</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">Activez les couches qui correspondent à votre tolérance au risque.</p>
          </header>
          <ul className="divide-y divide-slate-100">
            <StrategyRow
              label="Sauvegarde quotidienne"
              description="Snapshot complet exécuté chaque nuit à 02h30 UTC."
              enabled={cfg.dailyEnabled}
              onToggle={() => update({ dailyEnabled: !cfg.dailyEnabled })}
              weight={25}
            />
            <StrategyRow
              label="Sauvegarde horaire (données critiques)"
              description="Réservations, factures et paiements répliqués toutes les heures."
              enabled={cfg.hourlyCriticalEnabled}
              onToggle={() => update({ hourlyCriticalEnabled: !cfg.hourlyCriticalEnabled })}
              weight={20}
            />
            <StrategyRow
              label="Archive mensuelle"
              description="Export complet du PMS conservé hors-ligne pendant 10 ans (conformité)."
              enabled={cfg.monthlyArchiveEnabled}
              onToggle={() => update({ monthlyArchiveEnabled: !cfg.monthlyArchiveEnabled })}
              weight={15}
            />
            <StrategyRow
              label="Réplication multi-zone"
              description="Données dupliquées en temps réel sur 2 zones géographiques (UE)."
              enabled={cfg.multiZoneReplication}
              onToggle={() => update({ multiZoneReplication: !cfg.multiZoneReplication })}
              weight={25}
              premium
            />
          </ul>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Rétention</span>
            <input
              type="number"
              min={7} max={365}
              value={cfg.retentionDays}
              onChange={(e) => update({ retentionDays: Math.max(7, Math.min(365, parseInt(e.target.value) || 90)) })}
              className="w-24 px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[13px] font-semibold tabular-nums focus:ring-violet-500 outline-none"
            />
            <span className="text-[12px] text-slate-600">jours · les sauvegardes au-delà sont purgées automatiquement</span>
          </div>
        </section>

        {/* Dernière exécution */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
          <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Dernière sauvegarde</h3>
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center ring-1',
              cfg.lastDailyStatus === 'success'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-rose-50 text-rose-700 ring-rose-200',
            )}>
              {cfg.lastDailyStatus === 'success' ? <Database className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-slate-900">
                {cfg.lastDailyStatus === 'success' ? 'Succès' : 'Échec'}
              </div>
              {cfg.lastDailyRun && (
                <div className="text-[11.5px] text-slate-500 mt-0.5 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(cfg.lastDailyRun).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
            <button
              onClick={() => notify('Téléchargement de l\'archive (mock Phase 1)')}
              className="px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Télécharger
            </button>
          </div>
        </section>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};

const StrategyRow: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  weight: number;
  premium?: boolean;
}> = ({ label, description, enabled, onToggle, weight, premium }) => (
  <li className="px-5 py-3 flex items-center gap-3">
    <button
      onClick={onToggle}
      className={cn(
        'relative w-10 h-5 rounded-full transition-colors shrink-0',
        enabled ? 'bg-violet-600' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          enabled && 'translate-x-5',
        )}
      />
    </button>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-900">{label}</span>
        {premium && (
          <span className="text-[9px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
            Enterprise
          </span>
        )}
      </div>
      <div className="text-[11.5px] text-slate-500 mt-0.5">{description}</div>
    </div>
    <span className="text-[11px] text-slate-400 tabular-nums">+{weight} pts</span>
  </li>
);
