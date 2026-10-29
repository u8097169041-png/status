/**
 * Die drei austauschbaren KI-Provider:
 * - LocalProvider: lokales Sprachmodell über Ollama (kostenlos, Daten bleiben lokal).
 * - ServerProvider: zentraler, OpenAI-kompatibler KI-Dienst; nur mit Betreiber-Konfiguration und Nutzerfreigabe.
 * - FallbackProvider: regelbasierte, kontextabhängige Inhalte ohne Modell (immer verfügbar, ohne Netzwerk).
 * Welcher Provider verwendet wird, entscheidet der Router in aiService.ts.
 */
import type { AiFallbackReason } from '../../../shared/types';
import type { LocalAiConfig, ServerAiConfig } from '../config';
import { isChatModel, OllamaClient, supportsJsonSchema, type OllamaModel } from './ollamaClient';
import { OpenAiCompatibleClient } from './openaiClient';
import type { AiProvider, CompletionOutcome, FetchFn, ProviderRequest } from './types';

type Clock = () => number;

/** Bevorzugte lokale Modelle (gute deutsche und englische Antworten bei geringem Speicherbedarf). */
export const PREFERRED_LOCAL_MODELS = ['gemma3:4b', 'qwen2.5:3b', 'llama3.2:3b', 'gemma3', 'qwen2.5', 'qwen3', 'llama3.2', 'llama3.1', 'mistral', 'phi'];

const HEALTHY_TTL_MS = 30_000;
const UNHEALTHY_TTL_MS = 15_000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function isLoopback(url: string): boolean {
  const host = hostOf(url).replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

/** Einfache Sperre: lokale Modelle bearbeiten eine Anfrage nach der anderen (CPU/GPU-Last begrenzen). */
class Slot {
  private busy = false;
  private queue: (() => void)[] = [];

  /** Wartet höchstens `waitMs` auf den Slot; gibt null zurück, wenn er belegt bleibt. */
  async acquire(waitMs: number): Promise<(() => void) | null> {
    if (!this.busy) {
      this.busy = true;
      return () => this.release();
    }
    if (waitMs <= 0) return null;
    return new Promise((resolve) => {
      const waiter = () => {
        clearTimeout(timer);
        resolve(() => this.release());
      };
      const timer = setTimeout(() => {
        this.queue = this.queue.filter((w) => w !== waiter);
        resolve(null);
      }, waitMs);
      this.queue.push(waiter);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.busy = false;
  }
}

export interface LocalHealth {
  reachable: boolean | null;
  version: string | null;
  models: OllamaModel[];
  checkedAt: number;
  error: string | null;
}

/** Laufzeitbeobachtungen für die Diagnose: Geschwindigkeit und letzte Zeitüberschreitung. */
export interface LocalStats {
  tokensPerSecond: number | null;
  lastTimeout: { at: number; message: string } | null;
}

/** Kontextlänge für lokale Modelle (Systemprompt + Verlauf + Antwort). */
const LOCAL_NUM_CTX = 4096;

export interface LocalReadiness {
  ready: boolean;
  model: string | null;
  source: 'env' | 'settings' | 'auto' | null;
  reason: AiFallbackReason | null;
}

export class LocalProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly client: OllamaClient;
  private health: LocalHealth = { reachable: null, version: null, models: [], checkedAt: 0, error: null };
  private probing: Promise<void> | null = null;
  private readonly slot = new Slot();
  private busy = 0;
  private stats: LocalStats = { tokensPerSecond: null, lastTimeout: null };

  constructor(
    readonly config: LocalAiConfig,
    fetchFn?: FetchFn,
    private readonly clock: Clock = Date.now,
  ) {
    this.client = new OllamaClient(config.baseUrl, fetchFn);
  }

  get state(): LocalHealth {
    return this.health;
  }

  get observed(): LocalStats {
    return this.stats;
  }

  /** Fragt Version und installierte Modelle ab (kostenlos, kurze Zeitüberschreitung). Ergebnis wird zwischengespeichert. */
  async refresh(force = false): Promise<void> {
    if (!this.config.enabled) return;
    const age = this.clock() - this.health.checkedAt;
    const ttl = this.health.reachable ? HEALTHY_TTL_MS : UNHEALTHY_TTL_MS;
    if (!force && this.health.checkedAt > 0 && age < ttl) return;
    // Während einer laufenden Generierung ist Ollama ausgelastet; eine Prüfung könnte dann fälschlich scheitern.
    if (!force && this.busy > 0 && this.health.reachable) return;
    if (this.probing) return this.probing;
    this.probing = (async () => {
      try {
        const [version, models] = await Promise.all([this.client.version(), this.client.listModels()]);
        this.health = { reachable: true, version, models, checkedAt: this.clock(), error: null };
      } catch (error) {
        const aborted = (error as Error).name === 'AbortError';
        this.health = {
          reachable: false,
          version: null,
          models: [],
          checkedAt: this.clock(),
          error: aborted ? 'Zeitüberschreitung' : 'Nicht erreichbar',
        };
      } finally {
        this.probing = null;
      }
    })();
    return this.probing;
  }

  /** Nach einem Verbindungsfehler wird die lokale KI kurz übersprungen statt bei jeder Anfrage erneut zu warten. */
  markUnreachable(error: string): void {
    this.health = { ...this.health, reachable: false, checkedAt: this.clock(), error };
  }

  chatModels(): OllamaModel[] {
    return this.health.models.filter(isChatModel);
  }

  /** Modellwahl: .env (fest) > Einstellung in der App > automatisch aus den installierten Modellen. */
  readiness(settingsModel: string): LocalReadiness {
    if (!this.config.enabled) return { ready: false, model: null, source: null, reason: 'local-disabled' };
    if (this.health.reachable === null) return { ready: false, model: null, source: null, reason: 'local-unchecked' };
    if (!this.health.reachable) return { ready: false, model: null, source: null, reason: 'local-unreachable' };
    const installed = this.chatModels();
    const has = (name: string) => installed.some((m) => m.name === name || m.name === `${name}:latest`);
    const explicit: [string, 'env' | 'settings'] | null = this.config.model
      ? [this.config.model, 'env']
      : settingsModel
        ? [settingsModel, 'settings']
        : null;
    if (explicit) {
      return has(explicit[0])
        ? { ready: true, model: explicit[0], source: explicit[1], reason: null }
        : { ready: false, model: explicit[0], source: explicit[1], reason: 'local-model-missing' };
    }
    if (installed.length === 0) return { ready: false, model: null, source: null, reason: 'local-no-model' };
    for (const preferred of PREFERRED_LOCAL_MODELS) {
      const match = installed.find((m) => m.name.startsWith(preferred));
      if (match) return { ready: true, model: match.name, source: 'auto', reason: null };
    }
    return { ready: true, model: installed[0].name, source: 'auto', reason: null };
  }

  acquire(waitMs: number): Promise<(() => void) | null> {
    return this.slot.acquire(waitMs);
  }

  async complete(req: ProviderRequest & { model: string }): Promise<CompletionOutcome> {
    // JSON-Schema nur, wenn die installierte Ollama-Version es versteht; sonst einfacher JSON-Modus.
    const format = typeof req.json === 'object' && !supportsJsonSchema(this.health.version) ? true : req.json;
    this.busy++;
    try {
      const outcome = await this.client.chat({
        model: req.model,
        messages: req.messages,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        format,
        numCtx: LOCAL_NUM_CTX,
        timeouts: {
          firstTokenMs: this.config.loadTimeoutMs,
          idleMs: this.config.idleTimeoutMs,
          totalMs: req.long ? this.config.longTimeoutMs : this.config.timeoutMs,
        },
        signal: req.signal,
        onProgress: req.onProgress,
      });
      if (outcome.ok) {
        if (outcome.tokensPerSecond) this.stats.tokensPerSecond = outcome.tokensPerSecond;
      } else if (outcome.code === 'network') {
        // Nur echte Verbindungsfehler gelten als „nicht erreichbar“ – eine langsame KI ist erreichbar.
        this.markUnreachable('Nicht erreichbar');
      } else if (outcome.code === 'timeout') {
        this.stats.lastTimeout = { at: this.clock(), message: outcome.message };
      } else if (outcome.code === 'model_unavailable') {
        void this.refresh(true);
      }
      return outcome;
    } finally {
      this.busy--;
    }
  }
}

export class ServerProvider implements AiProvider {
  readonly id = 'server' as const;
  readonly client: OpenAiCompatibleClient;
  private blocked: { until: number; code: string } | null = null;
  private recent: number[] = [];

  constructor(
    readonly config: ServerAiConfig,
    fetchFn?: FetchFn,
    private readonly clock: Clock = Date.now,
  ) {
    this.client = new OpenAiCompatibleClient(config.baseUrl, fetchFn);
  }

  /** Was in .env fehlt. Ohne SERVER_AI_ENABLED=true gilt die Server-KI als nicht konfiguriert. */
  missing(): ('key' | 'model')[] {
    const out: ('key' | 'model')[] = [];
    if (!this.config.apiKey) out.push('key');
    if (!this.config.model) out.push('model');
    return out;
  }

  configured(): boolean {
    return this.config.enabled && this.missing().length === 0;
  }

  modelFor(kind: 'chat' | 'world'): string {
    return kind === 'world' ? this.config.worldModel || this.config.model : this.config.model;
  }

  host(): string | null {
    return hostOf(this.config.baseUrl) || null;
  }

  blockedUntil(): number | null {
    if (this.blocked && this.blocked.until > this.clock()) return this.blocked.until;
    this.blocked = null;
    return null;
  }

  /** Hebt eine Sperre nach Fehlern auf (z. B. nach Korrektur der Konfiguration und Neustart oder „Erneut prüfen“). */
  resetBlock(): void {
    this.blocked = null;
  }

  /** Anfragen der letzten Minute (Schutz vor Schleifen und Lastspitzen). */
  callsLastMinute(): number {
    const cutoff = this.clock() - 60_000;
    this.recent = this.recent.filter((t) => t > cutoff);
    return this.recent.length;
  }

  async complete(req: ProviderRequest & { model: string }): Promise<CompletionOutcome> {
    if (!this.configured() || !this.config.apiKey) {
      return { ok: false, code: 'disabled', message: 'Server-KI ist nicht konfiguriert.', retriable: false };
    }
    this.recent.push(this.clock());
    // Genau ein Aufruf – keine automatischen (kostenpflichtigen) Wiederholungen oder Ersatzmodelle.
    const outcome = await this.client.complete({
      apiKey: this.config.apiKey,
      model: req.model,
      messages: req.messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      timeoutMs: req.long ? this.config.longTimeoutMs : this.config.timeoutMs,
      signal: req.signal,
    });
    if (!outcome.ok) {
      // Zugangs- oder Zahlungsprobleme beheben sich nicht von selbst: bis zum Neustart bzw. „Erneut prüfen“ sperren.
      const hard = outcome.code === 'unauthorized' || outcome.code === 'payment_required';
      const soft = ['network', 'timeout', 'rate_limited', 'server_error', 'model_unavailable'].includes(outcome.code);
      if (hard) this.blocked = { until: this.clock() + 24 * 3_600_000, code: outcome.code };
      else if (soft) this.blocked = { until: this.clock() + 2 * 60_000, code: outcome.code };
    }
    return outcome;
  }
}

/**
 * Simulierte KI: liefert regelbasierte Inhalte, die der Aufrufer passend zum Kontext erzeugt
 * (Demo-Antworten der Figur, Vorlagen-Beiträge, regelbasierte Zusammenfassungen). Kein Netzwerk, keine Kosten.
 */
export class FallbackProvider implements AiProvider {
  readonly id = 'fallback' as const;

  async complete(req: ProviderRequest & { generate?: () => string }): Promise<CompletionOutcome> {
    const text = req.generate?.().trim() ?? '';
    if (!text) return { ok: false, code: 'unavailable', message: 'Keine simulierte Antwort verfügbar.', retriable: false };
    return { ok: true, text, model: 'simulated', usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 } };
  }
}
