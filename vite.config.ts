import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// --- SvelteKit app build (Track B) ---
// The SvelteKit source lives in web/ (not src/, which holds the Python backend).
// adapter-static emits a fully static SPA bundle into web-build/ that FastAPI serves.
// Standalone widgets (Track A) are built separately via vite.widgets.config.ts.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			kit: {
				// SvelteKit source relocated out of src/ (which holds the FastAPI Python backend).
				files: {
					routes: 'web/routes',
					lib: 'web/lib',
					appTemplate: 'web/app.html'
				},
				adapter: adapter({
					// Final static output directory. FastAPI serves this for SvelteKit-owned URLs.
					pages: 'web-build',
					assets: 'web-build',
					// SPA fallback so client-side routing works for any SvelteKit route.
					fallback: 'index.html',
					strict: false
				})
			}
		})
	],
	server: {
		// During `vite dev` (Track B), proxy API + legacy static assets to the FastAPI
		// backend so SvelteKit routes can hit the real API and load the legacy shell.
		proxy: {
			'/api': 'http://localhost:7000',
			'/static': 'http://localhost:7000'
		}
	}
});
