import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  dbFile: string;
  openRouterApiKey: string | null;
  openRouterBaseUrl: string;
  production: boolean;
  version: string;
}

export const APP_VERSION = '0.1.0';

/** Lädt .env (falls vorhanden) und liest die Konfiguration aus Umgebungsvariablen. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): AppConfig {
  const envFile = resolve(cwd, '.env');
  if (env === process.env && existsSync(envFile)) {
    try {
      process.loadEnvFile(envFile);
    } catch (error) {
      console.warn('[config] .env konnte nicht gelesen werden:', (error as Error).message);
    }
  }
  const dataDir = resolve(cwd, env.DATA_DIR?.trim() || './data');
  const port = Number.parseInt(env.PORT ?? '3001', 10);
  const key = env.OPENROUTER_API_KEY?.trim();
  return {
    port: Number.isFinite(port) && port > 0 && port < 65536 ? port : 3001,
    host: env.HOST?.trim() || '127.0.0.1',
    dataDir,
    dbFile: resolve(dataDir, 'socialverse.db'),
    openRouterApiKey: key ? key : null,
    openRouterBaseUrl: (env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    production: env.NODE_ENV === 'production',
    version: APP_VERSION,
  };
}
