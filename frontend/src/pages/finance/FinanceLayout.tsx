/**
 * FLOWTYM — Finance Layout (Vague F1)
 *
 * Shell unifié remplaçant les 8 placeholders (Facturation, Proforma, Caisse,
 * Impayés, Clôture, TVA, Paiements sécurisés, Comptabilité, Cash Management).
 *
 * Sidebar passe l'activePage, le layout route vers la bonne sous-vue.
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, CreditCard, AlertTriangle, FileText, Percent,
  Loader2, Lock,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { FacturationView } from './FacturationView';
import { ReconciliationView } from './ReconciliationView';
import { AuditLogView } from './AuditLogView';
import { TvaDeclarationView } from './TvaDeclarationView';
import { DebtorsView } from './DebtorsView';
import { ClosureWorkflowView } from './ClosureWorkflowView';
import { ProformaView } from './ProformaView';
import { CashRegisterView } from './CashRegisterView';
import { fetchFinanceKpis, type FinanceDashboardKpis } from '../../services/finance/finance.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

export type FinancePage =
  | 'finance'
  | 'facturation'
  | 'proforma'
  | 'caisse'
  | 'impayes'
  | 'cloture'
  | 'fin_reconciliation'
  | 'tva2026'
  | 'paiements_securises'
  | 'comptabilite'
  | 'cash_management';

const PAGE_TITLES: Record<FinancePage, { title: string; subtitle: string }> = {
  finance:             { title: 'Finance — Vue d\'ensemble',  subtitle: 'Dashboard financier et KPIs clés' },
  facturation:         { title: 'Facturation',                subtitle: 'Émission, suivi et statut des factures' },
  proforma:            { title: 'Proforma / Devis',           subtitle: 'Devis et propositions commerciales' },
  caisse:              { title: 'Caisse / Petite caisse',     subtitle: 'Comptage, mouvements espèces' },
  impayes:             { title: 'Impayés & Débiteurs',        subtitle: 'Balance âgée et workflow de relances' },
  cloture:             { title: 'Clôture journalière',        subtitle: 'Workflow midi/midi en 8 étapes' },
  fin_reconciliation:  { title: 'Rapprochement bancaire',     subtitle: 'Matching paiements OTA & banque' },
  tva2026:             { title: 'TVA 2026 & e-facture',       subtitle: 'Régime encaissements + PPF' },
  paiements_securises: { title: 'Paiements sécurisés',        subtitle: 'Pré-autorisations & 3DS' },
  comptabilite:        { title: 'Comptabilité',               subtitle: 'Journal des écritures et export FEC' },
  cash_management:     { title: 'Cash Management',            subtitle: 'Trésorerie et flux financiers' },
};

export interface FinanceLayoutProps {
  activePage: FinancePage;
}

export const FinanceLayout: React.FC<FinanceLayoutProps> = ({ activePage }) => {
  const [kpis, setKpis] = useState<FinanceDashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const cfg = PAGE_TITLES[activePage];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFinanceKpis().then(d => { if (!cancelled) { setKpis(d); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={Wallet}
          title={cfg.title}
          subtitle={cfg.subtitle}
        />
      </div>

      {/* KPI strip premium — visible sur toutes les pages Finance */}
      {activePage !== 'finance' && (
        <div className="px-6 pb-3">
          <KpiStrip kpis={kpis} loading={loading} />
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 pb-6">
        {activePage === 'finance' && <FinanceDashboard kpis={kpis} loading={loading} />}
        {activePage === 'facturation' && <FacturationView />}
        {activePage === 'proforma' && <ProformaView />}
        {activePage === 'caisse' && <CashRegisterView />}
        {activePage === 'impayes' && <DebtorsView />}
        {activePage === 'cloture' && <ClosureWorkflowView />}
        {activePage === 'fin_reconciliation' && <ReconciliationView />}
        {activePage === 'tva2026' && <TvaDeclarationView />}
        {activePage === 'paiements_securises' && (
          <PlaceholderModule
            icon={CreditCard}
            title="Paiements sécurisés"
            description="Pré-autorisations, captures différées, 3D-Secure, gestion des tokens carte"
            comingSoon={['Pré-autorisation 7j', 'Capture partielle/totale', 'Réconciliation Stripe/Adyen', 'Tokenisation PCI-DSS']}
          />
        )}
        {activePage === 'comptabilite' && <AuditLogView />}
        {activePage === 'cash_management' && (
          <PlaceholderModule
            icon={TrendingUp}
            title="Cash Management"
            description="Trésorerie temps réel et prévisionnel de cash-flow"
            comingSoon={['Forecast 90 jours', 'Multi-comptes bancaires', 'Alerte solde bas', 'Optimisation rotation cash']}
          />
        )}
      </div>
    </div>
  );
};

// ─── KPI Strip ───────────────────────────────────────────────────────────

function KpiStrip({ kpis, loading }: { kpis: FinanceDashboardKpis | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <KpiSmall icon="💶" label="CA du mois" value={loading ? '…' : `${Math.round((kpis?.ca_month ?? 0) / 1000)}K€`} tone="emerald" loading={loading} />
      <KpiSmall icon="📈" label="RevPAR mois" value={loading ? '…' : `${Math.round(kpis?.revpar ?? 0)}€`} tone="violet" loading={loading} />
      <KpiSmall icon="💳" label="Encaissements 30j" value={loading ? '…' : `${Math.round((kpis?.encaissements_30d ?? 0) / 1000)}K€`} tone="blue" loading={loading} />
      <KpiSmall icon="⏳" label="Débiteurs" value={loading ? '…' : `${Math.round((kpis?.debiteurs_total ?? 0) / 1000)}K€`} tone={kpis && kpis.debiteurs_total > 5000 ? 'red' : 'amber'} loading={loading} />
      <KpiSmall icon="🧾" label="TVA à payer" value={loading ? '…' : `${Math.round((kpis?.tva_due ?? 0)).toLocaleString('fr-FR')}€`} tone="orange" loading={loading} />
      <KpiSmall icon="🔒" label="Dern. clôture" value={loading ? '…' : (kpis?.last_closure ? new Date(kpis.last_closure).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—')} tone="gray" loading={loading} />
    </div>
  );
}

function KpiSmall({ icon, label, value, tone, loading }: { icon: string; label: string; value: string; tone: 'emerald' | 'violet' | 'blue' | 'amber' | 'orange' | 'red' | 'gray'; loading?: boolean }) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50/40',
    violet:  'border-violet-200 bg-violet-50/40',
    blue:    'border-blue-200 bg-blue-50/40',
    amber:   'border-amber-200 bg-amber-50/40',
    orange:  'border-orange-200 bg-orange-50/40',
    red:     'border-red-200 bg-red-50/40',
    gray:    'border-gray-200 bg-white',
  };
  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-3', colorMap[tone])}>
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
        <div className={cn('text-lg font-extrabold tabular-nums text-gray-900', loading && 'animate-pulse text-gray-300')}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Finance (page d'accueil) ──────────────────────────────────

function FinanceDashboard({ kpis, loading }: { kpis: FinanceDashboardKpis | null; loading: boolean }) {
  return (
    <div className="space-y-5">
      <KpiStrip kpis={kpis} loading={loading} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ModuleCard
          icon={FileText}
          title="Facturation"
          description="Émettre, suivre, encaisser, annuler les factures"
          stats={kpis ? `${Math.round(kpis.ca_month).toLocaleString('fr-FR')}€ ce mois` : 'Chargement…'}
          tone="violet"
          page="facturation"
        />
        <ModuleCard
          icon={Percent}
          title="TVA 2026"
          description="Régime encaissements + snapshots verrouillés"
          stats={kpis?.tva_due ? `${Math.round(kpis.tva_due).toLocaleString('fr-FR')}€ TVA due` : 'Aucun snapshot'}
          tone="orange"
          page="tva2026"
        />
        <ModuleCard
          icon={AlertTriangle}
          title="Débiteurs & Impayés"
          description="Balance âgée + relances automatiques"
          stats={kpis ? `${Math.round(kpis.debiteurs_total).toLocaleString('fr-FR')}€ en attente` : '—'}
          tone={kpis && kpis.debiteurs_total > 0 ? 'red' : 'gray'}
          page="impayes"
        />
        <ModuleCard
          icon={Lock}
          title="Clôture journalière"
          description="Workflow midi/midi en 8 étapes verrouillé"
          stats={kpis?.last_closure ? `Dernière : ${new Date(kpis.last_closure).toLocaleDateString('fr-FR')}` : 'Aucune clôture'}
          tone="blue"
          page="cloture"
        />
        <ModuleCard
          icon={CreditCard}
          title="Rapprochement"
          description="Matching paiements OTA & relevés bancaires"
          stats="Imports CSV / CAMT.053"
          tone="emerald"
          page="fin_reconciliation"
        />
        <ModuleCard
          icon={FileText}
          title="Proforma / Devis"
          description="Devis numérotés, conversion en facture"
          stats="Workflow conversion"
          tone="amber"
          page="proforma"
        />
      </div>
    </div>
  );
}

function ModuleCard({
  icon: Icon, title, description, stats, tone, page,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; stats: string;
  tone: 'violet' | 'orange' | 'red' | 'blue' | 'emerald' | 'amber' | 'gray';
  page: string;
}) {
  const colors = {
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  iconBg: 'bg-violet-100' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  iconBg: 'bg-orange-100' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     iconBg: 'bg-red-100' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    iconBg: 'bg-blue-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   iconBg: 'bg-amber-100' },
    gray:    { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',    iconBg: 'bg-gray-200' },
  }[tone];

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }))}
      className={cn(
        'group text-left bg-white rounded-lg border-2 p-5 transition-all hover:shadow-md',
        colors.border
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0', colors.iconBg)}>
          <Icon className={cn('w-5 h-5', colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-base font-bold', colors.text)}>{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        </div>
      </div>
      <div className={cn('text-sm font-bold', colors.text)}>{stats}</div>
    </button>
  );
}

function PlaceholderModule({
  icon: Icon, title, description, comingSoon,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; comingSoon: string[];
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 mx-auto rounded-full bg-violet-50 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-left max-w-md mx-auto">
        <div className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Roadmap fonctionnalités</div>
        <ul className="space-y-1">
          {comingSoon.map((item, i) => (
            <li key={i} className="text-sm text-violet-800 flex items-center gap-2">
              <span className="text-violet-400">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
