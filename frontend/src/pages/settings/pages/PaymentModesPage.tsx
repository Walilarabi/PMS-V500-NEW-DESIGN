/**
 * FLOWTYM — Paramètres · Modes de paiement.
 *
 * CRUD des modes de paiement acceptés (CB, espèces, virement, chèque,
 * voucher, lien de paiement…) avec frais, comptes comptables associés
 * et activation par canal de vente.
 *
 * Persistance localStorage (flowtym.payment.modes). Phase 2 = sync
 * vers le moteur d'encaissement + jonction avec la comptabilité.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Plus, Pencil, Trash2, Save, X, CheckCircle2, AlertCircle, Wallet, Banknote,
  Building2, Smartphone, Gift, Link2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const STORAGE_KEY = 'flowtym.payment.modes';

type PaymentKind = 'card' | 'cash' | 'transfer' | 'check' | 'voucher' | 'link' | 'mobile';

interface PaymentMode {
  id: string;
  label: string;
  kind: PaymentKind;
  active: boolean;
  feesPercent: number;        // commission %
  feesFlat: number;           // commission fixe €
  accountingCode: string;     // compte comptable
  channels: ('reception' | 'ota' | 'direct' | 'b2b')[];
  cashDrawer: boolean;        // déclenche tiroir-caisse
  notes?: string;
}

const KIND_LABEL: Record<PaymentKind, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  transfer: 'Virement',
  check: 'Chèque',
  voucher: 'Voucher / bon cadeau',
  link: 'Lien de paiement',
  mobile: 'Paiement mobile',
};

const KIND_ICON: Record<PaymentKind, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  cash: Banknote,
  transfer: Building2,
  check: Wallet,
  voucher: Gift,
  link: Link2,
  mobile: Smartphone,
};

const KIND_TONE: Record<PaymentKind, string> = {
  card: 'bg-violet-50 text-violet-700 ring-violet-200',
  cash: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  transfer: 'bg-sky-50 text-sky-700 ring-sky-200',
  check: 'bg-amber-50 text-amber-700 ring-amber-200',
  voucher: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  link: 'bg-rose-50 text-rose-700 ring-rose-200',
  mobile: 'bg-teal-50 text-teal-700 ring-teal-200',
};

const DEFAULT_MODES: PaymentMode[] = [
  { id: 'pm_cb',    label: 'Carte bancaire',  kind: 'card',     active: true,  feesPercent: 1.5, feesFlat: 0,    accountingCode: '5112000', channels: ['reception', 'direct'], cashDrawer: false },
  { id: 'pm_cash',  label: 'Espèces',         kind: 'cash',     active: true,  feesPercent: 0,   feesFlat: 0,    accountingCode: '5300000', channels: ['reception'],            cashDrawer: true },
  { id: 'pm_wire',  label: 'Virement SEPA',   kind: 'transfer', active: true,  feesPercent: 0,   feesFlat: 0,    accountingCode: '5121000', channels: ['b2b'],                  cashDrawer: false },
  { id: 'pm_check', label: 'Chèque',          kind: 'check',    active: false, feesPercent: 0,   feesFlat: 0,    accountingCode: '5113000', channels: ['reception'],            cashDrawer: false },
  { id: 'pm_link',  label: 'Lien Stripe',     kind: 'link',     active: true,  feesPercent: 1.4, feesFlat: 0.25, accountingCode: '5112000', channels: ['direct', 'b2b'],        cashDrawer: false },
];

function load(): PaymentMode[] {
  if (typeof window === 'undefined') return DEFAULT_MODES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_MODES;
  } catch { return DEFAULT_MODES; }
}
function save(arr: PaymentMode[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

const ALL_CHANNELS: { id: PaymentMode['channels'][0]; label: string }[] = [
  { id: 'reception', label: 'Réception' },
  { id: 'direct',    label: 'Direct (site)' },
  { id: 'ota',       label: 'OTA' },
  { id: 'b2b',       label: 'B2B / Sociétés' },
];

export const PaymentModesPage: React.FC = () => {
  const [modes, setModes] = useState<PaymentMode[]>(() => load());
  const [editing, setEditing] = useState<PaymentMode | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PaymentMode>({
    id: '', label: '', kind: 'card', active: true,
    feesPercent: 0, feesFlat: 0, accountingCode: '', channels: ['reception'], cashDrawer: false,
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { save(modes); }, [modes]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function startAdd() {
    setDraft({
      id: `pm_${Date.now()}`,
      label: '', kind: 'card', active: true,
      feesPercent: 0, feesFlat: 0, accountingCode: '', channels: ['reception'], cashDrawer: false,
    });
    setAdding(true);
    setEditing(null);
  }
  function startEdit(m: PaymentMode) {
    setDraft({ ...m });
    setEditing(m);
    setAdding(false);
  }
  function cancel() {
    setEditing(null);
    setAdding(false);
  }
  function persist() {
    if (!draft.label.trim()) return;
    if (adding) {
      setModes((arr) => [...arr, draft]);
      logAudit({ action: 'module_inspected', module: 'finance_billing', detail: `Mode de paiement "${draft.label}" créé` });
      notify(`Mode "${draft.label}" créé`);
    } else if (editing) {
      setModes((arr) => arr.map((m) => (m.id === editing.id ? draft : m)));
      logAudit({ action: 'module_inspected', module: 'finance_billing', detail: `Mode de paiement "${draft.label}" modifié` });
      notify(`Mode "${draft.label}" modifié`);
    }
    cancel();
  }
  function remove(m: PaymentMode) {
    if (!confirm(`Supprimer le mode "${m.label}" ?`)) return;
    setModes((arr) => arr.filter((x) => x.id !== m.id));
    logAudit({ action: 'module_inspected', module: 'finance_billing', detail: `Mode supprimé : ${m.label}` });
    notify('Mode supprimé');
  }
  function toggleActive(m: PaymentMode) {
    setModes((arr) => arr.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)));
  }
  function toggleChannel(channel: PaymentMode['channels'][0]) {
    setDraft((d) => ({
      ...d,
      channels: d.channels.includes(channel)
        ? d.channels.filter((c) => c !== channel)
        : [...d.channels, channel],
    }));
  }

  const activeCount = modes.filter((m) => m.active).length;
  const totalFees = useMemo(() => {
    const active = modes.filter((m) => m.active);
    if (active.length === 0) return 0;
    return active.reduce((s, m) => s + m.feesPercent, 0) / active.length;
  }, [modes]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Réservations · Finance</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Modes de paiement</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Moyens d'encaissement acceptés, commissions et comptes comptables associés.
              </p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau mode
          </button>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Modes configurés" value={`${modes.length}`} caption={`${activeCount} actif${activeCount > 1 ? 's' : ''}`} tone="violet" />
          <Metric label="Cartes / Liens" value={`${modes.filter((m) => m.kind === 'card' || m.kind === 'link').length}`} caption="Méthodes digitales" tone="emerald" />
          <Metric label="Commission moyenne" value={`${totalFees.toFixed(2)}%`} caption="Sur les modes actifs" tone={totalFees > 2 ? 'attention' : 'slate'} />
          <Metric label="Cash drawer" value={`${modes.filter((m) => m.cashDrawer).length}`} caption="Modes déclenchant le tiroir" tone="slate" />
        </div>

        {/* Tableau */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {modes.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400">
              <CreditCard className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-700">Aucun mode de paiement configuré</div>
              <div className="text-[11.5px] mt-1">Créez votre premier mode pour pouvoir encaisser.</div>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Mode</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Commission</th>
                  <th className="px-3 py-2.5 font-medium">Compte comptable</th>
                  <th className="px-3 py-2.5 font-medium">Canaux</th>
                  <th className="px-3 py-2.5 font-medium text-center">Tiroir</th>
                  <th className="px-3 py-2.5 font-medium text-center w-24">Statut</th>
                  <th className="px-3 py-2.5 font-medium text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modes.map((m) => {
                  const Icon = KIND_ICON[m.kind];
                  return (
                    <tr key={m.id} className={cn('border-t border-slate-100 hover:bg-slate-50/60', !m.active && 'opacity-60')}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-inset', KIND_TONE[m.kind])}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[12.5px] font-semibold text-slate-900">{m.label}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{m.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold', KIND_TONE[m.kind])}>
                          {KIND_LABEL[m.kind]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[12px]">
                        {m.feesPercent === 0 && m.feesFlat === 0 ? (
                          <span className="text-slate-400">Aucune</span>
                        ) : (
                          <span className="text-slate-700">
                            {m.feesPercent > 0 && `${m.feesPercent}%`}
                            {m.feesPercent > 0 && m.feesFlat > 0 && ' + '}
                            {m.feesFlat > 0 && `${m.feesFlat.toFixed(2)}€`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-slate-600">{m.accountingCode || <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {m.channels.length === 0 ? (
                            <span className="text-[11px] text-slate-400">Aucun</span>
                          ) : m.channels.map((c) => (
                            <span key={c} className="text-[10px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {ALL_CHANNELS.find((x) => x.id === c)?.label ?? c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {m.cashDrawer ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <span className="text-slate-300 text-[14px]">·</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleActive(m)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold',
                            m.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200',
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', m.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                          {m.active ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => startEdit(m)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(m)} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Note */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Phase 2 :</strong> intégration réelle Stripe / Adyen / Worldline + sync
            automatique des comptes comptables vers le journal (compte 51xx). Les commissions
            seront déduites automatiquement à l'encaissement.
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>

      {/* Modal édition */}
      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45" onClick={cancel}>
          <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-900">
                {adding ? 'Nouveau mode de paiement' : `Modifier "${editing?.label}"`}
              </h2>
              <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <PField label="Libellé" required>
                <input type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="pmi" />
              </PField>
              <PField label="Type">
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PaymentKind })} className="pmi">
                  {(Object.keys(KIND_LABEL) as PaymentKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </PField>
              <PField label="Commission (%)">
                <input type="number" min={0} step={0.1} value={draft.feesPercent} onChange={(e) => setDraft({ ...draft, feesPercent: parseFloat(e.target.value) || 0 })} className="pmi" />
              </PField>
              <PField label="Commission fixe (€)">
                <input type="number" min={0} step={0.05} value={draft.feesFlat} onChange={(e) => setDraft({ ...draft, feesFlat: parseFloat(e.target.value) || 0 })} className="pmi" />
              </PField>
              <PField label="Compte comptable" className="col-span-2">
                <input type="text" value={draft.accountingCode} onChange={(e) => setDraft({ ...draft, accountingCode: e.target.value })} className="pmi font-mono" placeholder="5112000" />
              </PField>
              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Canaux acceptés</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CHANNELS.map((c) => {
                    const active = draft.channels.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleChannel(c.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[12px] font-medium ring-1',
                          active ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-700 col-span-2">
                <input type="checkbox" checked={draft.cashDrawer} onChange={(e) => setDraft({ ...draft, cashDrawer: e.target.checked })} className="w-4 h-4 accent-violet-600" />
                Déclencher le tiroir-caisse à l'encaissement
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-700 col-span-2">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="w-4 h-4 accent-violet-600" />
                Actif (disponible à l'encaissement)
              </label>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2">
              <button onClick={cancel} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">Annuler</button>
              <button
                onClick={persist}
                disabled={!draft.label.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" /> {adding ? 'Créer' : 'Enregistrer'}
              </button>
            </div>

            <style>{`
              .pmi {
                width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
                background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                outline: none; font-size: 13px;
              }
              .pmi:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'emerald' | 'attention' | 'slate' }> = ({ label, value, caption, tone }) => {
  const color = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    attention: 'text-amber-700',
    slate: 'text-slate-700',
  }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};

const PField: React.FC<{ label: string; required?: boolean; className?: string; children: React.ReactNode }> = ({ label, required, className, children }) => (
  <label className={cn('block', className)}>
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
      {required && <span className="text-rose-500 text-[11px]">*</span>}
    </div>
    {children}
  </label>
);
