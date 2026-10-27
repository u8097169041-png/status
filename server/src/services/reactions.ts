import type { WritingStyle } from '../../../shared/constants';
import { characterSystemPrompt } from '../ai/prompts';
import type { AppContext } from '../context';
import { all, get, parseJson, tx } from '../db/database';
import { COMMENT_REPLIES, POST_REACTIONS, QUESTION_REPLY } from '../content/voiceTemplates';
import { createRng } from '../lib/rng';
import { cleanText, fill, truncate } from '../lib/text';
import { loadPromptCharacter } from './characterContext';
import type { DueJob } from './jobs';
import { getProfileRow } from './mappers';
import { notify } from './notifications';
import { addCharacterLike, insertCharacterComment } from './posts';
import { checkAchievements } from './progress';
import { getSettings } from './settings';

interface ReactorRow {
  id: string;
  name: string;
  handle: string;
  world_id: string | null;
  writing_style: WritingStyle;
  interests: string;
}

async function aiComment(ctx: AppContext, characterId: string, instruction: string): Promise<string | null> {
  const settings = getSettings(ctx.db);
  if (!settings.ai.reactionsEnabled || !ctx.ai.canUseWorldAi()) return null;
  const { character, world } = loadPromptCharacter(ctx, characterId);
  const result = await ctx.ai.complete({
    purpose: 'reaction',
    kind: 'world',
    maxTokens: 120,
    messages: [
      { role: 'system', content: characterSystemPrompt(character, world, settings.language, { mode: 'comment' }) },
      { role: 'user', content: instruction },
    ],
  });
  return result.ok ? truncate(cleanText(result.text), 400) : null;
}

/** Charaktere reagieren mit Likes und einem Kommentar auf einen Nutzerbeitrag. */
async function reactToPost(ctx: AppContext, postId: string): Promise<void> {
  const post = get<{ id: string; content: string; world_id: string | null; author_type: string }>(
    ctx.db,
    'SELECT id, content, world_id, author_type FROM posts WHERE id = ?',
    postId,
  );
  if (!post || post.author_type !== 'user') return;
  const lang = getSettings(ctx.db).language;
  const tags = all<{ tag: string }>(ctx.db, 'SELECT tag FROM post_tags WHERE post_id = ?', postId).map((r) => r.tag);
  const candidates = all<ReactorRow>(
    ctx.db,
    'SELECT id, name, handle, world_id, writing_style, interests FROM characters ORDER BY id',
  );
  if (candidates.length === 0) return;
  const rng = createRng(`react:${postId}`);
  const text = post.content.toLowerCase();
  const scored = candidates.map((c) => {
    let score = rng.next();
    if (post.world_id && c.world_id === post.world_id) score += 2;
    if (text.includes(`@${c.handle.toLowerCase()}`)) score += 5;
    for (const interest of parseJson<string[]>(c.interests, [])) {
      if (interest.length > 3 && text.includes(interest.toLowerCase())) score += 1;
    }
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const likers = scored.slice(0, rng.int(1, 3)).map((s) => s.c);
  const commenter = scored[0].c;
  const user = getProfileRow(ctx);

  let comment = await aiComment(
    ctx,
    commenter.id,
    `The user @${user.handle} posted: """${truncate(post.content, 500)}""". Write a short, friendly comment (max 200 characters) in character.`,
  );
  const source = comment ? 'ai' : 'sim';
  if (!comment) {
    const interests = parseJson<string[]>(commenter.interests, []);
    comment = fill(rng.pick(POST_REACTIONS[commenter.writing_style] ?? POST_REACTIONS.casual)[lang], {
      user: user.handle,
      tag: tags[0] ?? 'socialverse',
      interest: interests.length ? rng.pick(interests) : lang === 'de' ? 'das Leben' : 'life',
    });
  }
  tx(ctx.db, () => {
    for (const liker of likers) addCharacterLike(ctx, postId, liker.id);
    insertCharacterComment(ctx, { postId, parentId: null, characterId: commenter.id, content: comment, source });
    notify(ctx, 'postReaction', { names: likers.map((l) => l.name).join(', '), count: likers.length }, `/posts/${postId}`);
    notify(ctx, 'postComment', { name: commenter.name }, `/posts/${postId}`);
    checkAchievements(ctx);
  });
}

/** Der Autor eines Charakterbeitrags antwortet auf den Kommentar des Nutzers. */
async function replyToComment(ctx: AppContext, postId: string, commentId: string): Promise<void> {
  const row = get<{ character_id: string | null; content: string; comment: string; parent_id: string | null }>(
    ctx.db,
    `SELECT p.character_id, p.content, cm.content AS comment, cm.parent_id FROM posts p JOIN comments cm ON cm.post_id = p.id
      WHERE p.id = ? AND cm.id = ? AND cm.author_type = 'user'`,
    postId,
    commentId,
  );
  if (!row?.character_id) return;
  const character = get<ReactorRow>(
    ctx.db,
    'SELECT id, name, handle, world_id, writing_style, interests FROM characters WHERE id = ?',
    row.character_id,
  );
  if (!character) return;
  const lang = getSettings(ctx.db).language;
  const user = getProfileRow(ctx);
  const rng = createRng(`reply:${commentId}`);
  let reply = await aiComment(
    ctx,
    character.id,
    `You posted: """${truncate(row.content, 300)}""". The user @${user.handle} commented: """${truncate(row.comment, 400)}""". ` +
      `Reply briefly (max 200 characters), starting with @${user.handle}.`,
  );
  const source = reply ? 'ai' : 'sim';
  if (!reply) {
    reply = fill(rng.pick(COMMENT_REPLIES[character.writing_style] ?? COMMENT_REPLIES.casual)[lang], { user: user.handle });
    if (row.comment.trim().endsWith('?')) reply += ` ${QUESTION_REPLY[lang]}`;
  }
  tx(ctx.db, () => {
    insertCharacterComment(ctx, {
      postId,
      parentId: row.parent_id ?? commentId,
      characterId: character.id,
      content: reply,
      source,
    });
    notify(ctx, 'commentReply', { name: character.name }, `/posts/${postId}`);
  });
}

export async function runJob(ctx: AppContext, job: DueJob): Promise<void> {
  const payload = parseJson<Record<string, string>>(job.payload, {});
  if (job.kind === 'reactToPost' && payload.postId) await reactToPost(ctx, payload.postId);
  else if (job.kind === 'replyToComment' && payload.postId && payload.commentId) {
    await replyToComment(ctx, payload.postId, payload.commentId);
  }
}
