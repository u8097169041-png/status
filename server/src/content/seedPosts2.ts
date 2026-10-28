import type { SeedEvent, SeedPost, SeedStory } from './seedPosts';

/** Beiträge, Ereignisse und Stories der Welten aus Version 2 (alle Figuren fiktiv). */
export const SEED_POSTS_V2: SeedPost[] = [
  {
    id: 'p-brandt-1',
    author: 'c-brandt',
    hoursAgo: 3,
    content: {
      de: 'Heute Netzausbau im Norden besucht. Velmar braucht keine lauten Versprechen, sondern Leitungen, die halten. #velmarwahl #energie',
      en: 'Visited the grid expansion in the north today. Velmar doesn\'t need loud promises, it needs power lines that hold. #velmarelection #energy',
    },
    likes: ['c-proell'],
    comments: [
      { author: 'c-sander', minutesAfter: 20, content: { de: 'Vier Jahre für ein paar Leitungen? Velmar kann mehr!', en: 'Four years for a few power lines? Velmar can do better!' } },
      { author: 'c-ivy', minutesAfter: 45, content: { de: 'Frage an das Kanzleramt: Wann kommt der Kostenbericht?', en: 'Question for the chancellery: when is the cost report coming?' } },
    ],
  },
  {
    id: 'p-sander-1',
    author: 'c-sander',
    hoursAgo: 5,
    content: {
      de: 'Volle Halle in Westhafen! 3.000 Menschen, die einen Neuanfang wollen. Wir sehen uns beim TV-Duell! #neuesvelmar #velmarwahl',
      en: 'Packed hall in Westhaven! 3,000 people who want a fresh start. See you at the TV debate! #newvelmar #velmarelection',
    },
    likes: ['c-ivy'],
  },
  {
    id: 'p-ivy-1',
    author: 'c-ivy',
    hoursAgo: 9,
    content: {
      de: 'Recherche läuft. Zu Wahlkampfspenden gibt es mehr Fragen als Antworten – in beiden Lagern. Morgen mehr im Kurier. #velmarwahl',
      en: 'Investigation ongoing. When it comes to campaign donations there are more questions than answers – in both camps. More tomorrow in the Courier. #velmarelection',
    },
    likes: ['c-sander'],
    comments: [{ author: 'c-proell', minutesAfter: 30, content: { de: 'Wir haben nichts zu verbergen. Schreiben Sie, was Sie belegen können.', en: 'We have nothing to hide. Write what you can prove.' } }],
  },
  {
    id: 'p-lyra-1',
    author: 'c-lyra',
    hoursAgo: 2,
    content: {
      de: 'zwei jahre stille. heute nacht wieder ein lied geschrieben. es fühlt sich an wie atmen. #comeback #spotlight',
      en: 'two years of silence. wrote a song again tonight. it feels like breathing. #comeback #spotlight',
    },
    likes: ['c-dante', 'c-rolf'],
    comments: [{ author: 'c-kiki', minutesAfter: 5, content: { de: 'LEUTE!! Habt ihr das gesehen?! Ein neuer Song?!', en: 'GUYS!! Did you see that?! A new song?!' } }],
  },
  {
    id: 'p-dante-1',
    author: 'c-dante',
    hoursAgo: 7,
    content: {
      de: 'Drehtag 12. Der Regen kam pünktlich, die Hauptdarstellerin nicht. Regie ist eine Kunst der Geduld. #filmset #spotlight',
      en: 'Shooting day 12. The rain arrived on time, the lead actress didn\'t. Directing is the art of patience. #filmset #spotlight',
    },
    likes: ['c-lyra', 'c-kiki'],
  },
  {
    id: 'p-kiki-1',
    author: 'c-kiki',
    hoursAgo: 11,
    content: {
      de: 'Ich sag nur: Ein gewisser Filmstar wurde HEUTE im Tonstudio gesehen. Mit einer gewissen Sängerin. Zufall? Ich glaube nicht!! #goldenelinse',
      en: 'All I\'m saying: a certain film star was spotted in a recording studio TODAY. With a certain singer. Coincidence? I think not!! #goldenlens',
    },
    likes: ['c-rolf'],
  },
  {
    id: 'p-tariq-1',
    author: 'c-tariq',
    hoursAgo: 4,
    content: {
      de: 'Testlauf Nummer 214: Die Zelle hält seit 30 Tagen. Das Team hat Pizza verdient. Und ich vielleicht Schlaf. #lumio #unicornvalley',
      en: 'Test run number 214: the cell has held for 30 days. The team has earned pizza. And maybe I\'ve earned sleep. #lumio #unicornvalley',
    },
    likes: ['c-ben', 'c-margot'],
    comments: [{ author: 'c-hale', minutesAfter: 40, content: { de: 'Beeindruckend. Stellen Sie sich vor, was Sie mit unseren Ressourcen erreichen könnten.', en: 'Impressive. Imagine what you could achieve with our resources.' } }],
  },
  {
    id: 'p-hale-1',
    author: 'c-hale',
    hoursAgo: 8,
    content: {
      de: 'Haleworks investiert dieses Jahr zwei Milliarden in Energiespeicher. Wer die Zukunft bauen will, braucht Größe. #haleworks #unicornvalley',
      en: 'Haleworks is investing two billion in energy storage this year. Building the future takes scale. #haleworks #unicornvalley',
    },
    likes: ['c-ben'],
  },
  {
    id: 'p-ben-1',
    author: 'c-ben',
    hoursAgo: 12,
    content: {
      de: 'Newsletter #188: Warum die Lumio-Übernahme die wichtigste Entscheidung des Jahres ist – und warum Margot Feld schweigt. #lumio',
      en: 'Newsletter #188: why the Lumio takeover is the most important decision of the year – and why Margot Feld is silent. #lumio',
    },
    likes: ['c-tariq'],
  },
  {
    id: 'p-zoe-1',
    author: 'c-zoe',
    hoursAgo: 3,
    content: {
      de: 'Doppelpack gegen Nordsand! Danke an jede einzelne Person auf der Tribüne. Die Glocke war heute lauter als sonst. #fchafenstadt #titelrennen',
      en: 'Brace against Northsand! Thanks to every single person in the stands. The bell was louder than ever today. #fcharbourcity #titlerace',
    },
    likes: ['c-lukas', 'c-valente', 'c-hanna'],
    comments: [{ author: 'c-lukas', minutesAfter: 10, content: { de: 'Und das Tor in der 89. – unglaublich, Nummer 9!', en: 'And that goal in the 89th – unbelievable, number 9!' } }],
  },
  {
    id: 'p-hanna-1',
    author: 'c-hanna',
    hoursAgo: 6,
    content: {
      de: 'EXKLUSIV: Ein Spitzenklub aus dem Ausland bietet für Zoe Akande. Der Verein dementiert nicht. #transfer #fchafenstadt',
      en: 'EXCLUSIVE: a top club from abroad is bidding for Zoe Akande. The club isn\'t denying it. #transfer #fcharbourcity',
    },
    likes: [],
    comments: [{ author: 'c-valente', minutesAfter: 25, content: { de: 'Zoe spielt für Hafenstadt. Punkt.', en: 'Zoe plays for Harbour City. Full stop.' } }],
  },
  {
    id: 'p-theo-1',
    author: 'c-theo',
    hoursAgo: 4,
    content: {
      de: 'Heute Abend zu Gast: ein Mann, der behauptet, mit Tauben sprechen zu können. Ich habe Fragen. Die Tauben auch. #latenightlive',
      en: 'Tonight\'s guest: a man who claims he can talk to pigeons. I have questions. So do the pigeons. #latenightlive',
    },
    likes: ['c-ruth', 'c-felix', 'c-fatma'],
  },
  {
    id: 'p-fatma-1',
    author: 'c-fatma',
    hoursAgo: 9,
    content: {
      de: 'Mein Vermieter hat die Heizung „optimiert“. Jetzt kann ich meinen Atem sehen. Material für drei Minuten Stand-up. #comedy #latenightlive',
      en: 'My landlord "optimised" the heating. Now I can see my breath. Material for three minutes of stand-up. #comedy #latenightlive',
    },
    likes: ['c-theo', 'c-felix'],
  },
  {
    id: 'p-felix-1',
    author: 'c-felix',
    hoursAgo: 14,
    content: {
      de: 'Tag 15 als Praktikant: Kaffee für 23 Leute geholt, eine Idee gepitcht, beides fast verschüttet. #studio7',
      en: 'Day 15 as an intern: fetched coffee for 23 people, pitched an idea, nearly spilled both. #studio7',
    },
    likes: ['c-ruth'],
    comments: [{ author: 'c-ruth', minutesAfter: 60, content: { de: 'die idee war gut. der kaffee nicht.', en: 'the idea was good. the coffee wasn\'t.' } }],
  },
  {
    id: 'p-oskar-1',
    author: 'c-oskar',
    hoursAgo: 2,
    content: {
      de: 'Es hat funktioniert! Eine Nachricht von der Uni bis zum Hafen – in 0,3 Sekunden. Die Rohrpost braucht dafür 40 Minuten. #lichtnetz #analog2026',
      en: 'It worked! A message from the university to the harbour – in 0.3 seconds. The tube post needs 40 minutes. #lightnetwork #analog2026',
    },
    likes: ['c-edda', 'c-paul'],
    comments: [{ author: 'c-greta', minutesAfter: 35, content: { de: 'Und wer repariert Ihr Licht, wenn es bricht? Die Rohrpost läuft seit 57 Jahren.', en: 'And who repairs your light when it breaks? The tube post has run for 57 years.' } }],
  },
  {
    id: 'p-paul-1',
    author: 'c-paul',
    hoursAgo: 7,
    content: {
      de: 'ABENDBLATT, 3. Ausgabe: Rohrpost-Kapsel steckt seit Tagen im Rathaus fest. Bürgermeister kommuniziert per Brieftaube. #analog2026',
      en: 'EVENING PAPER, 3rd edition: tube capsule stuck in the town hall for days. Mayor communicates by carrier pigeon. #analog2026',
    },
    likes: ['c-edda'],
  },
];

export const SEED_EVENTS_V2: SeedEvent[] = [
  {
    id: 'e-capital-1',
    worldId: 'w-capital',
    dayOffset: 0,
    kind: 'gathering',
    title: { de: 'Wahlkampfauftakt', en: 'Campaign launch' },
    description: { de: 'Brandt und Sander starten am selben Tag in den Wahlkampf. Die Umfragen liegen gleichauf.', en: 'Brandt and Sander launch their campaigns on the same day. The polls are neck and neck.' },
    participants: ['c-brandt', 'c-sander'],
    hoursAgo: 10,
    storylineId: 's-capital-election',
  },
  {
    id: 'e-spotlight-1',
    worldId: 'w-spotlight',
    dayOffset: 0,
    kind: 'rumor',
    title: { de: 'Gerücht im Tonstudio', en: 'Rumour at the recording studio' },
    description: { de: 'Kiki Sommer berichtet von einem heimlichen Treffen zwischen Lyra Moon und Dante Rivera.', en: 'Kiki Sommer reports a secret meeting between Lyra Moon and Dante Rivera.' },
    participants: ['c-kiki', 'c-lyra', 'c-dante'],
    hoursAgo: 11,
  },
  {
    id: 'e-unicorn-1',
    worldId: 'w-unicorn',
    dayOffset: 0,
    kind: 'rivalry',
    title: { de: 'Das Übernahmeangebot', en: 'The takeover offer' },
    description: { de: 'Haleworks bietet 900 Millionen für Lumio. Tariq Osei bittet um Bedenkzeit.', en: 'Haleworks offers 900 million for Lumio. Tariq Osei asks for time to think.' },
    participants: ['c-hale', 'c-tariq'],
    hoursAgo: 9,
    storylineId: 's-unicorn-takeover',
  },
  {
    id: 'e-arena-1',
    worldId: 'w-arena',
    dayOffset: 0,
    kind: 'celebration',
    title: { de: 'Sieg gegen Nordsand', en: 'Victory against Northsand' },
    description: { de: 'Zoe Akande trifft doppelt, der FC Hafenstadt bleibt Tabellenführer.', en: 'Zoe Akande scores twice, FC Harbour City stays top of the table.' },
    participants: ['c-zoe', 'c-lukas'],
    hoursAgo: 4,
  },
  {
    id: 'e-latenight-1',
    worldId: 'w-latenight',
    dayOffset: 0,
    kind: 'crisis',
    title: { de: 'Das Quoten-Ultimatum', en: 'The ratings ultimatum' },
    description: { de: 'Der Sender gibt der Show vier Wochen, um die Quote zu steigern.', en: 'The network gives the show four weeks to raise ratings.' },
    participants: ['c-theo', 'c-ruth'],
    hoursAgo: 15,
    storylineId: 's-latenight-ratings',
  },
  {
    id: 'e-analog-1',
    worldId: 'w-analog',
    dayOffset: 0,
    kind: 'discovery',
    title: { de: 'Die erste Lichtnachricht', en: 'The first light message' },
    description: { de: 'Oskar Lindt schickt eine Nachricht durch Glas. Die Stadt staunt – und die Rohrpost-Gesellschaft ist alarmiert.', en: 'Oskar Lindt sends a message through glass. The city is amazed – and the Pneumatic Post Company is alarmed.' },
    participants: ['c-oskar', 'c-greta'],
    hoursAgo: 2,
    storylineId: 's-analog-light',
  },
];

export const SEED_STORIES_V2: SeedStory[] = [
  { author: 'c-sander', style: 0, hoursAgo: 1, content: { de: 'Auf dem Weg zur nächsten Halle. Danke für die Energie!', en: 'On the way to the next hall. Thanks for the energy!' } },
  { author: 'c-lyra', style: 2, hoursAgo: 3, content: { de: 'Klavier. Kerze. Eine neue Melodie.', en: 'Piano. Candle. A new melody.' } },
  { author: 'c-tariq', style: 3, hoursAgo: 4, content: { de: 'Laborlicht um 2 Uhr nachts. Fast geschafft.', en: 'Lab lights at 2 a.m. Almost there.' } },
  { author: 'c-zoe', style: 1, hoursAgo: 2, content: { de: 'Eisbad nach dem Spiel. Nie wieder. Bis Samstag.', en: 'Ice bath after the match. Never again. Until Saturday.' } },
  { author: 'c-felix', style: 5, hoursAgo: 5, content: { de: 'Habe Theo heute zum Lachen gebracht. Aus Versehen.', en: 'Made Theo laugh today. By accident.' } },
  { author: 'c-edda', style: 4, hoursAgo: 6, content: { de: '4.812 Verbindungen heute. Eine davon wird die Stadt verändern.', en: '4,812 connections today. One of them will change the city.' } },
];
