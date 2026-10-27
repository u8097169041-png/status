import type {
  ArtStyle,
  AvatarGlyph,
  Genre,
  Lang,
  RelationshipKind,
  WorldMetric,
  WritingStyle,
} from './constants';
import type { RelationshipStatus } from './relationships';
import type { LevelInfo } from './progress';

export type AuthorType = 'user' | 'character';
/** Herkunft eines Inhalts: Beispieldaten, Nutzer, lokale Simulation, echte KI oder lokale Demo-Generierung. */
export type ContentSource = 'seed' | 'user' | 'sim' | 'ai' | 'demo';

export interface AuthorRef {
  type: AuthorType;
  id: string | null;
  name: string;
  handle: string;
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
  isRealPersonSim: boolean;
  worldId: string | null;
}

export interface PostDto {
  id: string;
  author: AuthorRef;
  worldId: string | null;
  worldName: string | null;
  worldHue: number | null;
  content: string;
  tags: string[];
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  repostedByMe: boolean;
  repostOf: PostDto | null;
  repostOfDeleted: boolean;
  source: ContentSource;
  eventId: string | null;
  isOwn: boolean;
}

export interface CommentDto {
  id: string;
  postId: string;
  parentId: string | null;
  author: AuthorRef;
  content: string;
  createdAt: string;
  source: ContentSource;
  isOwn: boolean;
  replies: CommentDto[];
}

export interface PostDetailDto {
  post: PostDto;
  comments: CommentDto[];
}

export interface FeedPage {
  items: PostDto[];
  nextCursor: string | null;
}

export interface StoryDto {
  id: string;
  author: AuthorRef;
  worldId: string | null;
  content: string;
  style: number;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  isOwn: boolean;
}

export interface CharacterSummary {
  id: string;
  name: string;
  handle: string;
  tagline: string;
  role: string;
  worldId: string | null;
  worldName: string | null;
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
  isCustom: boolean;
  isRealPersonSim: boolean;
  mood: string;
  postCount: number;
}

export interface CharacterDetail extends CharacterSummary {
  description: string;
  personality: string[];
  interests: string[];
  background: string;
  writingStyle: WritingStyle;
  styleNotes: string;
  rules: string[];
  createdAt: string;
  relationships: RelationshipDto[];
  groups: { id: string; name: string; hue: number; role: string }[];
  stats: {
    chatMessages: number;
    lastChatAt: string | null;
    likesGiven: number;
    commentsOnYourPosts: number;
    eventsInvolved: number;
  };
}

export interface CharacterInput {
  name: string;
  handle: string;
  tagline: string;
  description: string;
  role: string;
  worldId: string | null;
  personality: string[];
  interests: string[];
  background: string;
  writingStyle: WritingStyle;
  styleNotes: string;
  rules: string[];
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
  isRealPersonSim: boolean;
}

export type WorldMetrics = Record<WorldMetric, number>;

export interface WorldSummary {
  id: string;
  name: string;
  tagline: string;
  genre: Genre;
  artStyle: ArtStyle;
  hue: number;
  isCustom: boolean;
  day: number;
  metrics: WorldMetrics;
  characterCount: number;
  activeStorylines: number;
  lastEventAt: string | null;
  lastEventTitle: string | null;
}

export interface WorldDetail extends WorldSummary {
  description: string;
  lore: string;
  atmosphere: string;
  rules: string[];
  createdAt: string;
  characters: CharacterSummary[];
  relationships: RelationshipDto[];
  groups: GroupDto[];
  storylines: StorylineDto[];
  recentEvents: WorldEventDto[];
}

export interface WorldInput {
  name: string;
  tagline: string;
  genre: Genre;
  description: string;
  lore: string;
  atmosphere: string;
  rules: string[];
  artStyle: ArtStyle;
  hue: number;
}

export interface WorldDraft extends WorldInput {
  characters: Omit<CharacterInput, 'worldId'>[];
  source: 'ai' | 'demo';
  notice?: string;
}

export interface CharacterRef {
  id: string;
  name: string;
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
}

export interface RelationshipDto {
  id: string;
  worldId: string | null;
  a: CharacterRef;
  b: CharacterRef;
  kind: RelationshipKind;
  affinity: number;
  status: RelationshipStatus;
  note: string;
  updatedAt: string;
}

export interface GroupDto {
  id: string;
  worldId: string;
  name: string;
  description: string;
  hue: number;
  members: { character: CharacterRef; role: string }[];
}

export interface StorylineDto {
  id: string;
  worldId: string;
  title: string;
  summary: string;
  stages: string[];
  stage: number;
  status: 'active' | 'resolved';
  updatedAt: string;
}

export type EventEffect =
  | { type: 'metric'; metric: WorldMetric; delta: number }
  | { type: 'affinity'; a: CharacterRef; b: CharacterRef; delta: number; affinity: number }
  | { type: 'relationshipKind'; a: CharacterRef; b: CharacterRef; from: RelationshipKind; to: RelationshipKind }
  | { type: 'storyline'; storylineId: string; title: string; stage: number; resolved: boolean };

export interface WorldEventDto {
  id: string;
  worldId: string;
  day: number;
  kind: string;
  title: string;
  description: string;
  source: 'seed' | 'sim' | 'user' | 'ai';
  effects: EventEffect[];
  participants: CharacterRef[];
  createdAt: string;
}

export interface EventCard {
  id: string;
  needsTargets: 0 | 1 | 2;
  metricHints: Partial<Record<WorldMetric, number>>;
}

export interface TriggerEventInput {
  cardId: string;
  targetIds: string[];
  customTitle?: string;
  customDescription?: string;
  customEffect?: 'harmony' | 'tension' | 'discovery';
}

export interface SimulationResult {
  world: WorldSummary;
  events: WorldEventDto[];
  postsCreated: number;
  aiCalls: number;
  notice?: string;
}

export interface ChatSummary {
  characterId: string;
  character: CharacterSummary;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

export interface ChatMessageDto {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  source: 'user' | 'ai' | 'demo';
  model: string | null;
  createdAt: string;
}

export interface MemoryEntryDto {
  id: string;
  content: string;
  kind: 'fact' | 'summary';
  source: 'rule' | 'ai' | 'user';
  createdAt: string;
}

export interface ChatDetail {
  characterId: string;
  character: CharacterSummary;
  messages: ChatMessageDto[];
  memoryEnabled: boolean;
  memoryWindow: number;
  memories: MemoryEntryDto[];
}

export interface SendMessageResult {
  userMessage: ChatMessageDto;
  reply: ChatMessageDto;
  notice?: AiNotice;
  progress: ProgressDelta;
}

export interface AiNotice {
  code: string;
  message?: string;
}

export interface UserProfileDto {
  displayName: string;
  handle: string;
  bio: string;
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
  titleReward: string;
  accentReward: string;
  createdAt: string;
}

export interface ProgressDelta {
  xpGained: number;
  levelUp: number | null;
  achievementsUnlocked: string[];
}

export interface QuestProgressDto {
  id: string;
  kind: 'daily' | 'general';
  target: number;
  current: number;
  xp: number;
  completed: boolean;
  claimed: boolean;
}

export interface ProgressDto {
  level: LevelInfo;
  todayXp: number;
  daily: QuestProgressDto[];
  general: QuestProgressDto[];
  achievements: { id: string; icon: string; target: number; current: number; unlockedAt: string | null }[];
  rewards: { id: string; type: 'title' | 'accent'; unlocked: boolean; unlock: { type: 'level'; level: number } | { type: 'achievement'; id: string } }[];
  collections: {
    characters: { id: string; name: string; avatarHue: number; avatarGlyph: AvatarGlyph; metAt: string | null }[];
    worlds: { id: string; name: string; hue: number; artStyle: ArtStyle; visitedAt: string | null }[];
  };
  recentXp: { action: string; amount: number; createdAt: string }[];
}

export interface NotificationDto {
  id: string;
  kind: string;
  params: Record<string, string | number>;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface AiSettings {
  enabled: boolean;
  chatModel: string;
  worldModel: string;
  fallbackModels: string[];
  maxTokens: number;
  temperature: number;
  timeoutSeconds: number;
  dailyRequestLimit: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  worldActivityEnabled: boolean;
  worldDailyLimit: number;
  reactionsEnabled: boolean;
  summariesEnabled: boolean;
}

export interface SimulationSettings {
  autoEnabled: boolean;
  intervalMinutes: number;
  maxEventsPerTick: number;
  maxAutoTicksPerDay: number;
  reactionsEnabled: boolean;
}

export interface MemorySettings {
  defaultWindow: number;
  autoFacts: boolean;
}

export interface PrivacySettings {
  sendDisplayName: boolean;
}

export interface AppSettings {
  language: Lang;
  onboardingDone: boolean;
  ai: AiSettings;
  simulation: SimulationSettings;
  memory: MemorySettings;
  privacy: PrivacySettings;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export interface AiUsageSummary {
  requests: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  costKnown: boolean;
}

export interface AiStatusDto {
  keyConfigured: boolean;
  keySource: 'env' | 'local' | null;
  keyHint: string | null;
  enabled: boolean;
  chatModel: string;
  worldModel: string;
  mode: 'ai' | 'demo';
  demoReason: 'no-key' | 'no-model' | 'disabled' | null;
  today: AiUsageSummary;
  month: AiUsageSummary;
  limits: {
    dailyRequestsReached: boolean;
    dailyBudgetReached: boolean;
    monthlyBudgetReached: boolean;
  };
  lastError: { code: string; message: string; at: string } | null;
}

export interface AiModelDto {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number | null; // USD pro Token
  completionPrice: number | null;
  isFree: boolean;
}

export interface AiUsageEntryDto {
  id: number;
  createdAt: string;
  purpose: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  costEstimated: boolean;
  status: 'ok' | 'error';
  errorCode: string | null;
  durationMs: number;
}

export interface AiTestResult {
  ok: boolean;
  model: string | null;
  reply?: string;
  error?: { code: string; message: string };
  durationMs: number;
}

export interface SimulationStatusDto {
  autoEnabled: boolean;
  intervalMinutes: number;
  ticksToday: number;
  maxAutoTicksPerDay: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
  aiWorldCallsToday: number;
  worldDailyLimit: number;
  aiWorldActive: boolean;
}

export interface BootstrapDto {
  profile: UserProfileDto;
  settings: AppSettings;
  ai: AiStatusDto;
  level: LevelInfo;
  unreadNotifications: number;
  version: string;
  /** Sprache, in der die Demo-Inhalte angelegt wurden. */
  contentLanguage: Lang;
  /** Ob bereits eigene Inhalte oder Fortschritt existieren (für das Onboarding). */
  hasUserActivity: boolean;
}

export interface TrendingTag {
  tag: string;
  count: number;
}

export interface DiscoverDto {
  featuredWorld: WorldSummary | null;
  worlds: WorldSummary[];
  characters: CharacterSummary[];
  trendingTags: TrendingTag[];
  storylines: (StorylineDto & { worldName: string; worldHue: number })[];
  recentEvents: (WorldEventDto & { worldName: string; worldHue: number })[];
  highlightPosts: PostDto[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
