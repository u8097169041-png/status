/** Gemeinsame Typen der KI-Schicht: Nachrichten, Fehlercodes und die Provider-Schnittstelle. */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AiErrorCode =
  | 'no_key'
  | 'no_model'
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'payment_required'
  | 'moderation'
  | 'rate_limited'
  | 'model_unavailable'
  | 'bad_request'
  | 'server_error'
  | 'invalid_response'
  | 'empty_response'
  | 'limit_reached'
  | 'busy'
  | 'unavailable'
  | 'disabled';

export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
}

export type CompletionOutcome =
  | { ok: true; text: string; model: string; usage: CompletionUsage }
  | { ok: false; code: AiErrorCode; message: string; status?: number; retriable: boolean };

export type FetchFn = typeof fetch;

export type ProviderId = 'local' | 'server' | 'fallback';

/** Anfrage an einen Provider. Limits und Freigaben prüft der Router vorher. */
export interface ProviderRequest {
  kind: 'chat' | 'world';
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** Antwort als JSON-Objekt anfordern (strukturierte Ergebnisse). */
  json: boolean;
}

/** Bereitschaft nach letztem Kenntnisstand – ohne Netzwerkzugriff abfragbar. */
export interface ProviderReadiness {
  ready: boolean;
  model: string | null;
}

/**
 * Austauschbarer KI-Provider. Echte Provider (lokal, Server) liefern Text eines Modells;
 * der Fallback-Provider erzeugt regelbasierte Inhalte ohne Modell.
 */
export interface AiProvider {
  readonly id: ProviderId;
  complete(req: ProviderRequest): Promise<CompletionOutcome>;
}

/** Entfernt alles, was wie ein Zugangsschlüssel aussieht, und kürzt Fehlermeldungen. */
export function safeMessage(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300);
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
