/**
 * FLOWTYM — GDPR / Documents View (Wave C8)
 *
 * Three-tab GDPR compliance center:
 *  • Consentements — overview KPIs + per-guest consent status with bulk update
 *  • Demandes       — GDPR request tracker (access / erasure / portability …)
 *  • Anonymisation  — quick search + controlled PII wipe with confirmation
 */

import React, { useState } from 'react';
import {
  ShieldCheck, Users, FileText, Eraser,
  CheckCircle2, XCircle, HelpCircle,
  Plus, Loader2, Download, AlertTriangle,
  ToggleLeft, ToggleRight, Eye, Clock,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  useGdprConsentOverview,
  useGuestsConsent,
  useSetGdprConsent,
  useGdprRequests,
  useGdprExport,
  useGdprErase,
} from '@/src/services/crm/hooks';
import {
  REQUEST_TYPE_META,
  REQUEST_STATUS_META,
  type GdprRequest,
  type GdprConsentRow,
} from '@/src/services/crm/gdpr.service';
import { GdprRequestModal } from './GdprRequestModal';
import { useGuests } from '@/src/domains/guests/hooks';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

type Tab = 'consents' | 'requests' | 'erase';

// ─── Main component ───────────────────────────────────────────────────────────

export const GdprView = () => {
  const [tab, setTab] = useState<Tab>('consents');

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'consents', label: 'Consentements', icon: ShieldCheck },
    { key: 'requests', label: 'Demandes RGPD',  icon: FileText   },
    { key: 'erase',    label: 'Anonymisation',  icon: Eraser     },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFB]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-bold transition-colors border-b-2',
              tab === key
                ? 'bg-white text-[#8B5CF6] border-[#8B5CF6]'
                : 'text-gray-400 hover:text-gray-600 border-transparent hover:bg-white/60',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {tab === 'consents' && <ConsentsTab />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'erase'    && <EraseTab />}
      </div>
    </div>
  );
};

// ─── Tab: Consentements ───────────────────────────────────────────────────────

type ConsentFilter = 'consented' | 'refused' | 'unknown' | null;

const ConsentsTab = () => {
  const [filter, setFilter] = useState<ConsentFilter>(null);

  const overviewQ  = useGdprConsentOverview();
  const guestsQ    = useGuestsConsent(filter);
  const setConsent = useSetGdprConsent();

  const ov = overviewQ.data;

  const FILTER_OPTS: { key: ConsentFilter; label: string; icon: React.ElementType; color: string }[] = [
    { key: null,         label: 'Tous',            icon: Users,       color: '#6B7280' },
    { key: 'consented',  label: 'Consentis',        icon: CheckCircle2, color: '#10B981' },
    { key: 'refused',    label: 'Refusés',          icon: XCircle,     color: '#EF4444' },
    { key: 'unknown',    label: 'Non renseignés',   icon: HelpCircle,  color: '#F59E0B' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {overviewQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse h-16 bg-gray-100" />
          ))
        ) : (
          <>
            <KpiCard
              label="Total clients"
              value={ov?.total ?? 0}
              icon={Users}
              color="#6B7280"
            />
            <KpiCard
              label="Consentis"
              value={ov?.consented ?? 0}
              icon={CheckCircle2}
              color="#10B981"
              suffix={ov?.consent_rate != null ? `${ov.consent_rate}%` : undefined}
            />
            <KpiCard
              label="Refusés"
              value={ov?.refused ?? 0}
              icon={XCircle}
              color="#EF4444"
            />
            <KpiCard
              label="Non renseignés"
              value={ov?.unknown ?? 0}
              icon={HelpCircle}
              color="#F59E0B"
            />
          </>
        )}
      </div>

      {/* Consent rate bar */}
      {ov && ov.total > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Répartition du consentement
            </span>
            <span className="text-sm font-bold text-gray-700">
              {ov.consent_rate != null ? `${ov.consent_rate}% taux de consentement` : '—'}
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(ov.consented / ov.total) * 100}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all"
              style={{ width: `${(ov.refused / ov.total) * 100}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${(ov.unknown / ov.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: 'Consenti',      color: 'bg-emerald-500' },
              { label: 'Refusé',        color: 'bg-red-400' },
              { label: 'Non renseigné', color: 'bg-amber-400' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              filter === key
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300',
            )}
            style={filter === key ? { background: color } : undefined}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Guest consent list */}
      <Card className="overflow-hidden">
        {guestsQ.isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Chargement…</div>
        ) : (guestsQ.data ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck size={28} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-bold text-gray-500">Aucun client dans cette catégorie</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-bold text-xs text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="text-left px-4 py-2.5 font-bold text-xs text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-center px-4 py-2.5 font-bold text-xs text-gray-400 uppercase tracking-wider">
                  Consentement
                </th>
                <th className="text-left px-4 py-2.5 font-bold text-xs text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-center px-4 py-2.5 font-bold text-xs text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {(guestsQ.data ?? []).map((g) => (
                <ConsentRow key={g.id} guest={g} onToggle={setConsent.mutate} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

const ConsentRow: React.FC<{
  guest: GdprConsentRow;
  onToggle: (args: { guestId: string; consent: boolean }) => void;
}> = ({ guest: g, onToggle }) => {
  const [pending, setPending] = useState(false);

  const handleToggle = async (consent: boolean) => {
    setPending(true);
    try { onToggle({ guestId: g.id, consent }); }
    finally { setTimeout(() => setPending(false), 800); }
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-bold text-gray-900">{g.full_name || '—'}</div>
        <div className="text-xs text-gray-400">{g.total_stays ?? 0} séjour{(g.total_stays ?? 0) !== 1 ? 's' : ''}</div>
      </td>
      <td className="px-4 py-3 text-gray-500">{g.email ?? '—'}</td>
      <td className="px-4 py-3 text-center">
        {g.gdpr_consent === true ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
            <CheckCircle2 size={11} /> Consenti
          </span>
        ) : g.gdpr_consent === false ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold">
            <XCircle size={11} /> Refusé
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold">
            <HelpCircle size={11} /> Inconnu
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs">
        {fmtDate(g.gdpr_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          {pending ? (
            <Loader2 size={14} className="animate-spin text-gray-400" />
          ) : g.gdpr_consent === true ? (
            <button
              type="button"
              onClick={() => handleToggle(false)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              title="Révoquer le consentement"
            >
              <ToggleRight size={16} className="text-emerald-500" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleToggle(true)}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 transition-colors"
              title="Enregistrer le consentement"
            >
              <ToggleLeft size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Tab: Demandes ────────────────────────────────────────────────────────────

const RequestsTab = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'rejected'>('all');
  const [modalRequest, setModalRequest] = useState<GdprRequest | null | 'new'>('new' as never);
  const [showModal, setShowModal]       = useState(false);
  const [editRequest, setEditRequest]   = useState<GdprRequest | null>(null);

  const requestsQ = useGdprRequests(
    statusFilter === 'all' ? undefined : statusFilter as any,
  );

  const STATUS_FILTERS = [
    { key: 'all',        label: 'Toutes'    },
    { key: 'pending',    label: 'En attente' },
    { key: 'processing', label: 'En cours'   },
    { key: 'completed',  label: 'Complétées' },
    { key: 'rejected',   label: 'Refusées'   },
  ];

  const openNew    = () => { setEditRequest(null); setShowModal(true); };
  const openResolve = (r: GdprRequest) => { setEditRequest(r); setShowModal(true); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key as any)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
                statusFilter === key
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={13} /> Nouvelle demande
        </Button>
      </div>

      {/* Request list */}
      {requestsQ.isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">Chargement…</div>
      ) : (requestsQ.data ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <FileText size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-bold text-gray-500">Aucune demande RGPD</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Enregistrez ici les demandes d'accès, d'effacement ou de portabilité reçues de vos clients.
          </p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus size={13} /> Créer une demande
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {(requestsQ.data ?? []).map((r) => (
            <RequestCard key={r.id} request={r} onResolve={() => openResolve(r)} />
          ))}
        </div>
      )}

      {showModal && (
        <GdprRequestModal
          request={editRequest}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

const RequestCard: React.FC<{ request: GdprRequest; onResolve: () => void }> = ({
  request: r,
  onResolve,
}) => {
  const typeMeta   = REQUEST_TYPE_META[r.request_type];
  const statusMeta = REQUEST_STATUS_META[r.status];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
            style={{ background: typeMeta?.color ?? '#6B7280' }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">
                {r.guest_name ?? 'Client supprimé'}
              </span>
              <span
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ color: typeMeta?.color, background: typeMeta?.color + '15' }}
              >
                {typeMeta?.label ?? r.request_type}
              </span>
              <span
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ color: statusMeta?.color, background: statusMeta?.bg }}
              >
                {statusMeta?.label ?? r.status}
              </span>
            </div>
            {r.guest_email && (
              <div className="text-xs text-gray-400 mt-0.5">{r.guest_email}</div>
            )}
            {r.notes && (
              <div className="text-xs text-gray-500 mt-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg">
                {r.notes}
              </div>
            )}
            {r.resolution && (
              <div className="text-xs text-emerald-600 mt-1.5 px-2.5 py-1.5 bg-emerald-50 rounded-lg">
                Résolution : {r.resolution}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={10} />
            {fmtDate(r.created_at)}
          </div>
          {r.status !== 'completed' && r.status !== 'rejected' && (
            <Button size="sm" variant="outline" onClick={onResolve}>
              <Eye size={11} /> Traiter
            </Button>
          )}
          {r.resolved_at && (
            <div className="text-xs text-gray-400">
              Résolu {fmtDate(r.resolved_at)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ─── Tab: Anonymisation ───────────────────────────────────────────────────────

const EraseTab = () => {
  const [search, setSearch]         = useState('');
  const [confirmGuest, setConfirmGuest] = useState<{ id: string; name: string } | null>(null);
  const [exportGuest, setExportGuest]   = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason]             = useState('');
  const [exportData, setExportData]     = useState<object | null>(null);

  const guestsQ = useGuests({ search, limit: 8 });
  const erase   = useGdprErase();
  const exporter = useGdprExport();

  const handleErase = async () => {
    if (!confirmGuest) return;
    await erase.mutateAsync({ guestId: confirmGuest.id, reason: reason || undefined });
    setConfirmGuest(null);
    setReason('');
    setSearch('');
  };

  const handleExport = async (guestId: string, guestName: string) => {
    const data = await exporter.mutateAsync(guestId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gdpr-export-${guestName.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportGuest(null);
  };

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Opérations irréversibles</p>
          <p className="text-xs text-amber-700 mt-0.5">
            L'anonymisation efface définitivement toutes les données personnelles identifiantes
            (nom, email, téléphone, passeport…). Les réservations et les statistiques sont conservées.
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Rechercher un client</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, email…"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#8B5CF6]"
        />

        {search.length > 1 && (
          <div className="mt-3 space-y-1">
            {guestsQ.isLoading ? (
              <p className="text-xs text-gray-400 text-center py-3">Recherche…</p>
            ) : (guestsQ.data?.rows ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
            ) : (
              (guestsQ.data?.rows ?? []).map((g) => {
                const name = [g.first_name, g.last_name].filter(Boolean).join(' ');
                const isAnon = name.startsWith('Anonymisé') || g.email?.endsWith('@erased.local');
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-xs font-bold text-[#8B5CF6] shrink-0">
                        {(g.first_name?.[0] ?? g.last_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{name}</div>
                        <div className="text-xs text-gray-400">{g.email ?? '—'}</div>
                      </div>
                      {isAnon && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[11px] font-bold uppercase">
                          Déjà anonymisé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(g.id, name)}
                        disabled={exporter.isPending}
                      >
                        {exporter.isPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        Export
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setConfirmGuest({ id: g.id, name })}
                        disabled={isAnon}
                        className="!bg-red-500 hover:!bg-red-600 !text-white"
                      >
                        <Eraser size={11} /> Anonymiser
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>

      {/* Confirm erasure dialog */}
      {confirmGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Eraser size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Confirmer l'anonymisation</h3>
                <p className="text-xs text-gray-400">{confirmGuest.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Cette action est <strong>irréversible</strong>. Toutes les données personnelles
              identifiantes seront effacées. Les données financières et statistiques sont conservées.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Motif (facultatif)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Demande écrite du 20/05/2026…"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-400"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConfirmGuest(null); setReason(''); }}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleErase}
                disabled={erase.isPending}
                className="!bg-red-500 hover:!bg-red-600 !text-white"
              >
                {erase.isPending && <Loader2 size={12} className="animate-spin" />}
                Confirmer l'anonymisation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Shared KPI card ──────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  suffix?: string;
}> = ({ label, value, icon: Icon, color, suffix }) => (
  <Card className="p-4 flex items-center gap-3">
    <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${color}18` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="text-lg font-bold text-gray-900 leading-none">
        {value}
        {suffix && <span className="text-xs font-bold text-gray-400 ml-1.5">{suffix}</span>}
      </div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1 truncate">
        {label}
      </div>
    </div>
  </Card>
);

export default GdprView;
