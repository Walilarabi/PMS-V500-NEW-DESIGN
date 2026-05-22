/**
 * FLOWTYM — Company Form Modal (Wave C3)
 *
 * Create / edit a company (corporate, agency, tour_operator, other).
 * Calls crm_save_company RPC via useSaveCompany mutation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSaveCompany } from '@/src/services/crm/hooks';
import type { Company } from '@/src/services/crm/crm.service';

type CompanyForm = Omit<Company, 'hotel_id' | 'created_at' | 'updated_at'> & { id: string | null };

const emptyForm = (defaultType: Company['type']): CompanyForm => ({
  id: null,
  name: '',
  type: defaultType,
  siret: null,
  tva_number: null,
  address: null,
  city: null,
  zip: null,
  country: null,
  email: null,
  phone: null,
  website: null,
  contract_type: null,
  negotiated_rate: 0,
  credit_limit: 0,
  notes: null,
});

interface Props {
  company: Company | null;
  defaultType?: Company['type'];
  onClose: () => void;
}

const Field = ({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors';

export const CompanyFormModal: React.FC<Props> = ({
  company,
  defaultType = 'corporate',
  onClose,
}) => {
  const isEdit = !!company?.id;

  const [form, setForm] = useState<CompanyForm>(
    company
      ? {
          id:              company.id,
          name:            company.name,
          type:            company.type,
          siret:           company.siret,
          tva_number:      company.tva_number,
          address:         company.address,
          city:            company.city,
          zip:             company.zip,
          country:         company.country,
          email:           company.email,
          phone:           company.phone,
          website:         company.website,
          contract_type:   company.contract_type,
          negotiated_rate: company.negotiated_rate,
          credit_limit:    company.credit_limit,
          notes:           company.notes,
        }
      : emptyForm((defaultType ?? 'corporate') as Company['type']),
  );

  const save = useSaveCompany();

  const set = (field: keyof CompanyForm, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }) as CompanyForm);

  const str = (v: string) => v.trim() || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await save.mutateAsync({
      id:              form.id,
      name:            form.name.trim(),
      type:            form.type,
      siret:           str(form.siret ?? ''),
      tva_number:      str(form.tva_number ?? ''),
      address:         str(form.address ?? ''),
      city:            str(form.city ?? ''),
      zip:             str(form.zip ?? ''),
      country:         str(form.country ?? ''),
      email:           str(form.email ?? ''),
      phone:           str(form.phone ?? ''),
      website:         str(form.website ?? ''),
      contract_type:   str(form.contract_type ?? ''),
      negotiated_rate: form.negotiated_rate,
      credit_limit:    form.credit_limit,
      notes:           str(form.notes ?? ''),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#8B5CF6]/10">
                <Building2 size={16} className="text-[#8B5CF6]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {isEdit ? 'Modifier la société' : 'Nouvelle société'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {isEdit ? company.name : 'Renseigner les informations'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Scrollable form body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom *" className="col-span-2">
                  <input
                    required
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={inputCls}
                    placeholder="Nom de la société"
                  />
                </Field>

                <Field label="Type">
                  <select
                    value={form.type}
                    onChange={(e) => set('type', e.target.value as Company['type'])}
                    className={inputCls + ' bg-white'}
                  >
                    <option value="corporate">Corporate</option>
                    <option value="agency">Agence</option>
                    <option value="tour_operator">Tour-opérateur</option>
                    <option value="other">Autre</option>
                  </select>
                </Field>

                <Field label="Type contrat">
                  <input
                    value={form.contract_type ?? ''}
                    onChange={(e) => set('contract_type', e.target.value)}
                    className={inputCls}
                    placeholder="Annuel, Spot…"
                  />
                </Field>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => set('email', e.target.value)}
                    className={inputCls}
                    placeholder="contact@societe.com"
                  />
                </Field>
                <Field label="Téléphone">
                  <input
                    value={form.phone ?? ''}
                    onChange={(e) => set('phone', e.target.value)}
                    className={inputCls}
                    placeholder="+33 1 23 45 67 89"
                  />
                </Field>
              </div>

              {/* Financial */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Taux négocié (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.negotiated_rate}
                    onChange={(e) => set('negotiated_rate', parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Plafond crédit (€)">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={form.credit_limit}
                    onChange={(e) => set('credit_limit', parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Legal */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="SIRET">
                  <input
                    value={form.siret ?? ''}
                    onChange={(e) => set('siret', e.target.value)}
                    className={inputCls}
                    placeholder="123 456 789 00012"
                  />
                </Field>
                <Field label="N° TVA">
                  <input
                    value={form.tva_number ?? ''}
                    onChange={(e) => set('tva_number', e.target.value)}
                    className={inputCls}
                    placeholder="FR12345678901"
                  />
                </Field>
              </div>

              {/* Address */}
              <Field label="Adresse">
                <input
                  value={form.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  className={inputCls}
                  placeholder="123 rue de la Paix"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Code postal">
                  <input
                    value={form.zip ?? ''}
                    onChange={(e) => set('zip', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Ville">
                  <input
                    value={form.city ?? ''}
                    onChange={(e) => set('city', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Pays">
                  <input
                    value={form.country ?? ''}
                    onChange={(e) => set('country', e.target.value)}
                    className={inputCls}
                    placeholder="FR"
                  />
                </Field>
              </div>

              {/* Web */}
              <Field label="Site web">
                <input
                  value={form.website ?? ''}
                  onChange={(e) => set('website', e.target.value)}
                  className={inputCls}
                  placeholder="https://www.societe.com"
                />
              </Field>

              {/* Notes */}
              <Field label="Notes">
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  className={inputCls + ' resize-none'}
                  placeholder="Informations complémentaires…"
                />
              </Field>

              {save.isError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
                  Erreur lors de l'enregistrement. Veuillez réessayer.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 size={13} className="animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer la société'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompanyFormModal;
