/**
 * Minimaler Client für OpenAI-kompatible Chat-Completions-APIs (z. B. OpenRouter oder ein eigener KI-Server).
 * Der API-Schlüssel wird ausschließlich im Authorization-Header übertragen und nie protokolliert.
 * Der Client wiederholt Anfragen nie selbst – jede Anfrage ist genau ein Aufruf.
 */
import { parseNumber, safeMessage, type AiErrorCode, type ChatMessage, type CompletionOutcome, type FetchFn } from './types';

export interface CompletionRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface RemoteModel {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number | null;
  completionPrice: number | null;
}

const APP_HEADERS = { 'X-Title': 'SocialVerse' };

function classifyStatus(status: number, message: string): { code: AiErrorCode; retriable: boolean } {
  if (status === 401) return { code: 'unauthorized', retriable: false };
  if (status === 402) return { code: 'payment_required', retriable: false };
  if (status === 403) return { code: 'moderation', retriable: true };
  if (status === 404) return { code: 'model_unavailable', retriable: true };
  if (status === 408) return { code: 'timeout', retriable: true };
  if (status === 429) return { code: 'rate_limited', retriable: true };
  if (status === 400) {
    // Ein unbekanntes Modell meldet OpenRouter teils als 400.
    const modelProblem = /model|endpoint/i.test(message);
    return { code: modelProblem ? 'model_unavailable' : 'bad_request', retriable: modelProblem };
  }
  if (status === 502 || status === 503) return { code: 'model_unavailable', retriable: true };
  if (status >= 500) return { code: 'server_error', retriable: true };
  return { code: 'bad_request', retriable: false };
}

export class OpenAiCompatibleClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${req.apiKey}`,
          'Content-Type': 'application/json',
          ...APP_HEADERS,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          usage: { include: true },
        }),
      });
      let body: unknown = null;
      const raw = await response.text();
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = null;
      }
      const errorObj = (body as { error?: { message?: unknown; code?: unknown } } | null)?.error;
      if (!response.ok || errorObj) {
        const status = response.ok ? (parseNumber(errorObj?.code) ?? 502) : response.status;
        const message = safeMessage(errorObj?.message) || `HTTP ${status}`;
        return { ok: false, status, message, ...classifyStatus(status, message) };
      }
      const data = body as {
        model?: unknown;
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
      } | null;
      if (!data || !Array.isArray(data.choices)) {
        return { ok: false, code: 'invalid_response', message: 'Antwort hatte kein gültiges Format.', retriable: true };
      }
      const content = data.choices[0]?.message?.content;
      const text = typeof content === 'string' ? content.trim() : '';
      if (!text) {
        return { ok: false, code: 'empty_response', message: 'Das Modell hat keinen Text geliefert.', retriable: true };
      }
      return {
        ok: true,
        text,
        model: typeof data.model === 'string' ? data.model : req.model,
        usage: {
          promptTokens: Math.max(0, Math.round(parseNumber(data.usage?.prompt_tokens) ?? 0)),
          completionTokens: Math.max(0, Math.round(parseNumber(data.usage?.completion_tokens) ?? 0)),
          costUsd: parseNumber(data.usage?.cost),
        },
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { ok: false, code: 'timeout', message: 'Zeitüberschreitung bei der KI-Anfrage.', retriable: true };
      }
      return { ok: false, code: 'network', message: 'Keine Verbindung zum KI-Server möglich.', retriable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async listModels(timeoutMs = 15_000): Promise<RemoteModel[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/models`, {
        signal: controller.signal,
        headers: APP_HEADERS,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { data?: unknown };
      if (!Array.isArray(body.data)) throw new Error('Ungültige Modellliste');
      return body.data
        .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && typeof (m as { id?: unknown }).id === 'string')
        .map((m) => {
          const pricing = (m.pricing ?? {}) as Record<string, unknown>;
          return {
            id: String(m.id),
            name: typeof m.name === 'string' ? m.name : String(m.id),
            contextLength: parseNumber(m.context_length),
            promptPrice: parseNumber(pricing.prompt),
            completionPrice: parseNumber(pricing.completion),
          };
        });
    } finally {
      clearTimeout(timer);
    }
  }
}
