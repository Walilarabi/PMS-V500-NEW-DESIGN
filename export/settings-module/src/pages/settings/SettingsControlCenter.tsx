/**
 * FLOWTYM RMS — Settings Control Center.
 *
 * Centre de commande du PMS. Orchestre :
 *   • le moteur de diagnostic (useSettingsDiagnostic) ;
 *   • 5 cartes KPI vivantes (santé, syncs, alertes, conformité, revenue) ;
 *   • le tableau d'état des 8 modules clés ;
 *   • le panneau alertes & actions recommandées ;
 *   • la checklist de configuration ;
 *   • la configuration guidée (parcours d'installation) ;
 *   • le flux des derniers journaux système ;
 *   • la modal Customize Dashboard (visibilité/ordre) ;
 *   • les exports JSON / Excel.
 *
 * La navigation depuis chaque bouton se fait via l'événement
 * 'navigate' (custom event capté par App.tsx) — pas de couplage dur
 * avec le router, on garde la mécanique existante du PMS.
 */
import React, { useMemo, useState } from 'react';
import {
  Activity, Download, FileDown, FileSpreadsheet, Loader2, Settings2, Wand2, Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { useSettingsDiagnostic } from '@/src/hooks/settings/useSettingsDiagnostic';
import { exportConfigJSON, exportConfigExcel, exportConfigPDF } from '@/src/services/settings/settingsExportService';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import type { ModuleStatus } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { SystemHealthKpiCards } from './widgets/SystemHealthKpiCards';
import { ModuleStatusTable } from './widgets/ModuleStatusTable';
import { RecommendedActionsPanel } from './widgets/RecommendedActionsPanel';
import { ConfigurationChecklist } from './widgets/ConfigurationChecklist';
import { GuidedSetupPanel } from './widgets/GuidedSetupPanel';
import { SystemLogsPanel } from './widgets/SystemLogsPanel';
import { ModuleDetailModal } from './widgets/ModuleDetailModal';
import { DashboardCustomizerModal, loadLayout, type WidgetPref } from './widgets/DashboardCustomizerModal';
import { QuickWinsPanel } from './widgets/QuickWinsPanel';
import { ScoreTrendsPanel } from './widgets/ScoreTrendsPanel';
import { AlertSimulationModal } from './widgets/AlertSimulationModal';
import type { ConfigAlert } from '@/src/types/settings/diagnostic';

function emitNavigate(target: PageId) {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { page: target } }));
}

export const SettingsControlCenter: React.FC = () => {
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelCity = useConfigStore((s) => s.hotel.city);
  const { report, running, rerun } = useSettingsDiagnostic();

  const [inspected, setInspected] = useState<ModuleStatus | null>(null);
  const [simulating, setSimulating] = useState<ConfigAlert | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [layout, setLayout] = useState<WidgetPref[]>(() => loadLayout());

  const generatedAt = useMemo(
    () => new Date(report.generatedAt).toLocaleString('fr-FR'),
    [report.generatedAt],
  );

  const widgets = useMemo(() => {
    const visible = layout.filter((w) => w.visible).sort((a, b) => a.order - b.order);
    return visible.map((w) => w.id);
  }, [layout]);

  function handleExport(kind: 'json' | 'excel' | 'pdf') {
    if (kind === 'json') exportConfigJSON(report);
    else if (kind === 'excel') exportConfigExcel(report);
    else exportConfigPDF(report);
    logAudit({ action: 'config_exported', detail: `Format ${kind.toUpperCase()}` });
    setExportMenu(false);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* ─── Header cockpit ─────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-violet-600 font-bold">Control Center · Flowtym</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Vue d'ensemble de la configuration et de la santé de votre PMS</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                {hotelName || 'Établissement'} {hotelCity ? `· ${hotelCity}` : ''} · Dernier diagnostic : {generatedAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Export menu */}
            <div className="relative">
              <button
                onClick={() => setExportMenu((v) => !v)}
                className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Exporter
              </button>
              {exportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-60 z-20 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg py-1 text-[13px]">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-rose-600" />
                      <div>
                        <div className="font-medium text-slate-900">PDF exécutif</div>
                        <div className="text-[11px] text-slate-400">Réunion direction · A4 paysage</div>
                      </div>
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-medium text-slate-900">Excel multi-feuilles</div>
                        <div className="text-[11px] text-slate-400">KPIs · Modules · Alertes · Checklist · Logs</div>
                      </div>
                    </button>
                    <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-slate-600" />
                      <div>
                        <div className="font-medium text-slate-900">Configuration JSON</div>
                        <div className="text-[11px] text-slate-400">Snapshot complet</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setCustomizerOpen(true)}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" /> Personnaliser le tableau
            </button>
            <button
              onClick={() => { void rerun(); }}
              disabled={running}
              className={cn(
                'px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20',
                running && 'opacity-70 cursor-wait',
              )}
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {running ? 'Diagnostic en cours…' : 'Lancer diagnostic PMS'}
            </button>
          </div>
        </header>

        {/* ─── Widgets dynamiques selon layout ────────────────────────── */}
        {widgets.includes('kpis') && (
          <SystemHealthKpiCards
            report={report}
            onOpenRevenue={() => emitNavigate('rev_dashboard' as PageId)}
          />
        )}

        {/* Quick Wins — conditionné par customizer + s'auto-cache si aucune alerte */}
        {widgets.includes('quickwins') && (
          <QuickWinsPanel report={report} onNavigate={emitNavigate} />
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          {widgets.includes('modules') && (
            <div className="xl:col-span-2">
              <ModuleStatusTable
                modules={report.modules}
                onInspect={setInspected}
                onNavigate={emitNavigate}
              />
            </div>
          )}
          {widgets.includes('alerts') && (
            <div className={cn(widgets.includes('modules') ? 'xl:col-span-1' : 'xl:col-span-3')}>
              <RecommendedActionsPanel alerts={report.alerts} onNavigate={emitNavigate} onSimulate={setSimulating} />
            </div>
          )}
        </div>

        {widgets.includes('trends') && <ScoreTrendsPanel report={report} />}

        <div className="grid gap-4 xl:grid-cols-3">
          {widgets.includes('checklist') && (
            <div className="xl:col-span-2">
              <ConfigurationChecklist domains={report.checklist} onNavigate={emitNavigate} />
            </div>
          )}
          {widgets.includes('guided') && (
            <div className="xl:col-span-1">
              <GuidedSetupPanel steps={report.guided} onNavigate={emitNavigate} />
            </div>
          )}
        </div>

        {widgets.includes('logs') && <SystemLogsPanel logs={report.logs} onNavigate={emitNavigate} />}

        {/* Footer signal Flowtym */}
        <footer className="flex items-center gap-2 text-[11.5px] text-slate-500 pt-2">
          <Activity className="w-3 h-3 text-violet-500" />
          <span>
            Diagnostic vivant — recalculé à chaque modification de configuration, événement, ou décision RMS.
          </span>
        </footer>
      </div>

      {/* Modals */}
      <ModuleDetailModal
        module={inspected}
        onClose={() => setInspected(null)}
        onNavigate={emitNavigate}
      />
      <DashboardCustomizerModal
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        onChange={setLayout}
      />
      <AlertSimulationModal
        alert={simulating}
        report={report}
        onClose={() => setSimulating(null)}
        onApplyAction={(target) => {
          setSimulating(null);
          emitNavigate(target);
        }}
      />
    </div>
  );
};
