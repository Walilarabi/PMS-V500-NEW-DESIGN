/**
 * FLOWTYM Revenue — Export service
 *
 * Helpers réutilisables pour les exports Excel + PDF des pages Revenue.
 * Aucun couplage UI : les pages passent leurs données, le service gère la
 * sérialisation, l'en-tête, le téléchargement et l'horodatage du fichier.
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';

// ─── HELPERS GÉNÉRIQUES ──────────────────────────────────────────────────────

/**
 * Génère un nom de fichier horodaté: `flowtym-<slug>-<YYYYMMDD-HHMM>.<ext>`.
 */
export function buildExportFileName(slug: string, ext: 'xlsx' | 'pdf'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `flowtym-${slug}-${stamp}.${ext}`;
}

interface ExcelSheet {
  name: string;
  rows: Array<Record<string, unknown>>;
}

/**
 * Écrit un classeur Excel multi-feuilles et déclenche le téléchargement.
 */
export function exportToExcel(sheets: ExcelSheet[], fileName: string): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    // Normalise la largeur des colonnes (auto-fit grossier basé sur le contenu)
    const cols = sheet.rows.length > 0 ? Object.keys(sheet.rows[0]) : [];
    ws['!cols'] = cols.map((key) => {
      const max = Math.max(
        key.length,
        ...sheet.rows.map((r) => String(r[key] ?? '').length)
      );
      return { wch: Math.min(40, Math.max(10, max + 2)) };
    });
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}

interface PDFTableConfig {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: RowInput[];
  fileName: string;
  /** KPI synthétiques affichés en haut du PDF. */
  kpis?: Array<{ label: string; value: string }>;
}

/**
 * Produit un PDF A4 paysage avec en-tête Flowtym, KPIs optionnels et tableau
 * stylé via jsPDF-AutoTable.
 */
export function exportToPDF(config: PDFTableConfig): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 40;
  let y = 40;

  // En-tête
  doc.setFillColor(139, 92, 246); // violet Flowtym
  doc.rect(marginLeft, y, 6, 26, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.title, marginLeft + 14, y + 16);
  y += 30;

  if (config.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(config.subtitle, marginLeft + 14, y);
    y += 14;
  }

  // KPIs en bandeau
  if (config.kpis?.length) {
    y += 6;
    const boxW = (pageWidth - marginLeft * 2 - 12 * (config.kpis.length - 1)) / config.kpis.length;
    config.kpis.forEach((kpi, i) => {
      const x = marginLeft + i * (boxW + 12);
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, boxW, 38, 6, 6, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label.toUpperCase(), x + 10, y + 14);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.text(kpi.value, x + 10, y + 30);
    });
    y += 50;
  }

  // Tableau
  autoTable(doc, {
    startY: y,
    head: [config.columns],
    body: config.rows,
    margin: { left: marginLeft, right: marginLeft },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      // Pied de page
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Flowtym PMS — ${new Date().toLocaleString('fr-FR')}`,
        marginLeft,
        ph - 20
      );
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.text(pageStr, pageWidth - marginLeft - doc.getTextWidth(pageStr), ph - 20);
    },
  });

  doc.save(config.fileName);
}

// ─── EXPORTS MÉTIER ──────────────────────────────────────────────────────────

export interface DistributionExportInput {
  period: string;
  totals: {
    revenue: number;
    netRevenue: number;
    commission: number;
    bookings: number;
    adr: number;
    revpar: number;
  };
  rows: Array<{
    canal: string;
    bookings: number;
    nights: number;
    adr: number;
    revenue: number;
    commissionRate: number;
    commissionCost: number;
    netRevenue: number;
    revpar: number;
    conversion: number;
    cancellation: number;
    score: number;
  }>;
}

export function exportDistributionExcel(input: DistributionExportInput): void {
  const fileName = buildExportFileName('distribution', 'xlsx');
  const sheets: ExcelSheet[] = [
    {
      name: 'Synthèse',
      rows: [
        { Indicateur: 'CA total', Valeur: input.totals.revenue, Unité: '€' },
        { Indicateur: 'CA net', Valeur: input.totals.netRevenue, Unité: '€' },
        { Indicateur: 'Commission', Valeur: input.totals.commission, Unité: '€' },
        { Indicateur: 'Réservations', Valeur: input.totals.bookings, Unité: '—' },
        { Indicateur: 'ADR moyen', Valeur: input.totals.adr, Unité: '€' },
        { Indicateur: 'RevPAR', Valeur: input.totals.revpar, Unité: '€' },
        { Indicateur: 'Période', Valeur: input.period, Unité: '—' },
      ],
    },
    {
      name: 'Performance canaux',
      rows: input.rows.map((r) => ({
        Canal: r.canal,
        Réservations: r.bookings,
        Nuitées: r.nights,
        'ADR (€)': r.adr,
        'CA brut (€)': r.revenue,
        'Commission %': r.commissionRate,
        'Coût commission (€)': r.commissionCost,
        'CA net (€)': r.netRevenue,
        'RevPAR (€)': r.revpar,
        'Conversion %': r.conversion,
        'Annulation %': r.cancellation,
        'Score perf.': r.score,
      })),
    },
  ];
  exportToExcel(sheets, fileName);
}

export function exportDistributionPDF(input: DistributionExportInput): void {
  exportToPDF({
    title: 'Distribution & OTA — Performance canaux',
    subtitle: `Période : ${input.period} · Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    fileName: buildExportFileName('distribution', 'pdf'),
    kpis: [
      { label: 'CA Total', value: formatEUR(input.totals.revenue) },
      { label: 'CA Net', value: formatEUR(input.totals.netRevenue) },
      { label: 'Commission', value: formatEUR(input.totals.commission) },
      { label: 'Réservations', value: String(input.totals.bookings) },
      { label: 'ADR', value: `${input.totals.adr}€` },
      { label: 'RevPAR', value: `${input.totals.revpar}€` },
    ],
    columns: [
      'Canal', 'Résa', 'Nuitées', 'ADR', 'CA brut',
      'Comm %', 'Coût comm.', 'CA net', 'RevPAR', 'Conv %', 'Score',
    ],
    rows: input.rows.map((r) => [
      r.canal,
      r.bookings,
      r.nights,
      `${r.adr}€`,
      formatEUR(r.revenue),
      `${r.commissionRate}%`,
      formatEUR(r.commissionCost),
      formatEUR(r.netRevenue),
      `${r.revpar}€`,
      `${r.conversion.toFixed(1)}%`,
      r.score,
    ]),
  });
}

export interface PromotionsExportInput {
  period: string;
  totals: {
    active: number;
    total: number;
    bookings: number;
    revenue: number;
    avgDiscount: number;
    roi: number;
  };
  rows: Array<{
    status: string;
    name: string;
    description: string;
    type: string;
    discount: string;
    channels: string;
    startDate: string;
    endDate: string;
    bookings: number;
    revenue: number;
    roi: number;
    conversion: number;
  }>;
}

export function exportPromotionsExcel(input: PromotionsExportInput): void {
  const fileName = buildExportFileName('promotions', 'xlsx');
  const sheets: ExcelSheet[] = [
    {
      name: 'Synthèse',
      rows: [
        { Indicateur: 'Promotions actives', Valeur: `${input.totals.active} / ${input.totals.total}` },
        { Indicateur: 'Réservations générées', Valeur: input.totals.bookings },
        { Indicateur: 'Revenu généré (€)', Valeur: input.totals.revenue },
        { Indicateur: 'Réduction moyenne (%)', Valeur: input.totals.avgDiscount.toFixed(1) },
        { Indicateur: 'ROI moyen', Valeur: `${input.totals.roi.toFixed(1)}x` },
        { Indicateur: 'Période', Valeur: input.period },
      ],
    },
    {
      name: 'Détail promotions',
      rows: input.rows.map((r) => ({
        Statut: r.status,
        Nom: r.name,
        Description: r.description,
        Type: r.type,
        Réduction: r.discount,
        Canaux: r.channels,
        Début: r.startDate,
        Fin: r.endDate,
        Réservations: r.bookings,
        'Revenu (€)': r.revenue,
        ROI: `${r.roi.toFixed(1)}x`,
        'Conversion %': r.conversion.toFixed(1),
      })),
    },
  ];
  exportToExcel(sheets, fileName);
}

export function exportPromotionsPDF(input: PromotionsExportInput): void {
  exportToPDF({
    title: 'Promotions — Campagnes et performance',
    subtitle: `Période : ${input.period} · Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    fileName: buildExportFileName('promotions', 'pdf'),
    kpis: [
      { label: 'Actives', value: `${input.totals.active}/${input.totals.total}` },
      { label: 'Réservations', value: String(input.totals.bookings) },
      { label: 'Revenu', value: formatEUR(input.totals.revenue) },
      { label: 'Réduction moy.', value: `${input.totals.avgDiscount.toFixed(1)}%` },
      { label: 'ROI moyen', value: `${input.totals.roi.toFixed(1)}x` },
    ],
    columns: [
      'Statut', 'Nom', 'Type', 'Réduction', 'Canaux',
      'Période', 'Résa', 'Revenu', 'ROI', 'Conv %',
    ],
    rows: input.rows.map((r) => [
      r.status,
      r.name,
      r.type,
      r.discount,
      r.channels,
      `${r.startDate} → ${r.endDate}`,
      r.bookings,
      formatEUR(r.revenue),
      `${r.roi.toFixed(1)}x`,
      `${r.conversion.toFixed(1)}%`,
    ]),
  });
}

// ─── UTILS PRIVÉS ────────────────────────────────────────────────────────────

function formatEUR(value: number): string {
  if (value >= 1000)
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}K€`;
  return `${Math.round(value)}€`;
}
