import React from 'react';
import {
  Search,
  Filter,
  UserPlus,
  Download,
  Mail,
  Phone,
  Briefcase,
  Users,
  Crown,
  Star,
  Medal,
  Gem,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Table2,
  LayoutGrid,
  BarChart3,
  ChevronRight,
  X,
} from 'lucide-react';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { useGuests, useCreateGuest } from '@/src/domains/guests/hooks';
import { ClientProfile360 } from '@/src/pages/clients/ClientProfile360';
import { ClientsKanban } from '@/src/pages/clients/ClientsKanban';
import { ClientsAnalytics } from '@/src/pages/clients/ClientsAnalytics';

type ViewMode = 'table' | 'kanban' | 'analytic';

const LOYALTY_CONFIG: Record<string, { label: string; icon: React.ReactNode; colors: string }> = {
  Platinum: { label: 'Platinum', icon: <Gem size={14} fill="currentColor" />,   colors: 'bg-blue-100 text-blue-600' },
  Gold:     { label: 'Gold',     icon: <Crown size={14} fill="currentColor" />, colors: 'bg-amber-100 text-amber-600' },
  Silver:   { label: 'Argent',   icon: <Star size={14} fill="currentColor" />,  colors: 'bg-gray-100 text-gray-500' },
  Standard: { label: 'Standard', icon: <Medal size={14} />,                     colors: 'bg-[#8B5CF6]/10 text-[#8B5CF6]' },
};

const SEGMENT_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  Business: { icon: <Briefcase size={14} />, label: 'Business' },
  Leisure:  { icon: <Users size={14} />,     label: 'Leisure' },
  VIP:      { icon: <Crown size={14} />,     label: 'VIP' },
};

const VIEW_MODES: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'table',    label: 'Tableau',    icon: Table2 },
  { key: 'kanban',   label: 'Kanban',     icon: LayoutGrid },
  { key: 'analytic', label: 'Analytique', icon: BarChart3 },
];

export const ClientsView = () => {
  const [searchQuery,   setSearchQuery]   = React.useState('');
  const [segmentFilter, setSegmentFilter] = React.useState('ALL');
  const [loyaltyFilter, setLoyaltyFilter] = React.useState('ALL');
  const [countryFilter, setCountryFilter] = React.useState('ALL');
  const [viewMode,      setViewMode]      = React.useState<ViewMode>('table');
  const [selectedId,    setSelectedId]    = React.useState<string | null>(null);
  const [showNewGuest,  setShowNewGuest]  = React.useState(false);
  const [guestDraft,    setGuestDraft]    = React.useState({ fullName: '', email: '', phone: '', segment: '' });
  const createGuest = useCreateGuest();

  const guestsQ = useGuests({
    limit:   200,
    search:  searchQuery,
    segment: segmentFilter,
    loyalty: loyaltyFilter,
    country: countryFilter,
  });

  const guests = guestsQ.data?.rows ?? [];
  const totalClients = guestsQ.data?.total ?? guests.length;

  const loyaltyCount = guests.filter(
    (g) => g.loyalty_level && g.loyalty_level !== 'Standard',
  ).length;
  const loyaltyRate = totalClients > 0 ? Math.round((loyaltyCount / totalClients) * 100) : 0;

  const clvAvg =
    guests.length > 0
      ? Math.round(guests.reduce((s, g) => s + (g.total_spent ?? 0), 0) / guests.length)
      : 0;

  const vipCount = guests.filter((g) => g.vip || g.loyalty_level === 'Platinum').length;

  const stats = [
    { label: 'Clients totaux',  value: String(totalClients),                       sub: `${guests.length} affichés`,         icon: Users, bg: 'bg-[#8B5CF6]/10', color: 'text-[#8B5CF6]' },
    { label: 'Taux de fidélité',value: `${loyaltyRate}%`,                           sub: `${loyaltyCount} clients fidélisés`, icon: Star,  bg: 'bg-emerald-50',   color: 'text-emerald-500' },
    { label: 'CLV moyen',       value: `${clvAvg.toLocaleString('fr-FR')} €`,       sub: 'Calculé sur total_spent réel',      icon: Crown, bg: 'bg-amber-50',     color: 'text-amber-500' },
    { label: 'VIP / Platinum',  value: String(vipCount),                            sub: 'Clients VIP ou Platinum',           icon: Gem,   bg: 'bg-blue-50',      color: 'text-blue-500' },
  ];

  const getLoyaltyCfg = (level: string | null) =>
    LOYALTY_CONFIG[level ?? 'Standard'] ?? LOYALTY_CONFIG.Standard;
  const getSegmentCfg = (seg: string | null) =>
    SEGMENT_CONFIG[seg ?? 'Leisure'] ?? { icon: <Users size={14} />, label: seg ?? '—' };

  const guestInitials = (g: { first_name?: string | null; last_name: string }) =>
    [g.first_name, g.last_name].filter(Boolean).map((n) => n![0].toUpperCase()).join('');
  const guestFullName = (g: { first_name?: string | null; last_name: string }) =>
    [g.first_name, g.last_name].filter(Boolean).join(' ') || g.last_name;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Fiches Clients</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            {guestsQ.isLoading
              ? 'Chargement des clients...'
              : `${totalClients.toLocaleString('fr-FR')} clients — base enrichie depuis les réservations`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white">
            <Download size={14} /> Exporter
          </Button>
          <Button className="gap-2 shadow-lg shadow-[#8B5CF6]/20" onClick={() => { setGuestDraft({ fullName: '', email: '', phone: '', segment: '' }); setShowNewGuest(true); }}>
            <UserPlus size={16} /> Nouveau client
          </Button>
        </div>
      </div>

      {guestsQ.isError && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">
            Impossible de charger les clients pour le moment.
          </p>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className={cn('p-2.5 rounded-xl', s.bg, s.color)}>
                <s.icon size={20} />
              </div>
              <Badge variant={s.color.includes('emerald') ? 'success' : 'neutral'} className="text-[10px] py-0.5">
                Réel
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-gray-900 leading-none">{s.value}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{s.label}</div>
              <p className={cn('text-xs font-bold mt-2', s.color.includes('emerald') ? 'text-emerald-500' : 'text-gray-400')}>
                {s.sub}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter + view-mode toolbar */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-[#8B5CF6] outline-none w-64"
                placeholder="Nom, email, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <FilterSelect
                value={segmentFilter}
                onChange={setSegmentFilter}
                placeholder="Segments"
                options={[
                  ['ALL', 'Tous segments'],
                  ['Leisure', 'Leisure'],
                  ['Business', 'Business'],
                  ['VIP', 'VIP'],
                ]}
              />
              <FilterSelect
                value={loyaltyFilter}
                onChange={setLoyaltyFilter}
                placeholder="Fidélité"
                display={(v) => LOYALTY_CONFIG[v]?.label ?? v}
                options={[
                  ['ALL', 'Toute fidélité'],
                  ['Standard', 'Standard'],
                  ['Silver', 'Argent'],
                  ['Gold', 'Or'],
                  ['Platinum', 'Platinum'],
                ]}
              />
              <FilterSelect
                value={countryFilter}
                onChange={setCountryFilter}
                placeholder="Pays"
                options={[
                  ['ALL', 'Tous pays'],
                  ['FR', 'France'],
                  ['GB', 'UK'],
                  ['US', 'USA'],
                  ['DE', 'Allemagne'],
                  ['ES', 'Espagne'],
                ]}
              />
              <Button variant="outline" size="sm" className="font-bold gap-2 focus:ring-1 focus:ring-[#8B5CF6]">
                <Filter size={14} /> Filtres
              </Button>
            </div>
          </div>

          {/* View-mode switcher */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl p-0.5">
            {VIEW_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                  viewMode === m.key
                    ? 'bg-white text-[#8B5CF6] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <m.icon size={13} />
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>

        {/* TABLE MODE */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-gray-100">
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Fidélité / Segment</th>
                  <th className="px-6 py-4">Statuts</th>
                  <th className="px-6 py-4">Dernière maj.</th>
                  <th className="px-6 py-4 text-right">CA total</th>
                  <th className="px-6 py-4 text-center">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guests.map((g) => {
                  const loyaltyCfg = getLoyaltyCfg(g.loyalty_level);
                  const segCfg     = getSegmentCfg(g.segment);
                  return (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedId(g.id)}
                      className="hover:bg-[#8B5CF6]/[0.03] transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center font-bold text-[#8B5CF6] text-xs">
                            {guestInitials(g)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm group-hover:text-[#8B5CF6] transition-colors">
                              {guestFullName(g)}
                            </span>
                            <span className="text-xs text-gray-400 font-medium mt-0.5">
                              {g.total_stays ?? 0} séjour{(g.total_stays ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Mail size={12} className="text-[#8B5CF6]" />
                            <span className="text-[13px] font-medium">{g.email || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <Phone size={12} />
                            <span className="text-[13px] font-medium">{g.phone || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', loyaltyCfg.colors)}>
                            {loyaltyCfg.icon}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-gray-600">{loyaltyCfg.label}</span>
                            <div className="flex items-center gap-1 text-gray-400">
                              {segCfg.icon}
                              <span className="text-xs font-bold uppercase">{segCfg.label}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex gap-1 flex-wrap">
                          {g.vip && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              <Sparkles size={9} /> VIP
                            </span>
                          )}
                          {g.blacklisted && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                              <ShieldAlert size={9} /> Blacklist
                            </span>
                          )}
                          {g.gdpr_consent && (
                            <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">
                              RGPD ✓
                            </span>
                          )}
                          {!g.vip && !g.blacklisted && !g.gdpr_consent && (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-gray-400 text-sm">
                        {g.updated_at ? new Date(g.updated_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-gray-900 text-sm">
                        {(g.total_spent ?? 0).toLocaleString('fr-FR')} €
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex p-2 text-gray-300 group-hover:text-[#8B5CF6] group-hover:bg-[#8B5CF6]/10 rounded-xl transition-colors">
                          <ChevronRight size={18} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {guestsQ.isLoading && (
                  <tr><td className="px-6 py-8 text-sm text-gray-400" colSpan={7}>Chargement des clients...</td></tr>
                )}
                {!guestsQ.isLoading && guests.length === 0 && (
                  <tr><td className="px-6 py-8 text-sm text-gray-500" colSpan={7}>Aucun client trouvé avec ces filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* KANBAN / ANALYTIC MODE */}
        {viewMode !== 'table' && (
          <div className="p-6">
            {guestsQ.isLoading ? (
              <p className="text-sm text-gray-400">Chargement des clients...</p>
            ) : guests.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun client trouvé avec ces filtres.</p>
            ) : viewMode === 'kanban' ? (
              <ClientsKanban guests={guests} onSelect={setSelectedId} />
            ) : (
              <ClientsAnalytics guests={guests} />
            )}
          </div>
        )}
      </Card>

      {/* 360° profile drawer */}
      <ClientProfile360 guestId={selectedId} onClose={() => setSelectedId(null)} />

      {/* ── Nouveau client modal ────────────────────────────────────── */}
      {showNewGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                  <UserPlus size={15} className="text-[#8B5CF6]" />
                </div>
                <h3 className="font-bold text-gray-900 text-[14px]">Nouveau client</h3>
              </div>
              <button onClick={() => setShowNewGuest(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Nom complet *', key: 'fullName', type: 'text', placeholder: 'Prénom Nom' },
                { label: 'Email',         key: 'email',    type: 'email', placeholder: 'client@email.com' },
                { label: 'Téléphone',     key: 'phone',    type: 'tel', placeholder: '+33 6 …' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(guestDraft as any)[f.key]}
                    onChange={e => setGuestDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-900 outline-none focus:border-[#8B5CF6] transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Segment</label>
                <select
                  value={guestDraft.segment}
                  onChange={e => setGuestDraft(d => ({ ...d, segment: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 bg-white outline-none focus:border-[#8B5CF6] transition-colors"
                >
                  <option value="">— Choisir —</option>
                  <option value="Business">Business</option>
                  <option value="Leisure">Leisure</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
              {createGuest.isError && (
                <p className="text-[12px] text-red-500 font-medium">{createGuest.error?.message ?? 'Erreur lors de la création'}</p>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                disabled={!guestDraft.fullName.trim() || createGuest.isPending}
                onClick={async () => {
                  try {
                    await createGuest.mutateAsync({
                      fullName:    guestDraft.fullName,
                      email:       guestDraft.email   || undefined,
                      phone:       guestDraft.phone   || undefined,
                      segment:     guestDraft.segment || undefined,
                    });
                    setShowNewGuest(false);
                  } catch {
                    // error shown above
                  }
                }}
              >
                {createGuest.isPending ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Création…</>
                ) : (
                  <><UserPlus size={14} />Créer le client</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowNewGuest(false)} disabled={createGuest.isPending}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Filter select ──────────────────────────────────────────────────────────

const FilterSelect = ({
  value, onChange, options, placeholder, display,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  placeholder: string;
  display?: (v: string) => string;
}) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative">
    <select
      className="absolute inset-0 opacity-0 cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
    <span className="text-xs font-bold text-gray-500">
      {value === 'ALL' ? placeholder : display ? display(value) : value}
    </span>
    <ArrowRight size={10} className="text-gray-300" />
  </div>
);

export default ClientsView;
