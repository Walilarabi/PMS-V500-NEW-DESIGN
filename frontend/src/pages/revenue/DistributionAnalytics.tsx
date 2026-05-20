/**
 * FLOWTYM DISTRIBUTION ANALYTICS
 * 
 * Analytics performance canaux OTA
 * KPIs business critiques par canal
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Percent,
  Users,
  BarChart3,
  Download,
  Filter,
  Calendar,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface ChannelPerformance {
  channelId: string;
  channelName: string;
  commission: number;
  bookings: number;        // Nombre réservations
  roomNights: number;      // Nuitées vendues
  revenue: number;         // CA total
  commissionCost: number;  // Coût commission
  netRevenue: number;      // CA net après commission
  adr: number;             // Average Daily Rate
  revpar: number;          // Revenue Per Available Room
  conversionRate: number;  // Taux conversion %
}

// Mock data generator
function generateChannelPerformance(): ChannelPerformance[] {
  const channels = [
    { channelId: 'ch_direct', channelName: 'Direct', commission: 0 },
    { channelId: 'ch_bk', channelName: 'Booking.com', commission: 10 },
    { channelId: 'ch_exp', channelName: 'Expedia', commission: 18 },
    { channelId: 'ch_airbnb', channelName: 'Airbnb', commission: 15 },
    { channelId: 'ch_agoda', channelName: 'Agoda', commission: 14.5 },
    { channelId: 'ch_hrs', channelName: 'HRS', commission: 15 },
    { channelId: 'ch_trip', channelName: 'Trip.com', commission: 16 },
    { channelId: 'ch_hb', channelName: 'Hotelbeds', commission: 17.8 },
    { channelId: 'ch_lm', channelName: 'Lastminute', commission: 18 },
    { channelId: 'ch_tbo', channelName: 'TBO.com', commission: 20 },
  ];

  return channels.map((ch, idx) => {
    // Simulate realistic performance data
    const baseBookings = ch.channelName === 'Direct' ? 145 : 
                        ch.channelName === 'Booking.com' ? 412 :
                        80 + Math.floor(Math.random() * 120);
    
    const bookings = baseBookings;
    const roomNights = Math.floor(bookings * (1.8 + Math.random() * 0.8)); // 1.8-2.6 nuits/booking
    const adr = 180 + Math.floor(Math.random() * 120); // ADR 180-300€
    const revenue = roomNights * adr;
    const commissionCost = Math.round(revenue * (ch.commission / 100));
    const netRevenue = revenue - commissionCost;
    const revpar = Math.round(revenue / 30); // Simplified: total rev / 30 days
    const conversionRate = 8 + Math.random() * 12; // 8-20%

    return {
      ...ch,
      bookings,
      roomNights,
      revenue,
      commissionCost,
      netRevenue,
      adr,
      revpar,
      conversionRate,
    };
  });
}

export function DistributionAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [sortBy, setSortBy] = useState<'revenue' | 'bookings' | 'netRevenue'>('revenue');

  const channelData = useMemo(() => generateChannelPerformance(), []);

  // Trier données
  const sortedData = useMemo(() => {
    return [...channelData].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [channelData, sortBy]);

  // KPIs globaux
  const totalBookings = channelData.reduce((sum, ch) => sum + ch.bookings, 0);
  const totalRevenue = channelData.reduce((sum, ch) => sum + ch.revenue, 0);
  const totalCommission = channelData.reduce((sum, ch) => sum + ch.commissionCost, 0);
  const totalNetRevenue = channelData.reduce((sum, ch) => sum + ch.netRevenue, 0);
  const avgCommissionRate = (totalCommission / totalRevenue) * 100;

  // Top 3 canaux
  const top3Revenue = sortedData.slice(0, 3);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={BarChart3}
          title="Distribution - Performance Canaux"
          subtitle="Analytics business par canal OTA - KPIs critiques ADR, RevPAR, Commission"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="space-y-6">
          {/* KPI Cards Globaux — cliquables pour pivoter le tri du tableau */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <button
              onClick={() => setSortBy('revenue')}
              className={cn(
                'bg-white rounded-lg border p-4 text-left transition-all',
                sortBy === 'revenue'
                  ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-sm'
                  : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">CA Total</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {Math.round(totalRevenue / 1000)}K€
              </div>
              <div className="mt-1 text-xs text-gray-400">30 derniers jours · trier ↓</div>
            </button>

            <button
              onClick={() => setSortBy('netRevenue')}
              className={cn(
                'bg-white rounded-lg border p-4 text-left transition-all',
                sortBy === 'netRevenue'
                  ? 'border-blue-500 ring-2 ring-blue-200 shadow-sm'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">CA Net</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {Math.round(totalNetRevenue / 1000)}K€
              </div>
              <div className="mt-1 text-xs text-emerald-600">
                Après commission · trier ↓
              </div>
            </button>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Commission</span>
                <Percent className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {avgCommissionRate.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {Math.round(totalCommission / 1000)}K€ coût
              </div>
            </div>

            <button
              onClick={() => setSortBy('bookings')}
              className={cn(
                'bg-white rounded-lg border p-4 text-left transition-all',
                sortBy === 'bookings'
                  ? 'border-purple-500 ring-2 ring-purple-200 shadow-sm'
                  : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Réservations</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{totalBookings}</div>
              <div className="mt-1 text-xs text-gray-400">Tous canaux · trier ↓</div>
            </button>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ADR Moyen</span>
                <Calendar className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {Math.round(totalRevenue / channelData.reduce((sum, ch) => sum + ch.roomNights, 0))}€
              </div>
              <div className="mt-1 text-xs text-gray-400">Average Daily Rate</div>
            </div>
          </div>

          {/* Toolbar Filtres */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Période :</span>
              <div className="flex items-center gap-2 border border-gray-300 rounded-md">
                <button
                  onClick={() => setSelectedPeriod('7d')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    selectedPeriod === '7d' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  7 jours
                </button>
                <button
                  onClick={() => setSelectedPeriod('30d')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    selectedPeriod === '30d' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  30 jours
                </button>
                <button
                  onClick={() => setSelectedPeriod('90d')}
                  className={cn(
                    'px-3 py-2 text-sm font-medium transition-colors',
                    selectedPeriod === '90d' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  90 jours
                </button>
              </div>

              <span className="text-sm font-medium text-gray-700 ml-4">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="revenue">CA Total</option>
                <option value="netRevenue">CA Net</option>
                <option value="bookings">Réservations</option>
              </select>
            </div>

            <button className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium">
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>

          {/* Graph Performance Comparative */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Comparative - Top 3 Canaux</h3>
            <div className="h-64 flex items-end justify-around gap-4">
              {top3Revenue.map((channel, idx) => {
                const maxRevenue = top3Revenue[0].revenue;
                const heightPercent = (channel.revenue / maxRevenue) * 100;
                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500'];

                return (
                  <div key={channel.channelId} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center gap-2">
                      {/* Barre CA */}
                      <div
                        className={cn('w-full rounded-t transition-all', colors[idx])}
                        style={{ height: `${heightPercent}%` }}
                        title={`${channel.channelName}: ${Math.round(channel.revenue / 1000)}K€`}
                      />
                      {/* Nom canal */}
                      <div className="text-sm font-semibold text-gray-900 text-center">
                        {channel.channelName}
                      </div>
                      {/* Métriques */}
                      <div className="text-xs text-gray-500 text-center space-y-1">
                        <div className="font-bold text-emerald-600">{Math.round(channel.revenue / 1000)}K€</div>
                        <div>{channel.bookings} résa</div>
                        <div className="text-orange-600">{channel.commission}% comm</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tableau Détaillé */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Performance Détaillée par Canal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Canal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Résa</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Nuitées</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ADR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">CA Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Comm %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Coût Comm</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">CA Net</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">RevPAR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Conv %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedData.map((channel) => (
                    <tr key={channel.channelId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{channel.channelName}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {channel.bookings}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {channel.roomNights}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                        {channel.adr}€
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">
                        {Math.round(channel.revenue / 1000)}K€
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          channel.commission === 0 ? 'bg-green-100 text-green-700' :
                          channel.commission <= 15 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {channel.commission}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-orange-600">
                        {Math.round(channel.commissionCost / 1000)}K€
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                        {Math.round(channel.netRevenue / 1000)}K€
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {channel.revpar}€
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {channel.conversionRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Légende</strong> : ADR = Average Daily Rate (prix moyen nuit), RevPAR = Revenue Per Available Room, 
              CA Net = CA Total - Coût Commission. Données période : {selectedPeriod === '7d' ? '7 derniers jours' : selectedPeriod === '30d' ? '30 derniers jours' : '90 derniers jours'}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
