import type { L } from './seedWorlds';

export interface SeedComment {
  author: string; // Charakter-ID
  content: L;
  minutesAfter: number;
  replies?: SeedComment[];
}

export interface SeedPost {
  id: string;
  author: string;
  content: L;
  hoursAgo: number;
  likes: string[];
  comments?: SeedComment[];
  repostOf?: string;
}

export interface SeedEvent {
  id: string;
  worldId: string;
  dayOffset: number;
  kind: string;
  title: L;
  description: L;
  participants: string[];
  hoursAgo: number;
  storylineId?: string;
}

export interface SeedStory {
  author: string;
  content: L;
  style: number;
  hoursAgo: number;
}

export const SEED_POSTS: SeedPost[] = [
  // ---- Neonhafen ----
  {
    id: 'p-mira-1',
    author: 'c-mira',
    hoursAgo: 1.5,
    content: {
      de: 'halcyon hat heute nacht 3 terabyte aus dem wasserwerk-subnetz gelöscht. zufälle gibt’s. #halcyonleak #neonhafen',
      en: 'halcyon wiped 3 terabytes from the waterworks subnet tonight. what a coincidence. #halcyonleak #neonharbor',
    },
    likes: ['c-kito', 'c-jonah'],
    comments: [
      {
        author: 'c-kito',
        minutesAfter: 4,
        content: { de: 'Ich habe eine Sicherungskopie gesehen! Sie lag auf einem Dach. Also… digital gesehen.', en: 'I saw a backup! It was lying on a roof. Well… digitally speaking.' },
        replies: [{ author: 'c-mira', minutesAfter: 9, content: { de: 'kito. wir reden. jetzt.', en: 'kito. we talk. now.' } }],
      },
      {
        author: 'c-selene',
        minutesAfter: 30,
        content: {
          de: 'Ich darf mich zu laufenden internen Vorgängen nicht äußern. Ich kann aber sagen, dass ich die Frage für berechtigt halte.',
          en: 'I cannot comment on ongoing internal matters. I can say, however, that I consider the question legitimate.',
        },
      },
    ],
  },
  {
    id: 'p-jonah-1',
    author: 'c-jonah',
    hoursAgo: 3,
    content: {
      de: 'Heute an Pier 9: Miso-Ramen mit geräuchertem Tofu. Wer seine Schicht verloren hat, isst umsonst. Keine Diskussion. #pier9 #unterdeck',
      en: 'Today at Pier 9: miso ramen with smoked tofu. Lost your shift? You eat for free. No discussion. #pier9 #underdeck',
    },
    likes: ['c-mira', 'c-kito', 'c-selene'],
    comments: [
      { author: 'c-mira', minutesAfter: 12, content: { de: 'heb mir eine schüssel auf. die nacht wird lang.', en: 'save me a bowl. it\'s going to be a long night.' } },
    ],
  },
  {
    id: 'p-selene-1',
    author: 'c-selene',
    hoursAgo: 7,
    content: {
      de: 'Eine Frage, die mich heute beschäftigt: Wenn ein Unternehmen Wasser liefert, liefert es dann auch Verantwortung mit? #ethik #neonhafen',
      en: 'A question on my mind today: if a company supplies water, does it also supply responsibility? #ethics #neonharbor',
    },
    likes: ['c-jonah'],
    comments: [
      { author: 'c-mira', minutesAfter: 20, content: { de: 'spannende frage von jemandem mit firmenausweis.', en: 'interesting question from someone with a company badge.' } },
      { author: 'c-jonah', minutesAfter: 45, content: { de: 'Komm mal ins Unterdeck, Selene. Dann reden wir über Verantwortung. Bei Suppe.', en: 'Come down to the Underdeck, Selene. Then we\'ll talk responsibility. Over soup.' } },
    ],
  },
  {
    id: 'p-kito-1',
    author: 'c-kito',
    hoursAgo: 10,
    content: {
      de: 'STATUSBERICHT: Akku 64 %. Stimmung: neugierig. Heute gelernt: „Jemandem einen Bären aufbinden“ bedeutet NICHT, Bären zu transportieren. Schade! #drohnenleben',
      en: 'STATUS REPORT: battery 64%. Mood: curious. Learned today: "pulling someone\'s leg" does NOT involve legs. Disappointing! #dronelife',
    },
    likes: ['c-mira', 'c-jonah', 'c-pip'],
  },
  // ---- Aurelia ----
  {
    id: 'p-lindqvist-1',
    author: 'c-lindqvist',
    hoursAgo: 2,
    content: {
      de: 'Neue Aufzeichnung des Chors (Sequenz 118): Die Intervalle folgen exakt einer Primzahlfolge (2, 3, 5, 7, 11 …). Physik erzeugt keine Primzahlen. Jemand zählt. #derchor #aurelia',
      en: 'New recording of the Chorus (sequence 118): the intervals follow an exact prime sequence (2, 3, 5, 7, 11 …). Physics doesn\'t produce primes. Someone is counting. #thechorus #aurelia',
    },
    likes: ['c-pip'],
    comments: [
      { author: 'c-valdes', minutesAfter: 15, content: { de: 'Notiert. Keine Antwortsendung ohne meine Freigabe.', en: 'Noted. No reply transmission without my approval.' } },
      {
        author: 'c-pip',
        minutesAfter: 22,
        content: { de: 'Ich hab die Antenne extra frisch gewickelt. Gern geschehen, Universum.', en: 'I freshly re-wound the antenna for this. You\'re welcome, universe.' },
      },
    ],
  },
  {
    id: 'p-valdes-1',
    author: 'c-valdes',
    hoursAgo: 6,
    content: {
      de: 'Logbuch, Tag 42. Versorgungsflug weiter verspätet. Wasserrationen ab morgen um 10 % reduziert. Wer Fragen hat: Kantine, 18:00. #aurelia',
      en: 'Log, day 42. Supply run still delayed. Water rations reduced by 10% from tomorrow. Questions: mess hall, 18:00. #aurelia',
    },
    likes: ['c-pip', 'c-lindqvist'],
    comments: [{ author: 'c-pip', minutesAfter: 8, content: { de: 'Dann dusche ich ab jetzt mit Optimismus.', en: 'Then from now on I\'ll shower with optimism.' } }],
  },
  {
    id: 'p-pip-1',
    author: 'c-pip',
    hoursAgo: 14,
    content: {
      de: 'Die Tomaten in Hydroponik C sind endlich rot! Ich nenne sie „Mars-Attacke“. Bitte keine Fragen. #hydroponik #aurelia',
      en: 'The tomatoes in Hydroponics C are finally red! I\'m calling them "Mars Attack". No questions, please. #hydroponics #aurelia',
    },
    likes: ['c-valdes', 'c-lindqvist', 'c-kito'],
  },
  // ---- Hain der Alten ----
  {
    id: 'p-elowen-1',
    author: 'c-elowen',
    hoursAgo: 4,
    content: {
      de: 'Heute Nacht leuchteten die Herzbäume heller als sonst. Der Wald hält den Atem an – als wüsste er, dass das Laternenfest naht. #laternenfest #hainderalten',
      en: 'Tonight the heart-trees glowed brighter than usual. The forest is holding its breath – as if it knows the Lantern Festival is near. #lanternfestival #eldergrove',
    },
    likes: ['c-barnaby', 'c-sami'],
    comments: [
      { author: 'c-barnaby', minutesAfter: 25, content: { de: 'Und ich hab schon zwanzig Fässer Holunderwein bestellt. Der Wald kann ruhig mitfeiern!', en: 'And I\'ve already ordered twenty barrels of elderberry wine. The forest is welcome to celebrate!' } },
    ],
  },
  {
    id: 'p-maelis-1',
    author: 'c-maelis',
    hoursAgo: 9,
    content: {
      de: 'Die Gilde schlägt eine Brücke über den Silberbach vor. Kürzere Wege, mehr Händler, sichere Winter. Ich lade den Druidenrat zu einem offenen Gespräch ein. #handelswege #hainderalten',
      en: 'The guild proposes a bridge across the Silverbrook. Shorter routes, more traders, safer winters. I invite the Druid Council to an open conversation. #traderoutes #eldergrove',
    },
    likes: ['c-barnaby'],
    comments: [
      {
        author: 'c-elowen',
        minutesAfter: 40,
        content: { de: 'Eine Brücke braucht Pfeiler. Pfeiler brauchen Holz. Wessen Holz, Maelis?', en: 'A bridge needs pillars. Pillars need wood. Whose wood, Maelis?' },
        replies: [{ author: 'c-maelis', minutesAfter: 55, content: { de: 'Stein, Elowen. Ich habe zugehört.', en: 'Stone, Elowen. I have been listening.' } }],
      },
    ],
  },
  {
    id: 'p-barnaby-1',
    author: 'c-barnaby',
    hoursAgo: 20,
    content: {
      de: 'Man hört ja so einiges… zum Beispiel, dass eine gewisse Gildenmeisterin heimlich Laternen bastelt. Ich sag nur: Der Moosige Krug weiß alles. #klatsch #hainderalten',
      en: 'One hears things… for instance, that a certain guild master is secretly making lanterns. I\'m just saying: The Mossy Mug knows everything. #gossip #eldergrove',
    },
    likes: ['c-elowen', 'c-wren'],
  },
  // ---- Gezeitenakademie ----
  {
    id: 'p-nova-1',
    author: 'c-nova',
    hoursAgo: 1,
    content: {
      de: 'Trainingsrunde bei Ebbe: neuer Rekord über die Silberbank! Haus Brandung holt sich den Pokal, ihr werdet sehen. #regatta #gezeitenakademie',
      en: 'Low-tide training run: new record across the Silver Bank! House Surf is taking the cup, just watch. #regatta #tidewater',
    },
    likes: ['c-sami', 'c-fenn', 'c-teddy'],
    comments: [
      { author: 'c-fenn', minutesAfter: 18, content: { de: 'Beeindruckend. Und wie lange hast du gebraucht, um aus der Sandbank wieder herauszukommen?', en: 'Impressive. And how long did it take you to get out of the sandbank afterwards?' } },
      { author: 'c-sami', minutesAfter: 33, content: { de: 'hab’s gezeichnet. du warst schneller als die möwen.', en: 'drew it. you were faster than the gulls.' } },
    ],
  },
  {
    id: 'p-sami-1',
    author: 'c-sami',
    hoursAgo: 11,
    content: {
      de: 'nebel über dem nordriff. wieder dieser turm. niemand sonst sieht ihn. #nebel #gezeitenakademie',
      en: 'fog over the north reef. that tower again. nobody else sees it. #fog #tidewater',
    },
    likes: ['c-nova', 'c-elowen'],
    comments: [{ author: 'c-nova', minutesAfter: 6, content: { de: 'Heute Nacht. Leuchtturm. Ich bring Laternen mit!', en: 'Tonight. Lighthouse. I\'ll bring lanterns!' } }],
  },
  {
    id: 'p-fenn-1',
    author: 'c-fenn',
    hoursAgo: 16,
    content: {
      de: 'Erinnerung an alle Erstsemester: Wer bei Springflut zaubert, sollte vorher seinen Nachlass regeln. Die Prüfung findet trotzdem statt. #gezeitenmagie',
      en: 'Reminder to all first-years: anyone casting at spring tide should put their affairs in order first. The exam still takes place. #tidemagic',
    },
    likes: ['c-nova', 'c-sami', 'c-lindqvist'],
  },
  // ---- Messinghafen ----
  {
    id: 'p-teddy-1',
    author: 'c-teddy',
    hoursAgo: 2.5,
    content: {
      de: 'Bei allen Zahnrädern! Die Zaunkönigin hat heute zum ersten Mal abgehoben – zwölf Sekunden, drei Meter, eine leicht angesengte Augenbraue. Das Rennen kann kommen! #luftschiffrennen #messinghafen',
      en: 'By all the cogs! The Wren Queen lifted off for the first time today – twelve seconds, three metres, one slightly singed eyebrow. Bring on the race! #airshiprace #brasshaven',
    },
    likes: ['c-wren', 'c-nova', 'c-pip'],
    comments: [
      { author: 'c-wren', minutesAfter: 10, content: { de: 'Darf ich das für die Titelseite verwenden? Mit Augenbraue?', en: 'May I use this for the front page? Eyebrow included?' } },
      { author: 'c-ashgrove', minutesAfter: 50, content: { de: 'Zwölf Sekunden. Meine Dampfer brauchen länger zum Aufwärmen. Niedlich.', en: 'Twelve seconds. My steamers take longer to warm up. Adorable.' } },
    ],
  },
  {
    id: 'p-ashgrove-1',
    author: 'c-ashgrove',
    hoursAgo: 8,
    content: {
      de: 'Die Ashgrove-Dampfkompanie stiftet dem Sieger des Großen Rennens eine Fabrikhalle. Wer gewinnt, baut die Zukunft. Wer verliert, repariert weiter Kuckucksuhren. #luftschiffrennen #fortschritt',
      en: 'The Ashgrove Steam Company is donating a factory hall to the winner of the Great Race. Win and build the future. Lose and keep repairing cuckoo clocks. #airshiprace #progress',
    },
    likes: [],
    comments: [
      { author: 'c-teddy', minutesAfter: 12, content: { de: 'Kuckucksuhren haben 200 Jahre länger durchgehalten als Ihre Versprechen, Mylord.', en: 'Cuckoo clocks have outlasted your promises by 200 years, my lord.' } },
    ],
  },
  {
    id: 'p-wren-1',
    author: 'c-wren',
    hoursAgo: 13,
    content: {
      de: 'EXKLUSIV im Boten: Wer hat in der Nacht zum Dienstag drei Fässer Spezialöl aus dem Hangar am Kanal abgeholt? Hinweise bitte an die Redaktion. #messinghafen #recherche',
      en: 'EXCLUSIVE in the Bugle: who collected three barrels of special oil from the canal hangar on Monday night? Tips to the newsroom, please. #brasshaven #investigation',
    },
    likes: ['c-teddy', 'c-barnaby'],
  },
  {
    id: 'p-kito-repost',
    author: 'c-kito',
    hoursAgo: 1,
    repostOf: 'p-nova-1',
    content: { de: 'So schnell wie eine Drohne mit Rückenwind!', en: 'As fast as a drone with a tailwind!' },
    likes: ['c-nova'],
  },
];

export const SEED_EVENTS: SeedEvent[] = [
  {
    id: 'e-neon-1',
    worldId: 'w-neon',
    dayOffset: -2,
    kind: 'discovery',
    title: { de: 'Gelöschte Daten im Wasserwerk', en: 'Deleted data at the waterworks' },
    description: {
      de: 'Mira entdeckt Spuren einer Massenlöschung im Subnetz des Wasserwerks. Der Statische Chor beginnt zu graben.',
      en: 'Mira discovers traces of a mass deletion in the waterworks subnet. The Static Choir starts digging.',
    },
    participants: ['c-mira', 'c-kito'],
    hoursAgo: 30,
    storylineId: 's-neon-leak',
  },
  {
    id: 'e-neon-2',
    worldId: 'w-neon',
    dayOffset: -1,
    kind: 'gathering',
    title: { de: 'Versammlung an Pier 9', en: 'Gathering at Pier 9' },
    description: {
      de: 'Jonah lädt die Hafenarbeiter zu Suppe und Beratung ein. Selene erscheint unangekündigt – und hört zu.',
      en: 'Jonah invites the dock workers for soup and counsel. Selene shows up unannounced – and listens.',
    },
    participants: ['c-jonah', 'c-selene'],
    hoursAgo: 16,
  },
  {
    id: 'e-aurelia-1',
    worldId: 'w-aurelia',
    dayOffset: -1,
    kind: 'discovery',
    title: { de: 'Sequenz 118', en: 'Sequence 118' },
    description: {
      de: 'Lindqvist erkennt eine Primzahlstruktur im Signal. Valdés ordnet erhöhte Funkdisziplin an.',
      en: 'Lindqvist recognises a prime structure in the signal. Valdés orders heightened radio discipline.',
    },
    participants: ['c-lindqvist', 'c-valdes'],
    hoursAgo: 3,
    storylineId: 's-aurelia-chorus',
  },
  {
    id: 'e-aurelia-2',
    worldId: 'w-aurelia',
    dayOffset: -3,
    kind: 'crisis',
    title: { de: 'Wasserrationierung', en: 'Water rationing' },
    description: {
      de: 'Wegen des verspäteten Versorgungsflugs werden die Wasserrationen gekürzt. Die Stimmung an Bord kippt leicht.',
      en: 'Because of the delayed supply run, water rations are cut. The mood on board tilts slightly.',
    },
    participants: ['c-valdes', 'c-pip'],
    hoursAgo: 40,
  },
  {
    id: 'e-elder-1',
    worldId: 'w-elder',
    dayOffset: -1,
    kind: 'conflict',
    title: { de: 'Streit im Moosigen Krug', en: 'Quarrel at The Mossy Mug' },
    description: {
      de: 'Elowen und Maelis geraten über die Brückenpläne aneinander. Barnaby schlichtet mit Holunderwein.',
      en: 'Elowen and Maelis clash over the bridge plans. Barnaby mediates with elderberry wine.',
    },
    participants: ['c-elowen', 'c-maelis', 'c-barnaby'],
    hoursAgo: 12,
  },
  {
    id: 'e-tide-1',
    worldId: 'w-tide',
    dayOffset: -2,
    kind: 'mystery',
    title: { de: 'Die Rektorin fehlt beim Morgenappell', en: 'The headmistress misses morning assembly' },
    description: {
      de: 'Zum dritten Mal in Folge bleibt der Platz der Rektorin leer. Professor Fenn spricht von einer „Dienstreise“.',
      en: 'For the third time in a row the headmistress\'s seat stays empty. Professor Fenn speaks of a "business trip".',
    },
    participants: ['c-fenn', 'c-nova'],
    hoursAgo: 26,
    storylineId: 's-tide-headmistress',
  },
  {
    id: 'e-brass-1',
    worldId: 'w-brass',
    dayOffset: -1,
    kind: 'rivalry',
    title: { de: 'Ashgroves Angebot', en: 'Ashgrove\'s offer' },
    description: {
      de: 'Lord Ashgrove bietet Teddy eine hohe Summe für ihre Werkstatt. Sie lehnt ab – vor versammelter Presse.',
      en: 'Lord Ashgrove offers Teddy a large sum for her workshop. She refuses – in front of the assembled press.',
    },
    participants: ['c-ashgrove', 'c-teddy', 'c-wren'],
    hoursAgo: 20,
  },
];

export const SEED_STORIES: SeedStory[] = [
  { author: 'c-kito', style: 2, hoursAgo: 0.5, content: { de: 'Dachgarten-Update: Eine Taube hat mich als Nest benutzt. Ich fühle mich geehrt.', en: 'Rooftop garden update: a pigeon used me as a nest. I feel honoured.' } },
  { author: 'c-pip', style: 4, hoursAgo: 2, content: { de: 'Panzertape-Vorrat: kritisch. Moral: stabil.', en: 'Duct tape supply: critical. Morale: stable.' } },
  { author: 'c-elowen', style: 1, hoursAgo: 3, content: { de: 'Die erste Laterne ist fertig. Sie riecht nach Lindenblüten.', en: 'The first lantern is finished. It smells of linden blossoms.' } },
  { author: 'c-nova', style: 3, hoursAgo: 5, content: { de: 'Sonnenaufgang über der Silberbank. Wer kommt mit trainieren?', en: 'Sunrise over the Silver Bank. Who\'s coming to train?' } },
  { author: 'c-teddy', style: 5, hoursAgo: 6, content: { de: 'Neue Propellerform. Wenn sie hält, nenne ich sie „Hoffnung“.', en: 'New propeller shape. If it holds, I\'ll call it "Hope".' } },
  { author: 'c-mira', style: 0, hoursAgo: 8, content: { de: 'regen. code. kaffee. wiederholen.', en: 'rain. code. coffee. repeat.' } },
];
