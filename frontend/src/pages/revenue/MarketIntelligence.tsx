/**
 * FLOWTYM Revenue — Market Intelligence
 *
 * Veille concurrentielle : prix des concurrents Lighthouse, comparaison
 * positionnement, indices de marché, alertes opportunité.
 *
 * Statut : placeholder propre — les données sont déjà en base
 * (public.competitor_rates, 3660 lignes pour Folkestone), l'UI sera
 * branchée dans le sprint dédié.
 */
import React from 'react';
import { Target } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { RevenueEmptyState } from '@/src/components/revenue/RevenueEmptyState';

export const MarketIntelligence: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={Target}
        title="Veille concurrentielle"
        subtitle="Positionnement marché et signaux issus de Lighthouse Rate Insight"
      />
      <RevenueEmptyState
        icon={Target}
        title="Module Veille concurrentielle à venir"
        description="Vue marché temps réel : prix concurrents sur Booking et autres OTAs, indices de positionnement, alertes opportunité et risque de perte de pricing power."
        features={[
          'Comparatif des prix concurrents jour par jour',
          'MPI (Market Penetration Index) et ARI (Average Rate Index)',
          'Détection automatique d\'opportunités de hausse de prix',
          'Alertes sold-out marché pour augmenter en demande forte',
          'Intégration Lighthouse Rate Insight (API + Excel)',
        ]}
        eta="Sprint suivant"
      />
    </div>
  );
};
