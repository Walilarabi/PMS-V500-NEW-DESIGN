/**
 * FLOWTYM — Proforma / Devis
 */

import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Plus, Loader2, ArrowRight } from 'lucide-react';
import { listProformas, type ProformaQuote } from '../../services/finance/finance.service';
import { toast } from '../../hooks/use-toast';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}€`;

const STATUS_CFG: Record<ProformaQuote['status'], { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Brouillon' },
  sent:      { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'Envoyé' },
  accepted:  { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Accepté' },
  converted: { bg: 'bg-violet-100',  text: 'text-violet-800',  label: 'Converti' },
  expired:   { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Expiré' },
  cancelled: { bg: 'bg-red-100',     text: 'text-red-800',     label: 'Annulé' },
};

export const ProformaView: React.FC = () => {
  const [list, setList] = useState<ProformaQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProformas().then(d => { if (!cancelled) { setList(d); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    total: list.length,
    draft: list.filter(p => p.status === 'draft').length,
    sent: list.filter(p => p.status === 'sent').length,
    accepted: list.filter(p => p.status === 'accepted').length,
    converted: list.filter(p => p.status === 'converted').length,
    totalTtc: list.reduce((s, p) => s + Number(p.total_ttc || 0), 0),
  }), [list]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total devis" value={String(stats.total)} tone="violet" />
        <Kpi label="Brouillons" value={String(stats.draft)} tone="gray" />
        <Kpi label="Envoyés" value={String(stats.sent)} tone="blue" />
        <Kpi label="Acceptés" value={String(stats.accepted)} tone="emerald" />
        <Kpi label="Pipeline" value={fmt(stats.totalTtc)} tone="amber" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <FileText className="w-4 h-4 inline mr-1 text-violet-500" />
          Devis & proforma — workflow d'acceptation et conversion en facture
        </div>
        <button
          onClick={() => toast({ title: 'Module en cours de finalisation', description: 'Création de proforma disponible prochainement (vague F1+)', variant: 'default' })}
          className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau devis
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          Chargement…
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-violet-300 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-violet-400 mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun devis encore</h3>
          <p className="text-sm text-gray-500">
            Créez votre premier devis/proforma pour l'envoyer à un client B2B ou un événement.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">N° devis</th>
                <th className="px-3 py-2.5 text-left font-bold">Client / Société</th>
                <th className="px-3 py-2.5 text-left font-bold">Émission</th>
                <th className="px-3 py-2.5 text-left font-bold">Validité</th>
                <th className="px-3 py-2.5 text-right font-bold">Total TTC</th>
                <th className="px-3 py-2.5 text-center font-bold">Statut</th>
                <th className="px-3 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(p => {
                const cfg = STATUS_CFG[p.status];
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs font-bold">{p.quote_number}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{p.guest_name}</div>
                      {p.company_name && <div className="text-[11px] text-gray-500">{p.company_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{new Date(p.issue_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(p.valid_until).toLocaleDateString('fr-FR')}
                      {new Date(p.valid_until) < new Date() && <span className="ml-1 text-red-600 font-bold">expiré</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(p.total_ttc)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.status === 'accepted' && (
                        <button className="text-xs text-violet-700 hover:underline flex items-center gap-1 mx-auto">
                          Convertir en facture
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'blue' | 'emerald' | 'amber' | 'gray' }) {
  const c = {
    violet:  'border-violet-200 bg-violet-50/40 text-violet-700',
    blue:    'border-blue-200 bg-blue-50/40 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    amber:   'border-amber-200 bg-amber-50/40 text-amber-700',
    gray:    'border-gray-200 bg-white text-gray-700',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3', c)}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
