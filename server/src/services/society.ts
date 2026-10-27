import { z } from 'zod';
import { LIMITS, RELATIONSHIP_KINDS, type RelationshipKind } from '../../../shared/constants';
import { clampAffinity, relationshipStatus } from '../../../shared/relationships';
import type { GroupDto, RelationshipDto, StorylineDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { cleanText } from '../lib/text';
import { toCharacterRef } from './mappers';

interface RelationshipRow {
  id: string;
  world_id: string | null;
  a_id: string;
  b_id: string;
  kind: RelationshipKind;
  affinity: number;
  note: string;
  updated_at: string;
  a_name: string;
  a_hue: number;
  a_glyph: string;
  b_name: string;
  b_hue: number;
  b_glyph: string;
}

const RELATIONSHIP_SELECT = `
  SELECT r.*, a.name AS a_name, a.avatar_hue AS a_hue, a.avatar_glyph AS a_glyph,
         b.name AS b_name, b.avatar_hue AS b_hue, b.avatar_glyph AS b_glyph
    FROM relationships r JOIN characters a ON a.id = r.a_id JOIN characters b ON b.id = r.b_id`;

function toRelationship(r: RelationshipRow): RelationshipDto {
  return {
    id: r.id,
    worldId: r.world_id,
    a: toCharacterRef({ id: r.a_id, name: r.a_name, avatar_hue: r.a_hue, avatar_glyph: r.a_glyph }),
    b: toCharacterRef({ id: r.b_id, name: r.b_name, avatar_hue: r.b_hue, avatar_glyph: r.b_glyph }),
    kind: r.kind,
    affinity: r.affinity,
    status: relationshipStatus(r.affinity),
    note: r.note,
    updatedAt: r.updated_at,
  };
}

export function relationshipsForWorld(ctx: AppContext, worldId: string): RelationshipDto[] {
  return all<RelationshipRow>(ctx.db, `${RELATIONSHIP_SELECT} WHERE r.world_id = ? ORDER BY r.affinity DESC`, worldId).map(
    toRelationship,
  );
}

export function relationshipsForCharacter(ctx: AppContext, characterId: string): RelationshipDto[] {
  return all<RelationshipRow>(
    ctx.db,
    `${RELATIONSHIP_SELECT} WHERE r.a_id = ? OR r.b_id = ? ORDER BY r.affinity DESC`,
    characterId,
    characterId,
  ).map(toRelationship);
}

export function getRelationshipBetween(ctx: AppContext, x: string, y: string): RelationshipDto | null {
  const [a, b] = x < y ? [x, y] : [y, x];
  const row = get<RelationshipRow>(ctx.db, `${RELATIONSHIP_SELECT} WHERE r.a_id = ? AND r.b_id = ?`, a, b);
  return row ? toRelationship(row) : null;
}

const relationshipSchema = z.object({
  aId: z.string().max(80),
  bId: z.string().max(80),
  kind: z.enum(RELATIONSHIP_KINDS),
  affinity: z.number().int().min(-100).max(100).default(0),
  note: z.string().trim().max(LIMITS.characterShortText).default(''),
});

export function createRelationship(ctx: AppContext, worldId: string, input: unknown): RelationshipDto {
  const parsed = relationshipSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_relationship', 'Ungültige Beziehung.', parsed.error.issues);
  const { aId, bId, kind, affinity, note } = parsed.data;
  if (aId === bId) throw badRequest('invalid_relationship', 'Ein Charakter kann keine Beziehung zu sich selbst haben.');
  const members = all<{ id: string }>(
    ctx.db,
    'SELECT id FROM characters WHERE id IN (?, ?) AND world_id = ?',
    aId,
    bId,
    worldId,
  );
  if (members.length !== 2) throw badRequest('invalid_relationship', 'Beide Charaktere müssen zu dieser Welt gehören.');
  const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
  if (get(ctx.db, 'SELECT 1 FROM relationships WHERE a_id = ? AND b_id = ?', a, b)) {
    throw conflict('relationship_exists', 'Zwischen diesen Charakteren besteht bereits eine Beziehung.');
  }
  const id = newId('r');
  run(
    ctx.db,
    `INSERT INTO relationships (id, world_id, a_id, b_id, kind, affinity, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    worldId,
    a,
    b,
    kind,
    affinity,
    cleanText(note),
    ctx.now().toISOString(),
  );
  return toRelationship(get<RelationshipRow>(ctx.db, `${RELATIONSHIP_SELECT} WHERE r.id = ?`, id)!);
}

export function updateRelationship(ctx: AppContext, id: string, input: unknown): RelationshipDto {
  const parsed = relationshipSchema.pick({ kind: true, affinity: true, note: true }).partial().safeParse(input);
  if (!parsed.success) throw badRequest('invalid_relationship', 'Ungültige Beziehung.', parsed.error.issues);
  const row = get<RelationshipRow>(ctx.db, `${RELATIONSHIP_SELECT} WHERE r.id = ?`, id);
  if (!row) throw notFound('Beziehung');
  run(
    ctx.db,
    'UPDATE relationships SET kind = ?, affinity = ?, note = ?, updated_at = ? WHERE id = ?',
    parsed.data.kind ?? row.kind,
    parsed.data.affinity ?? row.affinity,
    parsed.data.note !== undefined ? cleanText(parsed.data.note) : row.note,
    ctx.now().toISOString(),
    id,
  );
  return toRelationship(get<RelationshipRow>(ctx.db, `${RELATIONSHIP_SELECT} WHERE r.id = ?`, id)!);
}

export function deleteRelationship(ctx: AppContext, id: string): void {
  if (run(ctx.db, 'DELETE FROM relationships WHERE id = ?', id).changes === 0) throw notFound('Beziehung');
}

/**
 * Ändert die Zuneigung zwischen zwei Charakteren. Legt bei Bedarf eine neue Beziehung an.
 * Gibt alte und neue Werte sowie einen eventuellen Wechsel der Beziehungsart zurück.
 */
export function adjustAffinity(
  ctx: AppContext,
  worldId: string,
  x: string,
  y: string,
  delta: number,
): { before: number; after: number; kindBefore: RelationshipKind; kindAfter: RelationshipKind } {
  const [a, b] = x < y ? [x, y] : [y, x];
  const existing = get<{ id: string; affinity: number; kind: RelationshipKind }>(
    ctx.db,
    'SELECT id, affinity, kind FROM relationships WHERE a_id = ? AND b_id = ?',
    a,
    b,
  );
  const before = existing?.affinity ?? 0;
  const after = clampAffinity(before + delta);
  const kindBefore: RelationshipKind = existing?.kind ?? (delta >= 0 ? 'ally' : 'rival');
  let kindAfter = kindBefore;
  // Freundschaft und Rivalität können kippen; Familie, Mentor und Romanze bleiben bestehen.
  if ((kindBefore === 'friend' || kindBefore === 'ally' || kindBefore === 'colleague') && after <= -40) kindAfter = 'rival';
  else if (kindBefore === 'rival' && after >= 40) kindAfter = 'friend';
  else if ((kindBefore === 'ally' || kindBefore === 'colleague') && after >= 65) kindAfter = 'friend';
  const now = ctx.now().toISOString();
  if (existing) {
    run(ctx.db, 'UPDATE relationships SET affinity = ?, kind = ?, updated_at = ? WHERE id = ?', after, kindAfter, now, existing.id);
  } else {
    run(
      ctx.db,
      `INSERT INTO relationships (id, world_id, a_id, b_id, kind, affinity, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, '', ?)`,
      newId('r'),
      worldId,
      a,
      b,
      kindAfter,
      after,
      now,
    );
  }
  return { before, after, kindBefore, kindAfter };
}

// ---- Gruppen ----

export function groupsForWorld(ctx: AppContext, worldId: string): GroupDto[] {
  const groups = all<{ id: string; world_id: string; name: string; description: string; hue: number }>(
    ctx.db,
    'SELECT * FROM groups WHERE world_id = ? ORDER BY name',
    worldId,
  );
  return groups.map((g) => ({
    id: g.id,
    worldId: g.world_id,
    name: g.name,
    description: g.description,
    hue: g.hue,
    members: all<{ id: string; name: string; avatar_hue: number; avatar_glyph: string; role: string }>(
      ctx.db,
      `SELECT c.id, c.name, c.avatar_hue, c.avatar_glyph, gm.role FROM group_members gm
         JOIN characters c ON c.id = gm.character_id WHERE gm.group_id = ? ORDER BY c.name`,
      g.id,
    ).map((m) => ({ character: toCharacterRef(m), role: m.role })),
  }));
}

const groupSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.groupName),
  description: z.string().trim().max(LIMITS.characterShortText).default(''),
  hue: z.number().int().min(0).max(359).default(200),
  memberIds: z.array(z.string().max(80)).max(30).default([]),
});

export function createGroup(ctx: AppContext, worldId: string, input: unknown): GroupDto {
  if (!get(ctx.db, 'SELECT 1 FROM worlds WHERE id = ?', worldId)) throw notFound('Welt');
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_group', 'Ungültige Gruppe.', parsed.error.issues);
  const id = newId('g');
  tx(ctx.db, () => {
    run(
      ctx.db,
      'INSERT INTO groups (id, world_id, name, description, hue, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      worldId,
      cleanText(parsed.data.name),
      cleanText(parsed.data.description),
      parsed.data.hue,
      ctx.now().toISOString(),
    );
    for (const memberId of new Set(parsed.data.memberIds)) addGroupMemberInternal(ctx, id, worldId, memberId, '');
  });
  return groupsForWorld(ctx, worldId).find((g) => g.id === id)!;
}

function addGroupMemberInternal(ctx: AppContext, groupId: string, worldId: string, characterId: string, role: string) {
  if (!get(ctx.db, 'SELECT 1 FROM characters WHERE id = ? AND world_id = ?', characterId, worldId)) {
    throw badRequest('invalid_member', 'Mitglieder müssen zur Welt der Gruppe gehören.');
  }
  run(
    ctx.db,
    'INSERT OR REPLACE INTO group_members (group_id, character_id, role) VALUES (?, ?, ?)',
    groupId,
    characterId,
    cleanText(role).slice(0, LIMITS.characterListItem),
  );
}

export function setGroupMember(ctx: AppContext, groupId: string, characterId: string, input: unknown): GroupDto {
  const group = get<{ world_id: string }>(ctx.db, 'SELECT world_id FROM groups WHERE id = ?', groupId);
  if (!group) throw notFound('Gruppe');
  const parsed = z.object({ role: z.string().max(LIMITS.characterListItem).default('') }).safeParse(input ?? {});
  if (!parsed.success) throw badRequest('invalid_member', 'Ungültige Rolle.');
  addGroupMemberInternal(ctx, groupId, group.world_id, characterId, parsed.data.role);
  return groupsForWorld(ctx, group.world_id).find((g) => g.id === groupId)!;
}

export function removeGroupMember(ctx: AppContext, groupId: string, characterId: string): void {
  run(ctx.db, 'DELETE FROM group_members WHERE group_id = ? AND character_id = ?', groupId, characterId);
}

export function deleteGroup(ctx: AppContext, groupId: string): void {
  if (run(ctx.db, 'DELETE FROM groups WHERE id = ?', groupId).changes === 0) throw notFound('Gruppe');
}

// ---- Storylines ----

interface StorylineRow {
  id: string;
  world_id: string;
  title: string;
  summary: string;
  stages: string;
  stage: number;
  theme: string;
  status: 'active' | 'resolved';
  updated_at: string;
}

export function toStoryline(r: StorylineRow): StorylineDto {
  return {
    id: r.id,
    worldId: r.world_id,
    title: r.title,
    summary: r.summary,
    stages: parseJson<string[]>(r.stages, []),
    stage: r.stage,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

export function storylinesForWorld(ctx: AppContext, worldId: string): (StorylineDto & { theme: string })[] {
  return all<StorylineRow>(
    ctx.db,
    `SELECT * FROM storylines WHERE world_id = ? ORDER BY status = 'resolved', updated_at DESC`,
    worldId,
  ).map((r) => ({ ...toStoryline(r), theme: r.theme }));
}

const storylineSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.eventTitle),
  summary: z.string().trim().max(LIMITS.eventDescription).default(''),
  stages: z.array(z.string().trim().min(1).max(LIMITS.worldRule)).min(2).max(8),
  theme: z.enum(['harmony', 'tension', 'discovery']).default('discovery'),
});

export function createStoryline(ctx: AppContext, worldId: string, input: unknown): StorylineDto {
  if (!get(ctx.db, 'SELECT 1 FROM worlds WHERE id = ?', worldId)) throw notFound('Welt');
  const parsed = storylineSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_storyline', 'Ungültige Storyline.', parsed.error.issues);
  const id = newId('s');
  const now = ctx.now().toISOString();
  run(
    ctx.db,
    `INSERT INTO storylines (id, world_id, title, summary, stages, stage, theme, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'active', ?, ?)`,
    id,
    worldId,
    cleanText(parsed.data.title),
    cleanText(parsed.data.summary),
    JSON.stringify(parsed.data.stages.map(cleanText)),
    parsed.data.theme,
    now,
    now,
  );
  return toStoryline(get<StorylineRow>(ctx.db, 'SELECT * FROM storylines WHERE id = ?', id)!);
}
