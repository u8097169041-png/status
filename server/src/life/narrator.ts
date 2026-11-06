/**
 * Erzähler der Lebenssimulation. Vor jeder Antwort werden die relevanten Erinnerungen, Figurensteckbriefe,
 * Wissensgrenzen und der aktuelle Weltzustand abgerufen und begrenzt in den Kontext gelegt. Die KI erzählt das
 * vom Spielsystem entschiedene Ergebnis; ihre Ausgabe wird geprüft (keine Toten, die sprechen, keine Fremdfiguren).
 */
import { describeAppearance } from '../../../shared/appearance';
import { ACTION_CATEGORIES, SUGGESTION_KINDS, type ActionCategory, type LifeGenre, type LifeStat, type LifeStats, type LifeSuggestion, type SuggestionKind } from '../../../shared/life';
import type { JsonSchema } from '../ai/types';
import { sanitizeModelText } from '../ai/structured';
import { CRITICAL_TEXT, OUTCOME_TEXT, REACTION_LINES, SUGGESTIONS, type SuggestionTemplate } from '../content/lifeContent';
import type { AppContext } from '../context';
import { all, parseJson } from '../db/database';
import { newId } from '../lib/ids';
import type { Rng } from '../lib/rng';
import { fill, truncate } from '../lib/text';
import { lifeAppearance, playerAppearance, type LifeCharacterRow } from './characters';
import { classifyAction, type EventOutcome, type Resolution } from './engine';
import { knows, PLAYER, recall, recentSummaries, openPromises } from './memory';
import { statLevel } from './stats';
import { genresOf, presentOf, statKeysOf, statsOf, worldOf, type StoryRow } from './store';

export interface TurnContext {
  playerText: string;
  resolution: Resolution | null;
  events: EventOutcome[];
  mode: 'turn' | 'opening' | 'time' | 'away';
}

export interface Narration {
  narration: string;
  dialogue: { speakerId: string; text: string }[];
  suggestions: LifeSuggestion[];
  location: string | null;
  present: string[] | null;
  facts: { text: string; importance: number; knownBy: string[] }[];
  provider: 'local' | 'server' | 'fallback';
  model: string | null;
}

const LANGUAGE: Record<'de' | 'en', string> = { de: 'German', en: 'English' };

export const NARRATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narration: { type: 'string', maxLength: 900 },
    dialogue: {
      type: 'array',
      maxItems: 3,
      items: { type: 'object', properties: { speaker: { type: 'string', maxLength: 60 }, text: { type: 'string', maxLength: 300 } }, required: ['speaker', 'text'] },
    },
    location: { type: 'string', maxLength: 80 },
    present: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 60 } },
    facts: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', maxLength: 200 },
          importance: { type: 'integer', minimum: 1, maximum: 4 },
          knownBy: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 60 } },
        },
        required: ['text', 'importance'],
      },
    },
    suggestions: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...SUGGESTION_KINDS] },
          text: { type: 'string', maxLength: 110 },
          category: { type: 'string', enum: [...ACTION_CATEGORIES] },
          target: { type: 'string', maxLength: 60 },
        },
        required: ['kind', 'text'],
      },
    },
  },
  required: ['narration', 'dialogue', 'suggestions'],
};

function relationWords(c: LifeCharacterRow): string {
  const a = c.affinity >= 50 ? 'very fond of the player' : c.affinity >= 15 ? 'likes the player' : c.affinity <= -50 ? 'hates the player' : c.affinity <= -15 ? 'dislikes the player' : 'neutral towards the player';
  return `${a}; trust ${c.trust}/100, loyalty ${c.loyalty}/100, fear ${c.fear}/100; stance: ${c.stance}`;
}

function formatStats(stats: LifeStats, keys: LifeStat[]): string {
  return keys.map((k) => `${k} ${stats[k]} (${statLevel(stats[k] ?? 0, k === 'heat')})`).join(', ');
}

/** Baut den vollständigen, begrenzten Kontext für eine Erzählung. */
export function buildNarrationMessages(ctx: AppContext, story: StoryRow, chars: LifeCharacterRow[], turn: TurnContext): { system: string; user: string } {
  const world = worldOf(story);
  const stats = statsOf(story);
  const present = new Set(presentOf(story));
  if (turn.resolution?.targetId) present.add(turn.resolution.targetId);
  for (const e of turn.events) for (const p of e.participants) present.add(p);
  const alive = chars.filter((c) => c.status === 'alive');
  const presentChars = alive.filter((c) => present.has(c.id)).slice(0, 4);
  const others = chars.filter((c) => !presentChars.includes(c));
  const query = `${turn.playerText} ${turn.events.map((e) => e.title).join(' ')} ${presentChars.map((c) => c.name).join(' ')}`;
  const memories = recall(ctx, story.id, { query, subjects: [...present], viewer: PLAYER, turn: story.turn, limit: 10, criticalLimit: 12 });
  const summaries = recentSummaries(ctx, story.id, 3);
  const promises = openPromises(ctx, story.id).filter((p) => knows(p, PLAYER)).slice(0, 5);
  const history = all<{ role: string; speaker_id: string | null; content: string; pending: number }>(
    ctx.db,
    `SELECT role, speaker_id, content, pending FROM (SELECT * FROM life_messages WHERE story_id = ? AND pending = 0 AND role != 'image' ORDER BY id DESC LIMIT 12) ORDER BY id`,
    story.id,
  );
  const nameOf = (id: string | null) => chars.find((c) => c.id === id)?.name ?? '?';

  const lines: string[] = [];
  lines.push(`## Story: ${story.title}`);
  lines.push(truncate(story.premise, 700));
  lines.push(`Setting: ${truncate(world.setting, 200)}. Genres: ${genresOf(story).join(', ')}. Day ${story.day}. Current location: ${story.location || 'unknown'}.`);
  if (world.locations.length) lines.push(`Known places: ${world.locations.slice(0, 8).join(', ')}`);
  if (world.organizations.length) lines.push(`Organizations: ${world.organizations.slice(0, 6).join(', ')}`);
  if (world.rules.length) lines.push(`World rules: ${world.rules.slice(0, 5).join(' | ')}`);
  lines.push('');
  lines.push(`## The player character (addressed as "you")`);
  lines.push(`${story.player_name}, ${story.player_role}. Looks: ${describeAppearance(playerAppearance(story))}.`);
  lines.push(`Status values (0-100, decided by the game system): ${formatStats(stats, statKeysOf(story))}.`);
  const assets = parseJson<string[]>(story.assets, []);
  if (assets.length) lines.push(`Possessions: ${assets.slice(0, 8).join(', ')}`);
  if (promises.length) lines.push(`Open promises: ${promises.map((p) => p.content).join(' | ')}`);
  lines.push('');
  lines.push('## Characters in this scene');
  for (const c of presentChars) {
    const known = recall(ctx, story.id, { query, subjects: [c.id], viewer: c.id, turn: story.turn, limit: 4, criticalLimit: 4 });
    lines.push(`- ${c.name} (${c.role}). Personality: ${parseJson<string[]>(c.personality, []).join(', ')}. Goals: ${parseJson<string[]>(c.goals, []).join('; ')}.`);
    lines.push(`  Looks: ${describeAppearance(lifeAppearance(ctx, c))}. Relationship: ${relationWords(c)}.`);
    if (known.length) lines.push(`  ${c.name} knows: ${known.map((m) => m.content).join(' | ')}`);
    const secrets = parseJson<string[]>(c.secrets, []);
    if (secrets.length) lines.push(`  Hidden secret (narrator only, never reveal unless discovered in play): ${secrets.join(' | ')}`);
  }
  if (!presentChars.length) lines.push('(nobody specific)');
  const absent = others.filter((c) => c.status === 'alive').slice(0, 8);
  if (absent.length) lines.push(`Other characters (not here): ${absent.map((c) => `${c.name} (${c.role}, ${c.stance})`).join('; ')}`);
  const gone = chars.filter((c) => c.status !== 'alive');
  if (gone.length) lines.push(`These characters CANNOT act or speak: ${gone.map((c) => `${c.name} (${c.status})`).join(', ')}.`);
  lines.push('');
  if (summaries.length) {
    lines.push('## Earlier in the story');
    for (const s of summaries) lines.push(`- ${s.content}`);
    lines.push('');
  }
  if (memories.length) {
    lines.push('## Long-term memory (facts the player knows; never contradict them)');
    for (const m of memories) lines.push(`- [turn ${m.turn}${m.critical ? ', critical' : ''}] ${m.content}`);
    lines.push('');
  }
  if (history.length) {
    lines.push('## Recent messages');
    for (const h of history) {
      const who = h.role === 'player' ? story.player_name : h.role === 'character' ? nameOf(h.speaker_id) : h.role === 'event' ? 'Event' : 'Narrator';
      lines.push(`${who}: ${truncate(h.content, 300)}`);
    }
    lines.push('');
  }
  lines.push('## This turn');
  if (turn.mode === 'opening') lines.push('The story starts now. Describe the opening scene.');
  if (turn.mode === 'time' || turn.mode === 'away') lines.push('Several days pass. Summarize how life went on and what changed.');
  if (turn.playerText) lines.push(`Player action: "${truncate(turn.playerText, 400)}"`);
  const r = turn.resolution;
  if (r) {
    const target = chars.find((c) => c.id === r.targetId);
    const changes = Object.entries(r.statChanges)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`)
      .join(', ');
    lines.push(
      `Game system result (authoritative, narrate it faithfully): action type ${r.category}${target ? ` towards ${target.name}` : ''}, outcome ${r.tier.replace('_', ' ')} (success chance was ${Math.round(r.chance * 100)}%).` +
        (changes ? ` Changes: ${changes}.` : '') +
        (r.targetStatus?.status === 'dead' ? ` ${target?.name} dies.` : r.targetStatus?.status === 'gone' ? ` ${target?.name} flees.` : '') +
        (r.revealedSecret ? ` The player discovers: ${r.revealedSecret.secret}` : '') +
        (r.playerDied ? ' The player character dies. This is final.' : ''),
    );
  }
  for (const e of turn.events) lines.push(`Event that happens now (authoritative): ${e.title} – ${e.description}`);

  const system = [
    'You are the narrator and all non-player characters of a realistic, ongoing life simulation called SocialVerse.',
    `Write in ${LANGUAGE[story.lang]}. Address the player character in the second person (${story.lang === 'de' ? '"du"' : '"you"'}).`,
    'Rules:',
    '- The game system decides outcomes. Narrate its result faithfully. Never turn a failure into a success, never soften consequences, never invent rewards.',
    '- Life is not always positive: setbacks, conflicts, losses and betrayal are possible. Characters are not automatically friendly.',
    '- Keep every character consistent with their personality, goals, relationship values and history. Characters never change their personality abruptly.',
    '- A character may only refer to things listed under what they know, things that happened in their presence, or what the player tells them now.',
    '- Dead, imprisoned, missing or gone characters cannot act or speak. Never contradict established facts from memory.',
    '- Characters act on their own goals; they may make decisions, refuse, demand or surprise.',
    '- Violence may be described but not gratuitously; no sexual content; all characters are adults; fictional story.',
    '- Then propose exactly 4 short next actions for the player (max 12 words each, in the same language), one per kind: "smart" (sensible/strategic), "alternative", "risky" (could go badly), "surprising" (unusual). They must fit the current situation and not repeat earlier suggestions.',
    '- "facts": up to 3 new important facts from this scene worth remembering long-term (promises, revelations, decisions), with who knows them.',
    'Respond ONLY with JSON: {"narration": string, "dialogue": [{"speaker": name, "text": string}], "location": string, "present": [names], "facts": [{"text", "importance", "knownBy": [names or "player" or "everyone"]}], "suggestions": [{"kind", "text", "category", "target"}]}.',
  ].join('\n');
  return { system, user: lines.join('\n') };
}

// ---------- Vorschläge (regelbasiert) ----------

function targetsFor(needs: SuggestionTemplate['needs'], chars: LifeCharacterRow[], genres: LifeGenre[]): LifeCharacterRow[] {
  const alive = chars.filter((c) => c.status === 'alive');
  switch (needs) {
    case 'ally':
      return alive.filter((c) => c.affinity >= 15 && c.stance !== 'enemy' && c.stance !== 'rival');
    case 'foe':
      return alive.filter((c) => c.affinity <= -15 || c.stance === 'enemy' || c.stance === 'rival');
    case 'love':
      return alive.filter((c) => c.stance === 'love' || (genres.includes('romance') && c.affinity >= 35 && c.stance !== 'family'));
    case 'any':
      return alive;
    default:
      return [];
  }
}

export function ruleSuggestions(story: StoryRow, chars: LifeCharacterRow[], rng: Rng, recentTexts: string[]): LifeSuggestion[] {
  const genres = genresOf(story);
  const stats = statsOf(story);
  const lang = story.lang;
  const out: LifeSuggestion[] = [];
  const present = new Set(presentOf(story));
  for (const kind of SUGGESTION_KINDS) {
    const pool: SuggestionTemplate[] = [...genres.flatMap((g) => SUGGESTIONS[g]?.[kind] ?? []), ...(SUGGESTIONS.common[kind] ?? [])];
    // Zustandsabhängige Vernunft: verletzt → erholen, viel Aufmerksamkeit → untertauchen.
    if (kind === 'smart' && (stats.health ?? 100) < 35) pool.unshift({ text: { de: 'Deine Verletzungen behandeln lassen', en: 'Get your injuries treated' }, category: 'rest', risk: 1 });
    if (kind === 'smart' && (stats.heat ?? 0) > 70) pool.unshift({ text: { de: 'Untertauchen, bis sich die Lage beruhigt', en: 'Lie low until things calm down' }, category: 'wait', risk: 1 });
    const options = rng
      .shuffle(pool)
      .map((t) => {
        const candidates = t.needs ? targetsFor(t.needs, chars, genres) : [];
        if (t.needs && !candidates.length) return null;
        // Anwesende Figuren bevorzugen.
        const target = candidates.find((c) => present.has(c.id)) ?? (candidates.length ? rng.pick(candidates) : null);
        const text = fill(t.text[lang], { npc: target?.name ?? '' });
        return { t, target, text };
      })
      .filter((x): x is { t: SuggestionTemplate; target: LifeCharacterRow | null; text: string } => x !== null);
    const fresh = options.find((o) => !recentTexts.includes(o.text) && !out.some((s) => s.text === o.text)) ?? options[0];
    if (!fresh) continue;
    out.push({ id: newId('sg'), kind, text: fresh.text, category: fresh.t.category, risk: fresh.t.risk, targetId: fresh.target?.id ?? null });
  }
  return out;
}

// ---------- Ersatz-Erzählung ohne KI ----------

export function fallbackNarration(story: StoryRow, chars: LifeCharacterRow[], turn: TurnContext, rng: Rng, recentTexts: string[]): Narration {
  const lang = story.lang;
  const r = turn.resolution;
  const target = r ? chars.find((c) => c.id === r.targetId) : undefined;
  const parts: string[] = [];
  const dialogue: Narration['dialogue'] = [];
  if (r) {
    const group = r.tier === 'critical_success' || r.tier === 'success' ? 'success' : r.tier === 'partial' ? 'partial' : 'failure';
    parts.push(fill(OUTCOME_TEXT[r.category][group][lang], { target: target?.name ?? (lang === 'de' ? 'Dein Gegenüber' : 'The other person'), with: target ? (lang === 'de' ? ` mit ${target.name}` : ` with ${target.name}`) : '' }));
    if (r.tier === 'critical_success') parts.push(CRITICAL_TEXT.success[lang]);
    if (r.tier === 'critical_failure') parts.push(CRITICAL_TEXT.failure[lang]);
    if (r.revealedSecret) parts.push(lang === 'de' ? `Du erfährst: ${r.revealedSecret.secret}` : `You find out: ${r.revealedSecret.secret}`);
    if (target && target.status === 'alive' && !r.playerDied) {
      const mood = target.fear >= 60 ? 'afraid' : target.affinity >= 25 ? 'warm' : target.affinity <= -25 ? 'hostile' : 'cool';
      dialogue.push({ speakerId: target.id, text: rng.pick(REACTION_LINES[mood])[lang] });
    }
  }
  if (turn.mode === 'opening') parts.push(lang === 'de' ? 'Was tust du?' : 'What do you do?');
  return {
    narration: parts.join(' '),
    dialogue,
    suggestions: ruleSuggestions(story, chars, rng, recentTexts),
    location: null,
    present: null,
    facts: [],
    provider: 'fallback',
    model: null,
  };
}

// ---------- Prüfung der KI-Ausgabe ----------

function matchCharacter(name: string, chars: LifeCharacterRow[]): LifeCharacterRow | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return chars.find((c) => c.name.toLowerCase() === n) ?? chars.find((c) => c.name.toLowerCase().split(/\s+/)[0] === n.split(/\s+/)[0]);
}

export function parseNarration(raw: string, story: StoryRow, chars: LifeCharacterRow[], rng: Rng, recentTexts: string[]): Omit<Narration, 'provider' | 'model'> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const narration = sanitizeModelText(typeof data.narration === 'string' ? data.narration : '', 1200);
  if (!narration) return null;
  const alive = chars.filter((c) => c.status === 'alive');
  // Nur lebende, bekannte Figuren dürfen sprechen – keine erfundenen oder toten Sprecher.
  const dialogue = (Array.isArray(data.dialogue) ? data.dialogue : [])
    .map((d) => d as { speaker?: unknown; text?: unknown })
    .map((d) => ({ c: typeof d.speaker === 'string' ? matchCharacter(d.speaker, alive) : undefined, text: sanitizeModelText(typeof d.text === 'string' ? d.text : '', 400) }))
    .filter((d): d is { c: LifeCharacterRow; text: string } => Boolean(d.c && d.text))
    .slice(0, 3)
    .map((d) => ({ speakerId: d.c.id, text: d.text }));
  const ruleBased = ruleSuggestions(story, chars, rng, recentTexts);
  const seen = new Set(recentTexts.map((t) => t.toLowerCase()));
  const suggestions: LifeSuggestion[] = SUGGESTION_KINDS.map((kind) => {
    // Wiederholte oder doppelte Vorschläge der KI werden durch passende regelbasierte ersetzt.
    const s = (Array.isArray(data.suggestions) ? data.suggestions : [])
      .map((x) => x as { kind?: unknown; text?: unknown; category?: unknown; target?: unknown })
      .find((x) => x.kind === kind && typeof x.text === 'string' && x.text.trim() && !seen.has(sanitizeModelText(x.text, 140).toLowerCase()));
    if (!s) return ruleBased.find((r) => r.kind === kind)!;
    const text = sanitizeModelText(String(s.text), 140);
    seen.add(text.toLowerCase());
    const target = typeof s.target === 'string' ? matchCharacter(s.target, alive) : undefined;
    const cls = classifyAction(text, chars, target ? [target.id] : presentOf(story));
    const category = (ACTION_CATEGORIES as readonly string[]).includes(String(s.category)) ? (s.category as ActionCategory) : cls.category;
    const risk: 1 | 2 | 3 = kind === 'risky' ? 3 : kind === 'surprising' ? 2 : cls.risk;
    return { id: newId('sg'), kind: kind as SuggestionKind, text, category, risk, targetId: target?.id ?? cls.targetId };
  }).filter(Boolean);
  const location = typeof data.location === 'string' ? sanitizeModelText(data.location, 80) || null : null;
  const present = Array.isArray(data.present)
    ? data.present
        .map((n) => (typeof n === 'string' ? matchCharacter(n, alive)?.id : undefined))
        .filter((id): id is string => Boolean(id))
    : null;
  const facts = (Array.isArray(data.facts) ? data.facts : [])
    .map((f) => f as { text?: unknown; importance?: unknown; knownBy?: unknown })
    .filter((f) => typeof f.text === 'string' && f.text.trim())
    .slice(0, 3)
    .map((f) => ({
      text: sanitizeModelText(String(f.text), 240),
      importance: Math.max(1, Math.min(4, Number(f.importance) || 2)),
      knownBy: (Array.isArray(f.knownBy) ? f.knownBy : [])
        .map((k) => (typeof k === 'string' ? (/^(everyone|alle|all)$/i.test(k) ? '*' : /^(player|spieler)$/i.test(k) ? PLAYER : matchCharacter(k, chars)?.id) : undefined))
        .filter((k): k is string => Boolean(k)),
    }));
  return { narration, dialogue, suggestions, location, present, facts };
}

/** Erzählt einen Zug mit der verfügbaren KI; bei Ausfall oder unbrauchbarer Antwort regelbasiert. */
export async function narrate(ctx: AppContext, story: StoryRow, chars: LifeCharacterRow[], turn: TurnContext, rng: Rng, recentTexts: string[], background: boolean): Promise<Narration> {
  const fallback = () => fallbackNarration(story, chars, turn, rng, recentTexts);
  // Hintergrund-Ereignisse (während der Abwesenheit) sparen KI-Aufrufe.
  if (background || !ctx.ai.isActive('chat')) return fallback();
  const { system, user } = buildNarrationMessages(ctx, story, chars, turn);
  const result = await ctx.ai.complete({
    purpose: 'story',
    kind: 'chat',
    json: NARRATION_SCHEMA,
    long: true,
    maxTokens: 900,
    // Steckbriefe, Gedächtnis und Verlauf brauchen mehr Platz als ein Social-Chat.
    numCtx: 8192,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  if (!result.ok || result.provider === 'fallback') return fallback();
  const parsed = parseNarration(result.text, story, chars, rng, recentTexts);
  if (!parsed) return fallback();
  return { ...parsed, provider: result.provider, model: result.model };
}
