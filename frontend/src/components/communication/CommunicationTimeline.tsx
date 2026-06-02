/**
 * FLOWTYM — Journal Unifié des communications (L3).
 *
 * Timeline chronologique UNIQUE et transverse : emails, WhatsApp, SMS, notes
 * internes et actions CRM (badges, incidents), agrégés côté serveur par la RPC
 * communication_timeline. Réutilisée à 3 emplacements (fiche client, fiche
 * réservation, Flowday). Données réelles uniquement.
 */
import React, { useMemo, useState } from 'react';
import {
  Mail, MessageCircle, Smartphone, StickyNote, Tag, AlertTriangle,
  Clock, Loader2, Send, Paperclip, RefreshCw, ArrowDownLeft, ArrowUpRight, Search,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useCommunicationTimeline, useAddInternalNote } from '@/src/services/communication/useCommunicationTimeline';
import type { TimelineEntry, TimelineScope } from '@/src/services/communication/timeline.service';

// ─── Config visuelle par canal / type ────────────────────────────────────────

interface ChannelCfg { label: string; icon: React.ReactNode; color: string; bg: string; dot: string; }

function entryCfg(e: TimelineEntry): ChannelCfg {
  if (e.entry_type === 'note') return { label: 'Note interne', icon: <StickyNote size={13} />, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' };
  if (e.entry_type === 'badge') return { label: 'Badge', icon: <Tag size={13} />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' };
  if (e.entry_type === 'incident') return { label: 'Incident', icon: <AlertTriangle size={13} />, color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-400' };
  switch (e.channel) {
    case 'whatsapp': return { label: 'WhatsApp', icon: <MessageCircle size={13} />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
    case 'sms':      return { label: 'SMS', icon: <Smartphone size={13} />, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500' };
    default:         return { label: 'Email', icon: <Mail size={13} />, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' };
  }
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'En file', sent: 'Envoyé', delivered: 'Livré', read: 'Lu', failed: 'Échec',
  updated: 'Mis à jour', note: 'Note',
};

const fmtTime = (s: string) => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDayKey = (s: string) => new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// ─── Ligne d'entrée ───────────────────────────────────────────────────────────

function EntryRow({ e }: { key?: React.Key; e: TimelineEntry }) {
  const cfg = entryCfg(e);
  const isInbound = e.direction === 'inbound';
  const statusLabel = e.status ? (STATUS_LABEL[e.status] ?? e.status) : null;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', cfg.dot)} />
        <span className="mt-1 w-px flex-1 bg-slate-100" />
      </div>
      <div className={cn('mb-3 flex-1 rounded-xl border p-3', cfg.bg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cfg.color}>{cfg.icon}</span>
            <span className={cn('text-xs font-bold', cfg.color)}>{cfg.label}</span>
            {e.direction && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                {isInbound ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                {isInbound ? 'Reçu' : 'Envoyé'}
              </span>
            )}
            {statusLabel && (
              <span className={cn('rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold',
                e.status === 'failed' ? 'text-red-600' : cfg.color)}>{statusLabel}</span>
            )}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtTime(e.occurred_at)}</span>
        </div>

        {e.subject && e.entry_type === 'message' && (
          <p className="mt-1.5 text-sm font-semibold text-slate-800">{e.subject}</p>
        )}
        {e.body && (
          <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-slate-600 line-clamp-4">{e.body}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-slate-500">{isInbound ? 'Client' : (e.actor_name ?? 'Système')}</span>
          </span>
          {e.contact_address && <span className="font-mono">{e.contact_address}</span>}
          {e.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-500"><Paperclip size={11} />{e.attachments.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export interface CommunicationTimelineProps {
  scope: TimelineScope;
  /** N'active la requête que lorsque le conteneur est visible (lazy). */
  enabled?: boolean;
  title?: string;
  /** Afficher le composeur de note interne. */
  allowNotes?: boolean;
  /** Mode compact : nombre d'entrées limité (fiche client). */
  maxItems?: number;
  className?: string;
}

export function CommunicationTimeline({
  scope, enabled = true, title = 'Journal des communications', allowNotes = true, maxItems, className,
}: CommunicationTimelineProps) {
  const { data: entries = [], isLoading, isError, refetch, isFetching } = useCommunicationTimeline(scope, { enabled });
  const addNote = useAddInternalNote(scope);

  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const filtered = useMemo(() => {
    let list = entries;
    if (channelFilter !== 'all') {
      list = list.filter((e) =>
        channelFilter === 'crm'
          ? (e.entry_type === 'badge' || e.entry_type === 'incident')
          : channelFilter === 'note'
            ? e.entry_type === 'note'
            : e.channel === channelFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => (e.subject ?? '').toLowerCase().includes(q) || (e.body ?? '').toLowerCase().includes(q) || (e.actor_name ?? '').toLowerCase().includes(q));
    }
    return maxItems ? list.slice(0, maxItems) : list;
  }, [entries, channelFilter, search, maxItems]);

  const groups = useMemo(() => {
    const m = new Map<string, TimelineEntry[]>();
    for (const e of filtered) {
      const k = fmtDayKey(e.occurred_at);
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const submitNote = async () => {
    const body = noteBody.trim();
    if (!body) return;
    await addNote.mutateAsync(body);
    setNoteBody('');
  };

  const channels = [
    { key: 'all', label: 'Tous' },
    { key: 'email', label: 'Email' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'sms', label: 'SMS' },
    { key: 'note', label: 'Notes' },
    { key: 'crm', label: 'CRM' },
  ];

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Clock size={15} className="text-violet-600" />{title}</h3>
        <button onClick={() => refetch()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />Rafraîchir
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {channels.map((c) => (
            <button key={c.key} onClick={() => setChannelFilter(c.key)}
              className={cn('rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors',
                channelFilter === c.key ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Chargement…</div>
        ) : isError ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">Impossible de charger le journal. <button onClick={() => refetch()} className="font-bold underline">Réessayer</button></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Aucune communication pour le moment.</div>
        ) : (
          groups.map(([day, items]) => (
            <div key={day} className="mb-2">
              <p className="sticky top-0 z-10 mb-2 bg-white/80 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 backdrop-blur first-letter:uppercase">{day}</p>
              {items.map((e) => <EntryRow key={`${e.entry_type}-${e.entry_id}`} e={e} />)}
            </div>
          ))
        )}
      </div>

      {allowNotes && (
        <div className="mt-2 border-t border-slate-100 pt-3">
          <div className="flex items-end gap-2">
            <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={2} placeholder="Ajouter une note interne…"
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <button onClick={submitNote} disabled={addNote.isPending || !noteBody.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white shadow disabled:opacity-40">
              {addNote.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunicationTimeline;
