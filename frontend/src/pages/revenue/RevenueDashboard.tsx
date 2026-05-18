/**
 * FLOWTYM REVENUE DASHBOARD
 * 
 * Dashboard pilotage revenue management
 * KPIs temps réel + tendances + alertes
 */

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Target,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { LIGHTHOUSE_REAL_DATA } from '../../data/lighthouse-real-data';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export const RevenueDashboard: React.FC = () => {
  // Calcul KPIs à partir données réelles
  const kpis = useMemo(() => {
    const last7Days = LIGHTHOUSE_REAL_DATA.slice(0, 7);
    const last30Days = LIGHTHOUSE_REAL_DATA.slice(0, 30);
    
    const totalRevenue = last30Days.reduce((sum, d) => sum + (d.ourPrice * 5), 0); // 5 chambres vendues/jour estimé
    const avgADR = last30Days.reduce((sum, d) => sum + d.ourPrice, 0) / last30Days.length;
    const avgOccupation = last30Days.reduce((sum, d) => sum + (d.marketDemand * 100), 0) / last30Days.length;
    const revPAR = avgADR * (avgOccupation / 100);
    
    // Tendances
    const last7ADR = last7Days.reduce((sum, d) => sum + d.ourPrice, 0) / last7Days.length;
    const prev7ADR = LIGHTHOUSE_REAL_DATA.slice(7, 14).reduce((sum, d) => sum + d.ourPrice, 0) / 7;
    const adrTrend = ((last7ADR - prev7ADR) / prev7ADR) * 100;
    
    const last7Occ = last7Days.reduce((sum, d) => sum + (d.marketDemand * 100), 0) / 7;
    const prev7Occ = LIGHTHOUSE_REAL_DATA.slice(7, 14).reduce((sum, d) => sum + (d.marketDemand * 100), 0) / 7;
    const occTrend = ((last7Occ - prev7Occ) / prev7Occ) * 100;
    
    return {
      revenue: Math.round(totalRevenue),
      adr: Math.round(avgADR),
      occupation: Math.round(avgOccupation),
      revpar: Math.round(revPAR),
      adrTrend: adrTrend.toFixed(1),
      occTrend: occTrend.toFixed(1),
    };
  }, []);

  // Alertes
  const alerts = useMemo(() => {
    const today = LIGHTHOUSE_REAL_DATA[0];
    const alerts: Array<{type: 'warning' | 'success' | 'info', message: string}> = [];
    
    if (today.ourPrice < today.compsetMedian * 0.9) {
      alerts.push({
        type: 'warning',
        message: `Prix sous marché : ${today.ourPrice}€ vs médiane ${today.compsetMedian}€`
      });
    }
    
    if (today.marketDemand > 0.9) {
      alerts.push({
        type: 'success',
        message: `Demande forte : ${Math.round(today.marketDemand * 100)}% - Opportunité yield`
      });
    }
    
    if (parseFloat(kpis.adrTrend) < -5) {
      alerts.push({
        type: 'warning',
        message: `ADR en baisse : ${kpis.adrTrend}% sur 7 jours`
      });
    }
    
    return alerts;
  }, [kpis]);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={LayoutDashboard}
          title="Dashboard Revenue"
          subtitle="Vue d'ensemble temps réel - KPIs, tendances, alertes"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="space-y-6">
          {/* KPI Cards Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Revenu 30j</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {Math.round(kpis.revenue / 1000)}K€
              </div>
              <div className="mt-1 text-xs text-gray-400">Estimé</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ADR Moyen</span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.adr}€</div>
              <div className={cn(
                'mt-1 text-xs flex items-center gap-1',
                parseFloat(kpis.adrTrend) >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {parseFloat(kpis.adrTrend) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpis.adrTrend}% vs 7j
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Occupation</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.occupation}%</div>
              <div className={cn(
                'mt-1 text-xs flex items-center gap-1',
                parseFloat(kpis.occTrend) >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {parseFloat(kpis.occTrend) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpis.occTrend}% vs 7j
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">RevPAR</span>
                <Target className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.revpar}€</div>
              <div className="mt-1 text-xs text-gray-400">Revenue / Room</div>
            </div>
          </div>

          {/* Alertes */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Alertes & Opportunités
              </h3>
              <div className="space-y-2">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-2 p-3 rounded-md text-sm',
                      alert.type === 'warning' ? 'bg-orange-50 text-orange-800' :
                      alert.type === 'success' ? 'bg-emerald-50 text-emerald-800' :
                      'bg-blue-50 text-blue-800'
                    )}
                  >
                    {alert.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tendance ADR 7 jours */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance ADR - 7 derniers jours</h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {LIGHTHOUSE_REAL_DATA.slice(0, 7).reverse().map((day, idx) => {
                const maxPrice = Math.max(...LIGHTHOUSE_REAL_DATA.slice(0, 7).map(d => d.ourPrice));
                const height = (day.ourPrice / maxPrice) * 100;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{ height: `${height}%` }}
                      title={`${day.dayName}: ${day.ourPrice}€`}
                    />
                    <div className="text-[10px] text-gray-400">{day.dayName}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Position marché */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Position vs Marché</h3>
            <div className="space-y-4">
              {LIGHTHOUSE_REAL_DATA.slice(0, 5).map((day, idx) => {
                const diff = day.ourPrice - day.compsetMedian;
                const diffPercent = (diff / day.compsetMedian) * 100;
                
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{day.dayName} {day.date.slice(5)}</span>
                      <span className={cn(
                        'font-semibold',
                        diff >= 0 ? 'text-emerald-600' : 'text-orange-600'
                      )}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(0)}€ ({diffPercent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            diff >= 0 ? 'bg-emerald-500' : 'bg-orange-500'
                          )}
                          style={{ width: `${Math.min(Math.abs(diffPercent), 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-24">
                        {day.ourPrice}€ vs {day.compsetMedian}€
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
