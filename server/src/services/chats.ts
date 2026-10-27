import { z } from 'zod';
import { LIMITS } from '../../../shared/constants';
import type {
  AiNotice,
  ChatDetail,
  ChatMessageDto,
  ChatSummary,
  MemoryEntryDto,
  SendMessageResult,
} from '../../../shared/types';
import type { ChatMessage } from '../ai/openrouter';
import { characterSystemPrompt } from '../ai/prompts';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText, truncate } from '../lib/text';
import { loadPromptCharacter } from './characterContext';
import { getCharacterSummary, listCharacters } from './characters';
import { demoReply, extractFacts, localSummary } from './demoResponder';
import { getProfileRow } from './mappers';
import { mergeDelta, recordAction, recordEncounter } from './progress';
import { getSettings } from './settings';

interface ChatRow {
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
  model: string | null;
  created_at: string;
}

/** Ab so vielen „herausgefallenen“ Nachrichten wird die Zusammenfassung aktualisiert. */
const SUMMARY_BATCH = 8;
const busyChats = new Set<string>();

function toMessage(r: MessageRow): ChatMessageDto {
  return { id: r.id, role: r.role, content: r.content, source: r.source, model: r.model, createdAt: r.created_at };
}

function getChatRow(ctx: AppContext, characterId: string): ChatRow | undefined {
  return get<ChatRow>(ctx.db, 'SELECT * FROM chats WHERE character_id = ?', characterId);
}

function ensureChat(ctx: AppContext, characterId: string): ChatRow {
  const existing = getChatRow(ctx, characterId);
  if (existing) return existing;
  const now = ctx.now().toISOString();
  run(
    ctx.db,
    `INSERT INTO chats (character_id, memory_enabled, memory_window, summarized_upto, created_at, updated_at)
     VALUES (?, 1, ?, 0, ?, ?)`,
    characterId,
    getSettings(ctx.db).memory.defaultWindow,
    now,
    now,
  );
  return getChatRow(ctx, characterId)!;
}

function memories(ctx: AppContext, characterId: string): MemoryEntryDto[] {
  return all<{ id: string; content: string; kind: 'fact' | 'summary'; source: MemoryEntryDto['source']; created_at: string }>(
    ctx.db,
    `SELECT * FROM chat_memories WHERE character_id = ? ORDER BY kind DESC, created_at`,
    characterId,
  ).map((m) => ({ id: m.id, content: m.content, kind: m.kind, source: m.source, createdAt: m.created_at }));
}

export function listChats(ctx: AppContext): ChatSummary[] {
  const rows = all<{ character_id: string; last_content: string | null; last_at: string | null; n: number }>(
    ctx.db,
    `SELECT ch.character_id,
            (SELECT content FROM chat_messages m WHERE m.character_id = ch.character_id ORDER BY m.id DESC LIMIT 1) AS last_content,
            (SELECT created_at FROM chat_messages m WHERE m.character_id = ch.character_id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.character_id = ch.character_id) AS n
       FROM chats ch ORDER BY last_at DESC`,
  );
  const characters = new Map(listCharacters(ctx).map((c) => [c.id, c]));
  return rows
    .filter((r) => r.n > 0 && characters.has(r.character_id))
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
  const chat = getChatRow(ctx, characterId);
  const messages = all<MessageRow>(
    ctx.db,
    `SELECT * FROM (SELECT * FROM chat_messages WHERE character_id = ? ORDER BY id DESC LIMIT 200) ORDER BY id`,
    characterId,
  ).map(toMessage);
  return {
    characterId,
    character,
    messages,
    memoryEnabled: chat ? Boolean(chat.memory_enabled) : true,
    memoryWindow: chat?.memory_window ?? getSettings(ctx.db).memory.defaultWindow,
    memories: memories(ctx, characterId),
  };
}

function addMemoryInternal(ctx: AppContext, characterId: string, content: string, source: MemoryEntryDto['source']): boolean {
  const normalized = content.trim().toLowerCase();
  const exists = all<{ content: string }>(
    ctx.db,
    `SELECT content FROM chat_memories WHERE character_id = ? AND kind = 'fact'`,
    characterId,
  ).some((m) => m.content.trim().toLowerCase() === normalized);
  if (exists) return false;
  run(
    ctx.db,
    `INSERT INTO chat_memories (id, character_id, content, kind, source, created_at) VALUES (?, ?, ?, 'fact', ?, ?)`,
    newId('mem'),
    characterId,
    truncate(content, LIMITS.memoryEntry),
    source,
    ctx.now().toISOString(),
  );
  // Obergrenze: älteste automatisch erkannte Fakten zuerst entfernen.
  const count = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM chat_memories WHERE character_id = ? AND kind = 'fact'`, characterId)?.n ?? 0;
  if (count > LIMITS.memoryEntriesPerChat) {
    run(
      ctx.db,
      `DELETE FROM chat_memories WHERE id IN (
         SELECT id FROM chat_memories WHERE character_id = ? AND kind = 'fact'
          ORDER BY source = 'user', created_at LIMIT ?)`,
      characterId,
      count - LIMITS.memoryEntriesPerChat,
    );
  }
  return true;
}

function summaryOf(ctx: AppContext, characterId: string): string | null {
  return (
    get<{ content: string }>(ctx.db, `SELECT content FROM chat_memories WHERE character_id = ? AND kind = 'summary'`, characterId)
      ?.content ?? null
  );
}

/** Baut die an das Modell gesendeten Nachrichten: Systemprompt + die letzten N Nachrichten. */
export function buildChatMessages(ctx: AppContext, characterId: string, pendingUserMessage?: string): ChatMessage[] {
  const settings = getSettings(ctx.db);
  const chat = getChatRow(ctx, characterId);
  const memoryEnabled = chat ? Boolean(chat.memory_enabled) : true;
  const window = chat?.memory_window ?? settings.memory.defaultWindow;
  const { character, world } = loadPromptCharacter(ctx, characterId);
  const facts = memoryEnabled
    ? memories(ctx, characterId)
        .filter((m) => m.kind === 'fact')
        .map((m) => m.content)
    : [];
  const system = characterSystemPrompt(character, world, settings.language, {
    mode: 'chat',
    memories: facts,
    summary: memoryEnabled ? summaryOf(ctx, characterId) : null,
    userName: settings.privacy.sendDisplayName ? getProfileRow(ctx).display_name : null,
  });
  const history = all<MessageRow>(
    ctx.db,
    `SELECT * FROM (SELECT * FROM chat_messages WHERE character_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id`,
    characterId,
    memoryEnabled ? window : 2,
  );
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.content });
  if (pendingUserMessage !== undefined) messages.push({ role: 'user', content: pendingUserMessage });
  return messages;
}

async function updateSummary(ctx: AppContext, characterId: string): Promise<void> {
  const chat = getChatRow(ctx, characterId);
  if (!chat || !chat.memory_enabled) return;
  const settings = getSettings(ctx.db);
  // Nachrichten, die aus dem Fenster gefallen und noch nicht zusammengefasst sind.
  const boundary = get<{ id: number }>(
    ctx.db,
    `SELECT id FROM chat_messages WHERE character_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?`,
    characterId,
    chat.memory_window,
  );
  if (!boundary) return;
  const pending = all<MessageRow>(
    ctx.db,
    `SELECT * FROM chat_messages WHERE character_id = ? AND id > ? AND id <= ? ORDER BY id`,
    characterId,
    chat.summarized_upto,
    boundary.id,
  );
  if (pending.length < SUMMARY_BATCH) return;
  const previous = summaryOf(ctx, characterId);
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
    run(ctx.db, `DELETE FROM chat_memories WHERE character_id = ? AND kind = 'summary'`, characterId);
    run(
      ctx.db,
      `INSERT INTO chat_memories (id, character_id, content, kind, source, created_at) VALUES (?, ?, ?, 'summary', ?, ?)`,
      newId('mem'),
      characterId,
      summary,
      source,
      ctx.now().toISOString(),
    );
    run(ctx.db, 'UPDATE chats SET summarized_upto = ? WHERE character_id = ?', boundary.id, characterId);
  });
}

function insertMessage(
  ctx: AppContext,
  characterId: string,
  role: 'user' | 'assistant',
  content: string,
  source: ChatMessageDto['source'],
  model: string | null,
): ChatMessageDto {
  const now = ctx.now().toISOString();
  const { lastInsertRowid } = run(
    ctx.db,
    `INSERT INTO chat_messages (character_id, role, content, source, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    characterId,
    role,
    content,
    source,
    model,
    now,
  );
  run(ctx.db, 'UPDATE chats SET updated_at = ? WHERE character_id = ?', now, characterId);
  return toMessage(get<MessageRow>(ctx.db, 'SELECT * FROM chat_messages WHERE id = ?', lastInsertRowid)!);
}

function localReply(ctx: AppContext, characterId: string, message: string): string {
  const settings = getSettings(ctx.db);
  const { character, world } = loadPromptCharacter(ctx, characterId);
  const chat = getChatRow(ctx, characterId);
  const turn = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM chat_messages WHERE character_id = ? AND role = 'user'`, characterId)?.n ?? 0;
  const facts =
    chat?.memory_enabled !== 0
      ? memories(ctx, characterId)
          .filter((m) => m.kind === 'fact')
          .map((m) => m.content)
      : [];
  // Ein im Chat genannter Name hat Vorrang vor dem Profilnamen.
  const nameFact = facts.find((f) => f.startsWith('Name: '));
  const userName = nameFact
    ? nameFact.slice(6)
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
  getCharacterSummary(ctx, characterId);
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_message', 'Ungültige Nachricht.', parsed.error.issues);
  const content = cleanText(parsed.data.content);
  if (!content) throw badRequest('invalid_message', 'Die Nachricht darf nicht leer sein.');
  if (content.length > LIMITS.chatMessage) {
    throw badRequest('invalid_message', `Die Nachricht darf höchstens ${LIMITS.chatMessage} Zeichen lang sein.`);
  }
  if (busyChats.has(characterId)) throw new AppError(409, 'chat_busy', 'Die vorherige Nachricht wird noch beantwortet.');
  busyChats.add(characterId);
  try {
    const settings = getSettings(ctx.db);
    const { userMessage, progress } = tx(ctx.db, () => {
      const chat = ensureChat(ctx, characterId);
      const msg = insertMessage(ctx, characterId, 'user', content, 'user', null);
      if (chat.memory_enabled && settings.memory.autoFacts) {
        for (const fact of extractFacts(content, settings.language)) addMemoryInternal(ctx, characterId, fact, 'rule');
      }
      let delta = recordAction(ctx, 'chat', String(msg.id));
      delta = mergeDelta(delta, recordAction(ctx, 'chatWith', characterId));
      delta = mergeDelta(delta, recordEncounter(ctx, characterId));
      return { userMessage: msg, progress: delta };
    });

    let replyText: string | null = null;
    let replySource: ChatMessageDto['source'] = 'demo';
    let model: string | null = null;
    let notice: AiNotice | undefined;
    if (ctx.ai.isActive('chat')) {
      const messages = buildChatMessages(ctx, characterId);
      const result = await ctx.ai.complete({ purpose: 'chat', kind: 'chat', messages });
      if (result.ok) {
        replyText = truncate(cleanText(result.text), LIMITS.chatMessage);
        replySource = 'ai';
        model = result.model;
      } else {
        notice = { code: result.code, message: result.message };
      }
    }
    if (!replyText) replyText = localReply(ctx, characterId, content);
    const reply = insertMessage(ctx, characterId, 'assistant', replyText, replySource, model);
    try {
      await updateSummary(ctx, characterId);
    } catch (error) {
      console.warn('[chat] Zusammenfassung fehlgeschlagen:', (error as Error).message);
    }
    return { userMessage, reply, notice, progress };
  } finally {
    busyChats.delete(characterId);
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
  getCharacterSummary(ctx, characterId);
  const parsed = chatSettingsSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_chat_settings', 'Ungültige Chat-Einstellungen.', parsed.error.issues);
  const chat = ensureChat(ctx, characterId);
  run(
    ctx.db,
    'UPDATE chats SET memory_enabled = ?, memory_window = ? WHERE character_id = ?',
    parsed.data.memoryEnabled ?? Boolean(chat.memory_enabled),
    parsed.data.memoryWindow ?? chat.memory_window,
    characterId,
  );
  return getChat(ctx, characterId);
}

export function addMemory(ctx: AppContext, characterId: string, input: unknown): MemoryEntryDto[] {
  getCharacterSummary(ctx, characterId);
  const parsed = z.object({ content: z.string().max(LIMITS.memoryEntry * 2) }).safeParse(input);
  if (!parsed.success) throw badRequest('invalid_memory', 'Ungültige Erinnerung.');
  const content = cleanText(parsed.data.content);
  if (!content) throw badRequest('invalid_memory', 'Die Erinnerung darf nicht leer sein.');
  if (content.length > LIMITS.memoryEntry) throw badRequest('invalid_memory', 'Die Erinnerung ist zu lang.');
  ensureChat(ctx, characterId);
  addMemoryInternal(ctx, characterId, content, 'user');
  return memories(ctx, characterId);
}

export function deleteMemory(ctx: AppContext, characterId: string, memoryId: string): MemoryEntryDto[] {
  if (run(ctx.db, 'DELETE FROM chat_memories WHERE id = ? AND character_id = ?', memoryId, characterId).changes === 0) {
    throw notFound('Erinnerung');
  }
  return memories(ctx, characterId);
}

/** Löscht Verlauf und Erinnerungen eines Chats vollständig. */
export function clearChat(ctx: AppContext, characterId: string): void {
  run(ctx.db, 'DELETE FROM chats WHERE character_id = ?', characterId);
}

/** Zeigt exakt, welche Nachrichten bei der nächsten KI-Anfrage gesendet würden. */
export function promptPreview(ctx: AppContext, characterId: string, placeholder: string): {
  messages: ChatMessage[];
  model: string | null;
  mode: 'ai' | 'demo';
} {
  getCharacterSummary(ctx, characterId);
  return {
    messages: buildChatMessages(ctx, characterId, placeholder),
    model: ctx.ai.modelFor('chat') || null,
    mode: ctx.ai.isActive('chat') ? 'ai' : 'demo',
  };
}
