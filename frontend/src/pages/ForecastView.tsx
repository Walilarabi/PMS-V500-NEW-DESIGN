/**
 * FLOWTYM — PRÉVISIONNEL
 *
 * Forecasting des prochains 30-90 jours : projection ADR/RevPAR,
 * scénarios optimiste/pessimiste, alertes opportunités.
 */

import React, { useMemo, useState } from 'react';
import {
  Telescope, Calendar, TrendingUp, TrendingDown, AlertTriangle,
  Sparkles, ArrowUpRight, ArrowDownRight, Info,
} from 'lucide-react';
import { RevenueHeader } from '../components/revenue/RevenueHeader';
import { useConfigStore } from '../store/configStore';
import { useLighthouseStore } from '../store/lighthouseStore';

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

type Horizon = 30 | 60 | 90;

export const ForecastView: React.FC = () => {
  const [horizon, setHorizon] = useState<Horizon>(30);
  const hotel = useConfigStore(s => s.hotel);
  const rooms = useConfigStore(s => s.rooms);
  const lighthouseImport = useLighthouseStore(s => s.importData);

  const forecast = useMemo(() => {
    const days = lighthouseImport?.days ?? [];
    if (days.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const future = days.filter(d => d.date >= today);
    const window = (future.length > 0 ? future : days).slice(0, horizon);

    const adrAvg = window.reduce((s, d) => s + d.ourPrice, 0) / Math.max(window.length, 1);
    const medianAvg = window.reduce((s, d) => s + d.compsetMedian, 0) / Math.max(window.length, 1);
    const demandAvg = window.reduce((s, d) => s + d.marketDemandPercent, 0) / Math.max(window.length, 1);
    const occBase = Math.min(95, Math.max(20, demandAvg * 0.85 + 15));
    const revparBase = adrAvg * (occBase / 100);
    const roomCount = rooms.length || 1;

    // Scénarios
    const scenarios = {
      pessimistic: {
        label: 'Pessimiste',
        adr: adrAvg * 0.92,
        occ: occBase * 0.85,
      },
      realistic: {
        label: 'Réaliste',
        adr: adrAvg,
        occ: occBase,
      },
      optimistic: {
        label: 'Optimiste',
        adr: adrAvg * 1.08,
        occ: Math.min(95, occBase * 1.12),
      },
    } as const;

    const computeRevenue = (s: { adr: number; occ: number }) =>
      s.adr * (s.occ / 100) * roomCount * window.length;

    // Opportunités : journées sous médiane avec forte demande
    const opportunities = window.filter(d =>
      d.ourPrice > 0 && d.compsetMedian > 0 &&
      d.ourPrice < d.compsetMedian * 0.92 &&
      d.marketDemandPercent >= 60
    ).slice(0, 5);

    // Risques : journées sur-pricées avec faible demande
    const risks = window.filter(d =>
      d.ourPrice > 0 && d.compsetMedian > 0 &&
      d.ourPrice > d.compsetMedian * 1.10 &&
      d.marketDemandPercent < 40
    ).slice(0, 5);

    return {
      window,
      adrAvg: Math.round(adrAvg),
      medianAvg: Math.round(medianAvg),
      demandAvg: Math.round(demandAvg),
      occBase: Math.round(occBase),
      revparBase: Math.round(revparBase),
      scenarios,
      computeRevenue,
      opportunities,
      risks,
    };
  }, [lighthouseImport, rooms, horizon]);

  if (!forecast) {
    return (
      <div className="flex-1 flex flex-col bg-[#F9FAFB]">
        <div className="p-6 pb-3">
          <RevenueHeader
            icon={Telescope}
            title="Prévisionnel"
            subtitle="Projections de revenus sur 30-90 jours"
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <Telescope className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Données insuffisantes
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Importez vos données Lighthouse depuis la Veille concurrentielle pour activer les projections.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_compset' } }))}
              className="px-5 py-2.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 inline-flex items-center gap-2 text-sm font-medium"
            >
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
          icon={Telescope}
          title="Prévisionnel"
          subtitle={`${hotel?.name ?? 'Hôtel'} · projection ${horizon} jours · ${forecast.window.length} jours analysés`}
          actions={
            <div className="flex items-center gap-1 border border-gray-300 rounded-md bg-white p-1">
              {([30, 60, 90] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded transition-colors',
                    horizon === h
                      ? 'bg-violet-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {h}j
                </button>
              ))}
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5">
        {/* Référence */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RefCard label="ADR moyen prévu" value={`${forecast.adrAvg}€`} sub={`Médiane compset ${forecast.medianAvg}€`} />
          <RefCard label="Occupation prévue" value={`${forecast.occBase}%`} sub={`Demande ${forecast.demandAvg}%`} />
          <RefCard label="RevPAR projeté" value={`${forecast.revparBase}€`} sub="ADR × occupation" />
          <RefCard label="Nb chambres" value={`${rooms.length}`} sub={`${forecast.window.length} jours`} />
        </div>

        {/* Scénarios */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Scénarios de revenus sur {horizon} jours
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['pessimistic', 'realistic', 'optimistic'] as const).map(key => {
              const s = forecast.scenarios[key];
              const rev = forecast.computeRevenue(s);
              const color = key === 'optimistic' ? 'emerald' : key === 'pessimistic' ? 'orange' : 'violet';
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-lg border-2 p-4',
                    color === 'emerald' && 'border-emerald-300 bg-emerald-50/30',
                    color === 'violet' && 'border-violet-300 bg-violet-50/30',
                    color === 'orange' && 'border-orange-300 bg-orange-50/30'
                  )}
                >
                  <div className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    color === 'emerald' && 'text-emerald-700',
                    color === 'violet' && 'text-violet-700',
                    color === 'orange' && 'text-orange-700'
                  )}>
                    {s.label}
                  </div>
                  <div className="mt-2 text-3xl font-extrabold text-gray-900">
                    {Math.round(rev / 1000)}K€
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    ADR {Math.round(s.adr)}€ · Occ {Math.round(s.occ)}%
                  </div>
                  <div className="mt-2 text-[11px] text-gray-400">
                    RevPAR {Math.round(s.adr * s.occ / 100)}€
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Scénarios calculés à partir de l'ADR Lighthouse et de la demande marché.
            Pessimiste : −8% ADR / −15% occupation · Optimiste : +8% ADR / +12% occupation.
          </p>
        </div>

        {/* Opportunités & Risques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              Opportunités ({forecast.opportunities.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Journées sous-pricées avec forte demande — augmentation conseillée.
            </p>
            <ul className="space-y-2">
              {forecast.opportunities.map(d => (
                <li key={d.date} className="border border-emerald-100 bg-emerald-50/50 rounded p-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{d.dayName} {d.date.slice(5)}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Demande {d.marketDemandPercent}% · médiane {d.compsetMedian}€
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-700">{d.ourPrice}€</div>
                    <div className="text-[10px] text-emerald-600">
                      +{Math.round(d.compsetMedian - d.ourPrice)}€ possible
                    </div>
                  </div>
                </li>
              ))}
              {forecast.opportunities.length === 0 && (
                <li className="text-xs text-gray-400 italic">Aucune opportunité détectée</li>
              )}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Risques ({forecast.risks.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Journées sur-pricées avec faible demande — baisse conseillée.
            </p>
            <ul className="space-y-2">
              {forecast.risks.map(d => (
                <li key={d.date} className="border border-orange-100 bg-orange-50/50 rounded p-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{d.dayName} {d.date.slice(5)}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Demande {d.marketDemandPercent}% · médiane {d.compsetMedian}€
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-orange-700">{d.ourPrice}€</div>
                    <div className="text-[10px] text-orange-600 flex items-center gap-1 justify-end">
                      <ArrowDownRight className="w-3 h-3" />
                      −{Math.round(d.ourPrice - d.compsetMedian)}€ conseillé
                    </div>
                  </div>
                </li>
              ))}
              {forecast.risks.length === 0 && (
                <li className="text-xs text-gray-400 italic">Aucun risque détecté</li>
              )}
            </ul>
          </div>
        </div>

        {/* CTA actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rms' } }))}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-md hover:bg-violet-700 inline-flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Ajuster dans le RMS
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'rev_pricing' } }))}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Ouvrir le Calendrier tarifaire
          </button>
        </div>
      </div>
    </div>
  );
};

function RefCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}
