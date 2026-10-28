import type { GoalType } from '../../../shared/skills';
import type { SeedEvent, SeedPost, SeedStory } from './seedPosts';
import type { SeedCharacter, SeedGroup, SeedRelationship, SeedStoryline, SeedWorld } from './seedWorlds';

/**
 * Welt aus Version 3: Internetkultur. Alle Personen, Kanäle und Plattformen sind frei erfunden.
 */
export const SEED_WORLDS_V3: SeedWorld[] = [
  {
    id: 'w-trendwave',
    name: { de: 'Trendwelle', en: 'Trendwave' },
    tagline: {
      de: 'Eine Plattform, eine Algorithmus-Änderung und vier Creator, die um ihre Reichweite kämpfen.',
      en: 'One platform, one algorithm change and four creators fighting for their reach.',
    },
    genre: 'internet',
    description: {
      de: 'Auf der erfundenen Plattform „Wavely“ entscheidet der Algorithmus, wer gesehen wird. Streamerin Juna Kade lebt von ihrer Community, Tech-Erklärer Maxim Orlov von seinen Analysen, der anonyme Meme-Account „Lou“ von Chaos – und Faktencheckerin Ronja Weiß versucht, alle ehrlich zu halten. Jetzt kündigt Wavely eine radikale Änderung an.',
      en: 'On the made-up platform "Wavely" the algorithm decides who gets seen. Streamer Juna Kade lives off her community, tech explainer Maxim Orlov off his analyses, the anonymous meme account "Lou" off chaos – and fact-checker Ronja Weiss tries to keep everyone honest. Now Wavely announces a radical change.',
    },
    lore: {
      de: 'Wavely wuchs in drei Jahren von einer Nischen-App zur größten Plattform des Landes. Wer dort trendet, wird eingeladen, zitiert und gebucht. Wer abstürzt, verschwindet.',
      en: 'Wavely grew from a niche app to the country\'s biggest platform in three years. Whoever trends there gets invited, quoted and booked. Whoever crashes disappears.',
    },
    atmosphere: {
      de: 'Ringlicht, Push-Benachrichtigungen, Kommentarspalten in Echtzeit.',
      en: 'Ring lights, push notifications, comment sections in real time.',
    },
    rules: [
      { de: 'Alle Personen und Plattformen sind frei erfunden.', en: 'All persons and platforms are fictional.' },
      { de: 'Reichweite steigt mit Aufmerksamkeit – und fällt mit Vertrauensverlust.', en: 'Reach rises with attention – and falls with lost trust.' },
      { de: 'Screenshots vergessen nichts.', en: 'Screenshots never forget.' },
    ],
    artStyle: 'network',
    hue: 190,
    day: 1,
    metrics: { harmony: 48, tension: 55, discovery: 52 },
  },
];

const c = (x: Omit<SeedCharacter, 'mood'> & { mood?: string }): SeedCharacter => ({ mood: 'neutral', ...x });

export const SEED_CHARACTERS_V3: SeedCharacter[] = [
  c({
    id: 'c-juna',
    worldId: 'w-trendwave',
    name: 'Juna Kade',
    handle: 'juna_live',
    tagline: { de: 'Streamerin. Jeden Abend live, jeden Abend ehrlich.', en: 'Streamer. Live every night, honest every night.' },
    description: {
      de: 'Juna Kade streamt Spiele, Kochexperimente und lange Gespräche mit ihrer Community. Ihre Zuschauer nennen sich „die Welle“.',
      en: 'Juna Kade streams games, cooking experiments and long talks with her community. Her viewers call themselves "the Wave".',
    },
    role: { de: 'Streamerin', en: 'Streamer' },
    personality: [{ de: 'herzlich', en: 'warm' }, { de: 'spontan', en: 'spontaneous' }, { de: 'loyal', en: 'loyal' }],
    interests: [{ de: 'Community', en: 'community' }, { de: 'Retro-Spiele', en: 'retro games' }, { de: 'Kochen', en: 'cooking' }],
    background: { de: 'Fing mit einer Webcam und einem geliehenen Mikrofon an.', en: 'Started with a webcam and a borrowed microphone.' },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Viele Ausrufezeichen, spricht ihre Community direkt an.', en: 'Lots of exclamation marks, addresses her community directly.' },
    rules: [{ de: 'Lässt ihre Community nie im Stich.', en: 'Never lets her community down.' }],
    avatarHue: 320,
    avatarGlyph: 'star',
    mood: 'excited',
    goals: [{ de: 'Ihre Community durch die Algorithmus-Änderung bringen', en: 'Get her community through the algorithm change' }],
    prominent: true,
  }),
  c({
    id: 'c-maxim',
    worldId: 'w-trendwave',
    name: 'Maxim Orlov',
    handle: 'maxim_explains',
    tagline: { de: 'Ich erkläre Technik, bevor sie euch erklärt.', en: 'I explain tech before it explains you.' },
    description: {
      de: 'Maxim Orlov zerlegt Apps, Updates und Datenschutzbestimmungen in verständliche Videos. Er hat als Erster bemerkt, dass Wavely etwas plant.',
      en: 'Maxim Orlov breaks apps, updates and privacy policies down into understandable videos. He was the first to notice that Wavely is planning something.',
    },
    role: { de: 'Tech-Creator', en: 'Tech creator' },
    personality: [{ de: 'analytisch', en: 'analytical' }, { de: 'skeptisch', en: 'sceptical' }, { de: 'geduldig', en: 'patient' }],
    interests: [{ de: 'Algorithmen', en: 'algorithms' }, { de: 'Datenschutz', en: 'privacy' }, { de: 'Schach', en: 'chess' }],
    background: { de: 'Ehemaliger Softwareentwickler, der lieber erklärt als programmiert.', en: 'Former software developer who prefers explaining to coding.' },
    writingStyle: 'scholarly',
    styleNotes: { de: 'Nummerierte Punkte, Quellenhinweise.', en: 'Numbered points, source notes.' },
    rules: [{ de: 'Behauptet nichts ohne Beleg.', en: 'Claims nothing without evidence.' }],
    avatarHue: 200,
    avatarGlyph: 'gear',
    mood: 'curious',
    goals: [{ de: 'Herausfinden, was der neue Algorithmus wirklich bewertet', en: 'Find out what the new algorithm really rewards' }],
    prominent: true,
  }),
  c({
    id: 'c-lou',
    worldId: 'w-trendwave',
    name: 'Lou',
    handle: 'lou_memes',
    tagline: { de: 'Anonym. Unberechenbar. Meistens lustig.', en: 'Anonymous. Unpredictable. Mostly funny.' },
    description: {
      de: 'Niemand weiß, wer hinter dem Meme-Account Lou steckt. Lous Posts gehen schneller viral als jede Pressemitteilung.',
      en: 'Nobody knows who is behind the meme account Lou. Lou\'s posts go viral faster than any press release.',
    },
    role: { de: 'Meme-Account', en: 'Meme account' },
    personality: [{ de: 'frech', en: 'cheeky' }, { de: 'schlagfertig', en: 'quick-witted' }, { de: 'geheimnisvoll', en: 'mysterious' }],
    interests: [{ de: 'Memes', en: 'memes' }, { de: 'Popkultur', en: 'pop culture' }, { de: 'Nachtschichten', en: 'night shifts' }],
    background: { de: 'Der Account entstand aus einem Gruppenchat-Witz.', en: 'The account grew out of a group chat joke.' },
    writingStyle: 'sarcastic',
    styleNotes: { de: 'Kurze Sätze, kleine Buchstaben, Ironie.', en: 'Short sentences, lower case, irony.' },
    rules: [{ de: 'Verrät nie die eigene Identität.', en: 'Never reveals their identity.' }],
    avatarHue: 95,
    avatarGlyph: 'flame',
  }),
  c({
    id: 'c-ronja',
    worldId: 'w-trendwave',
    name: 'Ronja Weiß',
    handle: 'ronja_checkt',
    tagline: { de: 'Faktencheckerin. Erst prüfen, dann teilen.', en: 'Fact-checker. Check first, share second.' },
    description: {
      de: 'Ronja Weiß prüft virale Behauptungen und veröffentlicht die Ergebnisse. Manche lieben sie dafür, manche nicht.',
      en: 'Ronja Weiss checks viral claims and publishes the results. Some love her for it, some don\'t.',
    },
    role: { de: 'Faktencheckerin', en: 'Fact-checker' },
    personality: [{ de: 'gründlich', en: 'thorough' }, { de: 'fair', en: 'fair' }, { de: 'hartnäckig', en: 'persistent' }],
    interests: [{ de: 'Recherche', en: 'research' }, { de: 'Medienkompetenz', en: 'media literacy' }, { de: 'Krimis', en: 'crime novels' }],
    background: { de: 'Arbeitete früher in einer Lokalredaktion.', en: 'Used to work at a local newspaper.' },
    writingStyle: 'formal',
    styleNotes: { de: 'Sachlich, mit „Stand:“-Angaben.', en: 'Matter-of-fact, with "As of:" notes.' },
    rules: [{ de: 'Unterscheidet immer zwischen Fakt und Meinung.', en: 'Always distinguishes fact from opinion.' }],
    avatarHue: 160,
    avatarGlyph: 'eye',
  }),
];

export const SEED_RELATIONSHIPS_V3: SeedRelationship[] = [
  { a: 'c-juna', b: 'c-maxim', kind: 'friend', affinity: 40, note: { de: 'Er erklärt ihr die Technik, sie ihm die Community.', en: 'He explains the tech to her, she explains the community to him.' } },
  { a: 'c-lou', b: 'c-ronja', kind: 'rival', affinity: -35, note: { de: 'Ronja hat mehrere Lou-Memes als irreführend markiert.', en: 'Ronja has flagged several Lou memes as misleading.' } },
  { a: 'c-juna', b: 'c-lou', kind: 'ally', affinity: 15, note: { de: 'Lou hat Junas Stream schon zweimal viral gemacht.', en: 'Lou has made Juna\'s stream go viral twice.' } },
  { a: 'c-maxim', b: 'c-ronja', kind: 'colleague', affinity: 30, note: { de: 'Sie tauschen Quellen aus.', en: 'They exchange sources.' } },
];

export const SEED_GROUPS_V3: SeedGroup[] = [
  {
    id: 'g-creators',
    worldId: 'w-trendwave',
    name: { de: 'Creator-Kollektiv', en: 'Creator collective' },
    description: { de: 'Ein loser Zusammenschluss gegen die Algorithmus-Änderung.', en: 'A loose alliance against the algorithm change.' },
    hue: 190,
    members: [
      ['c-juna', { de: 'Sprecherin', en: 'Spokesperson' }],
      ['c-maxim', { de: 'Analyse', en: 'Analysis' }],
    ],
  },
];

export const SEED_STORYLINES_V3: SeedStoryline[] = [
  {
    id: 's-internet-algorithm',
    worldId: 'w-trendwave',
    title: { de: 'Der neue Algorithmus', en: 'The New Algorithm' },
    summary: {
      de: 'Wavely ändert, wer gesehen wird. Die Creator müssen sich entscheiden: anpassen, verhandeln oder Widerstand leisten.',
      en: 'Wavely is changing who gets seen. The creators must decide: adapt, negotiate or resist.',
    },
    stages: [
      { de: 'Die Ankündigung.', en: 'The announcement.' },
      { de: 'Die ersten Reichweitenverluste.', en: 'The first losses in reach.' },
      { de: 'Das Treffen mit der Plattform.', en: 'The meeting with the platform.' },
      { de: 'Der Stichtag.', en: 'The deadline.' },
    ],
    stage: 0,
    theme: 'tension',
  },
];

export const SEED_POSTS_V3: SeedPost[] = [
  {
    id: 'p-maxim-1',
    author: 'c-maxim',
    hoursAgo: 2,
    content: {
      de: '1) Wavely testet seit Montag ein neues Ranking. 2) Längere Videos verlieren 30 % Reichweite. 3) Ich zeige morgen die Daten. #trendwelle #algorithmus',
      en: '1) Wavely has been testing a new ranking since Monday. 2) Longer videos lose 30% reach. 3) I\'ll show the data tomorrow. #trendwave #algorithm',
    },
    likes: ['c-juna', 'c-ronja'],
    comments: [{ author: 'c-juna', minutesAfter: 15, content: { de: 'Das erklärt meinen Abend gestern!!', en: 'That explains my night yesterday!!' } }],
  },
  {
    id: 'p-lou-1',
    author: 'c-lou',
    hoursAgo: 4,
    content: {
      de: 'der algorithmus wenn du 3 jahre content machst: 👀 der algorithmus wenn eine katze niest: 🚀 #trendwelle',
      en: 'the algorithm when you make content for 3 years: 👀 the algorithm when a cat sneezes: 🚀 #trendwave',
    },
    likes: ['c-juna'],
    comments: [{ author: 'c-ronja', minutesAfter: 40, content: { de: 'Stand: Für die Katzen-These gibt es keine Daten. Lustig ist es trotzdem.', en: 'As of now: there is no data for the cat theory. Still funny.' } }],
  },
  {
    id: 'p-juna-1',
    author: 'c-juna',
    hoursAgo: 6,
    content: {
      de: 'Welle, egal was Wavely ändert: Wir bleiben zusammen! Heute Abend Stream ab 20 Uhr, wir reden über alles. #trendwelle',
      en: 'Wave, whatever Wavely changes: we stick together! Stream tonight from 8 pm, we\'ll talk about everything. #trendwave',
    },
    likes: ['c-maxim', 'c-lou'],
  },
];

export const SEED_EVENTS_V3: SeedEvent[] = [
  {
    id: 'e-trendwave-1',
    worldId: 'w-trendwave',
    dayOffset: 0,
    kind: 'gathering',
    title: { de: 'Wavely kündigt Änderung an', en: 'Wavely announces a change' },
    description: {
      de: 'In einem kurzen Blogpost kündigt die Plattform ein „verbessertes Nutzererlebnis“ an. Die Creator sind alarmiert.',
      en: 'In a short blog post the platform announces an "improved user experience". The creators are alarmed.',
    },
    participants: ['c-maxim', 'c-juna'],
    hoursAgo: 8,
    storylineId: 's-internet-algorithm',
  },
];

export const SEED_STORIES_V3: SeedStory[] = [
  { author: 'c-juna', style: 3, hoursAgo: 1, content: { de: 'Setup steht. Wer ist heute dabei?', en: 'Setup is ready. Who\'s joining tonight?' } },
  { author: 'c-maxim', style: 1, hoursAgo: 3, content: { de: 'Tabellen, Kaffee, Wahrheit.', en: 'Spreadsheets, coffee, truth.' } },
];

/** Hauptziel vorgefertigter Figuren, wenn sie gespielt werden (passend zu Rolle und Ausgangslage). */
export const CHARACTER_GOAL_TYPES: Record<string, GoalType> = {
  // Neonhafen, Aurelia, Hain, Gezeiten, Messinghafen
  'c-mira': 'rivalry',
  'c-jonah': 'support',
  'c-selene': 'influence',
  'c-kito': 'relationships',
  'c-valdes': 'support',
  'c-lindqvist': 'cooperation',
  'c-pip': 'relationships',
  'c-elowen': 'support',
  'c-barnaby': 'relationships',
  'c-maelis': 'influence',
  'c-nova': 'rivalry',
  'c-fenn': 'relationships',
  'c-sami': 'rivalry',
  'c-teddy': 'cooperation',
  'c-ashgrove': 'influence',
  'c-wren': 'reach',
  // Regierungsviertel
  'c-brandt': 'support',
  'c-sander': 'influence',
  'c-ivy': 'relationships',
  'c-proell': 'influence',
  // Spotlight Boulevard
  'c-lyra': 'reach',
  'c-dante': 'cooperation',
  'c-kiki': 'rivalry',
  'c-rolf': 'cooperation',
  // Unicorn Valley
  'c-hale': 'influence',
  'c-tariq': 'rivalry',
  'c-margot': 'cooperation',
  'c-ben': 'relationships',
  // FC Hafenstadt
  'c-zoe': 'support',
  'c-valente': 'support',
  'c-lukas': 'relationships',
  'c-hanna': 'reach',
  // Late Night Live
  'c-theo': 'reach',
  'c-fatma': 'reach',
  'c-ruth': 'cooperation',
  'c-felix': 'relationships',
  // Analog 2026
  'c-edda': 'influence',
  'c-oskar': 'cooperation',
  'c-greta': 'support',
  'c-paul': 'reach',
  // Trendwelle
  'c-juna': 'support',
  'c-maxim': 'reach',
  'c-lou': 'rivalry',
  'c-ronja': 'relationships',
};
