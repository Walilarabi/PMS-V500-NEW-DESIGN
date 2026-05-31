/**
 * FLOWTYM — PreBillingControlPanel (T13).
 * 8 contrôles pré-émission avec rapport visuel. Remplace le bouton "Émettre" direct.
 */
import React, { useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { runPreBillingChecks } from '@/src/engines/billing/preBillingEngine';
import type { PreBillingInput, PreBillingCheck } from '@/src/engines/billing/preBillingEngine';
import type { InvoiceRow } from '@/src/domains/billing/schemas';
import type { FolioRow, InvoiceLineRow, PaymentRow } from '@/src/domains/billing/schemas';

interface PreBillingControlPanelProps {
  invoice:    InvoiceRow;
  folios:     FolioRow[];
  lines:      InvoiceLineRow[];
  payments:   PaymentRow[];
  reservation?: {
    check_in: string;
    check_out: string;
    status: string;
  } | null;
  onIssue: () => void;
  isIssuing: boolean;
  onCancel: () => void;
}

const SEVERITY_CFG = {
  error:   { icon: <XCircle size={14} />,       color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  warning: { icon: <AlertTriangle size={14} />, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  info:    { icon: <Info size={14} />,           color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
};

function CheckRow({ check }: { key?: React.Key; check: PreBillingCheck }) {
  const cfg = SEVERITY_CFG[check.severity];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5', check.passed ? 'bg-emerald-50 border-emerald-200' : cfg.bg)}>
      <span className={cn('mt-0.5 shrink-0', check.passed ? 'text-emerald-600' : cfg.color)}>
        {check.passed ? <CheckCircle size={14} /> : cfg.icon}
      </span>
      <div>
        <p className={cn('text-xs font-semibold', check.passed ? 'text-emerald-700' : cfg.color)}>
          {check.label}
        </p>
        {!check.passed && check.message && (
          <p className="text-[11px] text-gray-500 mt-0.5">{check.message}</p>
        )}
      </div>
    </div>
  );
}

export function PreBillingControlPanel({
  invoice,
  folios,
  lines,
  payments,
  reservation,
  onIssue,
  isIssuing,
  onCancel,
}: PreBillingControlPanelProps) {
  const input: PreBillingInput = useMemo(() => ({
    invoice: {
      id:              invoice.id,
      status:          invoice.status,
      total_ht:        invoice.total_ht,
      total_tva:       invoice.total_tva,
      total_ttc:       invoice.total_ttc,
      paid_amount:     invoice.paid_amount,
      balance:         invoice.balance,
      bill_to_name:    invoice.bill_to_name,
      bill_to_address: invoice.bill_to_address,
      due_date:        invoice.due_date,
      reservation_id:  invoice.reservation_id,
      guest_id:        invoice.guest_id,
    },
    lines: lines.map(l => ({
      id:            l.id,
      description:   l.description,
      quantity:      l.quantity,
      unit_price_ht: l.unit_price_ht,
      tva_rate:      l.tva_rate,
      total_ht:      l.total_ht ?? null,
      total_ttc:     l.total_ttc ?? null,
      service_date:  l.service_date,
    })),
    folios,
    payments: payments.map(p => ({ id: p.id, amount: p.amount, status: p.status })),
    reservation: reservation ?? null,
  }), [invoice, folios, lines, payments, reservation]);

  const report = useMemo(() => runPreBillingChecks(input), [input]);

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Contrôle pré-émission</h3>
          <p className="text-xs text-gray-400">{report.errorCount} erreur(s) · {report.warningCount} avertissement(s)</p>
        </div>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {report.checks.map(check => <CheckRow key={check.id} check={check} />)}
      </div>

      {/* Summary banner */}
      {report.canIssue ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Tous les contrôles obligatoires sont validés.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <XCircle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {report.errorCount} erreur(s) bloquante(s) à corriger avant émission.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isIssuing} className="flex-1">
          Annuler
        </Button>
        <Button
          onClick={onIssue}
          disabled={!report.canIssue || isIssuing}
          className={cn(
            'flex-1 font-bold gap-2',
            report.canIssue
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
              : 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500',
          )}
        >
          {isIssuing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <CheckCircle size={13} />
          )}
          Émettre la facture
        </Button>
      </div>
    </div>
  );
}
