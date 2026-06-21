import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// --- SvelteKit app build (Track B) ---
// The SvelteKit source lives in web/ (not src/, which holds the Python backend).
// adapter-static emits a fully static SPA bundle into web-build/ that FastAPI serves.
// Standalone widgets (Track A) are built separately via vite.widgets.config.ts.
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // During `vite dev` (Track B), proxy API + legacy static assets to the FastAPI
    // backend so SvelteKit routes can hit the real API and load the legacy shell.
    proxy: {
      '/api': 'http://localhost:7000',
      '/static': 'http://localhost:7000',
    },
  },
});
