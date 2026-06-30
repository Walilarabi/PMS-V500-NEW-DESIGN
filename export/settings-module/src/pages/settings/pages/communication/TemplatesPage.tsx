/**
 * FLOWTYM — Paramètres · Communication · Templates.
 *
 * Liste RÉELLE des modèles (par défaut + surcharges hôtel) via fetchTemplates.
 * L'éditeur CRUD complet (création/modification/suppression par hôtel) arrive
 * au Lot L4/L6 ; cette page affiche les modèles actuellement disponibles.
 */
import React, { useEffect, useState } from 'react';
import { FileText, Mail, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { fetchTemplates, type CommTemplate, type TemplateChannel } from '@/src/services/communication/templates';
import { CommHeader } from './shared';

export const TemplatesPage: React.FC = () => {
  const [channel, setChannel] = useState<TemplateChannel>('email');
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTemplates(channel)
      .then((t) => { if (alive) setTemplates(t); })
      .catch(() => { if (alive) setTemplates([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [channel]);

  return (
    <div className="mx-auto max-w-3xl">
      <CommHeader eyebrow="Communication" title="Templates" subtitle="Modèles de messages réutilisables. Variables : {{guest}}, {{room}}, {{reservation}}, {{checkin}}, {{checkout}}, {{hotel}}." icon={<FileText size={16} className="text-violet-600" />} />

      <div className="mb-5 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <button onClick={() => setChannel('email')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-colors', channel === 'email' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={15} />Email</button>
        <button onClick={() => setChannel('whatsapp')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-colors', channel === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={15} />WhatsApp</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.icon}</span>
                <span className="font-bold text-slate-900">{t.label}</span>
                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.kind}</span>
              </div>
              {t.subject && <p className="mt-3 text-xs font-bold text-slate-400">Objet : <span className="font-medium text-slate-600">{t.subject}</span></p>}
              <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{t.body}</p>
            </div>
          ))}
          <p className="pt-2 text-center text-xs text-slate-400">L'édition des modèles par hôtel (créer / modifier / supprimer) arrive dans un prochain lot.</p>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
