import React, { useState } from 'react';
import { ShieldCheck, ChevronRight, AlertCircle, Wifi, Monitor, Globe, Server, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ExternalFactor {
  id: string;
  label: string;
  guide: string;
}

interface FactorGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  factors: ExternalFactor[];
}

const FACTOR_GROUPS: FactorGroup[] = [
  {
    id: 'browser',
    title: 'Navigateur',
    icon: Monitor,
    factors: [
      { id: 'browser_outdated',   label: 'Navigateur obsolète ou non supporté',           guide: 'Mettez à jour votre navigateur vers la dernière version (Chrome 120+, Firefox 121+, Edge 120+). Réessayez après la mise à jour.' },
      { id: 'browser_extension',  label: 'Extension navigateur active (bloqueur, VPN…)',  guide: 'Désactivez toutes les extensions (mode navigation privée ou profil vierge). Si le problème disparaît, réactivez-les une par une pour identifier le coupable.' },
      { id: 'ad_blocker',         label: 'Bloqueur de publicités ou de scripts',          guide: 'Désactivez uBlock, AdBlock ou Brave Shields sur ce domaine. Le PMS utilise des scripts nécessaires au bon fonctionnement.' },
      { id: 'browser_cache',      label: 'Cache ou cookies navigateur corrompus',         guide: 'Videz le cache : Ctrl+Shift+Del → cochez "Cache" et "Cookies" → Effacer. Rechargez la page avec Ctrl+F5.' },
      { id: 'browser_perms',      label: 'Permissions navigateur refusées (caméra, pop-up…)', guide: 'Vérifiez les permissions : cliquez sur le cadenas dans la barre d\'adresse → Autorisations → assurez-vous que rien n\'est bloqué.' },
    ],
  },
  {
    id: 'network',
    title: 'Réseau & session',
    icon: Wifi,
    factors: [
      { id: 'vpn',                label: 'VPN actif pouvant filtrer les requêtes',        guide: 'Désactivez le VPN temporairement et testez à nouveau. Certains VPN bloquent les connexions WebSocket nécessaires au temps réel.' },
      { id: 'antivirus',          label: 'Antivirus ou firewall bloquant des requêtes',   guide: 'Vérifiez les règles de votre antivirus ou pare-feu. Ajoutez une exception pour le domaine du PMS. Testez en mode sans échec réseau.' },
      { id: 'session_expired',    label: 'Session expirée ou token invalide',             guide: 'Déconnectez-vous puis reconnectez-vous. Si la session persiste, videz les cookies et reconnectez-vous.' },
      { id: 'network_unstable',   label: 'Connexion réseau instable ou lente',            guide: 'Testez votre connexion sur speedtest.net. Si la connexion est instable, passez en filaire ou changez de réseau Wi-Fi.' },
      { id: 'dns',                label: 'Problème DNS (résolution de nom impossible)',    guide: 'Essayez de changer vos DNS : utilisez 1.1.1.1 (Cloudflare) ou 8.8.8.8 (Google). Ou testez depuis un autre réseau (4G).' },
    ],
  },
  {
    id: 'device',
    title: 'Poste & affichage',
    icon: Globe,
    factors: [
      { id: 'screen_resolution',  label: 'Résolution ou zoom navigateur inadapté',        guide: 'Vérifiez que le zoom navigateur est à 100% (Ctrl+0). La résolution minimale recommandée est 1280×768.' },
      { id: 'device_memory',      label: 'Mémoire insuffisante sur l\'appareil',           guide: 'Fermez les onglets et applications inutiles. Redémarrez le navigateur. En cas de problème persistant, redémarrez le poste.' },
    ],
  },
  {
    id: 'external',
    title: 'Fournisseurs externes',
    icon: Server,
    factors: [
      { id: 'supabase_down',      label: 'Base de données Supabase en incident',          guide: 'Vérifiez le statut sur status.supabase.com. Si un incident est signalé, attendez la résolution avant de créer un ticket.' },
      { id: 'ota_down',           label: 'OTA (Booking, Expedia…) ou D-EDGE en panne',   guide: 'Vérifiez les statuts sur les pages dédiées des fournisseurs. Documentez l\'incident et attendez la résolution externe.' },
      { id: 'stripe_down',        label: 'Stripe ou passerelle de paiement en incident',  guide: 'Vérifiez status.stripe.com. Si Stripe est en incident, les paiements échoueront côté client sans que le PMS soit en cause.' },
      { id: 'smtp_down',          label: 'Serveur SMTP / emails non délivrés',            guide: 'Vérifiez les logs SMTP de votre fournisseur (SendGrid, Mailgun…). Testez l\'envoi d\'un email de test depuis la configuration.' },
    ],
  },
];

interface Props {
  onProceed: (result: { externalFactorsChecked: string[]; externalCheckResult?: string }) => void;
}

export const ExternalCheckWizard: React.FC<Props> = ({ onProceed }) => {
  const [checked, setChecked]         = useState<Record<string, boolean>>({});
  const [foundFactor, setFoundFactor] = useState<ExternalFactor | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
    if (foundFactor?.id === id) setFoundFactor(null);
  };

  const selectFactor = (factor: ExternalFactor) => {
    setFoundFactor(f => f?.id === factor.id ? null : factor);
  };

  const checkedIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldCheck size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">Vérification externe obligatoire</p>
          <p className="text-[12px] text-amber-700 mt-0.5 leading-relaxed">
            Avant de créer un ticket, vérifiez que le problème ne vient pas d'un facteur externe au PMS.
            Cochez chaque élément que vous avez vérifié. Cela accélère le diagnostic et évite les interventions inutiles.
          </p>
        </div>
      </div>

      {/* Factor groups */}
      {FACTOR_GROUPS.map(group => (
        <div key={group.id} className="border border-gray-100 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(e => e === group.id ? null : group.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <group.icon size={15} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">{group.title}</span>
              <span className="text-[11px] text-gray-400">
                {group.factors.filter(f => checked[f.id]).length}/{group.factors.length} vérifiés
              </span>
            </div>
            <ChevronRight
              size={15}
              className={cn('text-gray-400 transition-transform', expanded === group.id && 'rotate-90')}
            />
          </button>

          {expanded === group.id && (
            <div className="divide-y divide-gray-50">
              {group.factors.map(factor => (
                <div key={factor.id} className="bg-white">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      id={factor.id}
                      checked={!!checked[factor.id]}
                      onChange={() => toggle(factor.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8B5CF6] accent-[#8B5CF6] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={factor.id} className="text-[13px] text-gray-700 cursor-pointer select-none">
                        {factor.label}
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectFactor(factor)}
                      className={cn(
                        'text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0',
                        foundFactor?.id === factor.id
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200',
                      )}
                    >
                      C'est ça
                    </button>
                  </div>

                  {foundFactor?.id === factor.id && (
                    <div className="mx-4 mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={13} className="text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-bold text-orange-800 mb-1">Guide de résolution</p>
                          <p className="text-[12px] text-orange-700 leading-relaxed">{factor.guide}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFoundFactor(null)}
                        className="mt-2 text-[11px] text-orange-600 underline underline-offset-2"
                      >
                        Le problème persiste → ce n'était pas ça
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[12px] text-gray-400">
          {checkedIds.length > 0
            ? `${checkedIds.length} facteur${checkedIds.length > 1 ? 's' : ''} vérifié${checkedIds.length > 1 ? 's' : ''}`
            : 'Cochez les facteurs que vous avez vérifiés'}
        </p>
        <div className="flex items-center gap-2">
          {foundFactor && (
            <span className="text-[12px] text-orange-600 font-bold">
              Cause externe identifiée — appliquez le guide ci-dessus
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              onProceed({
                externalFactorsChecked: checkedIds,
                externalCheckResult: foundFactor ? `Cause externe: ${foundFactor.label}` : undefined,
              })
            }
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-colors',
              checkedIds.length > 0
                ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
            disabled={checkedIds.length === 0}
          >
            <RefreshCw size={13} />
            {foundFactor ? 'Problème persiste → créer un ticket' : 'Problème interne → créer un ticket'}
          </button>
        </div>
      </div>
    </div>
  );
};
