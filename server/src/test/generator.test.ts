import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { GenerationJobDto } from '../../../shared/types';
import { cancelGenerationJob, getGenerationJob, resetGenerationJobs, startGenerationJob } from '../services/generationJobs';
import { draftJsonSchema } from '../services/worldgen';
import { createTestApp, createTestContext, ollamaMock, routeMocks, TEST_CONFIG } from './helpers';

const W = { 'X-SocialVerse': '1' };

/** Gültiger KI-Entwurf passend zum angefragten Schema. */
function aiWorld(body: { format?: unknown }): string {
  const format = body.format as { properties?: { characters?: { minItems?: number } } } | undefined;
  const count = format?.properties?.characters?.minItems ?? 2;
  return JSON.stringify({
    name: 'Nebelbucht',
    tagline: 'Eine Bucht voller Geheimnisse.',
    description: 'Von der lokalen KI erzeugt.',
    lore: 'Früher ein Fischerdorf.',
    atmosphere: 'neblig',
    rules: ['Jeder kennt jeden.', 'Nachts läutet die Glocke.', 'Nichts bleibt geheim.'],
    characters: Array.from({ length: count }, (_, i) => ({
      name: `Figur ${i + 1}`,
      role: 'Fischerin',
      tagline: 'Kennt das Meer.',
      description: 'Ruhig.',
      personality: ['ruhig', 'klug', 'mutig'],
      interests: ['Meer', 'Musik'],
      background: 'Lebt seit Jahren hier.',
      writingStyle: 'casual',
    })),
  });
}

async function waitFor(id: string): Promise<GenerationJobDto> {
  for (let i = 0; i < 200; i++) {
    const job = getGenerationJob(id);
    if (job.status !== 'running') return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Auftrag wurde nicht fertig');
}

const input = { genre: 'mystery', prompt: 'Ein Leuchtturm', characterCount: 2, useAi: true };

afterEach(() => resetGenerationJobs());

describe('Weltgenerator mit lokaler KI (Hintergrundauftrag)', () => {
  it('erzeugt einen KI-Entwurf mit Fortschritt', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: aiWorld, tokenDelayMs: 5, chunks: 30 }), null) });
    const started = await startGenerationJob(ctx, input);
    expect(started).toMatchObject({ status: 'running', provider: 'local', model: 'gemma3:4b' });
    const done = await waitFor(started.id);
    expect(done.status).toBe('done');
    expect(done.draft?.source).toBe('ai');
    expect(done.draft?.name).toBe('Nebelbucht');
    expect(done.draft?.characters).toHaveLength(2);
    expect(done.tokens).toBeGreaterThan(10);
    expect(done.notice).toBeNull();
    // Begrenztes JSON-Schema statt freier Textlänge, langes Zeitlimit statt Chat-Limit.
    const call = ctx.fetchCalls.find((c) => c.url.endsWith('/api/chat'))?.body as { format: unknown; options: { num_predict: number } };
    expect(call.format).toEqual(draftJsonSchema(2));
    expect(call.options.num_predict).toBeGreaterThan(1_000);
  });

  it('liefert ohne erreichbare lokale KI sofort den lokalen Entwurf mit Diagnose', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ down: true }), null) });
    const job = await startGenerationJob(ctx, input);
    expect(job).toMatchObject({ status: 'done', provider: 'fallback', notice: 'local-unreachable' });
    expect(job.draft?.source).toBe('demo');
    expect(job.draft?.characters).toHaveLength(2);
  });

  it('fällt bei stockender Ausgabe auf den lokalen Entwurf zurück und nennt den Grund', async () => {
    const ctx = createTestContext({
      handler: routeMocks(ollamaMock({ reply: aiWorld, tokenDelayMs: 300, chunks: 10 }), null),
      config: { localAi: { ...TEST_CONFIG.localAi, idleTimeoutMs: 80 } },
    });
    const done = await waitFor((await startGenerationJob(ctx, input)).id);
    expect(done).toMatchObject({ status: 'done', notice: 'timeout' });
    expect(done.draft?.source).toBe('demo');
  });

  it('meldet abgeschnittene KI-Ausgaben als unvollständig', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: '{"name": "Halb', doneReason: 'length' }), null) });
    const done = await waitFor((await startGenerationJob(ctx, input)).id);
    expect(done).toMatchObject({ status: 'done', notice: 'truncated' });
  });

  it('lässt sich abbrechen und liefert dann sofort den lokalen Entwurf', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: aiWorld, tokenDelayMs: 200, chunks: 50 }), null) });
    const started = await startGenerationJob(ctx, input);
    await new Promise((r) => setTimeout(r, 50));
    const cancelled = cancelGenerationJob(started.id);
    expect(cancelled).toMatchObject({ status: 'cancelled', notice: 'cancelled' });
    expect(cancelled.draft?.source).toBe('demo');
    // Danach ist sofort ein neuer Auftrag möglich.
    await new Promise((r) => setTimeout(r, 20));
    const next = await startGenerationJob(ctx, input);
    expect(next.status).toBe('running');
  });

  it('erlaubt nur einen laufenden Auftrag gleichzeitig', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: aiWorld, tokenDelayMs: 50, chunks: 20 }), null) });
    await startGenerationJob(ctx, input);
    await expect(startGenerationJob(ctx, input)).rejects.toMatchObject({ status: 409, code: 'generation_running' });
  });

  it('bietet Start, Fortschritt und Abbruch über die API an', async () => {
    const ctx = createTestContext({ handler: routeMocks(ollamaMock({ reply: aiWorld, tokenDelayMs: 100, chunks: 30 }), null) });
    const app = createTestApp(ctx);
    const started = await request(app).post('/api/worlds/generate-jobs').set(W).send(input).expect(202);
    expect(started.body.status).toBe('running');
    const polled = await request(app).get(`/api/worlds/generate-jobs/${started.body.id}`).expect(200);
    expect(polled.body.id).toBe(started.body.id);
    const cancelled = await request(app).delete(`/api/worlds/generate-jobs/${started.body.id}`).set(W).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    await request(app).get('/api/worlds/generate-jobs/gen_unbekannt').expect(404);
    await request(app).post('/api/worlds/generate-jobs').set(W).send({ genre: 'gibtsnicht' }).expect(400);
  });
});
