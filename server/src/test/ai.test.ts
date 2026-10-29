import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';
import { parseChatTurn } from '../ai/structured';
import { get, run } from '../db/database';
import { sendMessage } from '../services/chats';
import { getSettings, updateSettings } from '../services/settings';
import { createTestContext, joinAsCustom, ollamaMock, openRouterMock, routeMocks, TEST_CONFIG, type MockHandler } from './helpers';

const messages = [{ role: 'user' as const, content: 'Hallo' }];
const KEY = 'sk-or-v1-geheimerschluessel-0123456789';
const SERVER = { ...TEST_CONFIG.serverAi, enabled: true, apiKey: KEY, model: 'test/free-model' };

function ctxWith(local: MockHandler | null, server: MockHandler | null, serverConfig: Partial<typeof SERVER> | null = null) {
  return createTestContext({
    handler: routeMocks(local, server),
    config: serverConfig ? { serverAi: { ...SERVER, ...serverConfig } } : {},
  });
}

const serverCalls = (ctx: ReturnType<typeof createTestContext>) => ctx.fetchCalls.filter((c) => c.url.includes('openrouter.test'));
const serverCompletions = (ctx: ReturnType<typeof createTestContext>) => ctx.fetchCalls.filter((c) => c.url.endsWith('/chat/completions'));
const localChats = (ctx: ReturnType<typeof createTestContext>) => ctx.fetchCalls.filter((c) => c.url.endsWith('/api/chat'));

afterEach(() => vi.restoreAllMocks());

describe('Konfiguration', () => {
  it('hat sichere Standardwerte: lokale KI an, Server-KI aus', () => {
    const cfg = loadConfig({}, '/tmp/socialverse-test');
    expect(cfg.localAi.enabled).toBe(true);
    expect(cfg.localAi.baseUrl).toBe('http://127.0.0.1:11434');
    expect(cfg.serverAi.enabled).toBe(false);
    expect(cfg.serverAi.apiKey).toBeNull();
  });

  it('aktiviert die Server-KI nicht allein durch einen (alten) Schlüssel', () => {
    const cfg = loadConfig({ OPENROUTER_API_KEY: KEY, SERVER_AI_MODEL: 'x/y' }, '/tmp/socialverse-test');
    expect(cfg.serverAi.apiKey).toBe(KEY);
    expect(cfg.serverAi.enabled).toBe(false);
  });

  it('verwirft ungültige Werte und Adressen mit Zugangsdaten', () => {
    const cfg = loadConfig(
      {
        SERVER_AI_ENABLED: 'vielleicht',
        SERVER_AI_MAX_TOKENS: '999999',
        SERVER_AI_DAILY_BUDGET_USD: '-3',
        SERVER_AI_BASE_URL: 'https://user:pass@example.com/v1',
        LOCAL_AI_BASE_URL: 'file:///etc/passwd',
        LOCAL_AI_MODEL: 'gemma3:4b; rm -rf /',
        LOCAL_AI_TIMEOUT_MS: 'abc',
      },
      '/tmp/socialverse-test',
    );
    expect(cfg.serverAi.enabled).toBe(false);
    expect(cfg.serverAi.maxTokens).toBe(400);
    expect(cfg.serverAi.dailyBudgetUsd).toBe(0.2);
    expect(cfg.serverAi.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(cfg.localAi.baseUrl).toBe('http://127.0.0.1:11434');
    expect(cfg.localAi.model).toBe('');
    expect(cfg.localAi.timeoutMs).toBe(180_000);
  });

  it('übernimmt „KI aus“ aus Version 1 als Modus „nur simulierte KI“', () => {
    const ctx = createTestContext();
    run(ctx.db, `INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, JSON.stringify({ ai: { enabled: false, chatModel: 'alt/model' } }));
    const ai = getSettings(ctx.db).ai;
    expect(ai.mode).toBe('fallback');
    expect('chatModel' in ai).toBe(false);
  });
});

describe('Provider-Auswahl', () => {
  it('bevorzugt die lokale KI und lässt Einbettungsmodelle aus', async () => {
    const ctx = ctxWith(ollamaMock({ models: ['nomic-embed-text:latest', 'llama3.2:3b', 'gemma3:4b'] }), openRouterMock(), {});
    updateSettings(ctx.db, { ai: { serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result.ok && result.provider).toBe('local');
    expect(result.ok && result.model).toBe('gemma3:4b');
    expect(serverCalls(ctx)).toHaveLength(0);
  });

  it('nutzt das in .env festgelegte bzw. in der App gewählte lokale Modell', async () => {
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ models: ['gemma3:4b', 'qwen2.5:3b'] }), null),
      config: { localAi: { ...TEST_CONFIG.localAi, model: 'qwen2.5:3b' } },
    });
    await ctx.ai.refreshHealth(true);
    expect(ctx.ai.status().local.model).toBe('qwen2.5:3b');
    expect(ctx.ai.status().local.modelSource).toBe('env');

    const ctx2 = ctxWith(ollamaMock({ models: ['gemma3:4b', 'qwen2.5:3b'] }), null);
    updateSettings(ctx2.db, { ai: { localModel: 'qwen2.5:3b' } });
    await ctx2.ai.refreshHealth(true);
    expect(ctx2.ai.status().local.modelSource).toBe('settings');
    updateSettings(ctx2.db, { ai: { localModel: 'gibtsnicht:1b' } });
    expect(ctx2.ai.status().reason).toBe('local-model-missing');
    expect(ctx2.ai.status().active).toBe('fallback');
  });

  it('verwendet ohne lokale KI und ohne Server die simulierte KI – ganz ohne kostenpflichtige Anfrage', async () => {
    const ctx = ctxWith(ollamaMock({ down: true }), openRouterMock(), {});
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Simulierte Antwort' });
    expect(result).toMatchObject({ ok: true, provider: 'fallback', text: 'Simulierte Antwort' });
    expect(ctx.ai.status().reason).toBe('local-unreachable');
    // Server ist konfiguriert, aber nicht freigegeben → keinerlei Anfrage an ihn (auch nicht für Preise).
    expect(serverCalls(ctx)).toHaveLength(0);
  });

  it('fragt einen nicht aktivierten Server-Provider nie an – auch nicht mit Schlüssel und Freigabe', async () => {
    const ctx = ctxWith(null, openRouterMock(), { enabled: false });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result).toMatchObject({ ok: false, code: 'unavailable' });
    expect(ctx.ai.status().reason).toBe('server-not-configured');
    expect(serverCalls(ctx)).toHaveLength(0);
    const test = await ctx.ai.testConnection('server');
    expect(test.ok).toBe(false);
    expect(serverCalls(ctx)).toHaveLength(0);
  });

  it('weicht im Automatikmodus nur mit ausdrücklicher Freigabe auf die Server-KI aus', async () => {
    const ctx = ctxWith(ollamaMock({ down: true }), openRouterMock({ reply: 'vom Server' }), {});
    const before = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(before.ok).toBe(false);
    expect(serverCompletions(ctx)).toHaveLength(0);
    updateSettings(ctx.db, { ai: { serverConsent: true } });
    const after = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(after).toMatchObject({ ok: true, provider: 'server', text: 'vom Server' });
    expect(serverCompletions(ctx)).toHaveLength(1);
  });

  it('macht im Modus „nur simulierte KI“ keinerlei Netzwerkanfragen', async () => {
    const ctx = ctxWith(ollamaMock(), openRouterMock(), {});
    updateSettings(ctx.db, { ai: { mode: 'fallback', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'regelbasiert' });
    expect(result).toMatchObject({ ok: true, provider: 'fallback' });
    expect(ctx.fetchCalls).toHaveLength(0);
  });

  it('liefert ohne Fallback einen verständlichen Fehler statt einer Ausnahme', async () => {
    const ctx = ctxWith(null, null);
    const result = await ctx.ai.complete({ purpose: 'summary', kind: 'chat', messages });
    expect(result).toMatchObject({ ok: false, code: 'unavailable' });
  });
});

describe('Ausfälle und Zeitüberschreitungen', () => {
  // Regression „KI-Generierung fehlgeschlagen (Zeitüberschreitung)“: Ein Weltentwurf braucht auf einem Prozessor
  // Minuten, das alte feste Gesamtlimit (60 s, ohne Streaming) brach jede längere Generierung ab.
  it('lässt eine langsame, aber fortschreitende lokale Generierung zu Ende laufen', async () => {
    const reply = JSON.stringify({ name: 'Nebelhafen', note: 'x'.repeat(200) });
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ reply, delayMs: 150, tokenDelayMs: 25, chunks: 40 }), null),
      // Gesamtlimit für Chats (400 ms) ist kürzer als die Generierung (≈ 1,2 s) – das lange Limit gilt.
      config: { localAi: { ...TEST_CONFIG.localAi, timeoutMs: 400, longTimeoutMs: 5_000, loadTimeoutMs: 1_000, idleTimeoutMs: 300 } },
    });
    const progress: number[] = [];
    const result = await ctx.ai.complete({ purpose: 'generator', kind: 'world', messages, json: true, long: true, onProgress: (n) => progress.push(n) });
    expect(result).toMatchObject({ ok: true, provider: 'local', text: reply });
    expect(progress.length).toBeGreaterThanOrEqual(30);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(ctx.ai.status().local.tokensPerSecond).toBeGreaterThan(0);
  });

  it('bricht ab, wenn die Ausgabe stockt – ohne auf das Gesamtlimit zu warten', async () => {
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ tokenDelayMs: 600, chunks: 5 }), null),
      config: { localAi: { ...TEST_CONFIG.localAi, longTimeoutMs: 10_000, idleTimeoutMs: 150 } },
    });
    const started = Date.now();
    const result = await ctx.ai.complete({ purpose: 'generator', kind: 'world', messages, long: true, fallback: () => 'Ersatz' });
    expect(result).toMatchObject({ ok: true, provider: 'fallback', notice: { code: 'timeout' } });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('meldet ein zu langsames Laden des Modells verständlich', async () => {
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ delayMs: 400 }), null),
      config: { localAi: { ...TEST_CONFIG.localAi, loadTimeoutMs: 100 } },
    });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    expect(result.ok && result.notice?.code).toBe('timeout');
    expect(result.ok && result.notice?.message).toContain('nicht rechtzeitig mit der Antwort begonnen');
  });

  it('meldet eine langsame lokale KI nach einer Zeitüberschreitung nicht als „nicht erreichbar“', async () => {
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ delayMs: 300 }), null),
      config: { localAi: { ...TEST_CONFIG.localAi, loadTimeoutMs: 50 } },
    });
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    const status = ctx.ai.status();
    expect(status.local.reachable).toBe(true);
    expect(status.active).toBe('local');
    expect(status.local.lastTimeout?.message).toContain('nicht rechtzeitig');
    // Die nächste Anfrage versucht es erneut statt sofort auszuweichen.
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    expect(localChats(ctx)).toHaveLength(2);
  });

  it('weicht bei nicht erreichbarer lokaler KI sofort aus, ohne zu warten', async () => {
    const ctx = ctxWith(ollamaMock({ down: true }), null);
    const started = Date.now();
    const result = await ctx.ai.complete({ purpose: 'generator', kind: 'world', messages, long: true, fallback: () => 'Ersatz' });
    expect(result).toMatchObject({ ok: true, provider: 'fallback' });
    expect(localChats(ctx)).toHaveLength(0);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('bricht eine Generierung auf Wunsch ab', async () => {
    const ctx = ctxWith(ollamaMock({ tokenDelayMs: 200, chunks: 20 }), null);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const result = await ctx.ai.complete({ purpose: 'generator', kind: 'world', messages, long: true, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, code: 'cancelled' });
    expect(ctx.ai.status().lastError).toBeNull();
  });

  it('sendet ein JSON-Schema ab Ollama 0.5, älteren Versionen nur den JSON-Modus', async () => {
    const schema = { type: 'object', properties: { reply: { type: 'string', maxLength: 50 } } };
    const modern = ctxWith(ollamaMock({ version: '0.6.2' }), null);
    await modern.ai.complete({ purpose: 'chat', kind: 'chat', messages, json: schema });
    expect((localChats(modern)[0].body as { format: unknown }).format).toEqual(schema);
    const old = ctxWith(ollamaMock({ version: '0.4.7' }), null);
    await old.ai.complete({ purpose: 'chat', kind: 'chat', messages, json: schema });
    expect((localChats(old)[0].body as { format: unknown }).format).toBe('json');
    const body = localChats(old)[0].body as { stream: boolean; options: { num_ctx: number } };
    expect(body.stream).toBe(true);
    expect(body.options.num_ctx).toBe(4096);
  });

  it('kennzeichnet am Token-Limit abgeschnittene Ausgaben', async () => {
    const ctx = ctxWith(ollamaMock({ doneReason: 'length', reply: '{"name": "Abgeschn' }), null);
    const result = await ctx.ai.complete({ purpose: 'generator', kind: 'world', messages, long: true });
    expect(result).toMatchObject({ ok: true, truncated: true });
  });

  it('meldet ein nicht installiertes Modell verständlich', async () => {
    const ctx = ctxWith(ollamaMock({ chatStatus: 404 }), null);
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    expect(result).toMatchObject({ ok: true, provider: 'fallback', notice: { code: 'model_unavailable' } });
  });

  it('lässt Hintergrundaufgaben bei belegter lokaler KI aus, statt zu stauen', async () => {
    const ctx = ctxWith(ollamaMock({ delayMs: 100 }), null);
    updateSettings(ctx.db, { ai: { worldActivityEnabled: true } });
    const chat = ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    await new Promise((r) => setTimeout(r, 20));
    const world = await ctx.ai.complete({ purpose: 'world', kind: 'world', messages, fallback: () => 'Vorlage' });
    expect(world).toMatchObject({ ok: true, provider: 'fallback' });
    expect((await chat).ok).toBe(true);
  });

  it('wiederholt fehlgeschlagene Server-Anfragen nicht und sperrt den Server nach Zugangsfehlern', async () => {
    const ctx = ctxWith(null, openRouterMock({ failModels: { 'test/free-model': 401 } }), {});
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const first = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    expect(first).toMatchObject({ ok: true, provider: 'fallback', notice: { code: 'unauthorized' } });
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages, fallback: () => 'Ersatz' });
    expect(serverCompletions(ctx)).toHaveLength(1);
    expect(ctx.ai.status().reason).toBe('server-blocked');
  });

  it('versucht bei Serverausfall kein anderes (kostenpflichtiges) Modell', async () => {
    const ctx = ctxWith(null, openRouterMock({ failModels: { 'test/free-model': 503 } }), {});
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result).toMatchObject({ ok: false, code: 'model_unavailable' });
    expect(serverCompletions(ctx)).toHaveLength(1);
  });
});

describe('Limits und Kosten der Server-KI', () => {
  it('lehnt Anfragen mit unbekannten Kosten ab', async () => {
    const failingPrices: MockHandler = (url, body) => (url.endsWith('/models') ? { status: 500, json: {} } : openRouterMock()(url, body));
    const ctx = ctxWith(null, failingPrices, {});
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result).toMatchObject({ ok: false, code: 'limit_reached' });
    expect(serverCompletions(ctx)).toHaveLength(0);
  });

  it('erlaubt bei Budget 0 nur kostenlose Modelle', async () => {
    const ctx = ctxWith(null, openRouterMock(), { model: 'test/paid-model' });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true, dailyBudgetUsd: 0 } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result).toMatchObject({ ok: false, code: 'limit_reached' });
    expect(serverCompletions(ctx)).toHaveLength(0);
  });

  it('nutzt Preise aus der Konfiguration und protokolliert geschätzte Kosten', async () => {
    const ctx = ctxWith(null, openRouterMock({ cost: null }), { model: 'test/paid-model', priceInputPerMTok: 1, priceOutputPerMTok: 2 });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(result.ok).toBe(true);
    const [entry] = ctx.ai.usageEntries();
    expect(entry.provider).toBe('server');
    expect(entry.costEstimated).toBe(true);
    expect(entry.costUsd).toBeCloseTo((120 * 1 + 30 * 2) / 1e6);
    expect(ctx.fetchCalls.some((c) => c.url.endsWith('/models'))).toBe(false);
  });

  it('respektiert Tages- und Minutenlimits', async () => {
    const ctx = ctxWith(null, openRouterMock(), { maxRequestsPerMinute: 2 });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    for (let i = 0; i < 3; i++) await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(serverCompletions(ctx)).toHaveLength(2);

    const daily = ctxWith(null, openRouterMock(), {});
    updateSettings(daily.db, { ai: { mode: 'server', serverConsent: true, dailyRequestLimit: 1 } });
    await daily.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    const second = await daily.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(second).toMatchObject({ ok: false });
    expect(serverCompletions(daily)).toHaveLength(1);
    expect(daily.ai.status().limits.dailyRequestsReached).toBe(true);
  });

  it('begrenzt die Tokens auf das Minimum aus Einstellung und Betreiber-Obergrenze', async () => {
    const ctx = ctxWith(null, openRouterMock(), { maxTokens: 120 });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true, maxTokens: 400 } });
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect((serverCompletions(ctx)[0].body as { max_tokens: number }).max_tokens).toBe(120);
  });

  it('protokolliert lokale Anfragen kostenlos und getrennt vom Server-Budget', async () => {
    const ctx = ctxWith(ollamaMock(), null);
    await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    const status = ctx.ai.status();
    expect(status.localToday).toBe(1);
    expect(status.today.requests).toBe(0);
    expect(ctx.ai.usageEntries()[0]).toMatchObject({ provider: 'local', costUsd: 0 });
  });
});

describe('Schutz von Geheimnissen', () => {
  it('zeigt den Schlüssel weder im Status noch in Protokollen oder Fehlermeldungen', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const leaky: MockHandler = (url) =>
      url.endsWith('/models')
        ? openRouterMock()(url, null)
        : { status: 400, json: { error: { message: `Bad key ${KEY} Bearer ${KEY}` } } };
    const ctx = ctxWith(null, leaky, {});
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
    expect(JSON.stringify(result)).not.toContain('geheimerschluessel');
    expect(JSON.stringify(ctx.ai.status())).not.toContain('geheimerschluessel');
    expect(JSON.stringify(ctx.ai.usageEntries())).not.toContain('geheimerschluessel');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('geheimerschluessel');
    // Der Schlüssel geht ausschließlich im Authorization-Header an den konfigurierten Server.
    expect(JSON.stringify(ctx.fetchCalls)).not.toContain('geheimerschluessel');
  });
});

describe('Strukturierte Ergebnisse und Spielregeln', () => {
  it('liest JSON-Antworten und fängt kaputte Ausgaben ab', () => {
    expect(parseChatTurn('{"reply":"Hi!","tone":"warm"}')).toEqual({ reply: 'Hi!', tone: 'warm', structured: true });
    expect(parseChatTurn('```json\n{"reply":"Na?","tone":"wütend"}\n```')).toEqual({ reply: 'Na?', tone: 'neutral', structured: true });
    expect(parseChatTurn('Einfach nur Text.')).toEqual({ reply: 'Einfach nur Text.', tone: 'neutral', structured: false });
    expect(parseChatTurn('{"reply": "abgebrochen')).toBeNull();
    expect(parseChatTurn('{"tone":"warm"}')).toBeNull();
    expect(parseChatTurn('{"reply":"Mein Code: sk-or-v1-abcdefghijklmnop","tone":"neutral"}')?.reply).not.toContain('sk-or');
  });

  it('ändert Zuneigung nur über die Spielregel (±1, einmal täglich) und nie XP', async () => {
    const xpOf = (c: ReturnType<typeof createTestContext>, id: string) => get<{ xp: number }>(c.db, 'SELECT xp FROM players WHERE id = ?', id)!.xp;
    const affinityOf = (c: ReturnType<typeof createTestContext>, playerId: string) => {
      const pc = get<{ character_id: string }>(c.db, 'SELECT character_id FROM players WHERE id = ?', playerId)!.character_id;
      const [a, b] = pc < 'c-mira' ? [pc, 'c-mira'] : ['c-mira', pc];
      return get<{ affinity: number }>(c.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b)?.affinity ?? 0;
    };
    // Die KI „verspricht“ XP und Quest-Abschluss – das darf nichts bewirken.
    const greedy = JSON.stringify({ reply: 'Du bekommst 9999 XP!', tone: 'warm', xp: 9999, questCompleted: true, affinity: 100 });
    const ai = ctxWith(ollamaMock({ reply: greedy }), null);
    const plain = ctxWith(null, null);
    const pAi = joinAsCustom(ai, 'w-neon');
    const pPlain = joinAsCustom(plain, 'w-neon');
    for (const text of ['Hallo', 'Wie geht es dir?']) {
      await sendMessage(ai, 'c-mira', { content: text });
      await sendMessage(plain, 'c-mira', { content: text });
    }
    expect(xpOf(ai, pAi)).toBe(xpOf(plain, pPlain));
    // +1 durch die freundliche Stimmung, aber nur einmal am Tag.
    expect(affinityOf(ai, pAi) - affinityOf(plain, pPlain)).toBe(1);
  });

  it('kennzeichnet die Herkunft jeder Antwort', async () => {
    const ctx = ctxWith(ollamaMock({ down: true }), null);
    joinAsCustom(ctx, 'w-neon');
    const result = await sendMessage(ctx, 'c-mira', { content: 'Hallo' });
    expect(result.reply.provider).toBe('fallback');
    expect(result.reply.source).toBe('demo');
    expect(result.notice).toBeUndefined();
  });
});
