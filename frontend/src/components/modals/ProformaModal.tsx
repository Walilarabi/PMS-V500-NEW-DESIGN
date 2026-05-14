/**
 * FLOWTYM — ProformaModal
 * Affiche la facture proforma avec toutes les informations de la réservation
 */
import React from 'react';
import { X, Printer, Download, Mail } from 'lucide-react';
import { motion } from 'motion/react';

interface ProformaProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    reference: string;
    guestName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    adults: number;
    children: number;
    checkIn: string;
    checkOut: string;
    nights: number;
    roomNumber?: string;
    roomType?: string;
    arrangement?: string;
    ratePlan?: string;
    source?: string;
    pricePerNight: number;
    totalHT: number;
    tva: number;
    taxeSejour: number;
    totalTTC: number;
    notes?: string;
    hotelName?: string;
    paymentLink?: string | null;
  };
}

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const fmtEur  = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export function ProformaModal({ isOpen, onClose, data }: ProformaProps) {
  if (!isOpen) return null;

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white w-full max-w-[700px] rounded-[20px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-violet-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[16px] font-bold text-white">Facture Proforma</h2>
            <p className="text-[11px] text-violet-200 mt-0.5">Document non contractuel · Valable 30 jours</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} title="Imprimer"
              className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
              <Printer size={14} />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body — printable */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6" id="proforma-print">

          {/* Hotel + Références */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-sm">F</span>
                </div>
                <span className="text-[16px] font-black text-gray-900">{data.hotelName ?? 'Flowtym PMS'}</span>
              </div>
              <p className="text-[11px] text-gray-400">Établissement hôtelier</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">PROFORMA</p>
              <p className="text-[18px] font-black text-gray-900 mt-0.5">{data.reference}</p>
              <p className="text-[11px] text-gray-400">Émis le {today}</p>
            </div>
          </div>

          {/* Ligne séparatrice */}
          <div className="border-t border-[#EDE9FE]" />

          {/* Client */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLIENT</p>
              <p className="text-[14px] font-bold text-gray-900">{data.guestName || '—'}</p>
              {data.email && <p className="text-[12px] text-gray-500 mt-0.5">{data.email}</p>}
              {data.phone && <p className="text-[12px] text-gray-500">{data.phone}</p>}
              {data.nationality && <p className="text-[12px] text-gray-400">{data.nationality}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">SÉJOUR</p>
              <div className="space-y-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Arrivée</span>
                  <span className="font-semibold text-gray-800">{fmtDate(data.checkIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Départ</span>
                  <span className="font-semibold text-gray-800">{fmtDate(data.checkOut)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Durée</span>
                  <span className="font-semibold text-gray-800">{data.nights} nuit{data.nights > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Personnes</span>
                  <span className="font-semibold text-gray-800">
                    {data.adults} adulte{data.adults > 1 ? 's' : ''}
                    {data.children > 0 ? ` · ${data.children} enfant${data.children > 1 ? 's' : ''}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chambre + prestation */}
          <div className="bg-[#F5F3FF] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">PRESTATION</p>
            <div className="space-y-2 text-[12.5px]">
              {data.roomNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Chambre</span>
                  <span className="font-semibold text-gray-800">N° {data.roomNumber} {data.roomType ? `· ${data.roomType}` : ''}</span>
                </div>
              )}
              {data.arrangement && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Arrangement</span>
                  <span className="font-semibold text-gray-800">{data.arrangement}</span>
                </div>
              )}
              {data.ratePlan && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan tarifaire</span>
                  <span className="font-semibold text-gray-800">{data.ratePlan}</span>
                </div>
              )}
              {data.source && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Canal</span>
                  <span className="font-semibold text-gray-800">{data.source}</span>
                </div>
              )}
            </div>
          </div>

          {/* Détail tarifaire */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">DÉTAIL TARIFAIRE</p>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#EDE9FE] text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="text-left pb-2">Désignation</th>
                  <th className="text-right pb-2">Nuits</th>
                  <th className="text-right pb-2">Prix/nuit</th>
                  <th className="text-right pb-2">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9FE]">
                <tr>
                  <td className="py-2.5 text-gray-700 font-medium">
                    Hébergement {data.roomType ?? ''} {data.arrangement ?? ''}
                  </td>
                  <td className="py-2.5 text-right text-gray-600">{data.nights}</td>
                  <td className="py-2.5 text-right text-gray-600">{fmtEur(data.pricePerNight)}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-800">{fmtEur(data.totalHT)}</td>
                </tr>
                {data.taxeSejour > 0 && (
                  <tr>
                    <td className="py-2.5 text-gray-500">Taxe de séjour ({data.adults} pers. × {data.nights} nuit{data.nights > 1 ? 's' : ''})</td>
                    <td className="py-2.5 text-right text-gray-400">{data.nights}</td>
                    <td className="py-2.5 text-right text-gray-400">{fmtEur(data.taxeSejour / data.nights / data.adults)}/pers/nuit</td>
                    <td className="py-2.5 text-right text-gray-600">{fmtEur(data.taxeSejour)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="bg-white border border-[#EDE9FE] rounded-2xl p-5 space-y-2 text-[12.5px]">
            <div className="flex justify-between text-gray-500">
              <span>Total HT</span>
              <span>{fmtEur(data.totalHT)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>TVA 10% (hébergement)</span>
              <span>{fmtEur(data.tva)}</span>
            </div>
            {data.taxeSejour > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Taxe de séjour</span>
                <span>{fmtEur(data.taxeSejour)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-[#EDE9FE]">
              <span className="font-black text-gray-900 text-[15px]">TOTAL TTC</span>
              <span className="font-black text-violet-600 text-[22px]">{fmtEur(data.totalTTC)}</span>
            </div>
          </div>

          {/* Lien de paiement si généré */}
          {data.paymentLink && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">LIEN DE PAIEMENT</p>
              <a href={data.paymentLink} target="_blank" rel="noreferrer"
                className="text-[12.5px] text-violet-600 font-semibold underline break-all">
                {data.paymentLink}
              </a>
              <p className="text-[10px] text-violet-400 mt-1">Ce lien est inclus automatiquement dans l'email de confirmation.</p>
            </div>
          )}

          {/* Notes */}
          {data.notes && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">NOTES & DEMANDES SPÉCIALES</p>
              <p className="text-[12.5px] text-gray-600 bg-[#F5F3FF] rounded-xl p-4">{data.notes}</p>
            </div>
          )}

          {/* Mentions légales */}
          <div className="border-t border-[#EDE9FE] pt-4">
            <p className="text-[10px] text-gray-300 leading-relaxed">
              Ce document est une facture proforma, non contractuelle. Elle ne vaut pas facture définitive.
              La réservation sera confirmée après encaissement de l'acompte ou accord express de l'hôtel.
              Généré automatiquement par FLOWTYM PMS · {data.reference}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#EDE9FE] flex items-center gap-3 bg-white shrink-0">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-[#EDE9FE] bg-[#F5F3FF] rounded-xl text-[12.5px] text-gray-600 font-medium hover:border-violet-300 transition-all">
            <Printer size={13} /> Imprimer
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 border border-[#EDE9FE] bg-[#F5F3FF] rounded-xl text-[12.5px] text-gray-600 font-medium hover:border-violet-300 transition-all">
            <Mail size={13} /> Envoyer par email
          </button>
          <div className="flex-1" />
          <button onClick={onClose}
            className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-[12.5px] transition-all shadow-lg shadow-violet-200">
            <X size={13} /> Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
