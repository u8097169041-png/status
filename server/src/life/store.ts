/** Datenzugriff für Lebensgeschichten. */
import type { LifeArchetype, LifeGenre, LifeStat, LifeStats } from '../../../shared/life';
import type { AppContext } from '../context';
import { get, parseJson, run } from '../db/database';
import { AppError, notFound } from '../lib/errors';

export interface StoryRow {
  id: string;
  title: string;
  premise: string;
  setup: string;
  genre: string;
  archetype: LifeArchetype;
  player_name: string;
  player_role: string;
  player_appearance: string;
  stats: string;
  stat_keys: string;
  assets: string;
  world: string;
  location: string;
  present: string;
  status: 'active' | 'ended';
  ending: string | null;
  turn: number;
  day: number;
  seed: string;
  lang: 'de' | 'en';
  cover_image_id: string | null;
  summarized_upto: number;
  created_at: string;
  updated_at: string;
  last_tick_at: string;
}

export interface WorldState {
  setting: string;
  locations: string[];
  organizations: string[];
  rules: string[];
  /** Zuletzt gewürfelte Ereignisarten (gegen Wiederholungen). */
  recentEvents?: string[];
  /** Zuletzt gezeigte Vorschläge (gegen Wiederholungen). */
  recentSuggestions?: string[];
  /** Änderungen des letzten Zugs (Anzeige). */
  lastChanges?: LifeStats;
  /** Zähler für Kamera-/Lichtvarianten der Szenenbilder. */
  imageVariation?: number;
}

export function getStory(ctx: AppContext, id: string): StoryRow {
  const row = get<StoryRow>(ctx.db, 'SELECT * FROM life_stories WHERE id = ?', id);
  if (!row) throw notFound('Lebensgeschichte');
  return row;
}

export function requireActive(story: StoryRow): void {
  if (story.status === 'ended') throw new AppError(409, 'story_ended', 'Diese Lebensgeschichte ist beendet.');
}

export const statsOf = (s: StoryRow): LifeStats => parseJson<LifeStats>(s.stats, {});
export const statKeysOf = (s: StoryRow): LifeStat[] => parseJson<LifeStat[]>(s.stat_keys, []);
export const worldOf = (s: StoryRow): WorldState => ({ setting: '', locations: [], organizations: [], rules: [], ...parseJson<Partial<WorldState>>(s.world, {}) });
export const genresOf = (s: StoryRow): LifeGenre[] => s.genre.split(',').filter(Boolean) as LifeGenre[];
export const presentOf = (s: StoryRow): string[] => parseJson<string[]>(s.present, []);

export function saveWorld(ctx: AppContext, storyId: string, world: WorldState): void {
  run(ctx.db, 'UPDATE life_stories SET world = ? WHERE id = ?', JSON.stringify(world), storyId);
}
