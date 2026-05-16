/**
 * FLOWTYM Revenue — Channels & OTAs
 *
 * Performance et rentabilité par canal de distribution :
 * Booking, Expedia, Airbnb, direct, GDS, etc.
 *
 * Statut : placeholder propre — implémentation Phase 2.
 */
import React from 'react';
import { Share2 } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { RevenueEmptyState } from '@/src/components/revenue/RevenueEmptyState';

export const ChannelsView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={Share2}
        title="Canaux & OTAs"
        subtitle="Performance, rentabilité et parité par canal de distribution"
      />
      <RevenueEmptyState
        icon={Share2}
        title="Module Canaux à venir"
        description="Analyse fine de chaque canal de distribution : performance, coût d'acquisition, rentabilité nette, parité tarifaire, et signaux de désintermédiation."
        features={[
          'Rentabilité nette par OTA (Booking, Expedia, Airbnb...)',
          'Coût d\'acquisition vs revenu direct',
          'Détection des écarts de parité tarifaire',
          'Mix direct vs OTA et opportunités de désintermédiation',
          'Synchronisation channel manager temps réel',
        ]}
        eta="Phase 2 — Q3 2026"
      />
    </div>
  );
};
