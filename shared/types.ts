import type { Archetype, ChatActionId, GoalType, SkillId } from './skills';
import type {
  ArtStyle,
  AvatarGlyph,
  Genre,
  Lang,
  RelationshipKind,
  WorldCategory,
  WorldMetric,
  WritingStyle,
} from './constants';
import type { ShopItemType } from './economy';
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
  /** Bekannte Figur dieser Welt („verifiziert“). */
  verified: boolean;
  /** Bei eigenen Inhalten: die Spielfigur, mit der gepostet wurde. */
  playerId?: string | null;
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
  /** Bekannte Figur der Welt – kann als Spielfigur übernommen werden. */
  prominent: boolean;
  /** Eigene Spielfigur des Nutzers. */
  isPlayer: boolean;
  /** Wird aktuell vom Nutzer gespielt (nimmt nicht an der autonomen Simulation teil). */
  playedByYou: boolean;
}

export interface CharacterDetail extends CharacterSummary {
  description: string;
  personality: string[];
  interests: string[];
  background: string;
  writingStyle: WritingStyle;
  styleNotes: string;
  rules: string[];
  goals: string[];
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
  goals?: string[];
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
  category: WorldCategory;
  /** Der Nutzer hat in dieser Welt eine aktive Spielfigur. */
  joined: boolean;
  /** Bekannteste Figuren der Welt (für die Weltkarte). */
  cast: CharacterRef[];
  /** Simulierte Beiträge der letzten 24 Stunden (keine Live-Daten). */
  postsToday: number;
  /** Eigenes Titelbild (URL) oder null für die generierte Grafik. */
  coverUrl: string | null;
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

/** Weltentwurf als Hintergrundauftrag (lange lokale KI-Generierungen). */
export interface GenerationJobDto {
  id: string;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  provider: AiProviderId;
  model: string | null;
  elapsedMs: number;
  /** Bisher erzeugte Tokens und erwartete Gesamtzahl (für die Fortschrittsanzeige). */
  tokens: number;
  expectedTokens: number;
  /** Ergebnis, sobald fertig: KI-Entwurf oder regelbasierter Entwurf mit Grund in `notice`. */
  draft: WorldDraft | null;
  notice: string | null;
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

export type ArcPath = 'bold' | 'diplomatic' | 'neutral';

/** Mögliches Ende eines Handlungsbogens; welches eintritt, hängt von den Entscheidungen ab. */
export interface ArcEndingDto {
  id: string;
  path: ArcPath;
  title: string;
  description: string;
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
  endings: ArcEndingDto[];
  /** Erreichtes Ende (nur bei abgeschlossenen Geschichten). */
  endingId: string | null;
  /** Prognose des Endes – nur sichtbar mit Strategie 2 der aktiven Spielfigur dieser Welt. */
  forecastEndingId?: string | null;
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
  /** Shop-Artikel, der die Karte freischaltet (nur Premium-Karten). */
  shopItem: string | null;
  locked: boolean;
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
  /** Herkunft einer Antwort: lokale KI, Server-KI oder simulierte KI (regelbasiert). */
  provider: AiProviderId | null;
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
  frameItem: string;
  bannerItem: string;
  createdAt: string;
}

export interface ProgressDelta {
  xpGained: number;
  coinsGained?: number;
  levelUp: number | null;
  achievementsUnlocked: string[];
  /** Neues Charakterlevel der Spielfigur (bringt einen Fähigkeitspunkt). */
  playerLevelUp?: number | null;
  /** In dieser Aktion abgeschlossene Quests. */
  questsCompleted?: { id: string; kind: QuestKind; title: string; xp: number }[];
}

export interface QuestProgressDto {
  id: string;
  kind: 'daily' | 'general';
  target: number;
  current: number;
  xp: number;
  coins: number;
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
    worlds: { id: string; name: string; hue: number; artStyle: ArtStyle; coverUrl: string | null; visitedAt: string | null }[];
  };
  recentXp: { action: string; amount: number; createdAt: string }[];
}

export interface NotificationDto {
  id: string;
  worldId: string | null;
  kind: string;
  params: Record<string, string | number>;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** auto = lokale KI bevorzugt; server = zentrale Server-KI (nur mit Freigabe); fallback = nur simulierte KI. */
export type AiMode = 'auto' | 'server' | 'fallback';
export type AiProviderId = 'local' | 'server' | 'fallback';

export interface AiSettings {
  mode: AiMode;
  /** Gewähltes lokales Modell (leer = automatisch aus den installierten Modellen). */
  localModel: string;
  /** Ausdrückliche Freigabe der Server-KI durch den Nutzer (kann Kosten verursachen). */
  serverConsent: boolean;
  maxTokens: number;
  temperature: number;
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

export type AiFallbackReason =
  | 'mode-fallback'
  | 'local-disabled'
  | 'local-unchecked'
  | 'local-unreachable'
  | 'local-no-model'
  | 'local-model-missing'
  | 'server-not-configured'
  | 'server-no-consent'
  | 'server-blocked'
  | 'server-limit';

export interface LocalAiModelDto {
  name: string;
  sizeGb: number | null;
  parameterSize: string | null;
  family: string | null;
}

export interface AiStatusDto {
  mode: AiMode;
  /** Provider, der die nächste Chat-Antwort erzeugt. */
  active: AiProviderId;
  activeModel: string | null;
  /** Warum nicht die bevorzugte echte KI verwendet wird (null = echte KI aktiv). */
  reason: AiFallbackReason | null;
  local: {
    enabledByConfig: boolean;
    baseUrl: string;
    /** Adresse liegt nicht auf diesem Rechner (Daten verlassen dann den Computer). */
    remote: boolean;
    reachable: boolean | null;
    version: string | null;
    models: LocalAiModelDto[];
    model: string | null;
    modelSource: 'env' | 'settings' | 'auto' | null;
    checkedAt: string | null;
    error: string | null;
    timeoutSeconds: number;
    longTimeoutSeconds: number;
    loadTimeoutSeconds: number;
    /** Zuletzt gemessene Geschwindigkeit (Tokens pro Sekunde). */
    tokensPerSecond: number | null;
    lastTimeout: { at: string; message: string } | null;
  };
  server: {
    /** Vom Betreiber in .env aktiviert und vollständig (Zugang, Modell) konfiguriert. */
    configured: boolean;
    enabledByConfig: boolean;
    missing: ('key' | 'model')[];
    consent: boolean;
    host: string | null;
    model: string | null;
    pricesKnown: boolean;
    blockedUntil: string | null;
    limits: {
      maxRequestsPerDay: number;
      maxRequestsPerMinute: number;
      maxTokens: number;
      timeoutSeconds: number;
      dailyBudgetUsd: number;
      monthlyBudgetUsd: number;
    };
  };
  today: AiUsageSummary;
  month: AiUsageSummary;
  localToday: number;
  limits: {
    dailyRequestsReached: boolean;
    dailyBudgetReached: boolean;
    monthlyBudgetReached: boolean;
  };
  /** Ein früher in der App gespeicherter API-Schlüssel liegt noch in der Datenbank (wird nicht mehr verwendet). */
  legacyKeyStored: boolean;
  lastError: { code: string; message: string; at: string; provider: AiProviderId } | null;
}

export interface AiUsageEntryDto {
  id: number;
  createdAt: string;
  provider: AiProviderId;
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
  provider: AiProviderId;
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

export interface PlayerStatsDto {
  reputation: number;
  influence: number;
  followers: number;
  xp: number;
}

export interface SkillPointsDto {
  earned: number;
  spent: number;
  available: number;
}

export interface PlayerDto extends PlayerStatsDto {
  id: string;
  worldId: string;
  worldName: string;
  worldHue: number;
  mode: 'custom' | 'existing';
  isActive: boolean;
  character: CharacterSummary & { background: string; goals: string[]; personality: string[] };
  joinedAt: string;
  lastActiveAt: string;
  retiredAt: string | null;
  pendingDecisions: number;
  /** Charakterlevel dieser Spielfigur (getrennt vom Kontolevel). */
  level: LevelInfo;
  archetype: Archetype;
  goalType: GoalType;
  skills: Record<SkillId, number>;
  skillPoints: SkillPointsDto;
}

export interface JoinWorldInput {
  mode: 'custom' | 'existing';
  characterId?: string;
  character?: {
    name: string;
    background: string;
    role: string;
    personality: string[];
    goals: string[];
    avatarHue: number;
    avatarGlyph: AvatarGlyph;
    /** An eine reale öffentliche Person angelehnt (wird als Simulation gekennzeichnet). */
    isRealPersonSim?: boolean;
  };
  /** Hauptziel der Figur; ohne Angabe passend zur Rolle. */
  goalType?: GoalType;
  /** Muss gesetzt sein, wenn bereits eine aktive Spielfigur existiert (bewusster Charakterwechsel). */
  confirmSwitch?: boolean;
}

export interface DecisionEffectsDto {
  reputation?: number;
  influence?: number;
  followers?: number;
  metrics?: Partial<Record<WorldMetric, number>>;
  affinity?: { characterId: string; name: string; delta: number }[];
  /** Die Option treibt die verknüpfte Geschichte um ein Kapitel voran. */
  advancesStoryline?: boolean;
}

export interface DecisionOptionDto {
  id: string;
  label: string;
  effects: DecisionEffectsDto;
  /** Benötigte Fähigkeit für diese Option. */
  requires?: { skill: SkillId; level: number };
  /** Die aktive Figur erfüllt die Voraussetzung nicht. */
  locked: boolean;
  /** Richtung, in die die Option den Handlungsbogen lenkt. */
  arcPath?: ArcPath;
  /** Ergebnisvorschau – nur mit Strategie 2. */
  outcomePreview?: string;
}

export interface DecisionDto {
  id: string;
  worldId: string;
  playerId: string;
  kind: string;
  title: string;
  description: string;
  options: DecisionOptionDto[];
  status: 'pending' | 'resolved';
  chosenOptionId: string | null;
  outcome: string | null;
  participants: CharacterRef[];
  storylineId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DecisionResult {
  decision: DecisionDto;
  player: PlayerDto;
  progress: ProgressDelta;
}

export interface WorldQuestProgressDto {
  id: string;
  metric: string;
  target: number;
  current: number;
  xp: number;
  coins: number;
  completed: boolean;
  claimed: boolean;
}

export interface WalletDto {
  balance: number;
  recent: { amount: number; reason: string; createdAt: string }[];
}

export interface ShopItemDto {
  id: string;
  type: ShopItemType;
  price: number;
  owned: boolean;
  equipped: boolean;
}

export interface SearchResultDto {
  query: string;
  worlds: WorldSummary[];
  characters: CharacterSummary[];
  posts: PostDto[];
}

export interface ActivityDto {
  notifications: NotificationDto[];
  events: WorldEventDto[];
  decisions: DecisionDto[];
}

export interface BootstrapDto {
  activeWorld: WorldSummary | null;
  activePlayer: PlayerDto | null;
  joinedWorlds: { world: WorldSummary; player: PlayerDto }[];
  coins: number;
  pendingDecisions: number;
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
  /** Bekannte Figuren aller Welten (spielbar). */
  figures: CharacterSummary[];
  /** Beliebte Welten nach simulierter Aktivität. */
  popular: WorldSummary[];
  /** Interaktive Handlungsbögen aller Welten mit ihren möglichen Enden. */
  scenarios: (StorylineDto & { worldName: string; worldHue: number; worldJoined: boolean })[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ---------- Quests, Fähigkeiten, Dialogoptionen ----------

export type QuestKind = 'main' | 'side' | 'event';

export type QuestMetric =
  | 'posts'
  | 'comments'
  | 'stories'
  | 'chatPartners'
  | 'chatWith'
  | 'affinityWith'
  | 'allies'
  | 'friends'
  | 'followersGain'
  | 'reputation'
  | 'influence'
  | 'decisions'
  | 'arcDecisions'
  | 'arcResolved'
  | 'cooperations'
  | 'cooperatedWith'
  | 'negotiatedWith'
  | 'endorsements'
  | 'eventReaction'
  | 'likesReceived';

export interface QuestObjectiveDto {
  metric: QuestMetric;
  target: number;
  current: number;
  done: boolean;
  /** Name der betroffenen Figur oder Geschichte (für die Anzeige). */
  name?: string;
}

export interface QuestPathDto {
  objectives: QuestObjectiveDto[];
  /** Alternativer Lösungsweg, der eine Fähigkeit voraussetzt. */
  requires?: { skill: SkillId; level: number };
  locked: boolean;
}

export interface QuestRewardsDto {
  reputation?: number;
  influence?: number;
  followers?: number;
}

export interface QuestDto {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  stage: number;
  stages: number;
  paths: QuestPathDto[];
  xp: number;
  coins: number;
  rewards: QuestRewardsDto;
  status: 'active' | 'completed' | 'expired';
  progress: number;
  createdAt: string;
  completedAt: string | null;
  /** Ereignisquests: verfällt nach diesem Welttag. */
  expiresDay: number | null;
  /** Verknüpftes Ereignis (zum direkten Reagieren). */
  eventId?: string | null;
}

export interface QuestBoardDto {
  player: PlayerDto;
  worldDay: number;
  main: QuestDto | null;
  side: QuestDto[];
  events: QuestDto[];
  completed: QuestDto[];
  mainStagesCompleted: number;
}

export interface SkillDto {
  id: SkillId;
  level: number;
  maxLevel: number;
  core: boolean;
  /** Kosten der nächsten Stufe in Fähigkeitspunkten. */
  cost: number;
  /** Charakterlevel, das für die nächste Stufe nötig ist. */
  nextRequiredLevel: number | null;
  canUpgrade: boolean;
  blockedReason: 'max' | 'level' | 'points' | null;
}

export interface SkillBoardDto {
  player: PlayerDto;
  skills: SkillDto[];
}

export interface ChatActionDto {
  id: ChatActionId;
  requires?: { skill: SkillId; level: number };
  affinity: number;
  available: boolean;
  /** Grund, warum die Option gerade nicht nutzbar ist. */
  reason: 'skill' | 'used' | 'affinityLow' | 'affinityHigh' | null;
  minAffinity?: number;
  maxAffinity?: number;
}

export interface ChatActionsDto {
  characterId: string;
  affinity: number;
  actions: ChatActionDto[];
  /** Ziele der Figur – erst nach einem persönlichen Gespräch (Charisma 2) bekannt. */
  knownGoals: string[] | null;
}

export interface ChatActionResult {
  message: SendMessageResult;
  affinityBefore: number;
  affinityAfter: number;
  effects: QuestRewardsDto;
  actions: ChatActionsDto;
}

export interface PostReach {
  followers: number;
  influence: number;
}
