/**
 * FLOWTYM — AuditLogView
 * Journal d'audit immutable + bouton export FEC.
 */
import React, { useState } from 'react';
import {
  History,
  Download,
  Search,
  Filter,
  ChevronRight,
  Shield,
  FileText,
  Zap,
  Users,
  CreditCard,
  AlertCircle,
  RefreshCcw,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import { useAuditLogs } from '@/src/domains/finance/hooks';
import { FecExportModal } from '@/src/components/finance/FecExportModal';
import type { AuditLogRead } from '@/src/domains/finance/schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entityIcon(entity: string) {
  const map: Record<string, React.ReactNode> = {
    reservation: <Zap size={14} />,
    payment: <CreditCard size={14} />,
    user: <Users size={14} />,
    invoice: <FileText size={14} />,
    room: <Shield size={14} />,
  };
  return map[entity.toLowerCase()] ?? <AlertCircle size={14} />;
}

function actionBadgeVariant(action: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (['INSERT', 'CREATE', 'CHECK_IN'].includes(action.toUpperCase())) return 'success';
  if (['DELETE', 'CANCEL', 'CHECK_OUT'].includes(action.toUpperCase())) return 'error';
  if (['UPDATE', 'MODIFY'].includes(action.toUpperCase())) return 'warning';
  return 'neutral';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function resolveActor(row: AuditLogRead): string {
  if (row.actor_user_id) return row.actor_user_id.slice(0, 8) + '…';
  return 'Système';
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AuditLogView = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [isFecModalOpen, setIsFecModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useAuditLogs({
    entity: entityFilter || undefined,
    action: actionFilter || undefined,
    limit: 100,
  });

  const rows = data?.rows ?? [];

  const filtered = rows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.entity.toLowerCase().includes(q) ||
      r.entity_id.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      (r.actor_user_id ?? '').toLowerCase().includes(q)
    );
  });

  const entities = Array.from(new Set(rows.map((r) => r.entity))).sort();
  const actions = Array.from(new Set(rows.map((r) => r.action))).sort();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-[#8B5CF6] rounded-2xl text-white shadow-lg shadow-[#8B5CF6]/20">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Journal d'Audit</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">
              Traçabilité immuable — {data?.total ?? 0} entrées
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 bg-white shadow-sm font-bold"
          >
            <RefreshCcw size={14} className={cn(isFetching && 'animate-spin')} />
            Actualiser
          </Button>
          <Button
            onClick={() => setIsFecModalOpen(true)}
            className="bg-[#8B5CF6] text-white gap-2 shadow-lg shadow-[#8B5CF6]/20 font-bold"
          >
            <Download size={16} />
            Export FEC
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total entrées', value: data?.total ?? 0, color: 'text-gray-900' },
          {
            label: 'Entités tracées',
            value: entities.length,
            color: 'text-[#8B5CF6]',
          },
          {
            label: 'Depuis hier',
            value: rows.filter((r) => {
              const d = new Date(r.created_at);
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              return d >= yesterday;
            }).length,
            color: 'text-emerald-600',
          },
          {
            label: 'Journal immutable',
            value: '✓ Triggers PG',
            color: 'text-emerald-600',
            isText: true,
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 bg-white border-transparent shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              {kpi.label}
            </p>
            <p className={cn('text-2xl font-bold', kpi.color)}>
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border-transparent shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par entité, ID, action…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="text-xs font-bold bg-gray-50 border-0 rounded-xl px-3 py-2.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            >
              <option value="">Toutes entités</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs font-bold bg-gray-50 border-0 rounded-xl px-3 py-2.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            >
              <option value="">Toutes actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-transparent shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Chargement du journal…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <History size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune entrée d'audit trouvée</p>
            <p className="text-xs mt-1 opacity-60">
              Les événements apparaîtront ici au fur et à mesure des actions métier
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] border-b border-gray-50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-4">Horodatage</th>
                  <th className="px-5 py-4">Acteur</th>
                  <th className="px-5 py-4">Entité</th>
                  <th className="px-5 py-4">ID entité</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Corrélation</th>
                  <th className="px-5 py-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-gray-50/80 transition-colors text-sm group">
                      <td className="px-5 py-4 font-mono text-xs text-gray-500">
                        {formatTime(row.created_at)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-600">
                        {resolveActor(row)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-gray-700 font-bold text-xs">
                          <span className="text-gray-400">{entityIcon(row.entity)}</span>
                          {row.entity}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-400">
                        {row.entity_id.length > 12
                          ? row.entity_id.slice(0, 8) + '…'
                          : row.entity_id}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={actionBadgeVariant(row.action)} className="text-[10px] px-2 py-0.5 font-bold">
                          {row.action.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-mono text-[10px] text-gray-300">
                        {row.correlation_id ? row.correlation_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === row.id ? null : row.id)
                          }
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <ChevronRight
                            size={14}
                            className={cn(
                              'transition-transform',
                              expandedId === row.id && 'rotate-90',
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={7} className="px-5 py-4">
                          <pre className="text-[10px] font-mono text-gray-500 bg-white p-3 rounded-xl overflow-x-auto max-h-40 border border-gray-100">
                            {JSON.stringify(row.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* FEC Modal */}
      <FecExportModal isOpen={isFecModalOpen} onClose={() => setIsFecModalOpen(false)} />

      <style dangerouslySetInnerHTML={{
        __html: `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`
      }} />
    </div>
  );
};
