import { WORLD_QUESTS, type WorldQuestDef, type WorldQuestMetric } from '../../../shared/worldQuests';
import { levelForXp } from '../../../shared/progress';
import type { ProgressDelta, WorldQuestProgressDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { get, run, tx } from '../db/database';
import { AppError, notFound } from '../lib/errors';
import { getPlayerRow, requireActivePlayer, type PlayerRow } from './players';
import { currentXp, finalizeDelta, grantXp } from './progress';
import { grantCoins } from './wallet';

function count(ctx: AppContext, sql: string, ...params: (string | number)[]): number {
  return get<{ n: number | null }>(ctx.db, sql, ...params)?.n ?? 0;
}

/** Misst den Stand einer Spielfigur – ausschließlich aus gespeicherten Daten. */
function metricValue(ctx: AppContext, p: PlayerRow, metric: WorldQuestMetric): number {
  switch (metric) {
    case 'decisions':
      return count(ctx, `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'resolved'`, p.id);
    case 'posts':
      return count(ctx, `SELECT COUNT(*) AS n FROM posts WHERE player_id = ? AND repost_of IS NULL`, p.id);
    case 'chatPartners':
      return count(
        ctx,
        `SELECT COUNT(DISTINCT cv.character_id) AS n FROM conversations cv
          WHERE cv.player_id = ? AND EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id = cv.id AND m.role = 'user')`,
        p.id,
      );
    case 'bestAffinity':
      return Math.max(
        0,
        count(ctx, 'SELECT MAX(affinity) AS n FROM relationships WHERE a_id = ? OR b_id = ?', p.character_id, p.character_id),
      );
    case 'reputation':
      return Math.max(0, p.reputation);
    case 'storyChapters':
      return count(
        ctx,
        `SELECT COUNT(*) AS n FROM world_events WHERE world_id = ? AND kind IN ('storyline', 'storyline-resolved') AND created_at >= ?`,
        p.world_id,
        p.joined_at,
      );
    case 'events':
      return count(
        ctx,
        `SELECT COUNT(*) AS n FROM world_events WHERE world_id = ? AND kind LIKE 'card-%' AND created_at >= ?`,
        p.world_id,
        p.joined_at,
      );
  }
}

function progressOf(ctx: AppContext, p: PlayerRow, q: WorldQuestDef): WorldQuestProgressDto {
  const current = metricValue(ctx, p, q.metric);
  const claimed = Boolean(get(ctx.db, 'SELECT 1 FROM quest_claims WHERE quest_id = ? AND period = ?', q.id, p.id));
  return {
    id: q.id,
    metric: q.metric,
    target: q.target,
    current: Math.min(current, q.target),
    xp: q.xp,
    coins: q.coins,
    completed: current >= q.target,
    claimed,
  };
}

/** Aufgaben der aktiven Spielfigur einer Welt. */
export function listWorldQuests(ctx: AppContext, worldId: string): WorldQuestProgressDto[] {
  const player = requireActivePlayer(ctx, worldId);
  return WORLD_QUESTS.map((q) => progressOf(ctx, player, q));
}

/** Löst eine Weltaufgabe ein – pro Spielfigur genau einmal. */
export function claimWorldQuest(ctx: AppContext, questId: string, worldId: string): ProgressDelta {
  const quest = WORLD_QUESTS.find((q) => q.id === questId);
  if (!quest) throw notFound('Aufgabe');
  const player = requireActivePlayer(ctx, worldId);
  return tx(ctx.db, () => {
    const state = progressOf(ctx, getPlayerRow(ctx, player.id), quest);
    if (state.claimed) throw new AppError(409, 'already_claimed', 'Diese Belohnung wurde bereits eingelöst.');
    if (!state.completed) throw new AppError(400, 'quest_incomplete', 'Die Aufgabe ist noch nicht abgeschlossen.');
    run(ctx.db, 'INSERT INTO quest_claims (quest_id, period, claimed_at) VALUES (?, ?, ?)', quest.id, player.id, ctx.now().toISOString());
    const levelBefore = levelForXp(currentXp(ctx));
    const gained = grantXp(ctx, `wq:${quest.id}:${player.id}`, 'quest', quest.xp, player.id);
    const coins = grantCoins(ctx, `wq:${quest.id}:${player.id}`, quest.coins, `quest:${quest.id}`);
    return finalizeDelta(ctx, levelBefore, gained, coins);
  });
}
