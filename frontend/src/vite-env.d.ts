/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// jspdf-autotable n'expose pas de types officiels — déclaration minimale.
declare module 'jspdf-autotable' {
  import type { jsPDF } from 'jspdf';
  export interface AutoTableOptions {
    head?: (string | number)[][];
    body?: (string | number)[][];
    startY?: number;
    theme?: 'grid' | 'striped' | 'plain';
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<string | number, Record<string, unknown>>;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    didParseCell?: (data: {
      section: 'head' | 'body' | 'foot';
      column: { index: number };
      row: { index: number };
      cell: { styles: Record<string, unknown> };
    }) => void;
    didDrawPage?: (data: { pageNumber: number }) => void;
  }
  function autoTable(doc: jsPDF, options: AutoTableOptions): void;
  export default autoTable;
}
