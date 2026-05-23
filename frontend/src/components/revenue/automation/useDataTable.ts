/**
 * FLOWTYM — Hook tableaux : recherche + tri + pagination
 *
 * Partagé entre le tableau des règles tactiques et celui des garde-fous.
 * Stateless côté serveur : tout est calculé en mémoire.
 */
import { useMemo, useState, useCallback } from 'react';

export type SortDir = 'asc' | 'desc';

export interface UseDataTableOptions<T> {
  /** Champs à scanner pour le filtre texte (peut être un getter). */
  searchFields: ((row: T) => string)[];
  /** Page size par défaut (10). */
  pageSize?: number;
  /** Reset à la page 1 quand le filtre change (true par défaut). */
  resetPageOnFilter?: boolean;
}

export interface UseDataTableState<T> {
  // Filtrage
  search: string;
  setSearch: (v: string) => void;

  // Tri
  sortKey: string | null;
  sortDir: SortDir;
  toggleSort: (key: string, getter: (row: T) => string | number | undefined) => void;

  // Pagination
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;

  // Données dérivées
  visible: T[];           // page courante après filtre + tri
  filtered: T[];          // après filtre uniquement
  totalPages: number;
  totalRows: number;
}

export function useDataTable<T>(rows: T[], opts: UseDataTableOptions<T>): UseDataTableState<T> {
  const [search, setSearchRaw] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortGetter, setSortGetter] = useState<((row: T) => string | number | undefined) | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts.pageSize ?? 10);

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v);
    if (opts.resetPageOnFilter !== false) setPage(1);
  }, [opts.resetPageOnFilter]);

  const toggleSort = useCallback((key: string, getter: (row: T) => string | number | undefined) => {
    if (sortKey === key) {
      // Cycle asc → desc → none
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortGetter(null);
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
      setSortGetter(() => getter);
    }
  }, [sortKey, sortDir]);

  const filtered = useMemo<T[]>(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) =>
      opts.searchFields.some((getter) => {
        const v = getter(row);
        return typeof v === 'string' && v.toLowerCase().includes(q);
      }),
    );
  }, [rows, search, opts.searchFields]);

  const sorted = useMemo<T[]>(() => {
    if (!sortKey || !sortGetter) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortGetter(a);
      const vb = sortGetter(b);
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'fr', { numeric: true }) * dir;
    });
  }, [filtered, sortKey, sortGetter, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  return {
    search,
    setSearch,
    sortKey,
    sortDir,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    visible,
    filtered: sorted,
    totalPages,
    totalRows: sorted.length,
  };
}
