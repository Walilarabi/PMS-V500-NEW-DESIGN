/**
 * FLOWTYM RMS — Stratégies tarifaires.
 *
 * Pilotage du positionnement RMS de l'établissement : choix d'une
 * stratégie tarifaire directrice exploitée par le moteur d'automatisation,
 * les recommandations et la simulation.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Target, Swords, Shield, Scale, Crown, BedDouble, Clock, Flame,
  Check, Gauge,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

interface Strategy {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  description: string;
  params: { label: string; value: string }[];
  metrics: { label: string; value: string; tone: 'up' | 'down' | 'flat' }[];
}

const STRATEGIES: Strategy[] = [
  {
    id: 'aggressive',
    name: 'Agressif',
    tagline: 'Maximiser le RevPAR',
    icon: Swords,
    accent: '#EF4444',
    description:
      "Hausses tarifaires rapides dès que la demande progresse. Capte le revenu sur les pics, accepte une occupation plus basse.",
    params: [
      { label: 'Élasticité prix', value: 'Haute' },
      { label: 'Seuil de hausse', value: 'Demande > 60 %' },
      { label: 'Plafond tarifaire', value: '+35 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+12 %', tone: 'up' },
      { label: 'ADR', value: '+18 %', tone: 'up' },
      { label: 'Occupation', value: '-6 pts', tone: 'down' },
    ],
  },
  {
    id: 'defensive',
    name: 'Défensif',
    tagline: "Sécuriser l'occupation",
    icon: Shield,
    accent: '#2563EB',
    description:
      "Tarifs prudents pour protéger le taux de remplissage. Privilégie la stabilité du volume sur les marchés incertains.",
    params: [
      { label: 'Élasticité prix', value: 'Basse' },
      { label: 'Seuil de baisse', value: 'Demande < 45 %' },
      { label: 'Plancher tarifaire', value: '-20 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+3 %', tone: 'up' },
      { label: 'ADR', value: '-4 %', tone: 'down' },
      { label: 'Occupation', value: '+9 pts', tone: 'up' },
    ],
  },
  {
    id: 'balanced',
    name: 'Équilibré',
    tagline: 'RevPAR & occupation',
    icon: Scale,
    accent: '#8B5CF6',
    description:
      "Compromis entre prix et volume. Ajuste les tarifs progressivement en suivant la médiane compset et la demande marché.",
    params: [
      { label: 'Élasticité prix', value: 'Modérée' },
      { label: 'Référence', value: 'Médiane compset' },
      { label: 'Amplitude', value: '±15 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+7 %', tone: 'up' },
      { label: 'ADR', value: '+5 %', tone: 'up' },
      { label: 'Occupation', value: '+2 pts', tone: 'up' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Positionnement haut de gamme',
    icon: Crown,
    accent: '#D97706',
    description:
      "Maintient un tarif au-dessus du compset pour préserver l'image de marque. Refuse la course au prix bas.",
    params: [
      { label: 'Position cible', value: 'Top 3 compset' },
      { label: 'Écart médiane', value: '+10 à +25 %' },
      { label: 'Discount OTA', value: 'Limité' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+5 %', tone: 'up' },
      { label: 'ADR', value: '+21 %', tone: 'up' },
      { label: 'Occupation', value: '-11 pts', tone: 'down' },
    ],
  },
  {
    id: 'fill',
    name: 'Remplissage',
    tagline: "Maximiser l'occupation",
    icon: BedDouble,
    accent: '#16A34A',
    description:
      "Priorité absolue au taux d'occupation. Tarifs attractifs pour écouler l'inventaire sur les périodes creuses.",
    params: [
      { label: 'Objectif occupation', value: '> 92 %' },
      { label: 'Élasticité prix', value: 'Très haute' },
      { label: 'Plancher tarifaire', value: '-30 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+1 %', tone: 'flat' },
      { label: 'ADR', value: '-12 %', tone: 'down' },
      { label: 'Occupation', value: '+16 pts', tone: 'up' },
    ],
  },
  {
    id: 'lastminute',
    name: 'Dernière minute',
    tagline: 'Capter la demande J / J-3',
    icon: Clock,
    accent: '#0891B2',
    description:
      "Optimise les réservations de dernière minute. Tarifs dynamiques sur la fenêtre courte selon le pickup observé.",
    params: [
      { label: 'Fenêtre', value: 'J à J-3' },
      { label: 'Déclencheur', value: 'Pickup faible' },
      { label: 'Amplitude', value: '±25 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+6 %', tone: 'up' },
      { label: 'ADR', value: '-3 %', tone: 'down' },
      { label: 'Occupation', value: '+8 pts', tone: 'up' },
    ],
  },
  {
    id: 'compression',
    name: 'Compression forte',
    tagline: 'Exploiter la rareté',
    icon: Flame,
    accent: '#DC2626',
    description:
      "Active des hausses marquées quand le marché est en surchauffe et la disponibilité compset faible. Maximise le yield sur événements.",
    params: [
      { label: 'Déclencheur', value: 'Pression > 85 %' },
      { label: 'Élasticité prix', value: 'Extrême' },
      { label: 'Plafond tarifaire', value: '+60 %' },
    ],
    metrics: [
      { label: 'RevPAR', value: '+19 %', tone: 'up' },
      { label: 'ADR', value: '+34 %', tone: 'up' },
      { label: 'Occupation', value: '-12 pts', tone: 'down' },
    ],
  },
];

const TONE_CLASS: Record<'up' | 'down' | 'flat', string> = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  flat: 'text-gray-400',
};

export const StrategiesPage: React.FC = () => {
  const [activeId, setActiveId] = useState<string>('balanced');
  const active = STRATEGIES.find((s) => s.id === activeId) ?? STRATEGIES[2];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Target}
          title="Stratégies tarifaires"
          subtitle="Pilotez le positionnement RMS — la stratégie active alimente l'automatisation, les recommandations et la simulation"
        />

        {/* Bandeau stratégie active */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl p-5 mb-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(120deg, ${active.accent}, ${active.accent}cc)`,
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <active.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-white/70">
                  Stratégie active
                </div>
                <div className="text-[20px] font-extrabold leading-tight">{active.name}</div>
                <div className="text-[13px] text-white/80">{active.tagline}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {active.metrics.map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-[11px] font-medium text-white/70">{m.label}</div>
                  <div className="text-[17px] font-extrabold">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Grille des stratégies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STRATEGIES.map((strategy, i) => {
            const isActive = strategy.id === activeId;
            return (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
                className={`bg-white rounded-2xl border p-4 flex flex-col transition-all ${
                  isActive
                    ? 'border-transparent ring-2 shadow-md'
                    : 'border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md'
                }`}
                style={isActive ? { boxShadow: `0 0 0 2px ${strategy.accent}` } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${strategy.accent}1a` }}
                  >
                    <strategy.icon className="w-5 h-5" style={{ color: strategy.accent }} />
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: strategy.accent }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>

                <h3 className="text-[15px] font-bold text-gray-900 mt-3">{strategy.name}</h3>
                <p className="text-[12px] font-semibold" style={{ color: strategy.accent }}>
                  {strategy.tagline}
                </p>
                <p className="text-[12px] text-gray-500 leading-snug mt-2 flex-1">
                  {strategy.description}
                </p>

                <div className="mt-3 space-y-1.5">
                  {strategy.params.map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-gray-400">{p.label}</span>
                      <span className="font-semibold text-gray-700">{p.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {strategy.metrics.map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="text-[10px] text-gray-400">{m.label}</div>
                      <div className={`text-[12.5px] font-bold ${TONE_CLASS[m.tone]}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveId(strategy.id)}
                  disabled={isActive}
                  className={`mt-3 h-9 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-4 h-4" /> Stratégie appliquée
                    </>
                  ) : (
                    'Activer cette stratégie'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Note d'exploitation */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-200/80 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Gauge className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="text-[12.5px] text-gray-500 leading-relaxed">
            La stratégie sélectionnée est exploitée dans{' '}
            <span className="font-semibold text-gray-700">Pricing &amp; Recommandations</span>,{' '}
            <span className="font-semibold text-gray-700">Automatisation</span>,{' '}
            <span className="font-semibold text-gray-700">Simulation</span> et le{' '}
            <span className="font-semibold text-gray-700">Dashboard</span>. Chaque changement
            recalcule les recommandations RMS et les garde-fous appliqués.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
