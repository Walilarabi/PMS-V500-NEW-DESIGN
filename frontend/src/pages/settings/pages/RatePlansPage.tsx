/**
 * FLOWTYM — Paramètres · Plans tarifaires.
 *
 * Charge les plans tarifaires directement depuis Supabase (sans passer par
 * le rateCalendarStore), afin de ne pas déclencher le chargement complet du
 * Calendrier tarifaire au montage de la page Paramètres.
 *
 * Le rateCalendarStore est chargé de manière différée uniquement lorsque
 * l'utilisateur ouvre le panneau d'édition RateManagerPanel.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Grid, Search, Settings as SettingsIcon, ExternalLink, Star, Power, CheckCircle2,
  AlertCircle, Plug, Tag, Upload, FileSpreadsheet, Trash2, X, Zap, ArrowRight, Wand2,
  RefreshCw, Plus,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { RateManagerPanel } from '@/src/components/rms/calendar/RateManagerPanel';
import { RatePlanImportModal } from './RatePlanImportModal';
import { usePermission, PermissionDeniedBanner } from '@/src/services/settings/permissionsService';
import type { PensionType } from '@/src/components/rms/types';
import type { PageId } from '@/src/types';
import {
  listRatePlansWithRooms,
  listRoomTypeRows,
  type RatePlanWithRoom,
  type RoomTypeRow,
} from '@/src/services/settings/rate-plans.service';
import {
  parseRatePlanExcel, saveImportedRatePlans, loadImportedRatePlans, clearImportedRatePlans,
  type RatePlanImportReport,
} from '@/src/services/settings/rate-plan-import.service';
import {
  integrateRatePlans, suggestRoomMappingFromRows, suggestMealPlanMapping,
  saveIntegrationReport, loadIntegrationReport,
  type IntegrationReport, type RoomTypeMapping, type MealPlanMapping,
} from '@/src/services/settings/rate-plan-integration.service';
import { logImportedRatePlanReport } from '@/src/services/settings/settingsPersistence';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';

interface RatePlansPageProps {
  onNavigate: (page: PageId) => void;
}

export const RatePlansPage: React.FC<RatePlansPageProps> = ({ onNavigate }) => {
  // Store used ONLY for panel actions (edit/delete) — NOT for data loading on mount.
  const { openRatePanel, deleteRatePlan } = useRateCalendarStore();

  const [plans, setPlans] = useState<RatePlanWithRoom[]>([]);
  const [roomRows, setRoomRows] = useState<RoomTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const audit = useAuditLogger();

  const canRead = usePermission('rev_pricing', 'read');
  const canWrite = usePermission('rev_pricing', 'write');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, r] = await Promise.all([listRatePlansWithRooms(), listRoomTypeRows()]);
      setPlans(p);
      setRoomRows(r);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function notify(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2500);
  }

  // ─── Import Excel ─────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<RatePlanImportReport | null>(() => loadImportedRatePlans());
  const [showImportedTable, setShowImportedTable] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const report = parseRatePlanExcel(buf, file.name);
      saveImportedRatePlans(report);
      setImported(report);
      setShowImportedTable(true);
      audit({
        action: 'rate_plan_imported',
        module: 'rms_revenue',
        detail: `"${file.name}" — ${report.totalRows} plans tarifaires détectés (${report.warnings.length} avertissements)`,
        meta: { fileName: file.name, totalRows: report.totalRows, warnings: report.warnings.length },
      });
      notify(`${report.totalRows} plans tarifaires importés`);
    } catch (err) {
      notify(`Erreur d'import : ${(err as Error).message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearImported() {
    if (!confirm("Effacer l'import en cours ?")) return;
    clearImportedRatePlans();
    setImported(null);
    setShowImportedTable(false);
    notify('Import effacé');
  }

  // ─── Workflow d'intégration ────────────────────────────────────────────
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [roomMapping, setRoomMapping] = useState<RoomTypeMapping>({});
  const [mealMapping, setMealMapping] = useState<MealPlanMapping>({});
  const [integrationReport, setIntegrationReport] = useState<IntegrationReport | null>(() => loadIntegrationReport());

  function openIntegration() {
    if (!imported) return;
    setRoomMapping(suggestRoomMappingFromRows(imported.uniqueRooms, roomRows));
    setMealMapping(suggestMealPlanMapping(imported.uniqueMealPlans));
    setIntegrationOpen(true);
  }

  function runIntegration() {
    if (!imported) return;
    const report = integrateRatePlans(imported.plans, roomMapping, mealMapping);
    saveIntegrationReport(report);
    setIntegrationReport(report);
    audit({
      action: 'rate_plan_integrated',
      module: 'rms_revenue',
      detail: `${report.created} créés · ${report.updated} mis à jour · ${report.rejected} rejetés · ${report.requiresMapping} à corriger`,
      meta: { created: report.created, updated: report.updated, rejected: report.rejected, requiresMapping: report.requiresMapping, total: report.total },
    });
    void logImportedRatePlanReport({
      fileName: imported.fileName,
      totalRows: report.total,
      createdCount: report.created,
      updatedCount: report.updated,
      rejectedCount: report.rejected,
      requiresMappingCount: report.requiresMapping,
      roomMapping,
      mealMapping,
      report,
      warnings: imported.warnings ?? [],
    });
    notify(`${report.created + report.updated} plans intégrés au système`);
    setIntegrationOpen(false);
  }

  async function handleDeletePlan(plan: RatePlanWithRoom) {
    if (!canWrite) return;
    if (!window.confirm(`Supprimer le plan "${plan.plan_name}" ? Cette action est irréversible.`)) return;
    const roomTypeId = plan.room_type_id ?? '';
    const { error } = await deleteRatePlan(roomTypeId, plan.id);
    if (error) { notify(`Suppression échouée — ${error}`); return; }
    audit({
      action: 'rate_plan_deleted',
      module: 'rms_revenue',
      detail: `${plan.plan_name} (${plan.plan_code})`,
      meta: { planId: plan.id, planCode: plan.plan_code },
    });
    notify(`Plan "${plan.plan_name}" supprimé`);
    void refresh();
  }

  // ─── Données dérivées ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (filterRoom !== 'all' && p.room_type_id !== filterRoom) return false;
      if (q && !`${p.plan_name} ${p.plan_code} ${p.room?.room_type_name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plans, search, filterRoom]);

  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.is_active).length;
  const refPlans = plans.filter((p) => p.is_reference).length;
  const roomsWithPlans = new Set(plans.map((p) => p.room_type_id).filter(Boolean));
  const orphanRooms = roomRows.filter((r) => !roomsWithPlans.has(r.id)).length;

  if (!canRead) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10">
          <PermissionDeniedBanner capability="rev_pricing" required="read" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Grid className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Tarifs & Prestations</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Plans tarifaires</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Plans tarifaires actifs par typologie de chambre, plan référent et canaux de distribution.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            <button
              onClick={() => { if (canWrite) openRatePanel(null); }}
              disabled={!canWrite}
              title={!canWrite ? 'Permission requise : rev_pricing (write)' : 'Créer un plan tarifaire'}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Créer un tarif
            </button>
            <button
              onClick={() => canWrite && setImportModalOpen(true)}
              disabled={!canWrite}
              title={!canWrite ? 'Permission requise : rev_pricing (write)' : 'Importer des plans tarifaires depuis Excel'}
              className="px-3 py-2 rounded-lg ring-1 ring-violet-200 bg-white text-[13px] font-medium text-violet-700 hover:bg-violet-50 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" /> Importer Excel
            </button>
            <RateManagerPanel />
            <RatePlanImportModal
              open={importModalOpen}
              onClose={() => setImportModalOpen(false)}
              onImported={() => { void refresh(); }}
            />
            <button
              onClick={() => onNavigate('rev_calendar' as PageId)}
              className="px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Grid className="w-3.5 h-3.5" /> Voir le Calendrier
            </button>
          </div>
        </header>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-slate-100" />)}
            </div>
            <div className="h-64 rounded-2xl bg-slate-100" />
          </div>
        )}

        {/* Error state */}
        {!loading && loadError && (
          <div className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1 text-[13px] text-rose-800">{loadError}</div>
            <button onClick={() => void refresh()} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[12px] font-medium hover:bg-rose-700 inline-flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> Réessayer
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* Bandeau import en cours */}
            {imported && imported.totalRows > 0 && (
              <section className="rounded-2xl ring-1 ring-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center ring-1 ring-emerald-200 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                        Import Excel : <span className="font-mono">{imported.fileName}</span>
                      </div>
                      <div className="text-[11.5px] text-slate-600 mt-0.5">
                        {imported.totalRows} plans · {imported.uniqueRooms.length} typologies · {imported.uniquePartners.length} partenaires · {imported.uniqueMealPlans.length} pensions
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Importé le {new Date(imported.parsedAt).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button onClick={() => setShowImportedTable(!showImportedTable)} className="px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-200 bg-white text-[12px] font-medium text-emerald-700 hover:bg-emerald-50">
                      {showImportedTable ? 'Masquer' : 'Voir les plans importés'}
                    </button>
                    <button onClick={() => canWrite && openIntegration()} disabled={!canWrite}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12.5px] font-medium hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                      <Zap className="w-3.5 h-3.5" /> Intégrer les tarifs au système
                    </button>
                    <button onClick={() => canWrite && clearImported()} disabled={!canWrite}
                      className="p-1.5 rounded-lg ring-1 ring-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {imported.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 ring-1 ring-amber-100 px-3 py-2 text-[11.5px] text-amber-800">
                    <div className="font-semibold mb-1 inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {imported.warnings.length} avertissement{imported.warnings.length > 1 ? 's' : ''}
                    </div>
                    <ul className="space-y-0.5 ml-4 list-disc">
                      {imported.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                      {imported.warnings.length > 3 && <li className="italic">+{imported.warnings.length - 3} autres…</li>}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Tableau plans importés */}
            {showImportedTable && imported && (
              <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
                <header className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-[13px] font-semibold text-slate-900">Plans importés ({imported.totalRows})</h3>
                </header>
                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50/60 sticky top-0">
                      <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Nom</th>
                        <th className="px-3 py-2 font-medium">Pension</th>
                        <th className="px-3 py-2 font-medium">Calcul</th>
                        <th className="px-3 py-2 font-medium">Chambres</th>
                        <th className="px-3 py-2 font-medium">Partenaires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imported.plans.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{p.code}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{p.name}</td>
                          <td className="px-3 py-2 text-slate-600">{p.mealPlan}</td>
                          <td className="px-3 py-2">
                            {p.computation === 'reference' ? (
                              <span className="inline-flex items-center gap-1 text-amber-700"><Star className="w-3 h-3 fill-amber-500" /> Référence</span>
                            ) : <span className="text-slate-500">Dérivé</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{p.rooms.length} type{p.rooms.length > 1 ? 's' : ''}</td>
                          <td className="px-3 py-2 text-slate-600">{p.partners.length > 0 ? `${p.partners.length} canal${p.partners.length > 1 ? 'aux' : ''}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Métriques */}
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Total plans" value={`${totalPlans}`} caption={`Sur ${roomRows.length} types de chambres`} tone="violet" />
              <Metric label="Plans actifs" value={`${activePlans}`} caption={`${totalPlans > 0 ? Math.round((activePlans / totalPlans) * 100) : 0}% du catalogue`} tone="emerald" />
              <Metric label="Plans référents" value={`${refPlans} / ${roomRows.length}`} caption="1 référent obligatoire / chambre" tone={refPlans >= roomRows.length && roomRows.length > 0 ? 'emerald' : 'attention'} />
              <Metric label="Chambres sans référent" value={`${orphanRooms}`} caption={orphanRooms === 0 ? 'Toutes couvertes' : 'Action requise'} tone={orphanRooms === 0 ? 'emerald' : 'critical'} />
            </div>

            {/* Alerte orphelin */}
            {orphanRooms > 0 && (
              <section className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {orphanRooms} chambre{orphanRooms > 1 ? 's' : ''} sans plan tarifaire de référence
                  </div>
                  <p className="text-[12px] text-slate-600 mt-1">
                    Sans plan de référence, le RMS ne peut pas appliquer ses recommandations.
                  </p>
                </div>
                <button onClick={() => onNavigate('rev_calendar' as PageId)}
                  className="shrink-0 px-3 py-2 rounded-lg bg-rose-600 text-white text-[12px] font-medium hover:bg-rose-700 inline-flex items-center gap-1.5">
                  Corriger <ExternalLink className="w-3 h-3" />
                </button>
              </section>
            )}

            {/* Filtres */}
            <section className="flex flex-wrap items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher plan, code, chambre…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none text-[13px]" />
              </div>
              <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} className="px-2.5 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px]">
                <option value="all">Toutes les chambres</option>
                {roomRows.map((r) => <option key={r.id} value={r.id}>{r.room_type_name}</option>)}
              </select>
              <span className="ml-auto text-[11px] text-slate-500">{filtered.length} / {totalPlans}</span>
            </section>

            {/* Tableau plans */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="px-5 py-16 text-center text-slate-400">
                  <Grid className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <div className="text-[13px] font-medium text-slate-700">
                    {plans.length === 0 ? 'Aucun plan tarifaire' : 'Aucun résultat'}
                  </div>
                  {plans.length === 0 && (
                    <div className="text-[12px] text-slate-500 mt-1">Créez votre premier plan via le bouton « Créer un tarif ».</div>
                  )}
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Plan tarifaire</th>
                      <th className="px-3 py-2.5 font-medium">Code</th>
                      <th className="px-3 py-2.5 font-medium">Chambre</th>
                      <th className="px-3 py-2.5 font-medium">Pension</th>
                      <th className="px-3 py-2.5 font-medium">Connectivité</th>
                      <th className="px-3 py-2.5 font-medium text-right w-32">Statut</th>
                      <th className="px-3 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((plan) => (
                      <tr key={plan.id} className="border-t border-slate-100 hover:bg-slate-50/60 group">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {plan.is_reference && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Plan de référence" />}
                            <span className="text-[12.5px] font-semibold text-slate-900 truncate">{plan.plan_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-mono text-slate-600">{plan.plan_code}</td>
                        <td className="px-3 py-2.5 text-slate-700 text-[12px]">{plan.room?.room_type_name ?? <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5">
                          {plan.pension_type ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md ring-1 ring-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-600">
                              {plan.pension_type}
                            </span>
                          ) : <span className="text-slate-400 text-[12px]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px]">
                          {plan.connectivity_type && plan.connectivity_type !== 'Aucun' ? (
                            <span className="inline-flex items-center gap-1 text-violet-700">
                              <Plug className="w-3 h-3" /> {plan.connectivity_type}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold',
                            plan.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200')}>
                            <Power className="w-2.5 h-2.5" />
                            {plan.is_active ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {canWrite && (
                            <button onClick={(e) => { e.stopPropagation(); void handleDeletePlan(plan); }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-rose-500 transition-opacity"
                              title="Supprimer ce plan">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Légende pensions */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4">
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Légende pensions
              </h3>
              <div className="grid gap-2 md:grid-cols-4">
                <PensionLegend code="RO" label="Room Only" desc="Chambre seule, sans restauration" />
                <PensionLegend code="BB" label="Bed & Breakfast" desc="Petit-déjeuner inclus" />
                <PensionLegend code="HB" label="Half Board" desc="Demi-pension (petit-déj. + dîner)" />
                <PensionLegend code="FB" label="Full Board" desc="Pension complète" />
              </div>
            </section>

            <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
              <SettingsIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <strong>Édition complète :</strong> création et modification fine des plans tarifaires se fait dans
                le <strong>Calendrier tarifaire</strong> via le panneau <em>RateManagerPanel</em>.
              </div>
            </div>

            {/* Rapport d'intégration */}
            {integrationReport && (
              <section className="rounded-2xl ring-1 ring-violet-200 bg-violet-50/30 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center ring-1 ring-violet-200">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-slate-900">Dernier rapport d'intégration</h3>
                      <p className="text-[11.5px] text-slate-600 mt-0.5">
                        Exécutée le {new Date(integrationReport.ranAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIntegrationReport(null)} className="px-2 py-1 text-[11.5px] text-slate-500 hover:text-slate-900">Masquer</button>
                </div>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mt-4">
                  <ReportStat label="Plans créés" value={integrationReport.created} tone="emerald" />
                  <ReportStat label="Mis à jour" value={integrationReport.updated} tone="sky" />
                  <ReportStat label="Rejetés" value={integrationReport.rejected} tone="rose" />
                  <ReportStat label="À mapper" value={integrationReport.requiresMapping} tone="amber" />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2 z-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toastMsg}
        </div>
      )}

      {/* Modal intégration */}
      {integrationOpen && imported && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4" onClick={() => setIntegrationOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[860px] max-w-[95vw] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 inline-flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-violet-500" /> Intégrer les tarifs au système
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">Mappez les typologies Excel vers les chambres du PMS, validez, puis intégrez.</p>
              </div>
              <button onClick={() => setIntegrationOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">Étape 1 · Aperçu</h3>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <ReportStat label="Plans à intégrer" value={imported.totalRows} tone="violet" />
                  <ReportStat label="Typologies" value={imported.uniqueRooms.length} tone="sky" />
                  <ReportStat label="Pensions" value={imported.uniqueMealPlans.length} tone="emerald" />
                  <ReportStat label="Partenaires" value={imported.uniquePartners.length} tone="amber" />
                </div>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">Étape 2 · Mapping typologies (Excel → PMS)</h3>
                <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                      <tr><th className="px-3 py-2 font-medium">Typologie Excel</th><th className="px-3 py-2 font-medium">→ Chambre PMS</th></tr>
                    </thead>
                    <tbody>
                      {imported.uniqueRooms.map((excelRoom) => (
                        <tr key={excelRoom} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-medium text-slate-700">{excelRoom}</td>
                          <td className="px-3 py-1.5">
                            <select value={roomMapping[excelRoom] ?? ''} onChange={(e) => setRoomMapping({ ...roomMapping, [excelRoom]: e.target.value })}
                              className={cn('w-full px-2.5 py-1.5 rounded-lg ring-1 text-[12px]', !roomMapping[excelRoom] ? 'ring-rose-200 bg-rose-50/50' : 'ring-slate-200 bg-white')}>
                              <option value="">— Non mappé —</option>
                              {roomRows.map((r) => <option key={r.id} value={r.id}>{r.room_type_name} ({r.room_type_code})</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">Étape 3 · Mapping pensions</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {imported.uniqueMealPlans.map((mp) => (
                    <div key={mp} className="rounded-lg ring-1 ring-slate-200 px-3 py-2 flex items-center gap-2">
                      <span className="text-[12.5px] text-slate-700 flex-1 truncate">{mp}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <select value={mealMapping[mp] ?? 'RO'} onChange={(e) => setMealMapping({ ...mealMapping, [mp]: e.target.value as PensionType })}
                        className="px-2 py-1 rounded-md ring-1 ring-slate-200 text-[11.5px] font-mono">
                        <option value="RO">RO · Room only</option>
                        <option value="BB">BB · Petit-déjeuner</option>
                        <option value="HB">HB · Demi-pension</option>
                        <option value="FB">FB · Pension complète</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-violet-50/40 ring-1 ring-violet-100 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                <div className="text-[12.5px] text-slate-700">
                  <div className="font-semibold text-slate-900">Étape 4 · Validation</div>
                  <p className="mt-1">Les plans seront <strong>créés ou mis à jour</strong> dans le rateCalendarStore. Dédoublonnage sur le code (planCode).</p>
                  <p className="mt-2 text-[11.5px] text-slate-600">
                    Typologies non mappées : <strong>{imported.uniqueRooms.filter((r) => !roomMapping[r]).length}</strong> — ces lignes seront rejetées.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between shrink-0">
              <span className="text-[11.5px] text-slate-500">
                {imported.uniqueRooms.filter((r) => roomMapping[r]).length} / {imported.uniqueRooms.length} typologies mappées
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setIntegrationOpen(false)} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">Annuler</button>
                <button onClick={runIntegration}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm">
                  <Zap className="w-3.5 h-3.5" /> Lancer l'intégration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

const ReportStat: React.FC<{ label: string; value: number; tone: 'violet' | 'emerald' | 'sky' | 'rose' | 'amber' }> = ({ label, value, tone }) => {
  const colors = { violet: 'bg-violet-50 text-violet-700 ring-violet-200', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200', sky: 'bg-sky-50 text-sky-700 ring-sky-200', rose: 'bg-rose-50 text-rose-700 ring-rose-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200' }[tone];
  return (
    <div className={cn('rounded-xl px-3 py-2 ring-1 ring-inset', colors)}>
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
      <div className="text-[11px] font-medium">{label}</div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'emerald' | 'critical' | 'attention' }> = ({ label, value, caption, tone }) => {
  const color = { violet: 'text-violet-700', emerald: 'text-emerald-700', critical: 'text-rose-700', attention: 'text-amber-700' }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};

const PensionLegend: React.FC<{ code: string; label: string; desc: string }> = ({ code, label, desc }) => (
  <div className="flex items-start gap-2">
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md ring-1 ring-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-700 shrink-0 mt-0.5">{code}</span>
    <div className="text-[11.5px]"><div className="font-medium text-slate-900">{label}</div><div className="text-slate-500">{desc}</div></div>
  </div>
);
