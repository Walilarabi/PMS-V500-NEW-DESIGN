/**
 * FLOWTYM — PERFORMANCE
 *
 * Dashboard de performance hôtelière : indicateurs clés (TO, ADR, RevPAR, GOPPAR),
 * comparatif N-1, classements top performers, alertes.
 *
 * Branchée sur les vraies données disponibles :
 * - configStore (rooms count, hotel info)
 * - lighthouseStore (compset & demande)
 * - rateCalendarStore (prix réels)
 */

import React, { useMemo } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, DollarSign, Bed, Users, Target,
  Calendar, BarChart3, Award, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { RevenueHeader } from '../components/revenue/RevenueHeader';
import { useConfigStore } from '../store/configStore';
import { useLighthouseStore } from '../store/lighthouseStore';
import { useRateCalendarStore } from '../components/rms/store/rateCalendarStore';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export const PerformanceView: React.FC = () => {
  const hotel = useConfigStore(s => s.hotel);
  const rooms = useConfigStore(s => s.rooms);
  const lighthouseImport = useLighthouseStore(s => s.importData);
  const { roomTypes } = useRateCalendarStore();

  // Calculs basés sur Lighthouse
  const metrics = useMemo(() => {
    const days = lighthouseImport?.days ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const future = days.filter(d => d.date >= today);
    const window30 = (future.length > 0 ? future : days).slice(0, 30);
    const window7 = window30.slice(0, 7);
    const prev7 = window30.slice(7, 14);
    const window90 = (future.length > 0 ? future : days).slice(0, 90);

    const roomCount = rooms.length || 1;

    const adr30 = window30.length > 0
      ? window30.reduce((s, d) => s + d.ourPrice, 0) / window30.length
      : 0;
    const adr7 = window7.length > 0
      ? window7.reduce((s, d) => s + d.ourPrice, 0) / window7.length
      : 0;
    const adrPrev7 = prev7.length > 0
      ? prev7.reduce((s, d) => s + d.ourPrice, 0) / prev7.length
      : 0;

    const demand30 = window30.length > 0
      ? window30.reduce((s, d) => s + d.marketDemandPercent, 0) / window30.length
      : 0;
    // RevPAR estimé = ADR × Occupation estimée (à partir de la demande marché)
    const occEst = Math.min(95, Math.max(20, demand30 * 0.85 + 15));
    const revpar30 = adr30 * (occEst / 100);
    const revparPrev7 = adrPrev7 * (occEst / 100);
    const adrDelta = adrPrev7 > 0 ? ((adr7 - adrPrev7) / adrPrev7) * 100 : 0;
    const revparDelta = revparPrev7 > 0 ? ((revpar30 - revparPrev7) / revparPrev7) * 100 : 0;
    const gop = revpar30 * 0.42; // estimation GOP ratio
    const totalRevenue30 = revpar30 * roomCount * window30.length;

    // Top journées (sur 30j)
    const sortedDays = [...window30]
      .filter(d => d.ourPrice > 0 && d.compsetMedian > 0)
      .sort((a, b) => (b.ourPrice - b.compsetMedian) - (a.ourPrice - a.compsetMedian));

    return {
      adr30, adr7, adrDelta,
      revpar30, revparDelta,
      demand30, occEst,
      gop, totalRevenue30,
      window30, window7, window90,
      sortedDays,
      hasData: days.length > 0,
    };
  }, [lighthouseImport, rooms]);

  // Top room types par disponibilité (depuis le calendrier)
  const topRoomTypes = useMemo(() => {
    return [...roomTypes]
      .filter(r => r.isActive)
      .slice(0, 5);
  }, [roomTypes]);

  if (!metrics.hasData) {
    return (
      <div className="flex-1 flex flex-col bg-[#F9FAFB]">
        <div className="p-6 pb-3">
          <RevenueHeader
            icon={Trophy}
            title="Performance"
            subtitle="Tableau de bord performance hôtelière — ADR, RevPAR, GOPPAR"
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Données insuffisantes
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Importez vos données Lighthouse depuis la Veille concurrentielle pour activer
              le tableau de bord performance.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
              className="px-5 py-2.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 inline-flex items-center gap-2 text-sm font-medium"
            >
              <Target className="w-4 h-4" />
              Aller à la veille concurrentielle
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={Trophy}
          title="Performance"
          subtitle={`${hotel?.name ?? 'Hôtel'} · ${rooms.length} chambres · 30 prochains jours`}
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">
        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<DollarSign className="w-4 h-4 text-blue-500" />}
            label="ADR 30j"
            value={`${Math.round(metrics.adr30)}€`}
            sub={`${pct(metrics.adrDelta)} vs 7j précédents`}
            subColor={metrics.adrDelta >= 0 ? 'emerald' : 'red'}
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_pricing' } }))}
          />
          <KpiCard
            icon={<BarChart3 className="w-4 h-4 text-purple-500" />}
            label="RevPAR 30j"
            value={`${Math.round(metrics.revpar30)}€`}
            sub={`${pct(metrics.revparDelta)} vs 7j précédents`}
            subColor={metrics.revparDelta >= 0 ? 'emerald' : 'red'}
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rms' } }))}
          />
          <KpiCard
            icon={<Bed className="w-4 h-4 text-orange-500" />}
            label="Occupation estimée"
            value={`${Math.round(metrics.occEst)}%`}
            sub={`Demande ${Math.round(metrics.demand30)}%`}
            subColor="slate"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
          />
          <KpiCard
            icon={<Award className="w-4 h-4 text-emerald-500" />}
            label="CA estimé 30j"
            value={`${Math.round(metrics.totalRevenue30 / 1000)}K€`}
            sub={`GOP/chambre ~${Math.round(metrics.gop)}€`}
            subColor="emerald"
          />
        </div>

        {/* Tendance RevPAR 7 jours */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">RevPAR — 7 prochains jours</h3>
            <span className="text-xs text-gray-500">Estimé · ADR × occupation prévue</span>
          </div>
          <div className="h-40 flex items-end justify-between gap-2">
            {metrics.window7.map((day, idx) => {
              const revpar = day.ourPrice * (metrics.occEst / 100);
              const maxRevpar = Math.max(...metrics.window7.map(d => d.ourPrice * (metrics.occEst / 100)), 1);
              const height = (revpar / maxRevpar) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="text-[10px] text-gray-400 font-semibold">{Math.round(revpar)}€</div>
                  <div
                    className="w-full bg-gradient-to-t from-violet-500 to-violet-400 rounded-t hover:brightness-110 transition-all"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.dayName} ${day.date.slice(5)} : RevPAR ${Math.round(revpar)}€`}
                  />
                  <div className="text-[10px] text-gray-500 font-medium">{day.dayName}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top journées + Top chambres */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              Top 5 journées (vs compset)
            </h3>
            <ul className="space-y-2">
              {metrics.sortedDays.slice(0, 5).map((d) => {
                const diff = d.ourPrice - d.compsetMedian;
                return (
                  <li key={d.date} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <span className="text-gray-700 font-medium">{d.dayName} {d.date.slice(5)}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">{d.ourPrice}€ vs {d.compsetMedian}€</span>
                      <span className={cn(
                        'font-bold px-2 py-0.5 rounded',
                        diff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                      )}>
                        {diff >= 0 ? '+' : ''}{diff}€
                      </span>
                    </div>
                  </li>
                );
              })}
              {metrics.sortedDays.length === 0 && (
                <li className="text-xs text-gray-400 italic">Aucune donnée comparative</li>
              )}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Bed className="w-4 h-4 text-orange-500" />
              Top 5 journées en baisse
            </h3>
            <ul className="space-y-2">
              {[...metrics.sortedDays].reverse().slice(0, 5).map((d) => {
                const diff = d.ourPrice - d.compsetMedian;
                return (
                  <li key={d.date} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <span className="text-gray-700 font-medium">{d.dayName} {d.date.slice(5)}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">{d.ourPrice}€ vs {d.compsetMedian}€</span>
                      <span className={cn(
                        'font-bold px-2 py-0.5 rounded flex items-center gap-1',
                        diff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                      )}>
                        {diff < 0 && <ArrowDownRight className="w-3 h-3" />}
                        {diff >= 0 ? '+' : ''}{diff}€
                      </span>
                    </div>
                  </li>
                );
              })}
              {metrics.sortedDays.length === 0 && (
                <li className="text-xs text-gray-400 italic">Aucune donnée comparative</li>
              )}
            </ul>
          </div>
        </div>

        {/* Types de chambres */}
        {topRoomTypes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Types de chambres actifs
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {topRoomTypes.map((rt) => (
                <button
                  key={rt.roomTypeId}
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_pricing' } }))}
                  className="border border-gray-200 rounded-md p-3 text-left hover:border-violet-400 hover:shadow-sm transition-all"
                >
                  <div className="text-xs font-bold text-gray-900">{rt.roomTypeName}</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-0.5">{rt.roomTypeCode}</div>
                  <div className="text-[11px] text-gray-600 mt-2">
                    Capacité : {rt.capacity} pers · {rt.ratePlans.length} plans
                  </div>
                  {rt.isReference && (
                    <span className="inline-block mt-1 text-[9px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                      RÉFÉRENT
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function KpiCard({
  icon, label, value, sub, subColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  subColor: 'emerald' | 'red' | 'slate';
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 text-left w-full',
        onClick && 'hover:border-violet-300 hover:shadow-sm transition-all'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      <div className={cn(
        'mt-1 text-xs flex items-center gap-1',
        subColor === 'emerald' ? 'text-emerald-600' :
        subColor === 'red' ? 'text-red-600' :
        'text-gray-500'
      )}>
        {subColor === 'emerald' && <TrendingUp className="w-3 h-3" />}
        {subColor === 'red' && <TrendingDown className="w-3 h-3" />}
        {sub}
      </div>
    </Tag>
  );
}
