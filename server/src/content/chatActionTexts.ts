import type { ChatActionId } from '../../../shared/skills';
import type { L } from './seedWorlds';

/** Nachrichten, die eine Dialogoption im Chat sendet. Platzhalter: {npc}, {interest}, {goal}, {world}. */
export const CHAT_ACTION_MESSAGES: Record<ChatActionId, L> = {
  'small-talk': {
    de: 'Wie geht es dir eigentlich gerade so in {world}?',
    en: 'How are things going for you in {world} these days?',
  },
  compliment: {
    de: 'Ich muss das einfach sagen: Wie du dich für {interest} einsetzt, beeindruckt mich wirklich.',
    en: 'I just have to say it: the way you care about {interest} really impresses me.',
  },
  personal: {
    de: 'Darf ich dich etwas Persönliches fragen? Was willst du in {world} wirklich erreichen?',
    en: 'May I ask you something personal? What do you really want to achieve in {world}?',
  },
  negotiate: {
    de: 'Wir sind nicht immer einer Meinung. Lass uns trotzdem eine Lösung finden, mit der wir beide leben können.',
    en: 'We don\'t always agree. Let\'s still find a solution we can both live with.',
  },
  cooperate: {
    de: 'Ich habe einen Vorschlag: Lass uns zusammenarbeiten – bei „{goal}“ könnte ich dir helfen.',
    en: 'I have a proposal: let\'s work together – I could help you with "{goal}".',
  },
  endorse: {
    de: 'Würdest du dich öffentlich für mich aussprechen? Dein Wort hat Gewicht.',
    en: 'Would you speak up for me publicly? Your word carries weight.',
  },
};

export const CHAT_ACTION_TEXT = {
  cooperationTitle: { de: 'Kooperation: {player} und {npc}', en: 'Cooperation: {player} and {npc}' },
  cooperationDescription: {
    de: '{player} und {npc} arbeiten künftig zusammen.',
    en: '{player} and {npc} will work together from now on.',
  },
  cooperationPost: {
    de: 'Offiziell: @{handle} und ich arbeiten ab jetzt zusammen. Gute Neuigkeiten für {world}! #{tag}',
    en: 'Official: @{handle} and I are working together from now on. Good news for {world}! #{tag}',
  },
  endorsePost: {
    de: 'Ich sage es, wie es ist: @{handle} hat mein Vertrauen. Hört euch an, was {handle} zu sagen hat. #{tag}',
    en: 'I\'ll say it like it is: @{handle} has my trust. Listen to what {handle} has to say. #{tag}',
  },
  defaultGoal: { de: 'deinem nächsten Projekt', en: 'your next project' },
  defaultInterest: { de: 'deine Arbeit', en: 'your work' },
} satisfies Record<string, L>;
