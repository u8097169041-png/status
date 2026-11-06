import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiService } from '../ai/aiService';
import { ImageService } from '../images/imageService';
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

/** Antwort eines simulierten Dienstes; `ndjson` liefert eine gestreamte Antwort (Zeilen mit Pause dazwischen). */
export interface MockResult {
  status: number;
  json?: unknown;
  ndjson?: { lines: unknown[]; firstDelayMs?: number; delayMs?: number };
  /** Binärantwort (z. B. ein Bild). */
  raw?: { data: Buffer; type: string };
}
export type MockHandler = (url: string, body: unknown) => MockResult | Promise<MockResult>;

export const TEST_CONFIG: AppConfig = {
  port: 0,
  host: '127.0.0.1',
  dataDir: ':memory:',
  dbFile: ':memory:',
  uploadsDir: join(tmpdir(), 'socialverse-test-uploads'),
  localAi: {
    enabled: true,
    baseUrl: 'http://ollama.test:11434',
    model: '',
    timeoutMs: 5_000,
    longTimeoutMs: 10_000,
    loadTimeoutMs: 5_000,
    idleTimeoutMs: 2_000,
    maxTokens: 350,
  },
  imageAi: {
    backend: 'auto',
    sdwebuiUrl: 'http://sd.test:7860',
    comfyuiUrl: 'http://comfy.test:8188',
    comfyCheckpoint: '',
    steps: 20,
    cfg: 5,
    portraitSize: '',
    sceneSize: '',
    timeoutMs: 5_000,
  },
  serverAi: {
    enabled: false,
    baseUrl: 'https://openrouter.test/api/v1',
    apiKey: null,
    model: '',
    worldModel: '',
    timeoutMs: 5_000,
    longTimeoutMs: 10_000,
    maxTokens: 400,
    maxTokensLong: 2_200,
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
    const handler: MockHandler = opts.handler ?? (() => ({ status: 500, json: { error: { message: 'no handler' } } }));
    const signal = init?.signal;
    const aborted = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const result = await Promise.race([Promise.resolve(handler(url, body)), aborted]);
    // Status 0 simuliert einen Verbindungsfehler (z. B. kein Internet oder Dienst nicht gestartet).
    if (result.status === 0) throw new TypeError('fetch failed');
    if (result.ndjson) {
      const { lines, firstDelayMs = 0, delayMs = 0 } = result.ndjson;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const wait = (ms: number) =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, ms);
              signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
          try {
            for (let i = 0; i < lines.length; i++) {
              await wait(i === 0 ? firstDelayMs : delayMs);
              controller.enqueue(encoder.encode(`${JSON.stringify(lines[i])}\n`));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
      return new Response(stream, { status: result.status, headers: { 'Content-Type': 'application/x-ndjson' } });
    }
    if (result.raw) return new Response(new Uint8Array(result.raw.data), { status: result.status, headers: { 'Content-Type': result.raw.type } });
    return new Response(JSON.stringify(result.json), { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }) as FetchFn;
  // Eigener Upload-Ordner je Testkontext, damit parallel laufende Tests sich nicht gegenseitig Dateien löschen.
  const config = { ...TEST_CONFIG, uploadsDir: mkdtempSync(join(tmpdir(), 'socialverse-test-uploads-')), ...opts.config };
  const ctx: TestContext = {
    db,
    config,
    now,
    ai: new AiService(db, config, now, fetchFn),
    images: new ImageService(db, config, now, fetchFn, 5),
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
    reply?: string | ((body: { model: string; messages: { content: string }[]; format?: unknown }) => string);
    chatStatus?: number;
    /** Wartezeit bis zum ersten Token (z. B. Laden des Modells). */
    delayMs?: number;
    /** Pause zwischen zwei Tokens (Generierungsgeschwindigkeit). */
    tokenDelayMs?: number;
    /** Antwort wird in so viele Tokens zerlegt. */
    chunks?: number;
    doneReason?: 'stop' | 'length';
    version?: string;
    down?: boolean;
  } = {},
): MockHandler {
  const models = options.models ?? ['gemma3:4b', 'nomic-embed-text:latest'];
  return async (url, body) => {
    if (options.down) return { status: 0, json: null };
    if (url.endsWith('/api/version')) return { status: 200, json: { version: options.version ?? '0.9.0' } };
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
      if (options.chatStatus) return { status: options.chatStatus, json: { error: `model not found, try pulling it first` } };
      const req = body as { model: string; messages: { content: string }[]; format?: unknown };
      const reply =
        typeof options.reply === 'function'
          ? options.reply(req)
          : (options.reply ?? JSON.stringify({ reply: 'Lokale Antwort der Figur.', tone: 'warm' }));
      // Wie Ollama: gestreamte Zeilen mit je einem Textstück, zuletzt eine Zeile mit done = true und Statistik.
      const parts = Math.max(1, Math.min(options.chunks ?? 4, reply.length));
      const size = Math.ceil(reply.length / parts);
      const lines: unknown[] = [];
      for (let i = 0; i < reply.length; i += size) {
        lines.push({ model: req.model, message: { role: 'assistant', content: reply.slice(i, i + size) }, done: false });
      }
      lines.push({
        model: req.model,
        message: { role: 'assistant', content: '' },
        done: true,
        done_reason: options.doneReason ?? 'stop',
        prompt_eval_count: 300,
        eval_count: lines.length,
        eval_duration: lines.length * 100_000_000,
      });
      return { status: 200, ndjson: { lines, firstDelayMs: options.delayMs ?? 0, delayMs: options.tokenDelayMs ?? 0 } };
    }
    return { status: 404, json: { error: 'not found' } };
  };
}

/** Leitet Anfragen je nach Adresse an die lokale KI, die Server-KI bzw. die Bild-KI-Simulation weiter. */
export function routeMocks(local: MockHandler | null, server: MockHandler | null, images: MockHandler | null = null): MockHandler {
  return (url, body) => {
    const handler = url.includes('ollama.test') ? local : url.includes('sd.test') || url.includes('comfy.test') ? images : server;
    return handler ? handler(url, body) : { status: 0, json: null };
  };
}

/** Kleinste gültige PNG-Datei (1×1). */
export const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f1d0000000049454e44ae426082',
  'hex',
);

export interface ImageCall {
  prompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
}

/** Simulierte Stable-Diffusion-WebUI/Forge (A1111-API). Jedes Bild ist eindeutig (Seed im Inhalt). */
export function sdWebUiMock(options: { model?: string; down?: boolean; status?: number; delayMs?: number; calls?: ImageCall[] } = {}): MockHandler {
  return async (url, body) => {
    if (!url.includes('sd.test') || options.down) return { status: 0, json: null };
    if (url.endsWith('/sdapi/v1/options')) return { status: 200, json: { sd_model_checkpoint: options.model ?? 'juggernautXL_v9.safetensors [abc]' } };
    if (url.endsWith('/sdapi/v1/txt2img')) {
      const b = body as { prompt: string; negative_prompt: string; width: number; height: number; seed: number };
      options.calls?.push({ prompt: b.prompt, negative: b.negative_prompt, width: b.width, height: b.height, seed: b.seed });
      if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
      if (options.status) return { status: options.status, json: { error: 'boom' } };
      const unique = Buffer.concat([TINY_PNG, Buffer.from(`seed:${b.seed}:${b.prompt.length}`)]);
      return { status: 200, json: { images: [unique.toString('base64')], info: '{}' } };
    }
    return { status: 404, json: { detail: 'Not Found' } };
  };
}

/** Simulierte ComfyUI-API (Warteschlange, Verlauf, Bildabruf). */
export function comfyUiMock(options: { checkpoints?: string[]; calls?: ImageCall[]; pendingPolls?: number } = {}): MockHandler {
  let polls = 0;
  const done = new Set<string>();
  return (url, body) => {
    if (!url.includes('comfy.test')) return { status: 0, json: null };
    if (url.endsWith('/system_stats')) return { status: 200, json: { system: { os: 'nt' }, devices: [{ name: 'cuda:0 NVIDIA GeForce RTX 3060', vram_total: 12_884_901_888 }] } };
    if (url.endsWith('/object_info/CheckpointLoaderSimple')) {
      return { status: 200, json: { CheckpointLoaderSimple: { input: { required: { ckpt_name: [options.checkpoints ?? ['realisticVisionV60_v60B1.safetensors']] } } } } };
    }
    if (url.endsWith('/prompt')) {
      const graph = (body as { prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }> }).prompt;
      const pos = Object.values(graph).filter((n) => n.class_type === 'CLIPTextEncode');
      const latent = Object.values(graph).find((n) => n.class_type === 'EmptyLatentImage')!;
      const sampler = Object.values(graph).find((n) => n.class_type === 'KSampler')!;
      options.calls?.push({ prompt: String(pos[0].inputs.text), negative: String(pos[1].inputs.text), width: Number(latent.inputs.width), height: Number(latent.inputs.height), seed: Number(sampler.inputs.seed) });
      const id = `p${options.calls?.length ?? 1}-${Number(sampler.inputs.seed)}`;
      done.add(id);
      return { status: 200, json: { prompt_id: id, number: 1 } };
    }
    const history = /\/history\/([^/?]+)$/.exec(url);
    if (history) {
      if (polls++ < (options.pendingPolls ?? 1)) return { status: 200, json: {} };
      const id = decodeURIComponent(history[1]);
      return { status: 200, json: { [id]: { status: { status_str: 'success' }, outputs: { '9': { images: [{ filename: `${id}.png`, subfolder: '', type: 'output' }] } } } } };
    }
    if (url.includes('/view?')) return { status: 200, raw: { data: Buffer.concat([TINY_PNG, Buffer.from(url)]), type: 'image/png' } };
    return { status: 404, json: {} };
  };
}

/** Tritt einer Welt mit einer eigenen Spielfigur bei (für Tests, die Beiträge oder Chats brauchen). */
export function joinAsCustom(ctx: AppContext, worldId: string, name = 'Testfigur'): string {
  return joinWorld(ctx, worldId, {
    mode: 'custom',
    character: { name, role: 'Neuankömmling', background: 'Kommt aus einer anderen Stadt.', personality: ['neugierig'], goals: ['Freunde finden'] },
  }).player.id;
}
