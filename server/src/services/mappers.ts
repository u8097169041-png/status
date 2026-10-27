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
  xp: number;
  created_at: string;
}

export const CHARACTER_SUMMARY_SQL = `
  SELECT c.*, w.name AS world_name,
         (SELECT COUNT(*) FROM posts p WHERE p.character_id = c.id) AS post_count
    FROM characters c LEFT JOIN worlds w ON w.id = c.world_id`;

export function toCharacterSummary(row: CharacterRow & { world_name: string | null; post_count: number }): CharacterSummary {
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

export function userAuthor(profile: ProfileRow): AuthorRef {
  return {
    type: 'user',
    id: null,
    name: profile.display_name,
    handle: profile.handle,
    avatarHue: profile.avatar_hue,
    avatarGlyph: profile.avatar_glyph as AvatarGlyph,
    isRealPersonSim: false,
    worldId: null,
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
  };
}

/** SQL-Spalten für den Charakter-Autor (Alias c). */
export const AUTHOR_COLUMNS = `c.id AS c_id, c.name AS c_name, c.handle AS c_handle, c.avatar_hue AS c_hue,
  c.avatar_glyph AS c_glyph, c.is_real_person_sim AS c_real, c.world_id AS c_world`;
