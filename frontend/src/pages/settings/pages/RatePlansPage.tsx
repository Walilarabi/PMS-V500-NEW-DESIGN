/**
 * FLOWTYM — Paramètres · Plans tarifaires.
 *
 * Vue d'ensemble en lecture seule + édition rapide des plans
 * tarifaires existants (configurés via le rateCalendarStore). Permet
 * de toggler isActive, identifier le plan référent par chambre, voir
 * les canaux de distribution et la pension associés.
 *
 * Phase 1 : modification rapide (active, plan référent). La création
 * complète de plans reste dans la page Calendrier tarifaire (vue
 * RMS, RateManagerPanel) qui a déjà les contrôles métier complets.
 *
 * Alimente directement le driver "Plans tarifaires de référence"
 * du score Configuration.
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Grid, Search, Settings as SettingsIcon, ExternalLink, Star, Power, CheckCircle2,
  AlertCircle, Plug, Tag, Upload, Download, FileSpreadsheet, Trash2, X, Zap, ArrowRight, Wand2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { RateManagerPanel } from '@/src/components/rms/calendar/RateManagerPanel';
import { usePermission, PermissionDeniedBanner } from '@/src/services/settings/permissionsService';
import type { RatePlanData, PensionType } from '@/src/components/rms/types';
import type { PageId } from '@/src/types';
import {
  parseRatePlanExcel, saveImportedRatePlans, loadImportedRatePlans, clearImportedRatePlans,
  type RatePlanImportReport,
} from '@/src/services/settings/rate-plan-import.service';
import {
  integrateRatePlans, suggestRoomMapping, suggestMealPlanMapping,
  saveIntegrationReport, loadIntegrationReport,
  type IntegrationReport, type RoomTypeMapping, type MealPlanMapping,
} from '@/src/services/settings/rate-plan-integration.service';
import { logImportedRatePlanReport } from '@/src/services/settings/settingsPersistence';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';

interface RatePlansPageProps {
  onNavigate: (page: PageId) => void;
}

export const RatePlansPage: React.FC<RatePlansPageProps> = ({ onNavigate }) => {
  const { roomTypes, loadData } = useRateCalendarStore();
  const [search, setSearch] = useState('');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [toast, setToast] = useState<string | null>(null);
  const audit = useAuditLogger();

  // RBAC — lecture min "read", mutations (import / intégration) en "write"
  const canRead = usePermission('rev_pricing', 'read');
  const canWrite = usePermission('rev_pricing', 'write');

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
    if (!confirm('Effacer l\'import en cours ?')) return;
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
    // Suggestion automatique des mappings
    setRoomMapping(suggestRoomMapping(imported.uniqueRooms, roomTypes));
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
      meta: {
        created: report.created,
        updated: report.updated,
        rejected: report.rejected,
        requiresMapping: report.requiresMapping,
        total: report.total,
      },
    });
    // Trace l'import dans Supabase pour audit + historique inter-sessions
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

  React.useEffect(() => {
    if (roomTypes.length === 0) loadData();
  }, []); // eslint-disable-line

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  // ─── Liste plate (room, plan) ─────────────────────────────────────────
  const rows = useMemo(() => {
    const arr: { room: typeof roomTypes[0]; plan: RatePlanData }[] = [];
    roomTypes.forEach((rt) => {
      (rt.ratePlans ?? []).forEach((p) => arr.push({ room: rt, plan: p }));
    });
    return arr;
  }, [roomTypes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ room, plan }) => {
      if (filterRoom !== 'all' && room.roomTypeId !== filterRoom) return false;
      if (q && !`${plan.planName} ${plan.planCode} ${room.roomTypeName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterRoom]);

  // ─── Métriques ────────────────────────────────────────────────────────
  const totalPlans = rows.length;
  const activePlans = rows.filter(({ plan }) => plan.isActive).length;
  const refPlans = rows.filter(({ plan }) => plan.isReference).length;
  const orphanRooms = roomTypes.filter((rt) => !(rt.ratePlans ?? []).some((p) => p.isReference)).length;

  // ─── Actions ──────────────────────────────────────────────────────────
  // NB : on n'a pas d'API publique simple sur rateCalendarStore pour modifier
  // un plan en place — on log + on redirige vers le Calendrier où les
  // contrôles complets existent. Les toggles ci-dessous sont des indicateurs
  // visuels qui amènent au bon écran d'édition.

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
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => canWrite && fileRef.current?.click()}
              disabled={importing || !canWrite}
              title={!canWrite ? 'Permission requise : rev_pricing (write)' : undefined}
              className="px-3 py-2 rounded-lg ring-1 ring-violet-200 bg-white text-[13px] font-medium text-violet-700 hover:bg-violet-50 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Import en cours…' : 'Importer Excel'}
            </button>
            {/* Phase 4 — éditeur CRUD complet (déplacé depuis le calendrier).
                Source unique de vérité : useRateCalendarStore. */}
            {canWrite && <RateManagerPanel />}
            <button
              onClick={() => onNavigate('rev_calendar' as PageId)}
              className="px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 inline-flex items-center gap-1.5"
              title="Visualiser l'application dans le Calendrier tarifaire"
            >
              <Grid className="w-3.5 h-3.5" /> Voir le Calendrier
            </button>
          </div>
        </header>

        {/* ─── Bandeau import en cours ─────────────────────────────────── */}
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
                    {imported.totalRows} plans tarifaires · {imported.uniqueRooms.length} typologies de chambres ·{' '}
                    {imported.uniquePartners.length} partenaires détectés · {imported.uniqueMealPlans.length} pensions
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Importé le {new Date(imported.parsedAt).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setShowImportedTable(!showImportedTable)}
                  className="px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-200 bg-white text-[12px] font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  {showImportedTable ? 'Masquer' : 'Voir les plans importés'}
                </button>
                <button
                  onClick={() => canWrite && openIntegration()}
                  disabled={!canWrite}
                  title={!canWrite ? 'Permission requise : rev_pricing (write)' : undefined}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12.5px] font-medium hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="w-3.5 h-3.5" /> Intégrer les tarifs au système
                </button>
                <button
                  onClick={() => canWrite && clearImported()}
                  disabled={!canWrite}
                  title={!canWrite ? 'Permission requise : rev_pricing (write)' : "Effacer l'import"}
                  className="p-1.5 rounded-lg ring-1 ring-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
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

        {/* ─── Tableau des plans importés ──────────────────────────────── */}
        {showImportedTable && imported && (
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[13px] font-semibold text-slate-900">Plans tarifaires importés ({imported.totalRows})</h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">Lecture seule — sera intégré au moteur RMS en Phase 2.</p>
            </header>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50/60 sticky top-0">
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Pension</th>
                    <th className="px-3 py-2 font-medium">Calcul</th>
                    <th className="px-3 py-2 font-medium">Base</th>
                    <th className="px-3 py-2 font-medium">Chambres</th>
                    <th className="px-3 py-2 font-medium">Partenaires</th>
                    <th className="px-3 py-2 font-medium">Annulation</th>
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
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Star className="w-3 h-3 fill-amber-500" /> Référence
                          </span>
                        ) : (
                          <span className="text-slate-500">Dérivé</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 truncate max-w-[140px]" title={p.baseRate}>
                        {p.baseRate || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[180px]" title={p.rooms.join(' / ')}>
                        {p.rooms.length} type{p.rooms.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]" title={p.partners.join(' / ')}>
                        {p.partners.length > 0 ? `${p.partners.length} canal${p.partners.length > 1 ? 'aux' : ''}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]" title={p.cancelCondition}>
                        {p.cancelCondition || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Total plans" value={`${totalPlans}`} caption={`Sur ${roomTypes.length} types de chambres`} tone="violet" />
          <Metric label="Plans actifs" value={`${activePlans}`} caption={`${totalPlans > 0 ? Math.round((activePlans / totalPlans) * 100) : 0}% du catalogue`} tone="emerald" />
          <Metric
            label="Plans référents"
            value={`${refPlans} / ${roomTypes.length}`}
            caption="1 référent obligatoire / chambre"
            tone={refPlans === roomTypes.length && roomTypes.length > 0 ? 'emerald' : 'attention'}
          />
          <Metric
            label="Chambres sans référent"
            value={`${orphanRooms}`}
            caption={orphanRooms === 0 ? 'Toutes couvertes' : 'Action requise'}
            tone={orphanRooms === 0 ? 'emerald' : 'critical'}
          />
        </div>

        {/* Bandeau alerte */}
        {orphanRooms > 0 && (
          <section className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-900">
                {orphanRooms} chambre{orphanRooms > 1 ? 's' : ''} sans plan tarifaire de référence
              </div>
              <p className="text-[12px] text-slate-600 mt-1">
                Sans plan de référence, le RMS ne peut pas appliquer ses recommandations. Ouvrez le
                Calendrier tarifaire pour désigner un plan de référence par typologie.
              </p>
            </div>
            <button
              onClick={() => onNavigate('rev_calendar' as PageId)}
              className="shrink-0 px-3 py-2 rounded-lg bg-rose-600 text-white text-[12px] font-medium hover:bg-rose-700 inline-flex items-center gap-1.5"
            >
              Corriger <ExternalLink className="w-3 h-3" />
            </button>
          </section>
        )}

        {/* Filtres */}
        <section className="flex flex-wrap items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher plan, code, chambre…"
              className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50/60 focus:bg-white focus:ring-violet-500 outline-none text-[13px]"
            />
          </div>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-2.5 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px]"
          >
            <option value="all">Toutes les chambres</option>
            {roomTypes.map((rt) => (
              <option key={rt.roomTypeId} value={rt.roomTypeId}>{rt.roomTypeName}</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-slate-500">{filtered.length} / {totalPlans}</span>
        </section>

        {/* Tableau plans */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {roomTypes.length === 0 ? (
            <div className="px-5 py-16 text-center text-slate-400">
              <Grid className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-700">Calendrier tarifaire en cours de chargement…</div>
              <div className="text-[12px] text-slate-500 mt-1">Les plans apparaîtront dès que les chambres seront chargées.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              Aucun plan ne correspond aux filtres.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Plan tarifaire</th>
                  <th className="px-3 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Chambre</th>
                  <th className="px-3 py-2.5 font-medium">Pension</th>
                  <th className="px-3 py-2.5 font-medium">Canal</th>
                  <th className="px-3 py-2.5 font-medium">Connectivité</th>
                  <th className="px-3 py-2.5 font-medium text-right">Cellules</th>
                  <th className="px-3 py-2.5 font-medium text-right w-32">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ room, plan }) => (
                  <tr key={`${room.roomTypeId}-${plan.planId}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {plan.isReference && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Plan de référence" />
                        )}
                        <span className="text-[12.5px] font-semibold text-slate-900 truncate">{plan.planName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-slate-600">{plan.planCode}</td>
                    <td className="px-3 py-2.5 text-slate-700 text-[12px]">{room.roomTypeName}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md ring-1 ring-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-600">
                        {plan.pensionType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[11.5px]">
                      {plan.channelType}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px]">
                      {plan.connectivityType !== 'Aucun' ? (
                        <span className="inline-flex items-center gap-1 text-violet-700">
                          <Plug className="w-3 h-3" /> {plan.connectivityType}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{plan.prices?.length ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold',
                        plan.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-500 ring-slate-200',
                      )}>
                        <Power className="w-2.5 h-2.5" />
                        {plan.isActive ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Pension types légende */}
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

        {/* Note Phase 2 */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
          <SettingsIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Édition complète :</strong> création / modification fine des plans tarifaires
            (calcMode, calcValue, dérivation, plan référent) se fait dans le <strong>Calendrier
            tarifaire</strong> via le panneau <em>RateManagerPanel</em> — interface dédiée déjà
            câblée au moteur RMS.
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}

        {/* ─── Rapport d'intégration ─────────────────────────────────── */}
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
              <button
                onClick={() => setIntegrationReport(null)}
                className="px-2 py-1 text-[11.5px] text-slate-500 hover:text-slate-900"
              >
                Masquer
              </button>
            </div>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mt-4">
              <ReportStat label="Plans créés" value={integrationReport.created} tone="emerald" />
              <ReportStat label="Mis à jour" value={integrationReport.updated} tone="sky" />
              <ReportStat label="Rejetés" value={integrationReport.rejected} tone="rose" />
              <ReportStat label="À mapper" value={integrationReport.requiresMapping} tone="amber" />
            </div>
            {(integrationReport.rejected > 0 || integrationReport.requiresMapping > 0) && (
              <details className="mt-3">
                <summary className="text-[12px] font-medium text-violet-700 cursor-pointer hover:underline">
                  Voir le détail des lignes problématiques ({integrationReport.rejected + integrationReport.requiresMapping})
                </summary>
                <ul className="mt-2 space-y-1.5 text-[11.5px] max-h-40 overflow-y-auto">
                  {integrationReport.rows
                    .filter((r) => r.status === 'rejected' || r.status === 'requires_mapping')
                    .map((r, i) => (
                      <li key={i} className="rounded-lg bg-white ring-1 ring-slate-100 px-3 py-1.5">
                        <span className="font-mono text-slate-700">{r.source.code}</span>
                        <span className="ml-2 text-slate-500">{r.source.name}</span>
                        {r.reason && <span className="ml-2 text-rose-600">— {r.reason}</span>}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>

      {/* ─── Modal "Intégrer les tarifs au système" ───────────────────── */}
      {integrationOpen && imported && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4" onClick={() => setIntegrationOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[860px] max-w-[95vw] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 inline-flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-violet-500" /> Intégrer les tarifs au système
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Mappez les typologies Excel vers les chambres du PMS, validez, puis intégrez.
                </p>
              </div>
              <button onClick={() => setIntegrationOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Étape 1 — Aperçu */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">
                  Étape 1 · Aperçu de l'import
                </h3>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <ReportStat label="Plans à intégrer" value={imported.totalRows} tone="violet" />
                  <ReportStat label="Typologies" value={imported.uniqueRooms.length} tone="sky" />
                  <ReportStat label="Pensions" value={imported.uniqueMealPlans.length} tone="emerald" />
                  <ReportStat label="Partenaires" value={imported.uniquePartners.length} tone="amber" />
                </div>
              </div>

              {/* Étape 2 — Mapping chambres */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">
                  Étape 2 · Mapping des typologies (Excel → PMS)
                </h3>
                <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Typologie Excel</th>
                        <th className="px-3 py-2 font-medium">→ Chambre PMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imported.uniqueRooms.map((excelRoom) => (
                        <tr key={excelRoom} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-medium text-slate-700">{excelRoom}</td>
                          <td className="px-3 py-1.5">
                            <select
                              value={roomMapping[excelRoom] ?? ''}
                              onChange={(e) => setRoomMapping({ ...roomMapping, [excelRoom]: e.target.value })}
                              className={cn(
                                'w-full px-2.5 py-1.5 rounded-lg ring-1 text-[12px]',
                                !roomMapping[excelRoom] ? 'ring-rose-200 bg-rose-50/50' : 'ring-slate-200 bg-white',
                              )}
                            >
                              <option value="">— Non mappé —</option>
                              {roomTypes.map((rt) => (
                                <option key={rt.roomTypeId} value={rt.roomTypeId}>
                                  {rt.roomTypeName} ({rt.roomTypeCode})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Étape 3 — Mapping pensions */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-violet-600 mb-2">
                  Étape 3 · Mapping des pensions
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {imported.uniqueMealPlans.map((mp) => (
                    <div key={mp} className="rounded-lg ring-1 ring-slate-200 px-3 py-2 flex items-center gap-2">
                      <span className="text-[12.5px] text-slate-700 flex-1 truncate">{mp}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <select
                        value={mealMapping[mp] ?? 'RO'}
                        onChange={(e) => setMealMapping({ ...mealMapping, [mp]: e.target.value as PensionType })}
                        className="px-2 py-1 rounded-md ring-1 ring-slate-200 text-[11.5px] font-mono"
                      >
                        <option value="RO">RO · Room only</option>
                        <option value="BB">BB · Petit-déjeuner</option>
                        <option value="HB">HB · Demi-pension</option>
                        <option value="FB">FB · Pension complète</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Étape 4 — Validation */}
              <div className="rounded-xl bg-violet-50/40 ring-1 ring-violet-100 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                <div className="text-[12.5px] text-slate-700">
                  <div className="font-semibold text-slate-900">Étape 4 · Validation</div>
                  <p className="mt-1">
                    À la confirmation, les plans seront <strong>créés ou mis à jour</strong> dans le rateCalendarStore.
                    Le dédoublonnage se fait sur le code (planCode) — les plans déjà présents seront
                    rafraîchis sans perdre les prix existants.
                  </p>
                  <p className="mt-2 text-[11.5px] text-slate-600">
                    Typologies non mappées : <strong>{imported.uniqueRooms.filter((r) => !roomMapping[r]).length}</strong>
                    {' — ces lignes seront rejetées et listées dans le rapport.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between shrink-0">
              <span className="text-[11.5px] text-slate-500">
                {imported.uniqueRooms.filter((r) => roomMapping[r]).length} / {imported.uniqueRooms.length} typologies mappées
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setIntegrationOpen(false)} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
                  Annuler
                </button>
                <button
                  onClick={runIntegration}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
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

const ReportStat: React.FC<{ label: string; value: number; tone: 'violet' | 'emerald' | 'sky' | 'rose' | 'amber' }> = ({ label, value, tone }) => {
  const colors = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }[tone];
  return (
    <div className={cn('rounded-xl px-3 py-2 ring-1 ring-inset', colors)}>
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
      <div className="text-[11px] font-medium">{label}</div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'emerald' | 'critical' | 'attention' }> = ({ label, value, caption, tone }) => {
  const color = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    critical: 'text-rose-700',
    attention: 'text-amber-700',
  }[tone];
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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md ring-1 ring-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-700 shrink-0 mt-0.5">
      {code}
    </span>
    <div className="text-[11.5px]">
      <div className="font-medium text-slate-900">{label}</div>
      <div className="text-slate-500">{desc}</div>
    </div>
  </div>
);
