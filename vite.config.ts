import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const backendPort = Number(process.env.PORT ?? 3001);

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    root: '.',
    projects: [
      {
        extends: false,
        test: {
          name: 'server',
          root: '.',
          include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'client',
          root: '.',
          include: ['client/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
