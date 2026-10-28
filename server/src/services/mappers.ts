import type { AvatarGlyph, WritingStyle } from '../../../shared/constants';
import type { AuthorRef, CharacterDetail, CharacterRef, CharacterSummary } from '../../../shared/types';
import type { AppContext } from '../context';
import { get, parseJson } from '../db/database';

export interface CharacterRow {
  id: string;
  world_id: string | null;
  name: string;
  handle: string;
  tagline: string;
  description: string;
  role: string;
  personality: string;
  interests: string;
  background: string;
  writing_style: string;
  style_notes: string;
  rules: string;
  avatar_hue: number;
  avatar_glyph: string;
  is_custom: number;
  is_real_person_sim: number;
  mood: string;
  goals: string;
  prominent: number;
  is_player: number;
  created_at: string;
}

export interface ProfileRow {
  display_name: string;
  handle: string;
  bio: string;
  avatar_hue: number;
  avatar_glyph: string;
  title_reward: string;
  accent_reward: string;
  frame_item: string;
  banner_item: string;
  active_world_id: string | null;
  xp: number;
  created_at: string;
}

export const CHARACTER_SUMMARY_SQL = `
  SELECT c.*, w.name AS world_name,
         (SELECT COUNT(*) FROM posts p WHERE p.character_id = c.id OR p.player_id IN
            (SELECT pl.id FROM players pl WHERE pl.character_id = c.id)) AS post_count,
         EXISTS (SELECT 1 FROM players pl WHERE pl.character_id = c.id AND pl.is_active = 1) AS played_by_you
    FROM characters c LEFT JOIN worlds w ON w.id = c.world_id`;

export type CharacterSummaryRow = CharacterRow & { world_name: string | null; post_count: number; played_by_you: number };

export function toCharacterSummary(row: CharacterSummaryRow): CharacterSummary {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    tagline: row.tagline,
    role: row.role,
    worldId: row.world_id,
    worldName: row.world_name,
    avatarHue: row.avatar_hue,
    avatarGlyph: row.avatar_glyph as AvatarGlyph,
    isCustom: Boolean(row.is_custom),
    isRealPersonSim: Boolean(row.is_real_person_sim),
    mood: row.mood,
    postCount: row.post_count,
    prominent: Boolean(row.prominent),
    isPlayer: Boolean(row.is_player),
    playedByYou: Boolean(row.played_by_you),
  };
}

export function toCharacterCore(row: CharacterRow) {
  return {
    description: row.description,
    personality: parseJson<string[]>(row.personality, []),
    interests: parseJson<string[]>(row.interests, []),
    background: row.background,
    writingStyle: row.writing_style as WritingStyle,
    styleNotes: row.style_notes,
    rules: parseJson<string[]>(row.rules, []),
    goals: parseJson<string[]>(row.goals, []),
    createdAt: row.created_at,
  } satisfies Partial<CharacterDetail>;
}

export function toCharacterRef(row: Pick<CharacterRow, 'id' | 'name' | 'avatar_hue' | 'avatar_glyph'>): CharacterRef {
  return { id: row.id, name: row.name, avatarHue: row.avatar_hue, avatarGlyph: row.avatar_glyph as AvatarGlyph };
}

export function getProfileRow(ctx: AppContext): ProfileRow {
  const row = get<ProfileRow>(ctx.db, 'SELECT * FROM user_profile WHERE id = 1');
  if (!row) throw new Error('Nutzerprofil fehlt – Datenbank wurde nicht initialisiert.');
  return row;
}

/** Spalten der Spielfigur eines eigenen Inhalts (Alias pc für den Charakter, pl für die Spielfigur). */
export const PLAYER_AUTHOR_COLUMNS = `pl.id AS pl_id, pc.name AS pc_name, pc.handle AS pc_handle, pc.avatar_hue AS pc_hue,
  pc.avatar_glyph AS pc_glyph, pc.is_real_person_sim AS pc_real, pc.world_id AS pc_world, pc.prominent AS pc_prominent`;

export interface PlayerAuthorColumns {
  pl_id: string | null;
  pc_name: string | null;
  pc_handle: string | null;
  pc_hue: number | null;
  pc_glyph: string | null;
  pc_real: number | null;
  pc_world: string | null;
  pc_prominent: number | null;
}

/** Autor eigener Inhalte: die Spielfigur (falls vorhanden), sonst das lokale Profil. */
export function userAuthor(profile: ProfileRow, player?: Partial<PlayerAuthorColumns>): AuthorRef {
  if (player?.pl_id && player.pc_name) {
    return {
      type: 'user',
      id: null,
      name: player.pc_name,
      handle: player.pc_handle ?? profile.handle,
      avatarHue: player.pc_hue ?? profile.avatar_hue,
      avatarGlyph: (player.pc_glyph ?? 'initials') as AvatarGlyph,
      isRealPersonSim: Boolean(player.pc_real),
      worldId: player.pc_world ?? null,
      verified: Boolean(player.pc_prominent),
      playerId: player.pl_id,
    };
  }
  return {
    type: 'user',
    id: null,
    name: profile.display_name,
    handle: profile.handle,
    avatarHue: profile.avatar_hue,
    avatarGlyph: profile.avatar_glyph as AvatarGlyph,
    isRealPersonSim: false,
    worldId: null,
    verified: false,
    playerId: null,
  };
}

export function characterAuthor(row: {
  c_id: string | null;
  c_name: string | null;
  c_handle: string | null;
  c_hue: number | null;
  c_glyph: string | null;
  c_real: number | null;
  c_world: string | null;
  c_prominent?: number | null;
}): AuthorRef {
  return {
    type: 'character',
    id: row.c_id,
    name: row.c_name ?? '?',
    handle: row.c_handle ?? 'unknown',
    avatarHue: row.c_hue ?? 0,
    avatarGlyph: (row.c_glyph ?? 'initials') as AvatarGlyph,
    isRealPersonSim: Boolean(row.c_real),
    worldId: row.c_world,
    verified: Boolean(row.c_prominent),
  };
}

/** SQL-Spalten für den Charakter-Autor (Alias c). */
export const AUTHOR_COLUMNS = `c.id AS c_id, c.name AS c_name, c.handle AS c_handle, c.avatar_hue AS c_hue,
  c.avatar_glyph AS c_glyph, c.is_real_person_sim AS c_real, c.world_id AS c_world, c.prominent AS c_prominent`;
