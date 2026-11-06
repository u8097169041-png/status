/**
 * Figuren einer Lebensgeschichte: Steckbrief, Werte gegenüber der Spielfigur, Aussehen und Profilbild.
 * Aus dem Social-Modus übernommene Figuren behalten Aussehen und Foto (gleiche Figur in beiden Modi).
 */
import { createHash } from 'node:crypto';
import { deriveAppearance, normalizeAppearance, portraitSvg, type Appearance } from '../../../shared/appearance';
import type { CharacterStance, LifeCharacterDto, LifeCharacterStatus } from '../../../shared/life';
import type { AppContext } from '../context';
import { all, get, parseJson, run } from '../db/database';
import { notFound } from '../lib/errors';
import { portraitPrompt } from '../images/prompts';
import { characterAppearance, stableSeed } from '../services/appearances';
import { getSettings } from '../services/settings';

export interface LifeCharacterRow {
  id: string;
  story_id: string;
  name: string;
  role: string;
  description: string;
  personality: string;
  goals: string;
  secrets: string;
  appearance: string;
  status: LifeCharacterStatus;
  affinity: number;
  trust: number;
  loyalty: number;
  fear: number;
  stance: CharacterStance;
  importance: number;
  social_character_id: string | null;
  avatar_image_id: string | null;
  status_turn: number | null;
  status_note: string;
  created_at: string;
}

export function lifeAppearance(ctx: AppContext, c: Pick<LifeCharacterRow, 'id' | 'role' | 'appearance' | 'social_character_id'>): Appearance {
  if (c.social_character_id && get(ctx.db, 'SELECT 1 FROM characters WHERE id = ?', c.social_character_id)) {
    return characterAppearance(ctx, c.social_character_id);
  }
  const derived = deriveAppearance(c.id, { role: c.role });
  try {
    return normalizeAppearance(JSON.parse(c.appearance || '{}'), derived);
  } catch {
    return derived;
  }
}

export function listLifeCharacters(ctx: AppContext, storyId: string): LifeCharacterRow[] {
  return all<LifeCharacterRow>(ctx.db, 'SELECT * FROM life_characters WHERE story_id = ? ORDER BY importance DESC, created_at, name', storyId);
}

export function getLifeCharacter(ctx: AppContext, id: string): LifeCharacterRow {
  const row = get<LifeCharacterRow>(ctx.db, 'SELECT * FROM life_characters WHERE id = ?', id);
  if (!row) throw notFound('Figur');
  return row;
}

/** Foto der Figur: eigenes Foto, sonst das Foto der verknüpften Social-Figur. */
function photoOf(ctx: AppContext, c: LifeCharacterRow): string | null {
  const own = ctx.images.getImage(c.avatar_image_id);
  if (own?.file) return own.file;
  if (c.social_character_id) {
    const social = get<{ avatar_image_id: string | null }>(ctx.db, 'SELECT avatar_image_id FROM characters WHERE id = ?', c.social_character_id);
    return ctx.images.getImage(social?.avatar_image_id)?.file ?? null;
  }
  return null;
}

export function toLifeCharacter(ctx: AppContext, c: LifeCharacterRow): LifeCharacterDto {
  const photo = photoOf(ctx, c);
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
    personality: parseJson<string[]>(c.personality, []),
    goals: parseJson<string[]>(c.goals, []),
    status: c.status,
    statusNote: c.status_note,
    affinity: c.affinity,
    trust: c.trust,
    loyalty: c.loyalty,
    fear: c.fear,
    stance: c.stance,
    appearance: lifeAppearance(ctx, c),
    avatarUrl: `/api/media/life-avatars/${c.id}${photo ? `?p=${photo.slice(4, 12)}` : ''}`,
    hasPhoto: Boolean(photo),
    fromSocial: Boolean(c.social_character_id),
  };
}

export function lifeAvatarResponse(ctx: AppContext, id: string): { kind: 'file'; path: string; etag: string } | { kind: 'svg'; svg: string; etag: string } {
  const story = get<{ id: string; player_appearance: string; player_name: string; player_role: string }>(
    ctx.db,
    'SELECT id, player_appearance, player_name, player_role FROM life_stories WHERE id = ?',
    id.replace(/^player:/, ''),
  );
  // Spielfigur: ID „player:<storyId>“.
  if (id.startsWith('player:') && story) {
    const appearance = playerAppearance(story);
    const svg = portraitSvg(appearance, `player:${story.id}`, story.player_name);
    return { kind: 'svg', svg, etag: `"${createHash('sha1').update(svg).digest('hex').slice(0, 16)}"` };
  }
  const c = getLifeCharacter(ctx, id);
  const photo = photoOf(ctx, c);
  if (photo) {
    const path = ctx.images.filePath(photo);
    if (path) return { kind: 'file', path, etag: `"${photo}"` };
  }
  const svg = portraitSvg(lifeAppearance(ctx, c), c.id, c.name);
  return { kind: 'svg', svg, etag: `"${createHash('sha1').update(svg).digest('hex').slice(0, 16)}"` };
}

export function playerAppearance(story: { id: string; player_appearance: string; player_role: string }): Appearance {
  const derived = deriveAppearance(`player:${story.id}`, { role: story.player_role });
  try {
    return normalizeAppearance(JSON.parse(story.player_appearance || '{}'), derived);
  } catch {
    return derived;
  }
}

/** Profilfoto einer Figur anfordern (nur mit Bild-KI). */
export async function requestLifeAvatar(ctx: AppContext, id: string, priority: 'user' | 'background') {
  const c = getLifeCharacter(ctx, id);
  const story = get<{ world: string }>(ctx.db, 'SELECT world FROM life_stories WHERE id = ?', c.story_id);
  const setting = parseJson<{ setting?: string }>(story?.world ?? '{}', {}).setting ?? '';
  return ctx.images.request({
    kind: 'avatar',
    ownerType: 'life_character',
    ownerId: c.id,
    prompt: portraitPrompt(lifeAppearance(ctx, c), { role: c.role, setting }),
    caption: c.name,
    seed: stableSeed(c.social_character_id ?? c.id),
    size: 'portrait',
    priority,
    onDone: (imageId) => run(ctx.db, 'UPDATE life_characters SET avatar_image_id = ? WHERE id = ?', imageId, c.id),
  });
}

export function ensureLifeAvatars(ctx: AppContext, storyId: string): void {
  if (!getSettings(ctx.db).images.autoAvatars || !ctx.images.available()) return;
  for (const c of listLifeCharacters(ctx, storyId).filter((x) => x.status !== 'dead').slice(0, 6)) {
    if (photoOf(ctx, c)) continue;
    void requestLifeAvatar(ctx, c.id, 'background').catch(() => undefined);
  }
}
