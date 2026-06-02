/**
 * FLOWTYM — Paramètres · Communication · SMS.
 *
 * L'architecture SMS (table hotel_sms_settings, providers Twilio / OVH /
 * SMSFactor / custom, edge function send-sms, logs, templates) est planifiée
 * pour le Lot L4. Cette page expose la feuille de route — aucun bouton mort.
 */
import React from 'react';
import { Smartphone } from 'lucide-react';
import { CommHeader, CommPage, ComingSoonPanel } from './shared';

export const SmsSettingsPage: React.FC = () => (
  <CommPage>
    <CommHeader eyebrow="Communication" title="SMS" subtitle="Canal SMS multi-provider pour notifications et rappels." icon={<Smartphone size={16} className="text-violet-600" />} />
    <ComingSoonPanel lot="Lot L4" title="Canal SMS — architecture prête, activation à venir">
      <p>Compatibilité prévue : <strong>Twilio</strong>, <strong>OVH SMS</strong>, <strong>SMSFactor</strong> et provider personnalisé.</p>
      <p className="mt-2">Inclura : connexion par hôtel (<code>hotel_sms_settings</code>), statut, test d'envoi, journal et templates SMS — sur le même socle sécurisé que l'email et WhatsApp (secrets serveur-only).</p>
    </ComingSoonPanel>
  </CommPage>
);

export default SmsSettingsPage;
