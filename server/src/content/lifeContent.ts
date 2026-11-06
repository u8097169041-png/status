/**
 * Inhalte des regelbasierten Spielsystems der Lebenssimulation (Deutsch/Englisch).
 * Die KI erzählt – Werte, Erfolg und Konsequenzen bestimmt dieses System.
 */
import { uw } from '../../../shared/regex';
import type { ActionCategory, CharacterStance, LifeArchetype, LifeGenre, LifeStat, SuggestionKind } from '../../../shared/life';
import type { L } from './seedWorlds';

// ---------- Rollen und Startwerte ----------

/** Reihenfolge = Priorität. „Boss“-Wörter machen aus Kriminellen einen Anführer. */
export const ARCHETYPE_PATTERNS: [LifeArchetype, RegExp][] = [
  ['crime_boss', uw(/\b(mafia|pate|patin|don\b|capo|kartell|clan|unterwelt|syndikat|mob|cartel|kingpin|crime lord|mafiaboss|mafia-boss|mafiakönig|drogenboss|gangsterboss|unterweltkönig)/i)],
  ['gangster', uw(/\b(gangster|dealer|dieb|thief|einbrecher|schmuggler|smuggler|auftragskiller|hitman|bandit|gang|kriminell|criminal|hehler)/i)],
  ['politician', uw(/\b(politiker|politician|kanzler|chancellor|minister|bürgermeister|mayor|präsident|president|senator|abgeordnet|parlament|parliament|wahlkampf|campaign|gouverneur|governor|partei)/i)],
  ['law', uw(/\b(polizist|polizistin|police|kommissar|detective|detektiv|ermittler|anwalt|anwältin|lawyer|richter|judge|staatsanwalt|prosecutor|agent|fbi|interpol|sheriff)/i)],
  ['entrepreneur', uw(/\b(unternehmer|entrepreneur|ceo|gründer|founder|firmenchef|konzern|investor|milliardär|billionaire|millionär|millionaire|geschäftsmann|geschäftsfrau|businessman|businesswoman|start-up|startup|tycoon)/i)],
  ['celebrity', uw(/\b(star|popstar|sänger|sängerin|singer|schauspieler|schauspielerin|actor|actress|influencer|berühmt|famous|promi|celebrity|model|rapper|musiker|musician|sportstar|fußballstar)/i)],
];

const LEADER = uw(/\b(boss|chef|anführer|oberhaupt|könig|königin|king|queen|pate|patin|don\b|leader|herrscher|ruler|kopf der|head of|mächtig|einflussreich|gefürchtet)/i);

export const STAT_BASE: Record<LifeArchetype, Partial<Record<LifeStat, number>>> = {
  crime_boss: { health: 85, power: 80, influence: 75, wealth: 80, authority: 85, loyalty: 70, reputation: 65, heat: 55, relationships: 50, skills: 65 },
  gangster: { health: 80, power: 35, wealth: 30, loyalty: 55, reputation: 30, heat: 40, skills: 50, relationships: 40 },
  politician: { health: 80, influence: 60, power: 50, reputation: 55, trust: 50, authority: 50, standing: 65, wealth: 60, relationships: 55, skills: 55 },
  entrepreneur: { health: 80, wealth: 70, influence: 50, reputation: 50, trust: 50, skills: 65, relationships: 45, standing: 60 },
  celebrity: { health: 80, reputation: 80, influence: 60, wealth: 70, trust: 45, relationships: 50, skills: 60 },
  law: { health: 85, authority: 55, trust: 60, skills: 60, reputation: 45, relationships: 45, standing: 50, wealth: 40 },
  ordinary: { health: 85, wealth: 35, relationships: 50, trust: 55, skills: 45, reputation: 20, standing: 30 },
};

/** Zusätze aus der Ausgangsgeschichte (z. B. „einflussreich“, „pleite“, „neu im Geschäft“). */
export const PREMISE_MODIFIERS: { pattern: RegExp; changes: Partial<Record<LifeStat, number>> }[] = [
  { pattern: uw(/\b(einflussreich|mächtig|gefürchtet|powerful|feared|influential|legendär|legendary)/i), changes: { power: 10, influence: 10, authority: 8 } },
  { pattern: uw(/\b(reich|wohlhabend|vermögend|milliardär|millionär|rich|wealthy|billionaire|millionaire)/i), changes: { wealth: 18 } },
  { pattern: uw(/\b(arm|pleite|verschuldet|schulden|broke|poor|in debt|mittellos)/i), changes: { wealth: -25 } },
  { pattern: uw(/\b(neu|anfänger|junior|aufstrebend|frisch|rookie|newcomer|beginner|aufsteiger)/i), changes: { authority: -15, power: -12, influence: -10, reputation: -10 } },
  { pattern: uw(/\b(berühmt|bekannt|prominent|famous|well-known|weltberühmt)/i), changes: { reputation: 15 } },
  { pattern: uw(/\b(beliebt|geschätzt|respektiert|popular|respected|beloved)/i), changes: { reputation: 8, trust: 10 } },
  { pattern: uw(/\b(korrupt|corrupt|skrupellos|ruthless)/i), changes: { trust: -15, heat: 10, power: 5 } },
  { pattern: uw(/\b(gesucht|wanted|unter beobachtung|ermittlungen gegen|under investigation)/i), changes: { heat: 25 } },
  { pattern: uw(/\b(verletzt|krank|injured|sick|ill)\b/i), changes: { health: -30 } },
  { pattern: uw(/\b(einsam|allein|isoliert|lonely|alone|isolated)/i), changes: { relationships: -20 } },
  { pattern: uw(/\b(familie|family|freunde|friends|clan)\b/i), changes: { relationships: 8 } },
  { pattern: uw(/\b(verraten|betrayed|im stich gelassen)/i), changes: { loyalty: -15, trust: -10 } },
  { pattern: uw(/\b(loyal|treu|ergeben|loyalty)/i), changes: { loyalty: 12 } },
  { pattern: uw(/\b(erfahren|veteran|experienced|meister|master|genie|genius)/i), changes: { skills: 15 } },
];

export function isLeader(text: string): boolean {
  return LEADER.test(text);
}

export const GENRE_PATTERNS: [LifeGenre, RegExp][] = [
  ['crime', uw(/\b(mafia|gang|kartell|cartel|drogen|drugs|unterwelt|underworld|schmuggel|smuggl|mord|murder|clan|syndikat|heist|raub|kriminell|criminal|polizei|police)/i)],
  ['romance', uw(/\b(liebe|love|verliebt|in love|beziehung|relationship|date|dating|romanz|romance|hochzeit|wedding|ehe|marriage|affäre|affair|ex-freund|ex-freundin|boyfriend|girlfriend|partner)/i)],
  ['politics', uw(/\b(politik|politics|wahl|election|partei|party|regierung|government|parlament|parliament|minister|kanzler|präsident|president)/i)],
  ['business', uw(/\b(firma|company|unternehmen|business|konzern|corporation|start-up|startup|börse|stock|investor|deal|geschäft)/i)],
  ['fame', uw(/\b(star|ruhm|fame|bühne|stage|film|musik|music|konzert|concert|fans|influencer|show|paparazzi)/i)],
];

// ---------- Aktionen ----------

/** Stichwörter je Aktionsart (Deutsch und Englisch). Reihenfolge = Priorität bei mehreren Treffern. */
export const ACTION_PATTERNS: [ActionCategory, RegExp][] = [
  ['violence', uw(/\b(töte|töten|ermorde|erschieß|erschies|erstech|umbringen|bring\w* um|angreif|greif\w*\s(?:[^.!?\s]+\s){0,5}an\b|schlag|verprügel|attackier|kill|murder|shoot|stab|attack|beat up|punch|fight|kämpf|ausschalten|eliminier)/i)],
  ['threaten', uw(/\b(droh|einschüchter|erpress|threat|intimidat|blackmail|warn\w* ihn|warn\w* sie|unter druck setz)/i)],
  ['crime', uw(/\b(schmuggel|überfall|raub|einbruch|stehl|klau|drogen|geldwäsche|bestech|smuggl|rob\b|robbery|heist|steal|launder|bribe|deal\w* drogen)/i)],
  ['deceive', uw(/\b(lüg|belüg|täusch|betrüg|verrat|verrät|hintergeh|fälsch|lie\b|lying|deceive|betray|cheat|trick|bluff|manipulier)/i)],
  ['romance', uw(/\b(küss|kiss|flirt|liebeserklärung|gesteh\w* (meine|ihm|ihr) (liebe|gefühle)|date\b|verabred|romantisch|romantic|umarm|hug|heirat|marry|propose|antrag|zärtlich)/i)],
  ['business', uw(/\b(investier|kauf|verkauf|handel|vertrag|deal|geschäft|firma|aktie|invest|buy|sell|trade|contract|negotiate a deal|übernahme|acquire|gründe)/i)],
  ['persuade', uw(/\b(überzeug|überred|verhandel|bitte\w* um|rede\w* ihm|rede\w* ihr|persuade|convince|negotiate|appeal|ask\w* for help|um hilfe)/i)],
  ['help', uw(/\b(helf|hilf|unterstütz|beschütz|schütz|schenk|spend|retten|rette|help|support|protect|gift|donate|save|tröst|comfort)/i)],
  ['investigate', uw(/\b(untersuch|ermittl|beobacht|spionier|durchsuch|nachforsch|recherchier|finde heraus|investigate|spy|search|observe|find out|research|look into|beschatt)/i)],
  ['public', uw(/\b(rede halten|ansprache|interview|pressekonferenz|öffentlich|post\w* |speech|press conference|announce|ankündig|auftritt|perform|konzert geben)/i)],
  ['rest', uw(/\b(schlaf|ruh\w* (mich|dich) aus|erhol|entspann|urlaub|pause|sleep|rest|relax|recover|vacation|meditier)/i)],
  ['travel', uw(/\b(fahr\w* (nach|zu|zum|zur|in)|flieg|reis|geh\w* (nach|zu|zum|zur|in)|verlass\w* die stadt|travel|drive to|fly to|go to|head to|leave town)/i)],
  ['wait', uw(/\b(warte|abwarten|nichts tun|wait|do nothing|lie low|untertauchen)/i)],
  ['talk', /./],
];

export const LETHAL = uw(/\b(töte|töten|ermorde|erschieß|erschies|erstech|umbringen|bring\w* um|kill|murder|shoot|stab|eliminier|ausschalten)/i);
export const PROMISE = uw(/\b(ich verspreche|versprech\w* dir|versprech\w* ihm|versprech\w* ihr|ich schwöre|mein wort|ehrenwort|i promise|i swear|you have my word|i give you my word)/i);
export const RISKY_WORDS = uw(/\b(allein|alone|unbewaffnet|unarmed|alles riskier|risk everything|sofort|immediately|ohne plan|without a plan|all-in|alles auf eine karte)/i);

/** Grundchance je Aktionsart und relevante Werte (Gewicht je Abweichung von 50). */
export const ACTION_RULES: Record<ActionCategory, { base: number; stats: Partial<Record<LifeStat, number>>; risk: 1 | 2 | 3; relation: boolean }> = {
  talk: { base: 0.75, stats: { relationships: 0.25 }, risk: 1, relation: true },
  persuade: { base: 0.5, stats: { influence: 0.35, reputation: 0.15, skills: 0.15 }, risk: 1, relation: true },
  threaten: { base: 0.45, stats: { power: 0.35, authority: 0.3 }, risk: 2, relation: false },
  violence: { base: 0.42, stats: { power: 0.35, skills: 0.2, health: 0.15 }, risk: 3, relation: false },
  deceive: { base: 0.45, stats: { skills: 0.35, influence: 0.1 }, risk: 2, relation: true },
  business: { base: 0.5, stats: { wealth: 0.2, skills: 0.3, influence: 0.15 }, risk: 2, relation: false },
  romance: { base: 0.45, stats: { relationships: 0.2, reputation: 0.1 }, risk: 1, relation: true },
  help: { base: 0.75, stats: { wealth: 0.1, relationships: 0.15 }, risk: 1, relation: true },
  investigate: { base: 0.5, stats: { skills: 0.4, influence: 0.1 }, risk: 1, relation: false },
  rest: { base: 0.9, stats: {}, risk: 1, relation: false },
  public: { base: 0.5, stats: { reputation: 0.3, influence: 0.2, trust: 0.15 }, risk: 2, relation: false },
  crime: { base: 0.45, stats: { power: 0.2, skills: 0.25, heat: -0.3 }, risk: 3, relation: false },
  travel: { base: 0.9, stats: { wealth: 0.05 }, risk: 1, relation: false },
  wait: { base: 0.95, stats: {}, risk: 1, relation: false },
};

export interface Effect {
  stats?: Partial<Record<LifeStat, number>>;
  target?: { affinity?: number; trust?: number; loyalty?: number; fear?: number };
  health?: [number, number];
}

/** Auswirkungen je Aktionsart: Erfolg, Teilerfolg, Misserfolg (kritische Ergebnisse verstärken sie). */
export const ACTION_EFFECTS: Record<ActionCategory, { success: Effect; partial: Effect; failure: Effect }> = {
  talk: { success: { stats: { relationships: 1 }, target: { affinity: 4, trust: 2 } }, partial: { target: { affinity: 1 } }, failure: { target: { affinity: -3 } } },
  persuade: {
    success: { stats: { influence: 2 }, target: { trust: 4, affinity: 3 } },
    partial: { stats: { influence: 1 } },
    failure: { stats: { influence: -1 }, target: { trust: -3, affinity: -2 } },
  },
  threaten: {
    success: { stats: { authority: 3, heat: 2 }, target: { fear: 15, affinity: -8, loyalty: 4 } },
    partial: { stats: { authority: 1 }, target: { fear: 6, affinity: -6 } },
    failure: { stats: { authority: -4 }, target: { affinity: -12, loyalty: -10, fear: -5 }, health: [0, 10] },
  },
  violence: {
    success: { stats: { power: 4, authority: 3, heat: 12, reputation: -2 }, target: { affinity: -35, fear: 25 } },
    partial: { stats: { heat: 8 }, target: { affinity: -25 }, health: [5, 15] },
    failure: { stats: { power: -3, heat: 10 }, target: { affinity: -20 }, health: [10, 28] },
  },
  deceive: {
    success: { stats: { wealth: 3, influence: 2 } },
    partial: { stats: { wealth: 1 }, target: { trust: -6 } },
    failure: { stats: { reputation: -4 }, target: { trust: -25, affinity: -18, loyalty: -10 } },
  },
  business: { success: { stats: { wealth: 6, skills: 1, influence: 1 } }, partial: { stats: { wealth: 1 } }, failure: { stats: { wealth: -6 } } },
  romance: {
    success: { stats: { relationships: 2 }, target: { affinity: 10, trust: 3 } },
    partial: { target: { affinity: 3 } },
    failure: { target: { affinity: -7, trust: -2 } },
  },
  help: {
    success: { stats: { reputation: 1, wealth: -1, relationships: 1 }, target: { affinity: 8, trust: 6, loyalty: 6 } },
    partial: { target: { affinity: 3, trust: 2 } },
    failure: { stats: { wealth: -2 }, target: { affinity: -1 } },
  },
  investigate: {
    success: { stats: { skills: 1 } },
    partial: {},
    failure: { stats: { heat: 3 }, target: { trust: -6, affinity: -4 } },
  },
  rest: { success: { stats: { heat: -3 }, health: [-20, -10] }, partial: { health: [-8, -4] }, failure: { health: [-3, 0] } },
  public: {
    success: { stats: { reputation: 5, influence: 3, trust: 2 } },
    partial: { stats: { reputation: 1 } },
    failure: { stats: { reputation: -5, trust: -3 } },
  },
  crime: {
    success: { stats: { wealth: 8, power: 2, heat: 10 } },
    partial: { stats: { wealth: 3, heat: 12 } },
    failure: { stats: { wealth: -4, heat: 18, authority: -3 }, health: [0, 12] },
  },
  travel: { success: {}, partial: {}, failure: { stats: { wealth: -1 } } },
  wait: { success: { stats: { heat: -2 } }, partial: {}, failure: {} },
};

// ---------- Erzählung ohne KI (Ersatz) ----------

export const OUTCOME_TEXT: Record<ActionCategory, Record<'success' | 'partial' | 'failure', L>> = {
  talk: {
    success: { de: 'Das Gespräch{with} verläuft gut. Man hört dir zu, und ein Stück Misstrauen fällt ab.', en: 'The conversation{with} goes well. You are heard, and some of the mistrust falls away.' },
    partial: { de: 'Ihr redet{with}, aber vieles bleibt ungesagt.', en: 'You talk{with}, but much remains unsaid.' },
    failure: { de: 'Das Gespräch{with} kippt. Ein falsches Wort, und die Stimmung ist dahin.', en: 'The conversation{with} turns sour. One wrong word, and the mood is gone.' },
  },
  persuade: {
    success: { de: 'Deine Argumente sitzen. {target} lässt sich überzeugen.', en: 'Your arguments land. {target} is convinced.' },
    partial: { de: '{target} hört zu, verspricht aber nichts.', en: '{target} listens but promises nothing.' },
    failure: { de: '{target} durchschaut, worauf du hinauswillst, und blockt ab.', en: '{target} sees what you are after and shuts you down.' },
  },
  threaten: {
    success: { de: 'Die Drohung wirkt. {target} weicht deinem Blick aus.', en: 'The threat works. {target} avoids your eyes.' },
    partial: { de: '{target} zuckt zusammen – aber in den Augen liegt Trotz.', en: '{target} flinches – but there is defiance in those eyes.' },
    failure: { de: '{target} lacht dir ins Gesicht. Deine Drohung verpufft, und das spricht sich herum.', en: '{target} laughs in your face. Your threat falls flat, and word gets around.' },
  },
  violence: {
    success: { de: 'Es geht schnell und hart. Als es vorbei ist, ist nichts mehr wie vorher.', en: 'It is quick and brutal. When it is over, nothing is the same.' },
    partial: { de: 'Der Kampf ist chaotisch. Du setzt dich durch, aber nicht ohne Blessuren.', en: 'The fight is chaotic. You prevail, but not without bruises.' },
    failure: { de: 'Du hast dich verschätzt. Der Gegenschlag trifft dich mit voller Wucht.', en: 'You misjudged it. The counterattack hits you hard.' },
  },
  deceive: {
    success: { de: 'Niemand bemerkt die Täuschung. Noch nicht.', en: 'Nobody notices the deception. Not yet.' },
    partial: { de: 'Die Lüge hält – gerade so. {target} wirkt nachdenklich.', en: 'The lie holds – barely. {target} looks thoughtful.' },
    failure: { de: 'Die Lüge fliegt auf. {target} wird das so schnell nicht vergessen.', en: 'The lie is exposed. {target} will not forget this soon.' },
  },
  business: {
    success: { de: 'Der Deal steht. Die Zahlen sprechen für dich.', en: 'The deal is done. The numbers speak for you.' },
    partial: { de: 'Ein mageres Geschäft – besser als nichts.', en: 'A lean deal – better than nothing.' },
    failure: { de: 'Das Geschäft platzt und kostet dich Geld.', en: 'The deal collapses and costs you money.' },
  },
  romance: {
    success: { de: 'Ein Moment, in dem die Welt kurz stillsteht. {target} lächelt.', en: 'A moment in which the world stands still. {target} smiles.' },
    partial: { de: '{target} ist geschmeichelt, aber zurückhaltend.', en: '{target} is flattered, but reserved.' },
    failure: { de: 'Der Moment ist falsch gewählt. {target} geht auf Abstand.', en: 'The timing is wrong. {target} keeps their distance.' },
  },
  help: {
    success: { de: 'Deine Hilfe kommt genau richtig. {target} wird das nicht vergessen.', en: 'Your help comes at exactly the right time. {target} will not forget it.' },
    partial: { de: 'Du hilfst, so gut es geht.', en: 'You help as best you can.' },
    failure: { de: 'Trotz guter Absicht verpufft deine Hilfe.', en: 'Despite good intentions, your help goes nowhere.' },
  },
  investigate: {
    success: { de: 'Du findest etwas, das niemand finden sollte.', en: 'You find something nobody was supposed to find.' },
    partial: { de: 'Ein paar Hinweise – aber noch kein klares Bild.', en: 'A few clues – but no clear picture yet.' },
    failure: { de: 'Deine Nachforschungen bleiben nicht unbemerkt.', en: 'Your digging does not go unnoticed.' },
  },
  rest: {
    success: { de: 'Endlich Ruhe. Du kommst wieder zu Kräften.', en: 'Finally some rest. You regain your strength.' },
    partial: { de: 'Unruhiger Schlaf, aber etwas Erholung.', en: 'Restless sleep, but some recovery.' },
    failure: { de: 'Die Gedanken lassen dich nicht los. An Erholung ist kaum zu denken.', en: 'Your thoughts won\'t let go. Rest is hard to come by.' },
  },
  public: {
    success: { de: 'Dein Auftritt kommt an. Man spricht über dich – positiv.', en: 'Your appearance lands. People talk about you – in a good way.' },
    partial: { de: 'Gemischte Reaktionen. Manche jubeln, manche spotten.', en: 'Mixed reactions. Some cheer, some mock.' },
    failure: { de: 'Der Auftritt geht nach hinten los.', en: 'The appearance backfires.' },
  },
  crime: {
    success: { de: 'Die Sache läuft glatt. Das Geld ist da – und die Aufmerksamkeit auch.', en: 'The job goes smoothly. The money is there – and so is the attention.' },
    partial: { de: 'Es klappt, aber jemand hat etwas gesehen.', en: 'It works, but someone saw something.' },
    failure: { de: 'Es geht schief. Sirenen in der Ferne.', en: 'It goes wrong. Sirens in the distance.' },
  },
  travel: {
    success: { de: 'Du machst dich auf den Weg. Neue Umgebung, neue Möglichkeiten.', en: 'You set off. New surroundings, new opportunities.' },
    partial: { de: 'Die Reise ist anstrengend, aber du kommst an.', en: 'The journey is exhausting, but you arrive.' },
    failure: { de: 'Unterwegs geht einiges schief.', en: 'Several things go wrong on the way.' },
  },
  wait: {
    success: { de: 'Du wartest ab und beobachtest. Die Zeit arbeitet – für oder gegen dich.', en: 'You wait and watch. Time is working – for or against you.' },
    partial: { de: 'Die Zeit vergeht.', en: 'Time passes.' },
    failure: { de: 'Das Warten zehrt an den Nerven.', en: 'The waiting wears on your nerves.' },
  },
};

export const CRITICAL_TEXT = {
  success: { de: 'Besser hätte es nicht laufen können.', en: 'It could not have gone better.' },
  failure: { de: 'Es ist schlimmer gekommen als befürchtet.', en: 'It turned out worse than feared.' },
};

/** Reaktion einer anwesenden Figur ohne KI – abhängig von Haltung und Ergebnis. */
export const REACTION_LINES: Record<'warm' | 'cool' | 'hostile' | 'afraid', L[]> = {
  warm: [
    { de: '„Ich wusste, dass ich mich auf dich verlassen kann.“', en: '"I knew I could count on you."' },
    { de: '„Gut. Lass uns das gemeinsam durchziehen.“', en: '"Good. Let\'s see this through together."' },
    { de: '„Danke. Wirklich.“', en: '"Thank you. Really."' },
  ],
  cool: [
    { de: '„Wir werden sehen, wohin das führt.“', en: '"We\'ll see where this leads."' },
    { de: '„Hm. Ich denke darüber nach.“', en: '"Hm. I\'ll think about it."' },
    { de: '„Das ändert nicht viel.“', en: '"That doesn\'t change much."' },
  ],
  hostile: [
    { de: '„Das wirst du bereuen.“', en: '"You will regret this."' },
    { de: '„Glaub nicht, dass ich das vergesse.“', en: '"Don\'t think I\'ll forget this."' },
    { de: '„Wir sind hier fertig.“', en: '"We\'re done here."' },
  ],
  afraid: [
    { de: '„Schon gut … schon gut. Ich mache, was du sagst.“', en: '"Alright … alright. I\'ll do what you say."' },
    { de: '„Bitte. Ich will keinen Ärger.“', en: '"Please. I don\'t want trouble."' },
  ],
};

// ---------- Ereignisse ----------

export interface EventTemplate {
  title: L;
  description: L;
  severity: 'minor' | 'major' | 'critical';
}

export const EVENT_TEXT: Record<string, EventTemplate> = {
  betrayal: {
    title: { de: 'Verrat', en: 'Betrayal' },
    description: { de: '{npc} hat hinter deinem Rücken gehandelt und Informationen an deine Gegner weitergegeben.', en: '{npc} has acted behind your back and passed information to your enemies.' },
    severity: 'critical',
  },
  betrayal_hidden: {
    title: { de: 'Etwas stimmt nicht', en: 'Something is off' },
    description: { de: 'Geschäfte platzen, Pläne werden vorzeitig bekannt. Jemand aus deinem Umfeld scheint zu reden.', en: 'Deals fall through, plans leak early. Someone close to you seems to be talking.' },
    severity: 'major',
  },
  attack: {
    title: { de: 'Anschlag', en: 'Attack' },
    description: { de: 'Leute von {npc} lauern dir auf. Es fallen Schläge, vielleicht Schüsse.', en: '{npc}\'s people ambush you. There are blows, maybe shots.' },
    severity: 'critical',
  },
  raid: {
    title: { de: 'Razzia', en: 'Raid' },
    description: { de: 'Die Polizei durchsucht deine Räume. Beweise und Geld werden beschlagnahmt.', en: 'The police search your premises. Evidence and money are seized.' },
    severity: 'major',
  },
  scandal: {
    title: { de: 'Skandal', en: 'Scandal' },
    description: { de: 'Ein unangenehmes Detail aus deiner Vergangenheit macht die Runde. Die Leute reden.', en: 'An awkward detail from your past is making the rounds. People are talking.' },
    severity: 'major',
  },
  opportunity: {
    title: { de: 'Eine Gelegenheit', en: 'An opportunity' },
    description: { de: 'Unerwartet bietet sich eine Chance, die nicht lange bestehen wird.', en: 'Unexpectedly, a chance appears that won\'t last long.' },
    severity: 'minor',
  },
  romance_moment: {
    title: { de: 'Nähe', en: 'Closeness' },
    description: { de: '{npc} sucht deine Nähe. Ein stiller, ehrlicher Moment zwischen euch.', en: '{npc} seeks you out. A quiet, honest moment between you.' },
    severity: 'minor',
  },
  jealousy: {
    title: { de: 'Eifersucht', en: 'Jealousy' },
    description: { de: '{npc} hat gesehen, wie nah du {other} gekommen bist – und ist verletzt.', en: '{npc} has seen how close you got to {other} – and is hurt.' },
    severity: 'major',
  },
  breakup: {
    title: { de: 'Trennung', en: 'Breakup' },
    description: { de: '{npc} beendet, was zwischen euch war. Die Worte sind leise, aber endgültig.', en: '{npc} ends what was between you. The words are quiet but final.' },
    severity: 'major',
  },
  illness: {
    title: { de: 'Gesundheit', en: 'Health' },
    description: { de: 'Dein Körper streikt. Ein Arzt mahnt dich, kürzerzutreten.', en: 'Your body gives out. A doctor urges you to slow down.' },
    severity: 'major',
  },
  accident: {
    title: { de: 'Unfall', en: 'Accident' },
    description: { de: 'Ein dummer Zufall, eine Sekunde Unachtsamkeit – und plötzlich liegst du im Krankenhaus.', en: 'A stupid coincidence, a second of carelessness – and suddenly you are in hospital.' },
    severity: 'critical',
  },
  npc_rise: {
    title: { de: '{npc} handelt', en: '{npc} makes a move' },
    description: { de: '{npc} verfolgt eigene Pläne: {goal}.', en: '{npc} pursues their own plans: {goal}.' },
    severity: 'minor',
  },
  npc_feud: {
    title: { de: 'Streit', en: 'Feud' },
    description: { de: '{npc} und {other} geraten heftig aneinander.', en: '{npc} and {other} clash fiercely.' },
    severity: 'minor',
  },
  npc_death: {
    title: { de: 'Ein Todesfall', en: 'A death' },
    description: { de: '{npc} ist tot. Die Nachricht trifft alle unvorbereitet.', en: '{npc} is dead. The news catches everyone unprepared.' },
    severity: 'critical',
  },
  windfall: {
    title: { de: 'Glück gehabt', en: 'A stroke of luck' },
    description: { de: 'Eine alte Investition, ein vergessener Gefallen – plötzlich ist mehr Geld da als gedacht.', en: 'An old investment, a forgotten favour – suddenly there is more money than expected.' },
    severity: 'minor',
  },
  loss: {
    title: { de: 'Verlust', en: 'Loss' },
    description: { de: 'Ein Geschäft bricht weg, eine Rechnung kommt zur falschen Zeit.', en: 'A deal falls away, a bill arrives at the wrong time.' },
    severity: 'minor',
  },
  income: {
    title: { de: 'Die Tage vergehen', en: 'Days pass' },
    description: { de: 'Der Alltag läuft weiter: Einnahmen, Ausgaben, kleine Begegnungen.', en: 'Everyday life goes on: income, expenses, small encounters.' },
    severity: 'minor',
  },
  death: {
    title: { de: 'Das Ende', en: 'The end' },
    description: { de: '{player} ist tot. {cause} Diese Lebensgeschichte ist zu Ende.', en: '{player} is dead. {cause} This life story is over.' },
    severity: 'critical',
  },
};

export const DEATH_CAUSE: Record<string, L> = {
  violence: { de: 'Der Kampf war einer zu viel.', en: 'The fight was one too many.' },
  attack: { de: 'Der Anschlag hat sein Ziel nicht verfehlt.', en: 'The attack did not miss its mark.' },
  illness: { de: 'Der Körper hat aufgegeben.', en: 'The body gave up.' },
  accident: { de: 'Ein Unfall, den niemand kommen sah.', en: 'An accident nobody saw coming.' },
  crime: { de: 'Der letzte Coup endete tödlich.', en: 'The last job ended fatally.' },
  threaten: { de: 'Die Drohung wurde mit Gewalt beantwortet.', en: 'The threat was answered with violence.' },
  default: { de: 'Das Schicksal war unbarmherzig.', en: 'Fate was merciless.' },
};

// ---------- Handlungsvorschläge ----------

export interface SuggestionTemplate {
  text: L;
  category: ActionCategory;
  risk: 1 | 2 | 3;
  /** Platzhalter {npc} wird mit einer passenden Figur gefüllt (ally = befreundet, foe = Gegner, any). */
  needs?: 'ally' | 'foe' | 'love' | 'any';
}

const S = (de: string, en: string, category: ActionCategory, risk: 1 | 2 | 3, needs?: SuggestionTemplate['needs']): SuggestionTemplate => ({ text: { de, en }, category, risk, needs });

export const SUGGESTIONS: Record<LifeGenre | 'common', Partial<Record<SuggestionKind, SuggestionTemplate[]>>> = {
  common: {
    smart: [
      S('Mit {npc} offen über die Lage sprechen', 'Talk openly with {npc} about the situation', 'talk', 1, 'ally'),
      S('Erst Informationen sammeln, bevor du handelst', 'Gather information before you act', 'investigate', 1),
      S('{npc} einen ehrlichen Gefallen tun', 'Do {npc} an honest favour', 'help', 1, 'any'),
      S('Dir Zeit nehmen und dich erholen', 'Take some time and recover', 'rest', 1),
    ],
    alternative: [
      S('{npc} um Rat fragen', 'Ask {npc} for advice', 'persuade', 1, 'ally'),
      S('Die Stadt für ein paar Tage verlassen', 'Leave the city for a few days', 'travel', 1),
      S('Abwarten und beobachten, wer sich bewegt', 'Wait and watch who makes a move', 'wait', 1),
      S('Herausfinden, was {npc} wirklich will', 'Find out what {npc} really wants', 'investigate', 1, 'any'),
    ],
    risky: [
      S('{npc} direkt zur Rede stellen', 'Confront {npc} directly', 'threaten', 2, 'foe'),
      S('{npc} eine Lüge auftischen', 'Feed {npc} a lie', 'deceive', 2, 'any'),
      S('Alles auf eine Karte setzen', 'Bet everything on one card', 'business', 3),
    ],
    surprising: [
      S('Einen alten Feind um Hilfe bitten', 'Ask an old enemy for help', 'persuade', 2, 'foe'),
      S('Die Wahrheit öffentlich machen', 'Make the truth public', 'public', 2),
      S('Spurlos verschwinden und neu anfangen', 'Disappear without a trace and start over', 'travel', 2),
      S('{npc} ein überraschendes Geschenk machen', 'Give {npc} a surprising gift', 'help', 1, 'any'),
    ],
  },
  crime: {
    smart: [S('Die Loyalität deiner Leute mit Geld sichern', 'Secure your people\'s loyalty with money', 'help', 1, 'ally'), S('Mit {npc} über ein Stillhalteabkommen verhandeln', 'Negotiate a truce with {npc}', 'persuade', 2, 'foe')],
    alternative: [S('Einen korrupten Polizisten bestechen', 'Bribe a corrupt police officer', 'crime', 2), S('Die Geschäfte vorübergehend ruhen lassen', 'Put the business on hold for now', 'wait', 1)],
    risky: [S('{npc} ausschalten lassen', 'Have {npc} taken out', 'violence', 3, 'foe'), S('Eine große Lieferung selbst übernehmen', 'Take over a big shipment yourself', 'crime', 3), S('{npc} öffentlich drohen', 'Threaten {npc} publicly', 'threaten', 2, 'foe')],
    surprising: [S('Mit der Polizei zusammenarbeiten', 'Cooperate with the police', 'deceive', 3), S('{npc} zu deinem Nachfolger machen', 'Make {npc} your successor', 'help', 2, 'ally')],
  },
  romance: {
    smart: [S('{npc} zu einem ruhigen Abendessen einladen', 'Invite {npc} to a quiet dinner', 'romance', 1, 'love'), S('Ein ehrliches Gespräch über eure Gefühle führen', 'Have an honest talk about your feelings', 'talk', 1, 'love')],
    alternative: [S('Einer Freundin oder einem Freund dein Herz ausschütten', 'Pour your heart out to a friend', 'talk', 1, 'ally'), S('Etwas Abstand nehmen und nachdenken', 'Take some distance and think', 'rest', 1)],
    risky: [S('{npc} spontan deine Liebe gestehen', 'Spontaneously confess your love to {npc}', 'romance', 2, 'love'), S('Mit {npc} flirten, um Eifersucht zu wecken', 'Flirt with {npc} to make someone jealous', 'romance', 3, 'any')],
    surprising: [S('Ein Wochenende in einer fremden Stadt planen', 'Plan a weekend in a strange city', 'travel', 1), S('Einen alten Liebesbrief öffentlich vorlesen', 'Read an old love letter out loud in public', 'public', 2)],
  },
  politics: {
    smart: [S('Eine Koalition mit {npc} ausloten', 'Explore a coalition with {npc}', 'persuade', 1, 'any'), S('Eine sachliche Rede zur Lage halten', 'Give a sober speech about the situation', 'public', 1)],
    alternative: [S('Hinter verschlossenen Türen verhandeln', 'Negotiate behind closed doors', 'persuade', 2), S('Die Stimmung an der Basis erkunden', 'Gauge the mood among the grassroots', 'investigate', 1)],
    risky: [S('Ein Gerücht über {npc} streuen', 'Spread a rumour about {npc}', 'deceive', 3, 'foe'), S('Eine Kampfabstimmung erzwingen', 'Force a showdown vote', 'public', 3)],
    surprising: [S('Mit dem politischen Gegner gemeinsam auftreten', 'Appear together with your political opponent', 'public', 2, 'foe'), S('Den Rücktritt ankündigen – als Druckmittel', 'Announce your resignation – as leverage', 'public', 3)],
  },
  business: {
    smart: [S('Die Zahlen genau prüfen lassen', 'Have the numbers checked closely', 'investigate', 1), S('{npc} eine faire Partnerschaft anbieten', 'Offer {npc} a fair partnership', 'business', 1, 'any')],
    alternative: [S('Einen Investor ins Boot holen', 'Bring an investor on board', 'business', 2), S('Kosten senken und abwarten', 'Cut costs and wait', 'wait', 1)],
    risky: [S('Die Konkurrenz von {npc} feindlich übernehmen', 'Launch a hostile takeover of {npc}\'s business', 'business', 3, 'foe'), S('Mit geschönten Zahlen verhandeln', 'Negotiate with doctored numbers', 'deceive', 3)],
    surprising: [S('Das Unternehmen an die Mitarbeiter übergeben', 'Hand the company over to the employees', 'help', 2), S('Ein völlig neues Produkt ankündigen', 'Announce a completely new product', 'public', 2)],
  },
  fame: {
    smart: [S('Ein ehrliches Interview geben', 'Give an honest interview', 'public', 1), S('Mit {npc} an einem gemeinsamen Projekt arbeiten', 'Work on a joint project with {npc}', 'business', 1, 'any')],
    alternative: [S('Für eine Weile aus der Öffentlichkeit verschwinden', 'Disappear from the public eye for a while', 'rest', 1), S('Die Fans um Unterstützung bitten', 'Ask your fans for support', 'public', 2)],
    risky: [S('{npc} öffentlich bloßstellen', 'Expose {npc} publicly', 'public', 3, 'foe'), S('Einen provokanten Auftritt wagen', 'Dare a provocative performance', 'public', 3)],
    surprising: [S('Ein geheimes Konzert für Fremde geben', 'Play a secret concert for strangers', 'public', 1), S('Deine Karriere öffentlich infrage stellen', 'Publicly question your own career', 'public', 2)],
  },
  drama: {
    smart: [S('Mit {npc} einen Kompromiss suchen', 'Look for a compromise with {npc}', 'persuade', 1, 'any')],
    alternative: [S('Einen neuen Job suchen', 'Look for a new job', 'business', 1)],
    risky: [S('{npc} die Meinung sagen – laut', 'Tell {npc} what you think – loudly', 'threaten', 2, 'foe')],
    surprising: [S('Ein Familiengeheimnis lüften', 'Reveal a family secret', 'public', 2)],
  },
};

// ---------- Standardbesetzung, falls die Beschreibung keine Figuren nennt ----------

export interface CastTemplate {
  role: L;
  description: L;
  stance: CharacterStance;
  affinity: number;
  trust: number;
  loyalty: number;
  personality: L[];
  goal: L;
  secret?: L;
  gender: 'female' | 'male';
}

const C = (x: CastTemplate) => x;
export const CAST_NAMES = {
  female: ['Elena Moretti', 'Sofia Brandt', 'Mara Kovač', 'Julia Hartmann', 'Nina Albrecht', 'Lucia Romano', 'Hannah Weiss', 'Amira Haddad'],
  male: ['Marco Bellini', 'Viktor Lenz', 'Daniel Krüger', 'Tomasz Nowak', 'Luca Ferraro', 'Jonas Richter', 'Karim Saleh', 'Felix Sommer'],
};

export const DEFAULT_CAST: Record<LifeGenre, CastTemplate[]> = {
  crime: [
    C({ role: { de: 'Consigliere und rechte Hand', en: 'Consigliere and right hand' }, description: { de: 'Kennt jedes Geheimnis der Familie.', en: 'Knows every family secret.' }, stance: 'ally', affinity: 40, trust: 70, loyalty: 75, personality: [{ de: 'besonnen', en: 'level-headed' }, { de: 'verschwiegen', en: 'discreet' }], goal: { de: 'Die Familie zusammenhalten', en: 'Keep the family together' }, gender: 'male' }),
    C({ role: { de: 'Ehrgeiziger Leutnant', en: 'Ambitious lieutenant' }, description: { de: 'Jung, hungrig, ungeduldig.', en: 'Young, hungry, impatient.' }, stance: 'subordinate', affinity: 15, trust: 45, loyalty: 35, personality: [{ de: 'ehrgeizig', en: 'ambitious' }, { de: 'impulsiv', en: 'impulsive' }], goal: { de: 'Selbst an die Spitze kommen', en: 'Get to the top himself' }, secret: { de: 'Trifft sich heimlich mit der Konkurrenz.', en: 'Secretly meets with the competition.' }, gender: 'male' }),
    C({ role: { de: 'Rivalisierende Bossin', en: 'Rival boss' }, description: { de: 'Kontrolliert den Hafen und will mehr.', en: 'Controls the harbour and wants more.' }, stance: 'enemy', affinity: -45, trust: 10, loyalty: 0, personality: [{ de: 'kalt', en: 'cold' }, { de: 'berechnend', en: 'calculating' }], goal: { de: 'Dein Revier übernehmen', en: 'Take over your territory' }, gender: 'female' }),
    C({ role: { de: 'Kommissarin der Mordkommission', en: 'Homicide detective' }, description: { de: 'Hartnäckig und unbestechlich.', en: 'Persistent and incorruptible.' }, stance: 'rival', affinity: -15, trust: 20, loyalty: 0, personality: [{ de: 'hartnäckig', en: 'persistent' }, { de: 'gerecht', en: 'righteous' }], goal: { de: 'Dich hinter Gitter bringen', en: 'Put you behind bars' }, gender: 'female' }),
  ],
  romance: [
    C({ role: { de: 'Neue Bekanntschaft', en: 'New acquaintance' }, description: { de: 'Charmant, rätselhaft, schwer zu lesen.', en: 'Charming, mysterious, hard to read.' }, stance: 'love', affinity: 30, trust: 40, loyalty: 40, personality: [{ de: 'charmant', en: 'charming' }, { de: 'zurückhaltend', en: 'reserved' }], goal: { de: 'Herausfinden, ob du es ernst meinst', en: 'Find out if you are serious' }, secret: { de: 'Hat sich gerade erst aus einer Beziehung gelöst.', en: 'Has only just left a relationship.' }, gender: 'female' }),
    C({ role: { de: 'Bester Freund', en: 'Best friend' }, description: { de: 'Kennt dich besser als du selbst.', en: 'Knows you better than you do.' }, stance: 'friend', affinity: 65, trust: 75, loyalty: 80, personality: [{ de: 'loyal', en: 'loyal' }, { de: 'ehrlich', en: 'honest' }], goal: { de: 'Dich vor Dummheiten bewahren', en: 'Keep you from doing something stupid' }, secret: { de: 'Ist heimlich in dich verliebt.', en: 'Is secretly in love with you.' }, gender: 'male' }),
    C({ role: { de: 'Ex-Partnerin', en: 'Ex-partner' }, description: { de: 'Die Trennung ist nicht lange her.', en: 'The breakup was not long ago.' }, stance: 'ex', affinity: -5, trust: 30, loyalty: 20, personality: [{ de: 'leidenschaftlich', en: 'passionate' }, { de: 'verletzt', en: 'hurt' }], goal: { de: 'Abschließen – oder zurückkommen', en: 'Move on – or come back' }, gender: 'female' }),
  ],
  politics: [
    C({ role: { de: 'Wahlkampfberater', en: 'Campaign adviser' }, description: { de: 'Brillant und zynisch.', en: 'Brilliant and cynical.' }, stance: 'ally', affinity: 35, trust: 60, loyalty: 55, personality: [{ de: 'scharfsinnig', en: 'sharp' }, { de: 'zynisch', en: 'cynical' }], goal: { de: 'Den Sieg um jeden Preis', en: 'Victory at any price' }, gender: 'male' }),
    C({ role: { de: 'Gegenkandidatin', en: 'Rival candidate' }, description: { de: 'Beliebt, angriffslustig, gut vernetzt.', en: 'Popular, combative, well connected.' }, stance: 'rival', affinity: -30, trust: 15, loyalty: 0, personality: [{ de: 'angriffslustig', en: 'combative' }, { de: 'charismatisch', en: 'charismatic' }], goal: { de: 'Dich schlagen', en: 'Beat you' }, gender: 'female' }),
    C({ role: { de: 'Investigativjournalistin', en: 'Investigative journalist' }, description: { de: 'Gräbt in deiner Vergangenheit.', en: 'Digs into your past.' }, stance: 'neutral', affinity: 0, trust: 30, loyalty: 0, personality: [{ de: 'neugierig', en: 'curious' }, { de: 'unbestechlich', en: 'incorruptible' }], goal: { de: 'Die Wahrheit veröffentlichen', en: 'Publish the truth' }, gender: 'female' }),
  ],
  business: [
    C({ role: { de: 'Geschäftspartner', en: 'Business partner' }, description: { de: 'Hat mit dir gegründet – und eigene Pläne.', en: 'Founded the company with you – and has plans of his own.' }, stance: 'ally', affinity: 30, trust: 55, loyalty: 45, personality: [{ de: 'ehrgeizig', en: 'ambitious' }, { de: 'pragmatisch', en: 'pragmatic' }], goal: { de: 'Mehr Kontrolle über die Firma', en: 'More control over the company' }, secret: { de: 'Verhandelt heimlich mit einem Käufer.', en: 'Is secretly negotiating with a buyer.' }, gender: 'male' }),
    C({ role: { de: 'Investorin', en: 'Investor' }, description: { de: 'Geduldig – solange die Zahlen stimmen.', en: 'Patient – as long as the numbers add up.' }, stance: 'neutral', affinity: 10, trust: 45, loyalty: 20, personality: [{ de: 'kühl', en: 'cool' }, { de: 'analytisch', en: 'analytical' }], goal: { de: 'Ihre Rendite', en: 'Her return' }, gender: 'female' }),
    C({ role: { de: 'Konkurrent', en: 'Competitor' }, description: { de: 'Größer, schneller, rücksichtslos.', en: 'Bigger, faster, ruthless.' }, stance: 'rival', affinity: -30, trust: 10, loyalty: 0, personality: [{ de: 'rücksichtslos', en: 'ruthless' }, { de: 'selbstsicher', en: 'confident' }], goal: { de: 'Dich vom Markt drängen', en: 'Push you out of the market' }, gender: 'male' }),
  ],
  fame: [
    C({ role: { de: 'Managerin', en: 'Manager' }, description: { de: 'Organisiert dein Leben – und verdient daran.', en: 'Organises your life – and profits from it.' }, stance: 'ally', affinity: 25, trust: 50, loyalty: 50, personality: [{ de: 'tüchtig', en: 'efficient' }, { de: 'kontrollierend', en: 'controlling' }], goal: { de: 'Deine Karriere – und ihre Provision', en: 'Your career – and her commission' }, gender: 'female' }),
    C({ role: { de: 'Paparazzo', en: 'Paparazzo' }, description: { de: 'Immer da, wenn es schiefgeht.', en: 'Always there when things go wrong.' }, stance: 'rival', affinity: -20, trust: 5, loyalty: 0, personality: [{ de: 'aufdringlich', en: 'pushy' }, { de: 'gerissen', en: 'cunning' }], goal: { de: 'Das Foto, das dich ruiniert', en: 'The photo that ruins you' }, gender: 'male' }),
    C({ role: { de: 'Jugendfreundin', en: 'Childhood friend' }, description: { de: 'Kennt dich von vor dem Ruhm.', en: 'Knew you before the fame.' }, stance: 'friend', affinity: 55, trust: 70, loyalty: 70, personality: [{ de: 'bodenständig', en: 'down-to-earth' }, { de: 'ehrlich', en: 'honest' }], goal: { de: 'Dich nicht an den Ruhm verlieren', en: 'Not lose you to fame' }, gender: 'female' }),
  ],
  drama: [
    C({ role: { de: 'Beste Freundin', en: 'Best friend' }, description: { de: 'Immer ehrlich, manchmal zu ehrlich.', en: 'Always honest, sometimes too honest.' }, stance: 'friend', affinity: 60, trust: 70, loyalty: 70, personality: [{ de: 'direkt', en: 'direct' }, { de: 'warmherzig', en: 'warm' }], goal: { de: 'Ein besseres Leben für sich', en: 'A better life for herself' }, gender: 'female' }),
    C({ role: { de: 'Chef', en: 'Boss' }, description: { de: 'Fordernd und unberechenbar.', en: 'Demanding and unpredictable.' }, stance: 'boss', affinity: -5, trust: 35, loyalty: 20, personality: [{ de: 'fordernd', en: 'demanding' }, { de: 'launisch', en: 'moody' }], goal: { de: 'Ergebnisse – um jeden Preis', en: 'Results – at any price' }, gender: 'male' }),
    C({ role: { de: 'Nachbar', en: 'Neighbour' }, description: { de: 'Weiß mehr, als er sagt.', en: 'Knows more than he says.' }, stance: 'neutral', affinity: 10, trust: 40, loyalty: 20, personality: [{ de: 'neugierig', en: 'curious' }, { de: 'freundlich', en: 'friendly' }], goal: { de: 'Nicht allein sein', en: 'Not be alone' }, secret: { de: 'Hat etwas Wichtiges beobachtet.', en: 'Has seen something important.' }, gender: 'male' }),
  ],
};

export const DEFAULT_SETTING: Record<LifeGenre, L> = {
  crime: { de: 'eine Hafenstadt, in der nachts andere Regeln gelten', en: 'a harbour city where different rules apply at night' },
  romance: { de: 'eine lebendige Großstadt mit kleinen Cafés und langen Nächten', en: 'a lively city of small cafés and long nights' },
  politics: { de: 'die Hauptstadt wenige Wochen vor einer wichtigen Wahl', en: 'the capital a few weeks before an important election' },
  business: { de: 'eine Wirtschaftsmetropole mit gläsernen Türmen', en: 'a business metropolis of glass towers' },
  fame: { de: 'eine Stadt der Studios, Bühnen und Blitzlichter', en: 'a city of studios, stages and flashbulbs' },
  drama: { de: 'eine ganz normale Stadt mit ganz normalen Sorgen', en: 'an ordinary city with ordinary worries' },
};

export const OPENING: L = {
  de: 'Die Geschichte beginnt. {setting} – und mittendrin {player}, {role}. {situation}',
  en: 'The story begins. {setting} – and in the middle of it all {player}, {role}. {situation}',
};

export const TIME_PASSES: L = {
  de: 'Einige Tage vergehen. Das Leben in {location} geht weiter – mit oder ohne dein Zutun.',
  en: 'A few days pass. Life in {location} goes on – with or without you.',
};

export const AWAY_INTRO: L = {
  de: 'Während du weg warst, hat sich einiges getan.',
  en: 'While you were away, things happened.',
};
