import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Frontend unit tests only. Server tests are `node --test` files — run them
// with `npm run test:server`; mixing them into vitest used to report 5 bogus
// "No test suite found" failures on `npx vitest run`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['server/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
