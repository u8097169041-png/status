/**
 * Client für die lokale KI-Laufzeit Ollama (https://ollama.com), native REST-API.
 * Es werden ausschließlich Anfragen an die konfigurierte Adresse gestellt; Modelle werden nie heruntergeladen.
 */
import { parseNumber, safeMessage, type ChatMessage, type CompletionOutcome, type FetchFn, type JsonSchema } from './types';

export interface OllamaModel {
  name: string;
  sizeBytes: number | null;
  family: string | null;
  families: string[];
  parameterSize: string | null;
}

export interface OllamaChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** true = JSON-Modus; Objekt = JSON-Schema (strukturierte Ausgabe, ab Ollama 0.5). */
  format: boolean | JsonSchema;
  /** Kontextlänge in Tokens. */
  numCtx: number;
  timeouts: {
    /** Bis zum ersten Token (inklusive Laden des Modells). */
    firstTokenMs: number;
    /** Höchstens so lange Pause zwischen zwei Tokens. */
    idleMs: number;
    /** Gesamtdauer. */
    totalMs: number;
  };
  signal?: AbortSignal;
  onProgress?: (tokens: number) => void;
}

/** Höchstlänge einer Antwort in Zeichen (Schutz vor endloser Ausgabe). */
const MAX_RESPONSE_CHARS = 100_000;

/** Ollama unterstützt JSON-Schemata als `format` ab Version 0.5. */
export function supportsJsonSchema(version: string | null): boolean {
  const m = /^(\d+)\.(\d+)/.exec(version ?? '');
  if (!m) return false;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > 0 || minor >= 5;
}

const TIMEOUT_MESSAGES = {
  first: 'Die lokale KI hat nicht rechtzeitig mit der Antwort begonnen (Modell lädt zu lange oder Rechner ausgelastet).',
  idle: 'Die lokale KI hat die Ausgabe unterbrochen.',
  total: 'Die lokale KI hat für die gesamte Antwort zu lange gebraucht.',
} as const;

async function withTimeout<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Modelle, die nur Einbettungen erzeugen und nicht chatten können. */
export function isChatModel(m: OllamaModel): boolean {
  const name = m.name.toLowerCase();
  if (/embed|bge-|minilm|rerank/.test(name)) return false;
  return !m.families.some((f) => /bert/i.test(f));
}

/** Entfernt „Denk“-Abschnitte einiger Modelle (z. B. Qwen3, DeepSeek-R1) aus der Antwort. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}

export class OllamaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
  ) {}

  async version(timeoutMs = 4_000): Promise<string> {
    return withTimeout(timeoutMs, async (signal) => {
      const response = await this.fetchFn(`${this.baseUrl}/api/version`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { version?: unknown };
      return typeof body.version === 'string' ? body.version.slice(0, 40) : 'unbekannt';
    });
  }

  async listModels(timeoutMs = 5_000): Promise<OllamaModel[]> {
    return withTimeout(timeoutMs, async (signal) => {
      const response = await this.fetchFn(`${this.baseUrl}/api/tags`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { models?: unknown };
      if (!Array.isArray(body.models)) throw new Error('Ungültige Modellliste');
      return body.models
        .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && typeof (m as { name?: unknown }).name === 'string')
        .slice(0, 200)
        .map((m) => {
          const details = (m.details ?? {}) as Record<string, unknown>;
          return {
            name: String(m.name).slice(0, 120),
            sizeBytes: parseNumber(m.size),
            family: typeof details.family === 'string' ? details.family : null,
            families: Array.isArray(details.families) ? details.families.filter((f): f is string => typeof f === 'string') : [],
            parameterSize: typeof details.parameter_size === 'string' ? details.parameter_size : null,
          };
        });
    });
  }

  /**
   * Chat-Anfrage mit Streaming. Statt eines festen Gesamtlimits wird der Fortschritt überwacht:
   * Bis zum ersten Token darf das Laden des Modells dauern, danach darf die Ausgabe nur kurz stocken.
   * So funktionieren lange Generierungen auf langsamen Rechnern, ohne bei Hängern ewig zu warten.
   */
  async chat(req: OllamaChatRequest): Promise<CompletionOutcome> {
    const controller = new AbortController();
    let reason: keyof typeof TIMEOUT_MESSAGES | 'cancel' | null = null;
    const abort = (why: keyof typeof TIMEOUT_MESSAGES | 'cancel') => {
      if (reason) return;
      reason = why;
      controller.abort();
    };
    const total = setTimeout(() => abort('total'), req.timeouts.totalMs);
    let idle = setTimeout(() => abort('first'), req.timeouts.firstTokenMs);
    const onCancel = () => abort('cancel');
    if (req.signal?.aborted) abort('cancel');
    req.signal?.addEventListener('abort', onCancel);
    const started = Date.now();
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          ...(req.format ? { format: req.format === true ? 'json' : req.format } : {}),
          // Modell bleibt 15 Minuten geladen – Folgeantworten kommen schneller.
          keep_alive: '15m',
          options: { temperature: req.temperature, num_predict: req.maxTokens, num_ctx: req.numCtx },
        }),
      });
      if (!response.ok || !response.body) {
        const raw = await response.text().catch(() => '');
        let body: Record<string, unknown> | null = null;
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        } catch {
          body = null;
        }
        const message = safeMessage(body?.error) || `HTTP ${response.status}`;
        const missing = response.status === 404 || /not found|pull/i.test(message);
        return {
          ok: false,
          status: response.status,
          code: missing ? 'model_unavailable' : response.status >= 500 ? 'server_error' : 'bad_request',
          message: missing ? `Modell „${req.model}“ ist nicht installiert.` : message,
          retriable: false,
        };
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let tokens = 0;
      let final: Record<string, unknown> | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          let chunk: Record<string, unknown>;
          try {
            chunk = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (chunk.error) {
            return { ok: false, code: 'server_error', message: safeMessage(chunk.error), retriable: false };
          }
          clearTimeout(idle);
          idle = setTimeout(() => abort('idle'), req.timeouts.idleMs);
          const piece = (chunk.message as { content?: unknown } | undefined)?.content;
          if (typeof piece === 'string' && piece) {
            content += piece;
            tokens++;
            req.onProgress?.(tokens);
            if (content.length > MAX_RESPONSE_CHARS) {
              controller.abort();
              return { ok: false, code: 'invalid_response', message: 'Die Antwort der lokalen KI war zu lang.', retriable: false };
            }
          }
          if (chunk.done === true) final = chunk;
        }
        if (final) break;
      }
      const text = stripThinking(content);
      if (!text) return { ok: false, code: 'empty_response', message: 'Die lokale KI hat keinen Text geliefert.', retriable: false };
      const evalCount = parseNumber(final?.eval_count) ?? tokens;
      const evalNs = parseNumber(final?.eval_duration);
      return {
        ok: true,
        text,
        model: typeof final?.model === 'string' ? final.model : req.model,
        truncated: final?.done_reason === 'length',
        tokensPerSecond:
          evalNs && evalNs > 0 ? Math.round((evalCount / (evalNs / 1e9)) * 10) / 10 : tokens > 0 ? Math.round((tokens / ((Date.now() - started) / 1000)) * 10) / 10 : null,
        usage: {
          promptTokens: Math.max(0, Math.round(parseNumber(final?.prompt_eval_count) ?? 0)),
          completionTokens: Math.max(0, Math.round(evalCount)),
          costUsd: 0,
        },
      };
    } catch (error) {
      if (reason === 'cancel') return { ok: false, code: 'cancelled', message: 'Abgebrochen.', retriable: false };
      if (reason) return { ok: false, code: 'timeout', message: TIMEOUT_MESSAGES[reason], retriable: false };
      if ((error as Error).name === 'AbortError') {
        return { ok: false, code: 'timeout', message: TIMEOUT_MESSAGES.total, retriable: false };
      }
      return { ok: false, code: 'network', message: 'Die lokale KI-Laufzeit ist nicht erreichbar.', retriable: false };
    } finally {
      clearTimeout(total);
      clearTimeout(idle);
      req.signal?.removeEventListener('abort', onCancel);
    }
  }
}
