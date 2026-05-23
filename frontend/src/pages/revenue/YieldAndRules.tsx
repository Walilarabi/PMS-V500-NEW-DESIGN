/**
 * FLOWTYM — REVENUE › AUTOMATISATION › Règles tactiques
 *
 * Cette page remplace l'ancien écran « Yield & Règles auto ». Elle expose
 * désormais le moteur RMS Enterprise avec ses 3 onglets :
 *   - Règles Automatiques
 *   - Garde-fous RMS
 *   - Priorités & Conflits
 */

import React from 'react';
import { TacticalRulesPage } from '@/src/components/revenue/automation/TacticalRulesPage';

export function YieldAndRules() {
  return <TacticalRulesPage />;
}

export default YieldAndRules;
