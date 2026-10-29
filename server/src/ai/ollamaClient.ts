/**
 * Client für die lokale KI-Laufzeit Ollama (https://ollama.com), native REST-API.
 * Es werden ausschließlich Anfragen an die konfigurierte Adresse gestellt; Modelle werden nie heruntergeladen.
 */
import { parseNumber, safeMessage, type ChatMessage, type CompletionOutcome, type FetchFn } from './types';

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
  json: boolean;
  timeoutMs: number;
}

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

  async version(timeoutMs = 1_500): Promise<string> {
    return withTimeout(timeoutMs, async (signal) => {
      const response = await this.fetchFn(`${this.baseUrl}/api/version`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { version?: unknown };
      return typeof body.version === 'string' ? body.version.slice(0, 40) : 'unbekannt';
    });
  }

  async listModels(timeoutMs = 2_500): Promise<OllamaModel[]> {
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

  async chat(req: OllamaChatRequest): Promise<CompletionOutcome> {
    try {
      return await withTimeout(req.timeoutMs, async (signal) => {
        const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            stream: false,
            ...(req.json ? { format: 'json' } : {}),
            // Modell bleibt 15 Minuten geladen – Folgeantworten kommen schneller.
            keep_alive: '15m',
            options: { temperature: req.temperature, num_predict: req.maxTokens },
          }),
        });
        const raw = await response.text();
        let body: Record<string, unknown> | null = null;
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        } catch {
          body = null;
        }
        if (!response.ok) {
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
        const message = (body?.message ?? null) as { content?: unknown } | null;
        if (!message || typeof message.content !== 'string') {
          return { ok: false, code: 'invalid_response', message: 'Antwort der lokalen KI hatte kein gültiges Format.', retriable: false };
        }
        const text = stripThinking(message.content);
        if (!text) return { ok: false, code: 'empty_response', message: 'Die lokale KI hat keinen Text geliefert.', retriable: false };
        return {
          ok: true,
          text,
          model: typeof body?.model === 'string' ? body.model : req.model,
          usage: {
            promptTokens: Math.max(0, Math.round(parseNumber(body?.prompt_eval_count) ?? 0)),
            completionTokens: Math.max(0, Math.round(parseNumber(body?.eval_count) ?? 0)),
            costUsd: 0,
          },
        };
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { ok: false, code: 'timeout', message: 'Die lokale KI hat nicht rechtzeitig geantwortet.', retriable: false };
      }
      return { ok: false, code: 'network', message: 'Die lokale KI-Laufzeit ist nicht erreichbar.', retriable: false };
    }
  }
}
