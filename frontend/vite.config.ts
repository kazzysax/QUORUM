import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The landing page is the static public/index.html served at "/". The application is the Vite
// entry app/index.html, built to dist/app/index.html and served at "/app".
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { app: resolve(__dirname, 'app/index.html') },
    },
  },
  server: {
    port: 3000,
    host: '127.0.0.1',
  },
  preview: {
    port: 3000,
    host: '127.0.0.1',
  },
});
