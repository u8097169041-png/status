import { describe, expect, it } from 'vitest';
import { categoryOfGenre, GENRES, WORLD_CATEGORIES } from '../../../shared/constants';
import { ROMANCE_REPLIES } from '../content/datingDecisions';
import { applyContentUpdates } from '../db/seed';
import { all, get, run } from '../db/database';
import type { Rng } from '../lib/rng';
import { sendMessage } from '../services/chats';
import { chooseOption, listDecisions, maybeCreateDecision } from '../services/decisions';
import { getDiscover } from '../services/discover';
import { getQuestBoard } from '../services/quests';
import { generateDraft, generateLocalDraft } from '../services/worldgen';
import { createTestContext, joinAsCustom, ollamaMock, routeMocks } from './helpers';

const WORLD = 'w-heartbeat';

/** Zufallsquelle, die gezielt eine bestimmte Entscheidung und bestimmte Figuren wählt. */
function pickingRng(templateId: string, prefer: string[] = []): Rng {
  return {
    next: () => 0.1,
    int: (min) => min,
    chance: () => true,
    weighted: (items) => items[0].item,
    shuffle: <T,>(items: readonly T[]) => {
      const list = [...items];
      return list.sort((a, b) => {
        const ia = prefer.indexOf((a as { id?: string }).id ?? '');
        const ib = prefer.indexOf((b as { id?: string }).id ?? '');
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    },
    pick: <T,>(items: readonly T[]) =>
      (items.find((x) => (x as { id?: string }).id === templateId) ??
        items.find((x) => prefer.includes((x as { id?: string }).id ?? '')) ??
        items[0]) as T,
  };
}

function relationship(ctx: ReturnType<typeof createTestContext>, playerId: string, npc: string) {
  const pc = get<{ character_id: string }>(ctx.db, 'SELECT character_id FROM players WHERE id = ?', playerId)!.character_id;
  const [a, b] = pc < npc ? [pc, npc] : [npc, pc];
  return get<{ kind: string; affinity: number }>(ctx.db, 'SELECT kind, affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b);
}

describe('Weltkategorie „Dating“', () => {
  it('ist eigenständige Kategorie und Genre und erscheint in der Weltauswahl', () => {
    expect(GENRES).toContain('dating');
    expect(WORLD_CATEGORIES).toContain('dating');
    expect(categoryOfGenre('dating')).toBe('dating');
    const ctx = createTestContext();
    const world = getDiscover(ctx).worlds.find((w) => w.id === WORLD);
    expect(world).toMatchObject({ category: 'dating', genre: 'dating', artStyle: 'romance' });
  });

  it('enthält nur klar erwachsene Figuren und nicht-explizite Weltregeln', () => {
    const ctx = createTestContext();
    const chars = all<{ tagline: string; description: string }>(ctx.db, 'SELECT tagline, description FROM characters WHERE world_id = ?', WORLD);
    expect(chars.length).toBeGreaterThanOrEqual(5);
    for (const c of chars) {
      const age = Number(/\((\d{2})\)/.exec(c.tagline)?.[1] ?? /(\d{2})/.exec(c.description)?.[1]);
      expect(age).toBeGreaterThanOrEqual(25);
    }
    const rules = JSON.parse(get<{ rules: string }>(ctx.db, 'SELECT rules FROM worlds WHERE id = ?', WORLD)!.rules) as string[];
    expect(rules.join(' ')).toMatch(/erwachsen/);
    expect(rules.join(' ')).toMatch(/nicht explizit/);
  });

  it('hat Geschichten mit mehreren eigenen Enden', () => {
    const ctx = createTestContext();
    const storylines = all<{ id: string; endings: string }>(ctx.db, 'SELECT id, endings FROM storylines WHERE world_id = ?', WORLD);
    expect(storylines.map((s) => s.id).sort()).toEqual(['s-hb-blind', 's-hb-twelve', 's-hb-window']);
    for (const s of storylines) {
      const endings = JSON.parse(s.endings) as { path: string; title: string }[];
      expect(endings.map((e) => e.path)).toEqual(['bold', 'diplomatic', 'neutral']);
    }
    const window = JSON.parse(storylines.find((s) => s.id === 's-hb-window')!.endings) as { title: string }[];
    expect(window.map((e) => e.title)).toEqual(['Das Geständnis', 'Zeit für mich', 'Eine zweite Chance']);
  });

  it('startet mit Dating-Entscheidungen und bleibt mit Quests und Level kompatibel', () => {
    const ctx = createTestContext();
    const playerId = joinAsCustom(ctx, WORLD, 'Sam Neu');
    const pending = listDecisions(ctx, { playerId, status: 'pending' });
    expect(pending.map((d) => d.kind)).toContain('dating-intro');
    const storyline = pending.find((d) => d.kind === 'storyline');
    expect(storyline?.options.map((o) => o.id)).toEqual(expect.arrayContaining(['push', 'support', 'stay-out', 'heart-to-heart']));
    const board = getQuestBoard(ctx, WORLD);
    expect(board.main?.title).toBeTruthy();
    expect(board.player.goalType).toBe('relationships');
  });

  it('macht aus einem ersten Date über die Spielregeln eine Romanze – erst ab genug Zuneigung', () => {
    const ctx = createTestContext();
    const playerId = joinAsCustom(ctx, WORLD, 'Sam Neu');
    // Erstes Date mit Jonas: +14 Zuneigung reicht noch nicht für eine Romanze (ab 35).
    const first = maybeCreateDecision(ctx, WORLD, pickingRng('date-invite', ['c-hb-jonas']));
    expect(first).toBeTruthy();
    const decision = listDecisions(ctx, { playerId, status: 'pending' }).find((d) => d.id === first)!;
    expect(decision.kind).toBe('date-invite');
    const option = decision.options.find((o) => o.id === 'first-date')!;
    expect(option.effects.affinity?.[0]).toMatchObject({ characterId: 'c-hb-jonas', becomes: 'romance', minAffinity: 35 });
    chooseOption(ctx, first!, { optionId: 'first-date' });
    expect(relationship(ctx, playerId, 'c-hb-jonas')).toMatchObject({ affinity: 14 });
    expect(relationship(ctx, playerId, 'c-hb-jonas')?.kind).not.toBe('romance');

    // Ein zweites Date (insgesamt 34 + ein weiteres) – jetzt wird es eine Romanze.
    for (const optionId of ['special-date', 'first-date']) {
      const id = maybeCreateDecision(ctx, WORLD, pickingRng('date-invite', ['c-hb-jonas']));
      if (optionId === 'special-date') {
        // Ohne Charisma ist die Option gesperrt.
        expect(() => chooseOption(ctx, id!, { optionId })).toThrow();
        chooseOption(ctx, id!, { optionId: 'first-date' });
      } else {
        chooseOption(ctx, id!, { optionId });
        // Das Ereignis der Entscheidung dokumentiert die neue Beziehungsart.
        const event = get<{ effects: string }>(ctx.db, `SELECT effects FROM world_events WHERE world_id = ? AND kind = 'decision' ORDER BY rowid DESC LIMIT 1`, WORLD);
        const effects = JSON.parse(event!.effects) as { type: string; to?: string }[];
        expect(effects.some((e) => e.type === 'relationshipKind' && e.to === 'romance')).toBe(true);
      }
    }
    expect(relationship(ctx, playerId, 'c-hb-jonas')).toMatchObject({ kind: 'romance', affinity: 42 });
  });

  it('lässt im Liebesdreieck unterschiedliche Wege zu', () => {
    const ctx = createTestContext();
    const playerId = joinAsCustom(ctx, WORLD, 'Sam Neu');
    const id = maybeCreateDecision(ctx, WORLD, pickingRng('triangle', ['c-hb-jonas', 'c-hb-milan']));
    const decision = listDecisions(ctx, { playerId, status: 'pending' }).find((d) => d.id === id)!;
    expect(decision.kind).toBe('triangle');
    expect(decision.options.map((o) => o.id)).toEqual(['choose-a', 'choose-b', 'honest-both', 'friends-both']);
    chooseOption(ctx, id!, { optionId: 'friends-both' });
    const names = decision.options[3].effects.affinity!.map((a) => a.characterId);
    for (const npc of names) expect(relationship(ctx, playerId, npc)?.kind).toBe('friend');
  });

  it('antwortet ohne KI mit passenden, nicht expliziten Dating-Antworten', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ down: true }), null) });
    joinAsCustom(ctx, WORLD, 'Sam Neu');
    const result = await sendMessage(ctx, 'c-hb-lena', { content: 'Ich glaube, ich bin verliebt. Was soll ich tun?' });
    expect(result.reply.provider).toBe('fallback');
    expect(ROMANCE_REPLIES.some((r) => result.reply.content.includes(r.de))).toBe(true);
  });

  it('erzeugt Dating-Entwürfe lokal und mit KI-Vorgaben für erwachsene, nicht explizite Inhalte', async () => {
    const local = generateLocalDraft('dating', '', 3, 'de', 'seed');
    expect(local.artStyle).toBe('romance');
    expect(local.rules.join(' ')).toMatch(/erwachsen/);
    expect(local.characters).toHaveLength(3);

    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: '{"name": "kaputt' }), null) });
    const draft = await generateDraft(ctx, { genre: 'dating', prompt: 'Ein Café', characterCount: 2, useAi: true });
    // Ungültige KI-Antwort → spielbarer lokaler Entwurf als Fallback.
    expect(draft.source).toBe('demo');
    expect(draft.genre).toBe('dating');
    const call = ctx.fetchCalls.find((c) => c.url.endsWith('/api/chat'))?.body as { messages: { content: string }[] };
    const prompt = call.messages.map((m) => m.content).join(' ');
    expect(prompt).toContain('adult aged 25-45');
    expect(prompt).toContain('never explicit');
  });

  it('wird in bestehende Datenbanken ergänzt, ohne vorhandene Daten zu ändern', () => {
    const ctx = createTestContext();
    run(ctx.db, `DELETE FROM posts WHERE world_id = ?`, WORLD);
    run(ctx.db, `DELETE FROM characters WHERE world_id = ?`, WORLD);
    run(ctx.db, `DELETE FROM worlds WHERE id = ?`, WORLD);
    run(ctx.db, `UPDATE meta SET value = '3' WHERE key = 'content_version'`);
    const before = all<{ id: string }>(ctx.db, 'SELECT id FROM worlds ORDER BY id').map((w) => w.id);
    expect(applyContentUpdates(ctx.db, ctx.now())).toBe(true);
    const after = all<{ id: string }>(ctx.db, 'SELECT id FROM worlds ORDER BY id').map((w) => w.id);
    expect(after).toEqual([...before, WORLD].sort());
    expect(get<{ n: number }>(ctx.db, 'SELECT COUNT(*) AS n FROM characters WHERE world_id = ?', WORLD)?.n).toBe(6);
  });
});
