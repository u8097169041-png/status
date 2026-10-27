import { describe, expect, it } from 'vitest';
import { dailyQuestsFor, levelForXp, levelInfo, xpForLevel, XP_RULES } from '../../../shared/progress';
import { clampAffinity, relationshipStatus } from '../../../shared/relationships';
import { get } from '../db/database';
import { claimQuest, currentXp, getProgress, recordAction } from '../services/progress';
import { setLike } from '../services/posts';
import { createTestContext } from './helpers';

describe('Level-Berechnung', () => {
  it('berechnet Schwellen und Level konsistent', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(1000);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(1000)).toBe(5);
    const info = levelInfo(150);
    expect(info.level).toBe(2);
    expect(info.progress).toBeCloseTo(0.25);
  });

  it('wählt täglich drei unterschiedliche, reproduzierbare Quests', () => {
    const a = dailyQuestsFor('2026-10-27');
    const b = dailyQuestsFor('2026-10-27');
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
  });
});

describe('Beziehungsstatus', () => {
  it('leitet Stufen aus der Zuneigung ab und begrenzt Werte', () => {
    expect(relationshipStatus(80)).toBe('close');
    expect(relationshipStatus(25)).toBe('friendly');
    expect(relationshipStatus(0)).toBe('neutral');
    expect(relationshipStatus(-30)).toBe('strained');
    expect(relationshipStatus(-90)).toBe('hostile');
    expect(clampAffinity(150)).toBe(100);
    expect(clampAffinity(-150)).toBe(-100);
  });
});

describe('XP-Vergabe', () => {
  it('belohnt dieselbe Aktion nur einmal (Like/Unlike/Like)', () => {
    const ctx = createTestContext();
    const first = setLike(ctx, 'p-mira-1', true);
    expect(first.progress.xpGained).toBe(XP_RULES.like.xp);
    setLike(ctx, 'p-mira-1', false);
    const again = setLike(ctx, 'p-mira-1', true);
    expect(again.progress.xpGained).toBe(0);
    expect(currentXp(ctx)).toBe(XP_RULES.like.xp);
  });

  it('beachtet das Tageslimit', () => {
    const ctx = createTestContext();
    let total = 0;
    for (let i = 0; i < XP_RULES.like.dailyCap + 5; i++) total += recordAction(ctx, 'like', `post-${i}`).xpGained;
    expect(total).toBe(XP_RULES.like.xp * XP_RULES.like.dailyCap);
    ctx.advance(24 * 60);
    expect(recordAction(ctx, 'like', 'post-next-day').xpGained).toBe(XP_RULES.like.xp);
  });

  it('meldet Level-Aufstiege und Erfolge', () => {
    const ctx = createTestContext();
    const delta = recordAction(ctx, 'post', 'p1');
    expect(delta.achievementsUnlocked).toContain('first-steps');
    for (let i = 0; i < 3; i++) recordAction(ctx, 'createWorld', `w${i}`);
    for (let i = 0; i < 5; i++) recordAction(ctx, 'createCharacter', `c${i}`);
    expect(currentXp(ctx)).toBeGreaterThanOrEqual(100);
    expect(get(ctx.db, `SELECT 1 FROM notifications WHERE kind = 'levelUp'`)).toBeTruthy();
  });
});

describe('Quests', () => {
  it('lässt sich erst nach Abschluss und nur einmal einlösen', () => {
    const ctx = createTestContext();
    expect(() => claimQuest(ctx, 'first-post')).toThrow(/noch nicht/);
    recordAction(ctx, 'post', 'p1');
    const before = currentXp(ctx);
    const delta = claimQuest(ctx, 'first-post');
    expect(delta.xpGained).toBe(30);
    expect(currentXp(ctx)).toBe(before + 30);
    expect(() => claimQuest(ctx, 'first-post')).toThrow(/bereits/);
    const quest = getProgress(ctx).general.find((q) => q.id === 'first-post');
    expect(quest?.claimed).toBe(true);
  });

  it('lehnt unbekannte Quests ab', () => {
    const ctx = createTestContext();
    expect(() => claimQuest(ctx, 'gibt-es-nicht')).toThrow();
  });
});
