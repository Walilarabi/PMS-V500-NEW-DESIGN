/**
 * FLOWTYM — Page « Règles tactiques »
 *
 * 3 onglets :
 *   1. Règles Automatiques
 *   2. Garde-fous RMS
 *   3. Priorités & Conflits
 *
 * Le header (titre, sous-titre, action principale) change selon l'onglet,
 * mais la structure visuelle reste identique (style Flowtym clair, accent
 * violet, cartes premium).
 */
import React, { useState } from 'react';
import { Cpu, Shield, Plus, Settings2 } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { TacticalRulesTabs, type TacticalTab } from './TacticalRulesTabs';
import { AutomaticRulesTab } from './AutomaticRulesTab';
import { GuardrailsTab } from './GuardrailsTab';
import { PrioritiesConflictsTab } from './PrioritiesConflictsTab';
import { GuardrailModal } from './GuardrailModal';

export const TacticalRulesPage: React.FC = () => {
  const [tab, setTab] = useState<TacticalTab>('rules');
  const [newGuardrailOpen, setNewGuardrailOpen] = useState(false);

  const headerByTab = {
    rules: {
      icon: Cpu,
      title: 'Règles tactiques',
      subtitle: 'Règles automatiques complémentaires à la stratégie pour optimiser votre RevPAR',
      action: (
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20">
          <Plus size={16} />
          Nouvelle règle
        </button>
      ),
    },
    guardrails: {
      icon: Shield,
      title: 'Règles tactiques',
      subtitle: 'Définissez les garde-fous qui protègent votre stratégie et sécurisent vos revenus',
      action: (
        <button
          onClick={() => setNewGuardrailOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20"
        >
          <Plus size={16} />
          Nouveau garde-fou
        </button>
      ),
    },
    priorities: {
      icon: Settings2,
      title: 'Règles tactiques',
      subtitle: 'Gestion de la hiérarchie des priorités et résolution des conflits entre règles',
      action: (
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-gray-700 text-[13px] font-semibold hover:bg-gray-50 shadow-sm">
          <Settings2 size={16} />
          Configurer les priorités
        </button>
      ),
    },
  } as const;

  const current = headerByTab[tab];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 max-w-[1600px] mx-auto">
        <RevenueHeader
          icon={current.icon}
          title={current.title}
          subtitle={current.subtitle}
          actions={current.action}
        />

        <TacticalRulesTabs active={tab} onChange={setTab} />

        {tab === 'rules' && <AutomaticRulesTab />}
        {tab === 'guardrails' && <GuardrailsTab />}
        {tab === 'priorities' && <PrioritiesConflictsTab />}
      </div>

      <GuardrailModal
        guardrail={null}
        open={newGuardrailOpen}
        onClose={() => setNewGuardrailOpen(false)}
      />
    </div>
  );
};
