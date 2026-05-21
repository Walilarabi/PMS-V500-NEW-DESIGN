/**
 * FLOWTYM — TVA 2026 (régime encaissements)
 *
 * Page de déclaration TVA mensuelle avec :
 *  - Sélecteur année/mois
 *  - Snapshot verrouillé (DGFiP conforme)
 *  - Encours début/fin, CA débits, base taxable
 *  - Ventilation par taux (10% / 5,5% / 20%)
 *  - Bar chart Recharts
 *  - Tampon fiscal SHA-256
 *  - Export PDF + FEC
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Percent, Lock, Unlock, Download, RefreshCw, AlertCircle, CheckCircle2,
  Loader2, FileText,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  listTvaSnapshots, generateTvaSnapshot, type TvaSnapshot,
} from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmt2 = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const TvaDeclarationView: React.FC = () => {
  const [snapshots, setSnapshots] = useState<TvaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listTvaSnapshots();
      setSnapshots(list);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const current = useMemo(
    () => snapshots.find(s => s.period_year === selectedYear && s.period_month === selectedMonth) ?? null,
    [snapshots, selectedYear, selectedMonth]
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateTvaSnapshot(selectedYear, selectedMonth);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const chartData = current ? [
    { name: '10% (Hébergement)', base: current.base_10, tva: current.tva_10, total: current.base_10 + current.tva_10 },
    { name: '5,5% (Pdéj)', base: current.base_55, tva: current.tva_55, total: current.base_55 + current.tva_55 },
    { name: '20% (Autres)', base: current.base_20, tva: current.tva_20, total: current.base_20 + current.tva_20 },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Toolbar période + actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <Percent className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-bold text-gray-700">Période :</span>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2025, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {current ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded">
            <Lock className="w-3.5 h-3.5" />
            Verrouillé · {current.fiscal_stamp}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded">
            <Unlock className="w-3.5 h-3.5" />
            Pas encore de snapshot
          </span>
        )}

        {!current && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 text-sm font-bold bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Générer & verrouiller
          </button>
        )}

        {current && (
          <>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={() => alert('Export FEC — déjà disponible via Comptabilité (sous-module Audit)')}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1.5 font-bold"
            >
              <Download className="w-4 h-4" />
              Export FEC
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement…
        </div>
      ) : !current ? (
        <EmptyState onGenerate={handleGenerate} generating={generating} />
      ) : (
        <>
          {/* Encours */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EncoursCard label="Encours début" value={current.encours_debut} tone="blue" sub="Clients présents + Débiteurs − Arrhes" />
            <EncoursCard label="Encours fin" value={current.encours_fin} tone="orange" sub={`Variation : ${current.encours_fin - current.encours_debut >= 0 ? '+' : ''}${fmt2(current.encours_fin - current.encours_debut)}`} />
            <EncoursCard label="CA débits (encaissé)" value={current.ca_debits} tone="emerald" sub="Régime encaissements" big />
          </div>

          {/* Tampon fiscal */}
          <div className="bg-slate-900 text-white rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Tampon fiscal DGFiP</div>
              <div className="text-lg font-bold font-mono mt-1">{current.fiscal_stamp}</div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">Hash SHA-256 : {current.payload_hash.slice(0, 32)}…</div>
            </div>
            <Lock className="w-8 h-8 text-emerald-400" />
          </div>

          {/* Détail par taux */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Percent className="w-4 h-4 text-violet-500" />
                Détail par taux de TVA
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                  <th className="px-4 py-2.5 text-left font-bold">Taux</th>
                  <th className="px-4 py-2.5 text-right font-bold">Base taxable</th>
                  <th className="px-4 py-2.5 text-right font-bold">TVA collectée</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <TvaRow label="10% (Hébergement, restauration sur place)" base={current.base_10} tva={current.tva_10} color="text-emerald-700" />
                <TvaRow label="5,5% (Petit-déjeuner emporté, denrées)" base={current.base_55} tva={current.tva_55} color="text-blue-700" />
                <TvaRow label="20% (Bar, boissons alcoolisées, divers)" base={current.base_20} tva={current.tva_20} color="text-orange-700" />
              </tbody>
              <tfoot className="bg-violet-50 border-t-2 border-violet-200">
                <tr className="text-sm font-extrabold">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right text-violet-900 tabular-nums">{fmt2(current.base_10 + current.base_55 + current.base_20)}</td>
                  <td className="px-4 py-3 text-right text-violet-900 tabular-nums">{fmt2(current.total_tva)}</td>
                  <td className="px-4 py-3 text-right text-violet-900 tabular-nums">{fmt2(current.base_10 + current.base_55 + current.base_20 + current.total_tva)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Graphique */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">📊 TVA collectée par taux</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${v}€`} width={70} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt2(v)}
                />
                <Bar dataKey="base" name="Base taxable" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tva" name="TVA" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Notice DGFiP */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-blue-900">
              <strong>Conformité DGFiP 2026</strong> — Ce snapshot est verrouillé et infalsifiable. La signature SHA-256 garantit l'intégrité.
              En cas de contrôle fiscal, ce document peut être présenté tel quel via export FEC ou PDF horodaté.
              Période du <strong>{new Date(current.period_start).toLocaleDateString('fr-FR')}</strong> au <strong>{new Date(current.period_end).toLocaleDateString('fr-FR')}</strong>.
            </div>
          </div>
        </>
      )}

      {/* Historique snapshots */}
      {snapshots.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Historique des snapshots TVA ({snapshots.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-4 py-2 text-left font-bold">Période</th>
                <th className="px-4 py-2 text-right font-bold">CA débits</th>
                <th className="px-4 py-2 text-right font-bold">TVA totale</th>
                <th className="px-4 py-2 text-left font-bold">Tampon</th>
                <th className="px-4 py-2 text-center font-bold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setSelectedYear(s.period_year); setSelectedMonth(s.period_month); }}
                >
                  <td className="px-4 py-2 font-semibold">
                    {new Date(s.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(s.ca_debits)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-orange-700">{fmt(s.total_tva)}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-gray-500">{s.fiscal_stamp}</td>
                  <td className="px-4 py-2 text-center">
                    {s.locked
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded"><Lock className="w-3 h-3" />Verrouillé</span>
                      : <span className="text-[10px] text-gray-500">Brouillon</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-violet-300 p-12 text-center">
      <Percent className="w-12 h-12 mx-auto text-violet-400 mb-3" />
      <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun snapshot pour cette période</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
        Générez un snapshot pour calculer la TVA sur encaissements (régime 2026 DGFiP).
        Le snapshot sera <strong>verrouillé et infalsifiable</strong>, signé SHA-256.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-md hover:bg-violet-700 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        Générer & verrouiller le snapshot
      </button>
    </div>
  );
}

function EncoursCard({ label, value, tone, sub, big }: { label: string; value: number; tone: 'blue' | 'orange' | 'emerald'; sub?: string; big?: boolean }) {
  const c = {
    blue: 'border-blue-200 bg-blue-50/40 text-blue-700',
    orange: 'border-orange-200 bg-orange-50/40 text-orange-700',
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-4', c)}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</div>
      <div className={cn('font-extrabold tabular-nums mt-1', big ? 'text-4xl' : 'text-3xl')}>{fmt2(value)}</div>
      {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function TvaRow({ label, base, tva, color }: { label: string; base: number; tva: number; color: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5">
        <span className={cn('font-semibold', color)}>{label}</span>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmt2(base)}</td>
      <td className={cn('px-4 py-2.5 text-right tabular-nums font-bold', color)}>{fmt2(tva)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmt2(base + tva)}</td>
    </tr>
  );
}
