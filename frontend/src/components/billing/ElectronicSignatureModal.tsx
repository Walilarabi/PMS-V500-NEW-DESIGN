/**
 * FLOWTYM — ElectronicSignatureModal (T18).
 * Canvas tactile + sauvegarde en Supabase (UPDATE invoices SET signature_data)
 */
import React, { useRef, useEffect, useState } from 'react';
import { PenLine, Trash2, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import { useQueryClient } from '@tanstack/react-query';

interface SignatureData {
  dataUrl: string;
  signedAt: string;
  invoiceNumber: string;
}

interface ElectronicSignatureModalProps {
  isOpen: boolean;
  invoiceId: string;
  invoiceNumber: string;
  onClose: () => void;
  onSigned?: () => void;
}

// ─── SignatureCanvas ──────────────────────────────────────────────────────────

function SignatureCanvas({
  onCapture,
  onClear,
}: {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const hasStrokes = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasStrokes.current = true;
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasStrokes.current && canvasRef.current) {
      onCapture(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onClear();
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 touch-none select-none">
        <canvas
          ref={canvasRef}
          width={560}
          height={160}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-gray-300 pointer-events-none select-none">
          Signez ici
        </p>
      </div>
      <button
        onClick={clear}
        className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        type="button"
      >
        <Trash2 size={11} /> Effacer
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ElectronicSignatureModal({
  isOpen,
  invoiceId,
  invoiceNumber,
  onClose,
  onSigned,
}: ElectronicSignatureModalProps) {
  const qc = useQueryClient();
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCapturedUrl(null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!capturedUrl) return;
    setError(null);
    setIsPending(true);
    try {
      const signatureData: SignatureData = {
        dataUrl:       capturedUrl,
        signedAt:      new Date().toISOString(),
        invoiceNumber,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase as any)
        .from('invoices')
        .update({ signature_data: signatureData })
        .eq('id', invoiceId);
      if (dbErr) throw mapSupabaseError(dbErr);
      await writeAuditLog({
        entity: 'invoice',
        entity_id: invoiceId,
        action: 'SIGN',
        payload: { signed_at: signatureData.signedAt, invoice_number: invoiceNumber },
      });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      setSuccess(true);
      setTimeout(() => { onSigned?.(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <PenLine size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Signature électronique</h2>
            <p className="text-xs text-gray-400">Facture {invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle size={40} className="text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700">Signature enregistrée</p>
          </div>
        ) : (
          <>
            <SignatureCanvas
              onCapture={(url) => setCapturedUrl(url)}
              onClear={() => setCapturedUrl(null)}
            />

            {capturedUrl && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-600" />
                <span className="text-xs text-emerald-700">Signature capturée — prête à enregistrer</span>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={!capturedUrl || isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Valider la signature
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
