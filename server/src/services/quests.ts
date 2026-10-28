import { LIMITS, type Lang } from '../../../shared/constants';
import { levelForXp } from '../../../shared/progress';
import type { SkillId } from '../../../shared/skills';
import type {
  ProgressDelta,
  QuestBoardDto,
  QuestDto,
  QuestKind,
  QuestMetric,
  QuestObjectiveDto,
  QuestPathDto,
  QuestRewardsDto,
} from '../../../shared/types';
import {
  EVENT_QUEST,
  MAIN_QUESTS,
  QUEST_TEXT,
  SIDE_QUESTS,
  type ObjectiveTemplate,
  type QuestTemplate,
} from '../content/questTemplates';
import type { AppContext } from '../context';
import { all, get, parseJson, run, tx } from '../db/database';
import { newId } from '../lib/ids';
import { fill, slugifyHandle } from '../lib/text';
import { createStorylineDecision } from './decisions';
import { notify } from './notifications';
import { getActivePlayerRow, getPlayerRow, toPlayer, adjustPlayerStats, type PlayerRow } from './players';
import { addCharacterLike, insertCharacterPost } from './posts';
import { currentXp, emptyDelta, finalizeDelta, grantXp } from './progress';
import { getLanguage } from './settings';
import { ensureRole, playerLevel, skillLevels } from './skills';
import { grantCoins } from './wallet';

/** Gespeichertes Ziel einer Quest (konkrete Figur/Geschichte bereits aufgelöst). */
interface StoredObjective {
  metric: QuestMetric;
  target: number;
  ref?: string;
  name?: string;
}

interface StoredPath {
  objectives: StoredObjective[];
  requires?: { skill: SkillId; level: number };
}

interface QuestRow {
  id: string;
  player_id: string;
  world_id: string;
  kind: QuestKind;
  template: string;
  dedupe_key: string;
  title: string;
  description: string;
  paths: string;
  params: string;
  stage: number;
  xp: number;
  coins: number;
  rewards: string;
  status: 'active' | 'completed' | 'expired';
  completed_path: number | null;
  created_at: string;
  completed_at: string | null;
  expires_day: number | null;
}

interface QuestParams {
  followersBase?: number;
  eventId?: string;
}

/** Ereignisarten, auf die eine Spielfigur öffentlich reagieren kann. */
const REACTABLE_EVENTS = new Set([
  'conflict',
  'rumor',
  'rivalry',
  'celebration',
  'discovery',
  'setback',
  'reconciliation',
  'friendship',
  'storyline',
  'storyline-new',
  'storyline-resolved',
  'gathering',
  'crisis',
  'mystery',
]);

function count(ctx: AppContext, sql: string, ...params: (string | number)[]): number {
  return get<{ n: number | null }>(ctx.db, sql, ...params)?.n ?? 0;
}

function affinity(ctx: AppContext, x: string, y: string): number {
  const [a, b] = x < y ? [x, y] : [y, x];
  return get<{ affinity: number }>(ctx.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b)?.affinity ?? 0;
}

/** Misst den Stand eines Ziels – ausschließlich aus gespeicherten Daten. */
function measure(ctx: AppContext, p: PlayerRow, q: Pick<QuestRow, 'created_at' | 'params'>, o: StoredObjective): number {
  const since = q.created_at;
  const params = parseJson<QuestParams>(q.params, {});
  const ref = o.ref ?? '*';
  switch (o.metric) {
    case 'posts':
      return count(ctx, 'SELECT COUNT(*) AS n FROM posts WHERE player_id = ? AND repost_of IS NULL AND created_at >= ?', p.id, since);
    case 'comments':
      return count(ctx, 'SELECT COUNT(*) AS n FROM comments WHERE player_id = ? AND created_at >= ?', p.id, since);
    case 'stories':
      return count(ctx, `SELECT COUNT(*) AS n FROM action_uses WHERE player_id = ? AND action = 'story' AND created_at >= ?`, p.id, since);
    case 'chatPartners':
      return count(
        ctx,
        `SELECT COUNT(DISTINCT cv.character_id) AS n FROM conversations cv JOIN conversation_messages m ON m.conversation_id = cv.id
          WHERE cv.player_id = ? AND m.role = 'user' AND m.created_at >= ?`,
        p.id,
        since,
      );
    case 'chatWith':
      return count(
        ctx,
        `SELECT COUNT(*) AS n FROM conversations cv JOIN conversation_messages m ON m.conversation_id = cv.id
          WHERE cv.player_id = ? AND cv.character_id = ? AND m.role = 'user' AND m.created_at >= ?`,
        p.id,
        ref,
        since,
      );
    case 'affinityWith':
      return affinity(ctx, p.character_id, ref);
    case 'allies':
    case 'friends':
      return count(
        ctx,
        'SELECT COUNT(*) AS n FROM relationships WHERE (a_id = ? OR b_id = ?) AND affinity >= ?',
        p.character_id,
        p.character_id,
        o.metric === 'allies' ? 30 : 65,
      );
    case 'followersGain':
      return Math.max(0, p.followers - (params.followersBase ?? p.followers));
    case 'reputation':
      return p.reputation;
    case 'influence':
      return p.influence;
    case 'decisions':
      return count(ctx, `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'resolved' AND resolved_at >= ?`, p.id, since);
    case 'arcDecisions':
      return ref === '*'
        ? count(
            ctx,
            `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'resolved' AND storyline_id IS NOT NULL AND resolved_at >= ?`,
            p.id,
            since,
          )
        : count(
            ctx,
            `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND status = 'resolved' AND storyline_id = ? AND resolved_at >= ?`,
            p.id,
            ref,
            since,
          );
    case 'arcResolved':
      return ref === '*'
        ? count(
            ctx,
            `SELECT COUNT(*) AS n FROM storylines s WHERE s.world_id = ? AND s.status = 'resolved' AND s.updated_at >= ?
               AND EXISTS (SELECT 1 FROM decisions d WHERE d.storyline_id = s.id AND d.player_id = ? AND d.status = 'resolved')`,
            p.world_id,
            since,
            p.id,
          )
        : count(ctx, `SELECT COUNT(*) AS n FROM storylines WHERE id = ? AND status = 'resolved'`, ref);
    case 'cooperations':
      return count(ctx, `SELECT COUNT(*) AS n FROM action_uses WHERE player_id = ? AND action = 'cooperate' AND created_at >= ?`, p.id, since);
    case 'cooperatedWith':
      return count(ctx, `SELECT COUNT(*) AS n FROM action_uses WHERE player_id = ? AND action = 'cooperate' AND ref = ?`, p.id, ref);
    case 'negotiatedWith':
      return count(
        ctx,
        `SELECT COUNT(*) AS n FROM action_uses WHERE player_id = ? AND action = 'negotiate' AND ref = ? AND created_at >= ?`,
        p.id,
        ref,
        since,
      );
    case 'endorsements':
      return count(ctx, `SELECT COUNT(*) AS n FROM action_uses WHERE player_id = ? AND action = 'endorse' AND created_at >= ?`, p.id, since);
    case 'eventReaction': {
      const eventFilter = ref === '*' ? 'IS NOT NULL' : '= ?';
      const eventArgs = ref === '*' ? [] : [ref];
      return (
        count(
          ctx,
          `SELECT COUNT(*) AS n FROM posts WHERE player_id = ? AND event_id ${eventFilter} AND created_at >= ?`,
          p.id,
          ...eventArgs,
          since,
        ) +
        count(
          ctx,
          `SELECT COUNT(*) AS n FROM comments cm JOIN posts p ON p.id = cm.post_id
            WHERE cm.player_id = ? AND p.event_id ${eventFilter} AND cm.created_at >= ?`,
          p.id,
          ...eventArgs,
          since,
        )
      );
    }
    case 'likesReceived':
      return count(
        ctx,
        `SELECT COUNT(*) AS n FROM character_likes cl JOIN posts p ON p.id = cl.post_id WHERE p.player_id = ? AND cl.created_at >= ?`,
        p.id,
        since,
      );
  }
}

function evaluatePaths(
  ctx: AppContext,
  p: PlayerRow,
  q: QuestRow,
  skills: Record<SkillId, number>,
): { paths: QuestPathDto[]; completedPath: number | null; progress: number } {
  const stored = parseJson<StoredPath[]>(q.paths, []);
  let completedPath: number | null = null;
  let progress = 0;
  const paths = stored.map((path, index) => {
    const locked = Boolean(path.requires && skills[path.requires.skill] < path.requires.level);
    const objectives: QuestObjectiveDto[] = path.objectives.map((o) => {
      const current = measure(ctx, p, q, o);
      return { metric: o.metric, target: o.target, current, done: current >= o.target, name: o.name };
    });
    const ratio =
      objectives.reduce((sum, o) => {
        // Negative Zielwerte (z. B. Zuneigung -15) werden über den Abstand bewertet.
        if (o.done) return sum + 1;
        if (o.target <= 0) return sum + Math.max(0, Math.min(1, 1 - (o.target - o.current) / 100));
        return sum + Math.max(0, Math.min(1, o.current / o.target));
      }, 0) / Math.max(1, objectives.length);
    if (!locked) progress = Math.max(progress, ratio);
    if (!locked && completedPath === null && objectives.every((o) => o.done)) completedPath = index;
    return { objectives, requires: path.requires, locked };
  });
  return { paths, completedPath, progress: completedPath !== null ? 1 : progress };
}

function toQuest(ctx: AppContext, p: PlayerRow, q: QuestRow, skills: Record<SkillId, number>): QuestDto {
  const evaluated = evaluatePaths(ctx, p, q, skills);
  const params = parseJson<QuestParams>(q.params, {});
  return {
    id: q.id,
    kind: q.kind,
    title: q.title,
    description: q.description,
    stage: q.stage,
    stages: q.kind === 'main' ? LIMITS.mainQuestStages : 1,
    paths: evaluated.paths,
    xp: q.xp,
    coins: q.coins,
    rewards: parseJson<QuestRewardsDto>(q.rewards, {}),
    status: q.status,
    progress: q.status === 'completed' ? 1 : evaluated.progress,
    createdAt: q.created_at,
    completedAt: q.completed_at,
    expiresDay: q.expires_day,
    eventId: params.eventId ?? null,
  };
}

// ---------- Erzeugung ----------

interface Npc {
  id: string;
  name: string;
  prominent: number;
  affinity: number;
}

/** Figuren der Welt (ohne gesteuerte) mit ihrer Zuneigung zur Spielfigur. */
function npcsWithAffinity(ctx: AppContext, p: PlayerRow): Npc[] {
  return all<Npc>(
    ctx.db,
    `SELECT c.id, c.name, c.prominent,
            COALESCE((SELECT r.affinity FROM relationships r
                       WHERE (r.a_id = c.id AND r.b_id = ?) OR (r.b_id = c.id AND r.a_id = ?)), 0) AS affinity
       FROM characters c
      WHERE c.world_id = ? AND c.id != ? AND c.is_player = 0
        AND NOT EXISTS (SELECT 1 FROM players pl WHERE pl.character_id = c.id AND pl.is_active = 1)
      ORDER BY c.id`,
    p.character_id,
    p.character_id,
    p.world_id,
    p.character_id,
  );
}

interface Vars {
  world: string;
  role: string;
  player: string;
  npc?: Npc;
  rival?: Npc;
  storyline?: { id: string; title: string };
  event?: { id: string; title: string };
}

function resolveObjective(ctx: AppContext, p: PlayerRow, o: ObjectiveTemplate, vars: Vars): StoredObjective {
  const target = o.ref === 'npc' ? vars.npc : o.ref === 'rival' ? vars.rival : undefined;
  if (target) {
    const base = o.relative ? affinity(ctx, p.character_id, target.id) : 0;
    return { metric: o.metric, target: Math.min(100, base + o.target), ref: target.id, name: target.name };
  }
  if (o.ref === 'storyline' && vars.storyline) return { metric: o.metric, target: o.target, ref: vars.storyline.id, name: vars.storyline.title };
  if (o.ref === 'event' && vars.event) return { metric: o.metric, target: o.target, ref: vars.event.id, name: vars.event.title };
  return { metric: o.metric, target: o.target, ref: o.ref === '*' ? '*' : undefined };
}

function insertQuest(
  ctx: AppContext,
  p: PlayerRow,
  kind: QuestKind,
  template: QuestTemplate,
  dedupeKey: string,
  vars: Vars,
  lang: Lang,
  extra: { stage?: number; expiresDay?: number | null; eventId?: string } = {},
): boolean {
  const text = {
    world: vars.world,
    role: vars.role,
    player: vars.player,
    npc: vars.npc?.name ?? '',
    rival: vars.rival?.name ?? QUEST_TEXT.noRival[lang],
    storyline: vars.storyline?.title ?? '',
    event: vars.event?.title ?? '',
  };
  const paths: StoredPath[] = template.paths.map((path) => ({
    objectives: path.objectives.map((o) => resolveObjective(ctx, p, o, vars)),
    requires: path.requires,
  }));
  const params: QuestParams = { followersBase: p.followers, eventId: extra.eventId };
  const inserted = run(
    ctx.db,
    `INSERT OR IGNORE INTO quests (id, player_id, world_id, kind, template, dedupe_key, title, description, paths, params, stage,
                                   xp, coins, rewards, status, created_at, expires_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    newId('q'),
    p.id,
    p.world_id,
    kind,
    template.id,
    dedupeKey,
    fill(template.title[lang], text).slice(0, LIMITS.eventTitle),
    fill(template.description[lang], text).slice(0, LIMITS.eventDescription),
    JSON.stringify(paths),
    JSON.stringify(params),
    extra.stage ?? 0,
    template.xp,
    template.coins,
    JSON.stringify(template.rewards),
    ctx.now().toISOString(),
    extra.expiresDay ?? null,
  );
  return inserted.changes > 0;
}

function activeCount(ctx: AppContext, playerId: string, kind: QuestKind): number {
  return count(ctx, `SELECT COUNT(*) AS n FROM quests WHERE player_id = ? AND kind = ? AND status = 'active'`, playerId, kind);
}

function exists(ctx: AppContext, playerId: string, key: string): boolean {
  return Boolean(get(ctx.db, 'SELECT 1 FROM quests WHERE player_id = ? AND dedupe_key = ?', playerId, key));
}

/**
 * Hält die Questliste einer Spielfigur aktuell: Hauptquest passend zu Rolle und Ziel, bis zu drei Nebenquests aus der
 * aktuellen Lage (Rivalitäten, Kooperationsmöglichkeiten, frühere Entscheidungen, laufende Geschichten) und eine
 * Ereignisquest zu einem aktuellen Weltereignis.
 */
export function refreshQuests(ctx: AppContext, playerId: string): void {
  const p = getPlayerRow(ctx, playerId);
  if (!p.is_active) return;
  const { goalType } = ensureRole(ctx, p);
  const lang = getLanguage(ctx.db);
  const world = get<{ name: string; day: number }>(ctx.db, 'SELECT name, day FROM worlds WHERE id = ?', p.world_id)!;
  const character = get<{ name: string; role: string }>(ctx.db, 'SELECT name, role FROM characters WHERE id = ?', p.character_id)!;
  const base: Vars = { world: world.name, role: character.role || (lang === 'de' ? 'Neuankömmling' : 'newcomer'), player: character.name };
  const npcs = npcsWithAffinity(ctx, p);
  const rival = [...npcs].filter((n) => n.affinity <= -10).sort((a, b) => a.affinity - b.affinity)[0];

  tx(ctx.db, () => {
    // Abgelaufene Ereignisquests
    run(
      ctx.db,
      `UPDATE quests SET status = 'expired' WHERE player_id = ? AND kind = 'event' AND status = 'active' AND expires_day < ?`,
      p.id,
      world.day,
    );

    // Hauptquest: nächste Stufe der Kette. Für Rivalitäten wird eine echte Rivalin/ein echter Rivale benötigt.
    const doneMain = count(ctx, `SELECT COUNT(*) AS n FROM quests WHERE player_id = ? AND kind = 'main' AND status = 'completed'`, p.id);
    if (activeCount(ctx, p.id, 'main') === 0 && doneMain < LIMITS.mainQuestStages) {
      const previousRival = get<{ paths: string }>(
        ctx.db,
        `SELECT paths FROM quests WHERE player_id = ? AND kind = 'main' AND template LIKE 'rival-%' ORDER BY created_at LIMIT 1`,
        p.id,
      );
      const previousRivalId = previousRival
        ? parseJson<StoredPath[]>(previousRival.paths, [])[0]?.objectives.find((o) => o.ref && o.ref !== '*')?.ref
        : undefined;
      const chainRival = (previousRivalId && npcs.find((n) => n.id === previousRivalId)) || rival;
      const chain = goalType === 'rivalry' && !chainRival ? MAIN_QUESTS.relationships : MAIN_QUESTS[goalType];
      const template = chain[doneMain];
      insertQuest(ctx, p, 'main', template, `main:${doneMain + 1}`, { ...base, rival: chainRival }, lang, { stage: doneMain + 1 });
    }

    // Nebenquests aus der aktuellen Lage
    // priority: Folgen eigener Entscheidungen erscheinen auch, wenn schon drei Nebenquests laufen (eine mehr erlaubt).
    const candidates: { key: string; template: QuestTemplate; vars: Vars; onCreate?: () => void; priority?: boolean }[] = [];
    if (count(ctx, 'SELECT COUNT(*) AS n FROM posts WHERE player_id = ?', p.id) === 0) {
      candidates.push({ key: 'introduce', template: SIDE_QUESTS.introduce, vars: base });
    }
    if (rival) candidates.push({ key: `rival:${rival.id}`, template: SIDE_QUESTS.rival, vars: { ...base, npc: rival } });
    // Folgen der letzten Entscheidung
    const last = get<{ options: string; chosen_option: string }>(
      ctx.db,
      `SELECT options, chosen_option FROM decisions WHERE player_id = ? AND status = 'resolved' ORDER BY resolved_at DESC LIMIT 1`,
      p.id,
    );
    if (last) {
      const chosen = parseJson<{ id: string; effects: { affinity?: { characterId: string; delta: number }[] } }[]>(last.options, []).find(
        (o) => o.id === last.chosen_option,
      );
      for (const a of chosen?.effects.affinity ?? []) {
        const npc = npcs.find((n) => n.id === a.characterId);
        if (!npc) continue;
        if (a.delta <= -8) candidates.push({ key: `reconcile:${npc.id}`, template: SIDE_QUESTS.reconcile, vars: { ...base, npc }, priority: true });
        if (a.delta >= 10) candidates.push({ key: `favor:${npc.id}`, template: SIDE_QUESTS.favor, vars: { ...base, npc }, priority: true });
      }
    }
    const partner = npcs.filter((n) => n.affinity >= 20 && n.affinity < 100).sort((a, b) => b.affinity - a.affinity)[0];
    if (partner) candidates.push({ key: `coop:${partner.id}`, template: SIDE_QUESTS.coop, vars: { ...base, npc: partner } });
    const storyline = get<{ id: string; title: string; stages: string; stage: number }>(
      ctx.db,
      `SELECT id, title, stages, stage FROM storylines WHERE world_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`,
      p.world_id,
    );
    if (storyline) {
      candidates.push({
        key: `arc:${storyline.id}`,
        template: SIDE_QUESTS.arc,
        vars: { ...base, storyline },
        // Damit die Quest lösbar ist, steht eine passende Entscheidung bereit.
        onCreate: () => {
          const pending = count(
            ctx,
            `SELECT COUNT(*) AS n FROM decisions WHERE player_id = ? AND storyline_id = ? AND status = 'pending'`,
            p.id,
            storyline.id,
          );
          const stage = parseJson<string[]>(storyline.stages, [])[storyline.stage] ?? '';
          if (pending === 0) createStorylineDecision(ctx, p.world_id, { id: storyline.id, title: storyline.title, stage });
        },
      });
    }
    const unknown = npcs.find(
      (n) =>
        n.prominent &&
        !get(ctx.db, 'SELECT 1 FROM conversations WHERE player_id = ? AND character_id = ?', p.id, n.id),
    );
    if (unknown) candidates.push({ key: `contact:${unknown.id}`, template: SIDE_QUESTS.contact, vars: { ...base, npc: unknown } });
    if (count(ctx, 'SELECT COUNT(*) AS n FROM posts WHERE player_id = ?', p.id) > 0) {
      candidates.push({ key: `buzz:${world.day}`, template: SIDE_QUESTS.buzz, vars: base });
    }

    for (const c of candidates) {
      if (activeCount(ctx, p.id, 'side') >= LIMITS.maxSideQuests + (c.priority ? 1 : 0)) continue;
      if (exists(ctx, p.id, c.key)) continue;
      if (insertQuest(ctx, p, 'side', c.template, c.key, c.vars, lang)) c.onCreate?.();
    }

    // Ereignisquest zu einem aktuellen Ereignis, an dem die Spielfigur nicht selbst beteiligt war
    if (activeCount(ctx, p.id, 'event') === 0) {
      const events = all<{ id: string; title: string; kind: string; participants: string }>(
        ctx.db,
        `SELECT id, title, kind, participants FROM world_events
          WHERE world_id = ? AND created_at >= ? AND day >= ? ORDER BY created_at DESC LIMIT 10`,
        p.world_id,
        p.joined_at,
        world.day - 1,
      );
      const event = events.find(
        (e) =>
          REACTABLE_EVENTS.has(e.kind) &&
          !parseJson<{ id: string }[]>(e.participants, []).some((x) => x.id === p.character_id) &&
          !exists(ctx, p.id, `event:${e.id}`),
      );
      if (event) {
        insertQuest(ctx, p, 'event', EVENT_QUEST, `event:${event.id}`, { ...base, event }, lang, {
          expiresDay: world.day + 2,
          eventId: event.id,
        });
      }
    }
  });
}

// ---------- Abschluss ----------

function completionEffects(ctx: AppContext, p: PlayerRow, q: QuestRow, lang: Lang): void {
  if (q.kind !== 'main') return;
  // Meilenstein der Hauptquest: Weltereignis und öffentliche Reaktion einer verbundenen Figur.
  const character = get<{ name: string; handle: string; avatar_hue: number; avatar_glyph: string }>(
    ctx.db,
    'SELECT name, handle, avatar_hue, avatar_glyph FROM characters WHERE id = ?',
    p.character_id,
  )!;
  const world = get<{ name: string; day: number }>(ctx.db, 'SELECT name, day FROM worlds WHERE id = ?', p.world_id)!;
  const vars = { player: character.name, quest: q.title, handle: character.handle, world: world.name };
  const eventId = newId('e');
  run(
    ctx.db,
    `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, created_at)
     VALUES (?, ?, ?, 'milestone', ?, ?, 'user', '[]', ?, ?)`,
    eventId,
    p.world_id,
    world.day,
    fill(QUEST_TEXT.milestoneTitle[lang], vars).slice(0, LIMITS.eventTitle),
    fill(QUEST_TEXT.milestoneDescription[lang], vars),
    JSON.stringify([{ id: p.character_id, name: character.name, avatarHue: character.avatar_hue, avatarGlyph: character.avatar_glyph }]),
    ctx.now().toISOString(),
  );
  const npcs = npcsWithAffinity(ctx, p);
  const friend = [...npcs].sort((a, b) => b.affinity - a.affinity)[0];
  if (friend) {
    const tag = slugifyHandle(world.name).replace(/_/g, '') || 'socialverse';
    const postId = insertCharacterPost(ctx, {
      characterId: friend.id,
      worldId: p.world_id,
      content: fill(QUEST_TEXT.milestonePost[lang], { ...vars, tag }),
      source: 'sim',
      eventId,
    });
    addCharacterLike(ctx, postId, friend.id);
  }
}

/**
 * Prüft alle aktiven Quests einer Spielfigur und schließt erfüllte ab. Belohnungen werden genau einmal vergeben:
 * Der Statuswechsel erfolgt nur, wenn die Quest noch aktiv ist, und XP/Funken haben eindeutige Schlüssel.
 */
export function evaluateQuests(ctx: AppContext, playerId: string): ProgressDelta {
  const lang = getLanguage(ctx.db);
  let delta = emptyDelta();
  let completedAny = false;
  tx(ctx.db, () => {
    const levelBefore = levelForXp(currentXp(ctx));
    const playerBefore = playerLevel(ctx, playerId);
    let gained = 0;
    let coins = 0;
    const completed: NonNullable<ProgressDelta['questsCompleted']> = [];
    const p = getPlayerRow(ctx, playerId);
    if (!p.is_active) return;
    const skills = skillLevels(ctx, playerId);
    for (const q of all<QuestRow>(ctx.db, `SELECT * FROM quests WHERE player_id = ? AND status = 'active' ORDER BY created_at`, playerId)) {
      const current = getPlayerRow(ctx, playerId);
      const { completedPath } = evaluatePaths(ctx, current, q, skills);
      if (completedPath === null) continue;
      const updated = run(
        ctx.db,
        `UPDATE quests SET status = 'completed', completed_path = ?, completed_at = ? WHERE id = ? AND status = 'active'`,
        completedPath,
        ctx.now().toISOString(),
        q.id,
      );
      if (updated.changes === 0) continue;
      gained += grantXp(ctx, `quest:${q.id}`, 'quest', q.xp, playerId);
      coins += grantCoins(ctx, `quest:${q.id}`, q.coins, `quest:${q.template}`);
      const rewards = parseJson<QuestRewardsDto>(q.rewards, {});
      adjustPlayerStats(ctx, playerId, rewards);
      completionEffects(ctx, current, q, lang);
      notify(ctx, q.kind === 'main' ? 'mainQuestCompleted' : 'questCompleted', { title: q.title, xp: q.xp }, '/tasks', q.world_id);
      completed.push({ id: q.id, kind: q.kind, title: q.title, xp: q.xp });
      completedAny = true;
    }
    if (completed.length === 0) return;
    delta = finalizeDelta(ctx, levelBefore, gained, coins);
    delta.questsCompleted = completed;
    const playerAfter = playerLevel(ctx, playerId);
    if (playerAfter > playerBefore) {
      delta.playerLevelUp = playerAfter;
      notify(ctx, 'playerLevelUp', { level: playerAfter }, '/skills', p.world_id);
    }
  });
  // Neue Stufe der Hauptquest und neue Nebenquests nachziehen.
  if (completedAny) refreshQuests(ctx, playerId);
  return delta;
}

/** Quest-Übersicht der aktiven Spielfigur einer Welt (prüft und ergänzt dabei die Quests). */
export function getQuestBoard(ctx: AppContext, worldId: string, playerRow?: PlayerRow): QuestBoardDto & { progress: ProgressDelta } {
  const p = playerRow ?? getActivePlayerRow(ctx, worldId);
  if (!p) throw new Error('no player');
  refreshQuests(ctx, p.id);
  const progress = evaluateQuests(ctx, p.id);
  const fresh = getPlayerRow(ctx, p.id);
  const skills = skillLevels(ctx, p.id);
  const rows = all<QuestRow>(
    ctx.db,
    `SELECT * FROM quests WHERE player_id = ? ORDER BY status = 'active' DESC, COALESCE(completed_at, created_at) DESC`,
    p.id,
  );
  const quests = rows.map((r) => toQuest(ctx, fresh, r, skills));
  const world = get<{ day: number }>(ctx.db, 'SELECT day FROM worlds WHERE id = ?', p.world_id)!;
  return {
    player: toPlayer(ctx, fresh),
    worldDay: world.day,
    main: quests.find((q) => q.kind === 'main' && q.status === 'active') ?? null,
    side: quests.filter((q) => q.kind === 'side' && q.status === 'active'),
    events: quests.filter((q) => q.kind === 'event' && q.status === 'active'),
    completed: quests.filter((q) => q.status === 'completed').slice(0, 20),
    mainStagesCompleted: quests.filter((q) => q.kind === 'main' && q.status === 'completed').length,
    progress,
  };
}

/** Für Tests und Simulation: Quests der aktiven Spielfigur einer Welt nachziehen (falls vorhanden). */
export function refreshWorldQuests(ctx: AppContext, worldId: string): void {
  const p = getActivePlayerRow(ctx, worldId);
  if (p) {
    refreshQuests(ctx, p.id);
    evaluateQuests(ctx, p.id);
  }
}
