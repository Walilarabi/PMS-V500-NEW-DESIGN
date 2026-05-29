/**
 * FLOWTYM — Paramètres · Partenaires de distribution.
 *
 * Liste des partenaires + fiche complète (drawer) avec 5 sections :
 * Général · Mapping chambres · Mapping plans · Commissions · Promotions.
 * Tout est persisté en Supabase (RLS hotel_id), aucune donnée fake.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Network, Plus, X, Pencil, Trash2, Search, Loader2, Percent, Tag, Bed, Grid, Gift, Save,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import * as svc from '@/src/services/settings/partners.service';

const PARTNER_TYPES: svc.PartnerType[] = ['OTA', 'direct', 'corporate', 'wholesaler', 'GDS', 'other'];

function toast(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export const PartnersPage: React.FC = () => {
  const { canRead, canWrite, DeniedBanner } = usePagePermission('rev_pricing');
  const [partners, setPartners] = useState<svc.PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setPartners(await svc.listPartners());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => `${p.name} ${p.external_id ?? ''}`.toLowerCase().includes(q));
  }, [partners, search]);

  if (!canRead) return <DeniedBanner />;

  const openPartner = openId ? partners.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Distribution</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Partenaires de distribution</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Chambres &amp; plans distribués, commissions, promotions et correspondances par partenaire.
              </p>
            </div>
          </div>
          <button
            onClick={() => canWrite && setCreating(true)}
            disabled={!canWrite}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau partenaire
          </button>
        </header>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un partenaire…"
                className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none" />
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              {partners.length === 0 ? 'Aucun partenaire. Importez vos plans (Excel) ou créez-en un.' : 'Aucun résultat.'}
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold">Partenaire</th>
                  <th className="text-left px-3 py-2 font-semibold">Code</th>
                  <th className="text-left px-3 py-2 font-semibold">Type</th>
                  <th className="text-left px-3 py-2 font-semibold">Commission</th>
                  <th className="text-center px-3 py-2 font-semibold">Chambres</th>
                  <th className="text-center px-3 py-2 font-semibold">Plans</th>
                  <th className="text-center px-3 py-2 font-semibold">Promos</th>
                  <th className="text-center px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setOpenId(p.id)}>
                    <td className="px-5 py-2.5 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">{p.external_id ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{p.partner_type}</td>
                    <td className="px-3 py-2.5 text-slate-600 tabular-nums">
                      {p.default_commission_value}{p.default_commission_type === 'percent' ? '%' : ` ${p.currency}`}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.rooms_mapped}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.plans_mapped}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.active_promotions}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10.5px] font-semibold', p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Pencil className="w-3.5 h-3.5 text-slate-400 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {(openPartner || creating) && (
        <PartnerSheet
          partner={openPartner}
          canWrite={canWrite}
          onClose={() => { setOpenId(null); setCreating(false); }}
          onSaved={() => { void refresh(); }}
        />
      )}
    </div>
  );
};

// ─── Drawer fiche partenaire ──────────────────────────────────────────────────

type Tab = 'general' | 'rooms' | 'plans' | 'commissions' | 'promotions';

const PartnerSheet: React.FC<{
  partner: svc.PartnerSummary | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ partner, canWrite, onClose, onSaved }) => {
  const [tab, setTab] = useState<Tab>('general');
  const [pid, setPid] = useState<string | null>(partner?.id ?? null);

  // General form
  const [form, setForm] = useState({
    name: partner?.name ?? '',
    external_id: partner?.external_id ?? '',
    partner_type: partner?.partner_type ?? 'OTA' as svc.PartnerType,
    default_commission_type: partner?.default_commission_type ?? 'percent' as svc.CommissionType,
    default_commission_value: partner?.default_commission_value ?? 0,
    currency: partner?.currency ?? 'EUR',
    is_active: partner?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const saveGeneral = async () => {
    if (!form.name.trim()) { toast('Le nom du partenaire est requis', 'error'); return; }
    setSaving(true);
    const { id, error } = await svc.upsertPartner({ id: pid ?? undefined, ...form, name: form.name.trim() });
    setSaving(false);
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    setPid(id);
    toast('Partenaire enregistré');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-screen w-full max-w-[760px] bg-white shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 bg-violet-600 text-white shrink-0">
          <div>
            <h2 className="text-[15px] font-bold">{partner ? partner.name : 'Nouveau partenaire'}</h2>
            <p className="text-[12px] text-violet-100">Fiche partenaire — distribution &amp; tarification</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X className="w-4 h-4" /></button>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-100 shrink-0 overflow-x-auto">
          {([['general', 'Général', Tag], ['rooms', 'Chambres', Bed], ['plans', 'Plans', Grid], ['commissions', 'Commissions', Percent], ['promotions', 'Promotions', Gift]] as [Tab, string, React.ComponentType<{ className?: string }>][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} disabled={id !== 'general' && !pid}
              className={cn('px-3 py-2 text-[12.5px] font-medium rounded-t-lg inline-flex items-center gap-1.5 disabled:opacity-40',
                tab === id ? 'text-violet-700 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700')}
              title={id !== 'general' && !pid ? "Enregistrez d'abord le partenaire" : undefined}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'general' && (
            <div className="space-y-4 max-w-lg">
              <Field label="Nom du partenaire *">
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} disabled={!canWrite} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code externe"><input value={form.external_id} onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))} className={inputCls} disabled={!canWrite} /></Field>
                <Field label="Type">
                  <select value={form.partner_type} onChange={(e) => setForm((f) => ({ ...f, partner_type: e.target.value as svc.PartnerType }))} className={inputCls} disabled={!canWrite}>
                    {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Commission">
                  <select value={form.default_commission_type} onChange={(e) => setForm((f) => ({ ...f, default_commission_type: e.target.value as svc.CommissionType }))} className={inputCls} disabled={!canWrite}>
                    <option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option>
                  </select>
                </Field>
                <Field label="Valeur"><input type="number" value={form.default_commission_value} onChange={(e) => setForm((f) => ({ ...f, default_commission_value: parseFloat(e.target.value) || 0 }))} className={inputCls} disabled={!canWrite} /></Field>
                <Field label="Devise"><input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputCls} disabled={!canWrite} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} disabled={!canWrite} />
                Partenaire actif
              </label>
              {canWrite && (
                <button onClick={saveGeneral} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
                </button>
              )}
            </div>
          )}

          {tab === 'rooms' && pid && <RoomMappingSection partnerId={pid} canWrite={canWrite} />}
          {tab === 'plans' && pid && <PlanMappingSection partnerId={pid} canWrite={canWrite} />}
          {tab === 'commissions' && pid && <CommissionSection partnerId={pid} canWrite={canWrite} />}
          {tab === 'promotions' && pid && <PromotionSection partnerId={pid} canWrite={canWrite} />}
        </div>
      </aside>
    </div>
  );
};

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none disabled:bg-slate-50';
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>{children}</label>
);

// ─── Section : Mapping chambres (multi-sélection + "Toutes les chambres") ─────
const RoomMappingSection: React.FC<{ partnerId: string; canWrite: boolean }> = ({ partnerId, canWrite }) => {
  const [opts, setOpts] = useState<svc.Option[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, o] = await Promise.all([svc.getRoomMappings(partnerId), svc.listRoomTypeOptions()]);
    setOpts(o);
    setSelected(new Set(m.filter((r) => r.is_active).map((r) => r.room_type_id)));
    setLoading(false);
  }, [partnerId]);
  useEffect(() => { void load(); }, [load]);

  const allSelected = opts.length > 0 && opts.every((o) => selected.has(o.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(opts.map((o) => o.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await svc.setPartnerRoomMappings(partnerId, [...selected]);
    setSaving(false);
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    toast(`${selected.size} chambre(s) distribuée(s) enregistrée(s)`); void load();
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  if (opts.length === 0) return <div className="text-[12.5px] text-slate-400 py-6 text-center">Aucune chambre active. Créez d'abord des chambres.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3 py-2 ring-1', allSelected ? 'bg-violet-50 ring-violet-200 text-violet-700' : 'bg-white ring-slate-200 text-slate-700')}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canWrite} />
          Toutes les chambres
        </label>
        <span className="text-[12px] text-slate-500 tabular-nums">{selected.size} / {opts.length} sélectionnée(s)</span>
      </div>

      <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[46vh] overflow-y-auto">
        {opts.map((o) => (
          <label key={o.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/60 cursor-pointer">
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} disabled={!canWrite} />
            <span className="text-[13px] text-slate-800 flex-1">{o.name}</span>
            {o.isVirtual && <span className="text-[10px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Virtuelle</span>}
            <span className="text-[11px] font-mono text-slate-400">{o.code}</span>
          </label>
        ))}
      </div>

      {canWrite && (
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer les chambres distribuées
        </button>
      )}
    </div>
  );
};

// ─── Section : Mapping plans ──────────────────────────────────────────────────
const PlanMappingSection: React.FC<{ partnerId: string; canWrite: boolean }> = ({ partnerId, canWrite }) => {
  const [rows, setRows] = useState<svc.PlanMapping[]>([]);
  const [opts, setOpts] = useState<svc.Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [m, o] = await Promise.all([svc.getPlanMappings(partnerId), svc.listRatePlanOptions()]);
    setRows(m); setOpts(o); setLoading(false);
  }, [partnerId]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!planId) { toast('Sélectionnez un plan tarifaire', 'error'); return; }
    const { error } = await svc.upsertPlanMapping({ partner_id: partnerId, rate_plan_id: planId, partner_rate_code: code || null, partner_rate_name: name || null, is_active: true });
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    setPlanId(''); setCode(''); setName(''); toast('Mapping plan enregistré'); void load();
  };
  const del = async (id: string) => { const { error } = await svc.deleteRow('rate_plan_partner_mappings', id); if (error) toast(error, 'error'); else void load(); };
  const nameOf = (id: string) => opts.find((o) => o.id === id)?.name ?? id;

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  return (
    <div className="space-y-3">
      <MapTable rows={rows.map((r) => ({ id: r.id, c1: nameOf(r.rate_plan_id), c2: r.partner_rate_code ?? '—', c3: r.partner_rate_name ?? '—', active: r.is_active }))}
        headers={['Plan Flowtym', 'Code partenaire', 'Nom partenaire']} canWrite={canWrite} onDelete={del} />
      {canWrite && (
        <AddRow>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
            <option value="">— Plan Flowtym —</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
          <input placeholder="Code partenaire" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          <input placeholder="Nom partenaire" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <AddBtn onClick={add} />
        </AddRow>
      )}
    </div>
  );
};

// ─── Section : Commissions ────────────────────────────────────────────────────
const CommissionSection: React.FC<{ partnerId: string; canWrite: boolean }> = ({ partnerId, canWrite }) => {
  const [rows, setRows] = useState<svc.Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<svc.CommissionType>('percent');
  const [value, setValue] = useState(0);

  const load = useCallback(async () => { setLoading(true); setRows(await svc.getCommissions(partnerId)); setLoading(false); }, [partnerId]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const { error } = await svc.upsertCommission({ partner_id: partnerId, commission_type: type, commission_value: value, is_active: true });
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    setValue(0); toast('Commission enregistrée'); void load();
  };
  const del = async (id: string) => { const { error } = await svc.deleteRow('dist_partner_commissions', id); if (error) toast(error, 'error'); else void load(); };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  return (
    <div className="space-y-3">
      <MapTable rows={rows.map((r) => ({ id: r.id, c1: r.commission_type === 'percent' ? 'Pourcentage' : 'Montant fixe', c2: `${r.commission_value}${r.commission_type === 'percent' ? '%' : ''}`, c3: r.start_date ? `${r.start_date} → ${r.end_date ?? '∞'}` : 'Permanent', active: r.is_active }))}
        headers={['Type', 'Valeur', 'Période']} canWrite={canWrite} onDelete={del} />
      {canWrite && (
        <AddRow>
          <select value={type} onChange={(e) => setType(e.target.value as svc.CommissionType)} className={inputCls}>
            <option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option>
          </select>
          <input type="number" placeholder="Valeur" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} className={inputCls} />
          <span />
          <AddBtn onClick={add} />
        </AddRow>
      )}
    </div>
  );
};

// ─── Section : Promotions ─────────────────────────────────────────────────────
const PromotionSection: React.FC<{ partnerId: string; canWrite: boolean }> = ({ partnerId, canWrite }) => {
  const [rows, setRows] = useState<svc.Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [dtype, setDtype] = useState<svc.CommissionType>('percent');
  const [value, setValue] = useState(0);

  const load = useCallback(async () => { setLoading(true); setRows(await svc.getPromotions(partnerId)); setLoading(false); }, [partnerId]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!name.trim()) { toast('Nom de la promotion requis', 'error'); return; }
    const { error } = await svc.upsertPromotion({ partner_id: partnerId, name: name.trim(), code: code || null, discount_type: dtype, discount_value: value, is_active: true, is_stackable: false });
    if (error) { toast(`Échec — ${error}`, 'error'); return; }
    setName(''); setCode(''); setValue(0); toast('Promotion enregistrée'); void load();
  };
  const del = async (id: string) => { const { error } = await svc.deleteRow('dist_partner_promotions', id); if (error) toast(error, 'error'); else void load(); };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  return (
    <div className="space-y-3">
      <MapTable rows={rows.map((r) => ({ id: r.id, c1: r.name, c2: r.code ?? '—', c3: `${r.discount_value}${r.discount_type === 'percent' ? '%' : ''}`, active: r.is_active }))}
        headers={['Nom', 'Code', 'Réduction']} canWrite={canWrite} onDelete={del} />
      {canWrite && (
        <AddRow>
          <input placeholder="Nom promotion" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <input placeholder="Code promo" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          <div className="flex gap-1">
            <select value={dtype} onChange={(e) => setDtype(e.target.value as svc.CommissionType)} className={inputCls}><option value="percent">%</option><option value="fixed">€</option></select>
            <input type="number" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} className={inputCls} />
          </div>
          <AddBtn onClick={add} />
        </AddRow>
      )}
    </div>
  );
};

// ─── Petits composants partagés ───────────────────────────────────────────────
const MapTable: React.FC<{ rows: { id: string; c1: string; c2: string; c3: string; active: boolean }[]; headers: [string, string, string]; canWrite: boolean; onDelete: (id: string) => void }> = ({ rows, headers, canWrite, onDelete }) => (
  <div className="rounded-xl ring-1 ring-slate-100 overflow-hidden">
    <table className="w-full text-[12px]">
      <thead className="bg-slate-50 text-slate-500 text-[10.5px] uppercase tracking-wide">
        <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>)}<th className="px-3 py-1.5 text-center">Statut</th><th /></tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? (
          <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-[11.5px]">Aucune entrée.</td></tr>
        ) : rows.map((r) => (
          <tr key={r.id}>
            <td className="px-3 py-2 text-slate-700">{r.c1}</td>
            <td className="px-3 py-2 font-mono text-slate-500">{r.c2}</td>
            <td className="px-3 py-2 text-slate-600">{r.c3}</td>
            <td className="px-3 py-2 text-center"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', r.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{r.active ? 'Actif' : 'Inactif'}</span></td>
            <td className="px-3 py-2 text-right">{canWrite && <button onClick={() => onDelete(r.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
const AddRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-xl bg-slate-50/60 ring-1 ring-slate-100 p-3">{children}</div>
);
const AddBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1 h-[38px]"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
);
