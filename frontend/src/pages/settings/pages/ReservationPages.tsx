/**
 * FLOWTYM — Paramètres · Réservations (Cancellation, Guarantees, NoShow, EmailTemplates).
 */
import React from 'react';
import { FileText, Shield, AlertOctagon, Mail } from 'lucide-react';
import { GenericListPage, type GenericListItem } from './_common';

// ─── Conditions d'annulation ──────────────────────────────────────────────

interface CancelItem extends GenericListItem {
  hoursBefore: number;
  feePercent: number;
  appliesTo: 'all' | 'b2c' | 'b2b' | 'group';
}

export const CancellationPage: React.FC = () => (
  <GenericListPage<CancelItem>
    icon={FileText}
    category="Réservations"
    title="Conditions d'annulation"
    description="Politiques d'annulation appliquées aux différents canaux et segments."
    storageKey="flowtym.cancellation"
    module="pms_reservations"
    defaults={[
      { id: 'flex',  label: 'Flexible (gratuit J-1)',     code: 'FLEX', active: true, hoursBefore: 24, feePercent: 0, appliesTo: 'all' },
      { id: 'std',   label: 'Standard (gratuit J-3)',     code: 'STD',  active: true, hoursBefore: 72, feePercent: 0, appliesTo: 'b2c' },
      { id: 'nr',    label: 'Non remboursable',           code: 'NR',   active: true, hoursBefore: 0, feePercent: 100, appliesTo: 'b2c' },
      { id: 'grp',   label: 'Groupes (J-14)',             code: 'GRP',  active: true, hoursBefore: 336, feePercent: 50, appliesTo: 'group' },
    ]}
    extraColumns={[
      { header: 'Gratuite jusqu\'à', render: (it) => `J-${Math.floor(it.hoursBefore / 24)}` },
      { header: 'Pénalité', render: (it) => `${it.feePercent}%` },
      { header: 'Cible', render: (it) => <span className="uppercase text-[10.5px] font-semibold">{it.appliesTo}</span> },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Heures avant</span>
          <input type="number" min={0} value={item.hoursBefore} onChange={(e) => set({ hoursBefore: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Pénalité (%)</span>
          <input type="number" min={0} max={100} value={item.feePercent} onChange={(e) => set({ feePercent: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Applicable à</span>
          <select value={item.appliesTo} onChange={(e) => set({ appliesTo: e.target.value as CancelItem['appliesTo'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="all">Tous</option><option value="b2c">B2C</option><option value="b2b">B2B</option><option value="group">Groupes</option>
          </select></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, hoursBefore: 24, feePercent: 0, appliesTo: 'all' })}
    phase2="application automatique aux factures + envoi email de confirmation d'annulation."
  />
);

// ─── Garanties ────────────────────────────────────────────────────────────

interface GuaranteeItem extends GenericListItem {
  guaranteeType: 'cb_preauth' | 'cb_capture' | 'iban' | 'voucher' | 'company';
  amount: number;
  amountType: 'percent' | 'flat' | 'first_night';
}

export const GuaranteesPage: React.FC = () => (
  <GenericListPage<GuaranteeItem>
    icon={Shield}
    category="Réservations"
    title="Garanties"
    description="Types de garantie exigés selon le canal et le segment."
    storageKey="flowtym.guarantees"
    module="pms_reservations"
    defaults={[
      { id: 'preauth', label: 'Pré-autorisation CB',          code: 'PRE',   active: true, guaranteeType: 'cb_preauth', amount: 1, amountType: 'first_night' },
      { id: 'capture', label: 'Capture CB (NR)',              code: 'CAP',   active: true, guaranteeType: 'cb_capture', amount: 100, amountType: 'percent' },
      { id: 'invoice', label: 'Facture entreprise',           code: 'INV',   active: true, guaranteeType: 'company', amount: 0, amountType: 'flat' },
      { id: 'voucher', label: 'Voucher tour-opérateur',       code: 'VCH',   active: true, guaranteeType: 'voucher', amount: 0, amountType: 'flat' },
    ]}
    extraColumns={[
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold uppercase">{it.guaranteeType}</span> },
      { header: 'Montant', render: (it) => {
        if (it.amountType === 'first_night') return '1ère nuit';
        if (it.amountType === 'percent') return `${it.amount}%`;
        return `${it.amount} €`;
      } },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Type</span>
          <select value={item.guaranteeType} onChange={(e) => set({ guaranteeType: e.target.value as GuaranteeItem['guaranteeType'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="cb_preauth">Pré-autorisation CB</option><option value="cb_capture">Capture CB</option><option value="iban">IBAN</option><option value="voucher">Voucher TO</option><option value="company">Société</option>
          </select></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Montant</span>
          <input type="number" min={0} value={item.amount} onChange={(e) => set({ amount: parseFloat(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Mode</span>
          <select value={item.amountType} onChange={(e) => set({ amountType: e.target.value as GuaranteeItem['amountType'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="percent">%</option><option value="flat">€</option><option value="first_night">1ère nuit</option>
          </select></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, guaranteeType: 'cb_preauth', amount: 1, amountType: 'first_night' })}
    phase2="intégration Stripe / Adyen pour pré-autorisations CB réelles + libération automatique."
  />
);

// ─── No-show ──────────────────────────────────────────────────────────────

interface NoShowItem extends GenericListItem {
  feePercent: number;
  delayHours: number;
  action: 'charge' | 'release' | 'review';
}

export const NoShowPage: React.FC = () => (
  <GenericListPage<NoShowItem>
    icon={AlertOctagon}
    category="Réservations"
    title="No-show & dépassement"
    description="Politique de gestion des no-show et dépassements de check-in."
    storageKey="flowtym.no_show"
    module="pms_reservations"
    defaults={[
      { id: 'standard',  label: 'Standard (1 nuit facturée)', code: 'STD',  active: true, feePercent: 100, delayHours: 22, action: 'charge' },
      { id: 'flex',      label: 'Flexible (relance manuelle)', code: 'FLEX', active: false, feePercent: 0,   delayHours: 4, action: 'review' },
      { id: 'release',   label: 'Libération auto',              code: 'REL',  active: true, feePercent: 100, delayHours: 24, action: 'release' },
    ]}
    extraColumns={[
      { header: 'Pénalité', render: (it) => `${it.feePercent}%` },
      { header: 'Délai', render: (it) => `${it.delayHours}h` },
      { header: 'Action', render: (it) => {
        const labels = { charge: 'Facturer', release: 'Libérer', review: 'À valider' };
        return <span className="text-slate-700">{labels[it.action]}</span>;
      } },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Pénalité (%)</span>
          <input type="number" min={0} max={100} value={item.feePercent} onChange={(e) => set({ feePercent: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Délai (h)</span>
          <input type="number" min={0} max={48} value={item.delayHours} onChange={(e) => set({ delayHours: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Action</span>
          <select value={item.action} onChange={(e) => set({ action: e.target.value as NoShowItem['action'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="charge">Facturer</option><option value="release">Libérer</option><option value="review">À valider</option>
          </select></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, feePercent: 100, delayHours: 22, action: 'charge' })}
    phase2="détection automatique no-show via heures de check-in + workflow batch nocturne."
  />
);

// ─── Email Templates dédié (différent de Notifications qui sont
//      les déclencheurs — ici on liste les templates eux-mêmes) ────────────

interface EmailTplItem extends GenericListItem {
  subject: string;
  language: 'fr' | 'en' | 'es' | 'de';
  channel: 'email' | 'sms';
}

export const EmailTemplatesPage: React.FC = () => (
  <GenericListPage<EmailTplItem>
    icon={Mail}
    category="Réservations"
    title="Templates email & SMS"
    description="Catalogue multilingue des templates utilisés dans les notifications transactionnelles."
    storageKey="flowtym.email.templates_catalog"
    module="pms_reservations"
    defaults={[
      { id: 'conf_fr', label: 'Confirmation FR',  code: 'CONF_FR', active: true, subject: 'Confirmation de réservation', language: 'fr', channel: 'email' },
      { id: 'conf_en', label: 'Confirmation EN',  code: 'CONF_EN', active: true, subject: 'Booking confirmation', language: 'en', channel: 'email' },
      { id: 'rem_fr',  label: 'Rappel J-1 FR',    code: 'REM_FR',  active: true, subject: 'Demain à l\'hôtel', language: 'fr', channel: 'email' },
      { id: 'sms_co',  label: 'SMS pré-check-in', code: 'SMS_CO',  active: true, subject: '', language: 'fr', channel: 'sms' },
      { id: 'cancel_fr', label: 'Annulation FR',  code: 'CNL_FR',  active: true, subject: 'Confirmation d\'annulation', language: 'fr', channel: 'email' },
    ]}
    extraColumns={[
      { header: 'Langue', render: (it) => <span className="uppercase font-mono text-[11.5px]">{it.language}</span> },
      { header: 'Canal', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold uppercase">{it.channel}</span> },
      { header: 'Sujet', render: (it) => <span className="text-slate-700 line-clamp-1">{it.subject || '—'}</span> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Sujet (email uniquement)</span>
          <input type="text" value={item.subject} onChange={(e) => set({ subject: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Langue</span>
            <select value={item.language} onChange={(e) => set({ language: e.target.value as EmailTplItem['language'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="fr">Français</option><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option>
            </select></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Canal</span>
            <select value={item.channel} onChange={(e) => set({ channel: e.target.value as EmailTplItem['channel'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="email">Email</option><option value="sms">SMS</option>
            </select></label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, subject: '', language: 'fr', channel: 'email' })}
    phase2="éditeur visuel MJML + envoi de test depuis cette page + statistiques d'ouverture par template."
  />
);
