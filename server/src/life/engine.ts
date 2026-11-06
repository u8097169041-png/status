/**
 * Spielsystem der Lebenssimulation. Es entscheidet Erfolg, Werteänderungen, Verletzungen, Todesfälle und
 * eigenständige Ereignisse – nachvollziehbar und unabhängig vom Sprachmodell, das nur erzählt.
 * Nichts ist garantiert: Jede Handlung kann scheitern, und Folgen bleiben dauerhaft bestehen.
 */
import { uw } from '../../../shared/regex';
import { clampStat, type ActionCategory, type CharacterStance, type LifeGenre, type LifeStat, type LifeStats, type LifeSuggestion, type OutcomeTier } from '../../../shared/life';
import {
  ACTION_EFFECTS,
  ACTION_PATTERNS,
  ACTION_RULES,
  DEATH_CAUSE,
  EVENT_TEXT,
  LETHAL,
  PROMISE,
  RISKY_WORDS,
  type Effect,
} from '../content/lifeContent';
import type { AppContext } from '../context';
import { parseJson, run } from '../db/database';
import { newId } from '../lib/ids';
import type { Rng } from '../lib/rng';
import { fill } from '../lib/text';
import type { LifeCharacterRow } from './characters';
import { EVERYONE, PLAYER, type MemoryKind } from './memory';
import type { StoryRow } from './store';

export interface Classified {
  category: ActionCategory;
  risk: 1 | 2 | 3;
  targetId: string | null;
  lethal: boolean;
  promise: boolean;
}

const RISKY_CATEGORIES: ActionCategory[] = ['violence', 'crime', 'threaten', 'deceive'];

/** Ordnet eine freie Eingabe einer Aktionsart zu und erkennt Ziel, Risiko, Tötungsabsicht und Versprechen. */
export function classifyAction(text: string, chars: LifeCharacterRow[], present: string[], suggestion?: LifeSuggestion | null): Classified {
  const alive = chars.filter((c) => c.status === 'alive');
  const lower = text.toLowerCase();
  const mentioned =
    alive.find((c) => lower.includes(c.name.toLowerCase())) ??
    alive.find((c) => {
      const first = c.name.split(/\s+/)[0].toLowerCase();
      return first.length > 2 && uw(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')).test(lower);
    });
  const category = suggestion?.category ?? ACTION_PATTERNS.find(([, p]) => p.test(text))![0];
  let risk = suggestion?.risk ?? ACTION_RULES[category].risk;
  if (RISKY_WORDS.test(text)) risk = Math.min(3, risk + 1) as 1 | 2 | 3;
  const needsTarget = ACTION_RULES[category].relation || ['threaten', 'violence'].includes(category);
  const presentAlive = present.find((id) => alive.some((c) => c.id === id)) ?? null;
  const targetId = (suggestion?.targetId && alive.some((c) => c.id === suggestion.targetId) ? suggestion.targetId : null) ?? mentioned?.id ?? (needsTarget ? presentAlive : null);
  return { category, risk, targetId, lethal: category === 'violence' && LETHAL.test(text), promise: PROMISE.test(text) };
}

export interface Resolution {
  category: ActionCategory;
  tier: OutcomeTier;
  chance: number;
  roll: number;
  statChanges: LifeStats;
  targetId: string | null;
  target: { affinity: number; trust: number; loyalty: number; fear: number } | null;
  targetStatus: { status: 'dead' | 'gone'; note: string } | null;
  stance: CharacterStance | null;
  revealedSecret: { characterId: string; secret: string } | null;
  playerDied: boolean;
  deathCause: string | null;
}

function scale(e: Effect, factor: number): Effect {
  const out: Effect = {};
  if (e.stats) out.stats = Object.fromEntries(Object.entries(e.stats).map(([k, v]) => [k, Math.round((v as number) * factor)]));
  if (e.target) out.target = Object.fromEntries(Object.entries(e.target).map(([k, v]) => [k, Math.round((v as number) * factor)]));
  if (e.health) out.health = [Math.round(e.health[0] * factor), Math.round(e.health[1] * factor)];
  return out;
}

/** Erfolgschance aus Werten, Beziehung und Risiko. Nie unter 5 % und nie über 92 %. */
export function successChance(stats: LifeStats, cls: Classified, target: LifeCharacterRow | null): number {
  const rule = ACTION_RULES[cls.category];
  let p = rule.base;
  for (const [stat, weight] of Object.entries(rule.stats) as [LifeStat, number][]) p += (weight * ((stats[stat] ?? 50) - 50)) / 100;
  if (target) {
    if (rule.relation) p += (target.affinity / 100) * 0.25 + ((target.trust - 50) / 100) * 0.15;
    if (cls.category === 'deceive' && target.trust < 30) p -= 0.12;
    if (cls.category === 'threaten') p += (target.fear / 100) * 0.2 - (target.stance === 'enemy' ? 0.08 : 0);
    if (cls.category === 'violence' && target.importance >= 3) p -= 0.1;
  }
  if (cls.lethal) p -= 0.08;
  p -= (cls.risk - 1) * 0.06;
  if ((stats.health ?? 80) < 30) p -= 0.1;
  return Math.max(0.05, Math.min(0.92, p));
}

export function rollTier(chance: number, cls: Classified, roll: number): OutcomeTier {
  const critFail = RISKY_CATEGORIES.includes(cls.category) ? 0.02 + 0.03 * cls.risk : 0.015;
  if (roll < chance * 0.18) return 'critical_success';
  if (roll < chance) return 'success';
  if (roll > 1 - critFail) return 'critical_failure';
  if (roll < chance + (1 - chance) * 0.4) return 'partial';
  return 'failure';
}

function nextStance(current: CharacterStance, affinity: number): CharacterStance {
  if (current === 'family' || current === 'boss' || current === 'subordinate') return affinity <= -60 ? 'enemy' : current;
  if (current === 'love' && affinity < -10) return 'ex';
  if (affinity <= -50) return 'enemy';
  if (affinity <= -20 && (current === 'neutral' || current === 'friend' || current === 'ally')) return 'rival';
  if (affinity >= 50 && (current === 'neutral' || current === 'rival')) return 'friend';
  return current;
}

export function resolveAction(stats: LifeStats, cls: Classified, target: LifeCharacterRow | null, rng: Rng): Resolution {
  const chance = successChance(stats, cls, target);
  const roll = rng.next();
  const tier = rollTier(chance, cls, roll);
  const base = ACTION_EFFECTS[cls.category];
  const effect =
    tier === 'critical_success'
      ? scale(base.success, 1.6)
      : tier === 'success'
        ? base.success
        : tier === 'partial'
          ? base.partial
          : tier === 'failure'
            ? base.failure
            : scale(base.failure, 1.8);
  const statChanges: LifeStats = { ...(effect.stats ?? {}) };
  let damage = effect.health ? rng.int(Math.min(...effect.health), Math.max(...effect.health)) : 0;
  // Gefährliche Ergebnisse: Gegenwehr, Festnahme, Bloßstellung.
  if (tier === 'critical_failure') {
    if (cls.category === 'violence') damage += rng.int(15, 40);
    if (cls.category === 'threaten') damage += rng.int(10, 30);
    if (cls.category === 'crime') {
      damage += rng.int(0, 20);
      statChanges.heat = (statChanges.heat ?? 0) + 15;
      statChanges.wealth = (statChanges.wealth ?? 0) - 10;
    }
    if (cls.category === 'deceive') statChanges.reputation = (statChanges.reputation ?? 0) - 6;
  }
  if (damage !== 0) statChanges.health = (statChanges.health ?? 0) - damage;

  let targetChange: Resolution['target'] = null;
  let targetStatus: Resolution['targetStatus'] = null;
  let stance: CharacterStance | null = null;
  let revealedSecret: Resolution['revealedSecret'] = null;
  if (target) {
    const t = effect.target ?? {};
    targetChange = { affinity: t.affinity ?? 0, trust: t.trust ?? 0, loyalty: t.loyalty ?? 0, fear: t.fear ?? 0 };
    // Unentdeckte Täuschung: Das Ziel merkt (noch) nichts.
    if (cls.category === 'deceive' && (tier === 'success' || tier === 'critical_success')) targetChange = { affinity: 0, trust: 0, loyalty: 0, fear: 0 };
    if (cls.category === 'violence' && (tier === 'success' || tier === 'critical_success')) {
      if (cls.lethal && (tier === 'critical_success' || target.importance <= 2)) targetStatus = { status: 'dead', note: 'killed' };
      else if (!cls.lethal) targetStatus = { status: 'gone', note: 'fled' };
    }
    const affinityAfter = Math.max(-100, Math.min(100, target.affinity + targetChange.affinity));
    let next = nextStance(target.stance, affinityAfter);
    if (cls.category === 'romance' && (tier === 'success' || tier === 'critical_success') && affinityAfter >= 50 && !['family', 'enemy', 'boss'].includes(target.stance)) next = 'love';
    if (cls.category === 'help' && target.stance === 'enemy' && affinityAfter > -15) next = 'rival';
    stance = next !== target.stance ? next : null;
    if (cls.category === 'investigate' && (tier === 'success' || tier === 'critical_success')) {
      const secrets = parseJson<string[]>(target.secrets, []);
      if (secrets.length) revealedSecret = { characterId: target.id, secret: secrets[0] };
    }
  }
  const healthAfter = (stats.health ?? 80) + (statChanges.health ?? 0);
  const playerDied = stats.health !== undefined && healthAfter <= 0;
  return {
    category: cls.category,
    tier,
    chance: Math.round(chance * 100) / 100,
    roll: Math.round(roll * 1000) / 1000,
    statChanges,
    targetId: target?.id ?? null,
    target: targetChange,
    targetStatus,
    stance,
    revealedSecret,
    playerDied,
    deathCause: playerDied ? cls.category : null,
  };
}

/** Werte anwenden und begrenzen; gibt die tatsächlichen Änderungen zurück. */
export function applyStats(stats: LifeStats, changes: LifeStats): { stats: LifeStats; applied: LifeStats } {
  const next: LifeStats = { ...stats };
  const applied: LifeStats = {};
  for (const [k, v] of Object.entries(changes) as [LifeStat, number][]) {
    if (next[k] === undefined || !v) continue;
    const before = next[k]!;
    next[k] = clampStat(before + v);
    if (next[k] !== before) applied[k] = next[k]! - before;
  }
  return { stats: next, applied };
}

export function applyCharacterChange(
  ctx: AppContext,
  c: LifeCharacterRow,
  change: { affinity?: number; trust?: number; loyalty?: number; fear?: number },
  stance: CharacterStance | null,
  turn: number,
  status?: { status: LifeCharacterRow['status']; note: string } | null,
): void {
  const clamp = (v: number, min: number) => Math.max(min, Math.min(100, Math.round(v)));
  c.affinity = clamp(c.affinity + (change.affinity ?? 0), -100);
  c.trust = clamp(c.trust + (change.trust ?? 0), 0);
  c.loyalty = clamp(c.loyalty + (change.loyalty ?? 0), 0);
  c.fear = clamp(c.fear + (change.fear ?? 0), 0);
  if (stance) c.stance = stance;
  if (status) {
    c.status = status.status;
    c.status_note = status.note;
    c.status_turn = turn;
  }
  run(
    ctx.db,
    'UPDATE life_characters SET affinity = ?, trust = ?, loyalty = ?, fear = ?, stance = ?, status = ?, status_note = ?, status_turn = ? WHERE id = ?',
    c.affinity,
    c.trust,
    c.loyalty,
    c.fear,
    c.stance,
    c.status,
    c.status_note,
    c.status_turn,
    c.id,
  );
}

// ---------- Eigenständige Ereignisse ----------

export interface EventOutcome {
  kind: string;
  title: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  participants: string[];
  stats: LifeStats;
  relation: { id: string; change: { affinity?: number; trust?: number; loyalty?: number; fear?: number }; stance?: CharacterStance; status?: { status: LifeCharacterRow['status']; note: string } }[];
  memory: { kind: MemoryKind; critical: boolean; importance: number; knownBy: string[] } | null;
  playerDied: boolean;
  deathCause: string | null;
}

interface Candidate {
  kind: string;
  weight: number;
  build: () => Omit<EventOutcome, 'kind' | 'title' | 'description' | 'severity' | 'playerDied' | 'deathCause'> & { vars?: Record<string, string>; textKind?: string };
}

/**
 * Würfelt Ereignisse aus dem aktuellen Zustand: illoyale Figuren verraten, Feinde schlagen zu, hohe Aufmerksamkeit
 * führt zu Razzien, Beziehungen entwickeln sich, Figuren verfolgen eigene Ziele – auch ohne Zutun des Spielers.
 */
export function rollEvents(
  story: StoryRow,
  stats: LifeStats,
  genres: LifeGenre[],
  chars: LifeCharacterRow[],
  rng: Rng,
  mode: 'turn' | 'time' | 'away',
  recent: string[],
): EventOutcome[] {
  const alive = chars.filter((c) => c.status === 'alive');
  const lang = story.lang;
  const crime = genres.includes('crime');
  const heat = stats.heat ?? 0;
  const candidates: Candidate[] = [];
  const npcVars = (c: LifeCharacterRow, other?: LifeCharacterRow) => ({ npc: c.name, other: other?.name ?? '', goal: parseJson<string[]>(c.goals, [])[0] ?? '' });

  for (const c of alive) {
    if (c.loyalty < 30 && c.affinity < 15 && c.stance !== 'family' && c.stance !== 'enemy') {
      candidates.push({
        kind: 'betrayal',
        weight: ((30 - c.loyalty) / 30) * (crime ? 0.7 : 0.4),
        build: () => {
          const discovered = rng.chance(0.5);
          return {
            participants: [c.id],
            stats: { wealth: -8, power: -5, influence: -4, loyalty: -6 },
            relation: [{ id: c.id, change: { affinity: discovered ? -30 : -5, loyalty: -10 }, stance: discovered ? 'enemy' : undefined }],
            memory: { kind: 'betrayal', critical: true, importance: 5, knownBy: discovered ? [c.id, PLAYER] : [c.id] },
            vars: npcVars(c),
            textKind: discovered ? 'betrayal' : 'betrayal_hidden',
          };
        },
      });
    }
    if (c.affinity <= -40 && (crime || c.stance === 'enemy')) {
      candidates.push({
        kind: 'attack',
        weight: (crime ? 0.35 : 0.12) * (0.6 + heat / 100) * (c.stance === 'enemy' ? 1.4 : 1),
        build: () => {
          const protection = Math.round(((stats.power ?? 30) + (stats.authority ?? 30)) / 10);
          const damage = Math.max(5, rng.int(18, 55) - protection);
          return {
            participants: [c.id],
            stats: { health: -damage, heat: 6 },
            relation: [{ id: c.id, change: { fear: -5 } }],
            memory: { kind: 'event', critical: true, importance: 5, knownBy: [EVERYONE] },
            vars: npcVars(c),
          };
        },
      });
    }
    if (c.stance === 'love' && c.affinity >= 45) {
      candidates.push({
        kind: 'romance_moment',
        weight: 0.3,
        build: () => ({ participants: [c.id], stats: { relationships: 3 }, relation: [{ id: c.id, change: { affinity: 5, trust: 4 } }], memory: { kind: 'relationship', critical: false, importance: 3, knownBy: [c.id, PLAYER] }, vars: npcVars(c) }),
      });
      const rivalLove = alive.find((o) => o.id !== c.id && o.stance === 'love' && o.affinity >= 35);
      if (rivalLove) {
        candidates.push({
          kind: 'jealousy',
          weight: 0.25,
          build: () => ({ participants: [c.id, rivalLove.id], stats: { relationships: -3 }, relation: [{ id: c.id, change: { affinity: -14, trust: -10 } }], memory: { kind: 'relationship', critical: false, importance: 4, knownBy: [c.id, PLAYER] }, vars: npcVars(c, rivalLove) }),
        });
      }
    }
    if ((c.stance === 'love' || c.stance === 'ex') && c.affinity < 0 && c.stance === 'love') {
      candidates.push({
        kind: 'breakup',
        weight: 0.4,
        build: () => ({ participants: [c.id], stats: { relationships: -6 }, relation: [{ id: c.id, change: { affinity: -10 }, stance: 'ex' }], memory: { kind: 'relationship', critical: true, importance: 4, knownBy: [EVERYONE] }, vars: npcVars(c) }),
      });
    }
    if (parseJson<string[]>(c.goals, []).length) {
      candidates.push({
        kind: 'npc_rise',
        weight: 0.18,
        build: () => {
          const hostile = c.affinity < -10;
          return {
            participants: [c.id],
            stats: hostile ? { influence: -3, power: -2 } : {},
            relation: [],
            memory: { kind: 'event', critical: false, importance: 2, knownBy: [c.id, PLAYER] },
            vars: npcVars(c),
          };
        },
      });
    }
  }
  const pair = alive.length >= 2 ? rng.shuffle(alive).slice(0, 2) : null;
  if (pair) {
    candidates.push({
      kind: 'npc_feud',
      weight: 0.1,
      build: () => ({ participants: pair.map((p) => p.id), stats: {}, relation: [], memory: { kind: 'event', critical: false, importance: 2, knownBy: [EVERYONE] }, vars: npcVars(pair[0], pair[1]) }),
    });
  }
  if (heat > 55) {
    candidates.push({
      kind: 'raid',
      weight: ((heat - 55) / 45) * 0.8,
      build: () => {
        const loyal = alive.filter((c) => c.stance === 'subordinate' || c.stance === 'ally');
        const arrested = loyal.length && rng.chance(0.35) ? rng.pick(loyal) : null;
        return {
          participants: arrested ? [arrested.id] : [],
          stats: { wealth: -10, heat: -20, authority: -5, reputation: -3 },
          relation: arrested ? [{ id: arrested.id, change: { loyalty: -5 }, status: { status: 'imprisoned', note: 'arrested' } }] : [],
          memory: { kind: 'event', critical: Boolean(arrested), importance: 4, knownBy: [EVERYONE] },
        };
      },
    });
  }
  if ((stats.trust ?? 50) < 30 || ((stats.reputation ?? 0) > 60 && rng.chance(0.4))) {
    candidates.push({ kind: 'scandal', weight: 0.22, build: () => ({ participants: [], stats: { reputation: -8, trust: -5, influence: -3 }, relation: [], memory: { kind: 'event', critical: false, importance: 3, knownBy: [EVERYONE] } }) });
  }
  candidates.push({ kind: 'opportunity', weight: 0.22, build: () => ({ participants: [], stats: rng.chance(0.5) ? { wealth: 6 } : { influence: 4, reputation: 2 }, relation: [], memory: null }) });
  candidates.push({ kind: 'windfall', weight: 0.07, build: () => ({ participants: [], stats: { wealth: rng.int(5, 12) }, relation: [], memory: null }) });
  candidates.push({ kind: 'loss', weight: 0.09, build: () => ({ participants: [], stats: { wealth: -rng.int(4, 10) }, relation: [], memory: null }) });
  const health = stats.health ?? 80;
  candidates.push({
    kind: 'illness',
    weight: 0.04 + (health < 40 ? 0.12 : 0),
    build: () => ({ participants: [], stats: { health: -rng.int(8, health < 40 ? 30 : 18) }, relation: [], memory: { kind: 'event', critical: false, importance: 3, knownBy: [PLAYER] } }),
  });
  candidates.push({
    kind: 'accident',
    weight: 0.02,
    build: () => ({ participants: [], stats: { health: -rng.int(15, 50) }, relation: [], memory: { kind: 'event', critical: true, importance: 4, knownBy: [EVERYONE] } }),
  });
  const mortal = alive.filter((c) => c.importance <= 3);
  if (mortal.length && (crime || rng.chance(0.3))) {
    const victim = rng.pick(mortal);
    candidates.push({
      kind: 'npc_death',
      weight: crime ? 0.05 : 0.015,
      build: () => ({
        participants: [victim.id],
        stats: victim.stance === 'love' || victim.stance === 'family' || victim.stance === 'friend' ? { relationships: -8 } : {},
        relation: [{ id: victim.id, change: {}, status: { status: 'dead', note: 'died' } }],
        memory: { kind: 'death', critical: true, importance: 5, knownBy: [EVERYONE] },
        vars: npcVars(victim),
      }),
    });
  }

  const count = mode === 'turn' ? (rng.chance(0.38) ? 1 : 0) : mode === 'time' ? rng.int(1, 2) : 1;
  const out: EventOutcome[] = [];
  const used = new Set<string>(recent.slice(-2));
  for (let i = 0; i < count; i++) {
    const pool = candidates.filter((c) => !used.has(c.kind) && c.weight > 0);
    if (!pool.length) break;
    const pick = rng.weighted(pool.map((c) => ({ item: c, weight: c.weight })));
    used.add(pick.kind);
    const built = pick.build();
    const text = EVENT_TEXT[built.textKind ?? pick.kind];
    const vars = { player: story.player_name, ...(built.vars ?? {}) };
    out.push({
      kind: pick.kind,
      title: fill(text.title[lang], vars),
      description: fill(text.description[lang], vars),
      severity: text.severity,
      participants: built.participants,
      stats: built.stats,
      relation: built.relation,
      memory: built.memory,
      playerDied: false,
      deathCause: (built.stats.health ?? 0) < 0 ? pick.kind : null,
    });
  }
  return out;
}

/** Text der Todesursache in der Sprache der Geschichte. */
export function deathText(story: StoryRow, cause: string | null): string {
  const c = DEATH_CAUSE[cause ?? 'default'] ?? DEATH_CAUSE.default;
  return fill(EVENT_TEXT.death.description[story.lang], { player: story.player_name, cause: c[story.lang] });
}

export function newEventId(): string {
  return newId('lev');
}
