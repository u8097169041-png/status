import { describe, expect, it } from 'vitest';
import { API_KEY_SECRET } from '../ai/aiService';
import { get } from '../db/database';
import { setSecret, updateSettings } from '../services/settings';
import { createTestContext, openRouterMock } from './helpers';

function configure(ctx: ReturnType<typeof createTestContext>, ai: Record<string, unknown>) {
  setSecret(ctx.db, API_KEY_SECRET, 'sk-or-test-1234567890', ctx.now());
  updateSettings(ctx.db, { ai });
}

const messages = [{ role: 'user' as const, content: 'Hallo' }];

describe('KI-Service', () => {
  it('meldet Demo-Modus ohne Schlüssel', () => {
    const ctx = createTestContext();
    const status = ctx.ai.status();
    expect(status.mode).toBe('demo');
    expect(status.demoReason).toBe('no-key');
    expect(status.keyHint).toBeNull();
  });

  it('maskiert den Schlüssel in der Statusanzeige', () => {
    const ctx = createTestContext();
    configure(ctx, { chatModel: 'test/free-model' });
    const status = ctx.ai.status();
    expect(status.mode).toBe('ai');
    expect(status.keyHint).not.toContain('1234567890');
    expect(JSON.stringify(status)).not.toContain('sk-or-test-1234567890');
  });

  it('bevorzugt den Schlüssel aus der Umgebungsvariable', () => {
    const ctx = createTestContext({ config: { openRouterApiKey: 'sk-or-env-abcdefghij' } });
    expect(ctx.ai.status().keySource).toBe('env');
  });

  it('nutzt Fallback-Modelle bei Nichtverfügbarkeit und protokolliert Kosten', async () => {
    const ctx = createTestContext({ handler: openRouterMock({ failModels: { 'test/paid-model': 503 }, cost: 0.00042 }) });
    configure(ctx, { chatModel: 'test/paid-model', fallbackModels: ['test/free-model'], dailyBudgetUsd: 1 });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.model).toBe('test/free-model');
    const rows = ctx.ai.usageEntries();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.status === 'error')?.errorCode).toBe('model_unavailable');
    expect(rows.find((r) => r.status === 'ok')?.costUsd).toBeCloseTo(0.00042);
  });

  it('bricht bei ungültigem Schlüssel ohne Fallback ab', async () => {
    const ctx = createTestContext({ handler: openRouterMock({ failModels: { 'test/free-model': 401 } }) });
    configure(ctx, { chatModel: 'test/free-model', fallbackModels: ['test/paid-model'] });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unauthorized');
    expect(ctx.fetchCalls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(1);
  });

  it('respektiert das Tageslimit für Anfragen', async () => {
    const ctx = createTestContext({ handler: openRouterMock() });
    configure(ctx, { chatModel: 'test/free-model', dailyRequestLimit: 1 });
    expect((await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages })).ok).toBe(true);
    const second = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('limit_reached');
  });

  it('erlaubt bei Budget 0 nur nachweislich kostenlose Modelle', async () => {
    const ctx = createTestContext({ handler: openRouterMock() });
    configure(ctx, { chatModel: 'test/paid-model', dailyBudgetUsd: 0 });
    const paid = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(paid.ok).toBe(false);
    updateSettings(ctx.db, { ai: { chatModel: 'test/free-model' } });
    const free = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(free.ok).toBe(true);
  });

  it('schätzt Kosten aus der Preisliste, wenn OpenRouter keine liefert', async () => {
    const ctx = createTestContext({ handler: openRouterMock({ cost: null }) });
    configure(ctx, { chatModel: 'test/paid-model', dailyBudgetUsd: 1 });
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    const row = get<{ cost_usd: number; cost_estimated: number }>(ctx.db, `SELECT cost_usd, cost_estimated FROM ai_usage WHERE status = 'ok'`);
    expect(row?.cost_estimated).toBe(1);
    expect(row?.cost_usd).toBeCloseTo(120 * 0.000001 + 30 * 0.000002);
  });

  it('behandelt ungültige Antworten und Zeitüberschreitungen sauber', async () => {
    const ctx = createTestContext({ handler: () => ({ status: 200, json: { unexpected: true } }) });
    configure(ctx, { chatModel: 'test/free-model', dailyBudgetUsd: 1 });
    const invalid = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe('invalid_response');

    const quick = openRouterMock();
    const slow = createTestContext({
      handler: (url, body) =>
        url.endsWith('/chat/completions')
          ? new Promise((resolve) => setTimeout(() => resolve({ status: 200, json: {} }), 8000))
          : quick(url, body),
    });
    configure(slow, { chatModel: 'test/free-model', timeoutSeconds: 5, dailyBudgetUsd: 1 });
    const timedOut = await slow.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) expect(timedOut.code).toBe('timeout');
  }, 15_000);

  it('testet die Verbindung ohne Modell nur über den Schlüssel-Endpunkt', async () => {
    const ctx = createTestContext({ handler: openRouterMock() });
    setSecret(ctx.db, API_KEY_SECRET, 'sk-or-test-1234567890', ctx.now());
    const result = await ctx.ai.testConnection();
    expect(result.ok).toBe(true);
    expect(ctx.fetchCalls.every((c) => !c.url.endsWith('/chat/completions'))).toBe(true);
  });
});
