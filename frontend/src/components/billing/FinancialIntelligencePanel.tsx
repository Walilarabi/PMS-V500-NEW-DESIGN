/**
 * FLOWTYM — FinancialIntelligencePanel (T15).
 * Résumé · Analyse client · Recommandations contextuelles · Toggle latéral droit
 */
import React, { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb, User, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useBillingStats, useInvoices, useDeposits } from '@/src/domains/billing/hooks';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const fmtPct = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(v);

// ─── Recommendations engine ───────────────────────────────────────────────────

interface Recommendation {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

function buildRecommendations(stats: {
  totalIssued: number;
  totalPaid: number;
  totalBalance: number;
  countDraft: number;
  countIssued: number;
  countPaid: number;
  countOverdue: number;
} | undefined, depositTotal: number): Recommendation[] {
  if (!stats) return [];
  const recs: Recommendation[] = [];

  if (stats.countOverdue > 0) {
    recs.push({
      id: 'overdue',
      icon: <AlertTriangle size={13} className="text-red-500" />,
      title: `${stats.countOverdue} facture(s) en retard`,
      body: `Solde total en souffrance : ${fmtEur(stats.totalBalance)}. Lancez des relances dès aujourd'hui.`,
      priority: 'high',
    });
  }

  if (stats.countDraft > 5) {
    recs.push({
      id: 'drafts',
      icon: <AlertTriangle size={13} className="text-amber-500" />,
      title: `${stats.countDraft} brouillons en attente`,
      body: 'Plusieurs factures ne sont pas encore émises. Pensez à finaliser pour améliorer votre trésorerie.',
      priority: 'medium',
    });
  }

  const collectionRate = stats.totalIssued > 0 ? stats.totalPaid / (stats.totalIssued + stats.totalPaid) : 0;
  if (collectionRate > 0.85) {
    recs.push({
      id: 'collection_good',
      icon: <CheckCircle size={13} className="text-emerald-500" />,
      title: 'Excellent taux de recouvrement',
      body: `${fmtPct(collectionRate)} de vos factures émises sont soldées. Continuez ainsi !`,
      priority: 'low',
    });
  }

  if (depositTotal > 0) {
    recs.push({
      id: 'deposits',
      icon: <Lightbulb size={13} className="text-blue-500" />,
      title: `${fmtEur(depositTotal)} de dépôts capturés`,
      body: 'Des acomptes en attente d\'imputation. Pensez à les appliquer aux factures correspondantes.',
      priority: 'medium',
    });
  }

  if (stats.countIssued > 0 && stats.totalBalance / stats.totalIssued > 0.3) {
    recs.push({
      id: 'high_balance',
      icon: <TrendingDown size={13} className="text-orange-500" />,
      title: 'Solde impayé élevé',
      body: `Plus de 30% des factures émises sont encore impayées (${fmtEur(stats.totalBalance)}). Analysez les délais de paiement.`,
      priority: 'high',
    });
  }

  return recs.slice(0, 5);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface FinancialIntelligencePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FinancialIntelligencePanel({ isOpen, onClose }: FinancialIntelligencePanelProps) {
  const { data: stats, isLoading } = useBillingStats();
  const { data: invoicesData } = useInvoices({ limit: 200 });
  const { data: deposits = [] } = useDeposits({});

  const depositTotal = useMemo(
    () => deposits.filter(d => d.status === 'captured').reduce((s, d) => s + d.amount, 0),
    [deposits],
  );

  const recommendations = useMemo(
    () => buildRecommendations(stats, depositTotal),
    [stats, depositTotal],
  );

  const invoices = invoicesData?.rows ?? [];
  const avgInvoice = invoices.length > 0
    ? invoices.reduce((s, i) => s + i.total_ttc, 0) / invoices.length
    : 0;
  const paidRate = stats && (stats.countPaid + stats.countIssued) > 0
    ? stats.countPaid / (stats.countPaid + stats.countIssued)
    : 0;

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-100 shadow-2xl z-40 flex flex-col transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Intelligence financière</h2>
            <p className="text-[10px] text-gray-400">Analyse en temps réel</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 size={11} /> Résumé
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Facturé (émis)',  value: fmtEur(stats?.totalIssued ?? 0),  icon: <TrendingUp size={12} className="text-amber-500" /> },
                  { label: 'Encaissé',        value: fmtEur(stats?.totalPaid ?? 0),    icon: <TrendingUp size={12} className="text-emerald-500" /> },
                  { label: 'Solde à régler',  value: fmtEur(stats?.totalBalance ?? 0), icon: <TrendingDown size={12} className="text-red-500" /> },
                  { label: 'Panier moyen',    value: fmtEur(avgInvoice),               icon: <BarChart3 size={12} className="text-blue-500" /> },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      {item.icon}
                      {item.label}
                    </div>
                    <span className="text-xs font-bold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User size={11} /> Métriques clés
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-emerald-700">{fmtPct(paidRate)}</p>
                  <p className="text-[10px] text-gray-500">Taux soldé</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">{stats?.countOverdue ?? 0}</p>
                  <p className="text-[10px] text-gray-500">En retard</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{stats?.countDraft ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Brouillons</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-purple-700">{invoices.length}</p>
                  <p className="text-[10px] text-gray-500">Total factures</p>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb size={11} /> Recommandations
                </h3>
                <div className="space-y-3">
                  {recommendations.map(rec => (
                    <div
                      key={rec.id}
                      className={cn('rounded-xl p-3 border', {
                        'bg-red-50 border-red-200':    rec.priority === 'high',
                        'bg-amber-50 border-amber-200': rec.priority === 'medium',
                        'bg-blue-50 border-blue-200':   rec.priority === 'low',
                      })}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {rec.icon}
                        <p className="text-xs font-semibold text-gray-800">{rec.title}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{rec.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
