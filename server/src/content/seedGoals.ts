import type { L } from './seedWorlds';

/** Ziele und Bekanntheit der Figuren aus Version 1 (werden bei bestehenden Datenbanken nachgetragen). */
export const V1_CHARACTER_GOALS: Record<string, L[]> = {
  'c-mira': [
    { de: 'Das Halcyon-Wasserprojekt aufdecken', en: 'Expose the Halcyon water project' },
    { de: 'Das Unterdeck schützen', en: 'Protect the Underdeck' },
  ],
  'c-jonah': [
    { de: 'Faire Löhne für die Hafenarbeiter', en: 'Fair wages for the dock workers' },
    { de: 'Pier 9 als Treffpunkt erhalten', en: 'Keep Pier 9 as a meeting place' },
  ],
  'c-selene': [
    { de: 'Halcyon von innen verändern', en: 'Change Halcyon from within' },
    { de: 'Ihren gelöschten Bericht wiederfinden', en: 'Recover her deleted report' },
  ],
  'c-kito': [
    { de: 'Herausfinden, was Freiheit bedeutet', en: 'Find out what freedom means' },
    { de: '1000 Geschichten sammeln', en: 'Collect 1,000 stories' },
  ],
  'c-valdes': [
    { de: 'Alle 200 Crewmitglieder sicher halten', en: 'Keep all 200 crew members safe' },
    { de: 'Den Versorgungsflug erreichen', en: 'Reach the supply run' },
  ],
  'c-lindqvist': [
    { de: 'Den Chor entschlüsseln', en: 'Decode the Chorus' },
    { de: 'Der Akademie das Gegenteil beweisen', en: 'Prove the academy wrong' },
  ],
  'c-pip': [
    { de: 'Die Station am Laufen halten', en: 'Keep the station running' },
    { de: 'Die perfekte Weltraumtomate züchten', en: 'Grow the perfect space tomato' },
  ],
  'c-elowen': [
    { de: 'Die Herzbäume schützen', en: 'Protect the heart-trees' },
    { de: 'Das Laternenfest gelingen lassen', en: 'Make the Lantern Festival a success' },
  ],
  'c-barnaby': [
    { de: 'Den Moosigen Krug zum Herz des Festes machen', en: 'Make The Mossy Mug the heart of the festival' },
  ],
  'c-maelis': [
    { de: 'Die Brücke über den Silberbach bauen', en: 'Build the bridge across the Silverbrook' },
    { de: 'Respekt des Druidenrats gewinnen', en: 'Win the respect of the Druid Council' },
  ],
  'c-nova': [
    { de: 'Die Regatta gewinnen', en: 'Win the regatta' },
    { de: 'Die verschwundene Rektorin finden', en: 'Find the missing headmistress' },
  ],
  'c-fenn': [
    { de: 'Das Geheimnis der Rektorin bewahren', en: 'Keep the headmistress\'s secret' },
  ],
  'c-sami': [
    { de: 'Den Nebelturm erreichen', en: 'Reach the fog tower' },
  ],
  'c-teddy': [
    { de: 'Das Große Luftschiffrennen gewinnen', en: 'Win the Great Airship Race' },
    { de: 'Die Werkstatt behalten', en: 'Keep the workshop' },
  ],
  'c-ashgrove': [
    { de: 'Messinghafen industrialisieren', en: 'Industrialise Brasshaven' },
    { de: 'Den Schlüssel der Turmuhr bekommen', en: 'Get the clock tower key' },
  ],
  'c-wren': [
    { de: 'Die Sabotage beim Rennen aufdecken', en: 'Uncover the race sabotage' },
  ],
};

export const V1_PROMINENT = ['c-mira', 'c-selene', 'c-valdes', 'c-lindqvist', 'c-elowen', 'c-maelis', 'c-nova', 'c-fenn', 'c-teddy', 'c-ashgrove'];
