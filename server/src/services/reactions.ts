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
import { adjustPlayerStats, controlledCharacterIds } from './players';
import { evaluateQuests } from './quests';
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

/** Handle, unter dem der Nutzer auftritt: die Spielfigur des Inhalts oder das lokale Profil. */
function actorHandle(ctx: AppContext, playerId: string | null): string {
  if (playerId) {
    const handle = get<{ handle: string }>(
      ctx.db,
      'SELECT c.handle FROM players pl JOIN characters c ON c.id = pl.character_id WHERE pl.id = ?',
      playerId,
    )?.handle;
    if (handle) return handle;
  }
  return getProfileRow(ctx).handle;
}

/** Figuren derselben Welt reagieren mit Likes und einem Kommentar auf einen Beitrag der Spielfigur. */
async function reactToPost(ctx: AppContext, postId: string, boost = 0): Promise<void> {
  const post = get<{ id: string; content: string; world_id: string | null; author_type: string; player_id: string | null }>(
    ctx.db,
    'SELECT id, content, world_id, author_type, player_id FROM posts WHERE id = ?',
    postId,
  );
  if (!post || post.author_type !== 'user') return;
  const lang = getSettings(ctx.db).language;
  const tags = all<{ tag: string }>(ctx.db, 'SELECT tag FROM post_tags WHERE post_id = ?', postId).map((r) => r.tag);
  // Beiträge in einer Welt sehen nur die Figuren dieser Welt; gespielte Figuren reagieren nicht automatisch.
  const controlled = post.world_id ? controlledCharacterIds(ctx, post.world_id) : new Set<string>();
  const candidates = (
    post.world_id
      ? all<ReactorRow>(ctx.db, 'SELECT id, name, handle, world_id, writing_style, interests FROM characters WHERE world_id = ? ORDER BY id', post.world_id)
      : all<ReactorRow>(ctx.db, 'SELECT id, name, handle, world_id, writing_style, interests FROM characters WHERE is_player = 0 ORDER BY id')
  ).filter((c) => !controlled.has(c.id));
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
  // Medienkompetenz und Statements bringen zusätzliche Reaktionen.
  const likers = scored.slice(0, rng.int(1, 3) + Math.max(0, Math.min(5, boost))).map((s) => s.c);
  const commenter = scored[0].c;
  const user = { handle: actorHandle(ctx, post.player_id) };

  let comment = await aiComment(
    ctx,
    commenter.id,
    `@${user.handle} posted: """${truncate(post.content, 500)}""". Write a short, friendly comment (max 200 characters) in character.`,
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
    let newLikes = 0;
    for (const liker of likers) if (addCharacterLike(ctx, postId, liker.id)) newLikes++;
    // Jede Reaktion bringt der Spielfigur ein paar Follower.
    if (post.player_id && newLikes > 0) adjustPlayerStats(ctx, post.player_id, { followers: 2 * newLikes });
    insertCharacterComment(ctx, { postId, parentId: null, characterId: commenter.id, content: comment, source });
    notify(ctx, 'postReaction', { names: likers.map((l) => l.name).join(', '), count: likers.length }, `/posts/${postId}`, post.world_id);
    notify(ctx, 'postComment', { name: commenter.name }, `/posts/${postId}`, post.world_id);
    checkAchievements(ctx);
    // Reaktionen können Quests abschließen (z. B. „Gesprächsstoff liefern“).
    if (post.player_id) evaluateQuests(ctx, post.player_id);
  });
}

/** Der Autor eines Charakterbeitrags antwortet auf den Kommentar des Nutzers. */
async function replyToComment(ctx: AppContext, postId: string, commentId: string): Promise<void> {
  const row = get<{
    character_id: string | null;
    content: string;
    comment: string;
    parent_id: string | null;
    player_id: string | null;
    world_id: string | null;
  }>(
    ctx.db,
    `SELECT p.character_id, p.content, p.world_id, cm.content AS comment, cm.parent_id, cm.player_id
       FROM posts p JOIN comments cm ON cm.post_id = p.id
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
  // Gespielte Figuren antworten nicht automatisch.
  if (row.world_id && controlledCharacterIds(ctx, row.world_id).has(character.id)) return;
  const lang = getSettings(ctx.db).language;
  const user = { handle: actorHandle(ctx, row.player_id) };
  const rng = createRng(`reply:${commentId}`);
  let reply = await aiComment(
    ctx,
    character.id,
    `You posted: """${truncate(row.content, 300)}""". @${user.handle} commented: """${truncate(row.comment, 400)}""". ` +
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
    notify(ctx, 'commentReply', { name: character.name }, `/posts/${postId}`, row.world_id);
  });
}

export async function runJob(ctx: AppContext, job: DueJob): Promise<void> {
  const payload = parseJson<Record<string, string>>(job.payload, {});
  if (job.kind === 'reactToPost' && payload.postId) await reactToPost(ctx, payload.postId, Number(payload.boost ?? 0) || 0);
  else if (job.kind === 'replyToComment' && payload.postId && payload.commentId) {
    await replyToComment(ctx, payload.postId, payload.commentId);
  }
}
