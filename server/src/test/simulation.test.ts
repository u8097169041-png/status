import { describe, expect, it } from 'vitest';
import { all, get } from '../db/database';
import { simulateWorld, triggerEvent } from '../services/simulation';
import { getWorld } from '../services/worlds';
import { createTestContext } from './helpers';

describe('Weltsimulation', () => {
  it('lässt einen Tag vergehen und erzeugt Ereignisse, Beiträge und gespeicherte Zustände', async () => {
    const ctx = createTestContext();
    const before = getWorld(ctx, 'w-neon').world;
    const postsBefore = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM posts WHERE world_id = 'w-neon'`)!.n;
    const result = await simulateWorld(ctx, 'w-neon', 'manual');
    expect(result.world.day).toBe(before.day + 1);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.postsCreated).toBeGreaterThan(0);
    const postsAfter = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM posts WHERE world_id = 'w-neon'`)!.n;
    expect(postsAfter).toBe(postsBefore + result.postsCreated);
    expect(result.progress.xpGained).toBeGreaterThan(0);
    const log = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM simulation_log`)!.n;
    expect(log).toBe(1);
  });

  it('ist bei gleichem Ausgangszustand deterministisch', async () => {
    const a = createTestContext();
    const b = createTestContext();
    const ra = await simulateWorld(a, 'w-elder', 'manual');
    const rb = await simulateWorld(b, 'w-elder', 'manual');
    expect(ra.events.map((e) => e.title)).toEqual(rb.events.map((e) => e.title));
    expect(ra.world.metrics).toEqual(rb.world.metrics);
  });

  it('übernimmt Zuneigungsänderungen in die gespeicherten Beziehungen', async () => {
    const ctx = createTestContext();
    const result = await simulateWorld(ctx, 'w-aurelia', 'manual');
    for (const e of result.events) {
      for (const effect of e.effects) {
        if (effect.type !== 'affinity') continue;
        const [x, y] = effect.a.id < effect.b.id ? [effect.a.id, effect.b.id] : [effect.b.id, effect.a.id];
        const row = get<{ affinity: number }>(ctx.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', x, y);
        expect(row).toBeTruthy();
      }
    }
  });

  it('Gerüchte-Karte verschlechtert die Beziehung der Beteiligten', async () => {
    const ctx = createTestContext();
    const pair = () => get<{ affinity: number }>(ctx.db, `SELECT affinity FROM relationships WHERE a_id = 'c-teddy' AND b_id = 'c-wren'`)!.affinity;
    const before = pair();
    const result = await triggerEvent(ctx, 'w-brass', { cardId: 'rumor', targetIds: ['c-teddy', 'c-wren'] });
    expect(pair()).toBe(before - 18);
    expect(result.events[0].source).toBe('user');
    expect(result.progress.xpGained).toBeGreaterThan(0);
  });

  it('Ereigniskarten prüfen Beteiligte und Titel', async () => {
    const ctx = createTestContext();
    await expect(triggerEvent(ctx, 'w-brass', { cardId: 'rumor', targetIds: ['c-teddy'] })).rejects.toThrow(/Beteiligte/);
    await expect(triggerEvent(ctx, 'w-brass', { cardId: 'rumor', targetIds: ['c-teddy', 'c-mira'] })).rejects.toThrow(/Welt/);
    await expect(triggerEvent(ctx, 'w-brass', { cardId: 'custom' })).rejects.toThrow(/Titel/);
    const ok = await triggerEvent(ctx, 'w-brass', { cardId: 'custom', customTitle: 'Ein Meteor schlägt ein', customEffect: 'discovery' });
    expect(ok.events[0].title).toBe('Ein Meteor schlägt ein');
  });

  it('hält die Weltmetriken auch über lange Zeit in einem lebendigen Bereich', async () => {
    const ctx = createTestContext();
    for (let i = 0; i < 60; i++) await simulateWorld(ctx, 'w-neon', 'auto');
    const w = get<{ harmony: number; tension: number; discovery: number }>(ctx.db, `SELECT harmony, tension, discovery FROM worlds WHERE id = 'w-neon'`)!;
    for (const value of [w.harmony, w.tension, w.discovery]) {
      expect(value).toBeGreaterThan(15);
      expect(value).toBeLessThan(90);
    }
    const kinds = all<{ kind: string }>(ctx.db, `SELECT DISTINCT kind FROM world_events WHERE world_id = 'w-neon' AND source = 'sim'`);
    expect(kinds.length).toBeGreaterThanOrEqual(6);
  });

  it('kann Geschichten bis zum Abschluss vorantreiben', async () => {
    const ctx = createTestContext();
    for (let i = 0; i < 40; i++) await simulateWorld(ctx, 'w-tide', 'manual');
    const resolved = all<{ id: string }>(ctx.db, `SELECT id FROM storylines WHERE world_id = 'w-tide' AND status = 'resolved'`);
    expect(resolved.length).toBeGreaterThan(0);
    expect(get(ctx.db, `SELECT 1 FROM achievements WHERE id = 'chronicler'`)).toBeTruthy();
  });
});
