/**
 * FLOWTYM — Tiers / Prescripteurs View (Wave C3)
 *
 * Vue prescripteurs : agences et tour-opérateurs partenaires.
 * Cards compactes + modal d'édition. Réutilise CompanyFormModal.
 */

import React, { useState } from 'react';
import {
  Handshake, Search, Plus, Pencil,
  Globe, Plane, TrendingUp, Building,
  Star,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { useCompanies } from '@/src/services/crm/hooks';
import { CompanyFormModal } from './CompanyFormModal';
import type { Company } from '@/src/services/crm/crm.service';

const TIER_TYPES: Company['type'][] = ['agency', 'tour_operator'];

// ─── Component ───────────────────────────────────────────────────────────────

export const TiersView = () => {
  const { data: allCompanies = [], isLoading } = useCompanies();
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState<Company | null | 'new'>(null);

  const tiers = allCompanies.filter((c) => TIER_TYPES.includes(c.type));
  const filtered = tiers.filter((c) =>
    !search ||
    [c.name, c.email, c.city, c.country]
      .some((v) => v?.toLowerCase().includes(search.toLowerCase())),
  );

  const agencyCount = tiers.filter((c) => c.type === 'agency').length;
  const tourOpCount = tiers.filter((c) => c.type === 'tour_operator').length;
  const avgRate     = tiers.length
    ? Math.round(tiers.reduce((s, c) => s + c.negotiated_rate, 0) / tiers.length)
    : 0;

  const kpis = [
    { label: 'Agences partenaires', value: agencyCount, icon: Globe,     color: '#3B82F6' },
    { label: 'Tour-opérateurs',     value: tourOpCount, icon: Plane,     color: '#F59E0B' },
    { label: 'Total prescripteurs', value: tiers.length, icon: Handshake, color: '#8B5CF6' },
    { label: 'Taux moyen',          value: `${avgRate}%`, icon: TrendingUp, color: '#10B981' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${k.color}18` }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{k.value}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                  {k.label}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Info banner */}
        <Card className="p-4 border-l-4 border-l-[#8B5CF6]">
          <div className="flex items-start gap-3">
            <Handshake size={15} className="text-[#8B5CF6] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-gray-800">Tiers & Prescripteurs</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Agences de voyage et tour-opérateurs partenaires qui prescrivent l'hôtel à leurs
                clients. Gérez ici les taux négociés, plafonds de crédit et contacts commerciaux.
              </p>
            </div>
          </div>
        </Card>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un prescripteur…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]"
            />
          </div>
          <Button size="sm" onClick={() => setModal('new')} className="shrink-0">
            <Plus size={13} /> Nouveau tiers
          </Button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="text-center text-sm text-gray-400 py-10">Chargement…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Handshake size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">
              {tiers.length === 0
                ? 'Aucun prescripteur enregistré.'
                : 'Aucun résultat.'}
            </p>
            {tiers.length === 0 && (
              <Button size="sm" className="mt-4" onClick={() => setModal('new')}>
                <Plus size={13} /> Ajouter un prescripteur
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <TierCard key={c.id} company={c} onEdit={() => setModal(c)} />
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <CompanyFormModal
          company={modal === 'new' ? null : modal}
          defaultType="agency"
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

// ─── TierCard sub-component ───────────────────────────────────────────────────

const TierCard: React.FC<{ company: Company; onEdit: () => void }> = ({ company: c, onEdit }) => {
  const isAgency = c.type === 'agency';
  const color    = isAgency ? '#3B82F6' : '#F59E0B';
  const Icon     = isAgency ? Globe : Plane;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}18` }}
          >
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-gray-900 leading-tight">{c.name}</div>
            <div className="mt-0.5">
              <Badge variant={isAgency ? 'info' : 'warning'}>
                {isAgency ? 'Agence' : 'Tour-opérateur'}
              </Badge>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#8B5CF6] transition-colors shrink-0"
          title="Modifier"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Details */}
      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        {c.email && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Building size={10} className="shrink-0 text-gray-400" />
            <span className="truncate">{c.email}</span>
          </div>
        )}
        {(c.city || c.country) && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Globe size={10} className="shrink-0 text-gray-400" />
            {[c.city, c.country].filter(Boolean).join(', ')}
          </div>
        )}
        {c.contract_type && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Star size={10} className="shrink-0 text-gray-400" />
            Contrat : {c.contract_type}
          </div>
        )}
        {c.phone && (
          <div className="text-[11px] text-gray-400 pl-4">{c.phone}</div>
        )}
      </div>

      {/* Financial chips */}
      {(c.negotiated_rate > 0 || c.credit_limit > 0) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          {c.negotiated_rate > 0 && (
            <div>
              <div className="text-[15px] font-bold text-[#8B5CF6]">{c.negotiated_rate}%</div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Taux</div>
            </div>
          )}
          {c.credit_limit > 0 && (
            <div>
              <div className="text-[15px] font-bold text-gray-900">
                {c.credit_limit.toLocaleString('fr-FR')} €
              </div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Crédit</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default TiersView;
