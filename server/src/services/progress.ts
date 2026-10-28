import {
  ACHIEVEMENTS,
  GENERAL_QUESTS,
  REWARDS,
  XP_RULES,
  dailyQuestsFor,
  levelForXp,
  levelInfo,
  type AchievementMetric,
  type QuestDef,
  type QuestMetric,
  type XpAction,
} from '../../../shared/progress';
import type { ProgressDelta, ProgressDto, QuestProgressDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, notFound } from '../lib/errors';
import { dayKey } from '../lib/time';
import { COIN_REWARDS } from '../../../shared/economy';
import { notify } from './notifications';
import { grantCoins } from './wallet';

export function emptyDelta(): ProgressDelta {
  return { xpGained: 0, coinsGained: 0, levelUp: null, achievementsUnlocked: [] };
}

export function mergeDelta(a: ProgressDelta, b: ProgressDelta): ProgressDelta {
  return {
    xpGained: a.xpGained + b.xpGained,
    coinsGained: (a.coinsGained ?? 0) + (b.coinsGained ?? 0),
    levelUp: b.levelUp ?? a.levelUp,
    achievementsUnlocked: [...a.achievementsUnlocked, ...b.achievementsUnlocked],
  };
}

export function currentXp(ctx: AppContext): number {
  return get<{ xp: number }>(ctx.db, 'SELECT xp FROM user_profile WHERE id = 1')?.xp ?? 0;
}

/** Vergibt XP genau einmal pro Schlüssel. Gibt die tatsächlich vergebene Menge zurück. */
export function grantXp(ctx: AppContext, key: string, action: string, amount: number, playerId?: string | null): number {
  if (amount <= 0) return 0;
  const now = ctx.now();
  const inserted = run(
    ctx.db,
    `INSERT OR IGNORE INTO xp_events (key, action, amount, day, created_at) VALUES (?, ?, ?, ?, ?)`,
    key,
    action,
    amount,
    dayKey(now),
    now.toISOString(),
  );
  if (inserted.changes === 0) return 0;
  run(ctx.db, 'UPDATE user_profile SET xp = xp + ? WHERE id = 1', amount);
  // Fortschritt der Spielfigur in ihrer Welt.
  if (playerId) run(ctx.db, 'UPDATE players SET xp = xp + ? WHERE id = ?', amount, playerId);
  return amount;
}

/**
 * Protokolliert eine Nutzeraktion für Quests/Erfolge und vergibt XP –
 * unter Beachtung von Tageslimits und ohne Mehrfachbelohnung für dieselbe Aktion.
 */
export function recordAction(ctx: AppContext, action: XpAction, ref: string, playerId?: string | null): ProgressDelta {
  return tx(ctx.db, () => {
    const now = ctx.now();
    const day = dayKey(now);
    const levelBefore = levelForXp(currentXp(ctx));
    run(
      ctx.db,
      `INSERT OR IGNORE INTO activity_log (action, ref, day, created_at) VALUES (?, ?, ?, ?)`,
      action,
      ref,
      day,
      now.toISOString(),
    );
    const rule = XP_RULES[action];
    let gained = 0;
    if (rule.xp > 0) {
      const awardedToday =
        get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM xp_events WHERE day = ? AND action = ?`, day, action)?.n ?? 0;
      if (awardedToday < rule.dailyCap) gained = grantXp(ctx, `${action}:${ref}`, action, rule.xp, playerId);
    }
    return finalizeDelta(ctx, levelBefore, gained);
  });
}

export function finalizeDelta(ctx: AppContext, levelBefore: number, gained: number, coins = 0): ProgressDelta {
  const levelAfter = levelForXp(currentXp(ctx));
  const delta: ProgressDelta = { xpGained: gained, coinsGained: coins, levelUp: null, achievementsUnlocked: [] };
  if (levelAfter > levelBefore) {
    delta.levelUp = levelAfter;
    notify(ctx, 'levelUp', { level: levelAfter }, '/progress');
    for (let level = levelBefore + 1; level <= levelAfter; level++) {
      delta.coinsGained! += grantCoins(ctx, `level:${level}`, COIN_REWARDS.levelUpPerLevel * level, `level:${level}`);
    }
  }
  delta.achievementsUnlocked = checkAchievements(ctx);
  delta.coinsGained! += delta.achievementsUnlocked.length * COIN_REWARDS.achievement;
  return delta;
}

function actionTotal(ctx: AppContext, action: string, distinct: boolean, day?: string): number {
  const col = distinct ? 'COUNT(DISTINCT ref)' : 'COUNT(*)';
  const row = day
    ? get<{ n: number }>(ctx.db, `SELECT ${col} AS n FROM activity_log WHERE action = ? AND day = ?`, action, day)
    : get<{ n: number }>(ctx.db, `SELECT ${col} AS n FROM activity_log WHERE action = ?`, action);
  return row?.n ?? 0;
}

function metricValue(ctx: AppContext, metric: QuestMetric | AchievementMetric, day?: string): number {
  switch (metric.type) {
    case 'action':
      return actionTotal(ctx, metric.action, false, day);
    case 'distinct':
      return actionTotal(ctx, metric.action, true, day);
    case 'level':
      return levelForXp(currentXp(ctx));
    case 'likesReceived':
      return (
        get<{ n: number }>(
          ctx.db,
          `SELECT COUNT(*) AS n FROM character_likes cl JOIN posts p ON p.id = cl.post_id WHERE p.author_type = 'user'`,
        )?.n ?? 0
      );
    case 'storylinesResolved':
      return get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM storylines WHERE status = 'resolved'`)?.n ?? 0;
  }
}

/** Prüft alle Erfolge und schaltet neu erreichte frei. */
export function checkAchievements(ctx: AppContext): string[] {
  const unlocked = new Set(all<{ id: string }>(ctx.db, 'SELECT id FROM achievements').map((r) => r.id));
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    if (metricValue(ctx, a.metric) >= a.target) {
      run(ctx.db, 'INSERT OR IGNORE INTO achievements (id, unlocked_at) VALUES (?, ?)', a.id, ctx.now().toISOString());
      grantCoins(ctx, `achievement:${a.id}`, COIN_REWARDS.achievement, `achievement:${a.id}`);
      notify(ctx, 'achievement', { id: a.id }, '/progress');
      fresh.push(a.id);
    }
  }
  return fresh;
}

function questPeriod(quest: QuestDef, day: string): string {
  return quest.kind === 'daily' ? day : 'once';
}

function questProgress(ctx: AppContext, quest: QuestDef, day: string): QuestProgressDto {
  const current = metricValue(ctx, quest.metric, quest.kind === 'daily' ? day : undefined);
  const claimed = Boolean(
    get(ctx.db, 'SELECT 1 FROM quest_claims WHERE quest_id = ? AND period = ?', quest.id, questPeriod(quest, day)),
  );
  return {
    id: quest.id,
    kind: quest.kind,
    target: quest.target,
    current: Math.min(current, quest.target),
    xp: quest.xp,
    coins: quest.coins ?? 0,
    completed: current >= quest.target,
    claimed,
  };
}

export function claimQuest(ctx: AppContext, questId: string): ProgressDelta {
  const day = dayKey(ctx.now());
  const quest = [...dailyQuestsFor(day), ...GENERAL_QUESTS].find((q) => q.id === questId);
  if (!quest) throw notFound('Quest');
  return tx(ctx.db, () => {
    const progress = questProgress(ctx, quest, day);
    if (progress.claimed) throw new AppError(409, 'already_claimed', 'Diese Belohnung wurde bereits eingelöst.');
    if (!progress.completed) throw new AppError(400, 'quest_incomplete', 'Die Quest ist noch nicht abgeschlossen.');
    const period = questPeriod(quest, day);
    run(
      ctx.db,
      'INSERT INTO quest_claims (quest_id, period, claimed_at) VALUES (?, ?, ?)',
      quest.id,
      period,
      ctx.now().toISOString(),
    );
    const levelBefore = levelForXp(currentXp(ctx));
    const gained = grantXp(ctx, `quest:${quest.id}:${period}`, 'quest', quest.xp);
    const coins = grantCoins(ctx, `quest:${quest.id}:${period}`, quest.coins ?? 0, `quest:${quest.id}`);
    return finalizeDelta(ctx, levelBefore, gained, coins);
  });
}

export function getProgress(ctx: AppContext): ProgressDto {
  const now = ctx.now();
  const day = dayKey(now);
  const xp = currentXp(ctx);
  const level = levelInfo(xp);
  const unlocked = new Map(
    all<{ id: string; unlocked_at: string }>(ctx.db, 'SELECT id, unlocked_at FROM achievements').map((r) => [
      r.id,
      r.unlocked_at,
    ]),
  );
  const todayXp =
    get<{ n: number | null }>(ctx.db, 'SELECT SUM(amount) AS n FROM xp_events WHERE day = ?', day)?.n ?? 0;

  const characters = all<{
    id: string;
    name: string;
    avatar_hue: number;
    avatar_glyph: string;
    first_at: string | null;
  }>(
    ctx.db,
    `SELECT c.id, c.name, c.avatar_hue, c.avatar_glyph, e.first_at
       FROM characters c LEFT JOIN encounters e ON e.character_id = c.id
      ORDER BY e.first_at IS NULL, e.first_at, c.name`,
  );
  const worlds = all<{ id: string; name: string; hue: number; art_style: string; first_at: string | null }>(
    ctx.db,
    `SELECT w.id, w.name, w.hue, w.art_style, v.first_at
       FROM worlds w LEFT JOIN world_visits v ON v.world_id = w.id
      ORDER BY v.first_at IS NULL, v.first_at, w.name`,
  );

  return {
    level,
    todayXp,
    daily: dailyQuestsFor(day).map((q) => questProgress(ctx, q, day)),
    general: GENERAL_QUESTS.map((q) => questProgress(ctx, q, day)),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      icon: a.icon,
      target: a.target,
      current: Math.min(metricValue(ctx, a.metric), a.target),
      unlockedAt: unlocked.get(a.id) ?? null,
    })),
    rewards: REWARDS.map((r) => ({
      id: r.id,
      type: r.type,
      unlock: r.unlock,
      unlocked: isRewardUnlocked(r.unlock, level.level, unlocked),
    })),
    collections: {
      characters: characters.map((c) => ({
        id: c.id,
        name: c.name,
        avatarHue: c.avatar_hue,
        avatarGlyph: c.avatar_glyph as never,
        metAt: c.first_at,
      })),
      worlds: worlds.map((w) => ({
        id: w.id,
        name: w.name,
        hue: w.hue,
        artStyle: w.art_style as never,
        visitedAt: w.first_at,
      })),
    },
    recentXp: all<{ action: string; amount: number; created_at: string }>(
      ctx.db,
      'SELECT action, amount, created_at FROM xp_events ORDER BY id DESC LIMIT 15',
    ).map((r) => ({ action: r.action, amount: r.amount, createdAt: r.created_at })),
  };
}

function isRewardUnlocked(
  unlock: (typeof REWARDS)[number]['unlock'],
  level: number,
  achievements: Map<string, string>,
): boolean {
  return unlock.type === 'level' ? level >= unlock.level : achievements.has(unlock.id);
}

export function rewardUnlocked(ctx: AppContext, rewardId: string): boolean {
  const reward = REWARDS.find((r) => r.id === rewardId);
  if (!reward) return false;
  const level = levelForXp(currentXp(ctx));
  const achievements = new Map(
    all<{ id: string; unlocked_at: string }>(ctx.db, 'SELECT id, unlocked_at FROM achievements').map((r) => [r.id, r.unlocked_at]),
  );
  return isRewardUnlocked(reward.unlock, level, achievements);
}

/** Erste Begegnung mit einem Charakter (Sammlung). */
export function recordEncounter(ctx: AppContext, characterId: string): ProgressDelta {
  const inserted = run(
    ctx.db,
    'INSERT OR IGNORE INTO encounters (character_id, first_at) VALUES (?, ?)',
    characterId,
    ctx.now().toISOString(),
  );
  if (inserted.changes === 0) return emptyDelta();
  return recordAction(ctx, 'meetCharacter', characterId);
}

/** Erster Besuch einer Welt (Sammlung). */
export function recordWorldVisit(ctx: AppContext, worldId: string): ProgressDelta {
  const inserted = run(
    ctx.db,
    'INSERT OR IGNORE INTO world_visits (world_id, first_at) VALUES (?, ?)',
    worldId,
    ctx.now().toISOString(),
  );
  if (inserted.changes === 0) return emptyDelta();
  return recordAction(ctx, 'visitWorld', worldId);
}
