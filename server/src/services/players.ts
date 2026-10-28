import { z } from 'zod';
import { AVATAR_GLYPHS, LIMITS, type Lang } from '../../../shared/constants';
import { levelInfo } from '../../../shared/progress';
import { GOAL_TYPES } from '../../../shared/skills';
import type { JoinWorldInput, PlayerDto, ProgressDelta } from '../../../shared/types';
import { PLAYER_TEXT } from '../content/decisionTemplates';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText, fill } from '../lib/text';
import { getCharacterRow, insertCharacter } from './characters';
import { createIntroDecision } from './decisions';
import { toCharacterRef, toCharacterSummary } from './mappers';
import { notify } from './notifications';
import { mergeDelta, recordAction, recordWorldVisit } from './progress';
import { refreshQuests } from './quests';
import { getLanguage } from './settings';
import { ensureRole, skillLevels, skillPoints } from './skills';

export interface PlayerRow {
  id: string;
  world_id: string;
  character_id: string;
  mode: 'custom' | 'existing';
  is_active: number;
  reputation: number;
  influence: number;
  followers: number;
  xp: number;
  joined_at: string;
  last_active_at: string;
  retired_at: string | null;
  archetype: string;
  goal_type: string;
}

export function getPlayerRow(ctx: AppContext, id: string): PlayerRow {
  const row = get<PlayerRow>(ctx.db, 'SELECT * FROM players WHERE id = ?', id);
  if (!row) throw notFound('Spielfigur');
  return row;
}

export function getActivePlayerRow(ctx: AppContext, worldId: string): PlayerRow | undefined {
  return get<PlayerRow>(ctx.db, 'SELECT * FROM players WHERE world_id = ? AND is_active = 1', worldId);
}

/** Aktive Spielfigur einer Welt oder Fehler 409, wenn der Nutzer der Welt nicht beigetreten ist. */
export function requireActivePlayer(ctx: AppContext, worldId: string): PlayerRow {
  const row = getActivePlayerRow(ctx, worldId);
  if (!row) throw new AppError(409, 'not_joined', 'Tritt der Welt zuerst bei, um hier mitzumachen.');
  return row;
}

export function toPlayer(ctx: AppContext, row: PlayerRow): PlayerDto {
  const role = ensureRole(ctx, row);
  const character = getCharacterRow(ctx, row.character_id);
  const world = get<{ name: string; hue: number }>(ctx.db, 'SELECT name, hue FROM worlds WHERE id = ?', row.world_id);
  const pending =
    get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'pending'`, row.id)?.n ?? 0;
  return {
    id: row.id,
    worldId: row.world_id,
    worldName: world?.name ?? '',
    worldHue: world?.hue ?? 0,
    mode: row.mode,
    isActive: Boolean(row.is_active),
    character: {
      ...toCharacterSummary(character),
      background: character.background,
      goals: parseJson<string[]>(character.goals, []),
      personality: parseJson<string[]>(character.personality, []),
    },
    reputation: row.reputation,
    influence: row.influence,
    followers: row.followers,
    xp: row.xp,
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
    retiredAt: row.retired_at,
    pendingDecisions: pending,
    level: levelInfo(row.xp),
    archetype: role.archetype,
    goalType: role.goalType,
    skills: skillLevels(ctx, row.id),
    skillPoints: skillPoints(ctx, row),
  };
}

export function listPlayers(ctx: AppContext, worldId?: string): PlayerDto[] {
  const rows = worldId
    ? all<PlayerRow>(ctx.db, 'SELECT * FROM players WHERE world_id = ? ORDER BY is_active DESC, last_active_at DESC', worldId)
    : all<PlayerRow>(ctx.db, 'SELECT * FROM players ORDER BY is_active DESC, last_active_at DESC');
  return rows.map((r) => toPlayer(ctx, r));
}

/** Charaktere, die nicht autonom handeln: eigene Spielfiguren und aktuell gespielte Figuren. */
export function controlledCharacterIds(ctx: AppContext, worldId: string): Set<string> {
  return new Set(
    all<{ id: string }>(
      ctx.db,
      `SELECT character_id AS id FROM players WHERE world_id = ? AND is_active = 1
       UNION SELECT id FROM characters WHERE world_id = ? AND is_player = 1`,
      worldId,
      worldId,
    ).map((r) => r.id),
  );
}

// ---- Aktive Welt ----

export function activeWorldId(ctx: AppContext): string | null {
  const id = get<{ active_world_id: string | null }>(ctx.db, 'SELECT active_world_id FROM user_profile WHERE id = 1')?.active_world_id;
  if (!id) return null;
  // Nur gültig, solange es dort eine aktive Spielfigur gibt.
  return getActivePlayerRow(ctx, id) ? id : null;
}

export function setActiveWorld(ctx: AppContext, worldId: string | null): void {
  if (worldId) requireActivePlayer(ctx, worldId);
  run(ctx.db, 'UPDATE user_profile SET active_world_id = ? WHERE id = 1', worldId);
  if (worldId) run(ctx.db, 'UPDATE players SET last_active_at = ? WHERE world_id = ? AND is_active = 1', ctx.now().toISOString(), worldId);
}

// ---- Beitritt und Wechsel ----

const joinSchema = z.object({
  mode: z.enum(['custom', 'existing']),
  characterId: z.string().max(80).optional(),
  character: z
    .object({
      name: z.string().trim().min(1).max(LIMITS.characterName),
      background: z.string().trim().max(LIMITS.characterLongText).default(''),
      role: z.string().trim().max(LIMITS.characterShortText).default(''),
      personality: z.array(z.string().trim().min(1).max(LIMITS.characterListItem)).max(LIMITS.characterListItems).default([]),
      goals: z.array(z.string().trim().min(1).max(LIMITS.characterRule)).max(LIMITS.playerGoals).default([]),
      avatarHue: z.number().int().min(0).max(359).default(200),
      avatarGlyph: z.enum(AVATAR_GLYPHS).default('initials'),
      isRealPersonSim: z.boolean().default(false),
    })
    .optional(),
  goalType: z.enum(GOAL_TYPES).optional(),
  confirmSwitch: z.boolean().optional(),
});

function retireActive(ctx: AppContext, worldId: string): void {
  run(
    ctx.db,
    'UPDATE players SET is_active = 0, retired_at = ? WHERE world_id = ? AND is_active = 1',
    ctx.now().toISOString(),
    worldId,
  );
}

function arrivalEvent(ctx: AppContext, worldId: string, characterId: string, lang: Lang, switched: boolean): void {
  const c = getCharacterRow(ctx, characterId);
  const world = get<{ name: string; day: number }>(ctx.db, 'SELECT name, day FROM worlds WHERE id = ?', worldId)!;
  const vars = { player: c.name, world: world.name, role: c.role || (lang === 'de' ? 'Neuankömmling' : 'newcomer') };
  run(
    ctx.db,
    `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, created_at)
     VALUES (?, ?, ?, 'arrival', ?, ?, 'user', '[]', ?, ?)`,
    newId('e'),
    worldId,
    world.day,
    fill((switched ? PLAYER_TEXT.switchTitle : PLAYER_TEXT.joinTitle)[lang], vars),
    fill(PLAYER_TEXT.joinDescription[lang], vars),
    JSON.stringify([toCharacterRef(c)]),
    ctx.now().toISOString(),
  );
}

export function joinWorld(ctx: AppContext, worldId: string, raw: unknown): { player: PlayerDto; progress: ProgressDelta } {
  const world = get<{ id: string }>(ctx.db, 'SELECT id FROM worlds WHERE id = ?', worldId);
  if (!world) throw notFound('Welt');
  const parsed = joinSchema.safeParse(raw);
  if (!parsed.success) throw badRequest('invalid_join', 'Ungültige Angaben zur Spielfigur.', parsed.error.issues);
  const input = parsed.data as JoinWorldInput;
  const lang = getLanguage(ctx.db);
  const existingActive = getActivePlayerRow(ctx, worldId);
  if (existingActive && !input.confirmSwitch) {
    throw new AppError(409, 'already_joined', 'Du spielst in dieser Welt bereits eine Figur. Bestätige den Wechsel.');
  }

  const playerId = tx(ctx.db, () => {
    const now = ctx.now().toISOString();
    let characterId: string;
    let reactivate: PlayerRow | undefined;
    if (input.mode === 'existing') {
      if (!input.characterId) throw badRequest('missing_character', 'Bitte wähle eine Figur.');
      const c = getCharacterRow(ctx, input.characterId);
      if (c.world_id !== worldId) throw badRequest('invalid_character', 'Diese Figur gehört nicht zu dieser Welt.');
      if (c.is_player) throw badRequest('invalid_character', 'Diese Figur ist bereits eine Spielfigur.');
      if (existingActive?.character_id === c.id) throw new AppError(409, 'already_playing', 'Diese Figur spielst du bereits.');
      characterId = c.id;
      // Wurde die Figur früher schon gespielt, wird dieser Spielstand fortgesetzt.
      reactivate = get<PlayerRow>(ctx.db, 'SELECT * FROM players WHERE world_id = ? AND character_id = ? AND is_active = 0', worldId, c.id);
    } else {
      const ch = input.character;
      if (!ch) throw badRequest('missing_character', 'Bitte beschreibe deine Figur.');
      const name = cleanText(ch.name);
      if (!name) throw badRequest('missing_character', 'Bitte gib einen Namen an.');
      characterId = insertCharacter(
        ctx,
        {
          name,
          handle: '',
          tagline: cleanText(ch.role),
          description: cleanText(ch.background),
          role: cleanText(ch.role),
          worldId,
          personality: ch.personality.map(cleanText).filter(Boolean),
          interests: [],
          background: cleanText(ch.background),
          writingStyle: 'casual',
          styleNotes: '',
          rules: [],
          goals: ch.goals.map(cleanText).filter(Boolean),
          avatarHue: ch.avatarHue,
          avatarGlyph: ch.avatarGlyph,
          isRealPersonSim: Boolean(ch.isRealPersonSim),
        },
        { strictHandle: false, isPlayer: true },
      );
    }
    if (existingActive) retireActive(ctx, worldId);
    let id: string;
    if (reactivate) {
      id = reactivate.id;
      run(ctx.db, 'UPDATE players SET is_active = 1, retired_at = NULL, last_active_at = ? WHERE id = ?', now, id);
      if (input.goalType) run(ctx.db, 'UPDATE players SET goal_type = ? WHERE id = ?', input.goalType, id);
    } else {
      id = newId('pl');
      const c = getCharacterRow(ctx, characterId);
      const famous = input.mode === 'existing' && Boolean(c.prominent);
      run(
        ctx.db,
        `INSERT INTO players (id, world_id, character_id, mode, is_active, reputation, influence, followers, xp, joined_at, last_active_at, goal_type)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?)`,
        id,
        worldId,
        characterId,
        input.mode,
        input.mode === 'existing' ? 10 : 0,
        famous ? 45 : input.mode === 'existing' ? 25 : 10,
        famous ? 12000 : input.mode === 'existing' ? 900 : 25,
        now,
        now,
        input.goalType ?? '',
      );
    }
    run(ctx.db, 'UPDATE user_profile SET active_world_id = ? WHERE id = 1', worldId);
    arrivalEvent(ctx, worldId, characterId, lang, Boolean(existingActive));
    if (!reactivate) createIntroDecision(ctx, worldId, id);
    refreshQuests(ctx, id);
    notify(ctx, 'joinedWorld', { world: get<{ name: string }>(ctx.db, 'SELECT name FROM worlds WHERE id = ?', worldId)!.name }, '/feed', worldId);
    return id;
  });

  let progress = recordAction(ctx, 'joinWorld', worldId, playerId);
  progress = mergeDelta(progress, recordWorldVisit(ctx, worldId));
  return { player: toPlayer(ctx, getPlayerRow(ctx, playerId)), progress };
}

/** Wechselt zu einer früheren Spielfigur derselben Welt zurück. Die bisherige bleibt gespeichert. */
export function activatePlayer(ctx: AppContext, playerId: string): PlayerDto {
  const row = getPlayerRow(ctx, playerId);
  if (!row.is_active) {
    tx(ctx.db, () => {
      retireActive(ctx, row.world_id);
      run(ctx.db, 'UPDATE players SET is_active = 1, retired_at = NULL, last_active_at = ? WHERE id = ?', ctx.now().toISOString(), playerId);
      run(ctx.db, 'UPDATE user_profile SET active_world_id = ? WHERE id = 1', row.world_id);
      arrivalEvent(ctx, row.world_id, row.character_id, getLanguage(ctx.db), true);
    });
  } else {
    setActiveWorld(ctx, row.world_id);
  }
  return toPlayer(ctx, getPlayerRow(ctx, playerId));
}

/** Verlässt eine Welt: Die Spielfigur wird inaktiv, alle Daten bleiben erhalten. */
export function leaveWorld(ctx: AppContext, worldId: string): void {
  requireActivePlayer(ctx, worldId);
  tx(ctx.db, () => {
    retireActive(ctx, worldId);
    run(ctx.db, 'UPDATE user_profile SET active_world_id = NULL WHERE id = 1 AND active_world_id = ?', worldId);
  });
}

/** Spielwerte begrenzen und speichern. */
export function adjustPlayerStats(
  ctx: AppContext,
  playerId: string,
  delta: { reputation?: number; influence?: number; followers?: number },
): void {
  const p = getPlayerRow(ctx, playerId);
  run(
    ctx.db,
    'UPDATE players SET reputation = ?, influence = ?, followers = ?, last_active_at = ? WHERE id = ?',
    Math.max(-100, Math.min(100, p.reputation + (delta.reputation ?? 0))),
    Math.max(0, Math.min(100, p.influence + (delta.influence ?? 0))),
    Math.max(0, p.followers + (delta.followers ?? 0)),
    ctx.now().toISOString(),
    playerId,
  );
}
