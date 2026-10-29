import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import type { ServerResponse } from 'node:http';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // Local DeepSeek Harness engine (npm run server / Electron main).
      '/api': {
        target: process.env.VITE_HARNESS_DEV_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
        // A dead bridge must yield a JSON error, not an empty body — the UI
        // parses JSON and would otherwise show "Unexpected end of JSON input".
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            if (res instanceof ServerResponse && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'Local harness engine is offline. Start it with: npm run server' }));
          });
        },
      },
      '/health': {
        target: process.env.VITE_HARNESS_DEV_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      // Embedded Flutter web preview compiler + static build output.
      '/preview': {
        target: process.env.VITE_HARNESS_DEV_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
