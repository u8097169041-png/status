import type { RelationshipKind, WorldMetric } from '../../../shared/constants';
import type { SkillId } from '../../../shared/skills';
import type { ArcPath } from '../../../shared/types';
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
  /** Zuneigungsänderung; optional wird die Beziehung ab einer Mindest-Zuneigung zu einer anderen Art (z. B. Romanze). */
  affinity?: { target: AffinityTarget; delta: number; becomes?: RelationshipKind; minAffinity?: number }[];
  /** Bei Beitritt: Zuneigung zu bis zu zwei bekannten Figuren. */
  networkAffinity?: number;
  advanceStoryline?: boolean;
  /** Nur wählbar mit dieser Fähigkeit (zusätzliche Lösungswege). */
  requires?: { skill: SkillId; level: number };
  /** Richtung, in die die Option einen Handlungsbogen lenkt, und Gewicht dieser Stimme. */
  arcPath?: ArcPath;
  arcWeight?: number;
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
    {
      id: 'charm',
      label: { de: 'Mit Charme den Raum erobern', en: 'Win the room with charm' },
      outcome: {
        de: '{player} gewinnt mit Witz und Wärme sofort Sympathien – bei Bekannten wie bei Fremden.',
        en: '{player} wins sympathy right away with wit and warmth – from acquaintances and strangers alike.',
      },
      reputation: 6,
      followers: 60,
      networkAffinity: 15,
      requires: { skill: 'charisma', level: 1 },
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
      {
        id: 'charm-help',
        label: { de: 'Mit Charme Unterstützer mobilisieren', en: 'Rally supporters with charm' },
        outcome: {
          de: '{player} überzeugt andere, gemeinsam mit anzupacken. {npc} ist begeistert – und {player} hat kaum Aufwand.',
          en: '{player} convinces others to pitch in together. {npc} is delighted – and it costs {player} little.',
        },
        reputation: 6,
        affinity: [{ target: 'npc', delta: 14 }],
        metrics: { harmony: 4 },
        requires: { skill: 'charisma', level: 1 },
      },
      {
        id: 'fair-deal',
        label: { de: 'Fairen Deal aushandeln', en: 'Negotiate a fair deal' },
        outcome: {
          de: '{player} handelt eine Vereinbarung aus, von der beide profitieren. {npc} fühlt sich ernst genommen.',
          en: '{player} negotiates an agreement that benefits both. {npc} feels taken seriously.',
        },
        influence: 5,
        affinity: [{ target: 'npc', delta: 6 }],
        requires: { skill: 'negotiation', level: 1 },
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
      {
        id: 'compromise',
        label: { de: 'Einen Kompromiss aushandeln', en: 'Broker a compromise' },
        outcome: {
          de: '{player} verhandelt eine Lösung, die beide Seiten unterschreiben. {a} und {b} reden wieder miteinander.',
          en: '{player} negotiates a solution both sides sign. {a} and {b} are talking again.',
        },
        affinity: [
          { target: 'a', delta: 10 },
          { target: 'b', delta: 10 },
        ],
        metrics: { tension: -9, harmony: 5 },
        reputation: 6,
        influence: 2,
        requires: { skill: 'negotiation', level: 1 },
      },
      {
        id: 'public-statement',
        label: { de: 'Mit einem klugen Statement die Debatte drehen', en: 'Turn the debate with a smart statement' },
        outcome: {
          de: '{player} findet die richtigen Worte für die Öffentlichkeit. Die Aufmerksamkeit liegt plötzlich bei {player}.',
          en: '{player} finds the right words for the public. Suddenly all attention is on {player}.',
        },
        followers: 150,
        influence: 4,
        metrics: { tension: -3 },
        requires: { skill: 'media', level: 2 },
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
        arcPath: 'bold',
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
        arcPath: 'diplomatic',
      },
      {
        id: 'stay-out',
        label: { de: 'Heraushalten', en: 'Stay out of it' },
        outcome: {
          de: '{player} beobachtet die Entwicklung aus sicherer Entfernung.',
          en: '{player} watches the developments from a safe distance.',
        },
        metrics: { discovery: 2 },
        arcPath: 'neutral',
      },
      {
        id: 'prepared',
        label: { de: 'Vorbereitet eingreifen', en: 'Step in prepared' },
        outcome: {
          de: '{player} hat die Lage analysiert und greift im richtigen Moment ein – ohne Chaos zu stiften.',
          en: '{player} has analysed the situation and steps in at the right moment – without causing chaos.',
        },
        influence: 7,
        reputation: 2,
        advanceStoryline: true,
        arcPath: 'bold',
        requires: { skill: 'strategy', level: 1 },
      },
      {
        id: 'broker',
        label: { de: 'Alle Seiten an einen Tisch holen', en: 'Bring all sides to the table' },
        outcome: {
          de: '{player} vermittelt zwischen allen Beteiligten. „{storyline}“ steuert auf eine Einigung zu.',
          en: '{player} mediates between everyone involved. "{storyline}" is heading for an agreement.',
        },
        reputation: 6,
        metrics: { harmony: 4, tension: -4 },
        advanceStoryline: true,
        arcPath: 'diplomatic',
        arcWeight: 2,
        requires: { skill: 'negotiation', level: 2 },
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
      {
        id: 'campaign',
        label: { de: 'Eine Medienkampagne daraus machen', en: 'Turn it into a media campaign' },
        outcome: {
          de: '{player} plant den Auftritt crossmedial. Ausschnitte gehen viral, die Reichweite explodiert.',
          en: '{player} plans the appearance across channels. Clips go viral and reach explodes.',
        },
        followers: 220,
        influence: 4,
        requires: { skill: 'media', level: 1 },
      },
      {
        id: 'timing',
        label: { de: 'Den perfekten Zeitpunkt abwarten', en: 'Wait for the perfect moment' },
        outcome: {
          de: '{player} wartet geduldig und tritt genau dann auf, als alle hinsehen. Der Einfluss wächst spürbar.',
          en: '{player} waits patiently and appears exactly when everyone is watching. Influence grows noticeably.',
        },
        influence: 9,
        reputation: 2,
        requires: { skill: 'strategy', level: 1 },
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
