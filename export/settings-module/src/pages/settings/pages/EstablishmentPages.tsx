/**
 * FLOWTYM — Paramètres · Établissement (Multi-hôtels, Timezone, Contact,
 * LegalDocs, Photos, Classification, Compliance).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe, Timer, MapPin, FileText, Image as ImageIcon, Star, ShieldCheck,
  Save, Plus, Trash2, ExternalLink, CheckCircle2, AlertCircle, Loader2, Building2,
  ArrowRightLeft,
} from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';
import { cn } from '@/src/lib/utils';
import {
  GenericListPage, SettingsPageHeader, SettingsMetric, SettingsToast, Phase2Notice,
  FormField, type GenericListItem,
} from './_common';

// ─── Multi-hôtels ─────────────────────────────────────────────────────────
// Vrai multi-hôtels (Phase 3) : lit `session.accessibleHotels` depuis
// AuthContext + permet de basculer via RPC `set_active_hotel`.

export const MultiHotelPage: React.FC = () => {
  const { session, switchHotel, isSwitchingHotel, status } = useAuth();
  const audit = useAuditLogger();
  const [switching, setSwitching] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hotels = useMemo(() => session?.accessibleHotels ?? [], [session]);
  const activeHotel = hotels.find((h) => h.isActive);
  const stats = useMemo(() => {
    const total = hotels.length;
    const active = hotels.filter((h) => h.isActive).length;
    const byRole = new Map<string, number>();
    hotels.forEach((h) => byRole.set(h.role, (byRole.get(h.role) ?? 0) + 1));
    return { total, active, byRole };
  }, [hotels]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleSwitch(hotelId: string, hotelName: string) {
    if (activeHotel?.hotelId === hotelId) {
      notify('Cet hôtel est déjà actif');
      return;
    }
    setSwitching(hotelId);
    setError(null);
    try {
      await switchHotel(hotelId);
      audit({
        action: 'hotel_switched',
        module: 'security_backups',
        detail: `Bascule vers ${hotelName}`,
        meta: { fromHotelId: activeHotel?.hotelId ?? null, toHotelId: hotelId, hotelName },
      });
      notify(`Hôtel actif : ${hotelName}`);
    } catch (err) {
      const msg = (err as Error).message || 'Échec du basculement';
      setError(msg);
    } finally {
      setSwitching(null);
    }
  }

  // ─── Loading / vide ────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement des hôtels accessibles…
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || hotels.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10 space-y-4">
          <SettingsPageHeader
            icon={Globe}
            category="Établissement"
            title="Multi-hôtels"
            description="Établissements accessibles à votre compte."
          />
          <div className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/60 px-4 py-3 text-[12.5px] text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Aucun hôtel accessible</div>
              <div className="text-amber-700/90 mt-0.5">
                Connectez-vous pour voir les hôtels rattachés à votre compte. Si vous êtes connecté
                mais ne voyez rien, vérifiez votre profil dans <code>public.users</code> et vos
                rattachements dans <code>user_hotels</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Globe}
          category="Établissement"
          title="Multi-hôtels"
          description="Établissements connectés au groupe. Sélectionnez l'hôtel actif pour basculer le tenant."
        />

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SettingsMetric label="Hôtels accessibles" value={String(stats.total)} caption="Lus depuis Supabase" />
          <SettingsMetric label="Hôtel actif" value={activeHotel?.name ?? '—'} caption={activeHotel?.city ?? ''} tone={activeHotel ? 'emerald' : 'slate'} />
          <SettingsMetric label="Rôles distincts" value={String(stats.byRole.size)} caption={[...stats.byRole.entries()].map(([r, c]) => `${r} (${c})`).join(' · ')} />
          <SettingsMetric label="Tenant ID" value={session?.tenantId ? session.tenantId.slice(0, 8) + '…' : '—'} caption="Identifiant interne" />
        </div>

        {error && (
          <div className="rounded-xl ring-1 ring-rose-100 bg-rose-50/60 px-4 py-3 text-[12.5px] text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Hôtel</th>
                <th className="px-3 py-2.5 font-medium">Ville / Pays</th>
                <th className="px-3 py-2.5 font-medium">Mon rôle</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 font-medium text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((h) => {
                const isActive = h.isActive;
                const isDefault = h.isDefault;
                const isLoading = switching === h.hotelId;
                return (
                  <tr key={h.hotelId} className={cn('border-t border-slate-100', isActive ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60')}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                        )}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                            {h.name}
                            {isDefault && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">Défaut</span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-400 font-mono truncate">{h.hotelId.slice(0, 13)}…</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 text-[12.5px]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {h.city ?? '?'}{h.country ? `, ${h.country}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold uppercase bg-violet-50 text-violet-700 ring-violet-200">
                        {h.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Disponible
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isActive ? (
                        <span className="text-[11.5px] text-emerald-700 font-medium">— en cours —</span>
                      ) : (
                        <button
                          onClick={() => handleSwitch(h.hotelId, h.name)}
                          disabled={isLoading || isSwitchingHotel}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[12px] font-medium ring-1 inline-flex items-center gap-1.5',
                            isLoading || isSwitchingHotel
                              ? 'bg-slate-100 text-slate-500 ring-slate-200 cursor-wait'
                              : 'bg-violet-600 text-white ring-violet-600 hover:bg-violet-700',
                          )}
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                          {isLoading ? 'Bascule…' : 'Basculer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <Phase2Notice>
          <strong>À venir :</strong> ajout de nouveaux hôtels au compte (provisioning) via la page Utilisateurs / Invitations.
        </Phase2Notice>

        <SettingsToast message={toast} />
      </div>
    </div>
  );
};

// ─── Timezone ─────────────────────────────────────────────────────────────

const STORAGE_TZ = 'flowtym.timezone';

interface TimezoneConfig {
  timezone: string;
  dateFormat: string;
  timeFormat: '24h' | '12h';
  weekStart: 'monday' | 'sunday';
}

const DEFAULT_TZ: TimezoneConfig = { timezone: 'Europe/Paris', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', weekStart: 'monday' };

const COMMON_TZ = [
  'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai',
  'Pacific/Auckland', 'UTC',
];

export const TimezonePage: React.FC = () => {
  const [cfg, setCfg] = useState<TimezoneConfig>(() => {
    try { return { ...DEFAULT_TZ, ...JSON.parse(localStorage.getItem(STORAGE_TZ) || '{}') }; } catch { return DEFAULT_TZ; }
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_TZ, JSON.stringify(cfg)); }, [cfg]);

  function handleSave() {
    localStorage.setItem(STORAGE_TZ, JSON.stringify(cfg));
    logAudit({ action: 'module_inspected', detail: `Fuseau horaire : ${cfg.timezone}` });
    setToast('Fuseau enregistré');
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Timer}
          category="Établissement"
          title="Fuseaux horaires"
          description="Fuseau de l'établissement, formats de date et heure, jour de début de semaine."
          action={<button onClick={handleSave} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Enregistrer</button>}
        />

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <SettingsMetric label="Fuseau" value={cfg.timezone} caption="Référence horaire" />
          <SettingsMetric label="Heure locale" value={new Date().toLocaleTimeString('fr-FR', { timeZone: cfg.timezone })} caption="Maintenant" tone="emerald" />
          <SettingsMetric label="Décalage UTC" value={`${new Date().toLocaleTimeString('en', { timeZone: cfg.timezone, timeZoneName: 'shortOffset' }).split(' ').pop()}`} caption="Vs UTC" tone="slate" />
        </div>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
          <FormField label="Fuseau horaire">
            <select value={cfg.timezone} onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono">
              {COMMON_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Format date">
              <select value={cfg.dateFormat} onChange={(e) => setCfg({ ...cfg, dateFormat: e.target.value })} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono">
                <option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option><option>DD MMMM YYYY</option>
              </select>
            </FormField>
            <FormField label="Format heure">
              <select value={cfg.timeFormat} onChange={(e) => setCfg({ ...cfg, timeFormat: e.target.value as '24h' | '12h' })} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                <option value="24h">24h</option><option value="12h">12h AM/PM</option>
              </select>
            </FormField>
            <FormField label="Début de semaine">
              <select value={cfg.weekStart} onChange={(e) => setCfg({ ...cfg, weekStart: e.target.value as 'monday' | 'sunday' })} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                <option value="monday">Lundi</option><option value="sunday">Dimanche</option>
              </select>
            </FormField>
          </div>
        </section>

        <Phase2Notice>Phase 2 : application au planning, RMS, rapports et exports comptables.</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

// ─── Contact ──────────────────────────────────────────────────────────────

interface ContactItem extends GenericListItem {
  role: 'reception' | 'gm' | 'sales' | 'accounting' | 'maintenance' | 'press';
  phone: string;
  email: string;
}

export const ContactPage: React.FC = () => (
  <GenericListPage<ContactItem>
    icon={MapPin}
    category="Établissement"
    title="Coordonnées"
    description="Points de contact internes et externes de l'établissement."
    storageKey="flowtym.contacts"
    module="pms_reservations"
    defaults={[
      { id: 'rec', label: 'Réception 24/7',   code: 'REC', active: true, role: 'reception',  phone: '+33 1 23 45 67 89', email: 'reception@hotel.fr' },
      { id: 'gm',  label: 'Direction',        code: 'GM',  active: true, role: 'gm',         phone: '+33 1 23 45 67 90', email: 'direction@hotel.fr' },
      { id: 'com', label: 'Service commercial', code: 'COM', active: true, role: 'sales',     phone: '+33 1 23 45 67 91', email: 'commercial@hotel.fr' },
      { id: 'cpt', label: 'Comptabilité',     code: 'CPT', active: true, role: 'accounting', phone: '+33 1 23 45 67 92', email: 'compta@hotel.fr' },
    ]}
    extraColumns={[
      { header: 'Fonction', render: (it) => <span className="capitalize">{it.role}</span> },
      { header: 'Téléphone', render: (it) => <span className="font-mono text-[11.5px]">{it.phone}</span> },
      { header: 'Email', render: (it) => <a href={`mailto:${it.email}`} className="text-violet-600 hover:underline">{it.email}</a> },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Rôle</span>
          <select value={item.role} onChange={(e) => set({ role: e.target.value as ContactItem['role'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="reception">Réception</option><option value="gm">Direction</option><option value="sales">Commercial</option><option value="accounting">Comptabilité</option><option value="maintenance">Maintenance</option><option value="press">Presse</option>
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Téléphone</span>
            <input type="tel" value={item.phone} onChange={(e) => set({ phone: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Email</span>
            <input type="email" value={item.email} onChange={(e) => set({ email: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, role: 'reception', phone: '', email: '' })}
    capability="set_hotel"
    supabaseSync
    phase2="annuaire automatique sur le portail client + carte de visite digitale."
  />
);

// ─── Documents légaux ─────────────────────────────────────────────────────

interface LegalDocItem extends GenericListItem {
  category: 'kbis' | 'license' | 'insurance' | 'safety' | 'other';
  fileUrl: string;
  expiryDate: string;
}

export const LegalDocsPage: React.FC = () => (
  <GenericListPage<LegalDocItem>
    icon={FileText}
    category="Établissement"
    title="Documents légaux"
    description="Pièces administratives obligatoires : K-bis, licences, assurances, attestations sécurité."
    storageKey="flowtym.legal_docs"
    module="pms_reservations"
    defaults={[]}
    extraColumns={[
      { header: 'Type', render: (it) => <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] font-semibold uppercase">{it.category}</span> },
      { header: 'Expiration', render: (it) => {
        const days = Math.round((new Date(it.expiryDate).getTime() - Date.now()) / 86_400_000);
        const tone = days < 0 ? 'text-rose-700' : days < 30 ? 'text-amber-700' : 'text-slate-700';
        return <span className={`tabular-nums ${tone}`}>{new Date(it.expiryDate).toLocaleDateString('fr-FR')}{days < 30 && ` (${days}j)`}</span>;
      } },
    ]}
    extraFormFields={(item, set) => (
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
          <select value={item.category} onChange={(e) => set({ category: e.target.value as LegalDocItem['category'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
            <option value="kbis">K-bis</option><option value="license">Licence</option><option value="insurance">Assurance</option><option value="safety">Sécurité</option><option value="other">Autre</option>
          </select></label>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Date expiration</span>
          <input type="date" value={item.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        <label className="block col-span-2"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">URL du fichier</span>
          <input type="url" value={item.fileUrl} onChange={(e) => set({ fileUrl: e.target.value })} placeholder="https://…/kbis.pdf" className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" /></label>
      </div>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, category: 'other', fileUrl: '', expiryDate: new Date().toISOString().slice(0, 10) })}
    capability="set_hotel"
    supabaseSync
    phase2="upload sécurisé + rappels automatiques 90/30 jours avant expiration."
  />
);

// ─── Photos & médias ──────────────────────────────────────────────────────

interface PhotoItem extends GenericListItem {
  url: string;
  category: 'exterior' | 'lobby' | 'room' | 'restaurant' | 'spa' | 'other';
  order: number;
}

export const PhotosPage: React.FC = () => (
  <GenericListPage<PhotoItem>
    icon={ImageIcon}
    category="Établissement"
    title="Photos & médias"
    description="Bibliothèque photo de l'établissement — distribuée aux OTAs et au portail client."
    storageKey="flowtym.photos"
    module="pms_reservations"
    defaults={[
      { id: 'p1', label: 'Façade soir',     code: 'EXT1', active: true, url: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600', category: 'exterior',  order: 1 },
      { id: 'p2', label: 'Lobby principal', code: 'LBY',  active: true, url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600', category: 'lobby',     order: 2 },
      { id: 'p3', label: 'Chambre Deluxe',  code: 'DLX',  active: true, url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600', category: 'room',      order: 3 },
      { id: 'p4', label: 'Salle restaurant',code: 'RST',  active: true, url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600', category: 'restaurant', order: 4 },
    ]}
    extraColumns={[
      { header: 'Catégorie', render: (it) => <span className="capitalize text-slate-700">{it.category}</span> },
      { header: 'Ordre', render: (it) => <span className="font-semibold tabular-nums">#{it.order}</span> },
      { header: 'Aperçu', render: (it) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={it.url} className="w-12 h-9 object-cover rounded ring-1 ring-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) },
    ]}
    extraFormFields={(item, set) => (
      <>
        <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">URL image</span>
          <input type="url" value={item.url} onChange={(e) => set({ url: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Catégorie</span>
            <select value={item.category} onChange={(e) => set({ category: e.target.value as PhotoItem['category'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="exterior">Extérieur</option><option value="lobby">Lobby</option><option value="room">Chambre</option><option value="restaurant">Restaurant</option><option value="spa">SPA</option><option value="other">Autre</option>
            </select></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Ordre d'affichage</span>
            <input type="number" min={1} value={item.order} onChange={(e) => set({ order: parseInt(e.target.value) || 1 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
        </div>
      </>
    )}
    emptyItem={() => ({ id: '', label: '', code: '', active: true, url: '', category: 'other', order: 99 })}
    capability="set_hotel"
    supabaseSync
    phase2="upload direct + recadrage + push OTAs / CMS portail client."
  />
);

// ─── Classement hôtelier ──────────────────────────────────────────────────

const CLASSIFICATION_KEY = 'flowtym.classification';

interface ClassificationConfig {
  stars: number;
  certifications: string[];
  awards: string[];
  greenLabel: 'none' | 'cle_verte' | 'green_globe' | 'ecolabel';
}

const DEFAULT_CLASS: ClassificationConfig = {
  stars: 4,
  certifications: ['Atout France 4★', 'Conforme RGPD'],
  awards: [],
  greenLabel: 'cle_verte',
};

export const ClassificationPage: React.FC = () => {
  const [cfg, setCfg] = useState<ClassificationConfig>(() => {
    try { return { ...DEFAULT_CLASS, ...JSON.parse(localStorage.getItem(CLASSIFICATION_KEY) || '{}') }; } catch { return DEFAULT_CLASS; }
  });
  const [newCert, setNewCert] = useState('');
  const [newAward, setNewAward] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(CLASSIFICATION_KEY, JSON.stringify(cfg)); }, [cfg]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader icon={Star} category="Établissement" title="Classement hôtelier" description="Étoiles, certifications, prix et labels écologiques." />

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
          <FormField label="Classement officiel">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => { setCfg({ ...cfg, stars: n }); notify(`Classement ${n}★`); }}
                  className={`w-10 h-10 rounded-xl ring-1 ${cfg.stars >= n ? 'bg-amber-100 text-amber-600 ring-amber-300' : 'bg-slate-50 text-slate-300 ring-slate-200'}`}>
                  <Star className={`w-5 h-5 mx-auto ${cfg.stars >= n ? 'fill-amber-500' : ''}`} />
                </button>
              ))}
              <span className="text-[13px] font-semibold text-slate-700 ml-2">{cfg.stars}{' '}étoile{cfg.stars > 1 ? 's' : ''}</span>
            </div>
          </FormField>

          <FormField label="Label écologique">
            <select value={cfg.greenLabel} onChange={(e) => setCfg({ ...cfg, greenLabel: e.target.value as ClassificationConfig['greenLabel'] })} className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="none">Aucun</option>
              <option value="cle_verte">Clé Verte</option>
              <option value="green_globe">Green Globe</option>
              <option value="ecolabel">EU Ecolabel</option>
            </select>
          </FormField>

          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Certifications</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cfg.certifications.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 text-[11.5px] font-medium">
                  {c}
                  <button onClick={() => setCfg({ ...cfg, certifications: cfg.certifications.filter((_, x) => x !== i) })} className="text-violet-400 hover:text-rose-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newCert} onChange={(e) => setNewCert(e.target.value)} placeholder="Nouvelle certification…" className="flex-1 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12.5px]" onKeyDown={(e) => e.key === 'Enter' && newCert.trim() && (setCfg({ ...cfg, certifications: [...cfg.certifications, newCert.trim()] }), setNewCert(''))} />
              <button onClick={() => newCert.trim() && (setCfg({ ...cfg, certifications: [...cfg.certifications, newCert.trim()] }), setNewCert(''))}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12.5px] font-medium hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Prix & distinctions</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cfg.awards.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[11.5px] font-medium">
                  {a}
                  <button onClick={() => setCfg({ ...cfg, awards: cfg.awards.filter((_, x) => x !== i) })} className="text-amber-400 hover:text-rose-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {cfg.awards.length === 0 && <span className="text-[12px] text-slate-400 italic">Aucune distinction enregistrée.</span>}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newAward} onChange={(e) => setNewAward(e.target.value)} placeholder="Nouvelle distinction…" className="flex-1 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12.5px]" />
              <button onClick={() => newAward.trim() && (setCfg({ ...cfg, awards: [...cfg.awards, newAward.trim()] }), setNewAward(''))}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12.5px] font-medium hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </section>

        <Phase2Notice>Phase 2 : affichage automatique sur OTA + portail + footer email + facture.</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

// ─── Compliance ──────────────────────────────────────────────────────────

export const CompliancePage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader icon={ShieldCheck} category="Établissement" title="Conformité" description="Vue d'ensemble multi-dimensions des obligations légales : RGPD, fiscalité, sécurité." />
        <div className="grid gap-4 md:grid-cols-3">
          <Link icon={ShieldCheck} title="RGPD" desc="Checklist UE 15 items pondérés" target="settings_rgpd" />
          <Link icon={FileText} title="Documents légaux" desc="K-bis, licences, assurances, ERP" target="settings_legal_docs" />
          <Link icon={Star} title="Classement hôtelier" desc="Étoiles + labels écologiques" target="settings_classification" />
          <Link icon={CheckCircle2} title="Fiscalité 2026" desc="PPF / PDP / Factur-X" target="settings_fiscal" />
          <Link icon={AlertCircle} title="Taxes locales" desc="TVA + taxe de séjour" target="settings_taxes_local" />
          <Link icon={ExternalLink} title="Audit" desc="Journal complet des actions" target="settings_audit" />
        </div>
        <Phase2Notice>Phase 2 : score global de conformité multi-dimensions + alerte automatique avant expiration des documents.</Phase2Notice>
      </div>
    </div>
  );
};

const Link: React.FC<{ icon: any; title: string; desc: string; target: string }> = ({ icon: Icon, title, desc, target }) => (
  <button
    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: target } }))}
    className="text-left rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4 hover:ring-violet-200 hover:shadow-md transition-all"
  >
    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center">
      <Icon className="w-4 h-4" />
    </div>
    <div className="mt-3 text-[13px] font-semibold text-slate-900">{title}</div>
    <div className="text-[11.5px] text-slate-500 mt-0.5">{desc}</div>
    <div className="mt-3 text-[11.5px] text-violet-600 font-medium inline-flex items-center gap-1">
      Ouvrir <ExternalLink className="w-3 h-3" />
    </div>
  </button>
);
