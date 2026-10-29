import { z } from 'zod';
import { COIN_REWARDS } from '../../../shared/economy';
import { categoryOfGenre, LIMITS, type Genre, type Lang, type RelationshipKind, type WorldMetric } from '../../../shared/constants';
import { clampMetric } from '../../../shared/relationships';
import { SKILL_RULES, type SkillId } from '../../../shared/skills';
import type { ArcPath, CharacterRef, DecisionDto, DecisionEffectsDto, DecisionResult, EventEffect } from '../../../shared/types';
import type { AppContext } from '../context';
import {
  DECISION_REACTIONS,
  DECISION_TEMPLATES,
  INTRO_DECISION,
  PLAYER_TEXT,
  type DecisionTemplate,
  type OptionTemplate,
} from '../content/decisionTemplates';
import { DATING_DECISION_TEMPLATES, DATING_INTRO_DECISION } from '../content/datingDecisions';
import { STORYLINE_TEXT } from '../content/simulationTemplates';
import { all, get, parseJson, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { createRng, type Rng } from '../lib/rng';
import { fill, slugifyHandle } from '../lib/text';
import { getCharacterRow } from './characters';
import { toCharacterRef } from './mappers';
import { notify } from './notifications';
import { adjustPlayerStats, controlledCharacterIds, getActivePlayerRow, getPlayerRow, toPlayer } from './players';
import { addCharacterLike, insertCharacterPost } from './posts';
import { mergeDelta, recordAction } from './progress';
import { getLanguage } from './settings';
import { adjustAffinity, setRelationshipKind } from './society';
import { addArcScore, resolveArc } from './arcs';
import { refreshQuests } from './quests';
import { requireSkill, skillLevels } from './skills';
import { grantCoins } from './wallet';

/** Gespeicherte Option mit konkret aufgelösten Auswirkungen. */
interface StoredOption {
  id: string;
  label: string;
  outcome: string;
  effects: DecisionEffectsDto & { storylineId?: string };
  requires?: { skill: SkillId; level: number };
  arcPath?: ArcPath;
  arcWeight?: number;
}

interface DecisionRow {
  id: string;
  world_id: string;
  player_id: string;
  kind: string;
  title: string;
  description: string;
  options: string;
  participants: string;
  storyline_id: string | null;
  status: 'pending' | 'resolved';
  chosen_option: string | null;
  outcome: string | null;
  event_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Npc {
  id: string;
  name: string;
  handle: string;
  avatar_hue: number;
  avatar_glyph: string;
  goals: string;
  prominent: number;
}

function toDecision(r: DecisionRow, skills: Record<SkillId, number>): DecisionDto {
  const options = parseJson<StoredOption[]>(r.options, []);
  // Strategie 2: Ergebnis vorab sehen.
  const preview = skills.strategy >= 2;
  return {
    id: r.id,
    worldId: r.world_id,
    playerId: r.player_id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      effects: { ...o.effects, storylineId: undefined } as DecisionEffectsDto,
      requires: o.requires,
      locked: Boolean(o.requires && skills[o.requires.skill] < o.requires.level),
      arcPath: r.storyline_id ? o.arcPath : undefined,
      outcomePreview: preview && r.status === 'pending' ? o.outcome : undefined,
    })),
    status: r.status,
    chosenOptionId: r.chosen_option,
    outcome: r.outcome,
    participants: parseJson<CharacterRef[]>(r.participants, []),
    storylineId: r.storyline_id,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function listDecisions(
  ctx: AppContext,
  filters: { worldId?: string; playerId?: string; status?: 'pending' | 'resolved'; limit?: number } = {},
): DecisionDto[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filters.worldId) {
    where.push('world_id = ?');
    params.push(filters.worldId);
  }
  if (filters.playerId) {
    where.push('player_id = ?');
    params.push(filters.playerId);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  return all<DecisionRow>(
    ctx.db,
    `SELECT * FROM decisions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY status = 'resolved', COALESCE(resolved_at, created_at) DESC LIMIT ?`,
    ...params,
    filters.limit ?? 50,
  ).map((r) => toDecision(r, skillLevels(ctx, r.player_id)));
}

function pendingCount(ctx: AppContext, playerId: string): number {
  return get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'pending'`, playerId)?.n ?? 0;
}

function npcsOf(ctx: AppContext, worldId: string): Npc[] {
  const controlled = controlledCharacterIds(ctx, worldId);
  return all<Npc>(
    ctx.db,
    'SELECT id, name, handle, avatar_hue, avatar_glyph, goals, prominent FROM characters WHERE world_id = ? ORDER BY id',
    worldId,
  ).filter((c) => !controlled.has(c.id));
}

function npcRef(n: Npc): CharacterRef {
  return toCharacterRef(n);
}

/** Erzeugt aus einer Vorlage eine gespeicherte Entscheidung mit konkreten Figuren und Texten. */
function instantiate(
  ctx: AppContext,
  worldId: string,
  playerId: string,
  template: DecisionTemplate,
  lang: Lang,
  ctxVars: { npc?: Npc; a?: Npc; b?: Npc; storyline?: { id: string; title: string; stage: string }; network?: Npc[]; goal?: string },
): string | null {
  const player = getPlayerRow(ctx, playerId);
  if (pendingCount(ctx, playerId) >= LIMITS.maxPendingDecisions) return null;
  const playerChar = getCharacterRow(ctx, player.character_id);
  const world = get<{ name: string }>(ctx.db, 'SELECT name FROM worlds WHERE id = ?', worldId)!;
  const vars: Record<string, string> = {
    player: playerChar.name,
    world: world.name,
    npc: ctxVars.npc?.name ?? '',
    a: ctxVars.a?.name ?? '',
    b: ctxVars.b?.name ?? '',
    goal: ctxVars.goal ?? '',
    storyline: ctxVars.storyline?.title ?? '',
    stage: ctxVars.storyline?.stage ?? '',
  };
  const targetOf = (t: 'npc' | 'a' | 'b') => (t === 'npc' ? ctxVars.npc : t === 'a' ? ctxVars.a : ctxVars.b);
  const options: StoredOption[] = template.options.map((o: OptionTemplate) => {
    const affinity: { characterId: string; name: string; delta: number; becomes?: RelationshipKind; minAffinity?: number }[] = [];
    for (const a of o.affinity ?? []) {
      const target = targetOf(a.target);
      if (target) affinity.push({ characterId: target.id, name: target.name, delta: a.delta, becomes: a.becomes, minAffinity: a.minAffinity });
    }
    if (o.networkAffinity) {
      for (const n of ctxVars.network ?? []) affinity.push({ characterId: n.id, name: n.name, delta: o.networkAffinity });
    }
    return {
      id: o.id,
      label: fill(o.label[lang], vars),
      outcome: fill(o.outcome[lang], vars),
      requires: o.requires,
      arcPath: o.arcPath,
      arcWeight: o.arcWeight,
      effects: {
        reputation: o.reputation,
        influence: o.influence,
        followers: o.followers,
        metrics: o.metrics,
        affinity: affinity.length ? affinity : undefined,
        advancesStoryline: o.advanceStoryline && ctxVars.storyline ? true : undefined,
        storylineId: o.advanceStoryline ? ctxVars.storyline?.id : undefined,
      },
    };
  });
  const participants = [ctxVars.npc, ctxVars.a, ctxVars.b, ...(ctxVars.network ?? [])].filter((n): n is Npc => Boolean(n)).map(npcRef);
  const id = newId('d');
  run(
    ctx.db,
    `INSERT INTO decisions (id, world_id, player_id, kind, title, description, options, participants, storyline_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    worldId,
    playerId,
    template.id,
    fill(template.title[lang], vars),
    fill(template.description[lang], vars),
    JSON.stringify(options),
    JSON.stringify(participants),
    ctxVars.storyline?.id ?? null,
    ctx.now().toISOString(),
  );
  notify(ctx, 'decision', { title: fill(template.title[lang], vars) }, '/tasks', worldId);
  return id;
}

/** Dating-Welten haben eigene Entscheidungen rund um Beziehungen; alle anderen Welten die allgemeinen. */
function isDatingWorld(ctx: AppContext, worldId: string): boolean {
  const genre = get<{ genre: Genre }>(ctx.db, 'SELECT genre FROM worlds WHERE id = ?', worldId)?.genre;
  return genre ? categoryOfGenre(genre) === 'dating' : false;
}

function templatesFor(ctx: AppContext, worldId: string): DecisionTemplate[] {
  return isDatingWorld(ctx, worldId) ? DATING_DECISION_TEMPLATES : DECISION_TEMPLATES;
}

export function createIntroDecision(ctx: AppContext, worldId: string, playerId: string): string | null {
  const lang = getLanguage(ctx.db);
  const npcs = npcsOf(ctx, worldId);
  const famous = npcs.filter((n) => n.prominent);
  const network = (famous.length >= 2 ? famous : npcs).slice(0, 2);
  return instantiate(ctx, worldId, playerId, isDatingWorld(ctx, worldId) ? DATING_INTRO_DECISION : INTRO_DECISION, lang, { network });
}

/** Wird von der Simulation aufgerufen: Gelegentlich wird die Spielfigur vor eine Entscheidung gestellt. */
export function maybeCreateDecision(ctx: AppContext, worldId: string, rng: Rng): string | null {
  const player = getActivePlayerRow(ctx, worldId);
  if (!player || pendingCount(ctx, player.id) >= LIMITS.maxPendingDecisions) return null;
  if (!rng.chance(0.55)) return null;
  const lang = getLanguage(ctx.db);
  const npcs = npcsOf(ctx, worldId);
  if (npcs.length === 0) return null;
  const options = templatesFor(ctx, worldId).filter((t) => t.needs !== 'storyline' && (t.needs !== 'pair' || npcs.length >= 2));
  const template = rng.pick(options);
  if (template.needs === 'pair') {
    // Bevorzugt Paare, die tatsächlich im Konflikt stehen.
    const tense = all<{ a_id: string; b_id: string }>(
      ctx.db,
      'SELECT a_id, b_id FROM relationships WHERE world_id = ? AND affinity < 0 ORDER BY affinity',
      worldId,
    ).filter((r) => npcs.some((n) => n.id === r.a_id) && npcs.some((n) => n.id === r.b_id));
    let a: Npc;
    let b: Npc;
    if (tense.length) {
      const pick = rng.pick(tense);
      a = npcs.find((n) => n.id === pick.a_id)!;
      b = npcs.find((n) => n.id === pick.b_id)!;
    } else {
      [a, b] = rng.shuffle(npcs).slice(0, 2);
    }
    return instantiate(ctx, worldId, player.id, template, lang, { a, b });
  }
  const npc = rng.pick(npcs);
  const goals = parseJson<string[]>(npc.goals, []);
  const goal = goals.length ? rng.pick(goals) : lang === 'de' ? 'ein wichtiges Vorhaben' : 'an important plan';
  return instantiate(ctx, worldId, player.id, template, lang, { npc, goal });
}

/** Wird aufgerufen, wenn eine Geschichte ein neues Kapitel erreicht. */
export function createStorylineDecision(ctx: AppContext, worldId: string, storyline: { id: string; title: string; stage: string }): string | null {
  const player = getActivePlayerRow(ctx, worldId);
  if (!player) return null;
  const template = templatesFor(ctx, worldId).find((t) => t.id === 'storyline')!;
  return instantiate(ctx, worldId, player.id, template, getLanguage(ctx.db), { storyline });
}

/** Bringt eine Geschichte direkt um ein Kapitel voran (z. B. durch eine Entscheidung). */
function advanceStorylineNow(ctx: AppContext, storylineId: string, lang: Lang): EventEffect | null {
  const s = get<{ id: string; world_id: string; title: string; stages: string; stage: number; status: string }>(
    ctx.db,
    'SELECT id, world_id, title, stages, stage, status FROM storylines WHERE id = ?',
    storylineId,
  );
  if (!s || s.status !== 'active') return null;
  const stages = parseJson<string[]>(s.stages, []);
  if (stages.length === 0) return null;
  const stage = Math.min(s.stage + 1, stages.length - 1);
  const resolved = stage >= stages.length - 1;
  run(ctx.db, 'UPDATE storylines SET stage = ?, status = ?, updated_at = ? WHERE id = ?', stage, resolved ? 'resolved' : 'active', ctx.now().toISOString(), s.id);
  const world = get<{ day: number; name: string }>(ctx.db, 'SELECT day, name FROM worlds WHERE id = ?', s.world_id)!;
  run(
    ctx.db,
    `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'user', ?, '[]', ?, ?)`,
    newId('e'),
    s.world_id,
    world.day,
    resolved ? 'storyline-resolved' : 'storyline',
    fill(STORYLINE_TEXT.advanceTitle[lang], { title: s.title, stage: stages[stage] }),
    fill((resolved ? STORYLINE_TEXT.resolvedDescription : STORYLINE_TEXT.advanceDescription)[lang], { title: s.title, stage: stages[stage] }),
    JSON.stringify([{ type: 'storyline', storylineId: s.id, title: s.title, stage, resolved }]),
    s.id,
    ctx.now().toISOString(),
  );
  if (resolved) notify(ctx, 'storylineResolved', { title: s.title, world: world.name }, `/worlds/${s.world_id}`, s.world_id);
  return { type: 'storyline', storylineId: s.id, title: s.title, stage, resolved };
}

const chooseSchema = z.object({ optionId: z.string().max(40) });

/** Trifft eine Entscheidung: wendet Auswirkungen an und schreibt den Storyverlauf fort. Genau einmal möglich. */
export function chooseOption(ctx: AppContext, decisionId: string, input: unknown): DecisionResult {
  const parsed = chooseSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_option', 'Ungültige Auswahl.');
  const lang = getLanguage(ctx.db);
  const result = tx(ctx.db, () => {
    const row = get<DecisionRow>(ctx.db, 'SELECT * FROM decisions WHERE id = ?', decisionId);
    if (!row) throw notFound('Entscheidung');
    if (row.status !== 'pending') throw new AppError(409, 'already_decided', 'Diese Entscheidung wurde bereits getroffen.');
    const player = getPlayerRow(ctx, row.player_id);
    if (!player.is_active) throw new AppError(409, 'player_inactive', 'Diese Entscheidung gehört zu einer Figur, die du gerade nicht spielst.');
    const option = parseJson<StoredOption[]>(row.options, []).find((o) => o.id === parsed.data.optionId);
    if (!option) throw badRequest('invalid_option', 'Diese Option gibt es nicht.');
    // Zusätzliche Lösungswege nur mit der passenden Fähigkeit.
    requireSkill(ctx, player.id, option.requires);
    const e = option.effects;
    // Die Wahl lenkt den Handlungsbogen; mit Strategie 3 zählt sie doppelt.
    if (row.storyline_id && option.arcPath) {
      const weight = (option.arcWeight ?? 1) * (skillLevels(ctx, player.id).strategy >= 3 ? SKILL_RULES.strategyArcWeight : 1);
      addArcScore(ctx, row.storyline_id, option.arcPath, weight);
    }
    const playerChar = getCharacterRow(ctx, player.character_id);
    const effects: EventEffect[] = [];

    adjustPlayerStats(ctx, player.id, { reputation: e.reputation, influence: e.influence, followers: e.followers });

    if (e.metrics) {
      const w = get<Record<WorldMetric, number>>(ctx.db, 'SELECT harmony, tension, discovery FROM worlds WHERE id = ?', row.world_id)!;
      for (const [metric, delta] of Object.entries(e.metrics) as [WorldMetric, number][]) {
        const next = clampMetric(w[metric] + delta);
        if (next !== w[metric]) effects.push({ type: 'metric', metric, delta: next - w[metric] });
        w[metric] = next;
      }
      run(ctx.db, 'UPDATE worlds SET harmony = ?, tension = ?, discovery = ? WHERE id = ?', w.harmony, w.tension, w.discovery, row.world_id);
    }

    for (const a of e.affinity ?? []) {
      if (!get(ctx.db, 'SELECT 1 FROM characters WHERE id = ?', a.characterId)) continue;
      const change = adjustAffinity(ctx, row.world_id, player.character_id, a.characterId, a.delta);
      const other = getCharacterRow(ctx, a.characterId);
      effects.push({ type: 'affinity', a: toCharacterRef(playerChar), b: toCharacterRef(other), delta: change.after - change.before, affinity: change.after });
      // Spielregel: Eine Beziehung wird erst ab der genannten Zuneigung zu einer Romanze bzw. Freundschaft.
      let kindAfter = change.kindAfter;
      if (a.becomes && a.becomes !== kindAfter && change.after >= (a.minAffinity ?? 0)) {
        setRelationshipKind(ctx, player.character_id, a.characterId, a.becomes);
        kindAfter = a.becomes;
      }
      if (kindAfter !== change.kindBefore) {
        effects.push({ type: 'relationshipKind', a: toCharacterRef(playerChar), b: toCharacterRef(other), from: change.kindBefore, to: kindAfter });
      }
    }

    let resolvedArc: string | null = null;
    if (e.storylineId) {
      const effect = advanceStorylineNow(ctx, e.storylineId, lang);
      if (effect) effects.push(effect);
      if (effect?.type === 'storyline' && effect.resolved) resolvedArc = effect.storylineId;
    }

    const world = get<{ day: number; name: string }>(ctx.db, 'SELECT day, name FROM worlds WHERE id = ?', row.world_id)!;
    const participants = parseJson<CharacterRef[]>(row.participants, []);
    const eventId = newId('e');
    run(
      ctx.db,
      `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, storyline_id, created_at)
       VALUES (?, ?, ?, 'decision', ?, ?, 'user', ?, ?, ?, ?)`,
      eventId,
      row.world_id,
      world.day,
      fill(PLAYER_TEXT.decisionTitle[lang], { player: playerChar.name, option: option.label }).slice(0, LIMITS.eventTitle),
      option.outcome.slice(0, LIMITS.eventDescription),
      JSON.stringify(effects),
      JSON.stringify([toCharacterRef(playerChar), ...participants]),
      row.storyline_id,
      ctx.now().toISOString(),
    );

    // Eine beteiligte Figur reagiert öffentlich.
    const reactor = participants.find((p) => get(ctx.db, 'SELECT 1 FROM characters WHERE id = ?', p.id));
    if (reactor) {
      const rng = createRng(`decision:${row.id}`);
      const postId = insertCharacterPost(ctx, {
        characterId: reactor.id,
        worldId: row.world_id,
        content: fill(rng.pick(DECISION_REACTIONS)[lang], {
          handle: playerChar.handle,
          world: world.name,
          tag: slugifyHandle(world.name).replace(/_/g, '') || 'socialverse',
        }),
        source: 'sim',
        eventId,
      });
      addCharacterLike(ctx, postId, reactor.id);
    }

    run(
      ctx.db,
      `UPDATE decisions SET status = 'resolved', chosen_option = ?, outcome = ?, event_id = ?, resolved_at = ? WHERE id = ?`,
      option.id,
      option.outcome,
      eventId,
      ctx.now().toISOString(),
      row.id,
    );
    // Erst nach dem Speichern der Wahl: Ende bestimmen und Beteiligte belohnen.
    if (resolvedArc) resolveArc(ctx, resolvedArc, lang);
    return { row, player };
  });

  // Folgen der Entscheidung können neue Nebenquests auslösen (z. B. Wiedergutmachung, Gefallen einfordern).
  refreshQuests(ctx, result.player.id);
  let progress = recordAction(ctx, 'decide', decisionId, result.player.id);
  const coins = grantCoins(ctx, `decision:${decisionId}`, COIN_REWARDS.decision, 'decision');
  progress = mergeDelta(progress, { xpGained: 0, coinsGained: coins, levelUp: null, achievementsUnlocked: [] });
  const decision = toDecision(get<DecisionRow>(ctx.db, 'SELECT * FROM decisions WHERE id = ?', decisionId)!, skillLevels(ctx, result.player.id));
  return { decision, player: toPlayer(ctx, getPlayerRow(ctx, result.player.id)), progress };
}
