import { z } from 'zod';
import { LIMITS } from '../../../shared/constants';
import type { CommentDto, FeedPage, PostDetailDto, PostDto, ProgressDelta, TrendingTag } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText, extractTags } from '../lib/text';
import { addHours } from '../lib/time';
import { scheduleJob } from './jobs';
import {
  AUTHOR_COLUMNS,
  PLAYER_AUTHOR_COLUMNS,
  characterAuthor,
  getProfileRow,
  userAuthor,
  type PlayerAuthorColumns,
  type ProfileRow,
} from './mappers';
import { activeWorldId, requireActivePlayer } from './players';
import { emptyDelta, recordAction } from './progress';
import { getSettings } from './settings';

interface PostRow {
  id: string;
  author_type: 'user' | 'character';
  character_id: string | null;
  world_id: string | null;
  content: string;
  repost_of: string | null;
  repost_of_deleted: number;
  event_id: string | null;
  source: PostDto['source'];
  created_at: string;
  edited_at: string | null;
  world_name: string | null;
  world_hue: number | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  liked_by_me: number;
  bookmarked_by_me: number;
  reposted_by_me: number;
  c_id: string | null;
  c_name: string | null;
  c_handle: string | null;
  c_hue: number | null;
  c_glyph: string | null;
  c_real: number | null;
  c_world: string | null;
  c_prominent: number | null;
  player_id: string | null;
}

type PostRowFull = PostRow & PlayerAuthorColumns;

const POST_SELECT = `
  SELECT p.*, w.name AS world_name, w.hue AS world_hue, ${AUTHOR_COLUMNS}, ${PLAYER_AUTHOR_COLUMNS},
    (SELECT COUNT(*) FROM character_likes cl WHERE cl.post_id = p.id)
      + (SELECT COUNT(*) FROM user_likes ul WHERE ul.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count,
    (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) AS repost_count,
    EXISTS (SELECT 1 FROM user_likes ul WHERE ul.post_id = p.id) AS liked_by_me,
    EXISTS (SELECT 1 FROM bookmarks b WHERE b.post_id = p.id) AS bookmarked_by_me,
    EXISTS (SELECT 1 FROM posts rp WHERE rp.repost_of = p.id AND rp.author_type = 'user') AS reposted_by_me
  FROM posts p
  LEFT JOIN characters c ON c.id = p.character_id
  LEFT JOIN players pl ON pl.id = p.player_id
  LEFT JOIN characters pc ON pc.id = pl.character_id
  LEFT JOIN worlds w ON w.id = p.world_id`;

function tagsFor(ctx: AppContext, postId: string): string[] {
  return all<{ tag: string }>(ctx.db, 'SELECT tag FROM post_tags WHERE post_id = ? ORDER BY tag', postId).map((r) => r.tag);
}

function toPost(ctx: AppContext, row: PostRowFull, profile: ProfileRow, depth = 0): PostDto {
  let repostOf: PostDto | null = null;
  if (row.repost_of && depth === 0) {
    const original = get<PostRowFull>(ctx.db, `${POST_SELECT} WHERE p.id = ?`, row.repost_of);
    if (original) repostOf = toPost(ctx, original, profile, depth + 1);
  }
  return {
    id: row.id,
    author: row.author_type === 'user' ? userAuthor(profile, row) : characterAuthor(row),
    worldId: row.world_id,
    worldName: row.world_name,
    worldHue: row.world_hue,
    content: row.content,
    tags: tagsFor(ctx, row.id),
    createdAt: row.created_at,
    editedAt: row.edited_at,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    repostCount: row.repost_count,
    likedByMe: Boolean(row.liked_by_me),
    bookmarkedByMe: Boolean(row.bookmarked_by_me),
    repostedByMe: Boolean(row.reposted_by_me),
    repostOf,
    repostOfDeleted: Boolean(row.repost_of_deleted),
    source: row.source,
    eventId: row.event_id,
    isOwn: row.author_type === 'user',
  };
}

export interface FeedFilters {
  worldId?: string;
  characterId?: string;
  tag?: string;
  author?: 'user';
  playerId?: string;
  bookmarked?: boolean;
  cursor?: string;
  limit?: number;
}

export function listPosts(ctx: AppContext, filters: FeedFilters = {}): FeedPage {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filters.worldId) {
    where.push('p.world_id = ?');
    params.push(filters.worldId);
  }
  if (filters.characterId) {
    where.push('p.character_id = ?');
    params.push(filters.characterId);
  }
  if (filters.tag) {
    where.push('EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag = ?)');
    params.push(filters.tag.toLowerCase().replace(/^#/, ''));
  }
  if (filters.author === 'user') where.push(`p.author_type = 'user'`);
  if (filters.playerId) {
    where.push('p.player_id = ?');
    params.push(filters.playerId);
  }
  if (filters.bookmarked) where.push('EXISTS (SELECT 1 FROM bookmarks b WHERE b.post_id = p.id)');
  if (filters.cursor) {
    const [createdAt, id] = filters.cursor.split('|');
    if (createdAt && id) {
      where.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))');
      params.push(createdAt, createdAt, id);
    }
  }
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const rows = all<PostRowFull>(
    ctx.db,
    `${POST_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    ...params,
    limit + 1,
  );
  const profile = getProfileRow(ctx);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => toPost(ctx, r, profile)),
    nextCursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null,
  };
}

export function getPost(ctx: AppContext, id: string): PostDto {
  const row = get<PostRowFull>(ctx.db, `${POST_SELECT} WHERE p.id = ?`, id);
  if (!row) throw notFound('Beitrag');
  return toPost(ctx, row, getProfileRow(ctx));
}

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_type: 'user' | 'character';
  content: string;
  source: CommentDto['source'];
  created_at: string;
  c_id: string | null;
  c_name: string | null;
  c_handle: string | null;
  c_hue: number | null;
  c_glyph: string | null;
  c_real: number | null;
  c_world: string | null;
  c_prominent: number | null;
}

export function getPostDetail(ctx: AppContext, id: string): PostDetailDto {
  const post = getPost(ctx, id);
  const profile = getProfileRow(ctx);
  const rows = all<CommentRow & PlayerAuthorColumns>(
    ctx.db,
    `SELECT cm.*, ${AUTHOR_COLUMNS}, ${PLAYER_AUTHOR_COLUMNS} FROM comments cm
      LEFT JOIN characters c ON c.id = cm.character_id
      LEFT JOIN players pl ON pl.id = cm.player_id
      LEFT JOIN characters pc ON pc.id = pl.character_id
      WHERE cm.post_id = ? ORDER BY cm.created_at, cm.id`,
    id,
  );
  const byId = new Map<string, CommentDto>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      postId: r.post_id,
      parentId: r.parent_id,
      author: r.author_type === 'user' ? userAuthor(profile, r) : characterAuthor(r),
      content: r.content,
      createdAt: r.created_at,
      source: r.source,
      isOwn: r.author_type === 'user',
      replies: [],
    });
  }
  // Zweiter Durchlauf: unabhängig von der Sortierung korrekt verschachteln.
  const roots: CommentDto[] = [];
  for (const dto of byId.values()) {
    const parent = dto.parentId ? byId.get(dto.parentId) : undefined;
    if (parent) parent.replies.push(dto);
    else roots.push(dto);
  }
  return { post, comments: roots };
}

const postInputSchema = z.object({
  content: z.string().max(LIMITS.postContent * 2),
  worldId: z.string().max(80).nullable().optional(),
});

function validateContent(raw: string, max: number, code = 'invalid_content'): string {
  const content = cleanText(raw);
  if (!content) throw badRequest(code, 'Der Text darf nicht leer sein.');
  if (content.length > max) throw badRequest(code, `Der Text darf höchstens ${max} Zeichen lang sein.`);
  return content;
}

function writeTags(ctx: AppContext, postId: string, content: string): void {
  run(ctx.db, 'DELETE FROM post_tags WHERE post_id = ?', postId);
  for (const tag of extractTags(content)) {
    run(ctx.db, 'INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)', postId, tag);
  }
}

export function createPost(ctx: AppContext, input: unknown): { post: PostDto; progress: ProgressDelta } {
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_post', 'Ungültiger Beitrag.', parsed.error.issues);
  const content = validateContent(parsed.data.content, LIMITS.postContent);
  // Beiträge entstehen immer in einer Welt – als die dort aktive Spielfigur.
  const worldId = parsed.data.worldId || activeWorldId(ctx);
  if (!worldId) throw new AppError(409, 'not_joined', 'Tritt zuerst einer Welt bei, um zu posten.');
  if (!get(ctx.db, 'SELECT 1 FROM worlds WHERE id = ?', worldId)) throw notFound('Welt');
  const player = requireActivePlayer(ctx, worldId);
  const id = newId('p');
  const progress = tx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO posts (id, author_type, character_id, world_id, player_id, content, source, created_at)
       VALUES (?, 'user', NULL, ?, ?, ?, 'user', ?)`,
      id,
      worldId,
      player.id,
      content,
      ctx.now().toISOString(),
    );
    run(ctx.db, 'UPDATE players SET last_active_at = ? WHERE id = ?', ctx.now().toISOString(), player.id);
    writeTags(ctx, id, content);
    if (getSettings(ctx.db).simulation.reactionsEnabled) {
      scheduleJob(ctx, 'reactToPost', { postId: id }, 8 + Math.floor(Math.random() * 20));
    }
    return recordAction(ctx, 'post', id, player.id);
  });
  return { post: getPost(ctx, id), progress };
}

function requireOwnPost(ctx: AppContext, id: string): void {
  const row = get<{ author_type: string }>(ctx.db, 'SELECT author_type FROM posts WHERE id = ?', id);
  if (!row) throw notFound('Beitrag');
  if (row.author_type !== 'user') throw forbidden('Nur eigene Beiträge können bearbeitet oder gelöscht werden.');
}

export function updatePost(ctx: AppContext, id: string, input: unknown): PostDto {
  requireOwnPost(ctx, id);
  const parsed = z.object({ content: z.string().max(LIMITS.postContent * 2) }).safeParse(input);
  if (!parsed.success) throw badRequest('invalid_post', 'Ungültiger Beitrag.', parsed.error.issues);
  const row = get<{ repost_of: string | null }>(ctx.db, 'SELECT repost_of FROM posts WHERE id = ?', id);
  const content = row?.repost_of ? cleanText(parsed.data.content) : validateContent(parsed.data.content, LIMITS.postContent);
  if (content.length > LIMITS.postContent) throw badRequest('invalid_content', 'Der Text ist zu lang.');
  tx(ctx.db, () => {
    run(ctx.db, 'UPDATE posts SET content = ?, edited_at = ? WHERE id = ?', content, ctx.now().toISOString(), id);
    writeTags(ctx, id, content);
  });
  return getPost(ctx, id);
}

export function deletePost(ctx: AppContext, id: string): void {
  requireOwnPost(ctx, id);
  tx(ctx.db, () => {
    run(ctx.db, 'UPDATE posts SET repost_of_deleted = 1 WHERE repost_of = ?', id);
    run(ctx.db, 'DELETE FROM posts WHERE id = ?', id);
  });
}

function requirePost(ctx: AppContext, id: string): { author_type: string; repost_of: string | null } {
  const row = get<{ author_type: string; repost_of: string | null }>(
    ctx.db,
    'SELECT author_type, repost_of FROM posts WHERE id = ?',
    id,
  );
  if (!row) throw notFound('Beitrag');
  return row;
}

export function setLike(ctx: AppContext, id: string, liked: boolean): { post: PostDto; progress: ProgressDelta } {
  const post = requirePost(ctx, id);
  const progress = tx(ctx.db, () => {
    if (!liked) {
      run(ctx.db, 'DELETE FROM user_likes WHERE post_id = ?', id);
      return emptyDelta();
    }
    const inserted = run(
      ctx.db,
      'INSERT OR IGNORE INTO user_likes (post_id, created_at) VALUES (?, ?)',
      id,
      ctx.now().toISOString(),
    );
    // Eigene Beiträge liken bringt keine XP.
    return inserted.changes > 0 && post.author_type !== 'user' ? recordAction(ctx, 'like', id) : emptyDelta();
  });
  return { post: getPost(ctx, id), progress };
}

export function setBookmark(ctx: AppContext, id: string, saved: boolean): { post: PostDto; progress: ProgressDelta } {
  requirePost(ctx, id);
  const progress = tx(ctx.db, () => {
    if (!saved) {
      run(ctx.db, 'DELETE FROM bookmarks WHERE post_id = ?', id);
      return emptyDelta();
    }
    const inserted = run(
      ctx.db,
      'INSERT OR IGNORE INTO bookmarks (post_id, created_at) VALUES (?, ?)',
      id,
      ctx.now().toISOString(),
    );
    return inserted.changes > 0 ? recordAction(ctx, 'bookmark', id) : emptyDelta();
  });
  return { post: getPost(ctx, id), progress };
}

export function repost(ctx: AppContext, id: string, input: unknown): { post: PostDto; progress: ProgressDelta } {
  const target = requirePost(ctx, id);
  const originalId = target.repost_of ?? id;
  requirePost(ctx, originalId);
  const parsed = z.object({ content: z.string().max(LIMITS.postContent * 2).optional() }).safeParse(input ?? {});
  if (!parsed.success) throw badRequest('invalid_post', 'Ungültiger Repost.', parsed.error.issues);
  const content = cleanText(parsed.data.content ?? '');
  if (content.length > LIMITS.postContent) throw badRequest('invalid_content', 'Der Text ist zu lang.');
  const existing = get(ctx.db, `SELECT 1 FROM posts WHERE repost_of = ? AND author_type = 'user'`, originalId);
  if (existing) throw new AppError(409, 'already_reposted', 'Du hast diesen Beitrag bereits geteilt.');
  const newPostId = newId('p');
  const world = get<{ world_id: string | null }>(ctx.db, 'SELECT world_id FROM posts WHERE id = ?', originalId);
  const player = world?.world_id ? requireActivePlayer(ctx, world.world_id) : null;
  const progress = tx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO posts (id, author_type, world_id, player_id, content, repost_of, source, created_at)
       VALUES (?, 'user', ?, ?, ?, ?, 'user', ?)`,
      newPostId,
      world?.world_id ?? null,
      player?.id ?? null,
      content,
      originalId,
      ctx.now().toISOString(),
    );
    writeTags(ctx, newPostId, content);
    return recordAction(ctx, 'repost', originalId, player?.id);
  });
  return { post: getPost(ctx, newPostId), progress };
}

export function undoRepost(ctx: AppContext, id: string): void {
  const target = requirePost(ctx, id);
  const originalId = target.repost_of ?? id;
  run(ctx.db, `DELETE FROM posts WHERE repost_of = ? AND author_type = 'user'`, originalId);
}

const commentSchema = z.object({
  content: z.string().max(LIMITS.commentContent * 2),
  parentId: z.string().max(80).nullable().optional(),
});

export function addComment(
  ctx: AppContext,
  postId: string,
  input: unknown,
): { comment: CommentDto; progress: ProgressDelta } {
  const post = requirePost(ctx, postId);
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_comment', 'Ungültiger Kommentar.', parsed.error.issues);
  const content = validateContent(parsed.data.content, LIMITS.commentContent);
  let parentId = parsed.data.parentId || null;
  if (parentId) {
    const parent = get<{ post_id: string; parent_id: string | null }>(
      ctx.db,
      'SELECT post_id, parent_id FROM comments WHERE id = ?',
      parentId,
    );
    if (!parent || parent.post_id !== postId) throw notFound('Kommentar');
    // Antworten werden in einem flachen Thread unter dem obersten Kommentar gesammelt.
    parentId = parent.parent_id ?? parentId;
  }
  const world = get<{ world_id: string | null }>(ctx.db, 'SELECT world_id FROM posts WHERE id = ?', postId);
  const player = world?.world_id ? requireActivePlayer(ctx, world.world_id) : null;
  const id = newId('cm');
  const progress = tx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO comments (id, post_id, parent_id, author_type, character_id, player_id, content, source, created_at)
       VALUES (?, ?, ?, 'user', NULL, ?, ?, 'user', ?)`,
      id,
      postId,
      parentId,
      player?.id ?? null,
      content,
      ctx.now().toISOString(),
    );
    if (post.author_type === 'character' && getSettings(ctx.db).simulation.reactionsEnabled) {
      scheduleJob(ctx, 'replyToComment', { postId, commentId: id }, 10 + Math.floor(Math.random() * 25));
    }
    return recordAction(ctx, 'comment', id, player?.id);
  });
  const comment = findComment(getPostDetail(ctx, postId).comments, id);
  if (!comment) throw notFound('Kommentar');
  return { comment, progress };
}

function findComment(list: CommentDto[], id: string): CommentDto | undefined {
  for (const c of list) {
    if (c.id === id) return c;
    const nested = findComment(c.replies, id);
    if (nested) return nested;
  }
  return undefined;
}

export function deleteComment(ctx: AppContext, id: string): void {
  const row = get<{ author_type: string }>(ctx.db, 'SELECT author_type FROM comments WHERE id = ?', id);
  if (!row) throw notFound('Kommentar');
  if (row.author_type !== 'user') throw forbidden('Nur eigene Kommentare können gelöscht werden.');
  run(ctx.db, 'DELETE FROM comments WHERE id = ?', id);
}

export function trendingTags(ctx: AppContext, limit = 10, sinceHours = 24 * 7): TrendingTag[] {
  return all<TrendingTag>(
    ctx.db,
    `SELECT t.tag AS tag, COUNT(*) AS count FROM post_tags t JOIN posts p ON p.id = t.post_id
      WHERE p.created_at >= ? GROUP BY t.tag ORDER BY count DESC, t.tag LIMIT ?`,
    addHours(ctx.now(), -sinceHours).toISOString(),
    limit,
  );
}

/** Interner Helfer für Simulation und Reaktionen: Beitrag eines Charakters anlegen. */
export function insertCharacterPost(
  ctx: AppContext,
  opts: { characterId: string; worldId: string | null; content: string; source: PostDto['source']; eventId?: string | null; createdAt?: Date },
): string {
  const id = newId('p');
  const content = cleanText(opts.content).slice(0, LIMITS.postContent);
  run(
    ctx.db,
    `INSERT INTO posts (id, author_type, character_id, world_id, content, event_id, source, created_at)
     VALUES (?, 'character', ?, ?, ?, ?, ?, ?)`,
    id,
    opts.characterId,
    opts.worldId,
    content,
    opts.eventId ?? null,
    opts.source,
    (opts.createdAt ?? ctx.now()).toISOString(),
  );
  writeTags(ctx, id, content);
  return id;
}

export function insertCharacterComment(
  ctx: AppContext,
  opts: { postId: string; parentId: string | null; characterId: string; content: string; source: CommentDto['source'] },
): string {
  const id = newId('cm');
  run(
    ctx.db,
    `INSERT INTO comments (id, post_id, parent_id, author_type, character_id, content, source, created_at)
     VALUES (?, ?, ?, 'character', ?, ?, ?, ?)`,
    id,
    opts.postId,
    opts.parentId,
    opts.characterId,
    cleanText(opts.content).slice(0, LIMITS.commentContent),
    opts.source,
    ctx.now().toISOString(),
  );
  return id;
}

export function addCharacterLike(ctx: AppContext, postId: string, characterId: string): boolean {
  return (
    run(
      ctx.db,
      'INSERT OR IGNORE INTO character_likes (post_id, character_id, created_at) VALUES (?, ?, ?)',
      postId,
      characterId,
      ctx.now().toISOString(),
    ).changes > 0
  );
}
