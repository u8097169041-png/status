import type { Lang } from '../../../shared/constants';
import { SEED_EVENTS, SEED_POSTS, SEED_STORIES, type SeedComment } from '../content/seedPosts';
import {
  SEED_CHARACTERS,
  SEED_GROUPS,
  SEED_RELATIONSHIPS,
  SEED_STORYLINES,
  SEED_WORLDS,
  type L,
} from '../content/seedWorlds';
import { extractTags } from '../lib/text';
import { addHours, addMinutes } from '../lib/time';
import { get, run, tx, type DB } from './database';
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
  if (isSeeded(db)) return false;
  seedDatabase(db, now, lang);
  return true;
}

export function seedDatabase(db: DB, now: Date, lang: Lang): void {
  const t = (l: L) => l[lang];
  const at = (hoursAgo: number) => addHours(now, -hoursAgo).toISOString();
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

    for (const w of SEED_WORLDS) {
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

    for (const c of SEED_CHARACTERS) {
      run(
        db,
        `INSERT INTO characters (id, world_id, name, handle, tagline, description, role, personality, interests, background,
                                 writing_style, style_notes, rules, avatar_hue, avatar_glyph, is_custom, is_real_person_sim,
                                 mood, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
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
        at(24 * 30),
      );
    }

    const worldOf = new Map(SEED_CHARACTERS.map((c) => [c.id, c.worldId]));
    SEED_RELATIONSHIPS.forEach((r, i) => {
      const [a, b] = pairKey(r.a, r.b);
      run(
        db,
        `INSERT INTO relationships (id, world_id, a_id, b_id, kind, affinity, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        `r-seed-${i + 1}`,
        worldOf.get(r.a) ?? null,
        a,
        b,
        r.kind,
        r.affinity,
        t(r.note),
        at(48),
      );
    });

    for (const g of SEED_GROUPS) {
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

    for (const s of SEED_STORYLINES) {
      run(
        db,
        `INSERT INTO storylines (id, world_id, title, summary, stages, stage, theme, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        s.id,
        s.worldId,
        t(s.title),
        t(s.summary),
        JSON.stringify(s.stages.map(t)),
        s.stage,
        s.theme,
        at(24 * 7),
        at(24),
      );
    }

    const worldDay = new Map(SEED_WORLDS.map((w) => [w.id, w.day]));
    const charRefs = new Map(
      SEED_CHARACTERS.map((c) => [c.id, { id: c.id, name: c.name, avatarHue: c.avatarHue, avatarGlyph: c.avatarGlyph }]),
    );
    for (const e of SEED_EVENTS) {
      run(
        db,
        `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'seed', '[]', ?, ?, ?)`,
        e.id,
        e.worldId,
        (worldDay.get(e.worldId) ?? 1) + e.dayOffset,
        e.kind,
        t(e.title),
        t(e.description),
        JSON.stringify(e.participants.map((id) => charRefs.get(id)).filter(Boolean)),
        e.storylineId ?? null,
        at(e.hoursAgo),
      );
    }

    let commentCounter = 0;
    const insertComment = (postId: string, parentId: string | null, c: SeedComment, base: Date) => {
      const id = `cm-seed-${++commentCounter}`;
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
      for (const reply of c.replies ?? []) insertComment(postId, id, reply, base);
    };

    for (const p of SEED_POSTS) {
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
      for (const c of p.comments ?? []) insertComment(p.id, null, c, created);
    }

    SEED_STORIES.forEach((s, i) => {
      const created = addHours(now, -s.hoursAgo);
      run(
        db,
        `INSERT INTO stories (id, author_type, character_id, world_id, content, style, created_at, expires_at)
         VALUES (?, 'character', ?, ?, ?, ?, ?, ?)`,
        `st-seed-${i + 1}`,
        s.author,
        worldOf.get(s.author) ?? null,
        t(s.content),
        s.style,
        created.toISOString(),
        addHours(created, STORY_LIFETIME_HOURS).toISOString(),
      );
    });

    run(
      db,
      `INSERT INTO notifications (id, kind, params, link, read, created_at) VALUES ('n-welcome', 'welcome', '{}', '/worlds', 0, ?)`,
      now.toISOString(),
    );
    run(
      db,
      `INSERT INTO meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      now.toISOString(),
    );
    run(
      db,
      `INSERT INTO meta (key, value) VALUES ('content_language', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      lang,
    );
  });
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
  'chat_memories',
  'chat_messages',
  'chats',
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
