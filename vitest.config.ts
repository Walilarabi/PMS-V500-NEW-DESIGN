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

export default defineConfig({
  resolve: {
    alias: {
      '@': frontendRoot,
    },
  },
  test: {
    // jsdom par défaut (les tests Finance utilisent DOMParser). Les tests
    // engines RMS Enterprise n'ont pas besoin de DOM mais tournent quand même.
    environment: 'jsdom',
    globals: true,
    include: ['frontend/src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/setup.ts'],
  },
});
