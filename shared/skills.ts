/**
 * Rollen (Archetypen), Hauptziele und Fähigkeiten der Spielfiguren.
 * Die Zahlen hier steuern die Spielmechanik im Backend und werden in der Oberfläche angezeigt –
 * es gibt keine Werte, die nur dekorativ sind.
 */

export const ARCHETYPES = ['politician', 'star', 'founder', 'athlete', 'entertainer', 'creator', 'reporter', 'local'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Hauptziele: bestimmen die Hauptquest-Kette einer Spielfigur. */
export const GOAL_TYPES = ['reach', 'support', 'cooperation', 'relationships', 'rivalry', 'influence'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const SKILLS = ['charisma', 'media', 'negotiation', 'strategy'] as const;
export type SkillId = (typeof SKILLS)[number];

export const SKILL_MAX_LEVEL = 3;
/** Benötigtes Charakterlevel für Fähigkeitsstufe 1, 2, 3. */
export const SKILL_LEVEL_REQUIREMENT = [0, 1, 3, 5] as const;

/** Kernfähigkeiten je Rolle kosten 1 Punkt pro Stufe, alle anderen 2. */
export const ARCHETYPE_PROFILE: Record<Archetype, { core: SkillId[]; defaultGoal: GoalType }> = {
  politician: { core: ['negotiation', 'strategy'], defaultGoal: 'influence' },
  star: { core: ['charisma', 'media'], defaultGoal: 'reach' },
  founder: { core: ['negotiation', 'strategy'], defaultGoal: 'cooperation' },
  athlete: { core: ['charisma', 'strategy'], defaultGoal: 'support' },
  entertainer: { core: ['media', 'charisma'], defaultGoal: 'reach' },
  creator: { core: ['media', 'charisma'], defaultGoal: 'reach' },
  reporter: { core: ['media', 'strategy'], defaultGoal: 'relationships' },
  local: { core: ['charisma', 'negotiation'], defaultGoal: 'relationships' },
};

export function skillCost(archetype: Archetype, skill: SkillId): number {
  return ARCHETYPE_PROFILE[archetype].core.includes(skill) ? 1 : 2;
}

/** Fähigkeitspunkte: einer pro Charakterlevel plus einer pro abgeschlossener Hauptquest-Stufe. */
export function skillPointsEarned(characterLevel: number, mainStagesCompleted: number): number {
  return characterLevel + mainStagesCompleted;
}

/** Konkrete Spielwerte der Fähigkeiten (vom Backend genutzt, in der Oberfläche erklärt). */
export const SKILL_RULES = {
  /** Neue Follower pro eigenem Beitrag: Basis + Bonus je Stufe Medienkompetenz. */
  followersPerPost: { base: 5, perMedia: 10 },
  /** Zusätzliche Figuren, die auf einen eigenen Beitrag reagieren, je Stufe Medienkompetenz. */
  extraReactorsPerMedia: 1,
  /** Follower pro Story ab Medienkompetenz 3. */
  storyFollowers: 20,
  /** Zuneigung beim ersten Chat des Tages mit einer Figur: Basis + Charisma. */
  chatAffinity: { base: 1, perCharisma: 1 },
  /** Kooperation möglich ab dieser Zuneigung (mit Verhandlung 2 schon ab der niedrigeren Schwelle). */
  cooperationAffinity: { normal: 50, negotiation: 20 },
  /** Fürsprache einer Figur (Charisma 3) ab dieser Zuneigung. */
  endorseAffinity: 40,
  /** Entscheidungen zu Geschichten zählen ab Strategie 3 doppelt für das Ende. */
  strategyArcWeight: 2,
} as const;

/** Dialogoptionen im Chat. Jede Option hat eine echte Wirkung und ggf. Voraussetzungen. */
export const CHAT_ACTIONS = ['small-talk', 'compliment', 'personal', 'negotiate', 'cooperate', 'endorse'] as const;
export type ChatActionId = (typeof CHAT_ACTIONS)[number];

export interface ChatActionRule {
  id: ChatActionId;
  requires?: { skill: SkillId; level: number };
  /** Zuneigung, die die Option bringt. */
  affinity: number;
  /** Wie oft: einmal pro Tag und Figur oder einmalig pro Figur. */
  limit: 'daily' | 'once';
  /** Nur verfügbar, wenn die Zuneigung mindestens/höchstens diesen Wert hat. */
  minAffinity?: number;
  maxAffinity?: number;
}

export const CHAT_ACTION_RULES: Record<ChatActionId, ChatActionRule> = {
  'small-talk': { id: 'small-talk', affinity: 3, limit: 'daily' },
  compliment: { id: 'compliment', requires: { skill: 'charisma', level: 1 }, affinity: 6, limit: 'daily' },
  personal: { id: 'personal', requires: { skill: 'charisma', level: 2 }, affinity: 8, limit: 'daily' },
  negotiate: { id: 'negotiate', requires: { skill: 'negotiation', level: 1 }, affinity: 12, limit: 'daily', maxAffinity: 19 },
  cooperate: { id: 'cooperate', affinity: 5, limit: 'once', minAffinity: SKILL_RULES.cooperationAffinity.negotiation },
  endorse: { id: 'endorse', requires: { skill: 'charisma', level: 3 }, affinity: 0, limit: 'once', minAffinity: SKILL_RULES.endorseAffinity },
};

/** Ordnet eine Rollenbeschreibung einem Archetyp zu (Stichwörter in Deutsch und Englisch). */
const ROLE_KEYWORDS: [Archetype, RegExp][] = [
  ['reporter', /journalist|reporter|redakt|editor|presse|press|korrespondent|correspondent/i],
  ['politician', /politi|abgeordnet|minister|kanzler|chancellor|bürgermeister|mayor|senator|wahlkampf|campaign|opposition|parlament|parliament|regierung|government|partei|party/i],
  ['creator', /influencer|streamer|youtuber|creator|tiktok|blogger|podcast|meme/i],
  ['star', /sänger|singer|schauspiel|actor|actress|popstar|pop star|model|musiker|musician|star|rapper/i],
  ['athlete', /spieler|player|stürmer|striker|trainer|coach|sportler|athlete|kapitän|captain|torwart|goalkeeper|verteidiger|defender/i],
  ['founder', /gründer|founder|ceo|investor|unternehm|entrepreneur|konzern|analyst|manager|vorstand|board/i],
  ['entertainer', /moderator|host|komiker|comedian|produzent|producer|showrunner|entertainer/i],
];

const CATEGORY_ARCHETYPE: Record<string, Archetype> = {
  politics: 'politician',
  celebrity: 'star',
  business: 'founder',
  sports: 'athlete',
  entertainment: 'entertainer',
  internet: 'creator',
};

export function archetypeFor(role: string, worldCategory: string): Archetype {
  for (const [archetype, pattern] of ROLE_KEYWORDS) if (pattern.test(role)) return archetype;
  return CATEGORY_ARCHETYPE[worldCategory] ?? 'local';
}
