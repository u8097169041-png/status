/**
 * Ablauf einer Lebensgeschichte: Zug des Spielers → Spielsystem entscheidet → Ereignisse → Erzählung (im Hintergrund).
 * Alles wird sofort gespeichert; die Erzählung ergänzt nur Text, Dialoge, Vorschläge und neue Fakten.
 */
import { z } from 'zod';
import type { ImageJobDto } from '../../../shared/types';
import type { LifeEventDto, LifeMessageDto, LifeResolutionDto, LifeStat, LifeStats, LifeStoryDto, LifeStorySummaryDto, LifeSuggestion } from '../../../shared/life';
import { AWAY_INTRO, OPENING, TIME_PASSES } from '../content/lifeContent';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { AppError, badRequest } from '../lib/errors';
import { createRng } from '../lib/rng';
import { cleanText, fill, truncate } from '../lib/text';
import { imageUrlOf } from '../images/imageService';
import { coverPrompt } from '../images/prompts';
import { buildScene, checkExtra } from '../images/scenes';
import { getSettings } from '../services/settings';
import { stableSeed } from '../services/appearances';
import { ensureLifeAvatars, lifeAppearance, listLifeCharacters, playerAppearance, toLifeCharacter, type LifeCharacterRow } from './characters';
import { applyCharacterChange, applyStats, classifyAction, deathText, newEventId, resolveAction, rollEvents, type EventOutcome, type Resolution } from './engine';
import { EVERYONE, knows, openPromises, PLAYER, recall, remember, reveal, toMemoryDto, type MemoryRow } from './memory';
import { narrate, type TurnContext } from './narrator';
import { genresOf, getStory, presentOf, requireActive, saveWorld, statKeysOf, statsOf, worldOf, type StoryRow } from './store';

const turnLocks = new Set<string>();
const narrations = new Map<string, Promise<void>>();
const imageJobs = new Map<string, string>();
const MESSAGE_PAGE = 60;
/** Ab so vielen noch nicht zusammengefassten Nachrichten wird der ältere Teil verdichtet. */
const SUMMARY_TRIGGER = 40;
const SUMMARY_CHUNK = 30;

interface MessageRow {
  id: number;
  story_id: string;
  turn: number;
  role: LifeMessageDto['role'];
  speaker_id: string | null;
  content: string;
  data: string | null;
  pending: number;
  created_at: string;
}

function insertMessage(ctx: AppContext, storyId: string, turn: number, role: LifeMessageDto['role'], content: string, data: unknown = null, speakerId: string | null = null, pending = false): number {
  const r = run(
    ctx.db,
    'INSERT INTO life_messages (story_id, turn, role, speaker_id, content, data, pending, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    storyId,
    turn,
    role,
    speakerId,
    content,
    data === null ? null : JSON.stringify(data),
    pending ? 1 : 0,
    ctx.now().toISOString(),
  );
  return Number(r.lastInsertRowid);
}

function toMessage(ctx: AppContext, r: MessageRow, names: Map<string, string>): LifeMessageDto {
  const data = parseJson<Record<string, unknown>>(r.data ?? '{}', {});
  const image = typeof data.imageId === 'string' ? ctx.images.getImage(data.imageId) : null;
  return {
    id: r.id,
    turn: r.turn,
    role: r.role,
    speakerId: r.speaker_id,
    speakerName: r.speaker_id ? (names.get(r.speaker_id) ?? null) : null,
    content: r.content,
    pending: Boolean(r.pending),
    ...(Array.isArray(data.suggestions) ? { suggestions: data.suggestions as LifeSuggestion[] } : {}),
    ...(data.resolution ? { resolution: data.resolution as LifeResolutionDto } : {}),
    ...(data.severity ? { severity: data.severity as LifeMessageDto['severity'] } : {}),
    ...(r.role === 'image' ? { imageUrl: imageUrlOf(image?.file), sceneCard: (data.sceneCard as LifeMessageDto['sceneCard']) ?? null } : {}),
    ...(data.away ? { away: true } : {}),
    createdAt: r.created_at,
  };
}

function toEvent(ctx: AppContext, r: { id: string; turn: number; day: number; kind: string; title: string; description: string; severity: LifeEventDto['severity']; image_id: string | null; created_at: string }): LifeEventDto {
  return { id: r.id, turn: r.turn, day: r.day, kind: r.kind, title: r.title, description: r.description, severity: r.severity, imageUrl: imageUrlOf(ctx.images.getImage(r.image_id)?.file), createdAt: r.created_at };
}

function summaryOf(ctx: AppContext, s: StoryRow): LifeStorySummaryDto {
  const stats = statsOf(s);
  const keys = statKeysOf(s);
  return {
    id: s.id,
    title: s.title,
    genres: genresOf(s),
    archetype: s.archetype,
    playerName: s.player_name,
    playerRole: s.player_role,
    status: s.status,
    ending: s.ending,
    day: s.day,
    turn: s.turn,
    location: s.location,
    coverUrl: imageUrlOf(ctx.images.getImage(s.cover_image_id)?.file),
    highlight: [...keys.filter((k) => k !== 'health').slice(0, 3), 'health' as const].map((k: LifeStat) => ({ stat: k, value: stats[k] ?? 0 })),
    updatedAt: s.updated_at,
  };
}

export function listStories(ctx: AppContext): LifeStorySummaryDto[] {
  return all<StoryRow>(ctx.db, 'SELECT * FROM life_stories ORDER BY status, updated_at DESC').map((s) => summaryOf(ctx, s));
}

export function getStoryDto(ctx: AppContext, id: string, before?: number): LifeStoryDto {
  const s = getStory(ctx, id);
  const chars = listLifeCharacters(ctx, id);
  const names = new Map(chars.map((c) => [c.id, c.name]));
  const rows = all<MessageRow>(
    ctx.db,
    `SELECT * FROM (SELECT * FROM life_messages WHERE story_id = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?) ORDER BY id`,
    ...(before ? [id, before, MESSAGE_PAGE + 1] : [id, MESSAGE_PAGE + 1]),
  );
  const hasOlder = rows.length > MESSAGE_PAGE;
  const messages = (hasOlder ? rows.slice(1) : rows).map((r) => toMessage(ctx, r, names));
  const world = worldOf(s);
  const jobId = imageJobs.get(id);
  const job = jobId ? ctx.images.getJob(jobId) : null;
  return {
    ...summaryOf(ctx, s),
    premise: s.premise,
    setting: world.setting,
    locations: world.locations,
    organizations: world.organizations,
    statKeys: statKeysOf(s),
    stats: statsOf(s),
    lastChanges: world.lastChanges ?? {},
    assets: parseJson<string[]>(s.assets, []),
    promises: openPromises(ctx, id).map((p) => toMemoryDto(ctx, p, names)),
    playerAppearance: playerAppearance(s),
    playerAvatarUrl: `/api/media/life-avatars/player:${s.id}`,
    characters: chars.map((c) => toLifeCharacter(ctx, c)),
    messages,
    hasOlderMessages: hasOlder,
    events: all<Parameters<typeof toEvent>[1]>(ctx.db, 'SELECT * FROM life_events WHERE story_id = ? ORDER BY turn DESC, created_at DESC LIMIT 40', id).map((e) => toEvent(ctx, e)),
    narrating: narrations.has(id),
    imageJob: job && (job.status === 'queued' || job.status === 'running') ? job : null,
  };
}

export function getMemories(ctx: AppContext, id: string, query: string): ReturnType<typeof toMemoryDto>[] {
  const s = getStory(ctx, id);
  const names = new Map(listLifeCharacters(ctx, id).map((c) => [c.id, c.name]));
  const rows = query.trim()
    ? recall(ctx, id, { query, viewer: PLAYER, turn: s.turn, limit: 40, criticalLimit: 40 })
    : all<MemoryRow>(ctx.db, 'SELECT * FROM life_memories WHERE story_id = ? ORDER BY critical DESC, turn DESC LIMIT 200', id).filter((m) => knows(m, PLAYER));
  return rows.map((m) => toMemoryDto(ctx, m, names));
}

// ---------- Züge ----------

const turnSchema = z.object({ text: z.string().max(1200).optional(), suggestionId: z.string().max(60).optional() }).strict();

function lastSuggestions(ctx: AppContext, storyId: string): LifeSuggestion[] {
  const row = get<{ data: string | null }>(ctx.db, `SELECT data FROM life_messages WHERE story_id = ? AND role = 'narrator' ORDER BY id DESC LIMIT 1`, storyId);
  const data = parseJson<{ suggestions?: LifeSuggestion[] }>(row?.data ?? '{}', {});
  return data.suggestions ?? [];
}

function recentSuggestionTexts(ctx: AppContext, storyId: string): string[] {
  return all<{ data: string | null }>(ctx.db, `SELECT data FROM life_messages WHERE story_id = ? AND role = 'narrator' ORDER BY id DESC LIMIT 3`, storyId).flatMap(
    (r) => (parseJson<{ suggestions?: LifeSuggestion[] }>(r.data ?? '{}', {}).suggestions ?? []).map((s) => s.text),
  );
}

function lock(storyId: string): void {
  if (turnLocks.has(storyId)) throw new AppError(409, 'turn_running', 'Die Geschichte wird gerade weitererzählt.');
  turnLocks.add(storyId);
}

const TIER_WORD = {
  de: { critical_success: 'großer Erfolg', success: 'Erfolg', partial: 'Teilerfolg', failure: 'Misserfolg', critical_failure: 'schwerer Fehlschlag' },
  en: { critical_success: 'great success', success: 'success', partial: 'partial success', failure: 'failure', critical_failure: 'disastrous failure' },
} as const;

/** Gemeinsamer Abschluss eines Zugs: Ereignisse anwenden, Tod prüfen, Zustand speichern, Erzählung starten. */
function applyEvents(ctx: AppContext, s: StoryRow, chars: LifeCharacterRow[], stats: LifeStats, events: EventOutcome[], turn: number, applied: LifeStats): { stats: LifeStats; died: boolean; cause: string | null } {
  let current = stats;
  let died = false;
  let cause: string | null = null;
  for (const e of events) {
    const r = applyStats(current, e.stats);
    current = r.stats;
    for (const [k, v] of Object.entries(r.applied)) applied[k as keyof LifeStats] = (applied[k as keyof LifeStats] ?? 0) + (v ?? 0);
    for (const rel of e.relation) {
      const c = chars.find((x) => x.id === rel.id);
      if (c) applyCharacterChange(ctx, c, rel.change, rel.stance ?? null, turn, rel.status ?? null);
    }
    const eventId = newEventId();
    run(
      ctx.db,
      `INSERT INTO life_events (id, story_id, turn, day, kind, title, description, severity, effects, participants, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      eventId,
      s.id,
      turn,
      s.day,
      e.kind,
      e.title,
      e.description,
      e.severity,
      JSON.stringify(r.applied),
      JSON.stringify(e.participants),
      ctx.now().toISOString(),
    );
    // Verborgener Verrat erscheint dem Spieler nur als Ahnung – die Wahrheit kennt nur der Verräter.
    insertMessage(ctx, s.id, turn, 'event', `${e.title}: ${e.description}`, { severity: e.severity, kind: e.kind, eventId });
    if (e.memory) {
      const subject = e.participants.map((p) => chars.find((c) => c.id === p)?.name).filter(Boolean).join(', ');
      const content = e.kind === 'betrayal' && !e.memory.knownBy.includes(PLAYER) ? `${subject} hat ${s.player_name} verraten.` : `${e.title}: ${e.description}`;
      remember(ctx, s.id, { kind: e.memory.kind, content, importance: e.memory.importance, critical: e.memory.critical, subjects: e.participants, knownBy: e.memory.knownBy, turn, source: 'engine' });
    }
    if (current.health !== undefined && current.health <= 0) {
      died = true;
      cause = e.deathCause ?? e.kind;
      break;
    }
  }
  return { stats: current, died, cause };
}

function finishDeath(ctx: AppContext, s: StoryRow, turn: number, cause: string | null): string {
  const text = deathText(s, cause);
  run(
    ctx.db,
    `INSERT INTO life_events (id, story_id, turn, day, kind, title, description, severity, created_at) VALUES (?, ?, ?, ?, 'death', ?, ?, 'critical', ?)`,
    newEventId(),
    s.id,
    turn,
    s.day,
    s.lang === 'de' ? 'Das Ende' : 'The end',
    text,
    ctx.now().toISOString(),
  );
  remember(ctx, s.id, { kind: 'death', content: text, importance: 5, critical: true, knownBy: [EVERYONE], turn, source: 'engine' });
  return text;
}

function startNarration(ctx: AppContext, storyId: string, messageId: number, turn: TurnContext, background: boolean): void {
  const promise = (async () => {
    try {
      const s = getStory(ctx, storyId);
      const chars = listLifeCharacters(ctx, storyId);
      const rng = createRng(`${s.seed}:${s.turn}:narration`);
      const recent = recentSuggestionTexts(ctx, storyId);
      let n = await narrate(ctx, s, chars, turn, rng, recent, background);
      if (turn.mode === 'opening' && n.provider === 'fallback') {
        const world = worldOf(s);
        const setup = parseJson<{ opening?: string }>(s.setup, {});
        n = { ...n, narration: fill(OPENING[s.lang], { setting: world.setting, player: s.player_name, role: s.player_role, situation: setup.opening ?? '' }) };
      }
      if ((turn.mode === 'time' || turn.mode === 'away') && n.provider === 'fallback') {
        n = { ...n, narration: `${turn.mode === 'away' ? `${AWAY_INTRO[s.lang]} ` : ''}${fill(TIME_PASSES[s.lang], { location: s.location || worldOf(s).setting })}` };
      }
      const ended = getStory(ctx, storyId).status === 'ended';
      tx(ctx.db, () => {
        const existing = parseJson<Record<string, unknown>>(get<{ data: string | null }>(ctx.db, 'SELECT data FROM life_messages WHERE id = ?', messageId)?.data ?? '{}', {});
        run(
          ctx.db,
          'UPDATE life_messages SET content = ?, data = ?, pending = 0 WHERE id = ?',
          n.narration,
          JSON.stringify({ ...existing, suggestions: ended ? [] : n.suggestions, provider: n.provider, model: n.model, ...(turn.mode === 'away' ? { away: true } : {}) }),
          messageId,
        );
        // Nach dem Tod der Spielfigur folgt keine Szene mehr hinter der Abschlussmeldung.
        if (!ended) for (const d of n.dialogue) insertMessage(ctx, storyId, s.turn, 'character', d.text, null, d.speakerId);
        const present = presentOf(s);
        for (const f of n.facts) {
          remember(ctx, storyId, { kind: 'fact', content: f.text, importance: f.importance, subjects: [], knownBy: f.knownBy.length ? [...f.knownBy, PLAYER] : [PLAYER, ...present], turn: s.turn, source: 'ai' });
        }
        const nextPresent = n.present ?? [...new Set([...present, ...n.dialogue.map((d) => d.speakerId)])];
        run(ctx.db, 'UPDATE life_stories SET present = ?, location = ?, updated_at = ? WHERE id = ?', JSON.stringify(nextPresent.slice(0, 6)), n.location ?? s.location, ctx.now().toISOString(), storyId);
      });
      await summarizeIfNeeded(ctx, storyId, background);
      // Wichtige Ereignisse automatisch bebildern (nur mit Bild-KI und höchstens alle 5 Züge).
      const severe = get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM life_events WHERE story_id = ? AND turn = ? AND severity IN ('major', 'critical')`, storyId, s.turn)?.n ?? 0;
      const lastImage = get<{ turn: number }>(ctx.db, `SELECT turn FROM life_messages WHERE story_id = ? AND role = 'image' ORDER BY id DESC LIMIT 1`, storyId);
      if (severe > 0 && !background && getSettings(ctx.db).images.autoScenes && ctx.images.available() && (!lastImage || s.turn - lastImage.turn >= 5)) {
        await requestStoryImage(ctx, storyId, '', 'background').catch(() => undefined);
      }
    } catch (error) {
      console.warn('[life] Erzählung fehlgeschlagen:', (error as Error).message);
      run(ctx.db, `UPDATE life_messages SET pending = 0, content = CASE WHEN content = '' THEN '…' ELSE content END WHERE id = ?`, messageId);
    } finally {
      narrations.delete(storyId);
      turnLocks.delete(storyId);
    }
  })();
  narrations.set(storyId, promise);
}

export async function takeTurn(ctx: AppContext, id: string, input: unknown): Promise<LifeStoryDto> {
  const parsed = turnSchema.safeParse(input ?? {});
  if (!parsed.success) throw badRequest('invalid_action', 'Ungültige Eingabe.');
  const story = getStory(ctx, id);
  requireActive(story);
  const suggestion = parsed.data.suggestionId ? (lastSuggestions(ctx, id).find((s) => s.id === parsed.data.suggestionId) ?? null) : null;
  if (parsed.data.suggestionId && !suggestion) throw badRequest('unknown_suggestion', 'Dieser Vorschlag ist nicht mehr aktuell.');
  const text = cleanText(suggestion?.text ?? parsed.data.text ?? '');
  if (!text) throw badRequest('invalid_action', 'Beschreibe, was du tun möchtest.');
  if (text.length > 600) throw badRequest('invalid_action', 'Die Eingabe ist zu lang (höchstens 600 Zeichen).');
  lock(id);
  let messageId = 0;
  let turnCtx: TurnContext;
  try {
    ({ messageId, turnCtx } = tx(ctx.db, () => {
      const s = getStory(ctx, id);
      const chars = listLifeCharacters(ctx, id);
      const turn = s.turn + 1;
      const rng = createRng(`${s.seed}:${turn}`);
      const present = presentOf(s);
      const cls = classifyAction(text, chars, present, suggestion);
      const target = chars.find((c) => c.id === cls.targetId) ?? null;
      const res: Resolution = resolveAction(statsOf(s), cls, target, rng);
      insertMessage(ctx, id, turn, 'player', text, { category: cls.category, kind: suggestion?.kind ?? null });
      const r = applyStats(statsOf(s), res.statChanges);
      const applied: LifeStats = { ...r.applied };
      const witnesses = [...new Set([...present, ...(target ? [target.id] : [])])];
      if (target && res.target) {
        applyCharacterChange(ctx, target, res.target, res.stance, turn, res.targetStatus ? { status: res.targetStatus.status, note: res.targetStatus.note } : null);
      }
      // Gedächtnis: Entscheidungen, Versprechen, Täuschung/Verrat, Todesfälle und Enthüllungen.
      const lang = s.lang;
      const tierWord = TIER_WORD[lang][res.tier];
      if (!['talk', 'wait', 'rest', 'travel'].includes(cls.category) || res.tier === 'critical_success' || res.tier === 'critical_failure') {
        remember(ctx, id, {
          kind: 'decision',
          content: `${s.player_name}: „${truncate(text, 160)}“ → ${tierWord}${target ? ` (${target.name})` : ''}`,
          importance: ['violence', 'crime', 'deceive', 'threaten'].includes(cls.category) || res.tier.startsWith('critical') ? 4 : 2,
          subjects: target ? [target.id] : [],
          knownBy: [PLAYER, ...witnesses],
          turn,
          source: 'engine',
        });
      }
      if (cls.promise) {
        remember(ctx, id, {
          kind: 'promise',
          content: lang === 'de' ? `${s.player_name} hat ${target?.name ?? 'jemandem'} versprochen: „${truncate(text, 180)}“` : `${s.player_name} promised ${target?.name ?? 'someone'}: "${truncate(text, 180)}"`,
          importance: 4,
          critical: true,
          subjects: target ? [target.id] : [],
          knownBy: [PLAYER, ...witnesses],
          turn,
          source: 'engine',
        });
      }
      if (cls.category === 'deceive' && target) {
        const betrayal = ['ally', 'friend', 'love', 'family', 'boss', 'subordinate'].includes(target.stance);
        const detected = res.tier === 'failure' || res.tier === 'critical_failure';
        remember(ctx, id, {
          kind: betrayal ? 'betrayal' : 'secret',
          content: lang === 'de' ? `${s.player_name} hat ${target.name} getäuscht: „${truncate(text, 140)}“${detected ? ' – und wurde durchschaut.' : ''}` : `${s.player_name} deceived ${target.name}: "${truncate(text, 140)}"${detected ? ' – and was found out.' : ''}`,
          importance: betrayal ? 5 : 3,
          critical: betrayal,
          subjects: [target.id],
          knownBy: detected ? [PLAYER, target.id] : [PLAYER],
          turn,
          source: 'engine',
        });
      }
      if (target && res.targetStatus?.status === 'dead') {
        remember(ctx, id, {
          kind: 'death',
          content: lang === 'de' ? `${target.name} wurde an Tag ${s.day} von ${s.player_name} getötet.` : `${target.name} was killed by ${s.player_name} on day ${s.day}.`,
          importance: 5,
          critical: true,
          subjects: [target.id],
          knownBy: [PLAYER, ...witnesses],
          turn,
          source: 'engine',
        });
      }
      if (res.revealedSecret) {
        remember(ctx, id, { kind: 'secret', content: `${target?.name}: ${res.revealedSecret.secret}`, importance: 4, subjects: [res.revealedSecret.characterId], knownBy: [PLAYER, res.revealedSecret.characterId], turn, source: 'engine' });
      }
      let stats = r.stats;
      let died = res.playerDied;
      let cause = res.deathCause;
      const world = worldOf(s);
      const events: EventOutcome[] = [];
      if (!died) {
        const freshChars = listLifeCharacters(ctx, id);
        events.push(...rollEvents(s, stats, genresOf(s), freshChars, rng, 'turn', world.recentEvents ?? []));
        const after = applyEvents(ctx, s, freshChars, stats, events, turn, applied);
        stats = after.stats;
        if (after.died) {
          died = true;
          cause = after.cause;
        }
      }
      let location = s.location;
      let nextPresent = [...new Set([...present, ...(target && target.status === 'alive' ? [target.id] : []), ...events.flatMap((e) => e.participants)])];
      if (cls.category === 'travel') {
        const m = /(?:nach|zu|zum|zur|in|to|towards)\s+([\p{L}\d][\p{L}\d .'-]{1,40})/u.exec(text);
        if (m) location = m[1].trim();
        nextPresent = target ? [target.id] : [];
      }
      const aliveIds = new Set(listLifeCharacters(ctx, id).filter((c) => c.status === 'alive').map((c) => c.id));
      nextPresent = nextPresent.filter((p) => aliveIds.has(p));
      world.lastChanges = applied;
      world.recentEvents = [...(world.recentEvents ?? []), ...events.map((e) => e.kind)].slice(-6);
      let ending: string | null = null;
      if (died) ending = finishDeath(ctx, s, turn, cause);
      run(
        ctx.db,
        'UPDATE life_stories SET stats = ?, turn = ?, present = ?, location = ?, world = ?, status = ?, ending = ?, updated_at = ? WHERE id = ?',
        JSON.stringify(stats),
        turn,
        JSON.stringify(nextPresent.slice(0, 6)),
        location,
        JSON.stringify(world),
        died ? 'ended' : 'active',
        ending,
        ctx.now().toISOString(),
        id,
      );
      const resolutionDto: LifeResolutionDto = { category: res.category, tier: res.tier, chance: res.chance, statChanges: applied, targetName: target?.name ?? null };
      const mid = insertMessage(ctx, id, turn, 'narrator', '', { resolution: resolutionDto }, null, true);
      // Das Ende steht nach der Erzählung des letzten Zugs.
      if (ending) insertMessage(ctx, id, turn, 'system', ending, { severity: 'critical', ending: true });
      return { messageId: mid, turnCtx: { playerText: text, resolution: res, events, mode: 'turn' as const } };
    }));
  } catch (error) {
    turnLocks.delete(id);
    throw error;
  }
  startNarration(ctx, id, messageId, turnCtx, false);
  return getStoryDto(ctx, id);
}

const INCOME: Record<StoryRow['archetype'], LifeStats> = {
  crime_boss: { wealth: 3 },
  gangster: { wealth: 1 },
  politician: { wealth: 1 },
  entrepreneur: { wealth: 2 },
  celebrity: { wealth: 2 },
  law: { wealth: 1 },
  ordinary: { wealth: 1 },
};

/** Zeit vergehen lassen: Tage vergehen, Figuren handeln eigenständig, Wunden heilen, Nachrichten verbreiten sich. */
export async function advanceTime(ctx: AppContext, id: string, mode: 'time' | 'away' = 'time'): Promise<LifeStoryDto> {
  const story = getStory(ctx, id);
  requireActive(story);
  lock(id);
  let messageId = 0;
  let turnCtx: TurnContext;
  try {
    ({ messageId, turnCtx } = tx(ctx.db, () => {
      const s = getStory(ctx, id);
      const turn = s.turn + 1;
      const rng = createRng(`${s.seed}:${turn}:time`);
      const days = rng.int(1, 3);
      const passive: LifeStats = { ...INCOME[s.archetype], health: 6 * days, heat: -5 * days };
      const r = applyStats(statsOf(s), passive);
      const applied: LifeStats = { ...r.applied };
      // Todesfälle, die bisher nur Zeugen kannten, sprechen sich herum.
      for (const m of all<MemoryRow>(ctx.db, `SELECT * FROM life_memories WHERE story_id = ? AND kind = 'death' AND known_by NOT LIKE '%"*"%'`, id)) reveal(ctx, m.id, [EVERYONE]);
      const chars = listLifeCharacters(ctx, id);
      const world = worldOf(s);
      const events = rollEvents({ ...s, day: s.day + days }, r.stats, genresOf(s), chars, rng, mode, world.recentEvents ?? []);
      const sDay = { ...s, day: s.day + days };
      const after = applyEvents(ctx, sDay, chars, r.stats, events, turn, applied);
      world.lastChanges = applied;
      world.recentEvents = [...(world.recentEvents ?? []), ...events.map((e) => e.kind)].slice(-6);
      const ending = after.died ? finishDeath(ctx, sDay, turn, after.cause) : null;
      run(
        ctx.db,
        'UPDATE life_stories SET stats = ?, turn = ?, day = ?, world = ?, status = ?, ending = ?, updated_at = ?, last_tick_at = ?, present = ? WHERE id = ?',
        JSON.stringify(after.stats),
        turn,
        s.day + days,
        JSON.stringify(world),
        after.died ? 'ended' : 'active',
        ending,
        mode === 'away' ? s.updated_at : ctx.now().toISOString(),
        ctx.now().toISOString(),
        JSON.stringify(events.flatMap((e) => e.participants).slice(0, 4)),
        id,
      );
      const mid = insertMessage(ctx, id, turn, 'narrator', '', mode === 'away' ? { away: true } : null, null, true);
      if (ending) insertMessage(ctx, id, turn, 'system', ending, { severity: 'critical', ending: true });
      return { messageId: mid, turnCtx: { playerText: '', resolution: null, events, mode } };
    }));
  } catch (error) {
    turnLocks.delete(id);
    throw error;
  }
  startNarration(ctx, id, messageId, turnCtx, mode === 'away');
  return getStoryDto(ctx, id);
}

/** Wartet auf eine laufende Erzählung (Tests, Hintergrundaufgaben). */
export async function waitForNarration(id: string): Promise<void> {
  await narrations.get(id);
}

/** Nach einem Neustart: unterbrochene Erzählungen regelbasiert abschließen, damit keine Geschichte hängen bleibt. */
export function recoverPendingNarrations(ctx: AppContext): void {
  for (const m of all<{ id: number; story_id: string; data: string | null }>(ctx.db, 'SELECT id, story_id, data FROM life_messages WHERE pending = 1')) {
    const data = parseJson<Record<string, unknown>>(m.data ?? '{}', {});
    const mode: TurnContext['mode'] = data.away ? 'away' : data.resolution ? 'turn' : 'time';
    startNarration(ctx, m.story_id, m.id, { playerText: '', resolution: null, events: [], mode }, true);
  }
}

/** Hintergrund-Takt: Geschichten entwickeln sich weiter, auch wenn der Spieler gerade nicht spielt (begrenzt). */
export async function tickLifeStories(ctx: AppContext): Promise<number> {
  // Pausierte Simulation (Einstellungen) pausiert auch die Lebensgeschichten.
  if (!getSettings(ctx.db).simulation.autoEnabled) return 0;
  const now = ctx.now().getTime();
  const due = all<{ id: string; last_tick_at: string; updated_at: string }>(ctx.db, `SELECT id, last_tick_at, updated_at FROM life_stories WHERE status = 'active'`).filter(
    (s) => now - Date.parse(s.last_tick_at) > 8 * 3_600_000 && now - Date.parse(s.updated_at) < 14 * 86_400_000,
  );
  let n = 0;
  for (const s of due.slice(0, 2)) {
    if (turnLocks.has(s.id)) continue;
    await advanceTime(ctx, s.id, 'away');
    await waitForNarration(s.id);
    n++;
  }
  return n;
}

// ---------- Zusammenfassungen ----------

async function summarizeIfNeeded(ctx: AppContext, id: string, background: boolean): Promise<void> {
  const s = getStory(ctx, id);
  const pending = all<MessageRow>(ctx.db, `SELECT * FROM life_messages WHERE story_id = ? AND id > ? AND pending = 0 AND role != 'image' ORDER BY id`, id, s.summarized_upto);
  if (pending.length < SUMMARY_TRIGGER) return;
  const chunk = pending.slice(0, SUMMARY_CHUNK);
  const names = new Map(listLifeCharacters(ctx, id).map((c) => [c.id, c.name]));
  const lines = chunk.map((m) => `${m.role === 'player' ? s.player_name : m.role === 'character' ? (names.get(m.speaker_id ?? '') ?? '?') : m.role === 'event' ? '!' : '·'}: ${truncate(m.content, 200)}`);
  let summary = '';
  if (!background && ctx.ai.isActive('chat')) {
    const result = await ctx.ai.complete({
      purpose: 'summary',
      kind: 'chat',
      maxTokens: 260,
      temperature: 0.2,
      messages: [
        { role: 'system', content: `Summarize this part of a life story in ${s.lang === 'de' ? 'German' : 'English'} for long-term memory. Keep decisions, conflicts, promises, relationships and consequences. Max 110 words, plain text.` },
        { role: 'user', content: lines.join('\n') },
      ],
    });
    if (result.ok && result.provider !== 'fallback') summary = truncate(cleanText(result.text), 900);
  }
  if (!summary) {
    // Regelbasiert: Handlungen des Spielers und Ereignisse in Kurzform.
    const acts = chunk.filter((m) => m.role === 'player').map((m) => truncate(m.content, 60));
    const events = chunk.filter((m) => m.role === 'event').map((m) => m.content.split(':')[0]);
    summary = truncate(`${s.lang === 'de' ? `Züge ${chunk[0].turn}–${chunk.at(-1)!.turn}` : `Turns ${chunk[0].turn}–${chunk.at(-1)!.turn}`}: ${acts.join('; ')}${events.length ? ` | ${events.join(', ')}` : ''}`, 900);
  }
  remember(ctx, id, { kind: 'summary', content: summary, importance: 3, knownBy: [PLAYER], turn: chunk.at(-1)!.turn, source: 'summary' });
  run(ctx.db, 'UPDATE life_stories SET summarized_upto = ? WHERE id = ?', chunk.at(-1)!.id, id);
}

// ---------- Bilder ----------

/**
 * Szenenbild der aktuellen Situation. Mit Bild-KI als Foto (Hintergrundauftrag), sonst als gezeichnete Szenenkarte.
 * Das Ergebnis erscheint als Bildnachricht im Verlauf und bleibt gespeichert.
 */
export async function requestStoryImage(ctx: AppContext, id: string, description: string, priority: 'user' | 'background' = 'user'): Promise<{ job: ImageJobDto | null; story: LifeStoryDto }> {
  const extra = checkExtra(description);
  const s = getStory(ctx, id);
  const chars = listLifeCharacters(ctx, id);
  const present = new Set(presentOf(s));
  const visibleChars = chars.filter((c) => c.status === 'alive' && present.has(c.id)).slice(0, 3);
  const names = new Map(chars.map((c) => [c.id, c.name]));
  const transcript = all<MessageRow>(ctx.db, `SELECT * FROM (SELECT * FROM life_messages WHERE story_id = ? AND pending = 0 AND role != 'image' ORDER BY id DESC LIMIT 10) ORDER BY id`, id).map(
    (m) => `${m.role === 'player' ? s.player_name : m.role === 'character' ? (names.get(m.speaker_id ?? '') ?? '?') : m.role === 'event' ? 'Event' : 'Narrator'}: ${truncate(m.content, 260)}`,
  );
  const memories = recall(ctx, id, { query: `${transcript.slice(-3).join(' ')} ${extra}`, subjects: [...present], viewer: PLAYER, turn: s.turn, limit: 4, criticalLimit: 2 }).map((m) => m.content);
  const world = worldOf(s);
  const variation = (world.imageVariation ?? 0) + 1;
  world.imageVariation = variation;
  saveWorld(ctx, id, world);
  const scene = await buildScene(ctx, {
    transcript,
    memories,
    characters: [
      { name: s.player_name, appearance: playerAppearance(s), role: s.player_role },
      ...visibleChars.map((c) => ({ name: c.name, appearance: lifeAppearance(ctx, c), role: c.role })),
    ],
    location: s.location,
    setting: world.setting,
    mood: genresOf(s)[0] === 'crime' ? 'tense, dangerous' : genresOf(s)[0] === 'romance' ? 'intimate, emotional' : 'realistic, everyday',
    lang: s.lang,
    extra,
    variation,
  });
  const characterIds = chars.filter((c) => scene.visible.includes(c.name)).map((c) => c.id);
  const job = await ctx.images.request({
    kind: 'scene',
    ownerType: 'life_story',
    ownerId: id,
    prompt: scene.prompt,
    caption: scene.caption,
    // Zufälliger Seed je Bild: gleiche Situation ⇒ trotzdem nie zweimal dasselbe Foto.
    seed: Math.floor(Math.random() * 2_147_483_647),
    size: 'scene',
    priority,
    onDone: (imageId) => {
      insertMessage(ctx, id, getStory(ctx, id).turn, 'image', scene.caption, { imageId, characterIds });
      const ev = get<{ id: string }>(ctx.db, 'SELECT id FROM life_events WHERE story_id = ? AND image_id IS NULL ORDER BY turn DESC LIMIT 1', id);
      if (priority === 'background' && ev) run(ctx.db, 'UPDATE life_events SET image_id = ? WHERE id = ?', imageId, ev.id);
    },
  });
  if (job) {
    if (job.status === 'queued' || job.status === 'running') imageJobs.set(id, job.id);
  } else if (priority === 'user') {
    insertMessage(ctx, id, s.turn, 'image', scene.caption, { sceneCard: { location: scene.location, characterIds, caption: scene.caption, mood: scene.mood } });
  }
  return { job, story: getStoryDto(ctx, id) };
}

/** Titelbild einer Geschichte (nur mit Bild-KI; sonst zeigt die Oberfläche eine gezeichnete Grafik). */
export async function requestStoryCover(ctx: AppContext, id: string): Promise<ImageJobDto | null> {
  const s = getStory(ctx, id);
  const world = worldOf(s);
  return ctx.images.request({
    kind: 'cover',
    ownerType: 'life_story',
    ownerId: id,
    prompt: coverPrompt({ title: s.title, setting: `${world.setting}${s.location ? `, ${s.location}` : ''}`, mood: genresOf(s)[0] === 'crime' ? 'noir, tense' : 'cinematic', variation: stableSeed(id) % 64 }),
    caption: s.title,
    seed: stableSeed(`cover:${id}`),
    size: 'cover',
    priority: 'background',
    onDone: (imageId) => run(ctx.db, 'UPDATE life_stories SET cover_image_id = ? WHERE id = ?', imageId, id),
  });
}

export function deleteStory(ctx: AppContext, id: string): void {
  getStory(ctx, id);
  if (turnLocks.has(id)) throw new AppError(409, 'turn_running', 'Die Geschichte wird gerade weitererzählt.');
  run(ctx.db, 'DELETE FROM life_stories WHERE id = ?', id);
}

export function startOpening(ctx: AppContext, id: string): void {
  const s = getStory(ctx, id);
  const mid = insertMessage(ctx, id, s.turn, 'narrator', '', null, null, true);
  turnLocks.add(id);
  startNarration(ctx, id, mid, { playerText: '', resolution: null, events: [], mode: 'opening' }, false);
  ensureLifeAvatars(ctx, id);
  void requestStoryCover(ctx, id).catch(() => undefined);
}

/** Beim Löschen aller Daten: laufende Zustände vergessen (laufende Erzählungen schreiben danach ins Leere). */
export function resetLifeState(): void {
  turnLocks.clear();
  narrations.clear();
  imageJobs.clear();
}
