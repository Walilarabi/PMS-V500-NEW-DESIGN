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
  Calendar, AlertTriangle, CheckCircle, Target, Upload, BedDouble,
  CreditCard, RefreshCw,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useRateCalendarStore } from '../../components/rms/store/rateCalendarStore';
import { useReservations } from '../../domains/reservations/hooks';
import { useRooms } from '../../domains/hotel/hooks';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

export const RevenueDashboard: React.FC = () => {
  const lighthouseImport = useLighthouseStore(s => s.importData);
  const { roomTypes, loadData } = useRateCalendarStore();

  // Real Supabase data — always fetched for the KPI fallback strip
  const { data: resData, isLoading: resLoading } = useReservations({ limit: 500 });
  const { data: rooms = [] } = useRooms();

  // Charger calendrier
  useEffect(() => {
    if (roomTypes.length === 0) loadData();
  }, []);

  const hasLighthouse = lighthouseImport !== null && lighthouseImport.days.length > 0;

  // ─── Supabase KPIs (always computed) ────────────────────────────────────
  const supabaseKpis = useMemo(() => {
    const rows = resData?.rows ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const totalRooms = rooms.length || 1;

    const inhouse = rows.filter(r =>
      r.check_in && r.check_out &&
      r.check_in <= today && r.check_out > today &&
      r.status !== 'cancelled'
    );
    const occupancy = Math.round((inhouse.length / totalRooms) * 100);
    const caTotal   = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const paid      = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
    const solde     = caTotal - paid;
    const arrivalsToday = rows.filter(r => r.check_in === today && r.status !== 'cancelled').length;
    const departuresToday = rows.filter(r => r.check_out === today && r.status !== 'cancelled').length;
    const overdue   = rows.filter(r => r.payment_status === 'overdue').length;

    // ADR from inhouse
    const adr = inhouse.length > 0
      ? Math.round(inhouse.reduce((s, r) => s + ((r.total_amount ?? 0) / Math.max(1, r.nights ?? 1)), 0) / inhouse.length)
      : 0;
    const revpar = totalRooms > 0 ? Math.round((adr * inhouse.length) / totalRooms) : 0;

    return { occupancy, caTotal, paid, solde, arrivalsToday, departuresToday, overdue, adr, revpar, inhouseCount: inhouse.length, totalRooms };
  }, [resData, rooms]);

  const fmtEUR = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  // ─── Si pas de Lighthouse, afficher les KPIs Supabase + CTA ─────────────
  if (!hasLighthouse) {
    return (
      <div className="flex-1 flex flex-col bg-[#F9FAFB]">
        <div className="p-6 pb-3">
          <RevenueHeader
            icon={LayoutDashboard}
            title="Dashboard Revenue"
            subtitle="KPIs opérationnels temps réel — données Supabase"
          />
        </div>
        <div className="px-6 pb-6 space-y-5">
          {/* Real KPI strip */}
          {resLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-[13px]"><RefreshCw size={14} className="animate-spin" /> Chargement des données…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Taux occup.',   value: `${supabaseKpis.occupancy}%`,            icon: BedDouble,   color: 'text-violet-600',  alert: false },
                { label: 'Occupées',      value: `${supabaseKpis.inhouseCount}/${supabaseKpis.totalRooms}`,icon: BedDouble,color:'text-violet-700',alert:false},
                { label: 'ADR',           value: `${supabaseKpis.adr}€`,                   icon: DollarSign,  color: 'text-emerald-600', alert: false },
                { label: 'RevPAR',        value: `${supabaseKpis.revpar}€`,                icon: TrendingUp,  color: 'text-emerald-700', alert: false },
                { label: 'Arrivées',      value: supabaseKpis.arrivalsToday.toString(),    icon: Calendar,    color: 'text-blue-600',    alert: false },
                { label: 'Départs',       value: supabaseKpis.departuresToday.toString(),  icon: Calendar,    color: 'text-blue-500',    alert: false },
                { label: 'Solde dû',      value: fmtEUR(supabaseKpis.solde),               icon: CreditCard,  color: 'text-red-600',     alert: supabaseKpis.solde > 0 },
                { label: 'En retard',     value: supabaseKpis.overdue.toString(),           icon: AlertTriangle,color:'text-red-700',    alert: supabaseKpis.overdue > 0 },
              ].map(k => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className={cn('bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm', k.alert && 'ring-red-200')}>
                    <div className="flex items-center gap-1 mb-1">
                      <Icon size={11} className={k.color} />
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
                    </div>
                    <p className={cn('text-[16px] font-bold', k.color)}>{k.value}</p>
                  </div>
                );
              })}
            </div>
          )}
          {/* CTA Lighthouse */}
          <div className="flex items-center gap-4 bg-blue-50 ring-1 ring-blue-200 rounded-2xl px-5 py-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Upload size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-blue-900">Données Lighthouse non importées</p>
              <p className="text-[11.5px] text-blue-700 mt-0.5">Importez votre fichier Excel depuis la veille concurrentielle pour afficher le compset, la demande marché et les recommandations yield.</p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[12.5px] font-semibold hover:bg-blue-700 shrink-0"
            >
              Importer
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
        {/* KPIs — cliquables pour drill-down */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_pricing' } }))}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-400 hover:shadow-sm transition-all"
            title="Ouvrir le Calendrier tarifaire"
          >
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
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-purple-400 hover:shadow-sm transition-all"
            title="Ouvrir la Veille concurrentielle"
          >
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
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rms' } }))}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-orange-400 hover:shadow-sm transition-all"
            title="Ouvrir le RMS Tableau Pro"
          >
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
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-emerald-400 hover:shadow-sm transition-all"
            title="Voir le détail du positionnement"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Rang moyen</span>
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              #{kpis.avgRank || '—'}{kpis.avgRankTotal > 0 ? ` / ${kpis.avgRankTotal}` : ''}
            </div>
            <div className="mt-1 text-xs text-gray-400">Position compset</div>
          </button>
        </div>

        {/* Alertes — cliquables pour naviguer vers la bonne page */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Alertes & Opportunités
            </h3>
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <button
                  key={idx}
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rms' } }))}
                  className={cn(
                    'flex items-start gap-2 p-3 rounded-md text-sm text-left w-full hover:brightness-95 transition-all',
                    alert.type === 'warning' ? 'bg-orange-50 text-orange-800' :
                    alert.type === 'success' ? 'bg-emerald-50 text-emerald-800' :
                    'bg-blue-50 text-blue-800'
                  )}
                  title="Cliquer pour ouvrir le RMS Tableau Pro"
                >
                  {alert.type === 'success'
                    ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>{alert.message}</span>
                </button>
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

        {/* Tendance écart médiane sur 30 jours — sparkline cliquable */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
          className="w-full bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-purple-300 hover:shadow-sm transition-all"
          title="Ouvrir la Veille concurrentielle"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Écart médiane compset — 30 prochains jours</h3>
              <p className="text-xs text-gray-500 mt-1">
                {(() => {
                  const valid = window30.filter(d => d.ourPrice > 0 && d.compsetMedian > 0);
                  if (valid.length === 0) return 'Pas de données suffisantes';
                  const above = valid.filter(d => d.ourPrice > d.compsetMedian).length;
                  const below = valid.length - above;
                  return `${above} jours au-dessus · ${below} jours en-dessous`;
                })()}
              </p>
            </div>
            <span className={cn(
              'text-xs font-bold px-2 py-1 rounded',
              kpis.gap >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
            )}>
              Moyenne {kpis.gap >= 0 ? '+' : ''}{kpis.gap}€ ({kpis.gapPct.toFixed(1)}%)
            </span>
          </div>
          {(() => {
            const series = window30.map(d => ({
              date: d.date,
              dayName: d.dayName,
              gap: d.ourPrice > 0 && d.compsetMedian > 0 ? d.ourPrice - d.compsetMedian : null,
            })).filter(p => p.gap !== null);
            if (series.length === 0) {
              return <div className="h-24 flex items-center justify-center text-xs text-gray-400">—</div>;
            }
            const maxAbs = Math.max(...series.map(p => Math.abs(p.gap as number)), 10);
            const W = 800;
            const H = 100;
            const stepX = series.length > 1 ? W / (series.length - 1) : W;
            const yFor = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - 6);
            const points = series.map((p, i) => `${i * stepX},${yFor(p.gap as number)}`).join(' ');
            const areaTop = `M0,${yFor(series[0].gap as number)} ` +
              series.map((p, i) => `L${i * stepX},${yFor(p.gap as number)}`).join(' ') +
              ` L${(series.length - 1) * stepX},${H / 2} L0,${H / 2} Z`;
            return (
              <div className="relative">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
                  <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" />
                  <path d={areaTop} fill="#8B5CF6" fillOpacity="0.12" />
                  <polyline points={points} fill="none" stroke="#8B5CF6" strokeWidth="2" />
                  {series.map((p, i) => (
                    <circle
                      key={p.date}
                      cx={i * stepX}
                      cy={yFor(p.gap as number)}
                      r="2.5"
                      fill={(p.gap as number) >= 0 ? '#10B981' : '#F97316'}
                    >
                      <title>{`${p.dayName} ${p.date.slice(5)} : ${(p.gap as number) >= 0 ? '+' : ''}${(p.gap as number).toFixed(0)}€`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                  <span>{series[0].date.slice(5)}</span>
                  <span className="text-gray-300">médiane = 0</span>
                  <span>{series[series.length - 1].date.slice(5)}</span>
                </div>
              </div>
            );
          })()}
        </button>

        {/* Position vs marché 5 prochains jours — cliquable */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Position vs marché (5 prochains jours)</h3>
          <p className="text-xs text-gray-500 mb-3">Cliquer sur une journée pour ouvrir le RMS</p>
          <div className="space-y-4">
            {window30.slice(0, 5).map((day, idx) => {
              const diff = day.ourPrice - day.compsetMedian;
              const diffPct = day.compsetMedian > 0 ? (diff / day.compsetMedian) * 100 : 0;
              return (
                <button
                  key={idx}
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rms' } }))}
                  className="w-full text-left hover:bg-gray-50 rounded p-2 -mx-2 transition-colors"
                >
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
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
