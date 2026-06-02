/**
 * FLOWTYM — Paramètres · Communication (Email hôtel + WhatsApp Business).
 *
 * Configure, PAR HÔTEL, l'envoi réel des emails et messages WhatsApp aux
 * clients depuis Flowday. Les secrets (tokens Meta, mot de passe SMTP,
 * refresh tokens OAuth) ne transitent jamais en lecture vers le frontend :
 * ils sont écrits via la RPC set_communication_secret et stockés dans une
 * table privée (service_role only). L'UI n'affiche que "présent : oui/non".
 */
import React, { useEffect, useState } from 'react';
import {
  Mail, MessageCircle, Send, CheckCircle2, AlertTriangle, Loader2, Save, KeyRound, ShieldCheck, Info,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getEmailSettings, saveEmailSettings, getWhatsAppSettings, saveWhatsAppSettings,
  setSecret, hasSecret, testEmail, testWhatsApp,
  type EmailSettings, type WhatsAppSettings, type EmailProvider, type ConnectionStatus,
} from '@/src/services/communication/communicationSettings.service';

type Tab = 'email' | 'whatsapp';

const StatusPill: React.FC<{ status?: ConnectionStatus; active?: boolean }> = ({ status, active }) => {
  const s: ConnectionStatus = !active ? 'disconnected' : (status ?? 'disconnected');
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    connected: { label: 'Connecté', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    disconnected: { label: 'Non connecté', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
    error: { label: 'Erreur', cls: 'bg-red-50 text-red-700 ring-red-200' },
  };
  const m = map[s];
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1', m.cls)}>{m.label}</span>;
};

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div>
    <label className="text-xs font-bold text-slate-500">{label}</label>
    <div className="mt-1">{children}</div>
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500';

/** Champ secret en écriture seule : affiche "configuré" sans révéler la valeur. */
const SecretField: React.FC<{
  label: string; present: boolean; onSave: (v: string) => Promise<void>; placeholder?: string;
}> = ({ label, present, onSave, placeholder }) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handle = async () => {
    setSaving(true);
    try { await onSave(value); setValue(''); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };
  return (
    <Field label={label} hint={present ? '✓ Secret enregistré (masqué). Saisir une nouvelle valeur pour le remplacer.' : 'Aucun secret enregistré.'}>
      <div className="flex gap-2">
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder ?? (present ? '••••••••' : '')} className={inputCls} autoComplete="new-password" />
        <button onClick={handle} disabled={saving || value.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
          {saved ? 'OK' : 'Enregistrer'}
        </button>
      </div>
    </Field>
  );
};

// ─── EMAIL ────────────────────────────────────────────────────────────────────

const EmailPanel: React.FC = () => {
  const [s, setS] = useState<Partial<EmailSettings>>({ provider: 'smtp', smtp_secure: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const refreshSecrets = async () => {
    const [smtpPwd, apiKey, access, refresh] = await Promise.all([
      hasSecret('email', 'smtp_password'), hasSecret('email', 'api_key'),
      hasSecret('email', 'access_token'), hasSecret('email', 'refresh_token'),
    ]);
    setSecrets({ smtp_password: smtpPwd, api_key: apiKey, access_token: access, refresh_token: refresh });
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getEmailSettings();
        if (data) setS(data);
        await refreshSecrets();
      } finally { setLoading(false); }
    })();
  }, []);

  const provider = (s.provider ?? 'smtp') as EmailProvider;
  const upd = (patch: Partial<EmailSettings>) => setS((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try { const saved = await saveEmailSettings(s); setS(saved); } finally { setSaving(false); }
  };

  const runTest = async () => {
    if (!testTo) return;
    setTesting(true); setTestMsg(null);
    const r = await testEmail(testTo);
    setTestMsg({ ok: r.ok, text: r.message });
    setTesting(false);
    await refreshSecrets();
    const data = await getEmailSettings(); if (data) setS(data);
  };

  if (loading) return <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusPill status={s.connection_status} active={s.is_active} />
          {s.last_error && <span className="text-xs text-red-500">{s.last_error}</span>}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(s.is_active)} onChange={(e) => upd({ is_active: e.target.checked })} className="h-4 w-4 rounded text-violet-600" />
          Activer l'envoi d'emails
        </label>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 text-sm text-violet-900">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} />Les emails partent de l'adresse de l'hôtel — jamais d'une adresse Flowtym générique.</p>
      </div>

      <Field label="Fournisseur">
        <select value={provider} onChange={(e) => upd({ provider: e.target.value as EmailProvider })} className={inputCls}>
          <option value="gmail_oauth">Google Workspace / Gmail (OAuth)</option>
          <option value="microsoft_graph">Microsoft 365 (Microsoft Graph)</option>
          <option value="smtp">SMTP (fallback sécurisé)</option>
          <option value="resend">Resend (API)</option>
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email expéditeur" hint="ex: reception@hotel.com"><input value={s.from_email ?? ''} onChange={(e) => upd({ from_email: e.target.value })} className={inputCls} placeholder="reception@hotel.com" /></Field>
        <Field label="Nom expéditeur"><input value={s.from_name ?? ''} onChange={(e) => upd({ from_name: e.target.value })} className={inputCls} placeholder="Hôtel Paris Centre" /></Field>
        <Field label="Reply-To (optionnel)"><input value={s.reply_to ?? ''} onChange={(e) => upd({ reply_to: e.target.value })} className={inputCls} /></Field>
      </div>

      {provider === 'smtp' && (
        <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2">
          <Field label="Hôte SMTP"><input value={s.smtp_host ?? ''} onChange={(e) => upd({ smtp_host: e.target.value })} className={inputCls} placeholder="smtp.hotel.com" /></Field>
          <Field label="Port"><input type="number" value={s.smtp_port ?? ''} onChange={(e) => upd({ smtp_port: Number(e.target.value) || null })} className={inputCls} placeholder="587" /></Field>
          <Field label="Utilisateur SMTP"><input value={s.smtp_username ?? ''} onChange={(e) => upd({ smtp_username: e.target.value })} className={inputCls} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={Boolean(s.smtp_secure)} onChange={(e) => upd({ smtp_secure: e.target.checked })} className="h-4 w-4 rounded text-violet-600" />TLS / SSL
          </label>
          <div className="md:col-span-2"><SecretField label="Mot de passe SMTP" present={secrets.smtp_password} onSave={(v) => setSecret('email', 'smtp_password', v).then(refreshSecrets)} /></div>
        </div>
      )}

      {provider === 'resend' && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <SecretField label="Clé API Resend" present={secrets.api_key} onSave={(v) => setSecret('email', 'api_key', v).then(refreshSecrets)} placeholder="re_..." />
        </div>
      )}

      {(provider === 'gmail_oauth' || provider === 'microsoft_graph') && (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="flex items-start gap-2 text-sm text-slate-600"><Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            Le flux de consentement OAuth (écran d'autorisation Google/Microsoft) doit être réalisé côté hôtel pour obtenir l'access/refresh token. Collez ensuite les tokens obtenus ci-dessous. Flowtym les renouvelle automatiquement.</p>
          <Field label="Compte email mappé"><input value={s.oauth_account ?? ''} onChange={(e) => upd({ oauth_account: e.target.value })} className={inputCls} placeholder="reception@hotel.com" /></Field>
          <SecretField label="Access token" present={secrets.access_token} onSave={(v) => setSecret('email', 'access_token', v).then(refreshSecrets)} />
          <SecretField label="Refresh token" present={secrets.refresh_token} onSave={(v) => setSecret('email', 'refresh_token', v).then(refreshSecrets)} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Enregistrer
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 p-4">
        <p className="mb-2 text-xs font-bold text-slate-500">Tester l'envoi</p>
        <div className="flex gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputCls} placeholder="votre@email.com" />
          <button onClick={runTest} disabled={testing || !testTo} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-700 disabled:opacity-40">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Tester
          </button>
        </div>
        {testMsg && (
          <div className={cn('mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm', testMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {testMsg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}<span>{testMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────

const WhatsAppPanel: React.FC = () => {
  const [s, setS] = useState<Partial<WhatsAppSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const refreshSecrets = async () => {
    const [token, verify] = await Promise.all([
      hasSecret('whatsapp', 'access_token'), hasSecret('whatsapp', 'webhook_verify_token'),
    ]);
    setSecrets({ access_token: token, webhook_verify_token: verify });
  };

  useEffect(() => {
    (async () => {
      try { const data = await getWhatsAppSettings(); if (data) setS(data); await refreshSecrets(); }
      finally { setLoading(false); }
    })();
  }, []);

  const upd = (patch: Partial<WhatsAppSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const save = async () => { setSaving(true); try { const saved = await saveWhatsAppSettings(s); setS(saved); } finally { setSaving(false); } };
  const runTest = async () => {
    if (!testTo) return;
    setTesting(true); setTestMsg(null);
    const r = await testWhatsApp(testTo);
    setTestMsg({ ok: r.ok, text: r.message });
    setTesting(false);
    const data = await getWhatsAppSettings(); if (data) setS(data);
  };

  if (loading) return <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusPill status={s.connection_status} active={s.is_active} />
          {s.last_error && <span className="text-xs text-red-500">{s.last_error}</span>}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(s.is_active)} onChange={(e) => upd({ is_active: e.target.checked })} className="h-4 w-4 rounded text-emerald-600" />
          Activer WhatsApp
        </label>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
          WhatsApp nécessite un compte WhatsApp Business de l'hôtel et peut générer des frais Meta selon les messages envoyés. Chaque hôtel connecte son PROPRE WhatsApp Business Account.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Meta Business ID"><input value={s.meta_business_id ?? ''} onChange={(e) => upd({ meta_business_id: e.target.value })} className={inputCls} /></Field>
        <Field label="WhatsApp Business Account ID (WABA)"><input value={s.waba_id ?? ''} onChange={(e) => upd({ waba_id: e.target.value })} className={inputCls} /></Field>
        <Field label="Phone Number ID"><input value={s.phone_number_id ?? ''} onChange={(e) => upd({ phone_number_id: e.target.value })} className={inputCls} /></Field>
        <Field label="Numéro affiché" hint="ex: +33 1 23 45 67 89"><input value={s.display_phone_number ?? ''} onChange={(e) => upd({ display_phone_number: e.target.value })} className={inputCls} /></Field>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
        <SecretField label="Access Token (permanent / system user)" present={secrets.access_token} onSave={(v) => setSecret('whatsapp', 'access_token', v).then(refreshSecrets)} placeholder="EAA..." />
        <SecretField label="Webhook verify token" present={secrets.webhook_verify_token} onSave={(v) => setSecret('whatsapp', 'webhook_verify_token', v).then(refreshSecrets)} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Enregistrer
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 p-4">
        <p className="mb-2 text-xs font-bold text-slate-500">Tester l'envoi (texte libre — nécessite une fenêtre client 24h ouverte)</p>
        <div className="flex gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputCls} placeholder="+33612345678" />
          <button onClick={runTest} disabled={testing || !testTo} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 text-xs font-bold text-emerald-700 disabled:opacity-40">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Tester
          </button>
        </div>
        {testMsg && (
          <div className={cn('mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm', testMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {testMsg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}<span>{testMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export const CommunicationSettingsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('email');
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">Réservations · Communication</span>
      </div>
      <h1 className="text-2xl font-black text-slate-900">Communication client</h1>
      <p className="mt-1 text-sm text-slate-500">Connectez l'email et le WhatsApp Business de l'hôtel pour envoyer des messages réels depuis Flowday.</p>

      <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <button onClick={() => setTab('email')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors', tab === 'email' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={16} />Email hôtel</button>
        <button onClick={() => setTab('whatsapp')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors', tab === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={16} />WhatsApp Business</button>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        {tab === 'email' ? <EmailPanel /> : <WhatsAppPanel />}
      </div>
    </div>
  );
};

export default CommunicationSettingsPage;
