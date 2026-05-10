export type PageId = 
  | 'flowboard'
  | 'planning' 
  | 'today' 
  | 'reservations' 
  | 'clients' 
  | 'revenue' 
  | 'operations' 
  | 'finance' 
  | 'analysis' 
  | 'settings'
  | 'calendrier'
  | 'mouvements'
  | 'qr'
  | 'simulation'
  | 'groupes'
  | 'paiements'
  | 'relances'
  | 'anomalies'
  | 'rie'
  | 'sas'
  | 'revenue-integrity'
  | 'odms'
  | 'litiges'
  | 'reconciliation'
  | 'audit'
  | 'users'
  | 'utilisateurs'
  | 'fiches'
  | 'fidelite'
  | 'yield'
  | 'promotions'
  | 'performance'
  | 'forecast'
  | 'facturation'
  | 'caisse'
  | 'impayes'
  | 'cloture'
  | 'proprietaires'
  | 'annulations'
  | 'supplements'
  | 'fermatures'
  | 'hotel'
  | 'taxe'
  | 'pms'
  | 'api';

export interface Reservation {
  id: string;
  reference: string;
  status: 'confirmed' | 'pending' | 'checkout' | 'cleaning' | 'arriving';
  client: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  channel: string;
  room: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'business' | 'leisure' | 'vip' | 'group';
  loyalty: 'none' | 'star' | 'medal' | 'crown' | 'gem';
  lastStay: string;
  totalSpent: number;
}
