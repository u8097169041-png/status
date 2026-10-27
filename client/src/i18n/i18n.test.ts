import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { translate } from './index';

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value as Record<string, unknown>, `${prefix}${key}.`));
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Übersetzungen', () => {
  const fde = flatten(de);
  const fen = flatten(en);

  it('haben in beiden Sprachen dieselben Schlüssel', () => {
    expect(Object.keys(fen).sort()).toEqual(Object.keys(fde).sort());
  });

  it('enthalten keine leeren Texte', () => {
    for (const [key, value] of [...Object.entries(fde), ...Object.entries(fen)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('verwenden in beiden Sprachen dieselben Platzhalter', () => {
    for (const key of Object.keys(fde)) {
      expect(placeholders(fen[key]), key).toEqual(placeholders(fde[key]));
    }
  });

  it('setzt Platzhalter ein und fällt bei unbekannten Schlüsseln auf den Schlüssel zurück', () => {
    expect(translate('de', 'worlds.day', { day: 3 })).toBe('Tag 3');
    expect(translate('en', 'worlds.day', { day: 3 })).toBe('Day 3');
    expect(translate('en', 'achievements.first-steps.desc')).toBe('Publish your first post.');
    expect(translate('de', 'gibt.es.nicht')).toBe('gibt.es.nicht');
  });
});
