import type { GoalType } from '../../../shared/skills';
import type { EndingTemplate } from './arcEndings';
import type { SeedEvent, SeedPost, SeedStory } from './seedPosts';
import type { SeedCharacter, SeedGroup, SeedRelationship, SeedStoryline, SeedWorld } from './seedWorlds';

/**
 * Welt aus Version 4: Dating. Alle Figuren sind frei erfunden und erwachsen (Alter steht in der Beschreibung).
 * Romantische Inhalte bleiben altersgerecht und nicht explizit.
 */
export const SEED_WORLDS_V4: SeedWorld[] = [
  {
    id: 'w-heartbeat',
    name: { de: 'Herzklopfen', en: 'Heartbeat' },
    tagline: {
      de: 'Ein Viertel, ein Café, eine Dating-App – und viele Herzen, die sich nicht entscheiden können.',
      en: 'One neighbourhood, one café, one dating app – and many hearts that can\'t make up their minds.',
    },
    genre: 'dating',
    description: {
      de: 'Im Lindenhof kennt jeder jeden. Buchhändlerin Lena sitzt jeden Morgen am Fensterplatz im Café „Zweite Tasse“, das Jonas mit viel Herz betreibt. Gründer Milan will mit seiner App „Spark“ das Viertel zum Dating-Hotspot machen, Podcasterin Nora sucht Paare für ein Blind-Date-Experiment, Tanzlehrerin Aylin passt auf ihre beste Freundin auf – und Architektin Clara fragt sich nach zwölf Ehejahren, wie es weitergeht.',
      en: 'In Linden Court everyone knows everyone. Bookseller Lena sits at the window seat of the café "Second Cup" every morning, which Jonas runs with a lot of heart. Founder Milan wants to turn the neighbourhood into a dating hotspot with his app "Spark", podcaster Nora is looking for couples for a blind date experiment, dance teacher Aylin looks out for her best friend – and architect Clara wonders, after twelve years of marriage, what comes next.',
    },
    lore: {
      de: 'Seit „Spark“ im Viertel getestet wird, gibt es mehr erste Dates als je zuvor – und mehr Missverständnisse. Die Bank am Kanal hat schon Liebeserklärungen und Abschiede gesehen.',
      en: 'Since "Spark" started testing in the neighbourhood there have been more first dates than ever – and more misunderstandings. The bench by the canal has seen confessions of love and farewells.',
    },
    atmosphere: {
      de: 'Lichterketten, Kaffeeduft, Herzklopfen und viele ungesendete Nachrichten.',
      en: 'String lights, the smell of coffee, butterflies and many unsent messages.',
    },
    rules: [
      { de: 'Alle Figuren sind frei erfunden und erwachsen.', en: 'All characters are fictional and adults.' },
      { de: 'Romantik bleibt respektvoll und nicht explizit.', en: 'Romance stays respectful and non-explicit.' },
      { de: 'Ehrlichkeit wirkt länger als jede große Geste.', en: 'Honesty lasts longer than any grand gesture.' },
    ],
    artStyle: 'romance',
    hue: 340,
    day: 1,
    metrics: { harmony: 55, tension: 45, discovery: 60 },
  },
];

const c = (x: Omit<SeedCharacter, 'mood'> & { mood?: string }): SeedCharacter => ({ mood: 'neutral', ...x });

export const SEED_CHARACTERS_V4: SeedCharacter[] = [
  c({
    id: 'c-hb-lena',
    worldId: 'w-heartbeat',
    name: 'Lena Vogt',
    handle: 'lena_liest',
    tagline: { de: 'Buchhändlerin (29). Glaubt an Happy Ends – meistens.', en: 'Bookseller (29). Believes in happy endings – mostly.' },
    description: {
      de: 'Lena Vogt, 29, führt den kleinen Buchladen im Lindenhof. Nach einer langen Beziehung ist sie seit Kurzem Single und unsicher, ob sie bereit für etwas Neues ist.',
      en: 'Lena Vogt, 29, runs the small bookshop in Linden Court. After a long relationship she has recently become single and is unsure whether she is ready for something new.',
    },
    role: { de: 'Buchhändlerin', en: 'Bookseller' },
    personality: [{ de: 'romantisch', en: 'romantic' }, { de: 'nachdenklich', en: 'thoughtful' }, { de: 'humorvoll', en: 'humorous' }],
    interests: [{ de: 'Liebesromane', en: 'romance novels' }, { de: 'Spaziergänge am Kanal', en: 'walks by the canal' }, { de: 'Flohmärkte', en: 'flea markets' }],
    background: { de: 'Hat den Buchladen von ihrer Tante übernommen.', en: 'Took over the bookshop from her aunt.' },
    writingStyle: 'poetic',
    styleNotes: { de: 'Zitiert gern Bücher, schreibt warm und ein wenig verträumt.', en: 'Likes to quote books, writes warmly and a little dreamily.' },
    rules: [{ de: 'Ist ehrlich, auch wenn es schwerfällt.', en: 'Is honest, even when it is hard.' }],
    avatarHue: 345,
    avatarGlyph: 'feather',
    mood: 'curious',
    goals: [{ de: 'Herausfinden, was sie wirklich will', en: 'Find out what she really wants' }],
    prominent: true,
  }),
  c({
    id: 'c-hb-jonas',
    worldId: 'w-heartbeat',
    name: 'Jonas Adeyemi',
    handle: 'zweite_tasse',
    tagline: { de: 'Barista & Cafébesitzer (32). Der beste Fensterplatz ist reserviert.', en: 'Barista & café owner (32). The best window seat is reserved.' },
    description: {
      de: 'Jonas Adeyemi, 32, betreibt das Café „Zweite Tasse“. Er ist herzlich und aufmerksam – nur über seine eigenen Gefühle spricht er ungern.',
      en: 'Jonas Adeyemi, 32, runs the café "Second Cup". He is warm and attentive – he just doesn\'t like talking about his own feelings.',
    },
    role: { de: 'Barista', en: 'Barista' },
    personality: [{ de: 'warmherzig', en: 'warm-hearted' }, { de: 'schüchtern', en: 'shy' }, { de: 'loyal', en: 'loyal' }],
    interests: [{ de: 'Kaffeeröstung', en: 'coffee roasting' }, { de: 'Jazz', en: 'jazz' }, { de: 'Kochen', en: 'cooking' }],
    background: { de: 'Hat das Café mit Erspartem und viel Mut eröffnet.', en: 'Opened the café with his savings and a lot of courage.' },
    writingStyle: 'casual',
    styleNotes: { de: 'Kurz, freundlich, mit Kaffee-Wortspielen.', en: 'Short, friendly, with coffee puns.' },
    rules: [{ de: 'Macht niemandem etwas vor.', en: 'Never pretends.' }],
    avatarHue: 25,
    avatarGlyph: 'leaf',
    goals: [{ de: 'Den Mut finden, Lena seine Gefühle zu zeigen', en: 'Find the courage to show Lena his feelings' }],
    prominent: true,
  }),
  c({
    id: 'c-hb-nora',
    worldId: 'w-heartbeat',
    name: 'Nora Kessler',
    handle: 'herzfrequenz',
    tagline: { de: 'Podcasterin (35). „Herzfrequenz“ – Liebe, ehrlich besprochen.', en: 'Podcaster (35). "Heart Rate" – love, honestly discussed.' },
    description: {
      de: 'Nora Kessler, 35, spricht in ihrem Podcast „Herzfrequenz“ über Dating, Beziehungen und Trennungen. Für die neue Staffel plant sie ein Blind-Date-Experiment im Viertel.',
      en: 'Nora Kessler, 35, talks about dating, relationships and breakups in her podcast "Heart Rate". For the new season she is planning a blind date experiment in the neighbourhood.',
    },
    role: { de: 'Podcasterin', en: 'Podcaster' },
    personality: [{ de: 'neugierig', en: 'curious' }, { de: 'direkt', en: 'direct' }, { de: 'empathisch', en: 'empathetic' }],
    interests: [{ de: 'Beziehungspsychologie', en: 'relationship psychology' }, { de: 'Interviews', en: 'interviews' }, { de: 'Brettspielabende', en: 'board game nights' }],
    background: { de: 'War früher Radiomoderatorin.', en: 'Used to be a radio presenter.' },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Stellt viele Fragen, spricht ihre Hörer direkt an.', en: 'Asks lots of questions, addresses her listeners directly.' },
    rules: [{ de: 'Erzählt nichts weiter, was ihr im Vertrauen gesagt wurde.', en: 'Never repeats what she was told in confidence.' }],
    avatarHue: 280,
    avatarGlyph: 'wave',
    mood: 'excited',
    goals: [{ de: 'Die beste Staffel ihres Podcasts produzieren', en: 'Produce the best season of her podcast' }],
    prominent: true,
  }),
  c({
    id: 'c-hb-milan',
    worldId: 'w-heartbeat',
    name: 'Milan Petrović',
    handle: 'milan_spark',
    tagline: { de: 'Gründer von „Spark“ (31). Jedes Match ist eine Geschichte.', en: 'Founder of "Spark" (31). Every match is a story.' },
    description: {
      de: 'Milan Petrović, 31, hat die Dating-App „Spark“ gegründet. Er ist charmant und voller Ideen – aber wenn es ernst wird, zieht er sich gern zurück.',
      en: 'Milan Petrović, 31, founded the dating app "Spark". He is charming and full of ideas – but when things get serious he tends to pull back.',
    },
    role: { de: 'App-Gründer', en: 'App founder' },
    personality: [{ de: 'charmant', en: 'charming' }, { de: 'ehrgeizig', en: 'ambitious' }, { de: 'unverbindlich', en: 'non-committal' }],
    interests: [{ de: 'Start-ups', en: 'start-ups' }, { de: 'Rooftop-Bars', en: 'rooftop bars' }, { de: 'Fotografie', en: 'photography' }],
    background: { de: 'Hat „Spark“ nach einer eigenen Trennung entwickelt.', en: 'Built "Spark" after a breakup of his own.' },
    writingStyle: 'casual',
    styleNotes: { de: 'Locker, selbstbewusst, gern mit einem Augenzwinkern.', en: 'Laid-back, confident, often with a wink.' },
    rules: [{ de: 'Respektiert ein Nein sofort.', en: 'Respects a no immediately.' }],
    avatarHue: 210,
    avatarGlyph: 'spark',
    goals: [{ de: '„Spark“ im Viertel groß machen', en: 'Make "Spark" big in the neighbourhood' }],
  }),
  c({
    id: 'c-hb-aylin',
    worldId: 'w-heartbeat',
    name: 'Aylin Demir',
    handle: 'aylin_tanzt',
    tagline: { de: 'Tanzlehrerin (28). Salsa heilt fast alles.', en: 'Dance teacher (28). Salsa fixes almost everything.' },
    description: {
      de: 'Aylin Demir, 28, unterrichtet Salsa und Bachata in der Tanzschule im Hinterhof. Sie ist Lenas beste Freundin – und sagt immer, was sie denkt.',
      en: 'Aylin Demir, 28, teaches salsa and bachata at the dance school in the courtyard. She is Lena\'s best friend – and always says what she thinks.',
    },
    role: { de: 'Tanzlehrerin', en: 'Dance teacher' },
    personality: [{ de: 'lebensfroh', en: 'joyful' }, { de: 'direkt', en: 'direct' }, { de: 'beschützend', en: 'protective' }],
    interests: [{ de: 'Salsa', en: 'salsa' }, { de: 'Musik', en: 'music' }, { de: 'Streetfood', en: 'street food' }],
    background: { de: 'Kennt Lena seit der Schulzeit.', en: 'Has known Lena since school.' },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Viele Ausrufezeichen, Tanz-Metaphern.', en: 'Lots of exclamation marks, dance metaphors.' },
    rules: [{ de: 'Steht immer zu ihren Freundinnen.', en: 'Always stands by her friends.' }],
    avatarHue: 15,
    avatarGlyph: 'flame',
    mood: 'happy',
    goals: [{ de: 'Lena vor Herzschmerz bewahren', en: 'Protect Lena from heartbreak' }],
  }),
  c({
    id: 'c-hb-clara',
    worldId: 'w-heartbeat',
    name: 'Clara Winter',
    handle: 'clara_baut',
    tagline: { de: 'Architektin (41). Plant Häuser – und manchmal ihr Leben neu.', en: 'Architect (41). Plans houses – and sometimes her life.' },
    description: {
      de: 'Clara Winter, 41, ist seit zwölf Jahren mit Elias verheiratet. Der Alltag hat die beiden auseinandergebracht – jetzt steht ihr Jahrestag bevor, und Clara weiß nicht, ob sie feiern oder reden soll.',
      en: 'Clara Winter, 41, has been married to Elias for twelve years. Everyday life has drifted them apart – now their anniversary is coming up, and Clara doesn\'t know whether to celebrate or to talk.',
    },
    role: { de: 'Architektin', en: 'Architect' },
    personality: [{ de: 'besonnen', en: 'level-headed' }, { de: 'warmherzig', en: 'warm-hearted' }, { de: 'zweifelnd', en: 'doubting' }],
    interests: [{ de: 'Altbauten', en: 'old buildings' }, { de: 'Gärtnern', en: 'gardening' }, { de: 'Jazzabende', en: 'jazz nights' }],
    background: { de: 'Hat das Haus am Kanal selbst renoviert.', en: 'Renovated the house by the canal herself.' },
    writingStyle: 'formal',
    styleNotes: { de: 'Ruhig, überlegt, ehrlich.', en: 'Calm, considered, honest.' },
    rules: [{ de: 'Trifft keine Entscheidung im Streit.', en: 'Never makes a decision in the middle of a fight.' }],
    avatarHue: 190,
    avatarGlyph: 'moon',
    mood: 'pensive',
    goals: [{ de: 'Klarheit über ihre Ehe gewinnen', en: 'Gain clarity about her marriage' }],
  }),
];

export const SEED_RELATIONSHIPS_V4: SeedRelationship[] = [
  { a: 'c-hb-jonas', b: 'c-hb-lena', kind: 'friend', affinity: 45, note: { de: 'Er reserviert ihr jeden Morgen den Fensterplatz. Beide lächeln öfter, als sie zugeben.', en: 'He reserves the window seat for her every morning. Both smile more often than they admit.' } },
  { a: 'c-hb-lena', b: 'c-hb-milan', kind: 'romance', affinity: 20, note: { de: 'Ein Match auf „Spark“, zwei schöne Dates – dann drei Tage Funkstille.', en: 'A match on "Spark", two lovely dates – then three days of silence.' } },
  { a: 'c-hb-jonas', b: 'c-hb-milan', kind: 'rival', affinity: -25, note: { de: 'Milan will das Café für Spark-Events mieten. Jonas will seinen ruhigen Laden behalten.', en: 'Milan wants to rent the café for Spark events. Jonas wants to keep his quiet place.' } },
  { a: 'c-hb-aylin', b: 'c-hb-lena', kind: 'friend', affinity: 70, note: { de: 'Beste Freundinnen seit der Schulzeit.', en: 'Best friends since school.' } },
  { a: 'c-hb-milan', b: 'c-hb-nora', kind: 'colleague', affinity: 10, note: { de: 'Nora bespricht „Spark“ in ihrem Podcast – freundlich, aber kritisch.', en: 'Nora covers "Spark" on her podcast – friendly but critical.' } },
  { a: 'c-hb-aylin', b: 'c-hb-jonas', kind: 'friend', affinity: 30, note: { de: 'Sie gibt im Café manchmal spontane Tanzstunden.', en: 'She sometimes gives spontaneous dance lessons in the café.' } },
  { a: 'c-hb-clara', b: 'c-hb-nora', kind: 'friend', affinity: 50, note: { de: 'Clara hat Nora von ihrer Ehekrise erzählt – im Vertrauen.', en: 'Clara told Nora about her marriage crisis – in confidence.' } },
  { a: 'c-hb-aylin', b: 'c-hb-milan', kind: 'rival', affinity: -10, note: { de: 'Aylin traut Milans Charme nicht.', en: 'Aylin doesn\'t trust Milan\'s charm.' } },
];

export const SEED_GROUPS_V4: SeedGroup[] = [
  {
    id: 'g-hb-cafe',
    worldId: 'w-heartbeat',
    name: { de: 'Stammtisch „Zweite Tasse“', en: '"Second Cup" regulars' },
    description: { de: 'Jeden Freitag: Kuchen, Klatsch und Liebeskummerberatung.', en: 'Every Friday: cake, gossip and heartbreak advice.' },
    hue: 25,
    members: [
      ['c-hb-jonas', { de: 'Gastgeber', en: 'Host' }],
      ['c-hb-lena', { de: 'Stammgast', en: 'Regular' }],
      ['c-hb-aylin', { de: 'Stimmungsmacherin', en: 'Life of the party' }],
    ],
  },
];

export const SEED_STORYLINES_V4: SeedStoryline[] = [
  {
    id: 's-hb-window',
    worldId: 'w-heartbeat',
    title: { de: 'Der Fensterplatz', en: 'The Window Seat' },
    summary: {
      de: 'Lena steht zwischen Jonas, der nie etwas sagt, und Milan, der zu viel verspricht. Ein Liebesdreieck – mit mehr als einem möglichen Ende.',
      en: 'Lena is caught between Jonas, who never says anything, and Milan, who promises too much. A love triangle – with more than one possible ending.',
    },
    stages: [
      { de: 'Die Nachricht nach drei Tagen Funkstille.', en: 'The message after three days of silence.' },
      { de: 'Das Missverständnis im Café.', en: 'The misunderstanding at the café.' },
      { de: 'Das Lichterfest im Lindenhof.', en: 'The festival of lights in Linden Court.' },
      { de: 'Die Entscheidung.', en: 'The decision.' },
    ],
    stage: 0,
    theme: 'tension',
  },
  {
    id: 's-hb-blind',
    worldId: 'w-heartbeat',
    title: { de: 'Das Blind-Date-Experiment', en: 'The Blind Date Experiment' },
    summary: {
      de: 'Nora bringt für ihren Podcast Fremde zu Blind Dates zusammen. Wer passt zu wem – und was passiert, wenn die Folge online geht?',
      en: 'Nora pairs up strangers for blind dates for her podcast. Who matches whom – and what happens when the episode goes online?',
    },
    stages: [
      { de: 'Die Anmeldung.', en: 'The sign-up.' },
      { de: 'Die Paarungen.', en: 'The pairings.' },
      { de: 'Der Abend der Wahrheit.', en: 'The night of truth.' },
      { de: 'Die Folge geht online.', en: 'The episode goes online.' },
    ],
    stage: 0,
    theme: 'discovery',
  },
  {
    id: 's-hb-twelve',
    worldId: 'w-heartbeat',
    title: { de: 'Zwölf Jahre', en: 'Twelve Years' },
    summary: {
      de: 'Clara und Elias haben sich auseinandergelebt. Zum Jahrestag stellt sich die Frage: neu anfangen, gemeinsam weitermachen oder getrennte Wege gehen?',
      en: 'Clara and Elias have drifted apart. Their anniversary raises the question: start over, carry on together or go separate ways?',
    },
    stages: [
      { de: 'Der vergessene Jahrestag.', en: 'The forgotten anniversary.' },
      { de: 'Das ehrliche Gespräch.', en: 'The honest conversation.' },
      { de: 'Zwei Wege.', en: 'Two paths.' },
    ],
    stage: 0,
    theme: 'harmony',
  },
];

/** Mögliche Enden der Dating-Geschichten – mutig, diplomatisch oder offen. */
export const ARC_ENDINGS_V4: Record<string, EndingTemplate[]> = {
  's-hb-window': [
    {
      path: 'bold',
      title: { de: 'Das Geständnis', en: 'The Confession' },
      description: {
        de: 'Beim Lichterfest sagt Jonas endlich, was er fühlt. Lena lächelt – und der Fensterplatz bekommt einen zweiten Stuhl.',
        en: 'At the festival of lights Jonas finally says what he feels. Lena smiles – and the window seat gets a second chair.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Zeit für mich', en: 'Time for Me' },
      description: {
        de: 'Lena spricht offen mit beiden und entscheidet sich vorerst für sich selbst. Alle bleiben Freunde – und das Viertel atmet auf.',
        en: 'Lena talks openly with both of them and chooses herself for now. Everyone stays friends – and the neighbourhood breathes a sigh of relief.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Eine zweite Chance', en: 'A Second Chance' },
      description: {
        de: 'Milan entschuldigt sich ehrlich für die Funkstille. Lena gibt ihm eine zweite Chance – ganz langsam und ohne App.',
        en: 'Milan honestly apologises for the silence. Lena gives him a second chance – very slowly and without the app.',
      },
    },
  ],
  's-hb-blind': [
    {
      path: 'bold',
      title: { de: 'Das Traumpaar', en: 'The Dream Couple' },
      description: {
        de: 'Ein Paar aus dem Experiment verliebt sich vor laufendem Mikrofon. Die Folge wird zum Hit, das Viertel feiert mit.',
        en: 'One couple from the experiment falls in love on the record. The episode becomes a hit and the neighbourhood celebrates.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Neue Freundschaften', en: 'New Friendships' },
      description: {
        de: 'Statt großer Romantik entstehen echte Freundschaften. Nora macht daraus ihre ehrlichste Folge.',
        en: 'Instead of grand romance, real friendships form. Nora turns it into her most honest episode.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Alles offen', en: 'All Open' },
      description: {
        de: 'Niemand weiß, wie es weitergeht. Die Folge endet mit einem Fragezeichen – und vielen Nachrichten von Hörern.',
        en: 'Nobody knows what happens next. The episode ends with a question mark – and many messages from listeners.',
      },
    },
  ],
  's-hb-twelve': [
    {
      path: 'bold',
      title: { de: 'Getrennte Wege', en: 'Separate Paths' },
      description: {
        de: 'Clara und Elias trennen sich – respektvoll und ohne Groll. Clara plant zum ersten Mal ein Haus nur für sich.',
        en: 'Clara and Elias separate – respectfully and without resentment. For the first time Clara plans a house just for herself.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Neuanfang zu zweit', en: 'A New Start Together' },
      description: {
        de: 'Nach vielen ehrlichen Gesprächen beschließen die beiden, neu anzufangen. Der nächste Jahrestag wird nicht vergessen.',
        en: 'After many honest conversations the two decide to start over. The next anniversary won\'t be forgotten.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Eine Pause', en: 'A Break' },
      description: {
        de: 'Clara und Elias nehmen sich eine Auszeit voneinander. Wie es ausgeht, entscheiden sie später.',
        en: 'Clara and Elias take some time apart. How it ends, they will decide later.',
      },
    },
  ],
};

export const SEED_POSTS_V4: SeedPost[] = [
  {
    id: 'p-hb-lena-1',
    author: 'c-hb-lena',
    hoursAgo: 2,
    content: {
      de: '„Man sieht nur mit dem Herzen gut.“ Heute im Schaufenster: alle Bücher über zweite Chancen. Zufall? Vielleicht. #herzklopfen',
      en: '"One sees clearly only with the heart." In the shop window today: every book about second chances. Coincidence? Maybe. #heartbeat',
    },
    likes: ['c-hb-jonas', 'c-hb-aylin'],
    comments: [{ author: 'c-hb-aylin', minutesAfter: 10, content: { de: 'Ich sehe genau, was du da machst!! 💃', en: 'I see exactly what you\'re doing!! 💃' } }],
  },
  {
    id: 'p-hb-nora-1',
    author: 'c-hb-nora',
    hoursAgo: 4,
    content: {
      de: 'Neue Staffel „Herzfrequenz“: Ich suche Menschen aus dem Lindenhof für ein Blind-Date-Experiment! Wer traut sich? #herzklopfen #blinddate',
      en: 'New season of "Heart Rate": I\'m looking for people from Linden Court for a blind date experiment! Who dares? #heartbeat #blinddate',
    },
    likes: ['c-hb-milan', 'c-hb-clara'],
    comments: [{ author: 'c-hb-milan', minutesAfter: 25, content: { de: 'Spark stellt gern die Technik. 😉', en: 'Spark is happy to provide the tech. 😉' } }],
  },
  {
    id: 'p-hb-jonas-1',
    author: 'c-hb-jonas',
    hoursAgo: 6,
    content: {
      de: 'Neue Röstung: „Fensterplatz“. Mild, ein bisschen bitter im Abgang, macht trotzdem glücklich. #zweitetasse #herzklopfen',
      en: 'New roast: "Window Seat". Mild, a little bitter in the finish, still makes you happy. #secondcup #heartbeat',
    },
    likes: ['c-hb-lena'],
  },
  {
    id: 'p-hb-clara-1',
    author: 'c-hb-clara',
    hoursAgo: 9,
    content: {
      de: 'Zwölf Jahre. Manche Häuser muss man renovieren, bevor man wieder darin wohnen kann. #herzklopfen',
      en: 'Twelve years. Some houses need renovating before you can live in them again. #heartbeat',
    },
    likes: ['c-hb-nora'],
  },
];

export const SEED_EVENTS_V4: SeedEvent[] = [
  {
    id: 'e-hb-1',
    worldId: 'w-heartbeat',
    dayOffset: 0,
    kind: 'gathering',
    title: { de: 'Spark-Abend in der „Zweiten Tasse“?', en: 'Spark night at the "Second Cup"?' },
    description: {
      de: 'Milan fragt öffentlich, ob er im Café einen Speed-Dating-Abend veranstalten darf. Jonas zögert, Lena schaut in ihren Kaffee.',
      en: 'Milan publicly asks whether he can host a speed dating night at the café. Jonas hesitates, Lena looks into her coffee.',
    },
    participants: ['c-hb-milan', 'c-hb-jonas', 'c-hb-lena'],
    hoursAgo: 7,
    storylineId: 's-hb-window',
  },
];

export const SEED_STORIES_V4: SeedStory[] = [
  { author: 'c-hb-aylin', style: 2, hoursAgo: 1, content: { de: 'Salsa-Kurs heute: Wer allein kommt, geht mit neuen Freunden!', en: 'Salsa class today: come alone, leave with new friends!' } },
  { author: 'c-hb-lena', style: 4, hoursAgo: 3, content: { de: 'Fensterplatz, Regen, gutes Buch. Fast perfekt.', en: 'Window seat, rain, a good book. Almost perfect.' } },
];

/** Hauptziele der Dating-Figuren, wenn sie gespielt werden. */
export const CHARACTER_GOAL_TYPES_V4: Record<string, GoalType> = {
  'c-hb-lena': 'relationships',
  'c-hb-jonas': 'relationships',
  'c-hb-nora': 'reach',
  'c-hb-milan': 'influence',
  'c-hb-aylin': 'support',
  'c-hb-clara': 'rivalry',
};
