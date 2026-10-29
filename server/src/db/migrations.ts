/**
 * Versionierte Datenbankmigrationen. Neue Änderungen immer als neuen Eintrag
 * mit höherer Versionsnummer anhängen – bestehende Einträge nie verändern.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    sql: `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_hue INTEGER NOT NULL DEFAULT 265,
  avatar_glyph TEXT NOT NULL DEFAULT 'initials',
  title_reward TEXT NOT NULL DEFAULT 'title-newcomer',
  accent_reward TEXT NOT NULL DEFAULT 'accent-violet',
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lore TEXT NOT NULL DEFAULT '',
  atmosphere TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '[]',
  art_style TEXT NOT NULL,
  hue INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  day INTEGER NOT NULL DEFAULT 1,
  harmony INTEGER NOT NULL DEFAULT 50,
  tension INTEGER NOT NULL DEFAULT 30,
  discovery INTEGER NOT NULL DEFAULT 40,
  tick_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  world_id TEXT REFERENCES worlds(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '[]',
  interests TEXT NOT NULL DEFAULT '[]',
  background TEXT NOT NULL DEFAULT '',
  writing_style TEXT NOT NULL DEFAULT 'casual',
  style_notes TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '[]',
  avatar_hue INTEGER NOT NULL,
  avatar_glyph TEXT NOT NULL DEFAULT 'initials',
  is_custom INTEGER NOT NULL DEFAULT 0,
  is_real_person_sim INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'neutral',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_characters_world ON characters(world_id);

CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  world_id TEXT REFERENCES worlds(id) ON DELETE CASCADE,
  a_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  b_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  affinity INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  CHECK (a_id < b_id),
  UNIQUE (a_id, b_id)
);
CREATE INDEX idx_relationships_world ON relationships(world_id);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  hue INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (group_id, character_id)
);

CREATE TABLE storylines (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  stages TEXT NOT NULL DEFAULT '[]',
  stage INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'discovery',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE world_events (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  effects TEXT NOT NULL DEFAULT '[]',
  participants TEXT NOT NULL DEFAULT '[]',
  storyline_id TEXT REFERENCES storylines(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_world ON world_events(world_id, created_at);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'character')),
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  world_id TEXT REFERENCES worlds(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  repost_of TEXT REFERENCES posts(id) ON DELETE SET NULL,
  repost_of_deleted INTEGER NOT NULL DEFAULT 0,
  event_id TEXT REFERENCES world_events(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT
);
CREATE INDEX idx_posts_created ON posts(created_at);
CREATE INDEX idx_posts_character ON posts(character_id);
CREATE INDEX idx_posts_world ON posts(world_id);

CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX idx_post_tags_tag ON post_tags(tag);

CREATE TABLE user_likes (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE character_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, character_id)
);

CREATE TABLE bookmarks (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'character')),
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);

CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'character')),
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  world_id TEXT REFERENCES worlds(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  style INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_stories_expires ON stories(expires_at);

CREATE TABLE story_views (
  story_id TEXT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL
);

CREATE TABLE chats (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  memory_enabled INTEGER NOT NULL DEFAULT 1,
  memory_window INTEGER NOT NULL DEFAULT 12,
  summarized_upto INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL REFERENCES chats(character_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chat_messages_chat ON chat_messages(character_id, id);

CREATE TABLE chat_memories (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES chats(character_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'summary')),
  source TEXT NOT NULL CHECK (source IN ('rule', 'ai', 'user')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chat_memories_chat ON chat_memories(character_id);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  ref TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (action, ref, day)
);
CREATE INDEX idx_activity_day ON activity_log(day, action);

CREATE TABLE xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  amount INTEGER NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_xp_day ON xp_events(day, action);

CREATE TABLE quest_claims (
  quest_id TEXT NOT NULL,
  period TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (quest_id, period)
);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL
);

CREATE TABLE encounters (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  first_at TEXT NOT NULL
);

CREATE TABLE world_visits (
  world_id TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  first_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_created ON notifications(created_at);

CREATE TABLE scheduled_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_jobs_due ON scheduled_jobs(status, due_at);

CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  cost_estimated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_code TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ai_usage_day ON ai_usage(day);
CREATE INDEX idx_ai_usage_month ON ai_usage(month);

CREATE TABLE simulation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id TEXT,
  trigger TEXT NOT NULL,
  day TEXT NOT NULL,
  events INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_simulation_log_day ON simulation_log(day, trigger);
`,
  },
  {
    version: 2,
    name: 'players-decisions-economy',
    sql: `
ALTER TABLE characters ADD COLUMN goals TEXT NOT NULL DEFAULT '[]';
ALTER TABLE characters ADD COLUMN prominent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN is_player INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_profile ADD COLUMN active_world_id TEXT;
ALTER TABLE user_profile ADD COLUMN frame_item TEXT NOT NULL DEFAULT '';
ALTER TABLE user_profile ADD COLUMN banner_item TEXT NOT NULL DEFAULT '';

-- Spielfiguren: eine aktive Figur pro Welt, frühere Figuren bleiben mit ihren Daten erhalten.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('custom', 'existing')),
  is_active INTEGER NOT NULL DEFAULT 1,
  reputation INTEGER NOT NULL DEFAULT 0,
  influence INTEGER NOT NULL DEFAULT 10,
  followers INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  retired_at TEXT
);
CREATE UNIQUE INDEX idx_players_active ON players(world_id) WHERE is_active = 1;
CREATE INDEX idx_players_world ON players(world_id);
CREATE INDEX idx_players_character ON players(character_id);

-- Entscheidungen der Spielfigur und ihr Ergebnis (Storyverlauf).
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  options TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  storyline_id TEXT REFERENCES storylines(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  chosen_option TEXT,
  outcome TEXT,
  event_id TEXT REFERENCES world_events(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX idx_decisions_player ON decisions(player_id, status);

-- Spielwährung als Buchungsjournal: jeder Schlüssel nur einmal (keine Doppelbelohnung).
CREATE TABLE wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE purchases (
  item_id TEXT PRIMARY KEY,
  purchased_at TEXT NOT NULL
);

ALTER TABLE posts ADD COLUMN player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE stories ADD COLUMN player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN world_id TEXT;
CREATE INDEX idx_stories_world ON stories(world_id);

-- Chats werden zu Gesprächen zwischen einer Spielfigur und einer Figur.
-- Bestehende Chats bleiben als Gespräche ohne Spielfigur erhalten.
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  memory_enabled INTEGER NOT NULL DEFAULT 1,
  memory_window INTEGER NOT NULL DEFAULT 12,
  summarized_upto INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id, character_id)
);
INSERT INTO conversations (id, player_id, character_id, memory_enabled, memory_window, summarized_upto, created_at, updated_at)
  SELECT 'conv_legacy_' || character_id, NULL, character_id, memory_enabled, memory_window, summarized_upto, created_at, updated_at FROM chats;

CREATE TABLE conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO conversation_messages (id, conversation_id, role, content, source, model, created_at)
  SELECT id, 'conv_legacy_' || character_id, role, content, source, model, created_at FROM chat_messages;
CREATE INDEX idx_conversation_messages ON conversation_messages(conversation_id, id);

CREATE TABLE conversation_memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'summary')),
  source TEXT NOT NULL CHECK (source IN ('rule', 'ai', 'user')),
  created_at TEXT NOT NULL
);
INSERT INTO conversation_memories (id, conversation_id, content, kind, source, created_at)
  SELECT id, 'conv_legacy_' || character_id, content, kind, source, created_at FROM chat_memories;
CREATE INDEX idx_conversation_memories ON conversation_memories(conversation_id);

DROP TABLE chat_memories;
DROP TABLE chat_messages;
DROP TABLE chats;
`,
  },
  {
    version: 3,
    name: 'quests-skills-arcs',
    sql: `
-- Rolle und Hauptziel der Spielfigur (leer = wird beim ersten Zugriff aus Rolle und Welt bestimmt).
ALTER TABLE players ADD COLUMN archetype TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN goal_type TEXT NOT NULL DEFAULT '';

-- Fähigkeiten je Spielfigur.
CREATE TABLE player_skills (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, skill_id)
);

-- Haupt-, Neben- und Ereignisquests je Spielfigur. dedupe_key verhindert doppelte Quests.
CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('main', 'side', 'event')),
  template TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  paths TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  stage INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  rewards TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  completed_path INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  expires_day INTEGER,
  UNIQUE (player_id, dedupe_key)
);
CREATE INDEX idx_quests_player ON quests(player_id, status);

-- Begrenzte Aktionen (Dialogoptionen, Boni): einmal pro Tag (day = Datum) oder einmalig (day = 'once').
CREATE TABLE action_uses (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ref TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (player_id, action, ref, day)
);

-- Handlungsbögen mit mehreren Enden.
ALTER TABLE storylines ADD COLUMN endings TEXT NOT NULL DEFAULT '[]';
ALTER TABLE storylines ADD COLUMN path_scores TEXT NOT NULL DEFAULT '{}';
ALTER TABLE storylines ADD COLUMN ending_id TEXT;
`,
  },
  {
    version: 4,
    name: 'hybrid-ai-providers',
    sql: `
-- Herkunft von KI-Inhalten: lokale KI, Server-KI oder simulierte (regelbasierte) KI.
ALTER TABLE ai_usage ADD COLUMN provider TEXT NOT NULL DEFAULT 'server';
CREATE INDEX idx_ai_usage_provider_day ON ai_usage(provider, day);
ALTER TABLE conversation_messages ADD COLUMN provider TEXT;
UPDATE conversation_messages SET provider = CASE source WHEN 'ai' THEN 'server' WHEN 'demo' THEN 'fallback' ELSE NULL END;
`,
  },
  {
    version: 5,
    name: 'world-cover-images',
    sql: `
-- Eigenes Titelbild einer Welt: Dateiname im Upload-Ordner (data/uploads/covers), NULL = generierte Grafik.
ALTER TABLE worlds ADD COLUMN cover_image TEXT;
`,
  },
];
