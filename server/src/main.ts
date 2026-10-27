import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AiService } from './ai/aiService';
import { createApp } from './app';
import { loadConfig } from './config';
import type { AppContext } from './context';
import { openDatabase } from './db/database';
import { seedIfEmpty } from './db/seed';
import { startScheduler } from './services/scheduler';

const config = loadConfig();
const db = openDatabase(config.dbFile);
const now = () => new Date();
const ctx: AppContext = { db, config, now, ai: new AiService(db, config, now) };

if (seedIfEmpty(db, now())) console.log('[db] Neue Datenbank angelegt und mit Demo-Inhalten gefüllt.');

// Im Produktionsbuild liegt das Frontend unter dist/client (relativ zu dist/server/index.js).
const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, '../client');
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const app = createApp(ctx, { clientDir, allowedHosts });
const stopScheduler = startScheduler(ctx);

const server = app.listen(config.port, config.host, () => {
  const url = `http://localhost:${config.port}`;
  console.log('');
  console.log('  SocialVerse läuft.');
  console.log(`  API:       ${url}/api/health`);
  console.log(`  Daten:     ${config.dbFile}`);
  console.log(`  KI-Modus:  ${ctx.ai.status().mode === 'ai' ? 'OpenRouter aktiv' : 'Lokaler Demo-Modus'}`);
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.log(`  Hinweis:   Der Server ist an ${config.host} gebunden und ggf. im Netzwerk erreichbar.`);
  }
  console.log('');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[server] Port ${config.port} ist bereits belegt. Läuft SocialVerse schon? Sonst PORT in .env ändern.`);
  } else {
    console.error('[server] Start fehlgeschlagen:', error.message);
  }
  process.exit(1);
});

function shutdown() {
  stopScheduler();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
