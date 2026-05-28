import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useHelpArticles, useUpsertArticle, useDeleteArticle } from '@/src/services/support/hooks';
import { HELP_MODULES, type HelpArticle, type UpsertArticleInput } from '@/src/services/support/help.service';

// ─── Article editor ───────────────────────────────────────────────────────────

interface EditorProps {
  initial?: HelpArticle;
  onSave: (input: UpsertArticleInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

const ArticleEditor: React.FC<EditorProps> = ({ initial, onSave, onCancel, isSaving }) => {
  const [module,      setModule]      = useState(initial?.module ?? HELP_MODULES[0]);
  const [title,       setTitle]       = useState(initial?.title ?? '');
  const [excerpt,     setExcerpt]     = useState(initial?.excerpt ?? '');
  const [body,        setBody]        = useState(initial?.body ?? '');
  const [tags,        setTags]        = useState((initial?.tags ?? []).join(', '));
  const [sortOrder,   setSortOrder]   = useState(initial?.sort_order ?? 0);
  const [published,   setPublished]   = useState(initial?.is_published ?? false);

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    await onSave({
      id:           initial?.id,
      module,
      title:        title.trim(),
      excerpt:      excerpt.trim() || undefined,
      body:         body.trim(),
      tags:         tags.split(',').map(t => t.trim()).filter(Boolean),
      sort_order:   sortOrder,
      is_published: published,
    });
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors placeholder:text-gray-300 bg-white';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{initial ? 'Modifier l\'article' : 'Nouvel article'}</h3>
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Module *</label>
          <select value={module} onChange={e => setModule(e.target.value)} className={inputCls + ' appearance-none cursor-pointer'}>
            {HELP_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Ordre d'affichage</label>
          <input type="number" min={0} value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Titre *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'article…" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Résumé</label>
        <input value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Courte description visible dans la liste…" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Contenu * <span className="normal-case font-normal text-[10px]">Markdown supporté : # Titre, ## Section, - liste, **gras**, 1. numéroté</span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Contenu de l'article en Markdown…"
          rows={14}
          className={inputCls + ' resize-y font-mono text-[12px]'}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tags (séparés par des virgules)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="réservation, client, facturation…" className={inputCls} />
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={published}
            onChange={e => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-[#8B5CF6]"
          />
          <span className="text-[13px] text-gray-600 font-medium">Publier l'article (visible par tous les utilisateurs)</span>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="px-3.5 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-500 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !body.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold hover:bg-[#7C3AED] disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const AdminArticles: React.FC = () => {
  const { data: articles = [], isLoading } = useHelpArticles({ includeUnpublished: true });
  const upsert  = useUpsertArticle();
  const remove  = useDeleteArticle();

  const [editing,   setEditing]   = useState<HelpArticle | null | 'new'>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [moduleFilter, setFilter] = useState<string>('all');

  const filtered = moduleFilter === 'all' ? articles : articles.filter(a => a.module === moduleFilter);

  const handleSave = async (input: UpsertArticleInput) => {
    await upsert.mutateAsync(input);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Articles d'aide</h2>
          <p className="text-sm text-gray-400 mt-0.5">{articles.filter(a => a.is_published).length} publiés · {articles.filter(a => !a.is_published).length} brouillons</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold hover:bg-[#7C3AED] transition-colors"
        >
          <Plus size={14} /> Nouvel article
        </button>
      </div>

      {/* Module filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')} className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors', moduleFilter === 'all' ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
          Tous
        </button>
        {HELP_MODULES.map(m => (
          <button key={m} onClick={() => setFilter(m)} className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors', moduleFilter === m ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
            {m}
          </button>
        ))}
      </div>

      {/* Editor */}
      {editing && (
        <ArticleEditor
          initial={editing === 'new' ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          isSaving={upsert.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">Confirmer la suppression de cet article ?</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleting(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-500 bg-white">Annuler</button>
            <button onClick={() => handleDelete(deleting)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[12px] font-bold">Supprimer</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Article</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-gray-400 text-sm" colSpan={5}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center" colSpan={5}>
                  <BookOpen size={24} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">Aucun article dans ce module.</p>
                </td>
              </tr>
            ) : filtered.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/60 transition-colors group">
                <td className="px-4 py-3.5">
                  <div className="text-[13px] font-bold text-gray-900">{a.title}</div>
                  {a.excerpt && <div className="text-[12px] text-gray-400 truncate max-w-xs">{a.excerpt}</div>}
                </td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] text-[11px] font-bold rounded-lg">{a.module}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-md">#{t}</span>
                    ))}
                    {a.tags.length > 3 && <span className="text-[10px] text-gray-400">+{a.tags.length - 3}</span>}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {a.is_published ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <Eye size={10} /> Publié
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      <EyeOff size={10} /> Brouillon
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setEditing(a)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(a.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
