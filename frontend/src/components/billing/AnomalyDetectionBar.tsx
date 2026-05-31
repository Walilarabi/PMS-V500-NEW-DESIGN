/**
 * FLOWTYM — AnomalyDetectionBar (T14).
 * Bandeau d'anomalies de facturation sous les KPIs de FacturationView.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { detectAnomalies } from '@/src/engines/billing/anomalyDetectionEngine';
import type { AnomalyDetectionInput, BillingAnomaly, AnomalySeverity } from '@/src/engines/billing/anomalyDetectionEngine';
import { useInvoices, useDeposits } from '@/src/domains/billing/hooks';

const SEVERITY_CFG: Record<AnomalySeverity, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  critical: { icon: <XCircle size={13} />,        color: 'text-red-700',    bg: 'bg-red-50 border-red-300',    label: 'Critique' },
  high:     { icon: <AlertCircle size={13} />,    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Élevée' },
  medium:   { icon: <AlertTriangle size={13} />,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200', label: 'Moyenne' },
  low:      { icon: <Info size={13} />,            color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',  label: 'Faible' },
};

function AnomalyRow({ anomaly }: { key?: React.Key; anomaly: BillingAnomaly }) {
  const cfg = SEVERITY_CFG[anomaly.severity];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5', cfg.bg)}>
      <span className={cn('shrink-0 mt-0.5', cfg.color)}>{cfg.icon}</span>
      <div className="min-w-0">
        <p className={cn('text-xs font-semibold', cfg.color)}>{anomaly.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{anomaly.description}</p>
        {anomaly.suggestedAction && (
          <p className="text-[11px] text-gray-400 italic mt-1">→ {anomaly.suggestedAction}</p>
        )}
      </div>
      <span className={cn('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full self-start mt-0.5', cfg.color, cfg.bg)}>
        {cfg.label}
      </span>
    </div>
  );
}

interface AnomalyDetectionBarProps {
  invoices?: AnomalyDetectionInput['invoices'];
  payments?: AnomalyDetectionInput['payments'];
  lines?: AnomalyDetectionInput['lines'];
  deposits?: AnomalyDetectionInput['deposits'];
}

export function AnomalyDetectionBar({
  invoices: invoicesProp,
  payments: paymentsProp,
  lines: linesProp,
  deposits: depositsProp,
}: AnomalyDetectionBarProps) {
  const [expanded, setExpanded] = useState(false);

  // If no props provided, use the billing hooks to get data
  const { data: invoicesData } = useInvoices({ limit: 200 });
  const { data: depositsData = [] } = useDeposits({});

  const invoices  = invoicesProp ?? (invoicesData?.rows ?? []).map(inv => ({
    id:             inv.id,
    invoice_number: inv.invoice_number,
    status:         inv.status,
    total_ttc:      inv.total_ttc,
    paid_amount:    inv.paid_amount,
    balance:        inv.balance,
    due_date:       inv.due_date,
    issued_at:      inv.issued_at,
    created_at:     inv.created_at,
  }));
  const deposits  = depositsProp ?? depositsData.map(d => ({
    id:             d.id,
    amount:         d.amount,
    status:         d.status,
    reservation_id: d.reservation_id,
  }));

  const anomalies = useMemo(() => detectAnomalies({
    invoices,
    payments:  paymentsProp ?? [],
    lines:     linesProp ?? [],
    deposits,
  }), [invoices, deposits, paymentsProp, linesProp]);

  if (anomalies.length === 0) return null;

  const critical = anomalies.filter(a => a.severity === 'critical').length;
  const high     = anomalies.filter(a => a.severity === 'high').length;
  const medium   = anomalies.filter(a => a.severity === 'medium').length;

  const worstSeverity: AnomalySeverity =
    critical > 0 ? 'critical' : high > 0 ? 'high' : medium > 0 ? 'medium' : 'low';
  const cfg = SEVERITY_CFG[worstSeverity];

  return (
    <div className={cn('mx-6 mt-4 rounded-xl border overflow-hidden', cfg.bg)}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className={cfg.color}>{cfg.icon}</span>
          <span className={cn('text-sm font-semibold', cfg.color)}>
            {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} détectée{anomalies.length > 1 ? 's' : ''}
          </span>
          <div className="flex gap-1.5">
            {critical > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                {critical} critique{critical > 1 ? 's' : ''}
              </span>
            )}
            {high > 0 && (
              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                {high} élevée{high > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <span className={cfg.color}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-current/10">
          {anomalies.map(a => <AnomalyRow key={a.id} anomaly={a} />)}
        </div>
      )}
    </div>
  );
}
