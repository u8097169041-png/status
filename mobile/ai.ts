/**
 * KI-Erzähler der Handy-Version über die Claude-Funktion der Seite (Konto des Spielers, mit Zustimmung).
 * Vorbereitung: Gespräch, das einen Entwurf pflegt. Spiel: Erzählung, Bewertung der Werte, Figurenänderungen,
 * Fakten, Handlungsstränge und vier Handlungsmöglichkeiten – alles als geprüftes JSON.
 */
import { deriveAppearance, type Gender } from '../shared/appearance';
import { CHARACTER_STANCES, LIFE_GENRES, LIFE_STATS, type CharacterStance, type LifeGenre, type LifeSetupCharacter, type LifeSetupDraft, type LifeStat, type SuggestionKind } from '../shared/life';
import { detectArchetype, detectGenres, initialStats } from '../server/src/life/stats';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}
type SampleFn = ((input: string | Turn[], opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string | Turn[], opts?: Record<string, unknown>) => Promise<T>;
};
interface ClaudeWindow {
  claude?: { use: (name: string) => Promise<unknown> };
}

let samplePromise: Promise<SampleFn | null> | null = null;
/** Die Claude-Funktion der Seite – oder null, wenn diese Ansicht sie nicht anbietet. */
export function getSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    const c = (window as unknown as ClaudeWindow).claude;
    samplePromise = c ? (c.use('sample') as Promise<SampleFn | null>).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

export interface AiError {
  code: string;
  message?: string;
}
export const isAiError = (e: unknown): e is AiError => typeof e === 'object' && e !== null && 'code' in e;

/** Verständliche Meldung je Fehlercode. */
export function aiErrorText(e: unknown): string {
  const code = isAiError(e) ? e.code : 'upstream_error';
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return 'Die KI ist für diese Seite nicht freigegeben. Es geht regelbasiert weiter.';
    case 'rate_limited':
      return 'Gerade zu viele KI-Anfragen oder dein Claude-Kontingent ist erreicht. Bitte später erneut versuchen.';
    case 'session_expired':
      return 'Bitte bei Claude neu anmelden.';
    case 'refused':
      return 'Die KI hat diese Handlung abgelehnt. Formuliere sie bitte anders.';
    case 'invalid_json':
    case 'empty_completion':
      return 'Die Antwort der KI war unvollständig. Bitte erneut versuchen.';
    case 'cancelled':
      return 'Abgebrochen.';
    default:
      return 'Die KI hat gerade nicht geantwortet. Bitte erneut versuchen.';
  }
}
export const isPermanentAiError = (e: unknown) => isAiError(e) && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code);

/**
 * Liest den bisher gestreamten Text eines JSON-Feldes (z. B. "narration"), auch wenn die Antwort noch
 * unvollständig ist – so erscheint die Erzählung schon, während die KI schreibt.
 */
export function partialField(raw: string, field: string): string {
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(raw);
  if (!m) return '';
  let body = '';
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\') {
      if (i + 1 >= raw.length) break;
      body += ch + raw[i + 1];
      i++;
      continue;
    }
    if (ch === '"') break;
    body += ch;
  }
  // Unvollständige \u-Folge am Ende abschneiden, dann wie JSON entschlüsseln.
  body = body.replace(/\\u[0-9a-fA-F]{0,3}$/, '');
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    return body.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
}

const STAT_LIST = LIFE_STATS.join(', ');
const STANCE_LIST = CHARACTER_STANCES.join(', ');
const SAFETY = 'Alle Figuren sind fiktive Erwachsene. Reale Personen nur als klar fiktive Simulation. Keine sexuellen Inhalte, Gewalt nicht ausgeschmückt.';

// ---------- Vorbereitung ----------

export interface AiDraftRaw {
  title?: string;
  playerName?: string;
  playerRole?: string;
  playerGender?: string;
  setting?: string;
  location?: string;
  opening?: string;
  genre?: string;
  characters?: { name?: string; role?: string; description?: string; personality?: string[]; goal?: string; secret?: string; stance?: string; gender?: string; age?: number }[];
  stats?: Record<string, number>;
  threads?: string[];
  assets?: string[];
}

const SETUP_RULES = `Du bereitest mit dem Spieler eine interaktive, zusammenhängende Lebensgeschichte vor (Deutsch).
Der Spieler beschreibt nach und nach Hintergrund, seine Rolle, Figuren, Beziehungen und die Ausgangssituation.
Deine Aufgabe in jeder Antwort:
1. "reply": kurz (2-5 Sätze) sagen, was du verstanden hast, und 1-2 gezielte Rückfragen oder Vorschläge machen, die die Geschichte reicher machen. Sag am Ende, dass er mit "Passt – starten" beginnen kann, wenn alles stimmt.
2. "draft": den VOLLSTÄNDIGEN aktuellen Entwurf zurückgeben – baue auf dem bisherigen Entwurf auf, übernimm alle Wünsche und alle genannten Personen des Spielers (beliebig viele), erfinde Fehlendes passend dazu (ruhig einige Nebenfiguren, die die Welt lebendig machen; insgesamt höchstens 25 Figuren).
Startwerte ("stats", 0-100): wähle 6-10 passende aus [${STAT_LIST}], "health" immer. Sie folgen aus Rolle und Lage (ein gefürchteter Mafiaboss: hohe Macht und Autorität; eine verschuldete Kassiererin: wenig Vermögen, keine Macht). "heat" = Aufmerksamkeit von Polizei/Feinden (hoch = gefährlich). Hat der Spieler Werte genannt, übernimm sie.
"stance" je Figur aus [${STANCE_LIST}] (Haltung zur Spielfigur). "threads": 2-4 offene Handlungsstränge zum Start. "genre" aus [${LIFE_GENRES.join(', ')}].
${SAFETY}
Antworte NUR mit JSON: {"reply": string, "draft": {"title","playerName","playerRole","playerGender":"female|male|diverse","setting","location","opening","genre","characters":[{"name","role","description","personality":[string],"goal","secret","stance","gender","age"}],"stats":{"health":80,...},"threads":[string],"assets":[string]}}`;

export async function aiSetupTurn(sample: SampleFn, history: Turn[], current: AiDraftRaw | null, onReply?: (text: string) => void): Promise<{ reply: string; draft: AiDraftRaw }> {
  const lead: Turn = { role: 'user', content: `${SETUP_RULES}\n\nBisheriger Entwurf: ${current ? JSON.stringify(current) : '(noch keiner)'}\n\nJetzt beginnt das Gespräch.` };
  const turns: Turn[] = [lead, { role: 'assistant', content: 'Verstanden. Beschreibe deine Geschichte.' }, ...history.slice(-12)];
  const res = await sample.json<{ reply?: unknown; draft?: AiDraftRaw }>(turns, {
    cache: false,
    ...(onReply ? { onText: ({ text }: { text: string }) => onReply(partialField(text, 'reply')) } : {}),
  });
  if (!res || typeof res !== 'object' || typeof res.reply !== 'string' || !res.draft || typeof res.draft !== 'object') throw { code: 'invalid_json' };
  return { reply: res.reply.slice(0, 1500), draft: res.draft };
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const asGender = (g: unknown): Gender | null => (g === 'female' || g === 'male' || g === 'diverse' ? g : null);

/** KI-Entwurf in einen geprüften Entwurf umwandeln (Werte begrenzt, Haltungen gültig). */
export function toDraft(raw: AiDraftRaw, premise: string): LifeSetupDraft {
  const role = str(raw.playerRole, 80) || 'ganz normaler Mensch';
  const archetype = detectArchetype(role, premise);
  const aiGenre = LIFE_GENRES.find((g) => g === raw.genre) as LifeGenre | undefined;
  const genres = [...new Set([...(aiGenre ? [aiGenre] : []), ...detectGenres(premise, archetype)])].slice(0, 3);
  const base = initialStats(archetype, premise, genres);
  const aiKeys = Object.keys(raw.stats ?? {}).filter((k): k is LifeStat => (LIFE_STATS as readonly string[]).includes(k));
  const statKeys: LifeStat[] = aiKeys.length >= 3 ? [...new Set<LifeStat>(['health', ...aiKeys])] : base.statKeys;
  const stats = Object.fromEntries(
    statKeys.map((k) => {
      const v = Number(raw.stats?.[k]);
      return [k, Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : (base.stats[k] ?? (k === 'health' ? 85 : 40))];
    }),
  );
  const playerName = str(raw.playerName, 60) || 'Alex Berger';
  const characters: LifeSetupCharacter[] = (Array.isArray(raw.characters) ? raw.characters : [])
    .map((c) => {
      const name = str(c?.name, 50);
      const stance = (CHARACTER_STANCES as readonly string[]).includes(String(c?.stance)) ? (c!.stance as CharacterStance) : 'neutral';
      const d = STANCE_START[stance];
      const age = Number(c?.age);
      return {
        name,
        role: str(c?.role, 80),
        description: str(c?.description, 300),
        personality: (Array.isArray(c?.personality) ? c!.personality : []).map((p) => str(p, 30)).filter(Boolean).slice(0, 4),
        goals: str(c?.goal, 160) ? [str(c?.goal, 160)] : [],
        secrets: str(c?.secret, 200) ? [str(c?.secret, 200)] : [],
        stance,
        ...d,
        appearance: deriveAppearance(`char:${name}`, { role: str(c?.role, 80), gender: asGender(c?.gender), age: Number.isFinite(age) ? Math.max(18, Math.min(95, Math.round(age))) : null }),
      };
    })
    .filter((c) => c.name && c.name.toLowerCase() !== playerName.toLowerCase())
    .slice(0, MAX_CHARS);
  return {
    title: str(raw.title, 80) || `${playerName} – ${role}`,
    premise: premise.slice(0, 8000),
    genres: genres.length ? genres : ['drama'],
    archetype,
    playerName,
    playerRole: role,
    playerAppearance: deriveAppearance(`player:${playerName}:${role}`, { role, gender: asGender(raw.playerGender) }),
    setting: str(raw.setting, 600),
    location: str(raw.location, 80),
    locations: str(raw.location, 80) ? [str(raw.location, 80)] : [],
    organizations: [],
    rules: [],
    opening: str(raw.opening, 800),
    characters,
    relations: [],
    stats,
    statKeys,
    assets: (Array.isArray(raw.assets) ? raw.assets : []).map((a) => str(a, 60)).filter(Boolean).slice(0, 8),
    source: 'ai',
  };
}

export const MAX_CHARS = 60;

export const STANCE_START: Record<CharacterStance, { affinity: number; trust: number; loyalty: number; fear: number }> = {
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

// ---------- Spiel ----------

export interface StoryContext {
  title: string;
  premise: string;
  setting: string;
  player: { name: string; role: string };
  day: number;
  location: string;
  stats: { stat: string; label: string; value: number }[];
  characters: { name: string; role: string; stance: string; status: string; affinity: number; trust: number; loyalty: number; fear: number; goal: string; secret: string; personality: string; detailed: boolean }[];
  summary: string;
  threads: string[];
  facts: string[];
  direction: string;
  recent: string[];
  action: string;
  mode: 'opening' | 'turn' | 'time';
}

export interface NewCharacter {
  name: string;
  role: string;
  description: string;
  stance: CharacterStance;
  gender: Gender | null;
  age: number | null;
  personality: string[];
  goal: string;
  secret: string;
}

export interface AiTurnResult {
  narration: string;
  scene: string;
  newCharacters: NewCharacter[];
  dialogue: { speaker: string; text: string }[];
  outcome: 'success' | 'partial' | 'failure' | 'none';
  stats: { stat: LifeStat; change: number; reason: string }[];
  characters: { name: string; affinity: number; trust: number; loyalty: number; fear: number; status: string | null; note: string }[];
  facts: { text: string; critical: boolean }[];
  threads: string[];
  summary: string;
  location: string;
  present: string[];
  days: number;
  suggestions: { kind: SuggestionKind; text: string }[];
}

const STORY_RULES = `Du bist Erzähler und spielst alle Nebenfiguren einer fortlaufenden, zusammenhängenden Lebensgeschichte. Schreibe auf Deutsch und sprich die Spielfigur mit "du" an.
Tempo und Erzählweise:
- Erzähle zügig und offen: pro Zug 1-3 kurze, dichte Absätze. Überspringe Belangloses, fasse Wartezeiten zusammen.
- Wechsle Szenen, Orte und Zeitpunkte, sobald eine Szene ihren Zweck erfüllt hat ("Am nächsten Morgen …", "Zwei Wochen später …"). Ein Zug darf mehrere Ereignisse umfassen. Gib jeder neuen Szene einen kurzen Titel in "scene" (sonst leer).
- Wenn der Spieler eine Szene, einen Ort oder einen Zeitsprung beschreibt, setze ihn direkt um.
Zusammenhang:
- Baue auf "Bisher geschah", offenen Handlungssträngen, Fakten und den letzten Nachrichten auf. Keine Widersprüche, keine Wiederholungen.
- Treibe die Geschichte spürbar voran; greife Handlungsstränge auf, schließe sie ab, eröffne neue.
- Figuren handeln nach eigenen Zielen; sie können ablehnen, lügen, verraten, überraschen. Tote, verschwundene oder inhaftierte Figuren handeln nicht. Nicht alles gelingt.
- "Regie" ist der Wunsch des Spielers für die Richtung: lenke glaubwürdig dorthin.
Figuren:
- Die Welt ist offen: Spricht der Spieler eine Person an, die noch nicht existiert, oder beschreibt er jemanden, oder braucht die Geschichte eine neue Figur, lege sie in "newCharacters" an (mit Rolle, kurzer Beschreibung, Haltung zur Spielfigur, Geschlecht, Alter, Art, Ziel, optional Geheimnis). Übernimm, was der Spieler über sie sagt. Bereits bekannte Figuren nie neu anlegen.
- ${SAFETY}
Bewertung (getrennt von der Erzählung): nur betroffene Werte, je -15 bis +15, mit kurzer Begründung. Sinkt "health" auf 0, stirbt die Spielfigur endgültig – nur wenn es aus dem Geschehen folgt.
Figurenänderungen: nur betroffene bekannte Figuren, Zuneigung/Vertrauen/Loyalität/Furcht je -25 bis +25, optional neuer Status (alive, dead, missing, imprisoned, gone).
Vier nächste Handlungsmöglichkeiten: konkrete Dinge, die die Spielfigur jetzt tun kann – gern auch ein Szenen- oder Zeitwechsel (max. 14 Wörter), je eine Art: "smart", "alternative", "risky", "surprising". Sie beziehen sich auf die Situation, nicht auf Werte.
"summary": "Bisher geschah" aktualisiert, höchstens 140 Wörter. "threads": offene Handlungsstränge (max. 5). "facts": neue wichtige Fakten, "critical": true für Unvergessliches.
Antworte NUR mit JSON in genau dieser Reihenfolge (die Erzählung zuerst):
{"narration": "...", "scene": "", "dialogue": [{"speaker": "Name", "text": "..."}], "newCharacters": [{"name": "...", "role": "...", "description": "...", "stance": "neutral", "gender": "female", "age": 30, "personality": ["..."], "goal": "...", "secret": ""}], "outcome": "success|partial|failure|none", "stats": [{"stat": "power", "change": -5, "reason": "..."}], "characters": [{"name": "...", "affinity": 0, "trust": 0, "loyalty": 0, "fear": 0, "status": "alive", "note": ""}], "facts": [{"text": "...", "critical": false}], "threads": ["..."], "summary": "...", "location": "...", "present": ["Namen"], "days_passed": 0, "suggestions": [{"kind": "smart", "text": "..."}]}`;

function contextText(c: StoryContext): string {
  const lines = [
    `## Geschichte: ${c.title}`,
    c.premise.slice(0, 1500),
    `Schauplatz: ${c.setting.slice(0, 300)} · Tag ${c.day} · Aktueller Ort: ${c.location || 'unbekannt'}`,
    `## Spielfigur: ${c.player.name}, ${c.player.role}`,
    `Werte (0-100): ${c.stats.map((s) => `${s.label} (${s.stat}) ${s.value}`).join(', ')}`,
    '## Figuren (ausführlich: anwesend oder wichtig)',
    ...c.characters.filter((x) => x.detailed).map(
      (x) =>
        `- ${x.name} (${x.role}) – Haltung: ${x.stance}, Status: ${x.status}, Zuneigung ${x.affinity}, Vertrauen ${x.trust}, Loyalität ${x.loyalty}, Furcht ${x.fear}. ${x.personality ? `Art: ${x.personality}. ` : ''}${x.goal ? `Ziel: ${x.goal}. ` : ''}${x.secret ? `Geheimnis (nur Erzähler, nicht verraten, bis es im Spiel herauskommt): ${x.secret}` : ''}`,
    ),
    c.characters.some((x) => !x.detailed) ? `## Weitere bekannte Figuren\n${c.characters.filter((x) => !x.detailed).map((x) => `${x.name} (${x.role}, ${x.stance}${x.status !== 'alive' ? `, ${x.status}` : ''})`).join('; ')}` : '',
    `## Bisher geschah\n${c.summary || '(Die Geschichte beginnt.)'}`,
    `## Offene Handlungsstränge\n${c.threads.length ? c.threads.map((t) => `- ${t}`).join('\n') : '(noch keine)'}`,
    `## Wichtige Fakten\n${c.facts.length ? c.facts.map((f) => `- ${f}`).join('\n') : '(noch keine)'}`,
    c.direction ? `## Regie (Wunsch des Spielers für die Richtung)\n${c.direction}` : '',
    `## Letzte Nachrichten\n${c.recent.join('\n') || '(keine)'}`,
    c.mode === 'opening'
      ? '## Jetzt\nEröffne die Geschichte mit der Ausgangssituation: eine lebendige erste Szene, die die Handlungsstränge anlegt. "outcome": "none", keine Wertänderungen.'
      : c.mode === 'time'
        ? '## Jetzt\nSpringe in der Zeit nach vorn (Tage bis Wochen, passend zur Geschichte). Erzähle knapp, was in dieser Zeit passiert – Figuren handeln eigenständig, Handlungsstränge entwickeln sich weiter – und beginne dann eine neue Szene mit Titel. "days_passed" angeben (höchstens 30).'
        : `## Handlung des Spielers jetzt\n${c.action}`,
  ];
  return lines.filter(Boolean).join('\n');
}

const KINDS: SuggestionKind[] = ['smart', 'alternative', 'risky', 'surprising'];
const num = (v: unknown, lim: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : 0;
};

export async function aiStoryTurn(sample: SampleFn, ctx: StoryContext, quick: boolean, signal?: AbortSignal, onNarration?: (text: string) => void): Promise<AiTurnResult> {
  const raw = await sample.json<Record<string, unknown>>(`${STORY_RULES}\n\n${contextText(ctx)}`, {
    cache: false,
    modelTier: quick ? 'quick' : 'default',
    ...(signal ? { signal } : {}),
    ...(onNarration ? { onText: ({ text }: { text: string }) => onNarration(partialField(text, 'narration')) } : {}),
  });
  const narration = str(raw?.narration, 4000).length ? String(raw.narration).trim().slice(0, 4000) : '';
  if (!narration) throw { code: 'invalid_json' };
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const suggestions = KINDS.map((kind) => {
    const s = arr<{ kind?: unknown; text?: unknown }>(raw.suggestions).find((x) => x?.kind === kind && str(x.text, 160));
    return s ? { kind, text: str(s.text, 160) } : null;
  }).filter((s): s is { kind: SuggestionKind; text: string } => s !== null);
  const known = new Set(ctx.characters.map((c) => c.name.toLowerCase()));
  known.add(ctx.player.name.toLowerCase());
  const newCharacters: NewCharacter[] = arr<Record<string, unknown>>(raw.newCharacters)
    .map((c) => {
      const age = Math.round(Number(c?.age));
      return {
        name: str(c?.name, 50),
        role: str(c?.role, 80),
        description: str(c?.description, 300),
        stance: ((CHARACTER_STANCES as readonly string[]).includes(String(c?.stance)) ? c.stance : 'neutral') as CharacterStance,
        gender: asGender(c?.gender),
        age: Number.isFinite(age) ? Math.max(18, Math.min(95, age)) : null,
        personality: arr<unknown>(c?.personality).map((p) => str(p, 30)).filter(Boolean).slice(0, 4),
        goal: str(c?.goal, 160),
        secret: str(c?.secret, 200),
      };
    })
    .filter((c) => c.name && !known.has(c.name.toLowerCase()) && known.add(c.name.toLowerCase()))
    .slice(0, 6);
  return {
    narration,
    scene: str(raw.scene, 80),
    newCharacters,
    dialogue: arr<{ speaker?: unknown; text?: unknown }>(raw.dialogue)
      .map((d) => ({ speaker: str(d?.speaker, 60), text: str(d?.text, 600) }))
      .filter((d) => d.speaker && d.text)
      .slice(0, 4),
    outcome: (['success', 'partial', 'failure', 'none'] as const).find((o) => o === raw.outcome) ?? 'none',
    stats: arr<{ stat?: unknown; change?: unknown; reason?: unknown }>(raw.stats)
      .filter((s) => (LIFE_STATS as readonly string[]).includes(String(s?.stat)))
      .map((s) => ({ stat: s.stat as LifeStat, change: num(s.change, 15), reason: str(s.reason, 160) }))
      .filter((s) => s.change !== 0)
      .slice(0, 8),
    characters: arr<Record<string, unknown>>(raw.characters)
      .map((c) => ({
        name: str(c?.name, 60),
        affinity: num(c?.affinity, 25),
        trust: num(c?.trust, 25),
        loyalty: num(c?.loyalty, 25),
        fear: num(c?.fear, 25),
        status: ['alive', 'dead', 'missing', 'imprisoned', 'gone'].includes(String(c?.status)) ? String(c?.status) : null,
        note: str(c?.note, 160),
      }))
      .filter((c) => c.name)
      .slice(0, 8),
    facts: arr<{ text?: unknown; critical?: unknown }>(raw.facts)
      .map((f) => ({ text: str(f?.text, 300), critical: f?.critical === true }))
      .filter((f) => f.text)
      .slice(0, 4),
    threads: arr<unknown>(raw.threads).map((x) => str(x, 200)).filter(Boolean).slice(0, 5),
    summary: str(raw.summary, 1400),
    location: str(raw.location, 80),
    present: arr<unknown>(raw.present).map((x) => str(x, 60)).filter(Boolean).slice(0, 6),
    days: Math.max(0, Math.min(30, Math.round(Number(raw.days_passed) || 0))),
    suggestions,
  };
}
