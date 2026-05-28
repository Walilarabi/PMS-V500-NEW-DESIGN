import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Ticket, BookOpen,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Package,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import type { AdminPage } from './AdminApp';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function useDashStats() {
  return useQuery({
    queryKey: ['admin-dash-v2'],
    queryFn: async () => {
      const [hotels, hotelSubs, users, tickets, articles] = await Promise.all([
        db.from('hotels').select('id, active'),
        db.from('hotel_subscriptions').select('id, status'),
        db.from('users').select('id', { count: 'exact' }),
        db.from('support_tickets').select('id, status, risk_score'),
        db.from('help_articles').select('id, is_published'),
      ]);
      const hRows  = (hotels.data ?? []) as { active: boolean }[];
      const sRows  = (hotelSubs.data ?? []) as { status: string }[];
      const tRows  = (tickets.data ?? []) as { status: string; risk_score: string | null }[];
      const aRows  = (articles.data ?? []) as { is_published: boolean }[];
      const open   = ['nouveau','en_analyse','attente_utilisateur','en_correction'];
      return {
        hotels:        hRows.length,
        hotelsActive:  hRows.filter(h => h.active).length,
        hotelsInactive:hRows.filter(h => !h.active).length,
        users:         (users.count as number) ?? 0,
        subs:          sRows.length,
        subsActive:    sRows.filter(s => s.status === 'active').length,
        ticketsOpen:   tRows.filter(t => open.includes(t.status)).length,
        ticketsCrit:   tRows.filter(t => t.risk_score === 'critique' && open.includes(t.status)).length,
        ticketsTotal:  tRows.length,
        articles:      aRows.length,
        articlesPub:   aRows.filter(a => a.is_published).length,
        noSub:         Math.max(0, hRows.length - sRows.length),
      };
    },
    staleTime: 60_000,
  });
}

interface Props { onNavigate: (page: AdminPage) => void; }

export const AdminDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { data: s, isLoading } = useDashStats();
  const v = (n?: number) => isLoading ? '…' : String(n ?? 0);

  const kpis = [
    { label: 'Hôtels',            value: v(s?.hotels),    sub: `${s?.hotelsActive ?? 0} actifs`,           icon: Building2, bg: 'bg-[#8B5CF6]/10', fg: 'text-[#8B5CF6]', nav: 'hotels'        as AdminPage },
    { label: 'Utilisateurs',      value: v(s?.users),     sub: 'Tous hôtels',                              icon: Users,     bg: 'bg-blue-50',       fg: 'text-blue-600',  nav: 'users'         as AdminPage },
    { label: 'Abonnements actifs',value: v(s?.subsActive),sub: `${s?.subs ?? 0} au total`,                 icon: Package,   bg: 'bg-indigo-50',     fg: 'text-indigo-600',nav: 'subscriptions' as AdminPage },
    { label: 'Tickets ouverts',   value: v(s?.ticketsOpen),sub:`${s?.ticketsCrit ?? 0} critiques`,         icon: Ticket,    bg: (s?.ticketsCrit ?? 0) > 0 ? 'bg-red-50' : 'bg-amber-50', fg: (s?.ticketsCrit ?? 0) > 0 ? 'text-red-500' : 'text-amber-500', nav: 'support' as AdminPage },
    { label: 'Articles publiés',  value: v(s?.articlesPub),sub:`${s?.articles ?? 0} au total`,             icon: BookOpen,  bg: 'bg-emerald-50',    fg: 'text-emerald-600',nav:'articles'       as AdminPage },
    { label: 'Sans abonnement',   value: v(s?.noSub),     sub: 'Hôtels à convertir',                       icon: AlertTriangle, bg: 'bg-orange-50', fg: 'text-orange-500',nav:'billing'        as AdminPage },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-400 mt-0.5">Vue globale de la plateforme Flowtym</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map(k => (
          <button
            key={k.label}
            type="button"
            onClick={() => onNavigate(k.nav)}
            className="bg-white rounded-2xl border border-gray-100 p-5 text-left hover:shadow-md hover:border-gray-200 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', k.bg)}>
                <k.icon size={18} className={k.fg} />
              </div>
              <ArrowUpRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
            </div>
            <p className="text-2xl font-black text-gray-900">{k.value}</p>
            <p className="text-[12px] font-semibold text-gray-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* Status rows */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">État des hôtels</h3>
          <div className="space-y-2.5">
            <Bar icon={CheckCircle2} color="bg-emerald-400" label="Actifs"   val={s?.hotelsActive ?? 0} total={Math.max(1, s?.hotels ?? 1)} />
            <Bar icon={Clock}        color="bg-amber-400"   label="Essai"    val={0}                     total={Math.max(1, s?.hotels ?? 1)} />
            <Bar icon={AlertTriangle}color="bg-red-400"     label="Inactifs" val={s?.hotelsInactive ?? 0} total={Math.max(1, s?.hotels ?? 1)} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Support</h3>
          <div className="space-y-2.5">
            <Bar icon={Ticket}        color="bg-blue-400"  label="Total"    val={s?.ticketsTotal ?? 0} total={Math.max(1, s?.ticketsTotal ?? 1)} />
            <Bar icon={AlertTriangle} color="bg-amber-400" label="Ouverts"  val={s?.ticketsOpen ?? 0}  total={Math.max(1, s?.ticketsTotal ?? 1)} />
            <Bar icon={AlertTriangle} color="bg-red-400"   label="Critiques"val={s?.ticketsCrit ?? 0}  total={Math.max(1, s?.ticketsTotal ?? 1)} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Actions rapides</h3>
        <div className="flex flex-wrap gap-2">
          {([
            ['Ajouter un hôtel',      'hotels'],
            ['Inviter un utilisateur','users'],
            ['Créer abonnement',      'subscriptions'],
            ['Générer facture',       'billing'],
            ['Mode support',          'support_mode'],
            ['Voir les logs',         'logs'],
          ] as [string, AdminPage][]).map(([label, nav]) => (
            <button
              key={label}
              onClick={() => onNavigate(nav)}
              className="px-3.5 py-2 bg-gray-50 hover:bg-[#8B5CF6]/8 hover:text-[#8B5CF6] rounded-xl text-[12px] font-semibold text-gray-600 transition-colors border border-gray-100"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Bar: React.FC<{ icon: React.ElementType; color: string; label: string; val: number; total: number }> = ({
  icon: Icon, color, label, val, total,
}) => {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <Icon size={13} className="text-gray-400 shrink-0" />
      <span className="text-[11px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold text-gray-800 w-6 text-right">{val}</span>
    </div>
  );
};
