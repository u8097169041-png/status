import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { LEGACY_API_KEY_SECRET } from '../ai/aiService';
import { setSecret } from '../services/settings';
import { createTestApp, createTestContext, joinAsCustom, TEST_CONFIG } from './helpers';

const W = { 'X-SocialVerse': '1' };

function setup() {
  const ctx = createTestContext();
  return { ctx, app: createTestApp(ctx) };
}

describe('API – Grundfunktionen und Schutz', () => {
  it('liefert Health und Bootstrap', async () => {
    const { app } = setup();
    await request(app).get('/api/health').expect(200, { ok: true, version: 'test' });
    const boot = await request(app).get('/api/bootstrap').expect(200);
    expect(boot.body.profile.displayName).toBe('Gast');
    expect(boot.body.ai.mode).toBe('auto');
    expect(boot.body.ai.active).toBe('fallback');
    expect(boot.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('lehnt schreibende Anfragen ohne CSRF-Header ab', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/posts').send({ content: 'x' }).expect(403);
    expect(res.body.error.code).toBe('csrf');
  });

  it('lehnt fremde Herkunft und fremde Hosts ab', async () => {
    const { app } = setup();
    await request(app).post('/api/posts').set(W).set('Origin', 'https://evil.example').send({ content: 'x' }).expect(403);
    await request(app).get('/api/health').set('Host', 'evil.example').expect(403);
  });

  it('meldet ungültiges JSON verständlich', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/posts').set(W).set('Content-Type', 'application/json').send('{kaputt').expect(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('gibt den Server-Schlüssel niemals zurück und nimmt keine Schlüssel von Spielern an', async () => {
    const key = 'sk-or-v1-supersecretvalue123456';
    const ctx = createTestContext({
      config: { serverAi: { ...TEST_CONFIG.serverAi, enabled: true, apiKey: key, model: 'test/free-model' } },
    });
    const app = createTestApp(ctx);
    const status = await request(app).get('/api/ai/status').expect(200);
    expect(status.body.server.configured).toBe(true);
    for (const path of ['/api/bootstrap', '/api/ai/status', '/api/settings', '/api/data/export', '/api/ai/usage']) {
      const res = await request(app).get(path).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('supersecretvalue');
    }
    // Es gibt keinen Endpunkt mehr, über den Spieler einen Schlüssel hinterlegen könnten.
    await request(app).put('/api/ai/key').set(W).send({ key: 'sk-or-v1-spielerschluessel123' }).expect(404);
    expect(JSON.stringify((await request(app).get('/api/ai/status')).body)).not.toContain('spielerschluessel');
  });

  it('entfernt einen alten, in der App gespeicherten Schlüssel, ohne ihn zu verwenden', async () => {
    const { app, ctx } = setup();
    setSecret(ctx.db, LEGACY_API_KEY_SECRET, 'sk-or-v1-alterschluessel12345', ctx.now());
    const before = await request(app).get('/api/ai/status').expect(200);
    expect(before.body.legacyKeyStored).toBe(true);
    expect(before.body.server.configured).toBe(false);
    expect(JSON.stringify(before.body)).not.toContain('alterschluessel');
    const removed = await request(app).delete('/api/ai/key').set(W).expect(200);
    expect(removed.body.legacyKeyStored).toBe(false);
  });

  it('validiert Einstellungen', async () => {
    const { app } = setup();
    await request(app).patch('/api/settings').set(W).send({ ai: { maxTokens: 999999 } }).expect(400);
    await request(app).patch('/api/settings').set(W).send({ unbekannt: true }).expect(400);
    const ok = await request(app).patch('/api/settings').set(W).send({ language: 'en', ai: { maxTokens: 300 } }).expect(200);
    expect(ok.body.language).toBe('en');
    expect(ok.body.ai.maxTokens).toBe(300);
  });
});

describe('API – Beiträge', () => {
  it('unterstützt den vollständigen Lebenszyklus eines Beitrags', async () => {
    const { app, ctx } = setup();
    const blocked = await request(app).post('/api/posts').set(W).send({ content: 'Ohne Welt', worldId: 'w-neon' }).expect(409);
    expect(blocked.body.error.code).toBe('not_joined');
    joinAsCustom(ctx, 'w-neon', 'Posterin');
    const created = await request(app).post('/api/posts').set(W).send({ content: 'Mein Test #hallo <script>alert(1)</script>', worldId: 'w-neon' }).expect(201);
    const id = created.body.post.id as string;
    expect(created.body.post.tags).toEqual(['hallo']);
    // Inhalt wird unverändert als Text gespeichert; die Ausgabe erfolgt im Frontend ausschließlich als Text.
    expect(created.body.post.content).toContain('<script>');
    expect(created.body.progress.xpGained).toBe(15);
    // Autor ist die Spielfigur der Welt.
    expect(created.body.post.author.name).toBe('Posterin');
    expect(created.body.post.author.playerId).toBeTruthy();

    const liked = await request(app).put(`/api/posts/${id}/like`).set(W).expect(200);
    expect(liked.body.post.likedByMe).toBe(true);
    const unliked = await request(app).delete(`/api/posts/${id}/like`).set(W).expect(200);
    expect(unliked.body.post.likedByMe).toBe(false);

    const saved = await request(app).put(`/api/posts/${id}/bookmark`).set(W).expect(200);
    expect(saved.body.post.bookmarkedByMe).toBe(true);
    const bookmarks = await request(app).get('/api/posts?bookmarked=1').expect(200);
    expect(bookmarks.body.items.map((p: { id: string }) => p.id)).toContain(id);

    const comment = await request(app).post(`/api/posts/${id}/comments`).set(W).send({ content: 'Erster!' }).expect(201);
    await request(app).post(`/api/posts/${id}/comments`).set(W).send({ content: 'Antwort', parentId: comment.body.comment.id }).expect(201);
    const detail = await request(app).get(`/api/posts/${id}`).expect(200);
    expect(detail.body.comments).toHaveLength(1);
    expect(detail.body.comments[0].replies).toHaveLength(1);

    const edited = await request(app).patch(`/api/posts/${id}`).set(W).send({ content: 'Bearbeitet #neu' }).expect(200);
    expect(edited.body.editedAt).not.toBeNull();
    expect(edited.body.tags).toEqual(['neu']);

    await request(app).delete(`/api/posts/${id}`).set(W).expect(204);
    await request(app).get(`/api/posts/${id}`).expect(404);
  });

  it('verhindert das Bearbeiten fremder Beiträge und leere Beiträge', async () => {
    const { app, ctx } = setup();
    joinAsCustom(ctx, 'w-neon');
    await request(app).patch('/api/posts/p-mira-1').set(W).send({ content: 'gehackt' }).expect(403);
    await request(app).delete('/api/posts/p-mira-1').set(W).expect(403);
    await request(app).post('/api/posts').set(W).send({ content: '   ' }).expect(400);
    await request(app).post('/api/posts').set(W).send({ content: 'x'.repeat(1001) }).expect(400);
  });

  it('erlaubt Reposts nur einmal und filtert nach Welt, Charakter und Thema', async () => {
    const { app, ctx } = setup();
    await request(app).post('/api/posts/p-jonah-1/repost').set(W).send({}).expect(409);
    joinAsCustom(ctx, 'w-neon');
    joinAsCustom(ctx, 'w-aurelia');
    await request(app).post('/api/posts/p-jonah-1/repost').set(W).send({}).expect(201);
    const second = await request(app).post('/api/posts/p-jonah-1/repost').set(W).send({}).expect(409);
    expect(second.body.error.code).toBe('already_reposted');
    const byWorld = await request(app).get('/api/posts?world=w-aurelia').expect(200);
    expect(byWorld.body.items.every((p: { worldId: string }) => p.worldId === 'w-aurelia')).toBe(true);
    const byChar = await request(app).get('/api/posts?character=c-pip').expect(200);
    expect(byChar.body.items.every((p: { author: { id: string } }) => p.author.id === 'c-pip')).toBe(true);
    const byTag = await request(app).get('/api/posts?tag=aurelia').expect(200);
    expect(byTag.body.items.length).toBeGreaterThan(0);
  });

  it('paginiert den Feed stabil', async () => {
    const { app, ctx } = setup();
    // Ohne Beitritt keine Weltbeiträge
    expect((await request(app).get('/api/posts?limit=5').expect(200)).body.items).toHaveLength(0);
    joinAsCustom(ctx, 'w-neon');
    joinAsCustom(ctx, 'w-aurelia');
    const first = await request(app).get('/api/posts?limit=5').expect(200);
    expect(first.body.items).toHaveLength(5);
    const next = await request(app).get(`/api/posts?limit=5&cursor=${encodeURIComponent(first.body.nextCursor)}`).expect(200);
    const ids = new Set(first.body.items.map((p: { id: string }) => p.id));
    expect(next.body.items.some((p: { id: string }) => ids.has(p.id))).toBe(false);
  });
});

describe('API – Charaktere, Welten, Daten', () => {
  it('legt Charaktere an, prüft Handles und schützt vorgefertigte Figuren', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/characters')
      .set(W)
      .send({ name: 'Nia Test', handle: 'nia_test', worldId: 'w-neon', personality: ['neugierig'], isRealPersonSim: true })
      .expect(201);
    expect(res.body.character.isRealPersonSim).toBe(true);
    expect(res.body.character.worldId).toBe('w-neon');
    await request(app).post('/api/characters').set(W).send({ name: 'Doppelt', handle: 'nia_test' }).expect(409);
    await request(app).post('/api/characters').set(W).send({ name: '' }).expect(400);
    await request(app).put('/api/characters/c-mira').set(W).send({ name: 'X' }).expect(403);
    const updated = await request(app).put(`/api/characters/${res.body.character.id}`).set(W).send({ name: 'Nia Neu', handle: 'nia_test' }).expect(200);
    expect(updated.body.name).toBe('Nia Neu');
    await request(app).delete(`/api/characters/${res.body.character.id}`).set(W).expect(204);
  });

  it('generiert und erstellt eine Welt samt Bewohnern', async () => {
    const { app } = setup();
    const draft = await request(app).post('/api/worlds/generate').set(W).send({ genre: 'steampunk', characterCount: 2, seed: 'fix' }).expect(200);
    expect(draft.body.source).toBe('demo');
    expect(draft.body.characters).toHaveLength(2);
    const { characters, source: _s, ...world } = draft.body;
    const created = await request(app).post('/api/worlds').set(W).send({ world, characters }).expect(201);
    expect(created.body.world.characters).toHaveLength(2);
    expect(created.body.progress.xpGained).toBeGreaterThan(0);
    const sim = await request(app).post(`/api/worlds/${created.body.world.id}/simulate`).set(W).expect(200);
    expect(sim.body.world.day).toBe(2);
    await request(app).delete('/api/worlds/w-neon').set(W).expect(403);
    await request(app).delete(`/api/worlds/${created.body.world.id}`).set(W).expect(204);
  });

  it('exportiert Daten ohne Schlüssel und löscht auf Wunsch alles', async () => {
    const { app, ctx } = setup();
    joinAsCustom(ctx, 'w-neon');
    setSecret(ctx.db, LEGACY_API_KEY_SECRET, 'sk-or-v1-secretsecret12345', ctx.now());
    await request(app).post('/api/posts').set(W).send({ content: 'Wird gelöscht' }).expect(201);
    const exp = await request(app).get('/api/data/export').expect(200);
    expect(exp.body.tables.secrets).toBeUndefined();
    expect(exp.body.tables.posts.some((p: { content: string }) => p.content === 'Wird gelöscht')).toBe(true);
    await request(app).post('/api/data/reset').set(W).send({ confirm: 'nein' }).expect(400);
    await request(app).post('/api/data/reset').set(W).send({ confirm: 'RESET', language: 'en' }).expect(200);
    const after = await request(app).get('/api/posts?author=user').expect(200);
    expect(after.body.items).toHaveLength(0);
    const boot = await request(app).get('/api/bootstrap').expect(200);
    expect(boot.body.ai.legacyKeyStored).toBe(false);
    expect(boot.body.contentLanguage).toBe('en');
    expect(boot.body.profile.displayName).toBe('Guest');
    expect(boot.body.activePlayer).toBeNull();
    expect(boot.body.joinedWorlds).toHaveLength(0);
  });

  it('beantwortet Chat-Nachrichten im Demo-Modus über die API', async () => {
    const { app, ctx } = setup();
    await request(app).post('/api/chats/c-elowen/messages').set(W).send({ content: 'Hallo' }).expect(409);
    joinAsCustom(ctx, 'w-elder');
    const res = await request(app).post('/api/chats/c-elowen/messages').set(W).send({ content: 'Hallo Elowen!' }).expect(201);
    expect(res.body.reply.source).toBe('demo');
    const preview = await request(app).get('/api/chats/c-elowen/prompt-preview').expect(200);
    expect(preview.body.mode).toBe('demo');
    expect(preview.body.messages[0].content).toContain('Elowen Ashbrook');
    const list = await request(app).get('/api/chats').expect(200);
    expect(list.body[0].characterId).toBe('c-elowen');
  });
});
