/**
 * FLOWTYM — Configuration Vitest
 *
 * Aligne l'alias `@` sur `frontend/` (comme vite.config.ts) pour que les
 * imports `@/src/...` fonctionnent en test. JSDOM par défaut pour pouvoir
 * tester les engines qui utilisent `window` (event bus).
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

const frontendRoot = path.resolve(__dirname, 'frontend');
const rootNodeModules = path.resolve(__dirname, 'node_modules');

export default defineConfig({
  resolve: {
    alias: {
      '@': frontendRoot,
      // Force single React instance — root copy wins (matches @testing-library/react)
      'react': path.resolve(rootNodeModules, 'react'),
      'react-dom': path.resolve(rootNodeModules, 'react-dom'),
      'react-dom/client': path.resolve(rootNodeModules, 'react-dom/client'),
    },
    // Deduplicate these packages so there is never more than one copy loaded
    dedupe: ['react', 'react-dom', 'zustand', '@tanstack/react-query'],
  },
  test: {
    // jsdom par défaut (les tests Finance utilisent DOMParser). Les tests
    // engines RMS Enterprise n'ont pas besoin de DOM mais tournent quand même.
    environment: 'jsdom',
    // Inline tanstack-query so its React imports go through the alias (single
    // React instance). Without this, @tanstack/react-query in frontend/node_modules
    // loads frontend/node_modules/react instead of the root copy.
    server: {
      deps: {
        inline: ['@tanstack/react-query'],
      },
    },
    globals: true,
    include: ['frontend/src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
  },
});
