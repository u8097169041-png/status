/** Aufgaben, die sich auf eine Spielfigur in einer bestimmten Welt beziehen. */
export type WorldQuestMetric =
  | 'decisions'
  | 'posts'
  | 'chatPartners'
  | 'bestAffinity'
  | 'reputation'
  | 'storyChapters'
  | 'events';

export interface WorldQuestDef {
  id: string;
  metric: WorldQuestMetric;
  target: number;
  xp: number;
  coins: number;
}

export const WORLD_QUESTS: WorldQuestDef[] = [
  { id: 'wq-first-decision', metric: 'decisions', target: 1, xp: 25, coins: 15 },
  { id: 'wq-voice', metric: 'posts', target: 2, xp: 25, coins: 15 },
  { id: 'wq-network', metric: 'chatPartners', target: 3, xp: 35, coins: 20 },
  { id: 'wq-ally', metric: 'bestAffinity', target: 40, xp: 40, coins: 25 },
  { id: 'wq-reputation', metric: 'reputation', target: 25, xp: 40, coins: 25 },
  { id: 'wq-chapter', metric: 'storyChapters', target: 1, xp: 30, coins: 20 },
  { id: 'wq-decider', metric: 'decisions', target: 5, xp: 60, coins: 40 },
  { id: 'wq-influencer', metric: 'events', target: 3, xp: 50, coins: 30 },
];
