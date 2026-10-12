import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

/** Short git commit of the build, shown as the version label; "-dirty" when there are uncommitted changes. */
function gitVersion() {
  try {
    const sha = execSync('git rev-parse --short=10 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '-dirty' : '';
    return sha + dirty;
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 10) ?? 'unknown';
  }
}
const GIT_SHA = gitVersion();

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

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Source map `mappings` → lines of segments with absolute values. */
function decodeMappings(mappings) {
  const state = [0, 0, 0, 0, 0];
  return mappings.split(';').map((line) => {
    state[0] = 0; // generated column resets per line
    return line ? line.split(',').map((seg) => {
      const out = [];
      for (let i = 0, field = 0; i < seg.length; field++) {
        let value = 0, shift = 0, digit;
        do {
          digit = B64.indexOf(seg[i++]);
          value += (digit & 31) << shift;
          shift += 5;
        } while (digit & 32);
        state[field] += value & 1 ? -(value >>> 1) : value >>> 1;
        out.push(state[field]);
      }
      return out;
    }) : [];
  });
}

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1, out = '';
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v) digit |= 32;
    out += B64[digit];
  } while (v);
  return out;
}

function encodeMappings(lines) {
  const state = [0, 0, 0, 0, 0];
  return lines.map((line) => {
    state[0] = 0;
    return line.map((seg) => seg.map((value, f) => { const d = value - state[f]; state[f] = value; return vlq(d); }).join('')).join(',');
  }).join(';');
}

/** The rewrites viteSingleFile applies when inlining a script (see its replaceScript()). */
const INLINE_REWRITES = [[/"?__VITE_PRELOAD__"?/g, () => 'void 0'], [/<(\/script>|!--)/g, (_, tag) => `\\x3C${tag}`]];

/** Applies one rewrite to `code`, moving the generated columns of `lines` along. */
function rewrite(code, lines, re, fn) {
  const matches = [...code.matchAll(re)];
  for (const m of matches.toReversed()) { // right to left: earlier offsets stay valid
    const rep = fn(...m);
    const line = code.slice(0, m.index).split('\n').length - 1;
    const col = m.index - code.lastIndexOf('\n', m.index - 1) - 1;
    const delta = rep.length - m[0].length;
    for (const seg of lines[line] ?? []) if (seg[0] > col) seg[0] = Math.max(col, seg[0] + delta);
    code = code.slice(0, m.index) + rep + code.slice(m.index + m[0].length);
  }
  return code;
}

/**
 * Source maps for error reports (Sentry). vite-plugin-singlefile inlines the JS into
 * index.html, so browsers report stack frames as page line:column, not script ones.
 * This applies singlefile's inlining rewrites first (so the map can follow them; its own
 * pass then finds nothing left to change), shifts the chunk's hidden source map by the
 * script's offset inside the page and writes it as dist/index.html.map
 * (`file: app:///index.html`, matching BUNDLE_URL in src/monitoring/sentry.ts).
 * The deploy workflow uploads it and deletes every .map before publishing: never public.
 */
function inlineSourceMap() {
  let chunk = null;
  let lines = null;
  return {
    name: 'inline-source-map',
    apply: 'build',
    generateBundle(_options, bundle) {
      // runs before viteSingleFile (plugin order), while the chunk still exists
      chunk = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && c.map) ?? null;
      if (!chunk) return;
      lines = decodeMappings(chunk.map.mappings);
      let code = chunk.code.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '');
      for (const [re, fn] of INLINE_REWRITES) code = rewrite(code, lines, re, fn);
      if (/^\s/.test(code)) throw new Error('inline-source-map: chunk starts with whitespace');
      chunk.code = code.trimEnd();
    },
    writeBundle({ dir }) {
      if (!chunk) return;
      for (const name of readdirSync(dir)) if (name.endsWith('.map')) rmSync(join(dir, name));
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      const at = html.indexOf(chunk.code);
      if (at < 0) throw new Error('inline-source-map: inlined script not found in index.html');
      const before = html.slice(0, at).split('\n');
      const col = before.at(-1).length;
      for (const seg of lines[0]) seg[0] += col;
      const map = { ...chunk.map, file: 'app:///index.html', mappings: ';'.repeat(before.length - 1) + encodeMappings(lines) };
      writeFileSync(join(dir, 'index.html.map'), JSON.stringify(map));
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
  plugins: [inlineSourceMap(), viteSingleFile(), fullReloadOnCode(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION), __GIT_SHA__: JSON.stringify(GIT_SHA) },
  resolve: { alias: preactAliases },
  server: {
    watch: isWSL ? { usePolling: true, interval: 150 } : undefined,
  },
  esbuild: { legalComments: 'none' },
  build: {
    target: 'es2020',
    sourcemap: 'hidden',
    assetsInlineLimit: 100000000,
    // terser squeezes a few % more than esbuild's minifier; drop console noise in production
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_console: ['log', 'debug', 'info'], pure_getters: true },
      format: { comments: false },
    },
  },
});
