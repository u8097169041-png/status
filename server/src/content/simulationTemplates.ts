import type { WorldMetric } from '../../../shared/constants';
import type { L } from './seedWorlds';

/**
 * Vorlagen für die lokale, deterministische Weltsimulation.
 * Platzhalter: {a} {b} (Namen), {aHandle} {bHandle}, {interest}, {world}, {tag}.
 */
export interface EventTemplate {
  id: string;
  kind: string;
  participants: 1 | 2;
  /** Bedingung an die Beziehung zwischen a und b. */
  requires?: 'positive' | 'negative';
  baseWeight: number;
  /** Zusätzliche Gewichtung je Weltmetrik (Wert/100 * Faktor). */
  metricWeight?: Partial<Record<WorldMetric, number>>;
  metrics: Partial<Record<WorldMetric, number>>;
  affinity?: number;
  mood: { a: string; b?: string };
  theme: WorldMetric;
  title: L;
  description: L;
  post: { by: 'a' | 'b'; text: L };
  comment?: { by: 'a' | 'b'; text: L };
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'shared-interest',
    kind: 'friendship',
    participants: 2,
    baseWeight: 3,
    metricWeight: { harmony: 2 },
    metrics: { harmony: 4, discovery: 2 },
    affinity: 12,
    mood: { a: 'happy', b: 'happy' },
    theme: 'harmony',
    title: { de: '{a} und {b} teilen eine Leidenschaft', en: '{a} and {b} share a passion' },
    description: {
      de: 'Bei einem zufälligen Treffen stellen {a} und {b} fest, dass sie beide für {interest} brennen. Aus einem kurzen Gespräch wird ein langer Abend.',
      en: 'At a chance meeting, {a} and {b} discover they are both passionate about {interest}. A short chat turns into a long evening.',
    },
    post: {
      by: 'a',
      text: {
        de: 'Unerwarteter Abend mit @{bHandle}: stundenlang über {interest} geredet. Hätte ich nicht gedacht. #{tag}',
        en: 'Unexpected evening with @{bHandle}: talked about {interest} for hours. Didn\'t see that coming. #{tag}',
      },
    },
    comment: { by: 'b', text: { de: 'Nächstes Mal bringe ich mehr Fragen mit.', en: 'Next time I\'m bringing more questions.' } },
  },
  {
    id: 'argument',
    kind: 'conflict',
    participants: 2,
    baseWeight: 2,
    metricWeight: { tension: 4 },
    metrics: { tension: 6, harmony: -4 },
    affinity: -15,
    mood: { a: 'tense', b: 'tense' },
    theme: 'tension',
    title: { de: 'Streit zwischen {a} und {b}', en: 'Argument between {a} and {b}' },
    description: {
      de: '{a} und {b} geraten öffentlich aneinander. Worte fallen, die sich nicht so leicht zurücknehmen lassen.',
      en: '{a} and {b} clash in public. Words are said that cannot easily be taken back.',
    },
    post: {
      by: 'a',
      text: {
        de: 'Manche verstehen einfach nicht, worum es hier wirklich geht. Ihr wisst, wen ich meine. #{tag}',
        en: 'Some people just don\'t get what this is really about. You know who you are. #{tag}',
      },
    },
    comment: { by: 'b', text: { de: 'Ich weiß genau, wen du meinst. Und ich bleibe dabei.', en: 'I know exactly who you mean. And I stand by it.' } },
  },
  {
    id: 'helping-hand',
    kind: 'support',
    participants: 2,
    baseWeight: 3,
    metricWeight: { harmony: 1, tension: 1 },
    metrics: { harmony: 3 },
    affinity: 10,
    mood: { a: 'happy', b: 'grateful' },
    theme: 'harmony',
    title: { de: '{a} hilft {b} aus der Klemme', en: '{a} helps {b} out of a jam' },
    description: {
      de: 'Als bei {b} alles schiefzugehen droht, springt {a} ohne zu zögern ein.',
      en: 'When everything threatens to go wrong for {b}, {a} steps in without hesitation.',
    },
    post: {
      by: 'b',
      text: {
        de: 'Danke, @{aHandle}. Ohne dich wäre heute alles schiefgegangen. #{tag}',
        en: 'Thank you, @{aHandle}. Without you today would have gone completely wrong. #{tag}',
      },
    },
  },
  {
    id: 'strange-find',
    kind: 'discovery',
    participants: 1,
    baseWeight: 2,
    metricWeight: { discovery: 4 },
    metrics: { discovery: 8 },
    mood: { a: 'curious' },
    theme: 'discovery',
    title: { de: '{a} macht eine merkwürdige Entdeckung', en: '{a} makes a strange discovery' },
    description: {
      de: 'Beim Streifzug durch {world} stößt {a} auf etwas, das nicht dorthin gehört. Niemand kann es bisher erklären.',
      en: 'While roaming {world}, {a} stumbles upon something that doesn\'t belong there. Nobody can explain it yet.',
    },
    post: {
      by: 'a',
      text: {
        de: 'Ich habe etwas gefunden, das ich mir nicht erklären kann. Mehr, sobald ich sicher bin. #{tag}',
        en: 'I found something I can\'t explain. More once I\'m sure. #{tag}',
      },
    },
  },
  {
    id: 'celebration',
    kind: 'celebration',
    participants: 2,
    baseWeight: 2,
    metricWeight: { harmony: 3 },
    metrics: { harmony: 8, tension: -4 },
    affinity: 6,
    mood: { a: 'happy', b: 'happy' },
    theme: 'harmony',
    title: { de: 'Spontanes Fest bei {a}', en: 'Spontaneous party at {a}\'s place' },
    description: {
      de: '{a} lädt kurzerhand zum Feiern ein. {b} bringt Musik mit – und für einen Abend vergessen alle ihre Sorgen.',
      en: '{a} throws an impromptu party. {b} brings music – and for one evening everyone forgets their worries.',
    },
    post: {
      by: 'a',
      text: {
        de: 'Danke an alle, die gestern da waren! Besonders an @{bHandle} für die Musik. #{tag}',
        en: 'Thanks to everyone who came last night! Especially @{bHandle} for the music. #{tag}',
      },
    },
  },
  {
    id: 'rumor',
    kind: 'rumor',
    participants: 2,
    baseWeight: 2,
    metricWeight: { tension: 2 },
    metrics: { tension: 5 },
    affinity: -10,
    mood: { a: 'smug', b: 'annoyed' },
    theme: 'tension',
    title: { de: 'Ein Gerücht über {b}', en: 'A rumour about {b}' },
    description: {
      de: 'Ein Gerücht über {b} macht die Runde. Die Spur führt angeblich zu {a}.',
      en: 'A rumour about {b} is making the rounds. The trail supposedly leads to {a}.',
    },
    post: {
      by: 'b',
      text: {
        de: 'Für alle, die gerade Geschichten über mich erzählen: Fragt mich doch einfach direkt. #{tag}',
        en: 'To everyone telling stories about me right now: just ask me directly. #{tag}',
      },
    },
  },
  {
    id: 'escalation',
    kind: 'rivalry',
    participants: 2,
    requires: 'negative',
    baseWeight: 3,
    metricWeight: { tension: 3 },
    metrics: { tension: 8, harmony: -3 },
    affinity: -8,
    mood: { a: 'angry', b: 'determined' },
    theme: 'tension',
    title: { de: 'Die Rivalität zwischen {a} und {b} spitzt sich zu', en: 'The rivalry between {a} and {b} escalates' },
    description: {
      de: 'Was als Meinungsverschiedenheit begann, wird zum offenen Wettstreit. Ganz {world} schaut zu.',
      en: 'What started as a disagreement turns into open competition. All of {world} is watching.',
    },
    post: {
      by: 'a',
      text: {
        de: 'Ich habe @{bHandle} eine faire Chance gegeben. Jetzt reicht es. #{tag}',
        en: 'I gave @{bHandle} a fair chance. Enough is enough. #{tag}',
      },
    },
    comment: { by: 'b', text: { de: 'Wir werden sehen, wer am Ende recht behält.', en: 'We\'ll see who\'s right in the end.' } },
  },
  {
    id: 'reconciliation',
    kind: 'reconciliation',
    participants: 2,
    requires: 'negative',
    baseWeight: 2,
    metricWeight: { harmony: 3 },
    metrics: { tension: -5, harmony: 5 },
    affinity: 20,
    mood: { a: 'hopeful', b: 'surprised' },
    theme: 'harmony',
    title: { de: '{a} reicht {b} die Hand', en: '{a} extends a hand to {b}' },
    description: {
      de: 'Nach langer Funkstille macht {a} den ersten Schritt auf {b} zu. Ein vorsichtiger Neuanfang?',
      en: 'After a long silence, {a} takes the first step towards {b}. A careful new beginning?',
    },
    post: {
      by: 'a',
      text: {
        de: 'Manchmal muss man über seinen Schatten springen. @{bHandle}, danke fürs Zuhören. #{tag}',
        en: 'Sometimes you have to swallow your pride. @{bHandle}, thanks for listening. #{tag}',
      },
    },
  },
  {
    id: 'quiet-day',
    kind: 'daily-life',
    participants: 1,
    baseWeight: 2,
    metrics: { harmony: 1 },
    mood: { a: 'relaxed' },
    theme: 'harmony',
    title: { de: 'Ein ruhiger Tag für {a}', en: 'A quiet day for {a}' },
    description: {
      de: '{a} nimmt sich einen Tag für {interest}. Auch das gehört zum Leben in {world}.',
      en: '{a} takes a day off for {interest}. That, too, is part of life in {world}.',
    },
    post: {
      by: 'a',
      text: { de: 'Heute einfach mal {interest}. Mehr brauche ich gerade nicht. #{tag}', en: 'Just {interest} today. That\'s all I need right now. #{tag}' },
    },
  },
  {
    id: 'setback',
    kind: 'setback',
    participants: 1,
    baseWeight: 1,
    metricWeight: { tension: 2 },
    metrics: { tension: 4, harmony: -2 },
    mood: { a: 'sad' },
    theme: 'tension',
    title: { de: 'Rückschlag für {a}', en: 'Setback for {a}' },
    description: {
      de: 'Ein Plan von {a} scheitert auf ganzer Linie. Die Nachricht verbreitet sich schnell.',
      en: 'One of {a}\'s plans fails completely. The news spreads quickly.',
    },
    post: {
      by: 'a',
      text: { de: 'Nicht mein Tag. Morgen versuche ich es noch einmal. #{tag}', en: 'Not my day. I\'ll try again tomorrow. #{tag}' },
    },
  },
];

/** Generische Storylines, die entstehen, wenn eine Welt keine aktive Storyline mehr hat. */
export const STORYLINE_TEMPLATES: { theme: WorldMetric; title: L; summary: L; stages: L[] }[] = [
  {
    theme: 'discovery',
    title: { de: 'Ein altes Geheimnis', en: 'An old secret' },
    summary: {
      de: 'Seltsame Hinweise deuten darauf hin, dass {world} ein Geheimnis verbirgt.',
      en: 'Strange clues suggest that {world} is hiding a secret.',
    },
    stages: [
      { de: 'Erste Hinweise tauchen auf.', en: 'First clues appear.' },
      { de: 'Eine Spur führt tiefer.', en: 'A trail leads deeper.' },
      { de: 'Die Wahrheit wird enthüllt.', en: 'The truth is revealed.' },
    ],
  },
  {
    theme: 'tension',
    title: { de: 'Machtprobe', en: 'Test of strength' },
    summary: {
      de: 'In {world} wächst der Streit darüber, wer das Sagen hat.',
      en: 'In {world}, the dispute over who is in charge is growing.',
    },
    stages: [
      { de: 'Spannungen wachsen.', en: 'Tensions grow.' },
      { de: 'Die Fronten verhärten sich.', en: 'The fronts harden.' },
      { de: 'Eine Entscheidung fällt.', en: 'A decision is made.' },
    ],
  },
  {
    theme: 'harmony',
    title: { de: 'Gemeinsam stärker', en: 'Stronger together' },
    summary: {
      de: 'Eine Idee könnte die Bewohner von {world} enger zusammenbringen.',
      en: 'An idea could bring the people of {world} closer together.',
    },
    stages: [
      { de: 'Eine Idee entsteht.', en: 'An idea is born.' },
      { de: 'Alle packen mit an.', en: 'Everyone pitches in.' },
      { de: 'Ein Fest für alle.', en: 'A celebration for everyone.' },
    ],
  },
];

export const STORYLINE_TEXT = {
  advanceTitle: { de: '{title}: {stage}', en: '{title}: {stage}' },
  advanceDescription: {
    de: 'Die Geschichte „{title}“ entwickelt sich weiter: {stage}',
    en: 'The story "{title}" moves on: {stage}',
  },
  resolvedDescription: {
    de: 'Die Geschichte „{title}“ ist abgeschlossen: {stage}',
    en: 'The story "{title}" has concluded: {stage}',
  },
  post: {
    de: 'Neuigkeiten zu „{title}“: {stage} #{tag}',
    en: 'News on "{title}": {stage} #{tag}',
  },
  newStoryline: {
    de: 'Ein neues Kapitel beginnt: {title}',
    en: 'A new chapter begins: {title}',
  },
} satisfies Record<string, L>;

/** Ereigniskarten, die Nutzer gezielt auslösen können. */
export interface CardTemplate {
  id: string;
  needsTargets: 0 | 1 | 2;
  metrics: Partial<Record<WorldMetric, number>>;
  affinity?: number;
  /** Zusätzliche zufällige Paare mit Zuneigungsänderung. */
  randomPairs?: { count: number; delta: number };
  advanceTheme?: WorldMetric;
  mood?: string;
  /** Premium-Karte: erst nach dem Kauf im Shop (mit Spielwährung) nutzbar. */
  shopItem?: string;
  /** Bei echten Personen (KI-Simulation) nicht erlaubt, weil die Karte ihnen Negatives andichtet. */
  negative?: boolean;
  title: L;
  description: L;
  posts: L[];
}

export const EVENT_CARDS: CardTemplate[] = [
  {
    id: 'festival',
    needsTargets: 0,
    metrics: { harmony: 12, tension: -6 },
    randomPairs: { count: 3, delta: 5 },
    advanceTheme: 'harmony',
    mood: 'happy',
    title: { de: 'Großes Fest in {world}', en: 'Grand festival in {world}' },
    description: {
      de: 'Auf Initiative von {user} feiert ganz {world}. Alte Streitigkeiten treten für einen Abend in den Hintergrund.',
      en: 'On {user}\'s initiative, all of {world} celebrates. Old quarrels fade into the background for one evening.',
    },
    posts: [
      { de: 'Was für ein Abend! Danke an alle, die dieses Fest möglich gemacht haben. #{tag}', en: 'What a night! Thanks to everyone who made this festival happen. #{tag}' },
      { de: 'Ich habe getanzt. Erzählt es niemandem. #{tag}', en: 'I danced. Don\'t tell anyone. #{tag}' },
    ],
  },
  {
    id: 'rumor',
    needsTargets: 2,
    negative: true,
    metrics: { tension: 8 },
    affinity: -18,
    advanceTheme: 'tension',
    mood: 'tense',
    title: { de: 'Gerüchteküche: {a} und {b}', en: 'Rumour mill: {a} and {b}' },
    description: {
      de: 'Ein anonymes Gerücht stellt {a} und {b} gegeneinander. Wer hat es in die Welt gesetzt?',
      en: 'An anonymous rumour pits {a} against {b}. Who started it?',
    },
    posts: [
      { de: 'Ich habe gehört, was über mich erzählt wird. @{bHandle}, wir müssen reden. #{tag}', en: 'I heard what people are saying about me. @{bHandle}, we need to talk. #{tag}' },
      { de: 'Interessant, wie schnell sich Geschichten verbreiten, wenn sie nicht stimmen. #{tag}', en: 'Funny how fast stories spread when they aren\'t true. #{tag}' },
    ],
  },
  {
    id: 'mystery',
    needsTargets: 0,
    metrics: { discovery: 14 },
    advanceTheme: 'discovery',
    mood: 'curious',
    title: { de: 'Ein Rätsel erschüttert {world}', en: 'A mystery shakes {world}' },
    description: {
      de: 'Über Nacht taucht in {world} etwas Unerklärliches auf. Alle haben eine Theorie.',
      en: 'Overnight, something inexplicable appears in {world}. Everyone has a theory.',
    },
    posts: [
      { de: 'Hat noch jemand das gesehen?! Ich glaube nicht an Zufälle. #{tag}', en: 'Did anyone else see that?! I don\'t believe in coincidences. #{tag}' },
      { de: 'Meine Theorie: Es hängt alles zusammen. Beweise folgen. #{tag}', en: 'My theory: it\'s all connected. Evidence to follow. #{tag}' },
    ],
  },
  {
    id: 'reconcile',
    needsTargets: 2,
    metrics: { tension: -6, harmony: 4 },
    affinity: 22,
    advanceTheme: 'harmony',
    mood: 'hopeful',
    title: { de: 'Vermittlung zwischen {a} und {b}', en: 'Mediation between {a} and {b}' },
    description: {
      de: '{user} bringt {a} und {b} an einen Tisch. Zum ersten Mal hören sie einander wirklich zu.',
      en: '{user} brings {a} and {b} to the same table. For the first time they truly listen to each other.',
    },
    posts: [
      { de: 'Ein gutes Gespräch mit @{bHandle}. Vielleicht lagen wir gar nicht so weit auseinander. #{tag}', en: 'A good talk with @{bHandle}. Maybe we weren\'t so far apart after all. #{tag}' },
    ],
  },
  {
    id: 'crisis',
    needsTargets: 0,
    metrics: { tension: 14, harmony: -8 },
    randomPairs: { count: 2, delta: -6 },
    advanceTheme: 'tension',
    mood: 'tense',
    title: { de: 'Krise in {world}', en: 'Crisis in {world}' },
    description: {
      de: 'Ein unerwarteter Notfall bringt {world} an seine Grenzen. Jetzt zeigt sich, wer zusammenhält.',
      en: 'An unexpected emergency pushes {world} to its limits. Now it shows who sticks together.',
    },
    posts: [
      { de: 'Bleibt ruhig und helft einander. Wir schaffen das. #{tag}', en: 'Stay calm and help each other. We\'ll get through this. #{tag}' },
      { de: 'Das war absehbar. Hat nur niemand hören wollen. #{tag}', en: 'This was foreseeable. Nobody wanted to listen. #{tag}' },
    ],
  },
  {
    id: 'alliance',
    needsTargets: 2,
    metrics: { harmony: 3 },
    affinity: 12,
    mood: 'determined',
    title: { de: 'Bündnis: {a} und {b}', en: 'Alliance: {a} and {b}' },
    description: {
      de: '{a} und {b} beschließen, künftig gemeinsame Sache zu machen.',
      en: '{a} and {b} decide to join forces from now on.',
    },
    posts: [
      { de: 'Ab heute arbeiten @{bHandle} und ich zusammen. Gute Neuigkeiten für alle. #{tag}', en: 'From today, @{bHandle} and I are working together. Good news for everyone. #{tag}' },
    ],
  },
  {
    id: 'spotlight',
    needsTargets: 1,
    metrics: { discovery: 3, harmony: 2 },
    mood: 'happy',
    title: { de: 'Bühne frei für {a}', en: 'Spotlight on {a}' },
    description: {
      de: '{a} steht plötzlich im Mittelpunkt von {world} – und nutzt die Gelegenheit.',
      en: '{a} suddenly finds themselves at the centre of {world} – and seizes the moment.',
    },
    posts: [
      { de: 'Ich habe nicht damit gerechnet, dass so viele zuhören. Danke! Hier ist, was mir am Herzen liegt: {interest}. #{tag}', en: 'I didn\'t expect so many people to listen. Thank you! Here\'s what matters to me: {interest}. #{tag}' },
    ],
  },
  {
    id: 'gala',
    needsTargets: 0,
    shopItem: 'card-gala',
    metrics: { harmony: 10, discovery: 4 },
    randomPairs: { count: 3, delta: 6 },
    advanceTheme: 'harmony',
    mood: 'happy',
    title: { de: 'Gala-Abend in {world}', en: 'Gala night in {world}' },
    description: {
      de: '{user} lädt zur großen Gala. Rote Teppiche, Reden und überraschende Begegnungen prägen den Abend.',
      en: '{user} hosts a grand gala. Red carpets, speeches and surprising encounters shape the evening.',
    },
    posts: [
      { de: 'Was für eine Gala! Ich habe Menschen getroffen, mit denen ich nie gerechnet hätte. #{tag}', en: 'What a gala! I met people I never expected to meet. #{tag}' },
      { de: 'Bestes Outfit des Abends? Ich sage nur: Ich war da. #{tag}', en: 'Best outfit of the night? All I\'m saying is: I was there. #{tag}' },
    ],
  },
  {
    id: 'breaking-news',
    needsTargets: 1,
    shopItem: 'card-breaking-news',
    metrics: { discovery: 10, tension: 4 },
    advanceTheme: 'discovery',
    mood: 'determined',
    title: { de: 'Eilmeldung: {a} im Fokus', en: 'Breaking: all eyes on {a}' },
    description: {
      de: 'Eine (simulierte) Eilmeldung rückt {a} in den Mittelpunkt. Ganz {world} diskutiert, was als Nächstes kommt.',
      en: 'A (simulated) breaking story puts {a} in the spotlight. All of {world} debates what comes next.',
    },
    posts: [
      { de: 'Ja, ihr habt richtig gehört. Mein Statement folgt – und zwar ausführlich. #{tag}', en: 'Yes, you heard right. My statement will follow – in full. #{tag}' },
    ],
  },
  {
    id: 'summit',
    needsTargets: 2,
    shopItem: 'card-summit',
    metrics: { tension: -10, harmony: 6 },
    affinity: 18,
    advanceTheme: 'harmony',
    mood: 'hopeful',
    title: { de: 'Gipfeltreffen: {a} und {b}', en: 'Summit: {a} and {b}' },
    description: {
      de: '{user} organisiert ein Gipfeltreffen. {a} und {b} verhandeln hinter verschlossenen Türen.',
      en: '{user} arranges a summit. {a} and {b} negotiate behind closed doors.',
    },
    posts: [
      { de: 'Produktives Treffen mit @{bHandle}. Mehr dazu bald. #{tag}', en: 'Productive meeting with @{bHandle}. More soon. #{tag}' },
    ],
  },
  {
    id: 'custom',
    needsTargets: 0,
    metrics: {},
    title: { de: '{title}', en: '{title}' },
    description: { de: '{description}', en: '{description}' },
    posts: [
      { de: 'Habt ihr das mitbekommen? „{title}“ – das wird {world} verändern. #{tag}', en: 'Did you hear? "{title}" – this will change {world}. #{tag}' },
      { de: 'Zu „{title}“: Ich habe meine eigene Meinung dazu. Und die ist nicht gerade leise. #{tag}', en: 'About "{title}": I have my own opinion on that. And it\'s not exactly quiet. #{tag}' },
    ],
  },
];

export const STORY_TEMPLATES: L[] = [
  { de: 'Kurzes Update: {interest} hält mich heute auf Trab.', en: 'Quick update: {interest} is keeping me busy today.' },
  { de: 'Stimmung heute: {mood}. Und ihr?', en: 'Mood today: {mood}. You?' },
  { de: 'Gerade in {world} unterwegs. Es liegt etwas in der Luft.', en: 'Out and about in {world}. Something is in the air.' },
];
