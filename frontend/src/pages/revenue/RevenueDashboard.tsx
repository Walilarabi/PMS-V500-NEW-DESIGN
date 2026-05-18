/**
 * FLOWTYM Revenue Dashboard
 *
 * Vue d'ensemble alimentée par les vraies données :
 *   - Lighthouse store : médiane, demande, ranking
 *   - Calendrier RMS : nos prix réels (chambre référente)
 *
 * Si aucune donnée Lighthouse importée → CTA vers la veille.
 */

import React, { useMemo, useEffect } from 'react';
import {
  LayoutDashboard, TrendingUp, TrendingDown, DollarSign, Users,
  Calendar, AlertTriangle, CheckCircle, Target, Upload,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useRateCalendarStore } from '../../components/rms/store/rateCalendarStore';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

export const RevenueDashboard: React.FC = () => {
  const lighthouseImport = useLighthouseStore(s => s.importData);
  const { roomTypes, loadData } = useRateCalendarStore();

  // Charger calendrier
  useEffect(() => {
    if (roomTypes.length === 0) loadData();
  }, []);

  const hasLighthouse = lighthouseImport !== null && lighthouseImport.days.length > 0;

  // ─── Si pas de Lighthouse, on affiche un CTA + un état vide ────────────
  if (!hasLighthouse) {
    return (
      <div className="flex-1 flex flex-col bg-[#F9FAFB]">
        <div className="p-6 pb-3">
          <RevenueHeader
            icon={LayoutDashboard}
            title="Dashboard Revenue"
            subtitle="Pilotage temps réel basé sur les données Lighthouse"
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Aucune donnée Lighthouse importée
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Le dashboard affiche les KPIs calculés à partir des données réelles importées (Lighthouse + calendrier tarifaire RMS).
              Importez votre fichier Excel Lighthouse depuis la page « Veille concurrentielle » pour commencer.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-2 text-sm font-medium"
            >
              <Target className="w-4 h-4" />
              Aller à la veille concurrentielle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const days = lighthouseImport.days;
  const today = new Date().toISOString().slice(0, 10);
  // Prendre 30 jours à partir d'aujourd'hui (ou les 30 premiers si tous dans le futur)
  const futureDays = days.filter(d => d.date >= today);
  const window30 = (futureDays.length > 0 ? futureDays : days).slice(0, 30);
  const window7 = window30.slice(0, 7);
  const prev7 = window30.slice(7, 14);

  const kpis = useMemo(() => {
    if (window30.length === 0) {
      return { avgPrice: 0, avgMedian: 0, gap: 0, gapPct: 0, avgDemand: 0, avgRank: 0, avgRankTotal: 0 };
    }

    const avgPrice = window30.reduce((s, d) => s + (d.ourPrice || 0), 0) / window30.length;
    const avgMedian = window30.reduce((s, d) => s + (d.compsetMedian || 0), 0) / window30.length;
    const avgDemand = window30.reduce((s, d) => s + d.marketDemandPercent, 0) / window30.length;
    const ranks = window30.map(d => d.rankPosition).filter((v): v is number => v !== null);
    const totals = window30.map(d => d.rankTotal).filter((v): v is number => v !== null);

    return {
      avgPrice: Math.round(avgPrice),
      avgMedian: Math.round(avgMedian),
      gap: Math.round(avgPrice - avgMedian),
      gapPct: avgMedian > 0 ? ((avgPrice - avgMedian) / avgMedian) * 100 : 0,
      avgDemand: Math.round(avgDemand),
      avgRank: ranks.length > 0 ? Math.round(ranks.reduce((s, r) => s + r, 0) / ranks.length) : 0,
      avgRankTotal: totals.length > 0 ? Math.round(totals.reduce((s, r) => s + r, 0) / totals.length) : 0,
    };
  }, [window30]);

  // Tendances 7j vs 7j-7j
  const trends = useMemo(() => {
    const adr7 = window7.length > 0 ? window7.reduce((s, d) => s + d.ourPrice, 0) / window7.length : 0;
    const adrPrev7 = prev7.length > 0 ? prev7.reduce((s, d) => s + d.ourPrice, 0) / prev7.length : 0;
    const adrDelta = adrPrev7 > 0 ? ((adr7 - adrPrev7) / adrPrev7) * 100 : 0;

    const dem7 = window7.length > 0 ? window7.reduce((s, d) => s + d.marketDemandPercent, 0) / window7.length : 0;
    const demPrev7 = prev7.length > 0 ? prev7.reduce((s, d) => s + d.marketDemandPercent, 0) / prev7.length : 0;
    const demDelta = demPrev7 > 0 ? ((dem7 - demPrev7) / demPrev7) * 100 : 0;

    return { adrDelta, demDelta };
  }, [window7, prev7]);

  // Alertes
  const alerts = useMemo(() => {
    const list: Array<{ type: 'warning' | 'success' | 'info'; message: string }> = [];
    const todayData = window30[0];
    if (!todayData) return list;

    if (todayData.ourPrice > 0 && todayData.compsetMedian > 0 && todayData.ourPrice < todayData.compsetMedian * 0.9) {
      list.push({
        type: 'warning',
        message: `${todayData.dayName} ${todayData.date.slice(5)} : notre prix (${todayData.ourPrice}€) est >10% sous la médiane compset (${todayData.compsetMedian}€)`,
      });
    }
    if (todayData.marketDemandPercent >= 90) {
      list.push({
        type: 'success',
        message: `${todayData.dayName} ${todayData.date.slice(5)} : demande très forte (${todayData.marketDemandPercent}%) — opportunité yield`,
      });
    }
    if (trends.adrDelta < -5) {
      list.push({
        type: 'warning',
        message: `ADR en baisse : ${trends.adrDelta.toFixed(1)}% sur 7 derniers jours`,
      });
    }
    return list;
  }, [window30, trends]);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={LayoutDashboard}
          title="Dashboard Revenue"
          subtitle={`Données réelles · ${lighthouseImport.fileName} · ${window30.length} jours analysés`}
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">ADR moyen 30j</span>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.avgPrice}€</div>
            <div className={cn(
              'mt-1 text-xs flex items-center gap-1',
              trends.adrDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {trends.adrDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trends.adrDelta.toFixed(1)}% vs 7j précédents
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Médiane compset</span>
              <Target className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.avgMedian}€</div>
            <div className={cn(
              'mt-1 text-xs',
              kpis.gap >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {kpis.gap >= 0 ? '+' : ''}{kpis.gap}€ écart ({kpis.gapPct.toFixed(1)}%)
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Demande moy.</span>
              <Users className="w-4 h-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{kpis.avgDemand}%</div>
            <div className={cn(
              'mt-1 text-xs flex items-center gap-1',
              trends.demDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {trends.demDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trends.demDelta.toFixed(1)}% vs 7j précédents
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Rang moyen</span>
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              #{kpis.avgRank || '—'}{kpis.avgRankTotal > 0 ? ` / ${kpis.avgRankTotal}` : ''}
            </div>
            <div className="mt-1 text-xs text-gray-400">Position compset</div>
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
                  {alert.type === 'success'
                    ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tendance ADR 7 jours */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance ADR — 7 prochains jours</h3>
          <div className="h-48 flex items-end justify-between gap-1">
            {window7.map((day, idx) => {
              const maxPrice = Math.max(...window7.map(d => d.ourPrice), 1);
              const height = (day.ourPrice / maxPrice) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.dayName} ${day.date.slice(5)} : ${day.ourPrice}€`}
                  />
                  <div className="text-[10px] text-gray-400">{day.dayName}</div>
                  <div className="text-[10px] text-gray-300">{day.ourPrice > 0 ? `${day.ourPrice}€` : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Position vs marché 5 prochains jours */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Position vs marché (5 prochains jours)</h3>
          <div className="space-y-4">
            {window30.slice(0, 5).map((day, idx) => {
              const diff = day.ourPrice - day.compsetMedian;
              const diffPct = day.compsetMedian > 0 ? (diff / day.compsetMedian) * 100 : 0;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{day.dayName} {day.date.slice(5)}</span>
                    <span className={cn(
                      'font-semibold',
                      diff >= 0 ? 'text-emerald-600' : 'text-orange-600'
                    )}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(0)}€ ({diffPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={cn('h-2 rounded-full', diff >= 0 ? 'bg-emerald-500' : 'bg-orange-500')}
                        style={{ width: `${Math.min(Math.abs(diffPct), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-32 text-right">
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
  );
};
