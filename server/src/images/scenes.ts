/**
 * Szenenbilder aus dem aktuellen Geschehen: Die letzten Nachrichten, beteiligte Figuren (mit festem Aussehen),
 * der Ort und die Stimmung werden zu einem Bildprompt verdichtet – mit lokaler KI ins Englische übersetzt
 * (Bildmodelle verstehen Englisch am besten), sonst regelbasiert.
 */
import type { Appearance } from '../../../shared/appearance';
import type { JsonSchema } from '../ai/types';
import type { AppContext } from '../context';
import { AppError } from '../lib/errors';
import { truncate } from '../lib/text';
import { isBlockedImageRequest, scenePrompt } from './prompts';

export interface SceneSource {
  /** Die letzten Nachrichten in zeitlicher Reihenfolge („Sprecher: Text“). */
  transcript: string[];
  /** Wichtige frühere Fakten, falls für die Szene relevant. */
  memories: string[];
  characters: { name: string; appearance: Appearance; role: string }[];
  location: string;
  setting: string;
  mood: string;
  lang: 'de' | 'en';
  extra: string;
  variation: number;
}

const SCENE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', maxLength: 320 },
    location: { type: 'string', maxLength: 120 },
    mood: { type: 'string', maxLength: 60 },
    visible: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 60 } },
  },
  required: ['action', 'location', 'mood', 'visible'],
};

export interface BuiltScene {
  prompt: string;
  caption: string;
  visible: string[];
  location: string;
  mood: string;
}

/** Prüft die eigene Beschreibung des Spielers. */
export function checkExtra(extra: string): string {
  const text = extra.trim().slice(0, 300);
  if (text && isBlockedImageRequest(text)) {
    throw new AppError(400, 'image_blocked', 'Diese Beschreibung kann nicht als Bild umgesetzt werden (keine sexuellen oder extrem gewalttätigen Darstellungen).');
  }
  return text;
}

export async function buildScene(ctx: AppContext, s: SceneSource): Promise<BuiltScene> {
  const names = s.characters.map((c) => c.name);
  let action = '';
  let location = s.location;
  let mood = s.mood;
  let visible = names.slice(0, 2);
  if (ctx.ai.isActive('chat')) {
    const result = await ctx.ai.complete({
      purpose: 'chat',
      kind: 'chat',
      json: SCENE_SCHEMA,
      maxTokens: 260,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You turn the latest moment of a story into a short, concrete English description for a photographer. ' +
            'Describe only what is visible right now (people, posture, action, objects, place), not the whole story. ' +
            'Never use character names in "action" (say "a man", "the woman" etc.), never describe nudity or gore. ' +
            'Respond ONLY with JSON {"action","location","mood","visible":[names of characters visible]}.',
        },
        {
          role: 'user',
          content: [
            `Characters: ${s.characters.map((c) => `${c.name} (${c.role})`).join('; ') || 'none'}`,
            `Place: ${s.location || s.setting}`,
            s.memories.length ? `Relevant earlier facts: ${s.memories.slice(0, 4).join(' | ')}` : '',
            `Latest messages:\n${s.transcript.slice(-8).join('\n')}`,
            s.extra ? `The player wants the image to show: ${s.extra}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });
    if (result.ok && result.provider !== 'fallback') {
      try {
        const data = JSON.parse(result.text.slice(result.text.indexOf('{'), result.text.lastIndexOf('}') + 1)) as Record<string, unknown>;
        if (typeof data.action === 'string' && data.action.trim()) action = data.action.trim();
        if (typeof data.location === 'string' && data.location.trim()) location = data.location.trim();
        if (typeof data.mood === 'string' && data.mood.trim()) mood = data.mood.trim();
        if (Array.isArray(data.visible)) {
          const v = data.visible.filter((n): n is string => typeof n === 'string').map((n) => names.find((x) => x.toLowerCase().startsWith(n.toLowerCase().split(' ')[0])) ?? '').filter(Boolean);
          if (v.length) visible = [...new Set(v)];
        }
      } catch {
        action = '';
      }
    }
  }
  if (!action) {
    // Regelbasiert: die letzte Szene in Kurzform (Bildmodelle verstehen auch einfache deutsche Begriffe teilweise).
    const last = s.transcript.slice(-3).join(' ');
    action = `a candid moment: ${truncate(last.replace(/^[^:]{1,40}:\s*/, ''), 220)}`;
  }
  if (isBlockedImageRequest(action)) action = 'two people in a tense, quiet conversation';
  const people = s.characters.filter((c) => visible.includes(c.name)).slice(0, 3);
  const prompt = scenePrompt({ characters: people, location: location || s.setting, action, mood, extra: s.extra, variation: s.variation });
  const caption = truncate(s.extra || (s.lang === 'de' ? `Szene: ${location || s.setting}` : `Scene: ${location || s.setting}`), 160);
  return { prompt, caption, visible: people.map((p) => p.name), location: location || s.setting, mood };
}
