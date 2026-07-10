// Loads the real browser markdown renderer (static/js/markdown.js) under Node by
// mocking the minimal browser globals it touches and stubbing its sibling imports.
// This mirrors the loader in tests/test_markdown_rendering_js.py so the streaming
// tests exercise the exact same renderer the browser runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export async function loadMarkdown() {
  globalThis.window = { location: { origin: 'http://localhost' }, katex: null };
  globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    createElement(tag) {
      if (tag !== 'template') throw new Error(`unsupported element: ${tag}`);
      return {
        _html: '',
        content: {
          querySelectorAll() {
            return [];
          },
        },
        set innerHTML(v) {
          this._html = v;
        },
        get innerHTML() {
          return this._html;
        },
      };
    },
  };
  globalThis.MutationObserver = class {
    observe() {}
  };

  let src = fs.readFileSync(
    path.join(REPO, 'web/lib/legacy/markdown.js'),
    'utf8',
  );

  // Remove ui.js import entirely
  src = src.replace(
    /import\s+[^;]*['"]\.\/ui\.js['"]\s*;/g,
    ''
  );

  // Inline splitTableRow instead of importing tableRow.js
  src = src.replace(
    /import\s+[^;]*tableRow\.js['"]\s*;/g,
    `function splitTableRow(row) {
      return (row || '').replace(/^\\s*\\|/, '').replace(/\\|\\s*$/, '')
        .split('|').map(c => c.trim());
    }`
  );

  // Load emojiShortcodes.js and convert it to inline code
  const emoji = fs.readFileSync(path.join(REPO, 'web/lib/legacy/emojiShortcodes.js'), 'utf8')
    .replace(/^export default .*$/m, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');

  // Inline ANY import referencing emojiShortcodes.js (do this BEFORE stripping $lib)
  src = src.replace(
    /import\s+[^;]*emojiShortcodes\.js['"]\s*;/g,
    () => emoji,
  );

  // NOW strip ALL SvelteKit alias imports ($lib/...)
  src = src.replace(
    /import\s+[^;]*['"]\$lib\/[^'"]+['"]\s*;/g,
    ''
  );

  src = src.replace(
    /var escapeHtml = uiModule\.esc;/,
    () =>
    `var escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');`
  );

  const url =
    'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  return import(url);
}

// Canonicalize rendered HTML so two renders that produce the SAME DOM compare
// equal. Collapses only newline-bearing whitespace BETWEEN tags (`>\n\n<` ->
// `><`): it is insignificant in rendered HTML, and incremental finalization
// legitimately emits `\n\n` between two blocks where a single full render emits
// `\n`. Code whitespace is safe because code is HTML-escaped, so significant
// newlines live inside <code> as text (never between a `>` and a `<`). Inline
// single spaces between tags are left alone. Structural differences (two <ul> vs
// one, <ol> vs <ul>) survive normalization and still fail, as they must.
// Mermaid ids embed Date.now(), so they are normalized too.
export function normalizeRender(html) {
  return String(html)
    .replace(/>\s*\n\s*</g, '><')
    .trim()
    .replace(/(mermaid|thinking)-\d+-\d+/g, '$1-X');
}
