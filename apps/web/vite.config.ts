import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    target: 'es2020',
    sourcemap: mode === 'production' ? 'hidden' : true,
    minify: 'esbuild',
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          query: ['@tanstack/react-query'],
          fullcalendar: [
            '@fullcalendar/core',
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/interaction',
            '@fullcalendar/rrule',
            'rrule',
          ],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['lucide-react', 'sonner', 'clsx'],
        },
      },
    },
  },
  esbuild:
    mode === 'production'
      ? { legalComments: 'none', pure: ['console.log', 'console.debug'] }
      : {},
}));
