/** Zentrale Grenzwerte, die Frontend und Backend gemeinsam verwenden. */
export const LIMITS = {
  postContent: 1000,
  commentContent: 500,
  storyContent: 280,
  chatMessage: 2000,
  memoryEntry: 300,
  memoryEntriesPerChat: 40,
  memoryWindowMin: 4,
  memoryWindowMax: 30,
  characterName: 60,
  characterHandle: 30,
  characterShortText: 160,
  characterLongText: 2000,
  characterListItems: 12,
  characterListItem: 60,
  characterRules: 10,
  characterRule: 200,
  worldName: 60,
  worldShortText: 200,
  worldLongText: 3000,
  worldRules: 12,
  worldRule: 200,
  groupName: 60,
  eventTitle: 120,
  eventDescription: 600,
  profileName: 50,
  profileBio: 300,
  tagsPerPost: 8,
  tagLength: 30,
  apiKeyLength: 300,
  modelId: 200,
  fallbackModels: 3,
  playerGoals: 6,
  maxPendingDecisions: 3,
  searchQuery: 80,
} as const;

export const LANGUAGES = ['de', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const WORLD_METRICS = ['harmony', 'tension', 'discovery'] as const;
export type WorldMetric = (typeof WORLD_METRICS)[number];

export const RELATIONSHIP_KINDS = ['friend', 'rival', 'mentor', 'family', 'romance', 'colleague', 'ally'] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const WRITING_STYLES = ['casual', 'formal', 'poetic', 'terse', 'enthusiastic', 'sarcastic', 'scholarly'] as const;
export type WritingStyle = (typeof WRITING_STYLES)[number];

export const ART_STYLES = ['city', 'cosmic', 'forest', 'ocean', 'gears', 'dunes', 'capital', 'stage', 'stadium'] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export const GENRES = [
  'politics',
  'celebrity',
  'business',
  'sports',
  'entertainment',
  'alt-history',
  'cyberpunk',
  'scifi',
  'fantasy',
  'academy',
  'steampunk',
  'postapocalyptic',
  'slice-of-life',
  'mystery',
] as const;
export type Genre = (typeof GENRES)[number];

/** Kategorien für die Weltauswahl auf der Entdecken-Seite. */
export const WORLD_CATEGORIES = ['politics', 'celebrity', 'business', 'sports', 'entertainment', 'scenario', 'fiction'] as const;
export type WorldCategory = (typeof WORLD_CATEGORIES)[number];

export function categoryOfGenre(genre: Genre): WorldCategory {
  switch (genre) {
    case 'politics':
    case 'celebrity':
    case 'business':
    case 'sports':
    case 'entertainment':
      return genre;
    case 'alt-history':
    case 'postapocalyptic':
      return 'scenario';
    default:
      return 'fiction';
  }
}

export const AVATAR_GLYPHS = ['initials', 'spark', 'moon', 'leaf', 'wave', 'gear', 'star', 'flame', 'eye', 'feather'] as const;
export type AvatarGlyph = (typeof AVATAR_GLYPHS)[number];

export const STORY_STYLES = 6;

/** Gültigkeit von Stories in Stunden. */
export const STORY_LIFETIME_HOURS = 24;
