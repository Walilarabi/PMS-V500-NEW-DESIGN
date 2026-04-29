import React from 'react';
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
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Download, 
  FileSpreadsheet, 
  ChevronRight,
  TrendingUp,
  Users,
  Target,
  Banknote
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';

import { cn } from '@/src/lib/utils';

const revenueData = [
  { name: 'Lun', revenue: 1200 },
  { name: 'Mar', revenue: 2100 },
  { name: 'Mer', revenue: 1500 },
  { name: 'Jeu', revenue: 2500 },
  { name: 'Ven', revenue: 3800 },
  { name: 'Sam', revenue: 4200 },
  { name: 'Dim', revenue: 3400 },
];

const channelData = [
  { name: 'Direct', value: 400, color: '#8B5CF6' },
  { name: 'Booking', value: 300, color: '#3B82F6' },
  { name: 'Expedia', value: 200, color: '#F59E0B' },
  { name: 'Airbnb', value: 100, color: '#EF4444' },
];

const performanceData = [
  { name: 'France', stays: 72, revenue: 12600 },
  { name: 'UK', stays: 45, revenue: 8450 },
  { name: 'USA', stays: 28, revenue: 6200 },
  { name: 'Germany', stays: 15, revenue: 3100 },
];

export const AnalysisView = () => {
  const [activeTab, setActiveTab] = React.useState('Exploitation');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB]">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 leading-tight">Analyse & Rapports</h1>
           <p className="text-gray-500 text-sm font-medium mt-1">Suivez les performances de votre établissement en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white font-bold"><Download size={14} /> PDF Export</Button>
           <Button variant="primary" size="sm" className="gap-2 px-5 shadow-lg shadow-[#8B5CF6]/20 font-bold">
             <FileSpreadsheet size={16} /> Exporter CSV
           </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-8">
        {['Exploitation', 'Statistiques', 'Financier', 'Clients', 'Direction'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={cn(
            "pb-4 text-xs font-bold transition-all relative px-2",
            activeTab === tab ? "text-[#8B5CF6]" : "text-gray-400 hover:text-gray-600"
          )}>
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B5CF6]" />}
          </button>
        ))}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
             <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8B5CF6]/10 rounded-xl">
                   <TrendingUp size={18} className="text-[#8B5CF6]" />
                </div>
                <div>
                   <h3 className="font-bold text-gray-900 leading-none">Évolution des revenus</h3>
                   <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Revenue Total Avril 2026: <span className="text-[#8B5CF6]">28 450 €</span></p>
                </div>
             </div>
             <Badge variant="success" className="gap-1 font-bold">+12.5% vs mois dernier</Badge>
          </CardHeader>
          <CardContent className="h-72">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                   <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#9CA3AF'}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#9CA3AF'}} />
                   <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' }}
                      cursor={{ stroke: '#8B5CF6', strokeWidth: 2, strokeDasharray: '4 4' }}
                   />
                   <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Small KPI Cards */}
        <div className="flex flex-col gap-4">
           <Card className="flex-1 p-5 relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="p-2 bg-emerald-50 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <TrendingUp size={18} className="text-emerald-500" />
                 </div>
                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ADR Moyen</h4>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">189 €</span>
                    <span className="text-[10px] font-bold text-emerald-500">+1.8%</span>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/20 rounded-full -mr-16 -mt-16 group-hover:bg-emerald-50/40 transition-colors" />
           </Card>
           
           <Card className="flex-1 p-5 relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="p-2 bg-red-50 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <Target size={18} className="text-red-500" />
                 </div>
                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">RevPAR</h4>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">142.5 €</span>
                    <span className="text-[10px] font-bold text-red-500">-3.3%</span>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/20 rounded-full -mr-16 -mt-16 group-hover:bg-red-50/40 transition-colors" />
           </Card>
           
           <Card className="flex-1 p-5 relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="p-2 bg-[#8B5CF6]/10 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    <Users size={18} className="text-[#8B5CF6]" />
                 </div>
                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nuitées Vendues</h4>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">1240</span>
                    <span className="text-[10px] font-bold text-emerald-500">+240</span>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 rounded-full -mr-16 -mt-16 group-hover:bg-[#8B5CF6]/10 transition-colors" />
           </Card>
        </div>

        {/* Secondary Charts */}
        <Card>
          <CardHeader>
             <h3 className="font-bold text-gray-900">Canaux de réservation</h3>
             <Badge variant="neutral">Top 4</Badge>
          </CardHeader>
          <CardContent className="h-64 flex flex-col items-center">
             <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                   <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                   >
                      {channelData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                   </Pie>
                   <Tooltip />
                </PieChart>
             </ResponsiveContainer>
             <div className="flex flex-wrap justify-center gap-3 mt-2">
                {channelData.map(c => (
                  <div key={c.name} className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                     <span className="text-[10px] font-bold text-gray-500 uppercase">{c.name}</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        {/* Performance by Nationality */}
        <Card className="lg:col-span-2">
           <CardHeader>
              <h3 className="font-bold text-gray-900">Performance par Nationalité</h3>
              <Button variant="ghost" size="sm" className="font-bold text-[11px]">Voir tout le classement <ChevronRight size={14} /></Button>
           </CardHeader>
           <div className="p-6 pt-0">
              <table className="w-full text-left">
                 <thead className="bg-gray-50/50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       <th className="px-4 py-3">Pays / Nationalité</th>
                       <th className="px-4 py-3">Nuits (PM)</th>
                       <th className="px-4 py-3">Hébergement</th>
                       <th className="px-4 py-3">Extra / F&B</th>
                       <th className="px-4 py-3 text-right">Total Net</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {performanceData.map((p, i) => (
                       <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 text-[13px] font-bold text-gray-900 flex items-center gap-3">
                             <span className="text-lg">
                                {p.name === 'France' ? '🇫🇷' : p.name === 'UK' ? '🇬🇧' : p.name === 'USA' ? '🇺🇸' : '🇩🇪'}
                             </span>
                             {p.name}
                          </td>
                          <td className="px-4 py-4 text-[13px] font-bold text-gray-400">{p.stays}</td>
                          <td className="px-4 py-4 text-[13px] font-bold text-gray-900">{p.revenue.toLocaleString()} €</td>
                          <td className="px-4 py-4 text-[13px] font-bold text-gray-400">{(p.revenue * 0.12).toFixed(0)} €</td>
                          <td className="px-4 py-4 text-[13px] font-bold text-[#8B5CF6] text-right">{(p.revenue * 1.12).toLocaleString()} €</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </Card>
      </div>
    </div>
  );
};
