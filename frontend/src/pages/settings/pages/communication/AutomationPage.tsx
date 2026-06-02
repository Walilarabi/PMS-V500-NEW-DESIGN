/**
 * FLOWTYM — Paramètres · Communication · Automatisation.
 *
 * Le moteur de workflows (communication_workflows / triggers / conditions /
 * actions + dispatcher cron) est planifié pour le Lot L6. Cette page présente
 * les scénarios cibles — aucune automatisation codée en dur.
 */
import React from 'react';
import { Zap } from 'lucide-react';
import { CommHeader, CommPage, ComingSoonPanel } from './shared';

const SCENARIOS = [
  'J-7 arrivée → email automatique',
  'J-2 arrivée → WhatsApp automatique',
  'Check-in → message de bienvenue',
  'Check-out → remerciement',
  'J+1 départ → demande d\'avis',
  'Anniversaire → fidélisation',
  'Client VIP → scénario spécifique',
];

export const AutomationPage: React.FC = () => (
  <CommPage>
    <CommHeader eyebrow="Communication" title="Automatisation" subtitle="Déclencheurs, conditions et actions multi-canal — entièrement paramétrables." icon={<Zap size={16} className="text-violet-600" />} />
    <ComingSoonPanel lot="Lot L6" title="Moteur de workflows de communication">
      <p>Tout sera paramétrable (aucun scénario codé en dur). Cas cibles :</p>
      <ul className="mt-3 space-y-1.5 text-left">
        {SCENARIOS.map((sc) => (
          <li key={sc} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700"><Zap size={13} className="shrink-0 text-violet-500" />{sc}</li>
        ))}
      </ul>
    </ComingSoonPanel>
  </CommPage>
);

export default AutomationPage;
