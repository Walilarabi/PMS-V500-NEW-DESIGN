/**
 * FLOWTYM — Caisse / Petite caisse
 *
 * Page de gestion de caisse : comptage, mouvements, variance.
 * Lit cash_register + cash_counts (tables existantes Supabase).
 */

import React, { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmt = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

interface CashMovement {
  id: string;
  hotel_id: string;
  date: string;
  amount: number;
  movement_type: string;
  description: string | null;
  user_id: string | null;
}

export const CashRegisterView: React.FC = () => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from('cash_register').select('*').order('date', { ascending: false }).limit(100)
      .then(({ data }) => {
        if (!cancelled) {
          setMovements((data ?? []) as CashMovement[]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const total = movements.reduce((s, m) => {
    const v = Number(m.amount || 0);
    return m.movement_type === 'out' ? s - v : s + v;
  }, 0);

  const todayMoves = movements.filter(m => m.date?.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Solde caisse" value={fmt(total)} icon={Wallet} tone="violet" />
        <Kpi label="Entrées du jour" value={fmt(todayMoves.filter(m => m.movement_type !== 'out').reduce((s, m) => s + Number(m.amount || 0), 0))} icon={TrendingUp} tone="emerald" />
        <Kpi label="Sorties du jour" value={fmt(todayMoves.filter(m => m.movement_type === 'out').reduce((s, m) => s + Number(m.amount || 0), 0))} icon={TrendingDown} tone="red" />
        <Kpi label="Mouvements 100 derniers" value={String(movements.length)} icon={Wallet} tone="gray" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <Wallet className="w-4 h-4 inline mr-1 text-violet-500" />
          Caisse principale + petite caisse
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            Entrée
          </button>
          <button className="px-3 py-1.5 text-xs font-bold border border-red-300 bg-red-50 text-red-700 rounded hover:bg-red-100 flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            Sortie
          </button>
          <button className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1.5">
            📊 Comptage
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          Chargement…
        </div>
      ) : movements.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-violet-300 p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto text-violet-400 mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun mouvement de caisse</h3>
          <p className="text-sm text-gray-500">Enregistrez le premier mouvement (entrée/sortie/dépense).</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">Date</th>
                <th className="px-3 py-2.5 text-left font-bold">Type</th>
                <th className="px-3 py-2.5 text-left font-bold">Description</th>
                <th className="px-3 py-2.5 text-right font-bold">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map(m => {
                const isOut = m.movement_type === 'out';
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs">{new Date(m.date).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold',
                        isOut ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                        {isOut ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {isOut ? 'Sortie' : 'Entrée'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{m.description ?? '—'}</td>
                    <td className={cn('px-3 py-2 text-right font-bold tabular-nums', isOut ? 'text-red-700' : 'text-emerald-700')}>
                      {isOut ? '−' : '+'}{fmt(Number(m.amount || 0))}
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

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'violet' | 'emerald' | 'red' | 'gray' }) {
  const c = {
    violet:  'border-violet-200 bg-violet-50/40 text-violet-700',
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    red:     'border-red-200 bg-red-50/40 text-red-700',
    gray:    'border-gray-200 bg-white text-gray-700',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-4', c)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{label}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
