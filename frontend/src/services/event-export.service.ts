/**
 * FLOWTYM RMS — Export Excel / PDF des événements marché.
 *
 * Fournit deux exports premium pour le module Événements :
 *
 *   • exportEventsToExcel(events, opts)
 *       - une feuille principale avec toutes les colonnes métier
 *       - filtres Excel (AutoFilter) appliqués
 *       - largeurs de colonnes calculées automatiquement
 *       - cellules d'impact mises en couleur via formatage conditionnel
 *
 *   • exportEventsToPDF(events, opts)
 *       - en-tête avec logo "Flowtym RMS", date d'export, hôtel, ville
 *       - bloc KPIs (événements, critiques, ADR estimé, RevPAR estimé)
 *       - tableau premium (jspdf-autotable) coloré par niveau d'impact
 *       - pagination automatique, footer pagination
 *
 * Ces deux exports s'appliquent indifféremment :
 *   - à la liste complète,
 *   - aux résultats filtrés,
 *   - aux résultats d'une recherche moteur.
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RMSMarketEvent } from '../types/events';
import { CATEGORY_LABELS, IMPACT_LABELS } from '../types/events';
import { aggregateImpact, daysBetween } from './event-impact.engine';

export interface ExportContext {
  hotelName?: string;
  city?: string;
  fileBaseName?: string;
  kpis?: {
    upcoming: number;
    critical: number;
    influencedAdrPct: number;
    influencedRevparPct: number;
  };
}

const IMPACT_COLORS = {
  critical: { hex: 'FECDD3', text: '9F1239' },  // rose
  high:     { hex: 'FED7AA', text: '9A3412' },  // orange
  medium:   { hex: 'FDE68A', text: '92400E' },  // amber
  low:      { hex: 'D1FAE5', text: '065F46' },  // emerald
  very_low: { hex: 'E2E8F0', text: '475569' },  // slate
} as const;

// ─── XLSX ─────────────────────────────────────────────────────────────────

export function exportEventsToExcel(events: RMSMarketEvent[], ctx: ExportContext = {}) {
  const headers = [
    'Nom événement', 'Catégorie', 'Ville', 'Lieu',
    'Date début', 'Date fin', 'Durée (j)',
    'Niveau impact', 'Pression marché',
    'ADR impacté (%)', 'TO impacté (%)', 'Influence prix (%)',
    'Source', 'Statut', 'Hôtels concernés',
  ];

  const rows: (string | number)[][] = events.map((e) => [
    e.name,
    CATEGORY_LABELS[e.category],
    e.city,
    e.venue || e.zone || '',
    e.startDate,
    e.endDate,
    daysBetween(e.startDate, e.endDate),
    IMPACT_LABELS[e.impact.level],
    Math.round(aggregateImpact(e.impact)),
    e.impact.adr,
    e.impact.occupancy,
    e.influencePrice,
    e.primarySource,
    e.status,
    (e.attachedHotels ?? []).join(', ') || 'Tous',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Largeurs auto (cap 60)
  const colWidths = headers.map((h, ci) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[ci] ?? '').length),
    );
    return { wch: Math.min(60, maxLen + 2) };
  });
  ws['!cols'] = colWidths;

  // AutoFilter
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };

  // En-tête en gras + fond violet
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    (ws[cellRef] as XLSX.CellObject).s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '7C3AED' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    } as unknown as XLSX.CellObject['s'];
  }

  // Couleur d'impact sur la colonne "Niveau impact" (index 7)
  events.forEach((e, i) => {
    const ref = XLSX.utils.encode_cell({ r: i + 1, c: 7 });
    if (!ws[ref]) return;
    const c = IMPACT_COLORS[e.impact.level];
    (ws[ref] as XLSX.CellObject).s = {
      fill: { patternType: 'solid', fgColor: { rgb: c.hex } },
      font: { color: { rgb: c.text }, bold: true },
      alignment: { horizontal: 'center' },
    } as unknown as XLSX.CellObject['s'];
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Événements');

  // Feuille KPIs si fournis
  if (ctx.kpis) {
    const kpiRows = [
      ['Indicateur', 'Valeur'],
      ['Événements à venir', ctx.kpis.upcoming],
      ['Événements critiques / forts', ctx.kpis.critical],
      ['ADR impacté (moyenne pondérée)', `+${ctx.kpis.influencedAdrPct}%`],
      ['RevPAR / TO impacté', `+${ctx.kpis.influencedRevparPct} pts`],
    ];
    const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows);
    wsKpi['!cols'] = [{ wch: 38 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, 'KPIs');
  }

  const fname = `${ctx.fileBaseName ?? 'flowtym_evenements'}_${todayStamp()}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ─── PDF ──────────────────────────────────────────────────────────────────

export function exportEventsToPDF(events: RMSMarketEvent[], ctx: ExportContext = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header — bandeau violet
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Flowtym RMS', 32, 32);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Centre intelligent des événements marché', 32, 50);

  // Bloc droit : date + hôtel
  const right = pageWidth - 32;
  doc.setFontSize(9);
  const generatedAt = new Date().toLocaleString('fr-FR');
  doc.text(`Exporté le ${generatedAt}`, right, 28, { align: 'right' });
  if (ctx.hotelName) doc.text(ctx.hotelName, right, 42, { align: 'right' });
  if (ctx.city) doc.text(`Ville : ${ctx.city}`, right, 56, { align: 'right' });

  // KPIs
  doc.setTextColor(15, 23, 42);
  let cursorY = 95;
  if (ctx.kpis) {
    const tiles: Array<[string, string]> = [
      ['Événements à venir', String(ctx.kpis.upcoming)],
      ['Impact fort / critique', String(ctx.kpis.critical)],
      ['ADR impacté (moy.)', `+${ctx.kpis.influencedAdrPct}%`],
      ['RevPAR impacté (moy.)', `+${ctx.kpis.influencedRevparPct} pts`],
    ];
    const tileW = (pageWidth - 64 - 18) / tiles.length;
    tiles.forEach(([label, value], i) => {
      const x = 32 + i * (tileW + 6);
      doc.setFillColor(245, 243, 255);
      doc.setDrawColor(221, 214, 254);
      doc.roundedRect(x, cursorY, tileW, 50, 6, 6, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x + 10, cursorY + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(76, 29, 149);
      doc.text(value, x + 10, cursorY + 36);
    });
    cursorY += 65;
  }

  // Table principale
  const head = [[
    'Nom', 'Catégorie', 'Ville / Lieu', 'Dates', 'Durée',
    'Impact', 'Pression', 'ADR', 'TO', 'Prix', 'Source',
  ]];
  const body = events.map((e) => [
    e.name,
    CATEGORY_LABELS[e.category],
    [e.city, e.venue || e.zone].filter(Boolean).join(' — '),
    `${formatFr(e.startDate)} → ${formatFr(e.endDate)}`,
    `${daysBetween(e.startDate, e.endDate)} j`,
    IMPACT_LABELS[e.impact.level],
    `${Math.round(aggregateImpact(e.impact))}%`,
    `+${e.impact.adr}%`,
    `+${e.impact.occupancy}%`,
    `+${e.influencePrice}%`,
    e.primarySource,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.4 },
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right', textColor: [124, 58, 237], fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 5) return;
      const ev = events[data.row.index];
      if (!ev) return;
      const c = IMPACT_COLORS[ev.impact.level];
      data.cell.styles.fillColor = hexToRgb(c.hex);
      data.cell.styles.textColor = hexToRgb(c.text);
      data.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: (data) => {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Flowtym RMS · Document confidentiel · Page ${data.pageNumber} / ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 14,
        { align: 'center' },
      );
    },
  });

  // Résumé marché en bas de la dernière page
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
  if (lastY + 90 < doc.internal.pageSize.getHeight()) {
    const summary = buildSummary(events);
    doc.setFillColor(247, 245, 255);
    doc.setDrawColor(221, 214, 254);
    doc.roundedRect(32, lastY + 16, pageWidth - 64, 70, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(76, 29, 149);
    doc.text('Résumé marché', 44, lastY + 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(summary, 44, lastY + 54, { maxWidth: pageWidth - 88 });
  }

  const fname = `${ctx.fileBaseName ?? 'flowtym_evenements'}_${todayStamp()}.pdf`;
  doc.save(fname);
}

// ─── helpers ──────────────────────────────────────────────────────────────

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatFr(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function hexToRgb(hex: string): [number, number, number] {
  const x = parseInt(hex, 16);
  return [(x >> 16) & 255, (x >> 8) & 255, x & 255];
}

function buildSummary(events: RMSMarketEvent[]): string {
  if (events.length === 0) return 'Aucun événement détecté sur la période sélectionnée.';
  const critical = events.filter((e) => e.impact.level === 'critical').length;
  const high = events.filter((e) => e.impact.level === 'high').length;
  const top = [...events].sort((a, b) => aggregateImpact(b.impact) - aggregateImpact(a.impact)).slice(0, 3);
  const parts = [
    `${events.length} événement${events.length > 1 ? 's' : ''} sur la période exportée.`,
    critical > 0 ? `${critical} critique${critical > 1 ? 's' : ''}` : null,
    high > 0 ? `${high} fort${high > 1 ? 's' : ''}` : null,
  ].filter(Boolean) as string[];
  const head = parts.join(' · ');
  const topStr = top.length
    ? ` Top impacts : ${top.map((e) => `${e.name} (${IMPACT_LABELS[e.impact.level]})`).join(', ')}.`
    : '';
  return head + topStr;
}
