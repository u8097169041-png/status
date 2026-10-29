import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, createTestContext } from './helpers';

const W = { 'X-SocialVerse': '1' };
// Kleinstmögliche gültige Dateien je Format (nur die Signatur wird geprüft, der Inhalt nicht dekodiert).
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f1d0000000049454e44ae426082',
  'hex',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32, 2)]);

function setup(config = {}) {
  const ctx = createTestContext({ config });
  return { ctx, app: createTestApp(ctx) };
}

async function customWorld(app: ReturnType<typeof createTestApp>): Promise<string> {
  const world = {
    name: 'Bildwelt',
    tagline: 'Mit eigenem Bild',
    genre: 'mystery',
    description: '',
    lore: '',
    atmosphere: '',
    rules: [],
    artStyle: 'city',
    hue: 200,
  };
  const res = await request(app).post('/api/worlds').set(W).send({ world, characters: [] }).expect(201);
  return res.body.world.id as string;
}

const upload = (app: ReturnType<typeof createTestApp>, id: string, type: string, body: Buffer) =>
  request(app).put(`/api/worlds/${id}/cover`).set(W).set('Content-Type', type).send(body);

describe('Eigene Weltbilder', () => {
  it('speichert, liefert, ersetzt und entfernt ein Titelbild', async () => {
    const { app, ctx } = setup();
    const id = await customWorld(app);
    expect((await request(app).get(`/api/worlds/${id}`)).body.world.coverUrl).toBeNull();

    const first = await upload(app, id, 'image/png', PNG).expect(200);
    expect(first.body.coverUrl).toMatch(/^\/api\/media\/covers\/[\w-]+-[a-f0-9]{16}\.png$/);
    const media = await request(app).get(first.body.coverUrl).expect(200);
    expect(media.headers['content-type']).toBe('image/png');
    expect(media.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(media.body).equals(PNG)).toBe(true);
    // Überall, wo die Welt erscheint, ist das Bild hinterlegt.
    expect((await request(app).get(`/api/worlds/${id}`)).body.world.coverUrl).toBe(first.body.coverUrl);
    expect((await request(app).get('/api/worlds')).body.find((w: { id: string }) => w.id === id).coverUrl).toBe(first.body.coverUrl);
    expect((await request(app).get('/api/discover')).body.worlds.find((w: { id: string }) => w.id === id).coverUrl).toBe(first.body.coverUrl);

    // Ersetzen: neue Datei, die alte wird gelöscht.
    const second = await upload(app, id, 'image/webp', WEBP).expect(200);
    expect(second.body.coverUrl).not.toBe(first.body.coverUrl);
    await request(app).get(first.body.coverUrl).expect(404);
    expect(readdirSync(join(ctx.config.uploadsDir, 'covers'))).toHaveLength(1);

    await request(app).delete(`/api/worlds/${id}/cover`).set(W).expect(204);
    expect((await request(app).get(`/api/worlds/${id}`)).body.world.coverUrl).toBeNull();
    expect(readdirSync(join(ctx.config.uploadsDir, 'covers'))).toHaveLength(0);
  });

  it('bleibt nach einem Neustart der richtigen Welt zugeordnet', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'socialverse-cover-'));
    const config = { uploadsDir: join(dir, 'uploads') };
    const dbFile = join(dir, 'test.db');
    const first = createTestContext({ dbFile, config });
    const app1 = createTestApp(first);
    const id = await customWorld(app1);
    const other = await customWorld(app1);
    const url = (await upload(app1, id, 'image/jpeg', JPEG).expect(200)).body.coverUrl;
    first.db.close();

    const restarted = createTestContext({ dbFile, config });
    const app2 = createTestApp(restarted);
    expect((await request(app2).get(`/api/worlds/${id}`)).body.world.coverUrl).toBe(url);
    expect((await request(app2).get(`/api/worlds/${other}`)).body.world.coverUrl).toBeNull();
    const media = await request(app2).get(url).expect(200);
    expect(Buffer.from(media.body).equals(JPEG)).toBe(true);
  });

  it('prüft Dateityp, Inhalt und Größe mit verständlichen Fehlern', async () => {
    const { app } = setup();
    const id = await customWorld(app);
    expect((await upload(app, id, 'image/gif', Buffer.from('GIF89a')).expect(400)).body.error.code).toBe('invalid_image_type');
    expect((await upload(app, id, 'image/jpeg', PNG).expect(400)).body.error.code).toBe('invalid_image');
    expect((await upload(app, id, 'image/png', Buffer.from('<svg onload=alert(1)>')).expect(400)).body.error.code).toBe('invalid_image');
    const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
    expect((await upload(app, id, 'image/png', big).expect(413)).body.error.code).toBe('image_too_large');
    // Ohne Schutz-Header (CSRF) wird nichts angenommen.
    await request(app).put(`/api/worlds/${id}/cover`).set('Content-Type', 'image/png').send(PNG).expect(403);
  });

  it('erlaubt Bilder nur für eigene Welten und schützt den Dateipfad', async () => {
    const { app } = setup();
    expect((await upload(app, 'w-neon', 'image/png', PNG).expect(403)).body.error.code).toBe('forbidden');
    await upload(app, 'w-gibtsnicht', 'image/png', PNG).expect(404);
    await request(app).get('/api/media/covers/..%2F..%2Fsocialverse.db').expect(404);
    await request(app).get('/api/media/covers/test.png').expect(404);
  });

  it('löscht das Bild mit der Welt und beim Zurücksetzen aller Daten', async () => {
    const { app, ctx } = setup();
    const id = await customWorld(app);
    await upload(app, id, 'image/png', PNG).expect(200);
    await request(app).delete(`/api/worlds/${id}`).set(W).expect(204);
    expect(readdirSync(join(ctx.config.uploadsDir, 'covers'))).toHaveLength(0);

    const id2 = await customWorld(app);
    await upload(app, id2, 'image/png', PNG).expect(200);
    await request(app).post('/api/data/reset').set(W).send({ confirm: 'RESET' }).expect(200);
    const dir = join(ctx.config.uploadsDir, 'covers');
    expect(existsSync(dir) ? readdirSync(dir) : []).toHaveLength(0);
  });
});
