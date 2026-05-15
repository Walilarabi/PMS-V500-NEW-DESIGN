/**
 * FLOWTYM — FEC Export (Fichier des Écritures Comptables) view.
 *
 * Permet à l'utilisateur direction d'exporter les écritures comptables sur
 * une période donnée au format DGFiP réglementaire. Affiche d'abord un
 * preview (compteur lignes, équilibre Débit=Crédit, journaux) puis propose
 * le téléchargement du fichier `.txt` final.
 */
import React, { useState } from 'react';
import { Download, FileSpreadsheet, Check, AlertCircle, BookOpen, Calculator } from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { supabase } from '@/src/lib/supabase';

interface FecPreview {
  rows: number;
  total_debit: number;
  total_credit: number;
  balanced: boolean;
  journals: Record<string, number>;
  hotel_name: string;
  siren: string;
}

const apiBase = (import.meta.env.VITE_BACKEND_URL as string | undefined)
  ?? (import.meta.env.REACT_APP_BACKEND_URL as string | undefined)
  ?? window.location.origin;

const FecExportView: React.FC = () => {
  const hotelQ = useActiveHotel();
  const { toast } = useToast();
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = `${now.getFullYear()}-12-31`;
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [loading, setLoading] = useState<'preview' | 'download' | null>(null);
  const [preview, setPreview] = useState<FecPreview | null>(null);

  const callApi = async <T = unknown>(path: string): Promise<{ data?: T; blob?: Blob; status: number; fileName?: string }> => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error('Session expirée — reconnectez-vous.');
    const url = `${apiBase.replace(/\/$/, '')}${path}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      let err = `HTTP ${resp.status}`;
      try { const j = await resp.json(); err = (j as { detail?: string }).detail ?? err; } catch { /* noop */ }
      throw new Error(err);
    }
    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await resp.json()) as T;
      return { data, status: resp.status };
    }
    const cd = resp.headers.get('content-disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(cd);
    const fileName = match ? match[1] : 'fec.txt';
    return { blob: await resp.blob(), status: resp.status, fileName };
  };

  const handlePreview = async () => {
    setLoading('preview');
    setPreview(null);
    try {
      const qs = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      const { data } = await callApi<FecPreview>(`/api/fec/preview?${qs}`);
      if (data) setPreview(data);
    } catch (e) {
      toast({ title: 'Échec preview', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async () => {
    setLoading('download');
    try {
      const qs = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      const { blob, fileName } = await callApi<Blob>(`/api/fec/export?${qs}`);
      if (!blob) throw new Error('Réponse vide');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName ?? 'fec.txt';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'FEC exporté', description: fileName ?? '', variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec export', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const fmtEUR = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FB] font-sans text-gray-900" data-testid="fec-page">
      <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <header>
          <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">Finance · Comptabilité</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1" data-testid="fec-title">
            Export FEC — Fichier des Écritures Comptables
            <span className="text-gray-400 font-normal text-xl ml-2">· {hotelQ.data?.name ?? '—'}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Génère un fichier DGFiP réglementaire pipe-délimité couvrant ventes et encaissements
            pour la période demandée (norme française — article L47 A du LPF, format obligatoire pour les contrôles fiscaux).
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5" data-testid="fec-config">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><BookOpen size={20} /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Période d'export</h2>
              <p className="text-xs text-gray-500">Sélectionnez l'exercice fiscal à exporter (1er janvier → 31 décembre par défaut).</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Date de début</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="fec-from"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Date de fin</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="fec-to"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={handlePreview} disabled={loading !== null}
                data-testid="fec-preview-btn"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold">
                <Calculator size={14} /> {loading === 'preview' ? 'Calcul…' : 'Calculer aperçu'}
              </button>
            </div>
          </div>
        </section>

        {preview && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4" data-testid="fec-preview-result">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Aperçu du fichier FEC</h3>
                <p className="text-xs text-gray-500">SIREN détecté : <span className="font-mono">{preview.siren || '—'}</span> · Hôtel : <span className="font-bold">{preview.hotel_name || '—'}</span></p>
              </div>
              <span data-testid="fec-balanced-badge" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${preview.balanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {preview.balanced ? <Check size={14} /> : <AlertCircle size={14} />}
                {preview.balanced ? 'Équilibré (D = C)' : 'NON équilibré'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Lignes écritures" value={String(preview.rows)} tone="violet" data-testid="fec-kpi-rows" />
              <Kpi label="Total Débit" value={fmtEUR(preview.total_debit)} tone="emerald" />
              <Kpi label="Total Crédit" value={fmtEUR(preview.total_credit)} tone="amber" />
              <Kpi label="Journaux" value={String(Object.keys(preview.journals).length)} tone="violet" hint={Object.entries(preview.journals).map(([k, n]) => `${k}: ${n}`).join(' · ')} />
            </div>
            <button type="button" onClick={handleDownload} disabled={loading !== null || preview.rows === 0}
              data-testid="fec-download-btn"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
              <Download size={14} /> {loading === 'download' ? 'Génération…' : 'Télécharger le fichier FEC'}
            </button>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3" data-testid="fec-help">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-amber-600" />
            <h3 className="text-sm font-bold text-gray-900">À savoir avant l'export</h3>
          </div>
          <ul className="list-disc pl-6 text-sm text-gray-600 space-y-1.5">
            <li>Format normé <strong>DGFiP</strong> : 18 colonnes pipe-délimitées (`|`), encodage UTF-8 + CRLF.</li>
            <li>Nom de fichier <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;SIREN&gt;FEC&lt;YYYYMMDD&gt;.txt</code> conforme à la norme.</li>
            <li>Les écritures sont générées depuis les <strong>factures</strong> (journal VE) et les <strong>encaissements</strong> (journal BQ), avec ventilation HT / TVA / TTC.</li>
            <li>Plan comptable utilisé : 411xxx (Clients) · 707000 (Ventes) · 445710 (TVA collectée) · 512xxx (Banque) · 530000 (Caisse).</li>
            <li>Vérifiez que votre <strong>SIRET</strong> est correctement renseigné dans <em>Fiche Établissement</em>. Pour l'instant : <span className="font-mono">{preview?.siren || hotelQ.data?.siret || '—'}</span></li>
          </ul>
        </section>
      </main>
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; tone: 'violet' | 'emerald' | 'amber'; hint?: string; 'data-testid'?: string }> = ({ label, value, tone, hint, ...rest }) => {
  const toneClass = { violet: 'bg-violet-50 text-violet-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' }[tone];
  return (
    <div className={`rounded-2xl border border-gray-100 p-4 ${toneClass}`} data-testid={rest['data-testid']}>
      <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[10px] mt-1 opacity-60 font-mono">{hint}</p>}
    </div>
  );
};

export default FecExportView;
