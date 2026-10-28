import { z } from 'zod';
import { AVATAR_GLYPHS, LIMITS } from '../../../shared/constants';
import { REWARDS } from '../../../shared/progress';
import type { UserProfileDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { run } from '../db/database';
import { badRequest } from '../lib/errors';
import { cleanText } from '../lib/text';
import { getProfileRow } from './mappers';
import { rewardUnlocked } from './progress';

export function getProfile(ctx: AppContext): UserProfileDto {
  const row = getProfileRow(ctx);
  return {
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio,
    avatarHue: row.avatar_hue,
    avatarGlyph: row.avatar_glyph as UserProfileDto['avatarGlyph'],
    titleReward: row.title_reward,
    accentReward: row.accent_reward,
    frameItem: row.frame_item,
    bannerItem: row.banner_item,
    createdAt: row.created_at,
  };
}

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(LIMITS.profileName),
    handle: z
      .string()
      .trim()
      .min(2)
      .max(LIMITS.characterHandle)
      .regex(/^[a-z0-9_]+$/i, 'Nur Buchstaben, Zahlen und Unterstriche'),
    bio: z.string().max(LIMITS.profileBio),
    avatarHue: z.number().int().min(0).max(359),
    avatarGlyph: z.enum(AVATAR_GLYPHS),
    titleReward: z.string().max(60),
    accentReward: z.string().max(60),
  })
  .partial()
  .strict();

export function updateProfile(ctx: AppContext, input: unknown): UserProfileDto {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_profile', 'Ungültige Profildaten.', parsed.error.issues);
  const patch = parsed.data;
  for (const [field, type] of [
    ['titleReward', 'title'],
    ['accentReward', 'accent'],
  ] as const) {
    const id = patch[field];
    if (id === undefined) continue;
    const reward = REWARDS.find((r) => r.id === id && r.type === type);
    if (!reward) throw badRequest('invalid_reward', 'Unbekannte Belohnung.');
    if (!rewardUnlocked(ctx, id)) throw badRequest('reward_locked', 'Diese Belohnung ist noch nicht freigeschaltet.');
  }
  const current = getProfile(ctx);
  const next = {
    ...current,
    ...patch,
    displayName: patch.displayName !== undefined ? cleanText(patch.displayName) : current.displayName,
    bio: patch.bio !== undefined ? cleanText(patch.bio) : current.bio,
    handle: patch.handle !== undefined ? patch.handle.toLowerCase() : current.handle,
  };
  if (!next.displayName) throw badRequest('invalid_profile', 'Der Anzeigename darf nicht leer sein.');
  run(
    ctx.db,
    `UPDATE user_profile SET display_name = ?, handle = ?, bio = ?, avatar_hue = ?, avatar_glyph = ?, title_reward = ?,
            accent_reward = ? WHERE id = 1`,
    next.displayName,
    next.handle,
    next.bio,
    next.avatarHue,
    next.avatarGlyph,
    next.titleReward,
    next.accentReward,
  );
  return getProfile(ctx);
}
