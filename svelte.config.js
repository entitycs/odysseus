import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  compilerOptions: {
    // Force runes mode except for node_modules
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
  },
  kit: {
    files: {
      routes: 'web/routes',
      lib: 'web/lib',
      appTemplate: 'web/app.html',
    },
    adapter: adapter({
      pages: 'web-build',
      assets: 'web-build',
      fallback: 'index.html', // issue? - see nonce in app.html
      strict: true,
    }),
  },
  preprocess: [
    vitePreprocess({
      style: false, // does not stop stripping from precompiled
      script: false, // default value
    }),
  ],
};

export default config;
