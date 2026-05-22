/**
 * FLOWTYM RMS — Simulation RMS.
 *
 * Mesure l'impact projeté d'une décision tarifaire avant application :
 * hausse de tarif, fermeture d'un canal, réduction de disponibilité,
 * activation d'une promotion, passage en stratégie agressive.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, TrendingUp, TrendingDown, Ban, BedDouble, Tag, Swords,
  ArrowRight, Sparkles, Minus,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

interface Scenario {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  /** Variation max de l'ADR (ratio) à intensité 100 %. */
  adrMax: number;
  /** Variation max de l'occupation (points de %) à intensité 100 %. */
  occMax: number;
  /** Variation max du volume de nuitées (ratio) à intensité 100 %. */
  roomNightsMax: number;
}

const SCENARIOS: Scenario[] = [
  { id: 'raise', label: 'Monter le tarif', hint: 'Ampleur de la hausse appliquée', icon: TrendingUp, accent: '#EF4444', adrMax: 0.28, occMax: -14, roomNightsMax: 0 },
  { id: 'close_booking', label: 'Fermer Booking.com', hint: 'Part de fermeture du canal', icon: Ban, accent: '#2563EB', adrMax: 0.06, occMax: -22, roomNightsMax: 0 },
  { id: 'reduce_avail', label: 'Réduire la disponibilité', hint: 'Ampleur de la restriction', icon: BedDouble, accent: '#D97706', adrMax: 0.09, occMax: 12, roomNightsMax: -0.18 },
  { id: 'promo', label: 'Activer une promotion', hint: 'Profondeur de la remise', icon: Tag, accent: '#16A34A', adrMax: -0.12, occMax: 18, roomNightsMax: 0 },
  { id: 'aggressive', label: 'Stratégie agressive', hint: 'Intensité du yield agressif', icon: Swords, accent: '#DC2626', adrMax: 0.22, occMax: -9, roomNightsMax: 0 },
];

const BASE = { adr: 326, occ: 78, roomNights: 1800 };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const euro = (v: number) => `${Math.round(v).toLocaleString('fr-FR')}€`;
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

interface Kpi {
  label: string;
  before: string;
  after: string;
  delta: number;
}

export const SimulationPage: React.FC = () => {
  const [scenarioId, setScenarioId] = useState<string>('raise');
  const [intensity, setIntensity] = useState<number>(60);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  const result = useMemo(() => {
    const t = intensity / 100;

    const baseRevpar = (BASE.adr * BASE.occ) / 100;
    const baseCa = baseRevpar * BASE.roomNights;

    const adr = BASE.adr * (1 + scenario.adrMax * t);
    const occ = clamp(BASE.occ + scenario.occMax * t, 4, 99);
    const roomNights = BASE.roomNights * (1 + scenario.roomNightsMax * t);
    const revpar = (adr * occ) / 100;
    const ca = revpar * roomNights;

    const pctDelta = (after: number, before: number) =>
      before === 0 ? 0 : ((after - before) / before) * 100;

    const kpis: Kpi[] = [
      { label: 'ADR', before: euro(BASE.adr), after: euro(adr), delta: pctDelta(adr, BASE.adr) },
      { label: 'Occupation', before: `${BASE.occ}%`, after: `${Math.round(occ)}%`, delta: occ - BASE.occ },
      { label: 'RevPAR', before: euro(baseRevpar), after: euro(revpar), delta: pctDelta(revpar, baseRevpar) },
      { label: 'CA période', before: euro(baseCa), after: euro(ca), delta: pctDelta(ca, baseCa) },
    ];

    const revparDelta = pctDelta(revpar, baseRevpar);
    return { kpis, revparDelta, caDelta: pctDelta(ca, baseCa) };
  }, [scenario, intensity]);

  const verdict =
    result.revparDelta > 1.5
      ? { label: 'Décision favorable', tone: '#16A34A', icon: TrendingUp }
      : result.revparDelta < -1.5
        ? { label: 'Décision défavorable', tone: '#EF4444', icon: TrendingDown }
        : { label: 'Impact neutre', tone: '#94A3B8', icon: Minus };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Activity}
          title="Simulation RMS"
          subtitle="Mesurez l'impact projeté d'une décision tarifaire avant de l'appliquer"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Constructeur de scénario */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5"
          >
            <h2 className="text-[15px] font-bold text-gray-900 mb-1">Scénario</h2>
            <p className="text-[12.5px] text-gray-400 mb-4">
              Choisissez une hypothèse et son intensité.
            </p>

            <div className="space-y-2">
              {SCENARIOS.map((s) => {
                const isActive = s.id === scenarioId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenarioId(s.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-transparent ring-2 bg-gray-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    style={isActive ? { boxShadow: `0 0 0 2px ${s.accent}` } : undefined}
                  >
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${s.accent}1a` }}
                    >
                      <s.icon className="w-4.5 h-4.5" style={{ color: s.accent }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-gray-800">{s.label}</span>
                      <span className="block text-[11.5px] text-gray-400">{s.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Intensité */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12.5px] font-semibold text-gray-600">
                  {scenario.hint}
                </span>
                <span
                  className="text-[13px] font-extrabold px-2 py-0.5 rounded-lg"
                  style={{ backgroundColor: `${scenario.accent}1a`, color: scenario.accent }}
                >
                  {intensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
                style={{ accentColor: scenario.accent }}
              />
              <div className="flex justify-between text-[10.5px] text-gray-400 mt-1">
                <span>Aucun</span>
                <span>Modéré</span>
                <span>Maximal</span>
              </div>
            </div>
          </motion.div>

          {/* Impact projeté */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-7 flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4">
              {result.kpis.map((kpi) => {
                const positive = kpi.delta > 0.05;
                const negative = kpi.delta < -0.05;
                const color = positive ? '#16A34A' : negative ? '#EF4444' : '#94A3B8';
                const isPts = kpi.label === 'Occupation';
                return (
                  <div
                    key={kpi.label}
                    className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4"
                  >
                    <div className="text-[12px] font-semibold text-gray-400">{kpi.label}</div>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-[14px] font-semibold text-gray-300 line-through">
                        {kpi.before}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                      <span className="text-[22px] font-extrabold text-gray-900">{kpi.after}</span>
                    </div>
                    <div className="text-[12.5px] font-bold mt-1" style={{ color }}>
                      {kpi.delta > 0 ? '+' : ''}
                      {isPts
                        ? `${kpi.delta.toFixed(1).replace('.', ',')} pts`
                        : pct(kpi.delta)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verdict */}
            <div
              className="rounded-2xl p-5 text-white shadow-lg flex items-center gap-4"
              style={{ background: `linear-gradient(120deg, ${verdict.tone}, ${verdict.tone}cc)` }}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <verdict.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-white/70">
                  Verdict de la simulation
                </div>
                <div className="text-[18px] font-extrabold leading-tight">{verdict.label}</div>
                <div className="text-[12.5px] text-white/85 mt-0.5">
                  « {scenario.label} » à {intensity}% : RevPAR{' '}
                  {result.revparDelta >= 0 ? '+' : ''}
                  {pct(result.revparDelta)} · CA {result.caDelta >= 0 ? '+' : ''}
                  {pct(result.caDelta)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200/80 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-violet-600" />
              </div>
              <p className="text-[12.5px] text-gray-500 leading-relaxed">
                Projection indicative basée sur l'élasticité prix observée du compset. Une fois
                validé, le scénario peut être transféré vers{' '}
                <span className="font-semibold text-gray-700">Pricing &amp; Recommandations</span>{' '}
                pour application.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;
