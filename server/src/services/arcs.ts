import type { Lang } from '../../../shared/constants';
import type { ArcEndingDto, ArcPath } from '../../../shared/types';
import { buildEndings } from '../content/arcEndings';
import type { L } from '../content/seedWorlds';
import type { AppContext } from '../context';
import { all, get, parseJson, run } from '../db/database';
import { newId } from '../lib/ids';
import { fill } from '../lib/text';
import { notify } from './notifications';
import { grantXp } from './progress';
import { grantCoins } from './wallet';

/** Belohnung für alle Spielfiguren, die einen Handlungsbogen mitentschieden haben. */
export const ARC_REWARD = { xp: 120, coins: 40 } as const;

const ARC_TEXT = {
  endingTitle: { de: 'Ende: {title} – {ending}', en: 'Ending: {title} – {ending}' },
} satisfies Record<string, L>;

type Scores = Partial<Record<ArcPath, number>>;

interface ArcRow {
  id: string;
  world_id: string;
  title: string;
  endings: string;
  path_scores: string;
  status: string;
}

function endingsOf(ctx: AppContext, row: ArcRow, lang: Lang): ArcEndingDto[] {
  const stored = parseJson<ArcEndingDto[]>(row.endings, []);
  if (stored.length) return stored;
  const world = get<{ name: string }>(ctx.db, 'SELECT name FROM worlds WHERE id = ?', row.world_id)?.name ?? '';
  return buildEndings(row.id, row.title, world, lang);
}

/** Pfad mit den meisten Stimmen; ohne Beteiligung oder bei Gleichstand der neutrale Ausgang. */
export function leadingPath(scores: Scores): ArcPath {
  const bold = scores.bold ?? 0;
  const diplomatic = scores.diplomatic ?? 0;
  const neutral = scores.neutral ?? 0;
  if (bold > diplomatic && bold > neutral) return 'bold';
  if (diplomatic > bold && diplomatic > neutral) return 'diplomatic';
  return 'neutral';
}

/** Eine Entscheidung lenkt den Handlungsbogen in eine Richtung. */
export function addArcScore(ctx: AppContext, storylineId: string, path: ArcPath, weight: number): void {
  const row = get<{ path_scores: string }>(ctx.db, 'SELECT path_scores FROM storylines WHERE id = ?', storylineId);
  if (!row) return;
  const scores = parseJson<Scores>(row.path_scores, {});
  scores[path] = (scores[path] ?? 0) + weight;
  run(ctx.db, 'UPDATE storylines SET path_scores = ? WHERE id = ?', JSON.stringify(scores), storylineId);
}

/** Aktuell wahrscheinliches Ende (für die Prognose mit Strategie 2). */
export function forecastEnding(ctx: AppContext, storylineId: string, lang: Lang): string | null {
  const row = get<ArcRow>(ctx.db, 'SELECT id, world_id, title, endings, path_scores, status FROM storylines WHERE id = ?', storylineId);
  if (!row) return null;
  const path = leadingPath(parseJson<Scores>(row.path_scores, {}));
  return endingsOf(ctx, row, lang).find((e) => e.path === path)?.id ?? null;
}

/**
 * Schließt einen Handlungsbogen ab: Das Ende ergibt sich aus den Entscheidungen. Es wird ein Weltereignis
 * geschrieben und jede beteiligte Spielfigur erhält einmalig eine Belohnung.
 */
export function resolveArc(ctx: AppContext, storylineId: string, lang: Lang): ArcEndingDto | null {
  const row = get<ArcRow>(ctx.db, 'SELECT id, world_id, title, endings, path_scores, status FROM storylines WHERE id = ?', storylineId);
  if (!row) return null;
  const endings = endingsOf(ctx, row, lang);
  const path = leadingPath(parseJson<Scores>(row.path_scores, {}));
  const ending = endings.find((e) => e.path === path) ?? endings[0];
  if (!ending) return null;
  const updated = run(
    ctx.db,
    'UPDATE storylines SET ending_id = ?, endings = ? WHERE id = ? AND ending_id IS NULL',
    ending.id,
    JSON.stringify(endings),
    storylineId,
  );
  if (updated.changes === 0) return ending;
  const world = get<{ day: number; name: string }>(ctx.db, 'SELECT day, name FROM worlds WHERE id = ?', row.world_id)!;
  run(
    ctx.db,
    `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
     VALUES (?, ?, ?, 'storyline-ending', ?, ?, 'sim', '[]', '[]', ?, ?)`,
    newId('e'),
    row.world_id,
    world.day,
    fill(ARC_TEXT.endingTitle[lang], { title: row.title, ending: ending.title }),
    ending.description,
    storylineId,
    ctx.now().toISOString(),
  );
  for (const participant of all<{ player_id: string }>(
    ctx.db,
    `SELECT DISTINCT player_id FROM decisions WHERE storyline_id = ? AND status = 'resolved'`,
    storylineId,
  )) {
    const key = `arc:${storylineId}:${participant.player_id}`;
    grantXp(ctx, key, 'arc', ARC_REWARD.xp, participant.player_id);
    grantCoins(ctx, key, ARC_REWARD.coins, 'arc');
    notify(ctx, 'arcEnding', { title: row.title, ending: ending.title }, `/worlds/${row.world_id}`, row.world_id);
  }
  return ending;
}
