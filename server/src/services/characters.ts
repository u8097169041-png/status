import { z } from 'zod';
import { AVATAR_GLYPHS, LIMITS, WRITING_STYLES } from '../../../shared/constants';
import type { CharacterDetail, CharacterInput, CharacterSummary, ProgressDelta } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText, slugifyHandle } from '../lib/text';
import {
  CHARACTER_SUMMARY_SQL,
  toCharacterCore,
  toCharacterSummary,
  type CharacterRow,
} from './mappers';
import { emptyDelta, recordAction, recordEncounter } from './progress';
import { relationshipsForCharacter } from './society';

type SummaryRow = CharacterRow & { world_name: string | null; post_count: number };

export function listCharacters(ctx: AppContext, filters: { worldId?: string; custom?: boolean } = {}): CharacterSummary[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filters.worldId) {
    where.push('c.world_id = ?');
    params.push(filters.worldId);
  }
  if (filters.custom) where.push('c.is_custom = 1');
  return all<SummaryRow>(
    ctx.db,
    `${CHARACTER_SUMMARY_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.is_custom DESC, c.name`,
    ...params,
  ).map(toCharacterSummary);
}

export function getCharacterRow(ctx: AppContext, id: string): SummaryRow {
  const row = get<SummaryRow>(ctx.db, `${CHARACTER_SUMMARY_SQL} WHERE c.id = ?`, id);
  if (!row) throw notFound('Charakter');
  return row;
}

export function getCharacterSummary(ctx: AppContext, id: string): CharacterSummary {
  return toCharacterSummary(getCharacterRow(ctx, id));
}

export function getCharacter(ctx: AppContext, id: string, opts: { recordVisit?: boolean } = {}): {
  character: CharacterDetail;
  progress: ProgressDelta;
} {
  const row = getCharacterRow(ctx, id);
  const progress = opts.recordVisit ? recordEncounter(ctx, id) : emptyDelta();
  const groups = all<{ id: string; name: string; hue: number; role: string }>(
    ctx.db,
    `SELECT g.id, g.name, g.hue, gm.role FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.character_id = ? ORDER BY g.name`,
    id,
  );
  const chat = get<{ n: number; last: string | null }>(
    ctx.db,
    `SELECT COUNT(*) AS n, MAX(created_at) AS last FROM chat_messages WHERE character_id = ?`,
    id,
  );
  const likesGiven =
    get<{ n: number }>(
      ctx.db,
      `SELECT COUNT(*) AS n FROM character_likes cl JOIN posts p ON p.id = cl.post_id
        WHERE cl.character_id = ? AND p.author_type = 'user'`,
      id,
    )?.n ?? 0;
  const commentsOnYourPosts =
    get<{ n: number }>(
      ctx.db,
      `SELECT COUNT(*) AS n FROM comments cm JOIN posts p ON p.id = cm.post_id
        WHERE cm.character_id = ? AND p.author_type = 'user'`,
      id,
    )?.n ?? 0;
  const eventsInvolved =
    get<{ n: number }>(
      ctx.db,
      `SELECT COUNT(*) AS n FROM world_events e
        WHERE EXISTS (SELECT 1 FROM json_each(e.participants) j WHERE json_extract(j.value, '$.id') = ?)`,
      id,
    )?.n ?? 0;
  return {
    progress,
    character: {
      ...toCharacterSummary(row),
      ...toCharacterCore(row),
      relationships: relationshipsForCharacter(ctx, id),
      groups,
      stats: {
        chatMessages: chat?.n ?? 0,
        lastChatAt: chat?.last ?? null,
        likesGiven,
        commentsOnYourPosts,
        eventsInvolved,
      },
    },
  };
}

const listField = (maxItems: number, maxLen: number) =>
  z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);

export const characterInputSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.characterName),
  handle: z.string().trim().max(LIMITS.characterHandle).default(''),
  tagline: z.string().trim().max(LIMITS.characterShortText).default(''),
  description: z.string().trim().max(LIMITS.characterLongText).default(''),
  role: z.string().trim().max(LIMITS.characterShortText).default(''),
  worldId: z.string().max(80).nullable().default(null),
  personality: listField(LIMITS.characterListItems, LIMITS.characterListItem).default([]),
  interests: listField(LIMITS.characterListItems, LIMITS.characterListItem).default([]),
  background: z.string().trim().max(LIMITS.characterLongText).default(''),
  writingStyle: z.enum(WRITING_STYLES).default('casual'),
  styleNotes: z.string().trim().max(LIMITS.characterShortText * 2).default(''),
  rules: listField(LIMITS.characterRules, LIMITS.characterRule).default([]),
  avatarHue: z.number().int().min(0).max(359).default(200),
  avatarGlyph: z.enum(AVATAR_GLYPHS).default('initials'),
  isRealPersonSim: z.boolean().default(false),
});

export function parseCharacterInput(input: unknown): CharacterInput {
  const parsed = characterInputSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_character', 'Ungültige Charakterdaten.', parsed.error.issues);
  const d = parsed.data;
  return {
    ...d,
    name: cleanText(d.name),
    tagline: cleanText(d.tagline),
    description: cleanText(d.description),
    role: cleanText(d.role),
    background: cleanText(d.background),
    styleNotes: cleanText(d.styleNotes),
    personality: d.personality.map(cleanText).filter(Boolean),
    interests: d.interests.map(cleanText).filter(Boolean),
    rules: d.rules.map(cleanText).filter(Boolean),
  };
}

function uniqueHandle(ctx: AppContext, desired: string, excludeId?: string): string {
  const base = slugifyHandle(desired) || 'character';
  let handle = base;
  let n = 2;
  while (
    get(ctx.db, 'SELECT 1 FROM characters WHERE handle = ? AND id != ?', handle, excludeId ?? '') ||
    handle === getProfileHandle(ctx)
  ) {
    const suffix = `_${n++}`;
    handle = `${base.slice(0, LIMITS.characterHandle - suffix.length)}${suffix}`;
  }
  return handle;
}

function getProfileHandle(ctx: AppContext): string | undefined {
  return get<{ handle: string }>(ctx.db, 'SELECT handle FROM user_profile WHERE id = 1')?.handle;
}

/** Legt einen Charakter an. `explicitHandle` wird strikt geprüft, sonst wird ein freier Handle erzeugt. */
export function insertCharacter(ctx: AppContext, input: CharacterInput, opts: { strictHandle: boolean }): string {
  if (input.worldId && !get(ctx.db, 'SELECT 1 FROM worlds WHERE id = ?', input.worldId)) throw notFound('Welt');
  let handle: string;
  if (opts.strictHandle && input.handle) {
    handle = slugifyHandle(input.handle);
    if (handle.length < 2) throw badRequest('invalid_handle', 'Der Handle muss mindestens 2 Zeichen haben.');
    if (get(ctx.db, 'SELECT 1 FROM characters WHERE handle = ?', handle)) {
      throw conflict('handle_taken', 'Dieser Handle ist bereits vergeben.');
    }
  } else {
    handle = uniqueHandle(ctx, input.handle || input.name);
  }
  const id = newId('c');
  run(
    ctx.db,
    `INSERT INTO characters (id, world_id, name, handle, tagline, description, role, personality, interests, background,
                             writing_style, style_notes, rules, avatar_hue, avatar_glyph, is_custom, is_real_person_sim,
                             mood, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'neutral', ?)`,
    id,
    input.worldId,
    input.name,
    handle,
    input.tagline,
    input.description,
    input.role,
    JSON.stringify(input.personality),
    JSON.stringify(input.interests),
    input.background,
    input.writingStyle,
    input.styleNotes,
    JSON.stringify(input.rules),
    input.avatarHue,
    input.avatarGlyph,
    input.isRealPersonSim,
    ctx.now().toISOString(),
  );
  return id;
}

export function createCharacter(ctx: AppContext, raw: unknown): { character: CharacterDetail; progress: ProgressDelta } {
  const input = parseCharacterInput(raw);
  const id = tx(ctx.db, () => insertCharacter(ctx, input, { strictHandle: true }));
  const progress = recordAction(ctx, 'createCharacter', id);
  return { character: getCharacter(ctx, id).character, progress };
}

export function updateCharacter(ctx: AppContext, id: string, raw: unknown): CharacterDetail {
  const row = getCharacterRow(ctx, id);
  if (!row.is_custom) throw forbidden('Vorgefertigte Charaktere können nicht bearbeitet werden.');
  const input = parseCharacterInput(raw);
  if (input.worldId && !get(ctx.db, 'SELECT 1 FROM worlds WHERE id = ?', input.worldId)) throw notFound('Welt');
  let handle = row.handle;
  if (input.handle && slugifyHandle(input.handle) !== row.handle) {
    handle = slugifyHandle(input.handle);
    if (handle.length < 2) throw badRequest('invalid_handle', 'Der Handle muss mindestens 2 Zeichen haben.');
    if (get(ctx.db, 'SELECT 1 FROM characters WHERE handle = ? AND id != ?', handle, id)) {
      throw conflict('handle_taken', 'Dieser Handle ist bereits vergeben.');
    }
  }
  tx(ctx.db, () => {
    run(
      ctx.db,
      `UPDATE characters SET world_id = ?, name = ?, handle = ?, tagline = ?, description = ?, role = ?, personality = ?,
              interests = ?, background = ?, writing_style = ?, style_notes = ?, rules = ?, avatar_hue = ?,
              avatar_glyph = ?, is_real_person_sim = ? WHERE id = ?`,
      input.worldId,
      input.name,
      handle,
      input.tagline,
      input.description,
      input.role,
      JSON.stringify(input.personality),
      JSON.stringify(input.interests),
      input.background,
      input.writingStyle,
      input.styleNotes,
      JSON.stringify(input.rules),
      input.avatarHue,
      input.avatarGlyph,
      input.isRealPersonSim,
      id,
    );
    if (input.worldId !== row.world_id) {
      // Beziehungen und Gruppen gehören zu einer Welt – beim Weltwechsel entfernen, um Inkonsistenzen zu vermeiden.
      run(ctx.db, 'DELETE FROM relationships WHERE a_id = ? OR b_id = ?', id, id);
      run(ctx.db, 'DELETE FROM group_members WHERE character_id = ?', id);
    }
  });
  return getCharacter(ctx, id).character;
}

export function deleteCharacter(ctx: AppContext, id: string): void {
  const row = getCharacterRow(ctx, id);
  if (!row.is_custom) throw forbidden('Vorgefertigte Charaktere können nicht gelöscht werden.');
  run(ctx.db, 'DELETE FROM characters WHERE id = ?', id);
}
