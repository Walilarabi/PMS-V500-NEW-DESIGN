import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const frontendRoot = path.resolve(__dirname, 'frontend');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');
  return {
    // Vite utilise frontend/ comme racine — index.html, src/, public/ s'y trouvent
    root: frontendRoot,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        // '@' résolu depuis la racine frontend/
        '@': frontendRoot,
      },
    },
    build: {
      // dist/ relatif à root (frontend/) → frontend/dist/
      // Vercel lit rootDirectory: "frontend" donc cherche dist/ dans frontend/
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Chunking manuel pour réduire le bundle principal (actuellement 2.2 MB)
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
      // HMR actif par défaut, désactivable via DISABLE_HMR=true
      hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      allowedHosts: true,
    },
  };
});
