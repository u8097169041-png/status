import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { SKILL_RULES } from '../../../shared/skills';
import { all, get, run } from '../db/database';
import { resolveArc } from '../services/arcs';
import { getChatActions, performChatAction } from '../services/chatActions';
import { sendMessage } from '../services/chats';
import { chooseOption, createStorylineDecision, listDecisions } from '../services/decisions';
import { getActivePlayerRow, getPlayerRow, joinWorld } from '../services/players';
import { createPost, reactToEvent } from '../services/posts';
import { evaluateQuests, getQuestBoard } from '../services/quests';
import { createStory } from '../services/stories';
import { listSkills, upgradeSkill } from '../services/skills';
import { getWorld } from '../services/worlds';
import { createTestApp, createTestContext, joinAsCustom, type TestContext } from './helpers';

const W = { 'X-SocialVerse': '1' };

function player(ctx: TestContext, worldId: string) {
  return getActivePlayerRow(ctx, worldId)!;
}

function grantPlayerXp(ctx: TestContext, playerId: string, xp: number) {
  run(ctx.db, 'UPDATE players SET xp = xp + ? WHERE id = ?', xp, playerId);
}

function template(ctx: TestContext, playerId: string, kind: 'main' | 'side' | 'event'): string[] {
  return all<{ template: string }>(ctx.db, `SELECT template FROM quests WHERE player_id = ? AND kind = ? AND status = 'active'`, playerId, kind).map(
    (r) => r.template,
  );
}

describe('Quests passen zu Rolle und Lage', () => {
  it('wählt die Hauptquest nach Rolle und Ziel der Figur', () => {
    const ctx = createTestContext();
    // Kanzlerin: Unterstützung gewinnen
    joinWorld(ctx, 'w-capital', { mode: 'existing', characterId: 'c-brandt' });
    const brandt = player(ctx, 'w-capital');
    expect(brandt.archetype).toBe('politician');
    expect(template(ctx, brandt.id, 'main')).toEqual(['support-1']);
    // Eigene Abgeordnete ohne Zielwahl: politischer Einfluss
    joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: 'Alex Vogt', role: 'Abgeordnete' }, confirmSwitch: true });
    const alex = player(ctx, 'w-capital');
    expect(alex.archetype).toBe('politician');
    expect(template(ctx, alex.id, 'main')).toEqual(['infl-1']);
    // Eigene Streamerin mit frei gewähltem Ziel
    joinWorld(ctx, 'w-trendwave', { mode: 'custom', character: { name: 'Mia Live', role: 'Streamerin' }, goalType: 'cooperation' });
    const mia = player(ctx, 'w-trendwave');
    expect(mia.archetype).toBe('creator');
    expect(template(ctx, mia.id, 'main')).toEqual(['coop-1']);
  });

  it('bezieht Rivalitäten, laufende Geschichten und frühere Entscheidungen ein', () => {
    const ctx = createTestContext();
    // Lou und Ronja sind verfeindet: Lous Hauptquest richtet sich an Ronja.
    joinWorld(ctx, 'w-trendwave', { mode: 'existing', characterId: 'c-lou' });
    const lou = player(ctx, 'w-trendwave');
    const board = getQuestBoard(ctx, 'w-trendwave', lou);
    expect(board.main?.title).toContain('Ronja Weiß');
    expect(board.main?.paths[0].objectives[0]).toMatchObject({ metric: 'chatWith', name: 'Ronja Weiß' });
    expect(board.side.map((q) => q.title).join(' ')).toContain('Ronja Weiß');
    expect(board.side.some((q) => q.title.includes('Der neue Algorithmus'))).toBe(true);

    // Eine Entscheidung gegen eine Figur erzeugt eine Wiedergutmachungsquest.
    joinWorld(ctx, 'w-unicorn', { mode: 'custom', character: { name: 'Pia Plan', role: 'Gründerin' } });
    const pia = player(ctx, 'w-unicorn');
    const decisionId = createStorylineDecision(ctx, 'w-unicorn', { id: 's-unicorn-takeover', title: 'Die Übernahme', stage: 'x' });
    run(ctx.db, `UPDATE decisions SET status = 'resolved' WHERE player_id = ? AND id != ?`, pia.id, decisionId!);
    const hale = 'c-hale';
    const request = listDecisions(ctx, { playerId: pia.id, status: 'pending' })[0];
    // Gezielt eine Bitte von Hale anlegen und ablehnen
    run(
      ctx.db,
      `UPDATE decisions SET kind = 'request', options = ? WHERE id = ?`,
      JSON.stringify([{ id: 'decline', label: 'Ablehnen', outcome: 'x', effects: { affinity: [{ characterId: hale, name: 'Mara Hale', delta: -10 }] } }]),
      request.id,
    );
    chooseOption(ctx, request.id, { optionId: 'decline' });
    expect(all<{ dedupe_key: string }>(ctx.db, 'SELECT dedupe_key FROM quests WHERE player_id = ?', pia.id).map((r) => r.dedupe_key)).toContain(
      `reconcile:${hale}`,
    );
  });

  it('erzeugt Ereignisquests aus simulierten Weltereignissen und lässt sie verfallen', () => {
    const ctx = createTestContext();
    const id = joinAsCustom(ctx, 'w-neon');
    const p = getPlayerRow(ctx, id);
    // Ein neues Ereignis nach dem Beitritt
    ctx.advance(10);
    run(
      ctx.db,
      `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, created_at)
       VALUES ('e-test', 'w-neon', (SELECT day FROM worlds WHERE id = 'w-neon'), 'rumor', 'Gerücht im Hafen', '', 'sim', '[]', '[]', ?)`,
      ctx.now().toISOString(),
    );
    const board = getQuestBoard(ctx, 'w-neon', p);
    expect(board.events).toHaveLength(1);
    expect(board.events[0].eventId).toBe('e-test');
    run(ctx.db, `UPDATE worlds SET day = day + 3 WHERE id = 'w-neon'`);
    expect(getQuestBoard(ctx, 'w-neon', p).events.find((q) => q.eventId === 'e-test')).toBeUndefined();
  });
});

describe('Fortschritt, XP und einmalige Belohnungen', () => {
  it('schließt Quests durch Interaktionen ab und belohnt nur einmal', () => {
    const ctx = createTestContext();
    const id = joinAsCustom(ctx, 'w-neon');
    const xpBefore = getPlayerRow(ctx, id).xp;
    createPost(ctx, { content: 'Hallo Neonhafen!' });
    const story = createStory(ctx, { content: 'Meine erste Story' });
    expect(story.progress.questsCompleted?.map((q) => q.title)).toContain('Stell dich in Neonhafen vor');
    const quest = get<{ id: string; status: string }>(ctx.db, `SELECT id, status FROM quests WHERE player_id = ? AND template = 'introduce'`, id)!;
    expect(quest.status).toBe('completed');
    // Charakter-XP: Beitritt, Beitrag, Story und Questbelohnung
    expect(getPlayerRow(ctx, id).xp).toBe(xpBefore + 15 + 10 + 40);
    // Erneutes Prüfen vergibt nichts mehr
    const again = evaluateQuests(ctx, id);
    expect(again.xpGained).toBe(0);
    expect(get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM xp_events WHERE key = ?`, `quest:${quest.id}`)?.n).toBe(1);
    expect(get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM wallet_ledger WHERE key = ?`, `quest:${quest.id}`)?.n).toBe(1);
    expect(getPlayerRow(ctx, id).xp).toBe(xpBefore + 65);
  });

  it('steigert das Charakterlevel und vergibt Fähigkeitspunkte', () => {
    const ctx = createTestContext();
    const id = joinAsCustom(ctx, 'w-neon');
    expect(listSkills(ctx, getPlayerRow(ctx, id)).every((s) => s.level === 0)).toBe(true);
    const before = getQuestBoard(ctx, 'w-neon', getPlayerRow(ctx, id)).player;
    expect(before.level.level).toBe(1);
    expect(before.skillPoints.available).toBe(1);
    grantPlayerXp(ctx, id, 100 - getPlayerRow(ctx, id).xp - 15);
    const post = createPost(ctx, { content: 'Level-Test' });
    expect(post.progress.playerLevelUp).toBe(2);
    const after = getQuestBoard(ctx, 'w-neon', getPlayerRow(ctx, id)).player;
    expect(after.level.level).toBe(2);
    expect(after.skillPoints.available).toBe(2);
  });

  it('schließt die Hauptquest-Stufe ab, startet die nächste und vergibt einen Fähigkeitspunkt', () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: 'Alex Vogt', role: 'Abgeordnete' } });
    const p = player(ctx, 'w-capital');
    run(ctx.db, 'UPDATE players SET influence = 25 WHERE id = ?', p.id);
    for (const d of listDecisions(ctx, { playerId: p.id, status: 'pending' })) chooseOption(ctx, d.id, { optionId: d.options[0].id });
    const board = getQuestBoard(ctx, 'w-capital', getPlayerRow(ctx, p.id));
    expect(board.mainStagesCompleted).toBe(1);
    expect(board.main?.stage).toBe(2);
    expect(board.player.skillPoints.earned).toBe(board.player.level.level + 1);
    expect(get(ctx.db, `SELECT 1 FROM world_events WHERE world_id = 'w-capital' AND kind = 'milestone'`)).toBeTruthy();
  });
});

describe('Fähigkeiten verändern das Spiel', () => {
  it('beachtet Punkte, Rollen-Kosten und Levelgrenzen', () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-trendwave', { mode: 'custom', character: { name: 'Mia Live', role: 'Streamerin' } });
    const p = player(ctx, 'w-trendwave');
    const skills = listSkills(ctx, p);
    expect(skills.find((s) => s.id === 'media')).toMatchObject({ core: true, cost: 1, canUpgrade: true });
    expect(skills.find((s) => s.id === 'strategy')).toMatchObject({ core: false, cost: 2, canUpgrade: false, blockedReason: 'points' });
    upgradeSkill(ctx, getPlayerRow(ctx, p.id), 'media');
    expect(() => upgradeSkill(ctx, getPlayerRow(ctx, p.id), 'media')).toThrow(/Fähigkeitspunkte|Charakterlevel/);
    grantPlayerXp(ctx, p.id, 300);
    // Level 3, 3 Punkte verdient, 1 ausgegeben
    const leveled = listSkills(ctx, getPlayerRow(ctx, p.id));
    expect(leveled.find((s) => s.id === 'media')).toMatchObject({ level: 1, canUpgrade: true, nextRequiredLevel: 3 });
    upgradeSkill(ctx, getPlayerRow(ctx, p.id), 'media');
    expect(listSkills(ctx, getPlayerRow(ctx, p.id)).find((s) => s.id === 'media')).toMatchObject({ level: 2, blockedReason: 'level' });
  });

  it('Medienkompetenz erhöht die Reichweite und ermöglicht Reaktionen auf Ereignisse und Statements', () => {
    const ctx = createTestContext();
    const id = joinAsCustom(ctx, 'w-neon');
    const first = createPost(ctx, { content: 'Ohne Medienkompetenz' });
    expect(first.reach.followers).toBe(SKILL_RULES.followersPerPost.base);
    const event = get<{ id: string }>(ctx.db, `SELECT id FROM world_events WHERE world_id = 'w-neon' LIMIT 1`)!;
    expect(() => reactToEvent(ctx, event.id, {})).toThrow(/Fähigkeit/);
    // Medienkompetenz ist für diese Rolle keine Kernfähigkeit (2 Punkte): Level 2 bringt den zweiten Punkt.
    grantPlayerXp(ctx, id, 100);
    upgradeSkill(ctx, getPlayerRow(ctx, id), 'media');
    const second = createPost(ctx, { content: 'Mit Medienkompetenz' });
    expect(second.reach.followers).toBe(SKILL_RULES.followersPerPost.base + SKILL_RULES.followersPerPost.perMedia);
    const reaction = reactToEvent(ctx, event.id, { content: 'Meine Sicht.' });
    expect(reaction.post.eventId).toBe(event.id);
    expect(() => reactToEvent(ctx, event.id, {})).toThrow(/bereits/);
    expect(() => createPost(ctx, { content: 'Statement', statement: true })).toThrow(/Fähigkeit/);
  });

  it('Charisma und Verhandlung schalten Dialogoptionen mit echter Wirkung frei', async () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-neon', { mode: 'custom', character: { name: 'Nia Funke', role: 'Kurierin' } });
    const p = player(ctx, 'w-neon');
    const before = getChatActions(ctx, 'c-mira');
    expect(before.actions.find((a) => a.id === 'compliment')).toMatchObject({ available: false, reason: 'skill' });
    expect(before.actions.find((a) => a.id === 'small-talk')).toMatchObject({ available: true });
    await expect(performChatAction(ctx, 'c-mira', 'compliment')).rejects.toMatchObject({ code: 'skill_required' });
    upgradeSkill(ctx, getPlayerRow(ctx, p.id), 'charisma');
    const result = await performChatAction(ctx, 'c-mira', 'compliment');
    // Erstes Gespräch des Tages (1 + Charisma 1) plus Kompliment (6)
    expect(result.affinityAfter - result.affinityBefore).toBe(6);
    expect(result.affinityAfter).toBe(2 + 6);
    expect(result.message.reply.content.length).toBeGreaterThan(0);
    expect(result.actions.actions.find((a) => a.id === 'compliment')?.reason).toBe('used');
    await expect(performChatAction(ctx, 'c-mira', 'compliment')).rejects.toMatchObject({ code: 'action_used' });

    // Kooperation: ohne Verhandlung erst ab Zuneigung 50, mit Verhandlung 2 ab 20.
    run(ctx.db, `UPDATE relationships SET affinity = 25 WHERE (a_id = ? AND b_id = 'c-mira') OR (b_id = ? AND a_id = 'c-mira')`, p.character_id, p.character_id);
    expect(getChatActions(ctx, 'c-mira').actions.find((a) => a.id === 'cooperate')).toMatchObject({ available: false, reason: 'affinityLow', minAffinity: 50 });
    run(ctx.db, `INSERT INTO player_skills (player_id, skill_id, level, updated_at) VALUES (?, 'negotiation', 2, '')`, p.id);
    expect(getChatActions(ctx, 'c-mira').actions.find((a) => a.id === 'cooperate')).toMatchObject({ available: true, minAffinity: 20 });
    const coop = await performChatAction(ctx, 'c-mira', 'cooperate');
    expect(coop.effects.influence).toBe(4);
    expect(get(ctx.db, `SELECT 1 FROM world_events WHERE kind = 'cooperation' AND world_id = 'w-neon'`)).toBeTruthy();
  });

  it('Fähigkeiten öffnen zusätzliche Entscheidungsoptionen und Strategie zeigt die Prognose', () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: 'Alex Vogt', role: 'Abgeordnete' } });
    const p = player(ctx, 'w-capital');
    const arc = listDecisions(ctx, { playerId: p.id, status: 'pending' }).find((d) => d.kind === 'storyline')!;
    const prepared = arc.options.find((o) => o.id === 'prepared')!;
    expect(prepared).toMatchObject({ locked: true, requires: { skill: 'strategy', level: 1 }, arcPath: 'bold' });
    expect(arc.options[0].outcomePreview).toBeUndefined();
    expect(() => chooseOption(ctx, arc.id, { optionId: 'prepared' })).toThrow(/Fähigkeit/);
    run(ctx.db, `INSERT INTO player_skills (player_id, skill_id, level, updated_at) VALUES (?, 'strategy', 2, '')`, p.id);
    const unlocked = listDecisions(ctx, { playerId: p.id, status: 'pending' }).find((d) => d.id === arc.id)!;
    expect(unlocked.options.find((o) => o.id === 'prepared')?.locked).toBe(false);
    expect(unlocked.options[0].outcomePreview).toBeTruthy();
    expect(getWorld(ctx, 'w-capital').world.storylines.find((s) => s.id === 's-capital-election')?.forecastEndingId).toBe(
      's-capital-election:neutral',
    );
    chooseOption(ctx, arc.id, { optionId: 'prepared' });
    expect(getWorld(ctx, 'w-capital').world.storylines.find((s) => s.id === 's-capital-election')?.forecastEndingId).toBe(
      's-capital-election:bold',
    );
  });

  it('alternative Questwege setzen die passende Fähigkeit voraus', () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-trendwave', { mode: 'existing', characterId: 'c-lou' });
    const p = player(ctx, 'w-trendwave');
    const main = getQuestBoard(ctx, 'w-trendwave', p).main!;
    expect(main.paths[1]).toMatchObject({ locked: true, requires: { skill: 'negotiation', level: 1 } });
    // Mit Verhandlung: Verhandeln mit Ronja erfüllt die erste Stufe sofort.
    run(ctx.db, `INSERT INTO player_skills (player_id, skill_id, level, updated_at) VALUES (?, 'negotiation', 1, '')`, p.id);
    return performChatAction(ctx, 'c-ronja', 'negotiate').then((r) => {
      expect(r.message.progress.questsCompleted?.some((q) => q.kind === 'main')).toBe(true);
      const board = getQuestBoard(ctx, 'w-trendwave', getPlayerRow(ctx, p.id));
      expect(board.completed.find((q) => q.kind === 'main')?.paths[1].objectives[0].done).toBe(true);
      expect(board.main?.stage).toBe(2);
    });
  });
});

describe('Handlungsbögen mit mehreren Enden', () => {
  it('bestimmt das Ende aus den Entscheidungen und belohnt Beteiligte einmal', () => {
    const ctx = createTestContext();
    joinWorld(ctx, 'w-capital', { mode: 'custom', character: { name: 'Alex Vogt', role: 'Abgeordnete' } });
    const p = player(ctx, 'w-capital');
    run(ctx.db, `INSERT INTO player_skills (player_id, skill_id, level, updated_at) VALUES (?, 'negotiation', 2, '')`, p.id);
    // Vier Kapitel: jede „Einigung“ bringt die Geschichte voran, bis sie endet.
    for (let i = 0; i < 4; i++) {
      const s = get<{ status: string; stage: number; stages: string }>(ctx.db, `SELECT status, stage, stages FROM storylines WHERE id = 's-capital-election'`)!;
      if (s.status === 'resolved') break;
      let d = listDecisions(ctx, { playerId: p.id, status: 'pending' }).find((x) => x.storylineId === 's-capital-election');
      if (!d) {
        createStorylineDecision(ctx, 'w-capital', { id: 's-capital-election', title: 'Die Wahl', stage: 'x' });
        d = listDecisions(ctx, { playerId: p.id, status: 'pending' }).find((x) => x.storylineId === 's-capital-election')!;
      }
      chooseOption(ctx, d.id, { optionId: 'broker' });
    }
    const s = get<{ status: string; ending_id: string }>(ctx.db, `SELECT status, ending_id FROM storylines WHERE id = 's-capital-election'`)!;
    expect(s).toEqual({ status: 'resolved', ending_id: 's-capital-election:diplomatic' });
    expect(get(ctx.db, `SELECT 1 FROM world_events WHERE kind = 'storyline-ending' AND storyline_id = 's-capital-election'`)).toBeTruthy();
    const key = `arc:s-capital-election:${p.id}`;
    expect(get<{ n: number }>(ctx.db, 'SELECT COUNT(*) AS n FROM xp_events WHERE key = ?', key)?.n).toBe(1);
    resolveArc(ctx, 's-capital-election', 'de');
    expect(get<{ n: number }>(ctx.db, 'SELECT COUNT(*) AS n FROM xp_events WHERE key = ?', key)?.n).toBe(1);
  });
});

describe('Speicherung und Trennung zwischen Welten', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sv-quests-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('behält Quests, XP und Fähigkeiten nach einem Neustart', () => {
    const file = join(dir, 'test.db');
    const first = createTestContext({ dbFile: file });
    const id = joinAsCustom(first, 'w-neon');
    createPost(first, { content: 'Vor dem Neustart' });
    upgradeSkill(first, getPlayerRow(first, id), 'charisma');
    const board = getQuestBoard(first, 'w-neon', getPlayerRow(first, id));
    first.db.close();

    const second = createTestContext({ dbFile: file });
    const after = getQuestBoard(second, 'w-neon', getPlayerRow(second, id));
    expect(after.player.xp).toBe(board.player.xp);
    expect(after.player.skills.charisma).toBe(1);
    expect(after.main?.id).toBe(board.main?.id);
    expect(after.side.map((q) => q.id).sort()).toEqual(board.side.map((q) => q.id).sort());
    second.db.close();
  });

  it('trennt Fortschritt, Quests und Fähigkeiten je Welt und Figur', async () => {
    const ctx = createTestContext();
    const neon = joinAsCustom(ctx, 'w-neon', 'Neon Figur');
    const elder = joinAsCustom(ctx, 'w-elder', 'Hain Figur');
    upgradeSkill(ctx, getPlayerRow(ctx, neon), 'charisma');
    await sendMessage(ctx, 'c-elowen', { content: 'Hallo Elowen' });
    expect(getPlayerRow(ctx, elder).xp).toBeGreaterThan(getPlayerRow(ctx, neon).xp);
    expect(listSkills(ctx, getPlayerRow(ctx, elder)).find((s) => s.id === 'charisma')?.level).toBe(0);
    const neonQuests = all<{ world_id: string }>(ctx.db, 'SELECT world_id FROM quests WHERE player_id = ?', neon);
    expect(neonQuests.every((q) => q.world_id === 'w-neon')).toBe(true);
    expect(getChatActions(ctx, 'c-elowen').actions.find((a) => a.id === 'compliment')?.reason).toBe('skill');
  });
});

describe('Weltinterne Inhalte erst nach dem Beitritt', () => {
  it('sperrt Ereignisse, Beiträge und Quests fremder Welten', async () => {
    const ctx = createTestContext();
    const app = createTestApp(ctx);
    expect(getWorld(ctx, 'w-neon').world.recentEvents).toEqual([]);
    await request(app).get('/api/worlds/w-neon/events').expect(409);
    await request(app).get('/api/posts/p-mira-1').expect(409);
    await request(app).get('/api/quests?world=w-neon').expect(409);
    expect((await request(app).get('/api/posts?character=c-mira').expect(200)).body.items).toHaveLength(0);
    joinAsCustom(ctx, 'w-neon');
    await request(app).get('/api/worlds/w-neon/events').expect(200);
    await request(app).get('/api/posts/p-mira-1').expect(200);
    const quests = await request(app).get('/api/quests?world=w-neon').expect(200);
    expect(quests.body.main.kind).toBe('main');
    const skills = await request(app).get('/api/skills?world=w-neon').expect(200);
    expect(skills.body.skills).toHaveLength(4);
    await request(app).post('/api/skills/charisma/upgrade?world=w-neon').set(W).expect(200);
    const actions = await request(app).get('/api/chats/c-mira/actions').expect(200);
    expect(actions.body.actions.find((a: { id: string }) => a.id === 'compliment').available).toBe(true);
    await request(app).post('/api/chats/c-mira/actions/compliment').set(W).expect(200);
  });
});
