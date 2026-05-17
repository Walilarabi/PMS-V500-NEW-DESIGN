/**
 * FLOWTYM LIGHTHOUSE MONTHLY VIEW
 * 
 * Vue mensuelle professionnelle type Lighthouse :
 * - Heatmap tarifaire (concurrent × jour)
 * - Graph médiane marché
 * - Barres pression marché verticales
 * - Données Lighthouse réelles
 */

import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, Activity, Download } from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { LIGHTHOUSE_MARKET_DATA, COMPETITORS, getMarketPressure } from '../../utils/lighthouse-parser';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export const LighthouseMonthlyView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-05');

  // Filtrer données par mois sélectionné
  const monthData = useMemo(() => {
    return LIGHTHOUSE_MARKET_DATA.filter(d => d.date.startsWith(selectedMonth));
  }, [selectedMonth]);

  // Calcul médiane période
  const periodMedian = useMemo(() => {
    if (monthData.length === 0) return 0;
    const sum = monthData.reduce((acc, d) => acc + d.compsetMedian, 0);
    return Math.round(sum / monthData.length);
  }, [monthData]);

  // Calcul pression moyenne
  const avgPressure = useMemo(() => {
    if (monthData.length === 0) return 0;
    const sum = monthData.reduce((acc, d) => acc + d.marketDemand, 0);
    return Math.round((sum / monthData.length) * 100);
  }, [monthData]);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={Calendar}
          title="Veille Concurrentielle - Vue Mensuelle"
          subtitle="Analyse marché type Lighthouse : heatmap tarifaire + pression marché"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Médiane Marché</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{periodMedian}€</div>
              <div className="mt-1 text-xs text-gray-400">Période sélectionnée</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pression Moyenne</span>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{avgPressure}%</div>
              <div className="mt-1 text-xs text-gray-400">Demande marché</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Concurrents</span>
                <Calendar className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{COMPETITORS.length}</div>
              <div className="mt-1 text-xs text-gray-400">Compset actif</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Jours Données</span>
                <Download className="w-4 h-4 text-green-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{monthData.length}</div>
              <div className="mt-1 text-xs text-gray-400">Lighthouse</div>
            </div>
          </div>

          {/* Graph Médiane Marché */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Médiane Marché vs Notre Prix</h3>
            <div className="h-64 flex items-end justify-between gap-1">
              {monthData.map((day, idx) => {
                const maxPrice = Math.max(...monthData.map(d => Math.max(d.ourPrice, d.compsetMedian)));
                const ourHeight = (day.ourPrice / maxPrice) * 100;
                const medianHeight = (day.compsetMedian / maxPrice) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    {/* Notre prix */}
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${ourHeight}%` }}
                      title={`Notre prix: ${day.ourPrice}€`}
                    />
                    {/* Médiane */}
                    <div
                      className="w-full bg-gray-300 rounded-t transition-all hover:bg-gray-400"
                      style={{ height: `${medianHeight}%` }}
                      title={`Médiane: ${day.compsetMedian}€`}
                    />
                    {/* Date */}
                    <div className="text-[8px] text-gray-400 mt-1 rotate-45 origin-left whitespace-nowrap">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-gray-600">Notre Prix</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded" />
                <span className="text-gray-600">Médiane Compset</span>
              </div>
            </div>
          </div>

          {/* Barres Pression Marché Verticales */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pression Marché (0-100%)</h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {monthData.map((day, idx) => {
                const pressure = getMarketPressure(day.marketDemand);
                const color = pressure >= 70 ? 'bg-red-500' : pressure >= 40 ? 'bg-yellow-500' : 'bg-green-500';
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className={cn('w-full rounded-t transition-all', color)}
                      style={{ height: `${pressure}%` }}
                      title={`${day.dayName} ${new Date(day.date).getDate()}: ${pressure}%`}
                    />
                    <div className="text-[8px] text-gray-400 mt-1">{day.dayName[0]}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-gray-600">0-40% (Faible)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded" />
                <span className="text-gray-600">40-70% (Moyen)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-gray-600">70-100% (Fort)</span>
              </div>
            </div>
          </div>

          {/* Message limitation données */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note</strong> : Vue basée sur 15 jours de données Lighthouse réelles (17-31 mai 2026). 
              Import complet Lighthouse prévu Phase 2.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
