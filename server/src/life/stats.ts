/**
 * Rolle und Startwerte einer Lebensgeschichte – regelbasiert aus Rolle und Ausgangsgeschichte abgeleitet,
 * damit sie nachvollziehbar sind und nicht vom Sprachmodell abhängen.
 */
import { uw } from '../../../shared/regex';
import { ARCHETYPE_STATS, clampStat, type LifeArchetype, type LifeGenre, type LifeStat, type LifeStats } from '../../../shared/life';
import { ARCHETYPE_PATTERNS, GENRE_PATTERNS, PREMISE_MODIFIERS, STAT_BASE, isLeader } from '../content/lifeContent';

export function detectArchetype(role: string, premise: string): LifeArchetype {
  for (const text of [role, premise]) {
    for (const [archetype, pattern] of ARCHETYPE_PATTERNS) {
      if (!pattern.test(text)) continue;
      // „Mitglied“ einer kriminellen Organisation ohne Führungsrolle ist kein Boss.
      if (archetype === 'crime_boss' && !isLeader(`${role} ${text === role ? '' : premise}`) && uw(/\b(soldat|soldier|mitglied|member|laufbursche|handlanger|fahrer|driver)/i).test(role)) return 'gangster';
      if (archetype === 'gangster' && isLeader(role)) return 'crime_boss';
      return archetype;
    }
  }
  return 'ordinary';
}

export function detectGenres(text: string, archetype: LifeArchetype): LifeGenre[] {
  const found = GENRE_PATTERNS.filter(([, p]) => p.test(text)).map(([g]) => g);
  const primary: LifeGenre =
    archetype === 'crime_boss' || archetype === 'gangster'
      ? 'crime'
      : archetype === 'politician'
        ? 'politics'
        : archetype === 'entrepreneur'
          ? 'business'
          : archetype === 'celebrity'
            ? 'fame'
            : (found[0] ?? 'drama');
  return [...new Set([primary, ...found])].slice(0, 3);
}

/** Startwerte: Grundwerte der Rolle, angepasst an Schlüsselwörter der Geschichte; nur die passenden Werte. */
export function initialStats(archetype: LifeArchetype, premise: string, genres: LifeGenre[]): { stats: LifeStats; statKeys: LifeStat[] } {
  const keys = [...ARCHETYPE_STATS[archetype]];
  // Krimi-Nebenhandlung ohne kriminelle Rolle: Aufmerksamkeit von Polizei/Feinden ist trotzdem relevant.
  if (genres.includes('crime') && !keys.includes('heat')) keys.push('heat');
  if (genres.includes('romance') && !keys.includes('relationships')) keys.push('relationships');
  const stats: LifeStats = {};
  for (const k of keys) stats[k] = STAT_BASE[archetype][k] ?? (k === 'health' ? 85 : k === 'heat' ? 10 : 40);
  for (const { pattern, changes } of PREMISE_MODIFIERS) {
    if (!pattern.test(premise)) continue;
    for (const [k, v] of Object.entries(changes) as [LifeStat, number][]) {
      if (stats[k] !== undefined) stats[k] = stats[k]! + v;
    }
  }
  for (const k of keys) stats[k] = clampStat(stats[k]!);
  return { stats, statKeys: keys };
}

/** Grobe Einordnung für Anzeige und Prompt (z. B. „hoch“). */
export function statLevel(value: number, inverted = false): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
  const v = inverted ? 100 - value : value;
  return v < 15 ? 'very_low' : v < 35 ? 'low' : v < 65 ? 'medium' : v < 85 ? 'high' : 'very_high';
}
