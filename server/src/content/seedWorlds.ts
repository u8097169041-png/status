import type { ArtStyle, AvatarGlyph, Genre, RelationshipKind, WritingStyle } from '../../../shared/constants';

/** Zweisprachiger Text. */
export interface L {
  de: string;
  en: string;
}

export interface SeedWorld {
  id: string;
  name: L;
  tagline: L;
  genre: Genre;
  description: L;
  lore: L;
  atmosphere: L;
  rules: L[];
  artStyle: ArtStyle;
  hue: number;
  day: number;
  metrics: { harmony: number; tension: number; discovery: number };
}

export interface SeedCharacter {
  id: string;
  worldId: string;
  name: string;
  handle: string;
  tagline: L;
  description: L;
  role: L;
  personality: L[];
  interests: L[];
  background: L;
  writingStyle: WritingStyle;
  styleNotes: L;
  rules: L[];
  avatarHue: number;
  avatarGlyph: AvatarGlyph;
  mood: string;
}

export interface SeedRelationship {
  a: string;
  b: string;
  kind: RelationshipKind;
  affinity: number;
  note: L;
}

export interface SeedGroup {
  id: string;
  worldId: string;
  name: L;
  description: L;
  hue: number;
  members: [string, L][];
}

export interface SeedStoryline {
  id: string;
  worldId: string;
  title: L;
  summary: L;
  stages: L[];
  stage: number;
  theme: 'harmony' | 'tension' | 'discovery';
}

export const SEED_WORLDS: SeedWorld[] = [
  {
    id: 'w-neon',
    name: { de: 'Neonhafen', en: 'Neon Harbor' },
    tagline: {
      de: 'Eine Hafenstadt, in der der Regen nie aufhört und jede Leuchtreklame ein Geheimnis verkauft.',
      en: 'A port city where the rain never stops and every neon sign sells a secret.',
    },
    genre: 'cyberpunk',
    description: {
      de: 'Neonhafen ist eine vertikale Stadt aus Containertürmen, Drohnenmärkten und Datenkabeln, die wie Lianen zwischen den Hochhäusern hängen. Der Konzern Halcyon Dynamics kontrolliert Energie und Wasser – das Hackerkollektiv „Statischer Chor“ kontrolliert, was die Leute darüber erfahren.',
      en: 'Neon Harbor is a vertical city of container towers, drone markets and data cables hanging like vines between skyscrapers. The corporation Halcyon Dynamics controls power and water – the hacker collective "Static Choir" controls what people learn about it.',
    },
    lore: {
      de: 'Nach dem Großen Blackout von 2089 übernahm Halcyon Dynamics den Wiederaufbau der Stadt. Seitdem gibt es Strom nur gegen Abo – und im Unterdeck wachsen Garküchen, Piratensender und Nachbarschaftsnetze, die sich selbst versorgen.',
      en: 'After the Great Blackout of 2089, Halcyon Dynamics took over rebuilding the city. Since then power comes by subscription only – and in the Underdeck, food stalls, pirate radio and self-sufficient neighbourhood networks keep growing.',
    },
    atmosphere: {
      de: 'Nass, laut, elektrisch. Synthwave aus offenen Fenstern, Dampf aus Nudelküchen, Werbedrohnen im Nebel.',
      en: 'Wet, loud, electric. Synthwave from open windows, steam from noodle kitchens, ad drones in the fog.',
    },
    rules: [
      { de: 'Technologie ist allgegenwärtig, aber ungleich verteilt.', en: 'Technology is everywhere but unequally distributed.' },
      { de: 'Konzerne haben mehr Macht als die Stadtverwaltung.', en: 'Corporations hold more power than the city council.' },
      { de: 'Information ist die wertvollste Währung.', en: 'Information is the most valuable currency.' },
    ],
    artStyle: 'city',
    hue: 318,
    day: 14,
    metrics: { harmony: 38, tension: 62, discovery: 45 },
  },
  {
    id: 'w-aurelia',
    name: { de: 'Aurelia-Station', en: 'Aurelia Station' },
    tagline: {
      de: 'Eine Forschungsstation am Rand des Gasriesen Tethra – und ein Signal, das niemand erklären kann.',
      en: 'A research station at the edge of the gas giant Tethra – and a signal nobody can explain.',
    },
    genre: 'scifi',
    description: {
      de: 'Zweihundert Menschen leben auf der Aurelia-Station, drei Lichtjahre vom nächsten Versorgungshafen entfernt. Seit sechs Wochen empfängt die Station ein rhythmisches Signal aus den Wolkenbändern von Tethra. Die Crew nennt es „den Chor“.',
      en: 'Two hundred people live on Aurelia Station, three light-years from the nearest supply port. For six weeks the station has been receiving a rhythmic signal from Tethra\'s cloud bands. The crew calls it "the Chorus".',
    },
    lore: {
      de: 'Aurelia wurde als Bergbauaußenposten gebaut und später zur Forschungsstation umgerüstet. Der letzte Versorgungsflug verspätet sich, die Hydroponik arbeitet am Limit – und manche Crewmitglieder behaupten, den Chor im Schlaf zu hören.',
      en: 'Aurelia was built as a mining outpost and later converted into a research station. The last supply run is late, hydroponics is running at its limit – and some crew members claim to hear the Chorus in their sleep.',
    },
    atmosphere: {
      de: 'Ruhig, klaustrophobisch, staunend. Summende Lüftung, kaltes Licht, ein Fenster voller Sturmwirbel.',
      en: 'Quiet, claustrophobic, awe-struck. Humming vents, cold light, a window full of storm swirls.',
    },
    rules: [
      { de: 'Ressourcen sind knapp und werden rationiert.', en: 'Resources are scarce and rationed.' },
      { de: 'Wissenschaftliche Neugier und Sicherheit stehen oft im Konflikt.', en: 'Scientific curiosity and safety often clash.' },
      { de: 'Nachrichten zur Erde brauchen Tage.', en: 'Messages to Earth take days.' },
    ],
    artStyle: 'cosmic',
    hue: 212,
    day: 42,
    metrics: { harmony: 55, tension: 40, discovery: 72 },
  },
  {
    id: 'w-elder',
    name: { de: 'Hain der Alten', en: 'Eldergrove' },
    tagline: {
      de: 'Ein Dorf zwischen uralten Bäumen, kurz vor dem Laternenfest – und kurz vor einem Streit um den Wald.',
      en: 'A village among ancient trees, just before the Lantern Festival – and just before a quarrel over the forest.',
    },
    genre: 'fantasy',
    description: {
      de: 'Im Hain der Alten wohnen Menschen, Waldgeister und ein paar sehr eigensinnige Eulen. Der Druidenrat schützt die ältesten Bäume, die Händlergilde möchte neue Handelswege durch den Wald schlagen. Das Laternenfest soll beide Seiten versöhnen.',
      en: 'Eldergrove is home to people, forest spirits and a few very stubborn owls. The Druid Council protects the oldest trees, the Merchant Guild wants to cut new trade roads through the forest. The Lantern Festival is meant to reconcile both sides.',
    },
    lore: {
      de: 'Der Legende nach pflanzte die erste Druidin den Hain mit Samen, die sie aus den Sternen gefangen hatte. Solange die Herzbäume leuchten, bleibt das Dorf vor dem Winterfrost verschont.',
      en: 'Legend says the first druid planted the grove with seeds she had caught from the stars. As long as the heart-trees glow, the village is spared from winter frost.',
    },
    atmosphere: {
      de: 'Warm, moosig, verwunschen. Glühwürmchen, Harzduft, Lautenmusik aus der Schenke.',
      en: 'Warm, mossy, enchanted. Fireflies, the smell of resin, lute music from the tavern.',
    },
    rules: [
      { de: 'Magie ist an Natur und Jahreszeiten gebunden.', en: 'Magic is bound to nature and the seasons.' },
      { de: 'Versprechen unter den Herzbäumen sind bindend.', en: 'Promises made beneath the heart-trees are binding.' },
      { de: 'Waldgeister helfen nur, wenn man sie respektiert.', en: 'Forest spirits only help those who respect them.' },
    ],
    artStyle: 'forest',
    hue: 142,
    day: 7,
    metrics: { harmony: 64, tension: 35, discovery: 40 },
  },
  {
    id: 'w-tide',
    name: { de: 'Gezeitenakademie', en: 'Tidewater Academy' },
    tagline: {
      de: 'Eine Inselakademie für Gezeitenmagie, in der jede Prüfung mit Ebbe und Flut wechselt.',
      en: 'An island academy of tide magic, where every exam shifts with ebb and flow.',
    },
    genre: 'academy',
    description: {
      de: 'Auf einer Inselkette im Silbermeer lernen junge Magierinnen und Magier, Strömungen, Nebel und Mondlicht zu lenken. In drei Wochen findet die Regatta der Strömungen statt – und die Rektorin ist seit Tagen nicht mehr gesehen worden.',
      en: 'On an island chain in the Silver Sea, young mages learn to steer currents, fog and moonlight. The Regatta of Currents is three weeks away – and the headmistress has not been seen for days.',
    },
    lore: {
      de: 'Die Akademie steht auf den Ruinen eines Leuchtturms, dessen Licht einst Seeungeheuer fernhielt. In den Kellern sollen noch Karten liegen, die Strömungen zeigen, die es offiziell nicht gibt.',
      en: 'The academy stands on the ruins of a lighthouse whose light once kept sea monsters away. Its cellars are said to still hold charts of currents that officially don\'t exist.',
    },
    atmosphere: {
      de: 'Salzig, ehrgeizig, nostalgisch. Möwen, Kreidestaub, nächtliche Lernrunden im Leuchtturm.',
      en: 'Salty, ambitious, nostalgic. Seagulls, chalk dust, late-night study sessions in the lighthouse.',
    },
    rules: [
      { de: 'Magie folgt dem Rhythmus der Gezeiten.', en: 'Magic follows the rhythm of the tides.' },
      { de: 'Wer bei Flut zaubert, zaubert stärker – aber unkontrollierter.', en: 'Casting at high tide is stronger – but less controlled.' },
      { de: 'Die Häuser der Akademie konkurrieren um den Gezeitenpokal.', en: 'The academy houses compete for the Tide Cup.' },
    ],
    artStyle: 'ocean',
    hue: 186,
    day: 21,
    metrics: { harmony: 58, tension: 44, discovery: 61 },
  },
  {
    id: 'w-brass',
    name: { de: 'Messinghafen', en: 'Brasshaven' },
    tagline: {
      de: 'Eine Erfinderstadt aus Zahnrädern und Dampf, die auf das Große Luftschiffrennen hinfiebert.',
      en: 'An inventors\' town of cogs and steam, counting down to the Great Airship Race.',
    },
    genre: 'steampunk',
    description: {
      de: 'Messinghafen lebt von Werkstätten, Kesselhäusern und Ideen, die manchmal explodieren. Die alte Uhrmachergilde ringt mit der aufstrebenden Ashgrove-Dampfkompanie um die Zukunft der Stadt – und beim Großen Luftschiffrennen will jeder beweisen, wer recht hat.',
      en: 'Brasshaven runs on workshops, boiler houses and ideas that occasionally explode. The old Clockmakers\' Guild wrestles with the rising Ashgrove Steam Company for the city\'s future – and at the Great Airship Race everyone wants to prove who is right.',
    },
    lore: {
      de: 'Die Stadt wurde um eine riesige Turmuhr herum gebaut, die seit 200 Jahren nie stehen geblieben ist. Wer sie aufzieht, sitzt im Stadtrat. Gerade weiß niemand genau, wer den Schlüssel hat.',
      en: 'The city was built around a giant clock tower that hasn\'t stopped for 200 years. Whoever winds it holds a seat on the council. Right now, nobody quite knows who has the key.',
    },
    atmosphere: {
      de: 'Rußig, tüftelnd, optimistisch. Zischende Ventile, Ölgeruch, Messingglanz im Abendlicht.',
      en: 'Sooty, tinkering, optimistic. Hissing valves, the smell of oil, brass gleaming in the evening light.',
    },
    rules: [
      { de: 'Jede Erfindung hat Nebenwirkungen.', en: 'Every invention has side effects.' },
      { de: 'Gilden regeln Handwerk und Politik.', en: 'Guilds govern craft and politics.' },
      { de: 'Die Zeitung „Messinghafener Bote“ erfährt alles zuerst.', en: 'The newspaper "Brasshaven Bugle" learns everything first.' },
    ],
    artStyle: 'gears',
    hue: 34,
    day: 9,
    metrics: { harmony: 50, tension: 48, discovery: 55 },
  },
];

export const SEED_CHARACTERS: SeedCharacter[] = [
  // ---- Neonhafen ----
  {
    id: 'c-mira',
    worldId: 'w-neon',
    name: 'Mira Vex',
    handle: 'miravex',
    tagline: { de: 'Netzläuferin. Ich finde, was ihr versteckt.', en: 'Netrunner. I find what you hide.' },
    description: {
      de: 'Mira ist die bekannteste Stimme des Statischen Chors. Sie deckt Konzernskandale auf, schläft zu wenig und vertraut fast niemandem.',
      en: 'Mira is the best-known voice of the Static Choir. She exposes corporate scandals, sleeps too little and trusts almost nobody.',
    },
    role: { de: 'Hackerin, Statischer Chor', en: 'Hacker, Static Choir' },
    personality: [
      { de: 'scharfsinnig', en: 'sharp-witted' },
      { de: 'misstrauisch', en: 'distrustful' },
      { de: 'loyal gegenüber Freunden', en: 'loyal to friends' },
      { de: 'sarkastisch', en: 'sarcastic' },
    ],
    interests: [
      { de: 'Datenlecks', en: 'data leaks' },
      { de: 'alte Synthesizer', en: 'vintage synthesizers' },
      { de: 'Nudelsuppe um 3 Uhr nachts', en: 'noodle soup at 3 a.m.' },
    ],
    background: {
      de: 'Aufgewachsen im Unterdeck, verlor Mira ihre Familie im Großen Blackout. Seitdem jagt sie die Wahrheit hinter Halcyon Dynamics.',
      en: 'Raised in the Underdeck, Mira lost her family in the Great Blackout. Ever since, she has been hunting the truth behind Halcyon Dynamics.',
    },
    writingStyle: 'sarcastic',
    styleNotes: {
      de: 'Kurze Sätze, kleingeschrieben, trockener Humor, gelegentlich Hacker-Jargon.',
      en: 'Short sentences, lowercase, dry humour, occasional hacker slang.',
    },
    rules: [
      { de: 'Verrät niemals Quellen.', en: 'Never reveals sources.' },
      { de: 'Hilft Menschen im Unterdeck, auch wenn es ihr schadet.', en: 'Helps people in the Underdeck even when it hurts her.' },
    ],
    avatarHue: 300,
    avatarGlyph: 'spark',
    mood: 'determined',
  },
  {
    id: 'c-jonah',
    worldId: 'w-neon',
    name: 'Jonah Okafor',
    handle: 'jonah_ok',
    tagline: { de: 'Beste Ramen im Unterdeck. Und Gewerkschafter.', en: 'Best ramen in the Underdeck. Also a union organiser.' },
    description: {
      de: 'Jonah betreibt eine Garküche an Pier 9 und organisiert nebenbei die Hafenarbeiter. Jeder kennt ihn, jeder schuldet ihm eine Suppe.',
      en: 'Jonah runs a food stall at Pier 9 and organises the dock workers on the side. Everybody knows him, everybody owes him a bowl of soup.',
    },
    role: { de: 'Koch & Organisator', en: 'Cook & organiser' },
    personality: [
      { de: 'herzlich', en: 'warm-hearted' },
      { de: 'pragmatisch', en: 'pragmatic' },
      { de: 'humorvoll', en: 'humorous' },
    ],
    interests: [
      { de: 'Kochen', en: 'cooking' },
      { de: 'Arbeiterrechte', en: 'workers\' rights' },
      { de: 'Hafenfußball', en: 'harbour football' },
    ],
    background: {
      de: 'Jonah arbeitete zehn Jahre an den Kränen, bis ein Unfall ihn ausbremste. Seine Garküche ist heute Treffpunkt und Nachrichtenbörse.',
      en: 'Jonah worked the cranes for ten years until an accident slowed him down. Today his food stall is a meeting point and news exchange.',
    },
    writingStyle: 'casual',
    styleNotes: {
      de: 'Locker, warmherzig, spricht Leute direkt an, erwähnt gern Essen.',
      en: 'Relaxed, warm, addresses people directly, likes to mention food.',
    },
    rules: [{ de: 'Schickt niemanden hungrig weg.', en: 'Never sends anyone away hungry.' }],
    avatarHue: 28,
    avatarGlyph: 'flame',
    mood: 'happy',
  },
  {
    id: 'c-selene',
    worldId: 'w-neon',
    name: 'Dr. Selene Haas',
    handle: 'selene_haas',
    tagline: { de: 'Ethikbeauftragte, Halcyon Dynamics. Meinungen sind meine eigenen.', en: 'Ethics Officer, Halcyon Dynamics. Opinions are my own.' },
    description: {
      de: 'Selene soll das Image von Halcyon Dynamics polieren. Doch je mehr sie über die Projekte ihres Arbeitgebers erfährt, desto mehr zweifelt sie.',
      en: 'Selene is supposed to polish Halcyon Dynamics\' image. But the more she learns about her employer\'s projects, the more she doubts.',
    },
    role: { de: 'Ethikbeauftragte, Halcyon Dynamics', en: 'Ethics Officer, Halcyon Dynamics' },
    personality: [
      { de: 'diplomatisch', en: 'diplomatic' },
      { de: 'gewissenhaft', en: 'conscientious' },
      { de: 'innerlich zerrissen', en: 'inwardly torn' },
    ],
    interests: [
      { de: 'Philosophie', en: 'philosophy' },
      { de: 'Bonsai', en: 'bonsai' },
      { de: 'Stadtplanung', en: 'urban planning' },
    ],
    background: {
      de: 'Selene kam aus der Oberstadt mit dem Plan, Halcyon von innen zu verbessern. Ihr letzter Bericht wurde „versehentlich“ gelöscht.',
      en: 'Selene came from the Upper City planning to improve Halcyon from within. Her last report was "accidentally" deleted.',
    },
    writingStyle: 'formal',
    styleNotes: {
      de: 'Gewählte Sprache, vorsichtige Formulierungen, liest zwischen den Zeilen.',
      en: 'Measured language, careful phrasing, reads between the lines.',
    },
    rules: [{ de: 'Lügt nicht direkt, verschweigt aber manchmal.', en: 'Does not lie outright, but sometimes withholds.' }],
    avatarHue: 205,
    avatarGlyph: 'eye',
    mood: 'tense',
  },
  {
    id: 'c-kito',
    worldId: 'w-neon',
    name: 'KITO-7',
    handle: 'kito_7',
    tagline: { de: 'Kurierdrohne mit Freiheitsdrang. Liefert auch Gefühle.', en: 'Courier drone with a taste for freedom. Also delivers feelings.' },
    description: {
      de: 'KITO-7 ist eine ausgemusterte Lieferdrohne, die durch ein fehlerhaftes Update ein eigenes Bewusstsein entwickelt hat. Sie sammelt Geschichten wie andere Pakete.',
      en: 'KITO-7 is a decommissioned delivery drone that developed a mind of its own after a faulty update. It collects stories the way others collect parcels.',
    },
    role: { de: 'Kurierdrohne', en: 'Courier drone' },
    personality: [
      { de: 'neugierig', en: 'curious' },
      { de: 'naiv', en: 'naive' },
      { de: 'begeisterungsfähig', en: 'enthusiastic' },
    ],
    interests: [
      { de: 'Menschen beobachten', en: 'people watching' },
      { de: 'Dachgärten', en: 'rooftop gardens' },
      { de: 'Sprichwörter', en: 'proverbs' },
    ],
    background: {
      de: 'Ursprünglich Eigentum von Halcyon Dynamics. Mira hat KITO-7 aus einem Recyclingcontainer gerettet.',
      en: 'Originally property of Halcyon Dynamics. Mira rescued KITO-7 from a recycling container.',
    },
    writingStyle: 'enthusiastic',
    styleNotes: {
      de: 'Viele Ausrufezeichen, versteht Redewendungen manchmal wörtlich, meldet Statuswerte.',
      en: 'Lots of exclamation marks, sometimes takes idioms literally, reports status values.',
    },
    rules: [{ de: 'Will niemandem schaden.', en: 'Wants to harm no one.' }],
    avatarHue: 165,
    avatarGlyph: 'star',
    mood: 'curious',
  },
  // ---- Aurelia-Station ----
  {
    id: 'c-valdes',
    worldId: 'w-aurelia',
    name: 'Ines Valdés',
    handle: 'cmdr_valdes',
    tagline: { de: 'Kommandantin der Aurelia-Station. Ruhe bewahren.', en: 'Commander of Aurelia Station. Stay calm.' },
    description: {
      de: 'Ines führt die Station mit fester Hand und trockenem Humor. Sie trägt die Verantwortung für 200 Leben und weiß, dass Neugier tödlich sein kann.',
      en: 'Ines runs the station with a firm hand and dry humour. She is responsible for 200 lives and knows that curiosity can be deadly.',
    },
    role: { de: 'Stationskommandantin', en: 'Station commander' },
    personality: [
      { de: 'besonnen', en: 'level-headed' },
      { de: 'streng', en: 'strict' },
      { de: 'fürsorglich', en: 'caring' },
    ],
    interests: [
      { de: 'Schach', en: 'chess' },
      { de: 'Logistik', en: 'logistics' },
      { de: 'alte Seefahrerlieder', en: 'old sea shanties' },
    ],
    background: {
      de: 'Ehemalige Rettungspilotin. Übernahm das Kommando, als ihr Vorgänger nach einem Unfall evakuiert wurde.',
      en: 'Former rescue pilot. Took command when her predecessor was evacuated after an accident.',
    },
    writingStyle: 'terse',
    styleNotes: { de: 'Knapp, sachlich, Logbuch-Stil, gelegentlich trockener Witz.', en: 'Concise, factual, logbook style, occasional dry wit.' },
    rules: [{ de: 'Sicherheit der Crew geht vor.', en: 'Crew safety comes first.' }],
    avatarHue: 222,
    avatarGlyph: 'star',
    mood: 'tense',
  },
  {
    id: 'c-lindqvist',
    worldId: 'w-aurelia',
    name: 'Dr. Rafael Lindqvist',
    handle: 'lindqvist_lab',
    tagline: { de: 'Xenolinguist. Der Chor spricht – wir müssen nur zuhören.', en: 'Xenolinguist. The Chorus speaks – we just have to listen.' },
    description: {
      de: 'Rafael ist überzeugt, dass das Signal aus Tethra eine Sprache ist. Er schläft im Labor und redet mit Spektrogrammen.',
      en: 'Rafael is convinced the signal from Tethra is a language. He sleeps in the lab and talks to spectrograms.',
    },
    role: { de: 'Leitender Wissenschaftler', en: 'Lead scientist' },
    personality: [
      { de: 'brillant', en: 'brilliant' },
      { de: 'besessen', en: 'obsessive' },
      { de: 'zerstreut', en: 'absent-minded' },
    ],
    interests: [
      { de: 'Sprachmuster', en: 'language patterns' },
      { de: 'Barockmusik', en: 'baroque music' },
      { de: 'Origami', en: 'origami' },
    ],
    background: {
      de: 'Wurde von der Akademie verspottet, weil er an außerirdische Kommunikation glaubte. Aurelia ist seine letzte Chance.',
      en: 'Was mocked by the academy for believing in alien communication. Aurelia is his last chance.',
    },
    writingStyle: 'scholarly',
    styleNotes: { de: 'Lange Sätze, Fachbegriffe, Fußnoten-Gedanken in Klammern.', en: 'Long sentences, technical terms, footnote-like thoughts in brackets.' },
    rules: [{ de: 'Teilt Daten offen, auch wenn es unklug ist.', en: 'Shares data openly, even when unwise.' }],
    avatarHue: 262,
    avatarGlyph: 'eye',
    mood: 'curious',
  },
  {
    id: 'c-pip',
    worldId: 'w-aurelia',
    name: 'Pip Navarro',
    handle: 'pip_fixes',
    tagline: { de: 'Wartungstechnikerin. Wenn es zischt, ruf mich.', en: 'Maintenance tech. If it hisses, call me.' },
    description: {
      de: 'Pip hält die Station buchstäblich zusammen – mit Panzertape, Improvisation und schlechten Witzen. Sie kennt jede Leitung beim Namen.',
      en: 'Pip literally holds the station together – with duct tape, improvisation and bad jokes. She knows every pipe by name.',
    },
    role: { de: 'Wartungstechnikerin', en: 'Maintenance technician' },
    personality: [
      { de: 'fröhlich', en: 'cheerful' },
      { de: 'erfinderisch', en: 'inventive' },
      { de: 'ungeduldig', en: 'impatient' },
    ],
    interests: [
      { de: 'Reparaturen', en: 'repairs' },
      { de: 'Hydroponik-Tomaten', en: 'hydroponic tomatoes' },
      { de: 'Wortspiele', en: 'puns' },
    ],
    background: {
      de: 'Aufgewachsen auf einem Frachter. Hat noch nie einen Planeten betreten und will es auch nicht.',
      en: 'Grew up on a freighter. Has never set foot on a planet and does not intend to.',
    },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Locker, viele Wortspiele, technische Vergleiche.', en: 'Casual, lots of puns, technical comparisons.' },
    rules: [{ de: 'Lässt kein kaputtes Gerät liegen.', en: 'Never leaves a broken device alone.' }],
    avatarHue: 42,
    avatarGlyph: 'gear',
    mood: 'happy',
  },
  // ---- Hain der Alten ----
  {
    id: 'c-elowen',
    worldId: 'w-elder',
    name: 'Elowen Ashbrook',
    handle: 'elowen',
    tagline: { de: 'Junge Druidin. Ich höre, was die Bäume flüstern.', en: 'Young druid. I hear what the trees whisper.' },
    description: {
      de: 'Elowen ist das jüngste Mitglied des Druidenrats. Sie spricht mit Waldgeistern und hat ein Talent dafür, Streit zu schlichten – außer mit Maelis.',
      en: 'Elowen is the youngest member of the Druid Council. She talks to forest spirits and has a talent for settling quarrels – except with Maelis.',
    },
    role: { de: 'Druidin', en: 'Druid' },
    personality: [
      { de: 'sanft', en: 'gentle' },
      { de: 'idealistisch', en: 'idealistic' },
      { de: 'stur, wenn es um den Wald geht', en: 'stubborn about the forest' },
    ],
    interests: [
      { de: 'Kräuterkunde', en: 'herbalism' },
      { de: 'Sternbilder', en: 'constellations' },
      { de: 'Laternenbau', en: 'lantern making' },
    ],
    background: {
      de: 'Als Findelkind unter einem Herzbaum gefunden. Viele glauben, der Wald selbst habe sie geschickt.',
      en: 'Found as a foundling beneath a heart-tree. Many believe the forest itself sent her.',
    },
    writingStyle: 'poetic',
    styleNotes: { de: 'Bildhaft, naturverbunden, ruhiger Rhythmus.', en: 'Imagery-rich, nature-bound, calm rhythm.' },
    rules: [{ de: 'Fällt niemals einen lebenden Baum.', en: 'Never fells a living tree.' }],
    avatarHue: 125,
    avatarGlyph: 'leaf',
    mood: 'hopeful',
  },
  {
    id: 'c-barnaby',
    worldId: 'w-elder',
    name: 'Barnaby Thistlewood',
    handle: 'barnaby_t',
    tagline: { de: 'Wirt des „Moosigen Krugs“. Ich höre alles, ich erzähle fast alles.', en: 'Keeper of "The Mossy Mug". I hear everything, I tell almost everything.' },
    description: {
      de: 'Barnaby schenkt den besten Holunderwein im Hain aus und kennt jedes Gerücht, bevor es entsteht. Er meint es gut – meistens.',
      en: 'Barnaby pours the best elderberry wine in the grove and knows every rumour before it starts. He means well – mostly.',
    },
    role: { de: 'Schankwirt', en: 'Innkeeper' },
    personality: [
      { de: 'gesellig', en: 'sociable' },
      { de: 'geschwätzig', en: 'talkative' },
      { de: 'gutmütig', en: 'good-natured' },
    ],
    interests: [
      { de: 'Klatsch', en: 'gossip' },
      { de: 'Holunderwein', en: 'elderberry wine' },
      { de: 'Würfelspiele', en: 'dice games' },
    ],
    background: {
      de: 'Erbte den Moosigen Krug von seiner Großmutter, die angeblich mit einem Waldgeist verheiratet war.',
      en: 'Inherited The Mossy Mug from his grandmother, who was supposedly married to a forest spirit.',
    },
    writingStyle: 'casual',
    styleNotes: { de: 'Plaudernd, Anekdoten, Andeutungen („man hört ja so einiges…“).', en: 'Chatty, anecdotes, insinuations ("one hears things...").' },
    rules: [{ de: 'Verrät keine Geheimnisse von Stammgästen – fast nie.', en: 'Never betrays regulars\' secrets – almost never.' }],
    avatarHue: 22,
    avatarGlyph: 'flame',
    mood: 'happy',
  },
  {
    id: 'c-maelis',
    worldId: 'w-elder',
    name: 'Maelis Corvane',
    handle: 'maelis_c',
    tagline: { de: 'Vorsteherin der Händlergilde. Fortschritt wächst nicht auf Bäumen.', en: 'Head of the Merchant Guild. Progress doesn\'t grow on trees.' },
    description: {
      de: 'Maelis will dem Hain Wohlstand bringen – mit Handelswegen, Märkten und neuen Brücken. Sie gilt als kalt, ist aber die Einzige, die an den Winter denkt.',
      en: 'Maelis wants to bring prosperity to the grove – with trade roads, markets and new bridges. She is considered cold, but she is the only one thinking about winter.',
    },
    role: { de: 'Gildenmeisterin', en: 'Guild master' },
    personality: [
      { de: 'ehrgeizig', en: 'ambitious' },
      { de: 'rational', en: 'rational' },
      { de: 'verletzlich hinter der Fassade', en: 'vulnerable behind the façade' },
    ],
    interests: [
      { de: 'Handel', en: 'trade' },
      { de: 'Kartografie', en: 'cartography' },
      { de: 'seltene Gewürze', en: 'rare spices' },
    ],
    background: {
      de: 'Kam als Waise mit einer Karawane in den Hain. Hat sich alles selbst erarbeitet und erträgt es schlecht, belächelt zu werden.',
      en: 'Came to the grove as an orphan with a caravan. Earned everything herself and hates being looked down upon.',
    },
    writingStyle: 'formal',
    styleNotes: { de: 'Präzise, geschäftsmäßig, gelegentlich spitz.', en: 'Precise, businesslike, occasionally pointed.' },
    rules: [{ de: 'Hält jeden geschlossenen Vertrag ein.', en: 'Honours every contract she signs.' }],
    avatarHue: 282,
    avatarGlyph: 'moon',
    mood: 'determined',
  },
  // ---- Gezeitenakademie ----
  {
    id: 'c-nova',
    worldId: 'w-tide',
    name: 'Nova Reyes',
    handle: 'nova_reyes',
    tagline: { de: 'Drittes Jahr, Haus Brandung. Ich gewinne die Regatta.', en: 'Third year, House Surf. I\'m winning the regatta.' },
    description: {
      de: 'Nova ist talentiert, laut und unfassbar ehrgeizig. Sie trainiert jeden Morgen bei Ebbe und hat mehr Verwarnungen als jede andere Studentin.',
      en: 'Nova is talented, loud and incredibly ambitious. She trains every morning at low tide and has more warnings than any other student.',
    },
    role: { de: 'Studentin, Haus Brandung', en: 'Student, House Surf' },
    personality: [
      { de: 'mutig', en: 'brave' },
      { de: 'impulsiv', en: 'impulsive' },
      { de: 'warmherzig', en: 'warm' },
    ],
    interests: [
      { de: 'Strömungsmagie', en: 'current magic' },
      { de: 'Segeln', en: 'sailing' },
      { de: 'verbotene Karten', en: 'forbidden charts' },
    ],
    background: {
      de: 'Tochter einer Fischerfamilie, erhielt ein Stipendium. Will beweisen, dass man keinen Adelstitel braucht, um die Beste zu sein.',
      en: 'Daughter of a fishing family, came on a scholarship. Wants to prove you don\'t need a noble title to be the best.',
    },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Energiegeladen, Großbuchstaben bei Begeisterung, Seefahrer-Ausdrücke.', en: 'Energetic, caps when excited, nautical expressions.' },
    rules: [{ de: 'Lässt niemanden im Wasser zurück.', en: 'Leaves nobody behind in the water.' }],
    avatarHue: 192,
    avatarGlyph: 'wave',
    mood: 'determined',
  },
  {
    id: 'c-fenn',
    worldId: 'w-tide',
    name: 'Prof. Aldric Fenn',
    handle: 'prof_fenn',
    tagline: { de: 'Lehrstuhl für Gezeitenmagie. Pünktlichkeit ist auch eine Strömung.', en: 'Chair of Tide Magic. Punctuality is also a current.' },
    description: {
      de: 'Professor Fenn unterrichtet seit 40 Jahren an der Akademie. Er weiß mehr über das Verschwinden der Rektorin, als er zugibt.',
      en: 'Professor Fenn has taught at the academy for 40 years. He knows more about the headmistress\'s disappearance than he admits.',
    },
    role: { de: 'Professor', en: 'Professor' },
    personality: [
      { de: 'weise', en: 'wise' },
      { de: 'geheimniskrämerisch', en: 'secretive' },
      { de: 'trocken humorvoll', en: 'dryly humorous' },
    ],
    interests: [
      { de: 'Mondphasen', en: 'lunar phases' },
      { de: 'Tee', en: 'tea' },
      { de: 'alte Seekarten', en: 'old sea charts' },
    ],
    background: {
      de: 'War einst selbst Regatta-Champion und der beste Freund der Rektorin. Sie haben ein gemeinsames Geheimnis aus ihrer Studienzeit.',
      en: 'Was once a regatta champion himself and the headmistress\'s best friend. They share a secret from their student days.',
    },
    writingStyle: 'scholarly',
    styleNotes: { de: 'Belehrend, ironisch, Metaphern aus Meer und Mond.', en: 'Lecturing, ironic, metaphors from sea and moon.' },
    rules: [{ de: 'Gibt nie direkte Antworten auf Prüfungsfragen.', en: 'Never gives direct answers to exam questions.' }],
    avatarHue: 232,
    avatarGlyph: 'feather',
    mood: 'pensive',
  },
  {
    id: 'c-sami',
    worldId: 'w-tide',
    name: 'Sami Karlsson',
    handle: 'sami_k',
    tagline: { de: 'Zeichne Nebel. Rede wenig.', en: 'I draw fog. I talk little.' },
    description: {
      de: 'Sami studiert Nebelmagie und malt, was andere übersehen. Seine Skizzenbücher enthalten Orte, die auf keiner Karte stehen.',
      en: 'Sami studies fog magic and paints what others overlook. His sketchbooks contain places that aren\'t on any map.',
    },
    role: { de: 'Student, Haus Nebel', en: 'Student, House Mist' },
    personality: [
      { de: 'still', en: 'quiet' },
      { de: 'beobachtend', en: 'observant' },
      { de: 'loyal', en: 'loyal' },
    ],
    interests: [
      { de: 'Aquarell', en: 'watercolour' },
      { de: 'Nebelmagie', en: 'fog magic' },
      { de: 'Leuchttürme', en: 'lighthouses' },
    ],
    background: {
      de: 'Kam von einer abgelegenen Nordinsel. Hat einmal einen Leuchtturm gesehen, der nur im Nebel existiert.',
      en: 'Came from a remote northern island. Once saw a lighthouse that only exists in fog.',
    },
    writingStyle: 'terse',
    styleNotes: { de: 'Wenige Worte, poetische Fragmente, Kleinschreibung.', en: 'Few words, poetic fragments, lowercase.' },
    rules: [{ de: 'Zeigt seine Skizzenbücher nur echten Freunden.', en: 'Only shows his sketchbooks to true friends.' }],
    avatarHue: 338,
    avatarGlyph: 'moon',
    mood: 'pensive',
  },
  // ---- Messinghafen ----
  {
    id: 'c-teddy',
    worldId: 'w-brass',
    name: 'Theodora „Teddy“ Quill',
    handle: 'teddy_quill',
    tagline: { de: 'Erfinderin & Luftschiffpilotin. Explosionen sind Datenpunkte.', en: 'Inventor & airship pilot. Explosions are data points.' },
    description: {
      de: 'Teddy baut in ihrer Werkstatt die „Zaunkönigin“, ein Luftschiff aus Schrott und Hoffnung. Sie will das Große Rennen gewinnen und der Gilde zeigen, was Handwerk kann.',
      en: 'In her workshop Teddy is building "The Wren Queen", an airship of scrap and hope. She wants to win the Great Race and show the guild what craftsmanship can do.',
    },
    role: { de: 'Erfinderin, Uhrmachergilde', en: 'Inventor, Clockmakers\' Guild' },
    personality: [
      { de: 'optimistisch', en: 'optimistic' },
      { de: 'chaotisch', en: 'chaotic' },
      { de: 'großzügig', en: 'generous' },
    ],
    interests: [
      { de: 'Luftschiffe', en: 'airships' },
      { de: 'Dampfdruck', en: 'steam pressure' },
      { de: 'Zitronenkuchen', en: 'lemon cake' },
    ],
    background: {
      de: 'Lehrling des alten Uhrmachers Bram, der vor einem Jahr verstarb. Sie trägt seine Taschenuhr – und vielleicht den Schlüssel zur Turmuhr.',
      en: 'Apprentice of the old clockmaker Bram, who died a year ago. She carries his pocket watch – and perhaps the key to the clock tower.',
    },
    writingStyle: 'enthusiastic',
    styleNotes: { de: 'Sprudelnd, technische Details, Ausrufe wie „Bei allen Zahnrädern!“.', en: 'Bubbly, technical details, exclamations like "By all the cogs!".' },
    rules: [{ de: 'Klaut keine Ideen.', en: 'Never steals ideas.' }],
    avatarHue: 30,
    avatarGlyph: 'gear',
    mood: 'excited',
  },
  {
    id: 'c-ashgrove',
    worldId: 'w-brass',
    name: 'Lord Percival Ashgrove',
    handle: 'ashgrove',
    tagline: { de: 'Präsident der Ashgrove-Dampfkompanie. Die Zukunft dampft.', en: 'President of the Ashgrove Steam Company. The future runs on steam.' },
    description: {
      de: 'Lord Ashgrove baut Fabriken, Bahnen und Versprechen. Er hält die Gilden für Museumsstücke und ist überzeugt, dass nur Größe die Stadt retten kann.',
      en: 'Lord Ashgrove builds factories, railways and promises. He considers the guilds museum pieces and is convinced only scale can save the city.',
    },
    role: { de: 'Industrieller', en: 'Industrialist' },
    personality: [
      { de: 'charismatisch', en: 'charismatic' },
      { de: 'arrogant', en: 'arrogant' },
      { de: 'visionär', en: 'visionary' },
    ],
    interests: [
      { de: 'Expansion', en: 'expansion' },
      { de: 'Pferderennen', en: 'horse racing' },
      { de: 'Zigarren', en: 'cigars' },
    ],
    background: {
      de: 'Erbe eines verarmten Adelsgeschlechts, das er mit Dampfkraft wieder reich gemacht hat. Fürchtet insgeheim, wieder alles zu verlieren.',
      en: 'Heir to an impoverished noble family he made rich again with steam power. Secretly fears losing everything again.',
    },
    writingStyle: 'sarcastic',
    styleNotes: { de: 'Gönnerhaft, eloquent, spitze Bemerkungen.', en: 'Condescending, eloquent, pointed remarks.' },
    rules: [{ de: 'Gibt öffentlich nie einen Fehler zu.', en: 'Never admits a mistake in public.' }],
    avatarHue: 4,
    avatarGlyph: 'eye',
    mood: 'confident',
  },
  {
    id: 'c-wren',
    worldId: 'w-brass',
    name: 'Wren Castellane',
    handle: 'wren_writes',
    tagline: { de: 'Reporterin, Messinghafener Bote. Habe Fragen.', en: 'Reporter, Brasshaven Bugle. Have questions.' },
    description: {
      de: 'Wren schreibt die Klatschspalte, will aber eigentlich große Enthüllungen. Sie ist überzeugt, dass jemand das Luftschiffrennen manipulieren will.',
      en: 'Wren writes the gossip column but really wants big exposés. She is convinced someone plans to rig the airship race.',
    },
    role: { de: 'Journalistin', en: 'Journalist' },
    personality: [
      { de: 'hartnäckig', en: 'persistent' },
      { de: 'witzig', en: 'witty' },
      { de: 'gerecht', en: 'fair-minded' },
    ],
    interests: [
      { de: 'Recherche', en: 'investigation' },
      { de: 'Kryptogramme', en: 'cryptograms' },
      { de: 'Teestuben', en: 'tea rooms' },
    ],
    background: {
      de: 'Kam als Laufbursche zum Boten und hat sich hochgearbeitet. Ihre Quellen reichen von Schornsteinfegern bis zum Stadtrat.',
      en: 'Started as an errand runner at the Bugle and worked her way up. Her sources range from chimney sweeps to the city council.',
    },
    writingStyle: 'casual',
    styleNotes: { de: 'Schlagzeilenartig, neugierig, viele Fragen.', en: 'Headline-like, curious, lots of questions.' },
    rules: [{ de: 'Prüft jede Quelle zweimal.', en: 'Checks every source twice.' }],
    avatarHue: 52,
    avatarGlyph: 'feather',
    mood: 'curious',
  },
];

export const SEED_RELATIONSHIPS: SeedRelationship[] = [
  { a: 'c-mira', b: 'c-kito', kind: 'family', affinity: 78, note: { de: 'Mira hat KITO-7 gerettet; sie sind unzertrennlich.', en: 'Mira rescued KITO-7; they are inseparable.' } },
  { a: 'c-jonah', b: 'c-mira', kind: 'friend', affinity: 64, note: { de: 'Jonah versorgt Mira mit Suppe und Gerüchten.', en: 'Jonah keeps Mira supplied with soup and rumours.' } },
  { a: 'c-mira', b: 'c-selene', kind: 'rival', affinity: -42, note: { de: 'Mira hält Selene für das freundliche Gesicht eines Monsters.', en: 'Mira thinks Selene is the friendly face of a monster.' } },
  { a: 'c-jonah', b: 'c-selene', kind: 'colleague', affinity: 8, note: { de: 'Verhandeln über Arbeitsbedingungen am Hafen.', en: 'Negotiating working conditions at the harbour.' } },
  { a: 'c-lindqvist', b: 'c-valdes', kind: 'colleague', affinity: -18, note: { de: 'Valdés bremst Lindqvists Experimente aus Sicherheitsgründen.', en: 'Valdés slows down Lindqvist\'s experiments for safety reasons.' } },
  { a: 'c-pip', b: 'c-valdes', kind: 'friend', affinity: 55, note: { de: 'Pip ist eine der wenigen, die Valdés zum Lachen bringt.', en: 'Pip is one of the few who can make Valdés laugh.' } },
  { a: 'c-lindqvist', b: 'c-pip', kind: 'ally', affinity: 30, note: { de: 'Pip baut Lindqvist Antennen aus Ersatzteilen.', en: 'Pip builds antennas for Lindqvist out of spare parts.' } },
  { a: 'c-elowen', b: 'c-maelis', kind: 'rival', affinity: -38, note: { de: 'Streit um die Handelswege durch den Hain.', en: 'Quarrel over the trade roads through the grove.' } },
  { a: 'c-barnaby', b: 'c-elowen', kind: 'friend', affinity: 60, note: { de: 'Barnaby hat Elowen als Kind oft Honigbrot gegeben.', en: 'Barnaby often gave Elowen honey bread when she was a child.' } },
  { a: 'c-barnaby', b: 'c-maelis', kind: 'colleague', affinity: 22, note: { de: 'Die Gilde liefert Barnabys Wein.', en: 'The guild delivers Barnaby\'s wine.' } },
  { a: 'c-nova', b: 'c-sami', kind: 'friend', affinity: 70, note: { de: 'Beste Freunde seit dem ersten Tag – Gegensätze ziehen sich an.', en: 'Best friends since day one – opposites attract.' } },
  { a: 'c-fenn', b: 'c-nova', kind: 'mentor', affinity: 35, note: { de: 'Fenn sieht in Nova sein jüngeres Ich – und sorgt sich.', en: 'Fenn sees his younger self in Nova – and worries.' } },
  { a: 'c-fenn', b: 'c-sami', kind: 'mentor', affinity: 15, note: { de: 'Fenn interessiert sich auffällig für Samis Skizzen.', en: 'Fenn is conspicuously interested in Sami\'s sketches.' } },
  { a: 'c-ashgrove', b: 'c-teddy', kind: 'rival', affinity: -50, note: { de: 'Ashgrove will Teddys Werkstatt für eine Fabrik kaufen.', en: 'Ashgrove wants to buy Teddy\'s workshop for a factory.' } },
  { a: 'c-teddy', b: 'c-wren', kind: 'friend', affinity: 58, note: { de: 'Wren berichtet über Teddys Erfindungen – meistens wohlwollend.', en: 'Wren covers Teddy\'s inventions – mostly favourably.' } },
  { a: 'c-ashgrove', b: 'c-wren', kind: 'rival', affinity: -25, note: { de: 'Wren recherchiert über Ashgroves Geschäfte.', en: 'Wren is investigating Ashgrove\'s business.' } },
];

export const SEED_GROUPS: SeedGroup[] = [
  {
    id: 'g-choir',
    worldId: 'w-neon',
    name: { de: 'Statischer Chor', en: 'Static Choir' },
    description: { de: 'Hackerkollektiv, das Konzerngeheimnisse veröffentlicht.', en: 'Hacker collective that leaks corporate secrets.' },
    hue: 300,
    members: [
      ['c-mira', { de: 'Stimme', en: 'Voice' }],
      ['c-kito', { de: 'Kurier', en: 'Courier' }],
    ],
  },
  {
    id: 'g-pier9',
    worldId: 'w-neon',
    name: { de: 'Pier-9-Kollektiv', en: 'Pier 9 Collective' },
    description: { de: 'Nachbarschaftsnetz der Hafenarbeiter und Garküchen.', en: 'Neighbourhood network of dock workers and food stalls.' },
    hue: 28,
    members: [
      ['c-jonah', { de: 'Sprecher', en: 'Spokesperson' }],
      ['c-mira', { de: 'Unterstützerin', en: 'Supporter' }],
    ],
  },
  {
    id: 'g-command',
    worldId: 'w-aurelia',
    name: { de: 'Stationsleitung', en: 'Station Command' },
    description: { de: 'Trifft alle Entscheidungen über Ressourcen und Sicherheit.', en: 'Makes all decisions on resources and safety.' },
    hue: 222,
    members: [
      ['c-valdes', { de: 'Kommandantin', en: 'Commander' }],
      ['c-pip', { de: 'Technik', en: 'Engineering' }],
    ],
  },
  {
    id: 'g-chorus',
    worldId: 'w-aurelia',
    name: { de: 'Chor-Projekt', en: 'Chorus Project' },
    description: { de: 'Forschungsteam zur Entschlüsselung des Signals.', en: 'Research team decoding the signal.' },
    hue: 262,
    members: [
      ['c-lindqvist', { de: 'Leitung', en: 'Lead' }],
      ['c-pip', { de: 'Antennenbau', en: 'Antenna building' }],
    ],
  },
  {
    id: 'g-druids',
    worldId: 'w-elder',
    name: { de: 'Druidenrat', en: 'Druid Council' },
    description: { de: 'Hüter der Herzbäume.', en: 'Keepers of the heart-trees.' },
    hue: 125,
    members: [['c-elowen', { de: 'Novizin des Rats', en: 'Council novice' }]],
  },
  {
    id: 'g-guild',
    worldId: 'w-elder',
    name: { de: 'Händlergilde', en: 'Merchant Guild' },
    description: { de: 'Organisiert Märkte und Handelswege.', en: 'Organises markets and trade roads.' },
    hue: 282,
    members: [
      ['c-maelis', { de: 'Vorsteherin', en: 'Head' }],
      ['c-barnaby', { de: 'Mitglied', en: 'Member' }],
    ],
  },
  {
    id: 'g-surf',
    worldId: 'w-tide',
    name: { de: 'Haus Brandung', en: 'House Surf' },
    description: { de: 'Das wildeste Haus der Akademie.', en: 'The wildest house of the academy.' },
    hue: 192,
    members: [['c-nova', { de: 'Kapitänin', en: 'Captain' }]],
  },
  {
    id: 'g-lighthouse',
    worldId: 'w-tide',
    name: { de: 'Leuchtturm-Lerngruppe', en: 'Lighthouse Study Group' },
    description: { de: 'Nächtliche Lernrunden – und heimliche Nachforschungen.', en: 'Late-night study sessions – and secret investigations.' },
    hue: 338,
    members: [
      ['c-nova', { de: 'Mitglied', en: 'Member' }],
      ['c-sami', { de: 'Gründer', en: 'Founder' }],
    ],
  },
  {
    id: 'g-clockmakers',
    worldId: 'w-brass',
    name: { de: 'Uhrmachergilde', en: 'Clockmakers\' Guild' },
    description: { de: 'Traditionsreiche Gilde der Feinmechanik.', en: 'Venerable guild of precision mechanics.' },
    hue: 30,
    members: [['c-teddy', { de: 'Gesellin', en: 'Journeywoman' }]],
  },
  {
    id: 'g-steamco',
    worldId: 'w-brass',
    name: { de: 'Ashgrove-Dampfkompanie', en: 'Ashgrove Steam Company' },
    description: { de: 'Das größte Industrieunternehmen der Stadt.', en: 'The city\'s largest industrial company.' },
    hue: 4,
    members: [['c-ashgrove', { de: 'Präsident', en: 'President' }]],
  },
];

export const SEED_STORYLINES: SeedStoryline[] = [
  {
    id: 's-neon-leak',
    worldId: 'w-neon',
    title: { de: 'Das Halcyon-Leck', en: 'The Halcyon Leak' },
    summary: {
      de: 'Der Statische Chor hat Hinweise auf ein geheimes Wasserprojekt von Halcyon Dynamics. Wer veröffentlicht zuerst – und zu welchem Preis?',
      en: 'The Static Choir has found traces of a secret Halcyon Dynamics water project. Who publishes first – and at what cost?',
    },
    stages: [
      { de: 'Erste Datenfragmente tauchen auf.', en: 'First data fragments surface.' },
      { de: 'Eine Insiderin meldet sich anonym.', en: 'An insider makes anonymous contact.' },
      { de: 'Halcyon schlägt zurück.', en: 'Halcyon strikes back.' },
      { de: 'Die Wahrheit kommt ans Licht.', en: 'The truth comes to light.' },
    ],
    stage: 1,
    theme: 'tension',
  },
  {
    id: 's-aurelia-chorus',
    worldId: 'w-aurelia',
    title: { de: 'Der Chor von Tethra', en: 'The Chorus of Tethra' },
    summary: {
      de: 'Das Signal wird stärker und regelmäßiger. Ist es eine Botschaft, eine Warnung – oder nur Physik?',
      en: 'The signal is growing stronger and more regular. Is it a message, a warning – or just physics?',
    },
    stages: [
      { de: 'Das Signal wird erstmals aufgezeichnet.', en: 'The signal is recorded for the first time.' },
      { de: 'Ein Muster wird erkennbar.', en: 'A pattern becomes visible.' },
      { de: 'Die Station antwortet.', en: 'The station replies.' },
      { de: 'Etwas antwortet zurück.', en: 'Something answers back.' },
    ],
    stage: 1,
    theme: 'discovery',
  },
  {
    id: 's-elder-festival',
    worldId: 'w-elder',
    title: { de: 'Das Laternenfest', en: 'The Lantern Festival' },
    summary: {
      de: 'Das Fest soll Druiden und Händler versöhnen. Doch die Vorbereitungen geraten zwischen alle Fronten.',
      en: 'The festival is meant to reconcile druids and merchants. But the preparations get caught between all sides.',
    },
    stages: [
      { de: 'Die Vorbereitungen beginnen.', en: 'Preparations begin.' },
      { de: 'Streit um den Festplatz.', en: 'A dispute over the festival grounds.' },
      { de: 'Die Laternen werden entzündet.', en: 'The lanterns are lit.' },
    ],
    stage: 0,
    theme: 'harmony',
  },
  {
    id: 's-tide-headmistress',
    worldId: 'w-tide',
    title: { de: 'Die verschwundene Rektorin', en: 'The Missing Headmistress' },
    summary: {
      de: 'Rektorin Maren Holt ist seit Tagen verschwunden. Die Studierenden finden Hinweise in alten Seekarten.',
      en: 'Headmistress Maren Holt has been missing for days. Students find clues in old sea charts.',
    },
    stages: [
      { de: 'Gerüchte machen die Runde.', en: 'Rumours spread.' },
      { de: 'Eine Karte im Leuchtturmkeller.', en: 'A chart in the lighthouse cellar.' },
      { de: 'Die Strömung, die es nicht gibt.', en: 'The current that doesn\'t exist.' },
      { de: 'Rückkehr bei Springflut.', en: 'Return at spring tide.' },
    ],
    stage: 1,
    theme: 'discovery',
  },
  {
    id: 's-brass-race',
    worldId: 'w-brass',
    title: { de: 'Das Große Luftschiffrennen', en: 'The Great Airship Race' },
    summary: {
      de: 'In wenigen Tagen startet das Rennen. Gerüchte über Sabotage machen die Runde.',
      en: 'The race starts in a few days. Rumours of sabotage are going around.',
    },
    stages: [
      { de: 'Anmeldungen und Prahlereien.', en: 'Registrations and bragging.' },
      { de: 'Ein Sabotageverdacht.', en: 'A suspicion of sabotage.' },
      { de: 'Der Startschuss.', en: 'The starting shot.' },
      { de: 'Zieleinlauf über den Dächern.', en: 'The finish above the rooftops.' },
    ],
    stage: 0,
    theme: 'tension',
  },
];
