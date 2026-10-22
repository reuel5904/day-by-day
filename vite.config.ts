import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: '/day-by-day/',
  plugins: [react()],
  publicDir: 'public',
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
});
