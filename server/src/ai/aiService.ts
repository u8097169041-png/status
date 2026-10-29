/**
 * KI-Router: wählt anhand von Einstellungen, Konfiguration und Verfügbarkeit den Provider
 * (lokal → Server nur mit Freigabe → simulierte KI), prüft Limits und protokolliert jede Anfrage.
 * Kostenpflichtige Anfragen werden nie automatisch wiederholt.
 */
import type {
  AiFallbackReason,
  AiStatusDto,
  AiTestResult,
  AiUsageEntryDto,
  AiUsageSummary,
} from '../../../shared/types';
import type { AppConfig } from '../config';
import { all, get, run, type DB } from '../db/database';
import { dayKey, monthKey } from '../lib/time';
import { deleteSecret, getSecret, getSettings } from '../services/settings';
import type { RemoteModel } from './openaiClient';
import { FallbackProvider, isLoopback, LocalProvider, ServerProvider } from './providers';
import { safeMessage, type AiErrorCode, type ChatMessage, type CompletionOutcome, type FetchFn, type ProviderId } from './types';

/** Früher in der App gespeicherter OpenRouter-Schlüssel (Version 1). Wird nicht mehr verwendet. */
export const LEGACY_API_KEY_SECRET = 'openrouter_api_key';

export type AiPurpose = 'chat' | 'summary' | 'world' | 'reaction' | 'generator' | 'test';

export interface AiCallRequest {
  purpose: AiPurpose;
  /** Welche Modelleinstellung verwendet wird (Server: SERVER_AI_WORLD_MODEL für Weltaktivität). */
  kind: 'chat' | 'world';
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Antwort als JSON-Objekt anfordern. */
  json?: boolean;
  /** Regelbasierter Ersatz (simulierte KI), wenn keine echte KI verfügbar ist oder sie scheitert. */
  fallback?: () => string;
}

export type AiCallResult =
  | {
      ok: true;
      text: string;
      provider: ProviderId;
      model: string | null;
      costUsd: number | null;
      /** Gesetzt, wenn eine echte KI gewählt war, aber nicht geantwortet hat (Antwort stammt dann vom Fallback). */
      notice?: { code: AiErrorCode; message: string };
    }
  | { ok: false; code: AiErrorCode; message: string };

interface Selection {
  provider: 'local' | 'server' | null;
  model: string | null;
  reason: AiFallbackReason | null;
}

const PRICE_CACHE_MS = 60 * 60 * 1000;
/** Hintergrundanfragen (Welt, Reaktionen) warten nicht auf ein belegtes lokales Modell. */
const BACKGROUND_PURPOSES: AiPurpose[] = ['world', 'reaction', 'summary'];
const WORLD_PURPOSES: AiPurpose[] = ['world', 'reaction'];

export class AiService {
  readonly local: LocalProvider;
  readonly server: ServerProvider;
  readonly fallback = new FallbackProvider();
  private priceCache: { at: number; models: RemoteModel[] } | null = null;
  private priceFailureAt = 0;
  private lastError: AiStatusDto['lastError'] = null;

  constructor(
    private readonly db: DB,
    private readonly config: AppConfig,
    private readonly now: () => Date,
    fetchFn?: FetchFn,
  ) {
    this.local = new LocalProvider(config.localAi, fetchFn);
    this.server = new ServerProvider(config.serverAi, fetchFn);
  }

  /** Prüft die lokale KI-Laufzeit (kostenlos). Die Server-KI wird dabei nie aufgerufen. */
  async refreshHealth(force = false): Promise<void> {
    if (force) this.server.resetBlock();
    if (getSettings(this.db).ai.mode !== 'fallback' || force) await this.local.refresh(force);
  }

  // ---- Auswahl ----

  private serverLimitReached(): boolean {
    const { ai } = getSettings(this.db);
    const cfg = this.config.serverAi;
    const now = this.now();
    const today = this.summary('day', dayKey(now));
    const month = this.summary('month', monthKey(now));
    const dailyBudget = Math.min(ai.dailyBudgetUsd, cfg.dailyBudgetUsd);
    const monthlyBudget = Math.min(ai.monthlyBudgetUsd, cfg.monthlyBudgetUsd);
    return (
      today.requests >= Math.min(ai.dailyRequestLimit, cfg.maxRequestsPerDay) ||
      (dailyBudget > 0 && today.costUsd >= dailyBudget) ||
      (monthlyBudget > 0 && month.costUsd >= monthlyBudget)
    );
  }

  private serverReason(): AiFallbackReason | null {
    if (!this.server.configured()) return 'server-not-configured';
    if (!getSettings(this.db).ai.serverConsent) return 'server-no-consent';
    if (this.server.blockedUntil()) return 'server-blocked';
    if (this.serverLimitReached()) return 'server-limit';
    return null;
  }

  private selection(kind: 'chat' | 'world' = 'chat'): Selection {
    const { ai } = getSettings(this.db);
    if (ai.mode === 'fallback') return { provider: null, model: null, reason: 'mode-fallback' };
    const local = this.local.readiness(ai.localModel);
    const serverReason = this.serverReason();
    if (ai.mode === 'server') {
      if (!serverReason) return { provider: 'server', model: this.server.modelFor(kind), reason: null };
      // Ist die Server-KI nicht nutzbar, darf die kostenlose lokale KI einspringen.
      if (local.ready) return { provider: 'local', model: local.model, reason: serverReason };
      return { provider: null, model: null, reason: serverReason };
    }
    if (local.ready) return { provider: 'local', model: local.model, reason: null };
    // Im Automatikmodus nur mit ausdrücklicher Freigabe auf die Server-KI ausweichen.
    if (!serverReason) return { provider: 'server', model: this.server.modelFor(kind), reason: local.reason };
    return { provider: null, model: null, reason: local.reason };
  }

  /** True, wenn eine echte KI (lokal oder Server) nach letztem Kenntnisstand verwendet würde. */
  isActive(kind: 'chat' | 'world' = 'chat'): boolean {
    return this.selection(kind).provider !== null;
  }

  activeProvider(kind: 'chat' | 'world' = 'chat'): ProviderId {
    return this.selection(kind).provider ?? 'fallback';
  }

  modelFor(kind: 'chat' | 'world'): string {
    return this.selection(kind).model ?? '';
  }

  /** True, wenn die Weltaktivität KI verwenden darf und das Tageslimit noch nicht erreicht ist. */
  canUseWorldAi(): boolean {
    const { ai } = getSettings(this.db);
    return ai.worldActivityEnabled && this.isActive('world') && this.worldCallsToday() < ai.worldDailyLimit;
  }

  worldCallsToday(): number {
    const row = get<{ n: number }>(
      this.db,
      `SELECT COUNT(*) AS n FROM ai_usage WHERE day = ? AND purpose IN ('world', 'reaction')`,
      dayKey(this.now()),
    );
    return row?.n ?? 0;
  }

  // ---- Verbrauch ----

  private summary(column: 'day' | 'month', value: string, provider: ProviderId = 'server'): AiUsageSummary {
    const row = get<{
      requests: number;
      failed: number | null;
      prompt: number | null;
      completion: number | null;
      cost: number | null;
      unknown: number | null;
    }>(
      this.db,
      `SELECT COUNT(*) AS requests,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed,
              SUM(prompt_tokens) AS prompt,
              SUM(completion_tokens) AS completion,
              SUM(COALESCE(cost_usd, 0)) AS cost,
              SUM(CASE WHEN status = 'ok' AND cost_usd IS NULL THEN 1 ELSE 0 END) AS unknown
         FROM ai_usage WHERE ${column} = ? AND provider = ?`,
      value,
      provider,
    );
    return {
      requests: row?.requests ?? 0,
      failed: row?.failed ?? 0,
      promptTokens: row?.prompt ?? 0,
      completionTokens: row?.completion ?? 0,
      costUsd: Math.round((row?.cost ?? 0) * 1e6) / 1e6,
      costKnown: (row?.unknown ?? 0) === 0,
    };
  }

  hasLegacyKey(): boolean {
    return getSecret(this.db, LEGACY_API_KEY_SECRET) !== null;
  }

  deleteLegacyKey(): void {
    deleteSecret(this.db, LEGACY_API_KEY_SECRET);
  }

  status(): AiStatusDto {
    const settings = getSettings(this.db);
    const now = this.now();
    const sel = this.selection('chat');
    const local = this.local.readiness(settings.ai.localModel);
    const health = this.local.state;
    const cfg = this.config.serverAi;
    const today = this.summary('day', dayKey(now));
    const month = this.summary('month', monthKey(now));
    const dailyBudget = Math.min(settings.ai.dailyBudgetUsd, cfg.dailyBudgetUsd);
    const monthlyBudget = Math.min(settings.ai.monthlyBudgetUsd, cfg.monthlyBudgetUsd);
    const blocked = this.server.blockedUntil();
    return {
      mode: settings.ai.mode,
      active: sel.provider ?? 'fallback',
      activeModel: sel.model,
      reason: sel.reason,
      local: {
        enabledByConfig: this.config.localAi.enabled,
        baseUrl: this.config.localAi.baseUrl,
        remote: !isLoopback(this.config.localAi.baseUrl),
        reachable: this.config.localAi.enabled ? health.reachable : null,
        version: health.version,
        models: this.local.chatModels().map((m) => ({
          name: m.name,
          sizeGb: m.sizeBytes ? Math.round((m.sizeBytes / 1e9) * 10) / 10 : null,
          parameterSize: m.parameterSize,
          family: m.family,
        })),
        model: local.model,
        modelSource: local.source,
        checkedAt: health.checkedAt ? new Date(health.checkedAt).toISOString() : null,
        error: health.error,
        timeoutSeconds: Math.round(this.config.localAi.timeoutMs / 1000),
      },
      server: {
        configured: this.server.configured(),
        enabledByConfig: cfg.enabled,
        missing: this.server.missing(),
        consent: settings.ai.serverConsent,
        host: this.server.configured() ? this.server.host() : null,
        model: this.server.configured() ? cfg.model : null,
        pricesKnown: cfg.priceInputPerMTok !== null && cfg.priceOutputPerMTok !== null,
        blockedUntil: blocked ? new Date(blocked).toISOString() : null,
        limits: {
          maxRequestsPerDay: Math.min(settings.ai.dailyRequestLimit, cfg.maxRequestsPerDay),
          maxRequestsPerMinute: cfg.maxRequestsPerMinute,
          maxTokens: Math.min(settings.ai.maxTokens, cfg.maxTokens),
          timeoutSeconds: Math.round(cfg.timeoutMs / 1000),
          dailyBudgetUsd: dailyBudget,
          monthlyBudgetUsd: monthlyBudget,
        },
      },
      today,
      month,
      localToday: this.summary('day', dayKey(now), 'local').requests,
      limits: {
        dailyRequestsReached: today.requests >= Math.min(settings.ai.dailyRequestLimit, cfg.maxRequestsPerDay),
        dailyBudgetReached: dailyBudget > 0 && today.costUsd >= dailyBudget,
        monthlyBudgetReached: monthlyBudget > 0 && month.costUsd >= monthlyBudget,
      },
      legacyKeyStored: this.hasLegacyKey(),
      lastError: this.lastError,
    };
  }

  // ---- Kosten und Limits der Server-KI ----

  /** Preis pro Token (USD). Quelle: .env oder – falls der Dienst sie anbietet – dessen Modellliste. */
  private async priceFor(model: string): Promise<{ prompt: number; completion: number } | null> {
    const cfg = this.config.serverAi;
    if (cfg.priceInputPerMTok !== null && cfg.priceOutputPerMTok !== null) {
      return { prompt: cfg.priceInputPerMTok / 1e6, completion: cfg.priceOutputPerMTok / 1e6 };
    }
    const fresh = this.priceCache && Date.now() - this.priceCache.at < PRICE_CACHE_MS;
    if (!fresh && Date.now() - this.priceFailureAt > 5 * 60_000) {
      try {
        this.priceCache = { at: Date.now(), models: await this.server.client.listModels(5_000) };
      } catch {
        this.priceFailureAt = Date.now();
      }
    }
    const m = this.priceCache?.models.find((x) => x.id === model);
    return m && m.promptPrice !== null && m.completionPrice !== null ? { prompt: m.promptPrice, completion: m.completionPrice } : null;
  }

  /** Prüft alle Limits vor einem Server-Aufruf. Unbekannte Kosten werden nicht riskiert. */
  private async checkServerLimits(
    req: AiCallRequest,
    model: string,
    maxTokens: number,
  ): Promise<{ code: AiErrorCode; message: string; price: { prompt: number; completion: number } | null } | { price: { prompt: number; completion: number } }> {
    const { ai } = getSettings(this.db);
    const cfg = this.config.serverAi;
    const now = this.now();
    const today = this.summary('day', dayKey(now));
    if (today.requests >= Math.min(ai.dailyRequestLimit, cfg.maxRequestsPerDay)) {
      return { code: 'limit_reached', message: 'Tageslimit für Server-KI-Anfragen erreicht.', price: null };
    }
    if (this.server.callsLastMinute() >= cfg.maxRequestsPerMinute) {
      return { code: 'limit_reached', message: 'Zu viele Server-KI-Anfragen in kurzer Zeit.', price: null };
    }
    if (WORLD_PURPOSES.includes(req.purpose) && this.worldCallsToday() >= ai.worldDailyLimit) {
      return { code: 'limit_reached', message: 'Tageslimit für KI-Weltaktivität erreicht.', price: null };
    }
    const price = await this.priceFor(model);
    if (!price) {
      return {
        code: 'limit_reached',
        message: 'Kosten des Server-Modells unbekannt – Preise in .env (SERVER_AI_PRICE_*) hinterlegen.',
        price: null,
      };
    }
    const promptChars = req.messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimate = (promptChars / 3.5) * price.prompt + maxTokens * price.completion;
    const month = this.summary('month', monthKey(now));
    const budgets: [number, number, string][] = [
      [Math.min(ai.dailyBudgetUsd, cfg.dailyBudgetUsd), today.costUsd, 'Tagesbudget'],
      [Math.min(ai.monthlyBudgetUsd, cfg.monthlyBudgetUsd), month.costUsd, 'Monatsbudget'],
    ];
    for (const [budget, spent, label] of budgets) {
      if (budget === 0 && estimate > 0) {
        return { code: 'limit_reached', message: `${label} ist 0 – nur kostenlose Modelle sind erlaubt.`, price };
      }
      if (budget > 0 && spent + estimate > budget) return { code: 'limit_reached', message: `${label} erreicht.`, price };
    }
    return { price };
  }

  private logUsage(entry: {
    provider: ProviderId;
    purpose: AiPurpose;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number | null;
    costEstimated: boolean;
    status: 'ok' | 'error';
    errorCode: string | null;
    durationMs: number;
  }): void {
    const now = this.now();
    run(
      this.db,
      `INSERT INTO ai_usage (created_at, day, month, provider, purpose, model, prompt_tokens, completion_tokens, cost_usd,
                             cost_estimated, status, error_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      now.toISOString(),
      dayKey(now),
      monthKey(now),
      entry.provider,
      entry.purpose,
      entry.model.slice(0, 120),
      entry.promptTokens,
      entry.completionTokens,
      entry.costUsd,
      entry.costEstimated,
      entry.status,
      entry.errorCode,
      entry.durationMs,
    );
  }

  private recordError(provider: ProviderId, code: string, message: string): void {
    const clean = safeMessage(message);
    this.lastError = { code, message: clean, at: this.now().toISOString(), provider };
    // Nur Provider, Fehlercode und bereinigte Meldung protokollieren – niemals Schlüssel oder Gesprächsinhalte.
    console.warn(`[ai] ${provider}: ${code} – ${clean}`);
  }

  // ---- Aufrufe ----

  /** Ein Aufruf an genau einen echten Provider – ohne Wiederholung und ohne automatischen Wechsel zu einem anderen. */
  private async callProvider(provider: 'local' | 'server', model: string, req: AiCallRequest): Promise<CompletionOutcome & { costUsd?: number | null }> {
    const { ai } = getSettings(this.db);
    const temperature = req.temperature ?? ai.temperature;
    const requested = req.maxTokens ?? ai.maxTokens;
    if (provider === 'local') {
      const cap = req.purpose === 'generator' ? Math.max(this.config.localAi.maxTokens, 1_200) : this.config.localAi.maxTokens;
      const maxTokens = Math.min(requested, cap);
      // Chats warten kurz auf ein belegtes Modell; Hintergrundaufgaben verzichten in diesem Fall auf KI.
      const release = await this.local.acquire(BACKGROUND_PURPOSES.includes(req.purpose) ? 0 : this.config.localAi.timeoutMs);
      if (!release) return { ok: false, code: 'busy', message: 'Die lokale KI ist gerade ausgelastet.', retriable: false };
      const started = Date.now();
      try {
        const outcome = await this.local.complete({ kind: req.kind, messages: req.messages, maxTokens, temperature, json: Boolean(req.json), model });
        this.logUsage({
          provider: 'local',
          purpose: req.purpose,
          model: outcome.ok ? outcome.model : model,
          promptTokens: outcome.ok ? outcome.usage.promptTokens : 0,
          completionTokens: outcome.ok ? outcome.usage.completionTokens : 0,
          costUsd: 0,
          costEstimated: false,
          status: outcome.ok ? 'ok' : 'error',
          errorCode: outcome.ok ? null : outcome.code,
          durationMs: Date.now() - started,
        });
        return { ...outcome, costUsd: 0 };
      } finally {
        release();
      }
    }

    const maxTokens = Math.min(requested, this.config.serverAi.maxTokens);
    const check = await this.checkServerLimits(req, model, maxTokens);
    if ('code' in check) return { ok: false, code: check.code, message: check.message, retriable: false };
    const started = Date.now();
    const outcome = await this.server.complete({ kind: req.kind, messages: req.messages, maxTokens, temperature, json: Boolean(req.json), model });
    let cost: number | null = null;
    let estimated = false;
    if (outcome.ok) {
      cost = outcome.usage.costUsd;
      if (cost === null) {
        cost = outcome.usage.promptTokens * check.price.prompt + outcome.usage.completionTokens * check.price.completion;
        estimated = true;
      }
    }
    this.logUsage({
      provider: 'server',
      purpose: req.purpose,
      model: outcome.ok ? outcome.model : model,
      promptTokens: outcome.ok ? outcome.usage.promptTokens : 0,
      completionTokens: outcome.ok ? outcome.usage.completionTokens : 0,
      costUsd: cost,
      costEstimated: estimated,
      status: outcome.ok ? 'ok' : 'error',
      errorCode: outcome.ok ? null : outcome.code,
      durationMs: Date.now() - started,
    });
    return { ...outcome, costUsd: cost };
  }

  private viaFallback(req: AiCallRequest, notice?: { code: AiErrorCode; message: string }): AiCallResult | null {
    if (!req.fallback) return null;
    const text = req.fallback().trim();
    if (!text) return null;
    return { ok: true, text, provider: 'fallback', model: null, costUsd: 0, ...(notice ? { notice } : {}) };
  }

  /**
   * Führt einen KI-Aufruf aus: bevorzugt lokal, Server nur mit Freigabe, sonst simulierte KI (falls angegeben).
   * Pro Aufruf wird höchstens ein echter Provider genau einmal angefragt.
   */
  async complete(req: AiCallRequest): Promise<AiCallResult> {
    await this.refreshHealth();
    const sel = this.selection(req.kind);
    if (!sel.provider || !sel.model) {
      return (
        this.viaFallback(req) ?? { ok: false, code: 'unavailable', message: 'Keine echte KI verfügbar – simulierte KI aktiv.' }
      );
    }
    if (WORLD_PURPOSES.includes(req.purpose) && this.worldCallsToday() >= getSettings(this.db).ai.worldDailyLimit) {
      return this.viaFallback(req) ?? { ok: false, code: 'limit_reached', message: 'Tageslimit für KI-Weltaktivität erreicht.' };
    }
    const outcome = await this.callProvider(sel.provider, sel.model, req);
    if (outcome.ok) {
      this.lastError = null;
      return { ok: true, text: outcome.text, provider: sel.provider, model: outcome.model, costUsd: outcome.costUsd ?? null };
    }
    if (outcome.code !== 'busy') this.recordError(sel.provider, outcome.code, outcome.message);
    const notice = { code: outcome.code, message: outcome.message };
    return this.viaFallback(req, notice) ?? { ok: false, ...notice };
  }

  /** Verbindungstest auf ausdrücklichen Wunsch. Lokal kostenlos; Server: eine minimale Anfrage (max. 8 Tokens). */
  async testConnection(target: 'local' | 'server'): Promise<AiTestResult> {
    const started = Date.now();
    const fail = (code: string, message: string): AiTestResult => ({
      ok: false,
      provider: target,
      model: null,
      durationMs: Date.now() - started,
      error: { code, message },
    });
    const req: AiCallRequest = {
      purpose: 'test',
      kind: 'chat',
      maxTokens: 8,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a connection test. Reply with the single word OK.' },
        { role: 'user', content: 'Test' },
      ],
    };
    let model: string;
    if (target === 'local') {
      await this.local.refresh(true);
      const ready = this.local.readiness(getSettings(this.db).ai.localModel);
      if (!ready.ready || !ready.model) return fail(ready.reason ?? 'unavailable', 'Lokale KI nicht bereit.');
      model = ready.model;
    } else {
      this.server.resetBlock();
      if (!this.server.configured()) return fail('server-not-configured', 'Server-KI ist nicht konfiguriert.');
      model = this.server.modelFor('chat');
    }
    const outcome = await this.callProvider(target, model, req);
    if (!outcome.ok) {
      if (outcome.code !== 'busy') this.recordError(target, outcome.code, outcome.message);
      return { ...fail(outcome.code, safeMessage(outcome.message)), model };
    }
    this.lastError = null;
    return { ok: true, provider: target, model: outcome.model, reply: outcome.text.slice(0, 100), durationMs: Date.now() - started };
  }

  usageEntries(limit = 50): AiUsageEntryDto[] {
    return all<{
      id: number;
      created_at: string;
      provider: ProviderId;
      purpose: string;
      model: string;
      prompt_tokens: number;
      completion_tokens: number;
      cost_usd: number | null;
      cost_estimated: number;
      status: 'ok' | 'error';
      error_code: string | null;
      duration_ms: number;
    }>(this.db, 'SELECT * FROM ai_usage ORDER BY id DESC LIMIT ?', limit).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      provider: r.provider,
      purpose: r.purpose,
      model: r.model,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      costUsd: r.cost_usd,
      costEstimated: Boolean(r.cost_estimated),
      status: r.status,
      errorCode: r.error_code,
      durationMs: r.duration_ms,
    }));
  }
}
