import React from 'react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  ReferenceArea
} from 'recharts';
import { cn } from '@/src/lib/utils';

interface RevenueKPIChartProps {
  data: any[];
}

export const RevenueKPIChart: React.FC<RevenueKPIChartProps> = ({ data }) => {
  // Transformer les données pour le graphique si nécessaire
  const chartData = data.map(d => ({
    ...d,
    name: `${d.dateNum} ${d.dayName}`,
    displayDate: d.dateStr,
    // On simule une zone "Target" ou "Last Year" pour l'effet de bande orange de l'image
    targetMin: d.ca * 0.85,
    targetMax: d.ca * 1.15,
  }));

  // Trouver les weekends pour les ReferenceArea
  const weekendAreas = chartData.filter(d => d.dayName === 'Sam' || d.dayName === 'Dim');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-xl shadow-slate-200/50">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">{label}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                <span className="text-[12px] font-bold text-slate-600">Revenue (CA)</span>
              </div>
              <span className="text-[13px] font-black text-slate-900">{payload[0]?.value.toLocaleString()} €</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[12px] font-bold text-slate-600">Occupation</span>
              </div>
              <span className="text-[13px] font-black text-emerald-500">{payload[1]?.value}%</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span className="text-[12px] font-bold text-slate-600">ADR</span>
              </div>
              <span className="text-[13px] font-black text-amber-500">{Math.round(payload[2]?.value)} €</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full w-full flex flex-col p-8 space-y-8 bg-white">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-8">
          {[
            { label: 'Revenue (CA)', val: data.reduce((acc, curr) => acc + curr.ca, 0).toLocaleString() + ' €', color: 'bg-emerald-500' },
            { label: 'Occ. Moyenne', val: Math.round(data.reduce((acc, curr) => acc + curr.occ, 0) / data.length) + '%', color: 'bg-indigo-500' },
            { label: 'ADR Moyen', val: Math.round(data.reduce((acc, curr) => acc + (curr.adr || 0), 0) / data.filter(d => d.adr > 0).length || 1) + ' €', color: 'bg-amber-500' },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
              </div>
              <span className="text-xl font-black text-slate-900 leading-none">{stat.val}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
           {['Journalier', 'Cumulé', 'vs N-1'].map((v, i) => (
             <button key={v} className={cn(
               "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
               i === 0 ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
             )}>{v}</button>
           ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 min-h-[400px] w-full relative">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => `${val}€`}
            />
            
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, 100]}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />

            {/* Zone Target (Bande orange de l'image) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="targetMax"
              stroke="none"
              fill="url(#areaGradient)"
              connectNulls
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="targetMin"
              stroke="#F59E0B"
              strokeDasharray="5 5"
              fill="#fff" // Masque la partie basse pour créer l'effet bande
              strokeOpacity={0.3}
            />

            {/* Bars: CA (Revenue) */}
            <Bar 
              yAxisId="left"
              dataKey="ca" 
              barSize={12} 
              fill="url(#barGradient)" 
              radius={[4, 4, 0, 0]} 
            />

            {/* Line: Occupancy */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="occ"
              stroke="#4F46E5"
              strokeWidth={3}
              dot={{ r: 4, fill: '#fff', stroke: '#4F46E5', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
            />

            {/* Line: ADR */}
            <Line
              yAxisId="right" // On le met sur l'axe droit pour la tendance ou gauche si on préfère
              type="monotone"
              dataKey="adr"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#fff', stroke: '#10B981', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
            />

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-10 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-3 rounded-full bg-indigo-500 opacity-20" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Revenue (CA)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-[3px] bg-indigo-500 relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white border-2 border-indigo-500" />
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Taux d'occupation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-[3px] bg-emerald-500 relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white border-2 border-emerald-500" />
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ADR (Prix Moyen)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-3 bg-amber-100/50 border-y border-amber-200/30" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Objectif / Target</span>
        </div>
      </div>
    </div>
  );
};
