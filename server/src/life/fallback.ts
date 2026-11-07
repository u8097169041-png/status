/**
 * Regelbasierte Erzählung und Vorschläge (ohne KI, ohne Datenbank) – vom Server und von der Handy-Version genutzt.
 */
import { SUGGESTION_KINDS, type LifeGenre, type LifeSuggestion } from '../../../shared/life';
import { CRITICAL_TEXT, OUTCOME_TEXT, REACTION_LINES, SUGGESTIONS, type SuggestionTemplate } from '../content/lifeContent';
import { newId } from '../lib/ids';
import type { Rng } from '../lib/rng';
import { fill } from '../lib/text';
import type { LifeCharacterRow } from './characters';
import type { EventOutcome, Resolution } from './engine';
import { genresOf, presentOf, statsOf, type StoryRow } from './store';

export interface TurnContext {
  playerText: string;
  resolution: Resolution | null;
  events: EventOutcome[];
  mode: 'turn' | 'opening' | 'time' | 'away';
}

export interface Narration {
  narration: string;
  dialogue: { speakerId: string; text: string }[];
  suggestions: LifeSuggestion[];
  location: string | null;
  present: string[] | null;
  facts: { text: string; importance: number; knownBy: string[] }[];
  provider: 'local' | 'server' | 'fallback';
  model: string | null;
}

// ---------- Vorschläge (regelbasiert) ----------

function targetsFor(needs: SuggestionTemplate['needs'], chars: LifeCharacterRow[], genres: LifeGenre[]): LifeCharacterRow[] {
  const alive = chars.filter((c) => c.status === 'alive');
  switch (needs) {
    case 'ally':
      return alive.filter((c) => c.affinity >= 15 && c.stance !== 'enemy' && c.stance !== 'rival');
    case 'foe':
      return alive.filter((c) => c.affinity <= -15 || c.stance === 'enemy' || c.stance === 'rival');
    case 'love':
      return alive.filter((c) => c.stance === 'love' || (genres.includes('romance') && c.affinity >= 35 && c.stance !== 'family'));
    case 'any':
      return alive;
    default:
      return [];
  }
}

export function ruleSuggestions(story: StoryRow, chars: LifeCharacterRow[], rng: Rng, recentTexts: string[]): LifeSuggestion[] {
  const genres = genresOf(story);
  const stats = statsOf(story);
  const lang = story.lang;
  const out: LifeSuggestion[] = [];
  const present = new Set(presentOf(story));
  for (const kind of SUGGESTION_KINDS) {
    const pool: SuggestionTemplate[] = [...genres.flatMap((g) => SUGGESTIONS[g]?.[kind] ?? []), ...(SUGGESTIONS.common[kind] ?? [])];
    // Zustandsabhängige Vernunft: verletzt → erholen, viel Aufmerksamkeit → untertauchen.
    if (kind === 'smart' && (stats.health ?? 100) < 35) pool.unshift({ text: { de: 'Deine Verletzungen behandeln lassen', en: 'Get your injuries treated' }, category: 'rest', risk: 1 });
    if (kind === 'smart' && (stats.heat ?? 0) > 70) pool.unshift({ text: { de: 'Untertauchen, bis sich die Lage beruhigt', en: 'Lie low until things calm down' }, category: 'wait', risk: 1 });
    const options = rng
      .shuffle(pool)
      .map((t) => {
        const candidates = t.needs ? targetsFor(t.needs, chars, genres) : [];
        if (t.needs && !candidates.length) return null;
        // Anwesende Figuren bevorzugen.
        const target = candidates.find((c) => present.has(c.id)) ?? (candidates.length ? rng.pick(candidates) : null);
        const text = fill(t.text[lang], { npc: target?.name ?? '' });
        return { t, target, text };
      })
      .filter((x): x is { t: SuggestionTemplate; target: LifeCharacterRow | null; text: string } => x !== null);
    const fresh = options.find((o) => !recentTexts.includes(o.text) && !out.some((s) => s.text === o.text)) ?? options[0];
    if (!fresh) continue;
    out.push({ id: newId('sg'), kind, text: fresh.text, category: fresh.t.category, risk: fresh.t.risk, targetId: fresh.target?.id ?? null });
  }
  return out;
}

// ---------- Ersatz-Erzählung ohne KI ----------

export function fallbackNarration(story: StoryRow, chars: LifeCharacterRow[], turn: TurnContext, rng: Rng, recentTexts: string[]): Narration {
  const lang = story.lang;
  const r = turn.resolution;
  const target = r ? chars.find((c) => c.id === r.targetId) : undefined;
  const parts: string[] = [];
  const dialogue: Narration['dialogue'] = [];
  if (r) {
    const group = r.tier === 'critical_success' || r.tier === 'success' ? 'success' : r.tier === 'partial' ? 'partial' : 'failure';
    parts.push(fill(OUTCOME_TEXT[r.category][group][lang], { target: target?.name ?? (lang === 'de' ? 'Dein Gegenüber' : 'The other person'), with: target ? (lang === 'de' ? ` mit ${target.name}` : ` with ${target.name}`) : '' }));
    if (r.tier === 'critical_success') parts.push(CRITICAL_TEXT.success[lang]);
    if (r.tier === 'critical_failure') parts.push(CRITICAL_TEXT.failure[lang]);
    if (r.revealedSecret) parts.push(lang === 'de' ? `Du erfährst: ${r.revealedSecret.secret}` : `You find out: ${r.revealedSecret.secret}`);
    if (target && target.status === 'alive' && !r.playerDied) {
      const mood = target.fear >= 60 ? 'afraid' : target.affinity >= 25 ? 'warm' : target.affinity <= -25 ? 'hostile' : 'cool';
      dialogue.push({ speakerId: target.id, text: rng.pick(REACTION_LINES[mood])[lang] });
    }
  }
  if (turn.mode === 'opening') parts.push(lang === 'de' ? 'Was tust du?' : 'What do you do?');
  return {
    narration: parts.join(' '),
    dialogue,
    suggestions: ruleSuggestions(story, chars, rng, recentTexts),
    location: null,
    present: null,
    facts: [],
    provider: 'fallback',
    model: null,
  };
}

