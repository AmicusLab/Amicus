import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    target: 'esnext',
  },
});
