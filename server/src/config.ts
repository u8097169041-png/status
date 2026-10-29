import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Lokale KI-Laufzeit (Ollama). Kostenlos; Daten bleiben auf dem Rechner bzw. im eigenen Netz. */
export interface LocalAiConfig {
  enabled: boolean;
  baseUrl: string;
  /** Fest vorgegebenes Modell; leer = in der App wählen bzw. automatisch aus den installierten Modellen. */
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

/**
 * Zentraler, OpenAI-kompatibler KI-Dienst (z. B. OpenRouter oder ein eigener Server).
 * Wird nur verwendet, wenn der Betreiber ihn hier ausdrücklich aktiviert UND der Nutzer ihn in der App freigibt.
 * Der Schlüssel existiert ausschließlich im Backend-Prozess.
 */
export interface ServerAiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  worldModel: string;
  timeoutMs: number;
  maxTokens: number;
  maxRequestsPerDay: number;
  maxRequestsPerMinute: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  /** Preise in USD pro 1 Mio. Tokens; null = unbekannt (dann wird die Preisliste des Dienstes abgefragt). */
  priceInputPerMTok: number | null;
  priceOutputPerMTok: number | null;
}

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  dbFile: string;
  localAi: LocalAiConfig;
  serverAi: ServerAiConfig;
  production: boolean;
  version: string;
}

export const APP_VERSION = '0.1.0';

export const DEFAULT_LOCAL_AI_URL = 'http://127.0.0.1:11434';
export const DEFAULT_SERVER_AI_URL = 'https://openrouter.ai/api/v1';

function bool(value: string | undefined, fallback: boolean): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'ja', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'nein', 'off'].includes(v)) return false;
  return fallback;
}

/** Ganze Zahl im erlaubten Bereich; ungültige Werte fallen auf den sicheren Standard zurück. */
function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function num(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseFloat(value?.trim() ?? '');
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function optionalNum(value: string | undefined, max: number): number | null {
  if (!value?.trim()) return null;
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

/** Nur http(s)-Adressen ohne Zugangsdaten in der URL; sonst der Standard. */
function url(value: string | undefined, fallback: string): string {
  const raw = value?.trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return fallback;
    return raw.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

const MODEL_RE = /^[A-Za-z0-9._:/@-]{1,120}$/;
function model(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return MODEL_RE.test(v) ? v : '';
}

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
  // OPENROUTER_API_KEY/OPENROUTER_BASE_URL aus Version 1 werden als Server-KI-Zugang übernommen,
  // aktivieren die Server-KI aber nicht von selbst (SERVER_AI_ENABLED=true ist zusätzlich nötig).
  const key = env.SERVER_AI_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim();
  return {
    port: Number.isFinite(port) && port > 0 && port < 65536 ? port : 3001,
    host: env.HOST?.trim() || '127.0.0.1',
    dataDir,
    dbFile: resolve(dataDir, 'socialverse.db'),
    localAi: {
      enabled: bool(env.LOCAL_AI_ENABLED, true),
      baseUrl: url(env.LOCAL_AI_BASE_URL, DEFAULT_LOCAL_AI_URL),
      model: model(env.LOCAL_AI_MODEL),
      timeoutMs: int(env.LOCAL_AI_TIMEOUT_MS, 60_000, 2_000, 300_000),
      maxTokens: int(env.LOCAL_AI_MAX_TOKENS, 350, 32, 2_000),
    },
    serverAi: {
      enabled: bool(env.SERVER_AI_ENABLED, false),
      baseUrl: url(env.SERVER_AI_BASE_URL || env.OPENROUTER_BASE_URL, DEFAULT_SERVER_AI_URL),
      apiKey: key ? key : null,
      model: model(env.SERVER_AI_MODEL),
      worldModel: model(env.SERVER_AI_WORLD_MODEL),
      timeoutMs: int(env.SERVER_AI_TIMEOUT_MS, 20_000, 2_000, 120_000),
      maxTokens: int(env.SERVER_AI_MAX_TOKENS, 400, 32, 4_000),
      maxRequestsPerDay: int(env.SERVER_AI_MAX_REQUESTS_PER_DAY, 200, 0, 100_000),
      maxRequestsPerMinute: int(env.SERVER_AI_MAX_REQUESTS_PER_MINUTE, 6, 0, 1_000),
      dailyBudgetUsd: num(env.SERVER_AI_DAILY_BUDGET_USD, 0.2, 0, 10_000),
      monthlyBudgetUsd: num(env.SERVER_AI_MONTHLY_BUDGET_USD, 2, 0, 100_000),
      priceInputPerMTok: optionalNum(env.SERVER_AI_PRICE_INPUT_PER_MTOK, 1_000),
      priceOutputPerMTok: optionalNum(env.SERVER_AI_PRICE_OUTPUT_PER_MTOK, 1_000),
    },
    production: env.NODE_ENV === 'production',
    version: APP_VERSION,
  };
}
