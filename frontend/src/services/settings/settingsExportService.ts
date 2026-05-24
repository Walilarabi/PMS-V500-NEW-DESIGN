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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    ...(Object.values(report.scores) as DiagnosticReport['scores'][keyof DiagnosticReport['scores']][])
      .map((s) => [s.label, s.value, TIER_LABEL[s.tier]] as (string | number)[]),
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

/**
 * Export PDF — rapport exécutif premium pour réunion de direction.
 * Bandeau Flowtym, date, hôtel, scores en cartes, top alertes critiques,
 * statut des modules, progression configuration. Mise en page A4 paysage
 * pour 1-2 pages selon le volume.
 */
export function exportConfigPDF(report: DiagnosticReport) {
  const cfg = useConfigStore.getState();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Bandeau header violet
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Flowtym — Control Center', 32, 32);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rapport de diagnostic PMS · ${cfg.hotel.name || 'Établissement'}`, 32, 50);

  doc.setFontSize(9);
  doc.text(`Exporté le ${new Date(report.generatedAt).toLocaleString('fr-FR')}`, pageWidth - 32, 28, { align: 'right' });
  doc.text(`Santé système : ${TIER_LABEL[report.overallTier]} (${report.scores.system_health.value}/100)`, pageWidth - 32, 44, { align: 'right' });
  doc.text(`${report.alerts.length} alerte(s) ouverte(s)`, pageWidth - 32, 58, { align: 'right' });

  let y = 95;
  doc.setTextColor(15, 23, 42);

  // Bloc 5 cartes scores
  const scores = [
    { id: 'system_health', label: 'Santé système' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'compliance', label: 'Conformité' },
    { id: 'security', label: 'Sécurité' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'revenue', label: 'Revenue' },
  ] as const;
  const tileW = (pageWidth - 64 - (scores.length - 1) * 8) / scores.length;
  scores.forEach((s, i) => {
    const sc = report.scores[s.id];
    const x = 32 + i * (tileW + 8);
    doc.setFillColor(245, 243, 255);
    doc.setDrawColor(221, 214, 254);
    doc.roundedRect(x, y, tileW, 56, 6, 6, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, x + 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(76, 29, 149);
    doc.text(`${sc.value}/100`, x + 10, y + 38);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(TIER_LABEL[sc.tier], x + 10, y + 50);
  });
  y += 75;

  // Modules
  autoTable(doc, {
    startY: y,
    head: [['Module', 'Statut', 'Problèmes détectés']],
    body: report.modules.map((m) => [m.name, STATUS_LABEL[m.status], m.issues.join(' · ') || 'Aucun']),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.4 },
    headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center', cellWidth: 110 } },
    margin: { left: 32, right: 32 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // Alertes (top 8)
  const topAlerts = report.alerts.slice(0, 8);
  if (topAlerts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Sévérité', 'Module', 'Alerte', 'Action recommandée']],
      body: topAlerts.map((a) => [
        SEVERITY_LABEL[a.severity],
        MODULE_LABEL[a.module],
        a.title,
        `${a.action.label} → ${a.action.target}`,
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.4 },
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 110 },
        3: { textColor: [124, 58, 237], cellWidth: 130 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        const sev = topAlerts[data.row.index]?.severity;
        const colors: Record<string, [number, number, number]> = {
          critical: [254, 205, 211],
          high: [254, 215, 170],
          medium: [253, 230, 138],
          low: [186, 230, 253],
          info: [226, 232, 240],
        };
        if (sev && colors[sev]) data.cell.styles.fillColor = colors[sev];
      },
      margin: { left: 32, right: 32 },
    });
  }

  // Footer pagination
  const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Flowtym RMS · Control Center · Page ${i} / ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 14,
      { align: 'center' },
    );
  }

  doc.save(`flowtym_control_center_${stamp()}.pdf`);
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
