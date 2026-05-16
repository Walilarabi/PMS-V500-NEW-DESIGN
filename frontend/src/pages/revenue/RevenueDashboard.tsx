/**
 * FLOWTYM Revenue — Dashboard
 *
 * Vue de pilotage globale du revenue management : KPI temps réel,
 * tendances ADR/RevPAR/Occupation, pick-up, forecast, alertes.
 *
 * Statut : placeholder propre — implémentation Phase 2.
 */
import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { RevenueEmptyState } from '@/src/components/revenue/RevenueEmptyState';

export const RevenueDashboard: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={LayoutDashboard}
        title="Dashboard Revenue"
        subtitle="Vue d'ensemble : KPI temps réel, forecast, pick-up et alertes"
      />
      <RevenueEmptyState
        icon={LayoutDashboard}
        title="Dashboard de pilotage en construction"
        description="Le dashboard rassemblera les KPI critiques de revenue management dans une vue unique, conçue pour les décisions quotidiennes du yield manager."
        features={[
          'KPI temps réel : RevPAR, ADR, Taux d\'occupation, RGI',
          'Forecast à 7 / 14 / 30 jours avec confiance prédictive',
          'Pick-up multi-OTAs vs forecast',
          'Alertes : sous-perf, opportunités, anomalies de marché',
          'Comparaison Year-over-Year intelligente',
        ]}
        eta="Phase 2 — Q3 2026"
      />
    </div>
  );
};
