/**
 * FLOWTYM — Paramètres · Intégrations spécifiques (POS, Serrures, Bornes,
 * Paiement, Lighthouse, Expedia, Booking, Public API, Webhooks).
 *
 * Pages compactes basées sur le pattern card-toggle pour les intégrations
 * vendors où l'utilisateur peut juste activer/désactiver et renseigner
 * une clé API.
 */
import React, { useState, useEffect } from 'react';
import {
  Receipt, Lock, Plane, CreditCard, BarChart3, Globe, FileCode2, Webhook,
  CheckCircle2, AlertCircle, Save, Plug, ExternalLink, RefreshCw,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { SettingsPageHeader, SettingsMetric, SettingsToast, Phase2Notice, FormField } from './_common';
import type { LucideIcon } from 'lucide-react';

interface IntegrationConfig {
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  lastSync?: string;
  status: 'idle' | 'connected' | 'error';
  customSettings?: Record<string, string>;
}

const DEFAULT: IntegrationConfig = { enabled: false, apiKey: '', endpoint: '', status: 'idle' };

function loadConfig(key: string): IntegrationConfig {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return DEFAULT; }
}
function saveConfig(key: string, c: IntegrationConfig) { localStorage.setItem(key, JSON.stringify(c)); }

// ─── Composant générique d'intégration ───────────────────────────────────

interface IntegrationPageProps {
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
  storageKey: string;
  vendorName: string;
  vendorUrl?: string;
  endpointPlaceholder?: string;
  apiKeyLabel?: string;
  capabilities: string[];
  phase2?: string;
  module: 'pms_reservations' | 'finance_billing' | 'integrations';
  extraFields?: { key: string; label: string; placeholder?: string }[];
}

const IntegrationPage: React.FC<IntegrationPageProps> = ({
  icon: Icon, category, title, description, storageKey, vendorName, vendorUrl,
  endpointPlaceholder, apiKeyLabel = 'Clé API', capabilities, phase2, module: moduleKey, extraFields,
}) => {
  const [cfg, setCfg] = useState<IntegrationConfig>(() => loadConfig(storageKey));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { saveConfig(storageKey, cfg); }, [cfg, storageKey]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function connect() {
    if (!cfg.apiKey.trim()) {
      notify('Renseignez d\'abord la clé API');
      return;
    }
    const next: IntegrationConfig = { ...cfg, enabled: true, status: 'connected', lastSync: new Date().toISOString() };
    setCfg(next);
    logAudit({ action: 'module_inspected', module: moduleKey, detail: `Intégration ${vendorName} activée` });
    notify(`${vendorName} connecté`);
  }

  function disconnect() {
    setCfg({ ...cfg, enabled: false, status: 'idle' });
    logAudit({ action: 'module_inspected', module: moduleKey, detail: `Intégration ${vendorName} désactivée` });
    notify(`${vendorName} déconnecté`);
  }

  function testConnection() {
    setCfg({ ...cfg, status: 'connected', lastSync: new Date().toISOString() });
    notify('Test : connexion OK (mock Phase 1)');
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Icon}
          category={category}
          title={title}
          description={description}
          action={vendorUrl ? (
            <a href={vendorUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              Site officiel <ExternalLink className="w-3 h-3" />
            </a>
          ) : undefined}
        />

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <SettingsMetric label="Statut" value={cfg.status === 'connected' ? 'Connecté' : cfg.status === 'error' ? 'Erreur' : 'Désactivé'} caption={vendorName}
            tone={cfg.status === 'connected' ? 'emerald' : cfg.status === 'error' ? 'rose' : 'slate'} />
          <SettingsMetric label="Activé" value={cfg.enabled ? 'Oui' : 'Non'} caption="État courant" tone={cfg.enabled ? 'violet' : 'slate'} />
          <SettingsMetric label="Dernière sync" value={cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} caption="Heartbeat" tone="slate" />
        </div>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Capacités</div>
          <ul className="grid gap-1.5 md:grid-cols-2 text-[12.5px] text-slate-700">
            {capabilities.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
          <FormField label={apiKeyLabel}>
            <input type="password" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
              placeholder="••••••••••••••••" className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none" />
          </FormField>
          <FormField label="Endpoint / URL">
            <input type="url" value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })}
              placeholder={endpointPlaceholder ?? `https://api.${vendorName.toLowerCase().replace(/\s+/g, '')}.com`}
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none" />
          </FormField>
          {extraFields?.map((f) => (
            <FormField key={f.key} label={f.label}>
              <input type="text" value={cfg.customSettings?.[f.key] ?? ''}
                onChange={(e) => setCfg({ ...cfg, customSettings: { ...(cfg.customSettings ?? {}), [f.key]: e.target.value } })}
                placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none" />
            </FormField>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {cfg.enabled ? (
            <>
              <button onClick={testConnection} className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Tester la connexion
              </button>
              <button onClick={disconnect} className="px-3 py-2 rounded-lg ring-1 ring-rose-200 bg-white text-[13px] font-medium text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5">
                Déconnecter
              </button>
            </>
          ) : (
            <button onClick={connect}
              disabled={!cfg.apiKey.trim()}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40">
              <Plug className="w-3.5 h-3.5" /> Connecter {vendorName}
            </button>
          )}
        </div>

        {phase2 && <Phase2Notice><strong>Phase 2 :</strong> {phase2}</Phase2Notice>}
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

// ─── Pages dérivées ──────────────────────────────────────────────────────

export const PosPage: React.FC = () => (
  <IntegrationPage
    icon={Receipt} category="Intégrations" title="POS" description="Caisses enregistreuses connectées (restaurant, bar, SPA)."
    storageKey="flowtym.integ.pos" vendorName="POS"
    apiKeyLabel="Identifiant magasin" module="pms_reservations"
    capabilities={['Synchronisation des additions vers les notes clients', 'Imputation automatique par compte comptable', 'Tiroir-caisse partagé entre points de vente', 'Suivi consommation par chambre']}
    phase2="connecteurs Lightspeed / Square / Toast natifs + reconciliation automatique en fin de service."
    extraFields={[{ key: 'storeId', label: 'ID magasin', placeholder: 'STORE_42' }]}
  />
);

export const LocksPage: React.FC = () => (
  <IntegrationPage
    icon={Lock} category="Intégrations" title="Serrures connectées" description="Verrous électroniques (Salto, Assa Abloy, Onity, …)."
    storageKey="flowtym.integ.locks" vendorName="Serrures"
    module="integrations"
    capabilities={['Génération de codes / cartes à la réservation', 'Invalidation automatique au check-out', 'Audit trail des accès chambres', 'Codes invité supplémentaires temporaires']}
    phase2="intégration SDK Salto Space / KS / Assa Abloy Visionline + mobile key (passes Apple / Google)."
    extraFields={[{ key: 'vendor', label: 'Vendeur', placeholder: 'Salto / Assa Abloy / Onity' }]}
  />
);

export const KioskPage: React.FC = () => (
  <IntegrationPage
    icon={Plane} category="Intégrations" title="Bornes check-in" description="Bornes en libre-service pour check-in / check-out autonome."
    storageKey="flowtym.integ.kiosk" vendorName="Bornes"
    module="pms_reservations"
    capabilities={['Check-in / check-out 24/7 sans réception', 'Scan pièce d\'identité (lecture OCR)', 'Délivrance carte / code chambre', 'Paiement encart CB intégré']}
    phase2="connecteurs Ariane Systems / Telkonet + impression facture / reçu et signature digitale CGV."
  />
);

export const PaymentIntegPage: React.FC = () => (
  <IntegrationPage
    icon={CreditCard} category="Intégrations" title="Paiement (TPE / online)" description="Connexion TPE physiques et plateforme de paiement en ligne."
    storageKey="flowtym.integ.payment" vendorName="Paiement"
    module="finance_billing"
    capabilities={['Pré-autorisations CB à la réservation', 'Capture automatique à l\'arrivée', 'Liens de paiement (Stripe Pay by Link, Adyen)', 'Remboursements en 1 clic', '3DSecure compliant']}
    phase2="webhooks temps réel Stripe / Adyen + reconciliation automatique avec le journal de caisse."
    extraFields={[{ key: 'provider', label: 'Fournisseur', placeholder: 'Stripe / Adyen / Worldline' }]}
  />
);

export const LighthouseIntegPage: React.FC = () => (
  <IntegrationPage
    icon={BarChart3} category="Intégrations" title="Lighthouse" description="Connecteur Lighthouse (intelligence marché, compset, événements)."
    storageKey="flowtym.integ.lighthouse" vendorName="Lighthouse"
    vendorUrl="https://www.mylighthouse.com" module="integrations"
    capabilities={['Import quotidien compset prix', 'Demande marché par jour', 'Événements salons / sport / concerts', 'Influence des recommandations RMS Flowtym']}
    phase2="API Lighthouse v2 native + push automatique tarifs validés depuis Flowtym vers Lighthouse pour fermer la boucle."
  />
);

export const ExpediaIntegPage: React.FC = () => (
  <IntegrationPage
    icon={Globe} category="Intégrations" title="Expedia Group" description="Connecteur Expedia / Hotels.com / Vrbo (EQC / EPS Rapid)."
    storageKey="flowtym.integ.expedia" vendorName="Expedia"
    vendorUrl="https://www.expediapartnersolutions.com" module="integrations"
    capabilities={['Push tarifs + dispo via EQC (Expedia Quick Connect)', 'Pull réservations en temps réel', 'Gestion des restrictions (MLOS, CTA, CTD)', 'Promotions Expedia (Mobile Rate, Member, Package)']}
    phase2="certification Expedia EQC v2 (REST), webhook ARI confirmé, gestion virtual CC."
    extraFields={[{ key: 'hotelId', label: 'Expedia Hotel ID', placeholder: '123456' }]}
  />
);

export const BookingIntegPage: React.FC = () => (
  <IntegrationPage
    icon={Globe} category="Intégrations" title="Booking.com" description="Connecteur Booking.com (XML 2-way / Connectivity Partner)."
    storageKey="flowtym.integ.booking" vendorName="Booking.com"
    vendorUrl="https://connect.booking.com" module="integrations"
    capabilities={['Push tarifs + dispo OTA Provider', 'Pull réservations XML 2-way', 'Gestion des restrictions et promotions', 'Genius rates + Mobile rate']}
    phase2="certification Booking Premier Partner — webhook réservations confirmé sous 30s."
    extraFields={[{ key: 'hotelId', label: 'Booking Hotel ID', placeholder: '1234567' }]}
  />
);

export const PublicApiPage: React.FC = () => (
  <IntegrationPage
    icon={FileCode2} category="Intégrations" title="API publique Flowtym" description="Activation de l'API publique pour intégrer des outils tiers à votre PMS."
    storageKey="flowtym.integ.public_api" vendorName="API publique"
    apiKeyLabel="Master key" module="integrations"
    capabilities={['Endpoints REST documentés (OpenAPI 3.1)', 'Rate limiting par clé', 'OAuth 2.0 + Bearer token', 'Logs détaillés de chaque appel', 'Webhooks sortants configurables']}
    phase2="documentation interactive (Swagger UI) + sandbox + SDK officiels Node.js / Python / PHP."
  />
);

export const WebhooksPage: React.FC = () => (
  <IntegrationPage
    icon={Webhook} category="Intégrations" title="Webhooks" description="Notifications sortantes vers vos outils externes lors d'événements Flowtym."
    storageKey="flowtym.integ.webhooks_master" vendorName="Webhooks"
    apiKeyLabel="Secret de signature partagé" module="integrations"
    capabilities={['Signature HMAC SHA-256 de chaque payload', 'Retry exponentiel automatique (3 tentatives)', 'Dead letter queue accessible 7 jours', 'Filtres par événement et par module']}
    phase2="éditeur de transformations payload (jq) + replay manuel d'un webhook donné."
  />
);
