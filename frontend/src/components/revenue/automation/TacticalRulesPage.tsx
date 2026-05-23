/**
 * FLOWTYM — Page « Règles tactiques » — Layout Enterprise
 *
 * Plein écran avec :
 *   - Header riche : 5 KPIs (règles actives, conflits, top règle,
 *     overrides, moteur on/off) + tabs pills inline + actions
 *   - Sidebar gauche : catégories, statut, tags, templates, recherche
 *   - Zone centrale : contenu de l'onglet actif (Règles / Garde-fous /
 *     Priorités & Conflits) — hauteur stable
 *   - Panneau droit : détail d'une règle sélectionnée (score risque,
 *     IA, impact prévisionnel, conflits, historique)
 */
import React, { useEffect, useState } from 'react';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { rmsAuditLogger } from '@/src/services/revenue/rmsAuditLogger';
import { TacticalRulesEnterpriseLayout } from './TacticalRulesEnterpriseLayout';
import type { TacticalTab } from './TacticalRulesTabs';

// Hydratation depuis Supabase une seule fois par session (non bloquante)
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
  const [tab, setTab] = useState<TacticalTab>('rules');
  useEffect(() => { hydrateOnce(); }, []);
  return <TacticalRulesEnterpriseLayout tab={tab} setTab={setTab} />;
};
