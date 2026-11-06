import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { describeAppearance } from '../../../shared/appearance';
import { characterAppearance } from '../services/appearances';
import { comfyUiMock, createTestApp, createTestContext, joinAsCustom, ollamaMock, routeMocks, sdWebUiMock, type ImageCall } from './helpers';

const W = { 'X-SocialVerse': '1' };

function setup(opts: { images?: ReturnType<typeof sdWebUiMock> | null; local?: ReturnType<typeof ollamaMock> | null; config?: object; dbFile?: string } = {}) {
  const ctx = createTestContext({ handler: routeMocks(opts.local ?? null, null, opts.images ?? null), config: opts.config, dbFile: opts.dbFile });
  return { ctx, app: createTestApp(ctx) };
}

async function waitJob(app: ReturnType<typeof createTestApp>, id: string) {
  for (let i = 0; i < 200; i++) {
    const res = await request(app).get(`/api/images/jobs/${id}`).expect(200);
    if (res.body.status !== 'queued' && res.body.status !== 'running') return res.body;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Bildauftrag nicht fertig');
}

describe('Bild-KI: Erkennung und Profilbilder', () => {
  it('ohne Bild-KI: gezeichnetes Porträt (SVG) mit strengen Headern, ETag und 304', async () => {
    const { app } = setup();
    const status = await request(app).get('/api/images/status?refresh=1').expect(200);
    expect(status.body.reachable).toBe(false);
    expect(status.body.backend).toBeNull();
    const res = await request(app).get('/api/media/avatars/c-mira').expect(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    const svg = Buffer.from(res.body as Buffer).toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/<script/i);
    await request(app).get('/api/media/avatars/c-mira').set('If-None-Match', res.headers.etag).expect(304);
    const job = await request(app).post('/api/characters/c-mira/avatar').set(W).send({}).expect(409);
    expect(job.body.error.code).toBe('images_unavailable');
  });

  it('erkennt Forge/A1111 (SDXL), erzeugt ein Foto mit festem Aussehen und speichert es dauerhaft', async () => {
    const calls: ImageCall[] = [];
    const { app, ctx } = setup({ images: sdWebUiMock({ calls }) });
    const status = await request(app).get('/api/images/status?refresh=1').expect(200);
    expect(status.body).toMatchObject({ backend: 'sdwebui', reachable: true, family: 'sdxl' });
    const job = await request(app).post('/api/characters/c-mira/avatar').set(W).send({}).expect(202);
    const done = await waitJob(app, job.body.id);
    expect(done.status).toBe('done');
    expect(calls).toHaveLength(1);
    // Fotorealistischer Stil, Negativprompt gegen Zeichnungen, SDXL-Hochformat und das feste Aussehen der Figur.
    expect(calls[0].prompt).toMatch(/photo/i);
    expect(calls[0].negative).toMatch(/cartoon/);
    expect(calls[0].negative).toMatch(/nsfw/);
    expect([calls[0].width, calls[0].height]).toEqual([896, 1152]);
    const looks = describeAppearance(characterAppearance(ctx, 'c-mira'));
    expect(calls[0].prompt).toContain(looks.split(',')[0]);
    const photo = await request(app).get('/api/media/avatars/c-mira').expect(200);
    expect(photo.headers['content-type']).toBe('image/png');
    const files = readdirSync(join(ctx.config.uploadsDir, 'images'));
    expect(files.filter((f) => f.endsWith('.png'))).toHaveLength(1);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
    // Aussehen bleibt gleich → derselbe Seed: Ein zweites Profilbild hätte dieselbe Figur zum Ziel.
    const appearance = await request(app).get('/api/characters/c-mira/appearance').expect(200);
    expect(appearance.body.photoUrl).toMatch(/^\/api\/media\/images\/img_[a-f0-9]{16}-[a-f0-9]{8}\.png$/);
  });

  it('identische Aufträge werden aus dem Cache bedient statt neu berechnet', async () => {
    const calls: ImageCall[] = [];
    const { ctx } = setup({ images: sdWebUiMock({ calls }) });
    const input = { kind: 'scene' as const, ownerType: 'test', ownerId: 'x', prompt: 'a quiet street at dusk', seed: 42, size: 'scene' as const, priority: 'user' as const };
    const first = await ctx.images.request(input);
    await ctx.images.waitFor(first!.id);
    const second = await ctx.images.request(input);
    expect(second!.status).toBe('done');
    expect(second!.imageId).toBe((await ctx.images.waitFor(first!.id))!.imageId);
    expect(calls).toHaveLength(1);
    // Anderer Seed → neues Bild (keine Wiederholung bei neuen Szenen).
    const third = await ctx.images.request({ ...input, seed: 43 });
    await ctx.images.waitFor(third!.id);
    expect(calls).toHaveLength(2);
  });

  it('Spieleraufträge überholen Hintergrundaufträge; die Hintergrund-Warteschlange ist begrenzt', async () => {
    const calls: ImageCall[] = [];
    const { ctx } = setup({ images: sdWebUiMock({ calls, delayMs: 30 }) });
    const base = { kind: 'scene' as const, ownerType: 'test', size: 'scene' as const };
    const bg = [];
    for (let i = 0; i < 8; i++) bg.push(await ctx.images.request({ ...base, ownerId: `bg${i}`, prompt: `background ${i}`, seed: i, priority: 'background' }));
    // Erster läuft sofort, danach höchstens 6 wartende Hintergrundaufträge.
    expect(bg.filter(Boolean)).toHaveLength(7);
    const user = await ctx.images.request({ ...base, ownerId: 'user', prompt: 'user scene', seed: 99, priority: 'user' });
    expect(user!.position).toBe(1);
    await ctx.images.waitFor(user!.id, 5000);
    expect(calls.findIndex((c) => c.prompt.includes('user scene'))).toBe(1);
  });

  it('Fehler der Bild-KI: Auftrag scheitert sauber, ohne Wiederholungsschleife', async () => {
    const calls: ImageCall[] = [];
    const { ctx } = setup({ images: sdWebUiMock({ calls, status: 500 }) });
    const job = await ctx.images.request({ kind: 'scene', ownerType: 't', ownerId: 'x', prompt: 'p', seed: 1, size: 'scene', priority: 'user' });
    const done = await ctx.images.waitFor(job!.id);
    expect(done!.status).toBe('failed');
    expect(calls).toHaveLength(1);
    expect(ctx.images.status().lastError?.message).toMatch(/HTTP 500/);
  });

  it('ComfyUI: Workflow mit installiertem Checkpoint, Abfrage des Verlaufs, Bild wird gespeichert', async () => {
    const calls: ImageCall[] = [];
    const { ctx } = setup({ images: comfyUiMock({ calls, pendingPolls: 2 }), config: { imageAi: { ...createTestContext({ seed: false }).config.imageAi, backend: 'comfyui' } } });
    await ctx.images.refresh(true);
    expect(ctx.images.status()).toMatchObject({ backend: 'comfyui', model: 'realisticVisionV60_v60B1.safetensors', family: 'sd15' });
    const job = await ctx.images.request({ kind: 'scene', ownerType: 't', ownerId: 'x', prompt: 'harbour at night', seed: 7, size: 'scene', priority: 'user' });
    const done = await ctx.images.waitFor(job!.id, 5000);
    expect(done!.status).toBe('done');
    expect(done!.imageUrl).toMatch(/^\/api\/media\/images\/img_/);
    // Realistic Vision ist ein SD-1.5-Modell: passende, kleinere Auflösung.
    expect(calls[0]).toMatchObject({ seed: 7, width: 768, height: 512 });
  });

  it('Bilder bleiben nach einem Neustart erhalten (Datei + Datenbank)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sv-img-persist-'));
    const dbFile = join(dir, 'db.sqlite');
    const uploadsDir = join(dir, 'uploads');
    const first = setup({ images: sdWebUiMock(), dbFile, config: { uploadsDir } });
    const job = await request(first.app).post('/api/characters/c-mira/avatar').set(W).send({}).expect(202);
    await waitJob(first.app, job.body.id);
    const url = (await request(first.app).get('/api/characters/c-mira/appearance')).body.photoUrl;
    first.ctx.db.close();
    // Neustart ohne erreichbare Bild-KI: Das gespeicherte Foto wird weiter ausgeliefert.
    const second = setup({ dbFile, config: { uploadsDir } });
    expect((await request(second.app).get('/api/characters/c-mira/appearance')).body.photoUrl).toBe(url);
    const res = await request(second.app).get('/api/media/avatars/c-mira').expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    await request(second.app).get(url).expect(200);
    second.ctx.db.close();
  });

  it('Dateinamen werden streng geprüft (kein Pfadzugriff)', async () => {
    const { app } = setup();
    await request(app).get('/api/media/images/..%2F..%2Fdb.sqlite').expect(404);
    await request(app).get('/api/media/images/img_zz.png').expect(404);
  });
});

describe('Bildschaltfläche im Social-Chat', () => {
  const sceneJson = JSON.stringify({ action: 'two people sharing coffee at a small window table, laughing', location: 'a cosy café', mood: 'warm', visible: ['Mira'] });

  function chatSetup(withImages: boolean) {
    const calls: ImageCall[] = [];
    const chatBodies: { messages: { content: string }[] }[] = [];
    const local = ollamaMock({
      reply: (body) => {
        chatBodies.push(body);
        return body.format && JSON.stringify(body.format).includes('visible') ? sceneJson : JSON.stringify({ reply: 'Lass uns morgen in das Café am Hafen gehen.', tone: 'warm' });
      },
    });
    const { app, ctx } = setup({ local, images: withImages ? sdWebUiMock({ calls }) : null });
    return { app, ctx, calls, chatBodies };
  }

  async function firstCharacter(app: ReturnType<typeof createTestApp>, ctx: ReturnType<typeof createTestContext>) {
    const worlds = (await request(app).get('/api/worlds')).body as { id: string }[];
    const worldId = worlds[0].id;
    joinAsCustom(ctx, worldId);
    const chars = (await request(app).get(`/api/characters?world=${worldId}`)).body as { id: string; name: string; isPlayer?: boolean }[];
    return chars.find((c) => !c.isPlayer && c.name !== 'Testfigur')!;
  }

  it('erzeugt ein Szenenfoto aus Verlauf und Aussehen, speichert es im Chat und schickt es nicht an die Chat-KI', async () => {
    const { app, ctx, calls, chatBodies } = chatSetup(true);
    const c = await firstCharacter(app, ctx);
    await request(app).post(`/api/chats/${c.id}/messages`).set(W).send({ content: 'Hast du Lust auf einen Kaffee?' }).expect(201);
    const res = await request(app).post(`/api/chats/${c.id}/images`).set(W).send({ description: 'am Fenster, Abendlicht' }).expect(202);
    expect(res.body.job.status).toMatch(/queued|running/);
    await ctx.images.waitFor(res.body.job.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toContain('two people sharing coffee');
    expect(calls[0].prompt).toContain('am Fenster, Abendlicht');
    // Der Szenen-Prompt enthält das feste Aussehen der Figur.
    const looks = describeAppearance(characterAppearance(ctx, c.id));
    expect(calls[0].prompt).toContain(looks.split(',')[0]);
    // Die KI hat für die Szene die letzten Nachrichten bekommen.
    const sceneRequest = chatBodies.find((b) => b.messages.some((m) => m.content.includes('Latest messages')))!;
    expect(sceneRequest.messages.at(-1)!.content).toContain('Hast du Lust auf einen Kaffee?');
    const chat = (await request(app).get(`/api/chats/${c.id}`)).body;
    const image = chat.messages.at(-1);
    expect(image).toMatchObject({ source: 'image', role: 'assistant' });
    expect(image.imageUrl).toMatch(/^\/api\/media\/images\//);
    // Zweites Bild desselben Moments: andere Kamera-/Lichtvariante und anderer Seed.
    const again = await request(app).post(`/api/chats/${c.id}/images`).set(W).send({}).expect(202);
    await ctx.images.waitFor(again.body.job.id);
    expect(calls[1].seed).not.toBe(calls[0].seed);
    expect(calls[1].prompt).not.toBe(calls[0].prompt);
    // Bildnachrichten gehen nicht in den Gesprächsverlauf der Chat-KI ein.
    const before = chatBodies.length;
    await request(app).post(`/api/chats/${c.id}/messages`).set(W).send({ content: 'Und jetzt?' }).expect(201);
    const chatRequest = chatBodies.slice(before).find((b) => b.messages.some((m) => m.content === 'Und jetzt?'))!;
    expect(chatRequest.messages.some((m) => m.content === image.content)).toBe(false);
  });

  it('ohne Bild-KI: Szenenkarte statt Foto; verbotene Beschreibungen werden abgelehnt', async () => {
    const { app, ctx } = chatSetup(false);
    const c = await firstCharacter(app, ctx);
    await request(app).post(`/api/chats/${c.id}/images`).set(W).send({}).expect(400);
    await request(app).post(`/api/chats/${c.id}/messages`).set(W).send({ content: 'Hallo!' }).expect(201);
    const res = await request(app).post(`/api/chats/${c.id}/images`).set(W).send({}).expect(200);
    expect(res.body.job).toBeNull();
    expect(res.body.message).toMatchObject({ source: 'image' });
    expect(res.body.message.sceneCard.characterIds).toContain(c.id);
    const blocked = await request(app).post(`/api/chats/${c.id}/images`).set(W).send({ description: 'nackt im Bett' }).expect(400);
    expect(blocked.body.error.code).toBe('image_blocked');
  });

  it('jede Antwort bringt vier unterschiedliche, situationsbezogene Vorschläge', async () => {
    const { app, ctx } = chatSetup(false);
    const c = await firstCharacter(app, ctx);
    const texts: string[][] = [];
    for (const msg of ['Hallo!', 'Wie geht es dir?', 'Erzähl mal von deinem Tag.']) {
      const res = await request(app).post(`/api/chats/${c.id}/messages`).set(W).send({ content: msg }).expect(201);
      const s = res.body.reply.suggestions as { kind: string; text: string }[];
      expect(s.map((x) => x.kind)).toEqual(['smart', 'alternative', 'risky', 'surprising']);
      expect(new Set(s.map((x) => x.text)).size).toBe(4);
      texts.push(s.map((x) => x.text));
    }
    // Aus der Antwort „… Café am Hafen …“ wird ein Thema aufgegriffen.
    expect(texts.flat().some((t) => /Café|Hafen/.test(t))).toBe(true);
    // Direkt aufeinanderfolgende Vorschlagssätze wiederholen sich nicht vollständig.
    expect(texts[1]).not.toEqual(texts[0]);
  });
});
