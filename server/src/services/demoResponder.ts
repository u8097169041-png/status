import type { Lang, WritingStyle } from '../../../shared/constants';
import { CHAT, STOPWORDS } from '../content/voiceTemplates';
import { createRng } from '../lib/rng';
import { fill, truncate } from '../lib/text';

export interface DemoCharacter {
  id: string;
  name: string;
  tagline: string;
  description: string;
  role: string;
  interests: string[];
  writingStyle: WritingStyle;
  worldName: string | null;
  worldTagline: string | null;
  relations: string[];
}

export interface DemoContext {
  lang: Lang;
  userName: string | null;
  facts: string[];
  lastEvent: string | null;
  turn: number;
}

const GREETING = /^(hallo|hi|hey|moin|servus|grüß|guten (morgen|tag|abend)|hello|good (morning|evening|afternoon)|yo)\b/i;
const WHO = /(wer bist du|stell dich vor|who are you|introduce yourself|erzähl.*über dich|tell me about yourself)/i;
const ROLE = /(was machst du|was ist dein (job|beruf)|what do you do|your job)/i;
const INTERESTS = /(interess|hobby|hobbies|magst du|what do you like|was gefällt dir)/i;
const WORLD = /(wo lebst du|wo wohnst du|deine welt|where do you live|your world)/i;
const RELATIONS = /(freund|feind|familie|beziehung|friends?|enem(y|ies)|family|relationship)/i;
const FEELINGS = /(traurig|einsam|müde|gestresst|angst|schlecht drauf|sad|lonely|tired|stressed|anxious|afraid)/i;
const THANKS = /^(danke|vielen dank|thx|thanks|thank you)\b/i;

/** Wählt ein aussagekräftiges Stichwort aus der Nachricht. */
export function keywordOf(message: string): string | null {
  const words = message
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return words.reduce((best, w) => (w.length > best.length ? w : best), words[0]);
}

function styleCase(text: string, style: WritingStyle): string {
  if (style === 'sarcastic' || style === 'terse') return text.toLowerCase();
  return text;
}

/**
 * Lokaler Demo-Antwortgenerator: deterministisch, kostenlos und ohne Netzwerk.
 * Er erzeugt plausible, aber einfache Antworten und ersetzt keine echte KI.
 */
export function demoReply(character: DemoCharacter, message: string, ctx: DemoContext): string {
  const rng = createRng(`${character.id}:${ctx.turn}:${message}`);
  const t = (l: { de: string; en: string }) => l[ctx.lang];
  const style = character.writingStyle;
  const parts: string[] = [];
  const trimmed = message.trim();
  const interest = character.interests.length ? rng.pick(character.interests) : null;

  if (GREETING.test(trimmed)) {
    parts.push(fill(t(rng.pick(CHAT.greeting[style])), { name: ctx.userName ? `, ${ctx.userName}` : '' }));
    if (character.tagline) parts.push(character.tagline);
  } else if (THANKS.test(trimmed)) {
    parts.push(t(CHAT.thanks));
  } else if (WHO.test(trimmed)) {
    parts.push(fill(t(CHAT.whoAmI), { name: character.name, description: truncate(character.description, 220) }));
  } else if (ROLE.test(trimmed) && character.role) {
    parts.push(fill(t(CHAT.role), { role: character.role, tagline: character.tagline }));
  } else if (INTERESTS.test(trimmed) && character.interests.length) {
    parts.push(fill(t(CHAT.interests), { interests: character.interests.slice(0, 3).join(', ') }));
  } else if (WORLD.test(trimmed) && character.worldName) {
    parts.push(fill(t(CHAT.world), { world: character.worldName, worldTagline: character.worldTagline ?? '' }));
  } else if (RELATIONS.test(trimmed)) {
    parts.push(
      character.relations.length
        ? fill(t(CHAT.relations), { relations: character.relations.slice(0, 3).join(', ') })
        : t(CHAT.noRelations),
    );
  } else if (FEELINGS.test(trimmed)) {
    parts.push(t(CHAT.feelings));
  } else {
    const keyword = keywordOf(trimmed);
    parts.push(keyword ? fill(t(rng.pick(CHAT.reflect[style])), { keyword }) : t(rng.pick(CHAT.fallback)));
    if (interest && rng.chance(0.6)) parts.push(fill(t(rng.pick(CHAT.interest)), { interest }));
  }

  if (ctx.facts.length && ctx.turn % 3 === 2) {
    parts.push(fill(t(rng.pick(CHAT.memory)), { fact: rng.pick(ctx.facts) }));
  } else if (ctx.lastEvent && ctx.turn % 5 === 4) {
    parts.push(fill(t(rng.pick(CHAT.event)), { event: ctx.lastEvent }));
  }
  if (trimmed.endsWith('?') === false && rng.chance(0.35) && style !== 'terse') {
    parts.push(t(rng.pick(CHAT.question)));
  }
  const maxParts = style === 'terse' ? 2 : 3;
  return styleCase(parts.slice(0, maxParts).join(' '), style);
}

// ---- Regelbasierte Erinnerung ----

const FACT_PATTERNS: { re: RegExp; make: (m: RegExpMatchArray, lang: Lang) => string }[] = [
  { re: /\b(?:ich heiße|mein name ist|nenn mich)\s+([\p{L}][\p{L}-]{1,29})/iu, make: (m) => `Name: ${m[1]}` },
  { re: /\b(?:my name is|call me|i am called|i'm called)\s+([\p{L}][\p{L}-]{1,29})/iu, make: (m) => `Name: ${m[1]}` },
  { re: /\bich (?:mag|liebe)\s+([^.!?\n]{2,60})/iu, make: (m, l) => (l === 'de' ? `Mag ${m[1].trim()}` : `Likes ${m[1].trim()}`) },
  { re: /\bi (?:like|love|enjoy)\s+([^.!?\n]{2,60})/iu, make: (m, l) => (l === 'de' ? `Mag ${m[1].trim()}` : `Likes ${m[1].trim()}`) },
  { re: /\bich (?:arbeite als|bin von beruf)\s+([^.!?\n]{2,60})/iu, make: (m, l) => (l === 'de' ? `Arbeitet als ${m[1].trim()}` : `Works as ${m[1].trim()}`) },
  { re: /\bi work as\s+([^.!?\n]{2,60})/iu, make: (m, l) => (l === 'de' ? `Arbeitet als ${m[1].trim()}` : `Works as ${m[1].trim()}`) },
  { re: /\bich (?:wohne|lebe) in\s+([^.!?\n]{2,40})/iu, make: (m, l) => (l === 'de' ? `Wohnt in ${m[1].trim()}` : `Lives in ${m[1].trim()}`) },
  { re: /\bi live in\s+([^.!?\n]{2,40})/iu, make: (m, l) => (l === 'de' ? `Wohnt in ${m[1].trim()}` : `Lives in ${m[1].trim()}`) },
  { re: /\bich bin\s+(\d{1,3})\s+jahre/iu, make: (m, l) => (l === 'de' ? `Ist ${m[1]} Jahre alt` : `Is ${m[1]} years old`) },
  { re: /\bi(?:'m| am)\s+(\d{1,3})\s+years/iu, make: (m, l) => (l === 'de' ? `Ist ${m[1]} Jahre alt` : `Is ${m[1]} years old`) },
  { re: /\bmein(?:e)? lieblings(\p{L}+) ist\s+([^.!?\n]{2,40})/iu, make: (m) => `Lieblings${m[1]}: ${m[2].trim()}` },
  { re: /\bmy favou?rite (\p{L}+) is\s+([^.!?\n]{2,40})/iu, make: (m) => `Favourite ${m[1]}: ${m[2].trim()}` },
  { re: /\b(?:merk dir|merke dir|bitte merken)[:,]?\s+([^\n]{3,200})/iu, make: (m) => m[1].trim() },
  { re: /\bremember(?: that)?[:,]?\s+([^\n]{3,200})/iu, make: (m) => m[1].trim() },
];

/** Erkennt einfache, nachvollziehbare Fakten über den Nutzer in einer Nachricht. */
export function extractFacts(message: string, lang: Lang): string[] {
  const facts: string[] = [];
  for (const { re, make } of FACT_PATTERNS) {
    const match = message.match(re);
    if (match) facts.push(truncate(make(match, lang), 300));
  }
  return [...new Set(facts)];
}

/** Einfache, lokale Zusammenfassung: häufigste Stichworte älterer Nutzernachrichten. */
export function localSummary(messages: string[], previous: string | null, lang: Lang): string {
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const word of message.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)) {
      const w = word.trim();
      if (w.length < 4 || STOPWORDS.has(w.toLowerCase())) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const prevTopics = previous?.match(/:\s*(.*)$/)?.[1]?.split(', ').filter(Boolean) ?? [];
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .filter((w) => !prevTopics.includes(w))
    .slice(0, 8);
  const topics = [...prevTopics, ...top].slice(-12);
  return (lang === 'de' ? 'Frühere Gesprächsthemen: ' : 'Earlier conversation topics: ') + topics.join(', ');
}
