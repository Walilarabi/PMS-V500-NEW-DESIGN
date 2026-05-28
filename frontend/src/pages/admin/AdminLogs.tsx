import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search, AlertTriangle, Info, Shield } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PlatformLog {
  id: string;
  admin_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  hotel_id: string | null;
  hotel_name: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  level: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  support_mode_activated: 'Mode support activé',
  hotel_created:          'Hôtel créé',
  hotel_updated:          'Hôtel modifié',
  hotel_deleted:          'Hôtel supprimé',
  hotel_suspended:        'Hôtel suspendu',
  hotel_reactivated:      'Hôtel réactivé',
  user_invited:           'Utilisateur invité',
  user_disabled:          'Utilisateur désactivé',
  subscription_changed:   'Abonnement modifié',
  invoice_generated:      'Facture générée',
  contract_sent:          'Contrat envoyé',
  contract_signed:        'Contrat signé',
  platform_login:         'Connexion admin',
};

const LEVEL_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  info:     { label: 'Info',     color: 'bg-blue-50 text-blue-600',    icon: Info },
  warning:  { label: 'Warning',  color: 'bg-amber-50 text-amber-600',  icon: AlertTriangle },
  critical: { label: 'Critique', color: 'bg-red-50 text-red-600',      icon: Shield },
};

function useLogs() {
  return useQuery<PlatformLog[]>({
    queryKey: ['admin-platform-logs'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

function useHotelList() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => { const { data } = await db.from('hotels').select('id, name').order('name'); return data ?? []; },
    staleTime: 60_000,
  });
}

export const AdminLogs: React.FC = () => {
  const { data: logs = [], isLoading } = useLogs();
  const { data: hotelList = [] }       = useHotelList();
  const [search, setSearch]    = useState('');
  const [levelF, setLevelF]    = useState('all');
  const [actionF, setActionF]  = useState('all');
  const [hotelF, setHotelF]    = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const m = !q || l.action.toLowerCase().includes(q) || l.admin_email?.toLowerCase().includes(q) || l.hotel_name?.toLowerCase().includes(q);
    const lv = levelF === 'all' || l.level === levelF;
    const ac = actionF === 'all' || l.action === actionF;
    const ht = hotelF === 'all' || l.hotel_id === hotelF;
    return m && lv && ac && ht;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">Logs & Activité</h1>
        <p className="text-sm text-gray-400 mt-0.5">Journal d'audit de la plateforme · {logs.length} entrées</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Action, admin, hôtel…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        <select value={levelF} onChange={e => setLevelF(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="all">Tous niveaux</option>
          {Object.keys(LEVEL_META).map(l => <option key={l} value={l}>{LEVEL_META[l].label}</option>)}
        </select>
        <select value={actionF} onChange={e => setActionF(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="all">Toutes actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
        <select value={hotelF} onChange={e => setHotelF(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
          <option value="all">Tous les hôtels</option>
          {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(LEVEL_META).map(([level, meta]) => {
          const count = logs.filter(l => l.level === level).length;
          return (
            <div key={level} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', meta.color.replace('text-', 'bg-').replace('-600','-100').replace('-50',''))}>
                <meta.icon size={14} className={meta.color.split(' ')[1]} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900">{count}</p>
                <p className="text-[11px] text-gray-400">{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Logs list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-400">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Activity size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun log trouvé.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(log => {
              const meta  = LEVEL_META[log.level] ?? LEVEL_META.info;
              const label = ACTION_LABELS[log.action] ?? log.action;
              const isExp = expanded === log.id;
              const hasPayload = log.payload && Object.keys(log.payload).length > 0;

              return (
                <div key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left"
                    onClick={() => hasPayload && setExpanded(isExp ? null : log.id)}
                  >
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', meta.color)}>
                      {meta.label}
                    </span>
                    <meta.icon size={13} className={cn('shrink-0', meta.color.split(' ')[1])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900">{label}</p>
                      <p className="text-[11px] text-gray-400">
                        {log.admin_email ?? 'système'}
                        {log.hotel_name && <span> · {log.hotel_name}</span>}
                        {log.ip_address && <span className="font-mono"> · {log.ip_address}</span>}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  {isExp && hasPayload && (
                    <div className="px-5 pb-4">
                      <pre className="bg-gray-50 rounded-xl p-3 text-[11px] font-mono text-gray-600 overflow-auto max-h-40">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
