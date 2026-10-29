/**
 * Strukturierte KI-Ergebnisse für Gespräche. Das Modell darf nur Text und eine Stimmungseinschätzung liefern;
 * Spielwerte (Zuneigung, XP, Quests, Fähigkeiten) verändern ausschließlich die Spielregeln des Servers.
 */
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants';
import { cleanText, truncate } from '../lib/text';

export const CHAT_TONES = ['warm', 'neutral', 'tense'] as const;
export type ChatTone = (typeof CHAT_TONES)[number];

const chatTurnSchema = z.object({
  reply: z.string().min(1).max(LIMITS.chatMessage * 2),
  tone: z.enum(CHAT_TONES).catch('neutral'),
});

export interface ChatTurn {
  reply: string;
  tone: ChatTone;
  /** true, wenn die Antwort im vereinbarten JSON-Format kam (nur dann zählt die Stimmung). */
  structured: boolean;
}

/** Anweisung an das Modell für das Antwortformat (Englisch, damit auch kleine Modelle sie zuverlässig befolgen). */
export const CHAT_FORMAT_INSTRUCTION =
  'Respond ONLY with a JSON object of the form {"reply": "<your message to the user>", "tone": "warm" | "neutral" | "tense"}. ' +
  '"tone" is how your character feels about the user after this exchange. No other keys, no markdown.';

/** Entfernt Zugangsdaten-ähnliche Zeichenfolgen und Steuerzeichen aus Modellausgaben. */
export function sanitizeModelText(text: string, max: number): string {
  const cleaned = cleanText(
    text
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[…]')
      .replace(/^```(?:json)?\s*|\s*```$/g, '')
      .replace(/^["„“]|["“”]$/g, ''),
  );
  return truncate(cleaned, max);
}

function firstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Liest die Antwort eines Modells. Kein gültiges JSON → Klartext als Antwort mit neutraler Stimmung;
 * sieht der Text nach kaputtem JSON aus, wird er verworfen (null → simulierte Antwort).
 */
export function parseChatTurn(raw: string): ChatTurn | null {
  const parsed = chatTurnSchema.safeParse(firstJsonObject(raw));
  if (parsed.success) {
    const reply = sanitizeModelText(parsed.data.reply, LIMITS.chatMessage);
    return reply ? { reply, tone: parsed.data.tone, structured: true } : null;
  }
  if (/^\s*[{[]/.test(raw) || /"reply"\s*:/.test(raw)) return null;
  const reply = sanitizeModelText(raw, LIMITS.chatMessage);
  return reply ? { reply, tone: 'neutral', structured: false } : null;
}

/** Spielregel: Stimmung → Zuneigungsänderung (höchstens ±1, einmal pro Tag und Figur – siehe chats.ts). */
export const TONE_AFFINITY: Record<ChatTone, number> = { warm: 1, neutral: 0, tense: -1 };
