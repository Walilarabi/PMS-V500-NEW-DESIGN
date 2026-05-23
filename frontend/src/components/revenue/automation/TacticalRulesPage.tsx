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
import React, { useEffect, useState } from 'react';
import { Cpu, Shield, Plus, Settings2 } from 'lucide-react';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';
import { TacticalRulesTabs, type TacticalTab } from './TacticalRulesTabs';
import { AutomaticRulesTab } from './AutomaticRulesTab';
import { GuardrailsTab } from './GuardrailsTab';
import { PrioritiesConflictsTab } from './PrioritiesConflictsTab';
import { GuardrailModal } from './GuardrailModal';
import { NewRuleModal } from './NewRuleModal';
import { ConfigurePrioritiesModal } from './ConfigurePrioritiesModal';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { rmsAuditLogger } from '@/src/services/revenue/rmsAuditLogger';
import { useT } from '@/src/i18n';
import { LocaleSwitcher } from '@/src/i18n/LocaleSwitcher';

// Hydratation depuis Supabase une seule fois par session (non bloquant)
let hydrated = false;
function hydrateOnce() {
  if (hydrated) return;
  hydrated = true;
  Promise.allSettled([
    tacticalRulesEngine.hydrate(),
    guardrailsEngine.hydrate(),
    priorityConflictEngine.hydrate(),
    rmsAuditLogger.hydrate(50),
  ]);
}

export const TacticalRulesPage: React.FC = () => {
  const t = useT();
  const [tab, setTab] = useState<TacticalTab>('rules');
  const [newGuardrailOpen, setNewGuardrailOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [configurePrioritiesOpen, setConfigurePrioritiesOpen] = useState(false);

  useEffect(() => { hydrateOnce(); }, []);

  const headerByTab = {
    rules: {
      icon: Cpu,
      title: t('rules.title'),
      subtitle: t('rules.subtitleAutomatic'),
      action: (
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            onClick={() => setNewRuleOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20"
          >
            <Plus size={16} />
            {t('rules.newRule')}
          </button>
        </div>
      ),
    },
    guardrails: {
      icon: Shield,
      title: t('rules.title'),
      subtitle: t('rules.subtitleGuardrails'),
      action: (
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            onClick={() => setNewGuardrailOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20"
          >
            <Plus size={16} />
            {t('rules.newGuardrail')}
          </button>
        </div>
      ),
    },
    priorities: {
      icon: Settings2,
      title: t('rules.title'),
      subtitle: t('rules.subtitlePriorities'),
      action: (
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            onClick={() => setConfigurePrioritiesOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-gray-700 text-[13px] font-semibold hover:bg-gray-50 shadow-sm"
          >
            <Settings2 size={16} />
            {t('rules.configurePriorities')}
          </button>
        </div>
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
      <NewRuleModal
        open={newRuleOpen}
        onClose={() => setNewRuleOpen(false)}
      />
      <ConfigurePrioritiesModal
        open={configurePrioritiesOpen}
        onClose={() => setConfigurePrioritiesOpen(false)}
      />
    </div>
  );
};
