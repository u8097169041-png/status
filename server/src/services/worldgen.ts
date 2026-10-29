import { z } from 'zod';
import { GENRES, LIMITS, WRITING_STYLES, type Genre, type Lang } from '../../../shared/constants';
import type { CharacterInput, ProgressDelta, WorldDraft } from '../../../shared/types';
import type { AppContext } from '../context';
import { tx } from '../db/database';
import { GENERIC_PERSONALITY, GENRE_POOLS, WORLDGEN_TEXT } from '../content/worldgenPools';
import { badRequest } from '../lib/errors';
import { createRng, type Rng } from '../lib/rng';
import type { JsonSchema } from '../ai/types';
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

/** Feldlängen für KI-Entwürfe: Sie begrenzen die Ausgabe (und damit die Dauer) einer lokalen Generierung. */
const DRAFT_LIMITS = { name: 40, tagline: 150, description: 400, lore: 300, atmosphere: 120, rule: 120, charRole: 60, charTagline: 120, charText: 220, trait: 30 };

/** JSON-Schema des Entwurfs. Die lokale KI (Ollama ≥ 0.5) erzeugt damit garantiert gültiges, begrenztes JSON. */
export function draftJsonSchema(characterCount: number): JsonSchema {
  const str = (maxLength: number) => ({ type: 'string', maxLength });
  const list = (maxLength: number, minItems: number, maxItems: number) => ({ type: 'array', items: str(maxLength), minItems, maxItems });
  const L = DRAFT_LIMITS;
  return {
    type: 'object',
    properties: {
      name: str(L.name),
      tagline: str(L.tagline),
      description: str(L.description),
      lore: str(L.lore),
      atmosphere: str(L.atmosphere),
      rules: list(L.rule, 3, 5),
      characters: {
        type: 'array',
        minItems: characterCount,
        maxItems: characterCount,
        items: {
          type: 'object',
          properties: {
            name: str(L.name),
            role: str(L.charRole),
            tagline: str(L.charTagline),
            description: str(L.charText),
            personality: list(L.trait, 3, 3),
            interests: list(L.trait, 2, 3),
            background: str(L.charText),
            writingStyle: { type: 'string', enum: [...WRITING_STYLES] },
          },
          required: ['name', 'role', 'tagline', 'description', 'personality', 'interests', 'background', 'writingStyle'],
        },
      },
    },
    required: ['name', 'tagline', 'description', 'lore', 'atmosphere', 'rules', 'characters'],
  };
}

/** Zusätzliche Vorgaben je Genre für KI-Entwürfe. */
const GENRE_HINTS: Partial<Record<string, string>> = {
  dating:
    'stories about meeting people, first dates, friendship, falling in love, misunderstandings, jealousy, love triangles, ' +
    'breakups and second chances; every character is clearly an adult aged 25-45; warm and emotional, never explicit',
};

/** Grobe Erwartung an die Länge eines Entwurfs in Tokens (für Fortschrittsanzeige und Token-Limit). */
export function expectedDraftTokens(characterCount: number): number {
  return 260 + characterCount * 230;
}

export interface DraftOptions {
  signal?: AbortSignal;
  onProgress?: (tokens: number) => void;
}

async function generateAiDraft(
  ctx: AppContext,
  genre: Genre,
  prompt: string,
  characterCount: number,
  lang: Lang,
  fallback: WorldDraft,
  opts: DraftOptions = {},
): Promise<WorldDraft | { error: string }> {
  const language = lang === 'de' ? 'German' : 'English';
  const L = DRAFT_LIMITS;
  const result = await ctx.ai.complete({
    purpose: 'generator',
    kind: 'world',
    json: draftJsonSchema(characterCount),
    long: true,
    signal: opts.signal,
    onProgress: opts.onProgress,
    // Großzügig über der Erwartung, damit gültiges JSON nicht abgeschnitten wird; das Schema begrenzt die Länge zusätzlich.
    maxTokens: Math.round(expectedDraftTokens(characterCount) * 1.8),
    messages: [
      {
        role: 'system',
        content:
          'You design fictional worlds for a social media role-play simulation. All characters are fictional adults; never use real people. ' +
          'Keep all content suitable for a general audience: romance may be warm and emotional but never explicit. ' +
          'Answer with ONLY one JSON object, no markdown, no commentary. Keep every text short and vivid.',
      },
      {
        role: 'user',
        content:
          `Genre: ${genre}${GENRE_HINTS[genre] ? ` (${GENRE_HINTS[genre]})` : ''}. ` +
          `Language for all text: ${language}. ` +
          (prompt ? `User idea: """${truncate(prompt, 400)}""". ` : '') +
          `Create ${characterCount} characters. JSON schema: {"name": string (max ${L.name} chars), "tagline": string (max ${L.tagline}), ` +
          `"description": string (max ${L.description}), "lore": string (max ${L.lore}), "atmosphere": string (max ${L.atmosphere}), ` +
          `"rules": string[3-5] (max ${L.rule} each), "characters": [{"name": string, "role": string (max ${L.charRole}), ` +
          `"tagline": string (max ${L.charTagline}), "description": string (max ${L.charText}), "personality": string[3], ` +
          `"interests": string[2-3], "background": string (max ${L.charText}), "writingStyle": one of ${WRITING_STYLES.join('|')}}]}`,
      },
    ],
  });
  if (!result.ok) return { error: result.code };
  const parsed = aiDraftSchema.safeParse(extractJson(result.text));
  if (!parsed.success) return { error: result.truncated ? 'truncated' : 'invalid_response' };
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

export type GenerateInput = z.infer<typeof generateSchema>;

export function parseGenerateInput(input: unknown): GenerateInput {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_generator_input', 'Ungültige Generator-Eingabe.', parsed.error.issues);
  return parsed.data;
}

/** Regelbasierter Entwurf – immer verfügbar und Grundlage, falls die KI nicht antwortet. */
export function localDraftFor(ctx: AppContext, input: GenerateInput): WorldDraft {
  const seed = input.seed ?? `${input.genre}:${input.prompt}:${ctx.now().getTime()}`;
  return generateLocalDraft(input.genre, input.prompt, input.characterCount, getLanguage(ctx.db), seed);
}

/**
 * Erzeugt einen Weltentwurf: mit KI, wenn gewünscht und verfügbar, sonst regelbasiert.
 * Scheitert die KI, wird der regelbasierte Entwurf mit dem Grund (`notice`) zurückgegeben.
 */
export async function generateDraft(ctx: AppContext, input: unknown, opts: DraftOptions = {}): Promise<WorldDraft> {
  const data = parseGenerateInput(input);
  const local = localDraftFor(ctx, data);
  if (!data.useAi) return local;
  await ctx.ai.refreshHealth();
  if (!ctx.ai.isActive('world')) {
    const reason = ctx.ai.status().reason;
    // Bewusst abgeschaltete KI ist kein Fehler – dann ohne Hinweis.
    return reason && reason !== 'mode-fallback' && reason !== 'local-disabled' ? { ...local, notice: reason } : local;
  }
  const ai = await generateAiDraft(ctx, data.genre, data.prompt, data.characterCount, getLanguage(ctx.db), local, opts);
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
