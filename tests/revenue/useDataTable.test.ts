/**
 * FLOWTYM — Tests useDataTable (recherche + tri + pagination)
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataTable } from '@/src/components/revenue/automation/useDataTable';

interface Row {
  name: string;
  category: string;
  value: number;
}

const ROWS: Row[] = [
  { name: 'Alpha', category: 'A', value: 30 },
  { name: 'Bravo', category: 'B', value: 10 },
  { name: 'Charlie', category: 'A', value: 50 },
  { name: 'Delta', category: 'C', value: 20 },
  { name: 'Echo', category: 'B', value: 40 },
];

describe('useDataTable', () => {
  it('expose tous les rows par défaut', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name],
      pageSize: 10,
    }));
    expect(result.current.totalRows).toBe(5);
    expect(result.current.visible.length).toBe(5);
  });

  it('filtre via la recherche', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name, (r) => r.category],
      pageSize: 10,
    }));
    act(() => result.current.setSearch('alp'));
    expect(result.current.totalRows).toBe(1);
    expect(result.current.visible[0].name).toBe('Alpha');
  });

  it('cherche dans plusieurs champs (multifield)', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name, (r) => r.category],
      pageSize: 10,
    }));
    act(() => result.current.setSearch('a'));
    // Alpha, Bravo, Charlie, Delta contain 'a' in name OR category 'A'
    expect(result.current.totalRows).toBeGreaterThanOrEqual(4);
  });

  it('tri ascendant puis descendant puis aucun', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name],
      pageSize: 10,
    }));

    act(() => result.current.toggleSort('value', (r) => r.value));
    expect(result.current.visible[0].value).toBe(10);
    expect(result.current.sortDir).toBe('asc');

    act(() => result.current.toggleSort('value', (r) => r.value));
    expect(result.current.visible[0].value).toBe(50);
    expect(result.current.sortDir).toBe('desc');

    act(() => result.current.toggleSort('value', (r) => r.value));
    expect(result.current.sortKey).toBeNull();
  });

  it('pagination respecte pageSize', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name],
      pageSize: 2,
    }));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.visible.length).toBe(2);

    act(() => result.current.setPage(2));
    expect(result.current.visible.length).toBe(2);

    act(() => result.current.setPage(3));
    expect(result.current.visible.length).toBe(1);
  });

  it('reset à page 1 quand le filtre change', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name],
      pageSize: 2,
    }));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.setSearch('a'));
    expect(result.current.page).toBe(1);
  });

  it('safePage clamp si la page courante dépasse totalPages après filtrage', () => {
    const { result } = renderHook(() => useDataTable(ROWS, {
      searchFields: [(r) => r.name],
      pageSize: 2,
    }));
    act(() => result.current.setPage(3));
    act(() => result.current.setSearch('z')); // aucun match
    // setSearch reset à page 1, totalPages devient 1 (aucun résultat → 1 page vide)
    expect(result.current.page).toBe(1);
    expect(result.current.totalRows).toBe(0);
  });
});
