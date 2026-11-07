/**
 * Regelbasierter Leser für die Einrichtung einer Lebensgeschichte (ohne Datenbank und KI).
 * Wird vom Server und von der eigenständigen Handy-Version gemeinsam genutzt.
 */
import { deriveAppearance, type Gender } from '../../../shared/appearance';
import type { CharacterStance, LifeSetupCharacter, LifeSetupDraft } from '../../../shared/life';
import { uw } from '../../../shared/regex';
import { CAST_NAMES, DEFAULT_CAST, DEFAULT_SETTING } from '../content/lifeContent';
import { createRng } from '../lib/rng';
import { cleanText, truncate } from '../lib/text';
import { detectArchetype, detectGenres, initialStats } from './stats';

export const MAX_CHARACTERS = 10;

/** Text der Einrichtung: ein Prompt und/oder einzelne Teile. */
export interface SetupText {
  prompt: string;
  parts?: { background?: string; characters?: string; relationships?: string; start?: string; details?: string };
  playerName?: string;
}

/** Alter aus Texten wie „Buchhändlerin (29)“ oder „Lena Vogt, 29,“. */
function ageHint(...texts: string[]): number | null {
  for (const t of texts) {
    const m = /\((\d{2})\)|,\s(\d{2}),/.exec(t);
    if (m) return Number(m[1] ?? m[2]);
  }
  return null;
}

export function fullText(i: SetupText): string {
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

export const STANCE_DEFAULTS: Record<CharacterStance, { affinity: number; trust: number; loyalty: number; fear: number }> = {
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

export function stanceOf(text: string): CharacterStance {
  for (const [stance, p] of STANCE_PATTERNS) if (p.test(text)) return stance;
  return 'neutral';
}

const FEMALE_WORDS = uw(/\b(sie ist|she is|she's|frau|tochter|schwester|mutter|ehefrau|freundin|partnerin|woman|wife|daughter|sister|mother|girlfriend|queen|königin|lady)\b/i);
const MALE_WORDS = uw(/\b(er ist|he is|he's|mann|sohn|bruder|vater|ehemann|freund|partner|man|husband|son|brother|father|boyfriend|king|könig|don|pate)\b/i);
/** Weibliche Berufsbezeichnungen (Politikerin, Kommissarin) – nur auf die Rolle angewendet. */
const FEMALE_SUFFIX = uw(/\p{L}{3,}in\b/iu);
const NOT_FEMALE = uw(/\b(kevin|martin|benjamin|paladin|termin|medizin|berlin|turin|dublin|harlekin)\b/i);

export function genderOf(role: string, description = ''): Gender | null {
  const text = `${role} ${description}`;
  const f = FEMALE_WORDS.exec(text)?.index ?? Infinity;
  const m = MALE_WORDS.exec(text)?.index ?? Infinity;
  if (f !== m) return f < m ? 'female' : 'male';
  if (FEMALE_SUFFIX.test(role) && !NOT_FEMALE.test(role)) return 'female';
  return null;
}

/** Spielfigur: nur eindeutige Angaben („ich bin eine Frau“, Rolle „Bürgermeisterin“) – „meine Frau“ meint jemand anderen. */
export function playerGender(role: string, text: string): Gender | null {
  if (uw(/\b(ich bin (eine )?frau|i am a woman|i'm a woman|als frau)\b/i).test(text)) return 'female';
  if (uw(/\b(ich bin ein mann|i am a man|i'm a man|als mann)\b/i).test(text)) return 'male';
  return genderOf(role);
}

const NAME = "[A-ZÄÖÜ][\\p{L}'’.-]+(?:\\s(?:de|da|di|del|van|von|der|la|le)?\\s?[A-ZÄÖÜ][\\p{L}'’-]+){0,2}";
/** Zeilen wie „- Marco Bellini: meine rechte Hand, …“ oder „Elena (Ehefrau) – …“. */
export const LINE_RE = new RegExp(`^\\s*(?:[-*•–]|\\d+[.)])?\\s*(${NAME})\\s*(?:\\(([^)]{2,80})\\))?\\s*[:–—-]\\s*(.{3,400})$`, 'u');
/** Fließtext: „mein Bruder Luca“, „meine Frau Elena“, „my lieutenant Viktor“. */
const INLINE_RE = uw(new RegExp(
  `\\b(?:mein(?:e|en|em|er)?|dein(?:e)?|unser(?:e)?|my|our|the|der|die|den|dem)\\s+((?:[\\p{Ll}-]+\\s){0,2}(?:bruder|schwester|frau|mann|freundin|freund|tochter|sohn|vater|mutter|rechte hand|consigliere|leutnant|rivale|rivalin|konkurrent|konkurrentin|partnerin|partner|chef|chefin|feind|kommissarin|kommissar|ex-frau|ex-freundin|ex|assistentin|assistent|berater|beraterin|brother|sister|wife|husband|girlfriend|boyfriend|daughter|son|father|mother|right hand|lieutenant|rival|partner|boss|enemy|detective|adviser|friend))\\s+(${NAME})`,
  'giu',
));

export function readCharacters(text: string, playerName: string): LifeSetupCharacter[] {
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

export function readPlayer(text: string, lang: 'de' | 'en', given?: string): { name: string; role: string } {
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

export function ruleDraftCore(input: SetupText, lang: 'de' | 'en', fromSocial: LifeSetupCharacter[], notice?: string): LifeSetupDraft {
  const text = fullText(input);
  const parts = input.parts ?? {};
  const rng = createRng(`setup:${text}`);
  const player = readPlayer(text, lang, input.playerName);
  const archetype = detectArchetype(player.role, text);
  const genres = detectGenres(text, archetype);
  const { stats, statKeys } = initialStats(archetype, text, genres);
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

