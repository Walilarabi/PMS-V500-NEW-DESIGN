import React, { useMemo, useState } from 'react';
import { Search, BookOpen, ChevronRight, FileText, Hash } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useHelpArticles } from '@/src/services/support/hooks';
import type { HelpArticle } from '@/src/services/support/help.service';

// ─── Mini markdown renderer (headings, bold, lists, paragraphs) ───────────────

const renderInline = (text: string): React.ReactNode => {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-bold text-gray-900">{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>,
  );
};

const Markdown: React.FC<{ source: string }> = ({ source }) => {
  const lines = source.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length) {
      blocks.push(
        <ul key={key} className="my-2 space-y-1 pl-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };

  const flushOrdered = (key: string) => {
    if (orderedBuffer.length) {
      blocks.push(
        <ol key={key} className="my-2 space-y-1.5">
          {orderedBuffer.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      orderedBuffer = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) {
      flushList(`ul-${idx}`); flushOrdered(`ol-${idx}`);
      blocks.push(<h2 key={idx} className="text-base font-bold text-gray-900 mt-4 mb-1.5 first:mt-0">{line.replace(/^#\s+/, '')}</h2>);
    } else if (/^##\s+/.test(line)) {
      flushList(`ul-${idx}`); flushOrdered(`ol-${idx}`);
      blocks.push(<h3 key={idx} className="text-sm font-bold text-gray-800 mt-3 mb-1">{line.replace(/^##\s+/, '')}</h3>);
    } else if (/^-\s+/.test(line)) {
      flushOrdered(`ol-${idx}`);
      listBuffer.push(line.replace(/^-\s+/, ''));
    } else if (/^\d+\.\s+/.test(line)) {
      flushList(`ul-${idx}`);
      orderedBuffer.push(line.replace(/^\d+\.\s+/, ''));
    } else if (line === '') {
      flushList(`ul-${idx}`); flushOrdered(`ol-${idx}`);
    } else {
      flushList(`ul-${idx}`); flushOrdered(`ol-${idx}`);
      blocks.push(<p key={idx} className="text-[13px] text-gray-600 leading-relaxed my-1.5">{renderInline(line)}</p>);
    }
  });
  flushList('ul-end'); flushOrdered('ol-end');

  return <div>{blocks}</div>;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const DocumentationView: React.FC = () => {
  const { data: articles = [], isLoading } = useHelpArticles();
  const [search, setSearch]       = useState('');
  const [activeId, setActiveId]   = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt?.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q)),
    );
  }, [articles, search]);

  const byModule = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    filtered.forEach(a => {
      const arr = map.get(a.module) ?? [];
      arr.push(a);
      map.set(a.module, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const active = articles.find(a => a.id === activeId)
    ?? filtered[0]
    ?? null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex min-h-[520px]">
      {/* Left nav — modules + articles */}
      <div className="w-72 border-r border-gray-100 flex flex-col shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans l'aide…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Article list grouped by module */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-4 text-[13px] text-gray-400">Chargement…</div>
          ) : byModule.length === 0 ? (
            <div className="p-4 text-[13px] text-gray-400 text-center">Aucun article trouvé.</div>
          ) : byModule.map(([module, items]) => (
            <div key={module} className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <Hash size={10} />
                {module}
              </div>
              <div className="space-y-0.5">
                {items.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActiveId(a.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                      active?.id === a.id
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                        : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="text-[13px] font-medium truncate">{a.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto">
        {active ? (
          <article className="p-6 max-w-2xl">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#8B5CF6] mb-2">
              <BookOpen size={12} />
              {active.module}
              <ChevronRight size={11} className="text-gray-300" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{active.title}</h1>
            {active.excerpt && <p className="text-sm text-gray-400 mb-4">{active.excerpt}</p>}
            {active.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {active.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-medium rounded-lg">#{t}</span>
                ))}
              </div>
            )}
            <div className="border-t border-gray-100 pt-4">
              <Markdown source={active.body} />
            </div>
          </article>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <BookOpen size={32} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Sélectionnez un article pour le consulter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentationView;
