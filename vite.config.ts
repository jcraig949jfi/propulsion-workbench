import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built site works at any GitHub Pages path
// (https://<user>.github.io/<repo>/) without hard-coding the repository name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
