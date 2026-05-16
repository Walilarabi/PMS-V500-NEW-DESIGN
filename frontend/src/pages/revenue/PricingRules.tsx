/**
 * FLOWTYM Revenue — Pricing Rules
 *
 * Règles tarifaires automatiques : déclencheurs (occupation, anticipation,
 * canal, jour de semaine) et actions (ajustement de prix, restriction LOS).
 *
 * Statut : fonctionnel — réutilise AutoRules existant.
 */
import React from 'react';
import { Zap } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { AutoRules } from '@/src/components/AutoRules';

export const PricingRules: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={Zap}
        title="Règles tarifaires"
        subtitle="Déclencheurs et actions d'ajustement automatique des prix et restrictions"
      />
      <AutoRules />
    </div>
  );
};
