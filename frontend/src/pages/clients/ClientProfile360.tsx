/**
 * FLOWTYM — Client 360° Profile (Wave C2)
 *
 * Drawer latéral présentant la fiche client complète :
 * KPIs réels, historique, saisonnalité, séjours, identité.
 * Alimenté par le RPC crm_guest_profile_360.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Mail, Phone, MessageCircle, MapPin, Globe, Calendar, CreditCard,
  TrendingUp, Moon, Clock, UserX, XCircle, Crown, Gem, Star, Medal,
  Sparkles, ShieldAlert, BedDouble, ArrowDownRight, ArrowUpRight,
  Briefcase, FileText, Languages, Cake, Loader2, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell,
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { useGuestProfile360 } from '@/src/domains/guests/hooks';
import type { GuestProfile360, HistoryEntry } from '@/src/services/crm/crm.service';
import { CommunicationTimeline } from '@/src/components/communication/CommunicationTimeline';

/** Section "Journal des communications" repliée par défaut (chargée à l'ouverture). */
const GuestTimelineSection: React.FC<{ guestId: string }> = ({ guestId }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
      >
        <span>Journal des communications</span>
        <span className="text-[9px] font-semibold text-violet-500">{open ? 'Réduire' : 'Afficher'}</span>
      </button>
      {open && (
        <div className="max-h-[420px]">
          <CommunicationTimeline
            scope={{ guestId }}
            enabled={open}
            title="Historique"
            className="h-[420px]"
          />
        </div>
      )}
    </section>
  );
};

const MONTHS_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

const LOYALTY_VISUAL: Record<string, { icon: React.ReactNode; colors: string; label: string }> = {
  Platinum: { icon: <Gem size={13} fill="currentColor" />,   colors: 'bg-blue-100 text-blue-600',   label: 'Platinum' },
  Gold:     { icon: <Crown size={13} fill="currentColor" />, colors: 'bg-amber-100 text-amber-600', label: 'Gold' },
  Silver:   { icon: <Star size={13} fill="currentColor" />,  colors: 'bg-gray-100 text-gray-500',   label: 'Argent' },
  Standard: { icon: <Medal size={13} />,                     colors: 'bg-[#8B5CF6]/10 text-[#8B5CF6]', label: 'Standard' },
};

const RISK_VISUAL: Record<string, { colors: string; label: string }> = {
  low:    { colors: 'bg-emerald-50 text-emerald-600', label: 'Risque faible' },
  medium: { colors: 'bg-amber-50 text-amber-600',     label: 'Risque modéré' },
  high:   { colors: 'bg-red-50 text-red-600',         label: 'Risque élevé' },
};

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── KPI tile ────────────────────────────────────────────────────────────────

const KpiTile = ({
  icon: Icon, label, value, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1.5">
    <div className={cn('flex items-center gap-1.5', accent ?? 'text-gray-400')}>
      <Icon size={13} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-lg font-bold text-gray-900 leading-none">{value}</span>
  </div>
);

// ─── Stay card ───────────────────────────────────────────────────────────────

const StayCard = ({
  title, stay, tone,
}: {
  title: string;
  stay: GuestProfile360['last_stay'];
  tone: 'past' | 'future';
}) => (
  <div className={cn(
    'rounded-xl p-3 border',
    tone === 'future' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-gray-50 border-gray-100',
  )}>
    <div className="flex items-center gap-1.5 mb-2">
      {tone === 'future'
        ? <ArrowUpRight size={12} className="text-emerald-500" />
        : <ArrowDownRight size={12} className="text-gray-400" />}
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{title}</span>
    </div>
    {stay ? (
      <>
        <div className="text-[13px] font-bold text-gray-900">
          {fmtDate(stay.check_in)} → {fmtDate(stay.check_out)}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
            <BedDouble size={11} /> {stay.room_number || '—'}
          </span>
          <span className="text-[12px] font-bold text-[#8B5CF6]">{fmtMoney(stay.total_amount)}</span>
        </div>
      </>
    ) : (
      <span className="text-[12px] text-gray-300 font-medium">Aucun séjour</span>
    )}
  </div>
);

// ─── History row ─────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  cancelled:   'bg-red-50 text-red-500',
  confirmed:   'bg-emerald-50 text-emerald-600',
  checked_in:  'bg-blue-50 text-blue-600',
  checked_out: 'bg-gray-100 text-gray-500',
};

const HistoryRow: React.FC<{ h: HistoryEntry }> = ({ h }) => (
  <tr className="border-b border-gray-50 last:border-0">
    <td className="py-2.5 pr-2">
      <div className="text-[11px] font-bold text-gray-900">{fmtDate(h.check_in)}</div>
      <div className="text-[10px] text-gray-400">{h.nights} nuit{h.nights > 1 ? 's' : ''}</div>
    </td>
    <td className="py-2.5 px-2 text-[11px] text-gray-500 font-medium">{h.room_number || '—'}</td>
    <td className="py-2.5 px-2">
      <span className={cn(
        'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase',
        STATUS_TONE[h.status] ?? 'bg-gray-100 text-gray-500',
      )}>
        {h.status}
      </span>
    </td>
    <td className="py-2.5 pl-2 text-right text-[11px] font-bold text-gray-900">
      {fmtMoney(h.total_amount)}
    </td>
  </tr>
);

// ─── Drawer body ─────────────────────────────────────────────────────────────

const ProfileBody = ({ profile }: { profile: GuestProfile360 }) => {
  const { guest, kpis } = profile;
  const fullName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || guest.last_name;
  const initials = [guest.first_name, guest.last_name]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('');
  const loyalty = LOYALTY_VISUAL[guest.loyalty_level ?? 'Standard'] ?? LOYALTY_VISUAL.Standard;
  const risk = RISK_VISUAL[guest.risk_level] ?? RISK_VISUAL.low;

  const seasonData = MONTHS_FR.map((m, i) => {
    const key = String(i + 1).padStart(2, '0');
    return { month: m, count: profile.seasonality[key] ?? 0 };
  });
  const maxSeason = Math.max(...seasonData.map((s) => s.count), 1);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="p-5 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white">
        <div className="flex items-start gap-4">
          {guest.photo_url ? (
            <img
              src={guest.photo_url}
              alt={fullName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold border-2 border-white/20">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate">{fullName}</h2>
            <div className="flex items-center gap-2 mt-1 text-white/70 text-[11px] font-medium">
              <Globe size={11} /> {guest.country || '—'}
              {guest.nationality && <span>· {guest.nationality}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', loyalty.colors)}>
                {loyalty.icon} {loyalty.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">
                {guest.segment || 'Leisure'}
              </span>
              {guest.vip && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/30 text-white">
                  <Sparkles size={10} /> VIP
                </span>
              )}
              {guest.blacklisted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/40 text-white">
                  <ShieldAlert size={10} /> Blacklist
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick contact */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <a
            href={guest.email ? `mailto:${guest.email}` : undefined}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-[11px] font-medium truncate"
          >
            <Mail size={12} className="shrink-0" /> <span className="truncate">{guest.email || '—'}</span>
          </a>
          <a
            href={guest.phone ? `tel:${guest.phone}` : undefined}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-[11px] font-medium truncate"
          >
            <Phone size={12} className="shrink-0" /> <span className="truncate">{guest.phone || '—'}</span>
          </a>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* KPIs */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
            Indicateurs clés
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <KpiTile icon={Moon}        label="Séjours"    value={String(kpis.total_stays)} accent="text-[#8B5CF6]" />
            <KpiTile icon={CreditCard}  label="CA total"   value={fmtMoney(kpis.total_revenue)} accent="text-emerald-500" />
            <KpiTile icon={TrendingUp}  label="ADR moyen"  value={fmtMoney(kpis.avg_adr)} accent="text-amber-500" />
            <KpiTile icon={BedDouble}   label="LOS moyen"  value={`${kpis.avg_los.toFixed(1)} n`} accent="text-blue-500" />
            <KpiTile icon={Clock}       label="Lead time"  value={`${Math.round(kpis.avg_lead_time_days)} j`} accent="text-gray-400" />
            <KpiTile icon={Calendar}    label="Réserv."    value={String(kpis.total_reservations)} accent="text-gray-400" />
            <KpiTile icon={UserX}       label="No-shows"   value={String(kpis.no_shows)} accent={kpis.no_shows > 0 ? 'text-red-500' : 'text-gray-400'} />
            <KpiTile icon={XCircle}     label="Annul."     value={String(kpis.cancellations)} accent={kpis.cancellations > 0 ? 'text-red-500' : 'text-gray-400'} />
          </div>
        </section>

        {/* Stays */}
        <section className="grid grid-cols-2 gap-3">
          <StayCard title="Dernier séjour" stay={profile.last_stay} tone="past" />
          <StayCard title="Prochain séjour" stay={profile.next_stay} tone="future" />
        </section>

        {/* Seasonality */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Saisonnalité
            </h3>
            {profile.favorite_source && (
              <span className="text-[10px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/8 px-2 py-0.5 rounded-full">
                Canal favori : {profile.favorite_source}
              </span>
            )}
          </div>
          {maxSeason > 1 ? (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 8, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {seasonData.map((s, i) => (
                      <Cell key={i} fill={s.count === maxSeason ? '#8B5CF6' : '#DDD6FE'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[11px] text-gray-300 font-medium">Données insuffisantes.</p>
          )}
        </section>

        {/* Journal des communications (L3) */}
        <GuestTimelineSection guestId={guest.id} />

        {/* Identity */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
            Identité & coordonnées
          </h3>
          <div className="space-y-1.5 text-[11px]">
            {guest.whatsapp && (
              <InfoRow icon={MessageCircle} label="WhatsApp" value={guest.whatsapp} />
            )}
            <InfoRow icon={Languages} label="Langue" value={guest.language || '—'} />
            <InfoRow icon={Cake} label="Naissance" value={fmtDate(guest.date_of_birth)} />
            <InfoRow icon={FileText} label="Passeport" value={guest.passport || '—'} />
            {guest.doc_expiry_date && (
              <InfoRow icon={AlertTriangle} label="Doc. expire" value={fmtDate(guest.doc_expiry_date)} />
            )}
            {guest.acquisition_source && (
              <InfoRow icon={Briefcase} label="Acquisition" value={guest.acquisition_source} />
            )}
            <InfoRow
              icon={MapPin}
              label="RGPD"
              value={guest.gdpr_consent ? `Consenti — ${fmtDate(guest.gdpr_date)}` : 'Non consenti'}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', risk.colors)}>
              {risk.label}
            </span>
            {guest.satisfaction_score != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                Satisfaction {guest.satisfaction_score}/10
              </span>
            )}
            {(guest.tags ?? []).map((t) => (
              <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B5CF6]/8 text-[#8B5CF6]">
                {t}
              </span>
            ))}
          </div>

          {guest.notes && (
            <p className="mt-3 text-[11px] text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
              {guest.notes}
            </p>
          )}
        </section>

        {/* History */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Historique des séjours
          </h3>
          {profile.history.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-300">
                  <th className="text-left pb-1.5 pr-2">Arrivée</th>
                  <th className="text-left pb-1.5 px-2">Chambre</th>
                  <th className="text-left pb-1.5 px-2">Statut</th>
                  <th className="text-right pb-1.5 pl-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {profile.history.map((h) => <HistoryRow key={h.id} h={h} />)}
              </tbody>
            </table>
          ) : (
            <p className="text-[11px] text-gray-300 font-medium">Aucun historique.</p>
          )}
        </section>
      </div>
    </div>
  );
};

const InfoRow = ({
  icon: Icon, label, value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-1.5 text-gray-400 font-medium">
      <Icon size={11} /> {label}
    </span>
    <span className="font-bold text-gray-700 text-right truncate max-w-[60%]">{value}</span>
  </div>
);

// ─── Public component ────────────────────────────────────────────────────────

export interface ClientProfile360Props {
  guestId: string | null;
  onClose: () => void;
}

export const ClientProfile360: React.FC<ClientProfile360Props> = ({ guestId, onClose }) => {
  const profileQ = useGuestProfile360(guestId);

  return (
    <AnimatePresence>
      {guestId && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Fiche client 360°
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {profileQ.isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 size={28} className="animate-spin text-[#8B5CF6]" />
                <span className="text-sm font-medium">Chargement de la fiche...</span>
              </div>
            )}

            {profileQ.isError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-500 p-6 text-center">
                <AlertTriangle size={28} />
                <span className="text-sm font-medium">
                  Impossible de charger la fiche client.
                </span>
              </div>
            )}

            {profileQ.data && <ProfileBody profile={profileQ.data} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default ClientProfile360;
