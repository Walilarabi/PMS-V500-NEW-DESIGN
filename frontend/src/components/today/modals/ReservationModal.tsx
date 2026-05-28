/**
 * FLOWTYM — ReservationModal (Flowday tabs: réservation/billing/cardex/incidents/lost/reviews/elite).
 */
import { useState } from 'react';
import {
  AlertTriangle, BadgeEuro, BedDouble, Calendar, CreditCard, FileText,
  Globe2, Hash, Hotel, IdCard, Mail, MapPin, Phone, Printer, Search, Sparkles, Users,
  WalletCards, X, type LucideIcon,
} from 'lucide-react';

import type { ModalTab, ReservationModalState } from '../types';
import { cn, formatReservationDate } from '../helpers';

export const ReservationModal = ({ state, onClose, onValidate }: { state: ReservationModalState; onClose: () => void; onValidate: (state: ReservationModalState) => void }) => {
  const { row, mode } = state;
  const [activeTab, setActiveTab] = useState<ModalTab>(mode === 'departure' ? 'billing' : 'reservation');
  const stayTotal = row.stayAmount;
  const roomLabel = `Ch. ${row.room} (${row.type})`;
  const statusLabel = row.status === 'Non prête' ? 'non prête' : row.status.toLowerCase();
  const tabs: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'reservation', label: 'Réservation', icon: FileText },
    { id: 'billing', label: 'Facturation', icon: CreditCard },
    { id: 'cardex', label: 'Cardex', icon: Users },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'lost', label: 'Objets oubliés', icon: Search },
    { id: 'reviews', label: 'Avis', icon: Sparkles },
    { id: 'elite', label: 'Élite Stay', icon: BadgeEuro },
  ];

  const InfoBlock = ({ label, value, className }: { label: string; value: string; className?: string }) => (
    <div className={className}>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-base font-semibold text-slate-800">{value}</div>
    </div>
  );

  const PanelTitle = ({ icon: Icon, children }: { icon: LucideIcon; children: string }) => (
    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4 text-sm font-extrabold uppercase tracking-wide text-violet-500">
      <Icon size={18} />
      {children}
    </div>
  );

  const Metric = ({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-3xl bg-white p-6 text-center shadow-sm border border-slate-100">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn('text-2xl font-black', tone)}>{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm md:p-6">
      <div className="min-h-[92vh] w-full max-w-[1180px] overflow-hidden rounded-[2rem] bg-slate-50 shadow-2xl">
        <div className="relative flex items-center justify-between gap-4 bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 px-8 py-7 text-white">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/16 text-2xl font-black">{row.initials}</div>
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black">{row.guest}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/65">
                <span>{row.reservationId}</span>
                <span className="rounded-full bg-white px-3 py-1 text-blue-600">{statusLabel}</span>
                <span>Ch. {row.room} · {formatReservationDate(row.arrival)} → {formatReservationDate(row.departure)} · {row.nights} nuit(s)</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-7">
            <div className="text-right">
              <div className="font-mono text-3xl font-black">{stayTotal}</div>
              <div className="mt-1 text-sm font-bold text-emerald-300">✓ Soldée</div>
            </div>
            <button onClick={onClose} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors" aria-label="Fermer">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap', active ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-700')}>
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[720px] p-7">
          {activeTab === 'reservation' && (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-600" />Confirmée</span>
                <div className="flex flex-wrap gap-3">
                  <button className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"><Printer size={18} /></button>
                  <button className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-500"><Mail size={18} /></button>
                  <button onClick={() => onValidate(state)} className="rounded-2xl bg-violet-600 px-7 py-3 font-black text-white shadow-lg shadow-violet-600/25">✓ Confirmer</button>
                  <button className="rounded-2xl border border-violet-300 bg-white px-7 py-3 font-black text-violet-500">Modifier</button>
                  <button onClick={onClose} className="rounded-2xl bg-red-50 px-7 py-3 font-black text-red-600">Annuler</button>
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={Users}>Client</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Nom complet" value={row.guest} />
                    <InfoBlock label="Nationalité" value="🇫🇷 France" />
                    <InfoBlock label="Email" value={row.email ?? 'sophie.dubois@gmail.com'} />
                    <InfoBlock label="Téléphone" value={row.phone ?? '+33 6 12 34 56 78'} />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={BedDouble}>Séjour</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Arrivée" value={formatReservationDate(row.arrival)} />
                    <InfoBlock label="Départ" value={formatReservationDate(row.departure)} />
                    <InfoBlock label="Type de chambre" value="Simple" />
                    <InfoBlock label="Chambre (dispo)" value={`${row.room} (Double Classique)`} />
                    <InfoBlock label="Type de pension" value="Room Only" />
                    <InfoBlock label="Conditions d'annulation" value="Flexible (72h)" />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={CreditCard}>Paiement & Garantie</PanelTitle>
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoBlock label="Canal (source)" value={row.source === 'DIRECT' ? 'Direct' : row.source} />
                    <InfoBlock label="Mode de paiement" value="Carte bancaire" />
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Garantie</div>
                      <div className="flex gap-2"><span className="rounded-xl border-2 border-violet-500 p-3 text-violet-500"><CreditCard size={18} /></span><span className="rounded-xl border border-slate-200 p-3 text-slate-400"><Hotel size={18} /></span><span className="rounded-xl border border-slate-200 p-3 text-slate-400"><WalletCards size={18} /></span></div>
                    </div>
                    <InfoBlock label="Statut du paiement" value={row.payment === 'Payé' ? 'Payé (Solde 0)' : row.payment} />
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
                  <PanelTitle icon={FileText}>Documents & Cardex</PanelTitle>
                  <div className="space-y-4">
                    <InfoBlock label="Ajouter au journal (Cardex)" value="Note, incident, préférence client..." />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><span className="font-bold text-violet-600">21:42 · system :</span> Création initiale</div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Pièces jointes (CNI, confirmations...)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-7">
              <div className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
                <InfoBlock label="Réservation" value={row.reservationId} />
                <InfoBlock label="Dates" value={`${formatReservationDate(row.arrival)} - ${formatReservationDate(row.departure)}`} />
                <InfoBlock label="Durée & Pax" value={`${row.nights} nuit(s) · ${row.guestCount} adulte(s)`} />
                <InfoBlock label="Hébergement" value={roomLabel} />
              </div>
              <div className="grid gap-5 md:grid-cols-4">
                <Metric label="Total facturé (TTC)" value="432,00 €" />
                <Metric label="Total encaissé" value="420,00 €" tone="text-emerald-600" />
                <Metric label="Solde restant" value="12,00 €" tone="text-red-600" />
                <Metric label="Statut global" value="EN ATTENTE" tone="text-amber-500" />
              </div>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
                  <span className="font-black text-violet-600">Folio 1 : Hébergement</span><span className="rounded-xl bg-slate-50 px-4 py-2 font-mono text-sm">N° FAC-20260505-F1</span><span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-600">Soldé</span>
                  <div className="ml-auto flex gap-2"><button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Aperçu PDF</button><button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Imprimer</button><button className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-bold text-blue-600">Envoyer</button></div>
                </div>
                <div className="grid gap-5 bg-slate-50 p-5 md:grid-cols-2"><InfoBlock label="Facturé à" value={row.guest} /><InfoBlock label="Adresse de facturation complète" value={`${row.guest}\n${row.email ?? 'sophie.dubois@gmail.com'}`} /></div>
                <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th className="p-4">Date</th><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA</th><th className="pr-6 text-right">Total TTC</th></tr></thead><tbody className="divide-y divide-slate-100">{[0, 1, 2].map((i) => <tr key={i}><td className="p-4 text-slate-500">{formatReservationDate(row.arrival)}</td><td className="font-bold">Nuitée Ch. {row.room}</td><td>1</td><td>127,27 €</td><td>10%</td><td className="pr-6 text-right font-black">140,00 €</td></tr>)}</tbody></table>
                <div className="grid gap-5 border-t border-slate-100 p-5 md:grid-cols-[1fr_1fr_1fr_auto]"><InfoBlock label="Famille de produit" value="Sélectionner une famille..." /><InfoBlock label="Produit" value="Sélectionner un produit..." /><InfoBlock label="Code produit" value="2 lettres..." /><button className="self-end rounded-2xl bg-violet-600 px-7 py-4 font-black text-white">Ajouter</button></div>
                <div className="flex flex-wrap items-end justify-between gap-6 border-t border-slate-100 bg-slate-50 p-6"><button className="rounded-2xl border border-emerald-300 bg-emerald-50 px-7 py-3 font-black text-emerald-600">Encaisser sur ce folio</button><div className="min-w-[300px] space-y-3 text-right"><div className="flex justify-between"><span>Total HT</span><span>381,82 €</span></div><div className="flex justify-between"><span>TVA</span><span>38,18 €</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-black"><span>TOTAL TTC</span><span>420,00 €</span></div></div></div>
              </div>
            </div>
          )}

          {activeTab === 'cardex' && (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-4"><Metric label="Séjours totaux" value="1" /><Metric label="Nuits cumulées" value={`${row.nights}`} /><Metric label="CA total (HT/TTC)" value={stayTotal} /><Metric label="Dépense moyenne" value={stayTotal} /></div>
              <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="space-y-6"><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Users}>Fiche identité</PanelTitle><div className="space-y-5 text-sm font-semibold text-slate-700"><div><Mail size={16} className="mb-1 text-slate-400" />{row.email ?? 'sophie.dubois@gmail.com'}</div><div><Phone size={16} className="mb-1 text-slate-400" />+33 6 12 34 56 78</div><div><MapPin size={16} className="mb-1 text-slate-400" />75001 Paris, France</div><div><Hash size={16} className="mb-1 text-slate-400" />CX-9921</div></div></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Globe2}>Origine des réservations</PanelTitle><div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black"><span>{row.source}</span><span className="rounded-full bg-violet-600 px-4 py-2 text-white">1</span></div></div></div>
                <div className="space-y-6"><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><div className="mb-5 flex justify-between"><PanelTitle icon={Calendar}>Chronologie des séjours</PanelTitle><span className="font-bold text-slate-400">1 Dossier(s)</span></div><table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th>Réf</th><th>Dates</th><th>Ch.</th><th>Nuits</th><th>Montant</th><th>Statut</th></tr></thead><tbody><tr className="bg-violet-50"><td className="py-4 font-black text-violet-600">{row.reservationId}</td><td>{formatReservationDate(row.arrival)} → {formatReservationDate(row.departure)}</td><td><span className="rounded-xl bg-white px-3 py-1 font-black">{row.room}</span></td><td>{row.nights}</td><td className="font-black">{stayTotal}</td><td className="font-black text-blue-600">{statusLabel.toUpperCase()}</td></tr></tbody></table></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={Sparkles}>Notes & préférences</PanelTitle><div className="grid gap-4 md:grid-cols-3"><InfoBlock label="Étage" value="Étage élevé" /><InfoBlock label="Lit" value="Double Queen" /><InfoBlock label="Régime" value="Sans gluten" /></div></div><div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100"><PanelTitle icon={IdCard}>Documents d'identité (check-in)</PanelTitle><p className="text-sm italic text-slate-400">Aucun document ID/Passeport enregistré.</p></div></div>
              </div>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-red-50 p-4 text-red-600"><AlertTriangle /></div>
                  <div><h4 className="text-2xl font-black">Journal des Incidents</h4><p className="font-semibold text-slate-400">Chambre {row.room}</p></div>
                </div>
                <button className="rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25">+ Signaler un incident</button>
              </div>
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-400 font-semibold">
                Aucun incident enregistré pour ce séjour.
              </div>
            </div>
          )}

          {activeTab === 'lost' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-orange-50 p-4 text-orange-600"><Search /></div>
                  <div><h4 className="text-2xl font-black">Objets Oubliés (Lost & Found)</h4><p className="font-semibold text-slate-400">Gestion des articles trouvés en chambre</p></div>
                </div>
                <button className="rounded-2xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg shadow-violet-600/25">+ Déclarer un objet</button>
              </div>
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-400 font-semibold">
                Aucun objet déclaré pour cette chambre.
              </div>
            </div>
          )}

          {activeTab === ‘reviews’ && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-600"><Sparkles /></div>
                <div><h4 className="text-2xl font-black">Avis Clients</h4><p className="font-semibold text-slate-400">Évaluations liées à ce séjour</p></div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-400 font-semibold">
                Aucun avis enregistré pour ce séjour.
              </div>
            </div>
          )}

          {activeTab === 'elite' && (
            <div className="space-y-7">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-600"><BadgeEuro /></div>
                <div><h4 className="text-2xl font-black">Élite Stay</h4><p className="font-semibold text-slate-400">{row.guest}</p></div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-400 font-semibold">
                Aucune adhésion Élite Stay trouvée pour ce client.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
