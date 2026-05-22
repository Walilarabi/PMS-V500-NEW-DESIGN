/**
 * FLOWTYM — Clients Analytics view (Wave C2)
 *
 * Vue analytique : répartition segments / fidélité / pays / CA,
 * calculée à partir de la base clients chargée.
 */

import React from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { Users, CreditCard, Globe, Award } from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import type { GuestRowDto } from '@/src/domains/guests/schemas';

const SEGMENT_COLORS: Record<string, string> = {
  Leisure:  '#8B5CF6',
  Business: '#3B82F6',
  VIP:      '#F59E0B',
  Autre:    '#D1D5DB',
};

const LOYALTY_ORDER = ['Standard', 'Silver', 'Gold', 'Platinum'];
const LOYALTY_COLORS: Record<string, string> = {
  Standard: '#C4B5FD',
  Silver:   '#9CA3AF',
  Gold:     '#F59E0B',
  Platinum: '#3B82F6',
};

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, it) => {
    const k = key(it);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

const ChartCard = ({
  title, icon: Icon, children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <Card className="p-5">
    <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
      <Icon size={13} className="text-[#8B5CF6]" /> {title}
    </h3>
    {children}
  </Card>
);

export const ClientsAnalytics = ({ guests }: { guests: GuestRowDto[] }) => {
  // Segment distribution
  const segCounts = countBy(guests, (g) => g.segment || 'Autre');
  const segData = Object.entries(segCounts).map(([name, value]) => ({ name, value }));

  // Loyalty distribution
  const loyCounts = countBy(guests, (g) => g.loyalty_level || 'Standard');
  const loyData = LOYALTY_ORDER.map((lvl) => ({ level: lvl, count: loyCounts[lvl] ?? 0 }));

  // Top countries
  const countryCounts = countBy(guests, (g) => g.country || '—');
  const countryData = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Revenue buckets
  const buckets = [
    { label: '0 €',         min: 0,    max: 1 },
    { label: '1–500 €',     min: 1,    max: 500 },
    { label: '500–1.5k €',  min: 500,  max: 1500 },
    { label: '1.5k–5k €',   min: 1500, max: 5000 },
    { label: '5k €+',       min: 5000, max: Infinity },
  ];
  const revData = buckets.map((b) => ({
    label: b.label,
    count: guests.filter((g) => {
      const s = g.total_spent ?? 0;
      return s >= b.min && s < b.max;
    }).length,
  }));

  const totalRevenue = guests.reduce((s, g) => s + (g.total_spent ?? 0), 0);
  const totalStays   = guests.reduce((s, g) => s + (g.total_stays ?? 0), 0);
  const vipCount     = guests.filter((g) => g.vip).length;
  const avgRevenue   = guests.length ? Math.round(totalRevenue / guests.length) : 0;

  const summary = [
    { label: 'Base clients',  value: guests.length.toLocaleString('fr-FR'),       icon: Users },
    { label: 'CA cumulé',     value: `${Math.round(totalRevenue).toLocaleString('fr-FR')} €`, icon: CreditCard },
    { label: 'Séjours total', value: totalStays.toLocaleString('fr-FR'),           icon: Award },
    { label: 'CA moyen',      value: `${avgRevenue.toLocaleString('fr-FR')} €`,    icon: Globe },
  ];

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
              <s.icon size={18} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 leading-none">{s.value}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                {s.label}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Segment pie */}
        <ChartCard title="Répartition par segment" icon={Users}>
          <div className="flex items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {segData.map((d) => (
                      <Cell key={d.name} fill={SEGMENT_COLORS[d.name] ?? '#D1D5DB'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {segData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-gray-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: SEGMENT_COLORS[d.name] ?? '#D1D5DB' }}
                    />
                    {d.name}
                  </span>
                  <span className="text-[12px] font-bold text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Loyalty bar */}
        <ChartCard title="Niveaux de fidélité" icon={Award}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loyData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="level" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {loyData.map((d) => (
                    <Cell key={d.level} fill={LOYALTY_COLORS[d.level] ?? '#C4B5FD'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {vipCount > 0 && (
            <p className="text-[11px] text-gray-400 font-medium mt-2">
              Dont <span className="font-bold text-blue-600">{vipCount}</span> client{vipCount > 1 ? 's' : ''} VIP.
            </p>
          )}
        </ChartCard>

        {/* Top countries */}
        <ChartCard title="Top pays" icon={Globe}>
          <div className="space-y-2.5">
            {countryData.map((c) => {
              const max = countryData[0]?.count || 1;
              return (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-10">{c.country}</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8B5CF6] rounded-full"
                      style={{ width: `${Math.round((c.count / max) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-900 w-8 text-right">{c.count}</span>
                </div>
              );
            })}
            {countryData.length === 0 && (
              <p className="text-[11px] text-gray-300 font-medium">Aucune donnée.</p>
            )}
          </div>
        </ChartCard>

        {/* Revenue distribution */}
        <ChartCard title="Distribution du CA client" icon={CreditCard}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default ClientsAnalytics;
