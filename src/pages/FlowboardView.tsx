import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Bed, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Zap,
  Globe,
  Wallet,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';

import { cn } from '@/src/lib/utils';

const REVENUE_DATA = [
  { name: 'Mon', value: 4000 },
  { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 2000 },
  { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 },
  { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

const OCCUPANCY_DATA = [
  { name: 'Classique', value: 85, color: '#8B5CF6' },
  { name: 'Deluxe', value: 65, color: '#3B82F6' },
  { name: 'Suite', value: 45, color: '#10B981' },
];

export const FlowboardView = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F8F9FD]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Flowboard</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Vue d'ensemble de la performance actuelle</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm">
             <Calendar size={16} className="text-gray-400" /> 27 avr. - 26 mai 2026
          </Button>
          <Button className="bg-[#8B5CF6] font-bold gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-[#8B5CF6]/20">
             <TrendingUp size={18} /> Optimiser yield
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Chiffre d\'Affaires', value: '42 850 €', trend: '+12.5%', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Taux d\'Occupation', value: '78%', trend: '+4.2%', icon: Bed, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/5' },
          { label: 'ADR (Prix Moyen)', value: '142 €', trend: '-2.1%', icon: Target, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'RevPAR', value: '110.76 €', trend: '+8.3%', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((kpi, i) => (
          <Card key={i} className="p-6 border-transparent bg-white shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-110", kpi.bg, kpi.color)}>
                <kpi.icon size={20} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                kpi.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {kpi.trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {kpi.trend}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-2 p-6 border-transparent bg-white shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Évolution du CA</h3>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Comparaison par rapport à la période précédente</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                <span className="text-[10px] font-bold text-gray-400">Période actuelle</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_DATA}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-1 p-6 border-transparent bg-white shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Occupation par Catégorie</h3>
            <p className="text-[10px] text-gray-500 font-medium mt-1">Données basées sur les 30 derniers jours</p>
          </div>
          <div className="flex-1 space-y-6">
            {OCCUPANCY_DATA.map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-gray-900">{item.name}</span>
                  <span className="text-[#8B5CF6]">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t border-gray-50">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl text-emerald-500 shadow-sm"><Users size={16} /></div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Clients Directs</p>
                    <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">42%</p>
                 </div>
              </div>
              <ArrowUpRight size={18} className="text-emerald-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
         <Card className="p-6 border-transparent bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Alertes de Performance</h3>
               <button className="text-[10px] font-bold text-[#8B5CF6] hover:underline uppercase tracking-widest">Tout voir</button>
            </div>
            <div className="space-y-4">
               {[
                 { label: 'ADR en baisse sur Weekend prochain', type: 'warning', icon: ArrowDownRight },
                 { label: 'Pic de réservations Booking.com (+25%)', type: 'info', icon: Globe },
                 { label: '3 nouveaux dossiers litiges (Finance)', type: 'error', icon: Clock },
               ].map((alert, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group hover:bg-white hover:border-[#8B5CF6]/20 transition-all">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "p-2.5 rounded-xl",
                         alert.type === 'warning' ? "bg-amber-50 text-amber-500" :
                         alert.type === 'error' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                       )}>
                          <alert.icon size={18} />
                       </div>
                       <span className="text-[13px] font-bold text-gray-700">{alert.label}</span>
                    </div>
                    <ArrowUpRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               ))}
            </div>
         </Card>

         <Card className="p-6 border-transparent bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Actions Prioritaires</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 { label: 'Ajuster prix Weekend', sub: 'Yield Management', icon: Zap },
                 { label: 'Relancer impayés', sub: 'Finance', icon: Wallet },
                 { label: 'Vérifier arrivées', sub: 'Front Desk', icon: Clock },
                 { label: 'Rapport mensuel', sub: 'Analysis', icon: BarChart3 },
               ].map((action, i) => (
                 <button key={i} className="flex flex-col gap-4 p-5 bg-white border border-gray-100 rounded-3xl hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all text-left shadow-sm group">
                    <div className="p-2.5 bg-gray-100 text-gray-400 group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6] rounded-xl self-start transition-colors">
                       <action.icon size={20} />
                    </div>
                    <div>
                       <span className="text-[11px] font-bold text-gray-900 block leading-tight">{action.label}</span>
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 block opacity-60">{action.sub}</span>
                    </div>
                 </button>
               ))}
            </div>
         </Card>
      </div>
    </div>
  );
};
