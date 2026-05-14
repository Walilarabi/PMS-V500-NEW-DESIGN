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
  // Finance sub-pages (Finance garde : Facturation, Caisse, Impayés, Clôture, Propriétaires)
  | 'facturation'
  | 'caisse'
  | 'impayes'
  | 'proprietaires'
  | 'cloture'
  // SAS — module à part entière dans la nav principale
  | 'sas'
  | 'sas_incoming'       // Réservations entrantes (bulle verte)
  | 'sas_rie'            // Revenue Integrity Engine dashboard
  | 'sas_anomalies'      // Liste anomalies
  | 'sas_quarantine'     // File quarantaine
  | 'sas_odms'           // OTA Dispute Center
  | 'sas_dispute_detail' // Détail litige
  | 'sas_reconciliation' // Reconciliation Center
  | 'sas_audit'          // Journal d'audit (déplacé depuis Finance)
  | 'sas_partners'       // Configuration partenaires OTA
  // Revenue sub-pages
  | 'yield'
  | 'promotions'
  // Clients sub-pages
  | 'fiches'
  | 'fidelite'
  // Settings sub-pages
  | 'annulations'
  | 'supplements'
  | 'fermatures'
  | 'hotel'
  | 'taxe'
  | 'pms'
  | 'api'
  // Analysis sub-pages
  | 'performance'
  | 'forecast';

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
