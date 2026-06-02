/**
 * FLOWTYM — Paramètres · Communication · WhatsApp Business.
 *
 * Chaque hôtel connecte SON PROPRE WhatsApp Business Account (Cloud API Meta).
 * Token stocké côté serveur, jamais exposé. Test d'envoi réel.
 */
import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, CheckCircle2, AlertTriangle, Loader2, Save } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getWhatsAppSettings, saveWhatsAppSettings, setSecret, hasSecret, testWhatsApp,
  type WhatsAppSettings,
} from '@/src/services/communication/communicationSettings.service';
import { CommHeader, CommPage, StatusPill, Field, SecretField, inputCls } from './shared';

export const WhatsAppSettingsPage: React.FC = () => {
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

  return (
    <CommPage>
      <CommHeader eyebrow="Communication" title="WhatsApp Business" subtitle="Connectez le compte WhatsApp Business de l'hôtel (Cloud API Meta)." icon={<MessageCircle size={16} className="text-emerald-600" />} />
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>
        ) : (
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
        )}
      </div>
    </CommPage>
  );
};

export default WhatsAppSettingsPage;
