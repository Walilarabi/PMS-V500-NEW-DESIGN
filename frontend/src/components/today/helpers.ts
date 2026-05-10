/**
 * FLOWTYM — Shared helpers/constants for the Flowday (TodayView) module.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { MessageTemplate, RoomRow, SortKey } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatReservationDate = (dateTime: string) => {
  const [date] = dateTime.split(' ');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

export const fillMessageTemplate = (template: MessageTemplate, row: RoomRow) => template.content
  .replace(/\{guest\}/g, row.guest)
  .replace(/\{room\}/g, row.room)
  .replace(/\{arrival\}/g, formatReservationDate(row.arrival))
  .replace(/\{departure\}/g, formatReservationDate(row.departure))
  .replace(/\{amount\}/g, row.stayAmount);

export const messageTemplates: MessageTemplate[] = [
  { id: 'confirmation', label: 'Confirmation de séjour', icon: '📅', content: 'Bonjour {guest},\n\nNous avons le plaisir de vous confirmer votre réservation pour les dates du {arrival} au {departure}.\nChambre : {room}\n\nCordialement,\nL\'équipe de la Réception' },
  { id: 'rappel', label: 'Rappel Arrivée', icon: '⏰', content: 'Cher(e) {guest},\n\nNous avons hâte de vous accueillir très bientôt dans la chambre {room}.\n\nA bientôt !\nL\'équipe de la Réception' },
  { id: 'paiement', label: 'Demande de Paiement', icon: '💰', content: 'Bonjour {guest},\n\nNous vous rappelons que le solde de votre séjour reste à régler.\nMontant : {amount}\n\nMerci de votre confiance.' },
  { id: 'facture', label: 'Envoi de Facture', icon: '📄', content: 'Bonjour {guest},\n\nVeuillez trouver ci-joint votre facture de séjour.\n\nCordialement,\nLa Réception' },
  { id: 'satisfaction', label: 'Questionnaire de Satisfaction', icon: '⭐', content: 'Cher(e) {guest},\n\nVotre avis nous est précieux ! Merci de prendre quelques minutes pour répondre à notre questionnaire de satisfaction.\n\nMerci beaucoup.' },
  { id: 'offre', label: 'Offre Spéciale', icon: '🎁', content: 'Bonjour {guest},\n\nProfitez de notre offre spéciale pour votre prochain séjour !\n-20% sur les nuits supplémentaires.\n\nÀ très vite.' },
  { id: 'modification', label: 'Modification de Réservation', icon: '✏️', content: 'Bonjour {guest},\n\nVotre réservation a été modifiée comme convenu.\nNouvelles dates : {arrival} - {departure}\n\nCordialement.' },
  { id: 'annulation', label: 'Confirmation d\'Annulation', icon: '❌', content: 'Bonjour {guest},\n\nVotre réservation a été annulée comme demandé.\n\nNous espérons vous accueillir prochainement.' },
];

export const housekeepers = ['Amina Benali', 'Julie Martin', 'Sara Diallo', 'Emma Petit', 'Lina Rossi'];

export const actionOptions = ['Lancer le ménage', 'Demande Inspection', 'Refus de service', 'Bloquer la chambre'];

export const priorityRank: Record<string, number> = { Critique: 0, Élevée: 1, Moyenne: 2, Faible: 3 };

export const getActionSelectValue = (action: string) => {
  if (action.includes('ménage')) return 'Lancer le ménage';
  if (action.includes('Inspection')) return 'Demande Inspection';
  if (action.includes('Refus')) return 'Refus de service';
  if (action.includes('Bloquer')) return 'Bloquer la chambre';
  return 'Lancer le ménage';
};

export const getFollowStyle = (taskStatus: string) => {
  if (taskStatus === 'À faire') return 'bg-red-50 text-red-600 border border-red-100';
  if (taskStatus === 'En cours') return 'bg-orange-50 text-orange-600 border border-orange-100';
  if (taskStatus === 'À valider') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
};

export const getSortValue = (row: RoomRow, key: SortKey) => {
  if (key === 'priority') return priorityRank[row.priority] ?? 99;
  if (key === 'room') return Number(row.room) || 0;
  if (key === 'arrival') return new Date(row.arrival).getTime();
  if (key === 'departure') return new Date(row.departure).getTime();
  if (key === 'eta') return row.etaTime || '99:99';
  if (key === 'nights') return row.nights;
  return String(row[key] ?? '').toLowerCase();
};
