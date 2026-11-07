/**
 * SocialVerse Leben – eigenständige Handy-Version des Lebensmodus.
 * Mit KI (Claude-Funktion der Seite, Konto des Spielers): Vorbereitungs-Gespräch, zusammenhängende Erzählung,
 * getrennte Bewertung der Werte, Handlungsstränge und Regie. Ohne KI: die regelbasierte Spiellogik der App
 * (Würfelsystem, Ereignisse, Vorschläge). Der Spielstand liegt im Browser (localStorage).
 */
import { deriveAppearance, normalizeAppearance, portraitSvg, type Appearance } from '../shared/appearance';
import {
  CHARACTER_STANCES,
  LIFE_ARCHETYPES,
  type LifeCharacterStatus,
  type LifeSetupCharacter,
  type LifeSetupDraft,
  type LifeStat,
  type LifeStats,
  type LifeSuggestion,
  type OutcomeTier,
} from '../shared/life';
import { de } from '../client/src/i18n/de';
import { aiErrorText, aiSetupTurn, aiStoryTurn, getSample, isPermanentAiError, toDraft, type AiDraftRaw, type StoryContext, type Turn } from './ai';
import { initialStats } from '../server/src/life/stats';
import { OPENING, TIME_PASSES } from '../server/src/content/lifeContent';
import { createRng } from '../server/src/lib/rng';
import { fill } from '../server/src/lib/text';
import type { LifeCharacterRow } from '../server/src/life/characters';
import { applyStats, classifyAction, deathText, resolveAction, rollEvents, type EventOutcome } from '../server/src/life/engine';
import { fallbackNarration, type TurnContext } from '../server/src/life/fallback';
import { keywordsOf } from '../server/src/life/memory';
import { ruleDraftCore } from '../server/src/life/reader';
import { genresOf, presentOf, statKeysOf, statsOf, worldOf, type StoryRow, type WorldState } from '../server/src/life/store';

// ---------- Datenmodell ----------

type Role = 'player' | 'narrator' | 'character' | 'event' | 'system' | 'scene';
interface Msg {
  id: number;
  turn: number;
  role: Role;
  speakerId?: string | null;
  content: string;
  title?: string;
  severity?: 'minor' | 'major' | 'critical';
  suggestions?: LifeSuggestion[];
  resolution?: { tier: OutcomeTier; chance: number; changes: LifeStats; target: string | null };
  scene?: { location: string; ids: string[] };
  /** KI-Bewertung des Zugs (getrennt von der Erzählung). */
  evaluation?: { stat: string; change: number; reason: string }[];
  outcome?: 'success' | 'partial' | 'failure' | 'none';
  pending?: boolean;
  /** Freier Sprecher (KI-Dialog einer nicht angelegten Figur). */
  speakerName?: string;
}
interface Ev {
  id: string;
  turn: number;
  day: number;
  title: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
}
interface Mem {
  id: string;
  turn: number;
  kind: string;
  content: string;
  importance: number;
  critical: boolean;
  subjects: string[];
  knownBy: string[];
}
interface Story {
  row: StoryRow;
  chars: LifeCharacterRow[];
  messages: Msg[];
  events: Ev[];
  memories: Mem[];
  nextMsg: number;
  /** 'ai': KI erzählt; 'rules': regelbasiert (ohne KI oder ohne Freigabe). */
  mode?: 'ai' | 'rules';
  summary?: string;
  threads?: string[];
  direction?: string;
  quick?: boolean;
}
interface SetupState {
  history: Turn[];
  premise: string;
  raw: AiDraftRaw | null;
  draft: LifeSetupDraft | null;
  statsEdited: boolean;
  aiOff?: boolean;
}
interface State {
  version: 1;
  stories: Story[];
  setup?: SetupState | null;
}

const EVERYONE = '*';
const PLAYER = 'player';
const KEY = 'socialverse-leben-v1';
const t = de;

function uid(prefix: string): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return `${prefix}_${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s && Array.isArray(s.stories)) return s;
    }
  } catch {
    // Kein Speicher verfügbar (privates Fenster): dann nur für diese Sitzung.
  }
  return { version: 1, stories: [] };
}

const state: State = load();
let storageOk = true;

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

// ---------- Hilfen ----------

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const now = () => new Date().toISOString();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const parse = <T,>(s: string | null | undefined, fb: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fb;
  } catch {
    return fb;
  }
};

const portraitCache = new Map<string, string>();
function portrait(key: string, appearance: Appearance, name: string): string {
  const k = `${key}:${JSON.stringify(appearance)}`;
  let url = portraitCache.get(k);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(appearance, key, name))}`;
    portraitCache.set(k, url);
  }
  return url;
}
function charAppearance(c: LifeCharacterRow): Appearance {
  return normalizeAppearance(parse(c.appearance, {}), deriveAppearance(c.id, { role: c.role }));
}
function playerAppearance(s: StoryRow): Appearance {
  return normalizeAppearance(parse(s.player_appearance, {}), deriveAppearance(`player:${s.id}`, { role: s.player_role }));
}

function remember(st: Story, m: Omit<Mem, 'id'>): void {
  st.memories.push({ ...m, id: uid('mem'), content: m.content.slice(0, 600), knownBy: [...new Set(m.knownBy)] });
}
const knows = (m: Mem, viewer: string) => m.knownBy.includes(EVERYONE) || m.knownBy.includes(viewer);

function push(st: Story, m: Omit<Msg, 'id'>): Msg {
  const msg = { ...m, id: st.nextMsg++ };
  st.messages.push(msg);
  return msg;
}

function setWorld(s: StoryRow, w: WorldState): void {
  s.world = JSON.stringify(w);
}

function recentSuggestionTexts(st: Story): string[] {
  return st.messages
    .filter((m) => m.role === 'narrator' && m.suggestions)
    .slice(-3)
    .flatMap((m) => m.suggestions!.map((s) => s.text));
}

function changeChar(c: LifeCharacterRow, change: { affinity?: number; trust?: number; loyalty?: number; fear?: number }, stance: LifeCharacterRow['stance'] | null, turn: number, status?: { status: LifeCharacterStatus; note: string } | null) {
  const clamp = (v: number, min: number) => Math.max(min, Math.min(100, Math.round(v)));
  c.affinity = clamp(c.affinity + (change.affinity ?? 0), -100);
  c.trust = clamp(c.trust + (change.trust ?? 0), 0);
  c.loyalty = clamp(c.loyalty + (change.loyalty ?? 0), 0);
  c.fear = clamp(c.fear + (change.fear ?? 0), 0);
  if (stance) c.stance = stance;
  if (status) {
    c.status = status.status;
    c.status_note = status.note;
    c.status_turn = turn;
  }
}

// ---------- Spielablauf (gleiche Regeln wie der Server) ----------

function createStory(d: LifeSetupDraft): Story {
  const id = uid('life');
  const ts = now();
  const keys = d.statKeys.includes('health') ? d.statKeys : (['health', ...d.statKeys] as LifeStat[]);
  const stats = Object.fromEntries(keys.map((k) => [k, Math.max(0, Math.min(100, Math.round(d.stats[k] ?? (k === 'health' ? 85 : 40))))]));
  const row: StoryRow = {
    id,
    title: d.title,
    premise: d.premise,
    setup: JSON.stringify({ opening: d.opening }),
    genre: d.genres.join(','),
    archetype: d.archetype,
    player_name: d.playerName,
    player_role: d.playerRole,
    player_appearance: JSON.stringify(d.playerAppearance),
    stats: JSON.stringify(stats),
    stat_keys: JSON.stringify(keys),
    assets: JSON.stringify(d.assets),
    world: JSON.stringify({ setting: d.setting, locations: d.locations, organizations: d.organizations, rules: d.rules }),
    location: d.location,
    present: '[]',
    status: 'active',
    ending: null,
    turn: 0,
    day: 1,
    seed: id,
    lang: 'de',
    cover_image_id: null,
    summarized_upto: 0,
    created_at: ts,
    updated_at: ts,
    last_tick_at: ts,
  };
  const st: Story = { row, chars: [], messages: [], events: [], memories: [], nextMsg: 1 };
  d.characters
    .filter((c) => c.name.trim())
    .forEach((c, i) => {
      const cid = uid('lc');
      const importance = i < 2 || ['love', 'family', 'enemy', 'boss'].includes(c.stance) ? 3 : 2;
      st.chars.push({
        id: cid,
        story_id: id,
        name: c.name.trim(),
        role: c.role,
        description: c.description,
        personality: JSON.stringify(c.personality),
        goals: JSON.stringify(c.goals),
        secrets: JSON.stringify(c.secrets),
        appearance: JSON.stringify(c.appearance ?? deriveAppearance(cid, { role: `${c.role} ${c.description}` })),
        status: 'alive',
        affinity: Math.round(c.affinity),
        trust: Math.round(c.trust),
        loyalty: Math.round(c.loyalty),
        fear: Math.round(c.fear),
        stance: c.stance,
        importance,
        social_character_id: null,
        avatar_image_id: null,
        status_turn: null,
        status_note: '',
        created_at: ts,
      });
      remember(st, {
        turn: 0,
        kind: 'relationship',
        content: `${c.name} (${c.role}): ${c.description}`,
        importance: importance + 1,
        critical: ['love', 'family', 'enemy'].includes(c.stance),
        subjects: [cid],
        knownBy: [PLAYER, cid],
      });
      for (const secret of c.secrets) remember(st, { turn: 0, kind: 'secret', content: `${c.name}: ${secret}`, importance: 4, critical: false, subjects: [cid], knownBy: [cid] });
    });
  remember(st, { turn: 0, kind: 'setup', content: trunc(d.premise, 900), importance: 5, critical: true, subjects: [], knownBy: [PLAYER] });
  if (d.setting) remember(st, { turn: 0, kind: 'location', content: d.setting, importance: 3, critical: false, subjects: [], knownBy: [EVERYONE] });
  row.present = JSON.stringify(st.chars.slice(0, 2).map((c) => c.id));
  // Eröffnung
  const n = fallbackNarration(row, st.chars, { playerText: '', resolution: null, events: [], mode: 'opening' }, createRng(`${row.seed}:0:narration`), []);
  const world = worldOf(row);
  push(st, {
    turn: 0,
    role: 'narrator',
    content: fill(OPENING.de, { setting: world.setting, player: row.player_name, role: row.player_role, situation: d.opening }),
    suggestions: n.suggestions,
  });
  return st;
}

/** Ereignisse anwenden; gibt neue Werte und ggf. den Tod der Spielfigur zurück. */
function applyEvents(st: Story, events: EventOutcome[], stats: LifeStats, turn: number, day: number, applied: LifeStats) {
  let current = stats;
  let died = false;
  let cause: string | null = null;
  for (const e of events) {
    const r = applyStats(current, e.stats);
    current = r.stats;
    for (const [k, v] of Object.entries(r.applied)) applied[k as LifeStat] = (applied[k as LifeStat] ?? 0) + (v ?? 0);
    for (const rel of e.relation) {
      const c = st.chars.find((x) => x.id === rel.id);
      if (c) changeChar(c, rel.change, rel.stance ?? null, turn, rel.status ?? null);
    }
    st.events.unshift({ id: uid('ev'), turn, day, title: e.title, description: e.description, severity: e.severity });
    push(st, { turn, role: 'event', content: e.description, title: e.title, severity: e.severity });
    if (e.memory) {
      const subject = e.participants.map((p) => st.chars.find((c) => c.id === p)?.name).filter(Boolean).join(', ');
      const content = e.kind === 'betrayal' && !e.memory.knownBy.includes(PLAYER) ? `${subject} hat ${st.row.player_name} verraten.` : `${e.title}: ${e.description}`;
      remember(st, { turn, kind: e.memory.kind, content, importance: e.memory.importance, critical: e.memory.critical, subjects: e.participants, knownBy: e.memory.knownBy });
    }
    if ((current.health ?? 1) <= 0) {
      died = true;
      cause = e.deathCause ?? e.kind;
      break;
    }
  }
  return { stats: current, died, cause };
}

function finishDeath(st: Story, turn: number, cause: string | null): string {
  const text = deathText(st.row, cause);
  st.events.unshift({ id: uid('ev'), turn, day: st.row.day, title: 'Das Ende', description: text, severity: 'critical' });
  remember(st, { turn, kind: 'death', content: text, importance: 5, critical: true, subjects: [], knownBy: [EVERYONE] });
  return text;
}

const TRAVEL = /(?:^|[^\p{L}])(?:nach|zum|zur|ins|in|to|towards|into)\s+(?:(?:dem|den|der|die|das|the)\s+)?(\p{Lu}[\p{L}\d'-]+(?:\s\p{Lu}[\p{L}\d'-]+){0,3})/u;

function takeTurn(st: Story, input: { text?: string; suggestion?: LifeSuggestion }): void {
  const s = st.row;
  if (s.status === 'ended') return;
  const text = clean(input.suggestion?.text ?? input.text ?? '').slice(0, 600);
  if (!text) return;
  const turn = s.turn + 1;
  const rng = createRng(`${s.seed}:${turn}`);
  const present = presentOf(s);
  const cls = classifyAction(text, st.chars, present, input.suggestion ?? null);
  const target = st.chars.find((c) => c.id === cls.targetId) ?? null;
  const res = resolveAction(statsOf(s), cls, target, rng);
  push(st, { turn, role: 'player', content: text });
  const r = applyStats(statsOf(s), res.statChanges);
  const applied: LifeStats = { ...r.applied };
  const witnesses = [...new Set([...present, ...(target ? [target.id] : [])])];
  if (target && res.target) changeChar(target, res.target, res.stance, turn, res.targetStatus ? { status: res.targetStatus.status, note: res.targetStatus.note } : null);
  const tierWord = t.lifeTiers[res.tier];
  if (!['talk', 'wait', 'rest', 'travel'].includes(cls.category) || res.tier.startsWith('critical')) {
    remember(st, {
      turn,
      kind: 'decision',
      content: `${s.player_name}: „${trunc(text, 160)}“ → ${tierWord}${target ? ` (${target.name})` : ''}`,
      importance: ['violence', 'crime', 'deceive', 'threaten'].includes(cls.category) || res.tier.startsWith('critical') ? 4 : 2,
      critical: false,
      subjects: target ? [target.id] : [],
      knownBy: [PLAYER, ...witnesses],
    });
  }
  if (cls.promise) {
    remember(st, { turn, kind: 'promise', content: `${s.player_name} hat ${target?.name ?? 'jemandem'} versprochen: „${trunc(text, 180)}“`, importance: 4, critical: true, subjects: target ? [target.id] : [], knownBy: [PLAYER, ...witnesses] });
  }
  if (cls.category === 'deceive' && target) {
    const betrayal = ['ally', 'friend', 'love', 'family', 'boss', 'subordinate'].includes(target.stance);
    const detected = res.tier === 'failure' || res.tier === 'critical_failure';
    remember(st, {
      turn,
      kind: betrayal ? 'betrayal' : 'secret',
      content: `${s.player_name} hat ${target.name} getäuscht: „${trunc(text, 140)}“${detected ? ' – und wurde durchschaut.' : ''}`,
      importance: betrayal ? 5 : 3,
      critical: betrayal,
      subjects: [target.id],
      knownBy: detected ? [PLAYER, target.id] : [PLAYER],
    });
  }
  if (target && res.targetStatus?.status === 'dead') {
    remember(st, { turn, kind: 'death', content: `${target.name} wurde an Tag ${s.day} von ${s.player_name} getötet.`, importance: 5, critical: true, subjects: [target.id], knownBy: [PLAYER, ...witnesses] });
  }
  if (res.revealedSecret) {
    remember(st, { turn, kind: 'secret', content: `${target?.name}: ${res.revealedSecret.secret}`, importance: 4, critical: false, subjects: [res.revealedSecret.characterId], knownBy: [PLAYER, res.revealedSecret.characterId] });
  }
  let stats = r.stats;
  let died = res.playerDied;
  let cause = res.deathCause;
  const world = worldOf(s);
  const events: EventOutcome[] = [];
  // Erzählung des Spielerzugs vor den Ereignissen anzeigen: Platzhalter jetzt, Text danach.
  const narr = push(st, { turn, role: 'narrator', content: '', resolution: { tier: res.tier, chance: res.chance, changes: {}, target: target?.name ?? null } });
  if (!died) {
    events.push(...rollEvents(s, stats, genresOf(s), st.chars, rng, 'turn', world.recentEvents ?? []));
    const after = applyEvents(st, events, stats, turn, s.day, applied);
    stats = after.stats;
    if (after.died) {
      died = true;
      cause = after.cause;
    }
  }
  let location = s.location;
  let nextPresent = [...new Set([...present, ...(target && target.status === 'alive' ? [target.id] : []), ...events.flatMap((e) => e.participants)])];
  if (cls.category === 'travel') {
    const m = TRAVEL.exec(text);
    if (m) location = m[1].replace(/[.,;!?].*$/, '').trim();
    nextPresent = target ? [target.id] : [];
  }
  const alive = new Set(st.chars.filter((c) => c.status === 'alive').map((c) => c.id));
  nextPresent = nextPresent.filter((p) => alive.has(p)).slice(0, 6);
  world.lastChanges = applied;
  world.recentEvents = [...(world.recentEvents ?? []), ...events.map((e) => e.kind)].slice(-6);
  Object.assign(s, { stats: JSON.stringify(stats), turn, present: JSON.stringify(nextPresent), location, status: died ? 'ended' : 'active', updated_at: now() });
  setWorld(s, world);
  const ending = died ? finishDeath(st, turn, cause) : null;
  s.ending = ending;
  const turnCtx: TurnContext = { playerText: text, resolution: res, events, mode: 'turn' };
  const n = fallbackNarration(s, st.chars, turnCtx, createRng(`${s.seed}:${turn}:narration`), recentSuggestionTexts(st));
  narr.content = n.narration;
  narr.resolution!.changes = applied;
  narr.suggestions = died ? [] : n.suggestions;
  if (!died) for (const d of n.dialogue) push(st, { turn, role: 'character', speakerId: d.speakerId, content: d.text });
  if (ending) push(st, { turn, role: 'system', content: ending });
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

function advanceTime(st: Story): void {
  const s = st.row;
  if (s.status === 'ended') return;
  const turn = s.turn + 1;
  const rng = createRng(`${s.seed}:${turn}:time`);
  const days = rng.int(1, 3);
  const r = applyStats(statsOf(s), { ...INCOME[s.archetype], health: 6 * days, heat: -5 * days });
  const applied: LifeStats = { ...r.applied };
  for (const m of st.memories) if (m.kind === 'death' && !m.knownBy.includes(EVERYONE)) m.knownBy.push(EVERYONE);
  const world = worldOf(s);
  const day = s.day + days;
  const narr = push(st, { turn, role: 'narrator', content: fill(TIME_PASSES.de, { location: s.location || world.setting }) });
  const events = rollEvents({ ...s, day }, r.stats, genresOf(s), st.chars, rng, 'time', world.recentEvents ?? []);
  const after = applyEvents(st, events, r.stats, turn, day, applied);
  world.lastChanges = applied;
  world.recentEvents = [...(world.recentEvents ?? []), ...events.map((e) => e.kind)].slice(-6);
  Object.assign(s, { stats: JSON.stringify(after.stats), turn, day, status: after.died ? 'ended' : 'active', updated_at: now(), present: JSON.stringify(events.flatMap((e) => e.participants).slice(0, 4)) });
  setWorld(s, world);
  const ending = after.died ? finishDeath(st, turn, after.cause) : null;
  s.ending = ending;
  const n = fallbackNarration(s, st.chars, { playerText: '', resolution: null, events, mode: 'time' }, createRng(`${s.seed}:${turn}:narration`), recentSuggestionTexts(st));
  narr.suggestions = after.died ? [] : n.suggestions;
  if (ending) push(st, { turn, role: 'system', content: ending });
}


// ---------- KI-Spielzug ----------

let busyStory: string | null = null;
let busyController: AbortController | null = null;
let aiNotice = '';

const matchChar = (st: Story, name: string) => {
  const n = name.trim().toLowerCase();
  return st.chars.find((c) => c.name.toLowerCase() === n) ?? st.chars.find((c) => c.name.toLowerCase().split(/\s+/)[0] === n.split(/\s+/)[0]);
};

function storyContext(st: Story, mode: StoryContext['mode'], action: string): StoryContext {
  const s = st.row;
  const stats = statsOf(s);
  const name = (id: string | null | undefined) => (id ? (st.chars.find((c) => c.id === id)?.name ?? '?') : '?');
  const recent = st.messages
    .filter((m) => !m.pending && ['player', 'narrator', 'character', 'event'].includes(m.role) && m.content)
    .slice(-14)
    .map((m) => {
      const who = m.role === 'player' ? s.player_name : m.role === 'character' ? (m.speakerName ?? name(m.speakerId)) : m.role === 'event' ? 'Ereignis' : 'Erzähler';
      return `${who}: ${trunc(m.content, 500)}`;
    });
  const known = st.memories.filter((m) => knows(m, PLAYER) && m.kind !== 'setup' && m.kind !== 'location');
  const facts = [...known.filter((m) => m.critical), ...known.filter((m) => !m.critical).slice(-14)].slice(-26).map((m) => m.content);
  return {
    title: s.title,
    premise: s.premise,
    setting: worldOf(s).setting,
    player: { name: s.player_name, role: s.player_role },
    day: s.day,
    location: s.location,
    stats: statKeysOf(s).map((k) => ({ stat: k, label: statLabel(k), value: stats[k] ?? 0 })),
    characters: st.chars.map((c) => ({
      name: c.name,
      role: c.role,
      stance: c.stance,
      status: c.status,
      affinity: c.affinity,
      trust: c.trust,
      loyalty: c.loyalty,
      fear: c.fear,
      goal: parse<string[]>(c.goals, []).join('; '),
      secret: parse<string[]>(c.secrets, []).join('; '),
      personality: parse<string[]>(c.personality, []).join(', '),
    })),
    summary: st.summary ?? '',
    threads: st.threads ?? [],
    facts,
    direction: st.direction ?? '',
    recent,
    action,
    mode,
  };
}

/** Ein Zug mit KI. Bei dauerhaft fehlender Freigabe wechselt die Geschichte auf die regelbasierte Spiellogik. */
async function aiTurn(st: Story, mode: StoryContext['mode'], action: string): Promise<void> {
  const sample = await getSample();
  if (!sample) {
    st.mode = 'rules';
    aiNotice = 'Die KI ist in dieser Ansicht nicht verfügbar. Es geht regelbasiert weiter.';
    if (mode === 'turn') takeTurn(st, { text: action });
    else if (mode === 'time') advanceTime(st);
    save();
    render();
    return;
  }
  const s = st.row;
  const turn = mode === 'opening' ? s.turn : s.turn + 1;
  if (mode === 'turn') push(st, { turn, role: 'player', content: action });
  const narr = push(st, { turn, role: 'narrator', content: '', pending: true });
  busyStory = s.id;
  busyController = new AbortController();
  aiNotice = '';
  save();
  render();
  try {
    const r = await aiStoryTurn(sample, storyContext(st, mode, action), Boolean(st.quick), busyController.signal);
    // Werte (getrennte Bewertung)
    const changes: LifeStats = {};
    for (const x of r.stats) changes[x.stat] = (changes[x.stat] ?? 0) + x.change;
    const applied = applyStats(statsOf(s), mode === 'opening' ? {} : changes);
    // Figuren
    for (const c of r.characters) {
      const ch = matchChar(st, c.name);
      if (!ch) continue;
      changeChar(ch, c, null, turn, c.status && c.status !== ch.status ? { status: c.status as LifeCharacterStatus, note: c.note } : null);
      if (c.status === 'dead') remember(st, { turn, kind: 'death', content: `${ch.name} ist tot.${c.note ? ` ${c.note}` : ''}`, importance: 5, critical: true, subjects: [ch.id], knownBy: [EVERYONE] });
    }
    for (const f of r.facts) {
      remember(st, { turn, kind: f.critical ? 'event' : 'fact', content: f.text, importance: f.critical ? 5 : 3, critical: f.critical, subjects: [], knownBy: [PLAYER] });
      if (f.critical) st.events.unshift({ id: uid('ev'), turn, day: s.day + r.days, title: trunc(f.text, 60), description: f.text, severity: 'major' });
    }
    if (r.threads.length) st.threads = r.threads;
    if (r.summary) st.summary = r.summary;
    narr.content = r.narration;
    narr.pending = false;
    narr.outcome = r.outcome;
    narr.evaluation = mode === 'opening' ? [] : r.stats.filter((x) => applied.applied[x.stat] !== undefined).map((x) => ({ stat: x.stat, change: x.change, reason: x.reason }));
    const died = (applied.stats.health ?? 1) <= 0;
    narr.suggestions = died ? [] : r.suggestions.map((x, i) => ({ id: `${turn}-${i}`, kind: x.kind, text: x.text, category: 'talk' as const, risk: 1 as const, targetId: null }));
    for (const d of r.dialogue) {
      const ch = matchChar(st, d.speaker);
      if (ch && ch.status !== 'alive') continue;
      if (d.speaker.toLowerCase() === s.player_name.toLowerCase()) continue;
      push(st, { turn, role: 'character', speakerId: ch?.id ?? null, speakerName: ch ? undefined : d.speaker, content: d.text });
    }
    const presentIds = r.present.map((n) => matchChar(st, n)?.id).filter((x): x is string => Boolean(x));
    const world = worldOf(s);
    world.lastChanges = applied.applied;
    Object.assign(s, {
      stats: JSON.stringify(applied.stats),
      turn,
      day: s.day + r.days,
      location: r.location || s.location,
      present: JSON.stringify(presentIds.length ? presentIds : presentOf(s)),
      updated_at: now(),
    });
    setWorld(s, world);
    if (died) {
      s.status = 'ended';
      s.ending = finishDeath(st, turn, null);
      push(st, { turn, role: 'system', content: s.ending });
    }
  } catch (e) {
    st.messages = st.messages.filter((m) => m !== narr && !(mode === 'turn' && m.turn === turn && m.role === 'player' && m.content === action && m.id === narr.id - 1));
    if (isPermanentAiError(e)) {
      st.mode = 'rules';
      aiNotice = aiErrorText(e);
      if (mode === 'turn') takeTurn(st, { text: action });
      else if (mode === 'time') advanceTime(st);
    } else {
      aiNotice = aiErrorText(e);
      if (mode === 'turn') pendingDraftText = action;
    }
  } finally {
    busyStory = null;
    busyController = null;
    save();
    render();
  }
}

// ---------- Vorbereitung (Gespräch + Entwurf) ----------

let setupBusy = false;
let setupNotice = '';

function setupFallbackReply(d: LifeSetupDraft): string {
  const chars = d.characters.map((c) => c.name).join(', ');
  return `Verstanden: Du spielst ${d.playerName} (${d.playerRole}).${chars ? ` Figuren: ${chars}.` : ''}${d.opening ? ` Start: ${d.opening}` : ''} Ergänze gern Details – oder tippe auf „Passt – starten“. (Ohne KI ausgewertet.)`;
}

async function sendSetupMessage(text: string): Promise<void> {
  const su = state.setup;
  if (!su || !text.trim() || setupBusy) return;
  su.history.push({ role: 'user', content: text.trim() });
  su.premise = `${su.premise}\n${text.trim()}`.trim();
  setupBusy = true;
  setupNotice = '';
  save();
  render();
  const sample = su.aiOff ? null : await getSample();
  try {
    if (!sample) throw { code: 'not_granted' };
    const { reply, draft } = await aiSetupTurn(sample, su.history, su.raw);
    su.raw = draft;
    const next = toDraft(draft, su.premise);
    if (su.statsEdited && su.draft) {
      next.stats = { ...next.stats, ...su.draft.stats };
      next.statKeys = [...new Set([...next.statKeys, ...su.draft.statKeys])];
    }
    su.draft = next;
    su.history.push({ role: 'assistant', content: reply });
  } catch (e) {
    if (isPermanentAiError(e) || !sample) {
      su.aiOff = true;
      const d = ruleDraftCore({ prompt: su.premise }, 'de', []);
      if (su.statsEdited && su.draft) d.stats = { ...d.stats, ...su.draft.stats };
      su.draft = d;
      su.history.push({ role: 'assistant', content: setupFallbackReply(d) });
      if (sample) setupNotice = aiErrorText(e);
    } else {
      su.history.pop();
      su.premise = su.premise.slice(0, Math.max(0, su.premise.length - text.trim().length)).trim();
      setupNotice = aiErrorText(e);
      pendingSetupText = text;
    }
  } finally {
    setupBusy = false;
    save();
    render();
  }
}

function startFromSetup(): void {
  const su = state.setup;
  if (!su?.draft) return;
  const d = su.draft;
  if (!d.title.trim() || !d.playerName.trim() || !d.characters.some((c) => c.name.trim())) {
    setupNotice = 'Für den Start braucht der Entwurf einen Titel, den Namen deiner Figur und mindestens eine weitere Figur.';
    render();
    return;
  }
  const st = createStory(d);
  const ai = !su.aiOff;
  st.mode = ai ? 'ai' : 'rules';
  st.threads = su.raw?.threads?.filter((x) => typeof x === 'string').slice(0, 5) ?? [];
  st.summary = '';
  st.direction = '';
  state.stories.push(st);
  state.setup = null;
  view = { name: 'story', id: st.row.id, tab: 'story' };
  if (ai) {
    st.messages = [];
    void aiTurn(st, 'opening', '');
  } else {
    save();
    render();
  }
}

// ---------- Oberfläche ----------

type View = { name: 'home' } | { name: 'setup'; tab: 'talk' | 'draft' } | { name: 'story'; id: string; tab: Tab; confirmDelete?: boolean; direction?: boolean };
type Tab = 'story' | 'status' | 'people' | 'events' | 'memory';
let view: View = { name: 'home' };
let memoryQuery = '';
let showAllMessages = false;
let pendingDraftText = '';
let pendingSetupText = '';

const app = document.getElementById('app')!;

const EXAMPLES: [string, string][] = [
  [t.life.exampleBoss, t.life.exampleBossText],
  [t.life.examplePolitician, t.life.examplePoliticianText],
  [t.life.exampleFounder, t.life.exampleFounderText],
  [t.life.exampleOrdinary, t.life.exampleOrdinaryText],
];

const INVERTED: LifeStat[] = ['heat'];
function meterTone(stat: LifeStat, v: number): string {
  const x = INVERTED.includes(stat) ? 100 - v : v;
  return x < 25 ? 'bad' : x < 50 ? 'warn' : stat === 'health' ? 'good' : 'ok';
}
const statLabel = (k: string) => (t.lifeStats as Record<string, string>)[k] ?? k;
const stanceLabel = (k: string) => (t.lifeStances as Record<string, string>)[k] ?? k;

function iconBook(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M8 7h7M8 11h5"/></svg>';
}

function renderHome(): string {
  const list = [...state.stories].sort((a, b) => (a.row.status === b.row.status ? b.row.updated_at.localeCompare(a.row.updated_at) : a.row.status === 'active' ? -1 : 1));
  return `
  <header class="top"><div class="brand">${iconBook()}<span>SocialVerse <b>Leben</b></span></div></header>
  <main class="wrap stack">
    <section class="intro">
      <h1>Lebensgeschichten</h1>
      <p>Beschreibe dein Leben im Gespräch – als Mafiaboss, Politikerin, Gründer, Star oder ganz normaler Mensch. Wenn alles passt, startest du, und die Geschichte entwickelt sich Zug um Zug weiter: zusammenhängend, mit Rückschlägen, Verrat und echten Konsequenzen.</p>
      <div class="row">
        <button class="btn primary" data-act="new">+ Neue Geschichte</button>
        ${state.setup ? '<button class="btn ghost" data-act="resume-setup">Vorbereitung fortsetzen</button>' : ''}
      </div>
    </section>
    ${
      list.length
        ? `<ul class="cards">${list
            .map((st) => {
              const s = st.row;
              const stats = statsOf(s);
              const keys = statKeysOf(s).filter((k) => k !== 'health').slice(0, 3);
              return `<li><button class="card story-card ${s.status}" data-act="open" data-id="${esc(s.id)}">
                <span class="row between"><span class="tag">${st.mode === 'ai' ? 'KI-Erzählung' : 'Regelbasiert'}</span><span class="pill ${s.status === 'ended' ? 'bad' : 'good'}">${s.status === 'ended' ? 'Beendet' : 'Läuft'}</span></span>
                <strong class="story-title">${esc(s.title)}</strong>
                <span class="muted small">${esc(s.player_name)} – ${esc(s.player_role)}</span>
                <span class="faint small">Tag ${s.day} · Zug ${s.turn}${s.location ? ` · ${esc(s.location)}` : ''}</span>
                <span class="mini">${keys.map((k) => `<span>${esc(statLabel(k))} <b>${stats[k] ?? 0}</b></span>`).join('')}<span>♥ <b>${stats.health ?? 0}</b></span></span>
              </button></li>`;
            })
            .join('')}</ul>`
        : `<div class="empty"><strong>Noch keine Lebensgeschichte</strong><span class="muted">Tippe auf „Neue Geschichte“ und beschreibe die Situation.</span></div>`
    }
    ${storageOk ? '' : '<p class="note warn">Der Browser erlaubt kein Speichern. Der Spielstand geht beim Schließen verloren.</p>'}
    <p class="faint small center">Die KI läuft über dein Claude-Konto (beim ersten Mal fragt die Seite nach Erlaubnis). Ohne KI wird regelbasiert erzählt. Der Spielstand liegt nur in diesem Browser.</p>
  </main>`;
}

function renderDraftEditor(d: LifeSetupDraft): string {
  return `
    <section class="card stack-sm">
      <label class="field"><span>Titel</span><input data-draft="title" maxlength="80" value="${esc(d.title)}" /></label>
      <label class="field"><span>Name deiner Figur</span><input data-draft="playerName" maxlength="60" value="${esc(d.playerName)}" /></label>
      <label class="field"><span>Rolle</span><input data-draft="playerRole" maxlength="80" value="${esc(d.playerRole)}" /></label>
      <label class="field"><span>Rollentyp</span><select data-draft="archetype">${LIFE_ARCHETYPES.map((a) => `<option value="${a}" ${a === d.archetype ? 'selected' : ''}>${esc((t.lifeArchetypes as Record<string, string>)[a])}</option>`).join('')}</select></label>
      <label class="field"><span>Schauplatz</span><textarea data-draft="setting" rows="2" maxlength="600">${esc(d.setting)}</textarea></label>
      <label class="field"><span>Ausgangssituation</span><textarea data-draft="opening" rows="3" maxlength="800">${esc(d.opening)}</textarea></label>
    </section>
    <section class="card stack-sm">
      <div class="row between"><h2 class="label">Startwerte</h2><button class="btn ghost small" data-act="auto-stats">Automatisch</button></div>
      <p class="faint small">Aus deiner Beschreibung erstellt. Du kannst sie hier einmal festlegen; im Spiel bewertet die KI jede Handlung und passt sie an.</p>
      ${d.statKeys
        .map((k) => `<label class="meter-row"><span>${esc(statLabel(k))}</span><input type="range" min="0" max="100" data-stat="${k}" value="${d.stats[k] ?? 0}" /><b>${d.stats[k] ?? 0}</b></label>`)
        .join('')}
    </section>
    <section class="stack-sm">
      <div class="row between"><h2 class="label">Figuren</h2><button class="btn ghost small" data-act="add-char" ${d.characters.length >= 10 ? 'disabled' : ''}>+ Figur</button></div>
      ${d.characters
        .map(
          (c, i) => `<div class="card stack-sm char-edit">
            <div class="row between"><strong>${esc(c.name || 'Neue Figur')}</strong><button class="icon small" data-act="del-char" data-i="${i}" aria-label="Figur entfernen">✕</button></div>
            <input data-char="${i}" data-f="name" maxlength="50" placeholder="Name" value="${esc(c.name)}" />
            <input data-char="${i}" data-f="role" maxlength="80" placeholder="Rolle" value="${esc(c.role)}" />
            <textarea data-char="${i}" data-f="description" rows="2" maxlength="400" placeholder="Beschreibung">${esc(c.description)}</textarea>
            <select data-char="${i}" data-f="stance">${CHARACTER_STANCES.map((s) => `<option value="${s}" ${s === c.stance ? 'selected' : ''}>${esc(stanceLabel(s))}</option>`).join('')}</select>
          </div>`,
        )
        .join('')}
    </section>`;
}

function renderSetup(v: Extract<View, { name: 'setup' }>): string {
  const su = state.setup!;
  const d = su.draft;
  const talk = `
    <div class="feed">
      <div class="msg them"><div class="bubble">Beschreibe die Situation, in der deine Geschichte beginnt: Wer bist du, wo lebst du, wer sind die wichtigen Menschen um dich herum, und was passiert gerade? Du kannst in mehreren Nachrichten ergänzen und ändern. ${su.aiOff ? '' : 'Ich frage nach und halte alles im Entwurf fest.'}</div></div>
      ${su.history.length === 0 ? `<div class="chips">${EXAMPLES.map(([label], i) => `<button class="chip" data-act="example" data-i="${i}">${esc(label)}</button>`).join('')}</div>` : ''}
      ${su.history.map((m) => `<div class="msg ${m.role === 'user' ? 'me' : 'them'}"><div class="bubble">${esc(m.content)}</div></div>`).join('')}
      ${setupBusy ? '<div class="msg them"><div class="bubble typing">Denkt nach …</div></div>' : ''}
    </div>`;
  return `
  <header class="top"><button class="icon" data-act="home" aria-label="Zurück">←</button><div class="grow"><strong>Vorbereitung</strong><span class="faint small block">Situation beschreiben, dann starten</span></div></header>
  <nav class="tabs" role="tablist">
    <button role="tab" aria-selected="${v.tab === 'talk'}" data-act="setup-tab" data-tab="talk">Gespräch</button>
    <button role="tab" aria-selected="${v.tab === 'draft'}" data-act="setup-tab" data-tab="draft" ${d ? '' : 'disabled'}>Entwurf${d ? ` · ${d.characters.length} Figuren` : ''}</button>
  </nav>
  <main class="wrap story-main story">
    ${v.tab === 'talk' || !d ? talk : `<div class="stack">${renderDraftEditor(d)}</div>`}
    <div class="dock">
      ${setupNotice ? `<p class="note warn">${esc(setupNotice)}</p>` : ''}
      ${d ? '<button class="btn primary" data-act="start">Passt – starten</button>' : ''}
      ${
        v.tab === 'talk' || !d
          ? `<form class="composer" data-form="setup"><textarea id="setup-text" rows="2" maxlength="3000" placeholder="${su.history.length ? 'Ergänzen oder ändern …' : 'z. B. Ich bin Don Salvatore Greco, der gefürchtete Mafiaboss von Palermo …'}" aria-label="Beschreibung">${esc(pendingSetupText)}</textarea><button class="btn primary" aria-label="Senden" ${setupBusy ? 'disabled' : ''}>➤</button></form>`
          : ''
      }
    </div>
  </main>`;
}

function avatar(st: Story, id: string, size = 'sm'): string {
  if (id === 'player') return `<img class="av ${size}" alt="" src="${portrait(`player:${st.row.id}`, playerAppearance(st.row), st.row.player_name)}" />`;
  const c = st.chars.find((x) => x.id === id);
  if (!c) return '';
  return `<img class="av ${size} ${c.status !== 'alive' ? 'gone' : ''}" alt="" src="${portrait(c.id, charAppearance(c), c.name)}" />`;
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

function renderMessage(st: Story, m: Msg): string {
  switch (m.role) {
    case 'player':
      return `<div class="msg me"><div class="bubble">${esc(m.content)}</div></div>`;
    case 'character': {
      const c = st.chars.find((x) => x.id === m.speakerId);
      return `<div class="msg them">${c ? avatar(st, c.id) : '<span class="av sm blank"></span>'}<div><span class="speaker">${esc(c?.name ?? m.speakerName ?? '?')}</span><div class="bubble">${esc(m.content)}</div></div></div>`;
    }
    case 'event':
      return `<div class="event ${m.severity ?? 'minor'}">${m.title ? `<b>${esc(m.title)}:</b> ` : ''}${esc(m.content)}</div>`;
    case 'system':
      return `<div class="ending">☠ ${esc(m.content)}</div>`;
    case 'scene':
      return `<figure class="scene"><div class="scene-art">${(m.scene?.ids ?? []).map((id) => avatar(st, id, 'lg')).join('')}</div><figcaption><b>${esc(m.scene?.location ?? '')}</b><span class="faint small">Szenenkarte</span></figcaption></figure>`;
    default: {
      if (m.pending) return `<div class="narr pending"><p class="muted">Die Geschichte entwickelt sich … <button class="btn ghost small" data-act="stop">Stopp</button></p></div>`;
      const r = m.resolution;
      const tone = r ? (r.tier.includes('success') ? 'good' : r.tier === 'partial' ? 'warn' : 'bad') : '';
      const changes = r
        ? Object.entries(r.changes)
            .filter(([, v]) => v)
            .map(([k, v]) => `<span class="delta ${(k === 'heat' ? v! < 0 : v! > 0) ? 'up' : 'down'}">${esc(statLabel(k))} ${v! > 0 ? '+' : ''}${v}</span>`)
            .join('')
        : '';
      const evaluation = m.evaluation?.length
        ? `<details class="eval"><summary>${m.evaluation
            .map((x) => `<span class="delta ${(x.stat === 'heat' ? x.change < 0 : x.change > 0) ? 'up' : 'down'}">${esc(statLabel(x.stat))} ${x.change > 0 ? '+' : ''}${x.change}</span>`)
            .join('')}<span class="faint small">Warum?</span></summary><ul>${m.evaluation.map((x) => `<li><b>${esc(statLabel(x.stat))}:</b> ${esc(x.reason)}</li>`).join('')}</ul></details>`
        : '';
      return `<div class="narr">${r ? `<div class="res ${tone}"><b>${esc(t.lifeTiers[r.tier])} · Chance ${Math.round(r.chance * 100)} %</b>${changes}</div>` : ''}${paragraphs(m.content)}${evaluation}</div>`;
    }
  }
}

function renderStatus(st: Story): string {
  const s = st.row;
  const stats = statsOf(s);
  const last = worldOf(s).lastChanges ?? {};
  const promises = st.memories.filter((m) => m.kind === 'promise');
  const assets = parse<string[]>(s.assets, []);
  return `<section class="card stack-sm"><h2 class="label">Deine Werte</h2>
    ${statKeysOf(s)
      .map((k) => {
        const v = stats[k] ?? 0;
        const d = last[k] ?? 0;
        const up = INVERTED.includes(k) ? d < 0 : d > 0;
        return `<div class="meter-row"><span>${esc(statLabel(k))}</span><span class="bar ${meterTone(k, v)}"><i style="width:${v}%"></i></span><b>${v}${d ? `<span class="delta ${up ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</b></div>`;
      })
      .join('')}
    <p class="faint small">${st.mode === 'ai' ? 'Die KI bewertet jede Handlung getrennt von der Erzählung und passt die Werte an (je höchstens ±15).' : 'Das Spielsystem berechnet die Werte – sie beeinflussen Erfolgschancen und wie Figuren reagieren.'}</p>
    ${assets.length ? `<h3 class="label">Besitz</h3><div class="chips">${assets.map((a) => `<span class="tag">${esc(a)}</span>`).join('')}</div>` : ''}
    ${st.summary ? `<h3 class="label">Bisher geschah</h3><p class="small">${esc(st.summary)}</p>` : ''}
    ${st.threads?.length ? `<h3 class="label">Offene Handlungsstränge</h3><ul class="list">${st.threads.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${promises.length ? `<h3 class="label">Offene Versprechen</h3><ul class="list">${promises.map((p) => `<li>${esc(p.content)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function bar(label: string, v: number, min = 0): string {
  const pct = ((v - min) / (100 - min)) * 100;
  const tone = min < 0 ? (v <= -25 ? 'bad' : v >= 25 ? 'good' : 'warn') : 'ok';
  return `<div class="meter-row compact"><span>${label}</span><span class="bar ${tone}"><i style="width:${Math.max(2, pct)}%"></i></span><b>${v}</b></div>`;
}

function renderPeople(st: Story): string {
  return `<section class="card stack-sm"><h2 class="label">Figuren und Beziehungen</h2>${st.chars
    .map((c) => {
      const out = c.status !== 'alive';
      return `<div class="person ${out ? 'out' : ''}"><div class="row">${avatar(st, c.id, 'md')}<div class="grow"><strong>${esc(c.name)}</strong><span class="muted small block">${esc(c.role)}</span>
        <span class="tag stance-${c.stance}">${esc(stanceLabel(c.stance))}</span>${out ? ` <span class="pill bad">${esc((t.lifeStatuses as Record<string, string>)[c.status])}</span>` : ''}</div></div>
        ${out ? '' : bar('Zuneigung', c.affinity, -100) + bar('Vertrauen', c.trust) + bar('Loyalität', c.loyalty) + (c.fear > 0 ? bar('Furcht', c.fear) : '')}</div>`;
    })
    .join('')}</section>`;
}

function renderEvents(st: Story): string {
  return `<section class="card stack-sm"><h2 class="label">Ereignisse</h2>${
    st.events.length
      ? `<ol class="timeline">${st.events.map((e) => `<li class="${e.severity}"><span class="faint small">Tag ${e.day}</span><strong>${esc(e.title)}</strong><span class="muted small">${esc(e.description)}</span></li>`).join('')}</ol>`
      : '<p class="faint small">Noch keine besonderen Ereignisse.</p>'
  }</section>`;
}

function renderMemory(st: Story): string {
  const q = keywordsOf(memoryQuery);
  const known = st.memories.filter((m) => knows(m, PLAYER));
  const list = (q.length ? known.filter((m) => q.some((w) => keywordsOf(m.content).includes(w))) : known).sort((a, b) => Number(b.critical) - Number(a.critical) || b.turn - a.turn).slice(0, 120);
  const name = (k: string) => (k === EVERYONE ? 'alle' : k === PLAYER ? 'du' : (st.chars.find((c) => c.id === k)?.name ?? '?'));
  return `<section class="card stack-sm"><h2 class="label">Was du weißt</h2>
    <p class="faint small">Das Gedächtnis der Geschichte aus deiner Sicht. Kritische Fakten gibt die Erzählung bei jedem Zug mit.</p>
    <input id="memory-q" type="search" placeholder="Erinnerungen durchsuchen" value="${esc(memoryQuery)}" />
    ${list.length ? `<ul class="memories">${list.map((m) => `<li class="${m.critical ? 'critical' : ''}"><span class="row small"><span class="tag">${esc((t.lifeMemoryKinds as Record<string, string>)[m.kind] ?? m.kind)}</span>${m.critical ? '<span class="pill bad">kritisch</span>' : ''}<span class="faint">Zug ${m.turn}</span></span><span>${esc(m.content)}</span><span class="faint small">Bekannt: ${esc(m.knownBy.map(name).join(', '))}</span></li>`).join('')}</ul>` : '<p class="faint small">Keine passenden Erinnerungen.</p>'}
  </section>`;
}

function renderStory(st: Story, v: Extract<View, { name: 'story' }>): string {
  const s = st.row;
  const ended = s.status === 'ended';
  const busy = busyStory === s.id;
  const lastNarr = [...st.messages].reverse().find((m) => m.role === 'narrator');
  const suggestions = ended || busy || lastNarr?.pending ? [] : (lastNarr?.suggestions ?? []);
  const messages = showAllMessages ? st.messages : st.messages.slice(-80);
  const tabs: [Tab, string][] = [
    ['story', 'Geschichte'],
    ['status', 'Status'],
    ['people', 'Figuren'],
    ['events', 'Ereignisse'],
    ['memory', 'Gedächtnis'],
  ];
  const kindIcon: Record<string, string> = { smart: '💡', alternative: '🧭', risky: '⚡', surprising: '🔀' };
  const body =
    v.tab === 'story'
      ? `<div class="feed" id="feed">${st.messages.length > messages.length ? '<button class="btn ghost small center-btn" data-act="older">Ältere Nachrichten zeigen</button>' : ''}${messages.map((m) => renderMessage(st, m)).join('')}</div>
        ${
          ended
            ? `<div class="card ended-card stack-sm"><strong>Diese Geschichte ist beendet</strong><span class="muted small">Der Tod ist endgültig – es gibt keine Wiederbelebung.</span><button class="btn primary" data-act="new">Neues Leben beginnen</button></div>`
            : `<div class="dock">
                ${aiNotice ? `<p class="note warn">${esc(aiNotice)}</p>` : ''}
                ${st.direction ? `<p class="faint small">🎬 Regie: ${esc(trunc(st.direction, 120))}</p>` : ''}
                <div class="sugg">${suggestions
                  .map((x) => `<button class="sg ${x.kind}" data-act="suggest" data-sid="${esc(x.id)}"><span class="k">${kindIcon[x.kind] ?? ''} ${esc(t.lifeKinds[x.kind])}</span><span>${esc(x.text)}</span></button>`)
                  .join('')}</div>
              <form class="composer" data-form="act"><textarea id="act-text" rows="1" maxlength="600" placeholder="Was tust du?" aria-label="Deine Handlung" ${busy ? 'disabled' : ''}>${esc(pendingDraftText)}</textarea><button class="btn primary" aria-label="Handeln" ${busy ? 'disabled' : ''}>➤</button></form></div>`
        }`
      : v.tab === 'status'
        ? renderStatus(st)
        : v.tab === 'people'
          ? renderPeople(st)
          : v.tab === 'events'
            ? renderEvents(st)
            : renderMemory(st);
  return `
  <header class="top story-top">
    <button class="icon" data-act="home" aria-label="Zurück">←</button>
    <div class="grow min0"><strong class="ellipsis block">${esc(s.title)}</strong><span class="faint small ellipsis block">Tag ${s.day} · Zug ${s.turn}${s.location ? ` · ${esc(s.location)}` : ''}${st.mode === 'ai' ? '' : ' · regelbasiert'}</span></div>
    <button class="icon" data-act="direction" ${ended ? 'disabled' : ''} aria-label="Regie" title="Regie: Richtung vorgeben">🎬</button>
    <button class="icon" data-act="advance" ${ended || busy ? 'disabled' : ''} aria-label="Zeit vergehen lassen" title="Zeit vergehen lassen">⏩</button>
    <button class="icon" data-act="ask-delete" aria-label="Geschichte löschen" title="Geschichte löschen">🗑</button>
  </header>
  ${v.confirmDelete ? `<div class="confirm"><span>„${esc(s.title)}“ endgültig löschen?</span><button class="btn danger small" data-act="delete">Löschen</button><button class="btn ghost small" data-act="cancel-delete">Abbrechen</button></div>` : ''}
  ${
    v.direction
      ? `<form class="direction" data-form="direction"><label class="field"><span>Regie: Wohin soll sich die Geschichte entwickeln?</span><textarea id="direction-text" rows="3" maxlength="500" placeholder="z. B. Ich will, dass Viktor sich als Verräter entpuppt und Lucia und ich uns näherkommen.">${esc(st.direction ?? '')}</textarea></label>
        ${st.mode === 'ai' ? `<label class="check"><input type="checkbox" id="quick" ${st.quick ? 'checked' : ''} /> Schnelle Antworten (kürzer nachgedacht)</label>` : ''}
        <div class="row"><button class="btn primary small">Übernehmen</button><button type="button" class="btn ghost small" data-act="close-direction">Schließen</button></div></form>`
      : ''
  }
  <nav class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${v.tab === id}" data-act="tab" data-tab="${id}">${label}</button>`).join('')}</nav>
  <main class="wrap story-main ${v.tab}">${body}</main>`;
}

function render(): void {
  const active = document.activeElement as HTMLElement | null;
  const focusId = active?.id;
  if (view.name === 'home') app.innerHTML = renderHome();
  else if (view.name === 'setup') {
    if (!state.setup) {
      view = { name: 'home' };
      return render();
    }
    app.innerHTML = renderSetup(view);
    if (view.tab === 'talk') document.querySelector('.feed')?.lastElementChild?.scrollIntoView({ block: 'end' });
  } else {
    const v = view;
    const st = state.stories.find((x) => x.row.id === v.id);
    if (!st) {
      view = { name: 'home' };
      return render();
    }
    app.innerHTML = renderStory(st, v);
    if (v.tab === 'story') document.getElementById('feed')?.lastElementChild?.scrollIntoView({ block: 'end' });
  }
  if (focusId) document.getElementById(focusId)?.focus();
}

function currentStory(): Story | undefined {
  return view.name === 'story' ? state.stories.find((x) => x.row.id === (view as { id: string }).id) : undefined;
}

function playAction(st: Story, text?: string, suggestion?: LifeSuggestion): void {
  if (busyStory || st.row.status === 'ended') return;
  pendingDraftText = '';
  if (st.mode === 'ai') {
    void aiTurn(st, 'turn', clean(suggestion?.text ?? text ?? '').slice(0, 600));
    return;
  }
  takeTurn(st, { text, suggestion });
  save();
  render();
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const st = currentStory();
  switch (act) {
    case 'home':
      view = { name: 'home' };
      showAllMessages = false;
      aiNotice = '';
      break;
    case 'new':
      state.setup = { history: [], premise: '', raw: null, draft: null, statsEdited: false };
      setupNotice = '';
      pendingSetupText = '';
      save();
      view = { name: 'setup', tab: 'talk' };
      break;
    case 'resume-setup':
      view = { name: 'setup', tab: 'talk' };
      break;
    case 'setup-tab':
      if (view.name === 'setup') view = { name: 'setup', tab: el.dataset.tab as 'talk' | 'draft' };
      break;
    case 'example':
      pendingSetupText = EXAMPLES[Number(el.dataset.i)][1];
      break;
    case 'auto-stats': {
      const su = state.setup;
      if (su?.draft) {
        const fresh = su.raw && !su.aiOff ? toDraft(su.raw, su.premise) : initialStatsDraft(su.draft, su.premise);
        su.draft.stats = fresh.stats;
        su.draft.statKeys = fresh.statKeys;
        su.statsEdited = false;
        save();
      }
      break;
    }
    case 'add-char':
      state.setup?.draft?.characters.push({ name: '', role: '', description: '', personality: [], goals: [], secrets: [], stance: 'neutral', affinity: 0, trust: 35, loyalty: 20, fear: 0 } as LifeSetupCharacter);
      save();
      break;
    case 'del-char':
      state.setup?.draft?.characters.splice(Number(el.dataset.i), 1);
      save();
      break;
    case 'start':
      startFromSetup();
      return;
    case 'open':
      view = { name: 'story', id: el.dataset.id!, tab: 'story' };
      showAllMessages = false;
      aiNotice = '';
      break;
    case 'tab':
      if (view.name === 'story') view = { ...view, tab: el.dataset.tab as Tab };
      break;
    case 'suggest':
      if (st) {
        const last = [...st.messages].reverse().find((m) => m.role === 'narrator');
        const sg = last?.suggestions?.find((x) => x.id === el.dataset.sid);
        if (sg) playAction(st, undefined, sg);
      }
      return;
    case 'advance':
      if (st && !busyStory) {
        if (st.mode === 'ai') void aiTurn(st, 'time', '');
        else {
          advanceTime(st);
          save();
        }
      }
      break;
    case 'stop':
      busyController?.abort();
      return;
    case 'direction':
      if (view.name === 'story') view = { ...view, direction: !view.direction };
      break;
    case 'close-direction':
      if (view.name === 'story') view = { ...view, direction: false };
      break;
    case 'older':
      showAllMessages = true;
      break;
    case 'ask-delete':
      if (view.name === 'story') view = { ...view, confirmDelete: true };
      break;
    case 'cancel-delete':
      if (view.name === 'story') view = { ...view, confirmDelete: false };
      break;
    case 'delete':
      if (st) {
        state.stories = state.stories.filter((x) => x !== st);
        save();
        view = { name: 'home' };
      }
      break;
    default:
      return;
  }
  render();
});

function initialStatsDraft(d: LifeSetupDraft, premise: string): { stats: LifeSetupDraft['stats']; statKeys: LifeStat[] } {
  return initialStats(d.archetype, premise, d.genres);
}

app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const d = state.setup?.draft;
  if (view.name === 'setup' && d) {
    if (el.dataset.draft) (d as unknown as Record<string, string>)[el.dataset.draft] = el.value;
    if (el.dataset.stat) {
      d.stats[el.dataset.stat as LifeStat] = Number(el.value);
      state.setup!.statsEdited = true;
      const b = el.nextElementSibling;
      if (b) b.textContent = el.value;
    }
    if (el.dataset.char !== undefined && el.dataset.f) (d.characters[Number(el.dataset.char)] as unknown as Record<string, string>)[el.dataset.f] = el.value;
    save();
  }
  if (el.id === 'setup-text') pendingSetupText = el.value;
  if (el.id === 'act-text') pendingDraftText = el.value;
  if (el.id === 'memory-q') {
    memoryQuery = el.value;
    const pos = el.selectionStart;
    render();
    const again = document.getElementById('memory-q') as HTMLInputElement | null;
    again?.setSelectionRange(pos, pos);
  }
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  const d = state.setup?.draft;
  if (view.name === 'setup' && d) {
    if (el.dataset.draft === 'archetype') d.archetype = el.value as LifeSetupDraft['archetype'];
    if (el.dataset.char !== undefined && el.dataset.f === 'stance') d.characters[Number(el.dataset.char)].stance = el.value as LifeSetupCharacter['stance'];
    save();
  }
});

function submitForm(kind: string | undefined): void {
  if (kind === 'setup') {
    const box = document.getElementById('setup-text') as HTMLTextAreaElement | null;
    const text = box?.value ?? '';
    if (!text.trim()) return;
    pendingSetupText = '';
    void sendSetupMessage(text);
    return;
  }
  const st = currentStory();
  if (!st) return;
  if (kind === 'direction') {
    st.direction = ((document.getElementById('direction-text') as HTMLTextAreaElement | null)?.value ?? '').trim().slice(0, 500);
    st.quick = Boolean((document.getElementById('quick') as HTMLInputElement | null)?.checked);
    if (view.name === 'story') view = { ...view, direction: false };
    save();
    render();
    return;
  }
  const box = document.getElementById('act-text') as HTMLTextAreaElement | null;
  if (!box || !box.value.trim()) return;
  playAction(st, box.value);
}

app.addEventListener('submit', (e) => {
  e.preventDefault();
  submitForm((e.target as HTMLFormElement).dataset.form);
});
app.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if ((el.id === 'act-text' || el.id === 'setup-text') && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitForm(el.id === 'act-text' ? 'act' : 'setup');
  }
});

// Spielstand bei einer neuen Version der Seite beibehalten (falls der Viewer das unterstützt).
interface Hot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ view }));
const start = (data: unknown) => {
  const v = (data as { view?: View } | undefined)?.view;
  if (v && (v.name !== 'story' || state.stories.some((s) => s.row.id === v.id)) && (v.name !== 'setup' || state.setup)) view = v;
  // Ein Zug, der beim Schließen noch lief, wird verworfen (kein hängender Platzhalter).
  for (const st of state.stories) st.messages = st.messages.filter((m) => !m.pending);
  render();
};
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
