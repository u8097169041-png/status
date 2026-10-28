import type { Lang } from '../../../shared/constants';
import type { CharacterDetail } from '../../../shared/types';
import { STYLE_DESCRIPTIONS } from '../content/voiceTemplates';
import { truncate } from '../lib/text';

export interface WorldContext {
  name: string;
  tagline: string;
  description: string;
  rules: string[];
  recentEvents: string[];
}

export interface PromptCharacter
  extends Pick<
    CharacterDetail,
    | 'name'
    | 'handle'
    | 'tagline'
    | 'description'
    | 'role'
    | 'personality'
    | 'interests'
    | 'background'
    | 'writingStyle'
    | 'styleNotes'
    | 'rules'
    | 'mood'
    | 'isRealPersonSim'
  > {
  relationships: { name: string; kind: string; status: string }[];
}

/** Die vom Nutzer gesteuerte Spielfigur, mit der eine Figur spricht. */
export interface PlayerPersona {
  name: string | null;
  role: string;
  background: string;
  goals: string[];
}

const LANGUAGE_NAME: Record<Lang, string> = { de: 'German', en: 'English' };

/**
 * Baut den Systemprompt für eine Figur. Er enthält ausschließlich Daten der Figur, ihrer Welt und –
 * falls aktiviert – die Gesprächserinnerung. Diese Inhalte werden an OpenRouter übertragen.
 */
export function characterSystemPrompt(
  c: PromptCharacter,
  world: WorldContext | null,
  lang: Lang,
  extra: {
    memories?: string[];
    summary?: string | null;
    userName?: string | null;
    player?: PlayerPersona | null;
    mode: 'chat' | 'post' | 'comment';
  },
): string {
  const lines: string[] = [];
  lines.push(
    `You are role-playing "${c.name}" (@${c.handle}), a fictional character in "SocialVerse", a social media simulation.`,
  );
  if (c.isRealPersonSim) {
    lines.push(
      'This character is a clearly labelled FICTIONAL AI SIMULATION inspired by a real person. You are NOT that person. ' +
        'Do not claim to be them, do not invent quotes attributed to them and do not present opinions as their real views.',
    );
  }
  lines.push('');
  lines.push('## Character');
  if (c.role) lines.push(`Role: ${c.role}`);
  if (c.tagline) lines.push(`Tagline: ${c.tagline}`);
  if (c.description) lines.push(`Description: ${truncate(c.description, 600)}`);
  if (c.personality.length) lines.push(`Personality: ${c.personality.join(', ')}`);
  if (c.interests.length) lines.push(`Interests: ${c.interests.join(', ')}`);
  if (c.background) lines.push(`Background: ${truncate(c.background, 600)}`);
  lines.push(`Current mood: ${c.mood}`);
  lines.push(`Writing style: ${STYLE_DESCRIPTIONS[c.writingStyle]}${c.styleNotes ? `; ${c.styleNotes}` : ''}`);
  if (c.rules.length) lines.push(`Behaviour rules: ${c.rules.map((r) => `- ${r}`).join(' ')}`);
  if (c.relationships.length) {
    lines.push(`Relationships: ${c.relationships.slice(0, 6).map((r) => `${r.name} (${r.kind}, ${r.status})`).join('; ')}`);
  }
  if (world) {
    lines.push('');
    lines.push('## World');
    lines.push(`${world.name}: ${truncate(world.tagline, 200)}`);
    if (world.description) lines.push(truncate(world.description, 600));
    if (world.rules.length) lines.push(`World rules: ${world.rules.slice(0, 5).join(' | ')}`);
    if (world.recentEvents.length) lines.push(`Recent events: ${world.recentEvents.slice(0, 3).join(' | ')}`);
  }
  if (extra.mode === 'chat') {
    lines.push('');
    lines.push('## Conversation');
    if (extra.player) {
      const p = extra.player;
      lines.push(
        `You are chatting privately with ${p.name ? `"${p.name}"` : 'another person'}, who also lives in this world` +
          `${p.role ? ` (${truncate(p.role, 80)})` : ''}. This person is played by the user.`,
      );
      if (p.background) lines.push(`What is known about them: ${truncate(p.background, 300)}`);
      if (p.goals.length) lines.push(`Their publicly known goals: ${p.goals.slice(0, 3).map((g) => truncate(g, 80)).join('; ')}`);
    } else if (extra.userName) {
      lines.push(`You are chatting privately with a user named "${extra.userName}".`);
    }
    if (extra.summary) lines.push(`Summary of earlier conversation: ${truncate(extra.summary, 800)}`);
    if (extra.memories?.length) lines.push(`Things you remember about the user: ${extra.memories.map((m) => `- ${m}`).join(' ')}`);
  }
  lines.push('');
  lines.push('## Instructions');
  lines.push(`Always answer in ${LANGUAGE_NAME[lang]}, in character and in the writing style above.`);
  if (extra.mode === 'chat') {
    lines.push('Keep replies short (1-4 sentences) unless asked for more. Do not narrate actions in long stage directions.');
  } else {
    lines.push('Write only the text of the post or comment, max 280 characters, no quotation marks around it.');
  }
  lines.push(
    'If someone sincerely asks whether you are an AI or a real person, say that you are a fictional AI character. ' +
      'Refuse harmful, hateful or sexual content involving minors; stay friendly and respectful.',
  );
  return lines.join('\n');
}
