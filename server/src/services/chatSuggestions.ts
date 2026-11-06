/**
 * Vier Antwortvorschläge für Social-Chats (klug, alternativ, riskant, überraschend) – regelbasiert aus der
 * letzten Antwort, den Interessen der Figur und dem Weltgeschehen. Kostet keinen zusätzlichen KI-Aufruf und
 * verlängert die Antwortzeit der lokalen KI nicht.
 */
import type { Lang } from '../../../shared/constants';
import type { SuggestionKind } from '../../../shared/life';
import type { ChatSuggestion } from '../../../shared/types';
import { createRng } from '../lib/rng';
import { fill, truncate } from '../lib/text';

type L = Record<Lang, string>;
interface Template {
  text: L;
  needs?: 'topic' | 'interest' | 'event' | 'question' | 'dating' | 'tense';
}
const T = (de: string, en: string, needs?: Template['needs']): Template => ({ text: { de, en }, needs });

const TEMPLATES: Record<SuggestionKind, Template[]> = {
  smart: [
    T('Erzähl mir mehr über {topic} – was bedeutet dir das?', 'Tell me more about {topic} – what does it mean to you?', 'topic'),
    T('Gute Frage. Ehrlich gesagt bin ich mir noch nicht sicher – wie würdest du es machen?', "Good question. Honestly, I'm not sure yet – how would you do it?", 'question'),
    T('Das klingt, als würde dich {topic} wirklich beschäftigen. Kann ich dir irgendwie helfen?', 'Sounds like {topic} really matters to you. Can I help somehow?', 'topic'),
    T('Wie bist du eigentlich zu {interest} gekommen?', 'How did you get into {interest} in the first place?', 'interest'),
    T('Ich glaube, wir haben uns falsch verstanden. Lass uns noch mal in Ruhe darüber reden.', "I think we misunderstood each other. Let's talk about it again calmly.", 'tense'),
    T('Was würdest du an meiner Stelle als Nächstes tun?', 'What would you do next if you were me?'),
  ],
  alternative: [
    T('Lass uns mal über etwas anderes reden – wie stehst du zu {interest}?', "Let's talk about something else – what do you think about {interest}?", 'interest'),
    T('Hast du eigentlich mitbekommen: „{event}“? Was hältst du davon?', 'Did you hear about "{event}"? What do you make of it?', 'event'),
    T('Was hast du heute eigentlich noch vor?', 'What are you up to for the rest of the day?'),
    T('Erzähl mal: Was war der schönste Moment deiner letzten Woche?', 'Tell me: what was the best moment of your last week?'),
    T('Ich mach mal einen Themenwechsel: Was hat dich zuletzt richtig überrascht?', "Change of topic: what surprised you most recently?"),
  ],
  risky: [
    T('Ehrlich? Das kaufe ich dir nicht ganz ab.', "Honestly? I don't quite buy that."),
    T('Ich habe das Gefühl, du verschweigst mir etwas bei {topic}.', "I have a feeling you're hiding something about {topic}.", 'topic'),
    T('Ganz ehrlich: Da liegst du falsch – und das weißt du auch.', 'Honestly: you are wrong about that – and you know it.'),
    T('Ich muss gestehen: Ich denke ziemlich oft an dich.', 'I have to admit: I think about you quite a lot.', 'dating'),
    T('Und wenn ich dich einfach auf ein Date einlade – heute Abend?', 'What if I just asked you out – tonight?', 'dating'),
    T('Dann sag es mir doch direkt ins Gesicht, statt um den heißen Brei zu reden.', 'Then say it to my face instead of beating around the bush.', 'tense'),
  ],
  surprising: [
    T('Was wäre, wenn wir morgen einfach alles stehen und liegen lassen und wegfahren?', 'What if we dropped everything tomorrow and just left town?'),
    T('Ich muss dir etwas erzählen, das noch niemand weiß.', "I need to tell you something nobody knows yet."),
    T('Wette: Ich errate dein größtes Geheimnis in drei Versuchen.', 'Bet I can guess your biggest secret in three tries.'),
    T('Spontane Frage: Wenn du ein Jahr frei hättest – was würdest du tun?', 'Random question: if you had a year off, what would you do?'),
    T('Lass uns {interest} zusammen ausprobieren – diese Woche noch.', "Let's try {interest} together – this week.", 'interest'),
    T('Ich habe eine verrückte Idee, wie wir beide berühmt werden könnten.', 'I have a crazy idea how we could both become famous.'),
  ],
};

const STOP = new Set(
  'aber alle allem also auch auf aus bei bin bis bist dann das dass dein deine dem den der des dich die dir doch dort du ein eine einem einen einer eines er es etwas euch für hab habe hast hat hatte ich ihr ihre im in ist ja jetzt kann kannst kein keine mal man mehr mein meine mich mir mit muss nach nicht nichts noch nur ob oder schon sehr sein seine sich sie sind so über um und uns unser viel vom von vor war was weil wenn wer wie wieder wir wird wirklich wo zu zum zur heute gerade immer einfach eigentlich wirklich vielleicht genau about after again also and are because been but can could did does doing from have here how into just know like more much not now only really should some that the their them then there these they this very want was were what when where which while who why will with would you your yours yeah okay'.split(
    ' ',
  ),
);

/** Ein Thema aus der letzten Antwort: bevorzugt ein Interesse der Figur, sonst ein auffälliges Substantiv. */
export function topicOf(reply: string, interests: string[], exclude: string[]): string | null {
  const lower = reply.toLowerCase();
  const interest = interests.find((i) => i.length > 2 && lower.includes(i.toLowerCase()));
  if (interest) return interest;
  const banned = new Set(exclude.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const words = reply
    .replace(/[„“"«»()[\]]/g, ' ')
    .split(/[\s,.;:!?–-]+/)
    .filter((w, i, arr) => w.length >= 5 && !STOP.has(w.toLowerCase()) && !banned.has(w.toLowerCase()) && /^\p{L}+$/u.test(w) && (i === 0 || !/[.!?]$/.test(arr[i - 1] ?? '')));
  // Deutsche Substantive sind großgeschrieben – innerhalb eines Satzes ein gutes Signal für ein Thema.
  const nouns = words.filter((w, i) => i > 0 && /^\p{Lu}/u.test(w));
  const pick = (nouns.length ? nouns : words).sort((a, b) => b.length - a.length)[0];
  return pick ? truncate(pick, 30) : null;
}

export interface ChatSuggestionInput {
  lang: Lang;
  reply: string;
  interests: string[];
  names: string[];
  event: string | null;
  dating: boolean;
  tone: 'warm' | 'neutral' | 'tense';
  seed: string;
  /** Zuletzt gezeigte Vorschläge (keine Wiederholung). */
  recent: string[];
}

export function chatSuggestions(i: ChatSuggestionInput): ChatSuggestion[] {
  const rng = createRng(`chat-suggestions:${i.seed}`);
  const topic = topicOf(i.reply, i.interests, i.names);
  const interest = i.interests.length ? rng.pick(i.interests) : null;
  const values: Record<string, string> = { topic: topic ?? '', interest: interest ?? '', event: i.event ?? '' };
  const question = /\?\s*$/.test(i.reply.trim()) || /\?\s/.test(i.reply);
  const ok = (t: Template) =>
    t.needs === undefined ||
    (t.needs === 'topic' && Boolean(topic)) ||
    (t.needs === 'interest' && Boolean(interest)) ||
    (t.needs === 'event' && Boolean(i.event)) ||
    (t.needs === 'question' && question) ||
    (t.needs === 'dating' && i.dating) ||
    (t.needs === 'tense' && i.tone === 'tense');
  const recent = new Set(i.recent);
  const out: ChatSuggestion[] = [];
  for (const kind of ['smart', 'alternative', 'risky', 'surprising'] as const) {
    const candidates = TEMPLATES[kind].filter(ok).map((t) => fill(t.text[i.lang], values));
    // Situationsbezogene Vorlagen (mit Bedingung) zuerst, dann nicht kürzlich gezeigte.
    const fresh = candidates.filter((c) => !recent.has(c));
    const pool = fresh.length ? fresh : candidates;
    const specific = pool.filter((c) => TEMPLATES[kind].some((t) => t.needs && fill(t.text[i.lang], values) === c));
    const text = specific.length && rng.next() < 0.7 ? rng.pick(specific) : rng.pick(pool);
    out.push({ id: `${kind}-${out.length}`, kind, text });
  }
  return out;
}
