import type { GenrePool } from './worldgenPools';

/** Generator-Bausteine für die realitätsnahen Weltkategorien. Alle Namen sind frei erfunden. */
export const GENRE_POOLS_V2 = {
  politics: {
    artStyle: 'capital',
    hue: [205, 230],
    namePrefix: [{ de: 'Republik ', en: 'Republic of ' }, { de: 'Freistaat ', en: 'Free State of ' }, { de: 'Bund ', en: 'Union of ' }],
    nameSuffix: [{ de: 'Aurelia', en: 'Aurelia' }, { de: 'Nordmark', en: 'Nordmark' }, { de: 'Valdera', en: 'Valdera' }, { de: 'Kestria', en: 'Kestria' }],
    taglines: [
      { de: 'Mehrheiten sind zerbrechlich – Schlagzeilen auch.', en: 'Majorities are fragile – and so are headlines.' },
      { de: 'Zwischen Plenarsaal, Hinterzimmer und Kommentarspalte.', en: 'Between the chamber, the back room and the comment section.' },
    ],
    factions: [
      { de: 'die Regierungskoalition', en: 'the governing coalition' },
      { de: 'die Opposition', en: 'the opposition' },
      { de: 'eine junge Protestbewegung', en: 'a young protest movement' },
      { de: 'das Hauptstadtpresse-Korps', en: 'the capital press corps' },
    ],
    places: [
      { de: 'das Parlament am Fluss', en: 'the parliament by the river' },
      { de: 'ein verrauchtes Café gegenüber dem Kanzleramt', en: 'a smoky café across from the chancellery' },
    ],
    conflicts: [
      { de: 'ein knapper Haushaltsstreit', en: 'a tight budget dispute' },
      { de: 'eine vorgezogene Wahl', en: 'a snap election' },
      { de: 'ein durchgestochenes Positionspapier', en: 'a leaked position paper' },
    ],
    lore: [
      { de: 'Seit der Verfassungsreform regiert hier keine Partei mehr allein. Jede Abstimmung ist ein Drahtseilakt.', en: 'Since the constitutional reform, no party governs alone. Every vote is a balancing act.' },
    ],
    atmospheres: [{ de: 'Blitzlichter, Aktenmappen und Kaffee um Mitternacht.', en: 'Camera flashes, briefcases and coffee at midnight.' }],
    rules: [
      { de: 'Alle Personen sind frei erfunden.', en: 'All persons are fictional.' },
      { de: 'Umfragen ändern sich täglich.', en: 'Polls change daily.' },
      { de: 'Wer ein Versprechen bricht, verliert Vertrauen.', en: 'Breaking a promise costs trust.' },
    ],
    roles: [
      { de: 'Abgeordnete:r', en: 'Member of parliament' },
      { de: 'Pressesprecher:in', en: 'Press secretary' },
      { de: 'Hauptstadtkorrespondent:in', en: 'Capital correspondent' },
      { de: 'Wahlkampfmanager:in', en: 'Campaign manager' },
    ],
    interests: [
      { de: 'Umfragewerte', en: 'polling numbers' },
      { de: 'Verkehrspolitik', en: 'transport policy' },
      { de: 'Debattenkultur', en: 'debate culture' },
      { de: 'Lokaljournalismus', en: 'local journalism' },
    ],
    firstNames: ['Henrike', 'Matteo', 'Clara', 'Yusuf', 'Ines', 'Konrad', 'Leni'],
    lastNames: ['Albers', 'Novak', 'Reuter', 'Kaya', 'Lindholm', 'Seidel'],
  },
  celebrity: {
    artStyle: 'stage',
    hue: [320, 350],
    namePrefix: [{ de: 'Glitter', en: 'Glitter' }, { de: 'Velvet', en: 'Velvet' }, { de: 'Golden', en: 'Golden' }],
    nameSuffix: [{ de: ' Boulevard', en: ' Boulevard' }, { de: ' Hills', en: ' Hills' }, { de: ' Avenue', en: ' Avenue' }],
    taglines: [
      { de: 'Jeder Auftritt ist eine Schlagzeile.', en: 'Every appearance is a headline.' },
      { de: 'Roter Teppich, harte Konkurrenz.', en: 'Red carpet, fierce competition.' },
    ],
    factions: [
      { de: 'die großen Agenturen', en: 'the big agencies' },
      { de: 'die Klatschpresse', en: 'the tabloids' },
      { de: 'eine neue Generation von Creator:innen', en: 'a new generation of creators' },
    ],
    places: [
      { de: 'die Premierenbühne am Boulevard', en: 'the premiere stage on the boulevard' },
      { de: 'eine exklusive Dachterrasse', en: 'an exclusive rooftop terrace' },
    ],
    conflicts: [
      { de: 'ein heiß umkämpfter Preis', en: 'a hotly contested award' },
      { de: 'ein Comeback, an das niemand glaubt', en: 'a comeback nobody believes in' },
    ],
    lore: [{ de: 'Wer hier berühmt ist, war es selten lange. Wer es bleiben will, braucht Freunde – und Geheimnisse.', en: 'Fame here rarely lasts. Whoever wants to keep it needs friends – and secrets.' }],
    atmospheres: [{ de: 'Blitzlichtgewitter, Champagner und leise Rivalitäten.', en: 'Flashbulbs, champagne and quiet rivalries.' }],
    rules: [
      { de: 'Alle Personen sind frei erfunden.', en: 'All persons are fictional.' },
      { de: 'Aufmerksamkeit ist die härteste Währung.', en: 'Attention is the hardest currency.' },
    ],
    roles: [
      { de: 'Schauspieler:in', en: 'Actor' },
      { de: 'Popstar', en: 'Pop star' },
      { de: 'Stylist:in', en: 'Stylist' },
      { de: 'Paparazzo', en: 'Paparazzo' },
    ],
    interests: [
      { de: 'Mode', en: 'fashion' },
      { de: 'Filmpremieren', en: 'film premieres' },
      { de: 'Charity-Galas', en: 'charity galas' },
      { de: 'Musikvideos', en: 'music videos' },
    ],
    firstNames: ['Sienna', 'Marlo', 'Cleo', 'Rafael', 'Joy', 'Noel', 'Bea'],
    lastNames: ['Sterling', 'Laurent', 'Vega', 'Monroe', 'Castell', 'Wilde'],
  },
  business: {
    artStyle: 'city',
    hue: [160, 190],
    namePrefix: [{ de: 'Silicon ', en: 'Silicon ' }, { de: 'Startup ', en: 'Startup ' }, { de: 'Venture ', en: 'Venture ' }],
    nameSuffix: [{ de: 'Bay', en: 'Bay' }, { de: 'Quarter', en: 'Quarter' }, { de: 'Harbor', en: 'Harbor' }],
    taglines: [
      { de: 'Jede Idee ist eine Milliarde wert – bis zur nächsten Finanzierungsrunde.', en: 'Every idea is worth a billion – until the next funding round.' },
      { de: 'Pitch, Pivot, Profit.', en: 'Pitch, pivot, profit.' },
    ],
    factions: [
      { de: 'die alten Konzerne', en: 'the old corporations' },
      { de: 'hungrige Start-ups', en: 'hungry start-ups' },
      { de: 'die Investorenszene', en: 'the investor scene' },
    ],
    places: [
      { de: 'ein Coworking-Space in einer alten Fabrik', en: 'a coworking space in an old factory' },
      { de: 'die Bühne der großen Tech-Konferenz', en: 'the stage of the big tech conference' },
    ],
    conflicts: [
      { de: 'eine feindliche Übernahme', en: 'a hostile takeover' },
      { de: 'ein Börsengang unter Zeitdruck', en: 'an IPO under time pressure' },
    ],
    lore: [{ de: 'Vor zehn Jahren war hier Brachland. Heute entscheidet sich hier, welche Apps die Welt benutzt.', en: 'Ten years ago this was wasteland. Today, it decides which apps the world uses.' }],
    atmospheres: [{ de: 'Hafermilch, Whiteboards und Nächte voller Folien.', en: 'Oat milk, whiteboards and nights full of slides.' }],
    rules: [
      { de: 'Alle Firmen und Personen sind frei erfunden.', en: 'All companies and persons are fictional.' },
      { de: 'Geld fließt dorthin, wo Vertrauen ist.', en: 'Money flows where trust is.' },
    ],
    roles: [
      { de: 'Gründer:in', en: 'Founder' },
      { de: 'Investor:in', en: 'Investor' },
      { de: 'Wirtschaftsreporter:in', en: 'Business reporter' },
      { de: 'Produktmanager:in', en: 'Product manager' },
    ],
    interests: [
      { de: 'Unternehmensbewertungen', en: 'valuations' },
      { de: 'künstliche Intelligenz', en: 'artificial intelligence' },
      { de: 'Nachhaltigkeit', en: 'sustainability' },
      { de: 'Marathonlaufen', en: 'marathon running' },
    ],
    firstNames: ['Ava', 'Niklas', 'Priya', 'Jonas', 'Mei', 'Oscar', 'Lea'],
    lastNames: ['Hartmann', 'Chen', 'Osei', 'Brandauer', 'Fischer', 'Ruiz'],
  },
  sports: {
    artStyle: 'stadium',
    hue: [100, 140],
    namePrefix: [{ de: 'Sportclub ', en: 'Sports Club ' }, { de: 'Liga ', en: 'League of ' }, { de: 'Arena ', en: 'Arena ' }],
    nameSuffix: [{ de: 'Nordstern', en: 'Northstar' }, { de: 'Rheinufer', en: 'Riverside' }, { de: 'Talblick', en: 'Valleyview' }],
    taglines: [
      { de: 'Ein Saison, ein Traum, tausend Meinungen.', en: 'One season, one dream, a thousand opinions.' },
      { de: 'Auf dem Platz zählt nur das Ergebnis – daneben alles andere.', en: 'On the pitch only the score counts – off it, everything else.' },
    ],
    factions: [
      { de: 'der Vorstand', en: 'the board' },
      { de: 'die Fankurve', en: 'the supporters\' end' },
      { de: 'das Trainerteam', en: 'the coaching staff' },
    ],
    places: [
      { de: 'das ausverkaufte Stadion', en: 'the sold-out stadium' },
      { de: 'die Kabine nach dem Abpfiff', en: 'the dressing room after the final whistle' },
    ],
    conflicts: [
      { de: 'ein Abstiegskampf', en: 'a relegation battle' },
      { de: 'ein Rekordtransfer', en: 'a record transfer' },
    ],
    lore: [{ de: 'Der Verein hat schon alles erlebt: Titel, Pleiten, Wunder. Die Fans sind geblieben.', en: 'The club has seen it all: titles, bankruptcies, miracles. The fans have stayed.' }],
    atmospheres: [{ de: 'Flutlicht, Gesänge und Bratwurstduft.', en: 'Floodlights, chants and the smell of sausages.' }],
    rules: [
      { de: 'Alle Personen sind frei erfunden.', en: 'All persons are fictional.' },
      { de: 'Fair Play wird belohnt.', en: 'Fair play is rewarded.' },
    ],
    roles: [
      { de: 'Kapitän:in', en: 'Captain' },
      { de: 'Trainer:in', en: 'Coach' },
      { de: 'Sportjournalist:in', en: 'Sports journalist' },
      { de: 'Nachwuchstalent', en: 'Young talent' },
    ],
    interests: [
      { de: 'Taktik', en: 'tactics' },
      { de: 'Fitness', en: 'fitness' },
      { de: 'Fankultur', en: 'fan culture' },
      { de: 'Statistiken', en: 'statistics' },
    ],
    firstNames: ['Mats', 'Elif', 'Joel', 'Sanna', 'Tim', 'Aylin', 'Ole'],
    lastNames: ['Becker', 'Yilmaz', 'Larsen', 'Petrović', 'Wagner', 'Moreno'],
  },
  entertainment: {
    artStyle: 'stage',
    hue: [265, 300],
    namePrefix: [{ de: 'Studio ', en: 'Studio ' }, { de: 'Sender ', en: 'Channel ' }, { de: 'Bühne ', en: 'Stage ' }],
    nameSuffix: [{ de: 'Prime', en: 'Prime' }, { de: 'Nachtlicht', en: 'Nightlight' }, { de: 'Funkhaus', en: 'Broadcast House' }],
    taglines: [
      { de: 'Die Show muss weitergehen – egal was hinter den Kulissen passiert.', en: 'The show must go on – no matter what happens backstage.' },
      { de: 'Quoten, Pointen und Pannen live.', en: 'Ratings, punchlines and live mishaps.' },
    ],
    factions: [
      { de: 'die Senderleitung', en: 'network management' },
      { de: 'die Autor:innen', en: 'the writers\' room' },
      { de: 'die Streaming-Konkurrenz', en: 'the streaming competition' },
    ],
    places: [
      { de: 'das Studio mit Livepublikum', en: 'the studio with a live audience' },
      { de: 'der enge Flur hinter der Bühne', en: 'the narrow corridor backstage' },
    ],
    conflicts: [
      { de: 'ein Quotenduell', en: 'a ratings duel' },
      { de: 'ein Gast, der alles aus dem Ruder laufen lässt', en: 'a guest who derails everything' },
    ],
    lore: [{ de: 'Seit Jahrzehnten läuft hier die beliebteste Show des Landes. Ob das so bleibt, entscheidet sich jeden Abend neu.', en: 'For decades, the country\'s most popular show has been made here. Whether it stays that way is decided anew every night.' }],
    atmospheres: [{ de: 'Scheinwerfer, Applausschilder und Lampenfieber.', en: 'Spotlights, applause signs and stage fright.' }],
    rules: [
      { de: 'Alle Personen sind frei erfunden.', en: 'All persons are fictional.' },
      { de: 'Live ist live – Fehler bleiben sichtbar.', en: 'Live is live – mistakes stay visible.' },
    ],
    roles: [
      { de: 'Moderator:in', en: 'Host' },
      { de: 'Comedian', en: 'Comedian' },
      { de: 'Showrunner:in', en: 'Showrunner' },
      { de: 'Bandleader:in', en: 'Bandleader' },
    ],
    interests: [
      { de: 'Improvisation', en: 'improv' },
      { de: 'Quoten', en: 'ratings' },
      { de: 'Satire', en: 'satire' },
      { de: 'Live-Musik', en: 'live music' },
    ],
    firstNames: ['Gil', 'Rosa', 'Benno', 'Tara', 'Milan', 'Edie', 'Sami'],
    lastNames: ['Kowalski', 'Bauer', 'Ferrante', 'Oduya', 'Lang', 'Holm'],
  },
  'alt-history': {
    artStyle: 'capital',
    hue: [30, 55],
    namePrefix: [{ de: 'Was wäre, wenn: ', en: 'What if: ' }, { de: 'Parallelwelt ', en: 'Parallel World ' }, { de: 'Zeitlinie ', en: 'Timeline ' }],
    nameSuffix: [{ de: 'Dampfnetz', en: 'Steam Net' }, { de: 'Luftschiffära', en: 'Airship Era' }, { de: 'Analogrepublik', en: 'Analog Republic' }],
    taglines: [
      { de: 'Eine Entscheidung in der Vergangenheit – und alles kam anders.', en: 'One decision in the past – and everything turned out differently.' },
      { de: 'Die Geschichte, wie sie nie geschah.', en: 'History as it never happened.' },
    ],
    factions: [
      { de: 'die Bewahrer der alten Ordnung', en: 'the keepers of the old order' },
      { de: 'eine Erfinder:innen-Gilde', en: 'an inventors\' guild' },
      { de: 'eine geheime Gesellschaft', en: 'a secret society' },
    ],
    places: [
      { de: 'ein Luftschiffhafen über der Stadt', en: 'an airship port above the city' },
      { de: 'ein Archiv voller verbotener Pläne', en: 'an archive full of forbidden plans' },
    ],
    conflicts: [
      { de: 'eine Erfindung, die alles umkehren könnte', en: 'an invention that could reverse everything' },
      { de: 'ein Streit um die offizielle Geschichtsschreibung', en: 'a dispute over the official historical record' },
    ],
    lore: [{ de: 'An einem einzigen Tag nahm die Geschichte eine andere Abzweigung. Niemand hier weiß, wie die Welt sonst aussähe.', en: 'On a single day, history took a different turn. Nobody here knows what the world would otherwise look like.' }],
    atmospheres: [{ de: 'Messing, Propellerbrummen und vergilbte Zeitungen.', en: 'Brass, humming propellers and yellowed newspapers.' }],
    rules: [
      { de: 'Dies ist ein fiktives Szenario, keine echte Geschichte.', en: 'This is a fictional scenario, not real history.' },
      { de: 'Technik entwickelte sich anders als bei uns.', en: 'Technology developed differently than in our world.' },
    ],
    roles: [
      { de: 'Erfinder:in', en: 'Inventor' },
      { de: 'Archivar:in', en: 'Archivist' },
      { de: 'Luftschiffkapitän:in', en: 'Airship captain' },
      { de: 'Zeitungsverleger:in', en: 'Newspaper publisher' },
    ],
    interests: [
      { de: 'Mechanik', en: 'mechanics' },
      { de: 'Geheimgeschichte', en: 'secret history' },
      { de: 'Telegrafie', en: 'telegraphy' },
      { de: 'Kartografie', en: 'cartography' },
    ],
    firstNames: ['Adelheid', 'Viktor', 'Mathilde', 'Ludwig', 'Frieda', 'Emil'],
    lastNames: ['von Arnim', 'Brückner', 'Steinhauer', 'Lorenz', 'Kessler'],
  },
} satisfies Record<string, GenrePool>;
