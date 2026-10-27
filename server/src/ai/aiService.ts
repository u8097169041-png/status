import type {
  AiModelDto,
  AiStatusDto,
  AiTestResult,
  AiUsageEntryDto,
  AiUsageSummary,
} from '../../../shared/types';
import type { AppConfig } from '../config';
import { all, get, run, type DB } from '../db/database';
import { dayKey, monthKey } from '../lib/time';
import { getSecret, getSettings } from '../services/settings';
import {
  OpenRouterClient,
  type AiErrorCode,
  type ChatMessage,
  type FetchFn,
  type OpenRouterModel,
} from './openrouter';

export const API_KEY_SECRET = 'openrouter_api_key';

export type AiPurpose = 'chat' | 'summary' | 'world' | 'reaction' | 'generator' | 'test';

export interface AiCallRequest {
  purpose: AiPurpose;
  /** Welche Modelleinstellung verwendet wird. */
  kind: 'chat' | 'world';
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export type AiCallResult =
  | { ok: true; text: string; model: string; costUsd: number | null }
  | { ok: false; code: AiErrorCode; message: string };

const MODEL_CACHE_MS = 60 * 60 * 1000;

function maskKey(key: string): string {
  if (key.length <= 10) return '••••';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export class AiService {
  private readonly client: OpenRouterClient;
  private modelCache: { at: number; models: OpenRouterModel[] } | null = null;
  private lastError: { code: string; message: string; at: string } | null = null;

  constructor(
    private readonly db: DB,
    private readonly config: AppConfig,
    private readonly now: () => Date,
    fetchFn?: FetchFn,
  ) {
    this.client = new OpenRouterClient(config.openRouterBaseUrl, fetchFn);
  }

  apiKey(): { key: string; source: 'env' | 'local' } | null {
    if (this.config.openRouterApiKey) return { key: this.config.openRouterApiKey, source: 'env' };
    const local = getSecret(this.db, API_KEY_SECRET);
    return local ? { key: local, source: 'local' } : null;
  }

  modelFor(kind: 'chat' | 'world'): string {
    const { ai } = getSettings(this.db);
    return kind === 'world' ? ai.worldModel || ai.chatModel : ai.chatModel;
  }

  /** True, wenn echte KI-Aufrufe grundsätzlich möglich sind (Schlüssel, Modell, aktiviert). */
  isActive(kind: 'chat' | 'world' = 'chat'): boolean {
    const { ai } = getSettings(this.db);
    return Boolean(ai.enabled && this.apiKey() && this.modelFor(kind));
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

  private summary(column: 'day' | 'month', value: string): AiUsageSummary {
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
         FROM ai_usage WHERE ${column} = ?`,
      value,
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

  status(): AiStatusDto {
    const settings = getSettings(this.db);
    const key = this.apiKey();
    const now = this.now();
    const today = this.summary('day', dayKey(now));
    const month = this.summary('month', monthKey(now));
    const demoReason: AiStatusDto['demoReason'] = !key
      ? 'no-key'
      : !settings.ai.enabled
        ? 'disabled'
        : !settings.ai.chatModel
          ? 'no-model'
          : null;
    return {
      keyConfigured: Boolean(key),
      keySource: key?.source ?? null,
      keyHint: key ? maskKey(key.key) : null,
      enabled: settings.ai.enabled,
      chatModel: settings.ai.chatModel,
      worldModel: settings.ai.worldModel || settings.ai.chatModel,
      mode: demoReason ? 'demo' : 'ai',
      demoReason,
      today,
      month,
      limits: {
        dailyRequestsReached: today.requests >= settings.ai.dailyRequestLimit,
        dailyBudgetReached: settings.ai.dailyBudgetUsd > 0 && today.costUsd >= settings.ai.dailyBudgetUsd,
        monthlyBudgetReached: settings.ai.monthlyBudgetUsd > 0 && month.costUsd >= settings.ai.monthlyBudgetUsd,
      },
      lastError: this.lastError,
    };
  }

  private async pricingFor(model: string): Promise<OpenRouterModel | null> {
    try {
      const models = await this.cachedModels(false);
      return models.find((m) => m.id === model) ?? null;
    } catch {
      return null;
    }
  }

  private async cachedModels(force: boolean): Promise<OpenRouterModel[]> {
    if (!force && this.modelCache && Date.now() - this.modelCache.at < MODEL_CACHE_MS) return this.modelCache.models;
    const models = await this.client.listModels();
    this.modelCache = { at: Date.now(), models };
    return models;
  }

  async listModels(force = false): Promise<AiModelDto[]> {
    const models = await this.cachedModels(force);
    return models
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.contextLength,
        promptPrice: m.promptPrice,
        completionPrice: m.completionPrice,
        isFree: m.promptPrice === 0 && m.completionPrice === 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Prüft die konfigurierten Limits vor einem Aufruf. Gibt einen Fehler zurück, wenn der Aufruf nicht erlaubt ist. */
  private async checkLimits(
    req: AiCallRequest,
    model: string,
    maxTokens: number,
  ): Promise<{ code: AiErrorCode; message: string } | null> {
    const { ai } = getSettings(this.db);
    const now = this.now();
    const today = this.summary('day', dayKey(now));
    if (today.requests >= ai.dailyRequestLimit) {
      return { code: 'limit_reached', message: 'Tageslimit für KI-Anfragen erreicht.' };
    }
    if ((req.purpose === 'world' || req.purpose === 'reaction') && this.worldCallsToday() >= ai.worldDailyLimit) {
      return { code: 'limit_reached', message: 'Tageslimit für KI-Weltaktivität erreicht.' };
    }
    const month = this.summary('month', monthKey(now));
    const pricing = await this.pricingFor(model);
    const promptChars = req.messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimate =
      pricing && pricing.promptPrice !== null && pricing.completionPrice !== null
        ? (promptChars / 3.5) * pricing.promptPrice + maxTokens * pricing.completionPrice
        : null;
    const budgets: [number, number, string][] = [
      [ai.dailyBudgetUsd, today.costUsd, 'Tagesbudget'],
      [ai.monthlyBudgetUsd, month.costUsd, 'Monatsbudget'],
    ];
    for (const [budget, spent, label] of budgets) {
      if (budget === 0) {
        // Budget 0 bedeutet: nur nachweislich kostenlose Modelle verwenden.
        if (estimate === null || estimate > 0) {
          return {
            code: 'limit_reached',
            message: `${label} ist 0 – nur kostenlose Modelle mit bekannten Preisen sind erlaubt.`,
          };
        }
      } else if (spent + (estimate ?? 0) > budget) {
        return { code: 'limit_reached', message: `${label} erreicht.` };
      }
    }
    return null;
  }

  private logUsage(entry: {
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
      `INSERT INTO ai_usage (created_at, day, month, purpose, model, prompt_tokens, completion_tokens, cost_usd,
                             cost_estimated, status, error_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      now.toISOString(),
      dayKey(now),
      monthKey(now),
      entry.purpose,
      entry.model,
      entry.promptTokens,
      entry.completionTokens,
      entry.costUsd,
      entry.costEstimated,
      entry.status,
      entry.errorCode,
      entry.durationMs,
    );
  }

  private recordError(code: string, message: string): void {
    this.lastError = { code, message, at: this.now().toISOString() };
    // Nur Fehlercode und bereinigte Meldung protokollieren – niemals Schlüssel oder Inhalte.
    console.warn(`[ai] Fehler: ${code} – ${message}`);
  }

  /** Führt einen KI-Aufruf mit Limitprüfung, Fallback-Modellen und Nutzungsprotokoll aus. */
  async complete(req: AiCallRequest): Promise<AiCallResult> {
    const settings = getSettings(this.db).ai;
    const key = this.apiKey();
    if (!settings.enabled) return { ok: false, code: 'disabled', message: 'KI-Anbindung ist deaktiviert.' };
    if (!key) return { ok: false, code: 'no_key', message: 'Kein API-Schlüssel konfiguriert.' };
    const primary = this.modelFor(req.kind);
    if (!primary) return { ok: false, code: 'no_model', message: 'Kein Modell ausgewählt.' };
    const models = [primary, ...settings.fallbackModels.filter((m) => m !== primary)];
    // Der Weltgenerator braucht für strukturierte Antworten etwas mehr Platz (fest begrenzt auf 1500 Tokens).
    const cap = req.purpose === 'generator' ? Math.max(settings.maxTokens, 1500) : settings.maxTokens;
    const maxTokens = Math.min(req.maxTokens ?? settings.maxTokens, cap);

    let lastFailure: { code: AiErrorCode; message: string } = { code: 'server_error', message: 'Unbekannter Fehler.' };
    for (const model of models) {
      const limit = await this.checkLimits(req, model, maxTokens);
      if (limit) {
        this.recordError(limit.code, limit.message);
        return { ok: false, ...limit };
      }
      const started = Date.now();
      const outcome = await this.client.complete({
        apiKey: key.key,
        model,
        messages: req.messages,
        maxTokens,
        temperature: req.temperature ?? settings.temperature,
        timeoutMs: settings.timeoutSeconds * 1000,
      });
      const durationMs = Date.now() - started;
      if (outcome.ok) {
        let cost = outcome.usage.costUsd;
        let estimated = false;
        if (cost === null) {
          const pricing = await this.pricingFor(model);
          if (pricing && pricing.promptPrice !== null && pricing.completionPrice !== null) {
            cost =
              outcome.usage.promptTokens * pricing.promptPrice + outcome.usage.completionTokens * pricing.completionPrice;
            estimated = true;
          }
        }
        this.logUsage({
          purpose: req.purpose,
          model: outcome.model,
          promptTokens: outcome.usage.promptTokens,
          completionTokens: outcome.usage.completionTokens,
          costUsd: cost,
          costEstimated: estimated,
          status: 'ok',
          errorCode: null,
          durationMs,
        });
        this.lastError = null;
        return { ok: true, text: outcome.text, model: outcome.model, costUsd: cost };
      }
      this.logUsage({
        purpose: req.purpose,
        model,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: null,
        costEstimated: false,
        status: 'error',
        errorCode: outcome.code,
        durationMs,
      });
      this.recordError(outcome.code, outcome.message);
      lastFailure = { code: outcome.code, message: outcome.message };
      if (!outcome.retriable) break;
    }
    return { ok: false, ...lastFailure };
  }

  async testConnection(): Promise<AiTestResult> {
    const started = Date.now();
    const key = this.apiKey();
    if (!key) {
      return { ok: false, model: null, durationMs: 0, error: { code: 'no_key', message: 'Kein API-Schlüssel konfiguriert.' } };
    }
    const model = this.modelFor('chat');
    if (!model) {
      const check = await this.client.checkKey(key.key);
      if (!check.ok) this.recordError(check.code, check.message);
      return check.ok
        ? { ok: true, model: null, durationMs: Date.now() - started, reply: 'key-valid' }
        : { ok: false, model: null, durationMs: Date.now() - started, error: { code: check.code, message: check.message } };
    }
    const result = await this.complete({
      purpose: 'test',
      kind: 'chat',
      maxTokens: 20,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a connection test. Reply with the single word OK.' },
        { role: 'user', content: 'Test' },
      ],
    });
    return result.ok
      ? { ok: true, model: result.model, reply: result.text.slice(0, 100), durationMs: Date.now() - started }
      : { ok: false, model, error: { code: result.code, message: result.message }, durationMs: Date.now() - started };
  }

  usageEntries(limit = 50): AiUsageEntryDto[] {
    return all<{
      id: number;
      created_at: string;
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
