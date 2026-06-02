/**
 * FLOWTYM — Bibliothèque de modèles hôteliers (slide-over).
 *
 * Galerie de modèles prêts à l'emploi pour le milieu hôtelier, regroupés par
 * étape du parcours client. Sélectionner un modèle ouvre l'éditeur pré-rempli
 * pour le personnaliser puis l'enregistrer comme modèle propre à l'hôtel.
 */
import React, { useMemo } from 'react';
import { X, Library, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { libraryFor, type LibraryTemplate, type TemplateChannel } from '@/src/services/communication/templates';
import { KindBadge } from './templateIcons';

interface Props {
  channel: TemplateChannel;
  onPick: (tpl: LibraryTemplate) => void;
  onClose: () => void;
}

export const TemplateLibraryDrawer: React.FC<Props> = ({ channel, onPick, onClose }) => {
  const grouped = useMemo(() => {
    const items = libraryFor(channel);
    const map = new Map<string, LibraryTemplate[]>();
    for (const it of items) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return [...map.entries()];
  }, [channel]);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-screen w-full max-w-[640px] bg-slate-50 shadow-2xl flex flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <Library className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Bibliothèque hôtelière</h2>
            <p className="truncate text-xs text-slate-500">Modèles prêts à l'emploi — cliquez pour personnaliser et enregistrer.</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {grouped.map(([category, items]) => (
            <section key={category} className="mb-6 last:mb-0">
              <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{category}</h3>
              <div className="space-y-2.5">
                {items.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => onPick(tpl)}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm',
                      'transition-colors hover:border-violet-200 hover:bg-violet-50/30',
                    )}
                  >
                    <KindBadge kind={tpl.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{tpl.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{tpl.description}</p>
                      <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">{tpl.body}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-violet-500" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default TemplateLibraryDrawer;
