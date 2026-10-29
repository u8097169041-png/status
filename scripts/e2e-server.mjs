// Startet den gebauten Server für Ende-zu-Ende-Tests mit einer frischen Datenbank in einem temporären Ordner.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = process.argv[2] ?? '3199';
const dataDir = mkdtempSync(join(tmpdir(), 'socialverse-e2e-'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/server/index.js'], {
  stdio: 'inherit',
  // Ohne ausdrückliche Angaben: keine lokale KI (auch nicht, falls auf dem Testrechner Ollama läuft) und keine Server-KI.
  env: {
    ...process.env,
    PORT: port,
    HOST: '127.0.0.1',
    DATA_DIR: dataDir,
    OPENROUTER_API_KEY: '',
    LOCAL_AI_ENABLED: process.env.LOCAL_AI_ENABLED ?? 'false',
    SERVER_AI_ENABLED: process.env.SERVER_AI_ENABLED ?? 'false',
    SERVER_AI_API_KEY: process.env.SERVER_AI_API_KEY ?? '',
  },
  cwd: process.cwd(),
});
const cleanup = () => {
  child.kill();
  rmSync(dataDir, { recursive: true, force: true });
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
child.on('exit', (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
