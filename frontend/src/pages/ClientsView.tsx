import React from 'react';
import {
  Search,
  Filter,
  UserPlus,
  Download,
  MoreHorizontal,
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
} from 'lucide-react';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { useGuests } from '@/src/domains/guests/hooks';

// Loyalty DB values → display config
const LOYALTY_CONFIG: Record<string, { label: string; icon: React.ReactNode; colors: string }> = {
  Platinum: {
    label: 'Platinum',
    icon: <Gem size={14} fill="currentColor" />,
    colors: 'bg-blue-100 text-blue-600',
  },
  Gold: {
    label: 'Gold',
    icon: <Crown size={14} fill="currentColor" />,
    colors: 'bg-amber-100 text-amber-600',
  },
  Silver: {
    label: 'Argent',
    icon: <Star size={14} fill="currentColor" />,
    colors: 'bg-gray-100 text-gray-500',
  },
  Standard: {
    label: 'Standard',
    icon: <Medal size={14} />,
    colors: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
  },
};

const SEGMENT_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  Business: { icon: <Briefcase size={14} />,  label: 'Business' },
  Leisure:  { icon: <Users size={14} />,      label: 'Leisure' },
  VIP:      { icon: <Crown size={14} />,      label: 'VIP' },
};

export const ClientsView = () => {
  const [searchQuery,   setSearchQuery]   = React.useState('');
  const [segmentFilter, setSegmentFilter] = React.useState('ALL');
  const [loyaltyFilter, setLoyaltyFilter] = React.useState('ALL');
  const [countryFilter, setCountryFilter] = React.useState('ALL');

  const guestsQ = useGuests({
    limit:   200,
    search:  searchQuery,
    // Pass DB values directly — repository maps them correctly
    segment: segmentFilter,
    loyalty: loyaltyFilter,
    country: countryFilter,
  });

  const guests = guestsQ.data?.rows ?? [];
  const totalClients = guestsQ.data?.total ?? guests.length;

  const loyaltyCount = guests.filter(
    (g) => g.loyalty_level && g.loyalty_level !== 'Standard',
  ).length;
  const loyaltyRate =
    totalClients > 0 ? Math.round((loyaltyCount / totalClients) * 100) : 0;

  const clvAvg =
    guests.length > 0
      ? Math.round(
          guests.reduce((s, g) => s + (g.total_spent ?? 0), 0) / guests.length,
        )
      : 0;

  const vipCount = guests.filter((g) => g.vip || g.loyalty_level === 'Platinum').length;

  const stats = [
    {
      label: 'Clients totaux',
      value: String(totalClients),
      sub: `${guests.length} affichés`,
      icon: Users,
      bg: 'bg-[#8B5CF6]/10',
      color: 'text-[#8B5CF6]',
    },
    {
      label: 'Taux de fidélité',
      value: `${loyaltyRate}%`,
      sub: `${loyaltyCount} clients fidélisés`,
      icon: Star,
      bg: 'bg-emerald-50',
      color: 'text-emerald-500',
    },
    {
      label: 'CLV moyen',
      value: `${clvAvg.toLocaleString('fr-FR')} €`,
      sub: 'Calculé sur total_spent réel',
      icon: Crown,
      bg: 'bg-amber-50',
      color: 'text-amber-500',
    },
    {
      label: 'VIP / Platinum',
      value: String(vipCount),
      sub: 'Clients VIP ou Platinum',
      icon: Gem,
      bg: 'bg-blue-50',
      color: 'text-blue-500',
    },
  ];

  const topClients = [...guests]
    .sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0))
    .slice(0, 5);

  const recentClients = [...guests].slice(0, 4);

  const getLoyaltyCfg = (level: string | null) =>
    LOYALTY_CONFIG[level ?? 'Standard'] ?? LOYALTY_CONFIG.Standard;

  const getSegmentCfg = (seg: string | null) =>
    SEGMENT_CONFIG[seg ?? 'Leisure'] ?? { icon: <Users size={14} />, label: seg ?? '—' };

  const guestInitials = (g: { first_name?: string | null; last_name: string }) =>
    [g.first_name, g.last_name]
      .filter(Boolean)
      .map((n) => n![0].toUpperCase())
      .join('');

  const guestFullName = (g: { first_name?: string | null; last_name: string }) =>
    [g.first_name, g.last_name].filter(Boolean).join(' ') || g.last_name;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB]">
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
          <Button className="gap-2 shadow-lg shadow-[#8B5CF6]/20">
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
              <Badge
                variant={s.color.includes('emerald') ? 'success' : 'neutral'}
                className="text-[10px] py-0.5"
              >
                Réel
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-gray-900 leading-none">{s.value}</div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {s.label}
              </div>
              <p className={cn('text-[10px] font-bold mt-2', s.color.includes('emerald') ? 'text-emerald-500' : 'text-gray-400')}>
                {s.sub}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Table with filters */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-[#8B5CF6] outline-none w-72"
                placeholder="Nom, email, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Segment filter — DB values */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative">
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                >
                  <option value="ALL">Tous segments</option>
                  <option value="Leisure">Leisure</option>
                  <option value="Business">Business</option>
                  <option value="VIP">VIP</option>
                </select>
                <span className="text-[11px] font-bold text-gray-400">
                  {segmentFilter === 'ALL' ? 'Segments' : segmentFilter}
                </span>
                <ArrowRight size={10} className="text-gray-300" />
              </div>

              {/* Loyalty filter — DB values: Gold / Silver / Platinum / Standard */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative">
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={loyaltyFilter}
                  onChange={(e) => setLoyaltyFilter(e.target.value)}
                >
                  <option value="ALL">Toute fidélité</option>
                  <option value="Standard">Standard</option>
                  <option value="Silver">Argent</option>
                  <option value="Gold">Or</option>
                  <option value="Platinum">Platinum</option>
                </select>
                <span className="text-[11px] font-bold text-gray-400">
                  {loyaltyFilter === 'ALL' ? 'Fidélité' : LOYALTY_CONFIG[loyaltyFilter]?.label ?? loyaltyFilter}
                </span>
                <ArrowRight size={10} className="text-gray-300" />
              </div>

              {/* Country filter */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative">
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                >
                  <option value="ALL">Tous pays</option>
                  <option value="FR">France</option>
                  <option value="GB">UK</option>
                  <option value="US">USA</option>
                  <option value="DE">Allemagne</option>
                  <option value="ES">Espagne</option>
                </select>
                <span className="text-[11px] font-bold text-gray-400">
                  {countryFilter === 'ALL' ? 'Pays' : countryFilter}
                </span>
                <ArrowRight size={10} className="text-gray-300" />
              </div>

              <Button variant="outline" size="sm" className="font-bold gap-2 focus:ring-1 focus:ring-[#8B5CF6]">
                <Filter size={14} /> Filtres
              </Button>
            </div>
          </div>
          <Badge variant="neutral" className="font-bold">
            {guests.length} / {totalClients} affichés
          </Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-gray-100">
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Fidélité / Segment</th>
                <th className="px-6 py-4">Statuts</th>
                <th className="px-6 py-4">Dernière maj.</th>
                <th className="px-6 py-4 text-right">CA total</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {guests.map((g) => {
                const loyaltyCfg = getLoyaltyCfg(g.loyalty_level);
                const segCfg     = getSegmentCfg(g.segment);
                const initials   = guestInitials(g);
                const fullName   = guestFullName(g);
                const isVip      = g.vip === true;
                const isBlacklisted = g.blacklisted === true;

                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center font-bold text-[#8B5CF6] text-xs">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 text-[13px]">{fullName}</span>
                          <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                            {g.total_stays ?? 0} séjour{(g.total_stays ?? 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 min-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Mail size={12} className="text-[#8B5CF6]" />
                          <span className="text-[11px] font-medium">{g.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                          <Phone size={12} />
                          <span className="text-[11px] font-medium">{g.phone || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', loyaltyCfg.colors)}>
                          {loyaltyCfg.icon}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-gray-600">{loyaltyCfg.label}</span>
                          <div className="flex items-center gap-1 text-gray-400">
                            {segCfg.icon}
                            <span className="text-[10px] font-bold uppercase">{segCfg.label}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-1 flex-wrap">
                        {isVip && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            <Sparkles size={9} /> VIP
                          </span>
                        )}
                        {isBlacklisted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                            <ShieldAlert size={9} /> Blacklist
                          </span>
                        )}
                        {g.gdpr_consent && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">
                            RGPD ✓
                          </span>
                        )}
                        {!isVip && !isBlacklisted && !g.gdpr_consent && (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-gray-400 text-[13px]">
                      {g.updated_at
                        ? new Date(g.updated_at).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-gray-900 text-[13px]">
                      {(g.total_spent ?? 0).toLocaleString('fr-FR')} €
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        type="button"
                        className="p-2 hover:bg-[#8B5CF6]/10 text-gray-400 hover:text-[#8B5CF6] rounded-xl transition-colors"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {guestsQ.isLoading && (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-400" colSpan={7}>
                    Chargement des clients...
                  </td>
                </tr>
              )}
              {!guestsQ.isLoading && guests.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-500" colSpan={7}>
                    Aucun client trouvé avec ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top clients by spend */}
        <Card className="p-6">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center justify-between">
            Top clients (par CA)
            <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">Voir tout</span>
          </h3>
          <div className="space-y-4">
            {topClients.map((g, i) => {
              const name = guestFullName(g);
              const spent = g.total_spent ?? 0;
              const maxSpent = topClients[0]?.total_spent ?? 1;
              return (
                <div key={g.id} className="flex items-center gap-4 group">
                  <div className="text-xs font-bold text-gray-300 w-4">{i + 1}</div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-900">
                    {guestInitials(g)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-gray-900">{name}</div>
                    <div className="w-full bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#8B5CF6]"
                        style={{ width: `${Math.round((spent / Math.max(maxSpent, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-[#8B5CF6]">
                    {spent.toLocaleString('fr-FR')} €
                  </div>
                </div>
              );
            })}
            {topClients.length === 0 && (
              <p className="text-sm text-gray-400">Aucune donnée disponible.</p>
            )}
          </div>
        </Card>

        {/* Recent clients */}
        <Card className="p-6">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center justify-between">
            Clients récents
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Récents</span>
          </h3>
          <div className="space-y-4">
            {recentClients.map((g, i) => (
              <div key={g.id} className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-white',
                    i % 2 === 0 ? 'bg-[#8B5CF6]' : 'bg-emerald-500',
                  )}
                >
                  {guestInitials(g)}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-gray-900">{guestFullName(g)}</div>
                  <div className="text-[11px] text-gray-400">
                    {g.total_stays ?? 0} séjour{(g.total_stays ?? 0) !== 1 ? 's' : ''} · {g.country ?? '—'}
                  </div>
                </div>
                <Badge variant="info" className="text-[9px] py-0">
                  {g.loyalty_level ?? 'Standard'}
                </Badge>
              </div>
            ))}
            {recentClients.length === 0 && (
              <p className="text-sm text-gray-400">Aucune donnée disponible.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ClientsView;
