import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ReportCategory } from '@/src/domains/analytics/types/analytics.types';

export interface AnalyticsHistoryItem {
  code: string;
  label: string;
  category: ReportCategory;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  fiscal: boolean;
  rowsCount: number;
}

interface AnalyticsState {
  activeCategory: ReportCategory | 'all';
  activeReportCode: string;
  shortcutBuffer: string;
  history: AnalyticsHistoryItem[];
  setActiveCategory: (category: ReportCategory | 'all') => void;
  setActiveReportCode: (code: string) => void;
  appendShortcutDigit: (digit: string) => void;
  clearShortcut: () => void;
  addHistoryItem: (item: AnalyticsHistoryItem) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      activeCategory: 'all',
      activeReportCode: '51010',
      shortcutBuffer: '',
      history: [],
      setActiveCategory: (category) => set({ activeCategory: category }),
      setActiveReportCode: (code) =>
        set({
          activeReportCode: code,
          shortcutBuffer: '',
        }),
      appendShortcutDigit: (digit) =>
        set((state) => ({
          shortcutBuffer: `${state.shortcutBuffer}${digit}`.slice(-5),
        })),
      clearShortcut: () => set({ shortcutBuffer: '' }),
      addHistoryItem: (item) =>
        set((state) => {
          const itemKey = `${item.code}:${item.periodFrom}:${item.periodTo}`;
          const deduped = state.history.filter(
            (entry) => `${entry.code}:${entry.periodFrom}:${entry.periodTo}` !== itemKey,
          );
          return { history: [item, ...deduped].slice(0, 50) };
        }),
    }),
    {
      name: 'flowtym-analytics-ui',
      partialize: (state) => ({
        activeCategory: state.activeCategory,
        activeReportCode: state.activeReportCode,
        history: state.history,
      }),
    },
  ),
);
