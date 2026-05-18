/**
 * FLOWTYM LIGHTHOUSE - VEILLE CONCURRENTIELLE
 * 
 * Vue mensuelle professionnelle type Lighthouse
 * - Heatmap tarifaire
 * - Upload Excel pour mise à jour
 * - Données réelles 87 jours
 */

import React, { useState, useMemo, useRef } from 'react';
import { Calendar, TrendingUp, Activity, Download, Upload, AlertCircle } from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { LIGHTHOUSE_REAL_DATA, getMarketPressure, COMPETITORS } from '../../data/lighthouse-real-data';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export const LighthouseMonthlyView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrer données par mois
  const monthData = useMemo(() => {
    return LIGHTHOUSE_REAL_DATA.filter(d => d.date.startsWith(selectedMonth));
  }, [selectedMonth]);

  // KPIs période
  const periodMedian = useMemo(() => {
    if (monthData.length === 0) return 0;
    const sum = monthData.reduce((acc, d) => acc + d.compsetMedian, 0);
    return Math.round(sum / monthData.length);
  }, [monthData]);

  const avgPressure = useMemo(() => {
    if (monthData.length === 0) return 0;
    const sum = monthData.reduce((acc, d) => acc + d.marketDemand, 0);
    return Math.round((sum / monthData.length) * 100);
  }, [monthData]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Parser le fichier Excel Lighthouse
      alert(`Fichier "${file.name}" sélectionné.\n\nParsing Excel Lighthouse à implémenter.\nPour l'instant, les données réelles de folkestoneopéra_bookingdotcom sont utilisées.`);
    }
  };

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
          {/* Toolbar avec Upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Période :</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="2026-05">Mai 2026</option>
                <option value="2026-06">Juin 2026</option>
                <option value="2026-07">Juillet 2026</option>
                <option value="2026-08">Août 2026</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Importer Lighthouse Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

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
              {monthData.slice(0, 30).map((day, idx) => {
                const maxPrice = Math.max(...monthData.slice(0, 30).map(d => Math.max(d.ourPrice, d.compsetMedian)));
                const ourHeight = (day.ourPrice / maxPrice) * 100;
                const medianHeight = (day.compsetMedian / maxPrice) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                    {/* Notre prix */}
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${ourHeight}%` }}
                      title={`${day.dayName} ${day.date.slice(5)}: Notre prix ${day.ourPrice}€`}
                    />
                    {/* Médiane */}
                    <div
                      className="w-full bg-gray-300 transition-all hover:bg-gray-400"
                      style={{ height: `${medianHeight}%` }}
                      title={`Médiane: ${day.compsetMedian}€`}
                    />
                    {/* Date */}
                    {idx % 3 === 0 && (
                      <div className="text-[8px] text-gray-400 mt-1 whitespace-nowrap">
                        {new Date(day.date).getDate()}
                      </div>
                    )}
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

          {/* Barres Pression Marché */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pression Marché (0-100%)</h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {monthData.slice(0, 30).map((day, idx) => {
                const pressure = getMarketPressure(day.marketDemand);
                const color = pressure >= 70 ? 'bg-red-500' : pressure >= 40 ? 'bg-yellow-500' : 'bg-green-500';
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className={cn('w-full rounded-t transition-all', color)}
                      style={{ height: `${pressure}%` }}
                      title={`${day.dayName} ${new Date(day.date).getDate()}: ${pressure}%`}
                    />
                    {idx % 3 === 0 && (
                      <div className="text-[8px] text-gray-400 mt-1">{day.dayName[0]}</div>
                    )}
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

          {/* Heatmap Position Compset */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Position vs Compset (Ranking)</h3>
            <div className="space-y-2">
              {monthData.slice(0, 10).map((day, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-24 text-gray-600">{day.dayName} {day.date.slice(5)}</div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 flex items-center px-2">
                      <span className={cn(
                        'text-xs font-semibold',
                        day.ranking.startsWith('1 ') || day.ranking.startsWith('2 ') || day.ranking.startsWith('3 ') 
                          ? 'text-emerald-600' 
                          : 'text-orange-600'
                      )}>
                        {day.ranking}
                      </span>
                    </div>
                    <div className="w-32 text-xs text-gray-500">{day.bookingRank}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note Upload */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Données Lighthouse</strong> : 87 jours de données réelles chargés depuis folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx. 
              Utilisez le bouton "Importer Lighthouse Excel" pour mettre à jour avec un nouveau fichier export Lighthouse.
              Le parsing Excel sera ajouté en Phase 2 pour automatiser les mises à jour.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
