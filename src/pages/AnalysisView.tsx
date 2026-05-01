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
  Pie,
} from 'recharts';
import { 
  Download, 
  FileSpreadsheet, 
  ChevronRight,
  TrendingUp,
  Target,
  Percent,
  Calendar,
  Filter,
  Users
} from 'lucide-react';
import { useReservations } from '@/src/contexts/ReservationContext';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';

const revenueData = [
  { name: 'Jan', revenue: 45000, bookings: 120 },
  { name: 'Fév', revenue: 52000, bookings: 145 },
  { name: 'Mar', revenue: 48000, bookings: 132 },
  { name: 'Avr', revenue: 61000, bookings: 168 },
  { name: 'Mai', revenue: 75000, bookings: 210 },
  { name: 'Jun', revenue: 89000, bookings: 245 },
];

const channelData = [
  { name: 'Direct (Web)', value: 45, color: '#8B5CF6' },
  { name: 'Booking.com', value: 30, color: '#3B82F6' },
  { name: 'Expedia', value: 15, color: '#10B981' },
  { name: 'Offline/Tel', value: 10, color: '#F59E0B' },
];

const performanceData = [
  { name: 'France', stays: 145, revenue: 32600, occupancy: '82%' },
  { name: 'UK', stays: 85, revenue: 19450, occupancy: '75%' },
  { name: 'USA', stays: 52, revenue: 14200, occupancy: '68%' },
  { name: 'Germany', stays: 41, revenue: 9100, occupancy: '70%' },
];

export const AnalysisView = () => {
  const [activeTab, setActiveTab] = React.useState('Exploitation');
  const [forecastPeriod, setForecastPeriod] = React.useState<'30' | '90' | '180'>('90');
  const { reservations } = useReservations();

  const renderExploitation = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Main Revenue Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
           <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-[#8B5CF6]/10 rounded-xl">
                 <TrendingUp size={18} className="text-[#8B5CF6]" />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900 leading-none">Évolution des revenus</h3>
                 <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Revenue Total S1 2026: <span className="text-[#8B5CF6]">372 000 €</span></p>
              </div>
           </div>
           <Badge variant="success" className="gap-1 font-bold">+18.5% vs N-1</Badge>
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
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
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
            <div className="relative z-10 text-left">
               <div className="p-2 bg-emerald-50 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp size={18} className="text-emerald-500" />
               </div>
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Prix Moyen (ADR)</h4>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">215,40 €</span>
                  <span className="text-[10px] font-bold text-emerald-500">+4.2%</span>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/20 rounded-full -mr-16 -mt-16 group-hover:bg-emerald-50/40 transition-colors" />
         </Card>
         
         <Card className="flex-1 p-5 relative overflow-hidden group text-left">
            <div className="relative z-10">
               <div className="p-2 bg-[#3B82F6]/10 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <Target size={18} className="text-[#3B82F6]" />
               </div>
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">RevPAR</h4>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">178,20 €</span>
                  <span className="text-[10px] font-bold text-[#3B82F6]">+2.1%</span>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/5 rounded-full -mr-16 -mt-16 group-hover:bg-[#3B82F6]/10 transition-colors" />
         </Card>
         
         <Card className="flex-1 p-5 relative overflow-hidden group text-left">
            <div className="relative z-10">
               <div className="p-2 bg-[#F59E0B]/10 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <Percent size={18} className="text-[#F59E0B]" />
               </div>
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Taux d'occupation</h4>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">82.4%</span>
                  <span className="text-[10px] font-bold text-emerald-500">+5.6%</span>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F59E0B]/5 rounded-full -mr-16 -mt-16 group-hover:bg-[#F59E0B]/10 transition-colors" />
         </Card>
      </div>

      <Card className="lg:col-span-1">
        <CardHeader className="text-left py-4">
           <h3 className="font-bold text-gray-900">Distribution par Canal</h3>
           <Badge variant="neutral" className="text-[9px] uppercase">Mix Direct/OTA</Badge>
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
                 <div key={c.name} className="flex items-center gap-1.5 text-left">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{c.name}</span>
                 </div>
              ))}
           </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
         <CardHeader className="text-left">
            <h3 className="font-bold text-gray-900">Performance par Marché</h3>
            <Button variant="ghost" size="sm" className="font-bold text-[11px] text-[#8B5CF6]">Détail géographique <ChevronRight size={14} /></Button>
         </CardHeader>
         <div className="p-0 overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-gray-50/50">
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     <th className="px-6 py-3">Marché</th>
                     <th className="px-6 py-3">Nuitées</th>
                     <th className="px-6 py-3">Hébergement</th>
                     <th className="px-6 py-3">Occup.</th>
                     <th className="px-6 py-3 text-right">Revenue Net</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {performanceData.map((p) => (
                     <tr key={`market-${p.name}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-[13px] font-bold text-gray-900 flex items-center gap-3">
                           <span className="text-lg">
                              {p.name === 'France' ? '🇫🇷' : p.name === 'UK' ? '🇬🇧' : p.name === 'USA' ? '🇺🇸' : '🇩🇪'}
                           </span>
                           {p.name}
                        </td>
                        <td className="px-6 py-4 text-[13px] font-bold text-gray-500">{p.stays}</td>
                        <td className="px-6 py-4 text-[13px] font-bold text-gray-900">{p.revenue.toLocaleString()} €</td>
                        <td className="px-6 py-4 text-[13px] font-bold text-gray-500">{p.occupancy}</td>
                        <td className="px-6 py-4 text-[13px] font-bold text-[#8B5CF6] text-right">{(p.revenue * 1.12).toLocaleString()} €</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </Card>
    </div>
  );

  const renderForecast = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-[#8B5CF6] text-white">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Pick-up (7j)</p>
                  <p className="text-3xl font-black">+ 12 450 €</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl"><TrendingUp size={20} /></div>
             </div>
             <p className="text-[11px] font-bold">14 nouvelles réservations cette semaine</p>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Occup. On-the-books (M+1)</p>
             <p className="text-2xl font-bold text-gray-900">68.2%</p>
             <p className="text-[10px] font-bold text-emerald-500 mt-2">+4% vs N-1</p>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Rev. On-the-books (M+1)</p>
             <p className="text-2xl font-bold text-gray-900">42 800 €</p>
             <p className="text-[10px] font-bold text-rose-500 mt-2">-2% vs Target</p>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fair Share Index</p>
             <p className="text-2xl font-bold text-gray-900">1.04</p>
             <p className="text-[10px] font-bold text-[#8B5CF6] mt-2">Top Performer</p>
          </Card>
       </div>

       <Card className="p-6 bg-white border-transparent shadow-sm h-96">
          <CardHeader className="px-0 pt-0 pb-6">
             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Prévisions d'occupation sur 90 jours</h3>
          </CardHeader>
          <ResponsiveContainer width="100%" height="85%">
             <BarChart data={[
               { date: 'Mai', actual: 68, lastYear: 62 },
               { date: 'Juin', actual: 75, lastYear: 78 },
               { date: 'Juil', actual: 89, lastYear: 82 },
               { date: 'Août', actual: 92, lastYear: 90 },
               { date: 'Sept', actual: 64, lastYear: 68 },
               { date: 'Oct', actual: 52, lastYear: 48 },
             ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#9CA3AF'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#9CA3AF'}} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="actual" name="Prévisionnel" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lastYear" name="N-1" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
             </BarChart>
          </ResponsiveContainer>
       </Card>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB] scrollbar-hide">
      <div className="flex items-center justify-between">
        <div className="text-left">
           <h1 className="text-2xl font-bold text-gray-900 leading-tight">Analyse</h1>
           <p className="text-gray-500 text-sm font-medium mt-1">Suivez les performances de votre établissement en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white font-bold"><Download size={14} /> PDF Export</Button>
           <Button variant="primary" size="sm" className="gap-2 px-5 shadow-lg shadow-[#8B5CF6]/20 font-bold">
             <FileSpreadsheet size={16} /> Exporter CSV
           </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 gap-8">
        {['Exploitation', 'Prévisions', 'Financier', 'Canaux'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={cn(
            "pb-4 text-xs font-bold transition-all relative px-2 text-nowrap",
            activeTab === tab ? "text-[#8B5CF6]" : "text-gray-400 hover:text-gray-600"
          )}>
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B5CF6]" />}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activeTab === 'Exploitation' && renderExploitation()}
        {activeTab === 'Prévisions' && renderForecast()}
        {/* Placeholder for other tabs */}
        {activeTab === 'Financier' && <div className="text-left p-20 bg-white rounded-3xl border border-dashed text-gray-300 font-bold uppercase tracking-widest text-center">Rapport Financier complet disponible dans Finance</div>}
        {activeTab === 'Canaux' && <div className="text-left p-20 bg-white rounded-3xl border border-dashed text-gray-300 font-bold uppercase tracking-widest text-center">Analytics Canaux disponibles dans Revenue</div>}
      </div>
    </div>
  );
};
