import { describe, expect, it } from 'vitest';
import { get } from '../db/database';
import { buildChatMessages, getChat, sendMessage } from '../services/chats';
import { demoReply, extractFacts, keywordOf, localSummary } from '../services/demoResponder';
import { updateSettings } from '../services/settings';
import { createTestContext, joinAsCustom, ollamaMock, openRouterMock, routeMocks, TEST_CONFIG } from './helpers';

const SERVER = { ...TEST_CONFIG.serverAi, enabled: true, apiKey: 'sk-or-test-1234567890', model: 'test/free-model' };

const character = {
  id: 'c-x',
  name: 'Testa',
  tagline: 'Eine Testfigur',
  description: 'Beschreibung',
  role: 'Testerin',
  interests: ['Schach'],
  writingStyle: 'casual' as const,
  worldName: 'Testwelt',
  worldTagline: 'Tagline',
  relations: ['Freund A'],
};

describe('Demo-Antworten und Erinnerung', () => {
  it('erkennt einfache Fakten', () => {
    expect(extractFacts('Hallo, ich heiße Michel und ich mag alte Synthesizer.', 'de')).toEqual(['Name: Michel', 'Mag alte Synthesizer']);
    expect(extractFacts('My name is Ada. I live in Berlin', 'en')).toEqual(['Name: Ada', 'Lives in Berlin']);
    expect(extractFacts('Merk dir: Ich habe morgen Geburtstag', 'de')).toEqual(['Ich habe morgen Geburtstag']);
    expect(extractFacts('Wie geht es dir?', 'de')).toEqual([]);
  });

  it('erzeugt deterministische, stilgerechte Antworten', () => {
    const ctx = { lang: 'de' as const, userName: 'Michel', facts: [], lastEvent: null, turn: 0 };
    const a = demoReply(character, 'Hallo!', ctx);
    expect(a).toBe(demoReply(character, 'Hallo!', ctx));
    expect(a).toContain('Michel');
    expect(demoReply(character, 'Wer bist du?', ctx)).toContain('Testa');
    expect(demoReply({ ...character, writingStyle: 'terse' }, 'Erzähl mir von Raumschiffen', ctx)).toBe(
      demoReply({ ...character, writingStyle: 'terse' }, 'Erzähl mir von Raumschiffen', ctx).toLowerCase(),
    );
  });

  it('nutzt gemerkte Fakten in späteren Antworten', () => {
    const reply = demoReply(character, 'Was denkst du über Wetter?', {
      lang: 'de',
      userName: null,
      facts: ['Mag Katzen'],
      lastEvent: null,
      turn: 2,
    });
    expect(reply).toContain('Mag Katzen');
  });

  it('wählt Stichwörter ohne Füllwörter', () => {
    expect(keywordOf('Was hältst du von Raumstationen?')).toBe('Raumstationen');
    expect(keywordOf('und oder aber')).toBeNull();
    expect(localSummary(['Raumschiffe sind toll', 'Raumschiffe und Sterne'], null, 'de')).toContain('Raumschiffe');
  });
});

describe('Chat-Service', () => {
  it('antwortet im Demo-Modus und speichert Verlauf und Fakten', async () => {
    const ctx = createTestContext();
    await expect(sendMessage(ctx, 'c-mira', { content: 'Hallo' })).rejects.toMatchObject({ code: 'not_joined' });
    joinAsCustom(ctx, 'w-neon');
    const result = await sendMessage(ctx, 'c-mira', { content: 'Hi! Ich heiße Lena.' });
    expect(result.reply.source).toBe('demo');
    expect(result.reply.content.length).toBeGreaterThan(0);
    expect(result.progress.xpGained).toBeGreaterThan(0);
    const chat = getChat(ctx, 'c-mira');
    expect(chat.messages).toHaveLength(2);
    expect(chat.memories.map((m) => m.content)).toContain('Name: Lena');
  });

  it('weist leere und zu lange Nachrichten ab', async () => {
    const ctx = createTestContext();
    joinAsCustom(ctx, 'w-neon');
    await expect(sendMessage(ctx, 'c-mira', { content: '   ' })).rejects.toThrow();
    await expect(sendMessage(ctx, 'c-mira', { content: 'x'.repeat(2500) })).rejects.toThrow();
    await expect(sendMessage(ctx, 'gibt-es-nicht', { content: 'Hallo' })).rejects.toThrow();
  });

  it('sendet nur das konfigurierte Fenster an die KI und erstellt eine Zusammenfassung', async () => {
    const ctx = createTestContext();
    updateSettings(ctx.db, { memory: { defaultWindow: 4 } });
    joinAsCustom(ctx, 'w-neon');
    for (let i = 0; i < 10; i++) await sendMessage(ctx, 'c-jonah', { content: `Nachricht Nummer ${i} über Raumschiffe` });
    const messages = buildChatMessages(ctx, 'c-jonah', 'Neue Frage');
    // Systemprompt + 4 Verlaufsnachrichten + neue Nachricht
    expect(messages).toHaveLength(6);
    expect(messages[0].role).toBe('system');
    const summary = get<{ content: string }>(ctx.db, `SELECT m.content FROM conversation_memories m JOIN conversations cv ON cv.id = m.conversation_id
        WHERE cv.character_id = 'c-jonah' AND m.kind = 'summary'`);
    expect(summary?.content).toContain('Raumschiffe');
  });

  it('verwendet die Server-KI nur mit Konfiguration und Freigabe', async () => {
    const ctx = createTestContext({
      handler: routeMocks(null, openRouterMock({ reply: 'Echte KI-Antwort' })),
      config: { serverAi: SERVER },
    });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    joinAsCustom(ctx, 'w-neon', 'Lena Probe');
    const result = await sendMessage(ctx, 'c-mira', { content: 'Hallo KI' });
    expect(result.reply.source).toBe('ai');
    expect(result.reply.provider).toBe('server');
    expect(result.reply.content).toBe('Echte KI-Antwort');
    expect(result.reply.model).toBe('test/free-model');
    const call = ctx.fetchCalls.find((c) => c.url.endsWith('/chat/completions'));
    const body = call?.body as { messages: { role: string; content: string }[]; max_tokens: number };
    expect(body.messages[0].content).toContain('Mira Vex');
    // Die Gegenseite kennt die Spielfigur, nicht das lokale Profil.
    expect(body.messages[0].content).toContain('Lena Probe');
    expect(body.messages.at(-1)?.content).toBe('Hallo KI');
    expect(body.max_tokens).toBe(400);
  });

  it('fällt bei KI-Fehlern auf die simulierte KI zurück und meldet den Grund', async () => {
    const ctx = createTestContext({
      handler: routeMocks(null, openRouterMock({ failModels: { 'test/free-model': 401 } })),
      config: { serverAi: SERVER },
    });
    updateSettings(ctx.db, { ai: { mode: 'server', serverConsent: true } });
    joinAsCustom(ctx, 'w-neon');
    const result = await sendMessage(ctx, 'c-mira', { content: 'Hallo' });
    expect(result.reply.source).toBe('demo');
    expect(result.reply.provider).toBe('fallback');
    expect(result.notice?.code).toBe('unauthorized');
  });

  it('antwortet mit der lokalen KI inklusive Spielkontext und strukturiertem Ergebnis', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock(), null) });
    joinAsCustom(ctx, 'w-neon', 'Lena Probe');
    const result = await sendMessage(ctx, 'c-mira', { content: 'Hallo Mira' });
    expect(result.reply.provider).toBe('local');
    expect(result.reply.model).toBe('gemma3:4b');
    expect(result.reply.content).toBe('Lokale Antwort der Figur.');
    const call = ctx.fetchCalls.find((c) => c.url.endsWith('/api/chat'));
    const body = call?.body as { format?: string; messages: { content: string }[]; options: { num_predict: number } };
    expect(body.format).toBe('json');
    expect(body.options.num_predict).toBeLessThanOrEqual(350);
    expect(body.messages[0].content).toContain('Game context (read-only)');
    expect(body.messages[0].content).toContain('never claim to award XP');
    // Kein Aufruf an einen kostenpflichtigen Dienst.
    expect(ctx.fetchCalls.some((c) => c.url.includes('openrouter.test'))).toBe(false);
  });
});
