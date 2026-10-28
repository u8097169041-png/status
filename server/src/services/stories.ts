import { z } from 'zod';
import { LIMITS, STORY_LIFETIME_HOURS, STORY_STYLES } from '../../../shared/constants';
import type { ProgressDelta, StoryDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText } from '../lib/text';
import { addHours } from '../lib/time';
import { AUTHOR_COLUMNS, PLAYER_AUTHOR_COLUMNS, characterAuthor, getProfileRow, userAuthor, type PlayerAuthorColumns } from './mappers';
import { SKILL_RULES } from '../../../shared/skills';
import { activeWorldId, adjustPlayerStats, requireActivePlayer } from './players';
import { skillLevel } from './skills';
import { recordAction } from './progress';

/** Entfernt abgelaufene Stories dauerhaft. */
export function purgeExpiredStories(ctx: AppContext): number {
  return run(ctx.db, 'DELETE FROM stories WHERE expires_at <= ?', ctx.now().toISOString()).changes;
}

/** Stories einer Welt – nur sichtbar, wenn der Nutzer dort mit einer Spielfigur mitspielt. */
export function listStories(ctx: AppContext, worldId: string): StoryDto[] {
  requireActivePlayer(ctx, worldId);
  purgeExpiredStories(ctx);
  const profile = getProfileRow(ctx);
  const rows = all<{
    id: string;
    author_type: 'user' | 'character';
    world_id: string | null;
    content: string;
    style: number;
    created_at: string;
    expires_at: string;
    seen: number;
    c_id: string | null;
    c_name: string | null;
    c_handle: string | null;
    c_hue: number | null;
    c_glyph: string | null;
    c_real: number | null;
    c_world: string | null;
    c_prominent: number | null;
  } & PlayerAuthorColumns>(
    ctx.db,
    `SELECT s.*, ${AUTHOR_COLUMNS}, ${PLAYER_AUTHOR_COLUMNS}, EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.id) AS seen
       FROM stories s LEFT JOIN characters c ON c.id = s.character_id
       LEFT JOIN players pl ON pl.id = s.player_id
       LEFT JOIN characters pc ON pc.id = pl.character_id
      WHERE s.expires_at > ? AND s.world_id = ? ORDER BY s.created_at DESC`,
    ctx.now().toISOString(),
    worldId,
  );
  return rows.map((r) => ({
    id: r.id,
    author: r.author_type === 'user' ? userAuthor(profile, r) : characterAuthor(r),
    worldId: r.world_id,
    content: r.content,
    style: r.style,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    seen: Boolean(r.seen) || r.author_type === 'user',
    isOwn: r.author_type === 'user',
  }));
}

const storySchema = z.object({
  content: z.string().max(LIMITS.storyContent * 2),
  style: z.number().int().min(0).max(STORY_STYLES - 1).optional(),
  worldId: z.string().max(80).optional(),
});

export function createStory(ctx: AppContext, input: unknown): { story: StoryDto; progress: ProgressDelta } {
  const parsed = storySchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_story', 'Ungültige Story.', parsed.error.issues);
  const content = cleanText(parsed.data.content);
  if (!content) throw badRequest('invalid_content', 'Der Text darf nicht leer sein.');
  if (content.length > LIMITS.storyContent) throw badRequest('invalid_content', 'Der Text ist zu lang.');
  const worldId = parsed.data.worldId || activeWorldId(ctx);
  if (!worldId) throw new AppError(409, 'not_joined', 'Tritt zuerst einer Welt bei, um Stories zu teilen.');
  const player = requireActivePlayer(ctx, worldId);
  const id = newId('st');
  const now = ctx.now();
  const progress = tx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO stories (id, author_type, character_id, world_id, player_id, content, style, created_at, expires_at)
       VALUES (?, 'user', NULL, ?, ?, ?, ?, ?, ?)`,
      id,
      worldId,
      player.id,
      content,
      parsed.data.style ?? 0,
      now.toISOString(),
      addHours(now, STORY_LIFETIME_HOURS).toISOString(),
    );
    // Für Quests zählen auch Stories, die später ablaufen und gelöscht werden.
    run(
      ctx.db,
      `INSERT OR IGNORE INTO action_uses (player_id, action, ref, day, created_at) VALUES (?, 'story', ?, 'once', ?)`,
      player.id,
      id,
      now.toISOString(),
    );
    // Medienkompetenz 3: Stories bringen zusätzliche Follower.
    if (skillLevel(ctx, player.id, 'media') >= 3) adjustPlayerStats(ctx, player.id, { followers: SKILL_RULES.storyFollowers });
    return recordAction(ctx, 'story', id, player.id);
  });
  const story = listStories(ctx, worldId).find((s) => s.id === id);
  if (!story) throw notFound('Story');
  return { story, progress };
}

export function markStorySeen(ctx: AppContext, id: string): void {
  if (!get(ctx.db, 'SELECT 1 FROM stories WHERE id = ?', id)) throw notFound('Story');
  run(ctx.db, 'INSERT OR IGNORE INTO story_views (story_id, viewed_at) VALUES (?, ?)', id, ctx.now().toISOString());
}

export function deleteStory(ctx: AppContext, id: string): void {
  const row = get<{ author_type: string }>(ctx.db, 'SELECT author_type FROM stories WHERE id = ?', id);
  if (!row) throw notFound('Story');
  if (row.author_type !== 'user') throw forbidden('Nur eigene Stories können gelöscht werden.');
  run(ctx.db, 'DELETE FROM stories WHERE id = ?', id);
}

export function insertCharacterStory(
  ctx: AppContext,
  opts: { characterId: string; worldId: string | null; content: string; style: number },
): void {
  const now = ctx.now();
  run(
    ctx.db,
    `INSERT INTO stories (id, author_type, character_id, world_id, content, style, created_at, expires_at)
     VALUES (?, 'character', ?, ?, ?, ?, ?, ?)`,
    newId('st'),
    opts.characterId,
    opts.worldId,
    cleanText(opts.content).slice(0, LIMITS.storyContent),
    opts.style % STORY_STYLES,
    now.toISOString(),
    addHours(now, STORY_LIFETIME_HOURS).toISOString(),
  );
}
