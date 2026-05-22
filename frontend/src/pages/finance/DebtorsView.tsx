/**
 * FLOWTYM — Débiteurs & Balance âgée
 *
 * Page Impayés avec balance âgée + workflow de relances.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, Mail, Phone, FileText, Loader2, Send, TrendingDown, CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { listDebtors, type DebtorAged } from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}€`;

const BUCKET_LABELS: Record<DebtorAged['aging_bucket'], { label: string; color: string; bg: string }> = {
  paid:            { label: 'Payé',           color: 'text-emerald-700', bg: 'bg-emerald-100' },
  current:         { label: 'À échoir',       color: 'text-blue-700',    bg: 'bg-blue-100' },
  overdue_30:      { label: '0-30j retard',   color: 'text-amber-700',   bg: 'bg-amber-100' },
  overdue_60:      { label: '30-60j',         color: 'text-orange-700',  bg: 'bg-orange-100' },
  overdue_90:      { label: '60-90j',         color: 'text-red-700',     bg: 'bg-red-100' },
  overdue_90_plus: { label: '+90j critique',  color: 'text-red-900',     bg: 'bg-red-200' },
};

export const DebtorsView: React.FC = () => {
  const [debtors, setDebtors] = useState<DebtorAged[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'critical'>('overdue');

  const reload = async () => {
    setLoading(true);
    try { setDebtors(await listDebtors()); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const stats = useMemo(() => {
    const total = debtors.reduce((s, d) => s + Number(d.balance || 0), 0);
    const buckets = {
      current: 0, overdue_30: 0, overdue_60: 0, overdue_90: 0, overdue_90_plus: 0,
    };
    debtors.forEach(d => {
      if (d.aging_bucket in buckets) {
        (buckets as any)[d.aging_bucket] += Number(d.balance || 0);
      }
    });
    return {
      total,
      count: debtors.length,
      critical: debtors.filter(d => d.aging_bucket === 'overdue_90_plus').length,
      buckets,
    };
  }, [debtors]);

  const filtered = useMemo(() => {
    if (filter === 'all') return debtors;
    if (filter === 'overdue') return debtors.filter(d => d.days_overdue > 0);
    return debtors.filter(d => d.aging_bucket === 'overdue_90_plus' || d.aging_bucket === 'overdue_90');
  }, [debtors, filter]);

  const chartData = [
    { name: 'À échoir',  amount: stats.buckets.current, color: '#3B82F6' },
    { name: '0-30j',     amount: stats.buckets.overdue_30, color: '#F59E0B' },
    { name: '30-60j',    amount: stats.buckets.overdue_60, color: '#F97316' },
    { name: '60-90j',    amount: stats.buckets.overdue_90, color: '#EF4444' },
    { name: '+90j',      amount: stats.buckets.overdue_90_plus, color: '#7F1D1D' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Total impayés" value={fmt(stats.total)} icon={AlertTriangle} tone={stats.total > 0 ? 'red' : 'gray'} />
        <KpiBox label="Débiteurs ouverts" value={String(stats.count)} icon={FileText} tone="amber" />
        <KpiBox label="Critique (+90j)" value={String(stats.critical)} icon={TrendingDown} tone="red" />
        <KpiBox label="Échéance ce mois" value={fmt(stats.buckets.current)} icon={Mail} tone="blue" />
      </div>

      {/* Balance âgée */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          Balance âgée — répartition par tranche
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}K€`} width={60} />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => fmt(v)}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
              {chartData.map(d => <Cell key={d.name} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Filtres :</span>
        {(['overdue', 'critical', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded',
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            )}
          >
            {f === 'overdue' ? 'En retard' : f === 'critical' ? 'Critiques (≥60j)' : 'Toutes'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{filtered.length} débiteur{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">Client / Société</th>
                <th className="px-3 py-2.5 text-left font-bold">Référence</th>
                <th className="px-3 py-2.5 text-right font-bold">Montant dû</th>
                <th className="px-3 py-2.5 text-right font-bold">Payé</th>
                <th className="px-3 py-2.5 text-right font-bold">Solde</th>
                <th className="px-3 py-2.5 text-left font-bold">Échéance</th>
                <th className="px-3 py-2.5 text-center font-bold">Tranche</th>
                <th className="px-3 py-2.5 text-center font-bold">Relances</th>
                <th className="px-3 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const bucket = BUCKET_LABELS[d.aging_bucket];
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-900">{d.guest_name}</div>
                      {d.company_name && <div className="text-[11px] text-gray-500">{d.company_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">{d.reference ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.amount_due)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{fmt(d.amount_paid)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-red-700">{fmt(d.balance)}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(d.due_date).toLocaleDateString('fr-FR')}
                      {d.days_overdue > 0 && (
                        <div className="text-[10px] text-red-600 font-bold">+{d.days_overdue}j retard</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', bucket.bg, bucket.color)}>
                        {bucket.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {d.reminder_count > 0 ? (
                        <span className="font-bold text-amber-700">{d.reminder_count}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button title="Envoyer relance email" className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button title="Marquer comme contacté" className="p-1 text-violet-600 hover:bg-violet-50 rounded">
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button title="Voir détails" className="p-1 text-gray-600 hover:bg-gray-50 rounded">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Workflow de relances */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3 text-sm">
        <Send className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-violet-900">
          <strong>Workflow de relances automatiques (à activer)</strong>
          <div className="text-xs text-violet-700 mt-1">
            J+30 : 1ère relance polie · J+60 : 2ème relance ferme · J+90 : mise en demeure formelle.
            La table <code className="bg-white px-1 rounded">dunning_logs</code> est prête côté Supabase pour stocker
            l'historique des envois. L'automatisation BullMQ sera ajoutée en Vague F5.
          </div>
        </div>
      </div>
    </div>
  );
};

function KpiBox({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'red' | 'amber' | 'blue' | 'gray' }) {
  const c = {
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200' },
    gray:  { bg: 'bg-white',    text: 'text-gray-700',  border: 'border-gray-200' },
  }[tone];
  return (
    <div className={cn('rounded-lg border p-4', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{label}</span>
        <Icon className={cn('w-4 h-4', c.text)} />
      </div>
      <div className={cn('text-2xl font-extrabold', c.text)}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-emerald-300 p-12 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-bold text-emerald-800 mt-3">Aucun impayé</h3>
      <p className="text-sm text-gray-600 mt-1">Tous les comptes débiteurs sont à jour.</p>
    </div>
  );
}
