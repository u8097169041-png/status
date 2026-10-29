import type { Lang } from '../../../shared/constants';
import { V1_CHARACTER_GOALS, V1_PROMINENT } from '../content/seedGoals';
import { SEED_EVENTS, SEED_POSTS, SEED_STORIES, type SeedComment } from '../content/seedPosts';
import { SEED_EVENTS_V2, SEED_POSTS_V2, SEED_STORIES_V2 } from '../content/seedPosts2';
import {
  SEED_CHARACTERS_V2,
  SEED_GROUPS_V2,
  SEED_RELATIONSHIPS_V2,
  SEED_STORYLINES_V2,
  SEED_WORLDS_V2,
} from '../content/seedWorlds2';
import {
  SEED_CHARACTERS,
  SEED_GROUPS,
  SEED_RELATIONSHIPS,
  SEED_STORYLINES,
  SEED_WORLDS,
  type L,
} from '../content/seedWorlds';
import { buildEndings } from '../content/arcEndings';
import {
  SEED_CHARACTERS_V3,
  SEED_EVENTS_V3,
  SEED_GROUPS_V3,
  SEED_POSTS_V3,
  SEED_RELATIONSHIPS_V3,
  SEED_STORIES_V3,
  SEED_STORYLINES_V3,
  SEED_WORLDS_V3,
} from '../content/seedWorlds3';
import {
  SEED_CHARACTERS_V4,
  SEED_EVENTS_V4,
  SEED_GROUPS_V4,
  SEED_POSTS_V4,
  SEED_RELATIONSHIPS_V4,
  SEED_STORIES_V4,
  SEED_STORYLINES_V4,
  SEED_WORLDS_V4,
} from '../content/seedWorlds4';
import { extractTags } from '../lib/text';
import { addHours, addMinutes } from '../lib/time';
import { all, get, run, tx, type DB } from './database';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../services/settings';
import { STORY_LIFETIME_HOURS } from '../../../shared/constants';

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function isSeeded(db: DB): boolean {
  return Boolean(get(db, `SELECT value FROM meta WHERE key = 'seeded_at'`));
}

/** Legt Profil, Einstellungen und Beispielinhalte an, sofern die Datenbank noch leer ist. */
export function seedIfEmpty(db: DB, now: Date, lang: Lang = 'de'): boolean {
  if (isSeeded(db)) {
    applyContentUpdates(db, now);
    return false;
  }
  seedDatabase(db, now, lang);
  return true;
}

/** Version der mitgelieferten Inhalte. Erhöhen, wenn neue Welten oder Daten nachgetragen werden. */
export const CONTENT_VERSION = 4;

const ALL_WORLDS = [...SEED_WORLDS, ...SEED_WORLDS_V2, ...SEED_WORLDS_V3, ...SEED_WORLDS_V4];
const ALL_CHARACTERS = [...SEED_CHARACTERS, ...SEED_CHARACTERS_V2, ...SEED_CHARACTERS_V3, ...SEED_CHARACTERS_V4];
const ALL_RELATIONSHIPS = [...SEED_RELATIONSHIPS, ...SEED_RELATIONSHIPS_V2, ...SEED_RELATIONSHIPS_V3, ...SEED_RELATIONSHIPS_V4];
const ALL_GROUPS = [...SEED_GROUPS, ...SEED_GROUPS_V2, ...SEED_GROUPS_V3, ...SEED_GROUPS_V4];
const ALL_STORYLINES = [...SEED_STORYLINES, ...SEED_STORYLINES_V2, ...SEED_STORYLINES_V3, ...SEED_STORYLINES_V4];
const ALL_EVENTS = [...SEED_EVENTS, ...SEED_EVENTS_V2, ...SEED_EVENTS_V3, ...SEED_EVENTS_V4];
const ALL_POSTS = [...SEED_POSTS, ...SEED_POSTS_V2, ...SEED_POSTS_V3, ...SEED_POSTS_V4];
const ALL_STORIES = [...SEED_STORIES, ...SEED_STORIES_V2, ...SEED_STORIES_V3, ...SEED_STORIES_V4];

function setMeta(db: DB, key: string, value: string): void {
  run(db, `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value);
}

function getMeta(db: DB, key: string): string | null {
  return get<{ value: string }>(db, 'SELECT value FROM meta WHERE key = ?', key)?.value ?? null;
}

/** Fügt die Beispielinhalte der angegebenen Welten ein (Welten, Figuren, Beziehungen, Gruppen, Geschichten, Beiträge). */
function insertWorldContent(db: DB, worldIds: Set<string>, now: Date, lang: Lang): void {
  const t = (l: L) => l[lang];
  const at = (hoursAgo: number) => addHours(now, -hoursAgo).toISOString();
  const characters = ALL_CHARACTERS.filter((c) => worldIds.has(c.worldId));
  const worldOf = new Map(ALL_CHARACTERS.map((c) => [c.id, c.worldId]));
  const inScope = (characterId: string) => worldIds.has(worldOf.get(characterId) ?? '');

  for (const w of ALL_WORLDS.filter((x) => worldIds.has(x.id))) {
    run(
      db,
      `INSERT INTO worlds (id, name, tagline, genre, description, lore, atmosphere, rules, art_style, hue, is_custom,
                           day, harmony, tension, discovery, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      w.id,
      t(w.name),
      t(w.tagline),
      w.genre,
      t(w.description),
      t(w.lore),
      t(w.atmosphere),
      JSON.stringify(w.rules.map(t)),
      w.artStyle,
      w.hue,
      w.day,
      w.metrics.harmony,
      w.metrics.tension,
      w.metrics.discovery,
      at(24 * 30),
    );
  }

  for (const c of characters) {
    const goals = c.goals ?? V1_CHARACTER_GOALS[c.id] ?? [];
    run(
      db,
      `INSERT INTO characters (id, world_id, name, handle, tagline, description, role, personality, interests, background,
                               writing_style, style_notes, rules, avatar_hue, avatar_glyph, is_custom, is_real_person_sim,
                               mood, goals, prominent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      c.id,
      c.worldId,
      c.name,
      c.handle,
      t(c.tagline),
      t(c.description),
      t(c.role),
      JSON.stringify(c.personality.map(t)),
      JSON.stringify(c.interests.map(t)),
      t(c.background),
      c.writingStyle,
      t(c.styleNotes),
      JSON.stringify(c.rules.map(t)),
      c.avatarHue,
      c.avatarGlyph,
      c.mood,
      JSON.stringify(goals.map(t)),
      c.prominent || V1_PROMINENT.includes(c.id),
      at(24 * 30),
    );
  }

  for (const r of ALL_RELATIONSHIPS.filter((x) => inScope(x.a))) {
    const [a, b] = pairKey(r.a, r.b);
    run(
      db,
      `INSERT INTO relationships (id, world_id, a_id, b_id, kind, affinity, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `r-seed-${a}-${b}`,
      worldOf.get(r.a) ?? null,
      a,
      b,
      r.kind,
      r.affinity,
      t(r.note),
      at(48),
    );
  }

  for (const g of ALL_GROUPS.filter((x) => worldIds.has(x.worldId))) {
    run(
      db,
      `INSERT INTO groups (id, world_id, name, description, hue, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      g.id,
      g.worldId,
      t(g.name),
      t(g.description),
      g.hue,
      at(24 * 30),
    );
    for (const [characterId, role] of g.members) {
      run(db, `INSERT INTO group_members (group_id, character_id, role) VALUES (?, ?, ?)`, g.id, characterId, t(role));
    }
  }

  const worldName = new Map(ALL_WORLDS.map((w) => [w.id, t(w.name)]));
  for (const s of ALL_STORYLINES.filter((x) => worldIds.has(x.worldId))) {
    run(
      db,
      `INSERT INTO storylines (id, world_id, title, summary, stages, stage, theme, status, endings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      s.id,
      s.worldId,
      t(s.title),
      t(s.summary),
      JSON.stringify(s.stages.map(t)),
      s.stage,
      s.theme,
      JSON.stringify(buildEndings(s.id, t(s.title), worldName.get(s.worldId) ?? '', lang)),
      at(24 * 7),
      at(24),
    );
  }

  const worldDay = new Map(ALL_WORLDS.map((w) => [w.id, w.day]));
  const charRefs = new Map(
    ALL_CHARACTERS.map((c) => [c.id, { id: c.id, name: c.name, avatarHue: c.avatarHue, avatarGlyph: c.avatarGlyph }]),
  );
  for (const e of ALL_EVENTS.filter((x) => worldIds.has(x.worldId))) {
    run(
      db,
      `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'seed', '[]', ?, ?, ?)`,
      e.id,
      e.worldId,
      Math.max(1, (worldDay.get(e.worldId) ?? 1) + e.dayOffset),
      e.kind,
      t(e.title),
      t(e.description),
      JSON.stringify(e.participants.map((id) => charRefs.get(id)).filter(Boolean)),
      e.storylineId ?? null,
      at(e.hoursAgo),
    );
  }

  const insertComment = (postId: string, parentId: string | null, c: SeedComment, base: Date, index: string) => {
    const id = `cm-seed-${postId}-${index}`;
    const created = addMinutes(base, c.minutesAfter);
    run(
      db,
      `INSERT INTO comments (id, post_id, parent_id, author_type, character_id, content, source, created_at)
       VALUES (?, ?, ?, 'character', ?, ?, 'seed', ?)`,
      id,
      postId,
      parentId,
      c.author,
      t(c.content),
      (created > now ? now : created).toISOString(),
    );
    (c.replies ?? []).forEach((reply, i) => insertComment(postId, id, reply, base, `${index}-${i}`));
  };

  for (const p of ALL_POSTS.filter((x) => inScope(x.author))) {
    const created = addHours(now, -p.hoursAgo);
    const content = t(p.content);
    run(
      db,
      `INSERT INTO posts (id, author_type, character_id, world_id, content, repost_of, source, created_at)
       VALUES (?, 'character', ?, ?, ?, ?, 'seed', ?)`,
      p.id,
      p.author,
      worldOf.get(p.author) ?? null,
      content,
      p.repostOf ?? null,
      created.toISOString(),
    );
    for (const tag of extractTags(content)) {
      run(db, `INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)`, p.id, tag);
    }
    for (const liker of p.likes) {
      run(
        db,
        `INSERT OR IGNORE INTO character_likes (post_id, character_id, created_at) VALUES (?, ?, ?)`,
        p.id,
        liker,
        addMinutes(created, 5).toISOString(),
      );
    }
    (p.comments ?? []).forEach((c, i) => insertComment(p.id, null, c, created, String(i)));
  }

  ALL_STORIES.filter((x) => inScope(x.author)).forEach((s, i) => {
    const created = addHours(now, -s.hoursAgo);
    run(
      db,
      `INSERT INTO stories (id, author_type, character_id, world_id, content, style, created_at, expires_at)
       VALUES (?, 'character', ?, ?, ?, ?, ?, ?)`,
      `st-seed-${s.author}-${i}`,
      s.author,
      worldOf.get(s.author) ?? null,
      t(s.content),
      s.style,
      created.toISOString(),
      addHours(created, STORY_LIFETIME_HOURS).toISOString(),
    );
  });
}

export function seedDatabase(db: DB, now: Date, lang: Lang): void {
  tx(db, () => {
    if (!get(db, 'SELECT 1 FROM settings WHERE key = ?', 'app')) {
      saveSettings(db, { ...DEFAULT_SETTINGS, language: lang });
    } else {
      saveSettings(db, { ...getSettings(db), language: lang });
    }
    run(
      db,
      `INSERT OR IGNORE INTO user_profile (id, display_name, handle, bio, avatar_hue, avatar_glyph, created_at)
       VALUES (1, ?, ?, ?, 265, 'initials', ?)`,
      lang === 'de' ? 'Gast' : 'Guest',
      lang === 'de' ? 'gast' : 'guest',
      lang === 'de' ? 'Neu in SocialVerse – auf Entdeckungsreise.' : 'New to SocialVerse – exploring.',
      now.toISOString(),
    );
    insertWorldContent(db, new Set(ALL_WORLDS.map((w) => w.id)), now, lang);
    run(
      db,
      `INSERT INTO notifications (id, kind, params, link, read, created_at) VALUES ('n-welcome', 'welcome', '{}', '/discover', 0, ?)`,
      now.toISOString(),
    );
    setMeta(db, 'seeded_at', now.toISOString());
    setMeta(db, 'content_language', lang);
    setMeta(db, 'content_version', String(CONTENT_VERSION));
  });
}

/**
 * Spielt neue mitgelieferte Inhalte in bestehende Datenbanken ein, ohne vorhandene Daten zu verändern.
 * Jede Stufe läuft genau einmal (gemerkt in meta.content_version).
 */
export function applyContentUpdates(db: DB, now: Date): boolean {
  const current = Number(getMeta(db, 'content_version') ?? '1');
  if (current >= CONTENT_VERSION) return false;
  const lang: Lang = getMeta(db, 'content_language') === 'en' ? 'en' : 'de';
  tx(db, () => {
    if (current < 2) {
      for (const [id, goals] of Object.entries(V1_CHARACTER_GOALS)) {
        run(db, `UPDATE characters SET goals = ? WHERE id = ? AND goals = '[]'`, JSON.stringify(goals.map((g) => g[lang])), id);
      }
      for (const id of V1_PROMINENT) run(db, 'UPDATE characters SET prominent = 1 WHERE id = ?', id);
      const missing = SEED_WORLDS_V2.filter((w) => !get(db, 'SELECT 1 FROM worlds WHERE id = ?', w.id)).map((w) => w.id);
      // Nur einfügen, wenn keine der Figuren-IDs oder Handles bereits belegt ist (z. B. durch eigene Charaktere).
      const conflicts = SEED_CHARACTERS_V2.filter(
        (c) => missing.includes(c.worldId) && get(db, 'SELECT 1 FROM characters WHERE id = ? OR handle = ?', c.id, c.handle),
      ).map((c) => c.worldId);
      insertWorldContent(db, new Set(missing.filter((id) => !conflicts.includes(id))), now, lang);
    }
    if (current < 3) {
      const missing = SEED_WORLDS_V3.filter((w) => !get(db, 'SELECT 1 FROM worlds WHERE id = ?', w.id)).map((w) => w.id);
      const conflicts = SEED_CHARACTERS_V3.filter(
        (c) => missing.includes(c.worldId) && get(db, 'SELECT 1 FROM characters WHERE id = ? OR handle = ?', c.id, c.handle),
      ).map((c) => c.worldId);
      insertWorldContent(db, new Set(missing.filter((id) => !conflicts.includes(id))), now, lang);
      // Bestehende Geschichten erhalten mögliche Enden.
      for (const s of all<{ id: string; title: string; world: string }>(
        db,
        `SELECT s.id, s.title, w.name AS world FROM storylines s JOIN worlds w ON w.id = s.world_id WHERE s.endings = '[]'`,
      )) {
        run(db, 'UPDATE storylines SET endings = ? WHERE id = ?', JSON.stringify(buildEndings(s.id, s.title, s.world, lang)), s.id);
      }
    }
    if (current < 4) {
      // Neue Dating-Welt; vorhandene Daten bleiben unverändert, belegte IDs/Handles werden nicht überschrieben.
      const missing = SEED_WORLDS_V4.filter((w) => !get(db, 'SELECT 1 FROM worlds WHERE id = ?', w.id)).map((w) => w.id);
      const conflicts = SEED_CHARACTERS_V4.filter(
        (c) => missing.includes(c.worldId) && get(db, 'SELECT 1 FROM characters WHERE id = ? OR handle = ?', c.id, c.handle),
      ).map((c) => c.worldId);
      insertWorldContent(db, new Set(missing.filter((id) => !conflicts.includes(id))), now, lang);
    }
    setMeta(db, 'content_version', String(CONTENT_VERSION));
  });
  return true;
}

/** Alle Tabellen mit Anwendungsdaten (ohne Migrationsverwaltung). Reihenfolge berücksichtigt Fremdschlüssel. */
export const DATA_TABLES = [
  'story_views',
  'stories',
  'bookmarks',
  'user_likes',
  'character_likes',
  'post_tags',
  'comments',
  'posts',
  'conversation_memories',
  'conversation_messages',
  'conversations',
  'quests',
  'player_skills',
  'action_uses',
  'decisions',
  'players',
  'group_members',
  'groups',
  'relationships',
  'world_events',
  'storylines',
  'encounters',
  'world_visits',
  'characters',
  'worlds',
  'activity_log',
  'xp_events',
  'quest_claims',
  'achievements',
  'wallet_ledger',
  'purchases',
  'notifications',
  'scheduled_jobs',
  'ai_usage',
  'simulation_log',
  'user_profile',
  'settings',
  'secrets',
  'meta',
] as const;

/** Löscht sämtliche lokalen Daten (inklusive lokal gespeichertem API-Schlüssel). */
export function wipeAllData(db: DB): void {
  tx(db, () => {
    for (const table of DATA_TABLES) run(db, `DELETE FROM ${table}`);
  });
}
