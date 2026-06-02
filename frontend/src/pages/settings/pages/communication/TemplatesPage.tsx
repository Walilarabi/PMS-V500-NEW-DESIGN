/**
 * FLOWTYM — Paramètres · Communication · Templates.
 *
 * Module complet de gestion des modèles de message PAR HÔTEL :
 *   • liste pleine largeur (grille) des modèles propres à l'hôtel ;
 *   • iconographie moderne par type (lucide), aperçu, état actif ;
 *   • création / édition / suppression (slide-over avec aperçu live) ;
 *   • bibliothèque de modèles hôteliers prêts à l'emploi ;
 *   • paramétrage d'envoi de base (type/déclencheur, langue, activation).
 *
 * Persistance Supabase (table communication_templates, RLS par hôtel).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText, Mail, MessageCircle, Loader2, Plus, Library, Pencil, Trash2,
  CheckCircle2, PauseCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  fetchHotelTemplates, deleteTemplate, TEMPLATE_KIND_META,
  type CommTemplate, type TemplateChannel, type LibraryTemplate,
} from '@/src/services/communication/templates';
import { CommHeader, CommPage, commToast } from './shared';
import { KindBadge } from './templateIcons';
import { TemplateEditorSheet } from './TemplateEditorSheet';
import { TemplateLibraryDrawer } from './TemplateLibraryDrawer';

type EditorState =
  | { mode: 'create'; seed: CommTemplate | null }
  | { mode: 'edit'; template: CommTemplate }
  | null;

export const TemplatesPage: React.FC = () => {
  const [channel, setChannel] = useState<TemplateChannel>('email');
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchHotelTemplates(channel)
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [channel]);

  useEffect(reload, [reload]);

  const isEmail = channel === 'email';

  const handleDelete = async (t: CommTemplate) => {
    if (!t.id || !t.isCustom) return;
    if (!window.confirm(`Supprimer le modèle « ${t.label} » ? Cette action est irréversible.`)) return;
    setDeletingId(t.id);
    try {
      await deleteTemplate(t.id);
      commToast('Modèle supprimé.');
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) {
      commToast((e as Error)?.message ?? 'Échec de la suppression.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const pickFromLibrary = (tpl: LibraryTemplate) => {
    setLibraryOpen(false);
    // Seed = copie du modèle de bibliothèque, en création.
    setEditor({ mode: 'create', seed: { ...tpl, id: '', isCustom: false, isActive: true } });
  };

  return (
    <CommPage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <CommHeader
          eyebrow="Communication"
          title="Modèles de messages"
          subtitle="Composez vos modèles email et WhatsApp. Variables : {{guest}}, {{room}}, {{reservation}}, {{checkin}}, {{checkout}}, {{hotel}}."
          icon={<FileText size={16} className="text-violet-600" />}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLibraryOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Library size={16} className="text-violet-600" /> Bibliothèque
          </button>
          <button
            onClick={() => setEditor({ mode: 'create', seed: null })}
            className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg', isEmail ? 'bg-violet-600 shadow-violet-200' : 'bg-emerald-600 shadow-emerald-200')}
          >
            <Plus size={16} /> Nouveau modèle
          </button>
        </div>
      </div>

      {/* Sélecteur de canal */}
      <div className="mb-6 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <button onClick={() => setChannel('email')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-colors', channel === 'email' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={15} />Email</button>
        <button onClick={() => setChannel('whatsapp')} className={cn('flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-colors', channel === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={15} />WhatsApp</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>
      ) : templates.length === 0 ? (
        <EmptyState isEmail={isEmail} onCreate={() => setEditor({ mode: 'create', seed: null })} onLibrary={() => setLibraryOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {templates.map((t) => (
            <article key={t.id} className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <KindBadge kind={t.kind} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-slate-900">{t.label}</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{TEMPLATE_KIND_META[t.kind].label}</p>
                </div>
                <span
                  className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', t.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}
                  title={t.isActive ? 'Modèle actif' : 'Modèle désactivé'}
                >
                  {t.isActive ? <CheckCircle2 size={11} /> : <PauseCircle size={11} />}
                  {t.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {isEmail && t.subject && (
                <p className="mt-3 line-clamp-1 text-xs text-slate-500"><span className="font-bold text-slate-400">Objet : </span>{t.subject}</p>
              )}
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">{t.body}</p>

              <div className="mt-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                <button
                  onClick={() => setEditor({ mode: 'edit', template: t })}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  <Pencil size={13} /> Modifier
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  disabled={deletingId === t.id}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                >
                  {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <TemplateEditorSheet
          channel={channel}
          template={editor.mode === 'edit' ? editor.template : editor.seed}
          isNew={editor.mode === 'create'}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); reload(); }}
        />
      )}

      {libraryOpen && (
        <TemplateLibraryDrawer channel={channel} onPick={pickFromLibrary} onClose={() => setLibraryOpen(false)} />
      )}
    </CommPage>
  );
};

const EmptyState: React.FC<{ isEmail: boolean; onCreate: () => void; onLibrary: () => void }> = ({ isEmail, onCreate, onLibrary }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-12 text-center">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
      <FileText className="h-6 w-6" strokeWidth={1.75} />
    </span>
    <h3 className="mt-4 text-lg font-bold text-slate-900">Aucun modèle {isEmail ? 'email' : 'WhatsApp'} pour l'instant</h3>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
      Démarrez à partir de la bibliothèque hôtelière ou composez votre propre modèle à partir de zéro.
    </p>
    <div className="mt-5 flex items-center justify-center gap-2">
      <button onClick={onLibrary} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
        <Library size={16} className="text-violet-600" /> Parcourir la bibliothèque
      </button>
      <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200">
        <Plus size={16} /> Nouveau modèle
      </button>
    </div>
  </div>
);

export default TemplatesPage;
