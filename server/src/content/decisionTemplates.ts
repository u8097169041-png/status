import type { WorldMetric } from '../../../shared/constants';
import type { L } from './seedWorlds';

/**
 * Vorlagen für Entscheidungen der Spielfigur. Platzhalter: {player}, {npc}, {a}, {b}, {world}, {goal},
 * {storyline}, {stage}. Die Auswirkungen sind transparent und werden in der Oberfläche angezeigt.
 */
export type AffinityTarget = 'npc' | 'a' | 'b';

export interface OptionTemplate {
  id: string;
  label: L;
  outcome: L;
  reputation?: number;
  influence?: number;
  followers?: number;
  metrics?: Partial<Record<WorldMetric, number>>;
  affinity?: { target: AffinityTarget; delta: number }[];
  /** Bei Beitritt: Zuneigung zu bis zu zwei bekannten Figuren. */
  networkAffinity?: number;
  advanceStoryline?: boolean;
}

export interface DecisionTemplate {
  id: string;
  needs: 'none' | 'npc' | 'pair' | 'storyline';
  title: L;
  description: L;
  options: OptionTemplate[];
}

export const INTRO_DECISION: DecisionTemplate = {
  id: 'intro',
  needs: 'none',
  title: { de: 'Dein erster Tag in {world}', en: 'Your first day in {world}' },
  description: {
    de: 'Alle Augen richten sich auf die neue Person in der Stadt. Wie trittst du auf?',
    en: 'All eyes are on the newcomer in town. How do you make your entrance?',
  },
  options: [
    {
      id: 'observe',
      label: { de: 'Erst einmal beobachten', en: 'Observe first' },
      outcome: {
        de: '{player} hält sich zurück und lernt {world} in Ruhe kennen. Man nimmt {player} als besonnen wahr.',
        en: '{player} keeps a low profile and gets to know {world} calmly. People see {player} as level-headed.',
      },
      reputation: 4,
      metrics: { discovery: 3 },
    },
    {
      id: 'loud',
      label: { de: 'Mit einem Paukenschlag auftreten', en: 'Make a big splash' },
      outcome: {
        de: '{player} sorgt sofort für Gesprächsstoff. Nicht alle sind begeistert – aber alle kennen jetzt den Namen.',
        en: '{player} immediately becomes the talk of the town. Not everyone is thrilled – but everyone knows the name now.',
      },
      influence: 8,
      reputation: -3,
      followers: 120,
      metrics: { tension: 4 },
    },
    {
      id: 'network',
      label: { de: 'Kontakte knüpfen', en: 'Build connections' },
      outcome: {
        de: '{player} stellt sich bei wichtigen Leuten vor und hinterlässt einen freundlichen Eindruck.',
        en: '{player} introduces themselves to important people and leaves a friendly impression.',
      },
      reputation: 3,
      networkAffinity: 10,
      metrics: { harmony: 3 },
    },
  ],
};

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: 'request',
    needs: 'npc',
    title: { de: '{npc} bittet dich um Hilfe', en: '{npc} asks for your help' },
    description: {
      de: '{npc} steckt mitten in einem Vorhaben („{goal}“) und braucht Unterstützung. Wie reagierst du?',
      en: '{npc} is in the middle of a plan ("{goal}") and needs support. How do you respond?',
    },
    options: [
      {
        id: 'help',
        label: { de: 'Helfen', en: 'Help' },
        outcome: { de: '{player} hilft {npc}. Das wird nicht vergessen.', en: '{player} helps {npc}. That will not be forgotten.' },
        reputation: 5,
        influence: -2,
        affinity: [{ target: 'npc', delta: 15 }],
        metrics: { harmony: 3 },
      },
      {
        id: 'bargain',
        label: { de: 'Gegenleistung verlangen', en: 'Ask for something in return' },
        outcome: {
          de: '{player} hilft – aber nicht umsonst. {npc} schuldet {player} nun einen Gefallen.',
          en: '{player} helps – but not for free. {npc} now owes {player} a favour.',
        },
        influence: 6,
        affinity: [{ target: 'npc', delta: -3 }],
      },
      {
        id: 'decline',
        label: { de: 'Ablehnen', en: 'Decline' },
        outcome: { de: '{player} lehnt ab. {npc} ist enttäuscht.', en: '{player} declines. {npc} is disappointed.' },
        influence: 2,
        affinity: [{ target: 'npc', delta: -10 }],
      },
    ],
  },
  {
    id: 'dispute',
    needs: 'pair',
    title: { de: 'Streit zwischen {a} und {b}', en: 'Dispute between {a} and {b}' },
    description: {
      de: '{a} und {b} sind öffentlich aneinandergeraten. Beide erwarten, dass du Stellung beziehst.',
      en: '{a} and {b} have clashed in public. Both expect you to take a stand.',
    },
    options: [
      {
        id: 'side-a',
        label: { de: '{a} unterstützen', en: 'Back {a}' },
        outcome: { de: '{player} stellt sich hinter {a}. {b} nimmt das persönlich.', en: '{player} sides with {a}. {b} takes it personally.' },
        affinity: [
          { target: 'a', delta: 12 },
          { target: 'b', delta: -12 },
        ],
        metrics: { tension: 3 },
        influence: 2,
      },
      {
        id: 'side-b',
        label: { de: '{b} unterstützen', en: 'Back {b}' },
        outcome: { de: '{player} stellt sich hinter {b}. {a} ist verärgert.', en: '{player} sides with {b}. {a} is annoyed.' },
        affinity: [
          { target: 'b', delta: 12 },
          { target: 'a', delta: -12 },
        ],
        metrics: { tension: 3 },
        influence: 2,
      },
      {
        id: 'mediate',
        label: { de: 'Vermitteln', en: 'Mediate' },
        outcome: {
          de: '{player} bringt beide an einen Tisch. Die Lage beruhigt sich – vorerst.',
          en: '{player} gets both to the same table. Things calm down – for now.',
        },
        affinity: [
          { target: 'a', delta: 5 },
          { target: 'b', delta: 5 },
        ],
        metrics: { tension: -6, harmony: 4 },
        reputation: 4,
      },
    ],
  },
  {
    id: 'storyline',
    needs: 'storyline',
    title: { de: '{storyline}: {stage}', en: '{storyline}: {stage}' },
    description: {
      de: 'Die Geschichte „{storyline}“ steht an einem Wendepunkt. Deine Haltung kann sie beschleunigen.',
      en: 'The story "{storyline}" is at a turning point. Your stance can speed it up.',
    },
    options: [
      {
        id: 'push',
        label: { de: 'Vorantreiben', en: 'Push it forward' },
        outcome: {
          de: '{player} mischt sich ein und treibt „{storyline}“ voran.',
          en: '{player} gets involved and pushes "{storyline}" forward.',
        },
        influence: 5,
        metrics: { tension: 3 },
        advanceStoryline: true,
      },
      {
        id: 'support',
        label: { de: 'Im Hintergrund unterstützen', en: 'Support behind the scenes' },
        outcome: {
          de: '{player} hilft leise mit. Wer genau hinsieht, bemerkt es.',
          en: '{player} quietly helps. Those who look closely notice.',
        },
        reputation: 5,
        metrics: { harmony: 3 },
      },
      {
        id: 'stay-out',
        label: { de: 'Heraushalten', en: 'Stay out of it' },
        outcome: {
          de: '{player} beobachtet die Entwicklung aus sicherer Entfernung.',
          en: '{player} watches the developments from a safe distance.',
        },
        metrics: { discovery: 2 },
      },
    ],
  },
  {
    id: 'opportunity',
    needs: 'none',
    title: { de: 'Eine Bühne in {world}', en: 'A stage in {world}' },
    description: {
      de: 'Man bietet dir an, öffentlich Stellung zu beziehen. Ganz {world} würde zuhören.',
      en: 'You are offered the chance to take a public stand. All of {world} would listen.',
    },
    options: [
      {
        id: 'speak',
        label: { de: 'Die Bühne nutzen', en: 'Take the stage' },
        outcome: {
          de: '{player} spricht vor großem Publikum. Die Reichweite wächst – die Erwartungen auch.',
          en: '{player} speaks to a large audience. Reach grows – and so do expectations.',
        },
        influence: 6,
        followers: 80,
        metrics: { tension: 2 },
      },
      {
        id: 'pass',
        label: { de: 'Bescheiden ablehnen', en: 'Modestly decline' },
        outcome: { de: '{player} lehnt dankend ab und gilt als bodenständig.', en: '{player} politely declines and is seen as down to earth.' },
        reputation: 3,
      },
    ],
  },
];

/** Reaktion einer beteiligten Figur auf eine Entscheidung (Beitrag im Feed). */
export const DECISION_REACTIONS: L[] = [
  { de: 'Bemerkenswert, wie @{handle} sich entschieden hat. Ich merke mir das. #{tag}', en: 'Remarkable how @{handle} decided. I\'ll remember that. #{tag}' },
  { de: '@{handle} hat Haltung gezeigt. Mal sehen, was daraus wird. #{tag}', en: '@{handle} took a stand. Let\'s see where this goes. #{tag}' },
  { de: 'Neuigkeiten aus {world}: @{handle} mischt mit. #{tag}', en: 'News from {world}: @{handle} is getting involved. #{tag}' },
];

export const PLAYER_TEXT = {
  joinTitle: { de: '{player} betritt {world}', en: '{player} arrives in {world}' },
  joinDescription: { de: 'Eine neue Figur ist in {world} angekommen: {player} ({role}).', en: 'A new figure has arrived in {world}: {player} ({role}).' },
  switchTitle: { de: '{player} übernimmt', en: '{player} takes over' },
  decisionTitle: { de: '{player}: {option}', en: '{player}: {option}' },
} satisfies Record<string, L>;
