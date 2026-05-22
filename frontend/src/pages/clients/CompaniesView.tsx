/**
 * FLOWTYM — Companies View (Wave C3)
 *
 * Liste complète des sociétés / agences / tour-opérateurs avec CRUD.
 * Filtres par type, recherche texte, KPI strip.
 */

import React, { useState } from 'react';
import {
  Building2, Search, Plus, Pencil, Trash2,
  Briefcase, Plane, Globe, CreditCard, PackageOpen,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { useCompanies, useDeleteCompany } from '@/src/services/crm/hooks';
import { CompanyFormModal } from './CompanyFormModal';
import type { Company } from '@/src/services/crm/crm.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Type metadata ────────────────────────────────────────────────────────────

type TypeMeta = {
  label: string;
  icon: React.ElementType;
  badgeVariant: 'info' | 'warning' | 'neutral';
};

const TYPE_META: Record<Company['type'], TypeMeta> = {
  corporate:     { label: 'Corporate',      icon: Briefcase,    badgeVariant: 'info' },
  agency:        { label: 'Agence',         icon: Globe,        badgeVariant: 'neutral' },
  tour_operator: { label: 'Tour-opérateur', icon: Plane,        badgeVariant: 'warning' },
  other:         { label: 'Autre',          icon: PackageOpen,  badgeVariant: 'neutral' },
};

const TYPE_FILTERS = [
  { key: 'ALL',          label: 'Tous' },
  { key: 'corporate',    label: 'Corporates' },
  { key: 'agency',       label: 'Agences' },
  { key: 'tour_operator',label: 'Tour-ops' },
  { key: 'other',        label: 'Autres' },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export const CompaniesView = () => {
  const { data: companies = [], isLoading } = useCompanies();
  const delMutation = useDeleteCompany();

  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter]  = useState<string>('ALL');
  const [modal, setModal]            = useState<Company | null | 'new'>(null);

  const filtered = companies.filter((c) => {
    if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [c.name, c.email, c.city, c.country]
        .some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const totalCredit   = companies.reduce((s, c) => s + c.credit_limit, 0);
  const agencyCount   = companies.filter((c) => c.type === 'agency' || c.type === 'tour_operator').length;
  const corpCount     = companies.filter((c) => c.type === 'corporate').length;

  const kpis = [
    { label: 'Total sociétés',  value: companies.length,                              icon: Building2,  color: '#8B5CF6' },
    { label: 'Agences & T.Op.', value: agencyCount,                                   icon: Plane,      color: '#3B82F6' },
    { label: 'Corporates',      value: corpCount,                                      icon: Briefcase,  color: '#F59E0B' },
    { label: 'Plafond crédit',  value: `${totalCredit.toLocaleString('fr-FR')} €`,   icon: CreditCard, color: '#10B981' },
  ];

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer "${name}" ? Cette action est irréversible.`)) return;
    await delMutation.mutateAsync(id);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4 flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{ background: `${k.color}18` }}
              >
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

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une société…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap',
                  typeFilter === f.key
                    ? 'bg-white text-[#8B5CF6] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={() => setModal('new')} className="shrink-0">
            <Plus size={13} /> Nouvelle société
          </Button>
        </div>

        {/* List */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-gray-400">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400 font-medium">
                {companies.length === 0
                  ? 'Aucune société enregistrée.'
                  : 'Aucun résultat pour ces filtres.'}
              </p>
              {companies.length === 0 && (
                <Button size="sm" className="mt-4" onClick={() => setModal('new')}>
                  <Plus size={13} /> Créer la première société
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Société', 'Type', 'Contact', 'Localisation', 'Taux négocié', 'Crédit', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => {
                    const meta = TYPE_META[c.type];
                    return (
                      <CompanyRow
                        key={c.id}
                        company={c}
                        meta={meta}
                        onEdit={() => setModal(c)}
                        onDelete={() => handleDelete(c.id, c.name)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-[11px] text-gray-300 font-medium text-center">
          {filtered.length} société{filtered.length !== 1 ? 's' : ''}{' '}
          affichée{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {modal !== null && (
        <CompanyFormModal
          company={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

// ─── Sub-component ────────────────────────────────────────────────────────────

const CompanyRow: React.FC<{
  company: Company;
  meta: TypeMeta;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ company: c, meta, onEdit, onDelete }) => (
  <tr className="hover:bg-gray-50/60 transition-colors group">
    <td className="px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
          <meta.icon size={14} className="text-[#8B5CF6]" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-gray-900">{c.name}</div>
          {c.website && (
            <div className="text-[10px] text-gray-400 truncate max-w-[140px]">
              {c.website.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>
    </td>

    <td className="px-4 py-3">
      <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
    </td>

    <td className="px-4 py-3">
      <div className="text-[12px] text-gray-700">{c.email ?? '—'}</div>
      {c.phone && <div className="text-[10px] text-gray-400">{c.phone}</div>}
    </td>

    <td className="px-4 py-3">
      <div className="text-[12px] text-gray-700">
        {[c.city, c.country].filter(Boolean).join(', ') || '—'}
      </div>
    </td>

    <td className="px-4 py-3">
      {c.negotiated_rate > 0 ? (
        <span className="text-[12px] font-bold text-[#8B5CF6]">{c.negotiated_rate}%</span>
      ) : (
        <span className="text-[12px] text-gray-300">—</span>
      )}
    </td>

    <td className="px-4 py-3">
      {c.credit_limit > 0 ? (
        <span className="text-[12px] font-bold text-gray-900">
          {c.credit_limit.toLocaleString('fr-FR')} €
        </span>
      ) : (
        <span className="text-[12px] text-gray-300">—</span>
      )}
    </td>

    <td className="px-4 py-3">
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-[#8B5CF6]/10 text-gray-400 hover:text-[#8B5CF6] transition-colors"
          title="Modifier"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          title="Supprimer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </td>
  </tr>
);

export default CompaniesView;
