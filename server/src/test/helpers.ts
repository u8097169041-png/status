import { AiService } from '../ai/aiService';
import type { FetchFn } from '../ai/types';
import { createApp } from '../app';
import type { AppConfig } from '../config';
import type { AppContext } from '../context';
import { openDatabase } from '../db/database';
import { seedIfEmpty } from '../db/seed';
import { joinWorld } from '../services/players';
import type { Lang } from '../../../shared/constants';

export interface TestContext extends AppContext {
  setNow: (date: Date) => void;
  advance: (minutes: number) => void;
  fetchCalls: { url: string; body: unknown }[];
}

export type MockHandler = (url: string, body: unknown) => { status: number; json: unknown } | Promise<{ status: number; json: unknown }>;

export const TEST_CONFIG: AppConfig = {
  port: 0,
  host: '127.0.0.1',
  dataDir: ':memory:',
  dbFile: ':memory:',
  localAi: {
    enabled: true,
    baseUrl: 'http://ollama.test:11434',
    model: '',
    timeoutMs: 5_000,
    maxTokens: 350,
  },
  serverAi: {
    enabled: false,
    baseUrl: 'https://openrouter.test/api/v1',
    apiKey: null,
    model: '',
    worldModel: '',
    timeoutMs: 5_000,
    maxTokens: 400,
    maxRequestsPerDay: 200,
    maxRequestsPerMinute: 6,
    dailyBudgetUsd: 0.2,
    monthlyBudgetUsd: 2,
    priceInputPerMTok: null,
    priceOutputPerMTok: null,
  },
  production: false,
  version: 'test',
};

/** Erzeugt einen vollständigen Anwendungskontext mit In-Memory-Datenbank und simuliertem OpenRouter. */
export function createTestContext(
  opts: { lang?: Lang; handler?: MockHandler; config?: Partial<AppConfig>; seed?: boolean; dbFile?: string } = {},
): TestContext {
  const db = openDatabase(opts.dbFile ?? ':memory:');
  let current = new Date('2026-10-27T10:00:00.000Z');
  const now = () => new Date(current);
  const fetchCalls: { url: string; body: unknown }[] = [];
  const fetchFn: FetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    fetchCalls.push({ url, body });
    const handler = opts.handler ?? (() => ({ status: 500, json: { error: { message: 'no handler' } } }));
    const signal = init?.signal;
    const aborted = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const result = await Promise.race([Promise.resolve(handler(url, body)), aborted]);
    // Status 0 simuliert einen Verbindungsfehler (z. B. kein Internet oder Dienst nicht gestartet).
    if (result.status === 0) throw new TypeError('fetch failed');
    return new Response(JSON.stringify(result.json), { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }) as FetchFn;
  const config = { ...TEST_CONFIG, ...opts.config };
  const ctx: TestContext = {
    db,
    config,
    now,
    ai: new AiService(db, config, now, fetchFn),
    setNow: (date) => {
      current = date;
    },
    advance: (minutes) => {
      current = new Date(current.getTime() + minutes * 60_000);
    },
    fetchCalls,
  };
  if (opts.seed !== false) seedIfEmpty(db, now(), opts.lang ?? 'de');
  return ctx;
}

export function createTestApp(ctx: AppContext) {
  return createApp(ctx, { clientDir: null });
}

/** Standardantworten eines simulierten OpenRouter-Servers. */
export function openRouterMock(options: {
  reply?: string;
  failModels?: Record<string, number>;
  cost?: number | null;
  models?: { id: string; prompt: string; completion: string }[];
} = {}): MockHandler {
  return (url, body) => {
    if (url.endsWith('/models')) {
      return {
        status: 200,
        json: {
          data: (options.models ?? [
            { id: 'test/free-model', prompt: '0', completion: '0' },
            { id: 'test/paid-model', prompt: '0.000001', completion: '0.000002' },
          ]).map((m) => ({ id: m.id, name: m.id, context_length: 8000, pricing: { prompt: m.prompt, completion: m.completion } })),
        },
      };
    }
    if (url.endsWith('/key')) return { status: 200, json: { data: { label: 'test' } } };
    const model = (body as { model: string }).model;
    const failure = options.failModels?.[model];
    if (failure) return { status: failure, json: { error: { message: `fail ${failure}`, code: failure } } };
    return {
      status: 200,
      json: {
        model,
        choices: [{ message: { content: options.reply ?? 'Hallo aus der KI!' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30, ...(options.cost === null ? {} : { cost: options.cost ?? 0.0001 }) },
      },
    };
  };
}

/** Simulierte lokale KI-Laufzeit (Ollama-API). */
export function ollamaMock(
  options: {
    models?: string[];
    reply?: string | ((body: { model: string; messages: { content: string }[]; format?: string }) => string);
    chatStatus?: number;
    delayMs?: number;
    down?: boolean;
  } = {},
): MockHandler {
  const models = options.models ?? ['gemma3:4b', 'nomic-embed-text:latest'];
  return async (url, body) => {
    if (options.down) return { status: 0, json: null };
    if (url.endsWith('/api/version')) return { status: 200, json: { version: '0.9.0' } };
    if (url.endsWith('/api/tags')) {
      return {
        status: 200,
        json: {
          models: models.map((name) => ({
            name,
            size: 3_300_000_000,
            details: { family: name.includes('embed') ? 'nomic-bert' : 'gemma3', families: name.includes('embed') ? ['nomic-bert'] : ['gemma3'], parameter_size: '4.3B' },
          })),
        },
      };
    }
    if (url.endsWith('/api/chat')) {
      if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
      if (options.chatStatus) return { status: options.chatStatus, json: { error: `model not found, try pulling it first` } };
      const req = body as { model: string; messages: { content: string }[]; format?: string };
      const reply =
        typeof options.reply === 'function'
          ? options.reply(req)
          : (options.reply ?? JSON.stringify({ reply: 'Lokale Antwort der Figur.', tone: 'warm' }));
      return { status: 200, json: { model: req.model, message: { role: 'assistant', content: reply }, done: true, prompt_eval_count: 300, eval_count: 25 } };
    }
    return { status: 404, json: { error: 'not found' } };
  };
}

/** Leitet Anfragen je nach Adresse an die lokale bzw. die Server-Simulation weiter. */
export function routeMocks(local: MockHandler | null, server: MockHandler | null): MockHandler {
  return (url, body) => {
    const handler = url.includes('ollama.test') ? local : server;
    return handler ? handler(url, body) : { status: 0, json: null };
  };
}

/** Tritt einer Welt mit einer eigenen Spielfigur bei (für Tests, die Beiträge oder Chats brauchen). */
export function joinAsCustom(ctx: AppContext, worldId: string, name = 'Testfigur'): string {
  return joinWorld(ctx, worldId, {
    mode: 'custom',
    character: { name, role: 'Neuankömmling', background: 'Kommt aus einer anderen Stadt.', personality: ['neugierig'], goals: ['Freunde finden'] },
  }).player.id;
}
