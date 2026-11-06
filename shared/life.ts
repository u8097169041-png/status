/**
 * Lebenssimulation: frei definierte, fortlaufende Geschichten mit eigenem Wertesystem.
 * Werte reichen von 0 bis 100. „heat“ (Aufmerksamkeit von Polizei und Feinden) ist umso gefährlicher, je höher er ist.
 */
import type { Appearance } from './appearance';

export const LIFE_STATS = [
  'health',
  'power',
  'influence',
  'wealth',
  'reputation',
  'authority',
  'trust',
  'relationships',
  'skills',
  'loyalty',
  'standing',
  'heat',
] as const;
export type LifeStat = (typeof LIFE_STATS)[number];
export type LifeStats = Partial<Record<LifeStat, number>>;

export const LIFE_ARCHETYPES = ['crime_boss', 'gangster', 'politician', 'entrepreneur', 'celebrity', 'law', 'ordinary'] as const;
export type LifeArchetype = (typeof LIFE_ARCHETYPES)[number];

export const LIFE_GENRES = ['crime', 'romance', 'politics', 'business', 'fame', 'drama'] as const;
export type LifeGenre = (typeof LIFE_GENRES)[number];

export const SUGGESTION_KINDS = ['smart', 'alternative', 'risky', 'surprising'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const ACTION_CATEGORIES = [
  'talk',
  'persuade',
  'threaten',
  'violence',
  'deceive',
  'business',
  'romance',
  'help',
  'investigate',
  'rest',
  'public',
  'crime',
  'travel',
  'wait',
] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

export const OUTCOME_TIERS = ['critical_success', 'success', 'partial', 'failure', 'critical_failure'] as const;
export type OutcomeTier = (typeof OUTCOME_TIERS)[number];

export const CHARACTER_STANCES = ['ally', 'friend', 'love', 'family', 'neutral', 'rival', 'enemy', 'ex', 'subordinate', 'boss'] as const;
export type CharacterStance = (typeof CHARACTER_STANCES)[number];

export const LIFE_CHARACTER_STATUSES = ['alive', 'dead', 'missing', 'imprisoned', 'gone'] as const;
export type LifeCharacterStatus = (typeof LIFE_CHARACTER_STATUSES)[number];

/** Welche Werte eine Geschichte mit dieser Rolle verwendet (Reihenfolge = Anzeige). */
export const ARCHETYPE_STATS: Record<LifeArchetype, LifeStat[]> = {
  crime_boss: ['health', 'power', 'influence', 'wealth', 'authority', 'loyalty', 'reputation', 'heat', 'relationships', 'skills'],
  gangster: ['health', 'power', 'wealth', 'loyalty', 'reputation', 'heat', 'skills', 'relationships'],
  politician: ['health', 'influence', 'power', 'reputation', 'trust', 'authority', 'standing', 'wealth', 'relationships', 'skills'],
  entrepreneur: ['health', 'wealth', 'influence', 'reputation', 'trust', 'skills', 'relationships', 'standing'],
  celebrity: ['health', 'reputation', 'influence', 'wealth', 'trust', 'relationships', 'skills'],
  law: ['health', 'authority', 'trust', 'skills', 'reputation', 'relationships', 'standing', 'wealth'],
  ordinary: ['health', 'wealth', 'relationships', 'trust', 'skills', 'reputation', 'standing'],
};

export interface LifeSuggestion {
  id: string;
  kind: SuggestionKind;
  text: string;
  category: ActionCategory;
  /** 1 = vorsichtig … 3 = sehr riskant. */
  risk: 1 | 2 | 3;
  targetId: string | null;
}

export interface LifeResolutionDto {
  category: ActionCategory;
  tier: OutcomeTier;
  /** Erfolgswahrscheinlichkeit (0–1) laut Spielsystem – nachvollziehbar statt vom Sprachmodell entschieden. */
  chance: number;
  statChanges: LifeStats;
  targetName: string | null;
}

export interface LifeCharacterDto {
  id: string;
  name: string;
  role: string;
  description: string;
  personality: string[];
  goals: string[];
  status: LifeCharacterStatus;
  statusNote: string;
  affinity: number;
  trust: number;
  loyalty: number;
  fear: number;
  stance: CharacterStance;
  appearance: Appearance;
  avatarUrl: string;
  hasPhoto: boolean;
  fromSocial: boolean;
}

export interface LifeMessageDto {
  id: number;
  turn: number;
  role: 'player' | 'narrator' | 'character' | 'event' | 'system' | 'image';
  speakerId: string | null;
  speakerName: string | null;
  content: string;
  pending: boolean;
  suggestions?: LifeSuggestion[];
  resolution?: LifeResolutionDto;
  severity?: 'minor' | 'major' | 'critical';
  /** Überschrift eines Ereignisses. */
  title?: string;
  imageUrl?: string | null;
  /** Gezeichnete Szenenkarte (ohne Bild-KI): beteiligte Figuren und Ort. */
  sceneCard?: { location: string; characterIds: string[]; caption: string; mood: string } | null;
  away?: boolean;
  createdAt: string;
}

export interface LifeEventDto {
  id: string;
  turn: number;
  day: number;
  kind: string;
  title: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  imageUrl: string | null;
  createdAt: string;
}

export interface LifeMemoryDto {
  id: string;
  turn: number;
  kind: string;
  content: string;
  importance: number;
  critical: boolean;
  knownBy: string[];
  source: string;
}

export interface LifeStorySummaryDto {
  id: string;
  title: string;
  genres: LifeGenre[];
  archetype: LifeArchetype;
  playerName: string;
  playerRole: string;
  status: 'active' | 'ended';
  ending: string | null;
  day: number;
  turn: number;
  location: string;
  coverUrl: string | null;
  highlight: { stat: LifeStat; value: number }[];
  updatedAt: string;
}

export interface LifeStoryDto extends LifeStorySummaryDto {
  premise: string;
  setting: string;
  locations: string[];
  organizations: string[];
  statKeys: LifeStat[];
  stats: LifeStats;
  /** Änderungen durch den letzten Zug (für die Anzeige). */
  lastChanges: LifeStats;
  assets: string[];
  promises: LifeMemoryDto[];
  playerAppearance: Appearance;
  playerAvatarUrl: string;
  characters: LifeCharacterDto[];
  messages: LifeMessageDto[];
  hasOlderMessages: boolean;
  events: LifeEventDto[];
  narrating: boolean;
  imageJob: import('./types').ImageJobDto | null;
}

export interface LifeSetupCharacter {
  name: string;
  role: string;
  description: string;
  personality: string[];
  goals: string[];
  secrets: string[];
  appearance?: Appearance;
  stance: CharacterStance;
  affinity: number;
  trust: number;
  loyalty: number;
  fear: number;
  socialCharacterId?: string | null;
}

export interface LifeSetupDraft {
  title: string;
  premise: string;
  genres: LifeGenre[];
  archetype: LifeArchetype;
  playerName: string;
  playerRole: string;
  playerAppearance: Appearance;
  setting: string;
  location: string;
  locations: string[];
  organizations: string[];
  rules: string[];
  opening: string;
  characters: LifeSetupCharacter[];
  relations: { a: string; b: string; kind: string; affinity: number; note: string }[];
  stats: LifeStats;
  statKeys: LifeStat[];
  assets: string[];
  source: 'ai' | 'rules';
  notice?: string;
}

export interface LifeSetupJobDto {
  id: string;
  status: 'running' | 'done';
  elapsedMs: number;
  tokens: number;
  draft: LifeSetupDraft | null;
}

export const clampStat = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));
