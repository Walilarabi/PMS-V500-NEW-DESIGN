import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Ticket, BookOpen, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (table: string) => (supabase as any).from(table);

function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [hotels, users, tickets, articles] = await Promise.all([
        q('hotels').select('id, active', { count: 'exact' }),
        q('users').select('id', { count: 'exact' }),
        q('support_tickets').select('id, status, risk_score', { count: 'exact' }),
        q('help_articles').select('id, is_published', { count: 'exact' }),
      ]);

      const hotelsData   = (hotels.data   ?? []) as { id: string; active: boolean }[];
      const ticketsData  = (tickets.data  ?? []) as { id: string; status: string; risk_score: string | null }[];
      const articlesData = (articles.data ?? []) as { id: string; is_published: boolean }[];

      return {
        hotels:        hotelsData.length,
        hotelsActive:  hotelsData.filter(h => h.active).length,
        users:         (users.count as number) ?? 0,
        ticketsTotal:  ticketsData.length,
        ticketsOpen:   ticketsData.filter(t => !['resolu','ferme'].includes(t.status)).length,
        ticketsCritique: ticketsData.filter(t => t.risk_score === 'critique' && !['resolu','ferme'].includes(t.status)).length,
        articles:      articlesData.length,
        articlesPublished: articlesData.filter(a => a.is_published).length,
      };
    },
    staleTime: 60_000,
  });
}

interface KPIProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  color: string;
  danger?: boolean;
}

const KPICard: React.FC<KPIProps> = ({ icon: Icon, label, value, sub, color, danger }) => (
  <div className={cn('bg-white rounded-2xl border p-5 flex items-start gap-4', danger ? 'border-red-200' : 'border-gray-100')}>
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
      <Icon size={18} className="text-white" />
    </div>
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={cn('text-3xl font-bold mt-0.5', danger ? 'text-red-600' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Tableau de bord</h2>
        <p className="text-sm text-gray-400 mt-0.5">Vue globale de la plateforme Flowtym</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Building2} label="Hôtels" value={stats.hotels}
          sub={`${stats.hotelsActive} actif${stats.hotelsActive > 1 ? 's' : ''}`}
          color="bg-[#8B5CF6]" />
        <KPICard icon={Users} label="Utilisateurs" value={stats.users}
          color="bg-blue-500" />
        <KPICard icon={Ticket} label="Tickets ouverts" value={stats.ticketsOpen}
          sub={stats.ticketsCritique > 0 ? `${stats.ticketsCritique} critique${stats.ticketsCritique > 1 ? 's' : ''}` : `${stats.ticketsTotal} total`}
          color={stats.ticketsCritique > 0 ? 'bg-red-500' : 'bg-amber-500'}
          danger={stats.ticketsCritique > 0} />
        <KPICard icon={BookOpen} label="Articles d'aide" value={stats.articlesPublished}
          sub={`${stats.articles} au total`}
          color="bg-emerald-500" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-[#8B5CF6]" />
            <h3 className="text-sm font-bold text-gray-900">Tickets critiques ouverts</h3>
          </div>
          {stats.ticketsCritique === 0 ? (
            <p className="text-[13px] text-gray-400">Aucun ticket critique en cours.</p>
          ) : (
            <p className="text-[13px] text-red-600 font-bold">
              {stats.ticketsCritique} ticket{stats.ticketsCritique > 1 ? 's' : ''} de niveau critique nécessite{stats.ticketsCritique > 1 ? 'nt' : ''} une intervention.
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-gray-900">Documentation</h3>
          </div>
          <p className="text-[13px] text-gray-600">
            {stats.articlesPublished} article{stats.articlesPublished > 1 ? 's' : ''} publié{stats.articlesPublished > 1 ? 's' : ''} sur {stats.articles} au total.
            {stats.articles - stats.articlesPublished > 0 && (
              <span className="text-amber-600 font-bold"> {stats.articles - stats.articlesPublished} brouillon{stats.articles - stats.articlesPublished > 1 ? 's' : ''}.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
