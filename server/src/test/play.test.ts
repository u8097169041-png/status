import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../db/migrations';
import { all, get, migrate, run } from '../db/database';
import { applyContentUpdates } from '../db/seed';
import { getChat, listChats, sendMessage } from '../services/chats';
import { chooseOption, createStorylineDecision, listDecisions } from '../services/decisions';
import { getDiscover } from '../services/discover';
import { activatePlayer, activeWorldId, joinWorld, listPlayers } from '../services/players';
import { createPost, listPosts } from '../services/posts';
import { search } from '../services/search';
import { simulateWorld, triggerEvent } from '../services/simulation';
import { createStory, listStories } from '../services/stories';
import { buyItem, coinBalance, grantCoins, listShop } from '../services/wallet';
import { claimWorldQuest, listWorldQuests } from '../services/worldQuests';
import { createTestApp, createTestContext, joinAsCustom } from './helpers';

const W = { 'X-SocialVerse': '1' };

describe('Entdecken', () => {
  it('zeigt Vorschauen ohne globale Stories, mit Kategorien, bekannten Figuren und Szenarien', async () => {
    const ctx = createTestContext();
    const discover = getDiscover(ctx);
    expect(Object.keys(discover).sort()).toEqual(['featuredWorld', 'figures', 'popular', 'scenarios', 'worlds']);
    const categories = new Set(discover.worlds.map((w) => w.category));
    for (const c of ['politics', 'celebrity', 'business', 'sports', 'entertainment', 'scenario', 'fiction']) {
      expect(categories.has(c as never)).toBe(true);
    }
    expect(discover.figures.length).toBeGreaterThan(5);
    expect(discover.figures.every((f) => f.prominent)).toBe(true);
    expect(discover.scenarios.length).toBeGreaterThan(0);
    expect(discover.worlds.every((w) => !w.joined)).toBe(true);

    // Ohne Beitritt gibt es keine Stories – weder global noch für eine Welt.
    const app = createTestApp(ctx);
    const stories = await request(app).get('/api/stories').expect(200);
    expect(stories.body).toEqual([]);
    const blocked = await request(app).get('/api/stories?world=w-neon').expect(409);
    expect(blocked.body.error.code).toBe('not_joined');
  });
});

describe('Beitritt und Spielfiguren', () => {
  it('tritt mit einer eigenen Figur bei und speichert Profil, Ziele und aktive Welt', () => {
    const ctx = createTestContext();
    const { player, progress } = joinWorld(ctx, 'w-capital', {
      mode: 'custom',
      character: {
        name: 'Alex Vogt',
        role: 'Junge Abgeordnete',
        background: 'Kommt aus der Kommunalpolitik.',
        personality: ['ehrgeizig', 'ehrlich'],
        goals: ['Ein eigenes Gesetz durchbringen'],
      },
    });
    expect(player.mode).toBe('custom');
    expect(player.isActive).toBe(true);
    expect(player.character.name).toBe('Alex Vogt');
    expect(player.character.goals).toEqual(['Ein eigenes Gesetz durchbringen']);
    expect(player.character.isPlayer).toBe(true);
    expect(progress.xpGained).toBeGreaterThan(0);
    expect(activeWorldId(ctx)).toBe('w-capital');
    // Einstiegsentscheidung und Ankunftsereignis
    // Einstiegsentscheidung plus eine Entscheidung zur laufenden Geschichte (für die Nebenquest „Mitreden“)
    const pending = listDecisions(ctx, { playerId: player.id, status: 'pending' });
    expect(pending.map((d) => d.kind).sort()).toEqual(['intro', 'storyline']);
    expect(get(ctx.db, `SELECT 1 FROM world_events WHERE world_id = 'w-capital' AND kind = 'arrival'`)).toBeTruthy();
  });

  it('spielt eine bekannte Figur und wechselt kontrolliert ohne Datenverlust', () => {
    const ctx = createTestContext();
    const first = joinWorld(ctx, 'w-capital', { mode: 'existing', characterId: 'c-brandt' }).player;
    expect(first.character.prominent).toBe(true);
    expect(first.followers).toBeGreaterThan(1000);
    createPost(ctx, { content: 'Erste Rede als Kanzlerin #velmar', worldId: 'w-capital' });

    // Ohne Bestätigung kein Wechsel
    expect(() => joinWorld(ctx, 'w-capital', { mode: 'existing', characterId: 'c-ivy' })).toThrow(/bereits/);
    const second = joinWorld(ctx, 'w-capital', { mode: 'existing', characterId: 'c-ivy', confirmSwitch: true }).player;
    const players = listPlayers(ctx, 'w-capital');
    expect(players.filter((p) => p.isActive).map((p) => p.id)).toEqual([second.id]);
    expect(players.find((p) => p.id === first.id)?.retiredAt).not.toBeNull();
    // Beiträge der früheren Figur bleiben erhalten und ihr zugeordnet
    expect(listPosts(ctx, { playerId: first.id }).items).toHaveLength(1);

    // Zurückwechseln setzt den alten Spielstand fort
    const back = activatePlayer(ctx, first.id);
    expect(back.isActive).toBe(true);
    // Werte der alten Figur bleiben erhalten (plus Follower durch ihren Beitrag).
    expect(back.followers).toBeGreaterThanOrEqual(first.followers);
    expect(back.reputation).toBe(first.reputation);
    expect(listPlayers(ctx, 'w-capital').filter((p) => p.isActive)).toHaveLength(1);
  });

  it('verhindert ungültige Beitritte', () => {
    const ctx = createTestContext();
    expect(() => joinWorld(ctx, 'w-capital', { mode: 'existing', characterId: 'c-mira' })).toThrow(/gehört nicht/);
    expect(() => joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: '  ' } })).toThrow();
    expect(() => joinWorld(ctx, 'w-gibtsnicht', { mode: 'custom', character: { name: 'X' } })).toThrow();
  });

  it('bietet Beitritt, Wechsel und Spielerliste über die API an', async () => {
    const ctx = createTestContext();
    const app = createTestApp(ctx);
    const joined = await request(app)
      .post('/api/worlds/w-arena/join')
      .set(W)
      .send({ mode: 'custom', character: { name: 'Sam Kick', role: 'Neuzugang', goals: ['Stammplatz'] } })
      .expect(201);
    expect(joined.body.player.worldId).toBe('w-arena');
    const boot = await request(app).get('/api/bootstrap').expect(200);
    expect(boot.body.activeWorld.id).toBe('w-arena');
    expect(boot.body.activePlayer.character.name).toBe('Sam Kick');
    expect(boot.body.joinedWorlds).toHaveLength(1);
    expect(boot.body.pendingDecisions).toBe(2);
    const conflict = await request(app).post('/api/worlds/w-arena/join').set(W).send({ mode: 'existing', characterId: 'c-zoe' }).expect(409);
    expect(conflict.body.error.code).toBe('already_joined');
    await request(app).put('/api/session/world').set(W).send({ worldId: 'w-neon' }).expect(409);
    await request(app).post('/api/worlds/w-arena/leave').set(W).expect(200);
    const after = await request(app).get('/api/bootstrap').expect(200);
    expect(after.body.activePlayer).toBeNull();
  });
});

describe('Weltgebundene Inhalte', () => {
  it('zeigt Stories, Beiträge und Chats nur in der Welt, in der man spielt', async () => {
    const ctx = createTestContext();
    joinAsCustom(ctx, 'w-neon', 'Nia Neon');
    createStory(ctx, { content: 'Neon-Story' });
    const neonStories = listStories(ctx, 'w-neon');
    expect(neonStories.every((s) => s.worldId === 'w-neon')).toBe(true);
    expect(neonStories.find((s) => s.isOwn)?.author.name).toBe('Nia Neon');
    expect(() => listStories(ctx, 'w-elder')).toThrow(/Tritt der Welt/);

    await sendMessage(ctx, 'c-mira', { content: 'Hallo Mira' });
    // Chat mit einer Figur einer anderen Welt erfordert dortigen Beitritt
    await expect(sendMessage(ctx, 'c-elowen', { content: 'Hallo' })).rejects.toMatchObject({ code: 'not_joined' });
    expect(listChats(ctx, 'w-neon').map((c) => c.characterId)).toEqual(['c-mira']);

    joinAsCustom(ctx, 'w-elder', 'Elder Gast');
    await sendMessage(ctx, 'c-elowen', { content: 'Hallo Elowen' });
    expect(listChats(ctx, 'w-elder').map((c) => c.characterId)).toEqual(['c-elowen']);
    expect(listChats(ctx, 'w-neon').map((c) => c.characterId)).toEqual(['c-mira']);
    expect(activeWorldId(ctx)).toBe('w-elder');
  });

  it('trennt Chatverläufe je Spielfigur und erlaubt keinen Chat mit sich selbst', async () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-neon', { mode: 'existing', characterId: 'c-jonah' });
    await expect(sendMessage(ctx, 'c-jonah', { content: 'Hallo ich' })).rejects.toMatchObject({ code: 'cannot_chat_self' });
    await sendMessage(ctx, 'c-mira', { content: 'Ich bin Jonah' });
    expect(getChat(ctx, 'c-mira').messages).toHaveLength(2);
    joinWorld(ctx, 'w-neon', { mode: 'custom', character: { name: 'Neue Figur' }, confirmSwitch: true });
    expect(getChat(ctx, 'c-mira').messages).toHaveLength(0);
  });

  it('lässt gespielte Figuren nicht autonom handeln', async () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-neon', { mode: 'existing', characterId: 'c-mira' });
    const before = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM posts WHERE character_id = 'c-mira'`)!.n;
    for (let i = 0; i < 6; i++) await simulateWorld(ctx, 'w-neon', 'manual');
    const afterCount = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM posts WHERE character_id = 'c-mira'`)!.n;
    expect(afterCount).toBe(before);
  });

  it('durchsucht Welten und Figuren, Beiträge nur in der aktiven Welt', () => {
    const ctx = createTestContext();
    expect(search(ctx, 'Spotlight').worlds.map((w) => w.id)).toContain('w-spotlight');
    expect(search(ctx, 'x').worlds).toHaveLength(0);
    expect(search(ctx, '%').posts).toHaveLength(0);
    joinAsCustom(ctx, 'w-neon');
    createPost(ctx, { content: 'Ich suche 100% Neonlicht' });
    expect(search(ctx, '100%').posts).toHaveLength(1);
    expect(search(ctx, '100_').posts).toHaveLength(0);
  });
});

describe('Entscheidungen und Storyverlauf', () => {
  it('wendet Auswirkungen dauerhaft an und erlaubt jede Entscheidung nur einmal', () => {
    const ctx = createTestContext();
    const { player } = joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: 'Robin Rat' } });
    const [intro] = listDecisions(ctx, { playerId: player.id, status: 'pending' });
    const network = intro.options.find((o) => o.id === 'network')!;
    expect(network.effects.affinity?.length).toBeGreaterThan(0);
    const coinsBefore = coinBalance(ctx);

    const result = chooseOption(ctx, intro.id, { optionId: 'network' });
    expect(result.decision.status).toBe('resolved');
    expect(result.decision.outcome).toBeTruthy();
    expect(result.player.reputation).toBe(player.reputation + 3);
    expect(result.progress.xpGained).toBeGreaterThan(0);
    expect(coinBalance(ctx)).toBeGreaterThan(coinsBefore);
    // Beziehung zwischen Spielfigur und Figur ist gespeichert
    const target = network.effects.affinity![0].characterId;
    const [a, b] = [player.character.id, target].sort();
    expect(get<{ affinity: number }>(ctx.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b)?.affinity).toBeGreaterThan(0);
    // Ereignis und Reaktion in der Welt
    expect(get(ctx.db, `SELECT 1 FROM world_events WHERE id = ? AND kind = 'decision'`, getEventId(ctx, intro.id))).toBeTruthy();
    expect(() => chooseOption(ctx, intro.id, { optionId: 'observe' })).toThrow(/bereits/);
    expect(() => chooseOption(ctx, 'd-gibtsnicht', { optionId: 'observe' })).toThrow();
  });

  it('bringt eine Geschichte durch eine Entscheidung voran', () => {
    const ctx = createTestContext();
    joinAsCustom(ctx, 'w-capital');
    const storyline = get<{ id: string; title: string; stage: number; stages: string }>(
      ctx.db,
      `SELECT id, title, stage, stages FROM storylines WHERE world_id = 'w-capital' AND status = 'active' LIMIT 1`,
    )!;
    const id = createStorylineDecision(ctx, 'w-capital', { id: storyline.id, title: storyline.title, stage: 'x' });
    expect(id).toBeTruthy();
    const decision = listDecisions(ctx, { worldId: 'w-capital' }).find((d) => d.id === id)!;
    expect(decision.options.find((o) => o.id === 'push')?.effects.advancesStoryline).toBe(true);
    chooseOption(ctx, id!, { optionId: 'push' });
    const after = get<{ stage: number }>(ctx.db, 'SELECT stage FROM storylines WHERE id = ?', storyline.id)!;
    expect(after.stage).toBe(storyline.stage + 1);
  });

  it('begrenzt offene Entscheidungen und erzeugt sie beim Simulieren', async () => {
    const ctx = createTestContext();
    const playerId = joinAsCustom(ctx, 'w-unicorn');
    for (let i = 0; i < 12; i++) await simulateWorld(ctx, 'w-unicorn', 'manual');
    const pending = listDecisions(ctx, { playerId, status: 'pending' });
    expect(pending.length).toBeGreaterThan(1);
    expect(pending.length).toBeLessThanOrEqual(3);
  });

  it('löst Weltaufgaben genau einmal ein', () => {
    const ctx = createTestContext();
    const { player } = joinWorld(ctx, 'w-latenight', { mode: 'custom', character: { name: 'Max Gag' } });
    expect(() => claimWorldQuest(ctx, 'wq-first-decision', 'w-latenight')).toThrow(/noch nicht/);
    const [intro] = listDecisions(ctx, { playerId: player.id, status: 'pending' });
    chooseOption(ctx, intro.id, { optionId: 'observe' });
    const quest = listWorldQuests(ctx, 'w-latenight').find((q) => q.id === 'wq-first-decision')!;
    expect(quest.completed).toBe(true);
    const delta = claimWorldQuest(ctx, 'wq-first-decision', 'w-latenight');
    expect(delta.xpGained).toBe(25);
    expect(delta.coinsGained).toBeGreaterThanOrEqual(15);
    expect(() => claimWorldQuest(ctx, 'wq-first-decision', 'w-latenight')).toThrow(/bereits/);
  });
});

function getEventId(ctx: ReturnType<typeof createTestContext>, decisionId: string): string {
  return get<{ event_id: string }>(ctx.db, 'SELECT event_id FROM decisions WHERE id = ?', decisionId)!.event_id;
}

describe('Spielwährung und Shop', () => {
  it('kauft nur mit ausreichend Funken und schaltet Premium-Ereigniskarten frei', async () => {
    const ctx = createTestContext();
    joinAsCustom(ctx, 'w-spotlight');
    expect(() => buyItem(ctx, 'card-gala')).toThrow(/Nicht genügend/);
    await expect(triggerEvent(ctx, 'w-spotlight', { cardId: 'gala' })).rejects.toMatchObject({ code: 'card_locked' });
    grantCoins(ctx, 'test:bonus', 200, 'test');
    expect(grantCoins(ctx, 'test:bonus', 200, 'test')).toBe(0);
    const before = coinBalance(ctx);
    const items = buyItem(ctx, 'card-gala');
    expect(items.find((i) => i.id === 'card-gala')?.owned).toBe(true);
    expect(coinBalance(ctx)).toBe(before - 90);
    expect(() => buyItem(ctx, 'card-gala')).toThrow(/bereits/);
    const result = await triggerEvent(ctx, 'w-spotlight', { cardId: 'gala' });
    expect(result.events[0].kind).toBe('card-gala');
    expect(listShop(ctx).length).toBeGreaterThan(5);
  });

  it('belegt Simulationen realer Personen nicht mit negativen Ereignissen', async () => {
    const ctx = createTestContext();
    const app = createTestApp(ctx);
    const res = await request(app)
      .post('/api/characters')
      .set(W)
      .send({ name: 'Sim Person', handle: 'sim_person', worldId: 'w-neon', isRealPersonSim: true })
      .expect(201);
    await expect(
      triggerEvent(ctx, 'w-neon', { cardId: 'rumor', targetIds: [res.body.character.id, 'c-mira'] }),
    ).rejects.toMatchObject({ code: 'real_person_protected' });
    for (let i = 0; i < 15; i++) await simulateWorld(ctx, 'w-neon', 'manual');
    const negative = all<{ kind: string; participants: string }>(
      ctx.db,
      `SELECT kind, participants FROM world_events WHERE world_id = 'w-neon' AND kind IN ('conflict', 'rumor', 'rivalry', 'setback')`,
    );
    expect(negative.some((e) => e.participants.includes(res.body.character.id))).toBe(false);
  });
});

describe('Migration und Inhaltsaktualisierung', () => {
  it('übernimmt bestehende Chats aus Version 1 als Gespräche', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
    db.exec(MIGRATIONS[0].sql);
    db.exec(`INSERT INTO schema_migrations VALUES (1, 'initial-schema', '2026-01-01')`);
    const now = '2026-01-01T00:00:00.000Z';
    run(db, `INSERT INTO worlds (id, name, genre, art_style, hue, created_at) VALUES ('w1', 'Alt', 'fantasy', 'forest', 10, ?)`, now);
    run(db, `INSERT INTO characters (id, world_id, name, handle, avatar_hue, created_at) VALUES ('c1', 'w1', 'Alte Figur', 'alt', 10, ?)`, now);
    run(db, `INSERT INTO chats (character_id, created_at, updated_at) VALUES ('c1', ?, ?)`, now, now);
    run(db, `INSERT INTO chat_messages (character_id, role, content, source, created_at) VALUES ('c1', 'user', 'Hallo von früher', 'user', ?)`, now);
    run(db, `INSERT INTO chat_memories (id, character_id, content, kind, source, created_at) VALUES ('m1', 'c1', 'Name: Alt', 'fact', 'rule', ?)`, now);

    migrate(db);
    const conv = get<{ id: string; player_id: string | null }>(db, `SELECT id, player_id FROM conversations WHERE character_id = 'c1'`);
    expect(conv?.player_id).toBeNull();
    expect(get<{ content: string }>(db, 'SELECT content FROM conversation_messages WHERE conversation_id = ?', conv!.id)?.content).toBe(
      'Hallo von früher',
    );
    expect(get<{ content: string }>(db, 'SELECT content FROM conversation_memories WHERE conversation_id = ?', conv!.id)?.content).toBe('Name: Alt');
    expect(get(db, `SELECT 1 FROM sqlite_master WHERE name = 'chats'`)).toBeUndefined();
  });

  it('ergänzt neue Welten in bestehenden Datenbanken, ohne eigene Daten zu verändern', () => {
    const ctx = createTestContext();
    // Zustand einer Version-1-Datenbank nachstellen
    const v2 = `('w-capital', 'w-spotlight', 'w-unicorn', 'w-arena', 'w-latenight', 'w-analog')`;
    run(ctx.db, `DELETE FROM posts WHERE world_id IN ${v2}`);
    run(ctx.db, `DELETE FROM characters WHERE world_id IN ${v2}`);
    run(ctx.db, `DELETE FROM worlds WHERE id IN ${v2}`);
    run(ctx.db, `UPDATE meta SET value = '1' WHERE key = 'content_version'`);
    run(ctx.db, `UPDATE characters SET goals = '[]', prominent = 0`);
    run(ctx.db, `INSERT INTO characters (id, name, handle, avatar_hue, is_custom, created_at) VALUES ('c-own', 'Eigene', 'kanzlerin_brandt', 1, 1, '2026-01-01')`);

    expect(applyContentUpdates(ctx.db, ctx.now())).toBe(true);
    const ids = all<{ id: string }>(ctx.db, 'SELECT id FROM worlds').map((w) => w.id);
    for (const id of ['w-spotlight', 'w-unicorn', 'w-arena', 'w-latenight', 'w-analog']) expect(ids).toContain(id);
    // Belegt ein eigener Charakter bereits einen Handle, wird die betroffene Welt übersprungen.
    expect(ids).not.toContain('w-capital');
    expect(get<{ name: string }>(ctx.db, `SELECT name FROM characters WHERE id = 'c-own'`)?.name).toBe('Eigene');
    expect(get<{ prominent: number }>(ctx.db, `SELECT prominent FROM characters WHERE id = 'c-mira'`)?.prominent).toBe(1);
    expect(applyContentUpdates(ctx.db, ctx.now())).toBe(false);
  });
});
