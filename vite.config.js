import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// WSL2: edits made from Windows (e.g. an editor on \\wsl$) don't emit inotify
// events, so the watcher must poll to notice them.
const isWSL = (() => {
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { return false; }
})();

/** Full page reload on any code change: the game holds a PIXI app, audio context and
 *  global listeners that partial HMR would duplicate. CSS still hot-swaps in place. */
function fullReloadOnCode() {
  return {
    name: 'full-reload-on-code',
    handleHotUpdate({ file, server }) {
      if (/\.(tsx?|js|html)$/.test(file)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

/** Content hash of everything that ends up in the build: same code = same version, so a
 *  rebuild without changes never makes players see a (false) update. */
function sourceVersion() {
  const hash = createHash('sha256');
  const walk = (dir) => {
    for (const name of readdirSync(dir).toSorted()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (!/\.test\.tsx?$/.test(name)) hash.update(path).update(readFileSync(path));
    }
  };
  walk('src');
  walk('public');
  for (const f of ['index.html', 'package-lock.json', 'vite.config.js']) hash.update(f).update(readFileSync(f));
  return hash.digest('hex').slice(0, 10);
}
const APP_VERSION = sourceVersion();

/** Writes dist/version.json, which the running game polls to detect a newer deploy. */
function versionFile() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) });
    },
  };
}

/** The code is written against React's API, but runs on Preact (same API, ~10 KB instead
 *  of ~200 KB for react-dom) to keep the single-file download small on mobile. */
export const preactAliases = [
  { find: /^react$/, replacement: 'preact/compat' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react-dom\/test-utils$/, replacement: 'preact/test-utils' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-runtime' },
];

// `npm run build` emits one self-contained dist/index.html (all JS/CSS inlined).
export default defineConfig({
  base: './', // works under any GitHub Pages sub-path
  plugins: [viteSingleFile(), fullReloadOnCode(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: { alias: preactAliases },
  server: {
    watch: isWSL ? { usePolling: true, interval: 150 } : undefined,
  },
  esbuild: { legalComments: 'none' },
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    // terser squeezes a few % more than esbuild's minifier; drop console noise in production
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_console: ['log', 'debug', 'info'], pure_getters: true },
      format: { comments: false },
    },
  },
});
