/**
 * Vitest global setup — environnement jsdom.
 *
 * lib/supabase.ts throw au load si VITE_SUPABASE_URL est absent. Vitest
 * propage automatiquement les variables process.env préfixées VITE_ vers
 * import.meta.env. On utilise vi.stubEnv qui est la voie officielle.
 */
import { vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.invalid');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
