import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, useReservations, CardexDocument } from '../../contexts/ReservationContext';
import { useConfigStore } from '../../store/configStore';
import { FileText, CreditCard, Users, AlertCircle, Search, Star, Award, X, Edit, Plus, Check, Printer, Mail, Save, ChevronDown, ChevronLeft, ChevronRight, Bed, Wine, Package, PlusCircle, Trash2, UploadCloud, Link as LinkIcon, History, TrendingUp, MapPin, Phone, Globe, Briefcase, Hash, Calendar, Shirt, Smartphone, File, Gem, MessageSquare, Reply, Share2, Tag, Box, Zap, Gift, Info, LogOut, MoreHorizontal, ArrowRight, RotateCcw, Clock, Scissors, Building2, BedDouble, Landmark } from 'lucide-react';
import { COUNTRIES, NatSelector, GUAR_ICONS, RATE_PLANS, GUAR_CFG, SEGMENTS } from './reservationConstants';
import { CHANNELS } from '../../constants/channels';
import { RefundModal } from '../billing/RefundModal';
import { CommunicationTimeline } from '@/src/components/communication/CommunicationTimeline';
import { useQuery } from '@tanstack/react-query';
import { resolveReservationRefIds } from '@/src/services/communication/timeline.service';

// ═══════════════════════════════════════════════════════════════════════════
// FLOWTYM — FICHE RÉSERVATION COMPLÈTE
// 7 onglets : Réservation · Facturation · Cardex · Incidents · Objets Oubliés
//             Avis · Fidélité ÉLITE STAY
// ═══════════════════════════════════════════════════════════════════════════

// ─── PROGRAMME FIDÉLITÉ — ÉLITE STAY ─────────────────────────────────────────
// Inspiré de Marriott Bonvoy · Accor Live Limitless · IHG One Rewards
// Règle : 10 points par Euro dépensé
// Conversion : 1 000 pts = 10 € de remise (taux 1%)
//
// Paliers :
// Bronze  : 0 – 4 999 pts   (membre)
// Silver  : 5 000 – 14 999  (après 1 séjour + 500 € dépensés)
// Gold    : 15 000 – 49 999  (fidèle récurrent)
// Platinum: ≥ 50 000          (VIP absolu — surclassement automatique)
//
// Avantages par palier :
// Bronze  : accumulation de base x1
// Silver  : bonus multiplicateur x1.25, late checkout 13h
// Gold    : bonus x1.5, surclassement si dispo, breakfast offert 1×/séjour
// Platinum: bonus x2, surclassement garanti, welcome amenity, lounge access

export interface EliteStayAccount {
  memberId: string;          // ES-XXXXX
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalPoints: number;       // cumul total tous temps
  availablePoints: number;   // points utilisables (non dépensés)
  lifetimeSpend: number;     // CA total depuis l'inscription en €
  memberSince: string;       // ISO date
  staysCount: number;        // nombre de séjours
  nightsCount: number;       // nombre de nuits cumulées
  transactions: LoyaltyTransaction[];
  redemptions: LoyaltyRedemption[];
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  type: 'earn' | 'bonus' | 'expire' | 'adjustment';
  points: number;
  description: string;
  reservationId?: string;
  amount?: number;           // montant €  ayant généré les points
}

export interface LoyaltyRedemption {
  id: string;
  date: string;
  pointsUsed: number;
  amountDiscount: number;   // remise en € obtenue
  reservationId: string;
  status: 'used' | 'pending' | 'cancelled';
}

// Incidents
export interface Incident {
  id: string;
  date: string;
  time: string;
  category: 'bruit' | 'proprete' | 'technique' | 'service' | 'securite' | 'autre';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolvedAt?: string;
  resolvedBy?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  guestNotified: boolean;
  compensation?: string;
}

// Objets oubliés
export interface LostItem {
  id: string;
  foundDate: string;
  foundLocation: string;
  description: string;
  category: 'vetement' | 'electronique' | 'document' | 'bijou' | 'autre';
  status: 'found' | 'claimed' | 'shipped' | 'donated' | 'disposed';
  claimedAt?: string;
  shippedAt?: string;
  trackingNumber?: string;
  photo?: string;
}

// Avis
export interface GuestReview {
  id: string;
  date: string;
  source: 'direct' | 'tripadvisor' | 'booking' | 'google' | 'expedia';
  overallScore: number;     // 1–10
  cleanliness?: number;
  comfort?: number;
  location?: number;
  service?: number;
  valueForMoney?: number;
  comment: string;
  response?: string;
  responseDate?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Cardex
export interface CardexEntry {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  room: string;
  nights: number;
  amount: number;
  canal: string;
  status: string;
  notes?: string;
  documents?: string[];
}

// ─── Constantes ────────────────────────────────────────────────────────────────
const POINTS_PER_EURO = 10;
const POINTS_TO_EURO = 1000;   // 1000 pts = 10 €  → taux 1%
const EURO_VALUE_PER_1000 = 10;

const TIER_CONFIG = {
  bronze:   { label: 'Bronze',   color: '#CD7F32', bg: '#FDF4E8', min: 0,     max: 4999,  multiplier: 1.0,  icon: '🥉' },
  silver:   { label: 'Silver',   color: '#94A3B8', bg: '#F8FAFC', min: 5000,  max: 14999, multiplier: 1.25, icon: '🥈' },
  gold:     { label: 'Gold',     color: '#F59E0B', bg: '#FFFBEB', min: 15000, max: 49999, multiplier: 1.5,  icon: '🥇' },
  platinum: { label: 'Platinum', color: '#8B5CF6', bg: '#EDE9FE', min: 50000, max: Infinity, multiplier: 2.0, icon: '💎' },
};

const TIER_BENEFITS: Record<string, string[]> = {
  bronze:   ['Accumulation 10 pts/€', 'Accès app membre', 'Newsletter offres exclusives'],
  silver:   ['Bonus x1.25 sur les points', 'Late checkout 13h00 (selon dispo)', 'Offres membre exclusives'],
  gold:     ['Bonus x1.5 sur les points', 'Surclassement si disponible', 'Petit-déjeuner offert 1×/séjour', 'Late checkout 14h00'],
  platinum: ['Bonus x2 sur les points', 'Surclassement garanti', 'Welcome amenity à l\'arrivée', 'Accès lounge', 'Butler service'],
};

const getTier = (pts: number): 'bronze' | 'silver' | 'gold' | 'platinum' => {
  if (pts >= 50000) return 'platinum';
  if (pts >= 15000) return 'gold';
  if (pts >= 5000)  return 'silver';
  return 'bronze';
};

const calcEarnedPoints = (amountEur: number, tier: string): number =>
  Math.floor(amountEur * POINTS_PER_EURO * (TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.multiplier || 1));

const calcRedeemValue = (points: number): number =>
  Math.floor(points / POINTS_TO_EURO) * EURO_VALUE_PER_1000;

const uid = () => crypto.randomUUID().slice(0, 8);
const TODAY = new Date().toISOString().split('T')[0];
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');
const fmtEuro = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const buildMockEliteStay = (reservations: any[], clientId?: string): EliteStayAccount => {
  const clientResas = reservations.filter(r => !clientId || r.client === clientId);
  const totalSpend = clientResas.reduce((s, r) => s + (r.totalAmount || r.totalTTC || 0), 0);
  const totalNights = clientResas.reduce((s, r) => s + (r.nights || 1), 0);
  const earnedPts = Math.floor(totalSpend * POINTS_PER_EURO * 1.25); // silver
  const tier = getTier(earnedPts);
  const memberId = `ES-${String(clientId || 'GUEST').substring(0,5).padStart(5, '0')}`;

  const transactions: LoyaltyTransaction[] = clientResas.flatMap(r => [
    {
      id: uid(), date: r.arrival || r.checkIn || TODAY, type: 'earn' as const,
      points: Math.floor((r.totalAmount || r.totalTTC || 0) * POINTS_PER_EURO),
      description: `Séjour — Ch. ${r.room} — ${r.nights || 1} nuit(s)`,
      reservationId: r.id, amount: r.totalAmount || r.totalTTC || 0,
    },
    ...((r.totalAmount || r.totalTTC || 0) > 200 ? [{
      id: uid(), date: r.departure || r.checkOut || TODAY, type: 'bonus' as const,
      points: Math.floor((r.totalAmount || r.totalTTC || 0) * POINTS_PER_EURO * 0.25),
      description: `Bonus Silver ×1.25 — ${r.id}`,
      reservationId: r.id,
    }] : []),
  ]);

  return {
    memberId, tier, totalPoints: earnedPts, availablePoints: Math.floor(earnedPts * 0.8),
    lifetimeSpend: totalSpend,
    memberSince: clientResas.length > 0 ? clientResas[clientResas.length - 1].checkIn : '',
    staysCount: clientResas.length, nightsCount: totalNights, transactions,
    redemptions: [],
  };
};

const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_LOST_ITEMS: LostItem[] = [];
const EMPTY_REVIEWS: GuestReview[] = [];

// ─── STYLES PARTAGÉS ─────────────────────────────────────────────────────────
const CARD = { background: 'white', borderRadius: 16, border: '1px solid #F1F5F9', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' } as const;
const LABEL = { fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 4, display: 'block' };
const VALUE = { fontSize: 13, fontWeight: 600, color: '#1E293B' };
const FIELD = { width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#F8FAFC', color: '#334155' } as const;
const BTN = (variant: 'primary' | 'ghost' | 'danger') => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  borderRadius: 10, border: variant === 'ghost' ? '1px solid #E2E8F0' : 'none',
  background: variant === 'primary' ? 'linear-gradient(135deg,#8B5CF6,#6D28D9)' : variant === 'danger' ? '#FEF2F2' : 'white',
  color: variant === 'primary' ? 'white' : variant === 'danger' ? '#DC2626' : '#64748B',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  boxShadow: variant === 'primary' ? '0 3px 10px rgba(139,92,246,.25)' : 'none',
} as const);

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Ico = {
  res:     <FileText size={16} />,
  bill:    <CreditCard size={16} />,
  cardex:  <Users size={16} />,
  incident:<AlertCircle size={16} />,
  lost:    <Search size={16} />,
  review:  <Star size={16} />,
  loyalty: <Award size={16} />,
  close:   <X size={16} />,
  edit:    <Edit size={13} />,
  plus:    <Plus size={13} />,
  check:   <Check size={13} />,
};

// ─── ONGLET 1 : RÉSERVATION (MODE AVANCÉ) ──────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

const TabReservation: React.FC<{ res: Reservation; onUpdate?: (updated: Reservation) => void }> = ({ res, onUpdate }) => {
  const { reservations } = useReservations();
  const configRooms = useConfigStore((s) => s.rooms);
  const roomList = configRooms.map(r => ({ number: r.number, type: [r.type, r.category].filter(Boolean).join(' '), price: r.price ?? 0 }));
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Computed Payment Status (Automatique, Read-Only)
  const autoPaymentStatus = useMemo(() => {
    const totalTTC = res.totalAmount || res.totalTTC || res.montant || 0;
    const solde = res.solde ?? totalTTC;
    const totalPaid = totalTTC - solde;
    if (totalTTC === 0) return 'En attente';
    if (totalPaid >= totalTTC) return 'Payé';
    if (totalPaid > 0) return 'Partiel';
    return 'En attente';
  }, [res.totalAmount, res.totalTTC, res.montant, res.solde]);

  const [editedRes, setEditedRes] = useState<any>({ 
    ...res,
    nationality: res.nationality || 'FR',
    nationalityLabel: 'France',
    boardType: res.mealPlan || 'Room Only',
    cancelPolicy: res.policy || 'flexible',
    paymentStatus: autoPaymentStatus,
    guaranteeType: 'cb'
  });

  React.useEffect(() => {
    if (!isEditing) {
      setEditedRes({ 
        ...res,
        nationality: res.nationality || 'FR',
        nationalityLabel: 'France',
        boardType: res.mealPlan || 'Room Only',
        cancelPolicy: res.policy || 'flexible',
        paymentStatus: autoPaymentStatus,
        guaranteeType: 'cb'
      });
    }
  }, [res, isEditing, autoPaymentStatus]);
  
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string>('');
  const [paymentLink, setPaymentLink] = useState('');
  const [newNote, setNewNote] = useState('');
  const [attachedDocs, setAttachedDocs] = useState<{name: string, size: number, type: string}[]>([]);

  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    confirmed:    { label: 'Confirmée',    color: '#2563EB', bg: '#EFF6FF' },
    pending:      { label: 'Brouillon',    color: '#D97706', bg: '#FFF7ED' },
    checked_in:   { label: 'En séjour',    color: '#059669', bg: '#ECFDF5' },
    checked_out:  { label: 'Départ',       color: '#64748B', bg: '#F8FAFC' },
    cancelled:    { label: 'Annulée',      color: '#DC2626', bg: '#FEF2F2' },
    no_show:      { label: 'No-Show',      color: '#9F1239', bg: '#FFF1F2' },
  };
  const st = statusColors[res.status] || statusColors.confirmed;

  // Filtrage Dynamique Chambres
  const availableRooms = useMemo(() => {
    const cin = new Date(editedRes.arrival || editedRes.checkIn).getTime();
    const cout = new Date(editedRes.departure || editedRes.checkOut).getTime();
    if (isNaN(cin) || isNaN(cout) || cin >= cout) return roomList;

    return roomList.filter(room => {
      // SI C'EST LA CHAMBRE DÉJÀ ATTRIBUÉE, ON LA GARDE TOUJOURS (même si le type a changé)
      if (String(room.number) === String(res.room)) return true;

      // Sinon, on filtre par type si sélectionné
      if (editedRes.roomType && room.type !== editedRes.roomType) return false;

      // Check Overlap
      const hasConflict = reservations.some(r => {
        if (r.id === res.id) return false;
        if (String(r.room) !== String(room.number)) return false;
        
        let resCin = new Date(r.arrival || r.checkIn || '').getTime();
        let resCout = new Date(r.departure || r.checkOut || '').getTime();
        
        if (isNaN(resCin) || isNaN(resCout)) {
           const matchCin = String(r.arrival).match(/^(\d{4}-\d{2}-\d{2})/);
           const matchCout = String(r.departure).match(/^(\d{4}-\d{2}-\d{2})/);
           if (matchCin) resCin = new Date(matchCin[1]).getTime();
           if (matchCout) resCout = new Date(matchCout[1]).getTime();
        }
        if (isNaN(resCin) || isNaN(resCout)) return false;
        return Math.max(cin, resCin) < Math.min(cout, resCout);
      });
      return !hasConflict;
    });
  }, [editedRes.arrival, editedRes.checkIn, editedRes.departure, editedRes.checkOut, editedRes.roomType, reservations, res.id, res.room]);

  // Si la chambre n'est plus dispo, la vider
  React.useEffect(() => {
    if (isEditing && editedRes.room && !availableRooms.find(r => r.number === editedRes.room)) {
       setEditedRes(prev => ({...prev, room: ''}));
    }
  }, [availableRooms, isEditing]);

  const handleAction = async (action: string, newStatus?: string) => {
    if (action === 'save') {
      // 1. Validation : Client obligatoire
      const clientName = editedRes.client || editedRes.guestName || '';
      if (!clientName.trim()) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Erreur : Le nom du client est obligatoire.', type: 'error' } }));
        return;
      }
      // 2. Validation : Disponibilité de la chambre
      if (editedRes.room && !availableRooms.find(r => r.number === editedRes.room)) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Conflit : La chambre ${editedRes.room} n'est pas disponible sur ces dates.`, type: 'error' } }));
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      let updated = { ...res };
      if (newStatus) updated.status = newStatus;
      
      if (action === 'save') {
        const updatedLogs = [...(res.logs || [])];
        
        // Génération automatique de l'Audit Log (Traçabilité)
        const changes = [];
        const oldArr = res.arrival || res.checkIn;
        const newArr = editedRes.arrival || editedRes.checkIn;
        if (oldArr !== newArr) changes.push(`Arrivée: ${oldArr} ➔ ${newArr}`);
        
        const oldDep = res.departure || res.checkOut;
        const newDep = editedRes.departure || editedRes.checkOut;
        if (oldDep !== newDep) changes.push(`Départ: ${oldDep} ➔ ${newDep}`);
        
        if (res.room !== editedRes.room) changes.push(`Chambre: ${res.room || 'Aucune'} ➔ ${editedRes.room || 'Aucune'}`);
        
        const oldClient = res.client || res.guestName;
        const newClient = editedRes.client || editedRes.guestName;
        if (oldClient !== newClient) changes.push(`Client: ${oldClient} ➔ ${newClient}`);
        
        if (changes.length > 0) {
          updatedLogs.push({
             timestamp: new Date().toISOString(),
             action: 'Modification système',
             userId: 'Admin (PMS)',
             after: changes.join(' | ')
          });
        }

        // Ajouter la note manuelle au log (Cardex)
        if (newNote.trim()) {
           updatedLogs.push({
             timestamp: new Date().toISOString(),
             action: 'Note manuelle',
             userId: 'Admin',
             after: newNote
           });
        }
        updated = { ...editedRes, logs: updatedLogs, paymentStatus: autoPaymentStatus };
        setIsEditing(false);
        setNewNote('');
      }
      if (onUpdate) onUpdate(updated);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Action '${action}' effectuée avec succès.` } }));
    }, 1000);
  };

  const handleConfirm = () => { if (window.confirm('Confirmer cette réservation ?')) handleAction('Confirmation', 'confirmed'); };
  const handleCancel = () => { if (window.confirm('Annuler cette réservation ?')) handleAction('Annulation', 'cancelled'); };

  const handleSendEmail = () => {
    setEmailStatus('loading');
    setTimeout(() => {
      setEmailStatus('success');
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Email envoyé avec succès.' } }));
      setTimeout(() => setShowEmailModal(false), 1500);
    }, 1500);
  };

  const generatePaymentLink = (processor: string) => {
     const ref = reservation?.reference ?? crypto.randomUUID().slice(0, 8).toUpperCase();
     setPaymentLink(`https://pay.flowtym.com/${processor.toLowerCase()}/${ref}`);
     window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Lien de paiement ${processor} généré` } }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length) {
      setAttachedDocs(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size, type: f.type }))]);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `${files.length} document(s) attaché(s)` } }));
    }
  };

  // Styles spécifiques
  const S_BLOCK = { ...CARD, display: 'flex', flexDirection: 'column', gap: 12 } as const;
  const S_LABEL = { fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase' as const, letterSpacing: '.5px' };
  const S_INPUT = { ...FIELD, padding: '10px 14px', fontSize: 13, fontWeight: 500, borderColor: isEditing ? '#C4B5FD' : 'transparent', background: isEditing ? '#fff' : '#F8FAFC', boxShadow: isEditing ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all .2s' };
  const S_SELECT = { ...S_INPUT, appearance: 'none' as const, cursor: isEditing ? 'pointer' : 'default' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* HEADER ACTIONS */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 100, background: st.bg, color: st.color, border: `1.5px solid ${st.color}30` }}>
          ● {st.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isEditing ? (
            <>
              <button onClick={() => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Génération du document...' }})); setTimeout(() => window.print(), 500); }} style={{ ...BTN('ghost'), padding: '8px', color: '#64748B' }} title="Imprimer la fiche"><Printer size={16} /></button>
              <button onClick={() => setShowEmailModal(true)} style={{ ...BTN('ghost'), padding: '8px', color: '#3B82F6', background: '#EFF6FF', borderColor: '#BFDBFE' }} title="Envoyer par email"><Mail size={16} /></button>
              {res.status !== 'confirmed' && <button onClick={handleConfirm} style={BTN('primary')}><Check size={14} /> Confirmer</button>}
              <button onClick={() => setIsEditing(true)} style={{ ...BTN('ghost'), color: '#8B5CF6', borderColor: '#C4B5FD', background: '#F5F3FF' }}><Edit size={14} /> Modifier</button>
              {res.status !== 'cancelled' && <button onClick={handleCancel} style={BTN('danger')}><X size={14} /> Annuler</button>}
            </>
          ) : (
            <>
              <button onClick={() => { setIsEditing(false); setEditedRes({...res}); }} style={BTN('ghost')}>Annuler</button>
              <button onClick={() => handleAction('save')} style={{ ...BTN('primary'), background: '#10B981', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }} disabled={isLoading}>
                {isLoading ? 'Sauvegarde...' : <><Save size={14} /> Enregistrer les modifications</>}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* BLOC CLIENT */}
        <div style={S_BLOCK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
            <Users size={16} color="#8B5CF6" /><span style={S_LABEL}>Client</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Nom complet</span><input type="text" value={editedRes.client || editedRes.guestName || ''} onChange={e => setEditedRes({...editedRes, client: e.target.value})} disabled={!isEditing} style={S_INPUT} /></div>
            <div style={{ flex: 1 }}><span style={LABEL}>Nationalité</span>
              {isEditing ? (
                <div style={{marginTop: 4}}><NatSelector code={editedRes.nationality} label={editedRes.nationalityLabel} onChange={(c, l) => setEditedRes({...editedRes, nationality: c, nationalityLabel: l})} /></div>
              ) : (
                <div style={S_INPUT}><img src={`https://flagcdn.com/w20/${editedRes.nationality.toLowerCase()}.png`} alt="flag" style={{width:16, marginRight: 8, verticalAlign: 'middle'}}/> {editedRes.nationalityLabel}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Email</span><input type="email" value={editedRes.email || ''} onChange={e => setEditedRes({...editedRes, email: e.target.value})} disabled={!isEditing} style={S_INPUT} /></div>
            <div style={{ flex: 1 }}><span style={LABEL}>Téléphone</span><input type="tel" value={editedRes.phone || ''} onChange={e => setEditedRes({...editedRes, phone: e.target.value})} disabled={!isEditing} style={S_INPUT} /></div>
          </div>
        </div>

        {/* BLOC SÉJOUR */}
        <div style={S_BLOCK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
            <Bed size={16} color="#8B5CF6" /><span style={S_LABEL}>Séjour</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Arrivée</span><input type="date" value={editedRes.arrival || editedRes.checkIn || ''} onChange={e => {
                const arr = e.target.value; setEditedRes({...editedRes, arrival: arr, checkIn: arr});
              }} disabled={!isEditing} style={S_INPUT} /></div>
            <div style={{ flex: 1 }}><span style={LABEL}>Départ</span><input type="date" value={editedRes.departure || editedRes.checkOut || ''} onChange={e => {
                const dep = e.target.value; setEditedRes({...editedRes, departure: dep, checkOut: dep});
              }} disabled={!isEditing} style={S_INPUT} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Type de chambre</span>
              <div style={{ position: 'relative' }}>
                <select value={editedRes.roomType || ''} onChange={e => setEditedRes({...editedRes, roomType: e.target.value})} disabled={!isEditing} style={S_SELECT}>
                  {['Simple','Double Classique','Double Supérieure','Twin','Suite Deluxe','Suite Panoramique','Familiale','Junior Suite'].map(t => <option key={t}>{t}</option>)}
                </select>
                {isEditing && <ChevronDown size={14} color="#8B5CF6" style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none' }}/>}
              </div>
            </div>
            <div style={{ flex: 1 }}><span style={LABEL}>Chambre (Dispo)</span>
              <div style={{ position: 'relative' }}>
                <select value={editedRes.room || ''} onChange={e => setEditedRes({...editedRes, room: e.target.value})} disabled={!isEditing} style={{...S_SELECT, borderColor: (isEditing && !editedRes.room) ? '#EF4444' : S_SELECT.borderColor }}>
                  <option value="">-- Sélectionner --</option>
                  {availableRooms.map(r => <option key={r.number} value={r.number}>{r.number} ({r.type})</option>)}
                </select>
                {isEditing && <ChevronDown size={14} color="#8B5CF6" style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none' }}/>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Type de pension</span>
              <select value={editedRes.boardType || 'Room Only'} onChange={e => setEditedRes({...editedRes, boardType: e.target.value})} disabled={!isEditing} style={S_SELECT}>
                {['Room Only','Petit-déjeuner','Demi-pension','Pension complète'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><span style={LABEL}>Conditions d'annulation</span>
              <select value={editedRes.cancelPolicy || 'flexible'} onChange={e => setEditedRes({...editedRes, cancelPolicy: e.target.value})} disabled={!isEditing} style={S_SELECT}>
                <option value="flexible">Flexible (72h)</option>
                <option value="modere">Modérée (48h)</option>
                <option value="stricte">Stricte (7j)</option>
                <option value="non_remboursable">Non remboursable</option>
              </select>
            </div>
          </div>
        </div>

        {/* BLOC PAIEMENT & GARANTIE */}
        <div style={S_BLOCK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
            <CreditCard size={16} color="#8B5CF6" /><span style={S_LABEL}>Paiement & Garantie</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Canal (Source)</span>
              <select value={editedRes.source || editedRes.channel || 'DIRECT'} onChange={e => setEditedRes({...editedRes, source: e.target.value})} disabled={!isEditing} style={S_SELECT}>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><span style={LABEL}>Mode de paiement</span>
              <select value={editedRes.paymentMode || 'Carte bancaire'} onChange={e => setEditedRes({...editedRes, paymentMode: e.target.value})} disabled={!isEditing} style={S_SELECT}>
                {['Carte bancaire','Espèces','Virement','Chèque','OTA (Expedia, Booking)'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={LABEL}>Garantie</span>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  {(['cb','virement','especes','paypal'] as const).map(type => (
                    <button key={type} disabled={!isEditing} onClick={() => setEditedRes({...editedRes, guaranteeType: type})} 
                      style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${editedRes.guaranteeType===type ? '#8B5CF6':'#E2E8F0'}`, background: editedRes.guaranteeType===type ? '#F5F3FF' : '#F8FAFC', color: editedRes.guaranteeType===type ? '#8B5CF6' : '#94A3B8', cursor: isEditing ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {GUAR_ICONS[type]}
                    </button>
                  ))}
               </div>
            </div>
            <div style={{ flex: 1 }}><span style={LABEL}>Statut du paiement</span>
              <div style={{ ...S_INPUT, display: 'flex', alignItems: 'center', height: 38, background: isEditing ? '#F8FAFC' : '#F8FAFC', cursor: 'not-allowed', color: autoPaymentStatus === 'Payé' ? '#10B981' : (autoPaymentStatus === 'Partiel' ? '#3B82F6' : '#D97706'), fontWeight: 700, borderColor: 'transparent' }}>
                {autoPaymentStatus === 'Payé' ? 'Payé (Solde 0)' : (autoPaymentStatus === 'Partiel' ? 'Partiellement payé' : 'Non payé / En attente')}
              </div>
            </div>
          </div>

          {/* Lien de Paiement Generator */}
          {isEditing && (
             <div style={{ marginTop: 8, padding: 12, background: '#F5F3FF', borderRadius: 12, border: '1.5px solid #EDE9FE' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><LinkIcon size={12}/> Générer un lien de paiement dynamique</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => generatePaymentLink('Stripe')} style={{ ...BTN('primary'), flex: 1, height: 36, background: '#6366F1' }}>Lien Stripe</button>
                  <button onClick={() => generatePaymentLink('PayPal')} style={{ ...BTN('primary'), flex: 1, height: 36, background: '#003087' }}>Lien PayPal</button>
                </div>
                {paymentLink && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fff', borderRadius: 8, border: '1px solid #C4B5FD', fontSize: 11, color: '#4C1D95', wordBreak: 'break-all', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {paymentLink}
                    <span style={{ padding: '2px 6px', background: '#FEF9C3', color: '#B45309', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>Envoyé</span>
                  </div>
                )}
             </div>
          )}
        </div>

        {/* BLOC DOCUMENTS & CARDEX */}
        <div style={S_BLOCK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
            <FileText size={16} color="#8B5CF6" /><span style={S_LABEL}>Documents & Cardex (Notes internes)</span>
          </div>
          
          {/* Notes internes avec historique */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={LABEL}>Ajouter au journal (Cardex)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Note, incident, préférence client..." value={newNote} onChange={e => setNewNote(e.target.value)} disabled={!isEditing} style={{ ...S_INPUT, flex: 1 }} />
            </div>
            
            <div style={{ padding: 8, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', height: 80, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(res.logs || []).map((log, i) => (
                <div key={i} style={{ fontSize: 11, color: '#475569' }}>
                  <span style={{ color: '#8B5CF6', fontWeight: 600 }}>{new Date(log.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span> · <strong>{log.userId}</strong> : {log.action} {log.after ? `"${log.after}"` : ''}
                </div>
              ))}
              {(!res.logs || res.logs.length === 0) && <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>Aucune note dans le Cardex</div>}
            </div>
          </div>

          {/* Upload Documents */}
          <div style={{ marginTop: 4 }}>
             <span style={LABEL}>Pièces jointes (CNI, Confirmations...)</span>
             {isEditing ? (
               <div style={{ position: 'relative', border: '2px dashed #C4B5FD', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F3FF', cursor: 'pointer', transition: 'all .2s' }}>
                 <UploadCloud size={20} color="#8B5CF6" style={{ marginBottom: 4 }} />
                 <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 500 }}>Glisser-déposer ou cliquer</span>
                 <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.html" onChange={handleFileUpload} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
               </div>
             ) : null}
             
             {attachedDocs.length > 0 && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                 {attachedDocs.map((doc, i) => (
                   <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                     <span style={{ fontSize: 11, color: '#334155', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{doc.name}</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <span style={{ fontSize: 10, color: '#94A3B8' }}>{(doc.size / 1024).toFixed(0)} kb</span>
                       {isEditing && <Trash2 size={12} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => setAttachedDocs(prev => prev.filter((_, idx) => idx !== i))} />}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Email Modal Overlay */}
      {showEmailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...CARD, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Envoyer un Email</span>
              <button onClick={() => setShowEmailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={LABEL}>Destinataire</span>
                <input type="email" defaultValue={editedRes.email || ''} style={{ ...FIELD, width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <span style={LABEL}>Objet</span>
                <input type="text" defaultValue={`Confirmation de votre séjour - ${res.id}`} style={{ ...FIELD, width: '100%', marginTop: 4 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="checkbox" id="attach_proforma" defaultChecked />
                <label htmlFor="attach_proforma" style={{ fontSize: 13, color: '#475569' }}>Joindre la facture proforma</label>
              </div>
              <button 
                onClick={handleSendEmail} 
                disabled={emailStatus === 'loading' || emailStatus === 'success'}
                style={{ ...BTN('primary'), marginTop: 12, justifyContent: 'center', background: emailStatus === 'success' ? '#10B981' : 'linear-gradient(135deg,#8B5CF6,#6D28D9)' }}
              >
                {emailStatus === 'loading' ? 'Envoi en cours...' : emailStatus === 'success' ? 'Envoyé ✓' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
// ─── FIN ONGLET 1 ─────────────────────────────────────────────────────────────

// ─── ONGLET 2 : FACTURATION (MULTI-FOLIO) ──────────────────────────────────
// ─── Audit Trail Types ───────────────────────────────────────────────────────
type AuditEntryType = 'LINE_ADD' | 'PAYMENT' | 'TRANSFER' | 'REFUND' | 'CREDIT_NOTE' | 'SPLIT' | 'DISCOUNT' | 'FOLIO_CREATE';
interface AuditEntry {
  id: string;
  type: AuditEntryType;
  ts: string;
  user: string;
  action: string;
  amount?: number;
  folioId?: string;
}

export interface InvoiceLine {
  id: string;
  date: string;
  desc: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number; // e.g. 0.10 for 10%
}

export interface Folio {
  id: string;
  name: string;
  payerType: 'client' | 'company';
  payerName: string;
  billingAddress: string;
  lines: InvoiceLine[];
  payments: number;
  paymentRecords: FolioPaymentRecord[];
}

interface FolioPaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
}

// ─── AUDIT COLOR MAP ─────────────────────────────────────────────────────────
const AUDIT_COLORS: Record<string, string> = {
  LINE_ADD: '#8B5CF6', PAYMENT: '#10B981', TRANSFER: '#3B82F6',
  REFUND: '#EF4444', CREDIT_NOTE: '#F97316', SPLIT: '#6366F1',
  DISCOUNT: '#F59E0B', FOLIO_CREATE: '#94A3B8',
};

// ─── BillingRightPanel ────────────────────────────────────────────────────────
function BillingRightPanel({ folios, res, auditLog, collapsed, onToggle }: {
  folios: Folio[]; res: Reservation; auditLog: AuditEntry[]; collapsed: boolean; onToggle: () => void;
}) {
  const fmtE = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  const calcTTC = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.unitPriceHT * l.qty * (1 + l.vatRate), 0);
  const globalTTC = folios.reduce((s, f) => s + calcTTC(f.lines), 0);
  const globalPaid = folios.reduce((s, f) => s + f.payments, 0);
  const globalSolde = globalTTC - globalPaid;
  const allLines = folios.flatMap(f => f.lines);
  const hasVAT = allLines.some(l => l.vatRate > 0);
  const hasTaxSejour = allLines.some(l => l.desc.toLowerCase().includes('taxe'));
  const hasPaid = globalPaid > 0 || globalTTC === 0;
  const isCoherent = globalTTC > 0;
  const alertCount = auditLog.filter(e => e.type === 'REFUND' || e.type === 'CREDIT_NOTE').length;
  const riskRatio = globalTTC > 0 ? (globalSolde / globalTTC) * 100 : 0;
  const risk = riskRatio < 20 ? { label: 'Faible', color: '#10B981', bg: '#ECFDF5' }
    : riskRatio < 60 ? { label: 'Modéré', color: '#F59E0B', bg: '#FFFBEB' }
    : { label: 'Élevé', color: '#EF4444', bg: '#FEF2F2' };
  const nights = (res as any).nights || 1;
  const panierMoyen = nights > 0 ? globalTTC / nights : 0;
  const staysCount = (res as any).staysCount || 1;
  const [section, setSection] = React.useState<'summary' | 'intelligence' | 'control'>('summary');

  if (collapsed) return (
    <div style={{ width: 28, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, borderLeft: '1px solid #E2E8F0', background: '#F8FAFC' }}>
      <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B5CF6', padding: 4 }} title="Ouvrir l'analyse financière"><ChevronLeft size={16} /></button>
      <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Analyse</div>
    </div>
  );

  return (
    <div style={{ width: 256, flexShrink: 0, borderLeft: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Analyse financière</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        {([['summary', 'Résumé'], ['intelligence', 'Intel.'], ['control', 'Contrôle']] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setSection(id)} style={{ flex: 1, padding: '7px 2px', fontSize: 9, fontWeight: 700, border: 'none', borderBottom: section === id ? '2px solid #8B5CF6' : '2px solid transparent', background: 'none', cursor: 'pointer', color: section === id ? '#8B5CF6' : '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lbl}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {section === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Total facturé', value: fmtE(globalTTC), color: '#1E293B' },
              { label: 'Total encaissé', value: fmtE(globalPaid), color: '#059669' },
              { label: 'Solde restant', value: fmtE(globalSolde), color: globalSolde > 0.01 ? '#DC2626' : '#059669' },
              { label: 'Acomptes', value: fmtE(globalPaid > 0 && globalSolde > 0.01 ? globalPaid : 0), color: '#6D28D9' },
              { label: 'Arrhes', value: fmtE((res as any).arrha || 0), color: '#475569' },
              { label: 'Préautorisations', value: 'N/A', color: '#94A3B8' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', background: '#fff', borderRadius: 7, border: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 10, color: '#64748B' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
        {section === 'intelligence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '8px 10px', background: risk.bg, borderRadius: 7, border: `1px solid ${risk.color}40` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>Risque d'impayé</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: risk.color }}>{risk.label}</div>
              <div style={{ fontSize: 10, color: risk.color, marginTop: 1 }}>{riskRatio.toFixed(0)}% reste dû</div>
            </div>
            <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>Historique client</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{staysCount === 1 ? '1er séjour' : `${staysCount} séjours`}</div>
            </div>
            <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>Panier moy. / nuit</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace' }}>{fmtE(panierMoyen)}</div>
            </div>
            <div style={{ padding: '8px 10px', background: '#EFF6FF', borderRadius: 7, border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Recommandations</div>
              {globalSolde > 0.01 && <div style={{ fontSize: 10, color: '#1E40AF', marginBottom: 3 }}>• Encaisser le solde de {fmtE(globalSolde)}</div>}
              {!hasTaxSejour && <div style={{ fontSize: 10, color: '#92400E', marginBottom: 3 }}>• Ajouter la taxe de séjour</div>}
              {staysCount > 1 && <div style={{ fontSize: 10, color: '#065F46', marginBottom: 3 }}>• Client fidèle — envisager remise</div>}
              {globalSolde <= 0.01 && hasTaxSejour && <div style={{ fontSize: 10, color: '#059669' }}>• Facture complète et soldée ✓</div>}
            </div>
          </div>
        )}
        {section === 'control' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'TVA vérifiée', ok: hasVAT },
              { label: 'Taxe de séjour', ok: hasTaxSejour },
              { label: 'Paiements vérifiés', ok: hasPaid },
              { label: 'Facture cohérente', ok: isCoherent },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', background: ok ? '#F0FDF4' : '#FFF1F2', borderRadius: 7, border: `1px solid ${ok ? '#BBF7D0' : '#FECDD3'}` }}>
                <span style={{ fontSize: 10, color: '#475569' }}>{label}</span>
                <span style={{ fontSize: 13 }}>{ok ? '✅' : '❌'}</span>
              </div>
            ))}
            {alertCount > 0 && (
              <div style={{ padding: '7px 8px', background: '#FFFBEB', borderRadius: 7, border: '1px solid #FDE68A', fontSize: 10, color: '#92400E' }}>
                ⚠️ {alertCount} alerte(s) (avoirs/remboursements)
              </div>
            )}
            {alertCount === 0 && allLines.length > 0 && <div style={{ padding: '7px 8px', background: '#F0FDF4', borderRadius: 7, border: '1px solid #BBF7D0', fontSize: 10, color: '#059669' }}>✅ Aucune alerte détectée</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FolioTimeline ────────────────────────────────────────────────────────────
function FolioTimeline({ entries }: { entries: AuditEntry[] }) {
  const [filter, setFilter] = React.useState<AuditEntryType | null>(null);
  const fmtE = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  const displayed = filter ? entries.filter(e => e.type === filter) : entries;
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 4, padding: '14px 18px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock size={14} color="#8B5CF6" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Timeline Financière</span>
          <span style={{ fontSize: 10, color: '#94A3B8', background: '#F1F5F9', padding: '1px 5px', borderRadius: 8 }}>{entries.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setFilter(null)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, border: '1px solid #E2E8F0', background: !filter ? '#8B5CF6' : '#fff', color: !filter ? '#fff' : '#64748B', cursor: 'pointer', fontWeight: 700 }}>Tout</button>
          {(['PAYMENT', 'TRANSFER', 'REFUND', 'LINE_ADD'] as AuditEntryType[]).map(t => (
            <button key={t} onClick={() => setFilter(f => f === t ? null : t)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, border: `1px solid ${AUDIT_COLORS[t]}50`, background: filter === t ? AUDIT_COLORS[t] : '#fff', color: filter === t ? '#fff' : AUDIT_COLORS[t], cursor: 'pointer', fontWeight: 700 }}>
              {t === 'PAYMENT' ? 'Paiement' : t === 'TRANSFER' ? 'Transfert' : t === 'REFUND' ? 'Remb.' : 'Ligne'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }}>
        {[...displayed].reverse().map((e, i, arr) => (
          <div key={e.id} style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: AUDIT_COLORS[e.type] || '#94A3B8', flexShrink: 0, marginTop: 3 }} />
              {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: '#F1F5F9', marginTop: 3, minHeight: 14 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 2 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{e.action}</span>
                {e.amount !== undefined && <span style={{ fontSize: 10, fontFamily: 'monospace', color: AUDIT_COLORS[e.type], fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{e.amount >= 0 ? '+' : ''}{fmtE(e.amount)}</span>}
              </div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{e.ts.replace('T', ' ').substring(0, 16)} · {e.user}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FolioTransferDialog ──────────────────────────────────────────────────────
type TransferDest = 'room' | 'reservation' | 'company' | 'group' | 'house_account';
function FolioTransferDialog({ isOpen, selectedLines, onClose, onConfirm }: {
  isOpen: boolean;
  selectedLines: number;
  onClose: () => void;
  onConfirm: (dest: TransferDest, target: string, reason: string) => void;
}) {
  const [dest, setDest] = React.useState<TransferDest>('room');
  const [target, setTarget] = React.useState('');
  const [reason, setReason] = React.useState('');
  React.useEffect(() => { if (isOpen) { setDest('room'); setTarget(''); setReason(''); } }, [isOpen]);
  if (!isOpen) return null;
  const DESTS: { id: TransferDest; label: string; icon: React.ReactNode; placeholder: string }[] = [
    { id: 'room', label: 'Autre chambre', icon: <BedDouble size={13} />, placeholder: 'Ex: 302' },
    { id: 'reservation', label: 'Autre réservation', icon: <FileText size={13} />, placeholder: 'Ex: RES-ABCD' },
    { id: 'company', label: 'Société', icon: <Building2 size={13} />, placeholder: 'Ex: Société SA' },
    { id: 'group', label: 'Groupe', icon: <Users size={13} />, placeholder: 'Ex: Groupe Conférence' },
    { id: 'house_account', label: 'Compte interne', icon: <Landmark size={13} />, placeholder: 'Direction / Commercial...' },
  ];
  const canConfirm = target.trim().length > 0 && reason.trim().length > 0;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRight size={16} color="#8B5CF6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#4C1D95' }}>Transférer {selectedLines} ligne(s)</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} color="#94A3B8" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destination</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DESTS.map(d => (
                <button key={d.id} onClick={() => { setDest(d.id); setTarget(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${dest === d.id ? '#8B5CF6' : '#E2E8F0'}`, background: dest === d.id ? '#F5F3FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ color: dest === d.id ? '#8B5CF6' : '#94A3B8' }}>{d.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: dest === d.id ? 700 : 500, color: dest === d.id ? '#6D28D9' : '#475569' }}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {DESTS.find(d => d.id === dest)?.label}
            </div>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder={DESTS.find(d => d.id === dest)?.placeholder} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Motif (obligatoire)</div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Frais à imputer sur la société cliente" rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={() => { if (canConfirm) { onConfirm(dest, target.trim(), reason.trim()); onClose(); } }} disabled={!canConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: canConfirm ? '#8B5CF6' : '#E2E8F0', color: canConfirm ? '#fff' : '#94A3B8', fontWeight: 700, fontSize: 13, cursor: canConfirm ? 'pointer' : 'default' }}>
              <ArrowRight size={13} style={{ marginRight: 6, display: 'inline' }} />Transférer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FolioSplitDialog ─────────────────────────────────────────────────────────
function FolioSplitDialog({ isOpen, folioName, totalTTC, lineCount, onClose, onConfirm }: {
  isOpen: boolean; folioName: string; totalTTC: number; lineCount: number;
  onClose: () => void; onConfirm: (mode: 'auto' | 'percent' | 'fixed', value: number) => void;
}) {
  const [mode, setMode] = React.useState<'auto' | 'percent' | 'fixed'>('auto');
  const [value, setValue] = React.useState(50);
  const fmtE = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  React.useEffect(() => { if (isOpen) { setMode('auto'); setValue(50); } }, [isOpen]);
  if (!isOpen) return null;
  const partA = mode === 'auto' ? totalTTC / 2 : mode === 'percent' ? totalTTC * value / 100 : Math.min(value, totalTTC);
  const partB = totalTTC - partA;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scissors size={16} color="#8B5CF6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#4C1D95' }}>Répartir {folioName}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} color="#94A3B8" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['auto', '50/50 Auto'], ['percent', '% personnalisé'], ['fixed', 'Montant fixe']] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: `1.5px solid ${mode === m ? '#8B5CF6' : '#E2E8F0'}`, background: mode === m ? '#F5F3FF' : '#fff', color: mode === m ? '#6D28D9' : '#64748B', fontWeight: mode === m ? 700 : 500, fontSize: 11, cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>
          {mode !== 'auto' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>{mode === 'percent' ? 'Partie A (%)' : 'Partie A (€)'}</div>
              <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} min={0} max={mode === 'percent' ? 100 : totalTTC} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Partie A', partA], ['Partie B', partB]].map(([lbl, amt]) => (
              <div key={String(lbl)} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#8B5CF6', fontFamily: 'monospace' }}>{fmtE(Number(amt))}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>~{Math.round(Number(amt) / totalTTC * lineCount)} ligne(s)</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={() => { onConfirm(mode, value); onClose(); }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Scissors size={13} style={{ marginRight: 6, display: 'inline' }} />Répartir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FolioAvoirDialog ─────────────────────────────────────────────────────────
function FolioAvoirDialog({ isOpen, maxAmount, onClose, onConfirm }: {
  isOpen: boolean; maxAmount: number; onClose: () => void; onConfirm: (amount: number, motif: string) => void;
}) {
  const [amount, setAmount] = React.useState(0);
  const [motif, setMotif] = React.useState('');
  const fmtE = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  React.useEffect(() => { if (isOpen) { setAmount(0); setMotif(''); } }, [isOpen]);
  if (!isOpen) return null;
  const canConfirm = amount > 0 && amount <= maxAmount + 0.01 && motif.trim().length > 0;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF7ED' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} color="#F97316" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#9A3412' }}>Créer un avoir</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} color="#94A3B8" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
            Maximum : {fmtE(maxAmount)} (total TTC du folio)
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Montant de l'avoir (€)</div>
            <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} min={0.01} max={maxAmount} step={0.01} placeholder="0.00" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${amount > maxAmount ? '#EF4444' : '#E2E8F0'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontWeight: 700 }} />
            {amount > maxAmount + 0.01 && <div style={{ fontSize: 10, color: '#EF4444', marginTop: 4 }}>Montant supérieur au total du folio</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Motif (obligatoire)</div>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Incident technique, remboursement partiel..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={() => { if (canConfirm) { onConfirm(amount, motif.trim()); onClose(); } }} disabled={!canConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: canConfirm ? '#F97316' : '#E2E8F0', color: canConfirm ? '#fff' : '#94A3B8', fontWeight: 700, fontSize: 13, cursor: canConfirm ? 'pointer' : 'default' }}>
              <RotateCcw size={13} style={{ marginRight: 6, display: 'inline' }} />Créer l'avoir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BillingActionsToolbar ────────────────────────────────────────────────────
function BillingActionsToolbar({ onTransfer, onSplit, onAvoir, onRefund, onHistory, selectedCount }: {
  onTransfer: () => void; onSplit: () => void; onAvoir: () => void; onRefund: () => void; onHistory: () => void; selectedCount: number;
}) {
  const [showTransferMenu, setShowTransferMenu] = React.useState(false);
  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap' };
  return (
    <div style={{ padding: '10px 18px', background: '#FAFBFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>Actions :</span>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowTransferMenu(v => !v)} style={{ ...btnBase, color: '#6D28D9', borderColor: '#C4B5FD', background: '#F5F3FF' }}>
          <ArrowRight size={12} /> Transférer <ChevronDown size={11} />
        </button>
        {showTransferMenu && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, marginTop: 4 }}>
            {[
              { label: 'Autre chambre', icon: <BedDouble size={12} /> },
              { label: 'Autre réservation', icon: <FileText size={12} /> },
              { label: 'Société', icon: <Building2 size={12} /> },
              { label: 'Groupe', icon: <Users size={12} /> },
              { label: 'Compte interne', icon: <Landmark size={12} /> },
            ].map(({ label, icon }) => (
              <button key={label} onClick={() => { setShowTransferMenu(false); onTransfer(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#334155', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span style={{ color: '#94A3B8' }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onSplit} style={{ ...btnBase, color: '#4F46E5', borderColor: '#C7D2FE' }}>
        <Scissors size={12} /> Répartir
      </button>
      <button onClick={onAvoir} style={{ ...btnBase, color: '#EA580C', borderColor: '#FED7AA' }}>
        <RotateCcw size={12} /> Créer un avoir
      </button>
      <button onClick={onRefund} style={{ ...btnBase, color: '#DC2626', borderColor: '#FECACA' }}>
        <RotateCcw size={12} style={{ transform: 'scaleX(-1)' }} /> Rembourser
      </button>
      <button onClick={onHistory} style={{ ...btnBase, marginLeft: 'auto', color: '#64748B' }}>
        <Clock size={12} /> Historique
      </button>
      {selectedCount > 0 && (
        <span style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 700, background: '#F5F3FF', padding: '3px 8px', borderRadius: 8, border: '1px solid #DDD6FE' }}>
          {selectedCount} ligne(s) sélectionnée(s)
        </span>
      )}
    </div>
  );
}

// ─── Invoice HTML Generator (opens in new tab for Aperçu / Impression) ───────
function buildInvoiceHTML(folio: Folio, res: Reservation, invoiceNumber: string): string {
  const fmtE = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  const calcTTC = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.unitPriceHT * l.qty * (1 + l.vatRate), 0);
  const calcHT = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.unitPriceHT * l.qty, 0);
  const ttc = calcTTC(folio.lines);
  const ht = calcHT(folio.lines);
  const vatBreakdown: Record<string, { ht: number; vat: number }> = {};
  folio.lines.forEach(l => {
    const key = (l.vatRate * 100).toFixed(0) + '%';
    if (!vatBreakdown[key]) vatBreakdown[key] = { ht: 0, vat: 0 };
    vatBreakdown[key].ht += l.unitPriceHT * l.qty;
    vatBreakdown[key].vat += l.unitPriceHT * l.qty * l.vatRate;
  });
  const solde = Math.max(0, ttc - folio.payments);
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const linesHTML = folio.lines.length > 0 ? folio.lines.map(l => `
    <tr>
      <td class="desc">${l.desc}</td>
      <td class="center">${l.date}</td>
      <td class="right">${l.qty}</td>
      <td class="right">${fmtE(l.unitPriceHT)}</td>
      <td class="right tva">${(l.vatRate * 100).toFixed(0)}%</td>
      <td class="right bold">${fmtE(l.unitPriceHT * l.qty * (1 + l.vatRate))}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">Aucune prestation</td></tr>';

  const vatRows = Object.entries(vatBreakdown).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).map(([rate, d]) => `
    <tr><td>${rate}</td><td class="right">${fmtE(d.ht)}</td><td class="right">${fmtE(d.vat)}</td></tr>`).join('');

  const paymentsHTML = folio.paymentRecords.length > 0
    ? folio.paymentRecords.map(p => `<tr class="paid"><td>Paiement reçu — ${p.method}</td><td class="right">${p.date}</td><td class="right">${fmtE(p.amount)}</td></tr>`).join('')
    : folio.payments > 0 ? `<tr class="paid"><td colspan="2">Paiement reçu</td><td class="right">${fmtE(folio.payments)}</td></tr>` : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Facture ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: white; }
  @page { size: A4 portrait; margin: 18mm 15mm 20mm 15mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }

  /* Print button */
  .no-print { display: flex; justify-content: center; gap: 12px; padding: 16px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; }
  .no-print button { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
  .btn-print { background: #8B5CF6; color: white; }
  .btn-close { background: #e9ecef; color: #495057; }

  /* Page */
  .page { max-width: 210mm; margin: 0 auto; padding: 0 2mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #8B5CF6; }
  .hotel-name { font-size: 20pt; font-weight: 900; color: #4C1D95; margin-bottom: 4px; letter-spacing: -0.5px; }
  .hotel-sub { font-size: 9pt; color: #555; line-height: 1.6; }
  .invoice-title { font-size: 26pt; font-weight: 900; color: #8B5CF6; margin-bottom: 6px; }
  .invoice-meta { font-size: 10pt; color: #333; line-height: 1.8; text-align: right; }
  .invoice-meta strong { color: #111; }

  /* Addresses */
  .addresses { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 24px; }
  .address-box { background: #f8f7ff; border: 1px solid #e0d9f7; border-radius: 8px; padding: 14px 16px; flex: 1; }
  .address-label { font-size: 8pt; font-weight: 700; color: #8B5CF6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .address-name { font-size: 11pt; font-weight: 700; color: #111; margin-bottom: 4px; }
  .address-text { font-size: 9.5pt; color: #444; line-height: 1.5; white-space: pre-wrap; }
  .reservation-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; }
  .res-label { font-size: 8pt; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .res-row { font-size: 9.5pt; color: #333; margin-bottom: 3px; }
  .res-row strong { color: #111; }

  /* Lines table */
  .table-title { font-size: 10pt; font-weight: 700; color: #4C1D95; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #8B5CF6; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
  table.lines thead tr { background: #4C1D95; color: white; }
  table.lines thead th { padding: 9px 8px; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; }
  table.lines tbody tr { border-bottom: 1px solid #f0f0f0; }
  table.lines tbody tr:nth-child(even) { background: #fafafa; }
  table.lines tbody td { padding: 8px; }
  table.lines .desc { font-weight: 600; }
  table.lines .center { text-align: center; color: #555; }
  table.lines .right { text-align: right; font-family: monospace; }
  table.lines .tva { color: #666; }
  table.lines .bold { font-weight: 700; color: #111; }
  table.lines .empty { text-align: center; font-style: italic; color: #888; padding: 20px; }

  /* Totals */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 320px; }
  .totals-box table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .totals-box td { padding: 6px 8px; }
  .totals-box .sub { color: #555; }
  .totals-box .vat-table { font-size: 9pt; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; width: 100%; border-collapse: collapse; }
  .totals-box .vat-table th { padding: 4px 6px; text-align: left; background: #f8f8f8; font-size: 8.5pt; color: #666; }
  .totals-box .vat-table td { padding: 4px 6px; border-top: 1px solid #f0f0f0; font-size: 8.5pt; }
  .totals-box .right { text-align: right; font-family: monospace; }
  .totals-sep { height: 2px; background: #111; margin: 6px 0; }
  .totals-ttc td { font-size: 14pt; font-weight: 900; color: #111; padding: 8px; }
  .paid { color: #059669; }
  .solde-due td { font-size: 12pt; font-weight: 800; color: #DC2626; }
  .solde-ok td { font-size: 12pt; font-weight: 800; color: #059669; }
  .paid-section { margin-bottom: 16px; }
  .paid-section table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .paid-section .paid { color: #059669; }
  .paid-section td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e0e0e0; font-size: 8.5pt; color: #888; text-align: center; line-height: 1.6; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 10pt; font-weight: 700; margin-bottom: 16px; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-due { background: #fee2e2; color: #991b1b; }
</style>
</head><body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Fermer</button>
</div>
<div class="page">
  <div class="header">
    <div>
      <div class="hotel-name">FLOWTYM HÔTEL</div>
      <div class="hotel-sub">123 Avenue des Champs-Élysées<br/>75008 Paris, France<br/>TVA Intracommunautaire : FR 12 345 678 901<br/>Tél : +33 1 23 45 67 89 · contact@flowtym.com</div>
    </div>
    <div style="text-align:right">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-meta"><strong>N° :</strong> ${invoiceNumber}<br/><strong>Date :</strong> ${today}<br/><strong>Réservation :</strong> ${(res as any).reference || res.id}</div>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:16px">
    <span class="status-badge ${solde <= 0.01 ? 'status-paid' : 'status-due'}">${solde <= 0.01 ? '✓ SOLDÉE' : `SOLDE : ${fmtE(solde)}`}</span>
  </div>

  <div class="addresses">
    <div class="address-box">
      <div class="address-label">Facturé à</div>
      <div class="address-name">${folio.payerName || (res as any).guestName || (res as any).client || 'Client'}</div>
      <div class="address-text">${folio.billingAddress || ''}</div>
    </div>
    <div class="reservation-box">
      <div class="res-label">Détails du séjour</div>
      <div class="res-row"><strong>Chambre :</strong> Ch. ${(res as any).room || '—'} (${(res as any).roomType || 'Standard'})</div>
      <div class="res-row"><strong>Arrivée :</strong> ${(res as any).checkin || ''}</div>
      <div class="res-row"><strong>Départ :</strong> ${(res as any).checkout || ''}</div>
      <div class="res-row"><strong>Durée :</strong> ${(res as any).nights || 1} nuit(s) · ${(res as any).guests?.adults || 2} adulte(s)</div>
    </div>
  </div>

  <div class="table-title">${folio.name}</div>
  <table class="lines">
    <thead><tr>
      <th style="text-align:left;width:35%">Description</th>
      <th style="text-align:center;width:12%">Date</th>
      <th style="text-align:right;width:7%">Qté</th>
      <th style="text-align:right;width:14%">PU HT</th>
      <th style="text-align:right;width:8%">TVA</th>
      <th style="text-align:right;width:14%">Total TTC</th>
    </tr></thead>
    <tbody>${linesHTML}</tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <table>
        <tr class="sub"><td>Total HT</td><td class="right">${fmtE(ht)}</td></tr>
        <tr><td colspan="2"><table class="vat-table">
          <thead><tr><th>Taux</th><th class="right">Base HT</th><th class="right">Montant TVA</th></tr></thead>
          <tbody>${vatRows || '<tr><td colspan="3" style="text-align:center;color:#aaa">—</td></tr>'}</tbody>
        </table></td></tr>
        <tr class="totals-ttc"><td><strong>TOTAL TTC</strong></td><td class="right"><strong>${fmtE(ttc)}</strong></td></tr>
      </table>
      <div class="totals-sep"></div>
      ${paymentsHTML ? `<div class="paid-section"><table>${paymentsHTML}</table></div>` : ''}
      <table>
        <tr class="${solde <= 0.01 ? 'solde-ok' : 'solde-due'}">
          <td>${solde <= 0.01 ? '✓ Facture soldée' : 'NET À PAYER'}</td>
          <td class="right">${fmtE(solde)}</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    Flowtym Hôtel SAS · RCS Paris 123 456 789 · TVA FR 12 345 678 901<br/>
    Conformément aux articles L441-3 et L441-6 du Code de Commerce — Escompte en cas de paiement anticipé : néant<br/>
    Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur · Indemnité forfaitaire pour frais de recouvrement : 40 €<br/>
    Page 1/1
  </div>
</div>
</body></html>`;
}

const TabFacturation: React.FC<{ res: Reservation }> = ({ res }) => {
  // Constants & Initial Data
  const defaultAddress = `${res.client || res.guestName || 'Client'}\n${res.email || ''}\n${res.phone || ''}`;
  const previousDefaultRef = React.useRef(defaultAddress);
  
  const [folios, setFolios] = useState<Folio[]>(() => {
    // Generate base lines
    const nights = res.nights || 1;
    const nightTTC = res.totalAmount || res.totalTTC || res.montant || 0;
    const unitPriceTTC = nightTTC / nights;
    const unitPriceHT = unitPriceTTC / 1.10;
    
    const hebergementLines: InvoiceLine[] = Array.from({ length: nights }).map((_, i) => {
      const d = new Date(res.arrival || res.checkIn || TODAY + 'T00:00:00');
      d.setDate(d.getDate() + i);
      return {
        id: uid(), date: fmtDate(d.toISOString().split('T')[0]),
        desc: `Nuitée Ch. ${res.room || '—'}`, qty: 1, unitPriceHT, vatRate: 0.10
      };
    });

    const taxLines: InvoiceLine[] = Array.from({ length: nights }).map((_, i) => {
      const d = new Date(res.arrival || res.checkIn || TODAY + 'T00:00:00');
      d.setDate(d.getDate() + i);
      return {
        id: uid(), date: fmtDate(d.toISOString().split('T')[0]),
        desc: `Taxe de séjour`, qty: res.guests?.adults || 2, unitPriceHT: 2.00, vatRate: 0.00
      };
    });

    return [
      { id: 'f1', name: 'Folio 1 : Hébergement', payerType: 'client', payerName: res.client || res.guestName || '', billingAddress: defaultAddress, lines: hebergementLines, payments: res.montant ? res.montant - res.solde : 0, paymentRecords: [] },
      { id: 'f2', name: 'Folio 2 : Taxes', payerType: 'client', payerName: res.client || res.guestName || '', billingAddress: defaultAddress, lines: taxLines, payments: 0, paymentRecords: [] },
      { id: 'f3', name: 'Folio 3 : Extras', payerType: 'client', payerName: res.client || res.guestName || '', billingAddress: defaultAddress, lines: [], payments: 0, paymentRecords: [] }
    ];
  });

  const families: Record<string, { code: string; desc: string; ht: number; tvaRate: number }[]> = {
    'Hébergement': [
      { code: 'NU', desc: 'Nuitée supplémentaire', ht: 95, tvaRate: 0.10 },
      { code: 'DL', desc: 'Late checkout', ht: 40, tvaRate: 0.10 }
    ],
    'Restauration': [
      { code: 'PD', desc: 'Petit-déjeuner buffet', ht: 15, tvaRate: 0.10 },
      { code: 'DI', desc: 'Dîner demi-pension', ht: 35, tvaRate: 0.10 }
    ],
    'Boissons': [
      { code: 'EA', desc: 'Eau minérale', ht: 4, tvaRate: 0.20 },
      { code: 'VI', desc: 'Vin au verre', ht: 8, tvaRate: 0.20 }
    ],
    'Spa & Bien-être': [
      { code: 'SP', desc: 'Accès spa', ht: 30, tvaRate: 0.20 },
      { code: 'MS', desc: 'Massage 30 min', ht: 55, tvaRate: 0.20 }
    ],
    'Blanchisserie': [
      { code: 'LB', desc: 'Blanchisserie express', ht: 18, tvaRate: 0.20 },
      { code: 'RP', desc: 'Repassage', ht: 12, tvaRate: 0.20 }
    ],
    'Transport': [
      { code: 'TX', desc: 'Transfert taxi', ht: 25, tvaRate: 0.10 },
      { code: 'NV', desc: 'Navette aéroport', ht: 35, tvaRate: 0.10 }
    ],
    'Télécommunications': [
      { code: 'TL', desc: 'Téléphone international', ht: 10, tvaRate: 0.20 },
      { code: 'WI', desc: 'Wifi premium', ht: 9, tvaRate: 0.20 }
    ],
    'Business': [
      { code: 'SA', desc: 'Salle de réunion', ht: 120, tvaRate: 0.20 },
      { code: 'IM', desc: 'Impression / secrétariat', ht: 14, tvaRate: 0.20 }
    ],
    'Parking': [
      { code: 'PK', desc: 'Parking nuit', ht: 20, tvaRate: 0.20 },
      { code: 'EV', desc: 'Recharge véhicule électrique', ht: 15, tvaRate: 0.20 }
    ],
    'Services divers': [
      { code: 'AN', desc: 'Animal de compagnie', ht: 18, tvaRate: 0.20 },
      { code: 'MN', desc: 'Minibar', ht: 22, tvaRate: 0.20 }
    ]
  };

  React.useEffect(() => {
    const currentDefault = `${res.client || res.guestName || 'Client'}\n${res.email || ''}\n${res.phone || ''}`;
    if (currentDefault !== previousDefaultRef.current) {
      setFolios(fs => fs.map(f => {
        if (f.billingAddress === previousDefaultRef.current || f.billingAddress.trim() === '') {
          return { ...f, billingAddress: currentDefault, payerName: res.client || res.guestName || '' };
        }
        return f;
      }));
      previousDefaultRef.current = currentDefault;
    }
  }, [res.client, res.guestName, res.email, res.phone]);

  const [activeFolioId, setActiveFolioId] = useState('f1');
  const [selectedFolioIds, setSelectedFolioIds] = useState<string[]>(['f1']);
  const [serviceFamily, setServiceFamily] = useState('');
  const [serviceCodeInput, setServiceCodeInput] = useState('');
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [showPayForm, setShowPayForm] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState('CB');
  const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'CB', 'VAD', 'AMEX', 'JCB', 'Diners'];
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState(0);

  // Bulk Transfer State
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [targetTransferFolio, setTargetTransferFolio] = useState('');

  // Right panel + action modals
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showAvoirDialog, setShowAvoirDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // Audit trail
  const guestName = res.client || res.guestName || 'Réception';
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => {
    const now = new Date().toISOString();
    return [
      { id: uid(), type: 'FOLIO_CREATE', ts: now, user: guestName, action: 'Folio 1 : Hébergement créé', folioId: 'f1' },
      { id: uid(), type: 'FOLIO_CREATE', ts: now, user: guestName, action: 'Folio 2 : Taxes créé', folioId: 'f2' },
      { id: uid(), type: 'FOLIO_CREATE', ts: now, user: guestName, action: 'Folio 3 : Extras créé', folioId: 'f3' },
    ];
  });
  const appendAudit = (type: AuditEntryType, action: string, amount?: number, folioId?: string) => {
    setAuditLog(prev => [...prev, { id: uid(), type, ts: new Date().toISOString(), user: guestName, action, amount, folioId }]);
  };

  // Computed Totals
  const calculateTotals = (lines: InvoiceLine[]) => {
    let ht = 0;
    let breakdown: Record<number, { ht: number; vat: number; ttc: number }> = {};
    let ttc = 0;
    lines.forEach(l => {
      const lineHT = l.unitPriceHT * l.qty;
      const lineVAT = lineHT * l.vatRate;
      const lineTTC = lineHT + lineVAT;
      
      ht += lineHT;
      ttc += lineTTC;
      
      if (!breakdown[l.vatRate]) breakdown[l.vatRate] = { ht: 0, vat: 0, ttc: 0 };
      breakdown[l.vatRate].ht += lineHT;
      breakdown[l.vatRate].vat += lineVAT;
      breakdown[l.vatRate].ttc += lineTTC;
    });
    return { ht, breakdown, ttc };
  };

  const globalTTC = folios.reduce((s, f) => s + calculateTotals(f.lines).ttc, 0);
  const globalPaid = folios.reduce((s, f) => s + f.payments, 0);
  const globalSolde = globalTTC - globalPaid;

  const activeFolio = folios.find(f => f.id === activeFolioId) || folios[0];
  const activeFolioTotals = calculateTotals(activeFolio.lines);
  const activeFolioSolde = activeFolioTotals.ttc - activeFolio.payments;
  const invoiceNumber = `FAC-${TODAY.replace(/-/g, '')}-${activeFolio.id.toUpperCase()}`;

  const allProducts = Object.entries(families).flatMap(([familyName, items]) =>
    items.map(item => ({ familyName, ...item }))
  );
  const selectedFamilyItems = serviceFamily ? families[serviceFamily] : [];
  const selectedProduct = selectedFamilyItems.find(item => item.code === selectedProductCode);
  const codeSuggestions = serviceCodeInput.length >= 2
    ? allProducts.filter(item => item.code.toLowerCase().startsWith(serviceCodeInput.slice(0, 2).toLowerCase())).slice(0, 6)
    : [];

  const handleAddService = () => {
    if (!serviceFamily || !selectedProduct) return;
    setFolios(fs => fs.map(f => f.id === activeFolioId ? {
      ...f,
      lines: [...f.lines, { id: uid(), date: fmtDate(TODAY), desc: `${selectedProduct.code} · ${selectedProduct.desc}`, qty: 1, unitPriceHT: selectedProduct.ht, vatRate: selectedProduct.tvaRate }]
    } : f));
    setSelectedProductCode('');
    setServiceCodeInput('');
    appendAudit('LINE_ADD', `Prestation ajoutée : ${selectedProduct.code} · ${selectedProduct.desc}`, selectedProduct.ht * (1 + selectedProduct.tvaRate), activeFolioId);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Prestation ${selectedProduct.code} ajoutée.` } }));
  };

  const applyCommercialDiscount = () => {
    const sanitized = Math.max(0, discountValue);
    if (sanitized <= 0) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'La remise doit être supérieure à 0.' } }));
      return;
    }
    const discountAmount = discountMode === 'percent'
      ? (activeFolioTotals.ttc * Math.min(sanitized, 100)) / 100
      : sanitized;
    const boundedAmount = Math.min(discountAmount, activeFolioTotals.ttc);
    if (boundedAmount <= 0) return;
    setFolios(fs => fs.map(f => f.id === activeFolioId ? {
      ...f,
      lines: [...f.lines, {
        id: uid(),
        date: fmtDate(TODAY),
        desc: discountMode === 'percent' ? `Remise commerciale (${sanitized.toFixed(2)}%)` : 'Remise commerciale (montant)',
        qty: 1,
        unitPriceHT: -boundedAmount,
        vatRate: 0
      }]
    } : f));
    appendAudit('DISCOUNT', `Remise commerciale appliquée (${discountMode === 'percent' ? sanitized.toFixed(0)+'%' : 'montant'})`, -boundedAmount, activeFolioId);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Remise appliquée : ${fmtEuro(boundedAmount)}` } }));
    setDiscountValue(0);
  };

  const handleBulkTransfer = () => {
    if (!targetTransferFolio || selectedLines.length === 0) return;
    setFolios(fs => {
      let linesToMove: InvoiceLine[] = [];
      const newFs = fs.map(f => {
        if (f.id === activeFolioId) {
          linesToMove = f.lines.filter(l => selectedLines.includes(l.id));
          return { ...f, lines: f.lines.filter(l => !selectedLines.includes(l.id)) };
        }
        return f;
      });
      return newFs.map(f => f.id === targetTransferFolio ? { ...f, lines: [...f.lines, ...linesToMove] } : f);
    });
    const targetName = folios.find(f => f.id === targetTransferFolio)?.name || targetTransferFolio;
    appendAudit('TRANSFER', `${selectedLines.length} ligne(s) transférée(s) → ${targetName}`, undefined, activeFolioId);
    setSelectedLines([]);
    setTargetTransferFolio('');
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `${selectedLines.length} ligne(s) transférée(s).` } }));
  };

  const toggleLineSelect = (lineId: string) => {
    setSelectedLines(prev => prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]);
  };

  const toggleAllLines = () => {
    if (selectedLines.length === activeFolio.lines.length && activeFolio.lines.length > 0) {
      setSelectedLines([]);
    } else {
      setSelectedLines(activeFolio.lines.map(l => l.id));
    }
  };

  const S_LABEL = { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '.5px' };

  // ── Handlers for action modals ──────────────────────────────────────────────
  const handleTransferConfirm = (dest: TransferDest, target: string, reason: string) => {
    const destLabels: Record<TransferDest, string> = { room: `Ch. ${target}`, reservation: target, company: `Société ${target}`, group: `Groupe ${target}`, house_account: target };
    if (dest === 'company' || dest === 'group') {
      const newId = `f${Date.now()}`;
      const newName = dest === 'company' ? `Folio Société : ${target}` : `Folio Groupe : ${target}`;
      let linesToMove: InvoiceLine[] = [];
      setFolios(fs => {
        const updated = fs.map(f => {
          if (f.id === activeFolioId) {
            linesToMove = selectedLines.length > 0 ? f.lines.filter(l => selectedLines.includes(l.id)) : f.lines;
            return { ...f, lines: f.lines.filter(l => !linesToMove.map(x => x.id).includes(l.id)) };
          }
          return f;
        });
        return [...updated, { id: newId, name: newName, payerType: 'company' as const, payerName: target, billingAddress: '', lines: linesToMove, payments: 0, paymentRecords: [] }];
      });
    }
    const count = selectedLines.length || activeFolio.lines.length;
    appendAudit('TRANSFER', `Transfert → ${destLabels[dest]} (${count} ligne(s)) — ${reason}`, undefined, activeFolioId);
    setSelectedLines([]);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Transfert effectué vers ${destLabels[dest]}` } }));
  };

  const handleSplitConfirm = (mode: 'auto' | 'percent' | 'fixed', value: number) => {
    const lines = [...activeFolio.lines];
    const totalTTC = activeFolioTotals.ttc;
    const targetA = mode === 'auto' ? totalTTC / 2 : mode === 'percent' ? totalTTC * value / 100 : Math.min(value, totalTTC);
    let runA = 0;
    const linesA: InvoiceLine[] = [];
    const linesB: InvoiceLine[] = [];
    for (const l of lines) {
      const ttc = l.unitPriceHT * l.qty * (1 + l.vatRate);
      if (runA + ttc <= targetA + 0.01) { linesA.push(l); runA += ttc; } else linesB.push(l);
    }
    const newId = `f${Date.now()}`;
    setFolios(fs => [
      ...fs.map(f => f.id === activeFolioId ? { ...f, lines: linesA } : f),
      { id: newId, name: `${activeFolio.name} (Partie B)`, payerType: activeFolio.payerType, payerName: activeFolio.payerName, billingAddress: activeFolio.billingAddress, lines: linesB, payments: 0, paymentRecords: [] }
    ]);
    appendAudit('SPLIT', `Répartition : ${activeFolio.name} → 2 parties`, totalTTC, activeFolioId);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Folio réparti en 2 parties.' } }));
  };

  const handleAvoirConfirm = (amount: number, motif: string) => {
    setFolios(fs => fs.map(f => f.id === activeFolioId ? {
      ...f, lines: [...f.lines, { id: uid(), date: fmtDate(TODAY), desc: `[AVOIR] ${motif}`, qty: 1, unitPriceHT: -amount, vatRate: 0 }]
    } : f));
    appendAudit('CREDIT_NOTE', `Avoir créé : ${motif}`, -amount, activeFolioId);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Avoir de ${fmtEuro(amount)} créé.` } }));
  };

  const handleRefundConfirm = (reason: string) => {
    const refundAmt = activeFolio.payments;
    setFolios(fs => fs.map(f => f.id === activeFolioId ? {
      ...f,
      payments: 0,
      paymentRecords: [],
      lines: [...f.lines, { id: uid(), date: fmtDate(TODAY), desc: `[REMBOURSEMENT] ${reason}`, qty: 1, unitPriceHT: -refundAmt, vatRate: 0 }]
    } : f));
    appendAudit('REFUND', `Remboursement : ${reason}`, -refundAmt, activeFolioId);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Remboursement de ${fmtEuro(refundAmt)} effectué.` } }));
  };

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      {/* ── MAIN CONTENT COLUMN ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* RÉSUMÉ DU SÉJOUR */}
      <div className="print-hide" style={{ ...CARD, padding: '16px 20px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <span style={S_LABEL}>Réservation</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6' }}>{(res as any).reference || res.id}</div>
          </div>
          <div>
            <span style={S_LABEL}>Dates</span>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(res.arrival || res.checkIn || '')} — {fmtDate(res.departure || res.checkOut || '')}</div>
          </div>
          <div>
            <span style={S_LABEL}>Durée & Pax</span>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{res.nights || 1} nuit(s) · {res.guests?.adults || 2} adulte(s)</div>
          </div>
          <div>
            <span style={S_LABEL}>Hébergement</span>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Ch. {res.room || '—'} ({res.roomType || 'Standard'})</div>
          </div>
        </div>
      </div>

      {/* GLOBAL RECAP */}
      <div className="print-hide" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Facturé (TTC)', value: fmtEuro(globalTTC), color: '#1E293B' },
          { label: 'Total Encaissé', value: fmtEuro(globalPaid), color: '#059669' },
          { label: 'Solde Restant', value: fmtEuro(globalSolde), color: globalSolde > 0 ? '#DC2626' : '#1E293B' },
          { label: 'Statut Global', value: globalSolde <= 0 ? 'SOLDÉ' : 'EN ATTENTE', color: globalSolde <= 0 ? '#10B981' : '#F59E0B' }
        ].map((k, i) => (
          <div key={i} style={{ ...CARD, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', background: i === 3 ? (globalSolde <= 0 ? '#ECFDF5' : '#FFFBEB') : '#fff' }}>
            <span style={S_LABEL}>{k.label}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* TABS NAVIGATION */}
      <div className="print-hide" style={{ display: 'flex', gap: 8, borderBottom: '2px solid #E2E8F0', paddingBottom: 0 }}>
        {folios.map(f => {
          const t = calculateTotals(f.lines);
          const s = t.ttc - f.payments;
          const isSettled = s <= 0 && t.ttc > 0;
          const isEmpty = t.ttc === 0 && f.payments === 0;
          const statusColor = isEmpty ? '#94A3B8' : (isSettled ? '#10B981' : '#DC2626');
          const isActive = activeFolioId === f.id;

          return (
            <div 
              key={f.id} 
              onClick={() => { setActiveFolioId(f.id); setSelectedLines([]); }}
              style={{ 
                padding: '12px 20px', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                background: isActive ? '#fff' : '#F8FAFC',
                border: `1px solid ${isActive ? '#E2E8F0' : 'transparent'}`,
                borderBottom: isActive ? 'none' : '1px solid transparent',
                marginBottom: isActive ? -2 : 0,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: isActive ? '0 -4px 10px rgba(0,0,0,0.02)' : 'none',
                transition: 'all 0.2s', zIndex: isActive ? 2 : 1, position: 'relative'
              }}
            >
              <input 
                type="checkbox" 
                checked={selectedFolioIds.includes(f.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedFolioIds(prev => 
                    prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                  );
                }}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#8B5CF6' }}
              />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? '#8B5CF6' : '#64748B' }}>{f.name}</span>
            </div>
          );
        })}
      </div>

      {/* ACTIVE FOLIO RENDER */}
      <div className="print-hide" style={{ ...CARD, padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: -24, borderTop: 'none', borderTopLeftRadius: 0, zIndex: 1, position: 'relative' }}>
        {/* Folio Header */}
        <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} color="#8B5CF6" />
            <input 
              type="text" 
              value={activeFolio.name} 
              onChange={e => setFolios(fs => fs.map(f => f.id === activeFolio.id ? {...f, name: e.target.value} : f))}
              style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', background: 'transparent', border: 'none', outline: 'none', width: 250 }}
            />
            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#F8FAFC', color: '#475569', fontWeight: 600, border: '1px solid #E2E8F0' }}>
              N° {invoiceNumber}
            </span>
            <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: activeFolioSolde <= 0 && activeFolioTotals.ttc > 0 ? '#ECFDF5' : '#FEF2F2', color: activeFolioSolde <= 0 && activeFolioTotals.ttc > 0 ? '#059669' : '#DC2626', fontWeight: 600 }}>
              {activeFolioSolde <= 0 && activeFolioTotals.ttc > 0 ? 'Soldé' : 'À payer'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginRight: 12, borderRight: '1px solid #E2E8F0', paddingRight: 12, display: 'flex', alignItems: 'center' }}>
              Action sur {selectedFolioIds.length} sélection(s)
            </div>
            <button
              onClick={() => {
                const targets = folios.filter(f => selectedFolioIds.includes(f.id) && (f.lines.length > 0 || f.payments > 0));
                if (targets.length === 0) { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Sélectionnez au moins un folio avec des données.' } })); return; }
                targets.forEach((folio, idx) => {
                  const inv = `FAC-${TODAY.replace(/-/g,'')}-${folio.id.toUpperCase()}`;
                  const html = buildInvoiceHTML(folio, res, inv);
                  const w = window.open('', `_invoice_${idx}`, 'width=900,height=1100,menubar=no,toolbar=no,location=no');
                  if (w) { w.document.write(html); w.document.close(); }
                });
              }}
              style={{ ...BTN('ghost'), color: '#6D28D9', background: '#F5F3FF', borderColor: '#C4B5FD' }}
            >
              <Search size={14} /> Aperçu PDF
            </button>
            <button
              onClick={() => {
                const targets = folios.filter(f => selectedFolioIds.includes(f.id) && (f.lines.length > 0 || f.payments > 0));
                if (targets.length === 0) { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Sélectionnez au moins un folio avec des données.' } })); return; }
                targets.forEach((folio, idx) => {
                  const inv = `FAC-${TODAY.replace(/-/g,'')}-${folio.id.toUpperCase()}`;
                  const html = buildInvoiceHTML(folio, res, inv);
                  const w = window.open('', `_print_${idx}`, 'width=900,height=1100,menubar=no,toolbar=no,location=no');
                  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
                });
              }}
              style={{ ...BTN('ghost'), color: '#475569' }}
            >
              <Printer size={14} /> Imprimer
            </button>
            <button 
              onClick={() => { 
                if (selectedFolioIds.length === 0) { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Veuillez sélectionner au moins un folio' } })); return; }
                window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Envoi de ${selectedFolioIds.length} facture(s) par email...` } })); 
              }} 
              style={{ ...BTN('ghost'), color: '#3B82F6', background: '#EFF6FF', borderColor: '#BFDBFE' }}
            >
              <Mail size={14} /> Envoyer
            </button>
          </div>
        </div>

        {/* ── Zone Actions Financières ── */}
        <BillingActionsToolbar
          onTransfer={() => setShowTransferDialog(true)}
          onSplit={() => setShowSplitDialog(true)}
          onAvoir={() => setShowAvoirDialog(true)}
          onRefund={() => setShowRefundDialog(true)}
          onHistory={() => setShowTimeline(v => !v)}
          selectedCount={selectedLines.length}
        />

        {/* Folio Payer & Address */}
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div>
            <span style={LABEL}>Facturé à</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => setFolios(fs => fs.map(f => f.id === activeFolio.id ? {...f, payerType: 'client'} : f))} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1.5px solid ${activeFolio.payerType === 'client' ? '#8B5CF6' : '#E2E8F0'}`, background: activeFolio.payerType === 'client' ? '#F5F3FF' : '#fff', color: activeFolio.payerType === 'client' ? '#8B5CF6' : '#64748B' }}>Client</button>
              <button onClick={() => setFolios(fs => fs.map(f => f.id === activeFolio.id ? {...f, payerType: 'company'} : f))} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1.5px solid ${activeFolio.payerType === 'company' ? '#8B5CF6' : '#E2E8F0'}`, background: activeFolio.payerType === 'company' ? '#F5F3FF' : '#fff', color: activeFolio.payerType === 'company' ? '#8B5CF6' : '#64748B' }}>Société</button>
            </div>
            <input type="text" placeholder="Nom d'affichage..." value={activeFolio.payerName} onChange={e => setFolios(fs => fs.map(f => f.id === activeFolio.id ? {...f, payerName: e.target.value} : f))} style={{ ...FIELD, marginTop: 8 }} />
          </div>
          <div>
            <span style={LABEL}>Adresse de facturation complète</span>
            <textarea 
              value={activeFolio.billingAddress} 
              onChange={e => setFolios(fs => fs.map(f => f.id === activeFolio.id ? {...f, billingAddress: e.target.value} : f))}
              style={{ ...FIELD, height: 72, resize: 'none', lineHeight: 1.4 }} 
              placeholder="Société SA&#10;123 Rue de la Paix&#10;75000 Paris"
            />
          </div>
        </div>

        {/* Folio Lines */}
        <div style={{ padding: '0 20px', background: '#fff' }}>
          {selectedLines.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#F5F3FF', border: '1px dashed #C4B5FD', borderRadius: 8, margin: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6D28D9' }}>{selectedLines.length} ligne(s) sélectionnée(s)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#4C1D95' }}>Déplacer vers :</span>
                <select value={targetTransferFolio} onChange={e => setTargetTransferFolio(e.target.value)} style={{ ...FIELD, height: 32, padding: '0 8px', fontSize: 12 }}>
                  <option value="" disabled>Choisir un folio...</option>
                  {folios.filter(f => f.id !== activeFolioId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button onClick={handleBulkTransfer} disabled={!targetTransferFolio} style={{ ...BTN('primary'), height: 32, padding: '0 12px', fontSize: 12, opacity: !targetTransferFolio ? 0.5 : 1 }}>Transférer</button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1px solid #E2E8F0', width: 40 }}>
                  <input type="checkbox" checked={selectedLines.length === activeFolio.lines.length && activeFolio.lines.length > 0} onChange={toggleAllLines} style={{ cursor: 'pointer' }} />
                </th>
                {['Date', 'Description', 'Qté', 'PU HT', 'TVA', 'Total TTC'].map((h, i) => (
                  <th key={i} style={{ padding: '12px 8px', textAlign: (i > 1 && i < 6) ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeFolio.lines.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>Aucune charge sur ce folio.</td></tr>
              )}
              {activeFolio.lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9', background: selectedLines.includes(l.id) ? '#FAFBFF' : 'transparent' }}>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedLines.includes(l.id)} onChange={() => toggleLineSelect(l.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '10px 8px', color: '#64748B' }}>{l.date}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: '#334155' }}>{l.desc}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{l.qty}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEuro(l.unitPriceHT)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748B' }}>{(l.vatRate * 100).toFixed(0)}%</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtEuro(l.unitPriceHT * l.qty * (1 + l.vatRate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Add Line Selector */}
          <div style={{ padding: '12px 0', borderBottom: '1px dashed #E2E8F0', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 180px auto', gap: 8, alignItems: 'end' }}>
            <div>
              <span style={LABEL}>Famille de produit</span>
              <select value={serviceFamily} onChange={e => { setServiceFamily(e.target.value); setSelectedProductCode(''); }} style={FIELD}>
                <option value="">Sélectionner une famille...</option>
                {Object.keys(families).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <span style={LABEL}>Produit</span>
              <select value={selectedProductCode} onChange={e => setSelectedProductCode(e.target.value)} style={FIELD} disabled={!serviceFamily}>
                <option value="">Sélectionner un produit...</option>
                {selectedFamilyItems.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.code} · {item.desc} ({fmtEuro(item.ht * (1 + item.tvaRate))} TTC)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={LABEL}>Code produit</span>
              <input
                value={serviceCodeInput}
                onChange={e => setServiceCodeInput(e.target.value.toUpperCase())}
                placeholder="2 lettres..."
                style={FIELD}
              />
              {codeSuggestions.length > 0 && (
                <div style={{ marginTop: 4, border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', maxHeight: 100, overflowY: 'auto' }}>
                  {codeSuggestions.map(item => (
                    <button
                      key={`${item.familyName}-${item.code}`}
                      onClick={() => { setServiceFamily(item.familyName); setSelectedProductCode(item.code); setServiceCodeInput(item.code); }}
                      style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      <strong>{item.code}</strong> · {item.desc}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleAddService} disabled={!selectedProduct} style={{ ...BTN('primary'), height: 38, border: 'none' }}>
              <PlusCircle size={14} /> Ajouter
            </button>
          </div>
        </div>

        {/* Folio Footer / Totals & Encaissement */}
        <div style={{ padding: '20px', background: '#FAFBFF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '1px solid #E2E8F0' }}>
          {/* Encaissement */}
          <div style={{ width: 350 }}>
            <span style={LABEL}>Paiements reçus : <strong style={{ color: '#059669' }}>{fmtEuro(activeFolio.payments)}</strong></span>
            {activeFolio.lines.length === 0 ? (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, color: '#64748B', fontSize: 12, fontStyle: 'italic' }}>
                Folio vide — Encaissement bloqué
              </div>
            ) : showPayForm === activeFolio.id ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="number" value={payAmt} onChange={e => setPayAmt(+e.target.value)} style={{ ...FIELD, width: 100 }} />
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ ...FIELD, width: 130 }}>
                  {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
                <button onClick={() => { 
                  const sanitizedAmount = Math.max(0, payAmt);
                  if (sanitizedAmount === 0) {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Le montant doit être supérieur à 0.' } }));
                    return;
                  }
                  setFolios(fs => fs.map(f => f.id === activeFolio.id ? {
                    ...f,
                    payments: f.payments + sanitizedAmount,
                    paymentRecords: [
                      ...f.paymentRecords,
                      { id: uid(), date: fmtDate(TODAY), amount: sanitizedAmount, method: payMethod }
                    ]
                  } : f));
                  appendAudit('PAYMENT', `Paiement ${payMethod} enregistré sur ${activeFolio.name}`, sanitizedAmount, activeFolio.id);
                  setShowPayForm(null);
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Paiement ${payMethod} enregistré sur ${activeFolio.name}` } }));
                }} style={{ ...BTN('primary'), background: '#10B981', border: 'none' }}>Valider</button>
                <button onClick={() => setShowPayForm(null)} style={BTN('ghost')}>Annuler</button>
              </div>
            ) : (
              <button onClick={() => { setPayAmt(Math.max(0, activeFolioSolde)); setPayMethod('CB'); setShowPayForm(activeFolio.id); }} style={{ ...BTN('ghost'), marginTop: 8, border: '1px solid #10B981', color: '#10B981', background: '#ECFDF5' }}>
                <CreditCard size={14} /> Encaisser sur ce folio
              </button>
            )}
            {activeFolio.paymentRecords.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 120, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff' }}>
                {activeFolio.paymentRecords.map((record) => (
                  <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontSize: 11, borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#475569' }}>{record.date} · {record.method}</span>
                    <strong style={{ color: '#059669' }}>{fmtEuro(record.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals Box */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ marginBottom: 10, padding: 8, border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 6, alignItems: 'center' }}>
              <select value={discountMode} onChange={e => setDiscountMode(e.target.value as 'percent' | 'amount')} style={{ ...FIELD, height: 32, padding: '0 8px', fontSize: 11 }}>
                <option value="percent">%</option>
                <option value="amount">Montant</option>
              </select>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} style={{ ...FIELD, height: 32, padding: '0 8px' }} placeholder={discountMode === 'percent' ? 'Ex: 10' : 'Ex: 35'} />
              <button onClick={applyCommercialDiscount} style={{ ...BTN('ghost'), height: 32, padding: '0 10px', fontSize: 11, color: '#7C3AED', borderColor: '#C4B5FD' }}>
                Geste
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Total HT</span>
              <span style={{ fontFamily: 'monospace' }}>{fmtEuro(activeFolioTotals.ht)}</span>
            </div>
            
            {/* Detailed Breakdown */}
            <div style={{ margin: '8px 0', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', background: '#fff' }}>
                <thead style={{ background: '#F8FAFC' }}>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'left', color: '#94A3B8' }}>Taux</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right', color: '#94A3B8' }}>Base HT</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right', color: '#94A3B8' }}>TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(activeFolioTotals.breakdown).sort((a,b) => +b[0] - +a[0]).map(([rate, data]) => (
                    <tr key={rate} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{(Number(rate)*100).toFixed(0)}%</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmtEuro(data.ht)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{fmtEuro(data.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ height: 1, background: '#E2E8F0', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, color: '#1E293B' }}>
              <span>TOTAL TTC</span>
              <span style={{ fontFamily: 'monospace' }}>{fmtEuro(activeFolioTotals.ttc)}</span>
            </div>
            {activeFolioSolde > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, color: '#DC2626', marginTop: 4 }}>
                <span>Reste à payer</span>
                <span style={{ fontFamily: 'monospace' }}>{fmtEuro(activeFolioSolde)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print View Layer — portal vers document.body pour largeur pleine page */}
      {ReactDOM.createPortal(<div className="print-only">
        {folios.filter(f => selectedFolioIds.includes(f.id)).map(folio => {
          const totals = calculateTotals(folio.lines);
          if (folio.lines.length === 0 && folio.payments === 0) return null; // Ne pas imprimer les folios vides
          return (
            <div key={'print-'+folio.id} style={{ pageBreakAfter: 'always', marginBottom: 50, padding: 20, background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, borderBottom: '2px solid #000', paddingBottom: 20 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 10px 0' }}>HÔTEL FLOWTYM</h1>
                  <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>
                    123 Avenue des Champs-Élysées<br/>75008 Paris, France<br/>TVA: FR1234567890<br/>contact@flowtym.com
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: 28, color: '#555', margin: '0 0 10px 0' }}>FACTURE</h2>
                  <div style={{ fontSize: 14 }}>
                    <strong>N° Facture :</strong> FAC-{TODAY.replace(/-/g, '')}-{folio.id.toUpperCase()}<br/>
                    <strong>Date :</strong> {fmtDate(TODAY)}<br/>
                    <strong>Réservation :</strong> {(res as any).reference || res.id}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                <div style={{ border: '1px solid #ccc', padding: 20, width: 300, background: '#f9f9f9', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Facturé à :</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{folio.payerName || 'Client'}</div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{folio.billingAddress}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    <th style={{ padding: 10, textAlign: 'left', border: '1px solid #ddd' }}>Description</th>
                    <th style={{ padding: 10, textAlign: 'center', border: '1px solid #ddd' }}>Date</th>
                    <th style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>Qté</th>
                    <th style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>PU HT</th>
                    <th style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>TVA</th>
                    <th style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {folio.lines.map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: 10, border: '1px solid #ddd', fontWeight: 600 }}>{l.desc}</td>
                      <td style={{ padding: 10, textAlign: 'center', border: '1px solid #ddd' }}>{l.date}</td>
                      <td style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>{l.qty}</td>
                      <td style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd' }}>{fmtEuro(l.unitPriceHT)}</td>
                      <td style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd', color: '#666' }}>{(l.vatRate*100).toFixed(0)}%</td>
                      <td style={{ padding: 10, textAlign: 'right', border: '1px solid #ddd', fontWeight: 700 }}>{fmtEuro(l.unitPriceHT * l.qty * (1 + l.vatRate))}</td>
                    </tr>
                  ))}
                  {folio.lines.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', fontStyle: 'italic', border: '1px solid #ddd' }}>Aucune charge</td></tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <table style={{ width: 300, borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8, fontWeight: 700, borderBottom: '1px solid #eee' }}>Total HT</td>
                      <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #eee' }}>{fmtEuro(totals.ht)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '8px 0' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', border: '1px solid #eee' }}>
                          <thead style={{ background: '#f5f5f5' }}>
                            <tr>
                              <th style={{ padding: 4, textAlign: 'left' }}>TVA</th>
                              <th style={{ padding: 4, textAlign: 'right' }}>Base HT</th>
                              <th style={{ padding: 4, textAlign: 'right' }}>Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(totals.breakdown).sort((a,b) => +b[0] - +a[0]).map(([rate, data]) => (
                              <tr key={rate}>
                                <td style={{ padding: 4, borderTop: '1px solid #eee' }}>{(Number(rate)*100).toFixed(0)}%</td>
                                <td style={{ padding: 4, textAlign: 'right', borderTop: '1px solid #eee' }}>{fmtEuro(data.ht)}</td>
                                <td style={{ padding: 4, textAlign: 'right', borderTop: '1px solid #eee' }}>{fmtEuro(data.vat)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #000', fontSize: 16, fontWeight: 900 }}>
                      <td style={{ padding: '12px 8px' }}>Total TTC</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>{fmtEuro(totals.ttc)}</td>
                    </tr>
                    {folio.paymentRecords.map((record) => (
                      <tr key={record.id} style={{ color: '#059669', fontSize: 13 }}>
                        <td style={{ padding: 8 }}>Paiement ({record.method})</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>-{fmtEuro(record.amount)}</td>
                      </tr>
                    ))}
                    {folio.paymentRecords.length === 0 && folio.payments > 0 && (
                      <tr style={{ color: '#059669', fontSize: 14 }}>
                        <td style={{ padding: 8 }}>Déjà réglé</td><td style={{ padding: 8, textAlign: 'right' }}>{fmtEuro(folio.payments)}</td>
                      </tr>
                    )}
                    <tr style={{ fontSize: 15, fontWeight: 800, color: (totals.ttc - folio.payments) > 0 ? '#DC2626' : '#059669' }}>
                      <td style={{ padding: '12px 8px', borderTop: '1px solid #ddd' }}>Net à payer</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', borderTop: '1px solid #ddd' }}>{fmtEuro(Math.max(0, totals.ttc - folio.payments))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>, document.body)}

      {/* ── Timeline Financière (toggled) ── */}
      {showTimeline && <FolioTimeline entries={auditLog} />}

      </div>{/* end main content column */}

      {/* ── Right Panel ── */}
      <BillingRightPanel
        folios={folios}
        res={res}
        auditLog={auditLog}
        collapsed={rightPanelCollapsed}
        onToggle={() => setRightPanelCollapsed(v => !v)}
      />

      {/* ── Action Modals ── */}
      <FolioTransferDialog
        isOpen={showTransferDialog}
        selectedLines={selectedLines.length || activeFolio.lines.length}
        onClose={() => setShowTransferDialog(false)}
        onConfirm={handleTransferConfirm}
      />
      <FolioSplitDialog
        isOpen={showSplitDialog}
        folioName={activeFolio.name}
        totalTTC={activeFolioTotals.ttc}
        lineCount={activeFolio.lines.length}
        onClose={() => setShowSplitDialog(false)}
        onConfirm={handleSplitConfirm}
      />
      <FolioAvoirDialog
        isOpen={showAvoirDialog}
        maxAmount={activeFolioTotals.ttc}
        onClose={() => setShowAvoirDialog(false)}
        onConfirm={handleAvoirConfirm}
      />
      <RefundModal
        isOpen={showRefundDialog}
        paymentAmount={activeFolio.payments}
        onConfirm={handleRefundConfirm}
        onCancel={() => setShowRefundDialog(false)}
      />
    </div>
  );
};

// ─── ONGLET 3 : CARDEX ────────────────────────────────────────────────────────
const TabCardex: React.FC<{ res: Reservation; allReservations: Reservation[] }> = ({ res, allReservations }) => {
  const guestResas = allReservations.filter(r =>
    r.guestName === res.guestName || (res.clientId && r.clientId === res.clientId)
  ).sort((a, b) => b.checkin.localeCompare(a.checkin));

  const totalNights = guestResas.reduce((s, r) => s + r.nights, 0);
  const totalSpend  = guestResas.reduce((s, r) => s + (r.totalAmount || r.montant || 0), 0);

  // Statistiques par canal
  const channelStats = guestResas.reduce((acc, r) => {
    const ch = r.canal || r.channel || 'DIRECT';
    if (!acc[ch]) acc[ch] = { count: 0, refs: [] };
    acc[ch].count++;
    acc[ch].refs.push(r.id);
    return acc;
  }, {} as Record<string, { count: number, refs: string[] }>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. KPIs Modernes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Séjours totaux', value: guestResas.length, icon: <History size={20}/>, color: '#8B5CF6', bg: '#F5F3FF' },
          { label: 'Nuits cumulées', value: totalNights, icon: <Bed size={20}/>, color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'CA Total (HT/TTC)', value: fmtEuro(totalSpend), icon: <CreditCard size={20}/>, color: '#10B981', bg: '#ECFDF5' },
          { label: 'Dépense moyenne', value: fmtEuro(guestResas.length ? totalSpend / guestResas.length : 0), icon: <TrendingUp size={20}/>, color: '#F59E0B', bg: '#FFFBEB' },
        ].map((k, i) => (
          <div key={i} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, padding: '20px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace' }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* Colonne Gauche : Profil & Canaux */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Fiche Identité */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
              <Users size={18} color="#8B5CF6"/> <span style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase' }}>Fiche Identité</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Email Principal', value: res.email || 'contact@client.com', icon: <Mail size={14} color="#94A3B8"/> },
                { label: 'Téléphone', value: res.phone || '+33 6 12 34 56 78', icon: <Phone size={14} color="#94A3B8"/> },
                { label: 'Adresse Facturation', value: res.address || '75001 Paris, France', icon: <MapPin size={14} color="#94A3B8"/> },
                { label: 'Type / Segment', value: 'Individuel · Loisirs · VIP', icon: <Briefcase size={14} color="#94A3B8"/> },
                { label: 'Identifiant Cardex', value: res.clientId || 'CX-9921', icon: <Hash size={14} color="#94A3B8"/> },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', lineHeight: 1.4 }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance par Canal */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
              <Globe size={18} color="#3B82F6"/> <span style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase' }}>Origine des Réservations</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(channelStats).map(([ch, data]: [string, any]) => (
                <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #F1F5F9' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{ch}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {data.refs.map(ref => <span key={ref} style={{ background: '#fff', padding: '1px 4px', borderRadius: 4, border: '1px solid #E2E8F0' }}>{ref}</span>)}
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#8B5CF6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                    {data.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Historique Complet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...CARD, flex: 1, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="#F59E0B"/> <span style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase' }}>Chronologie des Séjours</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>{guestResas.length} Dossier(s)</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Réf', 'Dates', 'Ch.', 'Nuits', 'Montant', 'Statut'].map((h, i) => (
                      <th key={i} style={{ padding: '12px 16px', textAlign: i > 3 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guestResas.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC', background: r.id === res.id ? '#F5F3FF' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace' }}>{r.id}</td>
                      <td style={{ padding: '12px 16px', color: '#64748B' }}>{fmtDate(r.checkin)} → {fmtDate(r.checkout)}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{r.room}</span></td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.nights}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{fmtEuro(r.totalAmount || r.montant || 0)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 100, background: r.status === 'checked_out' ? '#ECFDF5' : '#EFF6FF', color: r.status === 'checked_out' ? '#059669' : '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Préférences (Simplified) */}
          <div style={CARD}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                <Star size={18} color="#F59E0B"/> <span style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase' }}>Notes & Préférences</span>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Étage', val: 'Étage élevé' },
                  { label: 'Lit', val: 'Double Queen' },
                  { label: 'Régime', val: 'Sans gluten' },
                ].map((p, i) => (
                  <div key={i} style={{ padding: 12, background: '#FDFCFB', border: '1px solid #FEE2E2', borderRadius: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#450A0A' }}>{p.val}</div>
                  </div>
                ))}
             </div>
          </div>

          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
              <FileText size={18} color="#8B5CF6"/> <span style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase' }}>Documents d'identité (Check-in)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(res.cardexDocuments || []).map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{new Date(doc.uploadedAt).toLocaleString('fr-FR')} · {doc.source === 'checkin_scan' ? 'Scan check-in' : 'Upload manuel'}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6D28D9', background: '#F5F3FF', borderRadius: 100, padding: '3px 8px' }}>{doc.type || 'Document'}</span>
                </div>
              ))}
              {(!res.cardexDocuments || res.cardexDocuments.length === 0) && (
                <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Aucun document ID/Passeport enregistré.</div>
              )}
            </div>
            {(res.cardexDocuments || []).length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#FEFCE8', border: '1px solid #FDE68A', fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
                <strong>Note RGPD :</strong> les données du document sont stockées de manière chiffrée et supprimées automatiquement 30 jours après le check-out.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ONGLET 4 : INCIDENTS ─────────────────────────────────────────────────────
const TabIncidents: React.FC<{ res: Reservation }> = ({ res }) => {
  const [incidents, setIncidents] = useState<Incident[]>(EMPTY_INCIDENTS);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ category: 'technique', severity: 'medium', description: '', guestNotified: false });

  const SEVERITY = {
    low:      { label: 'Faible',   color: '#059669', bg: '#ECFDF5' },
    medium:   { label: 'Modéré',   color: '#D97706', bg: '#FFF7ED' },
    high:     { label: 'Élevé',    color: '#DC2626', bg: '#FEF2F2' },
    critical: { label: 'Critique', color: '#7F1D1D', bg: '#FEF2F2' },
  };
  const STATUS = {
    open:        { label: 'Ouvert',        color: '#DC2626', bg: '#FEF2F2' },
    in_progress: { label: 'En cours',      color: '#D97706', bg: '#FFF7ED' },
    resolved:    { label: 'Résolu',        color: '#059669', bg: '#ECFDF5' },
    closed:      { label: 'Clôturé',       color: '#64748B', bg: '#F8FAFC' },
  };

  const addIncident = () => {
    if (!form.description) return;
    const inc: Incident = { id: uid(), date: TODAY, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), ...form as any, status: 'open' };
    setIncidents(prev => [inc, ...prev]);
    setNewOpen(false);
    setForm({ category: 'technique', severity: 'medium', description: '', guestNotified: false });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Incident signalé · Notification équipe envoyée' } }));
  };

  const resolve = (id: string) => setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved', resolvedAt: new Date().toISOString() } : i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & New Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>Journal des Incidents</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Chambre {res.room} · {incidents.filter(i => i.status !== 'resolved').length} actif(s)</div>
          </div>
        </div>
        <button onClick={() => setNewOpen(true)} style={BTN('primary')}>
          <Plus size={16} /> Signaler un incident
        </button>
      </div>

      {/* Formulaire Nouveau (Expandable) */}
      <AnimatePresence>
        {newOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ ...CARD, background: 'white', border: '2px solid #8B5CF6', padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={LABEL}>Catégorie</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={FIELD}>
                    <option value="technique">Technique</option>
                    <option value="proprete">Propreté</option>
                    <option value="bruit">Bruit</option>
                    <option value="service">Service</option>
                    <option value="securite">Sécurité</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Gravité</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={FIELD}>
                    <option value="low">Faible</option>
                    <option value="medium">Modérée</option>
                    <option value="high">Élevée</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.guestNotified} onChange={e => setForm(f => ({ ...f, guestNotified: e.target.checked }))} />
                    Informer le client
                  </label>
                </div>
              </div>
              <label style={LABEL}>Description de l'incident</label>
              <textarea placeholder="Décrivez précisément le problème constaté..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ ...FIELD, minHeight: 80, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setNewOpen(false)} style={BTN('ghost')}>Annuler</button>
                <button onClick={addIncident} style={BTN('primary')}>Enregistrer & Alerter</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des Incidents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#F8FAFC', borderRadius: 16, border: '2px dashed #E2E8F0' }}>
            <Check size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8' }}>Aucun incident signalé pour ce séjour</div>
          </div>
        ) : (
          incidents.map(inc => {
            const sev = SEVERITY[inc.severity as keyof typeof SEVERITY];
            const st = STATUS[inc.status as keyof typeof STATUS];
            return (
              <div key={inc.id} style={{ ...CARD, padding: 0, borderLeft: `6px solid ${sev.color}`, overflow: 'hidden', transition: 'transform 0.2s' }}>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, background: '#F1F5F9', color: '#64748B', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>{inc.category}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, background: sev.bg, color: sev.color, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>{sev.label}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {fmtDate(inc.date)} · {inc.time}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 900, background: st.bg, color: st.color, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', border: `1px solid ${st.color}30` }}>
                      {st.label}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', lineHeight: 1.5, marginBottom: 16 }}>
                    {inc.description}
                  </div>

                  {inc.compensation && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <Star size={16} fill="#10B981" color="#10B981" />
                      <div>
                        <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 10, display: 'block', marginBottom: 2 }}>Geste Commercial Accordé</span>
                        {inc.compensation}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {inc.resolvedBy && (
                        <div style={{ fontSize: 11, color: '#64748B' }}>Intervention : <strong style={{ color: '#334155' }}>{inc.resolvedBy}</strong></div>
                      )}
                      {inc.guestNotified && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 6 }}>
                          ✓ CLIENT INFORMÉ
                        </div>
                      )}
                    </div>
                    
                    {inc.status !== 'resolved' && inc.status !== 'closed' && (
                      <button onClick={() => resolve(inc.id)} 
                        style={{ ...BTN('ghost'), color: '#059669', borderColor: '#BBF7D0', background: '#F0FDF4', fontSize: 11 }}>
                        <Check size={14} /> Marquer comme résolu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── ONGLET 5 : OBJETS OUBLIÉS ────────────────────────────────────────────────
const TabLostItems: React.FC = () => {
  const [items, setItems] = useState<LostItem[]>(EMPTY_LOST_ITEMS);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ description: '', foundLocation: '', category: 'autre' });

  const STATUS_LOST = {
    found:    { label: 'À traiter', color: '#D97706', bg: '#FFF7ED' },
    claimed:  { label: 'Réclamé',  color: '#2563EB', bg: '#EFF6FF' },
    shipped:  { label: 'Expédié',  color: '#8B5CF6', bg: '#EDE9FE' },
    donated:  { label: 'Donation', color: '#059669', bg: '#ECFDF5' },
    disposed: { label: 'Détruit',  color: '#64748B', bg: '#F8FAFC' },
  };

  const CAT_ICONS: Record<string, React.ReactNode> = {
    vetement: <Shirt size={16}/>,
    electronique: <Smartphone size={16}/>,
    document: <File size={16}/>,
    bijou: <Gem size={16}/>,
    autre: <Box size={16}/>
  };

  const addItem = () => {
    if (!form.description) return;
    setItems(prev => [{ id: uid(), foundDate: TODAY, ...form as any, status: 'found' }, ...prev]);
    setNewOpen(false);
    setForm({ description: '', foundLocation: '', category: 'autre' });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Objet oublié enregistré' } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>Objets Oubliés (Lost & Found)</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Gestion des articles trouvés en chambre</div>
          </div>
        </div>
        <button onClick={() => setNewOpen(true)} style={BTN('primary')}>
          <Plus size={16} /> Déclarer un objet
        </button>
      </div>

      {/* Formulaire Nouveau */}
      <AnimatePresence>
        {newOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ ...CARD, background: 'white', border: '2px solid #D97706', padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={LABEL}>Description de l'objet</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Chargeur iPhone, Veste..." style={FIELD} />
                </div>
                <div>
                  <label style={LABEL}>Lieu de découverte</label>
                  <input value={form.foundLocation} onChange={e => setForm(f => ({ ...f, foundLocation: e.target.value }))} placeholder="Chambre 103..." style={FIELD} />
                </div>
                <div>
                  <label style={LABEL}>Catégorie</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={FIELD}>
                    <option value="vetement">👕 Vêtement</option>
                    <option value="electronique">📱 Électronique</option>
                    <option value="document">📄 Document</option>
                    <option value="bijou">💍 Bijou</option>
                    <option value="autre">📦 Autre</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setNewOpen(false)} style={BTN('ghost')}>Annuler</button>
                <button onClick={addItem} style={BTN('primary')}>Enregistrer l'objet</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des Objets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {items.map(item => {
          const st = STATUS_LOST[item.status as keyof typeof STATUS_LOST];
          return (
            <div key={item.id} style={{ ...CARD, padding: '20px', borderLeft: `6px solid ${st.color}`, transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F8FAFC', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{CAT_ICONS[item.category] || <Box size={16}/>}</div>
                   <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>{item.category}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 900, background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 100, textTransform: 'uppercase', border: `1px solid ${st.color}30` }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>{item.description}</div>
              <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <MapPin size={12}/> Trouvé à : <strong>{item.foundLocation}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                 <div style={{ fontSize: 11, color: '#94A3B8' }}>Déclaré le {fmtDate(item.foundDate)}</div>
                 <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ ...BTN('ghost'), padding: '4px 8px', fontSize: 10 }}><Tag size={12}/> Étiqueter</button>
                    <button style={{ ...BTN('ghost'), padding: '4px 8px', fontSize: 10, color: '#2563EB', borderColor: '#BFDBFE' }}><Mail size={12}/> Informer client</button>
                 </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40, background: '#F8FAFC', borderRadius: 16, border: '2px dashed #E2E8F0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8' }}>Aucun objet trouvé répertorié</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ONGLET 6 : AVIS ──────────────────────────────────────────────────────────
const TabReviews: React.FC<{ res: Reservation }> = ({ res }) => {
  const [reviews, setReviews] = useState<GuestReview[]>(EMPTY_REVIEWS);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    direct:      { label: 'Direct',       color: '#8B5CF6', bg: '#EDE9FE', icon: <Hash size={14}/> },
    tripadvisor: { label: 'TripAdvisor',  color: '#00AF87', bg: '#ECFDF5', icon: <Globe size={14}/> },
    booking:     { label: 'Booking.com',  color: '#2563EB', bg: '#EFF6FF', icon: <Globe size={14}/> },
    google:      { label: 'Google',       color: '#DC2626', bg: '#FEF2F2', icon: <Globe size={14}/> },
    expedia:     { label: 'Expedia',      color: '#D97706', bg: '#FFF7ED', icon: <Globe size={14}/> },
  };

  const avgScore = reviews.length ? (reviews.reduce((s, r) => s + r.overallScore, 0) / reviews.length).toFixed(1) : '–';

  const Stars = ({ score }: { score: number }) => (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: i < score ? '#F59E0B' : '#E2E8F0', border: i < score ? 'none' : '1px solid #CBD5E1' }} />
      ))}
      <span style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', marginLeft: 8 }}>{score}/10</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Score moyen & Analytics */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 32, padding: '24px 32px' }}>
        <div style={{ textAlign: 'center' as const, paddingRight: 32, borderRight: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 56, fontWeight: 950, color: '#F59E0B', lineHeight: 1, letterSpacing: '-0.02em' }}>{avgScore}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, marginTop: 8, textTransform: 'uppercase' }}>{reviews.length} Avis Clients</div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Propreté', key: 'cleanliness' },
            { label: 'Confort', key: 'comfort' },
            { label: 'Localisation', key: 'location' },
            { label: 'Service', key: 'service' },
          ].map(c => {
            const avg = reviews.filter(r => (r as any)[c.key]).reduce((s, r) => s + ((r as any)[c.key] || 0), 0) / (reviews.filter(r => (r as any)[c.key]).length || 1);
            return (
              <div key={c.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                  <span>{c.label}</span><span style={{ color: '#1E293B' }}>{avg.toFixed(1)}</span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 100, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${avg * 10}%` }} style={{ height: '100%', background: avg >= 8 ? '#10B981' : avg >= 6 ? '#F59E0B' : '#DC2626', borderRadius: 100 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste des avis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reviews.map(r => {
          const src = SOURCE_CONFIG[r.source] || SOURCE_CONFIG.direct;
          return (
            <div key={r.id} style={{ ...CARD, padding: '24px', borderLeft: `6px solid ${r.sentiment === 'positive' ? '#10B981' : r.sentiment === 'negative' ? '#DC2626' : '#F59E0B'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: src.bg, color: src.color, padding: '4px 12px', borderRadius: 100, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                    {src.icon} {src.label}
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{fmtDate(r.date)}</span>
                </div>
                <Stars score={r.overallScore} />
              </div>
              
              <div style={{ fontSize: 15, color: '#1E293B', fontWeight: 600, lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic', paddingLeft: 12, borderLeft: '3px solid #F1F5F9' }}>
                "{r.comment}"
              </div>

              {r.response ? (
                <div style={{ background: '#F8FAFC', borderRadius: 16, padding: '16px 20px', border: '1px solid #F1F5F9', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 20, top: -10, background: '#fff', padding: '2px 10px', borderRadius: 6, fontSize: 10, fontWeight: 900, color: '#8B5CF6', border: '1px solid #DDD6FE' }}>
                    RÉPONSE DIRECTION
                  </div>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{r.response}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 10, textAlign: 'right' }}>Publiée le {fmtDate(r.responseDate!)}</div>
                </div>
              ) : (
                replyOpen === r.id ? (
                  <div style={{ marginTop: 16 }}>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Rédiger une réponse officielle..." style={{ ...FIELD, resize: 'vertical', minHeight: 80, marginBottom: 12, fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setReplyOpen(null)} style={BTN('ghost')}>Annuler</button>
                      <button onClick={() => {
                        setReviews(prev => prev.map(rv => rv.id === r.id ? { ...rv, response: replyText, responseDate: TODAY } : rv));
                        setReplyOpen(null); setReplyText('');
                        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Réponse publiée' } }));
                      }} style={BTN('primary')}><Reply size={14}/> Publier la réponse</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setReplyOpen(r.id); setReplyText(''); }} style={{ ...BTN('ghost'), color: '#8B5CF6', borderColor: '#DDD6FE' }}>
                      <MessageSquare size={14}/> Répondre à cet avis
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ONGLET 7 : FIDÉLITÉ ÉLITE STAY ──────────────────────────────────────────
const TabLoyalty: React.FC<{ res: Reservation; allReservations: Reservation[] }> = ({ res, allReservations }) => {
  const account = useMemo(() => buildMockEliteStay(allReservations, res.clientId), [allReservations, res.clientId]);
  const tier = TIER_CONFIG[account.tier];
  const nextTier = account.tier === 'bronze' ? TIER_CONFIG.silver : account.tier === 'silver' ? TIER_CONFIG.gold : account.tier === 'gold' ? TIER_CONFIG.platinum : null;
  const ptsToNextTier = nextTier ? (nextTier.min - account.totalPoints) : 0;
  const progressPct = nextTier ? Math.min(100, ((account.totalPoints - tier.min) / (nextTier.min - tier.min)) * 100) : 100;

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemPts, setRedeemPts] = useState(1000);
  const redeemValue = calcRedeemValue(redeemPts);
  const earnedThisStay = calcEarnedPoints(res.montant, account.tier);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* CARTE MEMBRE PREMIUM */}
      <div style={{
        background: `linear-gradient(135deg, ${account.tier === 'platinum' ? '#1E1E1E, #333333' : account.tier === 'gold' ? '#78350F, #B45309' : account.tier === 'silver' ? '#1E293B, #475569' : '#4F46E5, #3730A3'})`,
        borderRadius: 24, padding: '32px', color: 'white', position: 'relative', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 100, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Award size={24} color={account.tier === 'gold' ? '#FCD34D' : 'white'} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Élite Stay Member</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Tier {tier.label}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>ID MEMBRE</div>
            <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>{account.memberId}</div>
          </div>
        </div>

        <div style={{ zIndex: 1 }}>
           <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{res.guestName}</div>
           <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Inscrit le {fmtDate(account.memberSince)} · {account.staysCount} séjours cumulés</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
           <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 4 }}>POINTS DISPONIBLES</div>
              <div style={{ fontSize: 42, fontWeight: 950, color: account.tier === 'gold' ? '#FCD34D' : 'white', lineHeight: 1 }}>
                {account.availablePoints.toLocaleString()}
                <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 8, color: 'rgba(255,255,255,0.5)' }}>PTS</span>
              </div>
           </div>
           <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>VALEUR</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtEuro(calcRedeemValue(account.availablePoints))}</div>
           </div>
        </div>
      </div>

      {/* Progression */}
      {nextTier && (
        <div style={{ ...CARD, padding: 24 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="#4F46E5" />
                <span style={{ fontSize: 14, fontWeight: 900, color: '#1E293B' }}>Objectif {nextTier.label}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#4F46E5' }}>{ptsToNextTier.toLocaleString()} pts manquants</span>
           </div>
           <div style={{ height: 12, background: '#F1F5F9', borderRadius: 100, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1.2, ease: 'circOut' }}
                style={{ height: '100%', background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`, borderRadius: 100 }} />
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>{account.totalPoints.toLocaleString()} pts (Total)</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>Prochain palier : {nextTier.min.toLocaleString()} pts</span>
           </div>
        </div>
      )}

      {/* KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Dépenses Totales', value: fmtEuro(account.lifetimeSpend), icon: <Briefcase size={16}/>, color: '#1E293B' },
          { label: 'Gains ce séjour', value: `+${earnedThisStay.toLocaleString()} pts`, icon: <TrendingUp size={16}/>, color: '#059669' },
          { label: 'Taux multiplicateur', value: `×${tier.multiplier.toFixed(1)}`, icon: <Zap size={16}/>, color: '#8B5CF6' },
          { label: 'Statut actuel', value: tier.label, icon: <Award size={16}/>, color: tier.color },
        ].map((k, i) => (
          <div key={i} style={{ ...CARD, padding: 16, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#94A3B8' }}>{k.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Avantages & Conversion */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ ...CARD, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
             <Gift size={20} color="#F59E0B" />
             <span style={{ fontSize: 15, fontWeight: 900, color: '#1E293B' }}>Vos avantages {tier.label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             {TIER_BENEFITS[account.tier].map((b, i) => (
               <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                 <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F0FDF4', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                   <Check size={12} strokeWidth={4} />
                 </div>
                 {b}
               </div>
             ))}
          </div>
        </div>

        <div style={{ ...CARD, padding: 24, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Info size={20} color="#8B5CF6" />
              <span style={{ fontSize: 15, fontWeight: 900, color: '#5B21B6' }}>Comment convertir ?</span>
           </div>
           <div style={{ fontSize: 13, color: '#5B21B6', lineHeight: 1.6, fontWeight: 600 }}>
             <p style={{ marginBottom: 12 }}>• Vous gagnez <strong>{POINTS_PER_EURO} points</strong> par euro dépensé.</p>
             <p style={{ marginBottom: 12 }}>• 1 000 points = <strong>{fmtEuro(EURO_VALUE_PER_1000)}</strong> de remise directe.</p>
             <p>• Valable sur les séjours, le restaurant et le spa.</p>
           </div>
           <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px dashed #DDD6FE' }}>
              <button onClick={() => setRedeemOpen(!redeemOpen)} style={{ ...BTN('primary'), width: '100%', background: '#8B5CF6' }}>
                <Gift size={16} /> Utiliser mes points maintenant
              </button>
           </div>
        </div>
      </div>
      
      {/* Utilisation des points (Slider) */}
      <AnimatePresence>
        {redeemOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div style={{ ...CARD, padding: 24, background: '#F0FDF4', border: '2px solid #10B981' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#065F46' }}>Utiliser mes points de fidélité</span>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '4px 12px', borderRadius: 100 }}>
                    MAX: {account.availablePoints.toLocaleString()} PTS
                  </div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24, alignItems: 'center' }}>
                  <div>
                    <input type="range" min={1000} max={account.availablePoints} step={1000} value={redeemPts} 
                      onChange={e => setRedeemPts(+e.target.value)}
                      style={{ width: '100%', accentColor: '#10B981', height: 8 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 14, fontWeight: 900, color: '#059669' }}>
                       <span>{redeemPts.toLocaleString()} points</span>
                       <span>{fmtEuro(redeemValue)} de remise</span>
                    </div>
                  </div>
                  <button onClick={() => {
                    setRedeemOpen(false);
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Remise de ${fmtEuro(redeemValue)} appliquée au folio` } }));
                  }} style={{ ...BTN('primary'), background: '#10B981', height: 50, fontSize: 14 }}>
                    Confirmer la remise
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historique des transactions */}
      <div style={CARD}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={18} color="#94A3B8" />
          <span style={{ fontSize: 14, fontWeight: 900, color: '#1E293B' }}>Historique des transactions</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748B' }}>Date</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748B' }}>Type</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748B' }}>Détails</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#64748B' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {[...account.transactions].slice(0, 5).map((t, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>{fmtDate(t.date)}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 100, background: t.type === 'earn' ? '#ECFDF5' : '#FEF2F2', color: t.type === 'earn' ? '#059669' : '#DC2626', textTransform: 'uppercase' }}>
                      {t.type === 'earn' ? 'Gain' : 'Débit'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{t.description}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 14, fontWeight: 900, color: t.points > 0 ? '#059669' : '#DC2626' }}>
                    {t.points > 0 ? '+' : ''}{t.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── COMPOSANT PRINCIPAL : FICHE RÉSERVATION ─────────────────────────────────
interface FicheReservationProps {
  isOpen?: boolean;
  reservation: Reservation;
  allReservations?: Reservation[];
  onClose: () => void;
  onUpdate?: (updated: Reservation) => void;
}

/** Onglet "Journal" — Journal Unifié des communications (L3.1, données réelles). */
const TabCommunications: React.FC<{ res: any }> = ({ res }) => {
  const directGuest = res.guestId ?? res.guest_id ?? null;
  const directResa  = res.reservationUuid ?? res.reservation_id ?? null;
  const needResolve = !directGuest && !directResa;
  const reference   = res.reference ?? res.ref ?? res.id ?? null;

  // Repli pour vues legacy (ex. Planning) : résolution des UUID par référence.
  const resolveQ = useQuery({
    queryKey: ['resolve-res-ids', reference],
    queryFn: () => resolveReservationRefIds(String(reference)),
    enabled: needResolve && Boolean(reference),
    staleTime: 60_000,
  });

  const guestId = directGuest ?? resolveQ.data?.guestId ?? null;
  const reservationId = directResa ?? resolveQ.data?.reservationId ?? null;

  if (needResolve && resolveQ.isLoading) {
    return <div style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Chargement du journal…</div>;
  }
  if (!guestId && !reservationId) {
    return (
      <div style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13, lineHeight: 1.6 }}>
        Aucun historique rattaché à cette réservation pour le moment.
      </div>
    );
  }
  return (
    <div style={{ minHeight: 440 }}>
      <CommunicationTimeline scope={{ guestId, reservationId }} title="Journal des communications" className="h-[460px]" />
    </div>
  );
};

const TABS = [
  { id: 'reservation', label: 'Réservation',    icon: Ico.res     },
  { id: 'facturation', label: 'Facturation',     icon: Ico.bill    },
  { id: 'cardex',      label: 'Cardex',          icon: Ico.cardex  },
  { id: 'incidents',   label: 'Incidents',       icon: Ico.incident },
  { id: 'lost',        label: 'Objets oubliés',  icon: Ico.lost    },
  { id: 'reviews',     label: 'Avis',            icon: Ico.review  },
  { id: 'loyalty',     label: 'Élite Stay',      icon: Ico.loyalty },
  { id: 'communications', label: 'Journal',      icon: <MessageSquare size={13} /> },
];

export const ReservationDetailsModal: React.FC<FicheReservationProps> = ({
  reservation: rawReservation, allReservations: rawAllRes = [], isOpen = true, onClose, onUpdate
}) => {
  if (!isOpen || !rawReservation) return null;

  const adaptRes = (r: any) => {
    const parseDate = (d: any) => {
      if (!d) return '';
      const s = String(d).split(' ')[0].split('T')[0];
      if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
      if (s.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [dd, mm, yyyy] = s.split('/');
        return `${yyyy}-${mm}-${dd}`;
      }
      return s;
    };

    const statusMap: Record<string, string> = {
      'confirmée': 'confirmed', 'confirmé': 'confirmed', 'confirmed': 'confirmed',
      'arrivée': 'confirmed', 'arrivée < 1h': 'confirmed', 'en approche': 'confirmed',
      'en attente': 'pending', 'pending': 'pending',
      'en séjour': 'checked_in', 'checked_in': 'checked_in', 'stay': 'checked_in',
      'départ': 'checked_out', 'checked_out': 'checked_out',
      'annulée': 'cancelled', 'annulé': 'cancelled', 'cancelled': 'cancelled'
    };
    const rawStatus = String(r.status || 'pending').toLowerCase();
    let status = statusMap[rawStatus] || rawStatus;
    
    // Fallback intelligent pour les badges dynamiques (ex: "arrivée < 2h")
    if (status !== 'confirmed' && (rawStatus.includes('arrivée') || rawStatus.includes('confirm'))) {
      status = 'confirmed';
    }

    const cin = parseDate(r.arrival || r.checkIn || r.checkin);
    const cout = parseDate(r.departure || r.checkOut || r.checkout);
    const roomNum = String(r.room || r.roomNumber || '');
    
    // Inférence du type de chambre si manquant
    const rType = r.roomType || r.category || r.typeChambre || '';
    
    return { 
      ...r, 
      status,
      guestName: r.client || r.guestName,
      /** Numéro lisible (référence partenaire / OTA) — priorité sur l'UUID Supabase */
      reference: r.reference || r.ref || r.partnerRef || r.id,
      arrival: cin, checkIn: cin, checkin: cin,
      departure: cout, checkOut: cout, checkout: cout,
      room: roomNum,
      roomType: rType || 'Double Classique',
      mealPlan: r.mealPlan || r.pension || 'Room Only',
      montant: r.totalAmount || r.montant || 0,
      solde: r.solde ?? 0,
      nights: Math.max(1, Math.ceil((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)) 
    };
  };
  const reservation = adaptRes(rawReservation);
  const allReservations = rawAllRes.map(adaptRes);

  const [activeTab, setActiveTab] = useState<string>('reservation');
  const [showCheckinScanModal, setShowCheckinScanModal] = useState(false);

  const statusColors: Record<string, { color: string; bg: string }> = {
    confirmed:   { color: '#2563EB', bg: '#EFF6FF' },
    pending:     { color: '#D97706', bg: '#FFF7ED' },
    checked_in:  { color: '#059669', bg: '#ECFDF5' },
    checked_out: { color: '#64748B', bg: '#F8FAFC' },
    cancelled:   { color: '#DC2626', bg: '#FEF2F2' },
    no_show:     { color: '#9F1239', bg: '#FFF1F2' },
  };
  const st = statusColors[reservation.status] || statusColors.confirmed;

  const finalizeCheckin = (options?: { document?: CardexDocument; ignoredScan?: boolean }) => {
    if (!onUpdate) return;
    const currentLogs = reservation.logs || [];
    const nextLogs = [...currentLogs];
    const nextDocs = [...(reservation.cardexDocuments || [])];

    if (options?.document) {
      nextDocs.push(options.document);
      nextLogs.push({
        timestamp: new Date().toISOString(),
        action: 'Document ID/Passeport scanné',
        userId: 'Réception',
        after: options.document.name
      });
    }

    if (options?.ignoredScan) {
      nextLogs.push({
        timestamp: new Date().toISOString(),
        action: 'Scan ID/Passeport ignoré',
        userId: 'Réception',
        after: 'Client habituel'
      });
    }

    onUpdate({
      ...reservation,
      status: 'En séjour',
      statusColor: 'text-indigo-500',
      dotColor: 'bg-indigo-500',
      action: 'Check-out',
      reservationStatus: 'confirmed',
      logs: nextLogs,
      cardexDocuments: nextDocs
    });
  };

  return (
    <>
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          /* Reset visibility */
          body { visibility: hidden !important; background: white !important; }
          #flowtym-modal-root { visibility: hidden !important; background: transparent !important; }
          
          /* Show only print-only content */
          .print-only, .print-only * { visibility: visible !important; }
          .print-only {
            display: block !important;
            position: static !important;
            width: 100% !important;
            z-index: 9999 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          
          /* Hide everything else marked print-hide */
          .print-hide { display: none !important; }
          
          @page { margin: 15mm; size: auto; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      <div id="flowtym-modal-root" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.40)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px', backdropFilter: 'blur(8px)' }}>
        <motion.div
          initial={{ opacity: 0, scale: .97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: .97, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          style={{ width: '100%', maxWidth: 1280, height: '92vh', background: '#F8FAFC', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.22), 0 0 0 1px rgba(255,255,255,.08)' }}
        >
          {/* ── HEADER ── */}
          <div className="print-hide" style={{ background: '#8B5CF6', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Avatar initiales */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 }}>
            {(reservation.guestName || 'G').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          {/* Infos */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 2 }}>{reservation.guestName || 'Client'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,.6)' }}>{(reservation as any).reference || reservation.id}</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: st.bg, color: st.color }}>
                {reservation.status.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>
                Ch. {reservation.room} · {fmtDate(reservation.checkin)} → {fmtDate(reservation.checkout)} · {reservation.nights} nuit(s)
              </span>
            </div>
          </div>
          {/* Montant */}
          <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>{fmtEuro(reservation.montant)}</div>
            <div style={{ fontSize: 9, color: (reservation.solde ?? 0) > 0 ? '#FCA5A5' : '#86EFAC', fontWeight: 600 }}>
              {(reservation.solde ?? 0) > 0 ? `Solde : ${fmtEuro(reservation.solde)}` : '✓ Soldée'}
            </div>
          </div>

          {/* Fermer */}
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.12)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {Ico.close}
          </button>
        </div>

        {/* ── ONGLETS ── */}
        <div style={{ display: 'flex', gap: 0, background: 'white', borderBottom: '1px solid #F1F5F9', padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: 'none', background: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                borderBottom: activeTab === t.id ? '2.5px solid #8B5CF6' : '2.5px solid transparent',
                color: activeTab === t.id ? '#7C3AED' : '#94A3B8',
                transition: 'all .15s',
              }}>
              <span style={{ color: activeTab === t.id ? '#7C3AED' : '#CBD5E1' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CONTENU ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .15 }}>
              {activeTab === 'reservation' && <TabReservation res={reservation} onUpdate={onUpdate} />}
              {activeTab === 'facturation' && <TabFacturation res={reservation} />}
              {activeTab === 'cardex'      && <TabCardex res={reservation} allReservations={allReservations} />}
              {activeTab === 'incidents'   && <TabIncidents res={reservation} />}
              {activeTab === 'lost'        && <TabLostItems />}
              {activeTab === 'reviews'     && <TabReviews res={reservation} />}
              {activeTab === 'loyalty'     && <TabLoyalty res={reservation} allReservations={allReservations} />}
              {activeTab === 'communications' && <TabCommunications res={reservation} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── BARRE D'ACTIONS OPÉRATIONNELLES (bas de fiche) ── */}
        {(reservation.status === 'confirmed' || reservation.status === 'checked_in') && (
          <div className="print-hide" style={{ borderTop: '1px solid #F1F5F9', background: 'white', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>
              Actions opérationnelles
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {reservation.status === 'confirmed' && (
                <button
                  onClick={() => setShowCheckinScanModal(true)}
                  style={{ ...BTN('primary'), background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', height: 40, padding: '0 20px', boxShadow: '0 4px 14px rgba(16,185,129,0.30)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13 }}
                >
                  <Check size={15} strokeWidth={2.5} /> Check-in
                </button>
              )}
              {reservation.status === 'checked_in' && (
                <button
                  onClick={() => {
                    if (onUpdate) {
                      onUpdate({
                        ...reservation,
                        status: 'Check-out fait',
                        statusColor: 'text-gray-500',
                        dotColor: 'bg-gray-400',
                        action: 'Archivé',
                        reservationStatus: 'confirmed'
                      });
                    }
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Check-out réussi pour ${reservation.guestName}.` } }));
                  }}
                  style={{ ...BTN('primary'), background: 'linear-gradient(135deg,#64748B,#475569)', color: 'white', height: 40, padding: '0 20px', boxShadow: '0 4px 14px rgba(100,116,139,0.28)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13 }}
                >
                  <LogOut size={15} strokeWidth={2.5} /> Check-out
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
      </div>
      {showCheckinScanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...CARD, width: '100%', maxWidth: 520, background: 'white', boxShadow: '0 30px 80px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>Check-in · Scan ID/Passeport</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>Le document sera ajouté dans l'onglet Cardex.</div>
              </div>
              <button onClick={() => setShowCheckinScanModal(false)} style={{ ...BTN('ghost'), width: 34, height: 34, padding: 0 }}>{Ico.close}</button>
            </div>

            <label style={{ border: '2px dashed #C4B5FD', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#F5F3FF', marginBottom: 16 }}>
              <UploadCloud size={26} color="#7C3AED" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9' }}>Scanner ID / Passeport</span>
              <span style={{ fontSize: 11, color: '#7C3AED' }}>PDF, JPG ou PNG</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const documentEntry: CardexDocument = {
                    id: uid(),
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    uploadedAt: new Date().toISOString(),
                    source: 'checkin_scan'
                  };
                  finalizeCheckin({ document: documentEntry });
                  setShowCheckinScanModal(false);
                  setActiveTab('cardex');
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Check-in validé · document ${file.name} ajouté au Cardex.` } }));
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                onClick={() => {
                  finalizeCheckin({ ignoredScan: true });
                  setShowCheckinScanModal(false);
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Check-in validé sans scan pour ${reservation.guestName}.` } }));
                }}
                style={{ ...BTN('ghost'), flex: 1 }}
              >
                Ignorer (client habituel)
              </button>
              <button
                onClick={() => setShowCheckinScanModal(false)}
                style={{ ...BTN('ghost'), flex: 1 }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReservationDetailsModal;
