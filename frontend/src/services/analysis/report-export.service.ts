/**
 * FLOWTYM — Report Export Service
 *
 * Deux exports premium pour tout rapport :
 *   - exportReportToExcel(ctx)  — xlsx multi-feuilles (Synthèse / Données / Insights)
 *   - exportReportToPDF(ctx)    — PDF haute qualité via html2pdf (template HTML stylé)
 *
 * L'export est agnostique du renderer : il introspecte la première ligne pour
 * déduire les colonnes, applique des formatters par convention de nom et
 * récupère les insights via le registry.
 */

import * as XLSX from 'xlsx';
// @ts-expect-error html2pdf.js n'a pas de types officiels
import html2pdf from 'html2pdf.js';
import { computeInsightsFor } from './insights-registry';
import type { ReportDefinition, ReportCategoryConfig } from '../../pages/analysis/reports/registry';
import { REPORT_CATEGORIES } from '../../pages/analysis/reports/registry';
import type { ReportFilters } from '../../pages/analysis/ReportShell';
import type { Insight } from '../../components/analysis/insights/types';

export interface ExportContext {
  report: ReportDefinition;
  filters: ReportFilters;
  rows: Array<Record<string, unknown>>;
  hotelName?: string;
}

// ─── Helpers de formatage ────────────────────────────────────────────────

function fmtDateRangeFR(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `${s} → ${e}`;
}

function humanizeColumn(key: string): string {
  const map: Record<string, string> = {
    date: 'Date',
    canal: 'Canal',
    nuitees: 'Nuitées',
    ca_total: 'CA Total (€)',
    adr: 'ADR (€)',
    part_pct: 'Part (%)',
    reservations: 'Réservations',
    revenue: 'Revenu (€)',
    rooms_sold: 'Chambres vendues',
    rooms_available: 'Capacité',
    occupancy_pct: 'TO (%)',
    revpar: 'RevPAR (€)',
    revpar_n_1: 'RevPAR N-1 (€)',
    revenue_n_1: 'Revenu N-1 (€)',
    room_type: 'Type de chambre',
    capacity: 'Capacité',
    bucket: 'Bucket',
    bucket_order: '#',
    nationalite: 'Nationalité',
    segment: 'Segment',
    payment_method: 'Mode de paiement',
    payment_type: 'Type',
    nb_transactions: 'Transactions',
    montant_total: 'Montant total (€)',
    housekeeping_status: 'Statut ménage',
    occupation_status: 'Occupation',
    nb_chambres: 'Nombre chambres',
    numeros: 'Numéros',
    arrivees: 'Arrivées',
    departs: 'Départs',
    presents: 'Présents',
    occupation_pct: 'Occupation (%)',
  };
  return map[key] ?? key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

function detectColumns(rows: Array<Record<string, unknown>>): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

// ─── Calcul des KPIs synthétiques par rapport ────────────────────────────

interface KpiLine {
  label: string;
  value: string;
}

function computeSyntheticKpis(ctx: ExportContext): KpiLine[] {
  const { rows } = ctx;
  if (rows.length === 0) return [];

  const numericKey = (key: string) => rows.length > 0 && typeof Number(rows[0][key]) === 'number' && !Number.isNaN(Number(rows[0][key]));

  const sumOf = (key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
  const avgOf = (key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0) / rows.length;

  const kpis: KpiLine[] = [];

  if (numericKey('ca_total')) {
    kpis.push({ label: 'CA total période', value: `${Math.round(sumOf('ca_total')).toLocaleString('fr-FR')} €` });
  }
  if (numericKey('revenue')) {
    kpis.push({ label: 'Revenu total', value: `${Math.round(sumOf('revenue')).toLocaleString('fr-FR')} €` });
  }
  if (numericKey('nuitees')) {
    kpis.push({ label: 'Nuitées', value: sumOf('nuitees').toLocaleString('fr-FR') });
  }
  if (numericKey('reservations')) {
    kpis.push({ label: 'Réservations', value: sumOf('reservations').toLocaleString('fr-FR') });
  }
  if (numericKey('rooms_sold')) {
    kpis.push({ label: 'Chambres vendues', value: sumOf('rooms_sold').toLocaleString('fr-FR') });
  }
  if (numericKey('revpar')) {
    kpis.push({ label: 'RevPAR moyen', value: `${Math.round(avgOf('revpar')).toLocaleString('fr-FR')} €` });
  }
  if (numericKey('adr')) {
    kpis.push({ label: 'ADR moyen', value: `${Math.round(avgOf('adr')).toLocaleString('fr-FR')} €` });
  }
  if (numericKey('occupancy_pct')) {
    kpis.push({ label: 'Occupation moyenne', value: `${avgOf('occupancy_pct').toFixed(1)}%` });
  }
  if (numericKey('montant_total')) {
    kpis.push({ label: 'Montant total', value: `${Math.round(sumOf('montant_total')).toLocaleString('fr-FR')} €` });
  }
  if (numericKey('nb_transactions')) {
    kpis.push({ label: 'Transactions', value: sumOf('nb_transactions').toLocaleString('fr-FR') });
  }

  kpis.push({ label: 'Lignes', value: String(rows.length) });

  return kpis;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════════════════════════════

export function exportReportToExcel(ctx: ExportContext): void {
  const { report, filters, rows, hotelName } = ctx;
  const cat = REPORT_CATEGORIES.find(c => c.id === report.category);
  const insights = computeInsightsFor(report.id, rows);
  const kpis = computeSyntheticKpis(ctx);
  const columns = detectColumns(rows);

  const wb = XLSX.utils.book_new();

  // ─── Feuille 1 : Synthèse ──────────────────────────────────────────────
  const synthese: Array<Array<string | number>> = [];
  synthese.push([`Flowtym — ${report.title}`]);
  synthese.push([`${cat?.label ?? ''} · Rapport #${report.id}`]);
  synthese.push([]);
  if (hotelName) synthese.push(['Hôtel', hotelName]);
  synthese.push(['Période', fmtDateRangeFR(filters.startDate, filters.endDate)]);
  synthese.push(['Granularité', filters.granularity === 'day' ? 'Jour' : filters.granularity === 'week' ? 'Semaine' : 'Mois']);
  if (filters.comparison !== 'none') synthese.push(['Comparaison', filters.comparison]);
  synthese.push(['Date d\'export', new Date().toLocaleString('fr-FR')]);
  synthese.push([]);
  synthese.push(['INDICATEURS CLÉS']);
  kpis.forEach(k => synthese.push([k.label, k.value]));

  if (insights.length > 0) {
    synthese.push([]);
    synthese.push(['INSIGHTS ACTIONNABLES']);
    insights.forEach(ins => {
      const sev = ins.severity === 'critical' ? '🚨 CRITIQUE' :
                  ins.severity === 'warning'  ? '⚠️  ATTENTION' :
                  ins.severity === 'positive' ? '✅ POSITIF' :
                  'ℹ️  INFO';
      synthese.push([sev, ins.title]);
      synthese.push(['', ins.message]);
    });
  }

  const wsSynthese = XLSX.utils.aoa_to_sheet(synthese);
  wsSynthese['!cols'] = [{ wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse');

  // ─── Feuille 2 : Données détaillées ────────────────────────────────────
  if (rows.length > 0) {
    const header = columns.map(humanizeColumn);
    const data: Array<Array<unknown>> = [header];
    rows.forEach(r => {
      data.push(columns.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return v.join(', ');
        return v;
      }));
    });
    const wsData = XLSX.utils.aoa_to_sheet(data);
    wsData['!cols'] = columns.map(c => ({ wch: Math.max(humanizeColumn(c).length + 2, 14) }));
    // Freeze pane sur la première ligne
    wsData['!freeze'] = { xSplit: 0, ySplit: 1 };
    // AutoFilter
    const lastCol = XLSX.utils.encode_col(columns.length - 1);
    wsData['!autofilter'] = { ref: `A1:${lastCol}1` };
    XLSX.utils.book_append_sheet(wb, wsData, 'Données');
  }

  // ─── Feuille 3 : Insights détaillés ───────────────────────────────────
  if (insights.length > 0) {
    const insRows: Array<Array<string>> = [
      ['Sévérité', 'Titre', 'Message', 'Action suggérée'],
      ...insights.map(i => [
        i.severity,
        i.title,
        i.message,
        i.action?.label ?? '',
      ]),
    ];
    const wsIns = XLSX.utils.aoa_to_sheet(insRows);
    wsIns['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 80 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsIns, 'Insights');
  }

  const fileName = `flowtym_${report.id}_${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${filters.startDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT PDF
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPdfHtml(ctx: ExportContext, cat: ReportCategoryConfig | undefined, kpis: KpiLine[], insights: Insight[]): string {
  const { report, filters, rows, hotelName } = ctx;
  const columns = detectColumns(rows);

  const sevColor = (s: string) =>
    s === 'critical' ? '#FEE2E2;color:#991B1B' :
    s === 'warning'  ? '#FEF3C7;color:#92400E' :
    s === 'positive' ? '#D1FAE5;color:#065F46' :
                       '#DBEAFE;color:#1E3A8A';

  return `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm 18mm 12mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1F2937; font-size: 11px; line-height: 1.4; }
    .header { border-bottom: 2px solid #8B5CF6; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 18px; font-weight: 800; color: #8B5CF6; letter-spacing: -0.3px; }
    .meta { text-align: right; font-size: 9px; color: #6B7280; }
    .meta strong { color: #1F2937; }
    h1 { font-size: 17px; font-weight: 800; color: #111827; margin: 0 0 4px; }
    .cat { font-size: 10px; font-weight: 700; color: #8B5CF6; text-transform: uppercase; letter-spacing: 0.5px; }
    .desc { font-size: 11px; color: #6B7280; margin-bottom: 14px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 16px; }
    .kpi { border: 1px solid #E5E7EB; background: #F9FAFB; padding: 8px 10px; border-radius: 6px; }
    .kpi-label { font-size: 9px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    .kpi-value { font-size: 15px; font-weight: 800; color: #111827; margin-top: 3px; }
    h2 { font-size: 12px; font-weight: 800; color: #111827; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #E5E7EB; }
    .insight { border-left: 3px solid; padding: 6px 10px; margin-bottom: 6px; border-radius: 4px; }
    .insight-title { font-weight: 700; font-size: 11px; margin-bottom: 2px; }
    .insight-msg { font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; page-break-inside: auto; }
    thead { background: #F3F4F6; }
    th { text-align: left; padding: 6px 8px; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; color: #4B5563; border-bottom: 1px solid #D1D5DB; }
    td { padding: 5px 8px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    tr:nth-child(even) td { background: #FAFAFA; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 12mm; border-top: 1px solid #E5E7EB; font-size: 8px; color: #9CA3AF; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">FLOWTYM PMS</div>
      <div class="cat">${escapeHtml(cat?.label ?? '')} · #${escapeHtml(report.id)}</div>
    </div>
    <div class="meta">
      ${hotelName ? `<strong>${escapeHtml(hotelName)}</strong><br/>` : ''}
      <strong>Période :</strong> ${escapeHtml(fmtDateRangeFR(filters.startDate, filters.endDate))}<br/>
      <strong>Généré :</strong> ${new Date().toLocaleString('fr-FR')}
    </div>
  </div>

  <h1>${escapeHtml(report.title)}</h1>
  <div class="desc">${escapeHtml(report.description)}</div>

  ${kpis.length > 0 ? `
    <h2>Indicateurs clés</h2>
    <div class="kpis">
      ${kpis.map(k => `
        <div class="kpi">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value">${escapeHtml(k.value)}</div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  ${insights.length > 0 ? `
    <h2>Insights actionnables</h2>
    ${insights.map(i => `
      <div class="insight" style="background: ${sevColor(i.severity).split(';')[0]}; border-left-color: ${sevColor(i.severity).split('color:')[1]}; color: ${sevColor(i.severity).split('color:')[1]};">
        <div class="insight-title">${escapeHtml(i.title)}</div>
        <div class="insight-msg">${escapeHtml(i.message)}</div>
      </div>
    `).join('')}
  ` : ''}

  ${rows.length > 0 ? `
    <h2>Détail des données (${rows.length} lignes)</h2>
    <table>
      <thead>
        <tr>${columns.map(c => `<th>${escapeHtml(humanizeColumn(c))}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            ${columns.map(c => {
              const v = r[c];
              const display = Array.isArray(v)
                ? (v as unknown[]).slice(0, 8).join(', ') + ((v as unknown[]).length > 8 ? '…' : '')
                : v;
              return `<td>${escapeHtml(display)}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p style="text-align:center;color:#9CA3AF;margin-top:30px;">Aucune donnée pour cette période.</p>'}

  <div class="footer">
    <span>Flowtym PMS — Rapport confidentiel</span>
    <span>${escapeHtml(report.title)} · ${escapeHtml(report.id)}</span>
  </div>
</body>
</html>`;
}

export function exportReportToPDF(ctx: ExportContext): void {
  const { report } = ctx;
  const cat = REPORT_CATEGORIES.find(c => c.id === report.category);
  const insights = computeInsightsFor(report.id, ctx.rows);
  const kpis = computeSyntheticKpis(ctx);

  // On crée un conteneur off-screen
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.innerHTML = buildPdfHtml(ctx, cat, kpis, insights);
  document.body.appendChild(container);

  const fileName = `flowtym_${report.id}_${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${ctx.filters.startDate}.pdf`;

  const opts = {
    margin:       [10, 10, 14, 10],
    filename:     fileName,
    image:        { type: 'jpeg', quality: 0.92 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'], avoid: 'tr' },
  };

  html2pdf()
    .set(opts)
    .from(container)
    .save()
    .then(() => {
      document.body.removeChild(container);
    })
    .catch((err: unknown) => {
      console.error('[export-pdf] failed:', err);
      document.body.removeChild(container);
    });
}
