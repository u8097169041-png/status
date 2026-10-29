import { z } from 'zod';
import { categoryOfGenre, LIMITS, type Genre } from '../../../shared/constants';
import type {
  AiNotice,
  AiProviderId,
  ChatDetail,
  ChatMessageDto,
  ChatSummary,
  MemoryEntryDto,
  SendMessageResult,
} from '../../../shared/types';
import type { ChatMessage } from '../ai/types';
import { characterSystemPrompt, type GameContext, type PlayerPersona } from '../ai/prompts';
import { CHAT_FORMAT_INSTRUCTION, parseChatTurn, TONE_AFFINITY, type ChatTone } from '../ai/structured';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText, truncate } from '../lib/text';
import { loadPromptCharacter } from './characterContext';
import { getCharacterRow, getCharacterSummary, listCharacters } from './characters';
import { demoReply, extractFacts, localSummary } from './demoResponder';
import { getProfileRow } from './mappers';
import { getActivePlayerRow, requireActivePlayer, type PlayerRow } from './players';
import { mergeDelta, recordAction, recordEncounter } from './progress';
import { getSettings } from './settings';
import { skillLevel } from './skills';
import { adjustAffinity } from './society';
import { SKILL_RULES } from '../../../shared/skills';
import { dayKey } from '../lib/time';

/**
 * Chats sind Gespräche zwischen einer Spielfigur und einer Figur derselben Welt. Jede Spielfigur hat eigene
 * Verläufe und Erinnerungen; wechselt der Nutzer die Figur, beginnt ein neues Gespräch, das alte bleibt erhalten.
 * Figuren ohne Welt werden weiterhin direkt (ohne Spielfigur) angeschrieben.
 */
interface ConversationRow {
  id: string;
  player_id: string | null;
  character_id: string;
  memory_enabled: number;
  memory_window: number;
  summarized_upto: number;
}

interface MessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  source: ChatMessageDto['source'];
  provider: ChatMessageDto['provider'];
  model: string | null;
  created_at: string;
}

/** Ab so vielen „herausgefallenen“ Nachrichten wird die Zusammenfassung aktualisiert. */
const SUMMARY_BATCH = 8;
const busyChats = new Set<string>();

function toMessage(r: MessageRow): ChatMessageDto {
  return {
    id: r.id,
    role: r.role,
    content: r.content,
    source: r.source,
    provider: r.provider ?? null,
    model: r.model,
    createdAt: r.created_at,
  };
}

export interface ChatTarget {
  characterId: string;
  player: PlayerRow | null;
}

/** Prüft, ob mit dieser Figur gechattet werden darf, und ermittelt die zuständige Spielfigur. */
export function resolveTarget(ctx: AppContext, characterId: string): ChatTarget {
  const c = getCharacterRow(ctx, characterId);
  if (!c.world_id) return { characterId, player: null };
  const player = requireActivePlayer(ctx, c.world_id);
  if (c.is_player || player.character_id === c.id) {
    throw badRequest('cannot_chat_self', 'Mit deiner eigenen Spielfigur kannst du nicht chatten.');
  }
  return { characterId, player };
}

function findConversation(ctx: AppContext, target: ChatTarget): ConversationRow | undefined {
  if (!target.player) {
    return get<ConversationRow>(
      ctx.db,
      'SELECT * FROM conversations WHERE player_id IS NULL AND character_id = ? ORDER BY created_at LIMIT 1',
      target.characterId,
    );
  }
  const own = get<ConversationRow>(
    ctx.db,
    'SELECT * FROM conversations WHERE player_id = ? AND character_id = ?',
    target.player.id,
    target.characterId,
  );
  if (own) return own;
  // Verläufe aus der Zeit vor den Spielfiguren übernimmt die erste Spielfigur der Welt.
  const legacy = get<ConversationRow>(
    ctx.db,
    'SELECT * FROM conversations WHERE player_id IS NULL AND character_id = ? ORDER BY created_at LIMIT 1',
    target.characterId,
  );
  if (legacy) {
    run(ctx.db, 'UPDATE conversations SET player_id = ? WHERE id = ?', target.player.id, legacy.id);
    return { ...legacy, player_id: target.player.id };
  }
  return undefined;
}

function ensureConversation(ctx: AppContext, target: ChatTarget): ConversationRow {
  const existing = findConversation(ctx, target);
  if (existing) return existing;
  const now = ctx.now().toISOString();
  const id = newId('conv');
  run(
    ctx.db,
    `INSERT INTO conversations (id, player_id, character_id, memory_enabled, memory_window, summarized_upto, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, 0, ?, ?)`,
    id,
    target.player?.id ?? null,
    target.characterId,
    getSettings(ctx.db).memory.defaultWindow,
    now,
    now,
  );
  return get<ConversationRow>(ctx.db, 'SELECT * FROM conversations WHERE id = ?', id)!;
}

function memories(ctx: AppContext, conversationId: string | undefined): MemoryEntryDto[] {
  if (!conversationId) return [];
  return all<{ id: string; content: string; kind: 'fact' | 'summary'; source: MemoryEntryDto['source']; created_at: string }>(
    ctx.db,
    `SELECT * FROM conversation_memories WHERE conversation_id = ? ORDER BY kind DESC, created_at`,
    conversationId,
  ).map((m) => ({ id: m.id, content: m.content, kind: m.kind, source: m.source, createdAt: m.created_at }));
}

/** Gespräche der aktiven Spielfigur in einer Welt. */
export function listChats(ctx: AppContext, worldId: string): ChatSummary[] {
  const player = getActivePlayerRow(ctx, worldId);
  if (!player) return [];
  const rows = all<{ character_id: string; last_content: string | null; last_at: string | null; n: number }>(
    ctx.db,
    `SELECT cv.character_id,
            (SELECT content FROM conversation_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_content,
            (SELECT created_at FROM conversation_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id = cv.id) AS n
       FROM conversations cv
      WHERE cv.player_id = ?
         OR (cv.player_id IS NULL AND cv.character_id IN (SELECT id FROM characters WHERE world_id = ?))
      ORDER BY last_at DESC`,
    player.id,
    worldId,
  );
  const characters = new Map(listCharacters(ctx, { worldId }).map((c) => [c.id, c]));
  const seen = new Set<string>();
  return rows
    .filter((r) => r.n > 0 && characters.has(r.character_id) && r.character_id !== player.character_id)
    .filter((r) => !seen.has(r.character_id) && seen.add(r.character_id))
    .map((r) => ({
      characterId: r.character_id,
      character: characters.get(r.character_id)!,
      lastMessage: r.last_content ? truncate(r.last_content, 120) : null,
      lastMessageAt: r.last_at,
      messageCount: r.n,
    }));
}

export function getChat(ctx: AppContext, characterId: string): ChatDetail {
  const character = getCharacterSummary(ctx, characterId);
  const conv = findConversation(ctx, resolveTarget(ctx, characterId));
  const messages = conv
    ? all<MessageRow>(
        ctx.db,
        `SELECT * FROM (SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 200) ORDER BY id`,
        conv.id,
      ).map(toMessage)
    : [];
  return {
    characterId,
    character,
    messages,
    memoryEnabled: conv ? Boolean(conv.memory_enabled) : true,
    memoryWindow: conv?.memory_window ?? getSettings(ctx.db).memory.defaultWindow,
    memories: memories(ctx, conv?.id),
  };
}

function addMemoryInternal(ctx: AppContext, conversationId: string, content: string, source: MemoryEntryDto['source']): boolean {
  const normalized = content.trim().toLowerCase();
  const exists = all<{ content: string }>(
    ctx.db,
    `SELECT content FROM conversation_memories WHERE conversation_id = ? AND kind = 'fact'`,
    conversationId,
  ).some((m) => m.content.trim().toLowerCase() === normalized);
  if (exists) return false;
  run(
    ctx.db,
    `INSERT INTO conversation_memories (id, conversation_id, content, kind, source, created_at) VALUES (?, ?, ?, 'fact', ?, ?)`,
    newId('mem'),
    conversationId,
    truncate(content, LIMITS.memoryEntry),
    source,
    ctx.now().toISOString(),
  );
  // Obergrenze: älteste automatisch erkannte Fakten zuerst entfernen.
  const count =
    get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM conversation_memories WHERE conversation_id = ? AND kind = 'fact'`, conversationId)
      ?.n ?? 0;
  if (count > LIMITS.memoryEntriesPerChat) {
    run(
      ctx.db,
      `DELETE FROM conversation_memories WHERE id IN (
         SELECT id FROM conversation_memories WHERE conversation_id = ? AND kind = 'fact'
          ORDER BY source = 'user', created_at LIMIT ?)`,
      conversationId,
      count - LIMITS.memoryEntriesPerChat,
    );
  }
  return true;
}

function summaryOf(ctx: AppContext, conversationId: string | undefined): string | null {
  if (!conversationId) return null;
  return (
    get<{ content: string }>(
      ctx.db,
      `SELECT content FROM conversation_memories WHERE conversation_id = ? AND kind = 'summary'`,
      conversationId,
    )?.content ?? null
  );
}

/** Beschreibung der Spielfigur für die Gegenseite. Der Name wird nur gesendet, wenn es die Privatsphäre-Einstellung erlaubt. */
function personaOf(ctx: AppContext, player: PlayerRow | null, allowName: boolean): PlayerPersona | null {
  if (!player) return null;
  const c = getCharacterRow(ctx, player.character_id);
  return {
    name: allowName ? c.name : null,
    role: c.role,
    background: c.background,
    goals: parseJson<string[]>(c.goals, []),
  };
}

/** Nur lesbarer Spielkontext: Beziehung zur Spielfigur, aktuelle Hauptquest und laufende Geschichten der Welt. */
function gameContextOf(ctx: AppContext, target: ChatTarget): GameContext | null {
  const player = target.player;
  if (!player) return null;
  const [a, b] = player.character_id < target.characterId ? [player.character_id, target.characterId] : [target.characterId, player.character_id];
  const rel = get<{ affinity: number; kind: string }>(ctx.db, 'SELECT affinity, kind FROM relationships WHERE a_id = ? AND b_id = ?', a, b);
  const quest = get<{ title: string }>(
    ctx.db,
    `SELECT title FROM quests WHERE player_id = ? AND kind = 'main' AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    player.id,
  );
  const storylines = all<{ title: string; stages: string; stage: number }>(
    ctx.db,
    `SELECT title, stages, stage FROM storylines WHERE world_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 3`,
    player.world_id,
  ).map((sl) => {
    const stage = parseJson<string[]>(sl.stages, [])[sl.stage];
    return stage ? `${sl.title}: ${stage}` : sl.title;
  });
  return { affinity: rel?.affinity ?? 0, relationKind: rel?.kind ?? null, mainQuest: quest?.title ?? null, storylines };
}

/** Baut die an das Modell gesendeten Nachrichten: Systemprompt + die letzten N Nachrichten. */
export function buildChatMessages(ctx: AppContext, characterId: string, pendingUserMessage?: string): ChatMessage[] {
  const settings = getSettings(ctx.db);
  const target = resolveTarget(ctx, characterId);
  const conv = findConversation(ctx, target);
  const memoryEnabled = conv ? Boolean(conv.memory_enabled) : true;
  const window = conv?.memory_window ?? settings.memory.defaultWindow;
  const { character, world } = loadPromptCharacter(ctx, characterId);
  const facts = memoryEnabled
    ? memories(ctx, conv?.id)
        .filter((m) => m.kind === 'fact')
        .map((m) => m.content)
    : [];
  const persona = personaOf(ctx, target.player, settings.privacy.sendDisplayName);
  const system = characterSystemPrompt(character, world, settings.language, {
    mode: 'chat',
    memories: facts,
    summary: memoryEnabled ? summaryOf(ctx, conv?.id) : null,
    userName: persona ? persona.name : settings.privacy.sendDisplayName ? getProfileRow(ctx).display_name : null,
    player: persona,
    game: gameContextOf(ctx, target),
    format: CHAT_FORMAT_INSTRUCTION,
  });
  const history = conv
    ? all<MessageRow>(
        ctx.db,
        `SELECT * FROM (SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id`,
        conv.id,
        memoryEnabled ? window : 2,
      )
    : [];
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.content });
  if (pendingUserMessage !== undefined) messages.push({ role: 'user', content: pendingUserMessage });
  return messages;
}

async function updateSummary(ctx: AppContext, conversationId: string): Promise<void> {
  const conv = get<ConversationRow>(ctx.db, 'SELECT * FROM conversations WHERE id = ?', conversationId);
  if (!conv || !conv.memory_enabled) return;
  const settings = getSettings(ctx.db);
  // Nachrichten, die aus dem Fenster gefallen und noch nicht zusammengefasst sind.
  const boundary = get<{ id: number }>(
    ctx.db,
    `SELECT id FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?`,
    conversationId,
    conv.memory_window,
  );
  if (!boundary) return;
  const pending = all<MessageRow>(
    ctx.db,
    `SELECT * FROM conversation_messages WHERE conversation_id = ? AND id > ? AND id <= ? ORDER BY id`,
    conversationId,
    conv.summarized_upto,
    boundary.id,
  );
  if (pending.length < SUMMARY_BATCH) return;
  const previous = summaryOf(ctx, conversationId);
  let summary: string | null = null;
  let source: 'ai' | 'rule' = 'rule';
  if (settings.ai.summariesEnabled && ctx.ai.isActive('chat')) {
    const transcript = pending.map((m) => `${m.role === 'user' ? 'User' : 'Character'}: ${truncate(m.content, 400)}`).join('\n');
    const result = await ctx.ai.complete({
      purpose: 'summary',
      kind: 'chat',
      maxTokens: 220,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            `Summarise a role-play chat for long-term memory in ${settings.language === 'de' ? 'German' : 'English'}. ` +
            'Keep facts about the user, open topics and promises. Max 120 words. Plain text only.',
        },
        { role: 'user', content: `Previous summary: ${previous ?? '(none)'}\n\nNew messages:\n${transcript}` },
      ],
    });
    if (result.ok) {
      summary = truncate(cleanText(result.text), 1200);
      source = 'ai';
    }
  }
  if (!summary) {
    summary = localSummary(
      pending.filter((m) => m.role === 'user').map((m) => m.content),
      previous,
      settings.language,
    );
  }
  tx(ctx.db, () => {
    run(ctx.db, `DELETE FROM conversation_memories WHERE conversation_id = ? AND kind = 'summary'`, conversationId);
    run(
      ctx.db,
      `INSERT INTO conversation_memories (id, conversation_id, content, kind, source, created_at) VALUES (?, ?, ?, 'summary', ?, ?)`,
      newId('mem'),
      conversationId,
      summary,
      source,
      ctx.now().toISOString(),
    );
    run(ctx.db, 'UPDATE conversations SET summarized_upto = ? WHERE id = ?', boundary.id, conversationId);
  });
}

function insertMessage(
  ctx: AppContext,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  source: ChatMessageDto['source'],
  model: string | null,
  provider: ChatMessageDto['provider'] = null,
): ChatMessageDto {
  const now = ctx.now().toISOString();
  const { lastInsertRowid } = run(
    ctx.db,
    `INSERT INTO conversation_messages (conversation_id, role, content, source, provider, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    conversationId,
    role,
    content,
    source,
    provider,
    model,
    now,
  );
  run(ctx.db, 'UPDATE conversations SET updated_at = ? WHERE id = ?', now, conversationId);
  return toMessage(get<MessageRow>(ctx.db, 'SELECT * FROM conversation_messages WHERE id = ?', lastInsertRowid)!);
}

function isDatingCharacter(ctx: AppContext, characterId: string): boolean {
  const genre = get<{ genre: Genre }>(ctx.db, 'SELECT w.genre FROM characters c JOIN worlds w ON w.id = c.world_id WHERE c.id = ?', characterId)?.genre;
  return genre ? categoryOfGenre(genre) === 'dating' : false;
}

function localReply(ctx: AppContext, characterId: string, conv: ConversationRow, player: PlayerRow | null, message: string): string {
  const settings = getSettings(ctx.db);
  const { character, world } = loadPromptCharacter(ctx, characterId);
  const turn =
    get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM conversation_messages WHERE conversation_id = ? AND role = 'user'`, conv.id)
      ?.n ?? 0;
  const facts = conv.memory_enabled
    ? memories(ctx, conv.id)
        .filter((m) => m.kind === 'fact')
        .map((m) => m.content)
    : [];
  // Ein im Chat genannter Name hat Vorrang; sonst der Name der Spielfigur bzw. des Profils.
  const nameFact = facts.find((f) => f.startsWith('Name: '));
  const userName = nameFact
    ? nameFact.slice(6)
    : player
      ? getCharacterRow(ctx, player.character_id).name
      : settings.privacy.sendDisplayName
        ? getProfileRow(ctx).display_name
        : null;
  return demoReply(
    {
      id: characterId,
      name: character.name,
      tagline: character.tagline,
      description: character.description,
      role: character.role,
      interests: character.interests,
      writingStyle: character.writingStyle,
      worldName: world?.name ?? null,
      worldTagline: world?.tagline ?? null,
      relations: character.relationships.map((r) => r.name),
      romantic: isDatingCharacter(ctx, characterId),
    },
    message,
    {
      lang: settings.language,
      userName,
      facts,
      lastEvent: world?.recentEvents[0] ?? null,
      turn,
    },
  );
}

const sendSchema = z.object({ content: z.string().max(LIMITS.chatMessage * 2) });

export async function sendMessage(ctx: AppContext, characterId: string, input: unknown): Promise<SendMessageResult> {
  const target = resolveTarget(ctx, characterId);
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_message', 'Ungültige Nachricht.', parsed.error.issues);
  const content = cleanText(parsed.data.content);
  if (!content) throw badRequest('invalid_message', 'Die Nachricht darf nicht leer sein.');
  if (content.length > LIMITS.chatMessage) {
    throw badRequest('invalid_message', `Die Nachricht darf höchstens ${LIMITS.chatMessage} Zeichen lang sein.`);
  }
  const busyKey = `${target.player?.id ?? '-'}:${characterId}`;
  if (busyChats.has(busyKey)) throw new AppError(409, 'chat_busy', 'Die vorherige Nachricht wird noch beantwortet.');
  busyChats.add(busyKey);
  try {
    const settings = getSettings(ctx.db);
    const { conv, userMessage, progress } = tx(ctx.db, () => {
      const conv = ensureConversation(ctx, target);
      const msg = insertMessage(ctx, conv.id, 'user', content, 'user', null);
      if (conv.memory_enabled && settings.memory.autoFacts) {
        for (const fact of extractFacts(content, settings.language)) addMemoryInternal(ctx, conv.id, fact, 'rule');
      }
      const playerId = target.player?.id;
      if (playerId && target.player) {
        run(ctx.db, 'UPDATE players SET last_active_at = ? WHERE id = ?', ctx.now().toISOString(), playerId);
        // Das erste Gespräch des Tages stärkt die Beziehung – mit Charisma mehr.
        const first = run(
          ctx.db,
          `INSERT OR IGNORE INTO action_uses (player_id, action, ref, day, created_at) VALUES (?, 'chat-affinity', ?, ?, ?)`,
          playerId,
          characterId,
          dayKey(ctx.now()),
          ctx.now().toISOString(),
        );
        if (first.changes > 0) {
          const bonus = SKILL_RULES.chatAffinity.base + SKILL_RULES.chatAffinity.perCharisma * skillLevel(ctx, playerId, 'charisma');
          adjustAffinity(ctx, target.player.world_id, target.player.character_id, characterId, bonus);
        }
      }
      let delta = recordAction(ctx, 'chat', String(msg.id), playerId);
      delta = mergeDelta(delta, recordAction(ctx, 'chatWith', characterId, playerId));
      delta = mergeDelta(delta, recordEncounter(ctx, characterId));
      return { conv, userMessage: msg, progress: delta };
    });

    // Lokale KI bzw. (mit Freigabe) Server-KI; sonst oder bei Fehlern die simulierte Antwort der Figur.
    const simulated = () => localReply(ctx, characterId, conv, target.player, content);
    const result = await ctx.ai.complete({
      purpose: 'chat',
      kind: 'chat',
      json: true,
      messages: buildChatMessages(ctx, characterId),
      fallback: simulated,
    });
    let replyText: string;
    let provider: ChatMessageDto['provider'] = 'fallback';
    let model: string | null = null;
    let notice: AiNotice | undefined;
    let tone: ChatTone = 'neutral';
    const turn = result.ok && result.provider !== 'fallback' ? parseChatTurn(result.text) : null;
    if (result.ok && turn) {
      replyText = turn.reply;
      provider = result.provider;
      model = result.model;
      if (turn.structured) tone = turn.tone;
    } else {
      replyText = result.ok && result.provider === 'fallback' ? result.text : simulated();
      if (result.ok && result.notice) notice = { code: result.notice.code, message: result.notice.message };
      else if (!result.ok && result.code !== 'unavailable') notice = { code: result.code, message: result.message };
      else if (result.ok && !turn && result.provider !== 'fallback') notice = { code: 'invalid_response', message: 'Antwort der KI war unbrauchbar.' };
    }
    const reply = tx(ctx.db, () => {
      const saved = insertMessage(ctx, conv.id, 'assistant', replyText, provider === 'fallback' ? 'demo' : 'ai', model, provider);
      // Spielregel statt KI-Willkür: Die Stimmung einer echten KI-Antwort ändert die Zuneigung um höchstens 1,
      // und das höchstens einmal pro Tag und Figur. XP, Quests und Fähigkeiten bleiben unberührt.
      const delta = TONE_AFFINITY[tone];
      if (delta !== 0 && target.player) {
        const first = run(
          ctx.db,
          `INSERT OR IGNORE INTO action_uses (player_id, action, ref, day, created_at) VALUES (?, 'ai-tone', ?, ?, ?)`,
          target.player.id,
          characterId,
          dayKey(ctx.now()),
          ctx.now().toISOString(),
        );
        if (first.changes > 0) adjustAffinity(ctx, target.player.world_id, target.player.character_id, characterId, delta);
      }
      return saved;
    });
    try {
      await updateSummary(ctx, conv.id);
    } catch (error) {
      console.warn('[chat] Zusammenfassung fehlgeschlagen:', (error as Error).message);
    }
    return { userMessage, reply, notice, progress };
  } finally {
    busyChats.delete(busyKey);
  }
}

const chatSettingsSchema = z
  .object({
    memoryEnabled: z.boolean(),
    memoryWindow: z.number().int().min(LIMITS.memoryWindowMin).max(LIMITS.memoryWindowMax),
  })
  .partial()
  .strict();

export function updateChatSettings(ctx: AppContext, characterId: string, input: unknown): ChatDetail {
  const target = resolveTarget(ctx, characterId);
  const parsed = chatSettingsSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_chat_settings', 'Ungültige Chat-Einstellungen.', parsed.error.issues);
  const conv = ensureConversation(ctx, target);
  run(
    ctx.db,
    'UPDATE conversations SET memory_enabled = ?, memory_window = ? WHERE id = ?',
    parsed.data.memoryEnabled ?? Boolean(conv.memory_enabled),
    parsed.data.memoryWindow ?? conv.memory_window,
    conv.id,
  );
  return getChat(ctx, characterId);
}

export function addMemory(ctx: AppContext, characterId: string, input: unknown): MemoryEntryDto[] {
  const target = resolveTarget(ctx, characterId);
  const parsed = z.object({ content: z.string().max(LIMITS.memoryEntry * 2) }).safeParse(input);
  if (!parsed.success) throw badRequest('invalid_memory', 'Ungültige Erinnerung.');
  const content = cleanText(parsed.data.content);
  if (!content) throw badRequest('invalid_memory', 'Die Erinnerung darf nicht leer sein.');
  if (content.length > LIMITS.memoryEntry) throw badRequest('invalid_memory', 'Die Erinnerung ist zu lang.');
  const conv = ensureConversation(ctx, target);
  addMemoryInternal(ctx, conv.id, content, 'user');
  return memories(ctx, conv.id);
}

export function deleteMemory(ctx: AppContext, characterId: string, memoryId: string): MemoryEntryDto[] {
  const conv = findConversation(ctx, resolveTarget(ctx, characterId));
  if (!conv || run(ctx.db, 'DELETE FROM conversation_memories WHERE id = ? AND conversation_id = ?', memoryId, conv.id).changes === 0) {
    throw notFound('Erinnerung');
  }
  return memories(ctx, conv.id);
}

/** Löscht Verlauf und Erinnerungen des Gesprächs der aktiven Spielfigur vollständig. */
export function clearChat(ctx: AppContext, characterId: string): void {
  const conv = findConversation(ctx, resolveTarget(ctx, characterId));
  if (conv) run(ctx.db, 'DELETE FROM conversations WHERE id = ?', conv.id);
}

/** Zeigt exakt, welche Nachrichten bei der nächsten KI-Anfrage gesendet würden. */
export function promptPreview(ctx: AppContext, characterId: string, placeholder: string): {
  messages: ChatMessage[];
  model: string | null;
  mode: 'ai' | 'demo';
  provider: AiProviderId;
} {
  getCharacterSummary(ctx, characterId);
  return {
    messages: buildChatMessages(ctx, characterId, placeholder),
    model: ctx.ai.modelFor('chat') || null,
    mode: ctx.ai.isActive('chat') ? 'ai' : 'demo',
    provider: ctx.ai.activeProvider('chat'),
  };
}
