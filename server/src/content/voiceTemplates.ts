import type { WritingStyle } from '../../../shared/constants';
import type { L } from './seedWorlds';

type StyleTexts = Record<WritingStyle, L[]>;

/** Kommentare von Charakteren auf Nutzerbeiträge. Platzhalter: {user}, {tag}, {interest}. */
export const POST_REACTIONS: StyleTexts = {
  casual: [
    { de: 'Das gefällt mir, @{user}! Mehr davon.', en: 'Love this, @{user}! More please.' },
    { de: 'Ha, genau das habe ich heute gebraucht.', en: 'Ha, exactly what I needed today.' },
    { de: 'Guter Punkt, @{user}. Erinnert mich an {interest}.', en: 'Good point, @{user}. Reminds me of {interest}.' },
  ],
  formal: [
    { de: 'Ein bemerkenswerter Gedanke, @{user}. Ich werde darüber nachdenken.', en: 'A remarkable thought, @{user}. I shall consider it.' },
    { de: 'Vielen Dank für diesen Beitrag. Er verdient Aufmerksamkeit.', en: 'Thank you for this contribution. It deserves attention.' },
  ],
  poetic: [
    { de: 'Deine Worte tragen wie Wind durch Blätter, @{user}.', en: 'Your words drift like wind through leaves, @{user}.' },
    { de: 'Darin liegt ein leises Leuchten. Danke dafür.', en: 'There is a quiet glow in this. Thank you.' },
  ],
  terse: [
    { de: 'stark.', en: 'strong.' },
    { de: 'gesehen. gut.', en: 'seen. good.' },
    { de: 'mehr davon, @{user}.', en: 'more of this, @{user}.' },
  ],
  enthusiastic: [
    { de: 'WOW, @{user}! Das ist großartig!!', en: 'WOW, @{user}! This is amazing!!' },
    { de: 'Ich liebe es! Sofort gespeichert!', en: 'I love it! Saved immediately!' },
    { de: 'Das muss ich allen zeigen! #{tag} for the win!', en: 'I have to show everyone! #{tag} for the win!' },
  ],
  sarcastic: [
    { de: 'oh, wie originell. nein, ernsthaft – nicht schlecht, @{user}.', en: 'oh, how original. no, seriously – not bad, @{user}.' },
    { de: 'endlich mal jemand mit verstand hier.', en: 'finally someone with a brain around here.' },
  ],
  scholarly: [
    { de: 'Interessant – das wirft die Frage auf, welche Rolle {interest} dabei spielt.', en: 'Interesting – this raises the question of what role {interest} plays here.' },
    { de: 'Eine These, die ich gern genauer untersuchen würde, @{user}.', en: 'A thesis I would like to examine more closely, @{user}.' },
  ],
};

/** Antworten von Charakteren auf Kommentare des Nutzers. */
export const COMMENT_REPLIES: StyleTexts = {
  casual: [
    { de: '@{user} Danke dir! Schön, dass du vorbeischaust.', en: '@{user} Thanks! Nice of you to stop by.' },
    { de: '@{user} Haha, absolut. Wir sollten mal reden.', en: '@{user} Haha, absolutely. We should talk sometime.' },
  ],
  formal: [
    { de: '@{user} Vielen Dank für Ihre Rückmeldung.', en: '@{user} Thank you for your feedback.' },
    { de: '@{user} Ein berechtigter Einwand. Ich nehme ihn ernst.', en: '@{user} A fair point. I take it seriously.' },
  ],
  poetic: [
    { de: '@{user} Wie schön, dass deine Gedanken hierher gefunden haben.', en: '@{user} How lovely that your thoughts found their way here.' },
  ],
  terse: [
    { de: '@{user} danke.', en: '@{user} thanks.' },
    { de: '@{user} stimmt.', en: '@{user} true.' },
  ],
  enthusiastic: [
    { de: '@{user} JA! Genau so sehe ich das auch!', en: '@{user} YES! That\'s exactly how I see it!' },
    { de: '@{user} Du bist großartig, danke!!', en: '@{user} You\'re great, thank you!!' },
  ],
  sarcastic: [
    { de: '@{user} na sieh mal an, jemand hört zu.', en: '@{user} well look at that, someone\'s listening.' },
  ],
  scholarly: [
    { de: '@{user} Ein aufschlussreicher Kommentar – ich werde ihn in meine Überlegungen einbeziehen.', en: '@{user} An insightful comment – I shall include it in my considerations.' },
  ],
};

export const QUESTION_REPLY: L = {
  de: 'Gute Frage – darauf habe ich noch keine fertige Antwort.',
  en: 'Good question – I don\'t have a finished answer yet.',
};

/** Bausteine für lokale Demo-Antworten im Chat. */
export const CHAT = {
  greeting: {
    casual: [{ de: 'Hey{name}! Schön, von dir zu hören.', en: 'Hey{name}! Good to hear from you.' }],
    formal: [{ de: 'Guten Tag{name}. Es freut mich, dass Sie schreiben.', en: 'Good day{name}. I am glad you wrote.' }],
    poetic: [{ de: 'Sei gegrüßt{name} – wie ein Lichtstrahl durchs Blätterdach.', en: 'Greetings{name} – like a sunbeam through the canopy.' }],
    terse: [{ de: 'hi{name}.', en: 'hi{name}.' }],
    enthusiastic: [{ de: 'HALLO{name}! Wie schön, dass du da bist!', en: 'HELLO{name}! So great that you\'re here!' }],
    sarcastic: [{ de: 'oh, besuch{name}. selten.', en: 'oh, a visitor{name}. rare.' }],
    scholarly: [{ de: 'Willkommen{name}. Ein Gespräch ist stets eine Gelegenheit zur Erkenntnis.', en: 'Welcome{name}. A conversation is always an opportunity for insight.' }],
  } satisfies StyleTexts,
  reflect: {
    casual: [
      { de: '„{keyword}“ – erzähl mir mehr darüber.', en: '"{keyword}" – tell me more about that.' },
      { de: 'Klingt spannend. Was meinst du genau mit „{keyword}“?', en: 'Sounds exciting. What exactly do you mean by "{keyword}"?' },
    ],
    formal: [
      { de: 'Ihre Ausführungen zu „{keyword}“ sind aufschlussreich.', en: 'Your remarks on "{keyword}" are illuminating.' },
      { de: 'Darf ich nachfragen, was Sie mit „{keyword}“ verbinden?', en: 'May I ask what you associate with "{keyword}"?' },
    ],
    poetic: [
      { de: '„{keyword}“ – das Wort klingt nach, wie ein Echo im Wald.', en: '"{keyword}" – the word lingers, like an echo in the woods.' },
    ],
    terse: [
      { de: '{keyword}. hm.', en: '{keyword}. hm.' },
      { de: '{keyword}? weiter.', en: '{keyword}? go on.' },
    ],
    enthusiastic: [
      { de: '{keyword}?! Das ist ja spannend!', en: '{keyword}?! That\'s so exciting!' },
      { de: 'Oh, {keyword}! Davon will ich ALLES hören!', en: 'Oh, {keyword}! I want to hear EVERYTHING!' },
    ],
    sarcastic: [
      { de: '{keyword}. natürlich. was auch sonst.', en: '{keyword}. of course. what else.' },
      { de: 'ah, {keyword}. mein lieblingsthema. nicht.', en: 'ah, {keyword}. my favourite topic. not.' },
    ],
    scholarly: [
      { de: '„{keyword}“ ist ein faszinierender Ausgangspunkt (wenngleich die Quellenlage dünn ist).', en: '"{keyword}" is a fascinating starting point (although sources are thin).' },
    ],
  } satisfies StyleTexts,
  interest: [
    { de: 'Das erinnert mich an {interest}.', en: 'That reminds me of {interest}.' },
    { de: 'Bei mir dreht sich gerade viel um {interest}.', en: 'A lot of my time goes into {interest} right now.' },
    { de: 'Wenn ich ehrlich bin, denke ich dabei an {interest}.', en: 'To be honest, it makes me think of {interest}.' },
  ],
  memory: [
    { de: 'Du hattest erwähnt: {fact}', en: 'You mentioned: {fact}' },
    { de: 'Ich erinnere mich übrigens: {fact}', en: 'I remember, by the way: {fact}' },
  ],
  event: [
    { de: 'Hier ist übrigens einiges los: {event}.', en: 'By the way, a lot is going on here: {event}.' },
  ],
  whoAmI: { de: 'Ich bin {name}. {description}', en: 'I\'m {name}. {description}' },
  role: { de: 'Ich bin {role}. {tagline}', en: 'I\'m {role}. {tagline}' },
  interests: { de: 'Mich interessieren vor allem {interests}.', en: 'I\'m mostly into {interests}.' },
  world: { de: 'Ich lebe in {world}. {worldTagline}', en: 'I live in {world}. {worldTagline}' },
  relations: { de: 'Wichtig in meinem Leben: {relations}.', en: 'Important people in my life: {relations}.' },
  noRelations: { de: 'Ehrlich gesagt bin ich meistens für mich.', en: 'Honestly, I mostly keep to myself.' },
  feelings: {
    de: 'Das klingt nicht leicht. Ich bin da, wenn du reden willst.',
    en: 'That doesn\'t sound easy. I\'m here if you want to talk.',
  },
  thanks: { de: 'Gern geschehen.', en: 'You\'re welcome.' },
  fallback: [
    { de: 'Erzähl weiter, ich höre zu.', en: 'Go on, I\'m listening.' },
    { de: 'Interessant. Wie bist du darauf gekommen?', en: 'Interesting. How did you come to that?' },
    { de: 'Das muss ich erst einmal sacken lassen.', en: 'I need to let that sink in.' },
  ],
  question: [
    { de: 'Und du – was denkst du darüber?', en: 'And you – what do you think about it?' },
    { de: 'Was beschäftigt dich gerade am meisten?', en: 'What\'s on your mind the most right now?' },
  ],
};

/** Stilbeschreibungen für den KI-Systemprompt. */
export const STYLE_DESCRIPTIONS: Record<WritingStyle, string> = {
  casual: 'casual and friendly, conversational',
  formal: 'formal, polite and measured',
  poetic: 'poetic, rich in imagery, calm rhythm',
  terse: 'very short sentences, few words',
  enthusiastic: 'energetic and enthusiastic, exclamation marks',
  sarcastic: 'dry and sarcastic, but not cruel',
  scholarly: 'scholarly, precise, likes technical terms',
};

export const STOPWORDS = new Set(
  (
    'aber alle allem allen aller alles also auch auf aus bei beim bin bist bitte dann darum dass dein deine dem den der des dich die dir doch dort du durch eine einem einen einer eines etwas euch für gibt habe haben hast hat hatte heute hier ich ihr ihre immer ist jetzt kann kannst keine mal man mehr mein meine mich mir mit muss nach nicht noch nur oder schon sehr sein seine sich sie sind so über um und uns unser viel von vor war warum was weil welche wenn wer werden wie wieder wir wird wirklich wo zu zum zur ' +
    'about after again also and any are because been being but can could did does doing dont from have having her here hers him his how into its just like more most much not now off once only other our out over own same she should some such than that the their them then there these they this those through too under until very was were what when where which while who whom why will with would you your yours really maybe think thing things'
  ).split(/\s+/),
);
