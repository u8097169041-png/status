import { z } from 'zod';
import { GENRES, LIMITS, WRITING_STYLES, type Genre, type Lang } from '../../../shared/constants';
import type { CharacterInput, ProgressDelta, WorldDraft } from '../../../shared/types';
import type { AppContext } from '../context';
import { tx } from '../db/database';
import { GENERIC_PERSONALITY, GENRE_POOLS, WORLDGEN_TEXT } from '../content/worldgenPools';
import { badRequest } from '../lib/errors';
import { createRng, type Rng } from '../lib/rng';
import { cleanText, fill, truncate } from '../lib/text';
import { insertCharacter, parseCharacterInput } from './characters';
import { recordAction } from './progress';
import { getLanguage } from './settings';
import { insertWorld, parseWorldInput, recordWorldCreated } from './worlds';

const generateSchema = z.object({
  genre: z.enum(GENRES),
  prompt: z.string().max(500).default(''),
  characterCount: z.number().int().min(0).max(4).default(3),
  useAi: z.boolean().default(true),
  seed: z.string().max(60).optional(),
});

function pickDistinct<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return rng.shuffle(items).slice(0, Math.min(count, items.length));
}

/** Lokaler, regelbasierter Weltgenerator (ohne KI, ohne Kosten). */
export function generateLocalDraft(genre: Genre, prompt: string, characterCount: number, lang: Lang, seed: string): WorldDraft {
  const rng = createRng(seed);
  const pool = GENRE_POOLS[genre];
  const t = (l: { de: string; en: string }) => l[lang];
  const name = t(rng.pick(pool.namePrefix)) + t(rng.pick(pool.nameSuffix));
  const [faction1, faction2] = pickDistinct(rng, pool.factions, 2).map(t);
  const description = fill(t(WORLDGEN_TEXT.description), {
    name,
    faction1,
    faction2,
    place: t(rng.pick(pool.places)),
    conflict: t(rng.pick(pool.conflicts)),
  });
  const cleanPrompt = cleanText(prompt);
  const world = {
    name,
    tagline: t(rng.pick(pool.taglines)),
    genre,
    description: cleanPrompt
      ? `${description}\n\n${fill(t(WORLDGEN_TEXT.inspired), { prompt: truncate(cleanPrompt, 300) })}`
      : description,
    lore: t(rng.pick(pool.lore)),
    atmosphere: t(rng.pick(pool.atmospheres)),
    rules: pickDistinct(rng, pool.rules, 3).map(t),
    artStyle: pool.artStyle,
    hue: rng.int(pool.hue[0], pool.hue[1]),
  };
  const firstNames = rng.shuffle(pool.firstNames);
  const lastNames = rng.shuffle(pool.lastNames);
  const characters: Omit<CharacterInput, 'worldId'>[] = [];
  for (let i = 0; i < characterCount; i++) {
    const charName = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const role = t(rng.pick(pool.roles));
    const traits = pickDistinct(rng, GENERIC_PERSONALITY, 3).map(t);
    const interests = pickDistinct(rng, pool.interests, 2).map(t);
    characters.push({
      name: charName,
      handle: '',
      tagline: fill(t(WORLDGEN_TEXT.characterTagline), { role, world: name, interest: interests[0] ?? '' }),
      description: fill(t(WORLDGEN_TEXT.characterDescription), { name: charName, trait1: traits[0], trait2: traits[1], role, world: name }),
      role,
      personality: traits,
      interests,
      background: fill(t(WORLDGEN_TEXT.characterBackground), { name: charName, world: name, faction1, faction2 }),
      writingStyle: rng.pick(WRITING_STYLES),
      styleNotes: '',
      rules: [],
      avatarHue: (world.hue + rng.int(-60, 60) + 360) % 360,
      avatarGlyph: rng.pick(['initials', 'spark', 'moon', 'leaf', 'wave', 'gear', 'star', 'flame', 'eye', 'feather'] as const),
      isRealPersonSim: false,
    });
  }
  return { ...world, characters, source: 'demo' };
}

const aiDraftSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().default(''),
  description: z.string().default(''),
  lore: z.string().default(''),
  atmosphere: z.string().default(''),
  rules: z.array(z.string()).default([]),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().default(''),
        tagline: z.string().default(''),
        description: z.string().default(''),
        personality: z.array(z.string()).default([]),
        interests: z.array(z.string()).default([]),
        background: z.string().default(''),
        writingStyle: z.string().default('casual'),
      }),
    )
    .default([]),
});

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function generateAiDraft(
  ctx: AppContext,
  genre: Genre,
  prompt: string,
  characterCount: number,
  lang: Lang,
  fallback: WorldDraft,
): Promise<WorldDraft | { error: string }> {
  const language = lang === 'de' ? 'German' : 'English';
  const result = await ctx.ai.complete({
    purpose: 'generator',
    kind: 'world',
    maxTokens: 1500,
    messages: [
      {
        role: 'system',
        content:
          'You design fictional worlds for a social media role-play simulation. All characters are fictional; never use real people. ' +
          'Answer with ONLY one JSON object, no markdown, no commentary.',
      },
      {
        role: 'user',
        content:
          `Genre: ${genre}. Language for all text: ${language}. ` +
          (prompt ? `User idea: """${truncate(prompt, 400)}""". ` : '') +
          `Create ${characterCount} characters. JSON schema: {"name": string (max 40 chars), "tagline": string (max 150), ` +
          `"description": string (max 600), "lore": string (max 600), "atmosphere": string (max 150), "rules": string[3-5], ` +
          `"characters": [{"name": string, "role": string, "tagline": string, "description": string, "personality": string[3], ` +
          `"interests": string[2-3], "background": string, "writingStyle": one of ${WRITING_STYLES.join('|')}}]}`,
      },
    ],
  });
  if (!result.ok) return { error: result.code };
  const parsed = aiDraftSchema.safeParse(extractJson(result.text));
  if (!parsed.success) return { error: 'invalid_response' };
  const d = parsed.data;
  const cut = (s: string, n: number) => truncate(cleanText(s), n);
  return {
    name: cut(d.name, LIMITS.worldName),
    tagline: cut(d.tagline, LIMITS.worldShortText),
    genre,
    description: cut(d.description, LIMITS.worldLongText),
    lore: cut(d.lore, LIMITS.worldLongText),
    atmosphere: cut(d.atmosphere, LIMITS.worldShortText),
    rules: d.rules.map((r) => cut(r, LIMITS.worldRule)).filter(Boolean).slice(0, LIMITS.worldRules),
    artStyle: fallback.artStyle,
    hue: fallback.hue,
    source: 'ai',
    characters: d.characters.slice(0, characterCount).map((c, i) => ({
      ...fallback.characters[i],
      name: cut(c.name, LIMITS.characterName),
      role: cut(c.role, LIMITS.characterShortText),
      tagline: cut(c.tagline, LIMITS.characterShortText),
      description: cut(c.description, LIMITS.characterLongText),
      personality: c.personality.map((p) => cut(p, LIMITS.characterListItem)).filter(Boolean).slice(0, 6),
      interests: c.interests.map((p) => cut(p, LIMITS.characterListItem)).filter(Boolean).slice(0, 6),
      background: cut(c.background, LIMITS.characterLongText),
      writingStyle: (WRITING_STYLES as readonly string[]).includes(c.writingStyle)
        ? (c.writingStyle as CharacterInput['writingStyle'])
        : 'casual',
    })),
  };
}

export async function generateDraft(ctx: AppContext, input: unknown): Promise<WorldDraft> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_generator_input', 'Ungültige Generator-Eingabe.', parsed.error.issues);
  const { genre, prompt, characterCount, useAi } = parsed.data;
  const lang = getLanguage(ctx.db);
  const seed = parsed.data.seed ?? `${genre}:${prompt}:${ctx.now().getTime()}`;
  const local = generateLocalDraft(genre, prompt, characterCount, lang, seed);
  if (!useAi || !ctx.ai.isActive('world')) return local;
  const ai = await generateAiDraft(ctx, genre, prompt, characterCount, lang, local);
  if ('error' in ai) return { ...local, notice: ai.error };
  return ai;
}

const createSchema = z.object({
  world: z.unknown(),
  characters: z.array(z.unknown()).max(6).default([]),
});

export function createWorldWithCharacters(ctx: AppContext, input: unknown): { worldId: string; progress: ProgressDelta } {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_world', 'Ungültige Weltdaten.', parsed.error.issues);
  const world = parseWorldInput(parsed.data.world);
  const characters = parsed.data.characters.map((c) => parseCharacterInput({ ...(c as object), worldId: null }));
  const { worldId, characterIds } = tx(ctx.db, () => {
    const id = insertWorld(ctx, world);
    const ids = characters.map((c) => insertCharacter(ctx, { ...c, worldId: id }, { strictHandle: false }));
    return { worldId: id, characterIds: ids };
  });
  let progress = recordWorldCreated(ctx, worldId);
  for (const id of characterIds) {
    const delta = recordAction(ctx, 'createCharacter', id);
    progress = {
      xpGained: progress.xpGained + delta.xpGained,
      levelUp: delta.levelUp ?? progress.levelUp,
      achievementsUnlocked: [...progress.achievementsUnlocked, ...delta.achievementsUnlocked],
    };
  }
  return { worldId, progress };
}
