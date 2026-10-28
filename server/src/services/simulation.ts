import { z } from 'zod';
import { LIMITS, type Lang, type WorldMetric } from '../../../shared/constants';
import { clampMetric } from '../../../shared/relationships';
import type {
  CharacterRef,
  EventCard,
  EventEffect,
  ProgressDelta,
  SimulationResult,
  SimulationStatusDto,
} from '../../../shared/types';
import { characterSystemPrompt } from '../ai/prompts';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import {
  EVENT_CARDS,
  EVENT_TEMPLATES,
  STORY_TEMPLATES,
  STORYLINE_TEMPLATES,
  STORYLINE_TEXT,
  type EventTemplate,
} from '../content/simulationTemplates';
import type { L } from '../content/seedWorlds';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { createRng, type Rng } from '../lib/rng';
import { cleanText, fill, slugifyHandle, truncate } from '../lib/text';
import { addMinutes, dayKey } from '../lib/time';
import { loadPromptCharacter } from './characterContext';
import { getProfileRow, type CharacterRow } from './mappers';
import { notify } from './notifications';
import { addCharacterLike, insertCharacterComment, insertCharacterPost } from './posts';
import { createStorylineDecision, maybeCreateDecision } from './decisions';
import { activeWorldId } from './players';
import { checkAchievements, emptyDelta, recordAction } from './progress';
import { getLanguage, getSettings } from './settings';
import { adjustAffinity, toStoryline } from './society';
import { insertCharacterStory } from './stories';
import { buildEndings } from '../content/arcEndings';
import { resolveArc } from './arcs';
import { refreshWorldQuests } from './quests';
import { cardUnlocked } from './wallet';
import { getWorldRow, getWorldSummary, toEvent } from './worlds';

type SimCharacter = Pick<CharacterRow, 'id' | 'name' | 'handle' | 'avatar_hue' | 'avatar_glyph' | 'interests' | 'mood' | 'is_real_person_sim'>;

/** Ereignisarten, die Beteiligten Negatives zuschreiben – nicht für Simulationen realer Personen. */
const NEGATIVE_KINDS = new Set(['conflict', 'rumor', 'rivalry', 'setback']);

interface PlannedPost {
  characterId: string;
  text: string;
  eventIndex: number;
  comment?: { characterId: string; text: string };
  likers: string[];
  context: string;
  ai?: boolean;
}

interface PlannedEvent {
  id: string;
  kind: string;
  title: string;
  description: string;
  source: 'sim' | 'user';
  effects: EventEffect[];
  participants: CharacterRef[];
  storylineId: string | null;
}

const runningWorlds = new Set<string>();

function ref(c: SimCharacter): CharacterRef {
  return { id: c.id, name: c.name, avatarHue: c.avatar_hue, avatarGlyph: c.avatar_glyph as CharacterRef['avatarGlyph'] };
}

export function worldTag(name: string): string {
  return slugifyHandle(name).replace(/_/g, '') || 'socialverse';
}

function interestOf(rng: Rng, c: SimCharacter, lang: Lang): string {
  const interests = parseJson<string[]>(c.interests, []);
  if (interests.length) return rng.pick(interests);
  return lang === 'de' ? 'den Alltag' : 'everyday life';
}

function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

function affinityBetween(ctx: AppContext, x: string, y: string): number | null {
  const [a, b] = x < y ? [x, y] : [y, x];
  return get<{ affinity: number }>(ctx.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b)?.affinity ?? null;
}

/** Wählt ein passendes Paar für eine Vorlage. */
function pickPair(
  ctx: AppContext,
  rng: Rng,
  chars: SimCharacter[],
  requires?: 'positive' | 'negative',
  usedPairs: Set<string> = new Set(),
): [SimCharacter, SimCharacter] | null {
  if (chars.length < 2) return null;
  const pairs: [SimCharacter, SimCharacter, number | null][] = [];
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      if (usedPairs.has(pairKey(chars[i].id, chars[j].id))) continue;
      pairs.push([chars[i], chars[j], affinityBetween(ctx, chars[i].id, chars[j].id)]);
    }
  }
  let candidates = pairs;
  if (requires === 'negative') candidates = pairs.filter((p) => p[2] !== null && p[2] < -10);
  if (requires === 'positive') candidates = pairs.filter((p) => p[2] !== null && p[2] > 10);
  if (candidates.length === 0) return null;
  // Bestehende Beziehungen werden bevorzugt, damit sich Geschichten fortsetzen.
  const known = candidates.filter((p) => p[2] !== null);
  const pool = known.length > 0 && rng.chance(0.7) ? known : candidates;
  const [a, b] = rng.pick(pool);
  return rng.chance(0.5) ? [a, b] : [b, a];
}

interface SimState {
  world: ReturnType<typeof getWorldRow>;
  metrics: Record<WorldMetric, number>;
  lang: Lang;
  tag: string;
  userName: string;
}

function applyMetrics(state: SimState, deltas: Partial<Record<WorldMetric, number>>, effects: EventEffect[]): void {
  for (const [metric, delta] of Object.entries(deltas) as [WorldMetric, number][]) {
    if (!delta) continue;
    const before = state.metrics[metric];
    state.metrics[metric] = clampMetric(before + delta);
    const actual = state.metrics[metric] - before;
    if (actual !== 0) effects.push({ type: 'metric', metric, delta: actual });
  }
}

function applyAffinity(
  ctx: AppContext,
  worldId: string,
  a: SimCharacter,
  b: SimCharacter,
  delta: number,
  effects: EventEffect[],
): void {
  const change = adjustAffinity(ctx, worldId, a.id, b.id, delta);
  effects.push({ type: 'affinity', a: ref(a), b: ref(b), delta: change.after - change.before, affinity: change.after });
  if (change.kindAfter !== change.kindBefore) {
    effects.push({ type: 'relationshipKind', a: ref(a), b: ref(b), from: change.kindBefore, to: change.kindAfter });
  }
}

function setMood(ctx: AppContext, characterId: string, mood: string | undefined): void {
  if (mood) run(ctx.db, 'UPDATE characters SET mood = ? WHERE id = ?', mood, characterId);
}

function vars(state: SimState, rng: Rng, a?: SimCharacter, b?: SimCharacter, extra: Record<string, string> = {}) {
  return {
    a: a?.name ?? '',
    b: b?.name ?? '',
    aHandle: a?.handle ?? '',
    bHandle: b?.handle ?? '',
    interest: a ? interestOf(rng, a, state.lang) : '',
    world: state.world.name,
    tag: state.tag,
    user: state.userName,
    ...extra,
  };
}

function eligibleTemplates(
  ctx: AppContext,
  rng: Rng,
  chars: SimCharacter[],
  usedPairs: Set<string>,
): { template: EventTemplate; pair: [SimCharacter, SimCharacter] | null; pool: SimCharacter[] }[] {
  const result: { template: EventTemplate; pair: [SimCharacter, SimCharacter] | null; pool: SimCharacter[] }[] = [];
  for (const template of EVENT_TEMPLATES) {
    const pool = NEGATIVE_KINDS.has(template.kind) ? chars.filter((c) => !c.is_real_person_sim) : chars;
    if (template.participants === 1) {
      if (pool.length >= 1) result.push({ template, pair: null, pool });
      continue;
    }
    const pair = pickPair(ctx, rng, pool, template.requires, usedPairs);
    if (pair) result.push({ template, pair, pool });
  }
  return result;
}

/** Bringt aktive Storylines voran. Gibt erzeugte Ereignisse zurück. */
function progressStorylines(
  ctx: AppContext,
  state: SimState,
  rng: Rng,
  chars: SimCharacter[],
  themes: Set<WorldMetric>,
  forced: WorldMetric | null,
  events: PlannedEvent[],
  posts: PlannedPost[],
  advanced: { id: string; title: string; stage: string }[] = [],
): number {
  let resolvedCount = 0;
  const storylines = all<Parameters<typeof toStoryline>[0] & { theme: WorldMetric }>(
    ctx.db,
    `SELECT * FROM storylines WHERE world_id = ? AND status = 'active' ORDER BY updated_at`,
    state.world.id,
  );
  let forcedUsed = false;
  for (const s of storylines) {
    const stages = parseJson<string[]>(s.stages, []);
    if (stages.length === 0) continue;
    const isForced = forced !== null && !forcedUsed && s.theme === forced;
    const chance = 0.12 + (themes.has(s.theme) ? 0.18 : 0) + state.metrics[s.theme] / 600;
    if (!isForced && !rng.chance(chance)) continue;
    if (isForced) forcedUsed = true;
    const stage = Math.min(s.stage + 1, stages.length - 1);
    const resolved = stage >= stages.length - 1;
    const stageText = stages[stage];
    run(
      ctx.db,
      `UPDATE storylines SET stage = ?, status = ?, updated_at = ? WHERE id = ?`,
      stage,
      resolved ? 'resolved' : 'active',
      ctx.now().toISOString(),
      s.id,
    );
    if (!resolved) advanced.push({ id: s.id, title: s.title, stage: stageText });
    const participant = chars.length ? rng.pick(chars) : null;
    const t = (l: L) => l[state.lang];
    events.push({
      id: newId('e'),
      kind: resolved ? 'storyline-resolved' : 'storyline',
      title: fill(t(STORYLINE_TEXT.advanceTitle), { title: s.title, stage: stageText }),
      description: fill(t(resolved ? STORYLINE_TEXT.resolvedDescription : STORYLINE_TEXT.advanceDescription), {
        title: s.title,
        stage: stageText,
      }),
      source: 'sim',
      effects: [{ type: 'storyline', storylineId: s.id, title: s.title, stage, resolved }],
      participants: participant ? [ref(participant)] : [],
      storylineId: s.id,
    });
    if (participant) {
      posts.push({
        characterId: participant.id,
        text: fill(t(STORYLINE_TEXT.post), { title: s.title, stage: stageText, tag: state.tag }),
        eventIndex: events.length - 1,
        likers: [],
        context: `Story "${s.title}" progressed: ${stageText}`,
      });
    }
    if (resolved) {
      resolvedCount++;
      resolveArc(ctx, s.id, state.lang);
      notify(ctx, 'storylineResolved', { title: s.title, world: state.world.name }, `/worlds/${state.world.id}`, state.world.id);
    }
  }
  // Neue Storyline, wenn keine mehr aktiv ist – damit die Welt lebendig bleibt.
  const active = get<{ n: number }>(
    ctx.db,
    `SELECT COUNT(*) AS n FROM storylines WHERE world_id = ? AND status = 'active'`,
    state.world.id,
  )?.n;
  if (active === 0 && rng.chance(0.7)) {
    const template = rng.pick(STORYLINE_TEMPLATES);
    const t = (l: L) => l[state.lang];
    const title = t(template.title);
    const now = ctx.now().toISOString();
    const id = newId('s');
    run(
      ctx.db,
      `INSERT INTO storylines (id, world_id, title, summary, stages, stage, theme, status, endings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'active', ?, ?, ?)`,
      id,
      state.world.id,
      title,
      fill(t(template.summary), { world: state.world.name }),
      JSON.stringify(template.stages.map(t)),
      template.theme,
      JSON.stringify(buildEndings(id, title, state.world.name, state.lang)),
      now,
      now,
    );
    events.push({
      id: newId('e'),
      kind: 'storyline-new',
      title: fill(t(STORYLINE_TEXT.newStoryline), { title }),
      description: fill(t(template.summary), { world: state.world.name }),
      source: 'sim',
      effects: [],
      participants: [],
      storylineId: id,
    });
  }
  return resolvedCount;
}

/** Figuren, die autonom handeln – ohne die vom Nutzer gesteuerten Spielfiguren. */
function loadSimCharacters(ctx: AppContext, worldId: string): SimCharacter[] {
  return all<SimCharacter>(
    ctx.db,
    `SELECT id, name, handle, avatar_hue, avatar_glyph, interests, mood, is_real_person_sim FROM characters c
      WHERE world_id = ? AND is_player = 0
        AND NOT EXISTS (SELECT 1 FROM players pl WHERE pl.character_id = c.id AND pl.is_active = 1)
      ORDER BY id`,
    worldId,
  );
}

function initState(ctx: AppContext, worldId: string): SimState {
  const world = getWorldRow(ctx, worldId);
  return {
    world,
    metrics: { harmony: world.harmony, tension: world.tension, discovery: world.discovery },
    lang: getLanguage(ctx.db),
    tag: worldTag(world.name),
    userName: getProfileRow(ctx).display_name,
  };
}

/** Lässt Charaktere Beiträge optional per KI formulieren (begrenzt, abschaltbar). */
async function enrichPostsWithAi(ctx: AppContext, state: SimState, posts: PlannedPost[], maxCalls: number): Promise<number> {
  let calls = 0;
  for (const post of posts) {
    if (calls >= maxCalls || !ctx.ai.canUseWorldAi()) break;
    const { character, world } = loadPromptCharacter(ctx, post.characterId);
    const result = await ctx.ai.complete({
      purpose: 'world',
      kind: 'world',
      maxTokens: 160,
      messages: [
        { role: 'system', content: characterSystemPrompt(character, world, state.lang, { mode: 'post' }) },
        {
          role: 'user',
          content:
            `Write one short social media post reacting to this situation: ${truncate(post.context, 400)}. ` +
            `You may use the hashtag #${state.tag}. Draft for orientation (rewrite it in your own voice): "${post.text}"`,
        },
      ],
    });
    calls++;
    if (result.ok) {
      const text = cleanText(result.text.replace(/^["„“]|["“”]$/g, ''));
      if (text) {
        post.text = truncate(text, LIMITS.postContent);
        post.ai = true;
      }
    }
  }
  return calls;
}

function commit(
  ctx: AppContext,
  state: SimState,
  events: PlannedEvent[],
  posts: PlannedPost[],
  trigger: 'manual' | 'auto' | 'user',
  aiCalls: number,
): number {
  const now = ctx.now();
  run(
    ctx.db,
    `UPDATE worlds SET day = day + 1, tick_count = tick_count + 1, harmony = ?, tension = ?, discovery = ? WHERE id = ?`,
    state.metrics.harmony,
    state.metrics.tension,
    state.metrics.discovery,
    state.world.id,
  );
  const day = state.world.day + 1;
  events.forEach((e, i) => {
    run(
      ctx.db,
      `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.id,
      state.world.id,
      day,
      e.kind,
      truncate(e.title, LIMITS.eventTitle),
      truncate(e.description, LIMITS.eventDescription),
      e.source,
      JSON.stringify(e.effects),
      JSON.stringify(e.participants),
      e.storylineId,
      // Minimal versetzte Zeitstempel erhalten die Reihenfolge.
      addMinutes(now, i / 600).toISOString(),
    );
  });
  for (const p of posts) {
    const postId = insertCharacterPost(ctx, {
      characterId: p.characterId,
      worldId: state.world.id,
      content: p.text,
      source: p.ai ? 'ai' : 'sim',
      eventId: events[p.eventIndex]?.id ?? null,
    });
    if (p.comment) {
      insertCharacterComment(ctx, {
        postId,
        parentId: null,
        characterId: p.comment.characterId,
        content: p.comment.text,
        source: 'sim',
      });
    }
    for (const liker of p.likers) addCharacterLike(ctx, postId, liker);
  }
  run(
    ctx.db,
    `INSERT INTO simulation_log (world_id, trigger, day, events, ai_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    state.world.id,
    trigger,
    dayKey(now),
    events.length,
    aiCalls,
    now.toISOString(),
  );
  return posts.length;
}

function planLikes(rng: Rng, chars: SimCharacter[], exclude: string[]): string[] {
  const others = chars.filter((c) => !exclude.includes(c.id));
  return rng.shuffle(others).slice(0, rng.int(0, Math.min(2, others.length))).map((c) => c.id);
}

async function withWorldLock<T>(worldId: string, fn: () => Promise<T>): Promise<T> {
  if (runningWorlds.has(worldId)) throw new AppError(409, 'simulation_busy', 'Für diese Welt läuft bereits eine Simulation.');
  runningWorlds.add(worldId);
  try {
    return await fn();
  } finally {
    runningWorlds.delete(worldId);
  }
}

/** Ein Simulationsschritt („ein Tag vergeht“) für eine Welt. */
export async function simulateWorld(
  ctx: AppContext,
  worldId: string,
  trigger: 'manual' | 'auto',
): Promise<SimulationResult & { progress: ProgressDelta }> {
  return withWorldLock(worldId, async () => {
    const state = initState(ctx, worldId);
    const chars = loadSimCharacters(ctx, worldId);
    const rng = createRng(`${worldId}:${state.world.tick_count + 1}`);
    const settings = getSettings(ctx.db);
    const events: PlannedEvent[] = [];
    const posts: PlannedPost[] = [];
    const themes = new Set<WorldMetric>();
    const t = (l: L) => l[state.lang];

    let resolved = 0;
    const advanced: { id: string; title: string; stage: string }[] = [];
    const planAndApply = () => {
      const count = chars.length === 0 ? 0 : rng.int(1, settings.simulation.maxEventsPerTick);
      const usedPairs = new Set<string>();
      for (let i = 0; i < count; i++) {
        const options = eligibleTemplates(ctx, rng, chars, usedPairs);
        if (options.length === 0) break;
        const choice = rng.weighted(
          options.map((o) => ({
            item: o,
            weight:
              o.template.baseWeight +
              Object.entries(o.template.metricWeight ?? {}).reduce(
                (sum, [m, f]) => sum + (state.metrics[m as WorldMetric] / 100) * (f ?? 0),
                0,
              ),
          })),
        );
        const { template } = choice;
        const a = choice.pair ? choice.pair[0] : rng.pick(choice.pool);
        const b = choice.pair ? choice.pair[1] : undefined;
        if (b) usedPairs.add(pairKey(a.id, b.id));
        const v = vars(state, rng, a, b);
        const effects: EventEffect[] = [];
        applyMetrics(state, template.metrics, effects);
        if (b && template.affinity) applyAffinity(ctx, worldId, a, b, template.affinity, effects);
        setMood(ctx, a.id, template.mood.a);
        if (b) setMood(ctx, b.id, template.mood.b);
        themes.add(template.theme);
        events.push({
          id: newId('e'),
          kind: template.kind,
          title: fill(t(template.title), v),
          description: fill(t(template.description), v),
          source: 'sim',
          effects,
          participants: b ? [ref(a), ref(b)] : [ref(a)],
          storylineId: null,
        });
        const author = template.post.by === 'a' ? a : (b ?? a);
        const other = template.post.by === 'a' ? b : a;
        posts.push({
          characterId: author.id,
          text: fill(t(template.post.text), v),
          eventIndex: events.length - 1,
          comment:
            template.comment && other
              ? { characterId: (template.comment.by === 'a' ? a : b ?? a).id, text: fill(t(template.comment.text), v) }
              : undefined,
          likers: planLikes(rng, chars, [author.id]),
          context: `${fill(t(template.title), v)} – ${fill(t(template.description), v)}`,
        });
      }
      resolved = progressStorylines(ctx, state, rng, chars, themes, null, events, posts, advanced);
      // Proportionale Rückkehr zur Mitte (15 % pro Tag) verhindert, dass Welten dauerhaft in Extremwerten verharren.
      for (const m of ['harmony', 'tension', 'discovery'] as WorldMetric[]) {
        state.metrics[m] = clampMetric(state.metrics[m] + Math.round((50 - state.metrics[m]) * 0.15));
      }
      if (chars.length && rng.chance(0.35)) {
        const c = rng.pick(chars);
        insertCharacterStory(ctx, {
          characterId: c.id,
          worldId,
          content: fill(t(rng.pick(STORY_TEMPLATES)), { interest: interestOf(rng, c, state.lang), mood: c.mood, world: state.world.name }),
          style: rng.int(0, 5),
        });
      }
    };

    // Ohne KI: Planung, Zustandsänderungen und Inhalte in einer einzigen Transaktion.
    // Mit KI-Weltaktivität: Zustand zuerst speichern, dann (begrenzt) Texte per KI formulieren und
    // anschließend Ereignisse und Beiträge speichern. Schlägt ein KI-Aufruf fehl, bleibt der Vorlagentext.
    let aiCalls = 0;
    let postsCreated = 0;
    if (settings.ai.worldActivityEnabled && ctx.ai.canUseWorldAi()) {
      tx(ctx.db, planAndApply);
      aiCalls = await enrichPostsWithAi(ctx, state, posts, 2);
      postsCreated = tx(ctx.db, () => commit(ctx, state, events, posts, trigger, aiCalls));
    } else {
      postsCreated = tx(ctx.db, () => {
        planAndApply();
        return commit(ctx, state, events, posts, trigger, 0);
      });
    }

    // Die Spielfigur wird an Wendepunkten der Geschichte oder gelegentlich vor eine Entscheidung gestellt.
    tx(ctx.db, () => {
      const created = advanced.length > 0 && createStorylineDecision(ctx, worldId, advanced[0]);
      if (!created) maybeCreateDecision(ctx, worldId, rng);
    });
    // Neue Ereignisse können Ereignisquests auslösen; Veränderungen können Quests abschließen.
    refreshWorldQuests(ctx, worldId);

    const progress =
      trigger === 'manual' ? recordAction(ctx, 'simulate', `${worldId}:${state.world.tick_count + 1}`) : emptyDelta();
    if (resolved > 0) progress.achievementsUnlocked.push(...checkAchievements(ctx));
    const saved = all<Parameters<typeof toEvent>[0]>(
      ctx.db,
      `SELECT * FROM world_events WHERE id IN (${events.map(() => '?').join(',') || "''"}) ORDER BY created_at, id`,
      ...events.map((e) => e.id),
    ).map(toEvent);
    return {
      world: getWorldSummary(ctx, worldId),
      events: saved,
      postsCreated,
      aiCalls,
      notice: chars.length === 0 ? 'no_characters' : undefined,
      progress,
    };
  });
}

export function listEventCards(ctx: AppContext): EventCard[] {
  return EVENT_CARDS.map((c) => ({
    id: c.id,
    needsTargets: c.needsTargets,
    metricHints: c.metrics,
    shopItem: c.shopItem ?? null,
    locked: !cardUnlocked(ctx, c.id),
  }));
}

const triggerSchema = z.object({
  cardId: z.string().max(40),
  targetIds: z.array(z.string().max(80)).max(2).default([]),
  customTitle: z.string().max(LIMITS.eventTitle * 2).optional(),
  customDescription: z.string().max(LIMITS.eventDescription * 2).optional(),
  customEffect: z.enum(['harmony', 'tension', 'discovery']).optional(),
});

/** Vom Nutzer ausgelöstes Ereignis (Ereigniskarte). */
export async function triggerEvent(
  ctx: AppContext,
  worldId: string,
  input: unknown,
): Promise<SimulationResult & { progress: ProgressDelta }> {
  const parsed = triggerSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_event', 'Ungültiges Ereignis.', parsed.error.issues);
  const card = EVENT_CARDS.find((c) => c.id === parsed.data.cardId);
  if (!card) throw notFound('Ereigniskarte');
  if (!cardUnlocked(ctx, card.id)) {
    throw new AppError(403, 'card_locked', 'Diese Ereigniskarte muss zuerst im Shop freigeschaltet werden.');
  }
  return withWorldLock(worldId, async () => {
    const state = initState(ctx, worldId);
    const chars = loadSimCharacters(ctx, worldId);
    const targets = [...new Set(parsed.data.targetIds)].map((id) => chars.find((c) => c.id === id));
    if (targets.some((c) => !c)) throw badRequest('invalid_targets', 'Alle Beteiligten müssen zu dieser Welt gehören.');
    if (targets.length < card.needsTargets) {
      throw badRequest('missing_targets', `Diese Karte benötigt ${card.needsTargets} Beteiligte.`);
    }
    if (card.negative && targets.some((c) => c!.is_real_person_sim)) {
      throw badRequest('real_person_protected', 'Simulationen realer Personen können nicht mit negativen Ereignissen belegt werden.');
    }
    let customTitle = '';
    let customDescription = '';
    if (card.id === 'custom') {
      customTitle = cleanText(parsed.data.customTitle ?? '');
      customDescription = cleanText(parsed.data.customDescription ?? '');
      if (!customTitle) throw badRequest('missing_title', 'Bitte gib einen Titel für das Ereignis ein.');
      customTitle = truncate(customTitle, LIMITS.eventTitle);
      customDescription = truncate(customDescription, LIMITS.eventDescription);
    }
    const rng = createRng(`${worldId}:user:${state.world.tick_count + 1}:${card.id}`);
    const t = (l: L) => l[state.lang];
    const [a, b] = targets as SimCharacter[];
    const events: PlannedEvent[] = [];
    const posts: PlannedPost[] = [];

    const postsCreated = tx(ctx.db, () => {
      const effects: EventEffect[] = [];
      const metrics =
        card.id === 'custom' && parsed.data.customEffect
          ? { [parsed.data.customEffect]: 10, ...(parsed.data.customEffect === 'tension' ? { harmony: -4 } : {}) }
          : card.metrics;
      applyMetrics(state, metrics, effects);
      if (a && b && card.affinity) applyAffinity(ctx, worldId, a, b, card.affinity, effects);
      for (let i = 0; i < (card.randomPairs?.count ?? 0); i++) {
        const pair = pickPair(ctx, rng, chars);
        if (pair) applyAffinity(ctx, worldId, pair[0], pair[1], card.randomPairs!.delta, effects);
      }
      const involved = targets.length ? (targets as SimCharacter[]) : rng.shuffle(chars).slice(0, 2);
      for (const c of involved) setMood(ctx, c.id, card.mood);
      const v = vars(state, rng, a ?? involved[0], b ?? involved[1], {
        title: customTitle,
        description: customDescription || customTitle,
      });
      events.push({
        id: newId('e'),
        kind: `card-${card.id}`,
        title: fill(t(card.title), v),
        description: fill(t(card.description), v),
        source: 'user',
        effects,
        participants: involved.map(ref),
        storylineId: null,
      });
      card.posts.slice(0, Math.max(1, Math.min(card.posts.length, involved.length))).forEach((template, i) => {
        const author = involved[i];
        if (!author) return;
        const other = involved.find((c) => c.id !== author.id);
        const pv = vars(state, rng, author, other, { title: customTitle, description: customDescription });
        posts.push({
          characterId: author.id,
          text: fill(t(template), pv),
          eventIndex: 0,
          likers: planLikes(rng, chars, [author.id]),
          context: `${events[0].title} – ${events[0].description}`,
        });
      });
      progressStorylines(ctx, state, rng, chars, new Set(card.advanceTheme ? [card.advanceTheme] : []), card.advanceTheme ?? null, events, posts);
      return commit(ctx, state, events, posts, 'user', 0);
    });

    refreshWorldQuests(ctx, worldId);
    const progress = recordAction(ctx, 'triggerEvent', events[0].id);
    progress.achievementsUnlocked.push(...checkAchievements(ctx).filter((id) => !progress.achievementsUnlocked.includes(id)));
    const saved = all<Parameters<typeof toEvent>[0]>(
      ctx.db,
      `SELECT * FROM world_events WHERE id IN (${events.map(() => '?').join(',')}) ORDER BY created_at, id`,
      ...events.map((e) => e.id),
    ).map(toEvent);
    return {
      world: getWorldSummary(ctx, worldId),
      events: saved,
      postsCreated,
      aiCalls: 0,
      notice: chars.length === 0 ? 'no_characters' : undefined,
      progress,
    };
  });
}

// ---- Automatische Simulation ----

function lastAutoTick(ctx: AppContext): string | null {
  return get<{ value: string }>(ctx.db, `SELECT value FROM meta WHERE key = 'sim_last_auto'`)?.value ?? null;
}

function autoTicksToday(ctx: AppContext): number {
  return (
    get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM simulation_log WHERE trigger = 'auto' AND day = ?`, dayKey(ctx.now()))
      ?.n ?? 0
  );
}

export function simulationStatus(ctx: AppContext): SimulationStatusDto {
  const s = getSettings(ctx.db);
  const last = lastAutoTick(ctx);
  const ticksToday = autoTicksToday(ctx);
  const canRun = s.simulation.autoEnabled && ticksToday < s.simulation.maxAutoTicksPerDay;
  return {
    autoEnabled: s.simulation.autoEnabled,
    intervalMinutes: s.simulation.intervalMinutes,
    ticksToday,
    maxAutoTicksPerDay: s.simulation.maxAutoTicksPerDay,
    lastTickAt: last,
    nextTickAt: canRun
      ? (last ? addMinutes(new Date(last), s.simulation.intervalMinutes) : ctx.now()).toISOString()
      : null,
    aiWorldCallsToday: ctx.ai.worldCallsToday(),
    worldDailyLimit: s.ai.worldDailyLimit,
    aiWorldActive: s.ai.worldActivityEnabled && ctx.ai.isActive('world'),
  };
}

/** Wird regelmäßig vom Scheduler aufgerufen. Führt höchstens einen automatischen Schritt aus. */
export async function maybeRunAutoTick(ctx: AppContext): Promise<boolean> {
  const s = getSettings(ctx.db).simulation;
  if (!s.autoEnabled) return false;
  if (autoTicksToday(ctx) >= s.maxAutoTicksPerDay) return false;
  const last = lastAutoTick(ctx);
  const now = ctx.now();
  if (last && addMinutes(new Date(last), s.intervalMinutes) > now) return false;
  // Die Welt, in der du gerade spielst, ist jeden zweiten Schritt an der Reihe; sonst die Welt,
  // in der am längsten nichts passiert ist.
  const active = activeWorldId(ctx);
  const lastWorld = get<{ value: string }>(ctx.db, `SELECT value FROM meta WHERE key = 'sim_last_auto_world'`)?.value ?? null;
  const world =
    active && lastWorld !== active
      ? { id: active }
      : get<{ id: string }>(
          ctx.db,
          `SELECT w.id FROM worlds w
            WHERE EXISTS (SELECT 1 FROM characters c WHERE c.world_id = w.id) AND w.id != ?
            ORDER BY COALESCE((SELECT MAX(e.created_at) FROM world_events e WHERE e.world_id = w.id), '') ASC, w.id
            LIMIT 1`,
          active ?? '',
        ) ?? (active ? { id: active } : undefined);
  for (const [key, value] of [
    ['sim_last_auto', now.toISOString()],
    ['sim_last_auto_world', world?.id ?? ''],
  ]) {
    run(ctx.db, `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value);
  }
  if (!world) return false;
  await simulateWorld(ctx, world.id, 'auto');
  return true;
}
