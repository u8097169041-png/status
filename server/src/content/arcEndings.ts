import type { Lang } from '../../../shared/constants';
import type { ArcEndingDto, ArcPath } from '../../../shared/types';
import { fill } from '../lib/text';
import type { L } from './seedWorlds';

/**
 * Enden der Handlungsbögen. Jede Geschichte hat drei mögliche Enden: mutig („bold“), diplomatisch
 * („diplomatic“) und neutral („neutral“, wenn sich niemand einmischt). Welches eintritt, bestimmen die
 * Entscheidungen der Spielfiguren. Alle Inhalte sind fiktiv.
 */
export interface EndingTemplate {
  path: ArcPath;
  title: L;
  description: L;
}

export const ARC_ENDINGS: Record<string, EndingTemplate[]> = {
  's-capital-election': [
    {
      path: 'bold',
      title: { de: 'Erdrutschsieg', en: 'Landslide' },
      description: {
        de: 'Ein mutiger Schlussspurt kippt die Umfragen. Velmar bekommt eine klare Mehrheit – und eine aufgewühlte Opposition.',
        en: 'A bold final sprint flips the polls. Velmar gets a clear majority – and a stirred-up opposition.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Große Koalition', en: 'Grand Coalition' },
      description: {
        de: 'Niemand gewinnt allein. Brandt und Sander setzen sich an einen Tisch und regieren gemeinsam.',
        en: 'Nobody wins alone. Brandt and Sander sit down together and govern jointly.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Knapper Ausgang', en: 'Photo Finish' },
      description: {
        de: 'Ein Ergebnis mit wenigen Stimmen Unterschied. Velmar bleibt gespalten, die Debatte geht weiter.',
        en: 'A result decided by a handful of votes. Velmar stays divided and the debate continues.',
      },
    },
  ],
  's-spotlight-comeback': [
    {
      path: 'bold',
      title: { de: 'Triumph auf der großen Bühne', en: 'Triumph on the Big Stage' },
      description: {
        de: 'Das Überraschungskonzert wird zum Ereignis des Jahres. Lyra ist zurück – lauter als je zuvor.',
        en: 'The surprise concert becomes the event of the year. Lyra is back – louder than ever.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Das gemeinsame Album', en: 'The Joint Album' },
      description: {
        de: 'Statt Konkurrenz entsteht eine Zusammenarbeit. Der Boulevard feiert ein unerwartetes Duett.',
        en: 'Instead of rivalry, a collaboration is born. The boulevard celebrates an unexpected duet.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Leises Comeback', en: 'A Quiet Comeback' },
      description: {
        de: 'Die Fans freuen sich, die Schlagzeilen bleiben überschaubar. Ein Neuanfang in kleinen Schritten.',
        en: 'Fans are happy, the headlines stay modest. A fresh start in small steps.',
      },
    },
  ],
  's-unicorn-takeover': [
    {
      path: 'bold',
      title: { de: 'Feindliche Übernahme abgewehrt', en: 'Hostile Takeover Repelled' },
      description: {
        de: 'Lumio sammelt in letzter Minute neues Kapital und bleibt unabhängig. Haleworks zieht sich zurück.',
        en: 'Lumio raises fresh capital at the last minute and stays independent. Haleworks backs off.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Strategische Partnerschaft', en: 'Strategic Partnership' },
      description: {
        de: 'Statt Übernahme gibt es eine Partnerschaft auf Augenhöhe. Beide Seiten verkaufen es als Sieg.',
        en: 'Instead of a takeover there is a partnership of equals. Both sides sell it as a win.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Der Deal platzt', en: 'The Deal Collapses' },
      description: {
        de: 'Der Aufsichtsrat vertagt sich ohne Ergebnis. Unicorn Valley wartet auf das nächste Kapitel.',
        en: 'The board adjourns without a result. Unicorn Valley waits for the next chapter.',
      },
    },
  ],
  's-arena-title': [
    {
      path: 'bold',
      title: { de: 'Meister in letzter Minute', en: 'Champions in the Last Minute' },
      description: {
        de: 'Ein Tor in der Nachspielzeit entscheidet die Saison. Die Stadt feiert die ganze Nacht.',
        en: 'A stoppage-time goal decides the season. The city celebrates all night.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Das Team hält zusammen', en: 'The Team Holds Together' },
      description: {
        de: 'Das Transfergerücht ist vom Tisch, die Mannschaft steht geschlossen – und holt den Titel gemeinsam.',
        en: 'The transfer rumour is off the table, the squad stands united – and wins the title together.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Vizemeister', en: 'Runners-up' },
      description: {
        de: 'Am Ende fehlen zwei Punkte. Eine starke Saison, aber ohne Pokal.',
        en: 'In the end two points are missing. A strong season, but without the trophy.',
      },
    },
  ],
  's-latenight-ratings': [
    {
      path: 'bold',
      title: { de: 'Rekordquote', en: 'Record Ratings' },
      description: {
        de: 'Die gewagte Live-Sondersendung bricht alle Rekorde. Der Sender verlängert um zwei Staffeln.',
        en: 'The daring live special breaks every record. The network renews for two seasons.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Neues Format, altes Team', en: 'New Format, Same Team' },
      description: {
        de: 'Team und Sender einigen sich auf ein neues Konzept. Die Show überlebt – verändert, aber gemeinsam.',
        en: 'Team and network agree on a new concept. The show survives – changed, but together.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Die letzte Folge', en: 'The Final Episode' },
      description: {
        de: 'Die Show verabschiedet sich mit einer würdevollen letzten Folge. Das Publikum applaudiert im Stehen.',
        en: 'The show bows out with a dignified final episode. The audience gives a standing ovation.',
      },
    },
  ],
  's-analog-light': [
    {
      path: 'bold',
      title: { de: 'Das Licht geht an', en: 'The Lights Come On' },
      description: {
        de: 'Der Prototyp wird gegen alle Widerstände eingeführt. Die Stadt erlebt eine kleine Revolution.',
        en: 'The prototype is introduced against all resistance. The city experiences a small revolution.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Rohrpost und Licht', en: 'Tube Post and Light' },
      description: {
        de: 'Alte und neue Technik werden verbunden. Niemand verliert seine Arbeit, alle gewinnen Zeit.',
        en: 'Old and new technology are combined. Nobody loses their job, everyone gains time.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Ins Archiv', en: 'Into the Archive' },
      description: {
        de: 'Der Prototyp landet im Museum. Analog 2026 bleibt, wie es ist – vorerst.',
        en: 'The prototype ends up in a museum. Analog 2026 stays as it is – for now.',
      },
    },
  ],
  's-internet-algorithm': [
    {
      path: 'bold',
      title: { de: 'Die Creator-Revolte', en: 'The Creator Revolt' },
      description: {
        de: 'Ein gemeinsamer Upload-Streik zwingt die Plattform zum Einlenken. Trendwelle gehört wieder den Creators.',
        en: 'A joint upload strike forces the platform to give in. Trendwave belongs to its creators again.',
      },
    },
    {
      path: 'diplomatic',
      title: { de: 'Der Creator-Rat', en: 'The Creator Council' },
      description: {
        de: 'Plattform und Creators gründen einen gemeinsamen Rat. Algorithmus-Änderungen werden künftig angekündigt.',
        en: 'Platform and creators form a joint council. Algorithm changes will be announced in advance.',
      },
    },
    {
      path: 'neutral',
      title: { de: 'Neuer Algorithmus, neue Stars', en: 'New Algorithm, New Stars' },
      description: {
        de: 'Die Änderung setzt sich durch. Manche verlieren Reichweite, andere werden über Nacht bekannt.',
        en: 'The change goes through. Some lose reach, others become famous overnight.',
      },
    },
  ],
};

/** Allgemeine Enden für Geschichten ohne eigene Texte (z. B. aus der Simulation oder selbst angelegt). */
export const GENERIC_ENDINGS: EndingTemplate[] = [
  {
    path: 'bold',
    title: { de: 'Der große Wurf', en: 'The Bold Stroke' },
    description: {
      de: '„{title}“ endet mit einem mutigen Durchbruch. In {world} spricht man noch lange darüber.',
      en: '"{title}" ends with a bold breakthrough. {world} will talk about it for a long time.',
    },
  },
  {
    path: 'diplomatic',
    title: { de: 'Die Einigung', en: 'The Agreement' },
    description: {
      de: '„{title}“ endet mit einem Kompromiss, mit dem alle leben können.',
      en: '"{title}" ends in a compromise everyone can live with.',
    },
  },
  {
    path: 'neutral',
    title: { de: 'Der Lauf der Dinge', en: 'The Way Things Go' },
    description: {
      de: '„{title}“ nimmt seinen Lauf, ohne dass jemand entscheidend eingreift.',
      en: '"{title}" runs its course without anyone stepping in decisively.',
    },
  },
];

/** Konkrete Enden einer Geschichte in der Inhaltssprache (eigene Texte oder allgemeine Vorlage). */
export function buildEndings(storylineId: string, title: string, world: string, lang: Lang): ArcEndingDto[] {
  const templates = ARC_ENDINGS[storylineId] ?? GENERIC_ENDINGS;
  return templates.map((e) => ({
    id: `${storylineId}:${e.path}`,
    path: e.path,
    title: fill(e.title[lang], { title, world }),
    description: fill(e.description[lang], { title, world }),
  }));
}
