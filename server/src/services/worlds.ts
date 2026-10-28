import { z } from 'zod';
import { ART_STYLES, GENRES, LIMITS, categoryOfGenre, type ArtStyle, type Genre } from '../../../shared/constants';
import type { ProgressDelta, WorldDetail, WorldEventDto, WorldInput, WorldSummary } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText } from '../lib/text';
import { listCharacters } from './characters';
import { emptyDelta, recordAction, recordWorldVisit } from './progress';
import { groupsForWorld, relationshipsForWorld, storylinesForWorld } from './society';

interface WorldRow {
  id: string;
  name: string;
  tagline: string;
  genre: Genre;
  description: string;
  lore: string;
  atmosphere: string;
  rules: string;
  art_style: ArtStyle;
  hue: number;
  is_custom: number;
  day: number;
  harmony: number;
  tension: number;
  discovery: number;
  tick_count: number;
  created_at: string;
  character_count: number;
  active_storylines: number;
  last_event_at: string | null;
  last_event_title: string | null;
  joined: number;
}

const WORLD_SELECT = `
  SELECT w.*,
    (SELECT COUNT(*) FROM characters c WHERE c.world_id = w.id) AS character_count,
    (SELECT COUNT(*) FROM storylines s WHERE s.world_id = w.id AND s.status = 'active') AS active_storylines,
    (SELECT e.created_at FROM world_events e WHERE e.world_id = w.id ORDER BY e.created_at DESC LIMIT 1) AS last_event_at,
    (SELECT e.title FROM world_events e WHERE e.world_id = w.id ORDER BY e.created_at DESC LIMIT 1) AS last_event_title,
    EXISTS (SELECT 1 FROM players pl WHERE pl.world_id = w.id AND pl.is_active = 1) AS joined
  FROM worlds w`;

function toSummary(r: WorldRow): WorldSummary {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    genre: r.genre,
    artStyle: r.art_style,
    hue: r.hue,
    isCustom: Boolean(r.is_custom),
    day: r.day,
    metrics: { harmony: r.harmony, tension: r.tension, discovery: r.discovery },
    characterCount: r.character_count,
    activeStorylines: r.active_storylines,
    lastEventAt: r.last_event_at,
    lastEventTitle: r.last_event_title,
    category: categoryOfGenre(r.genre),
    joined: Boolean(r.joined),
  };
}

export function listWorlds(ctx: AppContext): WorldSummary[] {
  return all<WorldRow>(ctx.db, `${WORLD_SELECT} ORDER BY w.is_custom DESC, last_event_at DESC, w.name`).map(toSummary);
}

export function getWorldRow(ctx: AppContext, id: string): WorldRow {
  const row = get<WorldRow>(ctx.db, `${WORLD_SELECT} WHERE w.id = ?`, id);
  if (!row) throw notFound('Welt');
  return row;
}

export function getWorldSummary(ctx: AppContext, id: string): WorldSummary {
  return toSummary(getWorldRow(ctx, id));
}

interface EventRow {
  id: string;
  world_id: string;
  day: number;
  kind: string;
  title: string;
  description: string;
  source: WorldEventDto['source'];
  effects: string;
  participants: string;
  created_at: string;
}

export function toEvent(r: EventRow): WorldEventDto {
  return {
    id: r.id,
    worldId: r.world_id,
    day: r.day,
    kind: r.kind,
    title: r.title,
    description: r.description,
    source: r.source,
    effects: parseJson(r.effects, []),
    participants: parseJson(r.participants, []),
    createdAt: r.created_at,
  };
}

export function listEvents(ctx: AppContext, worldId: string, limit = 30, before?: string): WorldEventDto[] {
  getWorldRow(ctx, worldId);
  const rows = before
    ? all<EventRow>(
        ctx.db,
        'SELECT * FROM world_events WHERE world_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?',
        worldId,
        before,
        limit,
      )
    : all<EventRow>(ctx.db, 'SELECT * FROM world_events WHERE world_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', worldId, limit);
  return rows.map(toEvent);
}

export function recentEventsAll(ctx: AppContext, limit = 8): (WorldEventDto & { worldName: string; worldHue: number })[] {
  return all<EventRow & { world_name: string; world_hue: number }>(
    ctx.db,
    `SELECT e.*, w.name AS world_name, w.hue AS world_hue FROM world_events e JOIN worlds w ON w.id = e.world_id
      ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
    limit,
  ).map((r) => ({ ...toEvent(r), worldName: r.world_name, worldHue: r.world_hue }));
}

export function getWorld(ctx: AppContext, id: string, opts: { recordVisit?: boolean } = {}): {
  world: WorldDetail;
  progress: ProgressDelta;
} {
  const row = getWorldRow(ctx, id);
  const progress = opts.recordVisit ? recordWorldVisit(ctx, id) : emptyDelta();
  return {
    progress,
    world: {
      ...toSummary(row),
      description: row.description,
      lore: row.lore,
      atmosphere: row.atmosphere,
      rules: parseJson<string[]>(row.rules, []),
      createdAt: row.created_at,
      characters: listCharacters(ctx, { worldId: id }),
      relationships: relationshipsForWorld(ctx, id),
      groups: groupsForWorld(ctx, id),
      storylines: storylinesForWorld(ctx, id).map(({ theme: _theme, ...s }) => s),
      recentEvents: listEvents(ctx, id, 15),
    },
  };
}

export const worldInputSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.worldName),
  tagline: z.string().trim().max(LIMITS.worldShortText).default(''),
  genre: z.enum(GENRES),
  description: z.string().trim().max(LIMITS.worldLongText).default(''),
  lore: z.string().trim().max(LIMITS.worldLongText).default(''),
  atmosphere: z.string().trim().max(LIMITS.worldShortText).default(''),
  rules: z.array(z.string().trim().min(1).max(LIMITS.worldRule)).max(LIMITS.worldRules).default([]),
  artStyle: z.enum(ART_STYLES),
  hue: z.number().int().min(0).max(359),
});

export function parseWorldInput(input: unknown): WorldInput {
  const parsed = worldInputSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_world', 'Ungültige Weltdaten.', parsed.error.issues);
  const d = parsed.data;
  return {
    ...d,
    name: cleanText(d.name),
    tagline: cleanText(d.tagline),
    description: cleanText(d.description),
    lore: cleanText(d.lore),
    atmosphere: cleanText(d.atmosphere),
    rules: d.rules.map(cleanText).filter(Boolean),
  };
}

export function insertWorld(ctx: AppContext, w: WorldInput): string {
  const id = newId('w');
  run(
    ctx.db,
    `INSERT INTO worlds (id, name, tagline, genre, description, lore, atmosphere, rules, art_style, hue, is_custom, day,
                         harmony, tension, discovery, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 55, 30, 45, ?)`,
    id,
    w.name,
    w.tagline,
    w.genre,
    w.description,
    w.lore,
    w.atmosphere,
    JSON.stringify(w.rules),
    w.artStyle,
    w.hue,
    ctx.now().toISOString(),
  );
  run(
    ctx.db,
    `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, created_at)
     VALUES (?, ?, 1, 'founding', ?, ?, 'user', '[]', '[]', ?)`,
    newId('e'),
    id,
    w.name,
    w.tagline || w.description.slice(0, 200),
    ctx.now().toISOString(),
  );
  return id;
}

export function updateWorld(ctx: AppContext, id: string, input: unknown): WorldDetail {
  const row = getWorldRow(ctx, id);
  if (!row.is_custom) throw forbidden('Vorgefertigte Welten können nicht bearbeitet werden.');
  const w = parseWorldInput(input);
  run(
    ctx.db,
    `UPDATE worlds SET name = ?, tagline = ?, genre = ?, description = ?, lore = ?, atmosphere = ?, rules = ?, art_style = ?,
            hue = ? WHERE id = ?`,
    w.name,
    w.tagline,
    w.genre,
    w.description,
    w.lore,
    w.atmosphere,
    JSON.stringify(w.rules),
    w.artStyle,
    w.hue,
    id,
  );
  return getWorld(ctx, id).world;
}

export function deleteWorld(ctx: AppContext, id: string): void {
  const row = getWorldRow(ctx, id);
  if (!row.is_custom) throw forbidden('Vorgefertigte Welten können nicht gelöscht werden.');
  tx(ctx.db, () => {
    // Eigene Charaktere dieser Welt werden mitgelöscht, damit keine verwaisten Figuren zurückbleiben.
    run(ctx.db, 'DELETE FROM characters WHERE world_id = ? AND is_custom = 1', id);
    run(ctx.db, 'DELETE FROM worlds WHERE id = ?', id);
  });
}

export function recordWorldCreated(ctx: AppContext, id: string): ProgressDelta {
  return recordAction(ctx, 'createWorld', id);
}
