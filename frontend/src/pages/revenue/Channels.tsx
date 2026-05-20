/**
 * FLOWTYM CHANNELS & OTA
 * 
 * Gestion de la distribution multi-canaux et allocation inventaire
 * 
 * Features :
 * - Dashboard canaux (Booking/Expedia/Direct/Airbnb)
 * - Performance par canal (volume/ADR/commission/RevPAR)
 * - Allocation inventaire dynamique
 * - Restrictions par canal (MLOS/CTA/CTD)
 */

import React, { useState, useMemo } from 'react';
import {
  Globe,
  TrendingUp,
  DollarSign,
  Percent,
  Target,
  Settings,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface ChannelData {
  id: string;
  name: string;
  icon: string;
  color: string;
  volume: number; // Nombre de réservations
  adr: number; // Average Daily Rate
  commission: number; // %
  revparContribution: number; // €
  allocationMax: number; // Chambres max allouées
  currentAllocation: number;
  mlos: number; // Minimum Length of Stay
  cta: boolean; // Close To Arrival
  ctd: boolean; // Close To Departure
}

// Mock data
function generateChannelData(): ChannelData[] {
  return [
    {
      id: 'booking',
      name: 'Booking.com',
      icon: '🅱️',
      color: 'blue',
      volume: 342,
      adr: 285,
      commission: 18,
      revparContribution: 97470,
      allocationMax: 30,
      currentAllocation: 28,
      mlos: 1,
      cta: false,
      ctd: false,
    },
    {
      id: 'expedia',
      name: 'Expedia',
      icon: '🇪',
      color: 'amber',
      volume: 187,
      adr: 295,
      commission: 20,
      revparContribution: 55165,
      allocationMax: 25,
      currentAllocation: 19,
      mlos: 1,
      cta: false,
      ctd: false,
    },
    {
      id: 'direct',
      name: 'Site Direct',
      icon: '🏨',
      color: 'emerald',
      volume: 158,
      adr: 305,
      commission: 0,
      revparContribution: 48190,
      allocationMax: 45,
      currentAllocation: 35,
      mlos: 1,
      cta: false,
      ctd: false,
    },
    {
      id: 'airbnb',
      name: 'Airbnb',
      icon: '🅰️',
      color: 'rose',
      volume: 94,
      adr: 270,
      commission: 15,
      revparContribution: 25380,
      allocationMax: 15,
      currentAllocation: 10,
      mlos: 2,
      cta: true,
      ctd: false,
    },
  ];
}

type PerfMetric = 'volume' | 'adr' | 'revpar';

const CHANNEL_HEX: Record<string, string> = {
  booking: '#3b82f6',
  expedia: '#f59e0b',
  direct: '#10b981',
  airbnb: '#f43f5e',
};

function generatePerformance30j(channels: ChannelData[]) {
  const today = new Date();
  const data: Record<string, number | string>[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getDay();
    const weekendBoost = day === 5 || day === 6 ? 1.15 : day === 0 ? 0.95 : 1;
    const row: Record<string, number | string> = {
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    };
    channels.forEach((c) => {
      const baseVol = c.volume / 30;
      const noise = 0.85 + Math.random() * 0.3;
      const vol = Math.max(0, Math.round(baseVol * weekendBoost * noise));
      const adr = Math.round(c.adr * (0.95 + Math.random() * 0.1));
      const revpar = Math.round(vol * adr * (1 - c.commission / 100));
      row[`${c.id}_volume`] = vol;
      row[`${c.id}_adr`] = adr;
      row[`${c.id}_revpar`] = revpar;
    });
    data.push(row);
  }
  return data;
}

export function Channels() {
  const [autoAllocation, setAutoAllocation] = useState(true);
  const [perfMetric, setPerfMetric] = useState<PerfMetric>('volume');
  const [channels, setChannels] = useState<ChannelData[]>(() => generateChannelData());
  const [dirtyRestrictions, setDirtyRestrictions] = useState<Set<string>>(new Set());
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);
  const perfData = useMemo(() => generatePerformance30j(channels), [channels]);

  const metricLabel: Record<PerfMetric, string> = {
    volume: 'Réservations',
    adr: 'ADR (€)',
    revpar: 'RevPAR (€)',
  };

  const updateChannel = (id: string, patch: Partial<ChannelData>) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirtyRestrictions((prev) => new Set(prev).add(id));
  };

  const updateAllocation = (id: string, value: number) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, currentAllocation: Math.max(0, Math.min(c.allocationMax, value)) }
          : c
      )
    );
  };

  const applyRestrictions = (id: string) => {
    setDirtyRestrictions((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const channel = channels.find((c) => c.id === id);
    setAppliedFeedback(
      channel ? `Restrictions appliquées pour ${channel.name}` : 'Restrictions appliquées'
    );
    setTimeout(() => setAppliedFeedback(null), 2500);
  };

  const totalVolume = channels.reduce((sum, c) => sum + c.volume, 0);
  const avgADR = Math.round(channels.reduce((sum, c) => sum + c.adr * c.volume, 0) / totalVolume);
  const totalRevpar = channels.reduce((sum, c) => sum + c.revparContribution, 0);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden relative">
      {appliedFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-md shadow-lg text-sm font-semibold animate-pulse">
          ✓ {appliedFeedback}
        </div>
      )}
      {/* HEADER */}
      <RevenueHeader
        icon={Globe}
        title="Canaux & OTA"
        subtitle="Gestion de la distribution multi-canaux et allocation inventaire"
        quickActions={[
          {
            label: 'Rapports',
            icon: BarChart3,
            onClick: () => alert('Rapports en développement'),
          },
        ]}
      />

      {/* KPI CARDS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Volume total
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalVolume}</div>
            <div className="text-xs text-gray-500 mt-1">réservations ce mois</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              ADR Moyen
            </div>
            <div className="text-3xl font-bold text-blue-600">{avgADR}€</div>
            <div className="text-xs text-gray-500 mt-1">tous canaux confondus</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              RevPAR Total
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              {Math.round(totalRevpar).toLocaleString()}€
            </div>
            <div className="text-xs text-gray-500 mt-1">contribution globale</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Canal Principal
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {channels[0]?.icon} {channels[0]?.name}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.round((channels[0]?.volume / totalVolume) * 100)}% du volume
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* DASHBOARD CANAUX */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-700">Performance par canal</h3>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-4 gap-4">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all hover:scale-105"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{channel.icon}</span>
                        <span className="font-bold text-gray-900">{channel.name}</span>
                      </div>
                      <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-blue-600" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Volume</span>
                        <span className="font-bold text-gray-900">{channel.volume}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">ADR</span>
                        <span className="font-bold text-blue-600">{channel.adr}€</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Commission</span>
                        <span className="font-bold text-red-600">{channel.commission}%</span>
                      </div>

                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                        <span className="text-gray-600">RevPAR</span>
                        <span className="font-bold text-emerald-600">
                          {Math.round(channel.revparContribution).toLocaleString()}€
                        </span>
                      </div>
                    </div>

                    {/* Allocation */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">
                        Allocation : {channel.currentAllocation}/{channel.allocationMax} chambres
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            channel.id === 'booking' && 'bg-blue-500',
                            channel.id === 'expedia' && 'bg-amber-500',
                            channel.id === 'direct' && 'bg-emerald-500',
                            channel.id === 'airbnb' && 'bg-rose-500'
                          )}
                          style={{
                            width: `${(channel.currentAllocation / channel.allocationMax) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PERFORMANCE 30 JOURS */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">Performance canaux — 30 derniers jours</h3>
              <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
                {(['volume', 'adr', 'revpar'] as PerfMetric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPerfMetric(m)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded transition-colors',
                      perfMetric === m
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {metricLabel[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perfData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(value: number) =>
                      perfMetric === 'volume' ? value : `${value.toLocaleString()}€`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {channels.map((c) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={`${c.id}_${perfMetric}`}
                      name={c.name}
                      stroke={CHANNEL_HEX[c.id] ?? '#64748b'}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ALLOCATION INVENTAIRE */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">Allocation Inventaire</h3>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Auto-Allocation</span>
                <button
                  onClick={() => setAutoAllocation(!autoAllocation)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    autoAllocation ? 'bg-blue-600' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      autoAllocation ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-48">
                    <span className="text-xl">{channel.icon}</span>
                    <span className="font-semibold text-gray-900">{channel.name}</span>
                  </div>

                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max={channel.allocationMax}
                      value={channel.currentAllocation}
                      onChange={(e) => updateAllocation(channel.id, Number(e.target.value))}
                      disabled={autoAllocation}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="w-32 text-right">
                    <span className="font-bold text-gray-900">{channel.currentAllocation}</span>
                    <span className="text-gray-500"> / {channel.allocationMax}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RESTRICTIONS PAR CANAL */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-700">Restrictions par canal</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Canal</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">MLOS</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">CTA</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">CTD</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => (
                    <tr key={channel.id} className="border-b border-gray-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{channel.icon}</span>
                          <span className="font-semibold text-gray-900">{channel.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          max="14"
                          value={channel.mlos}
                          onChange={(e) =>
                            updateChannel(channel.id, {
                              mlos: Math.max(1, Math.min(14, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={channel.cta}
                          onChange={(e) => updateChannel(channel.id, { cta: e.target.checked })}
                          className="w-4 h-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={channel.ctd}
                          onChange={(e) => updateChannel(channel.id, { ctd: e.target.checked })}
                          className="w-4 h-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => applyRestrictions(channel.id)}
                          disabled={!dirtyRestrictions.has(channel.id)}
                          className={cn(
                            'text-xs px-3 py-1 rounded font-semibold transition-colors',
                            dirtyRestrictions.has(channel.id)
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          )}
                        >
                          {dirtyRestrictions.has(channel.id) ? 'Appliquer' : 'À jour'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <strong>MLOS</strong> : Minimum Length of Stay (Durée minimum de séjour)
                </div>
                <div>
                  <strong>CTA</strong> : Close To Arrival (Fermeture à l'arrivée)
                </div>
                <div>
                  <strong>CTD</strong> : Close To Departure (Fermeture au départ)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
