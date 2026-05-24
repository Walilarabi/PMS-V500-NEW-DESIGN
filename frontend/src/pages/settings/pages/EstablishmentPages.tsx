/**
 * FLOWTYM — Paramètres · Établissement (Multi-hôtels, Timezone, Contact,
 * LegalDocs, Photos, Classification, Compliance).
 */
import React, { useEffect, useState } from 'react';
import {
  Globe, Timer, MapPin, FileText, Image as ImageIcon, Star, ShieldCheck,
  Save, Plus, Trash2, ExternalLink, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import {
  GenericListPage, SettingsPageHeader, SettingsMetric, SettingsToast, Phase2Notice,
  FormField, type GenericListItem,
} from './_common';

// ─── Multi-hôtels ─────────────────────────────────────────────────────────

interface HotelEntry extends GenericListItem {
  city: string;
  country: string;
  roomsCount: number;
  status: 'active' | 'planned' | 'closed';
}

export const MultiHotelPage: React.FC = () => {
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelCity = useConfigStore((s) => s.hotel.city);
  const hotelCountry = useConfigStore((s) => s.hotel.country);
  return (
    <GenericListPage<HotelEntry>
      icon={Globe}
      category="Établissement"
      title="Multi-hôtels"
      description="Établissements connectés au groupe. L'hôtel courant est synchronisé avec votre profil."
      storageKey="flowtym.multi_hotel"
      module="pms_reservations"
      defaults={[
        { id: 'current', label: hotelName || 'Hôtel courant', code: 'CURR', active: true, city: hotelCity || 'Paris', country: hotelCountry || 'FR', roomsCount: 58, status: 'active' },
        { id: 'lyon', label: 'Hôtel Lyon Gare', code: 'LYO',  active: true, city: 'Lyon',     country: 'FR', roomsCount: 82, status: 'active' },
        { id: 'nice', label: 'Hôtel Nice Mer', code: 'NCE',  active: true, city: 'Nice',     country: 'FR', roomsCount: 120, status: 'active' },
      ]}
      extraColumns={[
        { header: 'Ville / Pays', render: (it) => `${it.city}, ${it.country}` },
        { header: 'Chambres', render: (it) => <span className="font-bold tabular-nums">{it.roomsCount}</span> },
        { header: 'Statut', render: (it) => {
          const colors = { active: 'bg-emerald-100 text-emerald-700', planned: 'bg-sky-100 text-sky-700', closed: 'bg-slate-100 text-slate-500' };
          return <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold uppercase ${colors[it.status]}`}>{it.status}</span>;
        } },
      ]}
      extraFormFields={(item, set) => (
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Ville</span>
            <input type="text" value={item.city} onChange={(e) => set({ city: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Pays</span>
            <input type="text" value={item.country} onChange={(e) => set({ country: e.target.value })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Chambres</span>
            <input type="number" min={0} value={item.roomsCount} onChange={(e) => set({ roomsCount: parseInt(e.target.value) || 0 })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" /></label>
          <label className="block"><span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Statut</span>
            <select value={item.status} onChange={(e) => set({ status: e.target.value as HotelEntry['status'] })} className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
              <option value="active">Actif</option><option value="planned">Planifié</option><option value="closed">Fermé</option>
            </select></label>
        </div>
      )}
      emptyItem={() => ({ id: '', label: '', code: '', active: true, city: '', country: 'FR', roomsCount: 0, status: 'planned' })}
      phase2="basculement multi-tenant Supabase RLS + synchronisation des paramètres mutualisables (rôles, conditions, taxes)."
    />
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
    defaults={[
      { id: 'kbis',     label: 'K-bis',                    code: 'KBIS', active: true, category: 'kbis',      fileUrl: '#', expiryDate: '2027-01-15' },
      { id: 'lic4',     label: 'Licence IV',               code: 'LIC4', active: true, category: 'license',   fileUrl: '#', expiryDate: '2028-06-30' },
      { id: 'assur',    label: 'Responsabilité civile',    code: 'RC',   active: true, category: 'insurance', fileUrl: '#', expiryDate: '2026-12-31' },
      { id: 'erp',      label: 'Commission sécurité ERP', code: 'ERP',  active: true, category: 'safety',    fileUrl: '#', expiryDate: '2026-09-30' },
    ]}
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
