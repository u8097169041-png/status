// Baut die eigenständige Handy-Version des Lebensmodus als eine einzige HTML-Datei (ohne Server, ohne KI).
// Die Spiellogik stammt aus server/src/life; Datenbank und IDs werden durch Browser-Varianten ersetzt.
// Aufruf: node scripts/build-mobile.mjs [ausgabe.html]
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'dist/mobile/socialverse-leben.html');
const shims = {
  name: 'browser-shims',
  setup(b) {
    b.onResolve({ filter: /\/db\/database$/ }, () => ({ path: resolve('mobile/shims/database.ts') }));
    b.onResolve({ filter: /\/lib\/ids$/ }, () => ({ path: resolve('mobile/shims/ids.ts') }));
  },
};
const result = await build({
  entryPoints: ['mobile/main.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  plugins: [shims],
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync('mobile/page.html', 'utf8').replace('/*__APP__*/', () => js);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Handy-Version: ${out} (${(page.length / 1024).toFixed(0)} KB)`);
