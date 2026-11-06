/**
 * Aussehen einer Figur. Es ist dauerhaft gespeichert und wird für jedes Bild dieser Figur verwendet
 * (Profilbild, Szenenbilder, gezeichnetes Ersatzporträt), damit die Figur überall gleich aussieht.
 */
import { uw } from './regex';

export const GENDERS = ['female', 'male', 'diverse'] as const;
export const SKIN_TONES = ['light', 'fair', 'olive', 'tan', 'brown', 'dark'] as const;
export const HAIR_STYLES = ['short', 'buzz', 'long', 'bob', 'curly', 'wavy', 'ponytail', 'bun', 'braids', 'afro', 'undercut', 'slicked', 'bald', 'hood'] as const;
export const HAIR_COLORS = ['black', 'dark-brown', 'brown', 'auburn', 'red', 'blonde', 'platinum', 'grey', 'white', 'blue', 'pink'] as const;
export const EYE_COLORS = ['brown', 'hazel', 'green', 'blue', 'grey', 'amber'] as const;
export const BUILDS = ['slim', 'average', 'athletic', 'sturdy'] as const;
export const FACIAL_HAIR = ['none', 'stubble', 'beard', 'mustache'] as const;
export const FEATURES = ['glasses', 'freckles', 'scar', 'earrings', 'tattoo'] as const;

export type Gender = (typeof GENDERS)[number];
export type SkinTone = (typeof SKIN_TONES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type EyeColor = (typeof EYE_COLORS)[number];
export type Build = (typeof BUILDS)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];
export type Feature = (typeof FEATURES)[number];

export interface Appearance {
  /** Menschen oder Maschinen (z. B. eine Drohne). */
  kind: 'human' | 'robot';
  gender: Gender;
  age: number;
  skin: SkinTone;
  hair: HairStyle;
  hairColor: HairColor;
  eyes: EyeColor;
  build: Build;
  facialHair: FacialHair;
  features: Feature[];
  /** Kleidung in wenigen englischen Worten (für Bildprompts), z. B. „tailored charcoal suit“. */
  clothing: string;
  /** Farbton der Kleidung (0–359) für das gezeichnete Porträt. */
  clothingHue: number;
}

const SKIN_HEX: Record<SkinTone, string> = {
  light: '#f3d6c3',
  fair: '#e9bf9f',
  olive: '#c99a6e',
  tan: '#b07a4f',
  brown: '#8a5a3a',
  dark: '#5b3a26',
};
const HAIR_HEX: Record<HairColor, string> = {
  black: '#1b1714',
  'dark-brown': '#3b2619',
  brown: '#6b4428',
  auburn: '#8e3b1f',
  red: '#b5481f',
  blonde: '#d9b56a',
  platinum: '#ece3cf',
  grey: '#9a9a9a',
  white: '#e6e6e6',
  blue: '#3a6fd8',
  pink: '#e07aa8',
};
const EYE_HEX: Record<EyeColor, string> = {
  brown: '#4a2d1a',
  hazel: '#7a5a2a',
  green: '#3f7a4a',
  blue: '#3e6fb0',
  grey: '#6e7a84',
  amber: '#a26a1c',
};

export function skinHex(s: SkinTone): string {
  return SKIN_HEX[s];
}

/** Deterministischer Zufall (unabhängig von Server-/Client-Implementierungen). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
  };
}

const FEMALE_ROLE = uw(/(in|frau|mutter|schwester|tochter|königin|herzogin|lady|woman|queen|mother|sister|daughter|actress|waitress|girl|mädchen)(\b|,|$)/i);
const MALE_ROLE = uw(/(mann|vater|bruder|sohn|könig|herzog|lord|king|\bman\b|father|brother|son\b|actor\b|boy|junge|\bdon\b|pate\b|wirt\b)/i);

/** Kleidung passend zur Rolle (englisch, für Bildprompts). */
export function clothingForRole(role: string, gender: Gender, pick: <T>(items: readonly T[]) => T): string {
  const r = role.toLowerCase();
  if (uw(/mafia|pate|don\b|boss|kartell|clan|gangster|unterwelt|mob/).test(r)) return pick(['tailored black three-piece suit', 'dark pinstripe suit with open collar', 'charcoal suit and black overcoat']);
  if (/kanzler|minister|politi|abgeordnet|präsident|senator|bürgermeister|mayor|president|chancellor/.test(r)) return pick(['navy business suit', 'dark blazer with a lapel pin', 'grey suit and white shirt']);
  if (/ceo|chef|gründer|founder|investor|konzern|analyst|manager|unternehm|industriell/.test(r)) return pick(['tailored blazer over a crisp shirt', 'expensive charcoal suit', 'smart casual blazer']);
  if (/koch|chef de|cook|barista|wirt|café/.test(r)) return pick(['apron over a rolled-up shirt', 'white chef jacket', 'denim shirt and canvas apron']);
  if (/hacker|stream|creator|meme|influencer|tech/.test(r)) return pick(['oversized hoodie', 'graphic t-shirt and bomber jacket', 'black hoodie with headphones around the neck']);
  if (/wissenschaft|scientist|forsch|ingenieur|engineer|techniker|erfinder|inventor/.test(r)) return pick(['lab coat over a sweater', 'work overalls with tool belt', 'practical utility jacket']);
  if (/kommandant|commander|offizier|soldat|polizei|police|kommissar|detective|agent/.test(r)) return pick(['dark uniform with insignia', 'trench coat over a shirt and tie', 'tactical jacket']);
  if (/druid|magier|gilde|guild|priest|ritter|knight/.test(r)) return pick(['hooded linen robe', 'leather jerkin and cloak', 'embroidered velvet coat']);
  if (/stürmer|spieler|trainer|kapitän|athlet|sport|verteidiger/.test(r)) return pick(['team training jacket', 'sports jersey', 'track jacket']);
  if (/sänger|singer|pop|schauspiel|actor|moderator|host|komiker|model|star/.test(r)) return pick(['statement leather jacket', 'elegant evening outfit', 'stylish designer jacket']);
  if (/journalist|reporter|redakt|faktenchecker|podcast/.test(r)) return pick(['casual blazer and t-shirt', 'knit sweater', 'denim jacket over a shirt']);
  if (/student|praktikant|intern/.test(r)) return pick(['casual sweater', 'denim jacket', 'flannel shirt']);
  if (/architekt|buchhänd|tanz|lehrer|teacher|professor/.test(r)) return pick(['knit cardigan', 'linen shirt', 'turtleneck sweater']);
  return gender === 'female' ? pick(['casual blouse', 'light sweater', 'denim jacket']) : gender === 'male' ? pick(['casual shirt', 'light sweater', 'denim jacket']) : pick(['casual jacket', 'light sweater']);
}

/** Erzeugt ein plausibles, festes Aussehen aus Rolle und Seed (für Figuren ohne gespeichertes Aussehen). */
export function deriveAppearance(seed: string, hints: { role?: string; age?: number | null; gender?: Gender | null } = {}): Appearance {
  const r = rng(`appearance:${seed}`);
  const role = hints.role ?? '';
  const gender: Gender = hints.gender ?? (FEMALE_ROLE.test(role) ? 'female' : MALE_ROLE.test(role) ? 'male' : r.pick(['female', 'male'] as const));
  const age = hints.age ?? (/student|praktikant|intern/i.test(role) ? r.int(19, 25) : /professor|großmutter|großvater|veteran/i.test(role) ? r.int(55, 72) : r.int(24, 58));
  const hairColor: HairColor = age > 60 ? r.pick(['grey', 'white', 'grey'] as const) : age > 48 ? r.pick(['grey', 'brown', 'dark-brown', 'black', 'blonde'] as const) : r.pick(['black', 'dark-brown', 'brown', 'auburn', 'blonde', 'black', 'brown', 'red'] as const);
  const hair: HairStyle =
    gender === 'male'
      ? r.pick(['short', 'short', 'buzz', 'wavy', 'curly', 'slicked', ...(age > 45 ? (['bald'] as const) : [])])
      : gender === 'female'
        ? r.pick(['long', 'bob', 'wavy', 'curly', 'ponytail', 'bun', 'braids', 'long'] as const)
        : r.pick(['short', 'bob', 'curly', 'undercut', 'wavy'] as const);
  return {
    kind: 'human',
    gender,
    age,
    skin: r.pick(SKIN_TONES),
    hair,
    hairColor,
    eyes: r.pick(EYE_COLORS),
    build: r.pick(BUILDS),
    facialHair: gender === 'male' ? r.pick(['none', 'none', 'stubble', 'beard', 'mustache'] as const) : 'none',
    features: [r.next() < 0.25 ? 'glasses' : null, r.next() < 0.15 ? 'freckles' : null, gender !== 'male' && r.next() < 0.3 ? 'earrings' : null].filter(
      (f): f is Feature => f !== null,
    ),
    clothing: clothingForRole(role, gender, r.pick),
    clothingHue: r.int(0, 359),
  };
}

/** Prüft und vervollständigt ein gespeichertes oder eingegebenes Aussehen (unbekannte Werte → Standard). */
export function normalizeAppearance(input: unknown, fallback: Appearance): Appearance {
  const a = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof Appearance, unknown>>;
  const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => ((list as readonly string[]).includes(v as string) ? (v as T) : d);
  const age = typeof a.age === 'number' && Number.isFinite(a.age) ? Math.round(Math.min(95, Math.max(18, a.age))) : fallback.age;
  return {
    kind: a.kind === 'robot' ? 'robot' : 'human',
    gender: oneOf(GENDERS, a.gender, fallback.gender),
    age,
    skin: oneOf(SKIN_TONES, a.skin, fallback.skin),
    hair: oneOf(HAIR_STYLES, a.hair, fallback.hair),
    hairColor: oneOf(HAIR_COLORS, a.hairColor, fallback.hairColor),
    eyes: oneOf(EYE_COLORS, a.eyes, fallback.eyes),
    build: oneOf(BUILDS, a.build, fallback.build),
    facialHair: oneOf(FACIAL_HAIR, a.facialHair, fallback.facialHair),
    features: Array.isArray(a.features) ? [...new Set(a.features.filter((f): f is Feature => (FEATURES as readonly string[]).includes(f as string)))] : fallback.features,
    clothing: typeof a.clothing === 'string' && a.clothing.trim() ? a.clothing.trim().replace(/[^\p{L}\p{N} ,.'-]/gu, '').slice(0, 80) : fallback.clothing,
    clothingHue: typeof a.clothingHue === 'number' && Number.isFinite(a.clothingHue) ? Math.round(((a.clothingHue % 360) + 360) % 360) : fallback.clothingHue,
  };
}

const HAIR_WORDS: Record<HairStyle, string> = {
  short: 'short',
  buzz: 'buzz-cut',
  long: 'long straight',
  bob: 'chin-length bob',
  curly: 'curly',
  wavy: 'wavy shoulder-length',
  ponytail: 'tied-back ponytail',
  bun: 'neat bun',
  braids: 'braided',
  afro: 'natural afro',
  undercut: 'undercut',
  slicked: 'slicked-back',
  bald: 'shaved',
  hood: 'hidden',
};

/**
 * Englische Beschreibung für Bildmodelle. Bewusst ohne Namen: Bildmodelle kennen die Figuren nicht,
 * und Namen realer Personen sollen keine echten Gesichter erzeugen.
 */
export function describeAppearance(a: Appearance): string {
  if (a.kind === 'robot') return 'a small matte-grey courier drone with a glowing round sensor eye';
  const person = a.gender === 'female' ? 'woman' : a.gender === 'male' ? 'man' : 'person';
  const hair = a.hair === 'bald' ? 'a shaved head' : a.hair === 'hood' ? 'a face half hidden under a dark hood' : `${HAIR_WORDS[a.hair]} ${a.hairColor.replace('-', ' ')} hair`;
  const extras = [
    a.facialHair !== 'none' ? (a.facialHair === 'beard' ? 'a full beard' : a.facialHair === 'stubble' ? 'light stubble' : 'a mustache') : null,
    a.features.includes('glasses') ? 'glasses' : null,
    a.features.includes('freckles') ? 'freckles' : null,
    a.features.includes('scar') ? 'a small scar on the cheek' : null,
    a.features.includes('earrings') ? 'earrings' : null,
    a.features.includes('tattoo') ? 'a visible tattoo' : null,
  ].filter(Boolean);
  return `a ${a.age}-year-old ${person} with ${hair}, ${a.eyes} eyes, ${a.skin} skin, ${a.build} build${extras.length ? `, ${extras.join(', ')}` : ''}, wearing ${a.clothing}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Gezeichnetes Porträt als SVG – Ersatz, solange kein Foto erzeugt wurde. Gleiches Aussehen ⇒ gleiches Bild. */
export function portraitSvg(a: Appearance, seed: string, label = ''): string {
  const r = rng(`portrait:${seed}`);
  const bgHue = (a.clothingHue + 180) % 360;
  const skin = SKIN_HEX[a.skin];
  const hair = HAIR_HEX[a.hairColor];
  const cloth = `hsl(${a.clothingHue} 45% 32%)`;
  const parts: string[] = [];
  parts.push(
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${bgHue} 35% 28%)"/><stop offset="1" stop-color="hsl(${(bgHue + 40) % 360} 40% 14%)"/></linearGradient></defs>`,
    `<rect width="256" height="256" fill="url(#bg)"/>`,
  );
  if (a.kind === 'robot') {
    parts.push(
      `<ellipse cx="128" cy="140" rx="70" ry="52" fill="#6f7680"/><ellipse cx="128" cy="132" rx="62" ry="40" fill="#8b929c"/>`,
      `<circle cx="128" cy="134" r="24" fill="#1a1f26"/><circle cx="128" cy="134" r="14" fill="hsl(${a.clothingHue} 90% 60%)"/><circle cx="122" cy="128" r="4" fill="#fff" opacity=".8"/>`,
      `<rect x="40" y="118" width="26" height="8" rx="4" fill="#4b525c"/><rect x="190" y="118" width="26" height="8" rx="4" fill="#4b525c"/>`,
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
  }
  const faceW = a.build === 'sturdy' ? 58 : a.build === 'slim' ? 50 : 54;
  const faceH = 66;
  const cy = 116;
  // Schultern und Kleidung
  const shoulder = a.build === 'athletic' || a.build === 'sturdy' ? 96 : 84;
  parts.push(`<path d="M${128 - shoulder} 256 Q${128 - shoulder} 196 128 190 Q${128 + shoulder} 196 ${128 + shoulder} 256 Z" fill="${cloth}"/>`);
  if (/suit|blazer/.test(a.clothing)) parts.push(`<path d="M116 192 L128 230 L140 192 Z" fill="#f2f2f2"/><path d="M125 200 L128 236 L131 200 Z" fill="hsl(${(a.clothingHue + 200) % 360} 50% 35%)"/>`);
  if (/hoodie|hood/.test(a.clothing) || a.hair === 'hood') parts.push(`<path d="M${128 - 62} 210 Q128 168 ${128 + 62} 210" stroke="hsl(${a.clothingHue} 40% 24%)" stroke-width="10" fill="none"/>`);
  // Hals
  parts.push(`<rect x="114" y="${cy + 46}" width="28" height="34" rx="10" fill="${skin}"/><rect x="114" y="${cy + 52}" width="28" height="10" fill="#000" opacity=".08"/>`);
  // Haare hinten (lang)
  if (['long', 'wavy', 'braids', 'curly', 'afro'].includes(a.hair) && a.hair !== 'afro') {
    const len = a.hair === 'long' || a.hair === 'braids' ? 92 : a.hair === 'wavy' ? 70 : 56;
    parts.push(`<path d="M${128 - faceW - 6} ${cy - 10} Q${128 - faceW - 14} ${cy + len} ${128 - faceW + 6} ${cy + len + 6} L${128 + faceW - 6} ${cy + len + 6} Q${128 + faceW + 14} ${cy + len} ${128 + faceW + 6} ${cy - 10} Z" fill="${hair}"/>`);
  }
  if (a.hair === 'afro') parts.push(`<circle cx="128" cy="${cy - 18}" r="${faceW + 24}" fill="${hair}"/>`);
  if (a.hair === 'hood') parts.push(`<path d="M${128 - faceW - 18} ${cy + 60} Q${128 - faceW - 22} ${cy - 70} 128 ${cy - 78} Q${128 + faceW + 22} ${cy - 70} ${128 + faceW + 18} ${cy + 60} Z" fill="hsl(${a.clothingHue} 35% 20%)"/>`);
  // Ohren und Gesicht
  parts.push(
    `<ellipse cx="${128 - faceW + 2}" cy="${cy + 6}" rx="9" ry="13" fill="${skin}"/><ellipse cx="${128 + faceW - 2}" cy="${cy + 6}" rx="9" ry="13" fill="${skin}"/>`,
    `<ellipse cx="128" cy="${cy}" rx="${faceW}" ry="${faceH}" fill="${skin}"/>`,
  );
  if (a.features.includes('earrings')) parts.push(`<circle cx="${128 - faceW + 2}" cy="${cy + 20}" r="3.5" fill="#e8c35a"/><circle cx="${128 + faceW - 2}" cy="${cy + 20}" r="3.5" fill="#e8c35a"/>`);
  // Haare vorn
  const top = cy - faceH + 4;
  switch (a.hair) {
    case 'bald':
      parts.push(`<ellipse cx="128" cy="${top + 18}" rx="${faceW - 8}" ry="16" fill="#fff" opacity=".08"/>`);
      break;
    case 'buzz':
      parts.push(`<path d="M${128 - faceW + 2} ${cy - 12} Q128 ${top - 14} ${128 + faceW - 2} ${cy - 12} Q128 ${top + 4} ${128 - faceW + 2} ${cy - 12} Z" fill="${hair}" opacity=".85"/>`);
      break;
    case 'slicked':
      parts.push(`<path d="M${128 - faceW} ${cy - 6} Q${128 - faceW + 4} ${top - 22} 128 ${top - 20} Q${128 + faceW - 4} ${top - 22} ${128 + faceW} ${cy - 6} Q${128 + 20} ${top + 2} ${128 - faceW} ${cy - 6} Z" fill="${hair}"/>`);
      break;
    case 'undercut':
      parts.push(`<path d="M${128 - faceW + 6} ${cy - 18} Q${128 - 10} ${top - 30} ${128 + faceW + 4} ${cy - 22} Q${128 + 20} ${top} ${128 - faceW + 6} ${cy - 18} Z" fill="${hair}"/>`);
      break;
    case 'bob':
      parts.push(`<path d="M${128 - faceW - 8} ${cy + 26} Q${128 - faceW - 12} ${top - 18} 128 ${top - 16} Q${128 + faceW + 12} ${top - 18} ${128 + faceW + 8} ${cy + 26} L${128 + faceW - 4} ${cy + 26} Q${128 + faceW - 6} ${top + 14} 128 ${top + 10} Q${128 - faceW + 6} ${top + 14} ${128 - faceW + 4} ${cy + 26} Z" fill="${hair}"/>`);
      break;
    case 'curly':
    case 'afro':
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + (i / 8) * Math.PI;
        parts.push(`<circle cx="${128 + Math.cos(ang) * (faceW - 2)}" cy="${cy - 10 + Math.sin(ang) * (faceH - 6)}" r="${14 + r.int(0, 4)}" fill="${hair}"/>`);
      }
      break;
    case 'hood':
      break;
    default: {
      // short, long, wavy, ponytail, bun, braids: Pony-/Scheitel-Form
      parts.push(`<path d="M${128 - faceW - 2} ${cy - 4} Q${128 - faceW} ${top - 22} 128 ${top - 20} Q${128 + faceW} ${top - 22} ${128 + faceW + 2} ${cy - 4} Q${128 + faceW - 8} ${top + 8} ${128 + 6} ${top + 4} Q${128 - 24} ${top + 18} ${128 - faceW - 2} ${cy - 4} Z" fill="${hair}"/>`);
      if (a.hair === 'bun') parts.push(`<circle cx="128" cy="${top - 26}" r="18" fill="${hair}"/>`);
      if (a.hair === 'ponytail') parts.push(`<path d="M${128 + faceW - 6} ${top + 6} Q${128 + faceW + 34} ${cy + 10} ${128 + faceW + 10} ${cy + 60}" stroke="${hair}" stroke-width="14" stroke-linecap="round" fill="none"/>`);
    }
  }
  // Augenbrauen, Augen, Nase, Mund
  const eyeY = cy + 2;
  const browY = eyeY - 14 + r.int(-1, 1);
  const browColor = a.hairColor === 'platinum' || a.hairColor === 'white' ? '#9a8f80' : hair;
  parts.push(
    `<path d="M${128 - 34} ${browY} Q${128 - 22} ${browY - 5} ${128 - 10} ${browY}" stroke="${browColor}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
    `<path d="M${128 + 10} ${browY} Q${128 + 22} ${browY - 5} ${128 + 34} ${browY}" stroke="${browColor}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  );
  for (const dx of [-22, 22]) {
    parts.push(`<ellipse cx="${128 + dx}" cy="${eyeY}" rx="9" ry="6" fill="#fff"/><circle cx="${128 + dx}" cy="${eyeY}" r="4.6" fill="${EYE_HEX[a.eyes]}"/><circle cx="${128 + dx}" cy="${eyeY}" r="2" fill="#111"/><circle cx="${128 + dx - 1.5}" cy="${eyeY - 1.5}" r="1.1" fill="#fff"/>`);
  }
  if (a.age > 45) parts.push(`<path d="M${128 - 34} ${eyeY + 9} q6 3 12 0 M${128 + 22} ${eyeY + 9} q6 3 12 0" stroke="#000" stroke-opacity=".18" stroke-width="1.5" fill="none"/>`);
  parts.push(`<path d="M128 ${eyeY + 6} Q${128 - 6} ${eyeY + 22} 128 ${eyeY + 26} Q${128 + 5} ${eyeY + 27} ${128 + 7} ${eyeY + 24}" stroke="#000" stroke-opacity=".22" stroke-width="2.5" stroke-linecap="round" fill="none"/>`);
  const smile = r.int(2, 7);
  parts.push(`<path d="M${128 - 16} ${eyeY + 38} Q128 ${eyeY + 38 + smile} ${128 + 16} ${eyeY + 38}" stroke="#8c3b3b" stroke-width="3.5" stroke-linecap="round" fill="none"/>`);
  if (a.features.includes('freckles')) {
    for (let i = 0; i < 10; i++) parts.push(`<circle cx="${128 + (i % 2 ? 1 : -1) * r.int(12, 34)}" cy="${eyeY + r.int(10, 22)}" r="1.4" fill="#8a4b2a" opacity=".55"/>`);
  }
  if (a.features.includes('scar')) parts.push(`<path d="M${128 + 30} ${eyeY + 12} l8 14" stroke="#a0615a" stroke-width="2" opacity=".7"/>`);
  if (a.facialHair === 'beard') parts.push(`<path d="M${128 - faceW + 6} ${cy + 10} Q${128 - faceW + 8} ${cy + faceH + 12} 128 ${cy + faceH + 10} Q${128 + faceW - 8} ${cy + faceH + 12} ${128 + faceW - 6} ${cy + 10} Q${128 + 20} ${eyeY + 52} 128 ${eyeY + 50} Q${128 - 20} ${eyeY + 52} ${128 - faceW + 6} ${cy + 10} Z" fill="${hair}" opacity=".9"/>`);
  if (a.facialHair === 'mustache' || a.facialHair === 'beard') parts.push(`<path d="M${128 - 18} ${eyeY + 34} Q128 ${eyeY + 26} ${128 + 18} ${eyeY + 34} Q128 ${eyeY + 31} ${128 - 18} ${eyeY + 34} Z" fill="${hair}"/>`);
  if (a.facialHair === 'stubble') parts.push(`<path d="M${128 - faceW + 10} ${cy + 18} Q128 ${cy + faceH + 8} ${128 + faceW - 10} ${cy + 18}" stroke="${hair}" stroke-opacity=".35" stroke-width="14" fill="none"/>`);
  if (a.features.includes('glasses')) {
    parts.push(
      `<circle cx="${128 - 22}" cy="${eyeY}" r="13" fill="none" stroke="#222" stroke-width="3"/><circle cx="${128 + 22}" cy="${eyeY}" r="13" fill="none" stroke="#222" stroke-width="3"/><path d="M${128 - 9} ${eyeY} h18" stroke="#222" stroke-width="3"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
}
