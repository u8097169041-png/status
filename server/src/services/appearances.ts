/**
 * Aussehen und Profilbilder der Social-Figuren. Das Aussehen ist pro Figur fest (gespeichert oder deterministisch
 * abgeleitet) und wird für Fotos und das gezeichnete Ersatzporträt gleichermaßen verwendet.
 */
import { createHash } from 'node:crypto';
import { deriveAppearance, normalizeAppearance, portraitSvg, type Appearance } from '../../../shared/appearance';
import type { CharacterAppearanceDto, ImageJobDto } from '../../../shared/types';
import { SEED_APPEARANCES } from '../content/seedAppearances';
import type { AppContext } from '../context';
import { get, run } from '../db/database';
import { notFound } from '../lib/errors';
import { imageUrlOf } from '../images/imageService';
import { portraitPrompt } from '../images/prompts';
import { getSettings } from './settings';

interface AppearanceRow {
  id: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  appearance: string;
  avatar_image_id: string | null;
  world_id: string | null;
}

/** Stabiler, positiver Seed aus einer ID – gleiche Figur ⇒ gleicher Seed ⇒ möglichst gleiches Gesicht. */
export function stableSeed(id: string): number {
  return createHash('sha256').update(id).digest().readUInt32BE(0) & 0x7fffffff;
}

/** Alter aus Texten wie „Buchhändlerin (29)“ oder „Lena Vogt, 29,“. */
export function ageHint(...texts: string[]): number | null {
  for (const t of texts) {
    const m = /\((\d{2})\)|,\s(\d{2}),/.exec(t);
    if (m) return Number(m[1] ?? m[2]);
  }
  return null;
}

export function appearanceFor(id: string, role: string, stored: string, texts: string[] = []): Appearance {
  const seeded = SEED_APPEARANCES[id];
  const derived = deriveAppearance(id, { role, age: seeded?.age ?? ageHint(...texts), gender: seeded?.gender ?? null });
  const base = seeded ? normalizeAppearance({ ...derived, ...seeded }, derived) : derived;
  if (!stored) return base;
  try {
    return normalizeAppearance(JSON.parse(stored), base);
  } catch {
    return base;
  }
}

function row(ctx: AppContext, id: string): AppearanceRow {
  const r = get<AppearanceRow>(
    ctx.db,
    'SELECT id, name, role, tagline, description, appearance, avatar_image_id, world_id FROM characters WHERE id = ?',
    id,
  );
  if (!r) throw notFound('Charakter');
  return r;
}

export function characterAppearance(ctx: AppContext, id: string): Appearance {
  const r = row(ctx, id);
  return appearanceFor(r.id, r.role, r.appearance, [r.tagline, r.description]);
}

export function getCharacterAppearance(ctx: AppContext, id: string): CharacterAppearanceDto {
  const r = row(ctx, id);
  const appearance = appearanceFor(r.id, r.role, r.appearance, [r.tagline, r.description]);
  const image = ctx.images.getImage(r.avatar_image_id);
  return {
    characterId: r.id,
    appearance,
    custom: Boolean(r.appearance),
    photoUrl: imageUrlOf(image?.file),
    pendingJob: ctx.images.pendingFor('character', r.id, 'avatar'),
  };
}

export function setCharacterAppearance(ctx: AppContext, id: string, input: unknown): CharacterAppearanceDto {
  const current = characterAppearance(ctx, id);
  const next = normalizeAppearance(input, current);
  // Ein neues Aussehen passt nicht mehr zum alten Foto – es wird bei Bedarf neu erzeugt.
  run(ctx.db, 'UPDATE characters SET appearance = ?, avatar_image_id = NULL WHERE id = ?', JSON.stringify(next), id);
  return getCharacterAppearance(ctx, id);
}

export function removeCharacterPhoto(ctx: AppContext, id: string): CharacterAppearanceDto {
  row(ctx, id);
  run(ctx.db, 'UPDATE characters SET avatar_image_id = NULL WHERE id = ?', id);
  return getCharacterAppearance(ctx, id);
}

/** Profilfoto anfordern (bei Bild-KI). null = keine Bild-KI erreichbar (gezeichnetes Porträt bleibt). */
export async function requestCharacterAvatar(ctx: AppContext, id: string, priority: 'user' | 'background'): Promise<ImageJobDto | null> {
  const r = row(ctx, id);
  const appearance = appearanceFor(r.id, r.role, r.appearance, [r.tagline, r.description]);
  const world = r.world_id ? get<{ atmosphere: string }>(ctx.db, 'SELECT atmosphere FROM worlds WHERE id = ?', r.world_id) : null;
  // Neues Foto auf Wunsch: anderer Seed als das vorige, sonst gleicher Seed (Cache-Treffer).
  const seed = priority === 'user' && r.avatar_image_id ? (stableSeed(`${r.id}:${Date.now()}`) & 0x7fffffff) : stableSeed(r.id);
  return ctx.images.request({
    kind: 'avatar',
    ownerType: 'character',
    ownerId: r.id,
    prompt: portraitPrompt(appearance, { role: r.role, setting: world?.atmosphere ?? '' }),
    caption: r.name,
    seed,
    size: 'portrait',
    priority,
    onDone: (imageId) => run(ctx.db, 'UPDATE characters SET avatar_image_id = ? WHERE id = ?', imageId, r.id),
  });
}

/** Beim Öffnen eines Chats: fehlendes Profilfoto leise im Hintergrund erzeugen (falls erlaubt und Bild-KI da). */
export function ensureAvatarInBackground(ctx: AppContext, id: string): void {
  if (!getSettings(ctx.db).images.autoAvatars) return;
  const r = get<{ avatar_image_id: string | null }>(ctx.db, 'SELECT avatar_image_id FROM characters WHERE id = ?', id);
  if (!r || ctx.images.getImage(r.avatar_image_id)) return;
  void requestCharacterAvatar(ctx, id, 'background').catch(() => undefined);
}

/** Profilbild als Datei (Foto) oder SVG (gezeichnet) – mit ETag für schnelles Neuladen. */
export function avatarResponse(ctx: AppContext, id: string): { kind: 'file'; path: string; etag: string } | { kind: 'svg'; svg: string; etag: string } {
  const r = row(ctx, id);
  const image = ctx.images.getImage(r.avatar_image_id);
  if (image?.file) {
    const path = ctx.images.filePath(image.file);
    if (path) return { kind: 'file', path, etag: `"${image.id}"` };
  }
  const appearance = appearanceFor(r.id, r.role, r.appearance, [r.tagline, r.description]);
  const svg = portraitSvg(appearance, r.id, r.name);
  return { kind: 'svg', svg, etag: `"${createHash('sha1').update(svg).digest('hex').slice(0, 16)}"` };
}
