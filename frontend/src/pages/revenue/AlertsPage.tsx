/**
 * FLOWTYM RMS — Alertes RMS.
 *
 * Pilotage par événements : opportunités, risques, surchauffe marché,
 * compression, sous-pricing et overpricing. Fil d'alertes filtrable.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell, TrendingUp, AlertTriangle, Flame, Layers,
  ArrowDownCircle, ArrowUpCircle, CalendarDays, Clock, ChevronRight,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

type AlertKind =
  | 'opportunity'
  | 'risk'
  | 'overheating'
  | 'compression'
  | 'underpricing'
  | 'overpricing';

type Severity = 'critical' | 'warning' | 'info';

interface KindMeta {
  label: string;
  icon: LucideIcon;
  color: string;
}

const KIND_META: Record<AlertKind, KindMeta> = {
  opportunity: { label: 'Opportunité', icon: TrendingUp, color: '#16A34A' },
  risk: { label: 'Risque', icon: AlertTriangle, color: '#EF4444' },
  overheating: { label: 'Surchauffe marché', icon: Flame, color: '#EA580C' },
  compression: { label: 'Compression', icon: Layers, color: '#D97706' },
  underpricing: { label: 'Sous-pricing', icon: ArrowDownCircle, color: '#2563EB' },
  overpricing: { label: 'Overpricing', icon: ArrowUpCircle, color: '#7C3AED' },
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critique',
  warning: 'À surveiller',
  info: 'Information',
};

interface RmAlert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  message: string;
  dates: string;
  ago: string;
}

const ALERTS: RmAlert[] = [
  {
    id: 'a1', kind: 'opportunity', severity: 'critical',
    title: 'Tarif sous la médiane sur un pic de demande',
    message: "Le 18 juin, la demande atteint 87 % alors que votre tarif reste 14€ sous la médiane compset. Une hausse immédiate est recommandée.",
    dates: '18 juin 2026', ago: 'il y a 2 h',
  },
  {
    id: 'a2', kind: 'overheating', severity: 'critical',
    title: 'Surchauffe marché détectée',
    message: 'La pression marché dépasse 90 % sur la semaine du 22 au 27 juin. Le compset relève ses tarifs de +34€ en moyenne.',
    dates: '22 → 27 juin 2026', ago: 'il y a 3 h',
  },
  {
    id: 'a3', kind: 'compression', severity: 'warning',
    title: 'Compression de disponibilité compset',
    message: '6 hôtels sur 10 du compset affichent complet le 25 juin. La rareté justifie une stratégie de compression.',
    dates: '25 juin 2026', ago: 'il y a 5 h',
  },
  {
    id: 'a4', kind: 'underpricing', severity: 'warning',
    title: 'Sous-pricing sur le week-end',
    message: 'Votre positionnement est #9/10 les 19 et 20 juin. Le potentiel de hausse est estimé à +22€ sans risque sur le volume.',
    dates: '19 → 20 juin 2026', ago: 'il y a 8 h',
  },
  {
    id: 'a5', kind: 'overpricing', severity: 'warning',
    title: 'Risque d\'overpricing en début de mois',
    message: 'Du 1er au 5 juin, votre tarif dépasse la médiane de +9 % avec une demande faible (< 30 %). Le remplissage est exposé.',
    dates: '1 → 5 juin 2026', ago: 'il y a 12 h',
  },
  {
    id: 'a6', kind: 'risk', severity: 'critical',
    title: 'Chute de pickup vs hier',
    message: 'Le pickup à 7 jours recule de -18 % sur la semaine du 8 juin. À surveiller si la tendance se confirme demain.',
    dates: '8 → 14 juin 2026', ago: 'il y a 1 j',
  },
  {
    id: 'a7', kind: 'opportunity', severity: 'info',
    title: 'Événement marché à fort potentiel',
    message: 'Un salon professionnel est confirmé du 16 au 18 juin. La demande compset anticipée justifie une ouverture tarifaire.',
    dates: '16 → 18 juin 2026', ago: 'il y a 1 j',
  },
  {
    id: 'a8', kind: 'risk', severity: 'warning',
    title: 'Dépendance OTA en hausse',
    message: 'La part Booking.com atteint 61 % des réservations du mois. Diversifier le mix distribution réduit le risque de commission.',
    dates: 'Juin 2026', ago: 'il y a 2 j',
  },
  {
    id: 'a9', kind: 'compression', severity: 'info',
    title: 'Fenêtre de réservation qui se raccourcit',
    message: 'Le lead time moyen passe de 21 à 14 jours. Activer la stratégie « Dernière minute » peut capter ce report.',
    dates: 'Juin 2026', ago: 'il y a 3 j',
  },
];

interface FilterDef {
  id: 'all' | AlertKind;
  label: string;
}

const FILTERS: FilterDef[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'opportunity', label: 'Opportunités' },
  { id: 'risk', label: 'Risques' },
  { id: 'overheating', label: 'Surchauffe' },
  { id: 'compression', label: 'Compression' },
  { id: 'underpricing', label: 'Sous-pricing' },
  { id: 'overpricing', label: 'Overpricing' },
];

export const AlertsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | AlertKind>('all');

  const visible = useMemo(
    () => (filter === 'all' ? ALERTS : ALERTS.filter((a) => a.kind === filter)),
    [filter],
  );

  const stats = useMemo(() => {
    return {
      opportunities: ALERTS.filter((a) => a.kind === 'opportunity').length,
      risks: ALERTS.filter((a) => a.kind === 'risk').length,
      critical: ALERTS.filter((a) => a.severity === 'critical').length,
      total: ALERTS.length,
    };
  }, []);

  const summary = [
    { label: 'Opportunités', value: stats.opportunities, color: '#16A34A' },
    { label: 'Risques', value: stats.risks, color: '#EF4444' },
    { label: 'Critiques', value: stats.critical, color: '#EA580C' },
    { label: 'Alertes actives', value: stats.total, color: '#8B5CF6' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Bell}
          title="Alertes RMS"
          subtitle="Pilotage par événements — opportunités, risques et signaux marché en temps réel"
        />

        {/* Synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {summary.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4"
            >
              <div className="text-[12px] font-semibold text-gray-400">{s.label}</div>
              <div className="text-[28px] font-extrabold mt-1" style={{ color: s.color }}>
                {s.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`h-9 px-3.5 rounded-xl text-[12.5px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Fil d'alertes */}
        <div className="space-y-3">
          {visible.map((alert, i) => {
            const meta = KIND_META[alert.kind];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.03 * i }}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex items-start gap-3.5"
                style={{ borderLeft: `4px solid ${meta.color}` }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${meta.color}1a` }}
                >
                  <meta.icon className="w-5 h-5" style={{ color: meta.color }} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {alert.severity === 'critical' && (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        {SEVERITY_LABEL.critical}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.ago}
                    </span>
                  </div>

                  <h3 className="text-[14px] font-bold text-gray-900 mt-1.5">{alert.title}</h3>
                  <p className="text-[12.5px] text-gray-500 leading-snug mt-0.5">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2 text-[11.5px] font-semibold text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {alert.dates}
                  </div>
                </div>

                <button
                  type="button"
                  className="self-center shrink-0 h-9 px-3 rounded-xl bg-gray-50 hover:bg-[#8B5CF6]/10 text-[12.5px] font-semibold text-gray-600 hover:text-[#8B5CF6] flex items-center gap-1 transition-colors"
                >
                  Traiter
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}

          {visible.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center text-[13px] text-gray-400">
              Aucune alerte pour ce filtre.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
