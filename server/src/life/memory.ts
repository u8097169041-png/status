/**
 * Gedächtnis der Lebenssimulation – mehrere Ebenen in einer strukturierten Datenbank statt im KI-Kontext:
 * - Kurzzeit: die letzten Nachrichten (life_messages)
 * - Langzeit: wichtige Ereignisse, Entscheidungen, Versprechen, Konflikte (life_memories)
 * - Figuren/Beziehungen: Steckbriefe und Werte (life_characters, life_relations) plus Erinnerungen mit Bezug
 * - Welt: Orte, Organisationen, Regeln (life_stories.world) plus Welt-Erinnerungen
 * - Spielerstatus: Werte, Besitz, offene Versprechen (life_stories)
 *
 * Kritische Fakten (Tod, Verrat, Versprechen, unumkehrbare Entscheidungen) werden nie zusammengefasst oder verdrängt.
 * Jede Erinnerung hat Wissende (`known_by`): Figuren kennen nur, was sie erlebt oder erfahren haben.
 */
import type { LifeMemoryDto } from '../../../shared/life';
import type { AppContext } from '../context';
import { all, get, parseJson, run } from '../db/database';
import { newId } from '../lib/ids';

export const EVERYONE = '*';
export const PLAYER = 'player';

export type MemoryKind =
  | 'setup'
  | 'event'
  | 'decision'
  | 'promise'
  | 'betrayal'
  | 'death'
  | 'secret'
  | 'relationship'
  | 'fact'
  | 'location'
  | 'organization'
  | 'summary';

export interface MemoryInput {
  kind: MemoryKind;
  content: string;
  importance: number;
  critical?: boolean;
  subjects?: string[];
  knownBy?: string[];
  turn: number;
  source: 'engine' | 'ai' | 'player' | 'summary' | 'setup';
}

export interface MemoryRow {
  id: string;
  story_id: string;
  turn: number;
  kind: MemoryKind;
  content: string;
  importance: number;
  critical: number;
  subjects: string;
  known_by: string;
  keywords: string;
  source: string;
  created_at: string;
}

const STOPWORDS = new Set(
  (
    'aber alle allem allen aller alles also auch auf aus bei beim bin bis bist dann darf darum dass dein deine dem den der des dich dir doch dort du durch eine einem einen einer eines euch fast fuer für gegen hab habe haben hast hat hatte hatten hier ich ihm ihn ihr ihre ihrem ihren immer jetzt kann kein keine mich mir mit muss nach nicht noch nur oder ohne schon sehr sein seine sich sie sind soll über ueber und uns unter vom von vor war waren warum was weil wenn werden wie wieder will wir wird wo zum zur zwar ' +
    'about after again also because been before being both could does doing down during each from have having here into just more most much must only other over same should some such than that their them then there these they this those through very what when where which while will with would your'
  ).split(' '),
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

/** Stichwörter für den Abruf: normalisiert, ohne Füllwörter, mit einfacher Wortstamm-Kürzung. */
export function keywordsOf(text: string): string[] {
  const words = normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w));
  return [...new Set(words)];
}

export function remember(ctx: AppContext, storyId: string, m: MemoryInput): string {
  const id = newId('mem');
  const subjects = [...new Set(m.subjects ?? [])];
  const knownBy = [...new Set(m.knownBy ?? [PLAYER])];
  const names = subjects.length
    ? all<{ name: string }>(ctx.db, `SELECT name FROM life_characters WHERE id IN (${subjects.map(() => '?').join(',')})`, ...subjects).map((r) => r.name)
    : [];
  run(
    ctx.db,
    `INSERT INTO life_memories (id, story_id, turn, kind, content, importance, critical, subjects, known_by, keywords, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    storyId,
    m.turn,
    m.kind,
    m.content.slice(0, 600),
    Math.max(1, Math.min(5, Math.round(m.importance))),
    m.critical ? 1 : 0,
    JSON.stringify(subjects),
    JSON.stringify(knownBy),
    ` ${keywordsOf(`${m.content} ${names.join(' ')}`).join(' ')} `,
    m.source,
    ctx.now().toISOString(),
  );
  return id;
}

/** Eine Figur erfährt eine bisher geheime Erinnerung (z. B. durch Nachforschungen oder ein Gespräch). */
export function reveal(ctx: AppContext, memoryId: string, to: string[]): void {
  const row = get<{ known_by: string }>(ctx.db, 'SELECT known_by FROM life_memories WHERE id = ?', memoryId);
  if (!row) return;
  const known = new Set(parseJson<string[]>(row.known_by, []));
  for (const t of to) known.add(t);
  run(ctx.db, 'UPDATE life_memories SET known_by = ? WHERE id = ?', JSON.stringify([...known]), memoryId);
}

export function knows(row: Pick<MemoryRow, 'known_by'>, viewer: string): boolean {
  const known = parseJson<string[]>(row.known_by, []);
  return known.includes(EVERYONE) || known.includes(viewer);
}

export interface RecallOptions {
  query: string;
  /** Figuren, um die es gerade geht (bevorzugt). */
  subjects?: string[];
  /** Wer sich erinnert: 'player' oder die ID einer Figur. Erinnerungen ohne dieses Wissen werden ausgelassen. */
  viewer: string;
  turn: number;
  limit?: number;
  /** Kritische Fakten, die immer dabei sind (Obergrenze, die wichtigsten zuerst). */
  criticalLimit?: number;
}

/**
 * Gezielter Abruf: zuerst alle kritischen Fakten (begrenzt), dann die relevantesten weiteren Erinnerungen –
 * bewertet nach Stichwortüberschneidung, beteiligten Figuren, Wichtigkeit und Aktualität.
 */
export function recall(ctx: AppContext, storyId: string, o: RecallOptions): MemoryRow[] {
  const rows = all<MemoryRow>(ctx.db, 'SELECT * FROM life_memories WHERE story_id = ? AND kind != ? ORDER BY turn', storyId, 'summary').filter((r) =>
    knows(r, o.viewer),
  );
  const query = keywordsOf(o.query);
  const subjects = new Set(o.subjects ?? []);
  const scored = rows.map((r) => {
    const kw = r.keywords;
    const overlap = query.reduce((n, w) => (kw.includes(` ${w} `) ? n + 1 : n), 0);
    const subjectHits = parseJson<string[]>(r.subjects, []).filter((s) => subjects.has(s)).length;
    const age = Math.max(0, o.turn - r.turn);
    const recency = 1 / (1 + age / 25);
    const score = overlap * 3 + subjectHits * 4 + r.importance * 1.5 + recency * 2 + (r.critical ? 3 : 0);
    return { r, score };
  });
  const critical = scored
    .filter((s) => s.r.critical)
    .sort((a, b) => b.score - a.score)
    .slice(0, o.criticalLimit ?? 12);
  const chosen = new Set(critical.map((c) => c.r.id));
  const rest = scored
    .filter((s) => !chosen.has(s.r.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, o.limit ?? 12);
  return [...critical, ...rest].map((s) => s.r).sort((a, b) => a.turn - b.turn);
}

/** Neueste Zusammenfassungen (älterer Verlauf), aus Sicht des Spielers. */
export function recentSummaries(ctx: AppContext, storyId: string, limit = 3): MemoryRow[] {
  return all<MemoryRow>(ctx.db, `SELECT * FROM life_memories WHERE story_id = ? AND kind = 'summary' ORDER BY turn DESC LIMIT ?`, storyId, limit).reverse();
}

export function openPromises(ctx: AppContext, storyId: string): MemoryRow[] {
  return all<MemoryRow>(ctx.db, `SELECT * FROM life_memories WHERE story_id = ? AND kind = 'promise' ORDER BY turn DESC LIMIT 10`, storyId);
}

export function toMemoryDto(ctx: AppContext, r: MemoryRow, names: Map<string, string>): LifeMemoryDto {
  const known = parseJson<string[]>(r.known_by, []);
  return {
    id: r.id,
    turn: r.turn,
    kind: r.kind,
    content: r.content,
    importance: r.importance,
    critical: Boolean(r.critical),
    knownBy: known.map((k) => (k === EVERYONE ? '*' : k === PLAYER ? 'player' : (names.get(k) ?? '?'))),
    source: r.source,
  };
}
