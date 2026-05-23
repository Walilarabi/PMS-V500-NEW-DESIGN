/**
 * FLOWTYM — Settings Export Service.
 *
 * Export du rapport de diagnostic (Control Center) en :
 *   • JSON  — structuré, complet, idempotent ;
 *   • Excel — multi-feuilles (KPIs, Modules, Alertes, Checklist, Logs).
 *
 * Les exports embarquent la configuration hôtel + les scores + alertes,
 * pour servir de "snapshot" de l'état du PMS à un instant T (utile pour
 * audit, revue mensuelle, ou transmission au support).
 */

import * as XLSX from 'xlsx';
import type { DiagnosticReport } from '@/src/types/settings/diagnostic';
import {
  MODULE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
} from '@/src/types/settings/diagnostic';
import { useConfigStore } from '@/src/store/configStore';

export function exportConfigJSON(report: DiagnosticReport) {
  const cfg = useConfigStore.getState();
  const payload = {
    generatedAt: report.generatedAt,
    hotel: cfg.hotel,
    taxes: cfg.taxes,
    overallTier: report.overallTier,
    scores: report.scores,
    modules: report.modules,
    alerts: report.alerts,
    checklist: report.checklist,
    guided: report.guided,
    logs: report.logs,
    connectors: report.connectors,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `flowtym_control_center_${stamp()}.json`);
}

export function exportConfigExcel(report: DiagnosticReport) {
  const wb = XLSX.utils.book_new();

  // Feuille KPIs
  const kpisRows = [
    ['Score', 'Valeur', 'Tier'],
    ...Object.values(report.scores).map((s) => [s.label, s.value, TIER_LABEL[s.tier]]),
  ];
  const wsKpi = XLSX.utils.aoa_to_sheet(kpisRows);
  wsKpi['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, 'KPIs');

  // Feuille Modules
  const modulesRows = [
    ['Module', 'Statut', 'Dernière vérification', 'Problèmes détectés'],
    ...report.modules.map((m) => [
      m.name,
      STATUS_LABEL[m.status],
      new Date(m.lastCheckedAt).toLocaleString('fr-FR'),
      m.issues.join(' · '),
    ]),
  ];
  const wsMod = XLSX.utils.aoa_to_sheet(modulesRows);
  wsMod['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsMod, 'Modules');

  // Feuille Alertes
  const alertsRows = [
    ['Sévérité', 'Module', 'Titre', 'Description', 'Action', 'Cible'],
    ...report.alerts.map((a) => [
      SEVERITY_LABEL[a.severity],
      MODULE_LABEL[a.module],
      a.title,
      a.description,
      a.action.label,
      a.action.target,
    ]),
  ];
  const wsAlert = XLSX.utils.aoa_to_sheet(alertsRows);
  wsAlert['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 40 }, { wch: 60 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsAlert, 'Alertes');

  // Feuille Checklist
  const clRows = [
    ['Domaine', 'Tâche', 'Statut', 'Cible', 'Bloquant'],
    ...report.checklist.flatMap((d) =>
      d.tasks.map((t) => [d.label, t.label, t.done ? 'Terminé' : 'À faire', t.target, t.blockedBy ?? '']),
    ),
  ];
  const wsCl = XLSX.utils.aoa_to_sheet(clRows);
  wsCl['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 14 }, { wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsCl, 'Checklist');

  // Feuille Logs
  const logsRows = [
    ['Date', 'Module', 'Niveau', 'Statut', 'Titre', 'Détail'],
    ...report.logs.map((l) => [
      new Date(l.at).toLocaleString('fr-FR'),
      MODULE_LABEL[l.module],
      l.level,
      l.status,
      l.title,
      l.detail ?? '',
    ]),
  ];
  const wsLogs = XLSX.utils.aoa_to_sheet(logsRows);
  wsLogs['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 50 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Logs');

  XLSX.writeFile(wb, `flowtym_control_center_${stamp()}.xlsx`);
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
