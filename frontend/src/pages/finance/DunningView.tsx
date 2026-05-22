/**
 * FLOWTYM — Relances automatiques (Vague F5)
 *
 * Workflow de dunning : synchronisation des débiteurs depuis les
 * réservations impayées, modèles de relance configurables (J+7 / J+15 /
 * J+30), campagne automatique en un clic, envoi manuel et historique.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Send, Mail, MessageSquare, Mailbox, RefreshCw, Loader2, Settings2,
  Zap, AlertCircle, CheckCircle2, Clock, TrendingDown, History, X,
  FileText, Eye, BadgeCheck, Save, Hourglass, Coins,
} from 'lucide-react';
import {
  getDunningSettings, saveDunningTemplate, syncDebtors, getDunningQueue,
  getDunningDashboard, listDunningDebtors, previewDunning, sendDunning,
  runDunningAuto, getDunningHistory, markDebtorPaid,
  type DunningTemplate, type DunningDebtor, type DunningDashboard,
  type DunningLog, type DunningPreview, type DunningChannel, type DunningTone,
  type DebtorStatus,
} from '../../services/finance/dunning.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');
const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const CHANNEL: Record<DunningChannel, { label: string; icon: typeof Mail }> = {
  email:  { label: 'Email',   icon: Mail },
  sms:    { label: 'SMS',     icon: MessageSquare },
  postal: { label: 'Courrier',icon: Mailbox },
};

const TONE: Record<DunningTone, { label: string; color: string; bg: string }> = {
  courteous: { label: 'Courtois', color: 'text-blue-700',  bg: 'bg-blue-100' },
  firm:      { label: 'Ferme',    color: 'text-amber-700', bg: 'bg-amber-100' },
  formal:    { label: 'Formel',   color: 'text-red-700',   bg: 'bg-red-100' },
};

const STATUS: Record<DebtorStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Ouvert',    color: 'text-amber-700',   bg: 'bg-amber-100' },
  partial:     { label: 'Partiel',   color: 'text-blue-700',    bg: 'bg-blue-100' },
  paid:        { label: 'Soldé',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  written_off: { label: 'Passé perte',color: 'text-gray-600',   bg: 'bg-gray-100' },
  disputed:    { label: 'Litige',    color: 'text-red-700',     bg: 'bg-red-100' },
};

// ─── KPI ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon: typeof Mail;
  tone: 'violet' | 'red' | 'amber' | 'emerald' | 'blue';
}) {
  const c = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3.5', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{label}</span>
        <Icon className={cn('w-4 h-4', c.text)} strokeWidth={1.75} />
      </div>
      <div className={cn('text-2xl font-extrabold', c.text)}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

function LevelPill({ level }: { level: number }) {
  if (!level) return <span className="text-[11px] text-gray-400">Aucune</span>;
  const color = level >= 3 ? 'bg-red-100 text-red-700'
    : level === 2 ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', color)}>
      Niveau {level}
    </span>
  );
}

// ─── Templates Modal ─────────────────────────────────────────────────────

const VARS = ['{{guest_name}}', '{{company_name}}', '{{balance}}', '{{reference}}', '{{due_date}}', '{{days_overdue}}', '{{hotel_name}}'];

function TemplatesModal({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<DunningTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [draft, setDraft] = useState<DunningTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getDunningSettings();
      setTemplates(t);
      setDraft(t[0] ?? null);
      setActiveIdx(0);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectTpl = (idx: number) => {
    setActiveIdx(idx);
    setDraft(templates[idx]);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDunningTemplate({
        id: draft.id,
        level: draft.level,
        name: draft.name,
        trigger_days: draft.trigger_days,
        channel: draft.channel,
        subject: draft.subject,
        body: draft.body,
        tone: draft.tone,
        active: draft.active,
      });
      setTemplates(prev => prev.map((t, i) => (i === activeIdx ? saved : t)));
      setDraft(saved);
    } catch (e: any) {
      setError(e?.message ?? 'Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col" style={{ height: 'min(680px, 90vh)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Modèles de relance</h3>
              <p className="text-xs text-gray-500">Escalade configurable et variables dynamiques</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !draft ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Levels list */}
            <div className="w-44 border-r border-gray-100 p-2 space-y-1 shrink-0 overflow-y-auto">
              {templates.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => selectTpl(i)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg transition-colors',
                    i === activeIdx ? 'bg-violet-600 text-white' : 'hover:bg-gray-100',
                  )}
                >
                  <div className="text-xs font-bold">Niveau {t.level}</div>
                  <div className={cn('text-[11px] truncate', i === activeIdx ? 'text-violet-100' : 'text-gray-500')}>
                    {t.name}
                  </div>
                  <div className={cn('text-[10px] mt-0.5', i === activeIdx ? 'text-violet-200' : 'text-gray-400')}>
                    J+{t.trigger_days} · {CHANNEL[t.channel].label}
                  </div>
                </button>
              ))}
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Nom du modèle">
                  <input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </Labeled>
                <Labeled label="Déclenchement (jours de retard)">
                  <input
                    type="number" min={0}
                    value={draft.trigger_days}
                    onChange={e => setDraft({ ...draft, trigger_days: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </Labeled>
                <Labeled label="Canal">
                  <select
                    value={draft.channel}
                    onChange={e => setDraft({ ...draft, channel: e.target.value as DunningChannel })}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                  >
                    {Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Ton">
                  <select
                    value={draft.tone}
                    onChange={e => setDraft({ ...draft, tone: e.target.value as DunningTone })}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                  >
                    {Object.entries(TONE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Labeled>
              </div>

              <Labeled label="Objet">
                <input
                  value={draft.subject}
                  onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </Labeled>

              <Labeled label="Corps du message">
                <textarea
                  value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  rows={8}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                />
              </Labeled>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1 self-center">Variables :</span>
                {VARS.map(v => (
                  <button
                    key={v}
                    onClick={() => setDraft({ ...draft, body: draft.body + ' ' + v })}
                    className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-mono font-bold hover:bg-violet-100"
                  >
                    {v}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={e => setDraft({ ...draft, active: e.target.checked })}
                  className="accent-violet-600"
                />
                Modèle actif (utilisé par la campagne automatique)
              </label>

              {error && (
                <div className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Fermer
          </button>
          <button
            onClick={save}
            disabled={saving || !draft}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Send / Preview Modal ────────────────────────────────────────────────

function SendModal({
  debtor, level, onClose, onSent,
}: {
  debtor: DunningDebtor;
  level: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [preview, setPreview] = useState<DunningPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewDunning(debtor.debtor_id, level)
      .then(p => { if (!cancelled) setPreview(p); })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Erreur'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debtor.debtor_id, level]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await sendDunning(debtor.debtor_id, level);
      onSent();
    } catch (e: any) {
      setError(e?.message ?? 'Échec de l\'envoi');
      setSending(false);
    }
  };

  const Channel = preview ? CHANNEL[preview.channel].icon : Mail;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Channel className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Relance niveau {level}</h3>
              <p className="text-xs text-gray-500">{debtor.guest_name} · {fmtEur(debtor.balance)} dû</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Préparation…
            </div>
          ) : !preview ? (
            <div className="text-sm text-red-600 text-center">{error ?? 'Aperçu indisponible'}</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500">Canal :</span>
                <span className="text-xs font-bold text-gray-800">{CHANNEL[preview.channel].label}</span>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', TONE[preview.tone].bg, TONE[preview.tone].color)}>
                  {TONE[preview.tone].label}
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Objet</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{preview.subject}</div>
                </div>
                <div className="px-3 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {preview.body}
                </div>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending || loading || !preview}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer la relance
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Modal ───────────────────────────────────────────────────────

function HistoryModal({ debtor, onClose }: { debtor: DunningDebtor; onClose: () => void }) {
  const [logs, setLogs] = useState<DunningLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDunningHistory(debtor.debtor_id)
      .then(l => { if (!cancelled) setLogs(l); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debtor.debtor_id]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <History className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Historique des relances</h3>
              <p className="text-xs text-gray-500">{debtor.guest_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-300">
              <Mail className="w-7 h-7 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-xs font-medium">Aucune relance envoyée</p>
            </div>
          ) : (
            logs.map((l, i) => {
              const Ch = CHANNEL[l.channel].icon;
              return (
                <div key={l.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Ch className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <LevelPill level={l.level} />
                      <span className="text-[10px] text-gray-400">{fmtDateTime(l.sent_at)}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-800 mt-1">{l.subject}</div>
                    <div className="text-[11px] text-gray-500 whitespace-pre-wrap mt-0.5 line-clamp-3">{l.body}</div>
                    <div className="flex gap-2 mt-1">
                      {l.delivered && <Tag ok label="Délivré" />}
                      {l.opened && <Tag ok label="Ouvert" />}
                      {l.responded && <Tag ok label="Répondu" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold',
      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
    )}>
      <CheckCircle2 className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────

function Toast({ msg, tone }: { msg: string; tone: 'ok' | 'err' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[300] px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2',
      tone === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
    )}>
      {tone === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────

export const DunningView: React.FC = () => {
  const [dashboard, setDashboard] = useState<DunningDashboard | null>(null);
  const [debtors, setDebtors] = useState<DunningDebtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'due' | 'open' | 'all'>('due');
  const [busy, setBusy] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [sendTarget, setSendTarget] = useState<{ debtor: DunningDebtor; level: number } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<DunningDebtor | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([getDunningDashboard(), listDunningDebtors()]);
      setDashboard(d);
      setDebtors(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSync = async () => {
    setBusy('sync');
    try {
      const r = await syncDebtors();
      await reload();
      flash(`${r.created} débiteur(s) créé(s), ${r.updated} mis à jour`);
    } catch (e: any) {
      flash(e?.message ?? 'Échec de la synchronisation', 'err');
    } finally {
      setBusy(null);
    }
  };

  const handleRunAuto = async () => {
    setBusy('auto');
    try {
      const r = await runDunningAuto();
      await reload();
      flash(r.processed > 0
        ? `Campagne terminée — ${r.processed} relance(s) envoyée(s)`
        : 'Aucune relance à envoyer pour le moment');
    } catch (e: any) {
      flash(e?.message ?? 'Échec de la campagne', 'err');
    } finally {
      setBusy(null);
    }
  };

  const handleMarkPaid = async (d: DunningDebtor) => {
    setBusy(d.debtor_id);
    try {
      await markDebtorPaid(d.debtor_id);
      await reload();
      flash(`${d.guest_name} marqué comme soldé`);
    } catch (e: any) {
      flash(e?.message ?? 'Erreur', 'err');
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return debtors;
    if (filter === 'due') return debtors.filter(d => d.is_due);
    return debtors.filter(d => d.balance > 0 && d.status !== 'paid');
  }, [debtors, filter]);

  const queueDue = dashboard?.queue_due ?? 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Débiteurs ouverts" value={String(dashboard?.debtors_open ?? 0)} icon={FileText} tone="amber" />
        <KpiCard label="Encours total" value={fmtEur(dashboard?.total_outstanding ?? 0)} icon={TrendingDown} tone="red" />
        <KpiCard label="Relances dues" value={String(queueDue)} sub="à traiter maintenant" icon={Clock} tone="violet" />
        <KpiCard label="Relances envoyées" value={String(dashboard?.relances.total ?? 0)}
          sub={`${dashboard?.relances.response_rate ?? 0}% de réponse`} icon={Send} tone="blue" />
        <KpiCard label="Recouvré" value={fmtEur(dashboard?.recovered_amount ?? 0)}
          sub={`${dashboard?.recovered_count ?? 0} dossier(s)`} icon={Coins} tone="emerald" />
      </div>

      {/* Campaign banner */}
      <div className={cn(
        'rounded-lg border p-4 flex items-center gap-3',
        queueDue > 0 ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200',
      )}>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          queueDue > 0 ? 'bg-violet-600' : 'bg-gray-300')}>
          <Zap className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900">
            {queueDue > 0
              ? `${queueDue} relance(s) prête(s) à être envoyée(s)`
              : 'Aucune relance en attente'}
          </div>
          <div className="text-xs text-gray-500">
            La campagne automatique applique chaque modèle actif aux débiteurs ayant atteint son seuil de retard.
          </div>
        </div>
        <button
          onClick={handleRunAuto}
          disabled={busy === 'auto' || queueDue === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-600/20 shrink-0"
        >
          {busy === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Lancer la campagne
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Filtres :</span>
        {(['due', 'open', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded',
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700',
            )}
          >
            {f === 'due' ? 'Relance due' : f === 'open' ? 'Impayés' : 'Tous'}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-1">{filtered.length} dossier(s)</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={busy === 'sync'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-40"
          >
            {busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Synchroniser débiteurs
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100"
          >
            <Settings2 className="w-3.5 h-3.5" /> Modèles
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 flex items-center justify-center">
            <BadgeCheck className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mt-3">
            {debtors.length === 0 ? 'Aucun débiteur' : 'Rien à relancer'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {debtors.length === 0
              ? 'Synchronisez les débiteurs depuis les réservations impayées pour démarrer.'
              : 'Aucun dossier ne correspond à ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[11px] uppercase tracking-wider text-gray-600">
                <th className="px-3 py-2.5 text-left font-bold">Débiteur</th>
                <th className="px-3 py-2.5 text-right font-bold">Solde dû</th>
                <th className="px-3 py-2.5 text-center font-bold">Retard</th>
                <th className="px-3 py-2.5 text-center font-bold">Statut</th>
                <th className="px-3 py-2.5 text-center font-bold">Dernière relance</th>
                <th className="px-3 py-2.5 text-left font-bold">Prochaine action</th>
                <th className="px-3 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const rowBusy = busy === d.debtor_id;
                return (
                  <tr key={d.debtor_id} className={cn('hover:bg-gray-50', d.is_due && 'bg-violet-50/30')}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-900">{d.guest_name}</div>
                      <div className="text-[11px] text-gray-500">
                        {d.company_name && <span>{d.company_name} · </span>}
                        <span className="font-mono">{d.reference ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-700 tabular-nums">{fmtEur(d.balance)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {d.days_overdue > 0 ? (
                        <span className={cn('text-xs font-bold', d.days_overdue >= 30 ? 'text-red-600' : 'text-amber-600')}>
                          {d.days_overdue} j
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">à échoir</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold', STATUS[d.status].bg, STATUS[d.status].color)}>
                        {STATUS[d.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <LevelPill level={d.reminder_count} />
                      {d.last_reminder_at && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{fmtDate(d.last_reminder_at)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {d.status === 'paid' ? (
                        <span className="text-[11px] text-emerald-600 font-semibold">Soldé</span>
                      ) : d.is_due ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700">
                          <Hourglass className="w-3 h-3" />
                          {d.next_template} (niv. {d.next_level})
                        </span>
                      ) : d.next_template ? (
                        <span className="text-[11px] text-gray-500">
                          {d.next_template} à J+{d.next_trigger_days}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">Cycle terminé</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {d.status !== 'paid' && d.balance > 0 && d.next_template && (
                          <button
                            onClick={() => setSendTarget({ debtor: d, level: d.next_level })}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold',
                              d.is_due
                                ? 'text-white bg-violet-600 hover:bg-violet-700'
                                : 'text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100',
                            )}
                          >
                            <Send className="w-3 h-3" /> Relancer
                          </button>
                        )}
                        <button
                          onClick={() => setHistoryTarget(d)}
                          title="Historique"
                          className="p-1 rounded text-gray-500 hover:bg-gray-100"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {d.status !== 'paid' && d.balance > 0 && (
                          <button
                            onClick={() => handleMarkPaid(d)}
                            disabled={rowBusy}
                            title="Marquer soldé"
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            {rowBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex items-start gap-3 text-sm">
        <Eye className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-violet-900">
          <strong>Workflow de relances en escalade</strong>
          <div className="text-xs text-violet-700 mt-1">
            Chaque modèle se déclenche à un seuil de retard configurable. La campagne automatique
            envoie le niveau de relance approprié à chaque débiteur ; l'historique de chaque envoi
            est tracé dans <code className="bg-white px-1 rounded">dunning_logs</code>.
          </div>
        </div>
      </div>

      {showTemplates && <TemplatesModal onClose={() => { setShowTemplates(false); reload(); }} />}
      {sendTarget && (
        <SendModal
          debtor={sendTarget.debtor}
          level={sendTarget.level}
          onClose={() => setSendTarget(null)}
          onSent={() => { setSendTarget(null); reload(); flash('Relance envoyée'); }}
        />
      )}
      {historyTarget && (
        <HistoryModal debtor={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
};
