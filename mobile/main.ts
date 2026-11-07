/**
 * SocialVerse Leben – eigenständige Handy-Version des Lebensmodus.
 * Nutzt dieselbe Spiellogik wie die App (Würfelsystem, Ereignisse, Vorschläge, regelbasierte Erzählung, Einrichtung).
 * Ohne Server: keine Sprach- oder Bild-KI; der Spielstand liegt im Browser (localStorage).
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
}
interface State {
  version: 1;
  stories: Story[];
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

function addScene(st: Story): void {
  const s = st.row;
  const present = new Set(presentOf(s));
  const ids = ['player', ...st.chars.filter((c) => c.status === 'alive' && present.has(c.id)).map((c) => c.id)].slice(0, 4);
  push(st, { turn: s.turn, role: 'scene', content: `Szene: ${s.location || worldOf(s).setting}`, scene: { location: s.location || worldOf(s).setting, ids } });
}

// ---------- Oberfläche ----------

type View = { name: 'home' } | { name: 'setup' } | { name: 'draft'; draft: LifeSetupDraft } | { name: 'story'; id: string; tab: Tab; confirmDelete?: boolean };
type Tab = 'story' | 'status' | 'people' | 'events' | 'memory';
let view: View = { name: 'home' };
let setupText = '';
let setupName = '';
let memoryQuery = '';
let showAllMessages = false;

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
      <p>${esc(t.life.intro)}</p>
      <button class="btn primary" data-act="new">+ Neue Geschichte</button>
    </section>
    ${
      list.length
        ? `<ul class="cards">${list
            .map((st) => {
              const s = st.row;
              const stats = statsOf(s);
              const keys = statKeysOf(s).filter((k) => k !== 'health').slice(0, 3);
              return `<li><button class="card story-card ${s.status}" data-act="open" data-id="${esc(s.id)}">
                <span class="row between"><span class="tag">${esc((t.lifeGenres as Record<string, string>)[genresOf(s)[0]] ?? '')}</span><span class="pill ${s.status === 'ended' ? 'bad' : 'good'}">${s.status === 'ended' ? 'Beendet' : 'Läuft'}</span></span>
                <strong class="story-title">${esc(s.title)}</strong>
                <span class="muted small">${esc(s.player_name)} – ${esc(s.player_role)}</span>
                <span class="faint small">Tag ${s.day} · Zug ${s.turn}${s.location ? ` · ${esc(s.location)}` : ''}</span>
                <span class="mini">${keys.map((k) => `<span>${esc(statLabel(k))} <b>${stats[k] ?? 0}</b></span>`).join('')}<span>♥ <b>${stats.health ?? 0}</b></span></span>
              </button></li>`;
            })
            .join('')}</ul>`
        : `<div class="empty"><strong>Noch keine Lebensgeschichte</strong><span class="muted">Starte mit einem der Beispiele oder deiner eigenen Beschreibung.</span></div>`
    }
    ${storageOk ? '' : '<p class="note warn">Der Browser erlaubt kein Speichern. Der Spielstand geht beim Schließen verloren.</p>'}
    <p class="faint small center">Handy-Version ohne KI: regelbasierte Erzählung, gezeichnete Porträts. Der Spielstand liegt nur in diesem Browser.</p>
  </main>`;
}

function renderSetup(): string {
  return `
  <header class="top"><button class="icon" data-act="home" aria-label="Zurück">←</button><strong>Neue Geschichte</strong><span></span></header>
  <main class="wrap stack">
    <p class="muted">${esc(t.life.setupIntro)}</p>
    <div class="chips">${EXAMPLES.map(([label], i) => `<button class="chip" data-act="example" data-i="${i}">${esc(label)}</button>`).join('')}</div>
    <label class="field"><span>Deine Geschichte</span>
      <textarea id="setup-text" rows="10" maxlength="6000" placeholder="${esc(t.life.promptPlaceholder)}">${esc(setupText)}</textarea>
    </label>
    <label class="field"><span>Name deiner Figur (optional)</span><input id="setup-name" maxlength="60" value="${esc(setupName)}" /></label>
    <p class="faint small">Tipp: Figuren als Liste angeben, z. B. „- Marco Bellini: meine rechte Hand“. Rolle und Startwerte bestimmt das Spielsystem.</p>
    <button class="btn primary" data-act="draft">Entwurf erstellen</button>
    <p id="setup-error" class="note warn" hidden></p>
  </main>`;
}

function renderDraft(d: LifeSetupDraft): string {
  return `
  <header class="top"><button class="icon" data-act="setup" aria-label="Zurück">←</button><strong>Entwurf prüfen</strong><span></span></header>
  <main class="wrap stack">
    <section class="card stack-sm">
      <label class="field"><span>Titel</span><input data-draft="title" maxlength="80" value="${esc(d.title)}" /></label>
      <label class="field"><span>Name deiner Figur</span><input data-draft="playerName" maxlength="60" value="${esc(d.playerName)}" /></label>
      <label class="field"><span>Rolle</span><input data-draft="playerRole" maxlength="80" value="${esc(d.playerRole)}" /></label>
      <label class="field"><span>Rollentyp</span><select data-draft="archetype">${LIFE_ARCHETYPES.map((a) => `<option value="${a}" ${a === d.archetype ? 'selected' : ''}>${esc((t.lifeArchetypes as Record<string, string>)[a])}</option>`).join('')}</select></label>
      <label class="field"><span>Ausgangssituation</span><textarea data-draft="opening" rows="2" maxlength="800">${esc(d.opening)}</textarea></label>
    </section>
    <section class="card stack-sm">
      <h2 class="label">Startwerte</h2>
      <p class="faint small">${esc(t.life.startValuesHint)}</p>
      ${d.statKeys
        .map(
          (k) => `<label class="meter-row"><span>${esc(statLabel(k))}</span><input type="range" min="0" max="100" data-stat="${k}" value="${d.stats[k] ?? 0}" /><b>${d.stats[k] ?? 0}</b></label>`,
        )
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
            <select data-char="${i}" data-f="stance">${CHARACTER_STANCES.map((s) => `<option value="${s}" ${s === c.stance ? 'selected' : ''}>${esc(stanceLabel(s))}</option>`).join('')}</select>
          </div>`,
        )
        .join('')}
    </section>
    <button class="btn primary" data-act="start">Geschichte starten</button>
  </main>`;
}

function avatar(st: Story, id: string, size = 'sm'): string {
  if (id === 'player') return `<img class="av ${size}" alt="" src="${portrait(`player:${st.row.id}`, playerAppearance(st.row), st.row.player_name)}" />`;
  const c = st.chars.find((x) => x.id === id);
  if (!c) return '';
  return `<img class="av ${size} ${c.status !== 'alive' ? 'gone' : ''}" alt="" src="${portrait(c.id, charAppearance(c), c.name)}" />`;
}

function renderMessage(st: Story, m: Msg): string {
  switch (m.role) {
    case 'player':
      return `<div class="msg me"><div class="bubble">${esc(m.content)}</div></div>`;
    case 'character': {
      const c = st.chars.find((x) => x.id === m.speakerId);
      return `<div class="msg them">${avatar(st, m.speakerId ?? '')}<div><span class="speaker">${esc(c?.name ?? '?')}</span><div class="bubble">${esc(m.content)}</div></div></div>`;
    }
    case 'event':
      return `<div class="event ${m.severity ?? 'minor'}">${m.title ? `<b>${esc(m.title)}:</b> ` : ''}${esc(m.content)}</div>`;
    case 'system':
      return `<div class="ending">☠ ${esc(m.content)}</div>`;
    case 'scene':
      return `<figure class="scene"><div class="scene-art">${(m.scene?.ids ?? []).map((id) => avatar(st, id, 'lg')).join('')}</div><figcaption><b>${esc(m.scene?.location ?? '')}</b><span class="faint small">Szenenkarte (ohne Bild-KI)</span></figcaption></figure>`;
    default: {
      const r = m.resolution;
      const tone = r ? (r.tier.includes('success') ? 'good' : r.tier === 'partial' ? 'warn' : 'bad') : '';
      const changes = r
        ? Object.entries(r.changes)
            .filter(([, v]) => v)
            .map(([k, v]) => `<span class="delta ${(k === 'heat' ? v! < 0 : v! > 0) ? 'up' : 'down'}">${esc(statLabel(k))} ${v! > 0 ? '+' : ''}${v}</span>`)
            .join('')
        : '';
      return `<div class="narr">${r ? `<div class="res ${tone}"><b>${esc(t.lifeTiers[r.tier])} · Chance ${Math.round(r.chance * 100)} %</b>${changes}</div>` : ''}<p>${esc(m.content)}</p></div>`;
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
    <p class="faint small">Das Spielsystem berechnet die Werte – sie beeinflussen Erfolgschancen und wie Figuren reagieren.</p>
    ${assets.length ? `<h3 class="label">Besitz</h3><div class="chips">${assets.map((a) => `<span class="tag">${esc(a)}</span>`).join('')}</div>` : ''}
    <h3 class="label">Offene Versprechen</h3>
    ${promises.length ? `<ul class="list">${promises.map((p) => `<li>${esc(p.content)}</li>`).join('')}</ul>` : '<p class="faint small">Keine offenen Versprechen.</p>'}
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
    <p class="faint small">${esc(t.life.memoryHint)}</p>
    <input id="memory-q" type="search" placeholder="Erinnerungen durchsuchen" value="${esc(memoryQuery)}" />
    ${list.length ? `<ul class="memories">${list.map((m) => `<li class="${m.critical ? 'critical' : ''}"><span class="row small"><span class="tag">${esc((t.lifeMemoryKinds as Record<string, string>)[m.kind] ?? m.kind)}</span>${m.critical ? '<span class="pill bad">kritisch</span>' : ''}<span class="faint">Zug ${m.turn}</span></span><span>${esc(m.content)}</span><span class="faint small">Bekannt: ${esc(m.knownBy.map(name).join(', '))}</span></li>`).join('')}</ul>` : '<p class="faint small">Keine passenden Erinnerungen.</p>'}
  </section>`;
}

function renderStory(st: Story, v: Extract<View, { name: 'story' }>): string {
  const s = st.row;
  const ended = s.status === 'ended';
  const lastNarr = [...st.messages].reverse().find((m) => m.role === 'narrator');
  const suggestions = ended ? [] : (lastNarr?.suggestions ?? []);
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
            : `<div class="dock"><div class="sugg">${suggestions
                .map((x) => `<button class="sg ${x.kind}" data-act="suggest" data-sid="${esc(x.id)}"><span class="k">${kindIcon[x.kind] ?? ''} ${esc(t.lifeKinds[x.kind])}</span><span>${esc(x.text)}</span></button>`)
                .join('')}</div>
              <form class="composer" data-form="act"><textarea id="act-text" rows="1" maxlength="600" placeholder="Was tust du? (frei formulieren)" aria-label="Deine Handlung"></textarea><button class="btn primary" aria-label="Handeln">➤</button></form></div>`
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
    <div class="grow min0"><strong class="ellipsis block">${esc(s.title)}</strong><span class="faint small ellipsis block">Tag ${s.day} · Zug ${s.turn}${s.location ? ` · ${esc(s.location)}` : ''}</span></div>
    <button class="icon" data-act="scene" ${ended ? 'disabled' : ''} aria-label="Szene festhalten" title="Szene festhalten">▣</button>
    <button class="icon" data-act="advance" ${ended ? 'disabled' : ''} aria-label="Zeit vergehen lassen" title="Zeit vergehen lassen">⏩</button>
    <button class="icon" data-act="ask-delete" aria-label="Geschichte löschen" title="Geschichte löschen">🗑</button>
  </header>
  ${v.confirmDelete ? `<div class="confirm"><span>„${esc(s.title)}“ endgültig löschen?</span><button class="btn danger small" data-act="delete">Löschen</button><button class="btn ghost small" data-act="cancel-delete">Abbrechen</button></div>` : ''}
  <nav class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${v.tab === id}" data-act="tab" data-tab="${id}">${label}</button>`).join('')}</nav>
  <main class="wrap story-main ${v.tab}">${body}</main>`;
}

function render(): void {
  const active = document.activeElement as HTMLElement | null;
  const focusId = active?.id;
  if (view.name === 'home') app.innerHTML = renderHome();
  else if (view.name === 'setup') app.innerHTML = renderSetup();
  else if (view.name === 'draft') app.innerHTML = renderDraft(view.draft);
  else {
    const v = view;
    const st = state.stories.find((x) => x.row.id === v.id);
    if (!st) {
      view = { name: 'home' };
      return render();
    }
    app.innerHTML = renderStory(st, v);
    if (v.tab === 'story') {
      const feed = document.getElementById('feed');
      feed?.lastElementChild?.scrollIntoView({ block: 'end' });
    }
  }
  if (focusId) document.getElementById(focusId)?.focus();
}

function currentStory(): Story | undefined {
  return view.name === 'story' ? state.stories.find((x) => x.row.id === (view as { id: string }).id) : undefined;
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
      break;
    case 'new':
    case 'setup':
      view = { name: 'setup' };
      break;
    case 'example':
      setupText = EXAMPLES[Number(el.dataset.i)][1];
      break;
    case 'draft': {
      setupText = (document.getElementById('setup-text') as HTMLTextAreaElement).value;
      setupName = (document.getElementById('setup-name') as HTMLInputElement).value;
      if (setupText.trim().length < 20) {
        const err = document.getElementById('setup-error')!;
        err.textContent = 'Beschreibe deine Geschichte etwas ausführlicher (mindestens ein bis zwei Sätze).';
        err.hidden = false;
        return;
      }
      view = { name: 'draft', draft: ruleDraftCore({ prompt: setupText, playerName: setupName.trim() || undefined }, 'de', []) };
      break;
    }
    case 'add-char':
      if (view.name === 'draft') view.draft.characters.push({ name: '', role: '', description: '', personality: [], goals: [], secrets: [], stance: 'neutral', affinity: 0, trust: 35, loyalty: 20, fear: 0 } as LifeSetupCharacter);
      break;
    case 'del-char':
      if (view.name === 'draft') view.draft.characters.splice(Number(el.dataset.i), 1);
      break;
    case 'start':
      if (view.name === 'draft') {
        const d = view.draft;
        if (!d.title.trim() || !d.playerName.trim() || !d.characters.some((c) => c.name.trim())) return;
        const story = createStory(d);
        state.stories.push(story);
        save();
        setupText = '';
        setupName = '';
        view = { name: 'story', id: story.row.id, tab: 'story' };
      }
      break;
    case 'open':
      view = { name: 'story', id: el.dataset.id!, tab: 'story' };
      showAllMessages = false;
      break;
    case 'tab':
      if (view.name === 'story') view = { ...view, tab: el.dataset.tab as Tab };
      break;
    case 'suggest':
      if (st) {
        const last = [...st.messages].reverse().find((m) => m.role === 'narrator');
        const sg = last?.suggestions?.find((x) => x.id === el.dataset.sid);
        if (sg) takeTurn(st, { suggestion: sg });
        save();
      }
      break;
    case 'advance':
      if (st) {
        advanceTime(st);
        save();
      }
      break;
    case 'scene':
      if (st) {
        addScene(st);
        save();
      }
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

app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (view.name === 'draft') {
    const d = view.draft;
    if (el.dataset.draft) (d as unknown as Record<string, string>)[el.dataset.draft] = el.value;
    if (el.dataset.stat) {
      d.stats[el.dataset.stat as LifeStat] = Number(el.value);
      const b = el.nextElementSibling;
      if (b) b.textContent = el.value;
    }
    if (el.dataset.char !== undefined && el.dataset.f) (d.characters[Number(el.dataset.char)] as unknown as Record<string, string>)[el.dataset.f] = el.value;
  }
  if (el.id === 'memory-q') {
    memoryQuery = el.value;
    const pos = el.selectionStart;
    render();
    const again = document.getElementById('memory-q') as HTMLInputElement | null;
    again?.setSelectionRange(pos, pos);
  }
  if (el.id === 'setup-text') setupText = el.value;
  if (el.id === 'setup-name') setupName = el.value;
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (view.name !== 'draft') return;
  if (el.dataset.draft === 'archetype') view.draft.archetype = el.value as LifeSetupDraft['archetype'];
  if (el.dataset.char !== undefined && el.dataset.f === 'stance') view.draft.characters[Number(el.dataset.char)].stance = el.value as LifeSetupCharacter['stance'];
});

function submitAction(): void {
  const st = currentStory();
  const box = document.getElementById('act-text') as HTMLTextAreaElement | null;
  if (!st || !box || !box.value.trim()) return;
  takeTurn(st, { text: box.value });
  save();
  render();
}

app.addEventListener('submit', (e) => {
  e.preventDefault();
  submitAction();
});
app.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (el.id === 'act-text' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitAction();
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
  if (v && (v.name !== 'story' || state.stories.some((s) => s.row.id === v.id))) view = v;
  render();
};
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
