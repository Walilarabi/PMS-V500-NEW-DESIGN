/**
 * FLOWTYM — FecExportModal
 * Modal DGFiP conforme NF Z 47-006 : preview + téléchargement + hash SHA-256.
 */
import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Eye, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import * as repo from '@/src/domains/finance/repository';
import type { FecEntry } from '@/src/domains/finance/schemas';
import { useActiveHotel } from '@/src/domains/hotel/hooks';

interface FecExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

async function sha256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const FecExportModal = ({ isOpen, onClose }: FecExportModalProps) => {
  const { data: hotel } = useActiveHotel();

  const today = new Date().toISOString().split('T')[0];
  const janFirst = `${new Date().getFullYear()}-01-01`;

  const [fromDate, setFromDate] = useState(janFirst);
  const [toDate, setToDate] = useState(today);
  const [entries, setEntries] = useState<FecEntry[]>([]);
  const [preview, setPreview] = useState<{
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    filename: string;
    content: string;
    hash?: string;
    journaux: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setEntries([]);
      setPreview(null);
      setError(null);
    }
  }, [isOpen]);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedEntries = await repo.generateFecEntries(fromDate, toDate);
      setEntries(fetchedEntries);

      const siren = hotel?.siret?.replace(/\s/g, '').slice(0, 9) ?? '000000000';
      const built = repo.buildFecBuffer(fetchedEntries, siren);

      // Calcul journaux (groupés par JournalCode)
      const journaux: Record<string, number> = {};
      for (const e of fetchedEntries) {
        journaux[e.JournalCode] = (journaux[e.JournalCode] ?? 0) + 1;
      }

      // SHA-256 du contenu
      const hash = await sha256(built.content);

      setPreview({ ...built, hash, journaux });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!preview) return;
    setSaving(true);

    try {
      // Téléchargement navigateur
      const blob = new Blob([preview.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = preview.filename;
      a.click();
      URL.revokeObjectURL(url);

      // Enregistrement trace immutable en DB
      const siren = hotel?.siret?.replace(/\s/g, '').slice(0, 9) ?? null;
      await repo.saveFecExport({
        period_from: fromDate,
        period_to: toDate,
        siren,
        filename: preview.filename,
        entries_count: entries.length,
        total_debit: preview.totalDebit,
        total_credit: preview.totalCredit,
        is_balanced: preview.isBalanced,
        sha256_hash: preview.hash,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#8B5CF6]/10 rounded-2xl text-[#8B5CF6]">
                  <FileText size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Compliance · DGFiP
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Export FEC</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Fichier des Écritures Comptables — Article L47 A du LPF
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Date range */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setPreview(null); }}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
                    Date de fin (clôture)
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setPreview(null); }}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                  />
                </div>
              </div>

              {/* Hotel info */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-gray-900">{hotel?.name ?? '—'}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    SIREN · {hotel?.siret?.slice(0, 9) ?? '000000000'}
                  </p>
                </div>
                {preview && (
                  <Badge
                    variant={preview.isBalanced ? 'success' : 'error'}
                    className="flex items-center gap-1.5 px-3 py-1.5"
                  >
                    {preview.isBalanced ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertCircle size={12} />
                    )}
                    {preview.isBalanced ? 'Balance équilibrée' : 'Déséquilibre détecté'}
                  </Badge>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Preview stats */}
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Écritures
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Total Débit
                      </p>
                      <p className="text-xl font-bold text-gray-900">{fmt(preview.totalDebit)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Total Crédit
                      </p>
                      <p className="text-xl font-bold text-gray-900">{fmt(preview.totalCredit)}</p>
                    </div>
                  </div>

                  {/* Journaux */}
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                      Journaux
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(preview.journaux).map(([code, count]) => (
                        <Badge key={code} variant="neutral" className="text-xs font-mono px-3 py-1">
                          {code} · {count}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Format info */}
                  <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl text-xs text-amber-800 leading-relaxed">
                    <span className="font-bold">Format DGFiP : </span>
                    fichier texte pipe-délimité (UTF-8), 18 colonnes obligatoires (JournalCode,
                    EcritureNum, CompteNum, Débit, Crédit…). Nom du fichier :{' '}
                    <span className="font-mono">{preview.filename}</span>
                  </div>

                  {/* SHA-256 */}
                  {preview.hash && (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Empreinte SHA-256 (preuve d'intégrité)
                      </p>
                      <p className="text-[10px] font-mono text-gray-600 break-all">{preview.hash}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3 rounded-b-[32px]">
              <Button variant="ghost" className="font-bold h-11 px-5" onClick={onClose}>
                Annuler
              </Button>

              {!preview ? (
                <Button
                  onClick={handlePreview}
                  disabled={loading}
                  className={cn(
                    'h-11 px-6 font-bold gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                  )}
                  variant="outline"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Eye size={16} />
                  )}
                  Aperçu
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handlePreview}
                    disabled={loading}
                    variant="outline"
                    className="h-11 px-5 font-bold gap-2 bg-white border-gray-200 text-gray-600"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                    Recalculer
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={saving || !preview.isBalanced}
                    className="h-11 px-8 font-bold gap-2 bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20 hover:bg-[#7C3AED] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Télécharger FEC
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
