/**
 * Einrichtung einer Lebensgeschichte: aus einem ausführlichen Prompt (oder mehreren Teilen) wird ein Entwurf
 * mit Spielfigur, Figuren, Beziehungen, Ort und Startwerten. Die lokale KI liest Figuren und Details heraus;
 * Rolle, Genre und Startwerte bestimmt immer das Spielsystem (nachvollziehbar, nicht vom Sprachmodell abhängig).
 * Ohne KI arbeitet ein regelbasierter Leser.
 */
import { uw } from '../../../shared/regex';
import { z } from 'zod';
import { deriveAppearance, normalizeAppearance, type Gender } from '../../../shared/appearance';
import {
  CHARACTER_STANCES,
  LIFE_ARCHETYPES,
  LIFE_GENRES,
  LIFE_STATS,
  clampStat,
  type CharacterStance,
  type LifeSetupCharacter,
  type LifeSetupDraft,
  type LifeSetupJobDto,
  type LifeStoryDto,
} from '../../../shared/life';
import type { JsonSchema } from '../ai/types';
import { CAST_NAMES, DEFAULT_CAST, DEFAULT_SETTING } from '../content/lifeContent';
import type { AppContext } from '../context';
import { all, parseJson, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { createRng } from '../lib/rng';
import { cleanText, truncate } from '../lib/text';
import { getLanguage } from '../services/settings';
import { characterAppearance, ageHint } from '../services/appearances';
import { EVERYONE, PLAYER, remember } from './memory';
import { getStoryDto, startOpening } from './service';
import { detectArchetype, detectGenres, initialStats } from './stats';

const MAX_CHARACTERS = 10;

// ---------- Eingabe ----------

const partsSchema = z
  .object({
    background: z.string().max(3000).optional(),
    characters: z.string().max(3000).optional(),
    relationships: z.string().max(2000).optional(),
    start: z.string().max(2000).optional(),
    details: z.string().max(2000).optional(),
  })
  .strict();

const setupInputSchema = z
  .object({
    prompt: z.string().max(6000).default(''),
    parts: partsSchema.optional(),
    playerName: z.string().max(60).optional(),
    socialCharacterIds: z.array(z.string().max(60)).max(6).default([]),
    useAi: z.boolean().default(true),
  })
  .strict();

export type SetupInput = z.infer<typeof setupInputSchema>;

export function parseSetupInput(input: unknown): SetupInput {
  const parsed = setupInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw badRequest('invalid_setup', 'Ungültige Angaben zur Geschichte.', parsed.error.issues);
  const text = fullText(parsed.data);
  if (text.length < 20) throw badRequest('setup_too_short', 'Beschreibe deine Geschichte etwas ausführlicher (mindestens ein bis zwei Sätze).');
  return parsed.data;
}

function fullText(i: SetupInput): string {
  const p = i.parts ?? {};
  return [i.prompt, p.background, p.characters, p.relationships, p.start, p.details].filter((x) => x && x.trim()).join('\n\n').trim();
}

// ---------- Regelbasierter Leser ----------

const STANCE_PATTERNS: [CharacterStance, RegExp][] = [
  ['ex', uw(/\b(ex-|ex\b|exfrau|exmann|ehemalige[rn]? (freundin|freund|partner)|former (wife|husband|partner|girlfriend|boyfriend))/i)],
  ['love', uw(/\b(geliebte[rn]?|liebe meines|verlobte[rn]?|ehefrau|ehemann|frau von mir|meine frau|mein mann|freundin von mir|partnerin|partner\b|lover|wife|husband|girlfriend|boyfriend|fiancée?|schwarm|crush|love interest)/i)],
  ['family', uw(/\b(bruder|schwester|mutter|vater|sohn|tochter|onkel|tante|cousin|cousine|neffe|nichte|großmutter|großvater|brother|sister|mother|father|son|daughter|uncle|aunt|nephew|niece|grand(mother|father))/i)],
  ['enemy', uw(/\b(feind|erzfeind|todfeind|hasst mich|will mich tot|enemy|nemesis|hates me|wants me dead)/i)],
  ['rival', uw(/\b(rivale|rivalin|konkurrent|konkurrentin|gegenspieler|gegner|herausforderer|rival|competitor|opponent|challenger|kommissar|ermittler|polizist|detective|cop\b|staatsanwalt|prosecutor)/i)],
  ['subordinate', uw(/\b(leutnant|soldat|untergebene[rn]?|handlanger|fahrer|leibwächter|bodyguard|assistent|assistentin|mitarbeiter|lieutenant|soldier|employee|henchman|driver)/i)],
  ['boss', uw(/\b(chef\b|chefin|vorgesetzte[rn]?|my boss|boss\b|supervisor|manager\b|managerin)/i)],
  ['ally', uw(/\b(rechte hand|consigliere|berater|beraterin|verbündete[rn]?|vertraute[rn]?|partner in crime|right hand|adviser|advisor|ally|confidant)/i)],
  ['friend', uw(/\b(freund|freundin|kumpel|bester freund|beste freundin|friend|buddy|best friend)/i)],
];

const STANCE_DEFAULTS: Record<CharacterStance, { affinity: number; trust: number; loyalty: number; fear: number }> = {
  ally: { affinity: 35, trust: 60, loyalty: 65, fear: 5 },
  friend: { affinity: 55, trust: 65, loyalty: 60, fear: 0 },
  love: { affinity: 50, trust: 55, loyalty: 55, fear: 0 },
  family: { affinity: 45, trust: 60, loyalty: 65, fear: 0 },
  neutral: { affinity: 0, trust: 35, loyalty: 20, fear: 0 },
  rival: { affinity: -25, trust: 15, loyalty: 0, fear: 10 },
  enemy: { affinity: -50, trust: 5, loyalty: 0, fear: 15 },
  ex: { affinity: -5, trust: 30, loyalty: 20, fear: 0 },
  subordinate: { affinity: 15, trust: 45, loyalty: 50, fear: 25 },
  boss: { affinity: 0, trust: 40, loyalty: 30, fear: 15 },
};

function stanceOf(text: string): CharacterStance {
  for (const [stance, p] of STANCE_PATTERNS) if (p.test(text)) return stance;
  return 'neutral';
}

const FEMALE_WORDS = uw(/\b(sie ist|she is|she's|frau|tochter|schwester|mutter|ehefrau|freundin|partnerin|woman|wife|daughter|sister|mother|girlfriend|queen|königin|lady)\b/i);
const MALE_WORDS = uw(/\b(er ist|he is|he's|mann|sohn|bruder|vater|ehemann|freund|partner|man|husband|son|brother|father|boyfriend|king|könig|don|pate)\b/i);
/** Weibliche Berufsbezeichnungen (Politikerin, Kommissarin) – nur auf die Rolle angewendet. */
const FEMALE_SUFFIX = uw(/\p{L}{3,}in\b/iu);
const NOT_FEMALE = uw(/\b(kevin|martin|benjamin|paladin|termin|medizin|berlin|turin|dublin|harlekin)\b/i);

function genderOf(role: string, description = ''): Gender | null {
  const text = `${role} ${description}`;
  const f = FEMALE_WORDS.exec(text)?.index ?? Infinity;
  const m = MALE_WORDS.exec(text)?.index ?? Infinity;
  if (f !== m) return f < m ? 'female' : 'male';
  if (FEMALE_SUFFIX.test(role) && !NOT_FEMALE.test(role)) return 'female';
  return null;
}

/** Spielfigur: nur eindeutige Angaben („ich bin eine Frau“, Rolle „Bürgermeisterin“) – „meine Frau“ meint jemand anderen. */
function playerGender(role: string, text: string): Gender | null {
  if (uw(/\b(ich bin (eine )?frau|i am a woman|i'm a woman|als frau)\b/i).test(text)) return 'female';
  if (uw(/\b(ich bin ein mann|i am a man|i'm a man|als mann)\b/i).test(text)) return 'male';
  return genderOf(role);
}

const NAME = "[A-ZÄÖÜ][\\p{L}'’.-]+(?:\\s(?:de|da|di|del|van|von|der|la|le)?\\s?[A-ZÄÖÜ][\\p{L}'’-]+){0,2}";
/** Zeilen wie „- Marco Bellini: meine rechte Hand, …“ oder „Elena (Ehefrau) – …“. */
const LINE_RE = new RegExp(`^\\s*(?:[-*•–]|\\d+[.)])?\\s*(${NAME})\\s*(?:\\(([^)]{2,80})\\))?\\s*[:–—-]\\s*(.{3,400})$`, 'u');
/** Fließtext: „mein Bruder Luca“, „meine Frau Elena“, „my lieutenant Viktor“. */
const INLINE_RE = uw(new RegExp(
  `\\b(?:mein(?:e|en|em|er)?|dein(?:e)?|unser(?:e)?|my|our|the|der|die|den|dem)\\s+((?:[\\p{Ll}-]+\\s){0,2}(?:bruder|schwester|frau|mann|freundin|freund|tochter|sohn|vater|mutter|rechte hand|consigliere|leutnant|rivale|rivalin|konkurrent|konkurrentin|partnerin|partner|chef|chefin|feind|kommissarin|kommissar|ex-frau|ex-freundin|ex|assistentin|assistent|berater|beraterin|brother|sister|wife|husband|girlfriend|boyfriend|daughter|son|father|mother|right hand|lieutenant|rival|partner|boss|enemy|detective|adviser|friend))\\s+(${NAME})`,
  'giu',
));

function readCharacters(text: string, playerName: string): LifeSetupCharacter[] {
  const found = new Map<string, LifeSetupCharacter>();
  const add = (name: string, role: string, description: string) => {
    const clean = name.trim().replace(/[.,;:]+$/, '');
    if (!clean || clean.toLowerCase() === playerName.toLowerCase() || found.has(clean.toLowerCase()) || clean.length > 50) return;
    if (/^(ich|du|er|sie|es|wir|ihr|mein|meine|die|der|das|i|you|he|she|we|they|the|name|rolle|role|ort|start|hintergrund|background)$/i.test(clean)) return;
    const all = `${role} ${description}`;
    const stance = stanceOf(all);
    const secret = uw(/\b(heimlich|insgeheim|geheim|secretly|in secret|hidden)\b[^.]*\.?/i).exec(description)?.[0];
    found.set(clean.toLowerCase(), {
      name: clean,
      role: truncate(cleanText(role || description.split(/[,.]/)[0] || ''), 80),
      description: truncate(cleanText(description), 300),
      personality: [],
      goals: [],
      secrets: secret ? [truncate(cleanText(secret), 200)] : [],
      stance,
      ...STANCE_DEFAULTS[stance],
      appearance: undefined,
    });
  };
  for (const line of text.split(/\n+/)) {
    const m = LINE_RE.exec(line);
    if (m && !/^(Name|Rolle|Role|Ort|Place|Start|Hintergrund|Background|Details|Titel|Title)$/i.test(m[1])) {
      const rest = m[3].trim();
      add(m[1], m[2] ?? rest.split(/[,.;]/)[0], rest);
    }
  }
  for (const m of text.matchAll(INLINE_RE)) {
    const role = m[1].trim();
    // Der Ausdruck ist für die Rollenwörter unabhängig von Groß-/Kleinschreibung – Namen bestehen aber nur aus großgeschriebenen Wörtern.
    const words = m[2].split(/\s+/);
    const keep = words.findIndex((w, i) => i > 0 && !/^\p{Lu}/u.test(w) && !/^(de|da|di|del|van|von|der|la|le)$/.test(w));
    const name = (keep < 0 ? words : words.slice(0, keep)).join(' ');
    if (!/^\p{Lu}/u.test(name)) continue;
    // Rest des Satzes als Beschreibung.
    const start = (m.index ?? 0) + m[0].length;
    const sentence = text.slice(start, start + 220).split(/[.!?\n]/)[0].replace(/^[\s,–-]+/, '');
    add(name, role.charAt(0).toUpperCase() + role.slice(1), sentence ? `${role}, ${sentence}` : role);
  }
  return [...found.values()].slice(0, MAX_CHARACTERS);
}

const NAME_INTRO =
  /(?:^|[\s.!?,;:])(?:[Ii]ch hei(?:ß|ss)e|[Mm]ein [Nn]ame ist|[Ii]ch bin|[Mm]an nennt mich|[Mm]y name is|I am called|[Cc]all me|[Nn]ame:|I am|I'm)\s+(?!(?:Ein|Eine|Der|Die|Das|A|An|The)\s)([A-ZÄÖÜ][\p{L}'’-]+(?:\s(?:de|da|di|del|van|von|der|la|le)?\s?[A-ZÄÖÜ][\p{L}'’-]+){0,2})/u;
const ROLE_RE = uw(
  /\b(?:ich bin|ich spiele|ich arbeite als|arbeite als|als|rolle:|role:|i am|i'm|i play|i work as|work as|as)\s+(?:ein(?:e|en)?\s+|der\s+|die\s+|a\s+|an\s+|the\s+)?([\p{L}][\p{L}\s-]{2,60}?)(?=[,.;\n!]|\s+(?:in|im|aus|von|der|die|des|from|of|who|und|and|mit|with|bei|at|for|für)\b|$)/iu,
);
const STOP_ROLE = /^(ich|du|er|sie|es|wir|hier|da|so|nicht|ein|eine|pleite|müde|allein|alone|tired|here|not)$/i;

function readPlayer(text: string, lang: 'de' | 'en', given?: string): { name: string; role: string } {
  const nameMatch = NAME_INTRO.exec(text);
  const name = cleanText(given ?? '') || nameMatch?.[1]?.trim() || (lang === 'de' ? 'Alex Berger' : 'Alex Carter');
  // Beifügung direkt nach dem Namen: „Ich bin Don Greco, der gefürchtete Mafiaboss von Palermo“.
  const after = nameMatch ? text.slice((nameMatch.index ?? 0) + nameMatch[0].length) : '';
  const apposition = uw(/^\s*,\s*(?:der|die|das|ein|eine|the|a|an)\s+([\p{L}][\p{L}\s-]{2,60}?)(?=[,.;\n!]|\s+(?:in|im|aus|von|from|of|who|und|and|mit|with|bei|at)\b|$)/iu).exec(after)?.[1];
  const candidates = [apposition, ...[...text.replace(name, '').matchAll(new RegExp(ROLE_RE.source, 'giu'))].map((m) => m[1])]
    .map((r) => cleanText(r ?? ''))
    .filter((r) => r && !STOP_ROLE.test(r) && r.toLowerCase() !== name.toLowerCase());
  const role = candidates[0] || (lang === 'de' ? 'ganz normaler Mensch' : 'ordinary person');
  return { name: truncate(name, 60), role: truncate(role, 80) };
}

const ORG_RE = uw(/\b(Familie|Clan|Partei|Firma|Kartell|Bande|Konzern|Organisation|Family|Clan|Party|Company|Cartel|Gang|Corporation|Syndikat|Syndicate)\s+([A-ZÄÖÜ][\p{L}'’-]+(?:\s[A-ZÄÖÜ][\p{L}'’-]+)?)/gu);
const ASSET_RE =
  uw(/\b(Restaurant|Nachtclub|Club|Bar|Casino|Kasino|Villa|Penthouse|Hafen|Lagerhaus|Werkstatt|Firma|Start-?up|Boutique|Hotel|Weingut|Yacht|Jacht|Autohaus|Bäckerei|Café|Kanzlei|Praxis|Label|Studio|Nightclub|Warehouse|Garage|Company|Vineyard|Bakery|Office|Mansion)\b/giu);
const PLACE_RE = uw(/\b(?:in|nach|aus|von|from|in the city of)\s+((?:New\s|Los\s|San\s|Las\s|Saint\s|St\.\s)?[A-ZÄÖÜ][\p{L}'’-]{2,}(?:\s[A-ZÄÖÜ][\p{L}'’-]{2,})?)/gu);
const NOT_PLACE = /^(Hause|Ruhe|Zukunft|Konkurrenz|Familie|Wahrheit|Liebe|Gefahr|Schulden|Stadt|Vergangenheit|Polizei|Firma|Partei|Arbeit|Schule|Zeit|Angst|Sorge|Rache|Macht)$/;

function pickCastName(gender: 'female' | 'male', used: Set<string>, rng: ReturnType<typeof createRng>): string {
  const pool = CAST_NAMES[gender].filter((n) => !used.has(n.toLowerCase()));
  const name = pool.length ? rng.pick(pool) : `${rng.pick(CAST_NAMES[gender])} ${used.size}`;
  used.add(name.toLowerCase());
  return name;
}

function socialCharacters(ctx: AppContext, ids: string[]): LifeSetupCharacter[] {
  if (!ids.length) return [];
  const rows = all<{ id: string; name: string; role: string; description: string; tagline: string; personality: string; background: string; is_real_person_sim: number }>(
    ctx.db,
    `SELECT id, name, role, description, tagline, personality, background, is_real_person_sim FROM characters WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  return rows.map((r) => {
    const stance = stanceOf(`${r.role} ${r.description}`);
    return {
      name: r.name,
      role: truncate(r.role || r.tagline, 80),
      // Simulationen realer Personen bleiben als fiktive Simulation gekennzeichnet.
      description: truncate(`${r.is_real_person_sim ? '[Fiktive Simulation] ' : ''}${r.description || r.background}`, 300),
      personality: parseJson<string[]>(r.personality, []).slice(0, 4),
      goals: [],
      secrets: [],
      stance,
      ...STANCE_DEFAULTS[stance],
      appearance: characterAppearance(ctx, r.id),
      socialCharacterId: r.id,
    };
  });
}

export function ruleDraft(ctx: AppContext, input: SetupInput, notice?: string): LifeSetupDraft {
  const lang = getLanguage(ctx.db);
  const text = fullText(input);
  const parts = input.parts ?? {};
  const rng = createRng(`setup:${text}`);
  const player = readPlayer(text, lang, input.playerName);
  const archetype = detectArchetype(player.role, text);
  const genres = detectGenres(text, archetype);
  const { stats, statKeys } = initialStats(archetype, text, genres);
  const fromSocial = socialCharacters(ctx, input.socialCharacterIds);
  const read = readCharacters([parts.characters, parts.relationships, input.prompt, parts.background, parts.details].filter(Boolean).join('\n'), player.name).filter(
    (c) => !fromSocial.some((s) => s.name.toLowerCase() === c.name.toLowerCase()),
  );
  const characters = [...fromSocial, ...read].slice(0, MAX_CHARACTERS);
  // Zu wenige Figuren: passende Standardbesetzung des Genres ergänzen (Rollen, die noch fehlen).
  if (characters.length < 3) {
    const used = new Set([player.name.toLowerCase(), ...characters.map((c) => c.name.toLowerCase())]);
    for (const t of DEFAULT_CAST[genres[0]]) {
      if (characters.length >= 3) break;
      if (characters.some((c) => c.stance === t.stance)) continue;
      characters.push({
        name: pickCastName(t.gender, used, rng),
        role: t.role[lang],
        description: t.description[lang],
        personality: t.personality.map((p) => p[lang]),
        goals: [t.goal[lang]],
        secrets: t.secret ? [t.secret[lang]] : [],
        stance: t.stance,
        affinity: t.affinity,
        trust: t.trust,
        loyalty: t.loyalty,
        fear: t.stance === 'subordinate' ? 25 : 0,
        appearance: deriveAppearance(`cast:${t.role.en}:${characters.length}`, { role: t.role[lang], gender: t.gender }),
      });
    }
  }
  const organizations = [...new Set([...text.matchAll(ORG_RE)].map((m) => `${m[1]} ${m[2]}`))].slice(0, 5);
  const assets = [...new Set([...text.matchAll(ASSET_RE)].map((m) => m[1]))].slice(0, 5);
  const place = [...text.matchAll(PLACE_RE)].map((m) => m[1]).find((p) => !NOT_PLACE.test(p.split(' ')[0])) ?? '';
  const setting = truncate(cleanText(parts.background ?? '') || (place ? `${place} – ${DEFAULT_SETTING[genres[0]][lang]}` : DEFAULT_SETTING[genres[0]][lang]), 400);
  // Ausgangssituation: der letzte Satz der Beschreibung, der nicht zu einer Aufzählung (Figurenliste) gehört.
  const prose = input.prompt
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !/^([-*•–]|\d+[.)])\s*/.test(l) && !LINE_RE.test(l));
  const sentences = prose.join(' ').split(/(?<=[.!?])\s+/).filter(Boolean);
  const opening = truncate(cleanText(parts.start ?? '') || (sentences.length >= 2 ? sentences.at(-1)! : ''), 500);
  const relations: LifeSetupDraft['relations'] = [];
  const rel = parts.relationships ?? '';
  for (const line of rel.split(/\n+/)) {
    const names = characters.filter((c) => line.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()));
    if (names.length >= 2) {
      const kind = stanceOf(line);
      relations.push({ a: names[0].name, b: names[1].name, kind, affinity: STANCE_DEFAULTS[kind].affinity, note: truncate(cleanText(line), 200) });
    }
  }
  // Ich-Erzählung („Ich bin …“) ergibt keinen guten Titel – dann Name und Rolle.
  const firstSentence = cleanText(text.split(/[.!?\n]/)[0]);
  const role = player.role.charAt(0).toUpperCase() + player.role.slice(1);
  const title = /^(ich|i|mein|meine|my|i'm)\b/i.test(firstSentence) || !firstSentence ? truncate(`${player.name} – ${role}`, 60) : truncate(firstSentence.split(' ').slice(0, 7).join(' '), 60);
  return {
    title,
    premise: truncate(cleanText(text), 4000),
    genres,
    archetype,
    playerName: player.name,
    playerRole: player.role,
    playerAppearance: deriveAppearance(`player:${player.name}:${player.role}`, { role: player.role, gender: playerGender(player.role, text) }),
    setting,
    location: place,
    locations: place ? [place] : [],
    organizations,
    rules: [],
    opening,
    characters: characters.map((c) => ({
      ...c,
      appearance: c.appearance ?? deriveAppearance(`char:${c.name}`, { role: `${c.role} ${c.description}`, gender: genderOf(c.role, c.description), age: ageHint(c.description) }),
    })),
    relations,
    stats,
    statKeys,
    assets,
    source: 'rules',
    ...(notice ? { notice } : {}),
  };
}

// ---------- KI-Leser ----------

const SETUP_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 60 },
    playerName: { type: 'string', maxLength: 60 },
    playerRole: { type: 'string', maxLength: 80 },
    playerGender: { type: 'string', enum: ['female', 'male', 'diverse', 'unknown'] },
    setting: { type: 'string', maxLength: 300 },
    location: { type: 'string', maxLength: 80 },
    locations: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 60 } },
    organizations: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 60 } },
    assets: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 60 } },
    opening: { type: 'string', maxLength: 400 },
    characters: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 50 },
          role: { type: 'string', maxLength: 80 },
          description: { type: 'string', maxLength: 240 },
          personality: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 30 } },
          goal: { type: 'string', maxLength: 120 },
          secret: { type: 'string', maxLength: 160 },
          stance: { type: 'string', enum: [...CHARACTER_STANCES] },
          gender: { type: 'string', enum: ['female', 'male', 'diverse'] },
          age: { type: 'integer', minimum: 18, maximum: 95 },
        },
        required: ['name', 'role', 'description', 'stance', 'gender'],
      },
    },
    relations: {
      type: 'array',
      maxItems: 8,
      items: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' }, kind: { type: 'string' }, note: { type: 'string', maxLength: 160 } }, required: ['a', 'b', 'kind'] },
    },
  },
  required: ['title', 'playerName', 'playerRole', 'setting', 'characters'],
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? truncate(cleanText(v), max) : '');
const strList = (v: unknown, max: number, n: number): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/** Verbindet die KI-Auswertung mit dem regelbasierten Entwurf. Werte und Rolle bestimmt das Spielsystem. */
export function mergeAiDraft(ctx: AppContext, input: SetupInput, raw: string): LifeSetupDraft | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const base = ruleDraft(ctx, { ...input, playerName: input.playerName || str(data.playerName, 60) || undefined });
  const text = fullText(input);
  const role = str(data.playerRole, 80) || base.playerRole;
  const archetype = detectArchetype(role, text);
  const genres = detectGenres(text, archetype);
  const { stats, statKeys } = initialStats(archetype, text, genres);
  const playerName = input.playerName || str(data.playerName, 60) || base.playerName;
  const social = socialCharacters(ctx, input.socialCharacterIds);
  const aiChars: LifeSetupCharacter[] = (Array.isArray(data.characters) ? data.characters : [])
    .map((c: Record<string, unknown>) => {
      const name = str(c.name, 50);
      const stance = (CHARACTER_STANCES as readonly string[]).includes(c.stance as string) ? (c.stance as CharacterStance) : stanceOf(`${str(c.role, 80)} ${str(c.description, 240)}`);
      const gender = (['female', 'male', 'diverse'] as const).find((g) => g === c.gender) ?? null;
      return {
        name,
        role: str(c.role, 80),
        description: str(c.description, 240),
        personality: strList(c.personality, 30, 3),
        goals: str(c.goal, 120) ? [str(c.goal, 120)] : [],
        secrets: str(c.secret, 160) ? [str(c.secret, 160)] : [],
        stance,
        ...STANCE_DEFAULTS[stance],
        appearance: deriveAppearance(`char:${name}`, { role: str(c.role, 80), gender, age: typeof c.age === 'number' ? Math.round(c.age) : null }),
      };
    })
    .filter((c) => c.name && c.name.toLowerCase() !== playerName.toLowerCase() && !social.some((s) => s.name.toLowerCase() === c.name.toLowerCase()));
  // Figuren, die nur der Regelleser gefunden hat (z. B. aus Aufzählungen), bleiben erhalten.
  const extra = base.characters.filter((c) => !c.socialCharacterId && ![...social, ...aiChars].some((x) => x.name.toLowerCase() === c.name.toLowerCase()));
  const characters = [...social, ...aiChars, ...(aiChars.length ? extra.filter((c) => readCharacters(text, playerName).some((r) => r.name === c.name)) : extra)].slice(0, MAX_CHARACTERS);
  const names = new Set(characters.map((c) => c.name));
  const relations = (Array.isArray(data.relations) ? data.relations : [])
    .map((r: Record<string, unknown>) => {
      const kind = (CHARACTER_STANCES as readonly string[]).includes(r.kind as string) ? (r.kind as CharacterStance) : stanceOf(str(r.kind, 40));
      return { a: str(r.a, 50), b: str(r.b, 50), kind, affinity: STANCE_DEFAULTS[kind].affinity, note: str(r.note, 160) };
    })
    .filter((r) => names.has(r.a) && names.has(r.b) && r.a !== r.b);
  const gender = (['female', 'male', 'diverse'] as const).find((g) => g === data.playerGender) ?? playerGender(role, text);
  return {
    ...base,
    title: str(data.title, 60) || base.title,
    archetype,
    genres,
    stats,
    statKeys,
    playerName,
    playerRole: role,
    playerAppearance: deriveAppearance(`player:${playerName}:${role}`, { role, gender }),
    setting: str(data.setting, 400) || base.setting,
    location: str(data.location, 80) || base.location,
    locations: strList(data.locations, 60, 5).length ? strList(data.locations, 60, 5) : base.locations,
    organizations: strList(data.organizations, 60, 5).length ? strList(data.organizations, 60, 5) : base.organizations,
    assets: strList(data.assets, 60, 5).length ? strList(data.assets, 60, 5) : base.assets,
    opening: str(data.opening, 500) || base.opening,
    characters: characters.length ? characters : base.characters,
    relations: relations.length ? relations : base.relations,
    source: 'ai',
  };
}

async function aiDraft(ctx: AppContext, input: SetupInput, signal: AbortSignal, onProgress: (n: number) => void): Promise<LifeSetupDraft> {
  const lang = getLanguage(ctx.db);
  const result = await ctx.ai.complete({
    purpose: 'generator',
    kind: 'world',
    json: SETUP_SCHEMA,
    long: true,
    signal,
    onProgress,
    maxTokens: 1400,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          `You read the setup of an interactive life story and extract it as JSON. Write all values in ${lang === 'de' ? 'German' : 'English'}. ` +
          'Extract the player character (name, role), the setting, important places, organizations, possessions and every named character with role, ' +
          'a short description, personality, goal, a hidden secret if the text implies one, and their stance towards the player ' +
          `(${CHARACTER_STANCES.join(', ')}). Only use what the text says or clearly implies; invent at most 2 fitting characters if fewer than 2 are named. ` +
          'All characters are fictional adults. Real persons may only appear as clearly fictional simulations. "opening" is the concrete starting situation.',
      },
      { role: 'user', content: fullText(input) },
    ],
  });
  if (!result.ok || result.provider === 'fallback') return ruleDraft(ctx, input, result.ok ? (result.notice?.code ?? 'ai_unavailable') : result.code);
  return mergeAiDraft(ctx, input, result.text) ?? ruleDraft(ctx, input, 'invalid_ai_output');
}

// ---------- Aufträge ----------

interface SetupJob {
  id: string;
  status: LifeSetupJobDto['status'];
  startedAt: number;
  finishedAt: number | null;
  tokens: number;
  draft: LifeSetupDraft | null;
  controller: AbortController;
  fallback: LifeSetupDraft;
}

const jobs = new Map<string, SetupJob>();

function jobDto(j: SetupJob): LifeSetupJobDto {
  return { id: j.id, status: j.status, elapsedMs: (j.finishedAt ?? Date.now()) - j.startedAt, tokens: j.tokens, draft: j.draft };
}

function prune(): void {
  for (const [id, j] of jobs) if (j.finishedAt && Date.now() - j.finishedAt > 30 * 60_000) jobs.delete(id);
  while (jobs.size > 10) jobs.delete(jobs.keys().next().value as string);
}

/** Entwurf erzeugen: mit KI als Hintergrundauftrag (Fortschritt abfragbar, abbrechbar), sonst sofort regelbasiert. */
export async function startSetupJob(ctx: AppContext, body: unknown): Promise<LifeSetupJobDto> {
  prune();
  const input = parseSetupInput(body);
  if ([...jobs.values()].some((j) => j.status === 'running')) throw new AppError(409, 'generation_running', 'Es wird bereits ein Entwurf erzeugt.');
  await ctx.ai.refreshHealth();
  const fallback = ruleDraft(ctx, input);
  const job: SetupJob = { id: newId('lsj'), status: 'running', startedAt: Date.now(), finishedAt: null, tokens: 0, draft: null, controller: new AbortController(), fallback };
  jobs.set(job.id, job);
  const finish = (d: LifeSetupDraft) => {
    if (job.status !== 'running') return;
    job.status = 'done';
    job.draft = d;
    job.finishedAt = Date.now();
  };
  if (!input.useAi || !ctx.ai.isActive('world')) {
    finish(fallback);
    return jobDto(job);
  }
  void aiDraft(ctx, input, job.controller.signal, (n) => {
    job.tokens = n;
  })
    .then(finish)
    .catch((error: unknown) => {
      console.warn('[life] Entwurf fehlgeschlagen:', (error as Error).message);
      finish({ ...fallback, notice: 'server_error' });
    });
  return jobDto(job);
}

export function getSetupJob(id: string): LifeSetupJobDto {
  const j = jobs.get(id);
  if (!j) throw notFound('Auftrag');
  return jobDto(j);
}

export function cancelSetupJob(id: string): LifeSetupJobDto {
  const j = jobs.get(id);
  if (!j) throw notFound('Auftrag');
  if (j.status === 'running') {
    j.controller.abort();
    j.status = 'done';
    j.draft = { ...j.fallback, notice: 'cancelled' };
    j.finishedAt = Date.now();
  }
  return jobDto(j);
}

export function resetSetupJobs(): void {
  for (const j of jobs.values()) j.controller.abort();
  jobs.clear();
}

// ---------- Geschichte anlegen ----------

const characterSchema = z.object({
  name: z.string().trim().min(1).max(50),
  role: z.string().max(80).default(''),
  description: z.string().max(400).default(''),
  personality: z.array(z.string().max(40)).max(6).default([]),
  goals: z.array(z.string().max(160)).max(4).default([]),
  secrets: z.array(z.string().max(240)).max(3).default([]),
  appearance: z.unknown().optional(),
  stance: z.enum(CHARACTER_STANCES).default('neutral'),
  affinity: z.number().min(-100).max(100).default(0),
  trust: z.number().min(0).max(100).default(40),
  loyalty: z.number().min(0).max(100).default(30),
  fear: z.number().min(0).max(100).default(0),
  socialCharacterId: z.string().max(60).nullable().optional(),
});

const draftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  premise: z.string().trim().min(10).max(8000),
  genres: z.array(z.enum(LIFE_GENRES)).min(1).max(3),
  archetype: z.enum(LIFE_ARCHETYPES),
  playerName: z.string().trim().min(1).max(60),
  playerRole: z.string().trim().min(1).max(80),
  playerAppearance: z.unknown().optional(),
  setting: z.string().max(600).default(''),
  location: z.string().max(80).default(''),
  locations: z.array(z.string().max(80)).max(8).default([]),
  organizations: z.array(z.string().max(80)).max(8).default([]),
  rules: z.array(z.string().max(200)).max(8).default([]),
  opening: z.string().max(800).default(''),
  characters: z.array(characterSchema).min(1).max(MAX_CHARACTERS),
  relations: z.array(z.object({ a: z.string().max(50), b: z.string().max(50), kind: z.string().max(40), affinity: z.number().min(-100).max(100).default(0), note: z.string().max(240).default('') })).max(20).default([]),
  stats: z.partialRecord(z.enum(LIFE_STATS), z.number().min(0).max(100)),
  statKeys: z.array(z.enum(LIFE_STATS)).min(2).max(LIFE_STATS.length),
  assets: z.array(z.string().max(80)).max(10).default([]),
  source: z.enum(['ai', 'rules']).default('rules'),
  notice: z.string().optional(),
});

/** Legt die Geschichte aus einem (ggf. vom Spieler bearbeiteten) Entwurf an und startet die Eröffnungsszene. */
export function createStory(ctx: AppContext, body: unknown): LifeStoryDto {
  const parsed = draftSchema.safeParse(body ?? {});
  if (!parsed.success) throw badRequest('invalid_draft', 'Der Entwurf ist unvollständig.', parsed.error.issues);
  const d = parsed.data;
  const names = d.characters.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) throw badRequest('duplicate_character', 'Zwei Figuren haben denselben Namen.');
  if (!d.statKeys.includes('health')) d.statKeys.unshift('health');
  const lang = getLanguage(ctx.db);
  const id = newId('life');
  const now = ctx.now().toISOString();
  const stats = Object.fromEntries(d.statKeys.map((k) => [k, clampStat(d.stats[k] ?? (k === 'health' ? 85 : 40))]));
  tx(ctx.db, () => {
    const player = normalizeAppearance(d.playerAppearance, deriveAppearance(`player:${id}`, { role: d.playerRole }));
    run(
      ctx.db,
      `INSERT INTO life_stories (id, title, premise, setup, genre, archetype, player_name, player_role, player_appearance, stats, stat_keys, assets, world, location, present, seed, lang, created_at, updated_at, last_tick_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      d.title,
      d.premise,
      JSON.stringify({ opening: d.opening, source: d.source }),
      d.genres.join(','),
      d.archetype,
      d.playerName,
      d.playerRole,
      JSON.stringify(player),
      JSON.stringify(stats),
      JSON.stringify(d.statKeys),
      JSON.stringify(d.assets),
      JSON.stringify({ setting: d.setting, locations: d.locations, organizations: d.organizations, rules: d.rules }),
      d.location,
      '[]',
      id,
      lang,
      now,
      now,
      now,
    );
    const ids = new Map<string, string>();
    d.characters.forEach((c, i) => {
      const cid = newId('lc');
      ids.set(c.name, cid);
      const social = c.socialCharacterId && all(ctx.db, 'SELECT 1 FROM characters WHERE id = ?', c.socialCharacterId).length ? c.socialCharacterId : null;
      const appearance = normalizeAppearance(c.appearance, deriveAppearance(cid, { role: `${c.role} ${c.description}` }));
      // Wichtigkeit: zuerst genannte Figuren und enge Bindungen/Feinde sind wichtiger (schwerer zu töten, häufiger in Ereignissen).
      const importance = i < 2 || ['love', 'family', 'enemy', 'boss'].includes(c.stance) ? 3 : 2;
      run(
        ctx.db,
        `INSERT INTO life_characters (id, story_id, name, role, description, personality, goals, secrets, appearance, affinity, trust, loyalty, fear, stance, importance, social_character_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        cid,
        id,
        c.name,
        c.role,
        c.description,
        JSON.stringify(c.personality),
        JSON.stringify(c.goals),
        JSON.stringify(c.secrets),
        JSON.stringify(appearance),
        Math.round(c.affinity),
        Math.round(c.trust),
        Math.round(c.loyalty),
        Math.round(c.fear),
        c.stance,
        importance,
        social,
        now,
      );
      // Gedächtnis von Anfang an: Die Beziehung kennen beide, ein Geheimnis nur die Figur selbst.
      remember(ctx, id, {
        kind: 'relationship',
        content: `${c.name} (${c.role}): ${c.description}`.slice(0, 400),
        importance: importance + 1,
        critical: ['love', 'family', 'enemy'].includes(c.stance),
        subjects: [cid],
        knownBy: [PLAYER, cid],
        turn: 0,
        source: 'setup',
      });
      for (const secret of c.secrets) {
        remember(ctx, id, { kind: 'secret', content: `${c.name}: ${secret}`, importance: 4, subjects: [cid], knownBy: [cid], turn: 0, source: 'setup' });
      }
    });
    for (const r of d.relations) {
      const a = ids.get(r.a);
      const b = ids.get(r.b);
      if (!a || !b || a === b) continue;
      run(ctx.db, 'INSERT OR REPLACE INTO life_relations (story_id, a_id, b_id, kind, affinity, note) VALUES (?, ?, ?, ?, ?, ?)', id, a, b, r.kind, Math.round(r.affinity), r.note);
      remember(ctx, id, { kind: 'relationship', content: `${r.a} ↔ ${r.b}: ${r.kind}${r.note ? ` – ${r.note}` : ''}`, importance: 3, subjects: [a, b], knownBy: [a, b, PLAYER], turn: 0, source: 'setup' });
    }
    remember(ctx, id, { kind: 'setup', content: truncate(d.premise, 900), importance: 5, critical: true, knownBy: [PLAYER], turn: 0, source: 'setup' });
    if (d.setting) remember(ctx, id, { kind: 'location', content: d.setting, importance: 3, knownBy: [EVERYONE], turn: 0, source: 'setup' });
    for (const o of d.organizations) remember(ctx, id, { kind: 'organization', content: o, importance: 3, knownBy: [EVERYONE], turn: 0, source: 'setup' });
    // Zu Beginn sind die ersten zwei Figuren anwesend.
    run(ctx.db, 'UPDATE life_stories SET present = ? WHERE id = ?', JSON.stringify([...ids.values()].slice(0, 2)), id);
  });
  startOpening(ctx, id);
  return getStoryDto(ctx, id);
}
