// Bündelt das Backend mit esbuild nach dist/server/index.js.
// Abhängigkeiten aus node_modules werden nicht eingebündelt.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/src/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
});
