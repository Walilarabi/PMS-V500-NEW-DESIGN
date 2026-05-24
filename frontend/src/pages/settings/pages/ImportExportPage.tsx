/**
 * FLOWTYM — Paramètres · Import / Export.
 *
 * Outils de migration et de sauvegarde manuelle : import CSV / Excel,
 * export complet (JSON, Excel, FEC). Phase 1 : exports réels depuis le
 * stockage local + import simulé. Phase 2 : import production avec
 * validation + rollback.
 */
import React, { useRef, useState } from 'react';
import {
  Upload, Download, FileSpreadsheet, FileText, FileCode2, AlertCircle, CheckCircle2, Database,
} from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import { useEventsStore } from '@/src/store/eventsStore';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { exportConfigJSON, exportConfigExcel, exportConfigPDF } from '@/src/services/settings/settingsExportService';
import { runDiagnostic } from '@/src/services/settings/settingsDiagnosticEngine';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { SettingsPageHeader, SettingsToast, Phase2Notice, SettingsMetric } from './_common';

export const ImportExportPage: React.FC = () => {
  const cfg = useConfigStore();
  const events = useEventsStore();
  const calendar = useRateCalendarStore();
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function exportAll(format: 'json' | 'excel' | 'pdf') {
    const report = runDiagnostic();
    if (format === 'json') exportConfigJSON(report);
    else if (format === 'excel') exportConfigExcel(report);
    else exportConfigPDF(report);
    logAudit({ action: 'config_exported', detail: `Export complet ${format.toUpperCase()}` });
    notify(`Export ${format.toUpperCase()} généré`);
  }

  function exportFullJSON() {
    const dump = {
      exportedAt: new Date().toISOString(),
      hotel: cfg.hotel,
      taxes: cfg.taxes,
      users: cfg.users,
      rooms: cfg.rooms,
      events: cfg.events,
      channels: cfg.channels,
      pricingRules: cfg.pricingRules,
      // events module + calendar (lite)
      eventsModule: {
        total: events.events.length,
        sources: events.sources.length,
      },
      calendar: {
        roomTypes: calendar.roomTypes.length,
        ratePlans: calendar.roomTypes.reduce((s, r) => s + (r.ratePlans?.length ?? 0), 0),
      },
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `flowtym_full_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logAudit({ action: 'config_exported', detail: 'Dump JSON complet (config + events + calendar)' });
    notify('Dump JSON complet généré');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result ?? '{}'));
        // Phase 1 : on confirme la structure mais on ne write pas — Phase 2 = vraie import
        const keys = Object.keys(data);
        logAudit({ action: 'module_inspected', detail: `Import JSON simulé : ${keys.length} clés (${keys.slice(0, 5).join(', ')})` });
        notify(`Import simulé Phase 1 — ${keys.length} sections détectées`);
      } catch (err) {
        notify('Fichier JSON invalide');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  const dataSize = JSON.stringify({ cfg: cfg.hotel, events: events.events, calendar: calendar.roomTypes }).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Database}
          category="Sécurité & Administration"
          title="Import / Export"
          description="Migration, sauvegarde manuelle et export comptable."
        />

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SettingsMetric label="Chambres" value={`${cfg.rooms.length}`} caption="Inventaire" />
          <SettingsMetric label="Utilisateurs" value={`${cfg.users.length}`} caption="Comptes" tone="emerald" />
          <SettingsMetric label="Événements" value={`${events.events.length}`} caption="Module Événements" tone="violet" />
          <SettingsMetric label="Taille données" value={`${(dataSize / 1024).toFixed(1)} Ko`} caption="JSON estimé" tone="slate" />
        </div>

        {/* Section Export */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-3">
          <div className="text-[13px] font-semibold text-slate-900 mb-2">Exporter</div>
          <p className="text-[12px] text-slate-500 mb-3">Téléchargez l'état actuel de votre configuration pour sauvegarde ou transfert.</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ExportButton icon={FileText} label="Rapport PDF exécutif" desc="Pour direction" onClick={() => exportAll('pdf')} tone="rose" />
            <ExportButton icon={FileSpreadsheet} label="Excel multi-feuilles" desc="KPIs · Modules · Alertes · Checklist" onClick={() => exportAll('excel')} tone="emerald" />
            <ExportButton icon={FileCode2} label="Diagnostic JSON" desc="Snapshot rapport complet" onClick={() => exportAll('json')} tone="violet" />
            <ExportButton icon={Database} label="Dump complet JSON" desc="Config + events + calendar" onClick={exportFullJSON} tone="sky" />
          </div>
        </section>

        {/* Section Import */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
          <div className="text-[13px] font-semibold text-slate-900 mb-2">Importer</div>
          <p className="text-[12px] text-slate-500 mb-3">Importez une configuration depuis un fichier JSON exporté.</p>
          <div
            onClick={() => fileRef.current?.click()}
            className={`rounded-xl ring-1 ring-dashed ring-slate-300 hover:ring-violet-400 hover:bg-violet-50/30 transition-all px-5 py-8 text-center cursor-pointer ${importing ? 'opacity-60' : ''}`}
          >
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Upload className="w-8 h-8 mx-auto text-violet-500 mb-2" />
            <div className="text-[13px] font-semibold text-slate-900">
              {importing ? 'Analyse en cours…' : 'Cliquer pour sélectionner un fichier JSON'}
            </div>
            <div className="text-[11.5px] text-slate-500 mt-1">Format Flowtym Full Export uniquement</div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 ring-1 ring-amber-100 px-3 py-2 text-[11.5px] text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Phase 1 :</strong> l'import est simulé pour vérifier la structure du fichier. L'écriture réelle dans les stores arrive en Phase 2 avec validation et rollback automatique.</span>
          </div>
        </section>

        <Phase2Notice>
          <strong>Phase 2 :</strong> import différentiel avec validation Zod + rollback transactionnel + journal détaillé.
          Export FEC (Fichier des Écritures Comptables) conforme au PCG français.
        </Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

const ExportButton: React.FC<{ icon: any; label: string; desc: string; onClick: () => void; tone: 'violet' | 'emerald' | 'rose' | 'sky' }> = ({ icon: Icon, label, desc, onClick, tone }) => {
  const colors = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100',
  }[tone];
  return (
    <button onClick={onClick} className={`text-left rounded-xl ring-1 p-3 transition-all ${colors}`}>
      <Icon className="w-5 h-5" />
      <div className="mt-2 text-[12.5px] font-semibold">{label}</div>
      <div className="text-[10.5px] opacity-80 mt-0.5">{desc}</div>
    </button>
  );
};
