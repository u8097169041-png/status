import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { LifeSetupDraft, LifeStoryDto } from '../../../shared/life';
import { run } from '../db/database';
import { listLifeCharacters } from '../life/characters';
import { classifyAction, resolveAction, successChance } from '../life/engine';
import { EVERYONE, PLAYER, recall, remember } from '../life/memory';
import { buildNarrationMessages, parseNarration } from '../life/narrator';
import { advanceTime, getStoryDto, recoverPendingNarrations, tickLifeStories, waitForNarration } from '../life/service';
import { ruleDraft, parseSetupInput } from '../life/setup';
import { getStory } from '../life/store';
import { createRng } from '../lib/rng';
import { createTestApp, createTestContext, ollamaMock, routeMocks, sdWebUiMock, type ImageCall, type TestContext } from './helpers';

const W = { 'X-SocialVerse': '1' };

const MAFIA = `Ich bin Don Salvatore Greco, der gefürchtete Mafiaboss von Palermo. Meine Familie kontrolliert den Hafen und drei Restaurants.
- Marco Bellini: meine rechte Hand, loyal seit zwanzig Jahren
- Viktor Lenz: ehrgeiziger Leutnant, trifft sich heimlich mit der Konkurrenz
- Elena Moretti: rivalisierende Bossin, die den Hafen will
Heute Abend treffe ich mich mit Viktor im Restaurant.`;

const CITIZEN = `Ich heiße Lena Vogt und arbeite als Kassiererin in einem Supermarkt in Leipzig. Ich bin pleite und habe Schulden.
Meine beste Freundin Julia Hartmann hilft mir, wo sie kann. Mein Chef Daniel Krüger ist launisch.`;

function setup(opts: { local?: ReturnType<typeof ollamaMock> | null; images?: ReturnType<typeof sdWebUiMock> | null; dbFile?: string; config?: object } = {}) {
  const ctx = createTestContext({ handler: routeMocks(opts.local ?? null, null, opts.images ?? null), dbFile: opts.dbFile, config: opts.config });
  return { ctx, app: createTestApp(ctx) };
}

async function draftFor(app: ReturnType<typeof createTestApp>, prompt: string, extra: object = {}): Promise<LifeSetupDraft> {
  const job = await request(app).post('/api/life/setup-jobs').set(W).send({ prompt, ...extra }).expect(202);
  let body = job.body;
  for (let i = 0; i < 200 && body.status === 'running'; i++) {
    await new Promise((r) => setTimeout(r, 10));
    body = (await request(app).get(`/api/life/setup-jobs/${body.id}`).expect(200)).body;
  }
  expect(body.status).toBe('done');
  return body.draft as LifeSetupDraft;
}

async function createStory(app: ReturnType<typeof createTestApp>, prompt: string, extra: object = {}): Promise<LifeStoryDto> {
  const draft = await draftFor(app, prompt, extra);
  const res = await request(app).post('/api/life/stories').set(W).send(draft).expect(201);
  await waitForNarration(res.body.id);
  return (await request(app).get(`/api/life/stories/${res.body.id}`).expect(200)).body as LifeStoryDto;
}

async function turn(app: ReturnType<typeof createTestApp>, id: string, body: object): Promise<LifeStoryDto> {
  await request(app).post(`/api/life/stories/${id}/turns`).set(W).send(body).expect(200);
  await waitForNarration(id);
  return (await request(app).get(`/api/life/stories/${id}`).expect(200)).body as LifeStoryDto;
}

function lastSuggestions(story: LifeStoryDto) {
  return [...story.messages].reverse().find((m) => m.role === 'narrator' && m.suggestions?.length)?.suggestions ?? [];
}

describe('Lebensgeschichte einrichten', () => {
  it('Mafiaboss: Rolle, Genre, hohe Macht, Figuren mit Haltung und Geheimnis aus dem Prompt', () => {
    const ctx = createTestContext();
    const d = ruleDraft(ctx, parseSetupInput({ prompt: MAFIA }));
    expect(d.playerName).toBe('Don Salvatore Greco');
    expect(d.archetype).toBe('crime_boss');
    expect(d.genres[0]).toBe('crime');
    expect(d.stats.power).toBeGreaterThanOrEqual(80);
    expect(d.stats.authority).toBeGreaterThanOrEqual(85);
    expect(d.statKeys).toContain('heat');
    const names = d.characters.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Marco Bellini', 'Viktor Lenz', 'Elena Moretti']));
    expect(d.characters.find((c) => c.name === 'Marco Bellini')!.stance).toBe('ally');
    expect(d.characters.find((c) => c.name === 'Viktor Lenz')!.stance).toBe('subordinate');
    expect(d.characters.find((c) => c.name === 'Elena Moretti')!.stance).toBe('rival');
    expect(d.characters.find((c) => c.name === 'Viktor Lenz')!.secrets[0]).toMatch(/heimlich/);
    expect(d.assets).toContain('Restaurant');
  });

  it('Normale Bürgerin: niedrige Werte, keine Macht – und andere Startwerte als der Boss', () => {
    const ctx = createTestContext();
    const d = ruleDraft(ctx, parseSetupInput({ prompt: CITIZEN }));
    const boss = ruleDraft(ctx, parseSetupInput({ prompt: MAFIA }));
    expect(d.playerName).toBe('Lena Vogt');
    expect(d.archetype).toBe('ordinary');
    expect(d.stats.power).toBeUndefined();
    expect(d.stats.wealth!).toBeLessThan(20);
    expect(d.stats.wealth!).toBeLessThan(boss.stats.wealth!);
    expect(d.playerAppearance.gender).toBe('female');
    expect(d.characters.map((c) => c.name)).toEqual(expect.arrayContaining(['Julia Hartmann', 'Daniel Krüger']));
    expect(d.characters.find((c) => c.name === 'Julia Hartmann')!.stance).toBe('friend');
    expect(d.characters.find((c) => c.name === 'Daniel Krüger')!.stance).toBe('boss');
  });

  it('mehrteilige Einrichtung und übernommene Social-Figur (gleiches Aussehen in beiden Modi)', async () => {
    const { app } = setup();
    const draft = await draftFor(app, '', {
      parts: {
        background: 'Berlin, Wahlkampf. Ich bin Abgeordnete und will Bürgermeisterin werden.',
        characters: '- Sofia Brandt: meine Wahlkampfberaterin\n- Karim Saleh: Gegenkandidat, skrupellos',
        start: 'Die erste Fernsehdebatte beginnt in einer Stunde.',
      },
      socialCharacterIds: ['c-mira'],
    });
    expect(draft.archetype).toBe('politician');
    expect(draft.opening).toContain('Fernsehdebatte');
    const mira = draft.characters.find((c) => c.socialCharacterId === 'c-mira')!;
    expect(mira).toBeTruthy();
    const story = (await request(app).post('/api/life/stories').set(W).send(draft).expect(201)).body as LifeStoryDto;
    await waitForNarration(story.id);
    const imported = story.characters.find((c) => c.fromSocial)!;
    const social = (await request(app).get('/api/characters/c-mira/appearance').expect(200)).body;
    expect(imported.appearance).toEqual(social.appearance);
  });

  it('lehnt zu kurze Beschreibungen und unvollständige Entwürfe ab', async () => {
    const { app } = setup();
    await request(app).post('/api/life/setup-jobs').set(W).send({ prompt: 'Boss' }).expect(400);
    await request(app).post('/api/life/stories').set(W).send({ title: 'x' }).expect(400);
  });
});

describe('Spielsystem: Würfe, Konsequenzen, Werte', () => {
  it('Erfolg ist nie garantiert; Werte und Beziehung verändern die Chance', () => {
    const ctx = createTestContext();
    const d = ruleDraft(ctx, parseSetupInput({ prompt: MAFIA }));
    const citizen = ruleDraft(ctx, parseSetupInput({ prompt: CITIZEN }));
    const target = { id: 't', status: 'alive', affinity: -40, trust: 10, loyalty: 0, fear: 20, stance: 'enemy', importance: 2, name: 'Viktor', secrets: '[]' } as never;
    const cls = classifyAction('Ich drohe Viktor', [], []);
    expect(cls.category).toBe('threaten');
    const strong = successChance(d.stats, cls, target);
    const weak = successChance(citizen.stats, cls, target);
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(0.92);
    // Über viele Würfe gibt es Erfolge und Misserfolge.
    const rng = createRng('dice');
    const tiers = new Set(Array.from({ length: 300 }, () => resolveAction(d.stats, cls, target, rng).tier));
    expect(tiers.has('success')).toBe(true);
    expect(tiers.has('failure') || tiers.has('critical_failure')).toBe(true);
  });

  it('ein Zug ändert Werte nach Spielregeln, erzeugt Erinnerungen und vier neue Vorschläge', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    expect(story.status).toBe('active');
    const opening = lastSuggestions(story);
    expect(opening.map((s) => s.kind)).toEqual(['smart', 'alternative', 'risky', 'surprising']);
    const before = story.stats;
    const after = await turn(app, story.id, { suggestionId: opening[2].id });
    const player = after.messages.find((m) => m.role === 'player')!;
    expect(player.content).toBe(opening[2].text);
    const resolved = after.messages.find((m) => m.resolution)!;
    expect(resolved.resolution!.chance).toBeGreaterThan(0);
    expect(resolved.pending).toBe(false);
    expect(after.turn).toBe(1);
    // Die angezeigten Änderungen entsprechen genau der Differenz der gespeicherten Werte.
    for (const [k, v] of Object.entries(after.lastChanges)) expect((after.stats as Record<string, number>)[k] - (before as Record<string, number>)[k]).toBe(v);
    const next = lastSuggestions(after);
    expect(next).toHaveLength(4);
    expect(next.map((s) => s.text)).not.toEqual(opening.map((s) => s.text));
    // Veraltete Vorschläge können nicht erneut gespielt werden.
    await request(app).post(`/api/life/stories/${story.id}/turns`).set(W).send({ suggestionId: opening[0].id }).expect(400);
    // Freie Eingabe bleibt möglich.
    const free = await turn(app, story.id, { text: 'Ich verspreche Marco, dass er am Gewinn beteiligt wird.' });
    expect(free.promises.some((p) => p.content.includes('Marco'))).toBe(true);
    expect(getStory(ctx, story.id).turn).toBe(2);
  });

  it('während einer laufenden Erzählung wird kein zweiter Zug angenommen', async () => {
    const local = ollamaMock({ delayMs: 150, reply: JSON.stringify({ narration: 'Ruhe.', dialogue: [], location: 'Palermo', present: [], facts: [], suggestions: [] }) });
    const { app } = setup({ local });
    const draft = await draftFor(app, MAFIA, { useAi: false });
    const created = (await request(app).post('/api/life/stories').set(W).send(draft).expect(201)).body;
    await waitForNarration(created.id);
    await request(app).post(`/api/life/stories/${created.id}/turns`).set(W).send({ text: 'Ich warte ab.' }).expect(200);
    const busy = await request(app).post(`/api/life/stories/${created.id}/turns`).set(W).send({ text: 'Noch einmal.' }).expect(409);
    expect(busy.body.error.code).toBe('turn_running');
    await waitForNarration(created.id);
  });

  it('Zeit vergeht: Tage, Heilung, Abklingen der Aufmerksamkeit; Abwesenheit nur alle 8 Stunden', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    run(ctx.db, 'UPDATE life_stories SET stats = ? WHERE id = ?', JSON.stringify({ ...story.stats, health: 40, heat: 80 }), story.id);
    await advanceTime(ctx, story.id, 'time');
    await waitForNarration(story.id);
    const after = getStoryDto(ctx, story.id);
    expect(after.day).toBeGreaterThan(story.day);
    expect(after.stats.health!).toBeGreaterThan(40);
    expect(after.stats.heat!).toBeLessThan(80);
    expect(await tickLifeStories(ctx)).toBe(0);
    ctx.advance(9 * 60);
    expect(await tickLifeStories(ctx)).toBe(1);
    expect(getStoryDto(ctx, story.id).messages.some((m) => m.away)).toBe(true);
  });
});

describe('Permanenter Tod', () => {
  it('stirbt die Spielfigur, endet die Geschichte endgültig – auch nach einem Neustart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sv-life-death-'));
    const dbFile = join(dir, 'db.sqlite');
    const first = setup({ dbFile, config: { uploadsDir: join(dir, 'u') } });
    let story = await createStory(first.app, MAFIA);
    let died = false;
    for (let i = 0; i < 40 && !died; i++) {
      run(first.ctx.db, 'UPDATE life_stories SET stats = ? WHERE id = ?', JSON.stringify({ ...getStoryDto(first.ctx, story.id).stats, health: 3 }), story.id);
      story = await turn(first.app, story.id, { text: 'Ich greife Elena Moretti allein und unbewaffnet an.' });
      died = story.status === 'ended';
    }
    expect(died).toBe(true);
    expect(story.ending).toBeTruthy();
    expect(story.events.some((e) => e.kind === 'death' && e.severity === 'critical')).toBe(true);
    const res = await request(first.app).post(`/api/life/stories/${story.id}/turns`).set(W).send({ text: 'Ich stehe wieder auf.' }).expect(409);
    expect(res.body.error.code).toBe('story_ended');
    await request(first.app).post(`/api/life/stories/${story.id}/advance`).set(W).send({}).expect(409);
    first.ctx.db.close();
    const second = setup({ dbFile, config: { uploadsDir: join(dir, 'u') } });
    const reloaded = (await request(second.app).get(`/api/life/stories/${story.id}`).expect(200)).body as LifeStoryDto;
    expect(reloaded.status).toBe('ended');
    // Keine Vorschläge mehr; das Ende ist die letzte Nachricht.
    expect([...reloaded.messages].reverse().find((m) => m.role === 'narrator')!.suggestions ?? []).toEqual([]);
    expect(reloaded.messages.at(-1)!.role).toBe('system');
    await request(second.app).post(`/api/life/stories/${story.id}/turns`).set(W).send({ text: 'Weiter' }).expect(409);
    second.ctx.db.close();
  });

  it('getötete Figuren können nicht mehr sprechen oder handeln', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    const viktor = story.characters.find((c) => c.name === 'Viktor Lenz')!;
    run(ctx.db, `UPDATE life_characters SET status = 'dead' WHERE id = ?`, viktor.id);
    const s = getStory(ctx, story.id);
    const chars = listLifeCharacters(ctx, story.id);
    const raw = JSON.stringify({ narration: 'Stille.', dialogue: [{ speaker: 'Viktor Lenz', text: 'Ich lebe noch!' }, { speaker: 'Marco', text: 'Boss?' }], suggestions: [] });
    const parsed = parseNarration(raw, s, chars, createRng('x'), [])!;
    expect(parsed.dialogue.map((d) => d.speakerId)).toEqual([story.characters.find((c) => c.name === 'Marco Bellini')!.id]);
    expect(classifyAction('Ich rede mit Viktor', chars, []).targetId).not.toBe(viktor.id);
    const { user } = buildNarrationMessages(ctx, s, chars, { playerText: 'x', resolution: null, events: [], mode: 'turn' });
    expect(user).toMatch(/CANNOT act or speak: Viktor Lenz \(dead\)/);
  });
});

describe('Gedächtnis: Abruf, Wissensgrenzen, lange Verläufe', () => {
  it('Figuren kennen nur, was sie erfahren haben; Geheimnisse bleiben verborgen', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    const marco = story.characters.find((c) => c.name === 'Marco Bellini')!;
    const elena = story.characters.find((c) => c.name === 'Elena Moretti')!;
    const viktor = story.characters.find((c) => c.name === 'Viktor Lenz')!;
    remember(ctx, story.id, { kind: 'secret', content: 'Das Geld liegt im Weinkeller unter dem Restaurant.', importance: 4, knownBy: [PLAYER, marco.id], subjects: [marco.id], turn: 1, source: 'engine' });
    const marcoKnows = recall(ctx, story.id, { query: 'Geld Weinkeller', viewer: marco.id, turn: 2 }).map((m) => m.content);
    const elenaKnows = recall(ctx, story.id, { query: 'Geld Weinkeller', viewer: elena.id, turn: 2 }).map((m) => m.content);
    expect(marcoKnows.some((c) => c.includes('Weinkeller'))).toBe(true);
    expect(elenaKnows.some((c) => c.includes('Weinkeller'))).toBe(false);
    // Ein Geheimnis, das nur Viktor kennt, bleibt dem Spieler und den anderen verborgen.
    remember(ctx, story.id, { kind: 'secret', content: 'Viktor hat 50.000 Euro von Elena angenommen.', importance: 4, knownBy: [viktor.id], subjects: [viktor.id], turn: 1, source: 'engine' });
    const playerKnows = recall(ctx, story.id, { query: 'Viktor Euro Elena', viewer: PLAYER, turn: 2, limit: 50, criticalLimit: 50 }).map((m) => m.content);
    expect(playerKnows.some((c) => c.includes('50.000'))).toBe(false);
    expect(recall(ctx, story.id, { query: 'Viktor Euro', viewer: viktor.id, turn: 2 }).some((m) => m.content.includes('50.000'))).toBe(true);
    expect(recall(ctx, story.id, { query: 'Viktor Euro', viewer: marco.id, turn: 2 }).some((m) => m.content.includes('50.000'))).toBe(false);
    const memories = (await request(app).get(`/api/life/stories/${story.id}/memories`).expect(200)).body as { content: string }[];
    expect(memories.some((m) => m.content.includes('50.000'))).toBe(false);
    expect((await request(app).get(`/api/life/stories/${story.id}/memories?q=Euro`).expect(200)).body.some((m: { content: string }) => m.content.includes('50.000'))).toBe(false);
    // Im Erzählkontext stehen Elenas Kenntnisse ohne den Weinkeller.
    run(ctx.db, 'UPDATE life_stories SET present = ? WHERE id = ?', JSON.stringify([elena.id]), story.id);
    const { user } = buildNarrationMessages(ctx, getStory(ctx, story.id), listLifeCharacters(ctx, story.id), { playerText: 'Ich spreche mit Elena', resolution: null, events: [], mode: 'turn' });
    const elenaLine = user.split('\n').find((l) => l.includes('Elena Moretti knows'));
    expect(elenaLine ?? '').not.toContain('Weinkeller');
    expect(user).not.toContain(viktor.name + ' knows');
  });

  it('nach 3.000 Nachrichten: kritische Fakten bleiben im Abruf, Zusammenfassungen entstehen, Abruf bleibt schnell', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    const marco = story.characters.find((c) => c.name === 'Marco Bellini')!;
    remember(ctx, story.id, { kind: 'promise', content: 'Salvatore hat Marco versprochen, seine Tochter Giulia zu beschützen.', importance: 5, critical: true, knownBy: [PLAYER, marco.id], subjects: [marco.id], turn: 1, source: 'engine' });
    remember(ctx, story.id, { kind: 'death', content: 'Tommaso wurde an Tag 2 am Hafen erschossen.', importance: 5, critical: true, knownBy: [EVERYONE], turn: 2, source: 'engine' });
    // Langer Verlauf: 3.000 Nachrichten und 1.500 gewöhnliche Erinnerungen.
    const insert = ctx.db.prepare('INSERT INTO life_messages (story_id, turn, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
    ctx.db.exec('BEGIN');
    for (let i = 0; i < 3000; i++) insert.run(story.id, 3 + Math.floor(i / 3), i % 3 === 0 ? 'player' : 'narrator', `Nachricht ${i} über Geschäfte am Markt und Wetter`, new Date().toISOString());
    for (let i = 0; i < 1500; i++) remember(ctx, story.id, { kind: 'fact', content: `Belangloser Fakt ${i} über das Wetter und den Markt`, importance: 1 + (i % 3), knownBy: [PLAYER], turn: 3 + i, source: 'engine' });
    ctx.db.exec('COMMIT');
    run(ctx.db, 'UPDATE life_stories SET turn = 1600 WHERE id = ?', story.id);
    const started = performance.now();
    const memories = recall(ctx, story.id, { query: 'Ich spreche mit Marco über Giulia', subjects: [marco.id], viewer: PLAYER, turn: 1600 });
    const elapsed = performance.now() - started;
    expect(memories.some((m) => m.content.includes('Giulia'))).toBe(true);
    expect(memories.some((m) => m.content.includes('Tommaso'))).toBe(true);
    expect(elapsed).toBeLessThan(300);
    // Auch ohne passende Stichwörter sind kritische Fakten immer dabei.
    const unrelated = recall(ctx, story.id, { query: 'Wetter', viewer: PLAYER, turn: 1600 });
    expect(unrelated.filter((m) => m.critical).map((m) => m.content).join(' ')).toMatch(/Giulia[\s\S]*Tommaso|Tommaso[\s\S]*Giulia/);
    // Der nächste Zug fasst alte Nachrichten zusammen und bleibt bedienbar.
    const after = await turn(app, story.id, { text: 'Ich rede mit Marco über Giulia.' });
    expect(after.messages.length).toBeLessThanOrEqual(60);
    expect(after.hasOlderMessages).toBe(true);
    const summaries = ctx.db.prepare(`SELECT COUNT(*) AS n FROM life_memories WHERE story_id = ? AND kind = 'summary'`).get(story.id) as { n: number };
    expect(summaries.n).toBeGreaterThan(0);
    const older = (await request(app).get(`/api/life/stories/${story.id}?before=${after.messages[0].id}`).expect(200)).body as LifeStoryDto;
    expect(older.messages.at(-1)!.id).toBeLessThan(after.messages[0].id);
  });

  it('vor jeder KI-Antwort wird gezielt erinnert: frühe Versprechen und Figurenwissen stehen im Kontext', async () => {
    const bodies: { messages: { role: string; content: string }[]; format?: unknown }[] = [];
    const local = ollamaMock({
      reply: (body) => {
        bodies.push(body as never);
        const f = JSON.stringify(body.format ?? '');
        if (f.includes('playerRole')) return JSON.stringify({ title: 'Palermo', playerName: 'Don Salvatore Greco', playerRole: 'Mafiaboss', setting: 'Palermo', characters: [] });
        return JSON.stringify({
          narration: 'Marco nickt langsam. „Du hast es versprochen“, sagt er.',
          dialogue: [{ speaker: 'Marco Bellini', text: 'Ich erinnere mich an dein Versprechen.' }],
          location: 'Restaurant Da Greco',
          present: ['Marco Bellini'],
          facts: [{ text: 'Marco vertraut Salvatore wieder.', importance: 3, knownBy: ['Marco Bellini'] }],
          suggestions: [
            { kind: 'smart', text: 'Marco einen Teil des Hafens überlassen', category: 'business', target: 'Marco Bellini' },
            { kind: 'alternative', text: 'Elena ein Friedensangebot schicken', category: 'persuade', target: 'Elena Moretti' },
            { kind: 'risky', text: 'Viktor heute Nacht zur Rede stellen', category: 'threaten', target: 'Viktor Lenz' },
            { kind: 'surprising', text: 'Die Polizei um ein Treffen bitten', category: 'persuade', target: '' },
          ],
        });
      },
    });
    const { app } = setup({ local });
    const story = await createStory(app, MAFIA);
    const opening = bodies.find((b) => JSON.stringify(b.format ?? '').includes('narration'))!;
    expect(opening.messages[1].content).toContain('Marco Bellini');
    let s = await turn(app, story.id, { text: 'Ich verspreche Marco, dass seine Tochter Giulia sicher ist.' });
    for (let i = 0; i < 6; i++) s = await turn(app, story.id, { text: `Ich prüfe die Bücher des Restaurants, Woche ${i}.` });
    const last = bodies.at(-1)!;
    const context = last.messages[1].content;
    expect(context).toContain('Giulia');
    expect(context).toMatch(/Open promises:.*Giulia/);
    expect(context).toContain('Game system result (authoritative');
    // Die KI-Vorschläge werden übernommen, die Erzählung gespeichert, die Szene aktualisiert.
    expect(lastSuggestions(s).map((x) => x.kind)).toEqual(['smart', 'alternative', 'risky', 'surprising']);
    expect(s.location).toBe('Restaurant Da Greco');
    expect(s.messages.some((m) => m.role === 'character' && m.speakerName === 'Marco Bellini')).toBe(true);
    // Identische KI-Vorschläge in Folge werden durch passende eigene ersetzt (keine Wiederholung).
    const prev = s.messages.filter((m) => m.role === 'narrator' && m.suggestions?.length).slice(-2);
    expect(prev[1].suggestions!.map((x) => x.text)).not.toEqual(prev[0].suggestions!.map((x) => x.text));
  });

  it('nach einem Absturz werden unterbrochene Erzählungen abgeschlossen', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    run(ctx.db, `INSERT INTO life_messages (story_id, turn, role, content, data, pending, created_at) VALUES (?, 1, 'narrator', '', '{"resolution":{"category":"talk"}}', 1, ?)`, story.id, new Date().toISOString());
    recoverPendingNarrations(ctx);
    await waitForNarration(story.id);
    const s = getStoryDto(ctx, story.id);
    expect(s.messages.some((m) => m.pending)).toBe(false);
  });
});

describe('Szenenbilder und Dauerhaftigkeit', () => {
  it('Bildschaltfläche: Foto mit Figurenaussehen aus dem Verlauf; ohne Bild-KI eine Szenenkarte', async () => {
    const calls: ImageCall[] = [];
    const withAi = setup({ images: sdWebUiMock({ calls }) });
    const story = await createStory(withAi.app, MAFIA);
    await turn(withAi.app, story.id, { text: 'Ich treffe Marco Bellini im Restaurant.' });
    const res = await request(withAi.app).post(`/api/life/stories/${story.id}/images`).set(W).send({ description: 'Kerzenlicht' }).expect(202);
    await withAi.ctx.images.waitFor(res.body.job.id);
    const scene = calls.find((c) => c.prompt.includes('Kerzenlicht'))!;
    expect(scene).toBeTruthy();
    expect(scene.prompt).toMatch(/photo/i);
    const s = getStoryDto(withAi.ctx, story.id);
    expect(s.messages.at(-1)!.role).toBe('image');
    expect(s.messages.at(-1)!.imageUrl).toMatch(/^\/api\/media\/images\//);
    // Spieler- und Figurenporträts sowie das Titelbild wurden im Hintergrund angefordert.
    expect(calls.some((c) => c.width === 1344)).toBe(true);

    const noAi = setup();
    const story2 = await createStory(noAi.app, MAFIA);
    const card = await request(noAi.app).post(`/api/life/stories/${story2.id}/images`).set(W).send({}).expect(200);
    expect(card.body.job).toBeNull();
    expect(card.body.story.messages.at(-1).sceneCard).toBeTruthy();
    await request(noAi.app).post(`/api/life/stories/${story2.id}/images`).set(W).send({ description: 'explizite Sexszene' }).expect(400);
  });

  it('Geschichte, Werte, Figuren und Gedächtnis bleiben nach einem Neustart erhalten', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sv-life-persist-'));
    const dbFile = join(dir, 'db.sqlite');
    const first = setup({ dbFile, config: { uploadsDir: join(dir, 'u') } });
    const story = await createStory(first.app, MAFIA);
    let s = story;
    for (let i = 0; i < 5; i++) s = await turn(first.app, story.id, { text: i === 2 ? 'Ich verspreche Marco einen Anteil.' : 'Ich rede mit Marco.' });
    const memoriesBefore = (await request(first.app).get(`/api/life/stories/${story.id}/memories`)).body.length;
    first.ctx.db.close();
    const second = setup({ dbFile, config: { uploadsDir: join(dir, 'u') } });
    const reloaded = (await request(second.app).get(`/api/life/stories/${story.id}`).expect(200)).body as LifeStoryDto;
    expect(reloaded.turn).toBe(5);
    expect(reloaded.stats).toEqual(s.stats);
    expect(reloaded.characters.map((c) => [c.name, c.affinity, c.status])).toEqual(s.characters.map((c) => [c.name, c.affinity, c.status]));
    expect(reloaded.messages.length).toBe(s.messages.length);
    expect((await request(second.app).get(`/api/life/stories/${story.id}/memories`)).body.length).toBe(memoriesBefore);
    expect(reloaded.promises.length).toBe(1);
    // Weiterspielen nach dem Neustart.
    await request(second.app).post(`/api/life/stories/${story.id}/turns`).set(W).send({ text: 'Ich gehe zum Hafen.' }).expect(200);
    await waitForNarration(story.id);
    second.ctx.db.close();
  });

  it('Löschen entfernt die Geschichte samt Figuren, Nachrichten und Gedächtnis', async () => {
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    await request(app).delete(`/api/life/stories/${story.id}`).set(W).expect(204);
    await request(app).get(`/api/life/stories/${story.id}`).expect(404);
    for (const t of ['life_characters', 'life_messages', 'life_memories', 'life_events']) {
      expect((ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE story_id = ?`).get(story.id) as { n: number }).n).toBe(0);
    }
    expect((await request(app).get('/api/life/stories')).body).toEqual([]);
  });
});

// Hilfstyp für Tests, die den Kontext direkt brauchen.
export type { TestContext };

describe('Reisen und Ortswechsel', () => {
  it('erkennt nur echte Ortsnamen als neues Ziel', async () => {
    const { app } = setup();
    const story = await createStory(app, MAFIA);
    const before = story.location;
    const stay = await turn(app, story.id, { text: 'Ich will die Stadt für ein paar Tage verlassen.' });
    expect(stay.location).not.toMatch(/paar Tage/);
    expect(stay.location === before || stay.location === 'Restaurant Da Greco' || stay.location.length > 0).toBe(true);
    const moved = await turn(app, story.id, { text: 'Ich fahre nach Neapel, um alte Freunde zu treffen.' });
    expect(moved.location).toBe('Neapel');
  });

  it('versteht englische Prompts (Rolle, Startwerte)', () => {
    const ctx = createTestContext({ lang: 'en' });
    const d = ruleDraft(ctx, parseSetupInput({ prompt: 'I am Tony Moretti, a powerful mafia boss in Chicago.\n- Sal Russo: my right hand, loyal for years\nTonight the rival family makes a move.' }));
    expect(d.playerName).toBe('Tony Moretti');
    expect(d.archetype).toBe('crime_boss');
    expect(d.characters.find((c) => c.name === 'Sal Russo')?.stance).toBe('ally');
    expect(d.opening).toContain('Tonight');
  });
});

describe('Ereignisse', () => {
  it('keine zufälligen Todesfälle in der Anlaufphase; später möglich, aber nicht für Hauptfiguren in kurzen Geschichten', async () => {
    const { rollEvents } = await import('../life/engine');
    const { app, ctx } = setup();
    const story = await createStory(app, MAFIA);
    const s = getStory(ctx, story.id);
    const chars = listLifeCharacters(ctx, story.id);
    const kinds = (turn: number) =>
      Array.from({ length: 400 }, (_, i) => rollEvents({ ...s, turn }, { health: 80, heat: 20, loyalty: 60 }, ['crime'], chars, createRng(`ev${turn}:${i}`), 'time', []))
        .flat()
        .filter((e) => e.kind === 'npc_death');
    expect(kinds(2)).toHaveLength(0);
    const later = kinds(12);
    expect(later.length).toBeGreaterThan(0);
    const main = new Set(chars.filter((c) => c.importance >= 3).map((c) => c.id));
    expect(later.every((e) => e.participants.every((p) => !main.has(p)))).toBe(true);
  });
});
