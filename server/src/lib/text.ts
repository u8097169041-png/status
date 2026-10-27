import { LIMITS } from '../../../shared/constants';

const TAG_PATTERN = /#([\p{L}\p{N}_]{2,30})/gu;

/** Extrahiert Hashtags (ohne #, kleingeschrieben, eindeutig). */
export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(TAG_PATTERN)) {
    tags.add(match[1].toLowerCase());
    if (tags.size >= LIMITS.tagsPerPost) break;
  }
  return [...tags];
}

/**
 * Normalisiert Freitext: entfernt Steuerzeichen (außer Zeilenumbrüchen/Tabs),
 * vereinheitlicht Zeilenumbrüche und begrenzt aufeinanderfolgende Leerzeilen.
 * HTML wird nicht interpretiert – die Ausgabe erfolgt im Frontend stets als Text.
 */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function slugifyHandle(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.characterHandle);
}

/** Ersetzt {platzhalter} in Vorlagen. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}
