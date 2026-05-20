/**
 * FLOWTYM Revenue — Promotions
 *
 * Gestion des codes promo, offres flash, campagnes saisonnières.
 *
 * Statut : placeholder propre — implémentation Phase 2.
 */
import React from 'react';
import { Tag } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { RevenueEmptyState } from '@/src/components/revenue/RevenueEmptyState';

export const PromotionsView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={Tag}
        title="Promotions"
        subtitle="Codes promo, offres flash et campagnes multi-canaux"
      />
      <RevenueEmptyState
        icon={Tag}
        title="Module Promotions à venir"
        description="Création et suivi des offres commerciales : codes promo, offres flash, packages, campagnes saisonnières et early booking sur tous les canaux."
        features={[
          'Codes promo personnalisables (réduction fixe / %)',
          'Offres flash avec deadline automatique',
          'Packages (chambre + petit-déj, séjour + spa...)',
          'Campagnes saisonnières programmables',
          'Push automatique vers Booking, Expedia, direct',
        ]}
        eta="Phase 2 — Q3 2026"
      />
    </div>
  );
};
