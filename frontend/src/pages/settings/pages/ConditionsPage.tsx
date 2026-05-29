/**
 * FLOWTYM — Paramètres · Conditions d'annulation.
 *
 * Gestion réelle (Supabase, RLS hotel_id) des politiques d'annulation avec
 * base de calcul de la pénalité. Création / modification / liste + résumé
 * lisible. Aucune donnée fake, aucun localStorage métier.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, X, Loader2, Save, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import {
  listPolicies, upsertPolicy, deletePolicy, formatPolicySummary,
  PENALTY_BASE_LABELS, type CancellationPolicy, type PenaltyType, type PenaltyBase,
} from '@/src/services/settings/cancellation.service';

function toast(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

const BASE_OPTIONS: PenaltyBase[] = ['first_night', 'total_stay', 'cancelled_amount', 'remaining_due', 'paid_amount', 'fixed_amount'];

type FormState = Omit<CancellationPolicy, 'id' | 'hotel_id'> & { id?: string };
const blank: FormState = {
  name: '', code: '', free_until_hours: 24, penalty_type: 'percentage',
  penalty_value: 100, penalty_base: 'first_night', currency: 'EUR',
  applies_from: null, applies_until: null, is_active: true,
};

export const ConditionsPage: React.FC = () => {
  const { canRead, canWrite, DeniedBanner } = usePagePermission('rev_pricing');
  const [rows, setRows] = useState<CancellationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);

  const refresh = useCallback(async () => { setLoading(true); setRows(await listPolicies()); setLoading(false); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.code ?? ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  if (!canRead) return <DeniedBanner />;

  const del = async (r: CancellationPolicy) => {
    if (!window.confirm(`Supprimer la condition "${r.name}" ?`)) return;
    const { error } = await deletePolicy(r.id);
    if (error) toast(error, 'error'); else { toast('Condition supprimée'); void refresh(); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Tarifs &amp; Prestations</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Conditions d'annulation</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">Pénalité, base de calcul et fenêtre de gratuité par condition.</p>
            </div>
          </div>
          <button onClick={() => canWrite && setEditing({ ...blank })} disabled={!canWrite}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Nouvelle condition
          </button>
        </header>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none" />
            </div>
          </div>
          {loading ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              {rows.length === 0 ? 'Aucune condition. Créez-en une.' : 'Aucun résultat.'}
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold">Condition</th>
                  <th className="text-left px-3 py-2 font-semibold">Code</th>
                  <th className="text-left px-3 py-2 font-semibold">Gratuité</th>
                  <th className="text-left px-3 py-2 font-semibold">Pénalité</th>
                  <th className="text-center px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">{r.code ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.free_until_hours > 0 ? `J-${Math.floor(r.free_until_hours / 24)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{formatPolicySummary(r)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10.5px] font-semibold', r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{r.is_active ? 'Actif' : 'Inactif'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {canWrite && <>
                        <button onClick={() => setEditing({ ...r })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(r)} className="p-1.5 rounded hover:bg-rose-50 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {editing && <PolicyModal form={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
    </div>
  );
};

const PolicyModal: React.FC<{ form: FormState; onClose: () => void; onSaved: () => void }> = ({ form: initial, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const isFixed = form.penalty_type === 'fixed_amount';

  const summary = formatPolicySummary(form);

  const save = async () => {
    if (!form.name.trim()) { toast('Le nom est requis', 'error'); return; }
    setSaving(true);
    const { error } = await upsertPolicy({ ...form, name: form.name.trim() });
    setSaving(false);
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    toast('Condition enregistrée'); onSaved();
  };

  const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none';
  const lbl = 'text-[11px] uppercase tracking-wide font-semibold text-slate-500';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-900">{form.id ? 'Modifier la condition' : 'Nouvelle condition'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>Nom *</span><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></label>
            <label className="block"><span className={lbl}>Code</span><input value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls} /></label>
          </div>

          <label className="block"><span className={lbl}>Gratuité jusqu'à (heures avant arrivée)</span>
            <input type="number" min={0} value={form.free_until_hours} onChange={(e) => setForm((f) => ({ ...f, free_until_hours: parseInt(e.target.value) || 0 }))} className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>Type de pénalité</span>
              <select value={form.penalty_type} onChange={(e) => setForm((f) => ({ ...f, penalty_type: e.target.value as PenaltyType }))} className={inputCls}>
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed_amount">Montant fixe</option>
              </select>
            </label>
            <label className="block"><span className={lbl}>Valeur {isFixed ? `(${form.currency})` : '(%)'}</span>
              <input type="number" min={0} value={form.penalty_value} onChange={(e) => setForm((f) => ({ ...f, penalty_value: parseFloat(e.target.value) || 0 }))} className={inputCls} />
            </label>
          </div>

          {/* Base de calcul — obligatoire en pourcentage, masquée en montant fixe */}
          {!isFixed && (
            <label className="block"><span className={lbl}>Base de calcul *</span>
              <select value={form.penalty_base} onChange={(e) => setForm((f) => ({ ...f, penalty_base: e.target.value as PenaltyBase }))} className={inputCls}>
                {BASE_OPTIONS.filter((b) => b !== 'fixed_amount').map((b) => (
                  <option key={b} value={b}>{PENALTY_BASE_LABELS[b]}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className={lbl}>Devise</span><input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputCls} /></label>
            <label className="block"><span className={lbl}>Applicable du</span><input type="date" value={form.applies_from ?? ''} onChange={(e) => setForm((f) => ({ ...f, applies_from: e.target.value || null }))} className={inputCls} /></label>
            <label className="block"><span className={lbl}>au</span><input type="date" value={form.applies_until ?? ''} onChange={(e) => setForm((f) => ({ ...f, applies_until: e.target.value || null }))} className={inputCls} /></label>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Condition active
          </label>

          <div className="rounded-xl bg-violet-50/60 ring-1 ring-violet-100 px-4 py-3 text-[13px] text-violet-800">
            <span className="font-semibold">Résumé : </span>{summary}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
