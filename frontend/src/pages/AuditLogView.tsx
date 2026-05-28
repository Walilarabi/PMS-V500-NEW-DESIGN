/**
 * FLOWTYM — Audit Log Center.
 *
 * Read-only journal of all business events (reservations, disputes, bank statements, …)
 * with filters: entity, action, actor, date range. Designed for compliance audits.
 */
import React, { useMemo, useState } from 'react';
import {
  RefreshCw, Search, ShieldCheck, User, Clock, Filter, FileText,
  ArrowDown, ArrowUp, X, Download,
} from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useAuditActors, useAuditEntities, useAuditLogs } from '@/src/domains/audit/hooks';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import type { AuditLog } from '@/src/domains/audit/schemas';

const ACTION_TONE: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  updated: 'bg-amber-50 text-amber-700 border-amber-200',
  deleted: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ENTITY_LABEL: Record<string, string> = {
  reservation: 'Réservation',
  ota_dispute: 'Litige OTA',
  ota_dispute_reminder: 'Relance ODMS',
  bank_statement: 'Ligne bancaire',
  room: 'Chambre',
  planning_event: 'Événement Planning',
  planning_channel: 'Canal Planning',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const resolveActor = (log: AuditLog, actorMap: Record<string, string>): string => {
  if (log.actor_user_id) return actorMap[log.actor_user_id] ?? log.actor_user_id.slice(0, 8);
  if (log.actor_label) return log.actor_label;
  return 'Système';
};

const renderDiffPreview = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return '—';
  const p = payload as Record<string, unknown>;
  if (p.diff && typeof p.diff === 'object') {
    const keys = Object.keys(p.diff as Record<string, unknown>);
    if (keys.length === 0) return 'Aucun changement significatif';
    const top = keys.slice(0, 3).join(', ');
    return `Modifs : ${top}${keys.length > 3 ? ` (+${keys.length - 3})` : ''}`;
  }
  if (p.after) return 'Création';
  if (p.before) return 'Suppression';
  return '—';
};

const AuditDetailDrawer: React.FC<{ log: AuditLog | null; actorMap: Record<string, string>; onClose: () => void }> = ({ log, actorMap, onClose }) => {
  if (!log) return null;
  return (
    <aside data-testid="audit-drawer" className="w-[420px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <header className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-violet-600 font-bold">Détail événement</p>
          <h3 className="text-base font-bold text-gray-900 mt-1">{ENTITY_LABEL[log.entity] ?? log.entity}</h3>
          <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ACTION_TONE[log.action] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            {log.action}
          </span>
        </div>
        <button type="button" onClick={onClose} data-testid="audit-drawer-close" className="p-1.5 rounded-lg hover:bg-gray-100">
          <X size={16} className="text-gray-400" />
        </button>
      </header>
      <div className="overflow-y-auto p-5 space-y-3 flex-1 text-sm">
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Acteur</p>
          <p className="text-gray-900 mt-1">{resolveActor(log, actorMap)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Quand</p>
          <p className="text-gray-900 mt-1">{fmtDate(log.created_at)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Entity ID</p>
          <p className="text-gray-700 font-mono text-xs mt-1 break-all">{log.entity_id}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Payload (JSON)</p>
          <pre data-testid="audit-drawer-payload" className="mt-1 max-h-[480px] overflow-auto rounded-lg bg-gray-50 border border-gray-100 p-3 text-[11px] text-gray-700 leading-tight">
{JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      </div>
    </aside>
  );
};

const AuditLogView: React.FC = () => {
  const hotelQ = useActiveHotel();
  const entitiesQ = useAuditEntities();
  const actorsQ = useAuditActors();
  const [entity, setEntity] = useState<string | ''>('');
  const [action, setAction] = useState<string | ''>('');
  const [actor, setActor] = useState<string | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(() => ({
    entity: entity || null,
    action: action || null,
    actorUserId: actor || null,
    fromDate: fromDate ? new Date(fromDate).toISOString() : null,
    toDate: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : null,
    limit: 250,
  }), [entity, action, actor, fromDate, toDate]);

  const logsQ = useAuditLogs(filters);

  const actorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of actorsQ.data ?? []) {
      m[a.id] = a.full_name ?? a.email;
    }
    return m;
  }, [actorsQ.data]);

  const filtered = useMemo(() => {
    const base = logsQ.data ?? [];
    if (!search.trim()) return base;
    const s = search.toLowerCase();
    return base.filter((l) => {
      const acc = `${l.entity} ${l.action} ${l.entity_id} ${actorMap[l.actor_user_id ?? ''] ?? ''} ${JSON.stringify(l.payload).toLowerCase()}`;
      return acc.includes(s);
    });
  }, [logsQ.data, search, actorMap]);

  const selected = filtered.find((l) => l.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const list = filtered;
    return {
      total: list.length,
      created: list.filter((l) => l.action === 'created').length,
      updated: list.filter((l) => l.action === 'updated').length,
      deleted: list.filter((l) => l.action === 'deleted').length,
    };
  }, [filtered]);

  const reset = () => {
    setEntity(''); setAction(''); setActor(''); setFromDate(''); setToDate(''); setSearch('');
  };

  const exportCsv = () => {
    const rows = filtered.map((l) => ({
      'Date': fmtDate(l.created_at),
      'Entité': ENTITY_LABEL[l.entity] ?? l.entity,
      'Entity ID': l.entity_id,
      'Action': l.action,
      'Acteur': resolveActor(l, actorMap),
      'Acteur User ID': l.actor_user_id ?? '',
      'Détail': renderDiffPreview(l.payload),
      'Payload JSON': JSON.stringify(l.payload),
    }));
    const csv = Papa.unparse(rows, { quotes: true });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowtym-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.setTextColor(60, 30, 130);
    doc.text("FLOWTYM — Journal d'audit", 32, 36);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Hôtel : ${hotelQ.data?.name ?? '—'}`, 32, 54);
    doc.text(`Exporté le : ${new Date().toLocaleString('fr-FR')}  ·  ${filtered.length} événement(s)`, 32, 68);
    autoTable(doc, {
      startY: 86,
      margin: { left: 32, right: 32 },
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 4 },
      head: [['Date', 'Entité', 'Action', 'Acteur', 'Entity ID', 'Détail']],
      body: filtered.map((l) => [
        fmtDate(l.created_at),
        ENTITY_LABEL[l.entity] ?? l.entity,
        l.action,
        resolveActor(l, actorMap),
        l.entity_id.slice(0, 8),
        renderDiffPreview(l.payload),
      ]),
    });
    doc.save(`flowtym-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="audit-page">
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8 w-full space-y-5">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
              Finance · Compliance
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="audit-title">
              Journal d'audit{' '}
              <span className="text-gray-400 font-normal text-xl">· {hotelQ.data?.name ?? '—'}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Trace immuable des opérations métier (création / modification / suppression) — utile pour les contrôles fiscaux et certifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              data-testid="audit-export-csv"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold"
              title="Exporter les événements affichés au format CSV"
            >
              <Download size={13} /> CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={filtered.length === 0}
              data-testid="audit-export-pdf"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold"
              title="Exporter les événements affichés au format PDF"
            >
              <Download size={13} /> PDF
            </button>
            <button
              type="button"
              onClick={() => void logsQ.refetch()}
              data-testid="audit-refresh"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-violet-700 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw size={13} className={logsQ.isFetching ? 'animate-spin' : ''} /> Rafraîchir
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="audit-kpis">
          <KpiCard label="Total événements" value={String(stats.total)} icon={ShieldCheck} tone="violet" />
          <KpiCard label="Créations" value={String(stats.created)} icon={ArrowUp} tone="emerald" />
          <KpiCard label="Modifications" value={String(stats.updated)} icon={Filter} tone="amber" />
          <KpiCard label="Suppressions" value={String(stats.deleted)} icon={ArrowDown} tone="rose" />
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm" data-testid="audit-filters">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Entité</label>
              <select value={entity} onChange={(e) => setEntity(e.target.value)} data-testid="audit-filter-entity" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Toutes</option>
                {(entitiesQ.data ?? []).map((e) => <option key={e.entity} value={e.entity}>{ENTITY_LABEL[e.entity] ?? e.entity} ({e.n})</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Action</label>
              <select value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-filter-action" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Toutes</option>
                <option value="created">Créations</option>
                <option value="updated">Modifications</option>
                <option value="deleted">Suppressions</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Acteur</label>
              <select value={actor} onChange={(e) => setActor(e.target.value)} data-testid="audit-filter-actor" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous (incl. système)</option>
                {(actorsQ.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name ?? a.email}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Du</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="audit-filter-from" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Au</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="audit-filter-to" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher dans le journal (entité, ID, payload, acteur…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="audit-search"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button type="button" onClick={reset} data-testid="audit-reset" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-violet-600">
              <X size={13} /> Réinitialiser
            </button>
          </div>
        </section>

        <div className="flex gap-4 items-start">
          <section className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="audit-table">
            <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Événements ({filtered.length})</h2>
              {logsQ.isLoading && <span className="text-[11px] text-gray-400">Chargement…</span>}
              {logsQ.isError && <span className="text-[11px] text-rose-500">Erreur de chargement</span>}
            </header>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                    <th className="px-4 py-3">Quand</th>
                    <th className="px-4 py-3">Entité</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Acteur</th>
                    <th className="px-4 py-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm" data-testid="audit-empty">Aucun événement avec les filtres actuels.</td></tr>
                  ) : filtered.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedId(log.id)}
                      data-testid={`audit-row-${log.id}`}
                      className={`cursor-pointer hover:bg-violet-50/40 transition-colors ${selectedId === log.id ? 'bg-violet-50/60' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-gray-600 tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5"><Clock size={12} className="text-gray-400" />{fmtDate(log.created_at)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                          <FileText size={10} /> {ENTITY_LABEL[log.entity] ?? log.entity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ACTION_TONE[log.action] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        <span className="inline-flex items-center gap-1.5"><User size={12} className="text-gray-400" />{log.actor_user_id ? (actorMap[log.actor_user_id] ?? log.actor_user_id.slice(0, 8)) : <em className="text-gray-400 not-italic">{log.actor_label ?? 'Système'}</em>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-[12px]">{renderDiffPreview(log.payload)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected && <AuditDetailDrawer log={selected} actorMap={actorMap} onClose={() => setSelectedId(null)} />}
        </div>
      </main>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: 'violet' | 'emerald' | 'amber' | 'rose' }> = ({ label, value, icon: Icon, tone }) => {
  const toneClass = {
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3" data-testid={`audit-kpi-${tone}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
};

export default AuditLogView;
