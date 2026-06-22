import adapter from '@sveltejs/adapter-static';

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
};

export default config;
