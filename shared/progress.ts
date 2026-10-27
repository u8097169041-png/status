/**
 * Definitionen für Erfahrungspunkte, Level, Quests, Erfolge und Belohnungen.
 * Texte liegen in den Übersetzungsdateien des Frontends (Schlüssel = id).
 */

export const XP_ACTIONS = [
  'post',
  'comment',
  'like',
  'repost',
  'bookmark',
  'story',
  'chat',
  'chatWith',
  'createCharacter',
  'createWorld',
  'triggerEvent',
  'simulate',
  'visitWorld',
  'meetCharacter',
] as const;
export type XpAction = (typeof XP_ACTIONS)[number];

/** XP pro Aktion und Tagesobergrenze (Anzahl belohnter Aktionen pro Tag). */
export const XP_RULES: Record<XpAction, { xp: number; dailyCap: number }> = {
  post: { xp: 15, dailyCap: 5 },
  comment: { xp: 5, dailyCap: 10 },
  like: { xp: 2, dailyCap: 15 },
  repost: { xp: 4, dailyCap: 5 },
  bookmark: { xp: 1, dailyCap: 5 },
  story: { xp: 10, dailyCap: 3 },
  chat: { xp: 3, dailyCap: 20 },
  chatWith: { xp: 0, dailyCap: 0 },
  createCharacter: { xp: 40, dailyCap: 5 },
  createWorld: { xp: 60, dailyCap: 3 },
  triggerEvent: { xp: 15, dailyCap: 6 },
  simulate: { xp: 5, dailyCap: 10 },
  visitWorld: { xp: 5, dailyCap: 20 },
  meetCharacter: { xp: 5, dailyCap: 30 },
};

/** Gesamte XP, die für das Erreichen eines Levels nötig sind. */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0 … 1
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
  };
}

export type QuestMetric =
  | { type: 'action'; action: XpAction }
  | { type: 'distinct'; action: XpAction }
  | { type: 'level' };

export interface QuestDef {
  id: string;
  kind: 'daily' | 'general';
  metric: QuestMetric;
  target: number;
  xp: number;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'daily-like', kind: 'daily', metric: { type: 'action', action: 'like' }, target: 3, xp: 20 },
  { id: 'daily-post', kind: 'daily', metric: { type: 'action', action: 'post' }, target: 1, xp: 25 },
  { id: 'daily-comment', kind: 'daily', metric: { type: 'action', action: 'comment' }, target: 2, xp: 20 },
  { id: 'daily-chat', kind: 'daily', metric: { type: 'action', action: 'chat' }, target: 5, xp: 25 },
  { id: 'daily-chat-distinct', kind: 'daily', metric: { type: 'distinct', action: 'chatWith' }, target: 2, xp: 30 },
  { id: 'daily-event', kind: 'daily', metric: { type: 'action', action: 'triggerEvent' }, target: 1, xp: 30 },
  { id: 'daily-simulate', kind: 'daily', metric: { type: 'action', action: 'simulate' }, target: 1, xp: 20 },
  { id: 'daily-story', kind: 'daily', metric: { type: 'action', action: 'story' }, target: 1, xp: 20 },
];

export const DAILY_QUEST_COUNT = 3;

export const GENERAL_QUESTS: QuestDef[] = [
  { id: 'first-post', kind: 'general', metric: { type: 'action', action: 'post' }, target: 1, xp: 30 },
  { id: 'first-chat', kind: 'general', metric: { type: 'action', action: 'chat' }, target: 1, xp: 30 },
  { id: 'first-character', kind: 'general', metric: { type: 'action', action: 'createCharacter' }, target: 1, xp: 50 },
  { id: 'first-world', kind: 'general', metric: { type: 'action', action: 'createWorld' }, target: 1, xp: 60 },
  { id: 'meet-five', kind: 'general', metric: { type: 'distinct', action: 'meetCharacter' }, target: 5, xp: 50 },
  { id: 'explore-worlds', kind: 'general', metric: { type: 'distinct', action: 'visitWorld' }, target: 5, xp: 50 },
  { id: 'event-maker', kind: 'general', metric: { type: 'action', action: 'triggerEvent' }, target: 5, xp: 60 },
  { id: 'reach-level-5', kind: 'general', metric: { type: 'level' }, target: 5, xp: 100 },
];

/** Wählt deterministisch die Tagesquests für ein Datum (YYYY-MM-DD). */
export function dailyQuestsFor(day: string): QuestDef[] {
  let hash = 2166136261;
  for (const ch of day) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const pool = [...DAILY_QUESTS];
  const picked: QuestDef[] = [];
  let state = hash >>> 0;
  while (picked.length < DAILY_QUEST_COUNT && pool.length > 0) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    picked.push(pool.splice(state % pool.length, 1)[0]);
  }
  return picked;
}

export type AchievementMetric =
  | { type: 'action'; action: XpAction }
  | { type: 'distinct'; action: XpAction }
  | { type: 'level' }
  | { type: 'likesReceived' }
  | { type: 'storylinesResolved' };

export interface AchievementDef {
  id: string;
  metric: AchievementMetric;
  target: number;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', metric: { type: 'action', action: 'post' }, target: 1, icon: 'footprints' },
  { id: 'social-butterfly', metric: { type: 'distinct', action: 'chatWith' }, target: 5, icon: 'messages' },
  { id: 'chatterbox', metric: { type: 'action', action: 'chat' }, target: 100, icon: 'message' },
  { id: 'curator', metric: { type: 'action', action: 'bookmark' }, target: 10, icon: 'bookmark' },
  { id: 'creator', metric: { type: 'action', action: 'createCharacter' }, target: 1, icon: 'user-plus' },
  { id: 'worldbuilder', metric: { type: 'action', action: 'createWorld' }, target: 1, icon: 'globe' },
  { id: 'puppeteer', metric: { type: 'action', action: 'triggerEvent' }, target: 10, icon: 'zap' },
  { id: 'chronicler', metric: { type: 'storylinesResolved' }, target: 1, icon: 'scroll' },
  { id: 'popular', metric: { type: 'likesReceived' }, target: 25, icon: 'heart' },
  { id: 'veteran', metric: { type: 'level' }, target: 10, icon: 'crown' },
];

export interface RewardDef {
  id: string;
  type: 'title' | 'accent';
  unlock: { type: 'level'; level: number } | { type: 'achievement'; id: string };
}

export const REWARDS: RewardDef[] = [
  { id: 'title-newcomer', type: 'title', unlock: { type: 'level', level: 1 } },
  { id: 'title-explorer', type: 'title', unlock: { type: 'level', level: 3 } },
  { id: 'title-storyteller', type: 'title', unlock: { type: 'level', level: 5 } },
  { id: 'title-worldshaper', type: 'title', unlock: { type: 'level', level: 8 } },
  { id: 'title-legend', type: 'title', unlock: { type: 'level', level: 12 } },
  { id: 'title-architect', type: 'title', unlock: { type: 'achievement', id: 'worldbuilder' } },
  { id: 'title-confidant', type: 'title', unlock: { type: 'achievement', id: 'social-butterfly' } },
  { id: 'accent-violet', type: 'accent', unlock: { type: 'level', level: 1 } },
  { id: 'accent-cyan', type: 'accent', unlock: { type: 'level', level: 2 } },
  { id: 'accent-amber', type: 'accent', unlock: { type: 'level', level: 4 } },
  { id: 'accent-rose', type: 'accent', unlock: { type: 'level', level: 6 } },
  { id: 'accent-aurora', type: 'accent', unlock: { type: 'achievement', id: 'chronicler' } },
];
