import type { DecisionTemplate } from './decisionTemplates';
import type { L } from './seedWorlds';

/**
 * Entscheidungen für Dating-Welten. Sie wirken über die bestehenden Spielregeln (Zuneigung, Beziehungsart,
 * Ansehen, Weltzustand, Handlungsbögen) – nie explizit, mit erwachsenen Figuren.
 */
export const DATING_INTRO_DECISION: DecisionTemplate = {
  id: 'dating-intro',
  needs: 'none',
  title: { de: 'Neu im Viertel: {world}', en: 'New in the neighbourhood: {world}' },
  description: {
    de: 'Im Café wird getuschelt: Wer ist die neue Person? Wie möchtest du hier ankommen?',
    en: 'There is whispering in the café: who is the newcomer? How do you want to arrive here?',
  },
  options: [
    {
      id: 'open-heart',
      label: { de: 'Offen auf alle zugehen', en: 'Approach everyone openly' },
      outcome: {
        de: '{player} grüßt, lacht und stellt Fragen. Man mag {player} sofort.',
        en: '{player} says hello, laughs and asks questions. People like {player} right away.',
      },
      reputation: 4,
      networkAffinity: 10,
      metrics: { harmony: 3 },
    },
    {
      id: 'mysterious',
      label: { de: 'Geheimnisvoll bleiben', en: 'Stay mysterious' },
      outcome: {
        de: '{player} gibt wenig preis. Genau das macht neugierig – und sorgt für Gesprächsstoff.',
        en: '{player} reveals little. That is exactly what makes people curious – and gets them talking.',
      },
      influence: 6,
      followers: 80,
      metrics: { discovery: 4 },
    },
    {
      id: 'friends-first',
      label: { de: 'Erst einmal Freundschaften schließen', en: 'Make friends first' },
      outcome: {
        de: '{player} sucht keine Romanze, sondern einen Platz am Stammtisch. Das kommt gut an.',
        en: '{player} isn\'t looking for romance but for a seat at the regulars\' table. That goes down well.',
      },
      reputation: 3,
      networkAffinity: 8,
      metrics: { harmony: 2 },
    },
    {
      id: 'charm',
      label: { de: 'Mit Charme und Witz auftreten', en: 'Make an entrance with charm and wit' },
      outcome: {
        de: '{player} bringt die ganze Runde zum Lachen. Mehr als eine Person schaut zweimal hin.',
        en: '{player} makes the whole table laugh. More than one person looks twice.',
      },
      reputation: 3,
      networkAffinity: 14,
      requires: { skill: 'charisma', level: 1 },
    },
  ],
};

export const DATING_DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: 'date-invite',
    needs: 'npc',
    title: { de: '{npc} fragt nach einem Treffen', en: '{npc} asks to meet up' },
    description: {
      de: '{npc} hat dir geschrieben: „Hast du Lust auf einen Kaffee – nur wir zwei?“ Was antwortest du?',
      en: '{npc} has messaged you: "Fancy a coffee – just the two of us?" What do you answer?',
    },
    options: [
      {
        id: 'first-date',
        label: { de: 'Zu einem ersten Date zusagen', en: 'Say yes to a first date' },
        outcome: {
          de: '{player} und {npc} verbringen einen langen Abend am Kanal. Es knistert – ganz vorsichtig.',
          en: '{player} and {npc} spend a long evening by the canal. There are sparks – very carefully.',
        },
        affinity: [{ target: 'npc', delta: 14, becomes: 'romance', minAffinity: 35 }],
        metrics: { harmony: 2 },
        arcPath: 'bold',
      },
      {
        id: 'as-friends',
        label: { de: 'Gern – aber als Freunde', en: 'Sure – but as friends' },
        outcome: {
          de: '{player} sagt ehrlich, was {player} sucht. {npc} ist kurz still – und dann erleichtert.',
          en: '{player} says honestly what {player} is looking for. {npc} goes quiet for a moment – then seems relieved.',
        },
        reputation: 3,
        affinity: [{ target: 'npc', delta: 8, becomes: 'friend', minAffinity: 20 }],
        arcPath: 'diplomatic',
      },
      {
        id: 'decline-kindly',
        label: { de: 'Freundlich absagen', en: 'Decline kindly' },
        outcome: {
          de: '{player} sagt behutsam ab. {npc} ist enttäuscht, schätzt aber die Ehrlichkeit.',
          en: '{player} declines gently. {npc} is disappointed but values the honesty.',
        },
        reputation: 2,
        affinity: [{ target: 'npc', delta: -4 }],
        arcPath: 'neutral',
      },
      {
        id: 'special-date',
        label: { de: 'Ein besonderes Date planen', en: 'Plan a special date' },
        outcome: {
          de: '{player} organisiert ein Picknick unter Lichterketten. {npc} erzählt noch tagelang davon.',
          en: '{player} organises a picnic under string lights. {npc} talks about it for days.',
        },
        followers: 40,
        affinity: [{ target: 'npc', delta: 20, becomes: 'romance', minAffinity: 30 }],
        metrics: { harmony: 3 },
        requires: { skill: 'charisma', level: 1 },
      },
    ],
  },
  {
    id: 'misunderstanding',
    needs: 'npc',
    title: { de: 'Ein Missverständnis mit {npc}', en: 'A misunderstanding with {npc}' },
    description: {
      de: '{npc} hat eine Nachricht von dir falsch verstanden und ist gekränkt. Im Viertel wird schon geredet.',
      en: '{npc} misread one of your messages and feels hurt. The neighbourhood is already talking.',
    },
    options: [
      {
        id: 'apologize',
        label: { de: 'Ehrlich entschuldigen', en: 'Apologise honestly' },
        outcome: {
          de: '{player} entschuldigt sich ohne Ausreden. {npc} atmet auf – das Eis ist gebrochen.',
          en: '{player} apologises without excuses. {npc} breathes a sigh of relief – the ice is broken.',
        },
        reputation: 3,
        affinity: [{ target: 'npc', delta: 12 }],
        metrics: { harmony: 3, tension: -2 },
      },
      {
        id: 'explain',
        label: { de: 'In Ruhe erklären, wie es gemeint war', en: 'Calmly explain what you meant' },
        outcome: {
          de: '{player} erklärt alles in Ruhe. {npc} versteht – ein bisschen Distanz bleibt.',
          en: '{player} explains everything calmly. {npc} understands – a little distance remains.',
        },
        reputation: 2,
        affinity: [{ target: 'npc', delta: 6 }],
      },
      {
        id: 'wait',
        label: { de: 'Abwarten, bis es sich legt', en: 'Wait for it to blow over' },
        outcome: {
          de: '{player} schweigt. {npc} fühlt sich ignoriert – das Missverständnis wächst.',
          en: '{player} stays silent. {npc} feels ignored – the misunderstanding grows.',
        },
        affinity: [{ target: 'npc', delta: -9 }],
        metrics: { tension: 3 },
      },
      {
        id: 'heartfelt',
        label: { de: 'Eine persönliche Nachricht schreiben', en: 'Write a heartfelt message' },
        outcome: {
          de: '{player} schreibt ehrlich, was {npc} {player} bedeutet. {npc} antwortet mit einem Herz.',
          en: '{player} writes honestly what {npc} means to {player}. {npc} replies with a heart.',
        },
        affinity: [{ target: 'npc', delta: 18 }],
        metrics: { harmony: 4 },
        requires: { skill: 'charisma', level: 2 },
      },
    ],
  },
  {
    id: 'jealousy',
    needs: 'pair',
    title: { de: 'Eifersucht zwischen {a} und {b}', en: 'Jealousy between {a} and {b}' },
    description: {
      de: '{a} hat {b} mit jemand anderem im Café gesehen – jetzt hängt der Haussegen schief. Beide erwarten, dass du Stellung beziehst.',
      en: '{a} saw {b} with someone else at the café – now things are tense. Both expect you to take a stand.',
    },
    options: [
      {
        id: 'mediate',
        label: { de: 'Ein klärendes Gespräch vermitteln', en: 'Arrange a clearing conversation' },
        outcome: {
          de: '{player} bringt {a} und {b} an einen Tisch. Das Missverständnis löst sich auf.',
          en: '{player} brings {a} and {b} together. The misunderstanding dissolves.',
        },
        reputation: 5,
        affinity: [
          { target: 'a', delta: 6 },
          { target: 'b', delta: 6 },
        ],
        metrics: { harmony: 4, tension: -3 },
      },
      {
        id: 'side-a',
        label: { de: 'Zu {a} halten', en: 'Side with {a}' },
        outcome: { de: '{player} steht zu {a}. {b} fühlt sich im Stich gelassen.', en: '{player} stands by {a}. {b} feels let down.' },
        affinity: [
          { target: 'a', delta: 12 },
          { target: 'b', delta: -10 },
        ],
        metrics: { tension: 3 },
      },
      {
        id: 'side-b',
        label: { de: 'Zu {b} halten', en: 'Side with {b}' },
        outcome: { de: '{player} steht zu {b}. {a} ist gekränkt.', en: '{player} stands by {b}. {a} is hurt.' },
        affinity: [
          { target: 'b', delta: 12 },
          { target: 'a', delta: -10 },
        ],
        metrics: { tension: 3 },
      },
      {
        id: 'stay-out',
        label: { de: 'Sich heraushalten', en: 'Stay out of it' },
        outcome: { de: '{player} hält sich raus. Die beiden müssen das allein klären.', en: '{player} stays out. The two have to sort it out alone.' },
        metrics: { discovery: 2 },
      },
      {
        id: 'honest-round',
        label: { de: 'Alle Beteiligten ehrlich zusammenbringen', en: 'Bring everyone together honestly' },
        outcome: {
          de: '{player} moderiert ein offenes Gespräch. Am Ende lachen {a} und {b} sogar darüber.',
          en: '{player} moderates an open conversation. In the end {a} and {b} even laugh about it.',
        },
        reputation: 6,
        affinity: [
          { target: 'a', delta: 10 },
          { target: 'b', delta: 10 },
        ],
        metrics: { harmony: 6, tension: -4 },
        requires: { skill: 'negotiation', level: 1 },
      },
    ],
  },
  {
    id: 'triangle',
    needs: 'pair',
    title: { de: '{a} oder {b}?', en: '{a} or {b}?' },
    description: {
      de: 'Zwischen dir, {a} und {b} knistert es. Beide hoffen auf ein Zeichen – und das ganze Viertel schaut zu.',
      en: 'There are sparks between you, {a} and {b}. Both are hoping for a sign – and the whole neighbourhood is watching.',
    },
    options: [
      {
        id: 'choose-a',
        label: { de: 'Sich für {a} entscheiden', en: 'Choose {a}' },
        outcome: {
          de: '{player} lädt {a} zum Lichterfest ein. {b} nimmt es mit Fassung – aber es tut weh.',
          en: '{player} invites {a} to the festival of lights. {b} takes it with composure – but it hurts.',
        },
        affinity: [
          { target: 'a', delta: 15, becomes: 'romance', minAffinity: 30 },
          { target: 'b', delta: -12 },
        ],
        metrics: { tension: 2 },
        arcPath: 'bold',
      },
      {
        id: 'choose-b',
        label: { de: 'Sich für {b} entscheiden', en: 'Choose {b}' },
        outcome: {
          de: '{player} entscheidet sich für {b}. {a} zieht sich still zurück.',
          en: '{player} chooses {b}. {a} quietly withdraws.',
        },
        affinity: [
          { target: 'b', delta: 15, becomes: 'romance', minAffinity: 30 },
          { target: 'a', delta: -12 },
        ],
        metrics: { tension: 2 },
        arcPath: 'bold',
      },
      {
        id: 'honest-both',
        label: { de: 'Ehrlich zu beiden sein und sich Zeit nehmen', en: 'Be honest with both and take time' },
        outcome: {
          de: '{player} sagt beiden die Wahrheit: Es ist noch zu früh. Beide respektieren das.',
          en: '{player} tells both the truth: it\'s still too early. Both respect that.',
        },
        reputation: 5,
        affinity: [
          { target: 'a', delta: 4 },
          { target: 'b', delta: 4 },
        ],
        arcPath: 'diplomatic',
      },
      {
        id: 'friends-both',
        label: { de: 'Mit beiden befreundet bleiben', en: 'Stay friends with both' },
        outcome: {
          de: '{player} entscheidet sich gegen eine Romanze – und gewinnt zwei gute Freunde.',
          en: '{player} decides against a romance – and gains two good friends.',
        },
        affinity: [
          { target: 'a', delta: 6, becomes: 'friend', minAffinity: -100 },
          { target: 'b', delta: 6, becomes: 'friend', minAffinity: -100 },
        ],
        metrics: { harmony: 3 },
        arcPath: 'neutral',
      },
    ],
  },
  {
    id: 'second-chance',
    needs: 'npc',
    title: { de: 'Eine zweite Chance für {npc}?', en: 'A second chance for {npc}?' },
    description: {
      de: 'Nach einer Funkstille meldet sich {npc}: „Es tut mir leid. Darf ich es wiedergutmachen?“',
      en: 'After a period of silence {npc} gets in touch: "I\'m sorry. Can I make it up to you?"',
    },
    options: [
      {
        id: 'give-chance',
        label: { de: 'Eine zweite Chance geben', en: 'Give a second chance' },
        outcome: {
          de: '{player} gibt {npc} eine zweite Chance – mit klaren Worten, was sich ändern muss.',
          en: '{player} gives {npc} a second chance – with clear words about what has to change.',
        },
        affinity: [{ target: 'npc', delta: 15, becomes: 'romance', minAffinity: 40 }],
        metrics: { harmony: 2 },
      },
      {
        id: 'friendship',
        label: { de: 'Freundschaft anbieten', en: 'Offer friendship' },
        outcome: {
          de: '{player} möchte keine Romanze mehr, aber {npc} nicht verlieren. Ein neuer Anfang.',
          en: '{player} no longer wants a romance but doesn\'t want to lose {npc}. A new beginning.',
        },
        reputation: 2,
        affinity: [{ target: 'npc', delta: 6, becomes: 'friend', minAffinity: -100 }],
      },
      {
        id: 'move-on',
        label: { de: 'Weiterziehen', en: 'Move on' },
        outcome: {
          de: '{player} wünscht {npc} alles Gute und blickt nach vorn.',
          en: '{player} wishes {npc} all the best and looks ahead.',
        },
        reputation: 2,
        affinity: [{ target: 'npc', delta: -6 }],
        metrics: { discovery: 3 },
      },
    ],
  },
  {
    id: 'speed-dating',
    needs: 'none',
    title: { de: 'Speed-Dating-Abend in {world}', en: 'Speed dating night in {world}' },
    description: {
      de: 'Heute Abend: Speed-Dating mit Kuchen und Lichterketten. Bist du dabei?',
      en: 'Tonight: speed dating with cake and string lights. Are you in?',
    },
    options: [
      {
        id: 'join',
        label: { de: 'Mitmachen', en: 'Join in' },
        outcome: { de: '{player} lernt an einem Abend mehr Leute kennen als in einem Monat.', en: '{player} meets more people in one evening than in a month.' },
        followers: 60,
        metrics: { harmony: 2, discovery: 2 },
      },
      {
        id: 'host',
        label: { de: 'Den Abend moderieren', en: 'Host the evening' },
        outcome: { de: '{player} führt charmant durch den Abend. Alle reden darüber.', en: '{player} hosts the evening charmingly. Everyone is talking about it.' },
        influence: 6,
        reputation: 3,
        followers: 90,
        requires: { skill: 'media', level: 1 },
      },
      {
        id: 'skip',
        label: { de: 'Lieber einen ruhigen Abend', en: 'Prefer a quiet evening' },
        outcome: { de: '{player} bleibt zu Hause – und hört später die besten Geschichten.', en: '{player} stays home – and hears the best stories later.' },
        metrics: { discovery: 2 },
      },
    ],
  },
  {
    id: 'storyline',
    needs: 'storyline',
    title: { de: '{storyline}: {stage}', en: '{storyline}: {stage}' },
    description: {
      de: 'In „{storyline}“ steht ein Wendepunkt an. Wie mischst du dich ein?',
      en: '"{storyline}" is at a turning point. How do you get involved?',
    },
    options: [
      {
        id: 'push',
        label: { de: 'Mut machen: „Sag, was du fühlst!“', en: 'Encourage: "Say what you feel!"' },
        outcome: { de: '{player} ermutigt alle zur Offenheit. „{storyline}“ nimmt Fahrt auf.', en: '{player} encourages everyone to be open. "{storyline}" picks up speed.' },
        influence: 4,
        metrics: { tension: 3 },
        advanceStoryline: true,
        arcPath: 'bold',
      },
      {
        id: 'support',
        label: { de: 'Behutsam vermitteln', en: 'Mediate gently' },
        outcome: { de: '{player} hört zu und vermittelt leise. Die Beteiligten finden Worte.', en: '{player} listens and quietly mediates. Everyone involved finds words.' },
        reputation: 5,
        metrics: { harmony: 3 },
        arcPath: 'diplomatic',
      },
      {
        id: 'stay-out',
        label: { de: 'Raum lassen', en: 'Give them space' },
        outcome: { de: '{player} lässt den Beteiligten Zeit. Manches muss reifen.', en: '{player} gives everyone time. Some things need to mature.' },
        metrics: { discovery: 2 },
        arcPath: 'neutral',
      },
      {
        id: 'perfect-moment',
        label: { de: 'Den perfekten Moment vorbereiten', en: 'Prepare the perfect moment' },
        outcome: {
          de: '{player} sorgt für Lichterketten, Musik und den richtigen Augenblick. Die Geschichte wagt den nächsten Schritt.',
          en: '{player} arranges string lights, music and the right moment. The story dares the next step.',
        },
        influence: 5,
        reputation: 2,
        advanceStoryline: true,
        arcPath: 'bold',
        requires: { skill: 'strategy', level: 1 },
      },
      {
        id: 'heart-to-heart',
        label: { de: 'Alle zu einem ehrlichen Gespräch bewegen', en: 'Get everyone to talk honestly' },
        outcome: {
          de: '{player} bringt alle zu einem offenen Gespräch zusammen. „{storyline}“ steuert auf ein versöhnliches Ende zu.',
          en: '{player} gets everyone to talk openly. "{storyline}" is heading for a reconciling ending.',
        },
        reputation: 6,
        metrics: { harmony: 4, tension: -4 },
        advanceStoryline: true,
        arcPath: 'diplomatic',
        arcWeight: 2,
        requires: { skill: 'negotiation', level: 2 },
      },
    ],
  },
];

/** Simulierte (regelbasierte) Antworten zu Liebe, Dates und Gefühlen – warm und nicht explizit. */
export const ROMANCE_REPLIES: L[] = [
  { de: 'Ach, das Herz. Ehrlich gesagt hilft mir dann ein Spaziergang am Kanal und ein ehrliches Gespräch.', en: 'Ah, the heart. Honestly, a walk by the canal and an honest conversation help me most.' },
  { de: 'Erste Dates sind wie neue Bücher: Man weiß nie, ob man nach drei Seiten bleibt – aber genau das ist spannend.', en: 'First dates are like new books: you never know if you\'ll stay after three pages – that\'s what makes it exciting.' },
  { de: 'Eifersucht sagt meistens mehr über die eigenen Ängste als über den anderen. Hast du schon mit der Person gesprochen?', en: 'Jealousy usually says more about our own fears than about the other person. Have you talked to them yet?' },
  { de: 'Manchmal ist die schönste Antwort: „Lass uns erst Freunde sein.“ Daraus wächst oft das Beste.', en: 'Sometimes the nicest answer is: "Let\'s be friends first." The best things often grow from that.' },
  { de: 'Zweite Chancen verdient, wer ehrlich sagt, was schiefgelaufen ist. Alles andere ist nur ein hübsches Versprechen.', en: 'Second chances are earned by people who say honestly what went wrong. Everything else is just a pretty promise.' },
  { de: 'Nach einer Trennung darf man traurig sein – und trotzdem schon auf den nächsten Kaffee mit Freunden freuen.', en: 'After a breakup you\'re allowed to be sad – and still look forward to the next coffee with friends.' },
];
