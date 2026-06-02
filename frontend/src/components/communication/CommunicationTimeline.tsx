/**
 * FLOWTYM — Journal Client 360° (L3.1).
 *
 * Timeline UNIQUE, chronologique et transverse : communication (email/SMS/
 * WhatsApp/notes), CRM (badges/incidents), cycle de vie réservation et finance,
 * agrégés côté serveur (RPC communication_timeline_v2). Filtres serveur,
 * pagination infinie keyset, virtualisation, pièces jointes (download signé +
 * upload). Données réelles uniquement.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Mail, MessageCircle, Smartphone, StickyNote, Tag, AlertTriangle, CalendarCheck,
  CreditCard, Clock, Loader2, Send, Paperclip, RefreshCw, ArrowDownLeft, ArrowUpRight,
  Search, Filter, Download, Plus,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  useTimeline360, useAddInternalNote, useUploadAttachment,
} from '@/src/services/communication/useCommunicationTimeline';
import { getAttachmentUrl } from '@/src/services/communication/attachments.service';
import type {
  TimelineEntry, TimelineScope, TimelineCategory, Timeline360Filters, TimelineAttachment,
} from '@/src/services/communication/timeline.service';

// ─── Config visuelle ──────────────────────────────────────────────────────────

interface Cfg { label: string; icon: React.ReactNode; color: string; bg: string; dot: string; }

function entryCfg(e: TimelineEntry): Cfg {
  const cat = e.category;
  if (cat === 'note' || e.entry_type === 'note') return { label: 'Note interne', icon: <StickyNote size={13} />, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' };
  if (cat === 'incident' || e.entry_type === 'incident') return { label: 'Incident', icon: <AlertTriangle size={13} />, color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-400' };
  if (cat === 'crm' || e.entry_type === 'badge') return { label: 'CRM', icon: <Tag size={13} />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' };
  if (cat === 'reservation' || e.entry_type === 'reservation') return { label: 'Réservation', icon: <CalendarCheck size={13} />, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' };
  if (cat === 'finance' || e.entry_type === 'finance') return { label: 'Finance', icon: <CreditCard size={13} />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
  if (e.entry_type === 'attachment') return { label: 'Document', icon: <Paperclip size={13} />, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500' };
  switch (e.channel) {
    case 'whatsapp': return { label: 'WhatsApp', icon: <MessageCircle size={13} />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
    case 'sms':      return { label: 'SMS', icon: <Smartphone size={13} />, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500' };
    default:         return { label: 'Email', icon: <Mail size={13} />, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' };
  }
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'En file', sent: 'Envoyé', delivered: 'Livré', read: 'Lu', failed: 'Échec',
};
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (s: string) => new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const dayKey = (s: string) => new Date(s).toISOString().slice(0, 10);

const CATEGORIES: { key: 'all' | TimelineCategory; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'communication', label: 'Communication' },
  { key: 'crm', label: 'CRM' },
  { key: 'reservation', label: 'Réservation' },
  { key: 'finance', label: 'Finance' },
  { key: 'incident', label: 'Incidents' },
  { key: 'note', label: 'Notes internes' },
];

// ─── Pièce jointe (download signé) ────────────────────────────────────────────

const AttachmentChip: React.FC<{ att: TimelineAttachment }> = ({ att }) => {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    if (!att.path) return;
    setLoading(true);
    const url = await getAttachmentUrl(att.path);
    setLoading(false);
    if (url) window.open(url, '_blank', 'noopener');
  };
  return (
    <button onClick={open} disabled={loading}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
      <span className="max-w-[160px] truncate">{att.name ?? 'pièce jointe'}</span>
      <Download size={11} className="text-slate-400" />
    </button>
  );
};

// ─── Ligne ────────────────────────────────────────────────────────────────────

const EntryRow: React.FC<{ e: TimelineEntry }> = ({ e }) => {
  const cfg = entryCfg(e);
  const isInbound = e.direction === 'inbound';
  const statusLabel = e.status && STATUS_LABEL[e.status] ? STATUS_LABEL[e.status] : null;
  return (
    <div className="flex gap-3 px-1 pb-3">
      <div className="flex flex-col items-center">
        <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', cfg.dot)} />
        <span className="mt-1 w-px flex-1 bg-slate-100" />
      </div>
      <div className={cn('flex-1 rounded-xl border p-3', cfg.bg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cfg.color}>{cfg.icon}</span>
            <span className={cn('text-xs font-bold', cfg.color)}>{cfg.label}</span>
            {e.direction && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                {isInbound ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}{isInbound ? 'Reçu' : 'Envoyé'}
              </span>
            )}
            {statusLabel && <span className={cn('rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold', e.status === 'failed' ? 'text-red-600' : cfg.color)}>{statusLabel}</span>}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtTime(e.occurred_at)}</span>
        </div>
        {e.subject && <p className="mt-1.5 text-sm font-semibold text-slate-800">{e.subject}</p>}
        {e.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-slate-600 line-clamp-4">{e.body}</p>}
        {e.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">{e.attachments.map((a, i) => <AttachmentChip key={a.id ?? i} att={a} />)}</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-500">{isInbound ? 'Client' : (e.actor_name ?? 'Système')}</span>
          {e.contact_address && <span className="font-mono">{e.contact_address}</span>}
        </div>
      </div>
    </div>
  );
};

// ─── Items virtualisés (jour + entrées) ───────────────────────────────────────

type Item = { kind: 'day'; key: string; label: string } | { kind: 'entry'; key: string; entry: TimelineEntry };

// ─── Composant principal ──────────────────────────────────────────────────────

export interface CommunicationTimelineProps {
  scope: TimelineScope;
  enabled?: boolean;
  title?: string;
  allowNotes?: boolean;
  allowAttachments?: boolean;
  className?: string;
}

export function CommunicationTimeline({
  scope, enabled = true, title = 'Journal des communications',
  allowNotes = true, allowAttachments = true, className,
}: CommunicationTimelineProps) {
  const [category, setCategory] = useState<'all' | TimelineCategory>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [channel, setChannel] = useState<string>('all');
  const [actor, setActor] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [noteBody, setNoteBody] = useState('');

  // Recherche debouncée (filtre serveur)
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const filters: Timeline360Filters = useMemo(() => ({
    categories: category === 'all' ? undefined : [category],
    channels: channel === 'all' ? undefined : [channel],
    actor: actor === 'all' ? undefined : actor,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    search: debounced || undefined,
  }), [category, channel, actor, from, to, debounced]);

  const q = useTimeline360(scope, filters, { enabled });
  const addNote = useAddInternalNote(scope);
  const upload = useUploadAttachment(scope);

  const entries = useMemo<TimelineEntry[]>(() => (q.data?.pages.flat() ?? []) as TimelineEntry[], [q.data]);

  // Liste des acteurs présents (pour le filtre utilisateur)
  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) if (e.actor_user_id && e.actor_name) m.set(e.actor_user_id, e.actor_name);
    return Array.from(m.entries());
  }, [entries]);

  // Construction des items (séparateurs de jour + entrées)
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let cur = '';
    for (const e of entries) {
      const k = dayKey(e.occurred_at);
      if (k !== cur) { cur = k; out.push({ kind: 'day', key: `day-${k}`, label: fmtDay(e.occurred_at) }); }
      out.push({ kind: 'entry', key: `${e.entry_type}-${e.entry_id}`, entry: e });
    }
    return out;
  }, [entries]);

  // Virtualisation
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i]?.kind === 'day' ? 32 : 104),
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Pagination infinie : charger plus en bas
  const vItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = vItems[vItems.length - 1];
    if (last && last.index >= items.length - 1 && q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [vItems, items.length, q]);

  const submitNote = async () => {
    const body = noteBody.trim();
    if (!body) return;
    await addNote.mutateAsync(body);
    setNoteBody('');
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload.mutateAsync({ file, kind: 'other', direction: 'internal' });
  };

  const channelOpts = [
    { k: 'all', l: 'Tous canaux' }, { k: 'email', l: 'Email' },
    { k: 'whatsapp', l: 'WhatsApp' }, { k: 'sms', l: 'SMS' }, { k: 'internal', l: 'Interne' },
  ];
  const selectCls = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400';

  return (
    <div className={cn('flex flex-col', className)}>
      {/* En-tête */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Clock size={15} className="text-violet-600" />{title}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowFilters((v) => !v)} className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold', showFilters ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}><Filter size={12} />Filtres</button>
          <button onClick={() => q.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50"><RefreshCw size={12} className={q.isFetching ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* Catégories */}
      <div className="mb-2 flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={cn('rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors', category === c.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700')}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Barre de recherche + filtres avancés */}
      <div className="mb-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        {showFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls}>
              {channelOpts.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
            </select>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={selectCls}>
              <option value="all">Tous utilisateurs</option>
              {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">Du<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} /></label>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">Au<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} /></label>
          </div>
        )}
      </div>

      {/* Liste virtualisée */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1" style={{ minHeight: 120 }}>
        {q.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Chargement…</div>
        ) : q.isError ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">Impossible de charger le journal. <button onClick={() => q.refetch()} className="font-bold underline">Réessayer</button></div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Aucun événement pour ces critères.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {vItems.map((vi) => {
              const item = items[vi.index];
              return (
                <div key={item.key} data-index={vi.index} ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
                  {item.kind === 'day'
                    ? <p className="py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 first-letter:uppercase">{item.label}</p>
                    : <EntryRow e={item.entry} />}
                </div>
              );
            })}
          </div>
        )}
        {q.isFetchingNextPage && <div className="flex justify-center py-3 text-slate-400"><Loader2 size={16} className="animate-spin" /></div>}
      </div>

      {/* Composeur note + upload */}
      {(allowNotes || allowAttachments) && (
        <div className="mt-2 border-t border-slate-100 pt-3">
          <div className="flex items-end gap-2">
            {allowNotes && (
              <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={2} placeholder="Ajouter une note interne…"
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            )}
            <div className="flex flex-col gap-1.5">
              {allowAttachments && (
                <>
                  <input ref={fileRef} type="file" hidden onChange={onPickFile} />
                  <button onClick={() => fileRef.current?.click()} disabled={upload.isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Fichier
                  </button>
                </>
              )}
              {allowNotes && (
                <button onClick={submitNote} disabled={addNote.isPending || !noteBody.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white shadow disabled:opacity-40">
                  {addNote.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Note
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunicationTimeline;
