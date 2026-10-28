import type { ArtStyle, Genre } from '../../../shared/constants';
import type { L } from './seedWorlds';
import { GENRE_POOLS_V2 } from './worldgenPools2';

export interface GenrePool {
  artStyle: ArtStyle;
  hue: [number, number];
  namePrefix: L[];
  nameSuffix: L[];
  taglines: L[];
  factions: L[];
  places: L[];
  conflicts: L[];
  lore: L[];
  atmospheres: L[];
  rules: L[];
  roles: L[];
  interests: L[];
  firstNames: string[];
  lastNames: string[];
}

export const GENRE_POOLS: Record<Genre, GenrePool> = {
  ...GENRE_POOLS_V2,
  cyberpunk: {
    artStyle: 'city',
    hue: [290, 335],
    namePrefix: [{ de: 'Chrom', en: 'Chrome' }, { de: 'Neon', en: 'Neon' }, { de: 'Vektor', en: 'Vector' }, { de: 'Pixel', en: 'Pixel' }],
    nameSuffix: [{ de: 'stadt', en: ' City' }, { de: 'hafen', en: ' Harbor' }, { de: 'sektor', en: ' Sector' }, { de: 'bezirk', en: ' District' }],
    taglines: [
      { de: 'Wo Daten mehr wert sind als Leben.', en: 'Where data is worth more than life.' },
      { de: 'Eine Stadt, die niemals schläft – und niemals vergisst.', en: 'A city that never sleeps – and never forgets.' },
      { de: 'Zwischen Werbedrohnen und Untergrundnetzen.', en: 'Between ad drones and underground networks.' },
    ],
    factions: [
      { de: 'ein allmächtiger Konzern', en: 'an all-powerful corporation' },
      { de: 'ein Hackerkollektiv', en: 'a hacker collective' },
      { de: 'die Straßengangs', en: 'the street gangs' },
      { de: 'eine korrupte Stadtpolizei', en: 'a corrupt city police' },
    ],
    places: [
      { de: 'ein Drohnenmarkt unter der Hochbahn', en: 'a drone market beneath the elevated railway' },
      { de: 'ein Turm aus Glas und Spiegeln', en: 'a tower of glass and mirrors' },
      { de: 'das überflutete Unterdeck', en: 'the flooded underdeck' },
    ],
    conflicts: [
      { de: 'ein Datenleck, das alles verändern könnte', en: 'a data leak that could change everything' },
      { de: 'ein Kampf um die Stromversorgung', en: 'a fight over the power supply' },
      { de: 'eine künstliche Intelligenz, die aufwacht', en: 'an artificial intelligence that is waking up' },
    ],
    lore: [
      { de: 'Seit dem großen Netzausfall regieren Konzerne die Stadt. Wer nicht verbunden ist, existiert nicht.', en: 'Since the great network outage, corporations rule the city. If you\'re not connected, you don\'t exist.' },
      { de: 'Die Stadt wurde auf den Trümmern einer alten Metropole gebaut. In den Kellern laufen noch Server aus vergessenen Zeiten.', en: 'The city was built on the ruins of an old metropolis. Servers from forgotten times still run in its basements.' },
    ],
    atmospheres: [
      { de: 'Regen, Neon, Synthwave und Nudeldampf.', en: 'Rain, neon, synthwave and noodle steam.' },
      { de: 'Kaltes Licht, heiße Gerüchte, endlose Nächte.', en: 'Cold light, hot rumours, endless nights.' },
    ],
    rules: [
      { de: 'Information ist Währung.', en: 'Information is currency.' },
      { de: 'Implantate sind verbreitet, aber teuer.', en: 'Implants are common but expensive.' },
      { de: 'Konzerne stehen über dem Gesetz.', en: 'Corporations stand above the law.' },
      { de: 'Jeder Schritt wird von Kameras erfasst.', en: 'Every step is recorded by cameras.' },
    ],
    roles: [
      { de: 'Netzläufer:in', en: 'Netrunner' },
      { de: 'Konzernsprecher:in', en: 'Corporate spokesperson' },
      { de: 'Straßenärzt:in', en: 'Street doctor' },
      { de: 'Kurier:in', en: 'Courier' },
      { de: 'Barbesitzer:in', en: 'Bar owner' },
    ],
    interests: [
      { de: 'alte Hardware', en: 'vintage hardware' },
      { de: 'Untergrundmusik', en: 'underground music' },
      { de: 'Verschlüsselung', en: 'encryption' },
      { de: 'Straßenessen', en: 'street food' },
    ],
    firstNames: ['Rin', 'Dex', 'Nova', 'Juno', 'Kai', 'Zara', 'Ivo', 'Lux'],
    lastNames: ['Okoro', 'Vance', 'Tanaka', 'Moreau', 'Silva', 'Kade', 'Ritter'],
  },
  scifi: {
    artStyle: 'cosmic',
    hue: [195, 245],
    namePrefix: [{ de: 'Orion', en: 'Orion' }, { de: 'Kepler', en: 'Kepler' }, { de: 'Vega', en: 'Vega' }, { de: 'Helios', en: 'Helios' }],
    nameSuffix: [{ de: '-Station', en: ' Station' }, { de: '-Kolonie', en: ' Colony' }, { de: '-Außenposten', en: ' Outpost' }, { de: '-Arche', en: ' Ark' }],
    taglines: [
      { de: 'Lichtjahre von zu Hause – und mitten im Unbekannten.', en: 'Light-years from home – and right in the unknown.' },
      { de: 'Eine Crew, ein Schiff, ein Geheimnis.', en: 'One crew, one ship, one secret.' },
      { de: 'Wo die Sterne näher sind als die Nachbarn.', en: 'Where the stars are closer than the neighbours.' },
    ],
    factions: [
      { de: 'die Stationsleitung', en: 'station command' },
      { de: 'das Forschungsteam', en: 'the research team' },
      { de: 'die Bergbaugewerkschaft', en: 'the miners\' union' },
      { de: 'eine geheimnisvolle Sekte', en: 'a mysterious cult' },
    ],
    places: [
      { de: 'die Beobachtungskuppel', en: 'the observation dome' },
      { de: 'ein versiegelter Frachtraum', en: 'a sealed cargo hold' },
      { de: 'die Hydroponik-Gärten', en: 'the hydroponic gardens' },
    ],
    conflicts: [
      { de: 'ein Signal aus dem All', en: 'a signal from space' },
      { de: 'knapper werdende Vorräte', en: 'dwindling supplies' },
      { de: 'ein Fund, der nicht menschlich ist', en: 'a find that is not human' },
    ],
    lore: [
      { de: 'Die Station wurde vor Jahrzehnten gebaut und ist längst älter als geplant. Manche Module sind seit Jahren versiegelt.', en: 'The station was built decades ago and has long outlived its design. Some modules have been sealed for years.' },
      { de: 'Die Kolonie war als Zwischenstopp gedacht – doch das Schiff, das sie weiterbringen sollte, kam nie.', en: 'The colony was meant as a stopover – but the ship meant to carry them on never came.' },
    ],
    atmospheres: [
      { de: 'Summende Lüftung, kaltes Licht, endlose Sterne.', en: 'Humming vents, cold light, endless stars.' },
      { de: 'Stille, Staunen und ein Hauch von Angst.', en: 'Silence, wonder and a hint of fear.' },
    ],
    rules: [
      { de: 'Ressourcen werden rationiert.', en: 'Resources are rationed.' },
      { de: 'Kommunikation zur Heimat dauert Tage.', en: 'Communication home takes days.' },
      { de: 'Sicherheit vor Neugier.', en: 'Safety before curiosity.' },
      { de: 'Niemand verlässt die Station allein.', en: 'Nobody leaves the station alone.' },
    ],
    roles: [
      { de: 'Kommandant:in', en: 'Commander' },
      { de: 'Astrobiolog:in', en: 'Astrobiologist' },
      { de: 'Pilot:in', en: 'Pilot' },
      { de: 'Ingenieur:in', en: 'Engineer' },
      { de: 'Bordärzt:in', en: 'Ship\'s doctor' },
    ],
    interests: [
      { de: 'Sternkarten', en: 'star charts' },
      { de: 'Schwerelosigkeit', en: 'zero gravity' },
      { de: 'Funkfrequenzen', en: 'radio frequencies' },
      { de: 'Weltraumgemüse', en: 'space vegetables' },
    ],
    firstNames: ['Ada', 'Mika', 'Soren', 'Leila', 'Tomas', 'Yuki', 'Emre', 'Noor'],
    lastNames: ['Chen', 'Okafor', 'Lindgren', 'Ramos', 'Ivanova', 'Weber', 'Achebe'],
  },
  fantasy: {
    artStyle: 'forest',
    hue: [100, 160],
    namePrefix: [{ de: 'Moos', en: 'Moss' }, { de: 'Sternen', en: 'Star' }, { de: 'Eichen', en: 'Oak' }, { de: 'Nebel', en: 'Mist' }],
    nameSuffix: [{ de: 'tal', en: 'vale' }, { de: 'hain', en: 'grove' }, { de: 'furt', en: 'ford' }, { de: 'heim', en: 'hollow' }],
    taglines: [
      { de: 'Wo alte Magie in jedem Blatt wohnt.', en: 'Where old magic lives in every leaf.' },
      { de: 'Ein Dorf, ein Wald und eine Legende.', en: 'A village, a forest and a legend.' },
      { de: 'Zwischen Feenringen und Händlerkarren.', en: 'Between fairy rings and merchant carts.' },
    ],
    factions: [
      { de: 'der Druidenzirkel', en: 'the druid circle' },
      { de: 'die Händlergilde', en: 'the merchant guild' },
      { de: 'das Waldvolk', en: 'the forest folk' },
      { de: 'ein ehrgeiziger Fürst', en: 'an ambitious lord' },
    ],
    places: [
      { de: 'ein uralter Steinkreis', en: 'an ancient stone circle' },
      { de: 'die Schenke am Fluss', en: 'the tavern by the river' },
      { de: 'ein verwunschener See', en: 'an enchanted lake' },
    ],
    conflicts: [
      { de: 'ein Streit um heilige Bäume', en: 'a quarrel over sacred trees' },
      { de: 'ein erwachender Drache', en: 'an awakening dragon' },
      { de: 'ein gebrochenes Versprechen', en: 'a broken promise' },
    ],
    lore: [
      { de: 'Vor Jahrhunderten schlossen Menschen und Waldgeister einen Pakt. Niemand weiß mehr genau, was darin steht.', en: 'Centuries ago, people and forest spirits made a pact. Nobody remembers exactly what it says.' },
      { de: 'Der Legende nach schläft unter dem Dorf ein Wesen, das bei Vollmond träumt.', en: 'Legend says a being sleeps beneath the village and dreams at full moon.' },
    ],
    atmospheres: [
      { de: 'Moos, Glühwürmchen und Lautenmusik.', en: 'Moss, fireflies and lute music.' },
      { de: 'Warm, verwunschen, ein bisschen gefährlich.', en: 'Warm, enchanted, a little dangerous.' },
    ],
    rules: [
      { de: 'Magie folgt den Jahreszeiten.', en: 'Magic follows the seasons.' },
      { de: 'Versprechen sind bindend.', en: 'Promises are binding.' },
      { de: 'Geister helfen nur Respektvollen.', en: 'Spirits help only the respectful.' },
      { de: 'Eisen schwächt Feenzauber.', en: 'Iron weakens fairy magic.' },
    ],
    roles: [
      { de: 'Kräuterkundige', en: 'Herbalist' },
      { de: 'Barde', en: 'Bard' },
      { de: 'Schmiedin', en: 'Blacksmith' },
      { de: 'Waldläufer', en: 'Ranger' },
      { de: 'Dorfälteste', en: 'Village elder' },
    ],
    interests: [
      { de: 'Kräutertränke', en: 'herbal potions' },
      { de: 'alte Lieder', en: 'old songs' },
      { de: 'Sternbilder', en: 'constellations' },
      { de: 'Holzschnitzerei', en: 'woodcarving' },
    ],
    firstNames: ['Eira', 'Bram', 'Lirien', 'Corin', 'Maeve', 'Tobin', 'Isolde', 'Fenwick'],
    lastNames: ['Ashford', 'Mossvale', 'Thornbury', 'Greenleaf', 'Harrow', 'Brightwater'],
  },
  academy: {
    artStyle: 'ocean',
    hue: [170, 205],
    namePrefix: [{ de: 'Silber', en: 'Silver' }, { de: 'Mond', en: 'Moon' }, { de: 'Sturm', en: 'Storm' }, { de: 'Kristall', en: 'Crystal' }],
    nameSuffix: [{ de: 'akademie', en: ' Academy' }, { de: 'kolleg', en: ' College' }, { de: 'schule', en: ' School' }, { de: 'institut', en: ' Institute' }],
    taglines: [
      { de: 'Lernen, wetteifern, Geheimnisse lüften.', en: 'Learn, compete, uncover secrets.' },
      { de: 'Eine Schule, in der jede Prüfung ein Abenteuer ist.', en: 'A school where every exam is an adventure.' },
      { de: 'Freundschaften fürs Leben – und Rivalitäten auch.', en: 'Friendships for life – and rivalries too.' },
    ],
    factions: [
      { de: 'die Häuser der Akademie', en: 'the academy houses' },
      { de: 'der Lehrkörper', en: 'the faculty' },
      { de: 'ein geheimer Studentenbund', en: 'a secret student society' },
      { de: 'der Schulrat', en: 'the board of governors' },
    ],
    places: [
      { de: 'die verbotene Bibliothek', en: 'the forbidden library' },
      { de: 'der alte Leuchtturm', en: 'the old lighthouse' },
      { de: 'der Übungsplatz am Meer', en: 'the training ground by the sea' },
    ],
    conflicts: [
      { de: 'ein großer Wettbewerb', en: 'a great competition' },
      { de: 'ein verschwundenes Lehrbuch', en: 'a missing textbook' },
      { de: 'ein Fluch über dem Westflügel', en: 'a curse over the west wing' },
    ],
    lore: [
      { de: 'Die Akademie wurde von einer Magierin gegründet, deren Porträt angeblich nachts die Augen bewegt.', en: 'The academy was founded by a mage whose portrait is said to move its eyes at night.' },
      { de: 'Jedes Jahr verschwindet ein Raum aus dem Lageplan – und taucht erst Monate später wieder auf.', en: 'Every year a room vanishes from the floor plan – and reappears only months later.' },
    ],
    atmospheres: [
      { de: 'Kreidestaub, Möwen und nächtliche Lernrunden.', en: 'Chalk dust, seagulls and late-night study sessions.' },
      { de: 'Ehrgeiz, Freundschaft und ein bisschen Magie.', en: 'Ambition, friendship and a bit of magic.' },
    ],
    rules: [
      { de: 'Die Häuser konkurrieren um einen Pokal.', en: 'The houses compete for a cup.' },
      { de: 'Magie außerhalb des Unterrichts ist verboten.', en: 'Magic outside class is forbidden.' },
      { de: 'Die Bibliothek schließt bei Sonnenuntergang.', en: 'The library closes at sunset.' },
      { de: 'Wer dreimal zu spät kommt, putzt die Eulerei.', en: 'Three times late and you clean the owlery.' },
    ],
    roles: [
      { de: 'Studentin', en: 'Student' },
      { de: 'Student', en: 'Student' },
      { de: 'Professorin', en: 'Professor' },
      { de: 'Bibliothekar', en: 'Librarian' },
      { de: 'Hausmeisterin', en: 'Caretaker' },
    ],
    interests: [
      { de: 'Zaubertränke', en: 'potions' },
      { de: 'Sportwettkämpfe', en: 'sports tournaments' },
      { de: 'alte Bücher', en: 'old books' },
      { de: 'Streiche', en: 'pranks' },
    ],
    firstNames: ['Alba', 'Felix', 'Ines', 'Jasper', 'Luna', 'Milo', 'Rosa', 'Theo'],
    lastNames: ['Blackwood', 'Marlow', 'Quinn', 'Sterling', 'Wilde', 'Hart'],
  },
  steampunk: {
    artStyle: 'gears',
    hue: [20, 48],
    namePrefix: [{ de: 'Kupfer', en: 'Copper' }, { de: 'Messing', en: 'Brass' }, { de: 'Dampf', en: 'Steam' }, { de: 'Zahnrad', en: 'Cog' }],
    nameSuffix: [{ de: 'burg', en: 'bury' }, { de: 'hafen', en: 'haven' }, { de: 'werk', en: 'works' }, { de: 'stadt', en: 'town' }],
    taglines: [
      { de: 'Wo jede Idee dampft – und manche explodieren.', en: 'Where every idea steams – and some explode.' },
      { de: 'Zahnräder, Luftschiffe und große Pläne.', en: 'Cogs, airships and grand plans.' },
      { de: 'Eine Stadt im Takt der großen Uhr.', en: 'A city ticking to the great clock.' },
    ],
    factions: [
      { de: 'die Uhrmachergilde', en: 'the clockmakers\' guild' },
      { de: 'eine Dampfkompanie', en: 'a steam company' },
      { de: 'die Luftschiffer', en: 'the airship crews' },
      { de: 'der Stadtrat', en: 'the city council' },
    ],
    places: [
      { de: 'der große Uhrturm', en: 'the great clock tower' },
      { de: 'ein Hangar am Kanal', en: 'a hangar by the canal' },
      { de: 'die Erfindermesse', en: 'the inventors\' fair' },
    ],
    conflicts: [
      { de: 'ein Luftschiffrennen', en: 'an airship race' },
      { de: 'ein gestohlener Bauplan', en: 'a stolen blueprint' },
      { de: 'eine Maschine, die zu viel kann', en: 'a machine that can do too much' },
    ],
    lore: [
      { de: 'Die Stadt entstand um eine Uhr, die nie stehen bleiben darf. Was passiert, wenn doch, weiß niemand.', en: 'The city grew around a clock that must never stop. Nobody knows what happens if it does.' },
      { de: 'Vor fünfzig Jahren erfand jemand den ewigen Kessel – und verschwand am nächsten Tag.', en: 'Fifty years ago someone invented the eternal boiler – and vanished the next day.' },
    ],
    atmospheres: [
      { de: 'Ruß, Öl, Messingglanz und zischende Ventile.', en: 'Soot, oil, gleaming brass and hissing valves.' },
      { de: 'Tüftelei, Teestuben und Fabriksirenen.', en: 'Tinkering, tea rooms and factory sirens.' },
    ],
    rules: [
      { de: 'Jede Erfindung hat Nebenwirkungen.', en: 'Every invention has side effects.' },
      { de: 'Gilden regeln das Handwerk.', en: 'Guilds govern the crafts.' },
      { de: 'Die Zeitung erfährt alles zuerst.', en: 'The newspaper learns everything first.' },
      { de: 'Kohle ist knapp, Ideen nicht.', en: 'Coal is scarce, ideas are not.' },
    ],
    roles: [
      { de: 'Erfinderin', en: 'Inventor' },
      { de: 'Luftschiffkapitän', en: 'Airship captain' },
      { de: 'Fabrikbesitzerin', en: 'Factory owner' },
      { de: 'Reporter', en: 'Reporter' },
      { de: 'Mechanikerin', en: 'Mechanic' },
    ],
    interests: [
      { de: 'Dampfmaschinen', en: 'steam engines' },
      { de: 'Teekultur', en: 'tea culture' },
      { de: 'Taschenuhren', en: 'pocket watches' },
      { de: 'Wetterballons', en: 'weather balloons' },
    ],
    firstNames: ['Ottilie', 'Barnaby', 'Clara', 'Edwin', 'Hazel', 'Silas', 'Matilda', 'August'],
    lastNames: ['Cogsworth', 'Fairweather', 'Penhallow', 'Brightspark', 'Ironside'],
  },
  postapocalyptic: {
    artStyle: 'dunes',
    hue: [15, 40],
    namePrefix: [{ de: 'Rost', en: 'Rust' }, { de: 'Staub', en: 'Dust' }, { de: 'Asche', en: 'Ash' }, { de: 'Glas', en: 'Glass' }],
    nameSuffix: [{ de: 'land', en: 'lands' }, { de: 'feste', en: ' Hold' }, { de: 'oase', en: ' Oasis' }, { de: 'senke', en: ' Basin' }],
    taglines: [
      { de: 'Nach dem Ende kommt der Neuanfang.', en: 'After the end comes a new beginning.' },
      { de: 'Wasser ist Gold, Vertrauen ist selten.', en: 'Water is gold, trust is rare.' },
      { de: 'Eine Siedlung am Rand der Wüste.', en: 'A settlement at the edge of the desert.' },
    ],
    factions: [
      { de: 'die Siedler', en: 'the settlers' },
      { de: 'eine Karawane der Wasserhändler', en: 'a caravan of water traders' },
      { de: 'die Plünderer', en: 'the raiders' },
      { de: 'ein Orden von Bewahrern', en: 'an order of keepers' },
    ],
    places: [
      { de: 'ein umgebauter Supermarkt', en: 'a converted supermarket' },
      { de: 'der letzte Brunnen', en: 'the last well' },
      { de: 'ein Flugzeugfriedhof', en: 'an aircraft graveyard' },
    ],
    conflicts: [
      { de: 'ein Streit um Wasser', en: 'a fight over water' },
      { de: 'ein Funkspruch aus der alten Welt', en: 'a radio message from the old world' },
      { de: 'ein heraufziehender Sandsturm', en: 'an approaching sandstorm' },
    ],
    lore: [
      { de: 'Niemand spricht gern über den Tag, an dem der Himmel brannte. Aber alle tragen ein Stück davon mit sich.', en: 'Nobody likes to talk about the day the sky burned. But everyone carries a piece of it.' },
      { de: 'Die Siedlung wurde in den Ruinen eines Flughafens gegründet. Manchmal blinken noch Lichter auf der alten Landebahn.', en: 'The settlement was founded in the ruins of an airport. Sometimes lights still blink on the old runway.' },
    ],
    atmospheres: [
      { de: 'Hitze, Staub und Lagerfeuergeschichten.', en: 'Heat, dust and campfire stories.' },
      { de: 'Rauh, hoffnungsvoll, zusammengeflickt.', en: 'Rough, hopeful, patched together.' },
    ],
    rules: [
      { de: 'Wasser wird geteilt.', en: 'Water is shared.' },
      { de: 'Fremde müssen sich beweisen.', en: 'Strangers must prove themselves.' },
      { de: 'Alte Technik ist wertvoll und gefährlich.', en: 'Old tech is valuable and dangerous.' },
    ],
    roles: [
      { de: 'Späherin', en: 'Scout' },
      { de: 'Mechaniker', en: 'Mechanic' },
      { de: 'Händlerin', en: 'Trader' },
      { de: 'Heiler', en: 'Healer' },
      { de: 'Anführerin', en: 'Leader' },
    ],
    interests: [
      { de: 'Schrottbasteleien', en: 'scrap crafting' },
      { de: 'alte Schallplatten', en: 'old records' },
      { de: 'Wüstenpflanzen', en: 'desert plants' },
    ],
    firstNames: ['Rook', 'Sable', 'Ezra', 'Wren', 'Juno', 'Cass', 'Tarek', 'Mara'],
    lastNames: ['Dune', 'Holloway', 'Reyes', 'Stone', 'Vega', 'Marsh'],
  },
  'slice-of-life': {
    artStyle: 'city',
    hue: [10, 60],
    namePrefix: [{ de: 'Linden', en: 'Linden' }, { de: 'Sonnen', en: 'Sunny' }, { de: 'Kirsch', en: 'Cherry' }, { de: 'Hafen', en: 'Harbour' }],
    nameSuffix: [{ de: 'viertel', en: ' Quarter' }, { de: 'straße', en: ' Street' }, { de: 'platz', en: ' Square' }, { de: 'hof', en: ' Court' }],
    taglines: [
      { de: 'Kleine Geschichten aus der Nachbarschaft.', en: 'Little stories from the neighbourhood.' },
      { de: 'Wo jeder jeden kennt – fast.', en: 'Where everybody knows everybody – almost.' },
      { de: 'Kaffee, Klatsch und kleine Abenteuer.', en: 'Coffee, gossip and little adventures.' },
    ],
    factions: [
      { de: 'die Nachbarschaftsinitiative', en: 'the neighbourhood association' },
      { de: 'die Ladenbesitzer', en: 'the shop owners' },
      { de: 'ein neuer Investor', en: 'a new investor' },
      { de: 'der Sportverein', en: 'the sports club' },
    ],
    places: [
      { de: 'ein Café an der Ecke', en: 'a corner café' },
      { de: 'der Gemeinschaftsgarten', en: 'the community garden' },
      { de: 'der Wochenmarkt', en: 'the weekly market' },
    ],
    conflicts: [
      { de: 'ein geplantes Bauprojekt', en: 'a planned construction project' },
      { de: 'das große Straßenfest', en: 'the big street festival' },
      { de: 'ein verschwundener Kater', en: 'a missing cat' },
    ],
    lore: [
      { de: 'Das Viertel war früher ein Fischerdorf. Die älteste Bewohnerin erinnert sich noch an die Boote.', en: 'The quarter used to be a fishing village. The oldest resident still remembers the boats.' },
      { de: 'Seit Jahrzehnten trifft man sich samstags auf dem Markt. Wer fehlt, wird vermisst.', en: 'For decades people have met at the market on Saturdays. Whoever is missing is missed.' },
    ],
    atmospheres: [
      { de: 'Kaffeeduft, Fahrradklingeln und Nachbarschaftsklatsch.', en: 'Coffee smell, bicycle bells and neighbourhood gossip.' },
      { de: 'Gemütlich, lebendig, manchmal chaotisch.', en: 'Cosy, lively, sometimes chaotic.' },
    ],
    rules: [
      { de: 'Hilfsbereitschaft wird erwidert.', en: 'Helpfulness is returned.' },
      { de: 'Neuigkeiten verbreiten sich schnell.', en: 'News travels fast.' },
      { de: 'Der Markt ist heilig.', en: 'The market is sacred.' },
    ],
    roles: [
      { de: 'Barista', en: 'Barista' },
      { de: 'Buchhändler', en: 'Bookseller' },
      { de: 'Studentin', en: 'Student' },
      { de: 'Rentner', en: 'Retiree' },
      { de: 'Gärtnerin', en: 'Gardener' },
    ],
    interests: [
      { de: 'Kaffee', en: 'coffee' },
      { de: 'Brettspiele', en: 'board games' },
      { de: 'Gärtnern', en: 'gardening' },
      { de: 'Lokalgeschichte', en: 'local history' },
    ],
    firstNames: ['Lena', 'Ben', 'Aylin', 'Paul', 'Mia', 'Jonas', 'Hanna', 'Emil'],
    lastNames: ['Becker', 'Yilmaz', 'Hoffmann', 'Schulz', 'Novak', 'Krüger'],
  },
  mystery: {
    artStyle: 'ocean',
    hue: [230, 270],
    namePrefix: [{ de: 'Raben', en: 'Raven' }, { de: 'Schatten', en: 'Shadow' }, { de: 'Nebel', en: 'Fog' }, { de: 'Grau', en: 'Grey' }],
    nameSuffix: [{ de: 'moor', en: 'moor' }, { de: 'klippe', en: ' Cliff' }, { de: 'hall', en: ' Hall' }, { de: 'bucht', en: ' Cove' }],
    taglines: [
      { de: 'Jeder hat ein Geheimnis. Manche mehrere.', en: 'Everyone has a secret. Some have several.' },
      { de: 'Ein Ort, an dem der Nebel Fragen stellt.', en: 'A place where the fog asks questions.' },
      { de: 'Nichts ist, wie es scheint.', en: 'Nothing is as it seems.' },
    ],
    factions: [
      { de: 'eine alte Familie', en: 'an old family' },
      { de: 'die Dorfpolizei', en: 'the village police' },
      { de: 'ein Kreis von Okkultisten', en: 'a circle of occultists' },
      { de: 'die Presse', en: 'the press' },
    ],
    places: [
      { de: 'ein verlassenes Herrenhaus', en: 'an abandoned manor' },
      { de: 'der Leuchtturm auf der Klippe', en: 'the lighthouse on the cliff' },
      { de: 'das Archiv im Rathauskeller', en: 'the archive in the town hall basement' },
    ],
    conflicts: [
      { de: 'ein ungelöster Fall', en: 'an unsolved case' },
      { de: 'ein verschwundenes Testament', en: 'a missing will' },
      { de: 'nächtliche Lichter im Moor', en: 'lights in the moor at night' },
    ],
    lore: [
      { de: 'Vor hundert Jahren verschwand ein ganzes Fest spurlos. Jedes Jahr am selben Tag läuten die Glocken von selbst.', en: 'A hundred years ago an entire festival vanished without a trace. Every year on the same day the bells ring by themselves.' },
      { de: 'Die Familie, der das halbe Dorf gehört, hütet ein Tagebuch, das niemand lesen darf.', en: 'The family that owns half the village guards a diary no one may read.' },
    ],
    atmospheres: [
      { de: 'Nebel, knarrende Dielen und flackernde Lampen.', en: 'Fog, creaking floorboards and flickering lamps.' },
      { de: 'Still, misstrauisch, faszinierend.', en: 'Quiet, suspicious, fascinating.' },
    ],
    rules: [
      { de: 'Niemand sagt die ganze Wahrheit.', en: 'Nobody tells the whole truth.' },
      { de: 'Hinweise verbergen sich im Alltag.', en: 'Clues hide in everyday life.' },
      { de: 'Nach Mitternacht geht man nicht ins Moor.', en: 'Nobody goes into the moor after midnight.' },
    ],
    roles: [
      { de: 'Detektivin', en: 'Detective' },
      { de: 'Archivar', en: 'Archivist' },
      { de: 'Pfarrerin', en: 'Vicar' },
      { de: 'Erbe', en: 'Heir' },
      { de: 'Wirtin', en: 'Innkeeper' },
    ],
    interests: [
      { de: 'Rätsel', en: 'puzzles' },
      { de: 'alte Briefe', en: 'old letters' },
      { de: 'Tee und Kriminalromane', en: 'tea and crime novels' },
    ],
    firstNames: ['Agatha', 'Edmund', 'Iris', 'Lionel', 'Vera', 'Rupert', 'Celia', 'Arthur'],
    lastNames: ['Grimsby', 'Ravenscroft', 'Holloway', 'Pembroke', 'Ashdown'],
  },
};

export const GENERIC_PERSONALITY: L[] = [
  { de: 'neugierig', en: 'curious' },
  { de: 'mutig', en: 'brave' },
  { de: 'vorsichtig', en: 'cautious' },
  { de: 'humorvoll', en: 'humorous' },
  { de: 'ehrgeizig', en: 'ambitious' },
  { de: 'loyal', en: 'loyal' },
  { de: 'verschlossen', en: 'reserved' },
  { de: 'hilfsbereit', en: 'helpful' },
  { de: 'stur', en: 'stubborn' },
  { de: 'verträumt', en: 'dreamy' },
];

export const WORLDGEN_TEXT = {
  description: {
    de: '{name} ist ein Ort, an dem {faction1} und {faction2} um die Zukunft ringen. Im Mittelpunkt steht {place} – und {conflict}.',
    en: '{name} is a place where {faction1} and {faction2} struggle over the future. At its heart lies {place} – and {conflict}.',
  },
  inspired: { de: 'Inspiriert von: {prompt}', en: 'Inspired by: {prompt}' },
  characterTagline: {
    de: '{role} in {world}. Liebt {interest}.',
    en: '{role} in {world}. Loves {interest}.',
  },
  characterDescription: {
    de: '{name} ist {trait1} und {trait2}. Rolle: {role}. Kaum jemand kennt {world} so gut.',
    en: '{name} is {trait1} and {trait2}. Role: {role}. Few people know {world} this well.',
  },
  characterBackground: {
    de: '{name} kam vor einigen Jahren nach {world}. Seitdem beobachtet {name} genau, wie {faction1} und {faction2} um Einfluss ringen.',
    en: '{name} came to {world} a few years ago. Ever since, {name} has been watching closely as {faction1} and {faction2} struggle for influence.',
  },
} satisfies Record<string, L>;
