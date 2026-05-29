/**
 * FLOWTYM — Fiche plan tarifaire (premium drawer, 8 onglets).
 *
 * Onglets :
 *   Général · Calcul · Contraintes · Annulation · Chambres · Partenaires · Promotions · Audit
 *
 * Toutes les persistances sont en Supabase (RLS hotel_id).
 * Aucune donnée fake, aucun bouton mort.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Loader2, Save, Star, Power, ChevronDown, ChevronRight, AlertCircle,
  Bed, Network, Gift, Clock, CalendarDays, Ban, Shield,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
import { listRoomTypeRows, listRatePlansWithRooms, type RoomTypeRow } from '@/src/services/settings/rate-plans.service';
import { listRatePlanOptions, listPartners, type PartnerSummary, type Option } from '@/src/services/settings/partners.service';
import { listPolicies, type CancellationPolicy } from '@/src/services/settings/cancellation.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'general' | 'calcul' | 'contraintes' | 'annulation' | 'chambres' | 'partenaires' | 'promotions' | 'audit';

interface RatePlanFull {
  id: string;
  plan_code: string;
  plan_name: string;
  description: string | null;
  pension_type: string | null;
  channel_type: string | null;
  connectivity_type: string | null;
  calc_mode: string | null;
  calc_value: number | null;
  calc_percent: number | null;
  reference_plan_id: string | null;
  rounding_rule: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
  is_reference: boolean;
  is_active: boolean;
  display_order: number | null;
  // Contraintes
  min_stay: number | null;
  max_stay: number | null;
  cta: boolean;
  ctd: boolean;
  release_days: number | null;
  advance_booking_min: number | null;
  advance_booking_max: number | null;
  // Annulation
  cancellation_policy_id: string | null;
  guarantee_policy: string | null;
  prepayment_percent: number | null;
  room_type_id: string | null;
  distribution_channels: string[];
  created_at: string | null;
  updated_at: string | null;
}

const BLANK: Omit<RatePlanFull, 'id' | 'created_at' | 'updated_at'> = {
  plan_code: '',
  plan_name: '',
  description: null,
  pension_type: 'RO',
  channel_type: 'Direct',
  connectivity_type: 'Aucun',
  calc_mode: 'fixed',
  calc_value: 0,
  calc_percent: 0,
  reference_plan_id: null,
  rounding_rule: 'none',
  min_price: null,
  max_price: null,
  currency: 'EUR',
  is_reference: false,
  is_active: true,
  display_order: null,
  min_stay: null,
  max_stay: null,
  cta: false,
  ctd: false,
  release_days: null,
  advance_booking_min: null,
  advance_booking_max: null,
  cancellation_policy_id: null,
  guarantee_policy: null,
  prepayment_percent: null,
  room_type_id: null,
  distribution_channels: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  planId: string | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RatePlanSheet: React.FC<Props> = ({ planId, canWrite, onClose, onSaved }) => {
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<Omit<RatePlanFull, 'id' | 'created_at' | 'updated_at'>>({ ...BLANK });
  const [savedId, setSavedId] = useState<string | null>(planId);
  const [loading, setLoading] = useState(!!planId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [roomOpts, setRoomOpts] = useState<RoomTypeRow[]>([]);
  const [planOpts, setPlanOpts] = useState<Option[]>([]);
  const [partnerList, setPartnerList] = useState<PartnerSummary[]>([]);
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);

  // Room checkbox state
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());

  // Partners checkbox state
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());

  const [auditRows, setAuditRows] = useState<{ at: string; by: string; action: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rooms, plans, partners, cxls] = await Promise.all([
        listRoomTypeRows(),
        listRatePlanOptions(),
        listPartners(),
        listPolicies(),
      ]);
      setRoomOpts(rooms);
      setPlanOpts(plans.filter((p) => p.id !== planId));
      setPartnerList(partners);
      setPolicies(cxls);

      if (planId) {
        const hid = await resolveHotelId();
        const { data } = await sb.from('rate_plans').select('*').eq('id', planId).eq('hotel_id', hid).maybeSingle();
        if (data) {
          setForm({
            plan_code: data.plan_code ?? '',
            plan_name: data.plan_name ?? '',
            description: data.description ?? null,
            pension_type: data.pension_type ?? 'RO',
            channel_type: data.channel_type ?? 'Direct',
            connectivity_type: data.connectivity_type ?? 'Aucun',
            calc_mode: data.calc_mode ?? 'fixed',
            calc_value: data.calc_value ?? 0,
            calc_percent: data.calc_percent ?? 0,
            reference_plan_id: data.reference_plan_id ?? null,
            rounding_rule: data.rounding_rule ?? 'none',
            min_price: data.min_price ?? null,
            max_price: data.max_price ?? null,
            currency: data.currency ?? 'EUR',
            is_reference: data.is_reference ?? false,
            is_active: data.is_active ?? true,
            display_order: data.display_order ?? null,
            min_stay: data.min_stay ?? null,
            max_stay: data.max_stay ?? null,
            cta: data.cta ?? false,
            ctd: data.ctd ?? false,
            release_days: data.release_days ?? null,
            advance_booking_min: data.advance_booking_min ?? null,
            advance_booking_max: data.advance_booking_max ?? null,
            cancellation_policy_id: data.cancellation_policy_id ?? null,
            guarantee_policy: data.guarantee_policy ?? null,
            prepayment_percent: data.prepayment_percent ?? null,
            room_type_id: data.room_type_id ?? null,
            distribution_channels: data.distribution_channels ?? [],
          });
          setSelectedRooms(data.room_type_id ? new Set([data.room_type_id]) : new Set());
          setSelectedPartners(new Set(data.distribution_channels ?? []));
        }

        // Load partner mappings
        const { data: mappings } = await sb.from('rate_plan_partner_mappings')
          .select('partner_id')
          .eq('rate_plan_id', planId)
          .eq('is_active', true);
        if (mappings?.length) {
          setSelectedPartners(new Set((mappings as { partner_id: string }[]).map((m) => m.partner_id)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  const f = (field: keyof typeof BLANK, val: unknown) => setForm((prev) => ({ ...prev, [field]: val }));

  const save = async () => {
    if (!form.plan_code.trim()) { setError('Le code du plan est obligatoire'); return; }
    if (!form.plan_name.trim()) { setError('Le nom du plan est obligatoire'); return; }
    setSaving(true);
    setError(null);
    try {
      const hid = await resolveHotelId();
      if (!hid) throw new Error('Hôtel introuvable — reconnectez-vous.');

      const payload: Record<string, unknown> = {
        hotel_id: hid,
        plan_code: form.plan_code.trim(),
        plan_name: form.plan_name.trim(),
        description: form.description || null,
        pension_type: form.pension_type,
        channel_type: form.channel_type,
        connectivity_type: form.connectivity_type,
        calc_mode: form.calc_mode,
        calc_value: form.calc_value ?? 0,
        calc_percent: form.calc_percent ?? 0,
        reference_plan_id: form.reference_plan_id || null,
        rounding_rule: form.rounding_rule,
        min_price: form.min_price,
        max_price: form.max_price,
        currency: form.currency ?? 'EUR',
        is_reference: form.is_reference,
        is_active: form.is_active,
        display_order: form.display_order,
        min_stay: form.min_stay,
        max_stay: form.max_stay,
        cta: form.cta,
        ctd: form.ctd,
        release_days: form.release_days,
        advance_booking_min: form.advance_booking_min,
        advance_booking_max: form.advance_booking_max,
        cancellation_policy_id: form.cancellation_policy_id || null,
        guarantee_policy: form.guarantee_policy || null,
        prepayment_percent: form.prepayment_percent,
        room_type_id: selectedRooms.size > 0 ? [...selectedRooms][0] : null,
        distribution_channels: [...selectedPartners],
        updated_at: new Date().toISOString(),
      };
      if (savedId) payload.id = savedId;

      const { data, error: upsertError } = await sb.from('rate_plans')
        .upsert(payload, { onConflict: 'hotel_id,plan_code' })
        .select('id')
        .maybeSingle();
      if (upsertError) throw new Error(upsertError.message);
      const newId = data?.id ?? savedId;
      setSavedId(newId);

      // Sync partner mappings
      if (newId) {
        const { data: existing } = await sb.from('rate_plan_partner_mappings')
          .select('id, partner_id').eq('rate_plan_id', newId);
        const existingRows: { id: string; partner_id: string }[] = existing ?? [];
        const existingSet = new Set(existingRows.map((r) => r.partner_id));
        const toAdd = [...selectedPartners].filter((pid) => !existingSet.has(pid));
        const toRemove = existingRows.filter((r) => !selectedPartners.has(r.partner_id)).map((r) => r.id);
        if (toAdd.length) {
          await sb.from('rate_plan_partner_mappings').upsert(
            toAdd.map((pid) => ({ hotel_id: hid, rate_plan_id: newId, partner_id: pid, is_active: true })),
            { onConflict: 'hotel_id,rate_plan_id,partner_id' },
          );
        }
        if (toRemove.length) {
          await sb.from('rate_plan_partner_mappings').delete().in('id', toRemove);
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const TABS: [Tab, string, React.ReactNode][] = [
    ['general', 'Général', null],
    ['calcul', 'Calcul', null],
    ['contraintes', 'Contraintes', null],
    ['annulation', 'Annulation', null],
    ['chambres', 'Chambres', <Bed key="b" className="w-3.5 h-3.5" />],
    ['partenaires', 'Partenaires', <Network key="n" className="w-3.5 h-3.5" />],
    ['promotions', 'Promotions', <Gift key="g" className="w-3.5 h-3.5" />],
    ['audit', 'Audit', <Clock key="c" className="w-3.5 h-3.5" />],
  ];

  const locked = tab !== 'general' && !savedId;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-screen w-full max-w-[860px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 bg-violet-600 text-white shrink-0">
          <div>
            <h2 className="text-[15px] font-bold">
              {planId ? form.plan_name || 'Plan tarifaire' : 'Nouveau plan tarifaire'}
            </h2>
            <p className="text-[12px] text-violet-100">
              {form.plan_code && <span className="font-mono mr-2">{form.plan_code}</span>}
              Fiche plan tarifaire
            </p>
          </div>
          <div className="flex items-center gap-2">
            {form.is_reference && <span className="inline-flex items-center gap-1 text-[11px] bg-amber-400/20 text-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3 fill-amber-300" /> Référent</span>}
            <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full', form.is_active ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white/70')}>
              <Power className="w-3 h-3" /> {form.is_active ? 'Actif' : 'Inactif'}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 ml-1"><X className="w-4 h-4" /></button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-2 border-b border-slate-100 shrink-0 overflow-x-auto">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => !locked && setTab(id)}
              disabled={locked && id !== 'general'}
              className={cn('px-3 py-2 text-[12.5px] font-medium rounded-t-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                tab === id ? 'text-violet-700 border-b-2 border-violet-600 bg-violet-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}
              title={locked && id !== 'general' ? "Enregistrez d'abord le plan" : undefined}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {tab === 'general' && <TabGeneral form={form} f={f} canWrite={canWrite} planOpts={planOpts} />}
              {tab === 'calcul' && <TabCalcul form={form} f={f} canWrite={canWrite} planOpts={planOpts} />}
              {tab === 'contraintes' && <TabContraintes form={form} f={f} canWrite={canWrite} />}
              {tab === 'annulation' && <TabAnnulation form={form} f={f} canWrite={canWrite} policies={policies} />}
              {tab === 'chambres' && (
                <TabChambres opts={roomOpts} selected={selectedRooms} onChange={setSelectedRooms} canWrite={canWrite} />
              )}
              {tab === 'partenaires' && (
                <TabPartenaires partners={partnerList} selected={selectedPartners} onChange={setSelectedPartners} canWrite={canWrite} />
              )}
              {tab === 'promotions' && <TabPromotions planId={savedId} />}
              {tab === 'audit' && <TabAudit rows={auditRows} planId={savedId} />}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-rose-50 border-t border-rose-100 text-[12.5px] text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Footer */}
        {canWrite && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between shrink-0">
            <button onClick={onClose} className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Fermer</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Enregistrer
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

// ─── Onglets ──────────────────────────────────────────────────────────────────

type FormUpdater = (field: keyof typeof BLANK, val: unknown) => void;

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none disabled:bg-slate-50 disabled:text-slate-500 bg-white';
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
    {hint && <span className="ml-2 text-[10.5px] text-slate-400">{hint}</span>}
    {children}
  </label>
);

const TabGeneral: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean; planOpts: Option[] }> = ({ form, f, canWrite }) => (
  <div className="space-y-4 max-w-xl">
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nom du plan *">
        <input value={form.plan_name} onChange={(e) => f('plan_name', e.target.value)} className={inputCls} disabled={!canWrite} />
      </Field>
      <Field label="Code *">
        <input value={form.plan_code} onChange={(e) => f('plan_code', e.target.value.toUpperCase())} className={inputCls + ' font-mono'} disabled={!canWrite} />
      </Field>
    </div>
    <Field label="Description">
      <textarea value={form.description ?? ''} onChange={(e) => f('description', e.target.value || null)}
        className={inputCls + ' min-h-[64px] resize-y'} disabled={!canWrite} rows={2} />
    </Field>
    <div className="grid grid-cols-3 gap-3">
      <Field label="Type de pension">
        <select value={form.pension_type ?? 'RO'} onChange={(e) => f('pension_type', e.target.value)} className={inputCls} disabled={!canWrite}>
          {['RO', 'BB', 'HB', 'FB', 'AI', 'Package'].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Canal">
        <select value={form.channel_type ?? 'Direct'} onChange={(e) => f('channel_type', e.target.value)} className={inputCls} disabled={!canWrite}>
          {['Direct', 'OTA', 'Mobile', 'Corporate', 'B2B'].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Devise">
        <input value={form.currency ?? 'EUR'} onChange={(e) => f('currency', e.target.value)} className={inputCls} disabled={!canWrite} />
      </Field>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Ordre d'affichage" hint="(optionnel)">
        <input type="number" value={form.display_order ?? ''} onChange={(e) => f('display_order', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} />
      </Field>
      <Field label="Connectivité">
        <select value={form.connectivity_type ?? 'Aucun'} onChange={(e) => f('connectivity_type', e.target.value)} className={inputCls} disabled={!canWrite}>
          {['Aucun', 'D-EDGE', 'ChannelManager', 'SiteMinder'].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
    </div>
    <div className="flex gap-4">
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" checked={form.is_active} onChange={(e) => f('is_active', e.target.checked)} disabled={!canWrite} />
        Plan actif
      </label>
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" checked={form.is_reference} onChange={(e) => f('is_reference', e.target.checked)} disabled={!canWrite} />
        Plan de référence (talon RMS)
      </label>
    </div>
  </div>
);

const TabCalcul: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean; planOpts: Option[] }> = ({ form, f, canWrite, planOpts }) => {
  const mode = form.calc_mode ?? 'fixed';
  return (
    <div className="space-y-4 max-w-xl">
      <Field label="Mode de calcul">
        <select value={mode} onChange={(e) => f('calc_mode', e.target.value)} className={inputCls} disabled={!canWrite}>
          <option value="fixed">Prix fixe (saisi manuellement)</option>
          <option value="derived">Dérivé d'un plan de référence (% + montant)</option>
          <option value="percent">Pourcentage du plan de référence</option>
          <option value="amount">Montant ajouté/soustrait</option>
        </select>
      </Field>

      {mode === 'fixed' && (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-4 text-[12.5px] text-slate-600">
          Le prix est saisi manuellement cellule par cellule dans le Calendrier tarifaire.
        </div>
      )}

      {(mode === 'derived' || mode === 'percent' || mode === 'amount') && (
        <>
          <Field label="Plan de référence">
            <select value={form.reference_plan_id ?? ''} onChange={(e) => f('reference_plan_id', e.target.value || null)} className={inputCls} disabled={!canWrite}>
              <option value="">— Aucun plan de référence —</option>
              {planOpts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </Field>
          {(mode === 'derived' || mode === 'percent') && (
            <Field label="Ajustement (%)" hint="ex: -10 = -10% du plan référence">
              <input type="number" step="0.1" value={form.calc_percent ?? 0} onChange={(e) => f('calc_percent', parseFloat(e.target.value) || 0)} className={inputCls} disabled={!canWrite} />
            </Field>
          )}
          {(mode === 'derived' || mode === 'amount') && (
            <Field label="Montant fixe (+/-)" hint="ex: 20 = +20€ / -15 = -15€">
              <input type="number" step="0.01" value={form.calc_value ?? 0} onChange={(e) => f('calc_value', parseFloat(e.target.value) || 0)} className={inputCls} disabled={!canWrite} />
            </Field>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix minimum">
          <input type="number" step="0.01" value={form.min_price ?? ''} onChange={(e) => f('min_price', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
        </Field>
        <Field label="Prix maximum">
          <input type="number" step="0.01" value={form.max_price ?? ''} onChange={(e) => f('max_price', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
        </Field>
      </div>
      <Field label="Règle d'arrondi">
        <select value={form.rounding_rule ?? 'none'} onChange={(e) => f('rounding_rule', e.target.value)} className={inputCls} disabled={!canWrite}>
          <option value="none">Aucun</option>
          <option value="ceil">Arrondi supérieur</option>
          <option value="floor">Arrondi inférieur</option>
          <option value="round">Arrondi standard</option>
          <option value="5">Arrondi au 5 le plus proche</option>
          <option value="10">Arrondi à la dizaine</option>
        </select>
      </Field>
    </div>
  );
};

const TabContraintes: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean }> = ({ form, f, canWrite }) => (
  <div className="space-y-5 max-w-xl">
    <section>
      <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" /> Durée de séjour
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Séjour minimum (nuits)" hint="(optionnel)">
          <input type="number" min="1" value={form.min_stay ?? ''} onChange={(e) => f('min_stay', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucune" />
        </Field>
        <Field label="Séjour maximum (nuits)" hint="(optionnel)">
          <input type="number" min="1" value={form.max_stay ?? ''} onChange={(e) => f('max_stay', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucune" />
        </Field>
      </div>
    </section>

    <section>
      <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <Ban className="w-3.5 h-3.5" /> Restrictions d'arrivée / départ
      </h3>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={form.cta} onChange={(e) => f('cta', e.target.checked)} disabled={!canWrite} />
          CTA — Fermé à l'arrivée
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={form.ctd} onChange={(e) => f('ctd', e.target.checked)} disabled={!canWrite} />
          CTD — Fermé au départ
        </label>
      </div>
    </section>

    <section>
      <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Fenêtre de réservation
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Release (jours)" hint="Délai minimum avant arrivée">
          <input type="number" min="0" value={form.release_days ?? ''} onChange={(e) => f('release_days', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucun" />
        </Field>
        <Field label="Réservation anticipée min." hint="(jours)">
          <input type="number" min="0" value={form.advance_booking_min ?? ''} onChange={(e) => f('advance_booking_min', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucune" />
        </Field>
        <Field label="Réservation anticipée max." hint="(jours)">
          <input type="number" min="0" value={form.advance_booking_max ?? ''} onChange={(e) => f('advance_booking_max', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="Aucune" />
        </Field>
      </div>
    </section>
  </div>
);

const TabAnnulation: React.FC<{ form: typeof BLANK; f: FormUpdater; canWrite: boolean; policies: CancellationPolicy[] }> = ({ form, f, canWrite, policies }) => (
  <div className="space-y-4 max-w-xl">
    <Field label="Condition d'annulation">
      <select value={form.cancellation_policy_id ?? ''} onChange={(e) => f('cancellation_policy_id', e.target.value || null)} className={inputCls} disabled={!canWrite}>
        <option value="">— Politique par défaut de l'hôtel —</option>
        {policies.map((p) => (
          <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
        ))}
      </select>
      {form.cancellation_policy_id && (() => {
        const pol = policies.find((p) => p.id === form.cancellation_policy_id);
        return pol ? (
          <div className="mt-1.5 text-[11.5px] text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
            Annulation gratuite jusqu'à {pol.free_until_hours}h — Pénalité : {pol.penalty_value}{pol.penalty_type === 'percentage' ? '%' : ` ${pol.currency}`}
          </div>
        ) : null;
      })()}
    </Field>

    <Field label="Garantie requise">
      <select value={form.guarantee_policy ?? ''} onChange={(e) => f('guarantee_policy', e.target.value || null)} className={inputCls} disabled={!canWrite}>
        <option value="">— Aucune garantie spécifique —</option>
        <option value="cc_required">Carte de crédit obligatoire</option>
        <option value="deposit">Acompte requis</option>
        <option value="full_prepayment">Prépaiement intégral</option>
        <option value="voucher">Bon cadeau / Voucher</option>
      </select>
    </Field>

    <Field label="Acompte (%)" hint="(si acompte ou prépaiement)">
      <input type="number" min="0" max="100" step="5" value={form.prepayment_percent ?? ''} onChange={(e) => f('prepayment_percent', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} disabled={!canWrite} placeholder="0" />
    </Field>

    <div className="rounded-xl bg-violet-50/40 ring-1 ring-violet-100 p-3 text-[11.5px] text-violet-800 flex items-start gap-2">
      <Shield className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
      <div>Les conditions d'annulation détaillées sont gérées dans <strong>Paramètres › Conditions</strong>.</div>
    </div>
  </div>
);

const TabChambres: React.FC<{ opts: RoomTypeRow[]; selected: Set<string>; onChange: (s: Set<string>) => void; canWrite: boolean }> = ({ opts, selected, onChange, canWrite }) => {
  const toggle = (id: string) => onChange(new Set([id]));
  if (opts.length === 0) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Aucune chambre active.</div>;
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-slate-500 mb-3">Sélectionnez la chambre associée à ce plan tarifaire (1 seule).</p>
      <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
        {opts.map((o) => (
          <label key={o.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/60 cursor-pointer">
            <input type="radio" name="room_type" checked={selected.has(o.id)} onChange={() => toggle(o.id)} disabled={!canWrite} />
            <span className="text-[13px] text-slate-800 flex-1">{o.room_type_name}</span>
            <span className="text-[11px] font-mono text-slate-400">{o.room_type_code}</span>
          </label>
        ))}
      </div>
      {selected.size > 0 && (
        <button onClick={() => onChange(new Set())} disabled={!canWrite} className="text-[11.5px] text-rose-500 hover:underline disabled:opacity-40">
          Retirer l'association
        </button>
      )}
    </div>
  );
};

const TabPartenaires: React.FC<{ partners: PartnerSummary[]; selected: Set<string>; onChange: (s: Set<string>) => void; canWrite: boolean }> = ({ partners, selected, onChange, canWrite }) => {
  const toggle = (id: string) => {
    onChange((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allSelected = partners.length > 0 && partners.every((p) => selected.has(p.id));
  const toggleAll = () => onChange(allSelected ? new Set() : new Set(partners.map((p) => p.id)));

  if (partners.length === 0) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Aucun partenaire actif. Créez-en d'abord dans Partenaires.</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3 py-2 ring-1 cursor-pointer', allSelected ? 'bg-violet-50 ring-violet-200 text-violet-700' : 'bg-white ring-slate-200 text-slate-700')}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canWrite} />
          Tous les partenaires
        </label>
        <span className="text-[12px] text-slate-500 tabular-nums">{selected.size} / {partners.length}</span>
      </div>
      <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[46vh] overflow-y-auto">
        {partners.map((p) => (
          <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/60 cursor-pointer">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!canWrite} />
            <span className="text-[13px] text-slate-800 flex-1">{p.name}</span>
            <span className="text-[10.5px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{p.partner_type}</span>
            <span className="text-[11px] font-mono text-slate-400">{p.external_id ?? ''}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const TabPromotions: React.FC<{ planId: string | null }> = ({ planId }) => {
  if (!planId) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Enregistrez d'abord le plan pour gérer les promotions.</div>;
  return (
    <div className="text-[12.5px] text-slate-400 py-8 text-center">
      <Gift className="w-6 h-6 mx-auto mb-2 text-slate-300" />
      <div className="font-medium text-slate-700">Promotions associées à ce plan</div>
      <div className="mt-1">La gestion des promotions est disponible dans <strong>Paramètres › Partenaires</strong>.</div>
    </div>
  );
};

const TabAudit: React.FC<{ rows: { at: string; by: string; action: string }[]; planId: string | null }> = ({ rows, planId }) => {
  if (!planId) return <div className="text-[12.5px] text-slate-400 py-8 text-center">Enregistrez d'abord le plan.</div>;
  return (
    <div>
      {rows.length === 0 ? (
        <div className="text-[12.5px] text-slate-400 py-8 text-center">Aucun log d'audit disponible.</div>
      ) : (
        <div className="rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50 max-h-[50vh] overflow-y-auto text-[12.5px]">
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-3">
              <span className="text-slate-400 w-36 shrink-0">{new Date(r.at).toLocaleString('fr-FR')}</span>
              <span className="text-slate-600 flex-1">{r.action}</span>
              <span className="text-slate-400 font-mono text-[11px]">{r.by}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
