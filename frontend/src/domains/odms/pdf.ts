/**
 * FLOWTYM — ODMS dispute evidence PDF generator.
 *
 * Pure client-side PDF using jsPDF + autoTable. Each PDF is FLOWTYM-branded
 * and contains: identification block, financial breakdown, anomaly list,
 * actions / next steps, and an audit footer with timestamp + reference.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { DisputeRow, DraftEmail } from './types';

interface BuildDisputePdfInput {
  hotelName: string;
  partnerName: string | null;
  partnerCode: string | null;
  dispute: DisputeRow;
  email: DraftEmail | null;
}

const fmt = (n: number | null | undefined, currency = 'EUR'): string => {
  if (typeof n !== 'number') return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
};

const VIOLET: [number, number, number] = [124, 58, 237];     // #7C3AED
const GREY900: [number, number, number] = [17, 24, 39];      // #111827
const GREY500: [number, number, number] = [107, 114, 128];   // #6B7280
const ROSE: [number, number, number] = [225, 29, 72];        // #E11D48

export function buildDisputeEvidencePdf(input: BuildDisputePdfInput): jsPDF {
  const { hotelName, partnerName, partnerCode, dispute, email } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  /* ---- Header band ---- */
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, w, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FLOWTYM', 32, 32);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Revenue Integrity Engine — Rapport de litige', 32, 50);
  doc.setFontSize(9);
  doc.text(`Référence : ${dispute.reference}`, w - 32, 32, { align: 'right' });
  doc.text(`Émis : ${new Date().toLocaleString('fr-FR')}`, w - 32, 48, { align: 'right' });

  /* ---- Identification block ---- */
  doc.setTextColor(...GREY900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Identification du litige', 32, 96);

  autoTable(doc, {
    startY: 104,
    margin: { left: 32, right: 32 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 160, textColor: GREY500, fontStyle: 'bold' },
      1: { textColor: GREY900 },
    },
    body: [
      ['Hôtel', hotelName],
      ['Partenaire OTA', `${partnerName ?? '—'} (${partnerCode ?? '—'})`],
      ['Sujet', dispute.subject],
      ['Origine', dispute.origin === 'AUTO' ? 'Automatique (RIE)' : 'Manuelle'],
      ['Statut', dispute.status],
      ['Devise', dispute.currency],
      ['Codes anomalies', (dispute.anomaly_codes ?? []).join(', ') || '—'],
    ],
  });

  /* ---- Financial breakdown ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursorY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GREY900);
  doc.text('Synthèse financière', 32, cursorY);

  autoTable(doc, {
    startY: cursorY + 8,
    margin: { left: 32, right: 32 },
    theme: 'striped',
    headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 6 },
    head: [['Indicateur', 'Montant']],
    body: [
      ['Montant attendu (calcul FLOWTYM)', fmt(dispute.expected_amount, dispute.currency)],
      ['Montant reçu (déclaré OTA)', fmt(dispute.received_amount, dispute.currency)],
      ['Montant réclamé', fmt(dispute.claimed_amount, dispute.currency)],
      ['Écart', fmt(dispute.delta_amount, dispute.currency)],
      ['Montant recouvré', fmt(dispute.recovered_amount, dispute.currency)],
    ],
  });

  /* ---- Email content (if exists) ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 18;
  if (email) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Communication transmise', 32, cursorY);
    cursorY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY500);
    doc.text(`À : ${email.to.join(', ') || '—'}`, 32, cursorY + 6);
    doc.text(`Cc : ${email.cc.join(', ') || '—'}`, 32, cursorY + 18);
    doc.text(`Sujet : ${email.subject}`, 32, cursorY + 30);

    doc.setTextColor(...GREY900);
    doc.setFontSize(9);
    const split = doc.splitTextToSize(email.body_text, w - 64);
    doc.text(split, 32, cursorY + 50);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = cursorY + 50 + split.length * 11;
  }

  /* ---- Description / resolution ---- */
  if (dispute.description || dispute.resolution) {
    if (cursorY > 760) { doc.addPage(); cursorY = 48; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...GREY900);
    doc.text('Notes & résolution', 32, cursorY);
    cursorY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (dispute.description) {
      const split = doc.splitTextToSize(`Description : ${dispute.description}`, w - 64);
      doc.text(split, 32, cursorY);
      cursorY += split.length * 11 + 6;
    }
    if (dispute.resolution) {
      const split = doc.splitTextToSize(`Résolution : ${dispute.resolution}`, w - 64);
      doc.setTextColor(...ROSE);
      doc.text(split, 32, cursorY);
      cursorY += split.length * 11;
    }
  }

  /* ---- Footer ---- */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(229, 231, 235);
    doc.line(32, 800, w - 32, 800);
    doc.setFontSize(8);
    doc.setTextColor(...GREY500);
    doc.text(`FLOWTYM PMS · ${dispute.reference} · ${new Date().toISOString()}`, 32, 814);
    doc.text(`Page ${p}/${pageCount}`, w - 32, 814, { align: 'right' });
  }

  return doc;
}

export function downloadDisputePdf(input: BuildDisputePdfInput): void {
  const doc = buildDisputeEvidencePdf(input);
  doc.save(`${input.dispute.reference}.pdf`);
}

export function disputePdfDataUrl(input: BuildDisputePdfInput): string {
  const doc = buildDisputeEvidencePdf(input);
  return doc.output('datauristring');
}
