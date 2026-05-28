import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // loadEnv charge les fichiers .env depuis le dossier courant (frontend/)
  // ET expose aussi les variables process.env qui commencent par VITE_
  // Le 3e argument '' signifie : charger TOUTES les variables (pas seulement VITE_)
  const env = loadEnv(mode, '.', '');

  // Les VITE_* sont automatiquement exposées via import.meta.env par Vite
  // MAIS seulement si elles sont dans un .env file ou passées en process.env
  // Vercel injecte ses env{} dans process.env → on les récupère ici
  const supabaseUrl =
    env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';

  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Injection explicite pour garantir que import.meta.env les voit
      // même quand elles viennent de process.env (cas Vercel)
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-query': ['@tanstack/react-query'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
            'vendor-motion': ['motion'],
            'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
            'vendor-forms': ['react-hook-form', 'zod'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      allowedHosts: true,
    },
  };
});
