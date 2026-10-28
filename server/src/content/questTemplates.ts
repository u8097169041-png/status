import type { GoalType, SkillId } from '../../../shared/skills';
import type { QuestMetric, QuestRewardsDto } from '../../../shared/types';
import type { L } from './seedWorlds';

/**
 * Quest-Vorlagen. Platzhalter: {world}, {role}, {player}, {npc}, {rival}, {storyline}, {event}.
 * Ein Ziel mit `ref` bezieht sich auf eine konkrete Figur, Geschichte oder ein Ereignis;
 * `ref: '*'` bedeutet „beliebig“. Alternative Lösungswege setzen eine Fähigkeit voraus.
 */
export type RefKind = 'npc' | 'rival' | 'storyline' | 'event' | '*';

export interface ObjectiveTemplate {
  metric: QuestMetric;
  target: number;
  ref?: RefKind;
  /** Zielwert relativ zum aktuellen Stand (z. B. Zuneigung +10). */
  relative?: boolean;
}

export interface PathTemplate {
  objectives: ObjectiveTemplate[];
  requires?: { skill: SkillId; level: number };
}

export interface QuestTemplate {
  id: string;
  title: L;
  description: L;
  paths: PathTemplate[];
  xp: number;
  coins: number;
  rewards: QuestRewardsDto;
}

const main = (
  id: string,
  title: L,
  description: L,
  paths: PathTemplate[],
  stage: 1 | 2 | 3,
): QuestTemplate => ({
  id,
  title,
  description,
  paths,
  xp: [0, 100, 160, 260][stage],
  coins: [0, 30, 45, 70][stage],
  rewards: { reputation: 4 * stage, influence: 4 * stage, followers: 60 * stage },
});

/** Hauptquest-Ketten je Hauptziel (drei Stufen). */
export const MAIN_QUESTS: Record<GoalType, QuestTemplate[]> = {
  reach: [
    main(
      'reach-1',
      { de: 'Sichtbar werden', en: 'Get Noticed' },
      {
        de: 'Als {role} in {world} zählt, wer gesehen wird. Veröffentliche Beiträge und gewinne erste Follower.',
        en: 'As {role} in {world}, what counts is being seen. Publish posts and win your first followers.',
      },
      [
        { objectives: [{ metric: 'posts', target: 2 }, { metric: 'followersGain', target: 40 }] },
        { objectives: [{ metric: 'eventReaction', target: 1, ref: '*' }, { metric: 'followersGain', target: 40 }], requires: { skill: 'media', level: 1 } },
      ],
      1,
    ),
    main(
      'reach-2',
      { de: 'Gesprächsthema werden', en: 'Become the Talk of the Town' },
      {
        de: 'Die Figuren von {world} sollen über dich reden. Sammle Reaktionen auf deine Beiträge.',
        en: 'The people of {world} should be talking about you. Collect reactions to your posts.',
      },
      [
        { objectives: [{ metric: 'likesReceived', target: 6 }, { metric: 'followersGain', target: 150 }] },
        { objectives: [{ metric: 'endorsements', target: 1 }, { metric: 'followersGain', target: 120 }], requires: { skill: 'charisma', level: 3 } },
      ],
      2,
    ),
    main(
      'reach-3',
      { de: 'Die Stimme von {world}', en: 'The Voice of {world}' },
      {
        de: 'Mach aus Reichweite echten Einfluss. Wenn du sprichst, hört {world} zu.',
        en: 'Turn reach into real influence. When you speak, {world} listens.',
      },
      [
        { objectives: [{ metric: 'followersGain', target: 400 }, { metric: 'influence', target: 30 }] },
        { objectives: [{ metric: 'followersGain', target: 300 }, { metric: 'likesReceived', target: 15 }], requires: { skill: 'media', level: 3 } },
      ],
      3,
    ),
  ],
  support: [
    main(
      'support-1',
      { de: 'Erste Verbündete', en: 'First Allies' },
      {
        de: 'Als {role} brauchst du Menschen, die hinter dir stehen. Sprich mit den Figuren von {world} und gewinne eine erste Unterstützerin oder einen ersten Unterstützer.',
        en: 'As {role} you need people who have your back. Talk to the people of {world} and win your first supporter.',
      },
      [
        { objectives: [{ metric: 'allies', target: 1 }, { metric: 'chatPartners', target: 2 }] },
        { objectives: [{ metric: 'cooperations', target: 1 }], requires: { skill: 'negotiation', level: 1 } },
      ],
      1,
    ),
    main(
      'support-2',
      { de: 'Rückhalt aufbauen', en: 'Build Support' },
      { de: 'Aus Einzelnen wird ein Lager. Gewinne mehr Verbündete und Ansehen in {world}.', en: 'Individuals become a camp. Win more allies and reputation in {world}.' },
      [
        { objectives: [{ metric: 'allies', target: 3 }, { metric: 'reputation', target: 20 }] },
        { objectives: [{ metric: 'endorsements', target: 2 }, { metric: 'reputation', target: 15 }], requires: { skill: 'charisma', level: 3 } },
      ],
      2,
    ),
    main(
      'support-3',
      { de: 'Breite Mehrheit', en: 'Broad Majority' },
      { de: 'Ganz {world} soll wissen, dass viele hinter dir stehen.', en: 'All of {world} should know that many stand behind you.' },
      [
        { objectives: [{ metric: 'allies', target: 5 }, { metric: 'reputation', target: 35 }] },
        { objectives: [{ metric: 'allies', target: 4 }, { metric: 'arcDecisions', target: 2, ref: '*' }, { metric: 'reputation', target: 30 }], requires: { skill: 'strategy', level: 2 } },
      ],
      3,
    ),
  ],
  cooperation: [
    main(
      'coop-1',
      { de: 'Ein erster Partner', en: 'A First Partner' },
      {
        de: 'Als {role} kommst du allein nicht weit. Baue Vertrauen auf und schließe eine Kooperation.',
        en: 'As {role} you won\'t get far alone. Build trust and form a cooperation.',
      },
      [{ objectives: [{ metric: 'cooperations', target: 1 }] }],
      1,
    ),
    main(
      'coop-2',
      { de: 'Netzwerk der Partner', en: 'Network of Partners' },
      { de: 'Mehrere Partnerschaften machen dich unverzichtbar in {world}.', en: 'Several partnerships make you indispensable in {world}.' },
      [{ objectives: [{ metric: 'cooperations', target: 2 }, { metric: 'influence', target: 25 }] }],
      2,
    ),
    main(
      'coop-3',
      { de: 'Die große Allianz', en: 'The Grand Alliance' },
      { de: 'Nutze dein Netzwerk, um die Geschichten von {world} mitzubestimmen.', en: 'Use your network to shape the stories of {world}.' },
      [
        { objectives: [{ metric: 'cooperations', target: 3 }, { metric: 'arcDecisions', target: 2, ref: '*' }] },
        { objectives: [{ metric: 'cooperations', target: 2 }, { metric: 'arcResolved', target: 1, ref: '*' }], requires: { skill: 'strategy', level: 2 } },
      ],
      3,
    ),
  ],
  relationships: [
    main(
      'rel-1',
      { de: 'Ankommen', en: 'Settling In' },
      { de: 'Lerne die Menschen in {world} kennen und finde eine erste Vertrauensperson.', en: 'Get to know the people in {world} and find someone to trust.' },
      [{ objectives: [{ metric: 'chatPartners', target: 2 }, { metric: 'allies', target: 1 }] }],
      1,
    ),
    main(
      'rel-2',
      { de: 'Vertraute finden', en: 'Find Confidants' },
      { de: 'Vertiefe deine Beziehungen. Wer dir vertraut, erzählt dir mehr.', en: 'Deepen your relationships. Those who trust you tell you more.' },
      [
        { objectives: [{ metric: 'allies', target: 3 }] },
        { objectives: [{ metric: 'allies', target: 2 }, { metric: 'chatPartners', target: 4 }], requires: { skill: 'charisma', level: 2 } },
      ],
      2,
    ),
    main(
      'rel-3',
      { de: 'Ein fester Kreis', en: 'A Close Circle' },
      { de: 'Mach aus einer Bekanntschaft eine echte Freundschaft.', en: 'Turn an acquaintance into a true friendship.' },
      [{ objectives: [{ metric: 'friends', target: 1 }, { metric: 'allies', target: 4 }] }],
      3,
    ),
  ],
  rivalry: [
    main(
      'rival-1',
      { de: '{rival} verstehen', en: 'Understand {rival}' },
      {
        de: 'Zwischen dir und {rival} herrscht Spannung. Finde heraus, worum es wirklich geht.',
        en: 'There is tension between you and {rival}. Find out what it is really about.',
      },
      [
        { objectives: [{ metric: 'chatWith', target: 2, ref: 'rival' }] },
        { objectives: [{ metric: 'negotiatedWith', target: 1, ref: 'rival' }], requires: { skill: 'negotiation', level: 1 } },
      ],
      1,
    ),
    main(
      'rival-2',
      { de: 'Waffenstillstand mit {rival}', en: 'Truce with {rival}' },
      { de: 'Bring die Beziehung zu {rival} wenigstens auf neutralen Boden.', en: 'Bring your relationship with {rival} back to at least neutral ground.' },
      [
        { objectives: [{ metric: 'affinityWith', target: 0, ref: 'rival' }] },
        {
          objectives: [
            { metric: 'negotiatedWith', target: 2, ref: 'rival' },
            { metric: 'affinityWith', target: -15, ref: 'rival' },
          ],
          requires: { skill: 'negotiation', level: 1 },
        },
      ],
      2,
    ),
    main(
      'rival-3',
      { de: 'Aus Rivalen werden Partner', en: 'From Rivals to Partners' },
      { de: 'Der größte Sieg: {rival} auf deiner Seite.', en: 'The greatest victory: {rival} on your side.' },
      [
        { objectives: [{ metric: 'affinityWith', target: 40, ref: 'rival' }] },
        { objectives: [{ metric: 'cooperatedWith', target: 1, ref: 'rival' }], requires: { skill: 'negotiation', level: 2 } },
      ],
      3,
    ),
  ],
  influence: [
    main(
      'infl-1',
      { de: 'Am Tisch sitzen', en: 'A Seat at the Table' },
      {
        de: 'Als {role} willst du mitentscheiden, was in {world} passiert. Triff Entscheidungen und gewinne Einfluss.',
        en: 'As {role} you want a say in what happens in {world}. Make decisions and gain influence.',
      },
      [{ objectives: [{ metric: 'influence', target: 20 }, { metric: 'decisions', target: 2 }] }],
      1,
    ),
    main(
      'infl-2',
      { de: 'Strippen ziehen', en: 'Pulling Strings' },
      { de: 'Einfluss braucht Verbündete – oder einen klugen Plan.', en: 'Influence needs allies – or a clever plan.' },
      [
        { objectives: [{ metric: 'influence', target: 40 }, { metric: 'allies', target: 2 }] },
        { objectives: [{ metric: 'influence', target: 35 }, { metric: 'arcDecisions', target: 2, ref: '*' }], requires: { skill: 'strategy', level: 1 } },
      ],
      2,
    ),
    main(
      'infl-3',
      { de: 'Machtfaktor in {world}', en: 'A Power in {world}' },
      { de: 'Bestimme das Ende einer Geschichte mit und werde zur festen Größe.', en: 'Help decide how a story ends and become a fixture.' },
      [
        { objectives: [{ metric: 'influence', target: 60 }, { metric: 'arcResolved', target: 1, ref: '*' }] },
        { objectives: [{ metric: 'influence', target: 55 }, { metric: 'cooperations', target: 2 }], requires: { skill: 'negotiation', level: 3 } },
      ],
      3,
    ),
  ],
};

/** Nebenquests, die aus der aktuellen Lage entstehen. */
export const SIDE_QUESTS: Record<string, QuestTemplate> = {
  introduce: {
    id: 'introduce',
    title: { de: 'Stell dich in {world} vor', en: 'Introduce Yourself in {world}' },
    description: { de: 'Noch kennt dich hier kaum jemand. Ein Beitrag und eine Story helfen.', en: 'Hardly anyone knows you here yet. A post and a story will help.' },
    paths: [{ objectives: [{ metric: 'posts', target: 1 }, { metric: 'stories', target: 1 }] }],
    xp: 40,
    coins: 15,
    rewards: { followers: 20 },
  },
  rival: {
    id: 'rival',
    title: { de: 'Spannungen mit {npc}', en: 'Tension with {npc}' },
    description: {
      de: 'Zwischen dir und {npc} ist die Stimmung schlecht. Entschärfe die Lage, bevor sie eskaliert.',
      en: 'Things are bad between you and {npc}. Defuse the situation before it escalates.',
    },
    paths: [
      { objectives: [{ metric: 'affinityWith', target: 0, ref: 'npc' }] },
      {
        objectives: [
          { metric: 'negotiatedWith', target: 1, ref: 'npc' },
          { metric: 'affinityWith', target: -20, ref: 'npc' },
        ],
        requires: { skill: 'negotiation', level: 1 },
      },
    ],
    xp: 60,
    coins: 25,
    rewards: { reputation: 4 },
  },
  reconcile: {
    id: 'reconcile',
    title: { de: 'Wiedergutmachung bei {npc}', en: 'Make Amends with {npc}' },
    description: {
      de: 'Deine letzte Entscheidung hat {npc} verärgert. Zeig, dass dir die Beziehung wichtig ist.',
      en: 'Your last decision upset {npc}. Show that the relationship matters to you.',
    },
    paths: [
      { objectives: [{ metric: 'affinityWith', target: 10, ref: 'npc', relative: true }] },
      {
        objectives: [
          { metric: 'chatWith', target: 2, ref: 'npc' },
          { metric: 'affinityWith', target: 5, ref: 'npc', relative: true },
        ],
        requires: { skill: 'charisma', level: 1 },
      },
    ],
    xp: 45,
    coins: 15,
    rewards: { reputation: 3 },
  },
  favor: {
    id: 'favor',
    title: { de: '{npc} schuldet dir etwas', en: '{npc} Owes You' },
    description: {
      de: 'Nach deiner Hilfe ist {npc} dir wohlgesonnen. Mach daraus eine Kooperation.',
      en: 'After your help, {npc} is well disposed towards you. Turn it into a cooperation.',
    },
    paths: [{ objectives: [{ metric: 'cooperatedWith', target: 1, ref: 'npc' }] }],
    xp: 50,
    coins: 20,
    rewards: { influence: 3 },
  },
  coop: {
    id: 'coop',
    title: { de: 'Kooperation mit {npc}', en: 'Cooperate with {npc}' },
    description: {
      de: '{npc} und du versteht euch gut. Eine gemeinsame Aktion würde euch beiden nützen.',
      en: '{npc} and you get along well. A joint project would benefit you both.',
    },
    paths: [{ objectives: [{ metric: 'cooperatedWith', target: 1, ref: 'npc' }] }],
    xp: 55,
    coins: 20,
    rewards: { influence: 4 },
  },
  arc: {
    id: 'arc',
    title: { de: 'Mitreden bei „{storyline}“', en: 'Have a Say in "{storyline}"' },
    description: {
      de: 'Die Geschichte „{storyline}“ läuft. Triff eine Entscheidung, die ihr Ende mitbestimmt.',
      en: 'The story "{storyline}" is underway. Make a decision that helps shape its ending.',
    },
    paths: [{ objectives: [{ metric: 'arcDecisions', target: 1, ref: 'storyline' }] }],
    xp: 45,
    coins: 15,
    rewards: { influence: 2 },
  },
  contact: {
    id: 'contact',
    title: { de: 'Kontakt zu {npc}', en: 'Get in Touch with {npc}' },
    description: { de: '{npc} ist eine bekannte Figur in {world}. Ein Gespräch kann Türen öffnen.', en: '{npc} is a well-known figure in {world}. A conversation can open doors.' },
    paths: [{ objectives: [{ metric: 'chatWith', target: 2, ref: 'npc' }] }],
    xp: 35,
    coins: 10,
    rewards: { reputation: 2 },
  },
  buzz: {
    id: 'buzz',
    title: { de: 'Gesprächsstoff liefern', en: 'Give Them Something to Talk About' },
    description: { de: 'Ein Beitrag, über den man spricht: Sammle Reaktionen der Figuren.', en: 'A post people talk about: collect reactions from the characters.' },
    paths: [{ objectives: [{ metric: 'likesReceived', target: 4 }] }],
    xp: 40,
    coins: 15,
    rewards: { followers: 40 },
  },
};

/** Dynamische Ereignisquest: Reaktion auf ein (simuliertes) Ereignis der Welt. */
export const EVENT_QUEST: QuestTemplate = {
  id: 'event',
  title: { de: 'Reaktion gefragt: {event}', en: 'Your Reaction: {event}' },
  description: {
    de: 'Ganz {world} spricht über dieses Ereignis. Kommentiere einen Beitrag dazu oder reagiere öffentlich, bevor das Thema verfliegt.',
    en: 'All of {world} is talking about this event. Comment on a post about it or react publicly before the topic fades.',
  },
  paths: [{ objectives: [{ metric: 'eventReaction', target: 1, ref: 'event' }] }],
  xp: 35,
  coins: 10,
  rewards: { reputation: 2, followers: 30 },
};

export const QUEST_TEXT = {
  milestoneTitle: { de: '{player}: {quest}', en: '{player}: {quest}' },
  milestoneDescription: {
    de: '{player} hat ein wichtiges Ziel erreicht: „{quest}“.',
    en: '{player} has reached an important goal: "{quest}".',
  },
  milestonePost: {
    de: 'Respekt an @{handle} – „{quest}“ geschafft. Das wird {world} verändern. #{tag}',
    en: 'Respect to @{handle} – "{quest}" achieved. This will change {world}. #{tag}',
  },
  noRival: { de: 'eine schwierige Person', en: 'a difficult person' },
} satisfies Record<string, L>;
