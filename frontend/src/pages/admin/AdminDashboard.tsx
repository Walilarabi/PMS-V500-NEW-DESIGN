import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Ticket, BookOpen,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Package,
  TrendingUp, DollarSign, BarChart2, Zap,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import type { AdminPage } from './AdminApp';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface SubRow { status: string; billing_cycle: string; custom_price: number | null; discount_percent: number; plan: { price_monthly: number; price_annual: number } | null; }

function computeMRR(subs: SubRow[]): number {
  return subs.filter(s => ['active','trial'].includes(s.status)).reduce((acc, s) => {
    const basePm  = s.plan?.price_monthly ?? 0;
    const basePa  = s.plan?.price_annual  ?? 0;
    const price   = s.custom_price != null ? s.custom_price : (s.billing_cycle === 'annual' ? basePa / 12 : basePm);
    const disc    = 1 - (s.discount_percent ?? 0) / 100;
    return acc + (price * disc);
  }, 0);
}

function useDashStats() {
  return useQuery({
    queryKey: ['admin-dash-v3'],
    queryFn: async () => {
      const [hotels, hotelSubs, users, tickets, articles] = await Promise.all([
        db.from('hotels').select('id,active'),
        db.from('hotel_subscriptions').select('id,status,billing_cycle,custom_price,discount_percent,plan:subscription_plans(price_monthly,price_annual)'),
        db.from('users').select('id', { count: 'exact' }),
        db.from('support_tickets').select('id,status,risk_score'),
        db.from('help_articles').select('id,is_published'),
      ]);

      const hRows = (hotels.data ?? [])   as { active: boolean }[];
      const sRows = (hotelSubs.data ?? []) as SubRow[];
      const tRows = (tickets.data  ?? []) as { status: string; risk_score: string | null }[];
      const aRows = (articles.data ?? []) as { is_published: boolean }[];
      const open  = ['nouveau','en_analyse','attente_utilisateur','en_correction'];

      const mrr  = computeMRR(sRows);
      const arr  = mrr * 12;
      const activeSubs = sRows.filter(s => s.status === 'active').length;
      const arpu = activeSubs > 0 ? mrr / activeSubs : 0;

      return {
        hotels:        hRows.length,
        hotelsActive:  hRows.filter(h => h.active).length,
        hotelsInactive:hRows.filter(h => !h.active).length,
        users:         (users.count as number) ?? 0,
        subs:          sRows.length,
        subsActive:    activeSubs,
        subsTrial:     sRows.filter(s => s.status === 'trial').length,
        subsSuspended: sRows.filter(s => s.status === 'suspended').length,
        ticketsOpen:   tRows.filter(t => open.includes(t.status)).length,
        ticketsCrit:   tRows.filter(t => t.risk_score === 'critique' && open.includes(t.status)).length,
        ticketsTotal:  tRows.length,
        articles:      aRows.length,
        articlesPub:   aRows.filter(a => a.is_published).length,
        noSub:         Math.max(0, hRows.length - sRows.length),
        mrr, arr, arpu,
      };
    },
    staleTime: 60_000,
  });
}

interface Props { onNavigate: (page: AdminPage) => void; }

export const AdminDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { data: s, isLoading } = useDashStats();
  const v  = (n?: number) => isLoading ? '…' : String(n ?? 0);
  const vf = (n?: number, decimals = 0) => isLoading ? '…' : n != null ? n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '0';

  // Financial KPIs
  const finKpis = [
    {
      label: 'MRR',
      value: isLoading ? '…' : `${vf(s?.mrr)} €`,
      sub: 'Revenu mensuel récurrent',
      icon: DollarSign, bg: 'bg-emerald-50', fg: 'text-emerald-600',
      nav: 'billing' as AdminPage,
    },
    {
      label: 'ARR',
      value: isLoading ? '…' : `${vf(s?.arr)} €`,
      sub: 'Revenu annuel projeté',
      icon: TrendingUp, bg: 'bg-blue-50', fg: 'text-blue-600',
      nav: 'billing' as AdminPage,
    },
    {
      label: 'ARPU',
      value: isLoading ? '…' : `${vf(s?.arpu)} €`,
      sub: 'Par client actif / mois',
      icon: BarChart2, bg: 'bg-indigo-50', fg: 'text-indigo-600',
      nav: 'subscriptions' as AdminPage,
    },
  ];

  // Operational KPIs
  const opKpis = [
    { label: 'Hôtels',            value: v(s?.hotels),     sub: `${s?.hotelsActive ?? 0} actifs`,      icon: Building2, bg: 'bg-[#8B5CF6]/10', fg: 'text-[#8B5CF6]', nav: 'hotels'        as AdminPage },
    { label: 'Utilisateurs',      value: v(s?.users),      sub: 'Tous établissements',                 icon: Users,     bg: 'bg-purple-50',     fg: 'text-purple-600',nav: 'users'         as AdminPage },
    { label: 'Abonnements actifs',value: v(s?.subsActive), sub: `${s?.subsTrial ?? 0} en essai`,       icon: Package,   bg: 'bg-cyan-50',       fg: 'text-cyan-600',  nav: 'subscriptions' as AdminPage },
    { label: 'Tickets ouverts',   value: v(s?.ticketsOpen),sub: `${s?.ticketsCrit ?? 0} critiques`,    icon: Ticket,    bg: (s?.ticketsCrit ?? 0) > 0 ? 'bg-red-50' : 'bg-amber-50', fg: (s?.ticketsCrit ?? 0) > 0 ? 'text-red-500' : 'text-amber-500', nav: 'support' as AdminPage },
    { label: 'Articles publiés',  value: v(s?.articlesPub),sub: `${s?.articles ?? 0} au total`,        icon: BookOpen,  bg: 'bg-emerald-50',    fg: 'text-emerald-600',nav:'articles'       as AdminPage },
    { label: 'Sans abonnement',   value: v(s?.noSub),      sub: 'Hôtels à convertir',                  icon: AlertTriangle, bg: (s?.noSub ?? 0) > 0 ? 'bg-orange-50' : 'bg-gray-50', fg: (s?.noSub ?? 0) > 0 ? 'text-orange-500' : 'text-gray-400', nav:'billing' as AdminPage },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue globale de la plateforme Flowtym · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Temps réel
        </div>
      </div>

      {/* Financial KPIs */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
          <TrendingUp size={11} /> Performance financière
        </p>
        <div className="grid grid-cols-3 gap-4">
          {finKpis.map(k => (
            <button key={k.label} type="button" onClick={() => onNavigate(k.nav)}
              className="bg-white rounded-2xl border border-gray-100 p-5 text-left hover:shadow-md hover:border-gray-200 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', k.bg)}>
                  <k.icon size={18} className={k.fg} />
                </div>
                <ArrowUpRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-2xl font-black text-gray-900">{k.value}</p>
              <p className="text-[12px] font-semibold text-gray-700 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Operational KPIs */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
          <Zap size={11} /> Opérationnel
        </p>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {opKpis.map(k => (
            <button key={k.label} type="button" onClick={() => onNavigate(k.nav)}
              className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md hover:border-gray-200 transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', k.bg)}>
                  <k.icon size={16} className={k.fg} />
                </div>
                <ArrowUpRight size={13} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-xl font-black text-gray-900">{k.value}</p>
              <p className="text-[12px] font-semibold text-gray-500 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Status rows */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hotels status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">État des établissements</h3>
          <div className="space-y-2.5">
            <Bar icon={CheckCircle2} color="bg-emerald-400" label="Actifs"   val={s?.hotelsActive ?? 0} total={Math.max(1, s?.hotels ?? 1)} />
            <Bar icon={Clock}        color="bg-amber-400"   label="Inactifs" val={s?.hotelsInactive ?? 0} total={Math.max(1, s?.hotels ?? 1)} />
            <Bar icon={AlertTriangle}color="bg-orange-400"  label="Sans abo" val={s?.noSub ?? 0} total={Math.max(1, s?.hotels ?? 1)} />
          </div>
        </div>

        {/* Subscriptions status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Abonnements</h3>
          <div className="space-y-2.5">
            <Bar icon={CheckCircle2} color="bg-emerald-400" label="Actifs"   val={s?.subsActive ?? 0}    total={Math.max(1, s?.subs ?? 1)} />
            <Bar icon={Clock}        color="bg-blue-400"    label="Essai"    val={s?.subsTrial ?? 0}     total={Math.max(1, s?.subs ?? 1)} />
            <Bar icon={AlertTriangle}color="bg-amber-400"   label="Suspendus"val={s?.subsSuspended ?? 0} total={Math.max(1, s?.subs ?? 1)} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Actions rapides</h3>
        <div className="flex flex-wrap gap-2">
          {([
            ['Ajouter un hôtel',        'hotels'],
            ['Assigner un abonnement',  'subscriptions'],
            ['Inviter un utilisateur',  'users'],
            ['Générer une facture',     'billing'],
            ['Mode support',            'support_mode'],
            ['Voir les logs',           'logs'],
            ['Nouveaux articles',       'articles'],
            ['Paramètres plateforme',   'settings'],
          ] as [string, AdminPage][]).map(([label, nav]) => (
            <button key={label} onClick={() => onNavigate(nav)}
              className="px-3.5 py-2 bg-gray-50 hover:bg-[#8B5CF6]/8 hover:text-[#8B5CF6] rounded-xl text-[12px] font-semibold text-gray-600 transition-colors border border-gray-100">
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
      <Icon size={12} className="text-gray-400 shrink-0" />
      <span className="text-[11px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold text-gray-700 w-6 text-right">{val}</span>
    </div>
  );
};
